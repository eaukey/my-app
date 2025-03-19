"use client";

import React, { useState, useEffect } from "react";
import { Home, BarChart2, Settings, MessageCircle, FileText } from "lucide-react";
import GraphComponent from "./GraphComponent";
import { useAuth0 } from "@auth0/auth0-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from 'next/image';

const stationMapping = {
  "2022124.0": "bourgoin",
  "2022128.0": "St jean de soudain",
  "2022127.0": "Villefontaine",
  "2022123.0": "Froges",
  "2022121.0": "SMH1",
  "2024405.0": "Chambéry",
  "202202.0": "Marseille",
  "2022071.0": "Paul Claudel",
  "20220910.0": "Aix",
  "2023319.0": "Cabassud",
  "2022099.0": "Salon de provence",
  "2022083.0": "Herblay",
  "20221214.0": "Fontenay",
  "2023021.0": "Enval",
  "2022084.0": "Marnaz",
  "2022129.0": "Pertuis",
  "2023047.0": "Marseille",
  "2022092.0": "Roseraie / Carrefour",
  "2022091.0": "Louis Delage / Polygone",
  "20230618.0": "Rognac",
  "2022911.0": "Saint Ambroix",
  "2023039.0": "Mions",
  "20231106.0": "Givors",
  "2023063.0": "Chatel-Guyon",
  "2023096.0": "Bouc-Bel-Air",
  "2023018.0": "Coignières",
  "2023619.0": "Prunelli-di-Fiumorbo (Corse)",
  "2024715.0": "Station Vito - Cervione",
  "20240714.0": "Sorbo - Ocagnano",
  "2023117.0": "Authon du Perche",
  "2023322.0": "Orleans",
  "2023510.0": "Annecy",
  "20240710.0": "La Riche",
  "2024081.0": "Gruissan",
  "20231014.0": "Saint Gervais la Forêt",
  "20241020.0": "Relais Arinella Bastia",
  "20241022.0": "Relais Balagne Calvi",
  "2024123.0": "Relais Moriani San Nicolas",
  "2024119.0": "Relais de Furiani",
  "2024121.0": "Station Algojola",
  "2024125.0": "Ets Marcel Ferrari",
  "2024102.0": "Relais Alistro",
  "20241026.0": "Relais Porticcio",
};

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

// Récupérer les stations disponibles depuis les métadonnées utilisateur
useEffect(() => {
  if (isAuthenticated && user) {
    const machines = user["https://app.com/machines"] || [];
    if (machines && machines.length > 0) {
      const mappedStations = machines.map((id) => ({
        id: id, // Conserver le numéro (ex. "2022124.0")
        name: stationMapping[id] || `Station inconnue (${id})`, // Nom mappé
      }));
      setAvailableMachines(mappedStations); // Stocker les objets { id, name }
      setSelectedMachine(mappedStations[0]?.id || ""); // Sélectionner le premier numéro
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
        <Image 
            src="/images/eaukey-logo.svg.png" 
            alt="Eaukey Logo"
            width={48}
            height={48}
            className="w-12"
            priority
          />
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
                  backgroundColor: "#41AEAD",
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
                backgroundColor: "#41AEAD",
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
            availableMachines.map((station, index) => (
              <option key={index} value={station.id}>
                {station.name}
              </option>
            ))
          ) : (
            <option value="">Aucune station disponible</option>
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
