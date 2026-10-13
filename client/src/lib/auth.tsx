import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, UserDto } from '@gantt/shared';

import { apiRequest, getToken, setToken } from '../api/client';

/**
 * Sesi pengguna (blueprint bagian 8). Token disimpan di localStorage; seluruh
 * data aplikasi selalu diambil dari API, bukan dari penyimpanan browser.
 */

interface AuthContextValue {
  user: UserDto | null;
  /** false selama pemeriksaan sesi awal belum selesai. */
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession(): Promise<void> {
      if (!getToken()) {
        setIsReady(true);
        return;
      }

      try {
        const response = await apiRequest<{ user: UserDto }>('/auth/me');
        if (!cancelled) setUser(response.user);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = (): void => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('gantt:unauthorized', onUnauthorized);
    return () => window.removeEventListener('gantt:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const response = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    setToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isReady, login, register, logout }),
    [user, isReady, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}
