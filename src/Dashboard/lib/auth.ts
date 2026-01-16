'use client';

import { User, AuthResponse } from '@/types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
}

export function setAuth(auth: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function hasRole(requiredRole: 'Admin' | 'Developer' | 'Viewer'): boolean {
  const user = getUser();
  if (!user) return false;

  // Backend sends role as number (enum): 0=Viewer, 1=Developer, 2=Admin
  // Convert to hierarchy value for comparison
  const roleHierarchy = { 'Admin': 2, 'Developer': 1, 'Viewer': 0 };
  const userRoleValue = typeof user.role === 'number' ? user.role : roleHierarchy[user.role as keyof typeof roleHierarchy] ?? 0;

  return userRoleValue >= roleHierarchy[requiredRole];
}
