'use client';

import React, { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import KpiCard from "./KpiCard";
import styles from "./RealTimeData.module.css";

// Cartes KPI temps reel pour les recycleurs d'AIR.
// Symetrique de RealTimeData (eau) mais branche sur /air/temps_reel/{metric}.
// Reutilise KpiCard et le meme CSS. Aucune logique eau touchee.

const formatTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

// Definition des cartes : metric backend -> libelle / unite / nb decimales
const KPI_DEFS = [
  { key: "debit",       label: "Débit d'air",          unit: "m³/h", digits: 0 },
  { key: "volume_air",  label: "Volume d'air (24h)",   unit: "m³",   digits: 0 },
  { key: "temperature", label: "Température",           unit: "°C",   digits: 1 },
  { key: "hygro",       label: "Humidité",             unit: "%",    digits: 0 },
  { key: "pression",    label: "Encrassement filtre",  unit: "Pa",   digits: 0 },
  { key: "qualite",     label: "CO₂",                  unit: "ppm",  digits: 0 },
];

// Statut metier leger (humidite uniquement ; le reste reste neutre tant que les
// seuils metier ne sont pas definis).
const getStatus = (key, value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "neutral";
  if (key === "hygro") {
    if (value > 80) return "watch";
    if (value < 30) return "watch";
    return "ok";
  }
  return "neutral";
};

const getInterpretation = (key, status) => {
  if (key === "hygro") {
    if (status === "watch") return "Humidité hors plage usuelle";
    if (status === "ok") return "Humidité dans la plage usuelle";
  }
  return "En observation";
};

const RealTimeDataAir = ({ selectedMachine }) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRealTime = async () => {
      if (!selectedMachine) return;
      setLoading(true);
      try {
        const newData = {};
        for (const def of KPI_DEFS) {
          try {
            const url = `${API_BASE}/air/temps_reel/${def.key}?nom_automate=${selectedMachine}`;
            const response = await fetch(url);
            if (response.ok) {
              const result = await response.json();
              newData[def.key] = {
                value: result.valeur !== undefined ? result.valeur : null,
                lastUpdate: result.horodatage ? new Date(result.horodatage) : null,
              };
            } else {
              newData[def.key] = { value: null, lastUpdate: null };
            }
          } catch (_) {
            newData[def.key] = { value: null, lastUpdate: null };
          }
        }
        setData(newData);
      } catch (_) {
        setError("Impossible de récupérer les données en temps réel");
      } finally {
        setLoading(false);
      }
    };

    fetchRealTime();
    const interval = setInterval(fetchRealTime, 60000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

  if (error) {
    return <div style={{ textAlign: "center", margin: "20px 0", color: "var(--critical)" }}>{error}</div>;
  }

  const buildKpi = (def) => {
    const raw = data[def.key]?.value;
    let value = null;
    if (raw !== null && raw !== undefined && !Number.isNaN(raw)) {
      value = parseFloat(raw).toFixed(def.digits);
    }
    const status = getStatus(def.key, raw);
    return {
      key: def.key,
      label: def.label,
      value,
      unit: def.unit,
      interpretation: getInterpretation(def.key, status),
      status,
      lastUpdate: def.key === "volume_air" ? "cumul 24h" : formatTime(data[def.key]?.lastUpdate),
    };
  };

  const kpis = KPI_DEFS.map(buildKpi);

  return (
    <div className={styles.container}>
      <div className={styles.kpiGrid}>
        {loading
          ? Array.from({ length: kpis.length }).map((_, idx) => <div key={idx} className={styles.kpiSkeleton} />)
          : kpis.map((kpi) => (
              <KpiCard
                key={kpi.key}
                label={kpi.label}
                value={kpi.value}
                unit={kpi.unit}
                interpretation={kpi.interpretation}
                status={kpi.status}
                lastUpdate={kpi.lastUpdate}
              />
            ))}
      </div>
    </div>
  );
};

export default RealTimeDataAir;
