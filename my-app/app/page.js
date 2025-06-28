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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center bg-white p-10 rounded-xl shadow-md">
        <Image
          src="/images/eaukey-logo.svg.png"
          alt="Eaukey Logo"
          width={120}
          height={120}
          priority
        />
        <h1 className="text-2xl font-bold mt-6 mb-4 text-[#41AEAD] text-center">
          Bienvenue sur Eaukey
        </h1>
        <button
          onClick={() => loginWithRedirect()}
          className="px-6 py-3 bg-[#41AEAD] text-white rounded-lg hover:bg-[#379c9a] transition"
        >
          Se connecter
        </button>
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
