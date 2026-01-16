namespace Backend.Models;

public enum LogLevel
{
    Info,
    Warning,
    Error
}

public enum BuildStage
{
    Clone,
    Build,
    Package,
    Upload
}

public class BuildLog
{
    public Guid Id { get; set; }
    public Guid BuildId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public LogLevel Level { get; set; } = LogLevel.Info;
    public string Message { get; set; } = string.Empty;
    public BuildStage Stage { get; set; }

    public Build Build { get; set; } = null!;
}
