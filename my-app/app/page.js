'use client';
import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import Image from "next/image";

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
  const { loginWithRedirect, isLoading } = useAuth0();

  if (isLoading) return <LoadingComponent />;

  return (
    <div className="login-gradient-bg flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
        <Image
          src="/images/eaukey-logo.svg.png"
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
        <button
          onClick={() => loginWithRedirect()}
          className="neon-btn px-8 py-3 bg-[var(--primary)] text-[#04131a] font-semibold rounded-lg transition relative overflow-hidden border border-[var(--primary-strong)]"
        >
          Se connecter
        </button>
        <p className="text-[11px] text-[var(--text-muted)] mt-4 text-center">
          Authentification sécurisée via Auth0.
        </p>
      </div>
    </div>
  );
};

// Composant principal
function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, isLoading } = useAuth0();

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
