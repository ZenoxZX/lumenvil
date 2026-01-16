'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ScriptingBackend } from '@/types';
import { getProjects, createBuild } from '@/lib/api';
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

interface NewBuildFormProps {
  projectId?: string;
}

export function NewBuildForm({ projectId }: NewBuildFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '');
  const [branch, setBranch] = useState<string>('');
  const [scriptingBackend, setScriptingBackend] = useState<ScriptingBackend>('IL2CPP');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await getProjects();
        setProjects(data.filter((p) => p.isActive));
        if (!projectId && data.length > 0) {
          setSelectedProject(data[0].id);
          setBranch(data[0].defaultBranch);
        } else if (projectId) {
          const project = data.find((p) => p.id === projectId);
          if (project) {
            setBranch(project.defaultBranch);
          }
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, [projectId]);

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    const project = projects.find((p) => p.id === value);
    if (project) {
      setBranch(project.defaultBranch);
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
            <Input
              id="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
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
