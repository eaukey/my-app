'use client';

import React, { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import KpiCard from "./KpiCard";
import styles from "./RealTimeData.module.css";

const SHOW_RECYCLING_KPI = true;

const formatTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const computeDeltaFromSeries = (series = []) => {
  const values = series
    .map((v) => (typeof v === "number" ? v : parseFloat(v)))
    .filter((v) => Number.isFinite(v));
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const delta = last - prev;
  const percent = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null;
  return {
    delta,
    percent,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
};

const getStatusForValue = (key, value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }
  if (key === "hauteur_cuve_traitement" || key === "hauteur_cuve_disconnection") {
    if (value > 80) return "ok";
    if (value >= 60) return "watch";
    return "critical";
  }
  if (key === "taux_recyclage") {
    if (value < 5) return "critical";
    if (value < 10) return "watch";
    return "ok";
  }
  return "neutral";
};

const getInterpretation = (key, status, deltaDirection) => {
  if (status === "critical") {
    if (key === "hauteur_cuve_traitement" || key === "hauteur_cuve_disconnection") return "Niveau bas";
    return "Critique";
  }
  if (status === "watch") {
    if (key === "hauteur_cuve_traitement" || key === "hauteur_cuve_disconnection") return "Niveau moyen";
    if (key === "taux_recyclage") return "À surveiller : recyclage faible";
    return "Zone de vigilance";
  }
  if (status === "ok") {
    if (key === "hauteur_cuve_traitement" || key === "hauteur_cuve_disconnection") return "Niveau élevé";
    if (deltaDirection === "down" && key === "taux_recyclage") return "Attention à la baisse récente";
    return "Conforme aux attentes";
  }
  if (deltaDirection === "up") return "Tendance en hausse";
  if (deltaDirection === "down") return "Tendance en baisse";
  return "En observation";
};

const RealTimeData = ({ selectedMachine, selectedPeriod }) => {
  const [data, setData] = useState({
    taux_recyclage: { value: null, lastUpdate: null },
    hauteur_cuve_traitement: { value: null, lastUpdate: null },
    hauteur_cuve_disconnection: { value: null, lastUpdate: null },
    volume_renvoi: { value: null, lastUpdate: null },
    compteur_electrique: { value: null, lastUpdate: null },
  });
  const [deltaData, setDeltaData] = useState({});
  const [loading, setLoading] = useState(true);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRealTimeData = async () => {
      if (!selectedMachine) return;

      setLoading(true);
      try {
        const endpoints = [
          "taux_recyclage",
          "hauteur_cuve_traitement",
          "hauteur_cuve_disconnection",
          "volume_renvoi",
          "compteur_electrique",
        ];

        const newData = {
          taux_recyclage: { value: null, lastUpdate: null },
          hauteur_cuve_traitement: { value: null, lastUpdate: null },
          hauteur_cuve_disconnection: { value: null, lastUpdate: null },
          volume_renvoi: { value: null, lastUpdate: null },
          compteur_electrique: { value: null, lastUpdate: null },
        };

        for (const endpoint of endpoints) {
          try {
            const url = `${API_BASE}/temps_reel/${endpoint}?nom_automate=${selectedMachine}`;
            const response = await fetch(url);

            if (response.ok) {
              const result = await response.json();
              let value = result.valeur !== undefined ? result.valeur : null;
              if (endpoint === "taux_recyclage" && value !== null && value >= 0 && value <= 1) {
                value = value * 100;
              }
              newData[endpoint] = {
                value,
                lastUpdate: result.horodatage ? new Date(result.horodatage) : null,
              };
            } else if (endpoint === "taux_recyclage") {
              // Fallback: utilise /taux_recyclage/semaine si /temps_reel/taux_recyclage n'est pas disponible
              try {
                const fallbackUrl = `${API_BASE}/taux_recyclage/semaine?nom_automate=${selectedMachine}`;
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) {
                  const fallbackJson = await fallbackRes.json();
                  const series = Array.isArray(fallbackJson?.data) ? fallbackJson.data : [];
                  // Prendre la derniere valeur non nulle
                  let lastVal = null;
                  for (let i = series.length - 1; i >= 0; i--) {
                    if (series[i] !== null && series[i] !== undefined && Number.isFinite(series[i])) {
                      lastVal = series[i];
                      break;
                    }
                  }
                  if (lastVal !== null && lastVal >= 0 && lastVal <= 1) {
                    lastVal = lastVal * 100;
                  }
                  newData[endpoint] = { value: lastVal, lastUpdate: new Date() };
                } else {
                  newData[endpoint] = { value: null, lastUpdate: null };
                }
              } catch (_) {
                newData[endpoint] = { value: null, lastUpdate: null };
              }
            } else {
              newData[endpoint] = { value: null, lastUpdate: null };
            }
          } catch (err) {
            newData[endpoint] = { value: null, lastUpdate: null };
          }
        }

        setData(newData);
      } catch (err) {
        setError("Impossible de récupérer les données en temps réel");
      } finally {
        setLoading(false);
      }
    };

    fetchRealTimeData();
    const interval = setInterval(fetchRealTimeData, 60000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

  useEffect(() => {
    const fetchDeltaData = async () => {
      if (!selectedMachine) {
        setDeltaData({});
        return;
      }
      setDeltaLoading(true);
      const deltaEndpoints = {
        compteur_electrique: (p) => `/compteur_elec/${p}`,
      };
      const nextDelta = {};

      for (const [key, endpointBuilder] of Object.entries(deltaEndpoints)) {
        try {
          const endpoint = endpointBuilder(selectedPeriod);
          const res = await fetch(`${API_BASE}${endpoint}?nom_automate=${selectedMachine}`);
          if (!res.ok) continue;
          const json = await res.json();
          const series = Array.isArray(json?.data) ? json.data : [];
          const delta = computeDeltaFromSeries(series);
          if (delta) nextDelta[key] = delta;
        } catch (_) {
          // silencieux, on affiche "—" si insuffisant
        }
      }
      setDeltaData(nextDelta);
      setDeltaLoading(false);
    };

    fetchDeltaData();
  }, [selectedMachine, selectedPeriod]);

  if (error) {
    return <div style={{ textAlign: "center", margin: "20px 0", color: "var(--critical)" }}>{error}</div>;
  }

  const getDeltaLabel = (key) => {
    const delta = deltaData[key];
    if (!delta) return null;
    if (delta.percent !== null && Number.isFinite(delta.percent)) {
      const val = delta.percent;
      return `${val > 0 ? "+" : ""}${val.toFixed(1)}% vs période précédente`;
    }
    return `${delta.delta > 0 ? "+" : ""}${delta.delta.toFixed(2)}`;
  };

  const buildKpi = (key, label, unit) => {
    const rawValue = data[key]?.value;
    let value = rawValue;
    if (rawValue !== null && rawValue !== undefined && !Number.isNaN(rawValue)) {
      if (key === "taux_recyclage") value = parseFloat(rawValue).toFixed(0);
      else if (key.includes("cuve")) value = parseFloat(rawValue).toFixed(0);
      else value = parseFloat(rawValue).toFixed(2);
    } else {
      value = null;
    }

    const status = getStatusForValue(key, rawValue);
    const deltaLabel = getDeltaLabel(key);
    const deltaDirection = deltaData[key]?.direction || "flat";
    const interpretation = getInterpretation(key, status, deltaDirection);
    return {
      key,
      label,
      value,
      unit,
      deltaLabel,
      deltaDirection,
      interpretation,
      status,
      lastUpdate: formatTime(data[key]?.lastUpdate),
    };
  };

  const kpis = [
    ...(SHOW_RECYCLING_KPI ? [buildKpi("taux_recyclage", "Taux de recyclage", "%")] : []),
    buildKpi("hauteur_cuve_traitement", "Cuve de traitement", "%"),
    buildKpi("hauteur_cuve_disconnection", "Cuve de renvoi", "%"),
    buildKpi("volume_renvoi", "Volume de renvoi", "m³"),
  ];

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
                deltaLabel={deltaLoading ? null : kpi.deltaLabel}
                deltaDirection={kpi.deltaDirection}
                interpretation={kpi.interpretation}
                status={kpi.status}
                lastUpdate={kpi.lastUpdate}
                tooltip={!kpi.deltaLabel ? "Données insuffisantes pour la variation" : undefined}
              />
            ))}
      </div>
    </div>
  );
};

export default RealTimeData;