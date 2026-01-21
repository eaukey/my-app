"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

export default function PrivateRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuth();
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
