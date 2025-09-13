"use client";

import React, { useState, useEffect } from "react";
import GraphComponent from "./GraphComponent";
import MultiSeriesGraphComponent from "./MultiSeriesGraphComponent";
import RealTimeData from "./RealTimeData";
import { useAuth0 } from "@auth0/auth0-react";
import styles from "./Dashboard.module.css";

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
  const [selectedMachine, setSelectedMachine] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return window.localStorage.getItem("station") || "";
      }
    } catch (_) {}
    return "";
  });
  const [activeDataCategory, setActiveDataCategory] = useState("performance"); // "performance" ou "technical"
  const [availableMachines, setAvailableMachines] = useState([]);

  // Fonction utilitaire pour comparer des IDs (gère "2023004" vs "2023004.0")
  const idsEqual = (a, b) => {
    const sa = a != null ? String(a) : "";
    const sb = b != null ? String(b) : "";
    if (sa === sb) return true;
    const na = Number(sa);
    const nb = Number(sb);
    return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
  };

  // Clé de stockage local pour mémoriser la station sélectionnée
  const LOCAL_STORAGE_KEY_SELECTED_MACHINE = "station";

  // Lecture de la sélection mémorisée au montage du composant
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_STORAGE_KEY_SELECTED_MACHINE) : null;
      if (saved) {
        setSelectedMachine(saved);
      }
    } catch (err) {
      console.warn("localStorage inaccessible pour lecture:", err);
    }
  }, []);

  // Sauvegarde de la sélection à chaque changement (utilisateur ou programme)
  useEffect(() => {
    try {
      if (selectedMachine) {
        typeof window !== "undefined" && window.localStorage.setItem(LOCAL_STORAGE_KEY_SELECTED_MACHINE, selectedMachine);
      }
    } catch (err) {
      console.warn("localStorage inaccessible pour écriture:", err);
    }
  }, [selectedMachine]);

  const periods = [
    { label: "Jour", value: "jour" },
    { label: "Semaine", value: "semaine" },
    { label: "Mois", value: "mois" },
    { label: "Année", value: "annee" }
  ];

  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";

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
    if (!isAuthenticated || !user) {
      return;
    }

    // ➜ Nouvelle logique : l'utilisateur possède un ou plusieurs *clients*
    //    stockés dans l'app-metadata, ex. "https://app.com/clients": ["Lescot", "Colonna"]

    let userClients = user["https://app.com/clients"] || user["https://app.com/client"] || user.clients || [];
    if (typeof userClients === "string") {
      userClients = [userClients];
    }

    console.log("DEBUG - userClients:", userClients);

    // Pour un admin ➜ pas de filtre ; sinon on restreint aux clients autorisés
    const filtered = isAdmin
      ? allAutomates
      : allAutomates.filter((auto) => userClients.includes(auto.client));

    // Construire la liste pour la <select>
    const mappedStations = filtered.map((auto) => ({
      id: String(auto.nom_automate),
      name: stationMapping[auto.nom_automate] || `Station inconnue (${auto.nom_automate})`,
    }));

    console.log("DEBUG - filtered automates count:", filtered.length);
    console.log("DEBUG - mappedStations:", mappedStations);

    setAvailableMachines(mappedStations);

    // Si des stations sont disponibles, déterminer la sélection sans écraser une valeur restaurée
    if (mappedStations.length > 0) {
      setSelectedMachine((prev) => {
        const saved = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_STORAGE_KEY_SELECTED_MACHINE) : null;
        // 1) Si la valeur courante est valide, on la garde
        if (prev && mappedStations.some((s) => idsEqual(s.id, prev))) {
          return String(prev);
        }
        // 2) Sinon, si une valeur sauvegardée est valide, on l'applique
        if (saved && mappedStations.some((s) => idsEqual(s.id, saved))) {
          return String(saved);
        }
        // 3) Sinon, fallback seulement si aucune valeur disponible
        return mappedStations[0].id;
      });
    }
  }, [isAuthenticated, user, stationMapping, allAutomates, isAdmin]);

  // Filtrer les graphiques selon la catégorie active
  const filteredGraphs = graphConfigs.filter(graph => graph.category === activeDataCategory);

  if (isLoading) {
    return <div>Chargement...</div>;
  }
  return (
    <div className={styles.container}>
      {/* En-tête avec bouton Connexion/Déconnexion */}
      <div className={styles.headerRow}>
        {isAuthenticated ? (
          <>
            <h1>Bienvenue, {user?.name || "Utilisateur"}</h1>
            <button
              onClick={() => logout({ returnTo: window.location.origin })}
              style={{
                padding: "0.375rem 0.75rem",
                backgroundColor: "#41AEAD",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Déconnexion
            </button>
          </>
        ) : (
          <button
            onClick={() => loginWithRedirect()}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "#41AEAD",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Connexion
          </button>
        )}
      </div>

      {/* Sélection de la station */}
      <div className={styles.block}>
        <select
          value={selectedMachine}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedMachine(value);
            try {
              typeof window !== "undefined" && window.localStorage.setItem(LOCAL_STORAGE_KEY_SELECTED_MACHINE, value);
            } catch (err) {
              console.warn("localStorage inaccessible pour écriture (onChange):", err);
            }
          }}
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #ddd",
            width: "100%",
            maxWidth: "20rem",
            fontSize: "0.875rem",
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
      <div className={styles.segmented}>
        <button
          onClick={() => setActiveDataCategory("performance")}
          className={`${styles.segBtn} ${activeDataCategory === "performance" ? styles.selectedButtonStyle : ""}`}
        >
          Données générales de performance
        </button>
        <button
          onClick={() => setActiveDataCategory("technical")}
          className={`${styles.segBtn} ${activeDataCategory === "technical" ? styles.selectedButtonStyle : ""}`}
        >
          Données techniques
        </button>
      </div>

      {/* Sélection des périodes */}
      <div className={styles.periodRow}>
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => setSelectedPeriod(period.value)}
            className={`${styles.periodBtn} ${selectedPeriod === period.value ? styles.periodBtnActive : ""}`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Affichage des graphiques filtrés par catégorie */}
      <div className={styles.chartsGrid}>
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
  );
}

export default Dashboard;
