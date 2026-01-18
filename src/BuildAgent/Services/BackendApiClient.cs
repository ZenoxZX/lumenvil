using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using BuildAgent.Models;

namespace BuildAgent.Services;

public class BackendApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<BackendApiClient> _logger;

    public BackendApiClient(string baseUrl, ILogger<BackendApiClient> logger)
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(baseUrl)
        };
        _logger = logger;
    }

    public async Task<PipelineScripts?> GetPipelineScriptsAsync(Guid pipelineId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching pipeline scripts for pipeline {PipelineId}", pipelineId);
            var response = await _httpClient.GetAsync($"/api/pipeline/{pipelineId}/scripts", cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<PipelineScripts>(cancellationToken: cancellationToken);
            }

            _logger.LogWarning("Failed to fetch pipeline scripts: {StatusCode}", response.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching pipeline scripts");
            return null;
        }
    }
}
