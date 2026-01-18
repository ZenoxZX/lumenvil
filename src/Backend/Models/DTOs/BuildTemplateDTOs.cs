namespace Backend.Models.DTOs;

public record CreateBuildTemplateRequest(
    string Name,
    string? Description,
    Guid? ProjectId,
    string? Branch,
    ScriptingBackend ScriptingBackend,
    bool UploadToSteam,
    string? SteamBranch,
    bool IsDefault = false
);

public record UpdateBuildTemplateRequest(
    string? Name,
    string? Description,
    string? Branch,
    ScriptingBackend? ScriptingBackend,
    bool? UploadToSteam,
    string? SteamBranch,
    bool? IsDefault
);

public record BuildTemplateResponse(
    Guid Id,
    string Name,
    string? Description,
    Guid? ProjectId,
    string? ProjectName,
    string? Branch,
    ScriptingBackend ScriptingBackend,
    bool UploadToSteam,
    string? SteamBranch,
    bool IsDefault,
    DateTime CreatedAt,
    string? CreatedByUsername
);
