namespace Backend.Models.DTOs;

public record CreateProjectRequest(
    string Name,
    string? Description,
    string? GitUrl,
    string DefaultBranch,
    string UnityVersion,
    string BuildPath,
    string? SteamAppId,
    string? SteamDepotId,
    ProjectNotificationSettingsDto? NotificationSettings = null
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
    bool? IsActive,
    ProjectNotificationSettingsDto? NotificationSettings = null
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
    int SuccessfulBuilds,
    ProjectNotificationSettingsDto? NotificationSettings = null
);

// Project notification settings DTOs
public record ProjectNotificationSettingsDto(
    bool UseGlobalSettings,
    ProjectDiscordSettingsDto? Discord,
    ProjectSlackSettingsDto? Slack,
    ProjectWebhookSettingsDto? Webhook
);

public record ProjectDiscordSettingsDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent>? Events
);

public record ProjectSlackSettingsDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent>? Events
);

public record ProjectWebhookSettingsDto(
    bool Enabled,
    string? Url,
    bool HasSecret,
    List<NotificationEvent>? Events
);

public record UpdateProjectNotificationSettingsDto(
    bool UseGlobalSettings,
    UpdateProjectDiscordDto? Discord,
    UpdateProjectSlackDto? Slack,
    UpdateProjectWebhookDto? Webhook
);

public record UpdateProjectDiscordDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent>? Events
);

public record UpdateProjectSlackDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent>? Events
);

public record UpdateProjectWebhookDto(
    bool Enabled,
    string? Url,
    string? Secret,
    List<NotificationEvent>? Events
);
