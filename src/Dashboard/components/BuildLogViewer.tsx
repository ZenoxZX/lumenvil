'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { BuildLog, LogLevel, BuildStage } from '@/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  ArrowDown,
  ArrowUp,
  Filter,
  X,
} from 'lucide-react';

interface BuildLogViewerProps {
  logs: BuildLog[];
  className?: string;
  maxHeight?: string;
}

const logLevelColors: Record<LogLevel, string> = {
  Info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const logTextColors: Record<LogLevel, string> = {
  Info: 'text-zinc-300',
  Warning: 'text-yellow-300',
  Error: 'text-red-300',
};

const stageColors: Record<BuildStage, string> = {
  Clone: 'bg-purple-500/20 text-purple-400',
  Build: 'bg-orange-500/20 text-orange-400',
  Package: 'bg-cyan-500/20 text-cyan-400',
  Upload: 'bg-green-500/20 text-green-400',
};

export function BuildLogViewer({
  logs,
  className,
  maxHeight = '500px',
}: BuildLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [stageFilter, setStageFilter] = useState<BuildStage | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const prevLogsLength = useRef(logs.length);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !searchQuery ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      const matchesStage = stageFilter === 'all' || log.stage === stageFilter;
      return matchesSearch && matchesLevel && matchesStage;
    });
  }, [logs, searchQuery, levelFilter, stageFilter]);

  const logCounts = useMemo(() => {
    return {
      total: logs.length,
      info: logs.filter((l) => l.level === 'Info').length,
      warning: logs.filter((l) => l.level === 'Warning').length,
      error: logs.filter((l) => l.level === 'Error').length,
    };
  }, [logs]);

  useEffect(() => {
    if (autoScroll && !userScrolled && logs.length > prevLogsLength.current) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLogsLength.current = logs.length;
  }, [logs, autoScroll, userScrolled]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserScrolled(!isAtBottom);
    if (isAtBottom) {
      setAutoScroll(true);
    }
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    setUserScrolled(false);
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    setAutoScroll(false);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setLevelFilter('all');
    setStageFilter('all');
  };

  const hasFilters = searchQuery || levelFilter !== 'all' || stageFilter !== 'all';

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-zinc-900 rounded-t-lg border border-zinc-800">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-800 border-zinc-700 h-9"
          />
        </div>

        {/* Level Filter */}
        <Select
          value={levelFilter}
          onValueChange={(v) => setLevelFilter(v as LogLevel | 'all')}
        >
          <SelectTrigger className="w-[130px] bg-zinc-800 border-zinc-700 h-9">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Info">Info ({logCounts.info})</SelectItem>
            <SelectItem value="Warning">Warning ({logCounts.warning})</SelectItem>
            <SelectItem value="Error">Error ({logCounts.error})</SelectItem>
          </SelectContent>
        </Select>

        {/* Stage Filter */}
        <Select
          value={stageFilter}
          onValueChange={(v) => setStageFilter(v as BuildStage | 'all')}
        >
          <SelectTrigger className="w-[130px] bg-zinc-800 border-zinc-700 h-9">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="Clone">Clone</SelectItem>
            <SelectItem value="Build">Build</SelectItem>
            <SelectItem value="Package">Package</SelectItem>
            <SelectItem value="Upload">Upload</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-2"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}

        {/* Scroll controls */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToTop}
            className="h-9 px-2"
            title="Scroll to top"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            variant={autoScroll && !userScrolled ? 'secondary' : 'ghost'}
            size="sm"
            onClick={scrollToBottom}
            className="h-9 px-2"
            title="Scroll to bottom (auto-scroll)"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Log Stats */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border-x border-zinc-800 text-xs">
        <span className="text-zinc-500">
          {filteredLogs.length} of {logs.length} logs
        </span>
        {logCounts.error > 0 && (
          <Badge variant="destructive" className="text-xs py-0">
            {logCounts.error} errors
          </Badge>
        )}
        {logCounts.warning > 0 && (
          <Badge variant="warning" className="text-xs py-0">
            {logCounts.warning} warnings
          </Badge>
        )}
        {autoScroll && !userScrolled && (
          <Badge variant="secondary" className="text-xs py-0 ml-auto">
            Auto-scroll ON
          </Badge>
        )}
      </div>

      {/* Log Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-zinc-950 rounded-b-lg border border-t-0 border-zinc-800 overflow-y-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            {logs.length === 0 ? 'Waiting for logs...' : 'No logs match your filters'}
          </div>
        ) : (
          <div className="p-2">
            {filteredLogs.map((log, index) => (
              <div
                key={log.id || index}
                className={cn(
                  'flex items-start gap-2 py-1 px-2 rounded hover:bg-zinc-900/50',
                  log.level === 'Error' && 'bg-red-500/5'
                )}
              >
                {/* Timestamp */}
                <span className="text-zinc-500 text-xs w-20 shrink-0 pt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>

                {/* Stage Badge */}
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded w-16 text-center shrink-0',
                    stageColors[log.stage]
                  )}
                >
                  {log.stage}
                </span>

                {/* Level Badge */}
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded border w-16 text-center shrink-0',
                    logLevelColors[log.level]
                  )}
                >
                  {log.level}
                </span>

                {/* Message */}
                <span
                  className={cn(
                    'flex-1 break-all',
                    logTextColors[log.level]
                  )}
                >
                  {searchQuery ? (
                    <HighlightedText text={log.message} highlight={searchQuery} />
                  ) : (
                    log.message
                  )}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>;

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
