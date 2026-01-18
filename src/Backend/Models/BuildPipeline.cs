namespace Backend.Models;

/// <summary>
/// A build pipeline containing a chain of processes to execute during build
/// </summary>
public class BuildPipeline
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Optional: Link to specific project, null = global/reusable
    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    public bool IsDefault { get; set; } = false;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Guid? CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    // Navigation
    public ICollection<BuildProcess> Processes { get; set; } = new List<BuildProcess>();
}

/// <summary>
/// A single process in the build pipeline chain
/// </summary>
public class BuildProcess
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PipelineId { get; set; }
    public BuildPipeline Pipeline { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public ProcessType Type { get; set; }
    public BuildPhase Phase { get; set; } = BuildPhase.PreBuild;

    /// <summary>
    /// Order in the pipeline chain (lower = runs first)
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// JSON configuration specific to the process type
    /// </summary>
    public string ConfigurationJson { get; set; } = "{}";

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// When the process runs in the build lifecycle
/// </summary>
public enum BuildPhase
{
    PreBuild = 0,   // Before Unity build starts
    PostBuild = 1   // After Unity build completes
}

/// <summary>
/// Type of build process
/// </summary>
public enum ProcessType
{
    /// <summary>
    /// Add or remove scripting define symbols
    /// Config: { "add": ["SYMBOL1", "SYMBOL2"], "remove": ["DEBUG"] }
    /// </summary>
    DefineSymbols = 0,

    /// <summary>
    /// Modify PlayerSettings before build
    /// Config: { "companyName": "...", "productName": "...", "version": "1.0.0" }
    /// </summary>
    PlayerSettings = 1,

    /// <summary>
    /// Configure which scenes to include in build
    /// Config: { "scenes": ["Assets/Scenes/Main.unity"], "mode": "include|exclude" }
    /// </summary>
    SceneList = 2,

    /// <summary>
    /// Custom C# code to execute
    /// Config: { "code": "Debug.Log(\"Hello\");", "usings": ["UnityEngine"] }
    /// </summary>
    CustomCode = 3,

    /// <summary>
    /// Execute shell/batch command
    /// Config: { "command": "echo hello", "workingDirectory": "" }
    /// </summary>
    ShellCommand = 4,

    /// <summary>
    /// Copy/move files
    /// Config: { "source": "...", "destination": "...", "pattern": "*.*" }
    /// </summary>
    FileCopy = 5,

    /// <summary>
    /// Modify specific asset settings
    /// Config: { "assetPath": "...", "settings": { ... } }
    /// </summary>
    AssetSettings = 6
}

#region Process Configurations

/// <summary>
/// Configuration for DefineSymbols process
/// </summary>
public class DefineSymbolsConfig
{
    public List<string> Add { get; set; } = new();
    public List<string> Remove { get; set; } = new();
}

/// <summary>
/// Configuration for PlayerSettings process
/// </summary>
public class PlayerSettingsConfig
{
    public string? CompanyName { get; set; }
    public string? ProductName { get; set; }
    public string? Version { get; set; }
    public string? BundleIdentifier { get; set; }
    public int? DefaultScreenWidth { get; set; }
    public int? DefaultScreenHeight { get; set; }
    public bool? FullscreenByDefault { get; set; }
    public bool? RunInBackground { get; set; }
}

/// <summary>
/// Configuration for SceneList process
/// </summary>
public class SceneListConfig
{
    public List<string> Scenes { get; set; } = new();
    public string Mode { get; set; } = "include"; // "include" or "exclude"
}

/// <summary>
/// Configuration for CustomCode process
/// </summary>
public class CustomCodeConfig
{
    public string Code { get; set; } = string.Empty;
    public List<string> Usings { get; set; } = new() { "UnityEngine", "UnityEditor" };
}

/// <summary>
/// Configuration for ShellCommand process
/// </summary>
public class ShellCommandConfig
{
    public string Command { get; set; } = string.Empty;
    public string? WorkingDirectory { get; set; }
    public int TimeoutSeconds { get; set; } = 300;
}

/// <summary>
/// Configuration for FileCopy process
/// </summary>
public class FileCopyConfig
{
    public string Source { get; set; } = string.Empty;
    public string Destination { get; set; } = string.Empty;
    public string Pattern { get; set; } = "*.*";
    public bool Recursive { get; set; } = true;
    public bool Overwrite { get; set; } = true;
}

#endregion
