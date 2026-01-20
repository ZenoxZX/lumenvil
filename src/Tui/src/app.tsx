import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { ApiClient } from './api/client.js';
import { ConfigStore, CONFIG_PATH } from './config.js';
import { User } from './types.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { MainShell } from './screens/MainShell.js';
import { connectToHub, disconnectFromHub } from './signalr.js';

const configStore = new ConfigStore();

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export default function App() {
  const api = useMemo(() => new ApiClient(configStore), []);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<User | null>(configStore.get().user || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { token } = configStore.get();
      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const current = await api.getCurrentUser();
        configStore.update({ user: current });
        setUser(current);
        setStatus('authenticated');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load session.';
        configStore.clearAuth();
        setUser(null);
        setError(message);
        setStatus('unauthenticated');
      }
    };

    void checkAuth();
  }, [api]);

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;

    void connectToHub(configStore);

    return () => {
      void disconnectFromHub();
    };
  }, [status, user]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const interval = setInterval(() => {
      api.getCurrentUser()
        .then((current) => {
          configStore.update({ user: current });
          setUser(current);
        })
        .catch(() => {
          configStore.clearAuth();
          setUser(null);
          setError('Session expired. Please login again.');
          setStatus('unauthenticated');
        });
    }, 10000);

    return () => clearInterval(interval);
  }, [api, status]);

  const config = configStore.get();

  const handleLogin = (nextUser: User) => {
    setUser(nextUser);
    setError(null);
    setStatus('authenticated');
  };

  const handleLogout = () => {
    configStore.clearAuth();
    setUser(null);
    setStatus('unauthenticated');
  };

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Box flexDirection="column">
        <Text dimColor>Config: {CONFIG_PATH}</Text>
        <Text dimColor>API: {config.apiBase || 'unset'}</Text>
        <Text dimColor>Hub: {config.hubUrl || 'unset'}</Text>
      </Box>

      {status === 'checking' && <Text>Checking session...</Text>}
      {status === 'unauthenticated' && (
        <LoginScreen api={api} onLogin={handleLogin} />
      )}
      {status === 'authenticated' && user && (
        <MainShell user={user} api={api} onLogout={handleLogout} />
      )}
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
