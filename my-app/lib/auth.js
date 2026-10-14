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

// Sécurité (2026-10-14) : le backend exige désormais un jeton sur toutes ses routes.
// Plusieurs composants appellent l'API avec fetch() directement (sans authFetch) :
// on ajoute donc automatiquement l'en-tête Authorization à toute requête vers
// API_BASE qui n'en a pas déjà un. Sans jeton stocké, la requête part telle quelle.
if (typeof window !== "undefined" && !window.__eaukeyAuthFetch) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
      if (url.startsWith(API_BASE)) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined) || {});
        if (!headers.has("Authorization")) {
          const t = readToken();
          if (t) {
            headers.set("Authorization", `Bearer ${t}`);
            init = { ...(init || {}), headers };
          }
        }
      }
    } catch {}
    return nativeFetch(input, init);
  };
  window.__eaukeyAuthFetch = true;
}

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
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const text = await res.text();
        const message =
          res.status === 404
            ? "Il n'existe pas de compte associé à cette adresse email."
            : res.status === 401
              ? "Mot de passe incorrect."
              : text || "Connexion impossible";
        throw new Error(message);
      }
      const data = await res.json();
      setToken(data.token);
      writeToken(data.token);
      await loadMe(data.token);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  }, [loadMe]);

  const register = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
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
    } finally {
      setIsLoading(false);
    }
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

export const hasRole = (user, role) =>
  Array.isArray(user?.roles) && user.roles.includes(role);

export const isAdmin = (user) => hasRole(user, "admin");
export const isSuperAdmin = (user) => hasRole(user, "super_admin");
export const isOrgAdmin = (user) =>
  user?.org_role === "org_admin" ||
  (Array.isArray(user?.organizations) && user.organizations.some((o) => o.org_role === "org_admin"));
