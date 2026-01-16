'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Project } from '@/types';
import { getProject, updateProject, getGitBranches } from '@/lib/api';
import { hasRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitUrl: '',
    defaultBranch: 'main',
    unityVersion: '',
    buildPath: '',
    steamAppId: '',
    steamDepotId: '',
    isActive: true,
  });

  useEffect(() => {
    if (!hasRole('Developer')) {
      router.push('/dashboard/projects');
      return;
    }

    const fetchProject = async () => {
      try {
        const project = await getProject(projectId);
        setFormData({
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

        // Load branches if gitUrl exists
        if (project.gitUrl) {
          await loadBranches(project.gitUrl);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load project',
          variant: 'destructive',
        });
        router.push('/dashboard/projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, router, toast]);

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

  const handleGitUrlChange = async (value: string) => {
    setFormData({ ...formData, gitUrl: value });
    if (value) {
      await loadBranches(value);
    } else {
      setBranches([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await updateProject(projectId, {
        name: formData.name,
        description: formData.description || undefined,
        gitUrl: formData.gitUrl || undefined,
        defaultBranch: formData.defaultBranch,
        unityVersion: formData.unityVersion,
        buildPath: formData.buildPath,
        steamAppId: formData.steamAppId || undefined,
        steamDepotId: formData.steamDepotId || undefined,
      });

      toast({
        title: 'Project Updated',
        description: `${formData.name} has been updated`,
      });

      router.push('/dashboard/projects');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update project',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Project</h1>
          <p className="text-muted-foreground">Update project settings</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Configure project settings and Git repository
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildPath">Build Path *</Label>
              <Input
                id="buildPath"
                value={formData.buildPath}
                onChange={(e) => setFormData({ ...formData, buildPath: e.target.value })}
                placeholder="D:\Projects\MyGame"
                required
              />
              <p className="text-xs text-muted-foreground">
                Local path where the project is located (used if no Git URL)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unityVersion">Unity Version *</Label>
              <Input
                id="unityVersion"
                value={formData.unityVersion}
                onChange={(e) => setFormData({ ...formData, unityVersion: e.target.value })}
                placeholder="2022.3.0f1"
                required
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Git Configuration</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gitUrl">Git Repository URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="gitUrl"
                      value={formData.gitUrl}
                      onChange={(e) => handleGitUrlChange(e.target.value)}
                      placeholder="https://github.com/username/repo.git"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => loadBranches(formData.gitUrl)}
                      disabled={!formData.gitUrl || loadingBranches}
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingBranches ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If provided, the build agent will clone/pull from this repository
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultBranch">Default Branch</Label>
                  {branches.length > 0 ? (
                    <Select
                      value={formData.defaultBranch}
                      onValueChange={(value) => setFormData({ ...formData, defaultBranch: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="defaultBranch"
                      value={formData.defaultBranch}
                      onChange={(e) => setFormData({ ...formData, defaultBranch: e.target.value })}
                      placeholder="main"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Steam Configuration (Optional)</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="steamAppId">Steam App ID</Label>
                  <Input
                    id="steamAppId"
                    value={formData.steamAppId}
                    onChange={(e) => setFormData({ ...formData, steamAppId: e.target.value })}
                    placeholder="480"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="steamDepotId">Steam Depot ID</Label>
                  <Input
                    id="steamDepotId"
                    value={formData.steamDepotId}
                    onChange={(e) => setFormData({ ...formData, steamDepotId: e.target.value })}
                    placeholder="481"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Project Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive projects cannot be built
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/projects')}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
