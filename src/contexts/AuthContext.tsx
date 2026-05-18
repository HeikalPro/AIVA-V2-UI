import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiGet,
  apiPost,
  clearTokens,
  getAccessToken,
  setTokens,
  startZohoLogin,
} from "@/lib/api-client";
import type { TokenResponse, UserProfile } from "@/types/api";

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithZoho: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    const profile = await apiGet<UserProfile>("/api/auth/me");
    setUser(profile);
  }, []);

  useEffect(() => {
    refreshProfile()
      .catch(() => {
        clearTokens();
        setUser(null);
        queryClient.clear();
      })
      .finally(() => setLoading(false));
  }, [refreshProfile, queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await apiPost<TokenResponse>("/api/auth/login", { email, password }, false);
      queryClient.clear();
      setTokens(tokens);
      await refreshProfile();
    },
    [queryClient, refreshProfile],
  );

  const loginWithZoho = useCallback(() => {
    startZohoLogin();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/auth/logout");
    } finally {
      clearTokens();
      queryClient.clear();
      setUser(null);
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, login, loginWithZoho, logout, refreshProfile }),
    [user, loading, login, loginWithZoho, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
