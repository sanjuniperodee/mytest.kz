import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from '../client';
import { useTelegram } from '../../lib/telegram';
import type { User, AuthResponse } from '../types';
import { setThemePreference } from '../../lib/theme';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (initData: string) => Promise<void>;
  loginWithCode: (phone: string, code: string) => Promise<void>;
  requestCode: (phone: string) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => {},
  loginWithCode: async () => {},
  requestCode: async () => {},
  refreshUser: async () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { webApp, isTelegram } = useTelegram();

  const fetchProfile = useCallback(async (): Promise<User | null> => {
    try {
      const { data } = await api.get('/users/me');
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Auto-login
  useEffect(() => {
    async function autoLogin() {
      if (getAccessToken()) {
        const profile = await fetchProfile();
        if (profile) {
          setThemePreference('light');
          setIsLoading(false);
          return;
        }
        clearTokens();
      }

      // initData из контекста или окна: до первого setState в TelegramProvider эффект Auth мог
      // уже завершиться без входа и отправить на /login — читаем window как запасной вариант.
      const initDataRaw = (
        webApp?.initData ||
        (typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '') ||
        ''
      ).trim();

      if (initDataRaw) {
        try {
          const { data } = await api.post<AuthResponse>('/auth/telegram', {
            initData: initDataRaw,
          });
          setTokens(data.accessToken, data.refreshToken);
          setThemePreference('light');
          setUser(data.user);
        } catch {
          // Telegram auth failed (неверный hash / другой TELEGRAM_BOT_TOKEN на API, сеть, CORS)
        }
      }

      setIsLoading(false);
    }

    autoLogin();
  }, [isTelegram, webApp, fetchProfile]);

  const login = useCallback(async (initData: string) => {
    const { data } = await api.post<AuthResponse>('/auth/telegram', { initData });
    setTokens(data.accessToken, data.refreshToken);
    setThemePreference('light');
    setUser(data.user);
  }, []);

  const requestCode = useCallback(async (phone: string) => {
    await api.post('/auth/web/request-code', { phone });
  }, []);

  const loginWithCode = useCallback(async (phone: string, code: string) => {
    const { data } = await api.post<AuthResponse>('/auth/web/verify-code', {
      phone,
      code,
    });
    setTokens(data.accessToken, data.refreshToken);
    setThemePreference('light');
    setUser(data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    return fetchProfile();
  }, [fetchProfile]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithCode, requestCode, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
