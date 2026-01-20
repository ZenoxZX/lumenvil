import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { BuildPipeline, Project } from '../types.js';
import { InputRow } from '../components/InputRow.js';
import { ToggleRow } from '../components/ToggleRow.js';

type PipelinesScreenProps = {
  api: ApiClient;
  isActive: boolean;
  onOpenPipeline: (id: string) => void;
};

type Mode = 'list' | 'form' | 'delete';

type FieldId = 'name' | 'description' | 'projectId' | 'isDefault' | 'isActive';

const fields: FieldId[] = ['name', 'description', 'projectId', 'isDefault', 'isActive'];

const labelMap: Record<FieldId, string> = {
  name: 'Name',
  description: 'Description',
  projectId: 'Project',
  isDefault: 'Default',
  isActive: 'Active',
};

const defaultForm = {
  name: '',
  description: '',
  projectId: '',
  isDefault: false,
  isActive: true,
};

const toggleFields = new Set<FieldId>(['isDefault', 'isActive']);

export function PipelinesScreen({ api, isActive, onOpenPipeline }: PipelinesScreenProps) {
  const [pipelines, setPipelines] = useState<BuildPipeline[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [formFieldIndex, setFormFieldIndex] = useState(0);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deletingPipeline, setDeletingPipeline] = useState<BuildPipeline | null>(null);

  const projectOptions = useMemo(() => {
    return [{ id: '', name: 'Global' }, ...projects.map((p) => ({ id: p.id, name: p.name }))];
  }, [projects]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipelinesData, projectsData] = await Promise.all([
        api.getPipelines(),
        api.getProjects(),
      ]);
      setPipelines(pipelinesData);
      setProjects(projectsData);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipelines.');
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
    const pipeline = pipelines[selectedIndex];
    if (!pipeline) return;
    setMode('form');
    setEditingId(pipeline.id);
    setFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      projectId: pipeline.projectId || '',
      isDefault: pipeline.isDefault,
      isActive: pipeline.isActive,
    });
    setFormFieldIndex(0);
    setStatus(null);
  };

  const startDelete = () => {
    const pipeline = pipelines[selectedIndex];
    if (!pipeline) return;
    setMode('delete');
    setDeletingPipeline(pipeline);
  };

  const cancelDelete = () => {
    setMode('list');
    setDeletingPipeline(null);
  };

  const confirmDelete = async () => {
    if (!deletingPipeline) return;
    setStatus('Deleting pipeline...');
    try {
      await api.deletePipeline(deletingPipeline.id);
      setStatus('Pipeline deleted.');
      setMode('list');
      setDeletingPipeline(null);
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to delete pipeline.');
      setMode('list');
      setDeletingPipeline(null);
    }
  };

  const handleSubmit = async () => {
    setStatus(null);
    if (!formData.name.trim()) {
      setStatus('Pipeline name is required.');
      return;
    }

    try {
      if (editingId) {
        await api.updatePipeline(editingId, {
          name: formData.name,
          description: formData.description || undefined,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
        });
        setStatus('Pipeline updated.');
      } else {
        await api.createPipeline({
          name: formData.name,
          description: formData.description || undefined,
          projectId: formData.projectId || undefined,
          isDefault: formData.isDefault,
        });
        setStatus('Pipeline created.');
      }

      setMode('list');
      setEditingId(null);
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save pipeline.');
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

  useInput((input, key) => {
    if (!isActive) return;

    if (mode === 'list') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(pipelines.length - 1, prev + 1));
      }
      if (input === 'r') {
        void fetchData();
      }
      if (input === 'c') {
        startCreate();
      }
      if (input === 'e') {
        startEdit();
      }
      if (key.return) {
        const pipeline = pipelines[selectedIndex];
        if (pipeline) onOpenPipeline(pipeline.id);
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

      if (key.upArrow || key.downArrow) {
        setFormFieldIndex((prev) => {
          if (key.downArrow) return (prev + 1) % fields.length;
          return (prev - 1 + fields.length) % fields.length;
        });
        return;
      }

      if (activeField === 'projectId' && (key.leftArrow || key.rightArrow)) {
        cycleProject(key.rightArrow ? 1 : -1);
        return;
      }

      if (toggleFields.has(activeField) && (input === ' ' || key.leftArrow || key.rightArrow)) {
        updateFieldValue(activeField, !formData[activeField]);
        return;
      }

      if (key.backspace || key.delete) {
        if (!toggleFields.has(activeField) && activeField !== 'projectId') {
          updateFieldValue(activeField, String(formData[activeField]).slice(0, -1));
        }
        return;
      }

      if (!input) return;

      if (!toggleFields.has(activeField) && activeField !== 'projectId') {
        updateFieldValue(activeField, `${formData[activeField]}${input}`);
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Pipelines</Text>
        <Text color="yellow">Loading pipelines...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Pipelines</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (mode === 'delete' && deletingPipeline) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Delete Pipeline</Text>
        <Text>Delete "{deletingPipeline.name}"? (y/n)</Text>
        {status && <Text color="yellow">{status}</Text>}
      </Box>
    );
  }

  if (mode === 'form') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{editingId ? 'Edit Pipeline' : 'New Pipeline'}</Text>
        <Text dimColor>↑/↓ move · Ctrl+S save · Esc cancel · left/right to change</Text>
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
      <Text bold>Pipelines</Text>
      {pipelines.length === 0 && <Text dimColor>No pipelines found.</Text>}
      {pipelines.map((pipeline, index) => {
        const selected = index === selectedIndex;
        const scope = pipeline.projectName ? pipeline.projectName : 'Global';
        return (
          <Text key={pipeline.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
            {selected ? '>' : ' '} {pipeline.name} · {scope} · {pipeline.processCount} steps
          </Text>
        );
      })}
      <Text dimColor>Enter to open · e edit · c create · d delete · r refresh</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
