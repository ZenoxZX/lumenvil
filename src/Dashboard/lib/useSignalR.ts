'use client';

import { useEffect, useRef } from 'react';
import {
  onBuildProgress,
  onBuildStatusUpdated,
  onBuildLogAdded,
  onBuildCompleted,
  joinBuildGroup,
  leaveBuildGroup,
  BuildProgressEvent,
  BuildStatusEvent,
  BuildLogEvent,
  BuildCompletedEvent,
} from './signalr';

export function useBuildProgress(
  callback: (data: BuildProgressEvent) => void,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = onBuildProgress((data) => {
      callbackRef.current(data);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useBuildStatusUpdated(
  callback: (data: BuildStatusEvent) => void,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = onBuildStatusUpdated((data) => {
      callbackRef.current(data);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useBuildLogAdded(
  callback: (data: BuildLogEvent) => void,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = onBuildLogAdded((data) => {
      callbackRef.current(data);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useBuildCompleted(
  callback: (data: BuildCompletedEvent) => void,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = onBuildCompleted((data) => {
      callbackRef.current(data);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useBuildGroup(buildId: string | undefined) {
  useEffect(() => {
    if (!buildId) return;

    joinBuildGroup(buildId);

    return () => {
      leaveBuildGroup(buildId);
    };
  }, [buildId]);
}

export {
  type BuildProgressEvent,
  type BuildStatusEvent,
  type BuildLogEvent,
  type BuildCompletedEvent,
};
