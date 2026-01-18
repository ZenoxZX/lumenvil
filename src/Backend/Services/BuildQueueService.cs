using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Hubs;
using Backend.Models;
using Backend.Models.DTOs;
using Backend.Services.Notifications;

namespace Backend.Services;

public class BuildQueueService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<BuildHub> _hubContext;
    private readonly NotificationService _notificationService;
    private readonly Channel<Guid> _buildQueue;
    private readonly ILogger<BuildQueueService> _logger;

    public BuildQueueService(
        IServiceScopeFactory scopeFactory,
        IHubContext<BuildHub> hubContext,
        NotificationService notificationService,
        ILogger<BuildQueueService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _notificationService = notificationService;
        _logger = logger;
        _buildQueue = Channel.CreateUnbounded<Guid>();
    }

    public async Task QueueBuildAsync(Guid buildId)
    {
        await _buildQueue.Writer.WriteAsync(buildId);
        _logger.LogInformation("Build {BuildId} queued", buildId);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Build Queue Service started");

        await foreach (var buildId in _buildQueue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessBuildAsync(buildId, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing build {BuildId}", buildId);
            }
        }
    }

    private async Task ProcessBuildAsync(Guid buildId, CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var build = await context.Builds
            .Include(b => b.Project)
            .FirstOrDefaultAsync(b => b.Id == buildId, stoppingToken);

        if (build == null)
        {
            _logger.LogWarning("Build {BuildId} not found", buildId);
            return;
        }

        _logger.LogInformation("Processing build {BuildId} for project {ProjectName}",
            buildId, build.Project.Name);

        // Notify that build is being processed (agent will pick it up via SignalR)
        await _hubContext.Clients.All.SendAsync("BuildQueued", new
        {
            BuildId = build.Id,
            ProjectId = build.ProjectId,
            ProjectName = build.Project.Name,
            BuildNumber = build.BuildNumber,
            Branch = build.Branch,
            ScriptingBackend = build.ScriptingBackend.ToString(),
            UnityVersion = build.Project.UnityVersion,
            BuildPath = build.Project.BuildPath,
            GitUrl = build.Project.GitUrl
        }, stoppingToken);
    }

    public async Task<BuildResponse> CreateBuildAsync(CreateBuildRequest request, Guid? triggeredById)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var project = await context.Projects.FindAsync(request.ProjectId);
        if (project == null)
        {
            throw new ArgumentException("Project not found");
        }

        var lastBuild = await context.Builds
            .Where(b => b.ProjectId == request.ProjectId)
            .OrderByDescending(b => b.BuildNumber)
            .FirstOrDefaultAsync();

        var build = new Build
        {
            Id = Guid.NewGuid(),
            ProjectId = request.ProjectId,
            BuildNumber = (lastBuild?.BuildNumber ?? 0) + 1,
            Branch = request.Branch ?? project.DefaultBranch,
            ScriptingBackend = request.ScriptingBackend,
            Status = BuildStatus.Queued,
            UploadToSteam = request.UploadToSteam,
            SteamBranch = request.SteamBranch,
            TriggeredById = triggeredById,
            CreatedAt = DateTime.UtcNow
        };

        context.Builds.Add(build);
        await context.SaveChangesAsync();

        await QueueBuildAsync(build.Id);

        var triggeredBy = triggeredById.HasValue
            ? await context.Users.FindAsync(triggeredById.Value)
            : null;

        return new BuildResponse(
            build.Id,
            build.ProjectId,
            project.Name,
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
            triggeredBy?.Username,
            build.CreatedAt
        );
    }

    public async Task UpdateBuildStatusAsync(Guid buildId, BuildStatus status, string? errorMessage = null)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var build = await context.Builds
            .Include(b => b.Project)
            .Include(b => b.TriggeredBy)
            .FirstOrDefaultAsync(b => b.Id == buildId);
        if (build == null) return;

        var previousStatus = build.Status;
        build.Status = status;
        if (errorMessage != null) build.ErrorMessage = errorMessage;

        if (status == BuildStatus.Building && !build.StartedAt.HasValue)
        {
            build.StartedAt = DateTime.UtcNow;
        }

        if (status is BuildStatus.Success or BuildStatus.Failed or BuildStatus.Cancelled)
        {
            build.CompletedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("BuildStatusUpdated", new
        {
            BuildId = buildId,
            Status = status.ToString(),
            ErrorMessage = errorMessage
        });

        // Send notifications for relevant status changes
        await SendBuildNotificationAsync(build, previousStatus, status);
    }

    private async Task SendBuildNotificationAsync(Build build, BuildStatus previousStatus, BuildStatus newStatus)
    {
        NotificationEvent? eventType = newStatus switch
        {
            BuildStatus.Cloning when previousStatus == BuildStatus.Queued => NotificationEvent.BuildStarted,
            BuildStatus.Success => NotificationEvent.BuildCompleted,
            BuildStatus.Failed => NotificationEvent.BuildFailed,
            BuildStatus.Cancelled => NotificationEvent.BuildCancelled,
            _ => null
        };

        if (eventType == null) return;

        try
        {
            var notification = NotificationService.CreateFromBuild(
                build,
                eventType.Value,
                build.Project.Name,
                build.TriggeredBy?.Username
            );

            await _notificationService.SendNotificationAsync(notification);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send notification for build {BuildId}", build.Id);
        }
    }

    public async Task AddBuildLogAsync(Guid buildId, Models.LogLevel level, string message, BuildStage stage)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var log = new BuildLog
        {
            Id = Guid.NewGuid(),
            BuildId = buildId,
            Level = level,
            Message = message,
            Stage = stage,
            Timestamp = DateTime.UtcNow
        };

        context.BuildLogs.Add(log);
        await context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("BuildLogAdded", new
        {
            BuildId = buildId,
            Log = new BuildLogResponse(log.Id, log.Timestamp, log.Level, log.Message, log.Stage)
        });
    }

    public async Task UpdateBuildCommitHashAsync(Guid buildId, string? commitHash)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var build = await context.Builds.FindAsync(buildId);
        if (build == null) return;

        build.CommitHash = commitHash;
        await context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("BuildCommitHashUpdated", new
        {
            BuildId = buildId,
            CommitHash = commitHash
        });
    }
}
