'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Project, Build, BuildStatus } from '@/types';
import { getProjects, getBuilds } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BuildList } from '@/components/BuildList';
import { NewBuildForm } from '@/components/NewBuildForm';
import {
  useBuildStatusUpdated,
  useBuildCompleted,
  useBuildProgress,
  BuildProgressEvent,
} from '@/lib/useSignalR';
import {
  FolderKanban,
  Hammer,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
} from 'lucide-react';

const runningStatuses: BuildStatus[] = ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalBuilds: 0,
    successfulBuilds: 0,
    failedBuilds: 0,
    runningBuilds: 0,
  });
  const [runningBuilds, setRunningBuilds] = useState<Build[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, BuildProgressEvent>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [projects, builds] = await Promise.all([
        getProjects(),
        getBuilds(undefined, 1, 100),
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
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useBuildStatusUpdated((event) => {
    setRunningBuilds((prev) => {
      const updated = prev.map((b) =>
        b.id === event.buildId ? { ...b, status: event.status } : b
      );
      // Filter out completed builds
      return updated.filter((b) => runningStatuses.includes(b.status));
    });

    // Update running count
    if (!runningStatuses.includes(event.status)) {
      setStats((prev) => ({
        ...prev,
        runningBuilds: Math.max(0, prev.runningBuilds - 1),
      }));
    }
  });

  useBuildCompleted((event) => {
    setRunningBuilds((prev) => prev.filter((b) => b.id !== event.buildId));

    setStats((prev) => ({
      ...prev,
      runningBuilds: Math.max(0, prev.runningBuilds - 1),
      successfulBuilds: event.success ? prev.successfulBuilds + 1 : prev.successfulBuilds,
      failedBuilds: event.success ? prev.failedBuilds : prev.failedBuilds + 1,
    }));

    setProgressMap((prev) => {
      const next = { ...prev };
      delete next[event.buildId];
      return next;
    });
  });

  useBuildProgress((event) => {
    setProgressMap((prev) => ({
      ...prev,
      [event.buildId]: event,
    }));
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your build automation system</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Builds</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBuilds}</div>
          </CardContent>
        </Card>

        <Card className={stats.runningBuilds > 0 ? 'border-blue-500/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            {stats.runningBuilds > 0 ? (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            ) : (
              <Play className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.runningBuilds > 0 ? 'text-blue-500' : ''}`}>
              {stats.runningBuilds}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats.successfulBuilds}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.failedBuilds}</div>
          </CardContent>
        </Card>
      </div>

      {/* Running Builds */}
      {runningBuilds.length > 0 && (
        <Card className="border-blue-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              Running Builds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {runningBuilds.map((build) => {
                const progress = progressMap[build.id];
                return (
                  <Link
                    key={build.id}
                    href={`/dashboard/builds/${build.id}`}
                    className="block"
                  >
                    <div className="flex flex-col p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          <div>
                            <div className="font-medium">
                              {build.projectName} #{build.buildNumber}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {build.branch} - {build.scriptingBackend}
                            </div>
                          </div>
                        </div>
                        <Badge variant="info">{build.status}</Badge>
                      </div>
                      {progress && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{progress.message}</span>
                            {progress.progress > 0 && <span>{progress.progress}%</span>}
                          </div>
                          {progress.progress > 0 && (
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${progress.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NewBuildForm onBuildCreated={fetchStats} />
        <BuildList limit={5} />
      </div>
    </div>
  );
}
