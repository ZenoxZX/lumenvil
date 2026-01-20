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

export type NotificationEvent =
  | 'BuildStarted'
  | 'BuildCompleted'
  | 'BuildFailed'
  | 'BuildCancelled'
  | 'UploadCompleted'
  | 'UploadFailed';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole | number;
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
  notificationSettings?: ProjectNotificationSettings;
}

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
  pipelineId?: string;
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

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  gitUrl?: string;
  defaultBranch?: string;
  unityVersion?: string;
  buildPath?: string;
  steamAppId?: string;
  steamDepotId?: string;
  isActive?: boolean;
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

export interface BuildPipeline {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  isDefault: boolean;
  isActive: boolean;
  processCount: number;
  createdAt: string;
  createdByUsername?: string;
}

export type ProcessType =
  | 'DefineSymbols'
  | 'PlayerSettings'
  | 'SceneList'
  | 'CustomCode'
  | 'ShellCommand'
  | 'FileCopy'
  | 'AssetSettings';

export type BuildPhase = 'PreBuild' | 'PostBuild';

export interface BuildPipelineDetail {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  isDefault: boolean;
  isActive: boolean;
  processes: BuildProcess[];
  createdAt: string;
  updatedAt?: string;
  createdByUsername?: string;
}

export interface BuildProcess {
  id: string;
  pipelineId: string;
  name: string;
  type: ProcessType;
  phase: BuildPhase;
  order: number;
  configuration: Record<string, unknown>;
  isEnabled: boolean;
  createdAt: string;
}

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  projectId?: string;
  isDefault?: boolean;
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CreateProcessRequest {
  name: string;
  type: ProcessType;
  phase: BuildPhase;
  order: number;
  configuration: Record<string, unknown>;
}

export interface UpdateProcessRequest {
  name?: string;
  phase?: BuildPhase;
  order?: number;
  configuration?: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface ProcessTypeInfo {
  type: ProcessType;
  name: string;
  description: string;
  defaultPhase: BuildPhase;
  defaultConfiguration: Record<string, unknown>;
}

export interface PipelineScripts {
  pipelineId: string;
  pipelineName: string;
  hasScripts: boolean;
  preBuildScript?: string;
  postBuildScript?: string;
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
