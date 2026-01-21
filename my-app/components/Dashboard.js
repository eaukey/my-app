"use client";

import React, { useState, useEffect } from "react";
import GraphComponent from "./GraphComponent";
import MultiSeriesGraphComponent from "./MultiSeriesGraphComponent";
import RealTimeData from "./RealTimeData";
import { useAuth0 } from "@auth0/auth0-react";
import styles from "./Dashboard.module.css";
import { API_BASE } from "../lib/apiBase";

const chartPalette = {
  primary: "var(--primary)",
  green: "#34d399",
  amber: "#fbbf24",
  orange: "#f97316",
  teal: "#22d3ee",
  violet: "#a855f7",
  pink: "#f472b6",
  blueSoft: "#7dd3fc",
  slate: "#cbd5f5",
};

const normalizeEmailList = (...values) => {
  const seen = new Set();
  const out = [];
  values.flat().forEach((v) => {
    const e = (v || "").toString().trim().toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push(e);
  });
  return out;
};

// Le mapping station <-> nom est désormais récupéré dynamiquement depuis l'API
// via l'endpoint /recherche/automate_LCA (sans paramètre).

const chartGroups = {
  performance: [
    {
      title: "Volumes (m³)",
      color: chartPalette.green,
      endpoint: (period) => `/volumes_all/${period}`,
      seriesConfig: [
        { key: "vol_renvoi_m3", label: "Renvoi", color: chartPalette.primary },
        { key: "vol_adoucie_m3", label: "Adoucie", color: chartPalette.green },
        { key: "vol_relevage_m3", label: "Relevage", color: chartPalette.amber },
      ],
    },
    {
      title: "Détail – Renvoi (m³)",
      color: chartPalette.primary,
      endpoint: (period) => `/renvoi/${period}`,
    },
  ],
  technical: [
    {
      title: "Volume adoucie (m³)",
      color: chartPalette.green,
      endpoint: (period) => `/adoucie/${period}`,
    },
    {
      title: "Volume relevage (m³)",
      color: chartPalette.orange,
      endpoint: (period) => `/relevage/${period}`,
    },
    {
      title: "Taux de recyclage (%)",
      color: chartPalette.teal,
      endpoint: (period) => `/taux_recyclage/${period}`,
    },
    {
      title: "Consommation électrique (kWh)",
      color: chartPalette.blueSoft,
      endpoint: (period) => `/compteur_elec/${period}`,
    },
    {
      title: "Taux désinfection (%)",
      color: chartPalette.violet,
      endpoint: (period) => `/taux_desinfection/${period}`,
    },
    {
      title: "Pression (mbar)",
      color: chartPalette.primary,
      endpoint: (period) => `/pression_all/${period}`,
      seriesConfig: [
        { key: "p1_med_mbar", label: "P1", color: chartPalette.primary },
        { key: "p2_med_mbar", label: "P2", color: chartPalette.green },
        { key: "p3_med_mbar", label: "P3", color: chartPalette.amber },
        { key: "p4_med_mbar", label: "P4", color: chartPalette.orange },
        { key: "p5_med_mbar", label: "P5", color: chartPalette.violet },
      ],
    },
    {
      title: "Température (°C)",
      color: chartPalette.pink,
      endpoint: (period) => `/temperature/${period}`,
    },
    {
      title: "Chlore (mV)",
      color: chartPalette.violet,
      endpoint: (period) => `/chlore/${period}`,
    },
    {
      title: "pH",
      color: chartPalette.orange,
      endpoint: (period) => `/ph/${period}`,
    },
  ],
};

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
  const [activeDataCategory, setActiveDataCategory] = useState("performance");
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
        const res = await fetch(`${API_BASE}/recherche/automate_LCA`);
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

    // Filtrage non-admin : userEmail doit être dans email/email2/email3
    const userEmail = (user?.email || "").toLowerCase();
    const filtered = isAdmin
      ? allAutomates
      : allAutomates.filter((auto) => {
          const emails = normalizeEmailList(auto.email, auto.email2, auto.email3, auto.emails || []);
          return emails.includes(userEmail);
        });

    // Construire la liste pour la <select>
    const mappedStations = filtered.map((auto) => ({
      id: String(auto.nom_automate),
      name: `${auto.client || "Inconnu"} – ${auto.lieu || auto.nom_automate}`,
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

  const filteredGraphs = chartGroups[activeDataCategory] || [];

  const handleFallbackPeriod = () => {
    setSelectedPeriod((prev) => {
      const fallbackMap = {
        jour: "jour",
        semaine: "jour",
        mois: "semaine",
        annee: "mois",
      };
      return fallbackMap[prev] || "jour";
    });
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }
  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.pageEyebrow}>Pilotage</p>
          <h1 className={styles.pageTitle}>Données générales de performance</h1>
        </div>
        <div className={styles.authActions}>
          {isAuthenticated ? (
            <button className={styles.primaryBtn} onClick={() => logout()}>
              Déconnexion
            </button>
          ) : (
            <button className={styles.primaryBtn} onClick={() => { if (typeof window !== "undefined") window.location.href = "/login"; }}>
              Connexion
            </button>
          )}
        </div>
      </div>

      <div className={styles.selectorCard}>
        <div className={styles.selectorLabel}>Site</div>
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
          className={styles.selector}
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

      {selectedMachine && (
        <RealTimeData
          selectedMachine={selectedMachine}
          selectedPeriod={selectedPeriod}
          siteLabel={stationMapping[selectedMachine] || availableMachines.find((s) => s.id === selectedMachine)?.name}
        />
      )}

      <div className={styles.tabsRow}>
        <button
          onClick={() => setActiveDataCategory("performance")}
          className={`${styles.tabBtn} ${activeDataCategory === "performance" ? styles.tabBtnActive : ""}`}
        >
          Synthèse & performance
        </button>
        <button
          onClick={() => setActiveDataCategory("technical")}
          className={`${styles.tabBtn} ${activeDataCategory === "technical" ? styles.tabBtnActive : ""}`}
        >
          Données techniques
        </button>
      </div>

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

      <div className={styles.chartsGrid}>
        {filteredGraphs.map((cfg) =>
          cfg.seriesConfig ? (
            <MultiSeriesGraphComponent
              key={cfg.title}
              title={cfg.title}
              color={cfg.color}
              selectedPeriod={selectedPeriod}
              selectedMachine={selectedMachine}
              endpoint={cfg.endpoint(selectedPeriod)}
              seriesConfig={typeof cfg.seriesConfig === "function" ? cfg.seriesConfig(selectedPeriod) : cfg.seriesConfig}
              onRequestFallback={handleFallbackPeriod}
            />
          ) : (
            <GraphComponent
              key={cfg.title}
              title={cfg.title}
              color={cfg.color}
              selectedPeriod={selectedPeriod}
              selectedMachine={selectedMachine}
              endpoint={cfg.endpoint(selectedPeriod)}
              onRequestFallback={handleFallbackPeriod}
            />
          )
        )}
      </div>
    </div>
  );
};

export default Dashboard;
