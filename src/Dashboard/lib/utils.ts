import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString();
}

export function formatDuration(start: string, end?: string): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diff = endDate.getTime() - startDate.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '-';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  let order = 0;
  let size = bytes;

  while (size >= 1024 && order < sizes.length - 1) {
    order++;
    size /= 1024;
  }

  return `${size.toFixed(2)} ${sizes[order]}`;
}
