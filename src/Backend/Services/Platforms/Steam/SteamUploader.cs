using System.Diagnostics;
using System.Text.RegularExpressions;
using Backend.Models;

namespace Backend.Services.Platforms.Steam;

public class SteamUploader : IPlatformUploader
{
    private readonly ILogger<SteamUploader> _logger;
    private readonly SteamConfig _config;
    private readonly SteamVdfGenerator _vdfGenerator;

    public PlatformType Platform => PlatformType.Steam;
    public string PlatformName => "Steam";

    public SteamUploader(ILogger<SteamUploader> logger, SteamConfig config)
    {
        _logger = logger;
        _config = config;
        _vdfGenerator = new SteamVdfGenerator();
    }

    public async Task<UploadResult> UploadAsync(
        BuildArtifact artifact,
        CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return new UploadResult(false, "Steam is not configured");
        }

        if (string.IsNullOrEmpty(artifact.AppId) || string.IsNullOrEmpty(artifact.DepotId))
        {
            return new UploadResult(false, "Steam AppId and DepotId are required");
        }

        if (!Directory.Exists(artifact.OutputPath))
        {
            return new UploadResult(false, $"Build output path not found: {artifact.OutputPath}");
        }

        try
        {
            // Generate VDF file
            var vdfPath = Path.Combine(artifact.OutputPath, "app_build.vdf");
            var vdfContent = _vdfGenerator.GenerateAppBuild(
                artifact.AppId,
                artifact.DepotId,
                $"Build #{artifact.BuildNumber}",
                artifact.OutputPath,
                artifact.Branch ?? _config.DefaultBranch ?? "default"
            );
            await File.WriteAllTextAsync(vdfPath, vdfContent, cancellationToken);

            _logger.LogInformation("Generated VDF file at {VdfPath}", vdfPath);

            // Run SteamCMD
            var result = await RunSteamCmdAsync(vdfPath, cancellationToken);

            if (result.Success)
            {
                // Try to extract build ID from output
                var buildId = ExtractBuildId(result.Output);
                var uploadedSize = GetDirectorySize(artifact.OutputPath);

                return new UploadResult(
                    true,
                    "Upload completed successfully",
                    buildId,
                    uploadedSize,
                    DateTime.UtcNow
                );
            }
            else
            {
                return new UploadResult(false, result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload to Steam");
            return new UploadResult(false, ex.Message);
        }
    }

    public Task<(bool IsValid, string? ErrorMessage)> ValidateConfigAsync()
    {
        if (string.IsNullOrEmpty(_config.Username))
        {
            return Task.FromResult<(bool IsValid, string? ErrorMessage)>((false, "Steam username is required"));
        }

        if (string.IsNullOrEmpty(_config.Password))
        {
            return Task.FromResult<(bool IsValid, string? ErrorMessage)>((false, "Steam password is required"));
        }

        var steamCmdPath = GetSteamCmdPath();
        if (steamCmdPath == null)
        {
            return Task.FromResult<(bool IsValid, string? ErrorMessage)>((false, "SteamCMD not found. Please install SteamCMD or configure the path."));
        }

        return Task.FromResult<(bool IsValid, string? ErrorMessage)>((true, null));
    }

    public async Task<(bool Success, string? Message)> TestConnectionAsync()
    {
        var validation = await ValidateConfigAsync();
        if (!validation.IsValid)
        {
            return (false, validation.ErrorMessage);
        }

        try
        {
            // Test login with SteamCMD
            var steamCmdPath = GetSteamCmdPath()!;
            var args = $"+login {_config.Username} {_config.Password} +quit";

            var result = await RunProcessAsync(steamCmdPath, args, TimeSpan.FromSeconds(60));

            if (result.ExitCode == 0 || result.Output.Contains("Logged in OK"))
            {
                return (true, "Successfully connected to Steam");
            }
            else if (result.Output.Contains("Steam Guard"))
            {
                return (false, "Steam Guard code required. Please configure Steam Guard or use an app-specific password.");
            }
            else
            {
                return (false, $"Login failed: {result.ErrorOutput}");
            }
        }
        catch (Exception ex)
        {
            return (false, $"Connection test failed: {ex.Message}");
        }
    }

    private async Task<(bool Success, string? ErrorMessage, string Output)> RunSteamCmdAsync(
        string vdfPath,
        CancellationToken cancellationToken)
    {
        var steamCmdPath = GetSteamCmdPath();
        if (steamCmdPath == null)
        {
            return (false, "SteamCMD not found", string.Empty);
        }

        var args = $"+login {_config.Username} {_config.Password} +run_app_build \"{vdfPath}\" +quit";

        _logger.LogInformation("Running SteamCMD for upload...");

        var result = await RunProcessAsync(steamCmdPath, args, TimeSpan.FromMinutes(30), cancellationToken);

        if (result.ExitCode == 0)
        {
            return (true, null, result.Output);
        }
        else
        {
            var error = !string.IsNullOrEmpty(result.ErrorOutput) ? result.ErrorOutput : result.Output;
            return (false, $"SteamCMD failed with exit code {result.ExitCode}: {error}", result.Output);
        }
    }

    private string? GetSteamCmdPath()
    {
        // Check configured path first
        if (!string.IsNullOrEmpty(_config.SteamCmdPath) && File.Exists(_config.SteamCmdPath))
        {
            return _config.SteamCmdPath;
        }

        // Check common locations
        var possiblePaths = new List<string>();

        if (OperatingSystem.IsWindows())
        {
            possiblePaths.AddRange(new[]
            {
                @"C:\SteamCMD\steamcmd.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "SteamCMD", "steamcmd.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "SteamCMD", "steamcmd.exe"),
            });
        }
        else if (OperatingSystem.IsMacOS())
        {
            possiblePaths.AddRange(new[]
            {
                "/usr/local/bin/steamcmd",
                "/opt/homebrew/bin/steamcmd",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "steamcmd", "steamcmd.sh"),
            });
        }
        else // Linux
        {
            possiblePaths.AddRange(new[]
            {
                "/usr/bin/steamcmd",
                "/usr/local/bin/steamcmd",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "steamcmd", "steamcmd.sh"),
            });
        }

        return possiblePaths.FirstOrDefault(File.Exists);
    }

    private async Task<(int ExitCode, string Output, string ErrorOutput)> RunProcessAsync(
        string fileName,
        string arguments,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            }
        };

        var outputBuilder = new System.Text.StringBuilder();
        var errorBuilder = new System.Text.StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null)
            {
                outputBuilder.AppendLine(e.Data);
                _logger.LogDebug("SteamCMD: {Output}", e.Data);
            }
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null)
            {
                errorBuilder.AppendLine(e.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeoutCts = new CancellationTokenSource(timeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(true); } catch { }
            throw;
        }

        return (process.ExitCode, outputBuilder.ToString(), errorBuilder.ToString());
    }

    private static string? ExtractBuildId(string output)
    {
        // Try to extract build ID from SteamCMD output
        var match = Regex.Match(output, @"BuildID\s*=?\s*(\d+)");
        return match.Success ? match.Groups[1].Value : null;
    }

    private static long GetDirectorySize(string path)
    {
        if (!Directory.Exists(path)) return 0;
        return new DirectoryInfo(path)
            .EnumerateFiles("*", SearchOption.AllDirectories)
            .Sum(f => f.Length);
    }
}
