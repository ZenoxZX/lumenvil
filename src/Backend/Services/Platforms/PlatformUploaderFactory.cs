using Backend.Models;
using Backend.Services.Platforms.Steam;

namespace Backend.Services.Platforms;

public class PlatformUploaderFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PlatformUploaderFactory> _logger;

    public PlatformUploaderFactory(
        IServiceProvider serviceProvider,
        ILogger<PlatformUploaderFactory> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public IPlatformUploader? GetUploader(PlatformType platform)
    {
        return platform switch
        {
            PlatformType.Steam => _serviceProvider.GetService<SteamUploader>(),
            PlatformType.Epic => null, // Not implemented yet
            _ => null
        };
    }

    public IEnumerable<IPlatformUploader> GetAllUploaders()
    {
        var uploaders = new List<IPlatformUploader>();

        var steamUploader = _serviceProvider.GetService<SteamUploader>();
        if (steamUploader != null)
        {
            uploaders.Add(steamUploader);
        }

        // Add more uploaders here as they are implemented

        return uploaders;
    }

    public IEnumerable<PlatformType> GetSupportedPlatforms()
    {
        return new[] { PlatformType.Steam };
    }
}
