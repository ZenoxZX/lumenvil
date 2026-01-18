using System.Text.Json;
using Backend.Models;

namespace Backend.Services.Notifications;

public class NotificationService
{
    private readonly SettingsService _settingsService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<NotificationService> _logger;

    private const string NotificationConfigKey = "notifications";

    public NotificationService(
        SettingsService settingsService,
        IHttpClientFactory httpClientFactory,
        ILoggerFactory loggerFactory,
        ILogger<NotificationService> logger)
    {
        _settingsService = settingsService;
        _httpClientFactory = httpClientFactory;
        _loggerFactory = loggerFactory;
        _logger = logger;
    }

    public async Task<NotificationConfig> GetConfigAsync()
    {
        var json = await _settingsService.GetSettingAsync(NotificationConfigKey);
        if (string.IsNullOrEmpty(json))
        {
            return new NotificationConfig();
        }

        try
        {
            return JsonSerializer.Deserialize<NotificationConfig>(json) ?? new NotificationConfig();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize notification config");
            return new NotificationConfig();
        }
    }

    public async Task SaveConfigAsync(NotificationConfig config)
    {
        var json = JsonSerializer.Serialize(config);
        await _settingsService.SetSettingAsync(NotificationConfigKey, json);
    }

    public async Task SendNotificationAsync(BuildNotification notification)
    {
        // Check for project-specific settings
        var projectConfig = ParseProjectNotificationConfig(notification.ProjectNotificationSettingsJson);
        var useProjectSettings = projectConfig != null && !projectConfig.UseGlobalSettings;

        var globalConfig = await GetConfigAsync();
        var httpClient = _httpClientFactory.CreateClient("notifications");
        var tasks = new List<Task>();

        // Determine which Discord config to use
        var discordConfig = useProjectSettings && projectConfig?.Discord != null
            ? projectConfig.Discord
            : globalConfig.Discord;

        if (discordConfig.IsConfigured && discordConfig.Events.Contains(notification.Event))
        {
            var discordNotifier = new DiscordNotifier(
                httpClient,
                discordConfig,
                _loggerFactory.CreateLogger<DiscordNotifier>());
            tasks.Add(SendWithLogging(discordNotifier, notification));
        }

        // Determine which Slack config to use
        var slackConfig = useProjectSettings && projectConfig?.Slack != null
            ? projectConfig.Slack
            : globalConfig.Slack;

        if (slackConfig.IsConfigured && slackConfig.Events.Contains(notification.Event))
        {
            var slackNotifier = new SlackNotifier(
                httpClient,
                slackConfig,
                _loggerFactory.CreateLogger<SlackNotifier>());
            tasks.Add(SendWithLogging(slackNotifier, notification));
        }

        // Determine which Webhook config to use
        var webhookConfig = useProjectSettings && projectConfig?.Webhook != null
            ? projectConfig.Webhook
            : globalConfig.Webhook;

        if (webhookConfig.IsConfigured && webhookConfig.Events.Contains(notification.Event))
        {
            var webhookNotifier = new WebhookNotifier(
                httpClient,
                webhookConfig,
                _loggerFactory.CreateLogger<WebhookNotifier>());
            tasks.Add(SendWithLogging(webhookNotifier, notification));
        }

        if (tasks.Count > 0)
        {
            await Task.WhenAll(tasks);
            _logger.LogInformation(
                "Sent {Count} notifications for {Event} on build {BuildId} (project-specific: {UseProjectSettings})",
                tasks.Count, notification.Event, notification.BuildId, useProjectSettings);
        }
    }

    private ProjectNotificationConfig? ParseProjectNotificationConfig(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;

        try
        {
            return JsonSerializer.Deserialize<ProjectNotificationConfig>(json);
        }
        catch
        {
            return null;
        }
    }

    public async Task<(bool Success, string? Message)> TestChannelAsync(NotificationChannel channel)
    {
        var config = await GetConfigAsync();
        var httpClient = _httpClientFactory.CreateClient("notifications");

        INotificationSender? notifier = channel switch
        {
            NotificationChannel.Discord => new DiscordNotifier(
                httpClient,
                config.Discord,
                _loggerFactory.CreateLogger<DiscordNotifier>()),
            NotificationChannel.Slack => new SlackNotifier(
                httpClient,
                config.Slack,
                _loggerFactory.CreateLogger<SlackNotifier>()),
            NotificationChannel.Webhook => new WebhookNotifier(
                httpClient,
                config.Webhook,
                _loggerFactory.CreateLogger<WebhookNotifier>()),
            _ => null
        };

        if (notifier == null)
        {
            return (false, $"Unknown channel: {channel}");
        }

        return await notifier.TestAsync();
    }

    private async Task SendWithLogging(INotificationSender sender, BuildNotification notification)
    {
        try
        {
            var (success, error) = await sender.SendAsync(notification);
            if (!success)
            {
                _logger.LogWarning(
                    "Failed to send {Channel} notification for build {BuildId}: {Error}",
                    sender.Channel, notification.BuildId, error);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Exception sending {Channel} notification for build {BuildId}",
                sender.Channel, notification.BuildId);
        }
    }

    // Helper method to create notification from build
    public static BuildNotification CreateFromBuild(
        Build build,
        NotificationEvent eventType,
        string projectName,
        string? triggeredBy = null,
        string? projectNotificationSettingsJson = null)
    {
        TimeSpan? duration = null;
        if (build.StartedAt.HasValue && build.CompletedAt.HasValue)
        {
            duration = build.CompletedAt.Value - build.StartedAt.Value;
        }
        else if (build.StartedAt.HasValue)
        {
            duration = DateTime.UtcNow - build.StartedAt.Value;
        }

        return new BuildNotification(
            Event: eventType,
            BuildId: build.Id,
            ProjectId: build.ProjectId,
            BuildNumber: build.BuildNumber,
            ProjectName: projectName,
            Branch: build.Branch,
            Status: build.Status,
            ErrorMessage: build.ErrorMessage,
            Duration: duration,
            BuildSize: build.BuildSize,
            TriggeredBy: triggeredBy,
            Timestamp: DateTime.UtcNow,
            ProjectNotificationSettingsJson: projectNotificationSettingsJson
        );
    }
}
