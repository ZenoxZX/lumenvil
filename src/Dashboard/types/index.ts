export type UserRole = 'Viewer' | 'Developer' | 'Admin';

export type BuildStatus =
  | 'Queued'
  | 'Cloning'
  | 'Building'
  | 'Packaging'
  | 'Uploading'
  | 'Success'
  | 'Failed'
  | 'Cancelled';

export type ScriptingBackend = 'Mono' | 'IL2CPP';

export type LogLevel = 'Info' | 'Warning' | 'Error';

export type BuildStage = 'Clone' | 'Build' | 'Package' | 'Upload';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  gitUrl?: string;
  defaultBranch: string;
  unityVersion: string;
  buildPath: string;
  steamAppId?: string;
  steamDepotId?: string;
  isActive: boolean;
  createdAt: string;
  totalBuilds: number;
  successfulBuilds: number;
}

export interface Build {
  id: string;
  projectId: string;
  projectName: string;
  buildNumber: number;
  branch: string;
  commitHash?: string;
  scriptingBackend: ScriptingBackend;
  buildTarget: string;
  status: BuildStatus;
  startedAt?: string;
  completedAt?: string;
  outputPath?: string;
  buildSize?: number;
  steamBranch?: string;
  steamUploadStatus?: string;
  errorMessage?: string;
  triggeredByUsername?: string;
  createdAt: string;
}

export interface BuildLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  stage: BuildStage;
}

export interface BuildDetail {
  build: Build;
  logs: BuildLog[];
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateBuildRequest {
  projectId: string;
  branch?: string;
  scriptingBackend: ScriptingBackend;
  steamBranch?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  gitUrl?: string;
  defaultBranch: string;
  unityVersion: string;
  buildPath: string;
  steamAppId?: string;
  steamDepotId?: string;
}
