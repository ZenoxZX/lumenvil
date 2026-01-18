namespace BuildAgent.Models;

public class BuildJob
{
    public Guid BuildId { get; set; }
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public int BuildNumber { get; set; }
    public string Branch { get; set; } = "main";
    public string ScriptingBackend { get; set; } = "IL2CPP";
    public string UnityVersion { get; set; } = string.Empty;
    public string BuildPath { get; set; } = string.Empty;
    public string? GitUrl { get; set; }
    public Guid? PipelineId { get; set; }
}

public class PipelineScripts
{
    public Guid PipelineId { get; set; }
    public string PipelineName { get; set; } = string.Empty;
    public bool HasScripts { get; set; }
    public string? PreBuildScript { get; set; }
    public string? PostBuildScript { get; set; }
}
