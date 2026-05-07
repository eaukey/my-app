"use client";

import React, { useState, useEffect } from "react";
import Chart from "./Chart";
import ComboRenvoiRendementChart from "./ComboRenvoiRendementChart";
import RealTimeData from "./RealTimeData";
import { useAuth } from "../lib/auth";
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

// Flags d'affichage des graphs : passer a true pour reactiver
const SHOW_RECYCLING_CHART = false;        // masque le graph "Rendement recycleur (%)" (remplace par le combo)
const SHOW_RENVOI_STANDALONE_CHART = false; // masque le graph "Volume renvoi (m3)" standalone (remplace par le combo)
const SHOW_DISINFECTION_CHART = true;

 

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
      type: "combo",
      title: "Volume renvoi & rendement recycleur",
      color: chartPalette.primary,
      volumeEndpoint: (period) => `/renvoi/${period}`,
      rendementEndpoint: (period) => `/taux_recyclage/${period}`,
    },
    ...(SHOW_RENVOI_STANDALONE_CHART
      ? [
          {
            title: "Volume renvoi (m³)",
            color: chartPalette.primary,
            endpoint: (period) => `/renvoi/${period}`,
          },
        ]
      : []),
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
    ...(SHOW_RECYCLING_CHART
      ? [
          {
            title: "Rendement recycleur (%)",
            color: chartPalette.teal,
            endpoint: (period) => `/taux_recyclage/${period}`,
          },
        ]
      : []),
  ],
  technical: [
    {
      title: "Volume adoucie (m³)",
      color: chartPalette.green,
      endpoint: (period) => `/adoucie/${period}`,
    },
    {
      type: "combo",
      title: "Volume renvoi & rendement recycleur",
      color: chartPalette.primary,
      volumeEndpoint: (period) => `/renvoi/${period}`,
      rendementEndpoint: (period) => `/taux_recyclage/${period}`,
    },
    {
      title: "Volume relevage (m³)",
      color: chartPalette.orange,
      endpoint: (period) => `/relevage/${period}`,
    },
    ...(SHOW_RECYCLING_CHART
      ? [
          {
            title: "Rendement recycleur (%)",
            color: chartPalette.teal,
            endpoint: (period) => `/taux_recyclage/${period}`,
          },
        ]
      : []),
    {
      title: "Consommation électrique (kWh)",
      color: chartPalette.blueSoft,
      endpoint: (period) => `/compteur_elec/${period}`,
    },
    {
      title: "Évolution de la consommation (kWh/m³ relevé)",
      color: chartPalette.slate,
      endpoint: (period) => `/ratio_kwh_m3/${period}`,
    },
    ...(SHOW_DISINFECTION_CHART
      ? [
          {
            title: "Taux désinfection (%)",
            color: chartPalette.violet,
            endpoint: (period) => `/taux_desinfection/${period}`,
          },
        ]
      : []),
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
    {
      title: "Conductivité (µS/cm)",
      color: chartPalette.teal,
      endpoint: (period) => `/conductivite/${period}`,
      seriesConfig: [
        { key: "cond_traitement", label: "Traitement", color: chartPalette.teal },
        { key: "cond_renvoi",     label: "Renvoi",     color: chartPalette.primary },
      ],
    },
    {
      title: "Hauteur cuve traitement (%)",
      color: chartPalette.green,
      endpoint: (period) => `/hauteur_cuve_traitement/${period}`,
    },
    {
      title: "Hauteur cuve disconnexion (%)",
      color: chartPalette.amber,
      endpoint: (period) => `/hauteur_cuve_disconnection/${period}`,
    },
  ],
};

