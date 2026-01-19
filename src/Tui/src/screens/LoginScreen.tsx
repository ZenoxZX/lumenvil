import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { User } from '../types.js';
import { InputRow } from '../components/InputRow.js';

type LoginScreenProps = {
  api: ApiClient;
  onLogin: (user: User) => void;
};

type ActiveField = 'username' | 'password' | 'submit';

export function LoginScreen({ api, onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeField, setActiveField] = useState<ActiveField>('username');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cycleField = (direction: 1 | -1) => {
    const fields: ActiveField[] = ['username', 'password', 'submit'];
    const currentIndex = fields.indexOf(activeField);
    const nextIndex = (currentIndex + direction + fields.length) % fields.length;
    setActiveField(fields[nextIndex]);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const auth = await api.login(username, password);
      onLogin(auth.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  useInput((input, key) => {
    if (submitting) return;

    if (key.upArrow || key.downArrow) {
      cycleField(key.downArrow ? 1 : -1);
      return;
    }

    if (key.return) {
      if (activeField === 'username') {
        setActiveField('password');
      } else {
        void handleSubmit();
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (activeField === 'username') {
        setUsername((prev) => prev.slice(0, -1));
      } else if (activeField === 'password') {
        setPassword((prev) => prev.slice(0, -1));
      }
      return;
    }

    if (!input) return;

    if (activeField === 'username') {
      setUsername((prev) => prev + input);
    } else if (activeField === 'password') {
      setPassword((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Login</Text>
      <InputRow
        label="Username"
        value={username}
        placeholder="admin"
        focused={activeField === 'username'}
      />
      <InputRow
        label="Password"
        value={password}
        placeholder="password"
        focused={activeField === 'password'}
        masked
      />

      <Box>
        <Text color={activeField === 'submit' ? 'cyan' : undefined}>
          {activeField === 'submit' ? '>' : ' '} [ Sign In ]
        </Text>
      </Box>

      {submitting && <Text color="yellow">Signing in...</Text>}
      {error && <Text color="red">{error}</Text>}

      <Text dimColor>↑/↓ to move. Enter to submit.</Text>
    </Box>
  );
}
