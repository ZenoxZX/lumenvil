'use client';

import { useEffect, useState } from 'react';
import { BuildTemplate, Project, ScriptingBackend } from '@/types';
import {
  getBuildTemplates,
  createBuildTemplate,
  updateBuildTemplate,
  deleteBuildTemplate,
  getProjects,
} from '@/lib/api';
import { hasRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  FileCode,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Upload,
  GitBranch,
} from 'lucide-react';

interface TemplateFormData {
  name: string;
  description: string;
  projectId: string;
  branch: string;
  scriptingBackend: ScriptingBackend;
  uploadToSteam: boolean;
  steamBranch: string;
  isDefault: boolean;
}

const defaultFormData: TemplateFormData = {
  name: '',
  description: '',
  projectId: '',
  branch: '',
  scriptingBackend: 'IL2CPP',
  uploadToSteam: false,
  steamBranch: '',
  isDefault: false,
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<BuildTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BuildTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<BuildTemplate | null>(null);

  const canManage = mounted && hasRole('Developer');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesData, projectsData] = await Promise.all([
        getBuildTemplates(),
        getProjects(),
      ]);
      setTemplates(templatesData);
      setProjects(projectsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (template: BuildTemplate) => {
    setEditingTemplate(template);
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
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingTemplate) {
        await updateBuildTemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description || undefined,
          branch: formData.branch || undefined,
          scriptingBackend: formData.scriptingBackend,
          uploadToSteam: formData.uploadToSteam,
          steamBranch: formData.steamBranch || undefined,
          isDefault: formData.isDefault,
        });
        toast({ title: 'Template Updated', description: `${formData.name} has been updated` });
      } else {
        await createBuildTemplate({
          name: formData.name,
          description: formData.description || undefined,
          projectId: formData.projectId || undefined,
          branch: formData.branch || undefined,
          scriptingBackend: formData.scriptingBackend,
          uploadToSteam: formData.uploadToSteam,
          steamBranch: formData.steamBranch || undefined,
          isDefault: formData.isDefault,
        });
        toast({ title: 'Template Created', description: `${formData.name} has been created` });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      await deleteBuildTemplate(templateToDelete.id);
      toast({ title: 'Template Deleted', description: `${templateToDelete.name} has been deleted` });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  const globalTemplates = templates.filter((t) => !t.projectId);
  const projectTemplates = templates.filter((t) => t.projectId);

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
            <FileCode className="h-8 w-8" />
            Build Templates
          </h1>
          <p className="text-muted-foreground">
            Predefined build configurations for quick builds
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {/* Global Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Global Templates</CardTitle>
          <CardDescription>Available for all projects</CardDescription>
        </CardHeader>
        <CardContent>
          {globalTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No global templates yet</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {globalTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  canManage={canManage}
                  onEdit={() => openEditDialog(template)}
                  onDelete={() => {
                    setTemplateToDelete(template);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project-specific Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Project Templates</CardTitle>
          <CardDescription>Templates specific to individual projects</CardDescription>
        </CardHeader>
        <CardContent>
          {projectTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No project-specific templates yet</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projectTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  canManage={canManage}
                  onEdit={() => openEditDialog(template)}
                  onDelete={() => {
                    setTemplateToDelete(template);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the template configuration'
                : 'Create a new build template'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Production Build"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="IL2CPP build for Steam release"
                />
              </div>

              {!editingTemplate && (
                <div className="space-y-2">
                  <Label htmlFor="project">Project (Optional)</Label>
                  <Select
                    value={formData.projectId || '__global__'}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value === '__global__' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Global (all projects)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__">Global (all projects)</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="branch">Branch (Optional)</Label>
                <Input
                  id="branch"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="Use project default"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scriptingBackend">Scripting Backend</Label>
                <Select
                  value={formData.scriptingBackend}
                  onValueChange={(value: ScriptingBackend) =>
                    setFormData({ ...formData, scriptingBackend: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IL2CPP">IL2CPP</SelectItem>
                    <SelectItem value="Mono">Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Upload to Steam</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically upload after build
                  </p>
                </div>
                <Switch
                  checked={formData.uploadToSteam}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, uploadToSteam: checked })
                  }
                />
              </div>

              {formData.uploadToSteam && (
                <div className="space-y-2">
                  <Label htmlFor="steamBranch">Steam Branch</Label>
                  <Input
                    id="steamBranch"
                    value={formData.steamBranch}
                    onChange={(e) => setFormData({ ...formData, steamBranch: e.target.value })}
                    placeholder="default"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Default Template</Label>
                  <p className="text-xs text-muted-foreground">
                    Use this template for quick builds
                  </p>
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDefault: checked })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingTemplate ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateCard({
  template,
  canManage,
  onEdit,
  onDelete,
}: {
  template: BuildTemplate;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{template.name}</h3>
            {template.isDefault && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{template.scriptingBackend}</Badge>
        {template.branch && (
          <Badge variant="outline" className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {template.branch}
          </Badge>
        )}
        {template.uploadToSteam && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Upload className="h-3 w-3" />
            Steam
          </Badge>
        )}
      </div>

      {template.projectName && (
        <p className="text-xs text-muted-foreground">Project: {template.projectName}</p>
      )}
    </div>
  );
}
