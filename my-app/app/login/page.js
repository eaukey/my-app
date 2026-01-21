"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth0();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    try {
      await login({ email, password });
      router.replace("/");
    } catch (err) {
      setLocalError(err.message || "Échec de connexion");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-6 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">Connexion</h1>
        <div className="space-y-2">
          <label className="text-sm text-[var(--text-secondary)]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-input)]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-[var(--text-secondary)]">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-input)]"
          />
        </div>
        {(localError || error) && (
          <p className="text-sm text-[var(--critical)]">{localError || error}</p>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 rounded bg-[var(--primary)] text-[#04131a] font-semibold disabled:opacity-60"
        >
          {isLoading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}





