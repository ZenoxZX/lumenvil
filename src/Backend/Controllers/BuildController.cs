using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using Backend.Services;
using Backend.Services.Platforms;
using Backend.Services.Platforms.Steam;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BuildController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly BuildQueueService _buildQueueService;
    private readonly SettingsService _settingsService;
    private readonly ILogger<BuildController> _logger;

    public BuildController(
        AppDbContext context,
        BuildQueueService buildQueueService,
        SettingsService settingsService,
        ILogger<BuildController> logger)
    {
        _context = context;
        _buildQueueService = buildQueueService;
        _settingsService = settingsService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? projectId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.Builds
            .Include(b => b.Project)
            .Include(b => b.TriggeredBy)
            .AsQueryable();

        if (projectId.HasValue)
        {
            query = query.Where(b => b.ProjectId == projectId.Value);
        }

        var totalCount = await query.CountAsync();
        var builds = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = builds.Select(b => new BuildResponse(
            b.Id,
            b.ProjectId,
            b.Project.Name,
            b.BuildNumber,
            b.Branch,
            b.CommitHash,
            b.ScriptingBackend,
            b.BuildTarget,
            b.Status,
            b.StartedAt,
            b.CompletedAt,
            b.OutputPath,
            b.BuildSize,
            b.UploadToSteam,
            b.SteamBranch,
            b.SteamUploadStatus,
            b.SteamBuildId,
            b.ErrorMessage,
            b.TriggeredBy?.Username,
            b.CreatedAt
        ));

        return Ok(new
        {
            Data = response,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var build = await _context.Builds
            .Include(b => b.Project)
            .Include(b => b.TriggeredBy)
            .Include(b => b.Logs.OrderBy(l => l.Timestamp))
            .FirstOrDefaultAsync(b => b.Id == id);

        if (build == null)
        {
            return NotFound();
        }

        var buildResponse = new BuildResponse(
            build.Id,
            build.ProjectId,
            build.Project.Name,
            build.BuildNumber,
            build.Branch,
            build.CommitHash,
            build.ScriptingBackend,
            build.BuildTarget,
            build.Status,
            build.StartedAt,
            build.CompletedAt,
            build.OutputPath,
            build.BuildSize,
            build.UploadToSteam,
            build.SteamBranch,
            build.SteamUploadStatus,
            build.SteamBuildId,
            build.ErrorMessage,
            build.TriggeredBy?.Username,
            build.CreatedAt
        );

        var logsResponse = build.Logs.Select(l => new BuildLogResponse(
            l.Id,
            l.Timestamp,
            l.Level,
            l.Message,
            l.Stage
        )).ToList();

        return Ok(new BuildDetailResponse(buildResponse, logsResponse));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Create([FromBody] CreateBuildRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        Guid? userId = null;
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedId))
        {
            userId = parsedId;
        }

        try
        {
            var build = await _buildQueueService.CreateBuildAsync(request, userId);
            return CreatedAtAction(nameof(GetById), new { id = build.Id }, build);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            if (ex.InnerException?.Message.Contains("FOREIGN KEY") == true)
            {
                return BadRequest(new { message = "Project not found. Please select a valid project." });
            }
            return StatusCode(500, new { message = "Database error occurred. Please try again." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"An unexpected error occurred: {ex.Message}" });
        }
    }

    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var build = await _context.Builds.FindAsync(id);
        if (build == null)
        {
            return NotFound();
        }

        if (build.Status is not (BuildStatus.Queued or BuildStatus.Cloning or BuildStatus.Building))
        {
            return BadRequest(new { message = "Build cannot be cancelled in its current state" });
        }

        await _buildQueueService.UpdateBuildStatusAsync(id, BuildStatus.Cancelled);
        return Ok(new { message = "Build cancelled" });
    }

    [HttpGet("{id}/logs")]
    public async Task<IActionResult> GetLogs(Guid id, [FromQuery] int? after = null)
    {
        var query = _context.BuildLogs
            .Where(l => l.BuildId == id)
            .OrderBy(l => l.Timestamp)
            .AsQueryable();

        if (after.HasValue)
        {
            query = query.Skip(after.Value);
        }

        var logs = await query.ToListAsync();

        return Ok(logs.Select(l => new BuildLogResponse(
            l.Id,
            l.Timestamp,
            l.Level,
            l.Message,
            l.Stage
        )));
    }

    [HttpPost("{id}/upload")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> TriggerUpload(Guid id)
    {
        var build = await _context.Builds
            .Include(b => b.Project)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (build == null)
        {
            return NotFound(new { message = "Build not found" });
        }

        if (build.Status != BuildStatus.Success)
        {
            return BadRequest(new { message = "Only successful builds can be uploaded" });
        }

        if (string.IsNullOrEmpty(build.OutputPath))
        {
            return BadRequest(new { message = "Build has no output path" });
        }

        var steamConfig = await _settingsService.GetSteamConfigAsync();
        if (!steamConfig.IsConfigured)
        {
            return BadRequest(new { message = "Steam is not configured. Please configure Steam settings first." });
        }

        if (string.IsNullOrEmpty(build.Project.SteamAppId) || string.IsNullOrEmpty(build.Project.SteamDepotId))
        {
            return BadRequest(new { message = "Project does not have Steam AppId and DepotId configured" });
        }

        // Update status to uploading
        build.SteamUploadStatus = "Uploading";
        await _context.SaveChangesAsync();

        try
        {
            var uploader = new SteamUploader(
                HttpContext.RequestServices.GetRequiredService<ILogger<SteamUploader>>(),
                steamConfig
            );

            var artifact = new BuildArtifact(
                build.Id,
                build.Project.Name,
                build.BuildNumber,
                build.OutputPath,
                build.Project.SteamAppId,
                build.Project.SteamDepotId,
                build.SteamBranch
            );

            var result = await uploader.UploadAsync(artifact);

            if (result.Success)
            {
                build.SteamUploadStatus = "Success";
                build.SteamBuildId = result.BuildId;
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Upload completed successfully",
                    buildId = result.BuildId,
                    uploadedSize = result.UploadedSize
                });
            }
            else
            {
                build.SteamUploadStatus = $"Failed: {result.Message}";
                await _context.SaveChangesAsync();

                return BadRequest(new { message = result.Message });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload build {BuildId} to Steam", id);
            build.SteamUploadStatus = $"Failed: {ex.Message}";
            await _context.SaveChangesAsync();

            return StatusCode(500, new { message = $"Upload failed: {ex.Message}" });
        }
    }
}
