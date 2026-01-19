import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { BuildDetail, BuildLog, BuildStatus } from '../types.js';
import { formatBytes, formatDateTime, formatDuration } from '../utils/format.js';
import {
  hubConnected,
  joinBuildGroup,
  leaveBuildGroup,
  onBuildCompleted,
  onBuildLogAdded,
  onBuildProgress,
  onBuildStatusUpdated,
} from '../signalr.js';

const runningStatuses: BuildStatus[] = ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'];

const logLines = 10;

type BuildDetailScreenProps = {
  api: ApiClient;
  buildId: string;
  isActive: boolean;
  onBack: () => void;
};

export function BuildDetailScreen({ api, buildId, isActive, onBack }: BuildDetailScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BuildDetail | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [logOffset, setLogOffset] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const data = await api.getBuild(buildId);
      setDetail(data);
      setLogOffset(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load build.');
    } finally {
      setLoading(false);
    }
  }, [api, buildId]);

  useEffect(() => {
    if (!isActive) return;
    void fetchDetail();
  }, [fetchDetail, isActive]);

  useEffect(() => {
    if (!isActive) return;

    void joinBuildGroup(buildId);

    const unsubscribeStatus = onBuildStatusUpdated((event) => {
      if (event.buildId !== buildId) return;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              build: {
                ...prev.build,
                status: event.status,
                errorMessage: event.errorMessage ?? prev.build.errorMessage,
              },
            }
          : prev
      );
    });

    const unsubscribeLog = onBuildLogAdded((event) => {
      if (event.buildId !== buildId) return;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              logs: [...prev.logs, event.log],
            }
          : prev
      );
    });

    const unsubscribeCompleted = onBuildCompleted((event) => {
      if (event.buildId !== buildId) return;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              build: {
                ...prev.build,
                status: event.success ? 'Success' : 'Failed',
                outputPath: event.outputPath ?? prev.build.outputPath,
                buildSize: event.buildSize ?? prev.build.buildSize,
                completedAt: new Date().toISOString(),
              },
            }
          : prev
      );
    });

    const unsubscribeProgress = onBuildProgress((event) => {
      if (event.buildId !== buildId) return;
      setProgressMessage(event.message);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLog();
      unsubscribeCompleted();
      unsubscribeProgress();
      void leaveBuildGroup(buildId);
    };
  }, [buildId, isActive]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (!hubConnected()) {
        void fetchDetail();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchDetail, isActive]);

  const logs = detail?.logs ?? ([] as BuildLog[]);
  const visibleLogs = useMemo(() => {
    const end = Math.max(0, logs.length - logOffset);
    const start = Math.max(0, end - logLines);
    return logs.slice(start, end);
  }, [logs, logOffset]);

  const build = detail?.build;
  const isRunning = build ? runningStatuses.includes(build.status) : false;

  const handleCancel = async () => {
    if (!build) return;
    setActionMessage('Cancelling build...');
    try {
      await api.cancelBuild(build.id);
      setActionMessage('Build cancellation requested.');
      await fetchDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to cancel build.');
    }
  };

  const handleUpload = async () => {
    if (!build) return;
    setActionMessage('Triggering upload...');
    try {
      const result = await api.triggerBuildUpload(build.id);
      setActionMessage(result.message);
      await fetchDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to upload build.');
    }
  };

  useInput((input, key) => {
    if (!isActive) return;

    if (input === 'r') {
      void fetchDetail();
      return;
    }

    if (input === '[') {
      setLogOffset((prev) => Math.min(prev + logLines, Math.max(0, logs.length - logLines)));
      return;
    }

    if (input === ']') {
      setLogOffset((prev) => Math.max(0, prev - logLines));
      return;
    }

    if (input === 'c' && isRunning) {
      void handleCancel();
      return;
    }

    if (input === 'u' && build && build.status === 'Success') {
      void handleUpload();
    }

    if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Build Detail</Text>

      {loading && <Text color="yellow">Loading build...</Text>}
      {error && <Text color="red">{error}</Text>}

      {!loading && !error && !build && <Text dimColor>Build not found.</Text>}

      {!loading && !error && build && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            <Text>{build.projectName} #{build.buildNumber}</Text>
            <Text>
              Status: <Text color={build.status === 'Success' ? 'green' : build.status === 'Failed' ? 'red' : 'cyan'}>{build.status}</Text>
            </Text>
            {progressMessage && isRunning && <Text dimColor>Progress: {progressMessage}</Text>}
            <Text>Branch: {build.branch}</Text>
            <Text>Scripting Backend: {build.scriptingBackend}</Text>
            <Text>Created: {formatDateTime(build.createdAt)}</Text>
            <Text>Started: {formatDateTime(build.startedAt)}</Text>
            <Text>Duration: {formatDuration(build.startedAt, build.completedAt)}</Text>
            <Text>Build Size: {formatBytes(build.buildSize)}</Text>
            {build.outputPath && <Text>Output: {build.outputPath}</Text>}
            {build.errorMessage && <Text color="red">Error: {build.errorMessage}</Text>}
          </Box>

          {(build.uploadToSteam || build.steamUploadStatus) && (
            <Box flexDirection="column">
              <Text bold>Steam Upload</Text>
              <Text>Status: {build.steamUploadStatus || (build.uploadToSteam ? 'Pending' : 'Not requested')}</Text>
              <Text>Branch: {build.steamBranch || 'default'}</Text>
              {build.steamBuildId && <Text>Build ID: {build.steamBuildId}</Text>}
            </Box>
          )}

          <Box flexDirection="column">
            <Text bold>Logs (last {logLines})</Text>
            {visibleLogs.length === 0 && <Text dimColor>No logs yet.</Text>}
            {visibleLogs.map((log) => (
              <Text key={log.id}>
                [{log.stage}] {log.level}: {log.message}
              </Text>
            ))}
          </Box>

          <Text dimColor>
            Esc back · r refresh · [ ] scroll logs · c cancel · u upload
          </Text>
          {actionMessage && <Text color="yellow">{actionMessage}</Text>}
        </Box>
      )}
    </Box>
  );
}
