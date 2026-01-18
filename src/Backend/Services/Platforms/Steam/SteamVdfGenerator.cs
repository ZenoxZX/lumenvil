using System.Text;

namespace Backend.Services.Platforms.Steam;

public class SteamVdfGenerator
{
    /// <summary>
    /// Generate app_build.vdf content for SteamCMD
    /// </summary>
    public string GenerateAppBuild(
        string appId,
        string depotId,
        string description,
        string contentRoot,
        string branch = "default",
        bool preview = false)
    {
        var sb = new StringBuilder();

        sb.AppendLine("\"AppBuild\"");
        sb.AppendLine("{");
        sb.AppendLine($"\t\"AppID\" \"{appId}\"");
        sb.AppendLine($"\t\"Desc\" \"{EscapeVdfString(description)}\"");
        sb.AppendLine($"\t\"ContentRoot\" \"{EscapeVdfPath(contentRoot)}\"");
        sb.AppendLine($"\t\"BuildOutput\" \"{EscapeVdfPath(Path.Combine(contentRoot, "steam_output"))}\"");

        if (preview)
        {
            sb.AppendLine("\t\"Preview\" \"1\"");
        }

        sb.AppendLine($"\t\"SetLive\" \"{EscapeVdfString(branch)}\"");

        sb.AppendLine("\t\"Depots\"");
        sb.AppendLine("\t{");
        sb.AppendLine($"\t\t\"{depotId}\"");
        sb.AppendLine("\t\t{");
        sb.AppendLine("\t\t\t\"FileMapping\"");
        sb.AppendLine("\t\t\t{");
        sb.AppendLine("\t\t\t\t\"LocalPath\" \"*\"");
        sb.AppendLine("\t\t\t\t\"DepotPath\" \".\"");
        sb.AppendLine("\t\t\t\t\"recursive\" \"1\"");
        sb.AppendLine("\t\t\t}");

        // Exclude common unnecessary files
        sb.AppendLine("\t\t\t\"FileExclusion\" \"*.pdb\"");
        sb.AppendLine("\t\t\t\"FileExclusion\" \"*.vdf\"");
        sb.AppendLine("\t\t\t\"FileExclusion\" \"steam_output\\\\*\"");

        sb.AppendLine("\t\t}");
        sb.AppendLine("\t}");

        sb.AppendLine("}");

        return sb.ToString();
    }

    /// <summary>
    /// Generate depot_build.vdf for a specific depot
    /// </summary>
    public string GenerateDepotBuild(
        string depotId,
        string contentRoot,
        string? fileExclusion = null)
    {
        var sb = new StringBuilder();

        sb.AppendLine("\"DepotBuild\"");
        sb.AppendLine("{");
        sb.AppendLine($"\t\"DepotID\" \"{depotId}\"");
        sb.AppendLine($"\t\"ContentRoot\" \"{EscapeVdfPath(contentRoot)}\"");
        sb.AppendLine("\t\"FileMapping\"");
        sb.AppendLine("\t{");
        sb.AppendLine("\t\t\"LocalPath\" \"*\"");
        sb.AppendLine("\t\t\"DepotPath\" \".\"");
        sb.AppendLine("\t\t\"recursive\" \"1\"");
        sb.AppendLine("\t}");

        if (!string.IsNullOrEmpty(fileExclusion))
        {
            sb.AppendLine($"\t\"FileExclusion\" \"{EscapeVdfString(fileExclusion)}\"");
        }

        sb.AppendLine("}");

        return sb.ToString();
    }

    private static string EscapeVdfString(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n")
            .Replace("\r", "\\r")
            .Replace("\t", "\\t");
    }

    private static string EscapeVdfPath(string path)
    {
        // VDF uses backslashes even on Unix
        return path.Replace("/", "\\").Replace("\\", "\\\\");
    }
}
