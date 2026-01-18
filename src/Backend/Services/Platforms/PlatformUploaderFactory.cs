using Backend.Models;
using Backend.Services.Platforms.Steam;

namespace Backend.Services.Platforms;

public class PlatformUploaderFactory
{
    private readonly SettingsService _settingsService;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<PlatformUploaderFactory> _logger;

    public PlatformUploaderFactory(
        SettingsService settingsService,
        ILoggerFactory loggerFactory,
        ILogger<PlatformUploaderFactory> logger)
    {
        _settingsService = settingsService;
        _loggerFactory = loggerFactory;
        _logger = logger;
    }

    public async Task<IPlatformUploader?> GetUploaderAsync(PlatformType platform)
    {
        return platform switch
        {
            PlatformType.Steam => await CreateSteamUploaderAsync(),
            PlatformType.Epic => null, // Not implemented yet
            _ => null
        };
    }

    private async Task<SteamUploader> CreateSteamUploaderAsync()
    {
        var config = await _settingsService.GetSteamConfigAsync();
        var logger = _loggerFactory.CreateLogger<SteamUploader>();
        return new SteamUploader(logger, config);
    }

    public IEnumerable<PlatformType> GetSupportedPlatforms()
    {
        return new[] { PlatformType.Steam };
    }
}