const Dashboard = () => {
  const { isAuthenticated, isLoading, logout, authFetch } = useAuth();
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
  const [stationsLoading, setStationsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalRecycle, setTotalRecycle] = useState(null);

  // Fonction utilitaire pour comparer des IDs (gère "2023004" vs "2023004.0")
  const idsEqual = (a, b) => {
    const sa = a != null ? String(a) : "";
    const sb = b != null ? String(b) : "";
    if (sa === sb) return true;
    const na = Number(sa);
    const nb = Number(sb);
    return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
  };

  const persistSelection = (value) => {
    setSelectedMachine(value);
    try {
      if (value) {
        typeof window !== "undefined" && window.localStorage.setItem(LOCAL_STORAGE_KEY_SELECTED_MACHINE, value);
      }
    } catch (err) {
      console.warn("localStorage inaccessible pour écriture:", err);
    }
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

  // Récupérer les stations disponibles depuis les métadonnées utilisateur
  useEffect(() => {
    // 1️⃣ Récupère le mapping complet depuis l'API au premier rendu
    const fetchStationMapping = async () => {
      if (!isAuthenticated) return;
      try {
        const res = await authFetch(`${API_BASE}/my/automates`);
        if (!res.ok) {
          throw new Error(`Erreur serveur: ${res.status}`);
        }
        const list = await res.json(); // [{ nom_automate, client, lieu }, ...]
        const safeList = Array.isArray(list) ? list : [];

        // Sauvegarde brute
        setAllAutomates(safeList);

        // Prépare un mapping id ➜ libellé (utilisé pour l'affichage)
        const map = {};
        safeList.forEach((item) => {
          map[item.nom_automate] = item.lieu || item.client || item.nom_automate;
        });
        setStationMapping(map);
      } catch (err) {
        console.error("Erreur lors de la récupération du mapping des stations:", err);
      } finally {
        setStationsLoading(false);
      }
    };

    fetchStationMapping();
  }, [isAuthenticated, authFetch]);

  // Récupère le total m3 recyclés (toutes stations accessibles)
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchTotal = async () => {
      try {
        const res = await authFetch(`${API_BASE}/volumes/total`);
        if (res.ok) {
          const data = await res.json();
          setTotalRecycle(data);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du total recyclé:", err);
      }
    };
    fetchTotal();
  }, [isAuthenticated, authFetch]);

  // 2️⃣ Dès que l'utilisateur est chargé, construit la liste des machines qu'il peut voir
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Construire la liste pour la <select>
    const mappedStations = allAutomates.map((auto) => ({
      id: String(auto.nom_automate),
      name: `${auto.client || "Inconnu"} – ${auto.lieu || auto.nom_automate}`,
    }));

    mappedStations.sort((a, b) => a.name.localeCompare(b.name, "fr"));

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
  }, [isAuthenticated, stationMapping, allAutomates]);

  const filteredGraphs = chartGroups[activeDataCategory] || [];

  const filteredSuggestions = searchQuery.trim()
    ? availableMachines.filter((station) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          station.name.toLowerCase().includes(q) ||
          String(station.id || "").toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

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
          ) : null}
        </div>
      </div>

      {totalRecycle && totalRecycle.total_recycle_m3 > 0 && (
        <div className={styles.totalBanner}>
          <span className={styles.totalValue}>
            {Math.round(totalRecycle.total_recycle_m3).toLocaleString("fr-FR")} m³
          </span>
          <div>
            <div className={styles.totalLabel}>
              d&apos;eau recyclée depuis la mise en route
            </div>
            <div className={styles.totalSub}>
              {totalRecycle.nb_stations} station{totalRecycle.nb_stations > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      <div className={styles.selectorCard}>
        <div className={styles.selectorLabel}>Site</div>
        <div className={styles.selectorControls}>
          <select
            value={selectedMachine}
            onChange={(e) => persistSelection(e.target.value)}
            className={styles.selector}
            aria-label="Sélectionner une station"
          >
            <option value="">
              {stationsLoading ? "Chargement des stations…" : "Sélectionnez une station"}
            </option>
            {availableMachines.map((station, index) => (
              <option key={index} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>

          <div className={styles.searchBox}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (nom, client, lieu)"
              className={styles.searchInput}
              aria-label="Rechercher une station"
            />
            {searchQuery && filteredSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {filteredSuggestions.map((station) => (
                  <button
                    key={station.id}
                    type="button"
                    className={styles.suggestionItem}
                    onClick={() => {
                      persistSelection(station.id);
                      setSearchQuery("");
                    }}
                  >
                    {station.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
        {filteredGraphs.map((cfg) => (
          cfg.type === "combo" ? (
            <ComboRenvoiRendementChart
              key={cfg.title}
              title={cfg.title}
              selectedPeriod={selectedPeriod}
              selectedMachine={selectedMachine}
              volumeEndpoint={cfg.volumeEndpoint(selectedPeriod)}
              rendementEndpoint={cfg.rendementEndpoint(selectedPeriod)}
              onRequestFallback={handleFallbackPeriod}
            />
          ) : (
            <Chart
              key={cfg.title}
              title={cfg.title}
              color={cfg.color}
              selectedPeriod={selectedPeriod}
              selectedMachine={selectedMachine}
              endpoint={cfg.endpoint(selectedPeriod)}
              seriesConfig={typeof cfg.seriesConfig === "function" ? cfg.seriesConfig(selectedPeriod) : cfg.seriesConfig}
              onRequestFallback={handleFallbackPeriod}
            />
          )
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
