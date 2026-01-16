// Place this script in your Unity project's Assets/Editor folder
// Path: Assets/Editor/BuildScript.cs

using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using System;
using System.Linq;

public static class BuildScript
{
    private static string[] GetEnabledScenes()
    {
        return EditorBuildSettings.scenes
            .Where(s => s.enabled)
            .Select(s => s.path)
            .ToArray();
    }

    private static string GetArgument(string name)
    {
        var args = Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == name && i + 1 < args.Length)
            {
                return args[i + 1];
            }
        }
        return null;
    }

    [MenuItem("Build/Build Windows (IL2CPP)")]
    public static void BuildWindowsIL2CPP()
    {
        BuildWindows(ScriptingImplementation.IL2CPP);
    }

    [MenuItem("Build/Build Windows (Mono)")]
    public static void BuildWindowsMono()
    {
        BuildWindows(ScriptingImplementation.Mono2x);
    }

    public static void BuildWindows()
    {
        var outputPath = GetArgument("-outputPath");
        var scriptingBackend = GetArgument("-scriptingBackend");

        if (string.IsNullOrEmpty(outputPath))
        {
            outputPath = "Build/Game.exe";
        }

        var implementation = scriptingBackend == "IL2CPP"
            ? ScriptingImplementation.IL2CPP
            : ScriptingImplementation.Mono2x;

        BuildWindows(implementation, outputPath);
    }

    private static void BuildWindows(ScriptingImplementation scriptingBackend, string outputPath = null)
    {
        Debug.Log($"[BuildScript] Starting Windows build with {scriptingBackend}");

        if (string.IsNullOrEmpty(outputPath))
        {
            outputPath = $"Build/{PlayerSettings.productName}.exe";
        }

        // Configure scripting backend
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Standalone, scriptingBackend);

        // Configure IL2CPP specific settings
        if (scriptingBackend == ScriptingImplementation.IL2CPP)
        {
            PlayerSettings.SetIl2CppCompilerConfiguration(BuildTargetGroup.Standalone, Il2CppCompilerConfiguration.Release);
        }

        var scenes = GetEnabledScenes();
        Debug.Log($"[BuildScript] Building {scenes.Length} scenes");

        var options = new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = outputPath,
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None
        };

        Debug.Log($"[BuildScript] Output path: {outputPath}");

        var report = BuildPipeline.BuildPlayer(options);

        if (report.summary.result == BuildResult.Succeeded)
        {
            Debug.Log($"[BuildScript] Build succeeded: {report.summary.totalSize} bytes");
            Debug.Log($"[BuildScript] Build time: {report.summary.totalTime}");
        }
        else
        {
            Debug.LogError($"[BuildScript] Build failed with {report.summary.totalErrors} errors");

            foreach (var step in report.steps)
            {
                foreach (var message in step.messages)
                {
                    if (message.type == LogType.Error)
                    {
                        Debug.LogError($"[BuildScript] {message.content}");
                    }
                }
            }

            // Exit with error code for CI/CD
            EditorApplication.Exit(1);
        }
    }

    // Called by the build agent
    public static void PerformBuild()
    {
        Debug.Log("[BuildScript] PerformBuild called from command line");
        BuildWindows();
    }
}
