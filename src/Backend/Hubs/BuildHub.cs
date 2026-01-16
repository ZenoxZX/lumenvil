using Microsoft.AspNetCore.SignalR;
using Backend.Models;
using Backend.Services;

namespace Backend.Hubs;

public class BuildHub : Hub
{
    private readonly ILogger<BuildHub> _logger;
    private readonly BuildQueueService _buildQueueService;

    public BuildHub(ILogger<BuildHub> logger, BuildQueueService buildQueueService)
    {
        _logger = logger;
        _buildQueueService = buildQueueService;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinBuildGroup(string buildId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"build-{buildId}");
        _logger.LogInformation("Client {ConnectionId} joined build group {BuildId}",
            Context.ConnectionId, buildId);
    }

    public async Task LeaveBuildGroup(string buildId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"build-{buildId}");
    }

    public async Task RegisterAgent(string agentName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "agents");
        _logger.LogInformation("Agent {AgentName} registered with connection {ConnectionId}",
            agentName, Context.ConnectionId);
        await Clients.Others.SendAsync("AgentConnected", agentName);
    }

    public async Task UpdateBuildStatus(Guid buildId, string status, string? errorMessage = null)
    {
        if (Enum.TryParse<BuildStatus>(status, out var buildStatus))
        {
            await _buildQueueService.UpdateBuildStatusAsync(buildId, buildStatus, errorMessage);
        }
    }

    public async Task AddBuildLog(Guid buildId, string level, string message, string stage)
    {
        if (Enum.TryParse<Models.LogLevel>(level, out var logLevel) &&
            Enum.TryParse<BuildStage>(stage, out var buildStage))
        {
            await _buildQueueService.AddBuildLogAsync(buildId, logLevel, message, buildStage);
        }
    }

    public async Task SendBuildProgress(Guid buildId, string stage, int progress, string message)
    {
        await Clients.All.SendAsync("BuildProgress", new
        {
            BuildId = buildId,
            Stage = stage,
            Progress = progress,
            Message = message
        });
    }

    public async Task BuildCompleted(Guid buildId, bool success, string? outputPath = null, long? buildSize = null)
    {
        var status = success ? BuildStatus.Success : BuildStatus.Failed;
        await _buildQueueService.UpdateBuildStatusAsync(buildId, status);

        await Clients.All.SendAsync("BuildCompleted", new
        {
            BuildId = buildId,
            Success = success,
            OutputPath = outputPath,
            BuildSize = buildSize
        });
    }

    public async Task UpdateBuildCommitHash(Guid buildId, string? commitHash)
    {
        await _buildQueueService.UpdateBuildCommitHashAsync(buildId, commitHash);
    }
}
