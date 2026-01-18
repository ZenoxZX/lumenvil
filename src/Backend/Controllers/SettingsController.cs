using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Services;
using Backend.Services.Platforms;
using Backend.Services.Platforms.Steam;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class SettingsController : ControllerBase
{
    private readonly SettingsService _settingsService;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(
        SettingsService settingsService,
        IServiceProvider serviceProvider,
        ILogger<SettingsController> logger)
    {
        _settingsService = settingsService;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    // Steam Settings

    [HttpGet("steam")]
    public async Task<IActionResult> GetSteamSettings()
    {
        var config = await _settingsService.GetSteamConfigAsync();

        // Don't return the actual password
        return Ok(new SteamSettingsResponse(
            config.Username,
            !string.IsNullOrEmpty(config.Password),
            config.SteamCmdPath,
            config.DefaultBranch,
            config.IsConfigured
        ));
    }

    [HttpPut("steam")]
    public async Task<IActionResult> UpdateSteamSettings([FromBody] UpdateSteamSettingsRequest request)
    {
        var config = await _settingsService.GetSteamConfigAsync();

        config.Username = request.Username;
        config.SteamCmdPath = request.SteamCmdPath;
        config.DefaultBranch = request.DefaultBranch;

        // Only update password if provided (not empty)
        if (!string.IsNullOrEmpty(request.Password))
        {
            config.Password = request.Password;
        }

        await _settingsService.SaveSteamConfigAsync(config);

        _logger.LogInformation("Steam settings updated by admin");

        return Ok(new SteamSettingsResponse(
            config.Username,
            !string.IsNullOrEmpty(config.Password),
            config.SteamCmdPath,
            config.DefaultBranch,
            config.IsConfigured
        ));
    }

    [HttpPost("steam/test")]
    public async Task<IActionResult> TestSteamConnection()
    {
        var config = await _settingsService.GetSteamConfigAsync();

        if (!config.IsConfigured)
        {
            return BadRequest(new { message = "Steam is not configured" });
        }

        var uploader = new SteamUploader(
            _serviceProvider.GetRequiredService<ILogger<SteamUploader>>(),
            config
        );

        var result = await uploader.TestConnectionAsync();

        if (result.Success)
        {
            return Ok(new { message = result.Message });
        }
        else
        {
            return BadRequest(new { message = result.Message });
        }
    }

    // Platform Info

    [HttpGet("platforms")]
    public IActionResult GetPlatforms()
    {
        var platforms = new[]
        {
            new PlatformInfo(PlatformType.Steam, "Steam", true),
            new PlatformInfo(PlatformType.Epic, "Epic Games Store", false),
        };

        return Ok(platforms);
    }
}

// DTOs
public record SteamSettingsResponse(
    string? Username,
    bool HasPassword,
    string? SteamCmdPath,
    string? DefaultBranch,
    bool IsConfigured
);

public record UpdateSteamSettingsRequest(
    string? Username,
    string? Password,
    string? SteamCmdPath,
    string? DefaultBranch
);

public record PlatformInfo(
    PlatformType Type,
    string Name,
    bool IsImplemented
);
