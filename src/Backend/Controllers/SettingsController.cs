using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Services;
using Backend.Services.Notifications;
using Backend.Services.Platforms;
using Backend.Services.Platforms.Steam;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class SettingsController : ControllerBase
{
    private readonly SettingsService _settingsService;
    private readonly NotificationService _notificationService;
    private readonly BuildCleanupService _cleanupService;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(
        SettingsService settingsService,
        NotificationService notificationService,
        BuildCleanupService cleanupService,
        IServiceProvider serviceProvider,
        ILogger<SettingsController> logger)
    {
        _settingsService = settingsService;
        _notificationService = notificationService;
        _cleanupService = cleanupService;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    // Steam Settings

    [HttpGet("steam")]
    public async Task<IActionResult> GetSteamSettings()
    {
        var config = await _settingsService.GetSteamConfigAsync();

        // Don't return the actual password
        return Ok(new SteamSettingsResponse(
            config.Username,
            !string.IsNullOrEmpty(config.Password),
            config.SteamCmdPath,
            config.DefaultBranch,
            config.IsConfigured
        ));
    }

    [HttpPut("steam")]
    public async Task<IActionResult> UpdateSteamSettings([FromBody] UpdateSteamSettingsRequest request)
    {
        var config = await _settingsService.GetSteamConfigAsync();

        config.Username = request.Username;
        config.SteamCmdPath = request.SteamCmdPath;
        config.DefaultBranch = request.DefaultBranch;

        // Only update password if provided (not empty)
        if (!string.IsNullOrEmpty(request.Password))
        {
            config.Password = request.Password;
        }

        await _settingsService.SaveSteamConfigAsync(config);

        _logger.LogInformation("Steam settings updated by admin");

        return Ok(new SteamSettingsResponse(
            config.Username,
            !string.IsNullOrEmpty(config.Password),
            config.SteamCmdPath,
            config.DefaultBranch,
            config.IsConfigured
        ));
    }

    [HttpPost("steam/test")]
    public async Task<IActionResult> TestSteamConnection()
    {
        var config = await _settingsService.GetSteamConfigAsync();

        if (!config.IsConfigured)
        {
            return BadRequest(new { message = "Steam is not configured" });
        }

        var uploader = new SteamUploader(
            _serviceProvider.GetRequiredService<ILogger<SteamUploader>>(),
            config
        );

        var result = await uploader.TestConnectionAsync();

        if (result.Success)
        {
            return Ok(new { message = result.Message });
        }
        else
        {
            return BadRequest(new { message = result.Message });
        }
    }

    // Platform Info

    [HttpGet("platforms")]
    public IActionResult GetPlatforms()
    {
        var platforms = new[]
        {
            new PlatformInfo(PlatformType.Steam, "Steam", true),
            new PlatformInfo(PlatformType.Epic, "Epic Games Store", false),
        };

        return Ok(platforms);
    }

    // Notification Settings

    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotificationSettings()
    {
        var config = await _notificationService.GetConfigAsync();

        return Ok(new NotificationSettingsResponse(
            new DiscordSettingsDto(
                config.Discord.Enabled,
                config.Discord.WebhookUrl,
                config.Discord.Events
            ),
            new SlackSettingsDto(
                config.Slack.Enabled,
                config.Slack.WebhookUrl,
                config.Slack.Events
            ),
            new WebhookSettingsDto(
                config.Webhook.Enabled,
                config.Webhook.Url,
                !string.IsNullOrEmpty(config.Webhook.Secret),
                config.Webhook.Events
            )
        ));
    }

    [HttpPut("notifications")]
    public async Task<IActionResult> UpdateNotificationSettings([FromBody] UpdateNotificationSettingsRequest request)
    {
        var config = await _notificationService.GetConfigAsync();

        // Update Discord
        if (request.Discord != null)
        {
            config.Discord.Enabled = request.Discord.Enabled;
            if (request.Discord.WebhookUrl != null)
                config.Discord.WebhookUrl = request.Discord.WebhookUrl;
            if (request.Discord.Events != null)
                config.Discord.Events = request.Discord.Events;
        }

        // Update Slack
        if (request.Slack != null)
        {
            config.Slack.Enabled = request.Slack.Enabled;
            if (request.Slack.WebhookUrl != null)
                config.Slack.WebhookUrl = request.Slack.WebhookUrl;
            if (request.Slack.Events != null)
                config.Slack.Events = request.Slack.Events;
        }

        // Update Generic Webhook
        if (request.Webhook != null)
        {
            config.Webhook.Enabled = request.Webhook.Enabled;
            if (request.Webhook.Url != null)
                config.Webhook.Url = request.Webhook.Url;
            if (request.Webhook.Secret != null)
                config.Webhook.Secret = request.Webhook.Secret;
            if (request.Webhook.Events != null)
                config.Webhook.Events = request.Webhook.Events;
        }

        await _notificationService.SaveConfigAsync(config);
        _logger.LogInformation("Notification settings updated by admin");

        return Ok(new NotificationSettingsResponse(
            new DiscordSettingsDto(
                config.Discord.Enabled,
                config.Discord.WebhookUrl,
                config.Discord.Events
            ),
            new SlackSettingsDto(
                config.Slack.Enabled,
                config.Slack.WebhookUrl,
                config.Slack.Events
            ),
            new WebhookSettingsDto(
                config.Webhook.Enabled,
                config.Webhook.Url,
                !string.IsNullOrEmpty(config.Webhook.Secret),
                config.Webhook.Events
            )
        ));
    }

    [HttpPost("notifications/test/{channel}")]
    public async Task<IActionResult> TestNotification(NotificationChannel channel)
    {
        var (success, message) = await _notificationService.TestChannelAsync(channel);

        if (success)
        {
            return Ok(new { message });
        }
        else
        {
            return BadRequest(new { message });
        }
    }

    // Build Cleanup Settings

    [HttpGet("cleanup")]
    public async Task<IActionResult> GetCleanupSettings()
    {
        var settings = await _cleanupService.GetCleanupSettingsAsync(_settingsService);
        return Ok(settings);
    }

    [HttpPut("cleanup")]
    public async Task<IActionResult> UpdateCleanupSettings([FromBody] CleanupSettings settings)
    {
        await _cleanupService.SaveCleanupSettingsAsync(_settingsService, settings);
        _logger.LogInformation("Cleanup settings updated by admin");
        return Ok(settings);
    }

    [HttpPost("cleanup/run")]
    public async Task<IActionResult> RunCleanup()
    {
        _logger.LogInformation("Manual cleanup triggered by admin");
        var result = await _cleanupService.RunCleanupAsync();
        return Ok(result);
    }

    [HttpGet("disk")]
    public IActionResult GetDiskSpace()
    {
        var diskInfo = _cleanupService.GetDiskSpaceInfo();
        return Ok(diskInfo);
    }
}

// DTOs
public record SteamSettingsResponse(
    string? Username,
    bool HasPassword,
    string? SteamCmdPath,
    string? DefaultBranch,
    bool IsConfigured
);

public record UpdateSteamSettingsRequest(
    string? Username,
    string? Password,
    string? SteamCmdPath,
    string? DefaultBranch
);

public record PlatformInfo(
    PlatformType Type,
    string Name,
    bool IsImplemented
);

// Notification DTOs
public record NotificationSettingsResponse(
    DiscordSettingsDto Discord,
    SlackSettingsDto Slack,
    WebhookSettingsDto Webhook
);

public record DiscordSettingsDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent> Events
);

public record SlackSettingsDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent> Events
);

public record WebhookSettingsDto(
    bool Enabled,
    string? Url,
    bool HasSecret,
    List<NotificationEvent> Events
);

public record UpdateNotificationSettingsRequest(
    UpdateDiscordSettingsDto? Discord,
    UpdateSlackSettingsDto? Slack,
    UpdateWebhookSettingsDto? Webhook
);

public record UpdateDiscordSettingsDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent>? Events
);

public record UpdateSlackSettingsDto(
    bool Enabled,
    string? WebhookUrl,
    List<NotificationEvent>? Events
);

public record UpdateWebhookSettingsDto(
    bool Enabled,
    string? Url,
    string? Secret,
    List<NotificationEvent>? Events
);
