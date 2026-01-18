'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getUser, clearAuth } from '@/lib/auth';
import { connectToHub, disconnectFromHub } from '@/lib/signalr';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Hammer,
  FolderKanban,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuildNotifications } from '@/components/BuildNotifications';
import { Toaster } from '@/components/ui/toaster';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Builds', href: '/dashboard/builds', icon: Hammer },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'Users', href: '/dashboard/users', icon: Users, adminOnly: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, adminOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    setUser(getUser());
    connectToHub().catch(() => {
      // SignalR connection is optional - app works without real-time updates
    });

    return () => {
      disconnectFromHub().catch(console.error);
    };
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  if (!mounted || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">Build Automation</h1>
          <p className="text-sm text-muted-foreground">Unity CI/CD</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            // Hide admin-only items for non-admins
            if (item.adminOnly) {
              const userRole = typeof user.role === 'number' ? user.role : ['Viewer', 'Developer', 'Admin'].indexOf(user.role);
              if (userRole !== 2) return null;
            }

            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground">
                {typeof user.role === 'number' ? ['Viewer', 'Developer', 'Admin'][user.role] : user.role}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </div>

      {/* Toast Notifications */}
      <BuildNotifications />
      <Toaster />
    </div>
  );
}
