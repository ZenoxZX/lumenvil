import { UserRole } from '../types.js';

const roleHierarchy: Record<UserRole, number> = {
  Viewer: 0,
  Developer: 1,
  Admin: 2,
};

export const normalizeRole = (role: UserRole | number): UserRole => {
  if (typeof role === 'number') {
    const roles: UserRole[] = ['Viewer', 'Developer', 'Admin'];
    return roles[role] || 'Viewer';
  }
  return role;
};

export const hasRole = (role: UserRole | number, required: UserRole): boolean => {
  const normalized = normalizeRole(role);
  return roleHierarchy[normalized] >= roleHierarchy[required];
};
