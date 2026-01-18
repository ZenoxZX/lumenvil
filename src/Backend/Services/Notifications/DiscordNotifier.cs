using System.Text;
using System.Text.Json;
using Backend.Models;

namespace Backend.Services.Notifications;

public class DiscordNotifier : INotificationSender
{
    private readonly HttpClient _httpClient;
    private readonly DiscordConfig _config;
    private readonly ILogger<DiscordNotifier> _logger;

    public NotificationChannel Channel => NotificationChannel.Discord;

    public DiscordNotifier(HttpClient httpClient, DiscordConfig config, ILogger<DiscordNotifier> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> SendAsync(BuildNotification notification, CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return (false, "Discord is not configured");
        }

        if (!_config.Events.Contains(notification.Event))
        {
            return (true, null); // Event not subscribed, skip silently
        }

        try
        {
            var embed = CreateEmbed(notification);
            var payload = new { embeds = new[] { embed } };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(_config.WebhookUrl, content, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Discord notification sent for build {BuildId}", notification.BuildId);
                return (true, null);
            }

            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Discord webhook failed: {StatusCode} - {Body}", response.StatusCode, errorBody);
            return (false, $"Discord returned {response.StatusCode}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send Discord notification");
            return (false, ex.Message);
        }
    }

    public async Task<(bool Success, string? Error)> TestAsync(CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return (false, "Discord is not configured");
        }

        try
        {
            var embed = new
            {
                title = "🔔 Test Notification",
                description = "Build Automation notification system is working correctly!",
                color = 3447003, // Blue
                timestamp = DateTime.UtcNow.ToString("o"),
                footer = new { text = "Build Automation" }
            };

            var payload = new { embeds = new[] { embed } };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(_config.WebhookUrl, content, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return (true, "Test notification sent successfully");
            }

            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            return (false, $"Discord returned {response.StatusCode}: {errorBody}");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private object CreateEmbed(BuildNotification notification)
    {
        var (title, color) = notification.Event switch
        {
            NotificationEvent.BuildStarted => ($"🚀 Build #{notification.BuildNumber} Started", 3447003), // Blue
            NotificationEvent.BuildCompleted => ($"✅ Build #{notification.BuildNumber} Completed", 3066993), // Green
            NotificationEvent.BuildFailed => ($"❌ Build #{notification.BuildNumber} Failed", 15158332), // Red
            NotificationEvent.BuildCancelled => ($"⚪ Build #{notification.BuildNumber} Cancelled", 9807270), // Gray
            NotificationEvent.UploadCompleted => ($"☁️ Upload Completed - Build #{notification.BuildNumber}", 3066993), // Green
            NotificationEvent.UploadFailed => ($"❌ Upload Failed - Build #{notification.BuildNumber}", 15158332), // Red
            _ => ($"Build #{notification.BuildNumber}", 3447003)
        };

        var fields = new List<object>
        {
            new { name = "Project", value = notification.ProjectName, inline = true },
            new { name = "Branch", value = notification.Branch, inline = true },
            new { name = "Status", value = notification.Status.ToString(), inline = true }
        };

        if (notification.Duration.HasValue)
        {
            var duration = notification.Duration.Value;
            var durationStr = duration.TotalMinutes >= 1
                ? $"{(int)duration.TotalMinutes}m {duration.Seconds}s"
                : $"{duration.Seconds}s";
            fields.Add(new { name = "Duration", value = durationStr, inline = true });
        }

        if (notification.BuildSize.HasValue)
        {
            var size = notification.BuildSize.Value;
            var sizeStr = size >= 1_073_741_824
                ? $"{size / 1_073_741_824.0:F2} GB"
                : size >= 1_048_576
                    ? $"{size / 1_048_576.0:F1} MB"
                    : $"{size / 1024.0:F0} KB";
            fields.Add(new { name = "Size", value = sizeStr, inline = true });
        }

        if (!string.IsNullOrEmpty(notification.TriggeredBy))
        {
            fields.Add(new { name = "Triggered By", value = notification.TriggeredBy, inline = true });
        }

        var embed = new Dictionary<string, object>
        {
            ["title"] = title,
            ["color"] = color,
            ["fields"] = fields,
            ["timestamp"] = notification.Timestamp.ToString("o"),
            ["footer"] = new { text = "Build Automation" }
        };

        if (!string.IsNullOrEmpty(notification.ErrorMessage))
        {
            embed["description"] = $"```\n{notification.ErrorMessage}\n```";
        }

        return embed;
    }
}
