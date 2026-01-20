import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import {
  BuildPhase,
  BuildPipelineDetail,
  BuildProcess,
  ProcessType,
  ProcessTypeInfo,
} from '../types.js';
import { InputRow } from '../components/InputRow.js';
import { ToggleRow } from '../components/ToggleRow.js';

const phaseOptions: BuildPhase[] = ['PreBuild', 'PostBuild'];

const defaultProcessForm = {
  name: '',
  type: 'DefineSymbols' as ProcessType,
  phase: 'PreBuild' as BuildPhase,
  isEnabled: true,
};

const defaultConfigForm = {
  defineAdd: '',
  defineRemove: '',
  companyName: '',
  productName: '',
  version: '',
  bundleIdentifier: '',
  defaultScreenWidth: '',
  defaultScreenHeight: '',
  fullscreenByDefault: false,
  runInBackground: false,
  scenes: '',
  sceneMode: 'include',
  customUsings: 'UnityEngine, UnityEditor',
  customCode: '',
  shellCommand: '',
  shellWorkingDirectory: '',
  shellTimeoutSeconds: '300',
  fileSource: '',
  fileDestination: '',
  filePattern: '*.*',
  fileRecursive: true,
  fileOverwrite: true,
  assetPath: '',
  assetSettingsJson: '{}',
};

type Mode = 'list' | 'form' | 'scripts';

type BaseFieldId = keyof typeof defaultProcessForm;

type ConfigFieldId = keyof typeof defaultConfigForm;

type FieldId = BaseFieldId | ConfigFieldId;

const baseFields: BaseFieldId[] = ['name', 'type', 'phase', 'isEnabled'];

const configFieldsByType: Record<ProcessType, ConfigFieldId[]> = {
  DefineSymbols: ['defineAdd', 'defineRemove'],
  PlayerSettings: [
    'companyName',
    'productName',
    'version',
    'bundleIdentifier',
    'defaultScreenWidth',
    'defaultScreenHeight',
    'fullscreenByDefault',
    'runInBackground',
  ],
  SceneList: ['scenes', 'sceneMode'],
  CustomCode: ['customUsings', 'customCode'],
  ShellCommand: ['shellCommand', 'shellWorkingDirectory', 'shellTimeoutSeconds'],
  FileCopy: ['fileSource', 'fileDestination', 'filePattern', 'fileRecursive', 'fileOverwrite'],
  AssetSettings: ['assetPath', 'assetSettingsJson'],
};

const toggleFields = new Set<FieldId>([
  'isEnabled',
  'fullscreenByDefault',
  'runInBackground',
  'fileRecursive',
  'fileOverwrite',
]);

const labelMap: Record<FieldId, string> = {
  name: 'Name',
  type: 'Type',
  phase: 'Phase',
  isEnabled: 'Enabled',
  defineAdd: 'Add Symbols',
  defineRemove: 'Remove Symbols',
  companyName: 'Company Name',
  productName: 'Product Name',
  version: 'Version',
  bundleIdentifier: 'Bundle Identifier',
  defaultScreenWidth: 'Default Width',
  defaultScreenHeight: 'Default Height',
  fullscreenByDefault: 'Fullscreen',
  runInBackground: 'Run in Background',
  scenes: 'Scenes',
  sceneMode: 'Scene Mode',
  customUsings: 'Usings',
  customCode: 'Custom Code',
  shellCommand: 'Command',
  shellWorkingDirectory: 'Working Dir',
  shellTimeoutSeconds: 'Timeout Sec',
  fileSource: 'Source',
  fileDestination: 'Destination',
  filePattern: 'Pattern',
  fileRecursive: 'Recursive',
  fileOverwrite: 'Overwrite',
  assetPath: 'Asset Path',
  assetSettingsJson: 'Asset Settings',
};

const listToText = (list?: string[]) => (list || []).join(', ');

const textToList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getConfigValue = (config: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (config[key] !== undefined) return config[key];
  }
  return undefined;
};

type PipelineDetailScreenProps = {
  api: ApiClient;
  pipelineId: string;
  isActive: boolean;
  onBack: () => void;
};

