'use client';

import { useEffect, useState } from 'react';
import { hasRole } from '@/lib/auth';
import {
  getSteamSettings,
  updateSteamSettings,
  testSteamConnection,
  getPlatforms,
  SteamSettings,
  PlatformInfo,
} from '@/lib/api';
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

  const isAdmin = mounted && hasRole('Admin');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [steamData, platformsData] = await Promise.all([
        getSteamSettings(),
        getPlatforms(),
      ]);

      setSteamSettings(steamData);
      setPlatforms(platformsData);

      setSteamForm({
        username: steamData.username || '',
        password: '',
        steamCmdPath: steamData.steamCmdPath || '',
        defaultBranch: steamData.defaultBranch || 'default',
      });
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
    </div>
  );
}
