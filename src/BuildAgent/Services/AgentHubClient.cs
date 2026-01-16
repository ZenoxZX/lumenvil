using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;
using BuildAgent.Models;

namespace BuildAgent.Services;

public class AgentHubClient : IAsyncDisposable
{
    private readonly HubConnection _connection;
    private readonly ILogger<AgentHubClient> _logger;
    private readonly string _agentName;

    public event Func<BuildJob, Task>? OnBuildQueued;

    public AgentHubClient(string hubUrl, string agentName, ILogger<AgentHubClient> logger)
    {
        _agentName = agentName;
        _logger = logger;

        _connection = new HubConnectionBuilder()
            .WithUrl(hubUrl)
            .WithAutomaticReconnect(new[] { TimeSpan.Zero, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(10) })
            .Build();

        _connection.Reconnecting += error =>
        {
            _logger.LogWarning("Connection lost, attempting to reconnect...");
            return Task.CompletedTask;
        };

        _connection.Reconnected += async connectionId =>
        {
            _logger.LogInformation("Reconnected with connection ID: {ConnectionId}", connectionId);
            await RegisterAgentAsync();
        };

        _connection.Closed += error =>
        {
            _logger.LogError(error, "Connection closed");
            return Task.CompletedTask;
        };

        _connection.On<BuildJob>("BuildQueued", async job =>
        {
            _logger.LogInformation("Received build job: {ProjectName} #{BuildNumber}", job.ProjectName, job.BuildNumber);
            if (OnBuildQueued != null)
            {
                await OnBuildQueued.Invoke(job);
            }
        });
    }

    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await _connection.StartAsync(cancellationToken);
                _logger.LogInformation("Connected to hub");
                await RegisterAgentAsync();
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to connect, retrying in 5 seconds...");
                await Task.Delay(5000, cancellationToken);
            }
        }
    }

    private async Task RegisterAgentAsync()
    {
        await _connection.InvokeAsync("RegisterAgent", _agentName);
        _logger.LogInformation("Agent registered as: {AgentName}", _agentName);
    }

    public async Task UpdateBuildStatusAsync(Guid buildId, string status, string? errorMessage = null)
    {
        await _connection.InvokeAsync("UpdateBuildStatus", buildId, status, errorMessage);
    }

    public async Task AddBuildLogAsync(Guid buildId, string level, string message, string stage)
    {
        await _connection.InvokeAsync("AddBuildLog", buildId, level, message, stage);
    }

    public async Task SendBuildProgressAsync(Guid buildId, string stage, int progress, string message)
    {
        await _connection.InvokeAsync("SendBuildProgress", buildId, stage, progress, message);
    }

    public async Task BuildCompletedAsync(Guid buildId, bool success, string? outputPath = null, long? buildSize = null)
    {
        await _connection.InvokeAsync("BuildCompleted", buildId, success, outputPath, buildSize);
    }

    public async ValueTask DisposeAsync()
    {
        await _connection.DisposeAsync();
    }
}
