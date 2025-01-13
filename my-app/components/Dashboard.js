"use client";

import React, { useState, useEffect } from "react";
import { Home, BarChart2, Settings, MessageCircle, FileText } from "lucide-react";
import GraphComponent from "./GraphComponent";
import { useAuth0 } from "@auth0/auth0-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const [selectedPeriod, setSelectedPeriod] = useState("jour");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [availableMachines, setAvailableMachines] = useState([]);
  const pathname = usePathname();

  const periods = ["jour", "semaine", "mois", "annee"];
  const titles = [
    { title: "Volume renvoi (m³)", color: "#2196F3" },
    { title: "Volume adoucie (m³)", color: "#4CAF50" },
    { title: "Volume relevage (m³)", color: "#FF9800" },
    { title: "Pression station (mbar)", color: "#9C27B0" },
    { title: "Taux recyclage (%)", color: "#3F51B5" },
    { title: "Taux désinfection (%)", color: "#795548" },
  ];

  // Récupérer les machines disponibles depuis les métadonnées utilisateur
  useEffect(() => {
    if (isAuthenticated && user) {
      const machines = user["https://app.com/machines"]; // Récupérer les métadonnées
      if (machines && machines.length > 0) {
        setAvailableMachines(machines); // Ajouter les machines au menu déroulant
        setSelectedMachine(machines[0]); // Par défaut, sélectionner la première machine
      }
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Barre de navigation */}
      <div className="w-16 min-h-screen fixed bg-[#41AEAD] flex flex-col items-center">
        {/* Logo */}
        <div className="py-4">
          <svg viewBox="0 0 100 120" className="w-12">
            <path d="M50 5 L95 60 L95 90 L50 115 L5 90 L5 60 Z" fill="white" />
            <text x="50" y="70" textAnchor="middle" fill="#41AEAD" style={{ fontSize: "16px" }}>
              Eaukey
            </text>
          </svg>
        </div>

        {/* Icônes de navigation */}
        <div className="flex flex-col items-center flex-grow space-y-6 mt-6">
          {[
            { icon: Home, href: "/", title: "Accueil" },
            { icon: BarChart2, href: "/stock", title: "Stock" },
            { icon: Settings, href: "/pilotage", title: "Pilotage" },
            { icon: MessageCircle, href: "/chat", title: "Chat" },
            { icon: FileText, href: "/documents", title: "Documents" },
          ].map(({ icon: Icon, href, title }) => (
            <Link
              key={href}
              href={href}
              className={`w-12 h-12 flex items-center justify-center ${
                pathname === href ? "bg-white rounded-lg" : "hover:bg-white hover:bg-opacity-10 rounded-lg"
              }`}
              title={title}
            >
              <Icon size={24} className={pathname === href ? "text-[#41AEAD]" : "text-white"} />
            </Link>
          ))}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 p-8 ml-16">
        {/* En-tête avec bouton Connexion/Déconnexion */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
          {isAuthenticated ? (
            <>
              <h1>Bienvenue, {user?.name || "Utilisateur"}</h1>
              <button
                onClick={() => logout({ returnTo: window.location.origin })}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              onClick={() => loginWithRedirect()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Connexion
            </button>
          )}
        </div>

        {/* Sélection des filtres */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
          {/* Périodes */}
          <div style={{ display: "flex", gap: "8px" }}>
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: selectedPeriod === period ? "#41AEAD" : "#E5E7EB",
                  color: selectedPeriod === period ? "white" : "black",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Sélection de la machine */}
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            style={{ padding: "8px", borderRadius: "8px", minWidth: "200px" }}
          >
            {availableMachines.length > 0 ? (
              availableMachines.map((machine, index) => (
                <option key={index} value={machine}>
                  {machine}
                </option>
              ))
            ) : (
              <option value="">Aucune machine disponible</option>
            )}
          </select>
        </div>

        {/* Affichage des graphiques */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          {titles.map(({ title, color }) => (
            <GraphComponent
              key={title}
              title={title}
              color={color}
              selectedPeriod={selectedPeriod}
              selectedMachine={selectedMachine}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
