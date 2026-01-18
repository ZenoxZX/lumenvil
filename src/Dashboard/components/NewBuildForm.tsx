'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ScriptingBackend } from '@/types';
import { getProjects, createBuild, getGitBranches } from '@/lib/api';
import { hasRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

interface NewBuildFormProps {
  projectId?: string;
  onBuildCreated?: () => void;
}

export function NewBuildForm({ projectId, onBuildCreated }: NewBuildFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '');
  const [branch, setBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [scriptingBackend, setScriptingBackend] = useState<ScriptingBackend>('IL2CPP');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const canCreateBuild = mounted && hasRole('Developer');

  const loadBranches = async (gitUrl: string) => {
    if (!gitUrl) {
      setBranches([]);
      return;
    }

    setLoadingBranches(true);
    try {
      const response = await getGitBranches(gitUrl);
      setBranches(response.branches);
    } catch (error) {
      console.error('Failed to load branches:', error);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const fetchProjects = async () => {
      try {
        const data = await getProjects();
        setProjects(data.filter((p) => p.isActive));
        if (!projectId && data.length > 0) {
          setSelectedProject(data[0].id);
          setBranch(data[0].defaultBranch);
          if (data[0].gitUrl) {
            await loadBranches(data[0].gitUrl);
          }
        } else if (projectId) {
          const project = data.find((p) => p.id === projectId);
          if (project) {
            setBranch(project.defaultBranch);
            if (project.gitUrl) {
              await loadBranches(project.gitUrl);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, [projectId]);

  const handleProjectChange = async (value: string) => {
    setSelectedProject(value);
    const project = projects.find((p) => p.id === value);
    if (project) {
      setBranch(project.defaultBranch);
      setBranches([]);
      if (project.gitUrl) {
        await loadBranches(project.gitUrl);
      }
    }
  };

  const handleRefreshBranches = async () => {
    const project = projects.find((p) => p.id === selectedProject);
    if (project?.gitUrl) {
      await loadBranches(project.gitUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      toast({
        title: 'Error',
        description: 'Please select a project',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const build = await createBuild({
        projectId: selectedProject,
        branch: branch || undefined,
        scriptingBackend,
      });
      toast({
        title: 'Build Started',
        description: `Build #${build.buildNumber} has been queued`,
      });
      onBuildCreated?.();
      router.push(`/dashboard/builds/${build.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start build',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Don't show the form if user doesn't have permission
  if (!canCreateBuild) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start New Build</CardTitle>
        <CardDescription>Configure and start a new Unity build</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={selectedProject}
              onValueChange={handleProjectChange}
              disabled={!!projectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} ({project.unityVersion})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <div className="flex gap-2">
              {branches.length > 0 ? (
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="flex-1"
                />
              )}
              {projects.find((p) => p.id === selectedProject)?.gitUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshBranches}
                  disabled={loadingBranches}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingBranches ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backend">Scripting Backend</Label>
            <Select
              value={scriptingBackend}
              onValueChange={(value: ScriptingBackend) => setScriptingBackend(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IL2CPP">IL2CPP (Recommended)</SelectItem>
                <SelectItem value="Mono">Mono</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={submitting || !selectedProject}>
            {submitting ? 'Starting...' : 'Start Build'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
