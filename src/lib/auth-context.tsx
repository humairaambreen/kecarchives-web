"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Cookies from "js-cookie";
import { auth as authApi, tryRefreshToken, type UserProfile } from "@/lib/api";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  register: (fullName: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_CACHE_KEY = "kec_user";

function readCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const cached = readCachedUser();
    return { user: cached, loading: true, error: null };
  });

  // Ref so the proactive-refresh timer can always see the latest clearTokens
  const clearTokensRef = useRef<() => void>(() => {});

  const setTokens = (access: string, refresh: string) => {
    Cookies.set("access_token", access, { sameSite: "lax", expires: 365 });
    Cookies.set("refresh_token", refresh, { sameSite: "lax", expires: 365 });
  };

  const clearTokens = useCallback(() => {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    localStorage.removeItem(USER_CACHE_KEY);
  }, []);

  useEffect(() => {
    clearTokensRef.current = clearTokens;
  }, [clearTokens]);

  const fetchMe = useCallback(async () => {
    try {
      const user = await authApi.me();
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      setState({ user, loading: false, error: null });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        // Only clear + sign out if the refresh token is also gone.
        // If the refresh token still exists, this 401 came from a transient
        // failure (e.g. backend cold-start ate the refresh call). Keep the
        // cached user — the proactive timer will refresh shortly.
        if (!Cookies.get("refresh_token")) {
          clearTokens();
          setState({ user: null, loading: false, error: null });
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      } else {
        // Network error / server blip — keep cached user visible.
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }, [clearTokens]);

  // ── Startup: restore session ─────────────────────────────────────────────
  useEffect(() => {
    const hasAccess = !!Cookies.get("access_token");
    const hasRefresh = !!Cookies.get("refresh_token");

    if (hasAccess) {
      // apiFetch will silently refresh inside /me if the JWT is already expired
      fetchMe();
    } else if (hasRefresh) {
      // Access token cookie gone (expired or cleared) but refresh token still valid
      tryRefreshToken().then((ok) => {
        if (ok) fetchMe();
        else setState({ user: null, loading: false, error: null });
      });
    } else {
      setState({ user: null, loading: false, error: null });
    }
  }, [fetchMe]);

  // ── Auth-expired event (from apiFetch) ───────────────────────────────────
  // Only fires when the refresh token itself is definitively invalid (cleared
  // by tryRefreshToken on a 401/403 from the /refresh endpoint).
  useEffect(() => {
    const onExpired = () => {
      clearTokensRef.current();
      setState((s) => (s.user ? { user: null, loading: false, error: null } : s));
    };
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const login = useCallback(async (identifier: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tokens = await authApi.login(identifier, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.me();
      setState({ user, loading: false, error: null });
    } catch (err) {
      setState({ user: null, loading: false, error: err instanceof Error ? err.message : "Login failed" });
      throw err;
    }
  }, []);

  const register = useCallback(async (fullName: string, username: string, email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tokens = await authApi.register(fullName, username, email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.me();
      setState({ user, loading: false, error: null });
    } catch (err) {
      setState({ user: null, loading: false, error: err instanceof Error ? err.message : "Registration failed" });
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {});
    clearTokens();
    setState({ user: null, loading: false, error: null });
  }, [clearTokens]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value = useMemo(
    () => ({ ...state, login, register, logout, clearError, refreshUser }),
    [state, login, register, logout, clearError, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
