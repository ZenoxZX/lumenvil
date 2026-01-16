'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import { getProjects, createProject, deleteProject } from '@/lib/api';
import { hasRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Hammer, CheckCircle, Pencil } from 'lucide-react';

function DialogComponent({
  children,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  return <Dialog {...props}>{children}</Dialog>;
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canEdit = hasRole('Developer');

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    gitUrl: '',
    defaultBranch: 'main',
    unityVersion: '2022.3.0f1',
    buildPath: '',
    steamAppId: '',
    steamDepotId: '',
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createProject({
        name: newProject.name,
        description: newProject.description || undefined,
        gitUrl: newProject.gitUrl || undefined,
        defaultBranch: newProject.defaultBranch,
        unityVersion: newProject.unityVersion,
        buildPath: newProject.buildPath,
        steamAppId: newProject.steamAppId || undefined,
        steamDepotId: newProject.steamDepotId || undefined,
      });

      toast({
        title: 'Project Created',
        description: `${newProject.name} has been created`,
      });

      setShowNewDialog(false);
      setNewProject({
        name: '',
        description: '',
        gitUrl: '',
        defaultBranch: 'main',
        unityVersion: '2022.3.0f1',
        buildPath: '',
        steamAppId: '',
        steamDepotId: '',
      });
      fetchProjects();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create project',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) {
      return;
    }

    try {
      await deleteProject(project.id);
      toast({
        title: 'Project Deleted',
        description: `${project.name} has been deleted`,
      });
      fetchProjects();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your Unity projects</p>
        </div>
        {canEdit && (
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Add a new Unity project to the build system
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      value={newProject.name}
                      onChange={(e) =>
                        setNewProject({ ...newProject, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newProject.description}
                      onChange={(e) =>
                        setNewProject({ ...newProject, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buildPath">Build Path *</Label>
                    <Input
                      id="buildPath"
                      value={newProject.buildPath}
                      onChange={(e) =>
                        setNewProject({ ...newProject, buildPath: e.target.value })
                      }
                      placeholder="D:\Projects\MyGame"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unityVersion">Unity Version *</Label>
                    <Input
                      id="unityVersion"
                      value={newProject.unityVersion}
                      onChange={(e) =>
                        setNewProject({ ...newProject, unityVersion: e.target.value })
                      }
                      placeholder="2022.3.0f1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitUrl">Git URL</Label>
                    <Input
                      id="gitUrl"
                      value={newProject.gitUrl}
                      onChange={(e) =>
                        setNewProject({ ...newProject, gitUrl: e.target.value })
                      }
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultBranch">Default Branch</Label>
                    <Input
                      id="defaultBranch"
                      value={newProject.defaultBranch}
                      onChange={(e) =>
                        setNewProject({ ...newProject, defaultBranch: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Project'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No projects yet</p>
            {canEdit && (
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription>{project.description || 'No description'}</CardDescription>
                  </div>
                  <Badge variant={project.isActive ? 'success' : 'secondary'}>
                    {project.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unity Version</span>
                    <span>{project.unityVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Default Branch</span>
                    <span>{project.defaultBranch}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Hammer className="h-3 w-3" /> Total Builds
                    </span>
                    <span>{project.totalBuilds}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" /> Successful
                    </span>
                    <span className="text-green-500">{project.successfulBuilds}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/builds?projectId=${project.id}`}>View Builds</Link>
                </Button>
                <div className="flex gap-1">
                  {canEdit && (
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/dashboard/projects/${project.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {hasRole('Admin') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProject(project)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
