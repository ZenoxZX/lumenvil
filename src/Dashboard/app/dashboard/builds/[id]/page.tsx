'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BuildDetail, BuildLog, BuildStatus } from '@/types';
import { getBuild, cancelBuild } from '@/lib/api';
import { formatDate, formatSize } from '@/lib/utils';
import { BuildProgressBar } from '@/components/BuildProgressBar';
import { BuildLogViewer } from '@/components/BuildLogViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  useBuildGroup,
  useBuildStatusUpdated,
  useBuildLogAdded,
  useBuildCompleted,
  useBuildProgress,
  BuildProgressEvent,
} from '@/lib/useSignalR';
import { ArrowLeft, XCircle, Clock } from 'lucide-react';

function LiveDuration({ startedAt, completedAt }: { startedAt?: string; completedAt?: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) {
      setElapsed('-');
      return;
    }

    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : null;

    if (end) {
      const diff = end - start;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(`${minutes}m ${seconds}s`);
      return;
    }

    const updateElapsed = () => {
      const now = Date.now();
      const diff = now - start;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(`${minutes}m ${seconds}s`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  return (
    <span className="font-medium flex items-center gap-1">
      {!completedAt && startedAt && <Clock className="w-4 h-4 animate-pulse text-blue-400" />}
      {elapsed}
    </span>
  );
}

export default function BuildDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [buildDetail, setBuildDetail] = useState<BuildDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [status, setStatus] = useState<BuildStatus | null>(null);
  const [progress, setProgress] = useState<BuildProgressEvent | null>(null);

  const buildId = params.id as string;

  // Join SignalR group for this build
  useBuildGroup(buildId);

  // Listen for real-time updates
  useBuildStatusUpdated((event) => {
    if (event.buildId === buildId) {
      setStatus(event.status);
      if (event.errorMessage) {
        setBuildDetail((prev) =>
          prev
            ? { ...prev, build: { ...prev.build, status: event.status, errorMessage: event.errorMessage } }
            : null
        );
      }
    }
  }, [buildId]);

  useBuildLogAdded((event) => {
    if (event.buildId === buildId) {
      setLogs((prev) => [...prev, event.log]);
    }
  }, [buildId]);

  useBuildCompleted((event) => {
    if (event.buildId === buildId) {
      setStatus(event.success ? 'Success' : 'Failed');
      setBuildDetail((prev) =>
        prev
          ? {
              ...prev,
              build: {
                ...prev.build,
                status: event.success ? 'Success' : 'Failed',
                outputPath: event.outputPath,
                buildSize: event.buildSize,
                completedAt: new Date().toISOString(),
              },
            }
          : null
      );
    }
  }, [buildId]);

  useBuildProgress((event) => {
    if (event.buildId === buildId) {
      setProgress(event);
    }
  }, [buildId]);

  useEffect(() => {
    const fetchBuild = async () => {
      try {
        const data = await getBuild(buildId);
        setBuildDetail(data);
        setLogs(data.logs);
        setStatus(data.build.status);
      } catch (error) {
        console.error('Failed to fetch build:', error);
        toast({
          title: 'Error',
          description: 'Failed to load build details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBuild();
  }, [buildId, toast]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelBuild(buildId);
      toast({
        title: 'Build Cancelled',
        description: 'The build has been cancelled',
      });
      const data = await getBuild(buildId);
      setBuildDetail(data);
      setStatus(data.build.status);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel build',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  const currentStatus = status || buildDetail?.build.status;
  const isRunning = currentStatus
    ? ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'].includes(currentStatus)
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading build details...</div>
      </div>
    );
  }

  if (!buildDetail) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-muted-foreground">Build not found</div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/builds">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Builds
          </Link>
        </Button>
      </div>
    );
  }

  const { build } = buildDetail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/builds">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {build.projectName} #{build.buildNumber}
            </h1>
            <p className="text-muted-foreground">
              {build.branch} - {build.scriptingBackend}
            </p>
          </div>
        </div>
        {isRunning && (
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {cancelling ? 'Cancelling...' : 'Cancel Build'}
          </Button>
        )}
      </div>

      {/* Build Progress Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Build Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildProgressBar status={currentStatus || 'Queued'} />
          {progress && isRunning && (
            <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
              <p className="text-sm text-zinc-400">{progress.message}</p>
              {progress.progress > 0 && (
                <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Build Info */}
      <Card>
        <CardHeader>
          <CardTitle>Build Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={
                  currentStatus === 'Success'
                    ? 'success'
                    : currentStatus === 'Failed'
                    ? 'destructive'
                    : isRunning
                    ? 'info'
                    : 'secondary'
                }
                className="mt-1"
              >
                {currentStatus}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(build.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <LiveDuration
                startedAt={build.startedAt}
                completedAt={currentStatus === 'Success' || currentStatus === 'Failed' ? build.completedAt : undefined}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Triggered By</p>
              <p className="font-medium">{build.triggeredByUsername || 'System'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="font-medium">{build.branch}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scripting Backend</p>
              <p className="font-medium">{build.scriptingBackend}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Build Size</p>
              <p className="font-medium">{formatSize(build.buildSize)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Commit</p>
              <p className="font-medium font-mono text-sm">
                {build.commitHash?.substring(0, 8) || '-'}
              </p>
            </div>
          </div>

          {build.errorMessage && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-destructive/80 mt-1">{build.errorMessage}</p>
            </div>
          )}

          {build.outputPath && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Output Path</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">{build.outputPath}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Build Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Build Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildLogViewer logs={logs} maxHeight="500px" />
        </CardContent>
      </Card>
    </div>
  );
}
