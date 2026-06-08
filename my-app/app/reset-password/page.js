'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../../lib/apiBase';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setError('Token manquant. Veuillez utiliser le lien envoyé par email.');
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/validate-reset-token?token=${token}`);
        if (!res.ok) {
          setError('Ce lien est invalide ou a expiré. Veuillez faire une nouvelle demande.');
          setTokenValid(false);
        } else {
          const data = await res.json();
          setTokenValid(true);
          setUserEmail(data.email || '');
        }
      } catch {
        setError('Erreur de validation du lien.');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Erreur lors de la réinitialisation.');
      }

      setSuccess('Mot de passe réinitialisé avec succès ! Redirection...');
      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      setError(err?.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="login-gradient-bg flex items-center justify-center min-h-screen px-4">
        <div className="flex flex-col items-center bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-6 sm:p-10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-[var(--text-secondary)]">Validation du lien...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-gradient-bg flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md sm:w-auto sm:max-w-none flex flex-col items-center bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-6 sm:p-10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
        <Image
          src="/images/Logo Eaukey.png"
          alt="Eaukey Logo"
          width={120}
          height={120}
          priority
        />
        <h1 className="text-2xl font-bold mt-6 mb-2 text-[var(--primary)] text-center">
          Réinitialiser le mot de passe
        </h1>

        {!tokenValid ? (
          <div className="w-full max-w-sm space-y-4">
            <p className="text-sm text-[var(--critical)] text-center">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full neon-btn px-8 py-3 bg-[var(--primary)] text-[#04131a] font-semibold rounded-lg transition border border-[var(--primary-strong)]"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            {userEmail && (
              <p className="text-sm text-[var(--text-secondary)] mb-4 text-center">
                Pour le compte : <span className="text-[var(--text-primary)]">{userEmail}</span>
              </p>
            )}
            <form className="w-full max-w-sm space-y-3" onSubmit={handleSubmit}>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nouveau mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--text-primary)]"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--text-primary)]"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full neon-btn px-8 py-3 bg-[var(--primary)] text-[#04131a] font-semibold rounded-lg transition relative overflow-hidden border border-[var(--primary-strong)] disabled:opacity-60"
              >
                {submitting ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>
              {error && (
                <p className="text-xs text-[var(--critical)] text-center">{error}</p>
              )}
              {success && (
                <p className="text-xs text-green-500 text-center">{success}</p>
              )}
            </form>
          </>
        )}

        <p className="text-[11px] text-[var(--text-muted)] mt-4 text-center">
          Authentification sécurisée interne.
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="login-gradient-bg flex items-center justify-center min-h-screen px-4">
        <div className="flex flex-col items-center bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-6 sm:p-10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-[var(--text-secondary)]">Chargement...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
