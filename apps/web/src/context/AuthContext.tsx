import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, clearTokens, getAccessToken, setTokens } from "../lib/api";
import type { AuthenticatedUser } from "../lib/types";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    ageConfirmed: true;
    referralCode?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.post<AuthenticatedUser>("/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.post<AuthTokens>("/auth/login", { email, password });
      setTokens(tokens.accessToken, tokens.refreshToken);
      await loadMe();
    },
    [loadMe],
  );

  const register = useCallback(
    async (input: { email: string; password: string; ageConfirmed: true; referralCode?: string }) => {
      const tokens = await api.post<AuthTokens>("/auth/register", input);
      setTokens(tokens.accessToken, tokens.refreshToken);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
