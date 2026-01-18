import { getToken, clearAuth } from './auth';
import {
  AuthResponse,
  Project,
  Build,
  BuildDetail,
  PaginatedResponse,
  CreateBuildRequest,
  CreateProjectRequest,
  User,
  CreateUserRequest,
  UpdateRoleRequest,
  BuildTemplate,
  CreateBuildTemplateRequest,
  UpdateBuildTemplateRequest,
  CleanupSettings,
  DiskSpaceInfo,
  CleanupResult,
  BuildPipeline,
  BuildPipelineDetail,
  BuildProcess,
  CreatePipelineRequest,
  CreateProcessRequest,
  ProcessTypeInfo,
  PipelineScripts,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new Error('Unable to connect to server. Please check if the backend is running.');
  }

  if (response.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    try {
      const error = await response.json();
      errorMessage = error.message || error.title || errorMessage;
    } catch {
      // Response body is not JSON or empty
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth
export async function login(username: string, password: string): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getCurrentUser() {
  return fetchApi<AuthResponse['user']>('/auth/me');
}

// Projects
export async function getProjects(): Promise<Project[]> {
  return fetchApi<Project[]>('/project');
}

export async function getProject(id: string): Promise<Project> {
  return fetchApi<Project>(`/project/${id}`);
}

export async function createProject(data: CreateProjectRequest): Promise<Project> {
  return fetchApi<Project>('/project', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Partial<CreateProjectRequest>): Promise<Project> {
  return fetchApi<Project>(`/project/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<void> {
  return fetchApi<void>(`/project/${id}`, {
    method: 'DELETE',
  });
}

// Builds
export async function getBuilds(
  projectId?: string,
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<Build>> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  if (projectId) {
    params.set('projectId', projectId);
  }
  return fetchApi<PaginatedResponse<Build>>(`/build?${params}`);
}

export async function getBuild(id: string): Promise<BuildDetail> {
  return fetchApi<BuildDetail>(`/build/${id}`);
}

export async function createBuild(data: CreateBuildRequest): Promise<Build> {
  return fetchApi<Build>('/build', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelBuild(id: string): Promise<void> {
  return fetchApi<void>(`/build/${id}/cancel`, {
    method: 'POST',
  });
}

export async function triggerBuildUpload(id: string): Promise<{ message: string; buildId?: string }> {
  return fetchApi<{ message: string; buildId?: string }>(`/build/${id}/upload`, {
    method: 'POST',
  });
}

// Git
export interface GitBranchesResponse {
  branches: string[];
}

export interface GitValidateResponse {
  valid: boolean;
}

export async function getGitBranches(gitUrl: string): Promise<GitBranchesResponse> {
  const params = new URLSearchParams({ gitUrl });
  return fetchApi<GitBranchesResponse>(`/git/branches?${params}`);
}

export async function validateGitRepository(gitUrl: string): Promise<GitValidateResponse> {
  const params = new URLSearchParams({ gitUrl });
  return fetchApi<GitValidateResponse>(`/git/validate?${params}`);
}

// Users
export async function getUsers(): Promise<User[]> {
  return fetchApi<User[]>('/user');
}

export async function createUser(data: CreateUserRequest): Promise<User> {
  return fetchApi<User>('/user', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUserRole(id: string, data: UpdateRoleRequest): Promise<User> {
  return fetchApi<User>(`/user/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string): Promise<void> {
  return fetchApi<void>(`/user/${id}`, {
    method: 'DELETE',
  });
}

// Settings
export interface SteamSettings {
  username: string | null;
  hasPassword: boolean;
  steamCmdPath: string | null;
  defaultBranch: string | null;
  isConfigured: boolean;
}

export interface UpdateSteamSettingsRequest {
  username: string | null;
  password: string | null;
  steamCmdPath: string | null;
  defaultBranch: string | null;
}

export interface PlatformInfo {
  type: string;
  name: string;
  isImplemented: boolean;
}

export async function getSteamSettings(): Promise<SteamSettings> {
  return fetchApi<SteamSettings>('/settings/steam');
}

export async function updateSteamSettings(data: UpdateSteamSettingsRequest): Promise<SteamSettings> {
  return fetchApi<SteamSettings>('/settings/steam', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function testSteamConnection(): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/settings/steam/test', {
    method: 'POST',
  });
}

export async function getPlatforms(): Promise<PlatformInfo[]> {
  return fetchApi<PlatformInfo[]>('/settings/platforms');
}

// Notifications
export type NotificationEvent =
  | 'BuildStarted'
  | 'BuildCompleted'
  | 'BuildFailed'
  | 'BuildCancelled'
  | 'UploadCompleted'
  | 'UploadFailed';

export type NotificationChannel = 'Discord' | 'Slack' | 'Webhook';

export interface DiscordSettings {
  enabled: boolean;
  webhookUrl: string | null;
  events: NotificationEvent[];
}

export interface SlackSettings {
  enabled: boolean;
  webhookUrl: string | null;
  events: NotificationEvent[];
}

export interface WebhookSettings {
  enabled: boolean;
  url: string | null;
  hasSecret: boolean;
  events: NotificationEvent[];
}

export interface NotificationSettings {
  discord: DiscordSettings;
  slack: SlackSettings;
  webhook: WebhookSettings;
}

export interface UpdateDiscordSettings {
  enabled: boolean;
  webhookUrl?: string | null;
  events?: NotificationEvent[];
}

export interface UpdateSlackSettings {
  enabled: boolean;
  webhookUrl?: string | null;
  events?: NotificationEvent[];
}

export interface UpdateWebhookSettings {
  enabled: boolean;
  url?: string | null;
  secret?: string | null;
  events?: NotificationEvent[];
}

export interface UpdateNotificationSettingsRequest {
  discord?: UpdateDiscordSettings;
  slack?: UpdateSlackSettings;
  webhook?: UpdateWebhookSettings;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return fetchApi<NotificationSettings>('/settings/notifications');
}

export async function updateNotificationSettings(
  data: UpdateNotificationSettingsRequest
): Promise<NotificationSettings> {
  return fetchApi<NotificationSettings>('/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function testNotificationChannel(
  channel: NotificationChannel
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/settings/notifications/test/${channel}`, {
    method: 'POST',
  });
}

// Build Templates
export async function getBuildTemplates(projectId?: string): Promise<BuildTemplate[]> {
  const params = projectId ? `?projectId=${projectId}` : '';
  return fetchApi<BuildTemplate[]>(`/buildtemplate${params}`);
}

export async function getBuildTemplate(id: string): Promise<BuildTemplate> {
  return fetchApi<BuildTemplate>(`/buildtemplate/${id}`);
}

export async function createBuildTemplate(data: CreateBuildTemplateRequest): Promise<BuildTemplate> {
  return fetchApi<BuildTemplate>('/buildtemplate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBuildTemplate(id: string, data: UpdateBuildTemplateRequest): Promise<BuildTemplate> {
  return fetchApi<BuildTemplate>(`/buildtemplate/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteBuildTemplate(id: string): Promise<void> {
  return fetchApi<void>(`/buildtemplate/${id}`, {
    method: 'DELETE',
  });
}

// Cleanup Settings
export async function getCleanupSettings(): Promise<CleanupSettings> {
  return fetchApi<CleanupSettings>('/settings/cleanup');
}

export async function updateCleanupSettings(data: CleanupSettings): Promise<CleanupSettings> {
  return fetchApi<CleanupSettings>('/settings/cleanup', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function runCleanup(): Promise<CleanupResult> {
  return fetchApi<CleanupResult>('/settings/cleanup/run', {
    method: 'POST',
  });
}

export async function getDiskSpace(): Promise<DiskSpaceInfo> {
  return fetchApi<DiskSpaceInfo>('/settings/disk');
}

// Build Pipelines
export async function getPipelines(projectId?: string): Promise<BuildPipeline[]> {
  const params = projectId ? `?projectId=${projectId}` : '';
  return fetchApi<BuildPipeline[]>(`/pipeline${params}`);
}

export async function getPipeline(id: string): Promise<BuildPipelineDetail> {
  return fetchApi<BuildPipelineDetail>(`/pipeline/${id}`);
}

export async function createPipeline(data: CreatePipelineRequest): Promise<BuildPipeline> {
  return fetchApi<BuildPipeline>('/pipeline', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePipeline(
  id: string,
  data: Partial<CreatePipelineRequest & { isActive?: boolean }>
): Promise<BuildPipeline> {
  return fetchApi<BuildPipeline>(`/pipeline/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePipeline(id: string): Promise<void> {
  return fetchApi<void>(`/pipeline/${id}`, {
    method: 'DELETE',
  });
}

// Pipeline Processes
export async function addProcess(pipelineId: string, data: CreateProcessRequest): Promise<BuildProcess> {
  return fetchApi<BuildProcess>(`/pipeline/${pipelineId}/process`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProcess(
  pipelineId: string,
  processId: string,
  data: Partial<CreateProcessRequest & { isEnabled?: boolean }>
): Promise<BuildProcess> {
  return fetchApi<BuildProcess>(`/pipeline/${pipelineId}/process/${processId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProcess(pipelineId: string, processId: string): Promise<void> {
  return fetchApi<void>(`/pipeline/${pipelineId}/process/${processId}`, {
    method: 'DELETE',
  });
}

export async function reorderProcesses(pipelineId: string, processIds: string[]): Promise<void> {
  return fetchApi<void>(`/pipeline/${pipelineId}/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ processIds }),
  });
}

export async function getProcessTypes(): Promise<ProcessTypeInfo[]> {
  return fetchApi<ProcessTypeInfo[]>('/pipeline/types');
}

export async function getPipelineScripts(pipelineId: string): Promise<PipelineScripts> {
  return fetchApi<PipelineScripts>(`/pipeline/${pipelineId}/scripts`);
}
