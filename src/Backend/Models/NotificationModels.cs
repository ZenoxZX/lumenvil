namespace Backend.Models;

public enum NotificationChannel
{
    Discord,
    Slack,
    Email,
    Webhook
}

public enum NotificationEvent
{
    BuildStarted,
    BuildCompleted,
    BuildFailed,
    BuildCancelled,
    UploadCompleted,
    UploadFailed
}

public class NotificationConfig
{
    public DiscordConfig Discord { get; set; } = new();
    public SlackConfig Slack { get; set; } = new();
    public EmailConfig Email { get; set; } = new();
    public WebhookConfig Webhook { get; set; } = new();
}

public class DiscordConfig
{
    public bool Enabled { get; set; }
    public string? WebhookUrl { get; set; }
    public List<NotificationEvent> Events { get; set; } = new();

    public bool IsConfigured => Enabled && !string.IsNullOrEmpty(WebhookUrl);
}

public class SlackConfig
{
    public bool Enabled { get; set; }
    public string? WebhookUrl { get; set; }
    public List<NotificationEvent> Events { get; set; } = new();

    public bool IsConfigured => Enabled && !string.IsNullOrEmpty(WebhookUrl);
}

public class EmailConfig
{
    public bool Enabled { get; set; }
    public SmtpSettings Smtp { get; set; } = new();
    public List<string> Recipients { get; set; } = new();
    public List<NotificationEvent> Events { get; set; } = new();

    public bool IsConfigured => Enabled && Smtp.IsConfigured && Recipients.Count > 0;
}

public class SmtpSettings
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool UseSsl { get; set; } = true;
    public string? FromAddress { get; set; }
    public string? FromName { get; set; } = "Build Automation";

    public bool IsConfigured => !string.IsNullOrEmpty(Host) &&
                                !string.IsNullOrEmpty(Username) &&
                                !string.IsNullOrEmpty(Password);
}

public class WebhookConfig
{
    public bool Enabled { get; set; }
    public string? Url { get; set; }
    public string? Secret { get; set; } // For HMAC signature
    public List<NotificationEvent> Events { get; set; } = new();

    public bool IsConfigured => Enabled && !string.IsNullOrEmpty(Url);
}

// Notification payload for services
public record BuildNotification(
    NotificationEvent Event,
    Guid BuildId,
    int BuildNumber,
    string ProjectName,
    string Branch,
    BuildStatus Status,
    string? ErrorMessage,
    TimeSpan? Duration,
    long? BuildSize,
    string? TriggeredBy,
    DateTime Timestamp
);
