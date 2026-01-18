using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProjectController(AppDbContext context)
    {
        _context = context;
    }

    private static ProjectNotificationSettingsDto? ParseNotificationSettings(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;

        try
        {
            var config = JsonSerializer.Deserialize<ProjectNotificationConfig>(json);
            if (config == null) return null;

            return new ProjectNotificationSettingsDto(
                config.UseGlobalSettings,
                config.Discord != null ? new ProjectDiscordSettingsDto(
                    config.Discord.Enabled,
                    config.Discord.WebhookUrl,
                    config.Discord.Events
                ) : null,
                config.Slack != null ? new ProjectSlackSettingsDto(
                    config.Slack.Enabled,
                    config.Slack.WebhookUrl,
                    config.Slack.Events
                ) : null,
                config.Webhook != null ? new ProjectWebhookSettingsDto(
                    config.Webhook.Enabled,
                    config.Webhook.Url,
                    !string.IsNullOrEmpty(config.Webhook.Secret),
                    config.Webhook.Events
                ) : null
            );
        }
        catch
        {
            return null;
        }
    }

    private ProjectResponse ToResponse(Project p, int totalBuilds, int successfulBuilds)
    {
        return new ProjectResponse(
            p.Id,
            p.Name,
            p.Description,
            p.GitUrl,
            p.DefaultBranch,
            p.UnityVersion,
            p.BuildPath,
            p.SteamAppId,
            p.SteamDepotId,
            p.IsActive,
            p.CreatedAt,
            totalBuilds,
            successfulBuilds,
            ParseNotificationSettings(p.NotificationSettingsJson)
        );
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var projects = await _context.Projects
            .Include(p => p.Builds)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var response = projects.Select(p => ToResponse(
            p,
            p.Builds.Count,
            p.Builds.Count(b => b.Status == BuildStatus.Success)
        ));

        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.Builds)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null)
        {
            return NotFound();
        }

        return Ok(ToResponse(
            project,
            project.Builds.Count,
            project.Builds.Count(b => b.Status == BuildStatus.Success)
        ));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Create([FromBody] CreateProjectRequest request)
    {
        if (await _context.Projects.AnyAsync(p => p.Name == request.Name))
        {
            return BadRequest(new { message = "Project with this name already exists" });
        }

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            GitUrl = request.GitUrl,
            DefaultBranch = request.DefaultBranch,
            UnityVersion = request.UnityVersion,
            BuildPath = request.BuildPath,
            SteamAppId = request.SteamAppId,
            SteamDepotId = request.SteamDepotId,
            CreatedAt = DateTime.UtcNow
        };

        // Handle notification settings
        if (request.NotificationSettings != null)
        {
            project.NotificationSettingsJson = SerializeNotificationSettings(request.NotificationSettings);
        }

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, ToResponse(project, 0, 0));
    }

    private static string? SerializeNotificationSettings(ProjectNotificationSettingsDto dto)
    {
        var config = new ProjectNotificationConfig
        {
            UseGlobalSettings = dto.UseGlobalSettings
        };

        if (dto.Discord != null)
        {
            config.Discord = new DiscordConfig
            {
                Enabled = dto.Discord.Enabled,
                WebhookUrl = dto.Discord.WebhookUrl,
                Events = dto.Discord.Events ?? new List<NotificationEvent>()
            };
        }

        if (dto.Slack != null)
        {
            config.Slack = new SlackConfig
            {
                Enabled = dto.Slack.Enabled,
                WebhookUrl = dto.Slack.WebhookUrl,
                Events = dto.Slack.Events ?? new List<NotificationEvent>()
            };
        }

        if (dto.Webhook != null)
        {
            config.Webhook = new WebhookConfig
            {
                Enabled = dto.Webhook.Enabled,
                Url = dto.Webhook.Url,
                Events = dto.Webhook.Events ?? new List<NotificationEvent>()
            };
        }

        return JsonSerializer.Serialize(config);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectRequest request)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
        {
            return NotFound();
        }

        if (request.Name != null) project.Name = request.Name;
        if (request.Description != null) project.Description = request.Description;
        if (request.GitUrl != null) project.GitUrl = request.GitUrl;
        if (request.DefaultBranch != null) project.DefaultBranch = request.DefaultBranch;
        if (request.UnityVersion != null) project.UnityVersion = request.UnityVersion;
        if (request.BuildPath != null) project.BuildPath = request.BuildPath;
        if (request.SteamAppId != null) project.SteamAppId = request.SteamAppId;
        if (request.SteamDepotId != null) project.SteamDepotId = request.SteamDepotId;
        if (request.IsActive.HasValue) project.IsActive = request.IsActive.Value;

        // Handle notification settings
        if (request.NotificationSettings != null)
        {
            project.NotificationSettingsJson = SerializeNotificationSettings(request.NotificationSettings);
        }

        await _context.SaveChangesAsync();

        var builds = await _context.Builds.Where(b => b.ProjectId == id).ToListAsync();

        return Ok(ToResponse(project, builds.Count, builds.Count(b => b.Status == BuildStatus.Success)));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
        {
            return NotFound();
        }

        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
