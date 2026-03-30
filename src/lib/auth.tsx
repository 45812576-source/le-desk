"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getCachedUser(): User | null {
  try {
    const s = localStorage.getItem("cached_user");
    return s ? (JSON.parse(s) as User) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always start with loading:true to match SSR — avoids hydration mismatch
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    async function initAuth() {
      const saved = localStorage.getItem("token");
      if (!saved) {
        setState({ user: null, token: null, loading: false });
        return;
      }

      // Apply cached user immediately so UI renders without waiting for network
      const cached = getCachedUser();
      if (cached) {
        setState({ user: cached, token: saved, loading: true });
      }

      // Validate token in background
      try {
        const res = await fetch("/api/proxy/auth/me", {
          headers: { Authorization: `Bearer ${saved}` },
        });
        if (!res.ok) throw new Error("invalid");
        const user: User = await res.json();
        localStorage.setItem("cached_user", JSON.stringify(user));
        setState({ user, token: saved, loading: false });
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("cached_user");
        setState({ user: null, token: null, loading: false });
      }
    }
    initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/proxy/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "登录失败");
    }

    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("cached_user", JSON.stringify(data.user));
    setState({ user: data.user, token: data.access_token, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setState({ user: null, token: null, loading: false });
    window.location.href = "/login";
  }, []);

  const refreshUser = useCallback(async () => {
    const saved = localStorage.getItem("token");
    if (!saved) return;
    const res = await fetch("/api/proxy/auth/me", {
      headers: { Authorization: `Bearer ${saved}` },
    });
    if (res.ok) {
      const user = await res.json();
      setState((s) => ({ ...s, user }));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
