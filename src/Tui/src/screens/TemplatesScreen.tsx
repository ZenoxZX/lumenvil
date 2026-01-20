import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { BuildTemplate, Project, ScriptingBackend } from '../types.js';
import { InputRow } from '../components/InputRow.js';
import { ToggleRow } from '../components/ToggleRow.js';

const scriptingOptions: ScriptingBackend[] = ['IL2CPP', 'Mono'];

const defaultForm = {
  name: '',
  description: '',
  projectId: '',
  branch: '',
  scriptingBackend: 'IL2CPP' as ScriptingBackend,
  uploadToSteam: false,
  steamBranch: '',
  isDefault: false,
};

type Mode = 'list' | 'form' | 'delete';

type FieldId = keyof typeof defaultForm;

const fields: FieldId[] = [
  'name',
  'description',
  'projectId',
  'branch',
  'scriptingBackend',
  'uploadToSteam',
  'steamBranch',
  'isDefault',
];

const toggleFields = new Set<FieldId>(['uploadToSteam', 'isDefault']);

const labelMap: Record<FieldId, string> = {
  name: 'Name',
  description: 'Description',
  projectId: 'Project',
  branch: 'Branch',
  scriptingBackend: 'Scripting',
  uploadToSteam: 'Upload to Steam',
  steamBranch: 'Steam Branch',
  isDefault: 'Default',
};

type TemplatesScreenProps = {
  api: ApiClient;
  isActive: boolean;
};

