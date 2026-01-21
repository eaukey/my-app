"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { API_BASE } from "./apiBase";

const AuthContext = createContext(null);

function normalizeUser(data) {
  if (!data) return null;
  const roleLower = (data.role || "").toLowerCase();
  return {
    ...data,
    role: roleLower,
    roles: roleLower ? [roleLower] : [],
    "https://app.com/role": roleLower,
    "https://app.com/roles": roleLower ? [roleLower] : [],
  };
}

export function Auth0Provider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMe = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error("unauth");
      const data = await res.json();
      setUser(normalizeUser(data));
      setError(null);
    } catch (_) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Login failed");
      }
      const data = await res.json();
      setUser(normalizeUser(data));
      setError(null);
      return data;
    } catch (e) {
      setUser(null);
      setError(e.message || "Login failed");
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setUser(null);
  }, []);

  const loginWithRedirect = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      loginWithRedirect,
      getAccessTokenSilently: async () => null,
    }),
    [user, isLoading, error, login, logout, loginWithRedirect]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth0() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth0 must be used within Auth0Provider");
  }
  return ctx;
}




