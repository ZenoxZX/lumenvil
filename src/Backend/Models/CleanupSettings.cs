namespace Backend.Models;

public class CleanupSettings
{
    public bool Enabled { get; set; } = false;

    // Keep last N builds per project (0 = unlimited)
    public int MaxBuildsPerProject { get; set; } = 10;

    // Delete builds older than N days (0 = unlimited)
    public int MaxBuildAgeDays { get; set; } = 30;

    // Minimum free disk space in GB before auto-cleanup triggers
    public int MinFreeDiskSpaceGB { get; set; } = 50;

    // Only delete builds with these statuses
    public List<BuildStatus> CleanupStatuses { get; set; } = new()
    {
        BuildStatus.Success,
        BuildStatus.Failed,
        BuildStatus.Cancelled
    };

    // Run cleanup at this hour (0-23, local time)
    public int ScheduledHour { get; set; } = 3; // 3 AM

    // Keep builds that were uploaded to Steam
    public bool KeepSteamUploads { get; set; } = true;
}

public class DiskSpaceInfo
{
    public string DrivePath { get; set; } = string.Empty;
    public long TotalBytes { get; set; }
    public long FreeBytes { get; set; }
    public long UsedBytes => TotalBytes - FreeBytes;
    public double FreePercentage => TotalBytes > 0 ? (double)FreeBytes / TotalBytes * 100 : 0;
    public double UsedPercentage => TotalBytes > 0 ? (double)UsedBytes / TotalBytes * 100 : 0;

    public string TotalFormatted => FormatBytes(TotalBytes);
    public string FreeFormatted => FormatBytes(FreeBytes);
    public string UsedFormatted => FormatBytes(UsedBytes);

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

public class CleanupResult
{
    public int BuildsDeleted { get; set; }
    public long SpaceFreedBytes { get; set; }
    public string SpaceFreedFormatted => FormatBytes(SpaceFreedBytes);
    public List<string> DeletedBuilds { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

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
