import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { User, UserRole } from '../types.js';
import { hasRole, normalizeRole } from '../utils/role.js';
import { DashboardScreen } from './DashboardScreen.js';
import { BuildsScreen } from './BuildsScreen.js';
import { BuildDetailScreen } from './BuildDetailScreen.js';
import { NewBuildScreen } from './NewBuildScreen.js';
import { ProjectsScreen } from './ProjectsScreen.js';
import { TemplatesScreen } from './TemplatesScreen.js';
import { PipelinesScreen } from './PipelinesScreen.js';
import { PipelineDetailScreen } from './PipelineDetailScreen.js';
import { UsersScreen } from './UsersScreen.js';
import { SettingsScreen } from './SettingsScreen.js';

export type MainShellProps = {
  user: User;
  api: ApiClient;
  onLogout: () => void;
};

type MenuItem = {
  id: string;
  label: string;
  minRole?: UserRole;
};

const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', minRole: 'Viewer' },
  { id: 'builds', label: 'Builds', minRole: 'Viewer' },
  { id: 'newBuild', label: 'New Build', minRole: 'Developer' },
  { id: 'projects', label: 'Projects', minRole: 'Developer' },
  { id: 'templates', label: 'Templates', minRole: 'Developer' },
  { id: 'pipelines', label: 'Pipelines', minRole: 'Developer' },
  { id: 'users', label: 'Users', minRole: 'Admin' },
  { id: 'settings', label: 'Settings', minRole: 'Admin' },
  { id: 'logout', label: 'Logout' },
];

export function MainShell({ user, api, onLogout }: MainShellProps) {
  const role = normalizeRole(user.role);

  const items = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      if (item.id === 'logout') return true;
      if (!item.minRole) return true;
      return hasRole(user.role, item.minRole);
    });
  }, [user.role]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeView, setActiveView] = useState(items[0]?.id || 'dashboard');
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    if (selectedIndex >= items.length) {
      setSelectedIndex(0);
    }
    const allowedIds = items.map((item) => item.id);
    if (!allowedIds.includes(activeView) || activeView === 'logout') {
      setActiveView(items[0].id);
    }
  }, [items, selectedIndex, activeView]);

  useInput((input, key) => {
    if (key.tab) {
      const nextIndex = key.shift
        ? (selectedIndex - 1 + items.length) % items.length
        : (selectedIndex + 1) % items.length;
      setSelectedIndex(nextIndex);
      const item = items[nextIndex];
      if (item && item.id !== 'logout') {
        setActiveView(item.id);
      }
      return;
    }

    if (key.ctrl && input === 'q') {
      onLogout();
      return;
    }
  });

  const openBuildDetail = (buildId: string) => {
    setSelectedBuildId(buildId);
    setActiveView('buildDetail');
  };

  const backToBuilds = () => {
    setActiveView('builds');
    setSelectedBuildId(null);
  };

  const openPipelineDetail = (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setActiveView('pipelineDetail');
  };

  const backToPipelines = () => {
    setActiveView('pipelines');
    setSelectedPipelineId(null);
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="cyan" bold>
        Lumenvil TUI
      </Text>

      <Text>
        User: {user.username} ({role})
      </Text>

      <Box flexDirection="row" gap={4}>
        <Box flexDirection="column" width={24}>
          <Text bold>Menu</Text>
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            return (
              <Text key={item.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
                {selected ? '>' : ' '} {index + 1}. {item.label}
              </Text>
            );
          })}
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <Text bold>View: {activeView}</Text>
          {activeView === 'dashboard' && (
            <DashboardScreen api={api} isActive={true} onOpenBuild={openBuildDetail} />
          )}
          {activeView === 'builds' && (
            <BuildsScreen api={api} isActive={true} onOpenBuild={openBuildDetail} />
          )}
          {activeView === 'buildDetail' && selectedBuildId && (
            <BuildDetailScreen api={api} buildId={selectedBuildId} isActive={true} onBack={backToBuilds} />
          )}
          {activeView === 'newBuild' && (
            <NewBuildScreen
              api={api}
              isActive={true}
              onCreated={(buildId) => openBuildDetail(buildId)}
              onBack={() => setActiveView('dashboard')}
            />
          )}
          {activeView === 'projects' && (
            <ProjectsScreen api={api} isActive={true} />
          )}
          {activeView === 'templates' && (
            <TemplatesScreen api={api} isActive={true} />
          )}
          {activeView === 'pipelines' && (
            <PipelinesScreen api={api} isActive={true} onOpenPipeline={openPipelineDetail} />
          )}
          {activeView === 'pipelineDetail' && selectedPipelineId && (
            <PipelineDetailScreen
              api={api}
              pipelineId={selectedPipelineId}
              isActive={true}
              onBack={backToPipelines}
            />
          )}
          {activeView === 'users' && (
            <UsersScreen api={api} isActive={true} currentUserId={user.id} />
          )}
          {activeView === 'settings' && (
            <SettingsScreen api={api} isActive={true} />
          )}
          <Text dimColor>Tab/Shift+Tab move menu · Ctrl+Q logs out</Text>
        </Box>
      </Box>
    </Box>
  );
}
