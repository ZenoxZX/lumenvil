import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiClient } from '../api/client.js';
import { User, UserRole } from '../types.js';
import { InputRow } from '../components/InputRow.js';
import { normalizeRole } from '../utils/role.js';

const roleOptions: UserRole[] = ['Viewer', 'Developer', 'Admin'];

type Mode = 'list' | 'form' | 'delete';

type FieldId = 'username' | 'email' | 'password' | 'role';

const fields: FieldId[] = ['username', 'email', 'password', 'role'];

const labelMap: Record<FieldId, string> = {
  username: 'Username',
  email: 'Email',
  password: 'Password',
  role: 'Role',
};

const defaultForm = {
  username: '',
  email: '',
  password: '',
  role: 'Developer' as UserRole,
};

type UsersScreenProps = {
  api: ApiClient;
  isActive: boolean;
  currentUserId?: string;
};

export function UsersScreen({ api, isActive, currentUserId }: UsersScreenProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [formFieldIndex, setFormFieldIndex] = useState(0);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [status, setStatus] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) return;
    void fetchUsers();
  }, [fetchUsers, isActive]);

  const activeField = fields[formFieldIndex];

  const startCreate = () => {
    setMode('form');
    setFormData({ ...defaultForm });
    setFormFieldIndex(0);
    setStatus(null);
  };

  const startDelete = () => {
    const user = users[selectedIndex];
    if (!user) return;
    setMode('delete');
    setDeletingUser(user);
  };

  const cancelDelete = () => {
    setMode('list');
    setDeletingUser(null);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setStatus('Deleting user...');
    try {
      await api.deleteUser(deletingUser.id);
      setStatus('User deleted.');
      setMode('list');
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to delete user.');
      setMode('list');
      setDeletingUser(null);
    }
  };

  const handleSubmit = async () => {
    setStatus(null);
    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setStatus('Username, email, and password are required.');
      return;
    }

    try {
      await api.createUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      setStatus('User created.');
      setMode('list');
      await fetchUsers();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to create user.');
    }
  };

  const updateRole = async (user: User, direction: 1 | -1) => {
    const current = normalizeRole(user.role);
    const currentIndex = roleOptions.indexOf(current);
    const nextIndex = (currentIndex + direction + roleOptions.length) % roleOptions.length;
    const nextRole = roleOptions[nextIndex];
    setStatus(`Updating ${user.username} role to ${nextRole}...`);
    try {
      await api.updateUserRole(user.id, { role: nextRole });
      await fetchUsers();
      setStatus('Role updated.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  useInput((input, key) => {
    if (!isActive) return;

    if (mode === 'list') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(users.length - 1, prev + 1));
      }
      if (input === 'r') {
        void fetchUsers();
      }
      if (input === 'c') {
        startCreate();
      }
      if (input === 'd') {
        startDelete();
      }
      if (key.leftArrow || key.rightArrow) {
        const user = users[selectedIndex];
        if (user) void updateRole(user, key.rightArrow ? 1 : -1);
      }
      return;
    }

    if (mode === 'delete') {
      if (input === 'y') {
        void confirmDelete();
      }
      if (input === 'n' || key.escape) {
        cancelDelete();
      }
      return;
    }

    if (mode === 'form') {
      if (key.escape) {
        setMode('list');
        return;
      }

      if (key.ctrl && input === 's') {
        void handleSubmit();
        return;
      }

      if (key.upArrow || key.downArrow) {
        setFormFieldIndex((prev) => {
          if (key.downArrow) return (prev + 1) % fields.length;
          return (prev - 1 + fields.length) % fields.length;
        });
        return;
      }

      if (activeField === 'role' && (key.leftArrow || key.rightArrow)) {
        const currentIndex = roleOptions.indexOf(formData.role);
        const nextIndex = (currentIndex + (key.rightArrow ? 1 : -1) + roleOptions.length) % roleOptions.length;
        setFormData((prev) => ({ ...prev, role: roleOptions[nextIndex] }));
        return;
      }

      if (key.backspace || key.delete) {
        if (activeField !== 'role') {
          setFormData((prev) => ({ ...prev, [activeField]: prev[activeField].slice(0, -1) }));
        }
        return;
      }

      if (!input) return;

      if (activeField !== 'role') {
        setFormData((prev) => ({ ...prev, [activeField]: `${prev[activeField]}${input}` }));
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Users</Text>
        <Text color="yellow">Loading users...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Users</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (mode === 'delete' && deletingUser) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Delete User</Text>
        <Text>Delete "{deletingUser.username}"? (y/n)</Text>
        {status && <Text color="yellow">{status}</Text>}
      </Box>
    );
  }

  if (mode === 'form') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>New User</Text>
        <Text dimColor>↑/↓ move · Ctrl+S save · Esc cancel · left/right to change role</Text>
        {fields.map((fieldId, index) => {
          const focused = activeField === fieldId && formFieldIndex === index;
          const value = formData[fieldId];
          return (
            <InputRow
              key={fieldId}
              label={labelMap[fieldId]}
              value={String(value)}
              focused={focused}
              masked={fieldId === 'password'}
            />
          );
        })}
        {status && <Text color={status.includes('Failed') ? 'red' : 'yellow'}>{status}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Users</Text>
      {users.length === 0 && <Text dimColor>No users found.</Text>}
      {users.map((user, index) => {
        const selected = index === selectedIndex;
        const role = normalizeRole(user.role);
        const isCurrent = currentUserId === user.id;
        return (
          <Text key={user.id} color={selected ? 'black' : undefined} backgroundColor={selected ? 'cyan' : undefined}>
            {selected ? '>' : ' '} {user.username} · {role}{isCurrent ? ' (you)' : ''}
          </Text>
        );
      })}
      <Text dimColor>c create · d delete · left/right change role · r refresh</Text>
      {status && <Text color="yellow">{status}</Text>}
    </Box>
  );
}
