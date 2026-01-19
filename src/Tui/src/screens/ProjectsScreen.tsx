import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import {
  NotificationEvent,
  Project,
  ProjectNotificationSettings,
} from '../types.js';
import { InputRow } from '../components/InputRow.js';
import { ToggleRow } from '../components/ToggleRow.js';

const defaultProjectForm = {
  name: '',
  description: '',
  gitUrl: '',
  defaultBranch: 'main',
  unityVersion: '2022.3.0f1',
  buildPath: '',
  steamAppId: '',
  steamDepotId: '',
  isActive: true,
};

const defaultNotificationForm = {
  useGlobalSettings: true,
  discordEnabled: false,
  discordWebhookUrl: '',
  discordEvents: '',
  slackEnabled: false,
  slackWebhookUrl: '',
  slackEvents: '',
  webhookEnabled: false,
  webhookUrl: '',
  webhookSecret: '',
  webhookEvents: '',
};

const allEvents: NotificationEvent[] = [
  'BuildStarted',
  'BuildCompleted',
  'BuildFailed',
  'BuildCancelled',
  'UploadCompleted',
  'UploadFailed',
];

type ProjectsScreenProps = {
  api: ApiClient;
  isActive: boolean;
};

type Mode = 'list' | 'form' | 'delete';

type Section = 'project' | 'notifications';

type ProjectFieldId = keyof typeof defaultProjectForm;

type NotificationFieldId = keyof typeof defaultNotificationForm;

type FieldId = ProjectFieldId | NotificationFieldId;

const projectFields: ProjectFieldId[] = [
  'name',
  'description',
  'gitUrl',
  'defaultBranch',
  'unityVersion',
  'buildPath',
  'steamAppId',
  'steamDepotId',
  'isActive',
];

const notificationFields: NotificationFieldId[] = [
  'useGlobalSettings',
  'discordEnabled',
  'discordWebhookUrl',
  'discordEvents',
  'slackEnabled',
  'slackWebhookUrl',
  'slackEvents',
  'webhookEnabled',
  'webhookUrl',
  'webhookSecret',
  'webhookEvents',
];

const toggleFields = new Set<FieldId>([
  'isActive',
  'useGlobalSettings',
  'discordEnabled',
  'slackEnabled',
  'webhookEnabled',
]);

const labelMap: Record<FieldId, string> = {
  name: 'Name',
  description: 'Description',
  gitUrl: 'Git URL',
  defaultBranch: 'Default Branch',
  unityVersion: 'Unity Version',
  buildPath: 'Build Path',
  steamAppId: 'Steam App ID',
  steamDepotId: 'Steam Depot ID',
  isActive: 'Active',
  useGlobalSettings: 'Use Global Settings',
  discordEnabled: 'Discord Enabled',
  discordWebhookUrl: 'Discord Webhook',
  discordEvents: 'Discord Events',
  slackEnabled: 'Slack Enabled',
  slackWebhookUrl: 'Slack Webhook',
  slackEvents: 'Slack Events',
  webhookEnabled: 'Webhook Enabled',
  webhookUrl: 'Webhook URL',
  webhookSecret: 'Webhook Secret',
  webhookEvents: 'Webhook Events',
};

const eventListToText = (events?: NotificationEvent[]) => (events || []).join(', ');

const parseEvents = (value: string): NotificationEvent[] => {
  const list = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.filter((entry): entry is NotificationEvent =>
    allEvents.includes(entry as NotificationEvent)
  );
};

const buildNotificationSettings = (
  form: typeof defaultNotificationForm
): ProjectNotificationSettings => {
  if (form.useGlobalSettings) {
    return { useGlobalSettings: true };
  }

  return {
    useGlobalSettings: false,
    discord: {
      enabled: form.discordEnabled,
      webhookUrl: form.discordWebhookUrl || undefined,
      events: parseEvents(form.discordEvents),
    },
    slack: {
      enabled: form.slackEnabled,
      webhookUrl: form.slackWebhookUrl || undefined,
      events: parseEvents(form.slackEvents),
    },
    webhook: {
      enabled: form.webhookEnabled,
      url: form.webhookUrl || undefined,
      events: parseEvents(form.webhookEvents),
    },
  };
};

