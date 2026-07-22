"use client";

// Layout "rapport" dedie a l'export PDF (rendu hors-ecran, theme clair print).
// Contient un bandeau KPI temps reel + une selection curatee des courbes cles,
// pour chaque periode demandee. Concu pour tenir en ~2 pages par periode.
//
// Reutilise les composants graphiques existants (Chart / Combo) : le theme clair
// est obtenu en surchargeant les variables CSS sur le conteneur .report.

import React, { useEffect, useState } from "react";
import Chart from "./Chart";
import ComboRenvoiRendementChart from "./ComboRenvoiRendementChart";
import { API_BASE } from "../lib/apiBase";
import styles from "./ExportReport.module.css";

// Selection curatee des courbes (par titre, resolues depuis chartGroups)
const EAU_CURATED = [
  "Volumes (m³)",
  "Volume renvoi & rendement recycleur",
  "Consommation électrique (kWh)",
  "Taux désinfection (%)",
  "Température (°C)",
  "Chlore (mV)",
];

const AIR_CURATED = [
  "Débits d'air (m³/h)",
  "Volume d'air traité (m³)",
  "Pressions différentielles — encrassement filtres (Pa)",
  "Températures (°C)",
  "Humidité (%)",
  "Qualité d'air (CO₂ / COV / MES)",
];

// Definition des tuiles KPI (temps reel)
const EAU_KPIS = [
  { key: "taux_recyclage", label: "Rendement recycleur", unit: "%", digits: 0 },
  { key: "hauteur_cuve_traitement", label: "Cuve traitement", unit: "%", digits: 0 },
  { key: "hauteur_cuve_disconnection", label: "Cuve renvoi", unit: "%", digits: 0 },
  { key: "volume_renvoi", label: "Volume renvoi", unit: "m³", digits: 2 },
  { key: "volume_relevage", label: "Volume relevage", unit: "m³", digits: 2 },
  { key: "compteur_electrique", label: "Conso. électrique", unit: "kWh", digits: 2 },
];

const AIR_KPIS = [
  { key: "debit", label: "Débit d'air", unit: "m³/h", digits: 0 },
  { key: "volume_air", label: "Volume air (24h)", unit: "m³", digits: 0 },
  { key: "temperature", label: "Température", unit: "°C", digits: 1 },
  { key: "hygro", label: "Humidité", unit: "%", digits: 0 },
  { key: "pression", label: "Encrass. filtre", unit: "Pa", digits: 0 },
  { key: "qualite", label: "CO₂", unit: "ppm", digits: 0 },
];

function ExportChart({ cfg, period, selectedMachine }) {
  if (cfg.type === "combo") {
    return (
      <ComboRenvoiRendementChart
        title={cfg.title}
        selectedPeriod={period}
        selectedMachine={selectedMachine}
        volumeEndpoint={cfg.volumeEndpoint(period)}
        rendementEndpoint={cfg.rendementEndpoint(period)}
      />
    );
  }
  return (
    <Chart
      title={cfg.title}
      color={cfg.color}
      selectedPeriod={period}
      selectedMachine={selectedMachine}
      endpoint={cfg.endpoint(period)}
      seriesConfig={typeof cfg.seriesConfig === "function" ? cfg.seriesConfig(period) : cfg.seriesConfig}
    />
  );
}

export default function ExportReport({ selectedMachine, isAir, chartGroups, periods }) {
  const [kpis, setKpis] = useState({});
  const [kpiLoading, setKpiLoading] = useState(true);

  const kpiDefs = isAir ? AIR_KPIS : EAU_KPIS;
  const curatedTitles = isAir ? AIR_CURATED : EAU_CURATED;

  // Resout les configs de courbes a partir des titres curates
  const lookup = {};
  [...(chartGroups.performance || []), ...(chartGroups.technical || [])].forEach((cfg) => {
    if (cfg && cfg.title && !lookup[cfg.title]) lookup[cfg.title] = cfg;
  });
  const curatedConfigs = curatedTitles.map((t) => lookup[t]).filter(Boolean);

  // Recupere les valeurs temps reel une fois
  useEffect(() => {
    if (!selectedMachine) return;
    let cancelled = false;
    const fetchKpis = async () => {
      setKpiLoading(true);
      const base = isAir ? "/air/temps_reel" : "/temps_reel";
      const out = {};
      for (const def of kpiDefs) {
        try {
          const res = await fetch(`${API_BASE}${base}/${def.key}?nom_automate=${selectedMachine}`);
          if (res.ok) {
            const json = await res.json();
            let v = json.valeur !== undefined ? json.valeur : null;
            if (def.key === "taux_recyclage" && v !== null && v >= 0 && v <= 1) v = v * 100;
            out[def.key] = v;
          } else {
            out[def.key] = null;
          }
        } catch (_) {
          out[def.key] = null;
        }
      }
      if (!cancelled) {
        setKpis(out);
        setKpiLoading(false);
      }
    };
    fetchKpis();
    return () => { cancelled = true; };
  }, [selectedMachine, isAir]);

  const fmtKpi = (def) => {
    const raw = kpis[def.key];
    if (raw === null || raw === undefined || Number.isNaN(raw)) return "—";
    return parseFloat(raw).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: def.digits,
    });
  };

  return (
    <div className={styles.report}>
      {/* Bandeau KPI temps reel (capture en un bloc) */}
      <div data-report-kpi className={styles.kpiBand}>
        {kpiLoading
          ? kpiDefs.map((_, i) => (
              <div key={i} className={styles.kpiSkeleton} aria-label="Chargement du graphique" />
            ))
          : kpiDefs.map((def) => (
              <div key={def.key} className={styles.kpiTile}>
                <div className={styles.kpiLabel}>{def.label}</div>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{fmtKpi(def)}</span>
                  <span className={styles.kpiUnit}>{def.unit}</span>
                </div>
              </div>
            ))}
      </div>

      {/* Une section de courbes curatees par periode */}
      {periods.map((p) => (
        <div key={p.value} data-report-section data-period={p.value}>
          <div className={styles.cardGrid}>
            {curatedConfigs.map((cfg) => (
              <div data-report-card data-period={p.value} key={cfg.title}>
                <ExportChart cfg={cfg} period={p.value} selectedMachine={selectedMachine} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
