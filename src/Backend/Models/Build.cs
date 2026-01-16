namespace Backend.Models;

public enum ScriptingBackend
{
    Mono,
    IL2CPP
}

public enum BuildStatus
{
    Queued,
    Cloning,
    Building,
    Packaging,
    Uploading,
    Success,
    Failed,
    Cancelled
}

public class Build
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public int BuildNumber { get; set; }
    public string Branch { get; set; } = "main";
    public string? CommitHash { get; set; }
    public ScriptingBackend ScriptingBackend { get; set; } = ScriptingBackend.IL2CPP;
    public string BuildTarget { get; set; } = "StandaloneWindows64";
    public BuildStatus Status { get; set; } = BuildStatus.Queued;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? OutputPath { get; set; }
    public long? BuildSize { get; set; }
    public string? SteamBranch { get; set; }
    public string? SteamUploadStatus { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? TriggeredById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public User? TriggeredBy { get; set; }
    public ICollection<BuildLog> Logs { get; set; } = new List<BuildLog>();
}
