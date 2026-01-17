using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using BuildAgent.Models;

namespace BuildAgent.Services;

public class GitOperationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? RepositoryPath { get; set; }
}

public interface IGitService
{
    Task<GitOperationResult> EnsureRepositoryAsync(Guid buildId, string gitUrl, string targetPath, string branch, CancellationToken ct);
    Task<string?> GetCurrentCommitHashAsync(string repositoryPath);
    Task<IEnumerable<string>> ListRemoteBranchesAsync(string gitUrl);
}

public class GitService : IGitService
{
    private readonly ILogger<GitService> _logger;
    private readonly AgentHubClient _hubClient;
    private readonly string _workspacePath;
    private static readonly TimeSpan GitTimeout = TimeSpan.FromMinutes(5);

    public GitService(ILogger<GitService> logger, AgentHubClient hubClient, string? workspacePath = null)
    {
        _logger = logger;
        _hubClient = hubClient;
        _workspacePath = workspacePath ?? "./workspace";
    }

    public async Task<GitOperationResult> EnsureRepositoryAsync(Guid buildId, string gitUrl, string targetPath, string branch, CancellationToken ct)
    {
        var repositoryPath = targetPath;

        try
        {
            // Ensure workspace directory exists
            Directory.CreateDirectory(Path.GetDirectoryName(repositoryPath) ?? _workspacePath);

            // Check if repository already exists
            var gitDir = Path.Combine(repositoryPath, ".git");
            var isExistingRepo = Directory.Exists(gitDir);

            if (isExistingRepo)
            {
                // Repository exists - do fetch and checkout
                await _hubClient.UpdateBuildStatusAsync(buildId, "Cloning");
                await _hubClient.AddBuildLogAsync(buildId, "Info", $"Repository exists at {repositoryPath}, fetching updates...", "Clone");

                // Fetch all branches
                var fetchResult = await RunGitCommandAsync(repositoryPath, "fetch --all", buildId, ct);
                if (!fetchResult.Success)
                {
                    return new GitOperationResult
                    {
                        Success = false,
                        ErrorMessage = $"Git fetch failed: {fetchResult.ErrorMessage}"
                    };
                }

                // Checkout the specified branch
                var checkoutResult = await RunGitCommandAsync(repositoryPath, $"checkout {branch}", buildId, ct);
                if (!checkoutResult.Success)
                {
                    return new GitOperationResult
                    {
                        Success = false,
                        ErrorMessage = $"Git checkout failed: {checkoutResult.ErrorMessage}"
                    };
                }

                // Pull latest changes
                var pullResult = await RunGitCommandAsync(repositoryPath, "pull", buildId, ct);
                if (!pullResult.Success)
                {
                    return new GitOperationResult
                    {
                        Success = false,
                        ErrorMessage = $"Git pull failed: {pullResult.ErrorMessage}"
                    };
                }

                // Clean untracked files but preserve Library folder
                await _hubClient.AddBuildLogAsync(buildId, "Info", "Cleaning repository (preserving Library folder)...", "Clone");
                await RunGitCommandAsync(repositoryPath, "clean -fdx -e Library/", buildId, ct);

                await _hubClient.AddBuildLogAsync(buildId, "Info", "Repository updated successfully", "Clone");
            }
            else
            {
                // Repository doesn't exist - clone
                await _hubClient.UpdateBuildStatusAsync(buildId, "Cloning");
                await _hubClient.AddBuildLogAsync(buildId, "Info", $"Cloning repository from {gitUrl}...", "Clone");

                // Clone with single branch for efficiency
                var cloneResult = await RunGitCommandAsync(
                    Path.GetDirectoryName(repositoryPath)!,
                    $"clone --branch {branch} --single-branch \"{gitUrl}\" \"{Path.GetFileName(repositoryPath)}\"",
                    buildId,
                    ct);

                if (!cloneResult.Success)
                {
                    return new GitOperationResult
                    {
                        Success = false,
                        ErrorMessage = $"Git clone failed: {cloneResult.ErrorMessage}"
                    };
                }

                await _hubClient.AddBuildLogAsync(buildId, "Info", "Repository cloned successfully", "Clone");
            }

            return new GitOperationResult
            {
                Success = true,
                RepositoryPath = repositoryPath
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Git operation failed");
            return new GitOperationResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<string?> GetCurrentCommitHashAsync(string repositoryPath)
    {
        try
        {
            var result = await RunGitCommandInternalAsync(repositoryPath, "rev-parse HEAD", CancellationToken.None);
            if (result.Success && !string.IsNullOrWhiteSpace(result.Output))
            {
                return result.Output.Trim();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get commit hash");
        }

        return null;
    }

    public async Task<IEnumerable<string>> ListRemoteBranchesAsync(string gitUrl)
    {
        var branches = new List<string>();

        try
        {
            var result = await RunGitCommandInternalAsync(
                Directory.GetCurrentDirectory(),
                $"ls-remote --heads \"{gitUrl}\"",
                CancellationToken.None,
                TimeSpan.FromSeconds(30));

            if (result.Success && !string.IsNullOrWhiteSpace(result.Output))
            {
                // Parse output: each line is "<hash>\trefs/heads/<branch>"
                var regex = new Regex(@"refs/heads/(.+)$", RegexOptions.Multiline);
                var matches = regex.Matches(result.Output);

                foreach (Match match in matches)
                {
                    if (match.Groups.Count > 1)
                    {
                        branches.Add(match.Groups[1].Value);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to list remote branches for {GitUrl}", gitUrl);
        }

        return branches;
    }

    private async Task<(bool Success, string? ErrorMessage, string? Output)> RunGitCommandAsync(
        string workingDirectory,
        string arguments,
        Guid buildId,
        CancellationToken ct)
    {
        var result = await RunGitCommandInternalAsync(workingDirectory, arguments, ct, GitTimeout, buildId);
        return (result.Success, result.ErrorMessage, result.Output);
    }

    private async Task<(bool Success, string? ErrorMessage, string? Output)> RunGitCommandInternalAsync(
        string workingDirectory,
        string arguments,
        CancellationToken ct,
        TimeSpan? timeout = null,
        Guid? buildId = null)
    {
        var effectiveTimeout = timeout ?? GitTimeout;

        var startInfo = new ProcessStartInfo
        {
            FileName = "git",
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        _logger.LogInformation("Running git command: git {Arguments} in {WorkingDirectory}", arguments, workingDirectory);

        using var process = new Process { StartInfo = startInfo };
        var outputBuilder = new System.Text.StringBuilder();
        var errorBuilder = new System.Text.StringBuilder();

        process.OutputDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                outputBuilder.AppendLine(e.Data);
                _logger.LogDebug("Git output: {Output}", e.Data);

                // Send progress updates for clone/fetch operations
                if (buildId.HasValue && (e.Data.Contains("%") || e.Data.Contains("Receiving") || e.Data.Contains("Resolving")))
                {
                    // Parse progress percentage if available
                    var percentMatch = Regex.Match(e.Data, @"(\d+)%");
                    if (percentMatch.Success && int.TryParse(percentMatch.Groups[1].Value, out var progress))
                    {
                        _ = _hubClient.SendBuildProgressAsync(buildId.Value, "Clone", progress, e.Data);
                    }
                }
            }
        };

        process.ErrorDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                // Git often writes progress to stderr, so we check if it's actually an error
                if (e.Data.Contains("fatal:") || e.Data.Contains("error:"))
                {
                    errorBuilder.AppendLine(e.Data);
                    _logger.LogWarning("Git error: {Error}", e.Data);
                }
                else
                {
                    outputBuilder.AppendLine(e.Data);
                    _logger.LogDebug("Git stderr: {Output}", e.Data);
                }
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeoutCts = new CancellationTokenSource(effectiveTimeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (timeoutCts.Token.IsCancellationRequested)
        {
            try { process.Kill(true); } catch { }
            return (false, "Git operation timed out", null);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(true); } catch { }
            return (false, "Git operation cancelled", null);
        }

        var success = process.ExitCode == 0;
        var error = errorBuilder.ToString().Trim();

        return (success, string.IsNullOrEmpty(error) ? null : error, outputBuilder.ToString());
    }
}
