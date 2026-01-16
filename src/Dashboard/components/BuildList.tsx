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
import { onBuildStatusUpdated, onBuildCompleted } from '@/lib/signalr';

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

interface BuildListProps {
  projectId?: string;
  limit?: number;
}

export function BuildList({ projectId, limit }: BuildListProps) {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  useEffect(() => {
    const unsubStatus = onBuildStatusUpdated((event) => {
      setBuilds((prev) =>
        prev.map((build) =>
          build.id === event.buildId
            ? { ...build, status: event.status, errorMessage: event.errorMessage }
            : build
        )
      );
    });

    const unsubCompleted = onBuildCompleted((event) => {
      setBuilds((prev) =>
        prev.map((build) =>
          build.id === event.buildId
            ? {
                ...build,
                status: event.success ? 'Success' : 'Failed',
                outputPath: event.outputPath,
                buildSize: event.buildSize,
              }
            : build
        )
      );
    });

    return () => {
      unsubStatus();
      unsubCompleted();
    };
  }, []);

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
          {builds.map((build) => (
            <Link
              key={build.id}
              href={`/dashboard/builds/${build.id}`}
              className="block"
            >
              <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-4">
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
            </Link>
          ))}
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
