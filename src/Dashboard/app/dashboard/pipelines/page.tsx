'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPipelines,
  createPipeline,
  deletePipeline,
  getProjects,
} from '@/lib/api';
import { BuildPipeline, Project } from '@/types';
import { hasRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  Workflow,
  Plus,
  Trash2,
  Settings,
  Loader2,
  Globe,
} from 'lucide-react';

export default function PipelinesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<BuildPipeline[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [newPipeline, setNewPipeline] = useState({
    name: '',
    description: '',
    projectId: '__global__',
    isDefault: false,
  });

  const canManage = mounted && hasRole('Developer');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pipelinesData, projectsData] = await Promise.all([
        getPipelines(),
        getProjects(),
      ]);
      setPipelines(pipelinesData);
      setProjects(projectsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load pipelines',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipeline.name.trim()) {
      toast({
        title: 'Error',
        description: 'Pipeline name is required',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const created = await createPipeline({
        name: newPipeline.name,
        description: newPipeline.description || undefined,
        projectId: newPipeline.projectId === '__global__' ? undefined : newPipeline.projectId,
        isDefault: newPipeline.isDefault,
      });

      setPipelines([...pipelines, created]);
      setDialogOpen(false);
      setNewPipeline({ name: '', description: '', projectId: '__global__', isDefault: false });

      toast({
        title: 'Pipeline Created',
        description: `Pipeline "${created.name}" has been created`,
      });

      // Navigate to edit page
      router.push(`/dashboard/pipelines/${created.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create pipeline',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (pipeline: BuildPipeline) => {
    if (!confirm(`Are you sure you want to delete "${pipeline.name}"?`)) {
      return;
    }

    setDeleting(pipeline.id);
    try {
      await deletePipeline(pipeline.id);
      setPipelines(pipelines.filter((p) => p.id !== pipeline.id));
      toast({
        title: 'Pipeline Deleted',
        description: `Pipeline "${pipeline.name}" has been deleted`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete pipeline',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-8 w-8" />
            Build Pipelines
          </h1>
          <p className="text-muted-foreground">
            Configure build process chains with custom steps
          </p>
        </div>

        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create Pipeline</DialogTitle>
                  <DialogDescription>
                    Create a new build pipeline with custom processes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newPipeline.name}
                      onChange={(e) =>
                        setNewPipeline({ ...newPipeline, name: e.target.value })
                      }
                      placeholder="Release Build Pipeline"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newPipeline.description}
                      onChange={(e) =>
                        setNewPipeline({ ...newPipeline, description: e.target.value })
                      }
                      placeholder="Pipeline for release builds"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project">Project (Optional)</Label>
                    <Select
                      value={newPipeline.projectId}
                      onValueChange={(value) =>
                        setNewPipeline({ ...newPipeline, projectId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__global__">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Global (All Projects)
                          </div>
                        </SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Leave as Global to use with any project
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Pipeline'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pipelines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Pipelines</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Build pipelines allow you to add custom processes like define symbols,
              player settings, and custom code that run during Unity builds.
            </p>
            {canManage && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Pipeline
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Pipelines</CardTitle>
            <CardDescription>
              {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Processes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelines.map((pipeline) => (
                  <TableRow key={pipeline.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pipeline.name}</div>
                        {pipeline.description && (
                          <div className="text-sm text-muted-foreground">
                            {pipeline.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pipeline.projectName ? (
                        <Badge variant="outline">{pipeline.projectName}</Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Globe className="h-3 w-3 mr-1" />
                          Global
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {pipeline.processCount} process{pipeline.processCount !== 1 ? 'es' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {pipeline.isDefault && (
                          <Badge variant="default">Default</Badge>
                        )}
                        {pipeline.isActive ? (
                          <Badge variant="outline" className="text-green-600">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/pipelines/${pipeline.id}`)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(pipeline)}
                            disabled={deleting === pipeline.id}
                          >
                            {deleting === pipeline.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
