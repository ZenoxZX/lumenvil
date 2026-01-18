using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using System.Security.Claims;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BuildTemplateController : ControllerBase
{
    private readonly AppDbContext _context;

    public BuildTemplateController(AppDbContext context)
    {
        _context = context;
    }

    private BuildTemplateResponse ToResponse(BuildTemplate t)
    {
        return new BuildTemplateResponse(
            t.Id,
            t.Name,
            t.Description,
            t.ProjectId,
            t.Project?.Name,
            t.Branch,
            t.ScriptingBackend,
            t.UploadToSteam,
            t.SteamBranch,
            t.IsDefault,
            t.CreatedAt,
            t.CreatedBy?.Username
        );
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? projectId)
    {
        var query = _context.BuildTemplates
            .Include(t => t.Project)
            .Include(t => t.CreatedBy)
            .AsQueryable();

        if (projectId.HasValue)
        {
            // Get templates for specific project + global templates
            query = query.Where(t => t.ProjectId == projectId || t.ProjectId == null);
        }

        var templates = await query
            .OrderBy(t => t.ProjectId == null) // Project-specific first
            .ThenByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .ToListAsync();

        return Ok(templates.Select(ToResponse));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var template = await _context.BuildTemplates
            .Include(t => t.Project)
            .Include(t => t.CreatedBy)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
        {
            return NotFound();
        }

        return Ok(ToResponse(template));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Create([FromBody] CreateBuildTemplateRequest request)
    {
        // Validate project if specified
        if (request.ProjectId.HasValue)
        {
            var projectExists = await _context.Projects.AnyAsync(p => p.Id == request.ProjectId);
            if (!projectExists)
            {
                return BadRequest(new { message = "Project not found" });
            }
        }

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var template = new BuildTemplate
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            ProjectId = request.ProjectId,
            Branch = request.Branch,
            ScriptingBackend = request.ScriptingBackend,
            UploadToSteam = request.UploadToSteam,
            SteamBranch = request.SteamBranch,
            IsDefault = request.IsDefault,
            CreatedById = userId,
            CreatedAt = DateTime.UtcNow
        };

        // If this is set as default, unset other defaults for same scope
        if (request.IsDefault)
        {
            await UnsetOtherDefaults(request.ProjectId);
        }

        _context.BuildTemplates.Add(template);
        await _context.SaveChangesAsync();

        // Reload with navigation properties
        await _context.Entry(template).Reference(t => t.Project).LoadAsync();
        await _context.Entry(template).Reference(t => t.CreatedBy).LoadAsync();

        return CreatedAtAction(nameof(GetById), new { id = template.Id }, ToResponse(template));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBuildTemplateRequest request)
    {
        var template = await _context.BuildTemplates
            .Include(t => t.Project)
            .Include(t => t.CreatedBy)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
        {
            return NotFound();
        }

        if (request.Name != null) template.Name = request.Name;
        if (request.Description != null) template.Description = request.Description;
        if (request.Branch != null) template.Branch = request.Branch;
        if (request.ScriptingBackend.HasValue) template.ScriptingBackend = request.ScriptingBackend.Value;
        if (request.UploadToSteam.HasValue) template.UploadToSteam = request.UploadToSteam.Value;
        if (request.SteamBranch != null) template.SteamBranch = request.SteamBranch;

        if (request.IsDefault.HasValue)
        {
            if (request.IsDefault.Value && !template.IsDefault)
            {
                await UnsetOtherDefaults(template.ProjectId);
            }
            template.IsDefault = request.IsDefault.Value;
        }

        await _context.SaveChangesAsync();

        return Ok(ToResponse(template));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var template = await _context.BuildTemplates.FindAsync(id);
        if (template == null)
        {
            return NotFound();
        }

        _context.BuildTemplates.Remove(template);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task UnsetOtherDefaults(Guid? projectId)
    {
        var otherDefaults = await _context.BuildTemplates
            .Where(t => t.ProjectId == projectId && t.IsDefault)
            .ToListAsync();

        foreach (var t in otherDefaults)
        {
            t.IsDefault = false;
        }
    }
}
