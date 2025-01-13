"use client";
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";

export default function PrivateRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuth0();
  const router = useRouter();

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (!isAuthenticated) {
    router.push("/"); // Redirige vers la page de connexion
    return null;
  }

  return <>{children}</>;
}
