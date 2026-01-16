import { getToken, clearAuth } from './auth';
import {
  AuthResponse,
  Project,
  Build,
  BuildDetail,
  PaginatedResponse,
  CreateBuildRequest,
  CreateProjectRequest,
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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
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
