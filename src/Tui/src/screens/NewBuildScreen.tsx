import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import {
  BuildPipeline,
  BuildTemplate,
  Project,
  ScriptingBackend,
  SteamSettings,
} from '../types.js';
import { InputRow } from '../components/InputRow.js';

const scriptingOptions: ScriptingBackend[] = ['IL2CPP', 'Mono'];

type NewBuildScreenProps = {
  api: ApiClient;
  isActive: boolean;
  onCreated?: (buildId: string) => void;
  onBack: () => void;
};

type FieldId =
  | 'project'
  | 'template'
  | 'pipeline'
  | 'branch'
  | 'scripting'
  | 'upload'
  | 'steamBranch'
  | 'submit';

export function NewBuildScreen({ api, isActive, onCreated, onBack }: NewBuildScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<BuildTemplate[]>([]);
  const [pipelines, setPipelines] = useState<BuildPipeline[]>([]);
  const [steamSettings, setSteamSettings] = useState<SteamSettings | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [branch, setBranch] = useState('');
  const [scriptingBackend, setScriptingBackend] = useState<ScriptingBackend>('IL2CPP');
  const [uploadToSteam, setUploadToSteam] = useState(false);
  const [steamBranch, setSteamBranch] = useState('default');
  const [activeField, setActiveField] = useState<FieldId>('project');
  const [submitting, setSubmitting] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const canUploadToSteam =
    !!steamSettings?.isConfigured &&
    !!selectedProject?.steamAppId &&
    !!selectedProject?.steamDepotId;

  const loadProjectData = useCallback(
    async (projectId: string) => {
      try {
        const [templatesData, pipelinesData] = await Promise.all([
          api.getBuildTemplates(projectId),
          api.getPipelines(projectId),
        ]);
        setTemplates(templatesData);
        setPipelines(pipelinesData);

        const defaultTemplate = templatesData.find((t) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
          if (defaultTemplate.branch) setBranch(defaultTemplate.branch);
          setScriptingBackend(defaultTemplate.scriptingBackend);
          setUploadToSteam(defaultTemplate.uploadToSteam);
          if (defaultTemplate.steamBranch) setSteamBranch(defaultTemplate.steamBranch);
        } else {
          setSelectedTemplateId('');
        }

        const defaultPipeline = pipelinesData.find((p) => p.isDefault && p.isActive);
        if (defaultPipeline) {
          setSelectedPipelineId(defaultPipeline.id);
        } else {
          setSelectedPipelineId('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates or pipelines.');
      }
    },
    [api]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const [projectsData, steamData] = await Promise.all([
        api.getProjects(),
        api.getSteamSettings().catch(() => null),
      ]);
      const activeProjects = projectsData.filter((p) => p.isActive);
      setProjects(activeProjects);
      setSteamSettings(steamData);

      if (steamData?.defaultBranch) {
        setSteamBranch(steamData.defaultBranch);
      }

      if (activeProjects.length > 0) {
        const project = activeProjects[0];
        setSelectedProjectId(project.id);
        setBranch(project.defaultBranch);
        await loadProjectData(project.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [api, loadProjectData]);

  useEffect(() => {
    if (!isActive) return;
    void loadData();
  }, [isActive, loadData]);

  const cycleField = () => {
    const fields: FieldId[] = ['project', 'template', 'pipeline', 'branch', 'scripting', 'upload', 'steamBranch', 'submit'];
    const currentIndex = fields.indexOf(activeField);
    const nextIndex = (currentIndex + 1) % fields.length;
    setActiveField(fields[nextIndex]);
  };

  const selectProject = async (direction: 1 | -1) => {
    if (projects.length === 0) return;
    const currentIndex = projects.findIndex((p) => p.id === selectedProjectId);
    const nextIndex = (currentIndex + direction + projects.length) % projects.length;
    const nextProject = projects[nextIndex];
    setSelectedProjectId(nextProject.id);
    setBranch(nextProject.defaultBranch);
    setUploadToSteam(false);
    await loadProjectData(nextProject.id);
  };

  const selectTemplate = (direction: 1 | -1) => {
    if (templates.length === 0) return;
    const list = [''] as string[];
    list.push(...templates.map((t) => t.id));
    const currentIndex = list.indexOf(selectedTemplateId);
    const nextIndex = (currentIndex + direction + list.length) % list.length;
    const nextId = list[nextIndex];
    setSelectedTemplateId(nextId);
    const template = templates.find((t) => t.id === nextId);
    if (template) {
      if (template.branch) setBranch(template.branch);
      setScriptingBackend(template.scriptingBackend);
      setUploadToSteam(template.uploadToSteam);
      if (template.steamBranch) setSteamBranch(template.steamBranch);
    }
  };

  const selectPipeline = (direction: 1 | -1) => {
    if (pipelines.length === 0) return;
    const list = [''] as string[];
    list.push(...pipelines.filter((p) => p.isActive).map((p) => p.id));
    const currentIndex = list.indexOf(selectedPipelineId);
    const nextIndex = (currentIndex + direction + list.length) % list.length;
    setSelectedPipelineId(list[nextIndex]);
  };

  const selectScripting = (direction: 1 | -1) => {
    const currentIndex = scriptingOptions.indexOf(scriptingBackend);
    const nextIndex = (currentIndex + direction + scriptingOptions.length) % scriptingOptions.length;
    setScriptingBackend(scriptingOptions[nextIndex]);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!selectedProjectId) {
      setStatus('Select a project.');
      return;
    }

    if (!branch.trim()) {
      setStatus('Branch is required.');
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const build = await api.createBuild({
        projectId: selectedProjectId,
        branch: branch || undefined,
        scriptingBackend,
        uploadToSteam: uploadToSteam && canUploadToSteam,
        steamBranch: uploadToSteam && canUploadToSteam ? steamBranch : undefined,
        templateId: selectedTemplateId || undefined,
        pipelineId: selectedPipelineId || undefined,
      });
      setStatus(`Build #${build.buildNumber} queued.`);
      onCreated?.(build.id);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to start build.');
    } finally {
      setSubmitting(false);
    }
  };

  useInput((input, key) => {
    if (!isActive || submitting) return;

    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow || key.downArrow) {
      if (key.downArrow) {
        cycleField();
      } else {
        const fields: FieldId[] = ['project', 'template', 'pipeline', 'branch', 'scripting', 'upload', 'steamBranch', 'submit'];
        const currentIndex = fields.indexOf(activeField);
        const nextIndex = (currentIndex - 1 + fields.length) % fields.length;
        setActiveField(fields[nextIndex]);
      }
      return;
    }

    if (key.return) {
      if (activeField === 'submit') {
        void handleSubmit();
      } else {
        cycleField();
      }
      return;
    }

    if (key.leftArrow) {
      if (activeField === 'project') void selectProject(-1);
      if (activeField === 'template') selectTemplate(-1);
      if (activeField === 'pipeline') selectPipeline(-1);
      if (activeField === 'scripting') selectScripting(-1);
      return;
    }

    if (key.rightArrow) {
      if (activeField === 'project') void selectProject(1);
      if (activeField === 'template') selectTemplate(1);
      if (activeField === 'pipeline') selectPipeline(1);
      if (activeField === 'scripting') selectScripting(1);
      return;
    }

    if (input === ' ') {
      if (activeField === 'upload') {
        if (!canUploadToSteam) {
          setStatus('Steam upload unavailable: configure Steam + project App/Depot IDs.');
        } else {
          setUploadToSteam((prev) => !prev);
        }
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (activeField === 'branch') {
        setBranch((prev) => prev.slice(0, -1));
      } else if (activeField === 'steamBranch') {
        setSteamBranch((prev) => prev.slice(0, -1));
      }
      return;
    }

    if (!input) return;

    if (activeField === 'branch') {
      setBranch((prev) => prev + input);
    } else if (activeField === 'steamBranch') {
      setSteamBranch((prev) => prev + input);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>New Build</Text>
        <Text color="yellow">Loading form data...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>New Build</Text>
        <Text color="red">{error}</Text>
        <Text dimColor>Press Esc to go back.</Text>
      </Box>
    );
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>New Build</Text>

      <Text dimColor>Use left/right to change selections, ↑/↓ to move, Enter to submit.</Text>

      <InputRow
        label="Project"
        value={selectedProject?.name || ''}
        placeholder="No projects"
        focused={activeField === 'project'}
      />

      <InputRow
        label="Template"
        value={selectedTemplate ? selectedTemplate.name : 'None'}
        focused={activeField === 'template'}
      />

      <InputRow
        label="Pipeline"
        value={selectedPipeline ? selectedPipeline.name : 'None'}
        focused={activeField === 'pipeline'}
      />

      <InputRow
        label="Branch"
        value={branch}
        placeholder="main"
        focused={activeField === 'branch'}
      />

      <InputRow
        label="Scripting"
        value={scriptingBackend}
        focused={activeField === 'scripting'}
      />

      <Box>
        <Text color={activeField === 'upload' ? 'cyan' : undefined}>
          {activeField === 'upload' ? '>' : ' '} Upload to Steam: {uploadToSteam ? 'Yes' : 'No'}
        </Text>
      </Box>

      {uploadToSteam && (
        <InputRow
          label="Steam Branch"
          value={steamBranch}
          placeholder="default"
          focused={activeField === 'steamBranch'}
        />
      )}

      <Box>
        <Text color={activeField === 'submit' ? 'cyan' : undefined}>
          {activeField === 'submit' ? '>' : ' '} [ Start Build ]
        </Text>
      </Box>

      {status && <Text color={status.startsWith('Build #') ? 'green' : 'yellow'}>{status}</Text>}
      <Text dimColor>Press Esc to go back.</Text>
    </Box>
  );
}
