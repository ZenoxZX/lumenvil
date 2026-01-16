'use client';

import { useEffect, useState, useRef } from 'react';
import { BuildLog, BuildStatus, LogLevel } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  onBuildProgress,
  onBuildLogAdded,
  onBuildStatusUpdated,
  onBuildCompleted,
  BuildProgressEvent,
} from '@/lib/signalr';

interface BuildProgressProps {
  buildId: string;
  initialStatus: BuildStatus;
  initialLogs: BuildLog[];
}

const logLevelColors: Record<LogLevel, string> = {
  Info: 'text-foreground',
  Warning: 'text-yellow-500',
  Error: 'text-red-500',
};

const stageLabels: Record<string, string> = {
  Clone: 'Cloning Repository',
  Build: 'Building Unity Project',
  Package: 'Packaging Build',
  Upload: 'Uploading to Steam',
};

export function BuildProgress({
  buildId,
  initialStatus,
  initialLogs,
}: BuildProgressProps) {
  const [status, setStatus] = useState<BuildStatus>(initialStatus);
  const [logs, setLogs] = useState<BuildLog[]>(initialLogs);
  const [progress, setProgress] = useState<BuildProgressEvent | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubProgress = onBuildProgress((event) => {
      if (event.buildId === buildId) {
        setProgress(event);
      }
    });

    const unsubLog = onBuildLogAdded((event) => {
      if (event.buildId === buildId) {
        setLogs((prev) => [...prev, event.log]);
      }
    });

    const unsubStatus = onBuildStatusUpdated((event) => {
      if (event.buildId === buildId) {
        setStatus(event.status);
      }
    });

    const unsubCompleted = onBuildCompleted((event) => {
      if (event.buildId === buildId) {
        setStatus(event.success ? 'Success' : 'Failed');
      }
    });

    return () => {
      unsubProgress();
      unsubLog();
      unsubStatus();
      unsubCompleted();
    };
  }, [buildId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isRunning = ['Queued', 'Cloning', 'Building', 'Packaging', 'Uploading'].includes(
    status
  );

  return (
    <div className="space-y-4">
      {isRunning && progress && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {stageLabels[progress.stage] || progress.stage}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress.progress} className="mb-2" />
            <p className="text-sm text-muted-foreground">{progress.message}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            Build Logs
            <Badge variant={isRunning ? 'info' : status === 'Success' ? 'success' : 'destructive'}>
              {status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-zinc-950 rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-muted-foreground">Waiting for logs...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-2 py-0.5">
                  <span className="text-muted-foreground text-xs w-20 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-1 rounded w-16 text-center shrink-0',
                      log.level === 'Error' && 'bg-red-500/20 text-red-500',
                      log.level === 'Warning' && 'bg-yellow-500/20 text-yellow-500',
                      log.level === 'Info' && 'bg-blue-500/20 text-blue-500'
                    )}
                  >
                    {log.level}
                  </span>
                  <span className={cn('flex-1', logLevelColors[log.level])}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
