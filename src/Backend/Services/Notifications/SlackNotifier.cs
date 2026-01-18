using System.Text;
using System.Text.Json;
using Backend.Models;

namespace Backend.Services.Notifications;

public class SlackNotifier : INotificationSender
{
    private readonly HttpClient _httpClient;
    private readonly SlackConfig _config;
    private readonly ILogger<SlackNotifier> _logger;

    public NotificationChannel Channel => NotificationChannel.Slack;

    public SlackNotifier(HttpClient httpClient, SlackConfig config, ILogger<SlackNotifier> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> SendAsync(BuildNotification notification, CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return (false, "Slack is not configured");
        }

        if (!_config.Events.Contains(notification.Event))
        {
            return (true, null); // Event not subscribed, skip silently
        }

        try
        {
            var blocks = CreateBlocks(notification);
            var payload = new { blocks };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(_config.WebhookUrl, content, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Slack notification sent for build {BuildId}", notification.BuildId);
                return (true, null);
            }

            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Slack webhook failed: {StatusCode} - {Body}", response.StatusCode, errorBody);
            return (false, $"Slack returned {response.StatusCode}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send Slack notification");
            return (false, ex.Message);
        }
    }

    public async Task<(bool Success, string? Error)> TestAsync(CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return (false, "Slack is not configured");
        }

        try
        {
            var blocks = new object[]
            {
                new
                {
                    type = "header",
                    text = new { type = "plain_text", text = "🔔 Test Notification", emoji = true }
                },
                new
                {
                    type = "section",
                    text = new { type = "mrkdwn", text = "Build Automation notification system is working correctly!" }
                }
            };

            var payload = new { blocks };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(_config.WebhookUrl, content, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return (true, "Test notification sent successfully");
            }

            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            return (false, $"Slack returned {response.StatusCode}: {errorBody}");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private object[] CreateBlocks(BuildNotification notification)
    {
        var (emoji, statusText) = notification.Event switch
        {
            NotificationEvent.BuildStarted => ("🚀", "Started"),
            NotificationEvent.BuildCompleted => ("✅", "Completed"),
            NotificationEvent.BuildFailed => ("❌", "Failed"),
            NotificationEvent.BuildCancelled => ("⚪", "Cancelled"),
            NotificationEvent.UploadCompleted => ("☁️", "Upload Completed"),
            NotificationEvent.UploadFailed => ("❌", "Upload Failed"),
            _ => ("📦", notification.Status.ToString())
        };

        var blocks = new List<object>
        {
            new
            {
                type = "header",
                text = new { type = "plain_text", text = $"{emoji} Build #{notification.BuildNumber} {statusText}", emoji = true }
            },
            new
            {
                type = "section",
                fields = new[]
                {
                    new { type = "mrkdwn", text = $"*Project:*\n{notification.ProjectName}" },
                    new { type = "mrkdwn", text = $"*Branch:*\n{notification.Branch}" },
                    new { type = "mrkdwn", text = $"*Status:*\n{notification.Status}" },
                    new { type = "mrkdwn", text = $"*Triggered By:*\n{notification.TriggeredBy ?? "System"}" }
                }
            }
        };

        // Add duration and size if available
        var extraFields = new List<object>();

        if (notification.Duration.HasValue)
        {
            var duration = notification.Duration.Value;
            var durationStr = duration.TotalMinutes >= 1
                ? $"{(int)duration.TotalMinutes}m {duration.Seconds}s"
                : $"{duration.Seconds}s";
            extraFields.Add(new { type = "mrkdwn", text = $"*Duration:*\n{durationStr}" });
        }

        if (notification.BuildSize.HasValue)
        {
            var size = notification.BuildSize.Value;
            var sizeStr = size >= 1_073_741_824
                ? $"{size / 1_073_741_824.0:F2} GB"
                : size >= 1_048_576
                    ? $"{size / 1_048_576.0:F1} MB"
                    : $"{size / 1024.0:F0} KB";
            extraFields.Add(new { type = "mrkdwn", text = $"*Size:*\n{sizeStr}" });
        }

        if (extraFields.Count > 0)
        {
            blocks.Add(new { type = "section", fields = extraFields });
        }

        // Add error message if present
        if (!string.IsNullOrEmpty(notification.ErrorMessage))
        {
            blocks.Add(new
            {
                type = "section",
                text = new { type = "mrkdwn", text = $"*Error:*\n```{notification.ErrorMessage}```" }
            });
        }

        // Add divider and context
        blocks.Add(new { type = "divider" });
        blocks.Add(new
        {
            type = "context",
            elements = new[]
            {
                new { type = "mrkdwn", text = $"Build Automation • {notification.Timestamp:yyyy-MM-dd HH:mm:ss} UTC" }
            }
        });

        return blocks.ToArray();
    }
}
