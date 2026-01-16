using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Backend.Services;

public class GitAuthenticationException : Exception
{
    public GitAuthenticationException(string message) : base(message) { }
}

public class GitRepositoryNotFoundException : Exception
{
    public GitRepositoryNotFoundException(string message) : base(message) { }
}

public interface IGitApiService
{
    Task<IEnumerable<string>> GetBranchesAsync(string gitUrl, CancellationToken ct = default);
    Task<bool> ValidateRepositoryAsync(string gitUrl, CancellationToken ct = default);
}

public class GitApiService : IGitApiService
{
    private readonly ILogger<GitApiService> _logger;
    private static readonly TimeSpan GitTimeout = TimeSpan.FromSeconds(30);

    public GitApiService(ILogger<GitApiService> logger)
    {
        _logger = logger;
    }

    public async Task<IEnumerable<string>> GetBranchesAsync(string gitUrl, CancellationToken ct = default)
    {
        var branches = new List<string>();

        try
        {
            var result = await RunGitCommandAsync($"ls-remote --heads \"{gitUrl}\"", ct);

            if (!result.Success)
            {
                if (result.ErrorMessage?.Contains("Authentication failed") == true ||
                    result.ErrorMessage?.Contains("could not read Username") == true)
                {
                    throw new GitAuthenticationException($"Authentication failed for repository: {gitUrl}");
                }

                if (result.ErrorMessage?.Contains("not found") == true ||
                    result.ErrorMessage?.Contains("does not appear to be a git repository") == true)
                {
                    throw new GitRepositoryNotFoundException($"Repository not found: {gitUrl}");
                }

                _logger.LogWarning("Failed to get branches for {GitUrl}: {Error}", gitUrl, result.ErrorMessage);
                return branches;
            }

            if (!string.IsNullOrWhiteSpace(result.Output))
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
        catch (GitAuthenticationException)
        {
            throw;
        }
        catch (GitRepositoryNotFoundException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branches for {GitUrl}", gitUrl);
        }

        return branches.OrderBy(b => b).ToList();
    }

    public async Task<bool> ValidateRepositoryAsync(string gitUrl, CancellationToken ct = default)
    {
        try
        {
            var result = await RunGitCommandAsync($"ls-remote --heads \"{gitUrl}\"", ct);
            return result.Success;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Repository validation failed for {GitUrl}", gitUrl);
            return false;
        }
    }

    private async Task<(bool Success, string? ErrorMessage, string? Output)> RunGitCommandAsync(
        string arguments,
        CancellationToken ct)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "git",
            Arguments = arguments,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        _logger.LogDebug("Running git command: git {Arguments}", arguments);

        using var process = new Process { StartInfo = startInfo };
        var outputBuilder = new System.Text.StringBuilder();
        var errorBuilder = new System.Text.StringBuilder();

        process.OutputDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                outputBuilder.AppendLine(e.Data);
            }
        };

        process.ErrorDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                errorBuilder.AppendLine(e.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeoutCts = new CancellationTokenSource(GitTimeout);
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
