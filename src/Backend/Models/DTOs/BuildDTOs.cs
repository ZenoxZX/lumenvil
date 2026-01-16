namespace Backend.Models.DTOs;

public record CreateBuildRequest(
    Guid ProjectId,
    string? Branch,
    ScriptingBackend ScriptingBackend = ScriptingBackend.IL2CPP,
    string? SteamBranch = null
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
    string? SteamBranch,
    string? SteamUploadStatus,
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
