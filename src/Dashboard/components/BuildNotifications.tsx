'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  useBuildStatusUpdated,
  useBuildCompleted,
} from '@/lib/useSignalR';
import { BuildStatus } from '@/types';

const statusMessages: Partial<Record<BuildStatus, string>> = {
  Cloning: 'Build started - Cloning repository...',
  Building: 'Building Unity project...',
  Packaging: 'Packaging build...',
  Uploading: 'Uploading to Steam...',
};

export function BuildNotifications() {
  const router = useRouter();
  const shownNotifications = useRef<Set<string>>(new Set());

  useBuildStatusUpdated((event) => {
    const key = `${event.buildId}-${event.status}`;

    // Only show "started" notification once per build
    if (event.status === 'Cloning' && !shownNotifications.current.has(key)) {
      shownNotifications.current.add(key);
      toast({
        title: 'Build Started',
        description: statusMessages[event.status],
        action: (
          <ToastAction
            altText="View build"
            onClick={() => router.push(`/dashboard/builds/${event.buildId}`)}
          >
            View
          </ToastAction>
        ),
      });
    }
  });

  useBuildCompleted((event) => {
    const key = `${event.buildId}-completed`;

    if (!shownNotifications.current.has(key)) {
      shownNotifications.current.add(key);

      if (event.success) {
        toast({
          title: 'Build Completed',
          description: 'Build finished successfully!',
          className: 'border-green-500 bg-green-500/10',
          action: (
            <ToastAction
              altText="View build"
              onClick={() => router.push(`/dashboard/builds/${event.buildId}`)}
            >
              View
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: 'Build Failed',
          description: 'Build encountered an error.',
          variant: 'destructive',
          action: (
            <ToastAction
              altText="View build"
              onClick={() => router.push(`/dashboard/builds/${event.buildId}`)}
            >
              View
            </ToastAction>
          ),
        });
      }
    }
  });

  // Clean up old notification keys periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (shownNotifications.current.size > 100) {
        shownNotifications.current.clear();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
