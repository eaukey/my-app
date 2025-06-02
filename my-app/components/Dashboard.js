"use client";

import React, { useState, useEffect } from "react";
import { Home, BarChart2, Settings, MessageCircle, FileText } from "lucide-react";
import GraphComponent from "./GraphComponent";
import MultiSeriesGraphComponent from "./MultiSeriesGraphComponent";
import RealTimeData from "./RealTimeData";
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

// Configuration des graphiques
const graphConfigs = [
  // Données générales de performance
  {
    title: "Volume renvoi (m³)",
    color: "#2196F3",
    endpoint: (period) => `/renvoi/${period}`,
    category: "performance"
  },
  {
    title: "Volume adoucie (m³)",
    color: "#4CAF50",
    endpoint: (period) => `/adoucie/${period}`,
    category: "performance"
  },
  {
    title: "Volume relevage (m³)",
    color: "#FF9800",
    endpoint: (period) => `/relevage/${period}`,
    category: "performance"
  },
  {
    title: "Volumes (m³)",
    color: "#4CAF50",
    endpoint: (period) => `/volumes_all/${period}`,
    seriesConfig: [
      { key: "vol_renvoi_m3", label: "Renvoi", color: "#2196F3" },
      { key: "vol_adoucie_m3", label: "Adoucie", color: "#4CAF50" },
      { key: "vol_relevage_m3", label: "Relevage", color: "#FFC107" }
    ],
    category: "performance"
  },
  {
    title: "Taux de recyclage (%)",
    color: "#009688",
    endpoint: (period) => `/taux_recyclage/${period}`,
    category: "performance"
  },
  {
    title: "Consommation électrique (kWh)",
    color: "#795548",
    endpoint: (period) => `/compteur_elec/${period}`,
    category: "performance"
  },
  
  // Données techniques
  {
    title: "Taux désinfection (%)",
    color: "#673AB7",
    endpoint: (period) => `/taux_desinfection/${period}`,
    category: "technical"
  },
  {
    title: "Pression (mbar)",
    color: "#2196F3",
    endpoint: (period) => `/pression_all/${period}`,
    seriesConfig: [
      { key: "p1_med_mbar", label: "P1", color: "#2196F3" },
      { key: "p2_med_mbar", label: "P2", color: "#4CAF50" },
      { key: "p3_med_mbar", label: "P3", color: "#FFC107" },
      { key: "p4_med_mbar", label: "P4", color: "#FF5722" },
      { key: "p5_med_mbar", label: "P5", color: "#9C27B0" }
    ],
    category: "technical"
  },
  {
    title: "Température (°C)",
    color: "#E91E63",
    endpoint: (period) => `/temperature/${period}`,
    category: "technical"
  },
  {
    title: "Chlore (mV)",
    color: "#9C27B0",
    endpoint: (period) => `/chlore/${period}`,
    category: "technical"
  },
  {
    title: "pH",
    color: "#FF9800",
    endpoint: (period) => `/ph/${period}`,
    category: "technical"
  }
];

const Dashboard = () => {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const [selectedPeriod, setSelectedPeriod] = useState("jour");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [activeDataCategory, setActiveDataCategory] = useState("performance"); // "performance" ou "technical"
  const [availableMachines, setAvailableMachines] = useState([]);
  const pathname = usePathname();

  const periods = [
    { label: "Jour", value: "jour" },
    { label: "Semaine", value: "semaine" },
    { label: "Mois", value: "mois" },
    { label: "Année", value: "annee" }
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

  // Filtrer les graphiques selon la catégorie active
  const filteredGraphs = graphConfigs.filter(graph => graph.category === activeDataCategory);

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

        {/* Sélection de la station */}
        <div style={{ marginBottom: "24px" }}>
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              width: "100%",
              maxWidth: "300px",
            }}
          >
            <option value="">Sélectionnez une station</option>
            {availableMachines.length > 0 ? (
              availableMachines.map((station, index) => (
                <option key={index} value={station.id}>
                  {station.name}
                </option>
              ))
            ) : (
              <>
                <option value="2022911.0">Herblay</option>
                <option value="2023004.0">Marseille</option>
                <option value="2022912.0">Lyon</option>
              </>
            )}
          </select>
        </div>

        {/* Données en temps réel */}
        {selectedMachine && <RealTimeData selectedMachine={selectedMachine} />}

        {/* Sélection des catégories de données */}
        <div style={{ marginBottom: "24px", display: "flex", gap: "16px" }}>
          <button
            onClick={() => setActiveDataCategory("performance")}
            style={{
              padding: "10px 16px",
              backgroundColor: activeDataCategory === "performance" ? "#41AEAD" : "#eee",
              color: activeDataCategory === "performance" ? "white" : "black",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              flex: 1,
              maxWidth: "300px"
            }}
          >
            Données générales de performance
          </button>
          <button
            onClick={() => setActiveDataCategory("technical")}
            style={{
              padding: "10px 16px",
              backgroundColor: activeDataCategory === "technical" ? "#41AEAD" : "#eee",
              color: activeDataCategory === "technical" ? "white" : "black",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              flex: 1,
              maxWidth: "300px"
            }}
          >
            Données techniques
          </button>
        </div>

        {/* Sélection des périodes */}
        <div style={{ marginBottom: "24px", display: "flex", gap: "8px" }}>
          {periods.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              style={{
                padding: "8px 16px",
                backgroundColor: selectedPeriod === period.value ? "#41AEAD" : "#eee",
                color: selectedPeriod === period.value ? "white" : "black",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Affichage des graphiques filtrés par catégorie */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          {filteredGraphs.map((cfg) => {
            // Si le graphique a une configuration multi-séries, utiliser MultiSeriesGraphComponent
            if (cfg.seriesConfig) {
              return (
                <MultiSeriesGraphComponent
                  key={cfg.title}
                  title={cfg.title}
                  color={cfg.color}
                  selectedPeriod={selectedPeriod}
                  selectedMachine={selectedMachine}
                  endpoint={cfg.endpoint(selectedPeriod)}
                  seriesConfig={typeof cfg.seriesConfig === 'function' ? cfg.seriesConfig(selectedPeriod) : cfg.seriesConfig}
                />
              );
            } 
            // Sinon, utiliser le GraphComponent standard
            return (
              <GraphComponent
                key={cfg.title}
                title={cfg.title}
                color={cfg.color}
                selectedPeriod={selectedPeriod}
                selectedMachine={selectedMachine}
                endpoint={cfg.endpoint(selectedPeriod)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
