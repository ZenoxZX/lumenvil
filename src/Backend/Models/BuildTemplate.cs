namespace Backend.Models;

public class BuildTemplate
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Optional: If null, template is global; if set, template is project-specific
    public Guid? ProjectId { get; set; }

    // Build configuration
    public string? Branch { get; set; } // null = use project's default branch
    public ScriptingBackend ScriptingBackend { get; set; } = ScriptingBackend.IL2CPP;

    // Steam settings
    public bool UploadToSteam { get; set; }
    public string? SteamBranch { get; set; }

    // Flags
    public bool IsDefault { get; set; } // Default template for quick builds

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedById { get; set; }

    // Navigation
    public Project? Project { get; set; }
    public User? CreatedBy { get; set; }
}
