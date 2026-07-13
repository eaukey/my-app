"use client";

// Bouton "Telecharger" discret : permet d'exporter les courbes du dashboard
// telles qu'elles sont affichees, pour une ou plusieurs periodes
// (jour / semaine / mois / annee) et les deux onglets, dans un seul PDF.
//
// Principe : on monte hors-ecran une "scene" contenant les grilles de graphiques
// pour chaque (periode x onglet) demande, on attend la fin des chargements
// (disparition des skeletons ChartCard), puis on capture chaque carte en PNG
// (html-to-image) et on assemble le tout en PDF (jsPDF).

import React, { useEffect, useRef, useState } from "react";
import Chart from "./Chart";
import ComboRenvoiRendementChart from "./ComboRenvoiRendementChart";
import QualiteEauCard from "./QualiteEauCard";
import styles from "./Dashboard.module.css";

const ALL_PERIODS = [
  { label: "Jour", value: "jour" },
  { label: "Semaine", value: "semaine" },
  { label: "Mois", value: "mois" },
  { label: "Année", value: "annee" },
];

const TABS = [
  { key: "performance", label: "Synthèse & performance" },
  { key: "technical", label: "Données techniques" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rend un graphique a partir de sa config (meme aiguillage que le Dashboard).
function ExportChart({ cfg, period, selectedMachine }) {
  if (cfg.type === "qualite_photo") {
    return (
      <QualiteEauCard title={cfg.title} color={cfg.color} selectedMachine={selectedMachine} />
    );
  }
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

export default function ChartExporter({ selectedMachine, chartGroups, stationLabel }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState({ jour: true, semaine: true, mois: true, annee: true });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  // Liste des (periode x onglet) a rendre hors-ecran pendant l'export
  const [jobs, setJobs] = useState([]);

  const stageRef = useRef(null);
  const menuRef = useRef(null);
  const resolveRef = useRef(null); // resout la promesse une fois la scene montee

  // Ferme le menu au clic exterieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Quand la scene hors-ecran est montee, on debloque runExport
  useEffect(() => {
    if (jobs.length > 0 && resolveRef.current) {
      const r = resolveRef.current;
      resolveRef.current = null;
      r();
    }
  }, [jobs]);

  const selectedPeriods = ALL_PERIODS.filter((p) => selected[p.value]);
  const allChecked = ALL_PERIODS.every((p) => selected[p.value]);

  const toggle = (value) => setSelected((s) => ({ ...s, [value]: !s[value] }));
  const toggleAll = () => {
    const next = !allChecked;
    setSelected({ jour: next, semaine: next, mois: next, annee: next });
  };

  // Attend la fin des chargements (skeletons disparus) puis laisse les
  // animations Recharts se terminer avant la capture.
  const waitForReady = async (root) => {
    const started = performance.now();
    await sleep(1000); // laisse le temps aux fetch de demarrer
    const maxMs = 60000;
    while (performance.now() - started < maxMs) {
      const loaders = root.querySelectorAll('[aria-label="Chargement du graphique"]');
      if (loaders.length === 0) break;
      await sleep(300);
    }
    await sleep(1800); // fin des animations d'entree Recharts
  };

  const runExport = async () => {
    if (!selectedMachine || selectedPeriods.length === 0 || busy) return;
    setOpen(false);
    setBusy(true);
    setProgress("Préparation…");

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // Construit la liste des scenes (periode x onglet)
      const newJobs = [];
      selectedPeriods.forEach((p) => {
        TABS.forEach((tab) => {
          if (Array.isArray(chartGroups[tab.key]) && chartGroups[tab.key].length > 0) {
            newJobs.push({ period: p, tab });
          }
        });
      });

      // Monte la scene hors-ecran et attend le montage
      setProgress("Rendu des graphiques…");
      await new Promise((resolve) => {
        resolveRef.current = resolve;
        setJobs(newJobs);
      });

      const root = stageRef.current;
      setProgress("Chargement des données…");
      await waitForReady(root);

      // Couleur de fond des cartes (pour combler les coins arrondis)
      const bg =
        getComputedStyle(document.body).getPropertyValue("--bg-elevated").trim() || "#ffffff";

      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const contentW = pageW - margin * 2;
      let y = margin;
      let firstPage = true;

      // En-tete du document
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Eaukey — Export des courbes", margin, y + 6);
      y += 22;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const dateStr = new Date().toLocaleString("fr-FR");
      pdf.text(`${stationLabel || selectedMachine} · ${dateStr}`, margin, y + 4);
      y += 20;

      const stageEls = root.querySelectorAll("[data-export-stage]");
      for (let s = 0; s < stageEls.length; s++) {
        const stageEl = stageEls[s];
        const heading = stageEl.getAttribute("data-heading") || "";
        setProgress(`Capture ${s + 1}/${stageEls.length} — ${heading}`);

        // Titre de section
        const headerH = 26;
        if (!firstPage && y + headerH + 120 > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setDrawColor(180);
        pdf.text(heading, margin, y + 12);
        y += headerH;
        firstPage = false;

        const cards = stageEl.querySelectorAll("[data-export-card]");
        for (const card of cards) {
          let dataUrl;
          try {
            dataUrl = await toPng(card, {
              pixelRatio: 2,
              backgroundColor: bg,
            });
          } catch (err) {
            console.error("Échec capture d'une carte:", err);
            continue; // on ignore la carte en echec et on continue
          }
          const rect = card.getBoundingClientRect();
          const ratio = rect.height / rect.width;
          const imgW = contentW;
          const imgH = imgW * ratio;

          if (y + imgH > pageH - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.addImage(dataUrl, "PNG", margin, y, imgW, imgH, undefined, "FAST");
          y += imgH + 14;
        }
      }

      const safeLabel = String(stationLabel || selectedMachine || "station")
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 40);
      const periodsPart = selectedPeriods.map((p) => p.value).join("-");
      pdf.save(`eaukey_courbes_${safeLabel}_${periodsPart}.pdf`);
    } catch (err) {
      console.error("Erreur export PDF:", err);
      alert("Une erreur est survenue pendant l'export. Réessayez.");
    } finally {
      setJobs([]);
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <div className={styles.exportWrap} ref={menuRef}>
      <button
        type="button"
        className={styles.exportBtn}
        onClick={() => (busy ? null : setOpen((o) => !o))}
        disabled={busy || !selectedMachine}
        aria-haspopup="true"
        aria-expanded={open}
        title="Télécharger les courbes en PDF"
      >
        {busy ? (
          <span className={styles.exportBtnBusy}>
            <span className={styles.exportSpinner} aria-hidden="true" />
            {progress || "Génération…"}
          </span>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Télécharger
          </>
        )}
      </button>

      {open && !busy && (
        <div className={styles.exportMenu} role="menu">
          <div className={styles.exportMenuTitle}>Périodes à exporter</div>
          <label className={styles.exportOption}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <span><strong>Tout</strong></span>
          </label>
          <div className={styles.exportDivider} />
          {ALL_PERIODS.map((p) => (
            <label key={p.value} className={styles.exportOption}>
              <input type="checkbox" checked={!!selected[p.value]} onChange={() => toggle(p.value)} />
              <span>{p.label}</span>
            </label>
          ))}
          <button
            type="button"
            className={styles.exportConfirm}
            onClick={runExport}
            disabled={selectedPeriods.length === 0}
          >
            Télécharger le PDF
          </button>
          <p className={styles.exportHint}>Les 2 onglets (synthèse + technique) sont inclus.</p>
        </div>
      )}

      {/* Scene hors-ecran utilisee uniquement pendant la capture */}
      {jobs.length > 0 && (
        <div
          ref={stageRef}
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: 920,
            pointerEvents: "none",
            opacity: 1,
          }}
        >
          {jobs.map(({ period, tab }) => (
            <div
              key={`${period.value}-${tab.key}`}
              data-export-stage
              data-heading={`${tab.label} — ${period.label}`}
              style={{ width: 920 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                {chartGroups[tab.key].map((cfg) => (
                  <div data-export-card key={cfg.title}>
                    <ExportChart cfg={cfg} period={period.value} selectedMachine={selectedMachine} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
