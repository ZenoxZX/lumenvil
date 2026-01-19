import { ConfigStore } from '../config.js';
import {
  AuthResponse,
  Build,
  BuildDetail,
  BuildPipelineDetail,
  BuildProcess,
  BuildPipeline,
  BuildTemplate,
  CreateBuildTemplateRequest,
  CreateBuildRequest,
  CreatePipelineRequest,
  CreateProcessRequest,
  CreateProjectRequest,
  CreateUserRequest,
  CleanupResult,
  CleanupSettings,
  DiskSpaceInfo,
  PaginatedResponse,
  PipelineScripts,
  PlatformInfo,
  ProcessTypeInfo,
  Project,
  NotificationSettings,
  NotificationChannel,
  UpdateNotificationSettingsRequest,
  UpdateBuildTemplateRequest,
  UpdatePipelineRequest,
  UpdateProcessRequest,
  UpdateProjectRequest,
  UpdateRoleRequest,
  SteamSettings,
  UpdateSteamSettingsRequest,
  User,
} from '../types.js';

export class ApiClient {
  private configStore: ConfigStore;

  constructor(configStore: ConfigStore) {
    this.configStore = configStore;
  }

  private get apiBase() {
    return this.configStore.get().apiBase;
  }

  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (typeof fetch !== 'function') {
      throw new Error('fetch is not available; use Node 18+ or add a fetch polyfill.');
    }

