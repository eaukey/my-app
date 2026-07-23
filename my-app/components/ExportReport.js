"use client";

// Layout "rapport" dedie a l'export PDF (rendu hors-ecran, theme clair print).
// Contient un bandeau KPI temps reel + une selection curatee des courbes cles,
// organisee en 2 sections ("Synthese & performance" / "Donnees techniques"),
// pour chaque periode demandee.
//
// Reutilise les composants graphiques existants (Chart / Combo) : le theme clair
// est obtenu en surchargeant les variables CSS sur le conteneur .report.

import React, { useEffect, useState } from "react";
import Chart from "./Chart";
import ComboRenvoiRendementChart from "./ComboRenvoiRendementChart";
import { API_BASE } from "../lib/apiBase";
import styles from "./ExportReport.module.css";

// Les 2 sections reprennent l'INTEGRALITE des courbes de chaque onglet du
// dashboard (comme a l'ecran). Seule la carte "qualite d'eau + photo" est
// exclue (photo non capturable pour cause de CORS).
const SECTION_META = [
  { key: "performance", label: "Synthèse & performance" },
  { key: "technical", label: "Données techniques" },
];

// Types de cartes non exportables (photo qui taint le canvas)
const EXCLUDED_TYPES = new Set(["qualite_photo"]);

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

export default function ExportReport({ selectedMachine, isAir, chartGroups, periods, sections }) {
  const [kpis, setKpis] = useState({});
  const [kpiLoading, setKpiLoading] = useState(true);

  const kpiDefs = isAir ? AIR_KPIS : EAU_KPIS;

  // Sections resolues : chaque section = toutes les courbes de son onglet
  // (sauf types exclus). On respecte les sections cochees (toutes par defaut).
  const resolvedSections = SECTION_META
    .filter((sec) => !sections || !sections.length || sections.includes(sec.key))
    .map((sec) => ({
      ...sec,
      configs: (chartGroups[sec.key] || []).filter(
        (cfg) => cfg && !EXCLUDED_TYPES.has(cfg.type)
      ),
    }))
    .filter((sec) => sec.configs.length > 0);

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

      {/* Pour chaque periode : 2 sections curatees (perf + technique) */}
      {periods.map((p) =>
        resolvedSections.map((sec) => (
          <div
            key={`${p.value}-${sec.key}`}
            data-report-section={sec.key}
            data-period={p.value}
          >
            <div className={styles.cardGrid}>
              {sec.configs.map((cfg) => (
                <div
                  data-report-card
                  data-period={p.value}
                  data-section={sec.key}
                  key={cfg.title}
                >
                  <ExportChart cfg={cfg} period={p.value} selectedMachine={selectedMachine} />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
