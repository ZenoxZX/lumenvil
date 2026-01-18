using Backend.Models;

namespace Backend.Services.Notifications;

public interface INotificationSender
{
    NotificationChannel Channel { get; }
    Task<(bool Success, string? Error)> SendAsync(BuildNotification notification, CancellationToken cancellationToken = default);
    Task<(bool Success, string? Error)> TestAsync(CancellationToken cancellationToken = default);
}
