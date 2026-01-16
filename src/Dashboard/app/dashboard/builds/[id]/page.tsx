'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BuildDetail } from '@/types';
import { getBuild, cancelBuild } from '@/lib/api';
import { formatDate, formatDuration, formatSize } from '@/lib/utils';
import { BuildProgress } from '@/components/BuildProgress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, XCircle } from 'lucide-react';

export default function BuildDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [buildDetail, setBuildDetail] = useState<BuildDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const buildId = params.id as string;

  useEffect(() => {
    const fetchBuild = async () => {
      try {
        const data = await getBuild(buildId);
        setBuildDetail(data);
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
      // Refresh build data
      const data = await getBuild(buildId);
      setBuildDetail(data);
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

  const { build, logs } = buildDetail;
  const isRunning = ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'].includes(
    build.status
  );

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
                  build.status === 'Success'
                    ? 'success'
                    : build.status === 'Failed'
                    ? 'destructive'
                    : isRunning
                    ? 'info'
                    : 'secondary'
                }
                className="mt-1"
              >
                {build.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(build.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">
                {build.startedAt
                  ? formatDuration(build.startedAt, build.completedAt)
                  : '-'}
              </p>
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

      {/* Build Progress & Logs */}
      <BuildProgress buildId={buildId} initialStatus={build.status} initialLogs={logs} />
    </div>
  );
}
