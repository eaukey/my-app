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

// Le mapping station <-> nom est désormais récupéré dynamiquement depuis l'API
// via l'endpoint /recherche/automate_LCA (sans paramètre).

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
  // Liste complète des automates récupérés depuis l'API
  const [allAutomates, setAllAutomates] = useState([]);
  // Mapping <id automate> ➜ libellé d'affichage (lieu ou client)
  const [stationMapping, setStationMapping] = useState({});
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
    // 1️⃣ Récupère le mapping complet depuis l'API au premier rendu
    const fetchStationMapping = async () => {
      try {
        const res = await fetch("https://backend-eaukey.duckdns.org/recherche/automate_LCA");
        if (!res.ok) {
          throw new Error(`Erreur serveur: ${res.status}`);
        }
        const list = await res.json(); // [{ nom_automate, client, lieu }, ...]

        // Sauvegarde brute
        setAllAutomates(list);

        // Prépare un mapping id ➜ libellé (utilisé pour l'affichage)
        const map = {};
        list.forEach((item) => {
          map[item.nom_automate] = item.lieu || item.client || item.nom_automate;
        });
        setStationMapping(map);
      } catch (err) {
        console.error("Erreur lors de la récupération du mapping des stations:", err);
      }
    };

    fetchStationMapping();
  }, []);

  // 2️⃣ Dès que l'utilisateur est chargé, construit la liste des machines qu'il peut voir
  useEffect(() => {
    // ➜ Nouvelle logique : l'utilisateur possède une ou plusieurs *clients*
    //    stockés dans l'app-metadata, ex. "https://app.com/clients": ["Lescot", "Colonna"]

    let userClients = user["https://app.com/clients"] || user["https://app.com/client"] || [];
    if (typeof userClients === "string") {
      userClients = [userClients];
    }

    // Filtrer la liste des automates selon le ou les clients de l'utilisateur
    const filtered = allAutomates.filter((auto) =>
      userClients.includes(auto.client)
    );

    // Construire la liste pour la <select>
    const mappedStations = filtered.map((auto) => ({
      id: auto.nom_automate,
      name: stationMapping[auto.nom_automate] || `Station inconnue (${auto.nom_automate})`,
    }));

    setAvailableMachines(mappedStations);

    // Si la station sélectionnée actuelle n'est plus valide, on la remplace
    if (mappedStations.length > 0) {
      setSelectedMachine((prev) =>
        mappedStations.some((s) => s.id === prev) ? prev : mappedStations[0].id
      );
    } else {
      setSelectedMachine("");
    }
  }, [isAuthenticated, user, stationMapping, allAutomates]);

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
