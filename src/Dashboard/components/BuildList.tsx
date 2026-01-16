'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Build, BuildStatus } from '@/types';
import { getBuilds } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useBuildStatusUpdated,
  useBuildCompleted,
  useBuildProgress,
  BuildProgressEvent,
} from '@/lib/useSignalR';
import { Loader2 } from 'lucide-react';

const statusVariants: Record<BuildStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  Queued: 'secondary',
  Cloning: 'info',
  Building: 'info',
  Packaging: 'info',
  Uploading: 'info',
  Success: 'success',
  Failed: 'destructive',
  Cancelled: 'warning',
};

const runningStatuses: BuildStatus[] = ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'];

interface BuildListProps {
  projectId?: string;
  limit?: number;
}

export function BuildList({ projectId, limit }: BuildListProps) {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [progressMap, setProgressMap] = useState<Record<string, BuildProgressEvent>>({});

  const fetchBuilds = async () => {
    try {
      const response = await getBuilds(projectId, page, limit || 10);
      setBuilds(response.data);
      setTotalPages(response.totalPages);
    } catch (error) {
      console.error('Failed to fetch builds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuilds();
  }, [projectId, page]);

  useBuildStatusUpdated((event) => {
    setBuilds((prev) =>
      prev.map((build) =>
        build.id === event.buildId
          ? { ...build, status: event.status, errorMessage: event.errorMessage }
          : build
      )
    );
  });

  useBuildCompleted((event) => {
    setBuilds((prev) =>
      prev.map((build) =>
        build.id === event.buildId
          ? {
              ...build,
              status: event.success ? 'Success' : 'Failed',
              outputPath: event.outputPath,
              buildSize: event.buildSize,
              completedAt: new Date().toISOString(),
            }
          : build
      )
    );
    // Clear progress for completed build
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading builds...</div>
        </CardContent>
      </Card>
    );
  }

  if (builds.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">No builds yet</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Builds</CardTitle>
        <CardDescription>View and manage your Unity builds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {builds.map((build) => {
            const isRunning = runningStatuses.includes(build.status);
            const progress = progressMap[build.id];

            return (
              <Link
                key={build.id}
                href={`/dashboard/builds/${build.id}`}
                className="block"
              >
                <div className="flex flex-col p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {isRunning && (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      )}
                      <div>
                        <div className="font-medium">
                          {build.projectName} #{build.buildNumber}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {build.branch} - {build.scriptingBackend}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{formatDate(build.createdAt)}</div>
                        {build.startedAt && (
                          <div>
                            Duration: {formatDuration(build.startedAt, build.completedAt)}
                          </div>
                        )}
                      </div>
                      <Badge variant={statusVariants[build.status]}>
                        {build.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Mini progress bar for running builds */}
                  {isRunning && progress && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{progress.message}</span>
                        {progress.progress > 0 && <span>{progress.progress}%</span>}
                      </div>
                      {progress.progress > 0 && (
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
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
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-4 text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
