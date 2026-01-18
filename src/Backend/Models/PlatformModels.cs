namespace Backend.Models;

public enum PlatformType
{
    Steam,
    Epic,
    // Future: iOS, Android, GOG, etc.
}

public enum UploadStatus
{
    Pending,
    Uploading,
    Success,
    Failed,
    Skipped
}

public class PlatformConfig
{
    public PlatformType Platform { get; set; }
    public bool Enabled { get; set; }
    public Dictionary<string, string> Settings { get; set; } = new();
}

public class SteamConfig
{
    public string? Username { get; set; }
    public string? Password { get; set; } // Stored encrypted or use env var
    public string? SteamCmdPath { get; set; }
    public string? DefaultBranch { get; set; } = "default";

    public bool IsConfigured => !string.IsNullOrEmpty(Username) && !string.IsNullOrEmpty(Password);
}

public record UploadResult(
    bool Success,
    string? Message = null,
    string? BuildId = null,
    long? UploadedSize = null,
    DateTime? CompletedAt = null
);

public record BuildArtifact(
    Guid BuildId,
    string ProjectName,
    int BuildNumber,
    string OutputPath,
    string? AppId,
    string? DepotId,
    string? Branch
);
