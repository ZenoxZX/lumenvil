'use client';

import { BuildStatus } from '@/types';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Hammer,
  Package,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';

interface BuildProgressBarProps {
  status: BuildStatus;
  className?: string;
}

const stages = [
  { key: 'Queued', label: 'Queued', icon: Clock },
  { key: 'Cloning', label: 'Cloning', icon: GitBranch },
  { key: 'Building', label: 'Building', icon: Hammer },
  { key: 'Packaging', label: 'Packaging', icon: Package },
  { key: 'Uploading', label: 'Uploading', icon: Upload },
  { key: 'Complete', label: 'Complete', icon: CheckCircle2 },
] as const;

const statusToStageIndex: Record<BuildStatus, number> = {
  Queued: 0,
  Cloning: 1,
  Building: 2,
  Packaging: 3,
  Uploading: 4,
  Success: 5,
  Failed: -1,
  Cancelled: -1,
};

const stageColors = {
  completed: 'bg-green-500 text-white border-green-500',
  active: 'bg-blue-500 text-white border-blue-500 animate-pulse',
  pending: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  failed: 'bg-red-500 text-white border-red-500',
};

const lineColors = {
  completed: 'bg-green-500',
  pending: 'bg-zinc-700',
};

export function BuildProgressBar({ status, className }: BuildProgressBarProps) {
  const currentStageIndex = statusToStageIndex[status];
  const isFailed = status === 'Failed';
  const isCancelled = status === 'Cancelled';
  const isCompleted = status === 'Success';

  const getStageState = (index: number) => {
    if (isFailed || isCancelled) {
      if (index < currentStageIndex || (currentStageIndex === -1 && index < 5)) {
        return 'completed';
      }
      return 'pending';
    }
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) return 'active';
    return 'pending';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between relative">
        {stages.map((stage, index) => {
          const state = getStageState(index);
          const Icon = stage.icon;
          const isLast = index === stages.length - 1;
          const showFailedIcon = (isFailed || isCancelled) && isLast;

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                    showFailedIcon ? stageColors.failed : stageColors[state]
                  )}
                >
                  {state === 'active' && !showFailedIcon ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : showFailedIcon ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs mt-2 font-medium',
                    state === 'active' && 'text-blue-400',
                    state === 'completed' && 'text-green-400',
                    state === 'pending' && 'text-zinc-500',
                    showFailedIcon && 'text-red-400'
                  )}
                >
                  {showFailedIcon ? (isFailed ? 'Failed' : 'Cancelled') : stage.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-2 transition-all duration-300',
                    getStageState(index + 1) === 'completed' || state === 'completed'
                      ? lineColors.completed
                      : lineColors.pending
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {(isFailed || isCancelled) && (
        <div className={cn(
          'mt-4 p-3 rounded-lg text-sm',
          isFailed ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
        )}>
          Build {isFailed ? 'failed' : 'was cancelled'}
        </div>
      )}

      {isCompleted && (
        <div className="mt-4 p-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">
          Build completed successfully
        </div>
      )}
    </div>
  );
}
