using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PipelineController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly CodeGeneratorService _codeGenerator;
    private readonly ILogger<PipelineController> _logger;

    public PipelineController(
        AppDbContext context,
        CodeGeneratorService codeGenerator,
        ILogger<PipelineController> logger)
    {
        _context = context;
        _codeGenerator = codeGenerator;
        _logger = logger;
    }

    #region Pipeline CRUD

    /// <summary>
    /// Get all pipelines, optionally filtered by project
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPipelines([FromQuery] Guid? projectId)
    {
        var query = _context.BuildPipelines
            .Include(p => p.Project)
            .Include(p => p.CreatedBy)
            .Include(p => p.Processes)
            .AsQueryable();

        if (projectId.HasValue)
        {
            // Get project-specific and global pipelines
            query = query.Where(p => p.ProjectId == projectId || p.ProjectId == null);
        }

        var pipelines = await query
            .OrderBy(p => p.Name)
            .Select(p => new PipelineResponse(
                p.Id,
                p.Name,
                p.Description,
                p.ProjectId,
                p.Project != null ? p.Project.Name : null,
                p.IsDefault,
                p.IsActive,
                p.Processes.Count,
                p.CreatedAt,
                p.CreatedBy != null ? p.CreatedBy.Username : null
            ))
            .ToListAsync();

        return Ok(pipelines);
    }

    /// <summary>
    /// Get pipeline with all processes
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPipeline(Guid id)
    {
        var pipeline = await _context.BuildPipelines
            .Include(p => p.Project)
            .Include(p => p.CreatedBy)
            .Include(p => p.Processes.OrderBy(pr => pr.Order))
            .FirstOrDefaultAsync(p => p.Id == id);

        if (pipeline == null)
        {
            return NotFound(new { message = "Pipeline not found" });
        }

        var response = new PipelineDetailResponse(
            pipeline.Id,
            pipeline.Name,
            pipeline.Description,
            pipeline.ProjectId,
            pipeline.Project?.Name,
            pipeline.IsDefault,
            pipeline.IsActive,
            pipeline.Processes.Select(pr => new ProcessResponse(
                pr.Id,
                pr.PipelineId,
                pr.Name,
                pr.Type,
                pr.Phase,
                pr.Order,
                JsonSerializer.Deserialize<object>(pr.ConfigurationJson) ?? new { },
                pr.IsEnabled,
                pr.CreatedAt
            )).ToList(),
            pipeline.CreatedAt,
            pipeline.UpdatedAt,
            pipeline.CreatedBy?.Username
        );

        return Ok(response);
    }

    /// <summary>
    /// Create a new pipeline
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> CreatePipeline([FromBody] CreatePipelineRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        // If setting as default, unset other defaults for this project
        if (request.IsDefault)
        {
            var existingDefaults = await _context.BuildPipelines
                .Where(p => p.ProjectId == request.ProjectId && p.IsDefault)
                .ToListAsync();
            foreach (var p in existingDefaults)
            {
                p.IsDefault = false;
            }
        }

        var pipeline = new BuildPipeline
        {
            Name = request.Name,
            Description = request.Description,
            ProjectId = request.ProjectId,
            IsDefault = request.IsDefault,
            CreatedById = userId
        };

        _context.BuildPipelines.Add(pipeline);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Pipeline '{Name}' created by user {UserId}", request.Name, userId);

        return CreatedAtAction(nameof(GetPipeline), new { id = pipeline.Id }, new PipelineResponse(
            pipeline.Id,
            pipeline.Name,
            pipeline.Description,
            pipeline.ProjectId,
            null,
            pipeline.IsDefault,
            pipeline.IsActive,
            0,
            pipeline.CreatedAt,
            null
        ));
    }

    /// <summary>
    /// Update pipeline
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> UpdatePipeline(Guid id, [FromBody] UpdatePipelineRequest request)
    {
        var pipeline = await _context.BuildPipelines.FindAsync(id);
        if (pipeline == null)
        {
            return NotFound(new { message = "Pipeline not found" });
        }

        if (request.Name != null) pipeline.Name = request.Name;
        if (request.Description != null) pipeline.Description = request.Description;
        if (request.IsActive.HasValue) pipeline.IsActive = request.IsActive.Value;

        if (request.IsDefault == true && !pipeline.IsDefault)
        {
            // Unset other defaults
            var existingDefaults = await _context.BuildPipelines
                .Where(p => p.ProjectId == pipeline.ProjectId && p.IsDefault && p.Id != id)
                .ToListAsync();
            foreach (var p in existingDefaults)
            {
                p.IsDefault = false;
            }
            pipeline.IsDefault = true;
        }
        else if (request.IsDefault == false)
        {
            pipeline.IsDefault = false;
        }

        pipeline.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new PipelineResponse(
            pipeline.Id,
            pipeline.Name,
            pipeline.Description,
            pipeline.ProjectId,
            null,
            pipeline.IsDefault,
            pipeline.IsActive,
            0,
            pipeline.CreatedAt,
            null
        ));
    }

    /// <summary>
    /// Delete pipeline
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> DeletePipeline(Guid id)
    {
        var pipeline = await _context.BuildPipelines.FindAsync(id);
        if (pipeline == null)
        {
            return NotFound(new { message = "Pipeline not found" });
        }

        _context.BuildPipelines.Remove(pipeline);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Pipeline '{Name}' deleted", pipeline.Name);

        return NoContent();
    }

    #endregion

    #region Process CRUD

    /// <summary>
    /// Add process to pipeline
    /// </summary>
    [HttpPost("{pipelineId}/process")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> AddProcess(Guid pipelineId, [FromBody] CreateProcessRequest request)
    {
        var pipeline = await _context.BuildPipelines.FindAsync(pipelineId);
        if (pipeline == null)
        {
            return NotFound(new { message = "Pipeline not found" });
        }

        var process = new BuildProcess
        {
            PipelineId = pipelineId,
            Name = request.Name,
            Type = request.Type,
            Phase = request.Phase,
            Order = request.Order,
            ConfigurationJson = JsonSerializer.Serialize(request.Configuration)
        };

        _context.BuildProcesses.Add(process);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPipeline), new { id = pipelineId }, new ProcessResponse(
            process.Id,
            process.PipelineId,
            process.Name,
            process.Type,
            process.Phase,
            process.Order,
            request.Configuration,
            process.IsEnabled,
            process.CreatedAt
        ));
    }

    /// <summary>
    /// Update process
    /// </summary>
    [HttpPut("{pipelineId}/process/{processId}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> UpdateProcess(Guid pipelineId, Guid processId, [FromBody] UpdateProcessRequest request)
    {
        var process = await _context.BuildProcesses
            .FirstOrDefaultAsync(p => p.Id == processId && p.PipelineId == pipelineId);

        if (process == null)
        {
            return NotFound(new { message = "Process not found" });
        }

        if (request.Name != null) process.Name = request.Name;
        if (request.Phase.HasValue) process.Phase = request.Phase.Value;
        if (request.Order.HasValue) process.Order = request.Order.Value;
        if (request.IsEnabled.HasValue) process.IsEnabled = request.IsEnabled.Value;
        if (request.Configuration != null)
        {
            process.ConfigurationJson = JsonSerializer.Serialize(request.Configuration);
        }

        await _context.SaveChangesAsync();

        return Ok(new ProcessResponse(
            process.Id,
            process.PipelineId,
            process.Name,
            process.Type,
            process.Phase,
            process.Order,
            JsonSerializer.Deserialize<object>(process.ConfigurationJson) ?? new { },
            process.IsEnabled,
            process.CreatedAt
        ));
    }

    /// <summary>
    /// Delete process
    /// </summary>
    [HttpDelete("{pipelineId}/process/{processId}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> DeleteProcess(Guid pipelineId, Guid processId)
    {
        var process = await _context.BuildProcesses
            .FirstOrDefaultAsync(p => p.Id == processId && p.PipelineId == pipelineId);

        if (process == null)
        {
            return NotFound(new { message = "Process not found" });
        }

        _context.BuildProcesses.Remove(process);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Reorder processes in pipeline
    /// </summary>
    [HttpPut("{pipelineId}/reorder")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> ReorderProcesses(Guid pipelineId, [FromBody] ReorderProcessesRequest request)
    {
        var processes = await _context.BuildProcesses
            .Where(p => p.PipelineId == pipelineId)
            .ToListAsync();

        for (int i = 0; i < request.ProcessIds.Count; i++)
        {
            var process = processes.FirstOrDefault(p => p.Id == request.ProcessIds[i]);
            if (process != null)
            {
                process.Order = i;
            }
        }

        await _context.SaveChangesAsync();

        return Ok();
    }

    #endregion

    #region Script Generation

    /// <summary>
    /// Generate Unity scripts for a pipeline
    /// </summary>
    [HttpGet("{id}/scripts")]
    [AllowAnonymous]
    public async Task<IActionResult> GenerateScripts(Guid id)
    {
        var pipeline = await _context.BuildPipelines
            .Include(p => p.Processes.OrderBy(pr => pr.Order))
            .FirstOrDefaultAsync(p => p.Id == id);

        if (pipeline == null)
        {
            return NotFound(new { message = "Pipeline not found" });
        }

        var scripts = _codeGenerator.GenerateScripts(pipeline);

        return Ok(new
        {
            pipelineId = pipeline.Id,
            pipelineName = pipeline.Name,
            hasScripts = scripts.HasScripts,
            preBuildScript = scripts.PreBuildScript,
            postBuildScript = scripts.PostBuildScript
        });
    }

    #endregion

    #region Process Types Info

    /// <summary>
    /// Get available process types with default configurations
    /// </summary>
    [HttpGet("types")]
    public IActionResult GetProcessTypes()
    {
        var types = new List<ProcessTypeInfo>
        {
            new(
                ProcessType.DefineSymbols,
                "Define Symbols",
                "Add or remove scripting define symbols before build",
                BuildPhase.PreBuild,
                new DefineSymbolsConfig()
            ),
            new(
                ProcessType.PlayerSettings,
                "Player Settings",
                "Modify Unity PlayerSettings before build",
                BuildPhase.PreBuild,
                new PlayerSettingsConfig()
            ),
            new(
                ProcessType.SceneList,
                "Scene List",
                "Configure which scenes to include in build",
                BuildPhase.PreBuild,
                new SceneListConfig()
            ),
            new(
                ProcessType.CustomCode,
                "Custom Code",
                "Execute custom C# code during build",
                BuildPhase.PreBuild,
                new CustomCodeConfig()
            ),
            new(
                ProcessType.ShellCommand,
                "Shell Command",
                "Execute shell/batch command",
                BuildPhase.PostBuild,
                new ShellCommandConfig()
            ),
            new(
                ProcessType.FileCopy,
                "File Copy",
                "Copy or move files",
                BuildPhase.PostBuild,
                new FileCopyConfig()
            )
        };

        return Ok(types);
    }

    #endregion
}
