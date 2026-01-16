using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GitController : ControllerBase
{
    private readonly IGitApiService _gitService;
    private readonly ILogger<GitController> _logger;

    public GitController(IGitApiService gitService, ILogger<GitController> logger)
    {
        _gitService = gitService;
        _logger = logger;
    }

    [HttpGet("branches")]
    public async Task<ActionResult<GitBranchesResponse>> GetBranches([FromQuery] string gitUrl, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(gitUrl))
        {
            return BadRequest(new { message = "gitUrl is required" });
        }

        try
        {
            var branches = await _gitService.GetBranchesAsync(gitUrl, ct);
            return Ok(new GitBranchesResponse(branches.ToList()));
        }
        catch (GitAuthenticationException ex)
        {
            _logger.LogWarning(ex, "Authentication failed for repository {GitUrl}", gitUrl);
            return BadRequest(new { message = "Authentication failed. Only public repositories are supported." });
        }
        catch (GitRepositoryNotFoundException ex)
        {
            _logger.LogWarning(ex, "Repository not found {GitUrl}", gitUrl);
            return NotFound(new { message = "Repository not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting branches for {GitUrl}", gitUrl);
            return StatusCode(500, new { message = "Failed to get branches" });
        }
    }

    [HttpGet("validate")]
    public async Task<ActionResult<GitValidateResponse>> ValidateRepository([FromQuery] string gitUrl, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(gitUrl))
        {
            return BadRequest(new { message = "gitUrl is required" });
        }

        try
        {
            var valid = await _gitService.ValidateRepositoryAsync(gitUrl, ct);
            return Ok(new GitValidateResponse(valid));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating repository {GitUrl}", gitUrl);
            return Ok(new GitValidateResponse(false));
        }
    }
}

public record GitBranchesResponse(List<string> Branches);
public record GitValidateResponse(bool Valid);
