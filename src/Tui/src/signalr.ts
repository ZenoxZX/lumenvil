import * as signalR from '@microsoft/signalr';
import { ConfigStore } from './config.js';
import { BuildLog, BuildStatus } from './types.js';

type BuildProgressEvent = {
  buildId: string;
  stage: string;
  progress: number;
  message: string;
};

type BuildStatusEvent = {
  buildId: string;
  status: BuildStatus;
  errorMessage?: string;
};

type BuildLogEvent = {
  buildId: string;
  log: BuildLog;
};

type BuildCompletedEvent = {
  buildId: string;
  success: boolean;
  outputPath?: string;
  buildSize?: number;
};

type EventCallback<T> = (data: T) => void;

let connection: signalR.HubConnection | null = null;
let connectionPromise: Promise<void> | null = null;
let isConnected = false;

const eventCallbacks: {
  buildProgress: EventCallback<BuildProgressEvent>[];
  buildStatusUpdated: EventCallback<BuildStatusEvent>[];
  buildLogAdded: EventCallback<BuildLogEvent>[];
  buildCompleted: EventCallback<BuildCompletedEvent>[];
} = {
  buildProgress: [],
  buildStatusUpdated: [],
  buildLogAdded: [],
  buildCompleted: [],
};

const normalizeBuildId = (data: Record<string, unknown>): string => {
  return String(data.buildId ?? data.BuildId ?? data.buildID ?? data.BuildID ?? '');
};

const normalizeBuildLog = (data: Record<string, unknown>): BuildLog => {
  const log = (data.log ?? data.Log ?? {}) as Record<string, unknown>;
  return {
    id: String(log.id ?? log.Id ?? ''),
    timestamp: String(log.timestamp ?? log.Timestamp ?? new Date().toISOString()),
    level: String(log.level ?? log.Level ?? 'Info') as BuildLog['level'],
    message: String(log.message ?? log.Message ?? ''),
    stage: String(log.stage ?? log.Stage ?? 'Build') as BuildLog['stage'],
  };
};

export const hubConnected = () => isConnected && connection?.state === signalR.HubConnectionState.Connected;

export async function connectToHub(configStore: ConfigStore): Promise<void> {
  const { hubUrl, token } = configStore.get();

  if (!hubUrl) return;

  if (connection?.state === signalR.HubConnectionState.Connected) {
    return;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (connection) {
    try {
      await connection.stop();
    } catch {
      // Ignore stop errors.
    }
    connection = null;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => token || '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Error)
    .build();

  connection.on('BuildProgress', (data: Record<string, unknown>) => {
    const payload: BuildProgressEvent = {
      buildId: normalizeBuildId(data),
      stage: String(data.stage ?? data.Stage ?? ''),
      progress: Number(data.progress ?? data.Progress ?? 0),
      message: String(data.message ?? data.Message ?? ''),
    };
    eventCallbacks.buildProgress.forEach((cb) => cb(payload));
  });

  connection.on('BuildStatusUpdated', (data: Record<string, unknown>) => {
    const errorValue = data.errorMessage ?? data.ErrorMessage;
    const payload: BuildStatusEvent = {
      buildId: normalizeBuildId(data),
      status: String(data.status ?? data.Status ?? 'Queued') as BuildStatus,
      errorMessage: errorValue ? String(errorValue) : undefined,
    };
    eventCallbacks.buildStatusUpdated.forEach((cb) => cb(payload));
  });

  connection.on('BuildLogAdded', (data: Record<string, unknown>) => {
    const payload: BuildLogEvent = {
      buildId: normalizeBuildId(data),
      log: normalizeBuildLog(data),
    };
    eventCallbacks.buildLogAdded.forEach((cb) => cb(payload));
  });

  connection.on('BuildCompleted', (data: Record<string, unknown>) => {
    const payload: BuildCompletedEvent = {
      buildId: normalizeBuildId(data),
      success: Boolean(data.success ?? data.Success),
      outputPath: (data.outputPath ?? data.OutputPath) ? String(data.outputPath ?? data.OutputPath) : undefined,
      buildSize: data.buildSize ?? data.BuildSize ? Number(data.buildSize ?? data.BuildSize) : undefined,
    };
    eventCallbacks.buildCompleted.forEach((cb) => cb(payload));
  });

  connection.onreconnected(() => {
    isConnected = true;
  });

  connection.onclose(() => {
    isConnected = false;
    connectionPromise = null;
  });

  connectionPromise = connection
    .start()
    .then(() => {
      isConnected = true;
      connectionPromise = null;
    })
    .catch(() => {
      isConnected = false;
      connectionPromise = null;
    });

  return connectionPromise;
}

export async function disconnectFromHub(): Promise<void> {
  connectionPromise = null;
  isConnected = false;
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // Ignore stop errors.
    }
    connection = null;
  }
}

export function onBuildProgress(callback: EventCallback<BuildProgressEvent>): () => void {
  eventCallbacks.buildProgress.push(callback);
  return () => {
    const index = eventCallbacks.buildProgress.indexOf(callback);
    if (index > -1) eventCallbacks.buildProgress.splice(index, 1);
  };
}

export function onBuildStatusUpdated(callback: EventCallback<BuildStatusEvent>): () => void {
  eventCallbacks.buildStatusUpdated.push(callback);
  return () => {
    const index = eventCallbacks.buildStatusUpdated.indexOf(callback);
    if (index > -1) eventCallbacks.buildStatusUpdated.splice(index, 1);
  };
}

export function onBuildLogAdded(callback: EventCallback<BuildLogEvent>): () => void {
  eventCallbacks.buildLogAdded.push(callback);
  return () => {
    const index = eventCallbacks.buildLogAdded.indexOf(callback);
    if (index > -1) eventCallbacks.buildLogAdded.splice(index, 1);
  };
}

export function onBuildCompleted(callback: EventCallback<BuildCompletedEvent>): () => void {
  eventCallbacks.buildCompleted.push(callback);
  return () => {
    const index = eventCallbacks.buildCompleted.indexOf(callback);
    if (index > -1) eventCallbacks.buildCompleted.splice(index, 1);
  };
}

export async function joinBuildGroup(buildId: string): Promise<void> {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    await connection.invoke('JoinBuildGroup', buildId);
  }
}

export async function leaveBuildGroup(buildId: string): Promise<void> {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    await connection.invoke('LeaveBuildGroup', buildId);
  }
}
