using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Services;

public class SettingsService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SettingsService> _logger;

    private const string SteamConfigKey = "platform:steam";

    public SettingsService(IServiceScopeFactory scopeFactory, ILogger<SettingsService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<SteamConfig> GetSteamConfigAsync()
    {
        var json = await GetSettingAsync(SteamConfigKey);
        if (string.IsNullOrEmpty(json))
        {
            return new SteamConfig();
        }

        try
        {
            return JsonSerializer.Deserialize<SteamConfig>(json) ?? new SteamConfig();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize Steam config");
            return new SteamConfig();
        }
    }

    public async Task SaveSteamConfigAsync(SteamConfig config)
    {
        var json = JsonSerializer.Serialize(config);
        await SetSettingAsync(SteamConfigKey, json);
    }

    public async Task<string?> GetSettingAsync(string key)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var setting = await context.Settings.FindAsync(key);
        return setting?.Value;
    }

    public async Task SetSettingAsync(string key, string value)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var setting = await context.Settings.FindAsync(key);
        if (setting == null)
        {
            setting = new Setting { Key = key, Value = value };
            context.Settings.Add(setting);
        }
        else
        {
            setting.Value = value;
        }

        await context.SaveChangesAsync();
    }

    public async Task<Dictionary<string, string>> GetAllSettingsAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        return await context.Settings.ToDictionaryAsync(s => s.Key, s => s.Value);
    }
}
