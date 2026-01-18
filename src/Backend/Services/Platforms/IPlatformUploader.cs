using Backend.Models;

namespace Backend.Services.Platforms;

public interface IPlatformUploader
{
    PlatformType Platform { get; }
    string PlatformName { get; }

    /// <summary>
    /// Upload a build artifact to the platform
    /// </summary>
    Task<UploadResult> UploadAsync(
        BuildArtifact artifact,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validate platform configuration
    /// </summary>
    Task<(bool IsValid, string? ErrorMessage)> ValidateConfigAsync();

    /// <summary>
    /// Test connection to the platform
    /// </summary>
    Task<(bool Success, string? Message)> TestConnectionAsync();
}
