'use client';

import React, { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import ExecutiveSummaryBar from "./ExecutiveSummaryBar";
import KpiCard from "./KpiCard";
import styles from "./RealTimeData.module.css";

const statusWeight = { ok: 0, watch: 1, critical: 2, neutral: 0 };

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
    if (value > 85) return "critical";
    if (value >= 70) return "watch";
    return "ok";
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
    if (key === "hauteur_cuve_traitement") return "Critique : niveau de cuve élevé";
    if (key === "hauteur_cuve_disconnection") return "Critique : cuve de renvoi saturée";
    return "Critique";
  }
  if (status === "watch") {
    if (key === "taux_recyclage") return "À surveiller : recyclage faible";
    return "Zone de vigilance";
  }
  if (status === "ok") {
    if (deltaDirection === "down" && key === "taux_recyclage") return "Attention à la baisse récente";
    return "Conforme aux attentes";
  }
  if (deltaDirection === "up") return "Tendance en hausse";
  if (deltaDirection === "down") return "Tendance en baisse";
  return "En observation";
};

const RealTimeData = ({ selectedMachine, selectedPeriod, siteLabel }) => {
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

        const newData = { ...data };

        for (const endpoint of endpoints) {
          try {
            if (endpoint === "taux_recyclage") {
              let value = null;
              let lastUpdate = null;
              const url1 = `${API_BASE}/temps_reel/taux_recyclage?nom_automate=${selectedMachine}`;
              const res1 = await fetch(url1);
              if (res1.ok) {
                const json1 = await res1.json();
                const raw = json1.valeur !== undefined ? json1.valeur : json1.value;
                if (raw !== undefined && raw !== null && !isNaN(parseFloat(raw))) {
                  let v = parseFloat(raw);
                  if (v >= 0 && v <= 1) v = v * 100;
                  value = v;
                }
                lastUpdate = json1.horodatage ? new Date(json1.horodatage) : null;
              } else {
                const url2 = `${API_BASE}/taux_recyclage/jour?nom_automate=${selectedMachine}`;
                const res2 = await fetch(url2);
                if (res2.ok) {
                  const json2 = await res2.json();
                  const arr = Array.isArray(json2) ? json2 : json2.data || json2.valeurs || json2.values || [];
                  for (let i = arr.length - 1; i >= 0; i--) {
                    const item = arr[i];
                    const rawItem =
                      typeof item === "number"
                        ? item
                        : item && typeof item === "object"
                        ? item.valeur ?? item.value ?? item.v
                        : null;
                    if (rawItem !== undefined && rawItem !== null && !isNaN(parseFloat(rawItem))) {
                      let v = parseFloat(rawItem);
                      if (v >= 0 && v <= 1) v = v * 100;
                      value = v;
                      if (item && typeof item === "object") {
                        const ts = item.horodatage ?? item.timestamp ?? item.date;
                        if (ts) lastUpdate = new Date(ts);
                      }
                      break;
                    }
                  }
                }
              }
              newData[endpoint] = { value, lastUpdate };
            } else {
              const url = `${API_BASE}/temps_reel/${endpoint}?nom_automate=${selectedMachine}`;
              const response = await fetch(url);

              if (response.ok) {
                const result = await response.json();
                newData[endpoint] = {
                  value: result.valeur !== undefined ? result.valeur : null,
                  lastUpdate: result.horodatage ? new Date(result.horodatage) : null,
                };
              } else {
                newData[endpoint] = { value: null, lastUpdate: null };
              }
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
        taux_recyclage: (p) => `/taux_recyclage/${p}`,
        volume_renvoi: (p) => `/renvoi/${p}`,
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
    return <div style={{ textAlign: "center", margin: "20px 0", color: "red" }}>{error}</div>;
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
    buildKpi("taux_recyclage", "Taux de recyclage", "%"),
    buildKpi("hauteur_cuve_traitement", "Cuve de traitement", "%"),
    buildKpi("hauteur_cuve_disconnection", "Cuve de renvoi", "%"),
    buildKpi("volume_renvoi", "Volume de renvoi", "m³"),
  ];

  const worstKpi = kpis.reduce(
    (acc, kpi) => {
      const weight = statusWeight[kpi.status] ?? 0;
      if (weight > acc.weight) return { weight, kpi };
      return acc;
    },
    { weight: -1, kpi: null }
  );

  const insight =
    worstKpi.weight > 1
      ? `Zone critique sur ${worstKpi.kpi?.label}`
      : worstKpi.weight === 1
      ? `Vigilance : ${worstKpi.kpi?.label}`
      : "Système stable";

  const lastUpdateText = formatTime(
    kpis
      .map((k) => data[k.key]?.lastUpdate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0]
  );

  return (
    <div className={styles.container}>
      <ExecutiveSummaryBar siteName={siteLabel} status={worstKpi.kpi?.status || "ok"} lastUpdate={lastUpdateText} insight={insight} />
      <div className={styles.kpiGrid}>
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => <div key={idx} className={styles.kpiSkeleton} />)
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