export function PipelineDetailScreen({ api, pipelineId, isActive, onBack }: PipelineDetailScreenProps) {
  const [pipeline, setPipeline] = useState<BuildPipelineDetail | null>(null);
  const [processTypes, setProcessTypes] = useState<ProcessTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [formFieldIndex, setFormFieldIndex] = useState(0);
  const [formData, setFormData] = useState({ ...defaultProcessForm });
  const [configForm, setConfigForm] = useState({ ...defaultConfigForm });
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [scripts, setScripts] = useState<{ preBuildScript?: string; postBuildScript?: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pipelineData, typesData] = await Promise.all([
        api.getPipeline(pipelineId),
        api.getProcessTypes(),
      ]);
      setPipeline(pipelineData);
      setProcessTypes(typesData);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline.');
    } finally {
      setLoading(false);
    }
  }, [api, pipelineId]);

  useEffect(() => {
    if (!isActive) return;
    void fetchData();
  }, [fetchData, isActive]);

  const processes = pipeline?.processes || [];

  const activeFields = useMemo(() => {
    const configFields = configFieldsByType[formData.type] || ['assetPath', 'assetSettingsJson'];
    return [...baseFields, ...configFields];
  }, [formData.type]);

  const activeField = activeFields[formFieldIndex] || activeFields[0];

  useEffect(() => {
    if (formFieldIndex >= activeFields.length) {
      setFormFieldIndex(0);
    }
  }, [activeFields.length, formFieldIndex]);

  const updateFieldValue = (field: FieldId, value: string | boolean) => {
    if (baseFields.includes(field as BaseFieldId)) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      setConfigForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const applyConfigToForm = (type: ProcessType, config: Record<string, unknown>) => {
    switch (type) {
      case 'DefineSymbols':
        setConfigForm((prev) => ({
          ...prev,
          defineAdd: listToText(getConfigValue(config, ['add', 'Add']) as string[]),
          defineRemove: listToText(getConfigValue(config, ['remove', 'Remove']) as string[]),
        }));
        break;
      case 'PlayerSettings':
        setConfigForm((prev) => ({
          ...prev,
          companyName: String(getConfigValue(config, ['companyName', 'CompanyName']) ?? ''),
          productName: String(getConfigValue(config, ['productName', 'ProductName']) ?? ''),
          version: String(getConfigValue(config, ['version', 'Version']) ?? ''),
          bundleIdentifier: String(getConfigValue(config, ['bundleIdentifier', 'BundleIdentifier']) ?? ''),
          defaultScreenWidth: getConfigValue(config, ['defaultScreenWidth', 'DefaultScreenWidth'])
            ? String(getConfigValue(config, ['defaultScreenWidth', 'DefaultScreenWidth']))
            : '',
          defaultScreenHeight: getConfigValue(config, ['defaultScreenHeight', 'DefaultScreenHeight'])
            ? String(getConfigValue(config, ['defaultScreenHeight', 'DefaultScreenHeight']))
            : '',
          fullscreenByDefault: Boolean(getConfigValue(config, ['fullscreenByDefault', 'FullscreenByDefault'])),
          runInBackground: Boolean(getConfigValue(config, ['runInBackground', 'RunInBackground'])),
        }));
        break;
      case 'SceneList':
        setConfigForm((prev) => ({
          ...prev,
          scenes: listToText(getConfigValue(config, ['scenes', 'Scenes']) as string[]),
          sceneMode: String(getConfigValue(config, ['mode', 'Mode']) ?? 'include'),
        }));
        break;
      case 'CustomCode':
        setConfigForm((prev) => ({
          ...prev,
          customUsings: listToText(getConfigValue(config, ['usings', 'Usings']) as string[]),
          customCode: String(getConfigValue(config, ['code', 'Code']) ?? ''),
        }));
        break;
      case 'ShellCommand':
        setConfigForm((prev) => ({
          ...prev,
          shellCommand: String(getConfigValue(config, ['command', 'Command']) ?? ''),
          shellWorkingDirectory: String(getConfigValue(config, ['workingDirectory', 'WorkingDirectory']) ?? ''),
          shellTimeoutSeconds: String(getConfigValue(config, ['timeoutSeconds', 'TimeoutSeconds']) ?? 300),
        }));
        break;
      case 'FileCopy':
        setConfigForm((prev) => ({
          ...prev,
          fileSource: String(getConfigValue(config, ['source', 'Source']) ?? ''),
          fileDestination: String(getConfigValue(config, ['destination', 'Destination']) ?? ''),
          filePattern: String(getConfigValue(config, ['pattern', 'Pattern']) ?? '*.*'),
          fileRecursive: getConfigValue(config, ['recursive', 'Recursive']) !== undefined
            ? Boolean(getConfigValue(config, ['recursive', 'Recursive']))
            : true,
          fileOverwrite: getConfigValue(config, ['overwrite', 'Overwrite']) !== undefined
            ? Boolean(getConfigValue(config, ['overwrite', 'Overwrite']))
            : true,
        }));
        break;
      case 'AssetSettings':
        setConfigForm((prev) => ({
          ...prev,
          assetPath: String(getConfigValue(config, ['assetPath', 'AssetPath']) ?? ''),
          assetSettingsJson: JSON.stringify(getConfigValue(config, ['settings', 'Settings']) ?? {}, null, 2),
        }));
        break;
      default:
        break;
    }
  };

  const applyDefaultsForType = (type: ProcessType) => {
    const info = processTypes.find((entry) => entry.type === type);
    if (info) {
      setFormData((prev) => ({ ...prev, phase: info.defaultPhase, type }));
      applyConfigToForm(type, info.defaultConfiguration as Record<string, unknown>);
    } else {
      setFormData((prev) => ({ ...prev, type }));
    }
  };

  const openAddProcess = () => {
    setMode('form');
    setEditingProcessId(null);
    setFormData({ ...defaultProcessForm });
    setConfigForm({ ...defaultConfigForm });
    applyDefaultsForType(defaultProcessForm.type);
    setFormFieldIndex(0);
    setStatus(null);
  };

  const openEditProcess = (process: BuildProcess) => {
    setMode('form');
    setEditingProcessId(process.id);
    setFormData({
      name: process.name,
      type: process.type,
      phase: process.phase,
      isEnabled: process.isEnabled,
    });
    setConfigForm({ ...defaultConfigForm });
    applyConfigToForm(process.type, process.configuration as Record<string, unknown>);
    setFormFieldIndex(0);
    setStatus(null);
  };

  const cycleProcessType = (direction: 1 | -1) => {
    const list = processTypes.map((t) => t.type);
    if (list.length === 0) return;
    const currentIndex = list.indexOf(formData.type);
    const nextIndex = (currentIndex + direction + list.length) % list.length;
    const nextType = list[nextIndex] || formData.type;
    applyDefaultsForType(nextType);
  };

  const cyclePhase = (direction: 1 | -1) => {
    const currentIndex = phaseOptions.indexOf(formData.phase);
    const nextIndex = (currentIndex + direction + phaseOptions.length) % phaseOptions.length;
    updateFieldValue('phase', phaseOptions[nextIndex]);
  };

  const cycleSceneMode = (direction: 1 | -1) => {
    const modes = ['include', 'exclude'];
    const currentIndex = modes.indexOf(configForm.sceneMode);
    const nextIndex = (currentIndex + direction + modes.length) % modes.length;
    updateFieldValue('sceneMode', modes[nextIndex]);
  };

  const buildConfig = (): { config?: Record<string, unknown>; error?: string } => {
    switch (formData.type) {
      case 'DefineSymbols':
        return {
          config: {
            add: textToList(configForm.defineAdd),
            remove: textToList(configForm.defineRemove),
          },
        };
      case 'PlayerSettings':
        return {
          config: {
            companyName: configForm.companyName || undefined,
            productName: configForm.productName || undefined,
            version: configForm.version || undefined,
            bundleIdentifier: configForm.bundleIdentifier || undefined,
            defaultScreenWidth: configForm.defaultScreenWidth
              ? Number.isFinite(parseInt(configForm.defaultScreenWidth, 10))
                ? parseInt(configForm.defaultScreenWidth, 10)
                : undefined
              : undefined,
            defaultScreenHeight: configForm.defaultScreenHeight
              ? Number.isFinite(parseInt(configForm.defaultScreenHeight, 10))
                ? parseInt(configForm.defaultScreenHeight, 10)
                : undefined
              : undefined,
            fullscreenByDefault: configForm.fullscreenByDefault,
            runInBackground: configForm.runInBackground,
          },
        };
      case 'SceneList':
        return {
          config: {
            scenes: textToList(configForm.scenes),
            mode: configForm.sceneMode || 'include',
          },
        };
      case 'CustomCode':
        return {
          config: {
            code: configForm.customCode || '',
            usings: textToList(configForm.customUsings),
          },
        };
      case 'ShellCommand':
        return {
          config: {
            command: configForm.shellCommand || '',
            workingDirectory: configForm.shellWorkingDirectory || undefined,
            timeoutSeconds: (() => {
              const parsed = parseInt(configForm.shellTimeoutSeconds, 10);
              return Number.isFinite(parsed) ? parsed : 300;
            })(),
          },
        };
      case 'FileCopy':
        return {
          config: {
            source: configForm.fileSource || '',
            destination: configForm.fileDestination || '',
            pattern: configForm.filePattern || '*.*',
            recursive: configForm.fileRecursive,
            overwrite: configForm.fileOverwrite,
          },
        };
      case 'AssetSettings':
        try {
          const settings = configForm.assetSettingsJson
            ? JSON.parse(configForm.assetSettingsJson)
            : {};
          return {
            config: {
              assetPath: configForm.assetPath || '',
              settings,
            },
          };
        } catch {
          return { error: 'Invalid JSON in asset settings.' };
        }
      default:
        return { config: {} };
    }
  };

  const handleSaveProcess = async () => {
    setStatus(null);
    if (!pipeline) return;
    if (!formData.name.trim()) {
      setStatus('Process name is required.');
      return;
    }

    const { config, error: configError } = buildConfig();
    if (configError) {
      setStatus(configError);
      return;
    }

    try {
      if (editingProcessId) {
        await api.updateProcess(pipeline.id, editingProcessId, {
          name: formData.name,
          phase: formData.phase,
          configuration: config || {},
          isEnabled: formData.isEnabled,
        });
      } else {
        await api.addProcess(pipeline.id, {
          name: formData.name,
          type: formData.type,
          phase: formData.phase,
          order: pipeline.processes.length,
          configuration: config || {},
        });
      }
      setStatus('Process saved.');
      setMode('list');
      setEditingProcessId(null);
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save process.');
    }
  };

  const handleDeleteProcess = async (process: BuildProcess) => {
    if (!pipeline) return;
    setStatus('Deleting process...');
    try {
      await api.deleteProcess(pipeline.id, process.id);
      setStatus('Process deleted.');
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to delete process.');
    }
  };

  const handleToggleProcess = async (process: BuildProcess) => {
    if (!pipeline) return;
    try {
      await api.updateProcess(pipeline.id, process.id, { isEnabled: !process.isEnabled });
      await fetchData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to update process.');
    }
  };

  const handleMoveProcess = async (process: BuildProcess, direction: 1 | -1) => {
    if (!pipeline) return;
    const currentIndex = pipeline.processes.findIndex((p) => p.id === process.id);
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= pipeline.processes.length) return;

    const newProcesses = [...pipeline.processes];
    [newProcesses[currentIndex], newProcesses[newIndex]] = [
      newProcesses[newIndex],
      newProcesses[currentIndex],
    ];

    setPipeline({ ...pipeline, processes: newProcesses });

    try {
      await api.reorderProcesses(pipeline.id, newProcesses.map((p) => p.id));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to reorder processes.');
      await fetchData();
    }
  };

  const handlePreviewScripts = async () => {
    setStatus('Loading scripts...');
    try {
      const scriptsData = await api.getPipelineScripts(pipelineId);
      setScripts({
        preBuildScript: scriptsData.preBuildScript,
        postBuildScript: scriptsData.postBuildScript,
      });
      setMode('scripts');
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load scripts.');
    }
  };

  useInput((input, key) => {
    if (!isActive) return;

    if (mode === 'list') {
      if (key.escape) {
        onBack();
        return;
      }

      if (input === 'r') {
        void fetchData();
        return;
      }

      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }

      if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(processes.length - 1, prev + 1));
      }

      if (input === 'a') {
        openAddProcess();
      }

      if (input === 'e') {
        const process = processes[selectedIndex];
        if (process) openEditProcess(process);
      }

      if (input === 'd') {
        const process = processes[selectedIndex];
        if (process) void handleDeleteProcess(process);
      }

      if (input === ' ') {
        const process = processes[selectedIndex];
        if (process) void handleToggleProcess(process);
      }

      if (input === '[') {
        const process = processes[selectedIndex];
        if (process) void handleMoveProcess(process, -1);
      }

      if (input === ']') {
        const process = processes[selectedIndex];
        if (process) void handleMoveProcess(process, 1);
      }

      if (input === 's') {
        void handlePreviewScripts();
      }

      return;
    }

    if (mode === 'scripts') {
      if (key.escape) {
        setMode('list');
      }
      return;
    }

    if (mode === 'form') {
      if (key.escape) {
        setMode('list');
        setEditingProcessId(null);
        return;
      }

      if (key.ctrl && input === 's') {
        void handleSaveProcess();
        return;
      }

      if (key.upArrow || key.downArrow) {
        setFormFieldIndex((prev) => {
          if (key.downArrow) return (prev + 1) % activeFields.length;
          return (prev - 1 + activeFields.length) % activeFields.length;
        });
        return;
      }

      if (activeField === 'type' && (key.leftArrow || key.rightArrow)) {
        cycleProcessType(key.rightArrow ? 1 : -1);
        return;
      }

      if (activeField === 'phase' && (key.leftArrow || key.rightArrow)) {
        cyclePhase(key.rightArrow ? 1 : -1);
        return;
      }

      if (activeField === 'sceneMode' && (key.leftArrow || key.rightArrow)) {
        cycleSceneMode(key.rightArrow ? 1 : -1);
        return;
      }

      if (toggleFields.has(activeField) && (input === ' ' || key.leftArrow || key.rightArrow)) {
        const currentValue = baseFields.includes(activeField as BaseFieldId)
          ? formData[activeField as BaseFieldId]
          : configForm[activeField as ConfigFieldId];
        updateFieldValue(activeField, !currentValue);
        return;
      }

      if (key.backspace || key.delete) {
        if (!toggleFields.has(activeField) && activeField !== 'type' && activeField !== 'phase' && activeField !== 'sceneMode') {
          const currentValue = baseFields.includes(activeField as BaseFieldId)
            ? formData[activeField as BaseFieldId]
            : configForm[activeField as ConfigFieldId];
          updateFieldValue(activeField, String(currentValue).slice(0, -1));
        }
        return;
      }

      if (!input) return;

      if (!toggleFields.has(activeField) && activeField !== 'type' && activeField !== 'phase' && activeField !== 'sceneMode') {
        const currentValue = baseFields.includes(activeField as BaseFieldId)
          ? formData[activeField as BaseFieldId]
          : configForm[activeField as ConfigFieldId];
        updateFieldValue(activeField, `${currentValue}${input}`);
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Pipeline Detail</Text>
        <Text color="yellow">Loading pipeline...</Text>
      </Box>
    );
  }

  if (error || !pipeline) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Pipeline Detail</Text>
        <Text color="red">{error || 'Pipeline not found.'}</Text>
      </Box>
    );
  }

  if (mode === 'scripts') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Scripts Preview</Text>
        <Text dimColor>Press Esc to go back.</Text>
        {scripts?.preBuildScript && (
          <Box flexDirection="column">
            <Text bold>Pre-Build Script</Text>
            <Text>{scripts.preBuildScript}</Text>
          </Box>
        )}
        {scripts?.postBuildScript && (
          <Box flexDirection="column">
            <Text bold>Post-Build Script</Text>
            <Text>{scripts.postBuildScript}</Text>
          </Box>
        )}
        {!scripts?.preBuildScript && !scripts?.postBuildScript && (
          <Text dimColor>No scripts generated.</Text>
        )}
        {status && <Text color="yellow">{status}</Text>}
      </Box>
    );
  }

  if (mode === 'form') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{editingProcessId ? 'Edit Process' : 'Add Process'}</Text>
        <Text dimColor>↑/↓ move · Ctrl+S save · Esc cancel · left/right to change</Text>
        {activeFields.map((fieldId, index) => {
          const focused = activeField === fieldId && formFieldIndex === index;
          const value = baseFields.includes(fieldId as BaseFieldId)
            ? formData[fieldId as BaseFieldId]
            : configForm[fieldId as ConfigFieldId];

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
        {formData.type === 'DefineSymbols' && (
          <Text dimColor>Symbols are comma-separated.</Text>
        )}
        {formData.type === 'SceneList' && (
          <Text dimColor>Scenes are comma-separated, mode is include/exclude.</Text>
        )}
        {formData.type === 'CustomCode' && (
          <Text dimColor>Usings are comma-separated.</Text>
        )}
        {status && <Text color={status.includes('Failed') ? 'red' : 'yellow'}>{status}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Pipeline: {pipeline.name}</Text>
      <Text dimColor>{pipeline.description || 'No description'}</Text>
      <Box flexDirection="column">
        {processes.length === 0 && <Text dimColor>No processes yet.</Text>}
        {processes.map((process, index) => {
          const selected = index === selectedIndex;
          return (
            <Text key={process.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
              {selected ? '>' : ' '} {process.name} · {process.type} · {process.phase} · {process.isEnabled ? 'On' : 'Off'}
            </Text>
          );
        })}
      </Box>
      <Text dimColor>a add · e edit · d delete · space toggle · [ ] reorder · s scripts · Esc back</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