    const token = this.configStore.get().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.apiBase}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    }

    if (response.status === 401) {
      this.configStore.clearAuth();
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      let errorMessage = `Server error (${response.status})`;
      try {
        const error = await response.json();
        errorMessage = error.message || error.title || errorMessage;
      } catch {
        // Response body is not JSON or empty.
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const auth = await this.fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.configStore.update({ token: auth.token, user: auth.user });
    return auth;
  }

  async getCurrentUser(): Promise<User> {
    return this.fetchApi<User>('/auth/me');
  }

  async getProjects(): Promise<Project[]> {
    return this.fetchApi<Project[]>('/project');
  }

  async getProject(id: string): Promise<Project> {
    return this.fetchApi<Project>(`/project/${id}`);
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.fetchApi<Project>('/project', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
    return this.fetchApi<Project>(`/project/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.fetchApi<void>(`/project/${id}`, {
      method: 'DELETE',
    });
  }

  async getBuilds(projectId?: string, page = 1, pageSize = 20): Promise<PaginatedResponse<Build>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (projectId) {
      params.set('projectId', projectId);
    }
    return this.fetchApi<PaginatedResponse<Build>>(`/build?${params}`);
  }

  async getBuild(id: string): Promise<BuildDetail> {
    return this.fetchApi<BuildDetail>(`/build/${id}`);
  }

  async createBuild(data: CreateBuildRequest): Promise<Build> {
    return this.fetchApi<Build>('/build', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelBuild(id: string): Promise<void> {
    return this.fetchApi<void>(`/build/${id}/cancel`, {
      method: 'POST',
    });
  }

  async triggerBuildUpload(id: string): Promise<{ message: string; buildId?: string }> {
    return this.fetchApi<{ message: string; buildId?: string }>(`/build/${id}/upload`, {
      method: 'POST',
    });
  }

  async getGitBranches(gitUrl: string): Promise<{ branches: string[] }> {
    const params = new URLSearchParams({ gitUrl });
    return this.fetchApi<{ branches: string[] }>(`/git/branches?${params}`);
  }

  async getSteamSettings(): Promise<SteamSettings> {
    return this.fetchApi<SteamSettings>('/settings/steam');
  }

  async updateSteamSettings(data: UpdateSteamSettingsRequest): Promise<SteamSettings> {
    return this.fetchApi<SteamSettings>('/settings/steam', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testSteamConnection(): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>('/settings/steam/test', {
      method: 'POST',
    });
  }

  async getPlatforms(): Promise<PlatformInfo[]> {
    return this.fetchApi<PlatformInfo[]>('/settings/platforms');
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    return this.fetchApi<NotificationSettings>('/settings/notifications');
  }

  async updateNotificationSettings(data: UpdateNotificationSettingsRequest): Promise<NotificationSettings> {
    return this.fetchApi<NotificationSettings>('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testNotificationChannel(channel: NotificationChannel): Promise<{ message: string }> {
    return this.fetchApi<{ message: string }>(`/settings/notifications/test/${channel}`, {
      method: 'POST',
    });
  }

  async getCleanupSettings(): Promise<CleanupSettings> {
    return this.fetchApi<CleanupSettings>('/settings/cleanup');
  }

  async updateCleanupSettings(data: CleanupSettings): Promise<CleanupSettings> {
    return this.fetchApi<CleanupSettings>('/settings/cleanup', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async runCleanup(): Promise<CleanupResult> {
    return this.fetchApi<CleanupResult>('/settings/cleanup/run', {
      method: 'POST',
    });
  }

  async getDiskSpace(): Promise<DiskSpaceInfo> {
    return this.fetchApi<DiskSpaceInfo>('/settings/disk');
  }

  async getBuildTemplates(projectId?: string): Promise<BuildTemplate[]> {
    const params = projectId ? `?projectId=${projectId}` : '';
    return this.fetchApi<BuildTemplate[]>(`/buildtemplate${params}`);
  }

  async createBuildTemplate(data: CreateBuildTemplateRequest): Promise<BuildTemplate> {
    return this.fetchApi<BuildTemplate>('/buildtemplate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBuildTemplate(id: string, data: UpdateBuildTemplateRequest): Promise<BuildTemplate> {
    return this.fetchApi<BuildTemplate>(`/buildtemplate/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBuildTemplate(id: string): Promise<void> {
    return this.fetchApi<void>(`/buildtemplate/${id}`, {
      method: 'DELETE',
    });
  }

  async getPipelines(projectId?: string): Promise<BuildPipeline[]> {
    const params = projectId ? `?projectId=${projectId}` : '';
    return this.fetchApi<BuildPipeline[]>(`/pipeline${params}`);
  }

  async getPipeline(id: string): Promise<BuildPipelineDetail> {
    return this.fetchApi<BuildPipelineDetail>(`/pipeline/${id}`);
  }

  async createPipeline(data: CreatePipelineRequest): Promise<BuildPipeline> {
    return this.fetchApi<BuildPipeline>('/pipeline', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePipeline(id: string, data: UpdatePipelineRequest): Promise<BuildPipeline> {
    return this.fetchApi<BuildPipeline>(`/pipeline/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePipeline(id: string): Promise<void> {
    return this.fetchApi<void>(`/pipeline/${id}`, {
      method: 'DELETE',
    });
  }

  async addProcess(pipelineId: string, data: CreateProcessRequest): Promise<BuildProcess> {
    return this.fetchApi<BuildProcess>(`/pipeline/${pipelineId}/process`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProcess(
    pipelineId: string,
    processId: string,
    data: UpdateProcessRequest
  ): Promise<BuildProcess> {
    return this.fetchApi<BuildProcess>(`/pipeline/${pipelineId}/process/${processId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProcess(pipelineId: string, processId: string): Promise<void> {
    return this.fetchApi<void>(`/pipeline/${pipelineId}/process/${processId}`, {
      method: 'DELETE',
    });
  }

  async reorderProcesses(pipelineId: string, processIds: string[]): Promise<void> {
    return this.fetchApi<void>(`/pipeline/${pipelineId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ processIds }),
    });
  }

  async getProcessTypes(): Promise<ProcessTypeInfo[]> {
    return this.fetchApi<ProcessTypeInfo[]>('/pipeline/types');
  }

  async getPipelineScripts(pipelineId: string): Promise<PipelineScripts> {
    return this.fetchApi<PipelineScripts>(`/pipeline/${pipelineId}/scripts`);
  }

  async getUsers(): Promise<User[]> {
    return this.fetchApi<User[]>('/user');
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    return this.fetchApi<User>('/user', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUserRole(id: string, data: UpdateRoleRequest): Promise<User> {
    return this.fetchApi<User>(`/user/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.fetchApi<void>(`/user/${id}`, {
      method: 'DELETE',
    });
  }
}
