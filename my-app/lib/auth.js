"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "./apiBase";

const AuthContext = createContext(null);
const TOKEN_KEY = "auth_token";

const readToken = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
};

const writeToken = (token) => {
  try {
    if (typeof window === "undefined") return;
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    writeToken(null);
  }, []);

  const authFetch = useCallback(
    (url, options = {}) => {
      const headers = new Headers(options.headers || {});
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  const loadMe = useCallback(async (existingToken) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${existingToken}` },
      });
      if (!res.ok) throw new Error("unauthorized");
      const data = await res.json();
      setUser(data);
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    const t = readToken();
    if (!t) {
      setIsLoading(false);
      return;
    }
    setToken(t);
    loadMe(t);
  }, [loadMe]);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setToken(data.token);
    writeToken(data.token);
    await loadMe(data.token);
    return data.user;
  }, [loadMe]);

  const register = useCallback(async (email, password) => {
    setIsLoading(true);
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setToken(data.token);
    writeToken(data.token);
    await loadMe(data.token);
    return data.user;
  }, [loadMe]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout: clearSession,
      authFetch,
    }),
    [user, token, isLoading, login, register, clearSession, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
