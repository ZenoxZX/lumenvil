namespace Backend.Models;

public class Project
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? GitUrl { get; set; }
    public string DefaultBranch { get; set; } = "main";
    public string UnityVersion { get; set; } = string.Empty;
    public string BuildPath { get; set; } = string.Empty;
    public string? SteamAppId { get; set; }
    public string? SteamDepotId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Build> Builds { get; set; } = new List<Build>();
}