export function TemplatesScreen({ api, isActive }: TemplatesScreenProps) {
  const [templates, setTemplates] = useState<BuildTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [formFieldIndex, setFormFieldIndex] = useState(0);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<BuildTemplate | null>(null);

  const projectOptions = useMemo(() => {
    return [{ id: '', name: 'Global' }, ...projects.map((p) => ({ id: p.id, name: p.name }))];
  }, [projects]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesData, projectsData] = await Promise.all([
        api.getBuildTemplates(),
        api.getProjects(),
      ]);
      setTemplates(templatesData);
      setProjects(projectsData);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) return;
    void fetchData();
  }, [fetchData, isActive]);

  const activeField = fields[formFieldIndex];

  const startCreate = () => {
    setMode('form');
    setEditingId(null);
    setFormData({ ...defaultForm });
    setFormFieldIndex(0);
    setStatus(null);
  };

  const startEdit = () => {
    const template = templates[selectedIndex];
    if (!template) return;
    setMode('form');
    setEditingId(template.id);
    setFormData({
      name: template.name,
      description: template.description || '',
      projectId: template.projectId || '',
      branch: template.branch || '',
      scriptingBackend: template.scriptingBackend,
      uploadToSteam: template.uploadToSteam,
      steamBranch: template.steamBranch || '',
      isDefault: template.isDefault,
    });
    setFormFieldIndex(0);
    setStatus(null);
  };

  const startDelete = () => {
    const template = templates[selectedIndex];
    if (!template) return;
    setMode('delete');
    setDeletingTemplate(template);
  };

  const cancelDelete = () => {
    setMode('list');
    setDeletingTemplate(null);
  };

  const confirmDelete = async () => {
    if (!deletingTemplate) return;
    setStatus('Deleting template...');
    try {
      await api.deleteBuildTemplate(deletingTemplate.id);
      setStatus('Template deleted.');
      setMode('list');
      setDeletingTemplate(null);
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to delete template.');
      setMode('list');
      setDeletingTemplate(null);
    }
  };

  const handleSubmit = async () => {
    setStatus(null);
    if (!formData.name.trim()) {
      setStatus('Template name is required.');
      return;
    }

    try {
      if (editingId) {
        await api.updateBuildTemplate(editingId, {
          name: formData.name,
          description: formData.description || undefined,
          branch: formData.branch || undefined,
          scriptingBackend: formData.scriptingBackend,
          uploadToSteam: formData.uploadToSteam,
          steamBranch: formData.steamBranch || undefined,
          isDefault: formData.isDefault,
        });
        setStatus('Template updated.');
      } else {
        await api.createBuildTemplate({
          name: formData.name,
          description: formData.description || undefined,
          projectId: formData.projectId || undefined,
          branch: formData.branch || undefined,
          scriptingBackend: formData.scriptingBackend,
          uploadToSteam: formData.uploadToSteam,
          steamBranch: formData.steamBranch || undefined,
          isDefault: formData.isDefault,
        });
        setStatus('Template created.');
      }

      setMode('list');
      setEditingId(null);
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save template.');
    }
  };

  const updateFieldValue = (field: FieldId, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const cycleProject = (direction: 1 | -1) => {
    const index = projectOptions.findIndex((p) => p.id === formData.projectId);
    const nextIndex = (index + direction + projectOptions.length) % projectOptions.length;
    updateFieldValue('projectId', projectOptions[nextIndex].id);
  };

  const cycleScripting = (direction: 1 | -1) => {
    const index = scriptingOptions.indexOf(formData.scriptingBackend);
    const nextIndex = (index + direction + scriptingOptions.length) % scriptingOptions.length;
    updateFieldValue('scriptingBackend', scriptingOptions[nextIndex]);
  };

  useInput((input, key) => {
    if (!isActive) return;

    if (mode === 'list') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(templates.length - 1, prev + 1));
      }
      if (input === 'r') {
        void fetchData();
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
        setEditingId(null);
        return;
      }

      if (key.ctrl && input === 's') {
        void handleSubmit();
        return;
      }

      if (key.ctrl && (input === 'j' || input === 'k')) {
        setFormFieldIndex((prev) => {
          if (input === 'j') return (prev + 1) % fields.length;
          return (prev - 1 + fields.length) % fields.length;
        });
        return;
      }

      if (activeField === 'projectId' && (key.leftArrow || key.rightArrow)) {
        cycleProject(key.rightArrow ? 1 : -1);
        return;
      }

      if (activeField === 'scriptingBackend' && (key.leftArrow || key.rightArrow)) {
        cycleScripting(key.rightArrow ? 1 : -1);
        return;
      }

      if (toggleFields.has(activeField) && (input === ' ' || key.leftArrow || key.rightArrow)) {
        updateFieldValue(activeField, !formData[activeField]);
        return;
      }

      if (key.backspace || key.delete) {
        if (!toggleFields.has(activeField) && activeField !== 'projectId' && activeField !== 'scriptingBackend') {
          updateFieldValue(activeField, String(formData[activeField]).slice(0, -1));
        }
        return;
      }

      if (!input) return;

      if (!toggleFields.has(activeField) && activeField !== 'projectId' && activeField !== 'scriptingBackend') {
        updateFieldValue(activeField, `${formData[activeField]}${input}`);
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Templates</Text>
        <Text color="yellow">Loading templates...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Templates</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (mode === 'delete' && deletingTemplate) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Delete Template</Text>
        <Text>Delete "{deletingTemplate.name}"? (y/n)</Text>
        {status && <Text color="yellow">{status}</Text>}
      </Box>
    );
  }

  if (mode === 'form') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{editingId ? 'Edit Template' : 'New Template'}</Text>
        <Text dimColor>Ctrl+J/K move · Ctrl+S save · Esc cancel · left/right to change</Text>
        {fields.map((fieldId, index) => {
          const focused = activeField === fieldId && formFieldIndex === index;
          const value = formData[fieldId];

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

          if (fieldId === 'projectId') {
            const selectedProject = projectOptions.find((p) => p.id === formData.projectId);
            return (
              <InputRow
                key={fieldId}
                label={labelMap[fieldId]}
                value={selectedProject?.name || 'Global'}
                focused={focused}
              />
            );
          }

          if (fieldId === 'scriptingBackend') {
            return (
              <InputRow
                key={fieldId}
                label={labelMap[fieldId]}
                value={formData.scriptingBackend}
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
        {status && <Text color={status.includes('Failed') ? 'red' : 'yellow'}>{status}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Templates</Text>
      {templates.length === 0 && <Text dimColor>No templates found.</Text>}
      {templates.map((template, index) => {
        const selected = index === selectedIndex;
        const scope = template.projectName ? template.projectName : 'Global';
        return (
          <Text key={template.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
            {selected ? '>' : ' '} {template.name} · {scope} · {template.scriptingBackend}
          </Text>
        );
      })}
      <Text dimColor>Enter to edit · c create · d delete · r refresh</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
