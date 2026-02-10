'use client';
import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect } from 'react';
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/apiBase";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

// Composants séparés avec display names
const LoadingComponent = function() {
  return <div>Loading...</div>;
};
LoadingComponent.displayName = 'LoadingComponent';

const ErrorComponent = function() {
  return <div>Error loading dashboard</div>; 
};
ErrorComponent.displayName = 'ErrorComponent';

// Composant Dashboard dynamique
const Dashboard = dynamic(() => import('../components/Dashboard').catch(err => {
  console.error('Error loading Dashboard:', err);
  return ErrorComponent;
}), {
  ssr: false,
  loading: LoadingComponent
});
Dashboard.displayName = 'DynamicDashboard';

// Page de connexion affichée lorsqu'on n'est pas authentifié
const LoginLanding = () => {
  const { login, register, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [showPassword, setShowPassword] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'envoi");
      setSuccess("Si cet email existe, un lien de réinitialisation a été envoyé.");
      setEmail("");
    } catch (err) {
      setError(err?.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <LoadingComponent />;

  return (
    <div className="login-gradient-bg flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
        <Image
          src="/images/Logo Eaukey.png"
          alt="Eaukey Logo"
          width={120}
          height={120}
          priority
        />
        <h1 className="text-3xl font-extrabold mt-6 mb-2 text-[var(--primary)] text-center">
          Des données claires pour une eau mieux utilisée.
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6 text-center max-w-md">
          Visualisez vos données en temps réel, identifiez les usages, mesurez le recyclage.
        </p>
        <form
          className="w-full max-w-sm space-y-3"
          onSubmit={mode === "forgot" ? handleForgotPassword : async (e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            setSubmitting(true);
            try {
              if (mode === "register") await register(email, password);
              else await login(email, password);
            } catch (err) {
              setError(err?.message || "Connexion impossible");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--text-primary)]"
            required
          />
          {mode !== "forgot" && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--text-primary)]"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full neon-btn px-8 py-3 bg-[var(--primary)] text-[#04131a] font-semibold rounded-lg transition relative overflow-hidden border border-[var(--primary-strong)] disabled:opacity-60"
          >
            {submitting
              ? mode === "forgot" ? "Envoi..." : mode === "register" ? "Création..." : "Connexion..."
              : mode === "forgot" ? "Envoyer le lien" : mode === "register" ? "Créer un compte" : "Se connecter"}
          </button>
          {error && (
            <p className="text-xs text-[var(--critical)] text-center">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-green-500 text-center">
              {success}
            </p>
          )}
        </form>
        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setMode("forgot");
            }}
            className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] hover:underline"
          >
            Mot de passe oublié ?
          </button>
        )}
        <div className="mt-3 text-xs text-center text-[var(--text-muted)]">
          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setMode("login");
              }}
              className="text-[var(--primary)] hover:underline"
            >
              Retour à la connexion
            </button>
          ) : (
            <>
              {mode === "login" ? "Pas de compte ?" : "Déjà un compte ?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setMode(mode === "login" ? "register" : "login");
                }}
                className="text-[var(--primary)] hover:underline"
              >
                {mode === "login" ? "Créer un compte" : "Se connecter"}
              </button>
            </>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-4 text-center">
          Authentification sécurisée interne.
        </p>
      </div>
    </div>
  );
};

// Composant principal
function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return <LoadingComponent />;
  }

  if (!isAuthenticated) {
    return <LoginLanding />;
  }

  return (
    <main>
      <Suspense fallback={<LoadingComponent />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

Home.displayName = 'Home';
export default Home;
