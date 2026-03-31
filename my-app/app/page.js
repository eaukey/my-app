'use client';
import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/apiBase";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";

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

// Composant bulle d'eau individuelle animée avec GSAP
const WaterBubble = ({ index, containerRef }) => {
  const bubbleRef = useRef(null);

  useEffect(() => {
    const el = bubbleRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const size = gsap.utils.random(8, 40);
    const startX = gsap.utils.random(0, 100);
    const duration = gsap.utils.random(4, 10);
    const delay = gsap.utils.random(0, 6);

    gsap.set(el, {
      width: size,
      height: size,
      left: `${startX}%`,
      bottom: '-10%',
      opacity: 0,
      scale: 0,
    });

    const tl = gsap.timeline({ repeat: -1, delay });

    tl.to(el, {
      bottom: '110%',
      opacity: gsap.utils.random(0.15, 0.5),
      scale: 1,
      duration,
      ease: 'none',
    })
    .to(el, {
      opacity: 0,
      scale: 0.5,
      duration: duration * 0.2,
    }, `-=${duration * 0.2}`)
    .set(el, {
      bottom: '-10%',
      left: `${gsap.utils.random(0, 100)}%`,
      scale: 0,
    });

    // Mouvement latéral sinusoïdal
    gsap.to(el, {
      x: `+=${gsap.utils.random(-60, 60)}`,
      duration: gsap.utils.random(2, 4),
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });

    return () => {
      gsap.killTweensOf(el);
    };
  }, [containerRef, index]);

  return (
    <div
      ref={bubbleRef}
      className="absolute rounded-full pointer-events-none"
      style={{
        background: 'radial-gradient(circle at 30% 30%, rgba(65, 174, 173, 0.4), rgba(65, 174, 173, 0.08))',
        border: '1px solid rgba(65, 174, 173, 0.2)',
        boxShadow: 'inset 0 -2px 6px rgba(65, 174, 173, 0.15), 0 0 8px rgba(65, 174, 173, 0.1)',
      }}
    />
  );
};

// Bulles qui apparaissent au hover de la souris
const HoverBubbles = ({ containerRef }) => {
  const [bubbles, setBubbles] = useState([]);
  const bubblesContainerRef = useRef(null);
  const nextId = useRef(0);

  const handleMouseMove = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (Math.random() > 0.7) return; // throttle

    const id = nextId.current++;
    setBubbles(prev => [...prev.slice(-15), { id, x, y }]);

    // Nettoyer après animation
    setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id));
    }, 2000);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, [containerRef, handleMouseMove]);

  return (
    <div ref={bubblesContainerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      <AnimatePresence>
        {bubbles.map(({ id, x, y }) => {
          const size = Math.random() * 20 + 6;
          return (
            <motion.div
              key={id}
              initial={{ x, y, scale: 0, opacity: 0.6 }}
              animate={{
                y: y - 120 - Math.random() * 80,
                x: x + (Math.random() - 0.5) * 80,
                scale: 1,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 + Math.random(), ease: 'easeOut' }}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                background: 'radial-gradient(circle at 30% 30%, rgba(65, 174, 173, 0.5), rgba(65, 174, 173, 0.1))',
                border: '1px solid rgba(65, 174, 173, 0.3)',
                boxShadow: 'inset 0 -1px 4px rgba(65, 174, 173, 0.2)',
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

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
  const leftPanelRef = useRef(null);
  const bubbleContainerRef = useRef(null);

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
    <div className="login-gradient-bg flex min-h-screen">
      {/* Panneau gauche — Logo + Branding */}
      <div
        ref={leftPanelRef}
        className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col items-center justify-center overflow-hidden"
      >
        {/* Bulles d'eau ambiantes GSAP */}
        <div ref={bubbleContainerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <WaterBubble key={i} index={i} containerRef={bubbleContainerRef} />
          ))}
        </div>

        {/* Bulles interactives au hover */}
        <HoverBubbles containerRef={leftPanelRef} />

        {/* Halo lumineux derrière le logo */}
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(65, 174, 173, 0.5) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Contenu logo + texte */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-20 flex flex-col items-center"
        >
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Image
              src="/images/Logo Eaukey.png"
              alt="Eaukey Logo"
              width={160}
              height={160}
              priority
              className="drop-shadow-[0_0_30px_rgba(65,174,173,0.4)]"
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl xl:text-6xl font-extrabold mt-8 tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #41AEAD 0%, #6dd5d4 50%, #41AEAD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Eaukey
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-[var(--text-secondary)] mt-4 text-lg text-center max-w-md leading-relaxed"
          >
            Des données claires pour une eau mieux utilisée.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-[var(--text-muted)] mt-2 text-sm text-center max-w-sm"
          >
            Visualisez vos données en temps réel, identifiez les usages, mesurez le recyclage.
          </motion.p>
        </motion.div>

        {/* Ligne de séparation verticale subtile */}
        <div className="absolute right-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-[var(--primary)]/20 to-transparent" />
      </div>

      {/* Panneau droit — Formulaire */}
      <div className="flex w-full lg:w-1/2 xl:w-[45%] items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Logo visible uniquement sur mobile */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image
              src="/images/Logo Eaukey.png"
              alt="Eaukey Logo"
              width={100}
              height={100}
              priority
            />
            <h1 className="text-3xl font-extrabold mt-4 text-[var(--primary)]">Eaukey</h1>
          </div>

          {/* Card formulaire */}
          <div className="bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)] p-8 sm:p-10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                  {mode === "forgot" ? "Mot de passe oublié" : mode === "register" ? "Créer un compte" : "Connexion"}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  {mode === "forgot"
                    ? "Entrez votre email pour recevoir un lien de réinitialisation."
                    : mode === "register"
                    ? "Remplissez vos informations pour commencer."
                    : "Connectez-vous à votre espace Eaukey."}
                </p>
              </motion.div>
            </AnimatePresence>

            <form
              className="space-y-4"
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
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--primary-strong)] focus:border-[var(--primary)]"
                  required
                />
              </div>
              {mode !== "forgot" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--primary-strong)] focus:border-[var(--primary)]"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </motion.div>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      setMode("forgot");
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors duration-200"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full neon-btn px-8 py-3.5 bg-[var(--primary)] text-[#04131a] font-semibold rounded-xl transition relative overflow-hidden border border-[var(--primary-strong)] disabled:opacity-60 text-sm tracking-wide"
              >
                {submitting
                  ? mode === "forgot" ? "Envoi..." : mode === "register" ? "Création..." : "Connexion..."
                  : mode === "forgot" ? "Envoyer le lien" : mode === "register" ? "Créer un compte" : "Se connecter"}
              </motion.button>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-[var(--critical)] text-center"
                  >
                    {error}
                  </motion.p>
                )}
                {success && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-green-500 text-center"
                  >
                    {success}
                  </motion.p>
                )}
              </AnimatePresence>
            </form>

            <div className="mt-5 pt-5 border-t border-[var(--border-subtle)] text-center">
              <div className="text-xs text-[var(--text-muted)]">
                {mode === "forgot" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      setMode("login");
                    }}
                    className="text-[var(--primary)] hover:underline transition-colors duration-200"
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
                      className="text-[var(--primary)] hover:underline font-medium transition-colors duration-200"
                    >
                      {mode === "login" ? "Créer un compte" : "Se connecter"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] mt-4 text-center">
              Authentification sécurisée interne.
            </p>
          </div>
        </motion.div>
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
