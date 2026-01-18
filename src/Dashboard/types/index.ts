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
  role: UserRole | number;  // Backend sends as number (0=Viewer, 1=Developer, 2=Admin)
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type NotificationEvent =
  | 'BuildStarted'
  | 'BuildCompleted'
  | 'BuildFailed'
  | 'BuildCancelled'
  | 'UploadCompleted'
  | 'UploadFailed';

export interface ProjectNotificationSettings {
  useGlobalSettings: boolean;
  discord?: {
    enabled: boolean;
    webhookUrl?: string;
    events?: NotificationEvent[];
  };
  slack?: {
    enabled: boolean;
    webhookUrl?: string;
    events?: NotificationEvent[];
  };
  webhook?: {
    enabled: boolean;
    url?: string;
    hasSecret?: boolean;
    events?: NotificationEvent[];
  };
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
  notificationSettings?: ProjectNotificationSettings;
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
  uploadToSteam: boolean;
  steamBranch?: string;
  steamUploadStatus?: string;
  steamBuildId?: string;
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
  uploadToSteam?: boolean;
  steamBranch?: string;
  templateId?: string;
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
  notificationSettings?: {
    useGlobalSettings: boolean;
    discord?: {
      enabled: boolean;
      webhookUrl?: string;
      events?: NotificationEvent[];
    };
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      events?: NotificationEvent[];
    };
    webhook?: {
      enabled: boolean;
      url?: string;
      secret?: string;
      events?: NotificationEvent[];
    };
  };
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateRoleRequest {
  role: UserRole;
}

// Build Templates
export interface BuildTemplate {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  branch?: string;
  scriptingBackend: ScriptingBackend;
  uploadToSteam: boolean;
  steamBranch?: string;
  isDefault: boolean;
  createdAt: string;
  createdByUsername?: string;
}

export interface CreateBuildTemplateRequest {
  name: string;
  description?: string;
  projectId?: string;
  branch?: string;
  scriptingBackend: ScriptingBackend;
  uploadToSteam: boolean;
  steamBranch?: string;
  isDefault?: boolean;
}

export interface UpdateBuildTemplateRequest {
  name?: string;
  description?: string;
  branch?: string;
  scriptingBackend?: ScriptingBackend;
  uploadToSteam?: boolean;
  steamBranch?: string;
  isDefault?: boolean;
}

// Build Cleanup
export interface CleanupSettings {
  enabled: boolean;
  maxBuildsPerProject: number;
  maxBuildAgeDays: number;
  minFreeDiskSpaceGB: number;
  cleanupStatuses: BuildStatus[];
  scheduledHour: number;
  keepSteamUploads: boolean;
}

export interface DiskSpaceInfo {
  drivePath: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freePercentage: number;
  usedPercentage: number;
  totalFormatted: string;
  freeFormatted: string;
  usedFormatted: string;
}

export interface CleanupResult {
  buildsDeleted: number;
  spaceFreedBytes: number;
  spaceFreedFormatted: string;
  deletedBuilds: string[];
  errors: string[];
  executedAt: string;
}
