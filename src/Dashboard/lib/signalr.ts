'use client';

import * as signalR from '@microsoft/signalr';
import { getToken } from './auth';
import { BuildLog, BuildStatus } from '@/types';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:5000/hubs/build';

let connection: signalR.HubConnection | null = null;
let connectionPromise: Promise<void> | null = null;

export interface BuildProgressEvent {
  buildId: string;
  stage: string;
  progress: number;
  message: string;
}

export interface BuildStatusEvent {
  buildId: string;
  status: BuildStatus;
  errorMessage?: string;
}

export interface BuildLogEvent {
  buildId: string;
  log: BuildLog;
}

export interface BuildCompletedEvent {
  buildId: string;
  success: boolean;
  outputPath?: string;
  buildSize?: number;
}

type EventCallback<T> = (data: T) => void;

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

export async function connectToHub(): Promise<void> {
  // Already connected
  if (connection?.state === signalR.HubConnectionState.Connected) {
    return;
  }

  // Connection in progress - wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  const token = getToken();

  // Stop existing connection if any
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // Ignore stop errors
    }
    connection = null;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token || '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on('BuildProgress', (data: BuildProgressEvent) => {
    eventCallbacks.buildProgress.forEach((cb) => cb(data));
  });

  connection.on('BuildStatusUpdated', (data: BuildStatusEvent) => {
    eventCallbacks.buildStatusUpdated.forEach((cb) => cb(data));
  });

  connection.on('BuildLogAdded', (data: BuildLogEvent) => {
    eventCallbacks.buildLogAdded.forEach((cb) => cb(data));
  });

  connection.on('BuildCompleted', (data: BuildCompletedEvent) => {
    eventCallbacks.buildCompleted.forEach((cb) => cb(data));
  });

  connection.onreconnecting(() => {
    console.log('SignalR reconnecting...');
  });

  connection.onreconnected(() => {
    console.log('SignalR reconnected');
  });

  connection.onclose(() => {
    console.log('SignalR connection closed');
    connectionPromise = null;
  });

  connectionPromise = connection.start().then(() => {
    console.log('SignalR connected');
    connectionPromise = null;
  }).catch((err) => {
    console.warn('SignalR connection failed (backend may be offline):', err.message || err);
    connectionPromise = null;
    // Don't throw - allow the app to work without real-time updates
  });

  return connectionPromise;
}

export async function disconnectFromHub(): Promise<void> {
  connectionPromise = null;
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // Ignore stop errors
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
