'use client';

import { useEffect, useState } from 'react';
import { hasRole } from '@/lib/auth';
import {
  getSteamSettings,
  updateSteamSettings,
  testSteamConnection,
  getPlatforms,
  getNotificationSettings,
  updateNotificationSettings,
  testNotificationChannel,
  SteamSettings,
  PlatformInfo,
  NotificationSettings,
  NotificationEvent,
  NotificationChannel,
} from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Settings,
  Save,
  TestTube,
  Check,
  X,
  Loader2,
  Bell,
  MessageSquare,
  Webhook,
} from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);

  const [steamSettings, setSteamSettings] = useState<SteamSettings | null>(null);
  const [steamForm, setSteamForm] = useState({
    username: '',
    password: '',
    steamCmdPath: '',
    defaultBranch: 'default',
  });

  // Notification state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [testingChannel, setTestingChannel] = useState<NotificationChannel | null>(null);

  // Notification forms
  const [discordForm, setDiscordForm] = useState({
    enabled: false,
    webhookUrl: '',
    events: [] as NotificationEvent[],
  });
  const [slackForm, setSlackForm] = useState({
    enabled: false,
    webhookUrl: '',
    events: [] as NotificationEvent[],
  });
  const [webhookForm, setWebhookForm] = useState({
    enabled: false,
    url: '',
    secret: '',
    events: [] as NotificationEvent[],
  });

  const allEvents: { value: NotificationEvent; label: string }[] = [
    { value: 'BuildStarted', label: 'Build Started' },
    { value: 'BuildCompleted', label: 'Build Completed' },
    { value: 'BuildFailed', label: 'Build Failed' },
    { value: 'BuildCancelled', label: 'Build Cancelled' },
    { value: 'UploadCompleted', label: 'Upload Completed' },
    { value: 'UploadFailed', label: 'Upload Failed' },
  ];

  const isAdmin = mounted && hasRole('Admin');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [steamData, platformsData, notificationsData] = await Promise.all([
        getSteamSettings(),
        getPlatforms(),
        getNotificationSettings().catch(() => null),
      ]);

      setSteamSettings(steamData);
      setPlatforms(platformsData);

      setSteamForm({
        username: steamData.username || '',
        password: '',
        steamCmdPath: steamData.steamCmdPath || '',
        defaultBranch: steamData.defaultBranch || 'default',
      });

      if (notificationsData) {
        setNotificationSettings(notificationsData);
        setDiscordForm({
          enabled: notificationsData.discord.enabled,
          webhookUrl: notificationsData.discord.webhookUrl || '',
          events: notificationsData.discord.events,
        });
        setSlackForm({
          enabled: notificationsData.slack.enabled,
          webhookUrl: notificationsData.slack.webhookUrl || '',
          events: notificationsData.slack.events,
        });
        setWebhookForm({
          enabled: notificationsData.webhook.enabled,
          url: notificationsData.webhook.url || '',
          secret: '',
          events: notificationsData.webhook.events,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSteam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updated = await updateSteamSettings({
        username: steamForm.username || null,
        password: steamForm.password || null,
        steamCmdPath: steamForm.steamCmdPath || null,
        defaultBranch: steamForm.defaultBranch || null,
      });

      setSteamSettings(updated);
      setSteamForm((prev) => ({ ...prev, password: '' }));

      toast({
        title: 'Settings Saved',
        description: 'Steam settings have been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);

    try {
      const result = await testSteamConnection();
      toast({
        title: 'Connection Successful',
        description: result.message,
        className: 'border-green-500 bg-green-500/10',
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Steam',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveNotifications = async (channel: 'discord' | 'slack' | 'webhook') => {
    setSavingNotifications(true);

    try {
      const updateData: Record<string, unknown> = {};

      if (channel === 'discord') {
        updateData.discord = {
          enabled: discordForm.enabled,
          webhookUrl: discordForm.webhookUrl || null,
          events: discordForm.events,
        };
      } else if (channel === 'slack') {
        updateData.slack = {
          enabled: slackForm.enabled,
          webhookUrl: slackForm.webhookUrl || null,
          events: slackForm.events,
        };
      } else if (channel === 'webhook') {
        updateData.webhook = {
          enabled: webhookForm.enabled,
          url: webhookForm.url || null,
          secret: webhookForm.secret || null,
          events: webhookForm.events,
        };
      }

      const updated = await updateNotificationSettings(updateData);
      setNotificationSettings(updated);

      toast({
        title: 'Settings Saved',
        description: `${channel.charAt(0).toUpperCase() + channel.slice(1)} notification settings have been updated`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save notification settings',
        variant: 'destructive',
      });
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleTestNotification = async (channel: NotificationChannel) => {
    setTestingChannel(channel);

    try {
      const result = await testNotificationChannel(channel);
      toast({
        title: 'Test Sent',
        description: result.message,
        className: 'border-green-500 bg-green-500/10',
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setTestingChannel(null);
    }
  };

  const toggleDiscordEvent = (event: NotificationEvent) => {
    const events = discordForm.events.includes(event)
      ? discordForm.events.filter((e) => e !== event)
      : [...discordForm.events, event];
    setDiscordForm({ ...discordForm, events });
  };

  const toggleSlackEvent = (event: NotificationEvent) => {
    const events = slackForm.events.includes(event)
      ? slackForm.events.filter((e) => e !== event)
      : [...slackForm.events, event];
    setSlackForm({ ...slackForm, events });
  };

  const toggleWebhookEvent = (event: NotificationEvent) => {
    const events = webhookForm.events.includes(event)
      ? webhookForm.events.filter((e) => e !== event)
      : [...webhookForm.events, event];
    setWebhookForm({ ...webhookForm, events });
  };

  if (!mounted) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don&apos;t have permission to view this page. Admin access required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">Configure platform integrations and system settings</p>
      </div>

      {/* Platforms Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Platforms</CardTitle>
          <CardDescription>Available platform integrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {platforms.map((platform) => (
              <div
                key={platform.type}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg"
              >
                <span className="font-medium">{platform.name}</span>
                {platform.isImplemented ? (
                  <Badge variant="default">Available</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Steam Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Steam Configuration</CardTitle>
              <CardDescription>Configure SteamCMD for uploading builds to Steam</CardDescription>
            </div>
            {steamSettings?.isConfigured ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                Not Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <form onSubmit={handleSaveSteam}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="steam-username">Steam Username</Label>
                <Input
                  id="steam-username"
                  value={steamForm.username}
                  onChange={(e) =>
                    setSteamForm({ ...steamForm, username: e.target.value })
                  }
                  placeholder="your_steam_username"
                />
                <p className="text-xs text-muted-foreground">
                  Use a dedicated build account, not your personal account
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steam-password">Steam Password</Label>
                <Input
                  id="steam-password"
                  type="password"
                  value={steamForm.password}
                  onChange={(e) =>
                    setSteamForm({ ...steamForm, password: e.target.value })
                  }
                  placeholder={steamSettings?.hasPassword ? '••••••••' : 'Enter password'}
                />
                <p className="text-xs text-muted-foreground">
                  {steamSettings?.hasPassword
                    ? 'Leave empty to keep current password'
                    : 'Required for Steam authentication'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steam-cmd-path">SteamCMD Path (Optional)</Label>
                <Input
                  id="steam-cmd-path"
                  value={steamForm.steamCmdPath}
                  onChange={(e) =>
                    setSteamForm({ ...steamForm, steamCmdPath: e.target.value })
                  }
                  placeholder="/usr/local/bin/steamcmd"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use default system path
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steam-branch">Default Steam Branch</Label>
                <Input
                  id="steam-branch"
                  value={steamForm.defaultBranch}
                  onChange={(e) =>
                    setSteamForm({ ...steamForm, defaultBranch: e.target.value })
                  }
                  placeholder="default"
                />
                <p className="text-xs text-muted-foreground">
                  Branch to publish builds to (e.g., default, beta, staging)
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !steamSettings?.isConfigured}
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Steam Guard Notice */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="text-yellow-600">Steam Guard Notice</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If your Steam account has Steam Guard enabled, you may need to use an{' '}
            <strong>App-Specific Password</strong> or run SteamCMD manually once to
            authorize this machine. Consider using a dedicated build account with
            Steam Guard configured for automated builds.
          </p>
        </CardContent>
      </Card>

      {/* Notifications Section Header */}
      <div className="pt-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notifications
        </h2>
        <p className="text-muted-foreground">Configure build notification channels</p>
      </div>

      {/* Discord Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#5865F2]" />
              <div>
                <CardTitle>Discord</CardTitle>
                <CardDescription>Send notifications to Discord via webhook</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="discord-enabled"
                checked={discordForm.enabled}
                onCheckedChange={(checked) =>
                  setDiscordForm({ ...discordForm, enabled: checked === true })
                }
              />
              <Label htmlFor="discord-enabled">Enabled</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discord-webhook">Webhook URL</Label>
            <Input
              id="discord-webhook"
              value={discordForm.webhookUrl}
              onChange={(e) => setDiscordForm({ ...discordForm, webhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              disabled={!discordForm.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allEvents.map((event) => (
                <div key={event.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`discord-${event.value}`}
                    checked={discordForm.events.includes(event.value)}
                    onCheckedChange={() => toggleDiscordEvent(event.value)}
                    disabled={!discordForm.enabled}
                  />
                  <Label
                    htmlFor={`discord-${event.value}`}
                    className={!discordForm.enabled ? 'text-muted-foreground' : ''}
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleTestNotification('Discord')}
            disabled={!discordForm.enabled || !discordForm.webhookUrl || testingChannel === 'Discord'}
          >
            {testingChannel === 'Discord' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>
          <Button
            onClick={() => handleSaveNotifications('discord')}
            disabled={savingNotifications}
          >
            {savingNotifications ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Slack Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#4A154B]" />
              <div>
                <CardTitle>Slack</CardTitle>
                <CardDescription>Send notifications to Slack via webhook</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="slack-enabled"
                checked={slackForm.enabled}
                onCheckedChange={(checked) =>
                  setSlackForm({ ...slackForm, enabled: checked === true })
                }
              />
              <Label htmlFor="slack-enabled">Enabled</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-webhook">Webhook URL</Label>
            <Input
              id="slack-webhook"
              value={slackForm.webhookUrl}
              onChange={(e) => setSlackForm({ ...slackForm, webhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
              disabled={!slackForm.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allEvents.map((event) => (
                <div key={event.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`slack-${event.value}`}
                    checked={slackForm.events.includes(event.value)}
                    onCheckedChange={() => toggleSlackEvent(event.value)}
                    disabled={!slackForm.enabled}
                  />
                  <Label
                    htmlFor={`slack-${event.value}`}
                    className={!slackForm.enabled ? 'text-muted-foreground' : ''}
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleTestNotification('Slack')}
            disabled={!slackForm.enabled || !slackForm.webhookUrl || testingChannel === 'Slack'}
          >
            {testingChannel === 'Slack' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>
          <Button
            onClick={() => handleSaveNotifications('slack')}
            disabled={savingNotifications}
          >
            {savingNotifications ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Generic Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              <div>
                <CardTitle>Custom Webhook</CardTitle>
                <CardDescription>Send notifications to a custom endpoint</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="webhook-enabled"
                checked={webhookForm.enabled}
                onCheckedChange={(checked) =>
                  setWebhookForm({ ...webhookForm, enabled: checked === true })
                }
              />
              <Label htmlFor="webhook-enabled">Enabled</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                value={webhookForm.url}
                onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                disabled={!webhookForm.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret (Optional)</Label>
              <Input
                id="webhook-secret"
                type="password"
                value={webhookForm.secret}
                onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                placeholder={notificationSettings?.webhook.hasSecret ? '••••••••' : 'HMAC secret'}
                disabled={!webhookForm.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Used to sign payloads with HMAC-SHA256
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allEvents.map((event) => (
                <div key={event.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`webhook-${event.value}`}
                    checked={webhookForm.events.includes(event.value)}
                    onCheckedChange={() => toggleWebhookEvent(event.value)}
                    disabled={!webhookForm.enabled}
                  />
                  <Label
                    htmlFor={`webhook-${event.value}`}
                    className={!webhookForm.enabled ? 'text-muted-foreground' : ''}
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleTestNotification('Webhook')}
            disabled={!webhookForm.enabled || !webhookForm.url || testingChannel === 'Webhook'}
          >
            {testingChannel === 'Webhook' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>
          <Button
            onClick={() => handleSaveNotifications('webhook')}
            disabled={savingNotifications}
          >
            {savingNotifications ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
