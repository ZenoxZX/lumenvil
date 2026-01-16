using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using BuildAgent.Services;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        // Configuration
        var hubUrl = context.Configuration["HubUrl"] ?? "http://localhost:5000/hubs/build";
        var agentName = context.Configuration["AgentName"] ?? Environment.MachineName;
        var unityHubPath = context.Configuration["UnityHubPath"] ?? @"C:\Program Files\Unity\Hub\Editor";
        var buildOutputBase = context.Configuration["BuildOutputBase"] ?? @"D:\Builds";
        var workspacePath = context.Configuration["WorkspacePath"] ?? @"D:\Workspaces";

        // Logging
        services.AddLogging(logging =>
        {
            logging.AddConsole();
            logging.SetMinimumLevel(LogLevel.Information);
        });

        // Services
        services.AddSingleton(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<AgentHubClient>>();
            return new AgentHubClient(hubUrl, agentName, logger);
        });

        services.AddSingleton<IGitService>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<GitService>>();
            var hubClient = sp.GetRequiredService<AgentHubClient>();
            return new GitService(logger, hubClient, workspacePath);
        });

        services.AddSingleton(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<UnityBuildRunner>>();
            var hubClient = sp.GetRequiredService<AgentHubClient>();
            var gitService = sp.GetRequiredService<IGitService>();
            return new UnityBuildRunner(logger, hubClient, gitService, unityHubPath, buildOutputBase, workspacePath);
        });

        services.AddHostedService(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<BuildService>>();
            var hubClient = sp.GetRequiredService<AgentHubClient>();
            var buildRunner = sp.GetRequiredService<UnityBuildRunner>();
            return new BuildService(logger, hubClient, buildRunner);
        });

        Console.WriteLine("===========================================");
        Console.WriteLine("     Unity Build Agent");
        Console.WriteLine("===========================================");
        Console.WriteLine($"Agent Name: {agentName}");
        Console.WriteLine($"Hub URL: {hubUrl}");
        Console.WriteLine($"Unity Hub Path: {unityHubPath}");
        Console.WriteLine($"Build Output: {buildOutputBase}");
        Console.WriteLine($"Workspace Path: {workspacePath}");
        Console.WriteLine("===========================================");
        Console.WriteLine("Press Ctrl+C to stop");
        Console.WriteLine();
    })
    .Build();

await host.RunAsync();
