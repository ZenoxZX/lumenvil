using System.Collections.Concurrent;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using BuildAgent.Models;

namespace BuildAgent.Services;

public class BuildService : BackgroundService
{
    private readonly ILogger<BuildService> _logger;
    private readonly AgentHubClient _hubClient;
    private readonly UnityBuildRunner _buildRunner;
    private readonly ConcurrentQueue<BuildJob> _buildQueue;
    private readonly SemaphoreSlim _buildSemaphore;
    private bool _isProcessing;

    public BuildService(
        ILogger<BuildService> logger,
        AgentHubClient hubClient,
        UnityBuildRunner buildRunner,
        int maxConcurrentBuilds = 1)
    {
        _logger = logger;
        _hubClient = hubClient;
        _buildRunner = buildRunner;
        _buildQueue = new ConcurrentQueue<BuildJob>();
        _buildSemaphore = new SemaphoreSlim(maxConcurrentBuilds, maxConcurrentBuilds);

        _hubClient.OnBuildQueued += OnBuildQueuedAsync;
    }

    private Task OnBuildQueuedAsync(BuildJob job)
    {
        _logger.LogInformation("Build queued: {ProjectName} #{BuildNumber}", job.ProjectName, job.BuildNumber);
        _buildQueue.Enqueue(job);
        return Task.CompletedTask;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Build Service started");

        // Connect to hub
        await _hubClient.ConnectAsync(stoppingToken);

        // Process queue
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_buildQueue.TryDequeue(out var job))
                {
                    await _buildSemaphore.WaitAsync(stoppingToken);

                    try
                    {
                        _isProcessing = true;
                        _logger.LogInformation("Processing build: {ProjectName} #{BuildNumber}",
                            job.ProjectName, job.BuildNumber);

                        await _buildRunner.RunBuildAsync(job, stoppingToken);
                    }
                    finally
                    {
                        _isProcessing = false;
                        _buildSemaphore.Release();
                    }
                }
                else
                {
                    await Task.Delay(1000, stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing build");
                await Task.Delay(5000, stoppingToken);
            }
        }

        _logger.LogInformation("Build Service stopped");
    }

    public bool IsProcessing => _isProcessing;
    public int QueueLength => _buildQueue.Count;
}
