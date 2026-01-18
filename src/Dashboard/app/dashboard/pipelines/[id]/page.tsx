'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getPipeline,
  updatePipeline,
  addProcess,
  updateProcess,
  deleteProcess,
  reorderProcesses,
  getProcessTypes,
  getPipelineScripts,
} from '@/lib/api';
import {
  BuildPipelineDetail,
  BuildProcess,
  ProcessTypeInfo,
  ProcessType,
  BuildPhase,
} from '@/types';
import { hasRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Workflow,
  Plus,
  Trash2,
  GripVertical,
  ArrowLeft,
  Loader2,
  Code,
  Settings,
  Play,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function PipelineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const pipelineId = params.id as string;

  const [pipeline, setPipeline] = useState<BuildPipelineDetail | null>(null);
  const [processTypes, setProcessTypes] = useState<ProcessTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add process dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingProcess, setAddingProcess] = useState(false);
  const [newProcess, setNewProcess] = useState({
    name: '',
    type: 'DefineSymbols' as ProcessType,
    phase: 'PreBuild' as BuildPhase,
    configuration: {} as Record<string, unknown>,
  });

  // Edit process dialog
  const [editingProcess, setEditingProcess] = useState<BuildProcess | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Scripts preview dialog
  const [scriptsDialogOpen, setScriptsDialogOpen] = useState(false);
  const [scripts, setScripts] = useState<{ preBuildScript?: string; postBuildScript?: string } | null>(null);
  const [loadingScripts, setLoadingScripts] = useState(false);

  const canManage = mounted && hasRole('Developer');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [pipelineId]);

  const fetchData = async () => {
    try {
      const [pipelineData, typesData] = await Promise.all([
        getPipeline(pipelineId),
        getProcessTypes(),
      ]);
      setPipeline(pipelineData);
      setProcessTypes(typesData);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load pipeline',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipeline || !newProcess.name.trim()) return;

    setAddingProcess(true);
    try {
      const typeInfo = processTypes.find((t) => t.type === newProcess.type);
      const created = await addProcess(pipelineId, {
        name: newProcess.name,
        type: newProcess.type,
        phase: newProcess.phase,
        order: pipeline.processes.length,
        configuration: typeInfo?.defaultConfiguration || {},
      });

      setPipeline({
        ...pipeline,
        processes: [...pipeline.processes, created],
      });

      setAddDialogOpen(false);
      setNewProcess({
        name: '',
        type: 'DefineSymbols',
        phase: 'PreBuild',
        configuration: {},
      });

      toast({
        title: 'Process Added',
        description: `Process "${created.name}" has been added`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add process',
        variant: 'destructive',
      });
    } finally {
      setAddingProcess(false);
    }
  };

  const handleDeleteProcess = async (process: BuildProcess) => {
    if (!pipeline) return;
    if (!confirm(`Delete process "${process.name}"?`)) return;

    try {
      await deleteProcess(pipelineId, process.id);
      setPipeline({
        ...pipeline,
        processes: pipeline.processes.filter((p) => p.id !== process.id),
      });
      toast({
        title: 'Process Deleted',
        description: `Process "${process.name}" has been deleted`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete process',
        variant: 'destructive',
      });
    }
  };

  const handleToggleProcess = async (process: BuildProcess) => {
    if (!pipeline) return;

    try {
      const updated = await updateProcess(pipelineId, process.id, {
        isEnabled: !process.isEnabled,
      });

      setPipeline({
        ...pipeline,
        processes: pipeline.processes.map((p) =>
          p.id === process.id ? updated : p
        ),
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update process',
        variant: 'destructive',
      });
    }
  };

  const handleMoveProcess = async (process: BuildProcess, direction: 'up' | 'down') => {
    if (!pipeline) return;

    const currentIndex = pipeline.processes.findIndex((p) => p.id === process.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= pipeline.processes.length) return;

    const newProcesses = [...pipeline.processes];
    [newProcesses[currentIndex], newProcesses[newIndex]] = [
      newProcesses[newIndex],
      newProcesses[currentIndex],
    ];

    // Optimistic update
    setPipeline({ ...pipeline, processes: newProcesses });

    try {
      await reorderProcesses(pipelineId, newProcesses.map((p) => p.id));
    } catch (error) {
      // Revert on error
      fetchData();
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reorder',
        variant: 'destructive',
      });
    }
  };

  const handleEditProcess = (process: BuildProcess) => {
    setEditingProcess(process);
    setEditDialogOpen(true);
  };

  const handleSaveProcessConfig = async (config: Record<string, unknown>) => {
    if (!pipeline || !editingProcess) return;

    try {
      const updated = await updateProcess(pipelineId, editingProcess.id, {
        configuration: config,
      });

      setPipeline({
        ...pipeline,
        processes: pipeline.processes.map((p) =>
          p.id === editingProcess.id ? updated : p
        ),
      });

      setEditDialogOpen(false);
      setEditingProcess(null);

      toast({
        title: 'Process Updated',
        description: 'Process configuration has been saved',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });
    }
  };

  const handlePreviewScripts = async () => {
    setLoadingScripts(true);
    setScriptsDialogOpen(true);

    try {
      const scriptsData = await getPipelineScripts(pipelineId);
      setScripts(scriptsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate scripts',
        variant: 'destructive',
      });
    } finally {
      setLoadingScripts(false);
    }
  };

  const getProcessTypeLabel = (type: ProcessType) => {
    const typeInfo = processTypes.find((t) => t.type === type);
    return typeInfo?.name || type;
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Pipeline not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/dashboard/pipelines')}
        >
          Back to Pipelines
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/pipelines')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-8 w-8" />
            {pipeline.name}
          </h1>
          <p className="text-muted-foreground">
            {pipeline.description || 'No description'}
          </p>
        </div>
        <Button variant="outline" onClick={handlePreviewScripts}>
          <Eye className="mr-2 h-4 w-4" />
          Preview Scripts
        </Button>
      </div>

      {/* Process Chain */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Process Chain</CardTitle>
              <CardDescription>
                Processes run in order during Unity build
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Process
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pipeline.processes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No processes yet. Add your first process to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pipeline.processes.map((process, index) => (
                <div
                  key={process.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg ${
                    !process.isEnabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => handleMoveProcess(process, 'up')}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === pipeline.processes.length - 1}
                      onClick={() => handleMoveProcess(process, 'down')}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{process.name}</span>
                      <Badge variant="outline">
                        {getProcessTypeLabel(process.type)}
                      </Badge>
                      <Badge
                        variant={process.phase === 'PreBuild' ? 'default' : 'secondary'}
                      >
                        {process.phase}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={process.isEnabled}
                      onCheckedChange={() => handleToggleProcess(process)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditProcess(process)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteProcess(process)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Process Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <form onSubmit={handleAddProcess}>
            <DialogHeader>
              <DialogTitle>Add Process</DialogTitle>
              <DialogDescription>
                Add a new process to the pipeline chain
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="process-name">Name</Label>
                <Input
                  id="process-name"
                  value={newProcess.name}
                  onChange={(e) =>
                    setNewProcess({ ...newProcess, name: e.target.value })
                  }
                  placeholder="Add Steam Defines"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newProcess.type}
                  onValueChange={(value: ProcessType) =>
                    setNewProcess({ ...newProcess, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {processTypes.map((type) => (
                      <SelectItem key={type.type} value={type.type}>
                        <div>
                          <div className="font-medium">{type.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {type.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select
                  value={newProcess.phase}
                  onValueChange={(value: BuildPhase) =>
                    setNewProcess({ ...newProcess, phase: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PreBuild">Pre-Build (before Unity build)</SelectItem>
                    <SelectItem value="PostBuild">Post-Build (after Unity build)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addingProcess}>
                {addingProcess ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Process'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Process Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure: {editingProcess?.name}</DialogTitle>
            <DialogDescription>
              {getProcessTypeLabel(editingProcess?.type || 'DefineSymbols')}
            </DialogDescription>
          </DialogHeader>
          {editingProcess && (
            <ProcessConfigEditor
              process={editingProcess}
              onSave={handleSaveProcessConfig}
              onCancel={() => setEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Scripts Preview Dialog */}
      <Dialog open={scriptsDialogOpen} onOpenChange={setScriptsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Scripts Preview</DialogTitle>
            <DialogDescription>
              These scripts will be created in Unity before build and deleted after
            </DialogDescription>
          </DialogHeader>
          {loadingScripts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {scripts?.preBuildScript && (
                <div>
                  <Label>Pre-Build Script (LumenvilPreBuild.cs)</Label>
                  <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                    <code>{scripts.preBuildScript}</code>
                  </pre>
                </div>
              )}
              {scripts?.postBuildScript && (
                <div>
                  <Label>Post-Build Script (LumenvilPostBuild.cs)</Label>
                  <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                    <code>{scripts.postBuildScript}</code>
                  </pre>
                </div>
              )}
              {!scripts?.preBuildScript && !scripts?.postBuildScript && (
                <p className="text-center py-8 text-muted-foreground">
                  No enabled processes to generate scripts
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Process Configuration Editor Component
function ProcessConfigEditor({
  process,
  onSave,
  onCancel,
}: {
  process: BuildProcess;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>(process.configuration);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(config);
    setSaving(false);
  };

  // Render different editors based on process type
  const renderEditor = () => {
    switch (process.type) {
      case 'DefineSymbols':
        return (
          <DefineSymbolsEditor
            config={config as { add?: string[]; remove?: string[] }}
            onChange={setConfig}
          />
        );
      case 'PlayerSettings':
        return (
          <PlayerSettingsEditor
            config={config as Record<string, unknown>}
            onChange={setConfig}
          />
        );
      case 'CustomCode':
        return (
          <CustomCodeEditor
            config={config as { code?: string; usings?: string[] }}
            onChange={setConfig}
          />
        );
      case 'ShellCommand':
        return (
          <ShellCommandEditor
            config={config as { command?: string; workingDirectory?: string; timeoutSeconds?: number }}
            onChange={setConfig}
          />
        );
      default:
        return (
          <div className="space-y-2">
            <Label>Configuration (JSON)</Label>
            <Textarea
              value={JSON.stringify(config, null, 2)}
              onChange={(e) => {
                try {
                  setConfig(JSON.parse(e.target.value));
                } catch {}
              }}
              className="font-mono"
              rows={10}
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {renderEditor()}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Configuration
        </Button>
      </DialogFooter>
    </div>
  );
}

// Define Symbols Editor
function DefineSymbolsEditor({
  config,
  onChange,
}: {
  config: { add?: string[]; remove?: string[] };
  onChange: (config: Record<string, unknown>) => void;
}) {
  const [addSymbols, setAddSymbols] = useState((config.add || []).join('\n'));
  const [removeSymbols, setRemoveSymbols] = useState((config.remove || []).join('\n'));

  useEffect(() => {
    onChange({
      add: addSymbols.split('\n').filter((s) => s.trim()),
      remove: removeSymbols.split('\n').filter((s) => s.trim()),
    });
  }, [addSymbols, removeSymbols]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Add Symbols (one per line)</Label>
        <Textarea
          value={addSymbols}
          onChange={(e) => setAddSymbols(e.target.value)}
          placeholder="STEAM_BUILD&#10;RELEASE_VERSION"
          className="font-mono"
          rows={6}
        />
      </div>
      <div className="space-y-2">
        <Label>Remove Symbols (one per line)</Label>
        <Textarea
          value={removeSymbols}
          onChange={(e) => setRemoveSymbols(e.target.value)}
          placeholder="DEBUG_MODE&#10;DEVELOPMENT_BUILD"
          className="font-mono"
          rows={6}
        />
      </div>
    </div>
  );
}

// Player Settings Editor
function PlayerSettingsEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Company Name</Label>
        <Input
          value={(config.companyName as string) || ''}
          onChange={(e) => onChange({ ...config, companyName: e.target.value || undefined })}
          placeholder="My Game Studio"
        />
      </div>
      <div className="space-y-2">
        <Label>Product Name</Label>
        <Input
          value={(config.productName as string) || ''}
          onChange={(e) => onChange({ ...config, productName: e.target.value || undefined })}
          placeholder="My Game"
        />
      </div>
      <div className="space-y-2">
        <Label>Version</Label>
        <Input
          value={(config.version as string) || ''}
          onChange={(e) => onChange({ ...config, version: e.target.value || undefined })}
          placeholder="1.0.0"
        />
      </div>
      <div className="space-y-2">
        <Label>Bundle Identifier</Label>
        <Input
          value={(config.bundleIdentifier as string) || ''}
          onChange={(e) => onChange({ ...config, bundleIdentifier: e.target.value || undefined })}
          placeholder="com.company.game"
        />
      </div>
    </div>
  );
}

// Custom Code Editor
function CustomCodeEditor({
  config,
  onChange,
}: {
  config: { code?: string; usings?: string[] };
  onChange: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>C# Code</Label>
        <Textarea
          value={config.code || ''}
          onChange={(e) => onChange({ ...config, code: e.target.value })}
          placeholder="// Your custom code here&#10;Debug.Log(&quot;Custom process running...&quot;);"
          className="font-mono"
          rows={12}
        />
        <p className="text-xs text-muted-foreground">
          Code runs inside Unity Editor. Available: UnityEngine, UnityEditor, AssetDatabase, PlayerSettings, etc.
        </p>
      </div>
    </div>
  );
}

// Shell Command Editor
function ShellCommandEditor({
  config,
  onChange,
}: {
  config: { command?: string; workingDirectory?: string; timeoutSeconds?: number };
  onChange: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Command</Label>
        <Textarea
          value={config.command || ''}
          onChange={(e) => onChange({ ...config, command: e.target.value })}
          placeholder="echo Build completed!"
          className="font-mono"
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Working Directory (optional)</Label>
          <Input
            value={config.workingDirectory || ''}
            onChange={(e) => onChange({ ...config, workingDirectory: e.target.value || undefined })}
            placeholder="Leave empty for project root"
          />
        </div>
        <div className="space-y-2">
          <Label>Timeout (seconds)</Label>
          <Input
            type="number"
            value={config.timeoutSeconds || 300}
            onChange={(e) => onChange({ ...config, timeoutSeconds: parseInt(e.target.value) || 300 })}
          />
        </div>
      </div>
    </div>
  );
}
