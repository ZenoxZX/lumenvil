import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import {
  BuildStatus,
  CleanupResult,
  CleanupSettings,
  DiskSpaceInfo,
  NotificationChannel,
  NotificationEvent,
  NotificationSettings,
  PlatformInfo,
  SteamSettings,
} from '../types.js';
import { InputRow } from '../components/InputRow.js';
import { ToggleRow } from '../components/ToggleRow.js';

const sections = ['platforms', 'steam', 'notifications', 'cleanup'] as const;

type Section = (typeof sections)[number];

type SettingsScreenProps = {
  api: ApiClient;
  isActive: boolean;
};

const notificationEvents: NotificationEvent[] = [
  'BuildStarted',
  'BuildCompleted',
  'BuildFailed',
  'BuildCancelled',
  'UploadCompleted',
  'UploadFailed',
];

const cleanupStatuses: BuildStatus[] = ['Success', 'Failed', 'Cancelled'];

export function SettingsScreen({ api, isActive }: SettingsScreenProps) {
  const [section, setSection] = useState<Section>('platforms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [steamSettings, setSteamSettings] = useState<SteamSettings | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [cleanupSettings, setCleanupSettings] = useState<CleanupSettings | null>(null);
  const [diskSpace, setDiskSpace] = useState<DiskSpaceInfo | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  const [steamForm, setSteamForm] = useState({
    username: '',
    password: '',
    steamCmdPath: '',
    defaultBranch: 'default',
  });

  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel>('Discord');
  const [notificationForm, setNotificationForm] = useState({
    discordEnabled: false,
    discordWebhookUrl: '',
    discordEvents: '',
    slackEnabled: false,
    slackWebhookUrl: '',
    slackEvents: '',
    webhookEnabled: false,
    webhookUrl: '',
    webhookSecret: '',
    webhookEvents: '',
  });

  const [cleanupForm, setCleanupForm] = useState({
    enabled: false,
    maxBuildsPerProject: '10',
    maxBuildAgeDays: '30',
    minFreeDiskSpaceGB: '50',
    scheduledHour: '3',
    cleanupStatuses: cleanupStatuses.join(', '),
    keepSteamUploads: true,
  });

  const [steamFieldIndex, setSteamFieldIndex] = useState(0);
  const [notificationFieldIndex, setNotificationFieldIndex] = useState(0);
  const [cleanupFieldIndex, setCleanupFieldIndex] = useState(0);

  type SteamField = 'username' | 'password' | 'steamCmdPath' | 'defaultBranch';
  type NotificationField =
    | 'discordEnabled'
    | 'discordWebhookUrl'
    | 'discordEvents'
    | 'slackEnabled'
    | 'slackWebhookUrl'
    | 'slackEvents'
    | 'webhookEnabled'
    | 'webhookUrl'
    | 'webhookSecret'
    | 'webhookEvents';
  type CleanupField =
    | 'enabled'
    | 'maxBuildsPerProject'
    | 'maxBuildAgeDays'
    | 'minFreeDiskSpaceGB'
    | 'scheduledHour'
    | 'cleanupStatuses'
    | 'keepSteamUploads';

  const steamFields: SteamField[] = ['username', 'password', 'steamCmdPath', 'defaultBranch'];
  const notificationFieldsByChannel: Record<NotificationChannel, NotificationField[]> = {
    Discord: ['discordEnabled', 'discordWebhookUrl', 'discordEvents'],
    Slack: ['slackEnabled', 'slackWebhookUrl', 'slackEvents'],
    Webhook: ['webhookEnabled', 'webhookUrl', 'webhookSecret', 'webhookEvents'],
  };
  const cleanupFields: CleanupField[] = [
    'enabled',
    'maxBuildsPerProject',
    'maxBuildAgeDays',
    'minFreeDiskSpaceGB',
    'scheduledHour',
    'cleanupStatuses',
    'keepSteamUploads',
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [steamData, platformsData, notificationsData, cleanupData, diskData] = await Promise.all([
        api.getSteamSettings(),
        api.getPlatforms(),
        api.getNotificationSettings().catch(() => null),
        api.getCleanupSettings().catch(() => null),
        api.getDiskSpace().catch(() => null),
      ]);

      setPlatforms(platformsData);
      setSteamSettings(steamData);
      setDiskSpace(diskData);

      setSteamForm({
        username: steamData.username || '',
        password: '',
        steamCmdPath: steamData.steamCmdPath || '',
        defaultBranch: steamData.defaultBranch || 'default',
      });

      if (notificationsData) {
        setNotificationSettings(notificationsData);
        setNotificationForm({
          discordEnabled: notificationsData.discord.enabled,
          discordWebhookUrl: notificationsData.discord.webhookUrl || '',
          discordEvents: notificationsData.discord.events.join(', '),
          slackEnabled: notificationsData.slack.enabled,
          slackWebhookUrl: notificationsData.slack.webhookUrl || '',
          slackEvents: notificationsData.slack.events.join(', '),
          webhookEnabled: notificationsData.webhook.enabled,
          webhookUrl: notificationsData.webhook.url || '',
          webhookSecret: '',
          webhookEvents: notificationsData.webhook.events.join(', '),
        });
      }

      if (cleanupData) {
        setCleanupSettings(cleanupData);
        setCleanupForm({
          enabled: cleanupData.enabled,
          maxBuildsPerProject: cleanupData.maxBuildsPerProject.toString(),
          maxBuildAgeDays: cleanupData.maxBuildAgeDays.toString(),
          minFreeDiskSpaceGB: cleanupData.minFreeDiskSpaceGB.toString(),
          scheduledHour: cleanupData.scheduledHour.toString(),
          cleanupStatuses: cleanupData.cleanupStatuses.join(', '),
          keepSteamUploads: cleanupData.keepSteamUploads,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) return;
    void fetchData();
  }, [fetchData, isActive]);

  const currentNotificationFields = notificationFieldsByChannel[notificationChannel];

  const parseEvents = (value: string): NotificationEvent[] => {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry): entry is NotificationEvent =>
        notificationEvents.includes(entry as NotificationEvent)
      );
  };

  const parseCleanupStatuses = (value: string): BuildStatus[] => {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry): entry is BuildStatus =>
        cleanupStatuses.includes(entry as BuildStatus)
      );
  };

  const handleSaveSteam = async () => {
    setStatus('Saving Steam settings...');
    try {
      const updated = await api.updateSteamSettings({
        username: steamForm.username || null,
        password: steamForm.password || null,
        steamCmdPath: steamForm.steamCmdPath || null,
        defaultBranch: steamForm.defaultBranch || null,
      });
      setSteamSettings(updated);
      setSteamForm((prev) => ({ ...prev, password: '' }));
      setStatus('Steam settings saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save Steam settings.');
    }
  };

  const handleTestSteam = async () => {
    setStatus('Testing Steam connection...');
    try {
      const result = await api.testSteamConnection();
      setStatus(result.message);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Steam test failed.');
    }
  };

  const handleSaveNotifications = async () => {
    setStatus('Saving notification settings...');
    try {
      const payload = notificationChannel === 'Discord'
        ? {
            discord: {
              enabled: notificationForm.discordEnabled,
              webhookUrl: notificationForm.discordWebhookUrl || null,
              events: parseEvents(notificationForm.discordEvents),
            },
          }
        : notificationChannel === 'Slack'
        ? {
            slack: {
              enabled: notificationForm.slackEnabled,
              webhookUrl: notificationForm.slackWebhookUrl || null,
              events: parseEvents(notificationForm.slackEvents),
            },
          }
        : {
            webhook: {
              enabled: notificationForm.webhookEnabled,
              url: notificationForm.webhookUrl || null,
              secret: notificationForm.webhookSecret || null,
              events: parseEvents(notificationForm.webhookEvents),
            },
          };

      const updated = await api.updateNotificationSettings(payload);
      setNotificationSettings(updated);
      setStatus('Notification settings saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save notifications.');
    }
  };

  const handleTestNotifications = async () => {
    setStatus(`Sending test to ${notificationChannel}...`);
    try {
      const result = await api.testNotificationChannel(notificationChannel);
      setStatus(result.message);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Notification test failed.');
    }
  };

  const handleSaveCleanup = async () => {
    setStatus('Saving cleanup settings...');
    try {
      const payload: CleanupSettings = {
        enabled: cleanupForm.enabled,
        maxBuildsPerProject: parseInt(cleanupForm.maxBuildsPerProject, 10) || 0,
        maxBuildAgeDays: parseInt(cleanupForm.maxBuildAgeDays, 10) || 0,
        minFreeDiskSpaceGB: parseInt(cleanupForm.minFreeDiskSpaceGB, 10) || 0,
        scheduledHour: parseInt(cleanupForm.scheduledHour, 10) || 0,
        cleanupStatuses: parseCleanupStatuses(cleanupForm.cleanupStatuses),
        keepSteamUploads: cleanupForm.keepSteamUploads,
      };
      const updated = await api.updateCleanupSettings(payload);
      setCleanupSettings(updated);
      setStatus('Cleanup settings saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save cleanup settings.');
    }
  };

  const handleRunCleanup = async () => {
    setStatus('Running cleanup...');
    try {
      const result = await api.runCleanup();
      setCleanupResult(result);
      const disk = await api.getDiskSpace().catch(() => null);
      if (disk) setDiskSpace(disk);
      setStatus(`Cleanup finished. Deleted ${result.buildsDeleted} builds.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Cleanup run failed.');
    }
  };

  useInput((input, key) => {
    if (!isActive) return;

    if (input === '[') {
      const index = sections.indexOf(section);
      const nextIndex = (index - 1 + sections.length) % sections.length;
      setSection(sections[nextIndex]);
      return;
    }

    if (input === ']') {
      const index = sections.indexOf(section);
      const nextIndex = (index + 1) % sections.length;
      setSection(sections[nextIndex]);
      return;
    }

    if (key.ctrl && input === 'r') {
      if (section === 'cleanup') {
        void handleRunCleanup();
      } else {
        void fetchData();
      }
      return;
    }

    if (key.ctrl && input === 's') {
      if (section === 'steam') {
        void handleSaveSteam();
      } else if (section === 'notifications') {
        void handleSaveNotifications();
      } else if (section === 'cleanup') {
        void handleSaveCleanup();
      }
      return;
    }

    if (key.ctrl && input === 't') {
      if (section === 'steam') {
        void handleTestSteam();
      } else if (section === 'notifications') {
        void handleTestNotifications();
      }
      return;
    }

    if (section === 'steam') {
      if (key.upArrow || key.downArrow) {
        setSteamFieldIndex((prev) => {
          if (key.downArrow) return (prev + 1) % steamFields.length;
          return (prev - 1 + steamFields.length) % steamFields.length;
        });
        return;
      }
      const activeField = steamFields[steamFieldIndex];
      if (key.backspace || key.delete) {
        setSteamForm((prev) => ({ ...prev, [activeField]: prev[activeField].slice(0, -1) }));
        return;
      }
      if (!input) return;
      setSteamForm((prev) => ({ ...prev, [activeField]: `${prev[activeField]}${input}` }));
    }

    if (section === 'notifications') {
      if (key.ctrl && input === 'd') setNotificationChannel('Discord');
      if (key.ctrl && input === 'l') setNotificationChannel('Slack');
      if (key.ctrl && input === 'w') setNotificationChannel('Webhook');
      if (key.upArrow || key.downArrow) {
        setNotificationFieldIndex((prev) => {
          if (key.downArrow) return (prev + 1) % currentNotificationFields.length;
          return (prev - 1 + currentNotificationFields.length) % currentNotificationFields.length;
        });
        return;
      }

      const activeField = currentNotificationFields[notificationFieldIndex];
      if (activeField.endsWith('Enabled')) {
        if (input === ' ' || key.leftArrow || key.rightArrow) {
          setNotificationForm((prev) => ({
            ...prev,
            [activeField]: !prev[activeField],
          }));
        }
        return;
      }

      if (key.backspace || key.delete) {
        setNotificationForm((prev) => ({
          ...prev,
          [activeField]: String(prev[activeField]).slice(0, -1),
        }));
        return;
      }

      if (!input) return;
      setNotificationForm((prev) => ({
        ...prev,
        [activeField]: `${prev[activeField]}${input}`,
      }));
    }

    if (section === 'cleanup') {
      if (key.upArrow || key.downArrow) {
        setCleanupFieldIndex((prev) => {
          if (key.downArrow) return (prev + 1) % cleanupFields.length;
          return (prev - 1 + cleanupFields.length) % cleanupFields.length;
        });
        return;
      }

      const activeField = cleanupFields[cleanupFieldIndex];
      if (activeField === 'enabled' || activeField === 'keepSteamUploads') {
        if (input === ' ' || key.leftArrow || key.rightArrow) {
          setCleanupForm((prev) => ({ ...prev, [activeField]: !prev[activeField] }));
        }
        return;
      }

      if (key.backspace || key.delete) {
        setCleanupForm((prev) => ({
          ...prev,
          [activeField]: String(prev[activeField]).slice(0, -1),
        }));
        return;
      }

      if (!input) return;
      setCleanupForm((prev) => ({
        ...prev,
        [activeField]: `${prev[activeField]}${input}`,
      }));
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Settings</Text>
        <Text color="yellow">Loading settings...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Settings</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Settings</Text>
      <Text dimColor>[ and ] switch section · Ctrl+R refresh · Ctrl+S save · ↑/↓ move</Text>

      {section === 'platforms' && (
        <Box flexDirection="column" gap={1}>
          {platforms.map((platform) => (
            <Text key={platform.type}>
              {platform.name} · {platform.isImplemented ? 'Available' : 'Coming soon'}
            </Text>
          ))}
          {platforms.length === 0 && <Text dimColor>No platforms.</Text>}
        </Box>
      )}

      {section === 'steam' && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>↑/↓ move · Ctrl+S save · Ctrl+T test</Text>
          {steamFields.map((field, index) => {
            const focused = steamFieldIndex === index;
            const value = steamForm[field];
            return (
              <InputRow
                key={field}
                label={field === 'steamCmdPath' ? 'SteamCMD Path' : field.charAt(0).toUpperCase() + field.slice(1)}
                value={value}
                focused={focused}
                masked={field === 'password'}
              />
            );
          })}
          {steamSettings && (
            <Text dimColor>Configured: {steamSettings.isConfigured ? 'Yes' : 'No'}</Text>
          )}
        </Box>
      )}

      {section === 'notifications' && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>Ctrl+D Discord · Ctrl+L Slack · Ctrl+W Webhook · ↑/↓ move · Ctrl+S save · Ctrl+T test</Text>
          <Text>Channel: {notificationChannel}</Text>
          {currentNotificationFields.map((fieldId, index) => {
            const focused = notificationFieldIndex === index;
            const value = notificationForm[fieldId as keyof typeof notificationForm];
            if (fieldId.endsWith('Enabled')) {
              return (
                <ToggleRow
                  key={fieldId}
                  label={fieldId}
                  value={Boolean(value)}
                  focused={focused}
                />
              );
            }
            return (
              <InputRow
                key={fieldId}
                label={fieldId}
                value={String(value)}
                focused={focused}
                masked={fieldId === 'webhookSecret'}
              />
            );
          })}
          <Text dimColor>Events: {notificationEvents.join(', ')}</Text>
          {notificationSettings && (
            <Text dimColor>Webhook secret set: {notificationSettings.webhook.hasSecret ? 'Yes' : 'No'}</Text>
          )}
        </Box>
      )}

      {section === 'cleanup' && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>↑/↓ move · Ctrl+S save · Ctrl+R run cleanup</Text>
          {cleanupFields.map((fieldId, index) => {
            const focused = cleanupFieldIndex === index;
            const value = cleanupForm[fieldId as keyof typeof cleanupForm];
            if (fieldId === 'enabled' || fieldId === 'keepSteamUploads') {
              return (
                <ToggleRow
                  key={fieldId}
                  label={fieldId}
                  value={Boolean(value)}
                  focused={focused}
                />
              );
            }
            return (
              <InputRow
                key={fieldId}
                label={fieldId}
                value={String(value)}
                focused={focused}
              />
            );
          })}
          {diskSpace && (
            <Text dimColor>
              Disk: {diskSpace.drivePath} · Free {diskSpace.freeFormatted} · Used {diskSpace.usedFormatted}
            </Text>
          )}
          {cleanupResult && (
            <Text dimColor>
              Last cleanup: {cleanupResult.buildsDeleted} builds, freed {cleanupResult.spaceFreedFormatted}
            </Text>
          )}
        </Box>
      )}

      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
