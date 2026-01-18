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
        var config = await GetConfigAsync();
        var httpClient = _httpClientFactory.CreateClient("notifications");
        var tasks = new List<Task>();

        // Discord
        if (config.Discord.IsConfigured && config.Discord.Events.Contains(notification.Event))
        {
            var discordNotifier = new DiscordNotifier(
                httpClient,
                config.Discord,
                _loggerFactory.CreateLogger<DiscordNotifier>());
            tasks.Add(SendWithLogging(discordNotifier, notification));
        }

        // Slack
        if (config.Slack.IsConfigured && config.Slack.Events.Contains(notification.Event))
        {
            var slackNotifier = new SlackNotifier(
                httpClient,
                config.Slack,
                _loggerFactory.CreateLogger<SlackNotifier>());
            tasks.Add(SendWithLogging(slackNotifier, notification));
        }

        // Generic Webhook
        if (config.Webhook.IsConfigured && config.Webhook.Events.Contains(notification.Event))
        {
            var webhookNotifier = new WebhookNotifier(
                httpClient,
                config.Webhook,
                _loggerFactory.CreateLogger<WebhookNotifier>());
            tasks.Add(SendWithLogging(webhookNotifier, notification));
        }

        if (tasks.Count > 0)
        {
            await Task.WhenAll(tasks);
            _logger.LogInformation(
                "Sent {Count} notifications for {Event} on build {BuildId}",
                tasks.Count, notification.Event, notification.BuildId);
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
        string? triggeredBy = null)
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
            BuildNumber: build.BuildNumber,
            ProjectName: projectName,
            Branch: build.Branch,
            Status: build.Status,
            ErrorMessage: build.ErrorMessage,
            Duration: duration,
            BuildSize: build.BuildSize,
            TriggeredBy: triggeredBy,
            Timestamp: DateTime.UtcNow
        );
    }
}
