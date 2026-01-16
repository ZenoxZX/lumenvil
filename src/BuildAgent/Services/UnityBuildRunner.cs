using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using BuildAgent.Models;

namespace BuildAgent.Services;

public class UnityBuildRunner
{
    private readonly ILogger<UnityBuildRunner> _logger;
    private readonly AgentHubClient _hubClient;
    private readonly IGitService _gitService;
    private readonly string _unityHubPath;
    private readonly string _buildOutputBase;
    private readonly string _workspacePath;

    public UnityBuildRunner(
        ILogger<UnityBuildRunner> logger,
        AgentHubClient hubClient,
        IGitService gitService,
        string? unityHubPath = null,
        string? buildOutputBase = null,
        string? workspacePath = null)
    {
        _logger = logger;
        _hubClient = hubClient;
        _gitService = gitService;
        _unityHubPath = unityHubPath ?? @"C:\Program Files\Unity\Hub\Editor";
        _buildOutputBase = buildOutputBase ?? @"D:\Builds";
        _workspacePath = workspacePath ?? @"D:\Workspaces";
    }

    public async Task<bool> RunBuildAsync(BuildJob job, CancellationToken cancellationToken)
    {
        var buildId = job.BuildId;
        var outputPath = Path.Combine(_buildOutputBase, job.ProjectName, $"Build_{job.BuildNumber}");
        var projectPath = job.BuildPath;

        try
        {
            // Step 1: Git operations if GitUrl is provided
            if (!string.IsNullOrEmpty(job.GitUrl))
            {
                var targetPath = Path.Combine(_workspacePath, job.ProjectName);

                _logger.LogInformation("Git URL provided, ensuring repository at {Path}", targetPath);

                var gitResult = await _gitService.EnsureRepositoryAsync(
                    buildId,
                    job.GitUrl,
                    targetPath,
                    job.Branch,
                    cancellationToken);

                if (!gitResult.Success)
                {
                    await _hubClient.AddBuildLogAsync(buildId, "Error", $"Git operation failed: {gitResult.ErrorMessage}", "Clone");
                    await _hubClient.BuildCompletedAsync(buildId, false);
                    return false;
                }

                // Update project path to cloned repository
                projectPath = targetPath;

                // Get and report commit hash
                var commitHash = await _gitService.GetCurrentCommitHashAsync(projectPath);
                if (!string.IsNullOrEmpty(commitHash))
                {
                    await _hubClient.AddBuildLogAsync(buildId, "Info", $"Building commit: {commitHash}", "Clone");
                    await _hubClient.UpdateBuildCommitHashAsync(buildId, commitHash);
                }
            }

            // Step 2: Unity build
            await _hubClient.UpdateBuildStatusAsync(buildId, "Building");
            await _hubClient.AddBuildLogAsync(buildId, "Info", "Starting Unity build...", "Build");

            // Find Unity Editor
            var unityPath = FindUnityEditor(job.UnityVersion);
            if (unityPath == null)
            {
                await _hubClient.AddBuildLogAsync(buildId, "Error", $"Unity version {job.UnityVersion} not found", "Build");
                await _hubClient.BuildCompletedAsync(buildId, false);
                return false;
            }

            await _hubClient.AddBuildLogAsync(buildId, "Info", $"Using Unity: {unityPath}", "Build");

            // Ensure output directory exists
            Directory.CreateDirectory(outputPath);

            // Build arguments - use the potentially updated projectPath
            var buildTargetPath = Path.Combine(outputPath, $"{job.ProjectName}.exe");
            var logPath = Path.Combine(outputPath, "build.log");

            var args = new List<string>
            {
                "-quit",
                "-batchmode",
                "-nographics",
                "-projectPath", $"\"{projectPath}\"",
                "-buildTarget", "Win64",
                "-executeMethod", "BuildScript.BuildWindows",
                $"-outputPath", $"\"{buildTargetPath}\"",
                $"-scriptingBackend", job.ScriptingBackend,
                "-logFile", $"\"{logPath}\""
            };

            var startInfo = new ProcessStartInfo
            {
                FileName = unityPath,
                Arguments = string.Join(" ", args),
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            _logger.LogInformation("Starting Unity build: {Args}", startInfo.Arguments);
            await _hubClient.AddBuildLogAsync(buildId, "Info", $"Build command: Unity {string.Join(" ", args)}", "Build");

            using var process = new Process { StartInfo = startInfo };

            // Monitor log file for progress
            var logMonitorTask = MonitorLogFileAsync(buildId, logPath, cancellationToken);

            process.Start();

            // Wait for process to exit or cancellation
            while (!process.HasExited)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    process.Kill(true);
                    await _hubClient.AddBuildLogAsync(buildId, "Warning", "Build cancelled by user", "Build");
                    await _hubClient.UpdateBuildStatusAsync(buildId, "Cancelled");
                    return false;
                }
                await Task.Delay(1000, cancellationToken);
            }

            // Give log monitor time to finish
            await Task.Delay(2000, cancellationToken);

            var success = process.ExitCode == 0;

            if (success)
            {
                var buildSize = GetDirectorySize(outputPath);
                await _hubClient.AddBuildLogAsync(buildId, "Info", $"Build completed successfully. Size: {FormatSize(buildSize)}", "Build");
                await _hubClient.BuildCompletedAsync(buildId, true, outputPath, buildSize);
            }
            else
            {
                // Read last lines from log file for error
                var errorMessage = await GetBuildErrorAsync(logPath);
                await _hubClient.AddBuildLogAsync(buildId, "Error", $"Build failed with exit code {process.ExitCode}: {errorMessage}", "Build");
                await _hubClient.BuildCompletedAsync(buildId, false);
            }

            return success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Build failed with exception");
            await _hubClient.AddBuildLogAsync(buildId, "Error", $"Build exception: {ex.Message}", "Build");
            await _hubClient.BuildCompletedAsync(buildId, false);
            return false;
        }
    }

    private string? FindUnityEditor(string version)
    {
        var versionPath = Path.Combine(_unityHubPath, version, "Editor", "Unity.exe");
        if (File.Exists(versionPath))
        {
            return versionPath;
        }

        // Try to find any matching version
        if (Directory.Exists(_unityHubPath))
        {
            var directories = Directory.GetDirectories(_unityHubPath);
            var match = directories.FirstOrDefault(d => Path.GetFileName(d).StartsWith(version.Split('.')[0]));
            if (match != null)
            {
                var editorPath = Path.Combine(match, "Editor", "Unity.exe");
                if (File.Exists(editorPath))
                {
                    return editorPath;
                }
            }
        }

        return null;
    }

    private async Task MonitorLogFileAsync(Guid buildId, string logPath, CancellationToken cancellationToken)
    {
        var lastPosition = 0L;
        var progressRegex = new Regex(@"\[(\d+)/(\d+)\]|(\d+)%|Building.*?(\d+)/(\d+)", RegexOptions.Compiled);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                if (File.Exists(logPath))
                {
                    using var fs = new FileStream(logPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    fs.Seek(lastPosition, SeekOrigin.Begin);

                    using var reader = new StreamReader(fs);
                    string? line;
                    while ((line = await reader.ReadLineAsync()) != null)
                    {
                        if (!string.IsNullOrWhiteSpace(line))
                        {
                            var level = "Info";
                            if (line.Contains("error", StringComparison.OrdinalIgnoreCase))
                                level = "Error";
                            else if (line.Contains("warning", StringComparison.OrdinalIgnoreCase))
                                level = "Warning";

                            // Only log important lines
                            if (level != "Info" ||
                                line.Contains("Building") ||
                                line.Contains("Compiling") ||
                                line.Contains("Scripts") ||
                                line.Contains("Assets") ||
                                progressRegex.IsMatch(line))
                            {
                                await _hubClient.AddBuildLogAsync(buildId, level, line, "Build");
                            }

                            // Parse and send progress
                            var match = progressRegex.Match(line);
                            if (match.Success)
                            {
                                int progress = 0;
                                if (match.Groups[1].Success && match.Groups[2].Success)
                                {
                                    var current = int.Parse(match.Groups[1].Value);
                                    var total = int.Parse(match.Groups[2].Value);
                                    progress = (int)((current / (double)total) * 100);
                                }
                                else if (match.Groups[3].Success)
                                {
                                    progress = int.Parse(match.Groups[3].Value);
                                }

                                await _hubClient.SendBuildProgressAsync(buildId, "Build", progress, line);
                            }
                        }
                    }

                    lastPosition = fs.Position;
                }

                await Task.Delay(500, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error reading log file");
                await Task.Delay(1000, cancellationToken);
            }
        }
    }

    private static async Task<string> GetBuildErrorAsync(string logPath)
    {
        if (!File.Exists(logPath))
            return "Log file not found";

        try
        {
            var lines = await File.ReadAllLinesAsync(logPath);
            var errorLines = lines
                .Where(l => l.Contains("error", StringComparison.OrdinalIgnoreCase))
                .TakeLast(5)
                .ToList();

            return errorLines.Any()
                ? string.Join(Environment.NewLine, errorLines)
                : "Unknown error";
        }
        catch
        {
            return "Could not read error from log";
        }
    }

    private static long GetDirectorySize(string path)
    {
        if (!Directory.Exists(path))
            return 0;

        return new DirectoryInfo(path)
            .EnumerateFiles("*", SearchOption.AllDirectories)
            .Sum(f => f.Length);
    }

    private static string FormatSize(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        int order = 0;
        double size = bytes;
        while (size >= 1024 && order < sizes.Length - 1)
        {
            order++;
            size /= 1024;
        }
        return $"{size:0.##} {sizes[order]}";
    }
}
