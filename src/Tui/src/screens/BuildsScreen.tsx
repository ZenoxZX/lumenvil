import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { Build, BuildStatus, PaginatedResponse } from '../types.js';
import { formatDateTime } from '../utils/format.js';
import { hubConnected, onBuildCompleted, onBuildStatusUpdated } from '../signalr.js';

const statusColor: Partial<Record<BuildStatus, string>> = {
  Success: 'green',
  Failed: 'red',
  Cancelled: 'yellow',
  Queued: 'cyan',
  Cloning: 'cyan',
  Building: 'cyan',
  Packaging: 'cyan',
  Uploading: 'cyan',
};

type BuildsScreenProps = {
  api: ApiClient;
  isActive: boolean;
  onOpenBuild: (id: string) => void;
};

export function BuildsScreen({ api, isActive, onOpenBuild }: BuildsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<PaginatedResponse<Build>>({
    data: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fetchBuilds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBuilds(undefined, page, 20);
      setResponse(data);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load builds.');
    } finally {
      setLoading(false);
    }
  }, [api, page]);

  useEffect(() => {
    if (!isActive) return;
    void fetchBuilds();
  }, [fetchBuilds, isActive]);

  useEffect(() => {
    if (!isActive) return;

    const unsubscribeStatus = onBuildStatusUpdated((event) => {
      setResponse((prev) => ({
        ...prev,
        data: prev.data.map((build) =>
          build.id === event.buildId
            ? { ...build, status: event.status, errorMessage: event.errorMessage }
            : build
        ),
      }));
    });

    const unsubscribeCompleted = onBuildCompleted((event) => {
      setResponse((prev) => ({
        ...prev,
        data: prev.data.map((build) =>
          build.id === event.buildId
            ? {
                ...build,
                status: event.success ? 'Success' : 'Failed',
                outputPath: event.outputPath,
                buildSize: event.buildSize,
                completedAt: new Date().toISOString(),
              }
            : build
        ),
      }));
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCompleted();
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (!hubConnected()) {
        void fetchBuilds();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchBuilds, isActive]);

  const selectedBuild = useMemo(() => response.data[selectedIndex], [response.data, selectedIndex]);

  useInput((input, key) => {
    if (!isActive) return;

    if (input === 'r') {
      void fetchBuilds();
    }

    if (input === 'n' && page < response.totalPages) {
      setPage((prev) => prev + 1);
    }

    if (input === 'p' && page > 1) {
      setPage((prev) => prev - 1);
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(response.data.length - 1, prev + 1));
    }

    if (key.return && selectedBuild) {
      onOpenBuild(selectedBuild.id);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Builds</Text>

      {loading && <Text color="yellow">Loading builds...</Text>}
      {error && <Text color="red">{error}</Text>}

      {!loading && !error && response.data.length === 0 && (
        <Text dimColor>No builds yet.</Text>
      )}

      {!loading && !error && response.data.length > 0 && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            {response.data.map((build, index) => {
              const selected = index === selectedIndex;
              const color = statusColor[build.status] || undefined;
              return (
                <Text
                  key={build.id}
                  color={selected ? 'black' : color}
                  backgroundColor={selected ? 'cyan' : undefined}
                >
                  {selected ? '>' : ' '} {build.projectName} #{build.buildNumber} · {build.branch} · {build.status} · {formatDateTime(build.createdAt)}
                </Text>
              );
            })}
          </Box>

          <Text dimColor>
            Page {response.page} of {response.totalPages} · Enter to open · n/p to page · r to refresh
          </Text>
        </Box>
      )}
    </Box>
  );
}
