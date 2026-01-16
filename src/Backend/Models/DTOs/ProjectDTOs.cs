namespace Backend.Models.DTOs;

public record CreateProjectRequest(
    string Name,
    string? Description,
    string? GitUrl,
    string DefaultBranch,
    string UnityVersion,
    string BuildPath,
    string? SteamAppId,
    string? SteamDepotId
);

public record UpdateProjectRequest(
    string? Name,
    string? Description,
    string? GitUrl,
    string? DefaultBranch,
    string? UnityVersion,
    string? BuildPath,
    string? SteamAppId,
    string? SteamDepotId,
    bool? IsActive
);

public record ProjectResponse(
    Guid Id,
    string Name,
    string? Description,
    string? GitUrl,
    string DefaultBranch,
    string UnityVersion,
    string BuildPath,
    string? SteamAppId,
    string? SteamDepotId,
    bool IsActive,
    DateTime CreatedAt,
    int TotalBuilds,
    int SuccessfulBuilds
);
