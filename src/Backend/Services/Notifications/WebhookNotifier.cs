using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Models;

namespace Backend.Services.Notifications;

public class WebhookNotifier : INotificationSender
{
    private readonly HttpClient _httpClient;
    private readonly WebhookConfig _config;
    private readonly ILogger<WebhookNotifier> _logger;

    public NotificationChannel Channel => NotificationChannel.Webhook;

    public WebhookNotifier(HttpClient httpClient, WebhookConfig config, ILogger<WebhookNotifier> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> SendAsync(BuildNotification notification, CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return (false, "Webhook is not configured");
        }

        if (!_config.Events.Contains(notification.Event))
        {
            return (true, null); // Event not subscribed, skip silently
        }

        try
        {
            var payload = CreatePayload(notification);
            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                Converters = { new JsonStringEnumConverter() }
            });

            var request = new HttpRequestMessage(HttpMethod.Post, _config.Url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            // Add HMAC signature if secret is configured
            if (!string.IsNullOrEmpty(_config.Secret))
            {
                var signature = ComputeHmacSignature(json, _config.Secret);
                request.Headers.Add("X-Webhook-Signature", signature);
            }

            request.Headers.Add("X-Webhook-Event", notification.Event.ToString());

            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Webhook notification sent for build {BuildId}", notification.BuildId);
                return (true, null);
            }

            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Webhook failed: {StatusCode} - {Body}", response.StatusCode, errorBody);
            return (false, $"Webhook returned {response.StatusCode}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send Webhook notification");
            return (false, ex.Message);
        }
    }

    public async Task<(bool Success, string? Error)> TestAsync(CancellationToken cancellationToken = default)
    {
        if (!_config.IsConfigured)
        {
            return (false, "Webhook is not configured");
        }

        try
        {
            var payload = new
            {
                @event = "test",
                timestamp = DateTime.UtcNow,
                message = "Build Automation notification system is working correctly!"
            };

            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var request = new HttpRequestMessage(HttpMethod.Post, _config.Url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            if (!string.IsNullOrEmpty(_config.Secret))
            {
                var signature = ComputeHmacSignature(json, _config.Secret);
                request.Headers.Add("X-Webhook-Signature", signature);
            }

            request.Headers.Add("X-Webhook-Event", "test");

            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return (true, "Test notification sent successfully");
            }

            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            return (false, $"Webhook returned {response.StatusCode}: {errorBody}");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private object CreatePayload(BuildNotification notification)
    {
        return new
        {
            @event = notification.Event.ToString(),
            timestamp = notification.Timestamp,
            build = new
            {
                id = notification.BuildId,
                number = notification.BuildNumber,
                project = notification.ProjectName,
                branch = notification.Branch,
                status = notification.Status.ToString(),
                errorMessage = notification.ErrorMessage,
                durationSeconds = notification.Duration?.TotalSeconds,
                sizeBytes = notification.BuildSize,
                triggeredBy = notification.TriggeredBy
            }
        };
    }

    private static string ComputeHmacSignature(string payload, string secret)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);

        using var hmac = new HMACSHA256(keyBytes);
        var hashBytes = hmac.ComputeHash(payloadBytes);
        return $"sha256={Convert.ToHexString(hashBytes).ToLowerInvariant()}";
    }
}
