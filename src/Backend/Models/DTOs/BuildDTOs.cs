namespace Backend.Models.DTOs;

public record CreateBuildRequest(
    Guid ProjectId,
    string? Branch,
    ScriptingBackend ScriptingBackend = ScriptingBackend.IL2CPP,
    bool UploadToSteam = false,
    string? SteamBranch = null,
    Guid? TemplateId = null  // Optional: Create build from template
);

public record BuildResponse(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    int BuildNumber,
    string Branch,
    string? CommitHash,
    ScriptingBackend ScriptingBackend,
    string BuildTarget,
    BuildStatus Status,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    string? OutputPath,
    long? BuildSize,
    bool UploadToSteam,
    string? SteamBranch,
    string? SteamUploadStatus,
    string? SteamBuildId,
    string? ErrorMessage,
    string? TriggeredByUsername,
    DateTime CreatedAt
);

public record BuildLogResponse(
    Guid Id,
    DateTime Timestamp,
    LogLevel Level,
    string Message,
    BuildStage Stage
);

public record BuildDetailResponse(
    BuildResponse Build,
    List<BuildLogResponse> Logs
);
