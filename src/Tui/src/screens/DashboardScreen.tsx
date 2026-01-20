import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { Build, BuildStatus } from '../types.js';
import { hubConnected, onBuildCompleted, onBuildStatusUpdated } from '../signalr.js';

const runningStatuses: BuildStatus[] = ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'];

type DashboardScreenProps = {
  api: ApiClient;
  isActive: boolean;
  onOpenBuild?: (id: string) => void;
};

export function DashboardScreen({ api, isActive, onOpenBuild }: DashboardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalBuilds: 0,
    successfulBuilds: 0,
    failedBuilds: 0,
    runningBuilds: 0,
  });
  const [runningBuilds, setRunningBuilds] = useState<Build[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projects, builds] = await Promise.all([
        api.getProjects(),
        api.getBuilds(undefined, 1, 100),
      ]);

      const running = builds.data.filter((b) => runningStatuses.includes(b.status));

      setStats({
        totalProjects: projects.length,
        totalBuilds: builds.totalCount,
        successfulBuilds: builds.data.filter((b) => b.status === 'Success').length,
        failedBuilds: builds.data.filter((b) => b.status === 'Failed').length,
        runningBuilds: running.length,
      });
      setRunningBuilds(running);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) return;
    void fetchData();
  }, [fetchData, isActive]);

  useEffect(() => {
    if (!isActive) return;

    const unsubscribeStatus = onBuildStatusUpdated(() => {
      void fetchData();
    });

    const unsubscribeCompleted = onBuildCompleted(() => {
      void fetchData();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCompleted();
    };
  }, [fetchData, isActive]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (!hubConnected()) {
        void fetchData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData, isActive]);

  useInput((input, key) => {
    if (!isActive) return;

    if (input === 'r') {
      void fetchData();
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(runningBuilds.length - 1, prev + 1));
    }

    if (key.return && runningBuilds[selectedIndex] && onOpenBuild) {
      onOpenBuild(runningBuilds[selectedIndex].id);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Dashboard</Text>

      {loading && <Text color="yellow">Loading stats...</Text>}
      {error && <Text color="red">{error}</Text>}

      {!loading && !error && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" gap={3}>
            <Text>Total Projects: {stats.totalProjects}</Text>
            <Text>Total Builds: {stats.totalBuilds}</Text>
            <Text color="green">Successful: {stats.successfulBuilds}</Text>
            <Text color="red">Failed: {stats.failedBuilds}</Text>
            <Text color={stats.runningBuilds > 0 ? 'cyan' : undefined}>Running: {stats.runningBuilds}</Text>
          </Box>

          <Box flexDirection="column">
            <Text bold>Running Builds</Text>
            {runningBuilds.length === 0 && (
              <Text dimColor>No active builds.</Text>
            )}
            {runningBuilds.map((build, index) => {
              const selected = index === selectedIndex;
              return (
                <Text key={build.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
                  {selected ? '>' : ' '} {build.projectName} #{build.buildNumber} · {build.branch} · {build.status}
                </Text>
              );
            })}
          </Box>

          <Text dimColor>Enter to open build, r to refresh.</Text>
        </Box>
      )}
    </Box>
  );
}
