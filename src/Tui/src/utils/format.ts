export const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export const formatDuration = (start?: string, end?: string) => {
  if (!start) return '-';
  const startDate = new Date(start).getTime();
  const endDate = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) return '-';
  const diff = Math.max(0, endDate - startDate);
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

export const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};
