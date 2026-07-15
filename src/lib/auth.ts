// Simple auth system for 2 partners
// Passwords stored as simple strings (local app, no sensitive data risk)

import type { AppUser } from '../types';

const USERS: Record<string, { password: string; user: AppUser }> = {
  'jorge': {
    password: '141414',
    user: { id: 'jorge', name: 'Jorge Quispe', role: 'Administrador', avatar: 'JQ' }
  },
  'isamar': {
    password: '151515',
    user: { id: 'isamar', name: 'Isamar Silvestre', role: 'Administrador', avatar: 'IS' }
  }
};

export const login = (username: string, password: string): AppUser | null => {
  const entry = USERS[username.toLowerCase().trim()];
  if (entry && entry.password === password) {
    localStorage.setItem('zigma_session', JSON.stringify(entry.user));
    return entry.user;
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem('zigma_session');
};

export const getCurrentUser = (): AppUser | null => {
  const session = localStorage.getItem('zigma_session');
  if (!session) return null;
  try { return JSON.parse(session); } catch { return null; }
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};
