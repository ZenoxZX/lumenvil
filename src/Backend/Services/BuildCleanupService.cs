using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Services;

public class BuildCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BuildCleanupService> _logger;
    private const string CleanupSettingsKey = "cleanup";
    private DateTime _lastCleanupCheck = DateTime.MinValue;

    public BuildCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<BuildCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Build Cleanup Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndRunCleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in cleanup service");
            }

            // Check every hour
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task CheckAndRunCleanupAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var settingsService = scope.ServiceProvider.GetRequiredService<SettingsService>();

        var settings = await GetCleanupSettingsAsync(settingsService);
        if (!settings.Enabled)
        {
            return;
        }

        var now = DateTime.Now;

        // Check if it's time for scheduled cleanup
        if (now.Hour == settings.ScheduledHour && _lastCleanupCheck.Date != now.Date)
        {
            _logger.LogInformation("Running scheduled cleanup at {Hour}:00", settings.ScheduledHour);
            _lastCleanupCheck = now;
            await RunCleanupAsync(settings, cancellationToken);
            return;
        }

        // Check disk space for emergency cleanup
        var diskInfo = GetDiskSpaceInfo();
        var freeSpaceGB = diskInfo.FreeBytes / (1024.0 * 1024 * 1024);

        if (freeSpaceGB < settings.MinFreeDiskSpaceGB)
        {
            _logger.LogWarning(
                "Low disk space detected: {FreeSpace} GB free (minimum: {MinSpace} GB). Running emergency cleanup.",
                freeSpaceGB.ToString("F2"), settings.MinFreeDiskSpaceGB);
            await RunCleanupAsync(settings, cancellationToken);
        }
    }

    public async Task<CleanupResult> RunCleanupAsync(CleanupSettings? settings = null, CancellationToken cancellationToken = default)
    {
        var result = new CleanupResult();

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settingsService = scope.ServiceProvider.GetRequiredService<SettingsService>();

        settings ??= await GetCleanupSettingsAsync(settingsService);

        _logger.LogInformation("Starting build cleanup");

        try
        {
            // Get all builds that can be cleaned up
            var query = context.Builds
                .Include(b => b.Project)
                .Where(b => settings.CleanupStatuses.Contains(b.Status))
                .Where(b => !string.IsNullOrEmpty(b.OutputPath))
                .AsQueryable();

            // Exclude Steam uploads if configured
            if (settings.KeepSteamUploads)
            {
                query = query.Where(b => string.IsNullOrEmpty(b.SteamBuildId));
            }

            var allBuilds = await query.OrderByDescending(b => b.CreatedAt).ToListAsync(cancellationToken);

            var buildsToDelete = new List<Build>();

            // Group by project for per-project limits
            var buildsByProject = allBuilds.GroupBy(b => b.ProjectId);

            foreach (var projectGroup in buildsByProject)
            {
                var projectBuilds = projectGroup.ToList();

                // Apply max builds per project limit
                if (settings.MaxBuildsPerProject > 0 && projectBuilds.Count > settings.MaxBuildsPerProject)
                {
                    var excessBuilds = projectBuilds.Skip(settings.MaxBuildsPerProject);
                    buildsToDelete.AddRange(excessBuilds);
                }

                // Apply max age limit
                if (settings.MaxBuildAgeDays > 0)
                {
                    var cutoffDate = DateTime.UtcNow.AddDays(-settings.MaxBuildAgeDays);
                    var oldBuilds = projectBuilds.Where(b => b.CreatedAt < cutoffDate);
                    foreach (var oldBuild in oldBuilds)
                    {
                        if (!buildsToDelete.Contains(oldBuild))
                        {
                            buildsToDelete.Add(oldBuild);
                        }
                    }
                }
            }

            // Delete builds
            foreach (var build in buildsToDelete)
            {
                try
                {
                    var spaceFreed = await DeleteBuildFilesAsync(build);
                    result.SpaceFreedBytes += spaceFreed;
                    result.BuildsDeleted++;
                    result.DeletedBuilds.Add($"{build.Project?.Name ?? "Unknown"} #{build.BuildNumber}");

                    // Clear the output path in database
                    build.OutputPath = null;
                    build.BuildSize = null;

                    _logger.LogInformation(
                        "Deleted build files for {Project} #{BuildNumber}, freed {Space}",
                        build.Project?.Name, build.BuildNumber, FormatBytes(spaceFreed));
                }
                catch (Exception ex)
                {
                    var error = $"Failed to delete {build.Project?.Name} #{build.BuildNumber}: {ex.Message}";
                    result.Errors.Add(error);
                    _logger.LogError(ex, "Failed to delete build {BuildId}", build.Id);
                }
            }

            await context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Cleanup completed: {Count} builds deleted, {Space} freed",
                result.BuildsDeleted, result.SpaceFreedFormatted);
        }
        catch (Exception ex)
        {
            result.Errors.Add($"Cleanup failed: {ex.Message}");
            _logger.LogError(ex, "Cleanup failed");
        }

        return result;
    }

    private async Task<long> DeleteBuildFilesAsync(Build build)
    {
        if (string.IsNullOrEmpty(build.OutputPath) || !Directory.Exists(build.OutputPath))
        {
            return 0;
        }

        var dirInfo = new DirectoryInfo(build.OutputPath);
        var size = await Task.Run(() => GetDirectorySize(dirInfo));

        Directory.Delete(build.OutputPath, recursive: true);

        return size;
    }

    private long GetDirectorySize(DirectoryInfo directory)
    {
        long size = 0;

        try
        {
            foreach (var file in directory.GetFiles("*", SearchOption.AllDirectories))
            {
                size += file.Length;
            }
        }
        catch (UnauthorizedAccessException)
        {
            // Skip files we can't access
        }

        return size;
    }

    public DiskSpaceInfo GetDiskSpaceInfo(string? path = null)
    {
        path ??= AppContext.BaseDirectory;

        var driveInfo = new DriveInfo(Path.GetPathRoot(path) ?? "C:\\");

        return new DiskSpaceInfo
        {
            DrivePath = driveInfo.Name,
            TotalBytes = driveInfo.TotalSize,
            FreeBytes = driveInfo.AvailableFreeSpace
        };
    }

    public async Task<CleanupSettings> GetCleanupSettingsAsync(SettingsService settingsService)
    {
        var json = await settingsService.GetSettingAsync(CleanupSettingsKey);
        if (string.IsNullOrEmpty(json))
        {
            return new CleanupSettings();
        }

        try
        {
            return JsonSerializer.Deserialize<CleanupSettings>(json) ?? new CleanupSettings();
        }
        catch
        {
            return new CleanupSettings();
        }
    }

    public async Task SaveCleanupSettingsAsync(SettingsService settingsService, CleanupSettings settings)
    {
        var json = JsonSerializer.Serialize(settings);
        await settingsService.SetSettingAsync(CleanupSettingsKey, json);
    }

    private static string FormatBytes(long bytes)
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
