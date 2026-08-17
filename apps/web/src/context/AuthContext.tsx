import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStorage } from '../lib/apiClient';

export interface CurrentUser {
  id: string;
  email: string;
  role: 'super_admin' | 'tenant_admin' | 'end_user';
  tenantId: string | null;
  mailboxId: string | null;
  isTwoFactorEnabled?: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
}

interface LoginResult {
  require2FA?: boolean;
  mfaToken?: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult | void>;
  login2FA: (mfaToken: string, code: string) => Promise<void>;
  generate2FA: () => Promise<{ secret: string; otpauthUrl: string; qrCodeUrl: string }>;
  enable2FA: (code: string) => Promise<void>;
  disable2FA: (code: string) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    role: CurrentUser['role'];
    tenantId?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hasToken = Boolean(tokenStorage.getAccessToken());
    if (!hasToken) {
      setIsLoading(false);
      return;
    }
    api
      .get<CurrentUser & { accessToken?: string }>('/auth/me')
      .then((res) => {
        if (res.accessToken) {
          const refreshToken = tokenStorage.getRefreshToken() ?? '';
          tokenStorage.setTokens(res.accessToken, refreshToken);
        }
        setUser(res);
      })
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthTokens & LoginResult>('/auth/login', { email, password }, { skipAuth: true });
    if (res.require2FA && res.mfaToken) {
      return { require2FA: true, mfaToken: res.mfaToken };
    }
    if (res.accessToken && res.refreshToken && res.user) {
      tokenStorage.setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
    }
  }, []);

  const login2FA = useCallback(async (mfaToken: string, code: string) => {
    const res = await api.post<AuthTokens>('/auth/login-2fa', { mfaToken, code }, { skipAuth: true });
    tokenStorage.setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const generate2FA = useCallback(async () => {
    return api.post<{ secret: string; otpauthUrl: string; qrCodeUrl: string }>('/auth/2fa/generate');
  }, []);

  const enable2FA = useCallback(async (code: string) => {
    await api.post('/auth/2fa/enable', { code });
    setUser((prev) => (prev ? { ...prev, isTwoFactorEnabled: true } : prev));
  }, []);

  const disable2FA = useCallback(async (code: string) => {
    await api.post('/auth/2fa/disable', { code });
    setUser((prev) => (prev ? { ...prev, isTwoFactorEnabled: false } : prev));
  }, []);

  const register = useCallback(
    async (params: { email: string; password: string; role: CurrentUser['role']; tenantId?: string }) => {
      const res = await api.post<AuthTokens>('/auth/register', params, { skipAuth: true });
      tokenStorage.setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }, { skipAuth: true }).catch(() => undefined);
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, login2FA, generate2FA, enable2FA, disable2FA, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider');
  }
  return ctx;
}