export function ProjectsScreen({ api, isActive }: ProjectsScreenProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [formSection, setFormSection] = useState<Section>('project');
  const [formFieldIndex, setFormFieldIndex] = useState(0);
  const [projectForm, setProjectForm] = useState({ ...defaultProjectForm });
  const [notificationForm, setNotificationForm] = useState({ ...defaultNotificationForm });
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProjects();
      setProjects(data);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) return;
    void fetchProjects();
  }, [fetchProjects, isActive]);

  const activeFields = formSection === 'project' ? projectFields : notificationFields;
  const activeField = activeFields[formFieldIndex];

  const selectedProject = projects[selectedIndex];

  const loadProjectIntoForm = (project: Project) => {
    setProjectForm({
      name: project.name,
      description: project.description || '',
      gitUrl: project.gitUrl || '',
      defaultBranch: project.defaultBranch,
      unityVersion: project.unityVersion,
      buildPath: project.buildPath,
      steamAppId: project.steamAppId || '',
      steamDepotId: project.steamDepotId || '',
      isActive: project.isActive,
    });

    const settings = project.notificationSettings;
    if (settings) {
      setNotificationForm({
        useGlobalSettings: settings.useGlobalSettings,
        discordEnabled: settings.discord?.enabled ?? false,
        discordWebhookUrl: settings.discord?.webhookUrl || '',
        discordEvents: eventListToText(settings.discord?.events),
        slackEnabled: settings.slack?.enabled ?? false,
        slackWebhookUrl: settings.slack?.webhookUrl || '',
        slackEvents: eventListToText(settings.slack?.events),
        webhookEnabled: settings.webhook?.enabled ?? false,
        webhookUrl: settings.webhook?.url || '',
        webhookSecret: '',
        webhookEvents: eventListToText(settings.webhook?.events),
      });
    } else {
      setNotificationForm({ ...defaultNotificationForm });
    }
  };

  const startCreate = () => {
    setMode('form');
    setEditingProjectId(null);
    setProjectForm({ ...defaultProjectForm });
    setNotificationForm({ ...defaultNotificationForm });
    setFormSection('project');
    setFormFieldIndex(0);
    setStatus(null);
  };

  const startEdit = () => {
    if (!selectedProject) return;
    setMode('form');
    setEditingProjectId(selectedProject.id);
    loadProjectIntoForm(selectedProject);
    setFormSection('project');
    setFormFieldIndex(0);
    setStatus(null);
  };

  const startDelete = () => {
    if (!selectedProject) return;
    setMode('delete');
    setDeletingProject(selectedProject);
  };

  const cancelDelete = () => {
    setMode('list');
    setDeletingProject(null);
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    setStatus('Deleting project...');
    try {
      await api.deleteProject(deletingProject.id);
      setStatus(`Deleted ${deletingProject.name}.`);
      setMode('list');
      setDeletingProject(null);
      await fetchProjects();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to delete project.');
      setMode('list');
      setDeletingProject(null);
    }
  };

  const updateFieldValue = (field: FieldId, value: string | boolean) => {
    if (projectFields.includes(field as ProjectFieldId)) {
      setProjectForm((prev) => ({ ...prev, [field]: value }));
    } else {
      setNotificationForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async () => {
    setStatus(null);
    try {
      if (!projectForm.name.trim()) {
        setStatus('Project name is required.');
        return;
      }

      const notificationSettings = buildNotificationSettings(notificationForm);

      if (editingProjectId) {
        await api.updateProject(editingProjectId, {
          name: projectForm.name,
          description: projectForm.description || undefined,
          gitUrl: projectForm.gitUrl || undefined,
          defaultBranch: projectForm.defaultBranch,
          unityVersion: projectForm.unityVersion,
          buildPath: projectForm.buildPath,
          steamAppId: projectForm.steamAppId || undefined,
          steamDepotId: projectForm.steamDepotId || undefined,
          isActive: projectForm.isActive,
          notificationSettings,
        });
        setStatus('Project updated.');
      } else {
        await api.createProject({
          name: projectForm.name,
          description: projectForm.description || undefined,
          gitUrl: projectForm.gitUrl || undefined,
          defaultBranch: projectForm.defaultBranch,
          unityVersion: projectForm.unityVersion,
          buildPath: projectForm.buildPath,
          steamAppId: projectForm.steamAppId || undefined,
          steamDepotId: projectForm.steamDepotId || undefined,
          notificationSettings,
        });
        setStatus('Project created.');
      }

      setMode('list');
      setEditingProjectId(null);
      await fetchProjects();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save project.');
    }
  };

  useInput((input, key) => {
    if (!isActive) return;

    if (mode === 'list') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(projects.length - 1, prev + 1));
      }
      if (input === 'r') {
        void fetchProjects();
      }
      if (input === 'c') {
        startCreate();
      }
      if (key.return) {
        startEdit();
      }
      if (input === 'd') {
        startDelete();
      }
      return;
    }

    if (mode === 'delete') {
      if (input === 'y') {
        void confirmDelete();
      }
      if (input === 'n' || key.escape) {
        cancelDelete();
      }
      return;
    }

    if (mode === 'form') {
      if (key.escape) {
        setMode('list');
        setEditingProjectId(null);
        return;
      }

      if (key.ctrl && input === 'n') {
        const nextSection = formSection === 'project' ? 'notifications' : 'project';
        setFormSection(nextSection);
        setFormFieldIndex(0);
        return;
      }

      if (key.ctrl && input === 's') {
        void handleSubmit();
        return;
      }

      if (key.ctrl && (input === 'j' || input === 'k')) {
        setFormFieldIndex((prev) => {
          if (input === 'j') return (prev + 1) % activeFields.length;
          return (prev - 1 + activeFields.length) % activeFields.length;
        });
        return;
      }

      if (toggleFields.has(activeField) && (input === ' ' || key.leftArrow || key.rightArrow)) {
        const currentValue = projectFields.includes(activeField as ProjectFieldId)
          ? projectForm[activeField as ProjectFieldId]
          : notificationForm[activeField as NotificationFieldId];
        updateFieldValue(activeField, !currentValue);
        return;
      }

      if (key.backspace || key.delete) {
        if (!toggleFields.has(activeField)) {
          const currentValue = projectFields.includes(activeField as ProjectFieldId)
            ? projectForm[activeField as ProjectFieldId]
            : notificationForm[activeField as NotificationFieldId];
          updateFieldValue(activeField, String(currentValue).slice(0, -1));
        }
        return;
      }

      if (!input) return;

      if (!toggleFields.has(activeField)) {
        const currentValue = projectFields.includes(activeField as ProjectFieldId)
          ? projectForm[activeField as ProjectFieldId]
          : notificationForm[activeField as NotificationFieldId];
        updateFieldValue(activeField, `${currentValue}${input}`);
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Projects</Text>
        <Text color="yellow">Loading projects...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Projects</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (mode === 'delete' && deletingProject) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Delete Project</Text>
        <Text>Delete "{deletingProject.name}"? (y/n)</Text>
        {status && <Text color="yellow">{status}</Text>}
      </Box>
    );
  }

  if (mode === 'form') {
    const showNotificationHint = formSection === 'notifications';
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{editingProjectId ? 'Edit Project' : 'New Project'}</Text>
        <Text dimColor>Ctrl+J/K move · Ctrl+N section · Ctrl+S save · Esc cancel</Text>

        {formSection === 'project' && (
          <Box flexDirection="column" gap={1}>
            {projectFields.map((fieldId, index) => {
              const focused = activeField === fieldId && formFieldIndex === index;
              const value = projectForm[fieldId];
              if (toggleFields.has(fieldId)) {
                return (
                  <ToggleRow
                    key={fieldId}
                    label={labelMap[fieldId]}
                    value={Boolean(value)}
                    focused={focused}
                  />
                );
              }
              return (
                <InputRow
                  key={fieldId}
                  label={labelMap[fieldId]}
                  value={String(value)}
                  focused={focused}
                />
              );
            })}
          </Box>
        )}

        {formSection === 'notifications' && (
          <Box flexDirection="column" gap={1}>
            {notificationFields.map((fieldId, index) => {
              const focused = activeField === fieldId && formFieldIndex === index;
              const value = notificationForm[fieldId];
              if (toggleFields.has(fieldId)) {
                return (
                  <ToggleRow
                    key={fieldId}
                    label={labelMap[fieldId]}
                    value={Boolean(value)}
                    focused={focused}
                  />
                );
              }
              return (
                <InputRow
                  key={fieldId}
                  label={labelMap[fieldId]}
                  value={String(value)}
                  focused={focused}
                  masked={fieldId === 'webhookSecret'}
                />
              );
            })}
          </Box>
        )}

        {showNotificationHint && (
          <Text dimColor>
            Events list: {allEvents.join(', ')}
          </Text>
        )}
        {status && <Text color={status.includes('Failed') ? 'red' : 'yellow'}>{status}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Projects</Text>
      {projects.length === 0 && <Text dimColor>No projects found.</Text>}
      {projects.map((project, index) => {
        const selected = index === selectedIndex;
        return (
          <Text key={project.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
            {selected ? '>' : ' '} {project.name} · {project.unityVersion} · {project.isActive ? 'Active' : 'Inactive'}
          </Text>
        );
      })}
      <Text dimColor>Enter to edit · c create · d delete · r refresh</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
