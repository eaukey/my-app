"use client";

// Bouton "Telecharger" discret : genere un rapport PDF qualitatif des courbes
// cles + bandeau KPI temps reel, pour la/les periode(s) choisie(s).
//
// Principe : on monte hors-ecran un layout "rapport" (ExportReport, theme clair
// print), on attend la fin des chargements (skeletons ChartCard disparus), puis
// on capture le bandeau KPI et chaque courbe en PNG (html-to-image) et on
// assemble un PDF pagine (jsPDF) avec en-tetes/titres dessines nativement.

import React, { useEffect, useRef, useState } from "react";
import ExportReport from "./ExportReport";
import styles from "./Dashboard.module.css";

const ALL_PERIODS = [
  { label: "Jour", value: "jour" },
  { label: "Semaine", value: "semaine" },
  { label: "Mois", value: "mois" },
  { label: "Année", value: "annee" },
];

// Sections du rapport (memes libelles que les onglets du dashboard)
const SECTION_ORDER = ["performance", "technical"];
const SECTION_LABELS = {
  performance: "Synthèse & performance",
  technical: "Données techniques",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ChartExporter({ selectedMachine, chartGroups, stationLabel, isAir, currentPeriod }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState({});
  // Sections a inclure (les deux cochees par defaut)
  const [selSections, setSelSections] = useState({ performance: true, technical: true });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [jobPeriods, setJobPeriods] = useState([]); // periodes rendues hors-ecran

  const stageRef = useRef(null);
  const menuRef = useRef(null);
  const resolveRef = useRef(null);

  // Par defaut, seule la periode actuellement affichee est cochee
  useEffect(() => {
    setSelected({ [currentPeriod || "jour"]: true });
  }, [currentPeriod]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Debloque runExport une fois la scene montee
  useEffect(() => {
    if (jobPeriods.length > 0 && resolveRef.current) {
      const r = resolveRef.current;
      resolveRef.current = null;
      r();
    }
  }, [jobPeriods]);

  const selectedPeriods = ALL_PERIODS.filter((p) => selected[p.value]);
  const toggle = (value) => setSelected((s) => ({ ...s, [value]: !s[value] }));

  // Sections cochees, dans l'ordre d'affichage
  const activeSections = SECTION_ORDER.filter((k) => selSections[k]);
  const toggleSection = (key) =>
    setSelSections((s) => ({ ...s, [key]: !s[key] }));
  const canExport = selectedPeriods.length > 0 && activeSections.length > 0;

  const waitForReady = async (root) => {
    const started = performance.now();
    await sleep(1000);
    const maxMs = 60000;
    while (performance.now() - started < maxMs) {
      const loaders = root.querySelectorAll('[aria-label="Chargement du graphique"]');
      if (loaders.length === 0) break;
      await sleep(300);
    }
    await sleep(1800); // fin des animations Recharts
  };

  const runExport = async () => {
    if (!selectedMachine || !canExport || busy) return;
    setOpen(false);
    setBusy(true);
    setProgress("Préparation…");

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // Monte le rapport hors-ecran et attend le montage
      setProgress("Rendu du rapport…");
      await new Promise((resolve) => {
        resolveRef.current = resolve;
        setJobPeriods(selectedPeriods);
      });

      const root = stageRef.current;
      setProgress("Chargement des données…");
      await waitForReady(root);

      const capture = (node) => toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });

      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 30;
      const contentW = pageW - margin * 2;
      const colGap = 14;
      const colW = (contentW - colGap) / 2;
      const teal = [65, 174, 173];
      let y = margin;

      // --- En-tete du document ---
      pdf.setTextColor(15, 26, 45);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Rapport de performance", margin, y + 6);
      y += 24;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(100, 116, 139);
      const dateStr = new Date().toLocaleString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
      pdf.text(`${stationLabel || selectedMachine}`, margin, y + 2);
      pdf.text(dateStr, pageW - margin, y + 2, { align: "right" });
      y += 12;
      pdf.setDrawColor(211, 219, 230);
      pdf.line(margin, y + 4, pageW - margin, y + 4);
      y += 16;

      // --- Bandeau KPI temps reel ---
      setProgress("Capture des indicateurs…");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...teal);
      pdf.text("INDICATEURS TEMPS RÉEL", margin, y + 4);
      y += 12;
      try {
        const kpiNode = root.querySelector("[data-report-kpi]");
        if (kpiNode) {
          const dataUrl = await capture(kpiNode);
          const rect = kpiNode.getBoundingClientRect();
          const imgH = contentW * (rect.height / rect.width);
          pdf.addImage(dataUrl, "PNG", margin, y, contentW, imgH, undefined, "FAST");
          y += imgH + 18;
        }
      } catch (err) {
        console.error("Échec capture KPI:", err);
      }

      // --- Pour chaque periode : titre periode + 2 sections (perf + technique) ---
      for (let pi = 0; pi < selectedPeriods.length; pi++) {
        const period = selectedPeriods[pi];
        setProgress(`Capture courbes — ${period.label} (${pi + 1}/${selectedPeriods.length})`);

        // Titre de periode (grand)
        const periodTitleH = 24;
        if (y + periodTitleH + 60 > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.setTextColor(15, 26, 45);
        pdf.text(period.label, margin, y + 11);
        y += periodTitleH;

        // Chaque section cochee (Synthese & performance, puis Donnees techniques)
        for (const secKey of activeSections) {
          const cards = root.querySelectorAll(
            `[data-report-card][data-period="${period.value}"][data-section="${secKey}"]`
          );
          if (cards.length === 0) continue;

          // Capture toutes les cartes de la section
          const imgs = [];
          for (const card of cards) {
            try {
              const dataUrl = await capture(card);
              const rect = card.getBoundingClientRect();
              imgs.push({ dataUrl, h: colW * (rect.height / rect.width) });
            } catch (err) {
              console.error("Échec capture d'une courbe:", err);
            }
          }
          if (imgs.length === 0) continue;

          // Sous-en-tete de section
          const secTitleH = 20;
          const firstRowH = imgs[0].h;
          if (y + secTitleH + firstRowH > pageH - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(...teal);
          pdf.text((SECTION_LABELS[secKey] || secKey).toUpperCase(), margin, y + 9);
          y += secTitleH;

          // Disposition 2 colonnes
          for (let i = 0; i < imgs.length; i += 2) {
            const left = imgs[i];
            const right = imgs[i + 1];
            const rowH = Math.max(left.h, right ? right.h : 0);
            if (y + rowH > pageH - margin) {
              pdf.addPage();
              y = margin;
            }
            pdf.addImage(left.dataUrl, "PNG", margin, y, colW, left.h, undefined, "FAST");
            if (right) {
              pdf.addImage(right.dataUrl, "PNG", margin + colW + colGap, y, colW, right.h, undefined, "FAST");
            }
            y += rowH + 12;
          }
          y += 8;
        }
        y += 6;
      }

      const safeLabel = String(stationLabel || selectedMachine || "station")
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 40);
      const periodsPart = selectedPeriods.map((p) => p.value).join("-");
      pdf.save(`rapport_eaukey_${safeLabel}_${periodsPart}.pdf`);
    } catch (err) {
      console.error("Erreur export PDF:", err);
      alert("Une erreur est survenue pendant l'export. Réessayez.");
    } finally {
      setJobPeriods([]);
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
        title="Télécharger un rapport PDF"
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
          <div className={styles.exportMenuTitle}>Périodes à inclure</div>
          {ALL_PERIODS.map((p) => (
            <label key={p.value} className={styles.exportOption}>
              <input type="checkbox" checked={!!selected[p.value]} onChange={() => toggle(p.value)} />
              <span>{p.label}</span>
            </label>
          ))}

          <div className={styles.exportMenuTitle}>Sections à inclure</div>
          {SECTION_ORDER.map((key) => (
            <label key={key} className={styles.exportOption}>
              <input
                type="checkbox"
                checked={!!selSections[key]}
                onChange={() => toggleSection(key)}
              />
              <span>{SECTION_LABELS[key]}</span>
            </label>
          ))}

          <button
            type="button"
            className={styles.exportConfirm}
            onClick={runExport}
            disabled={!canExport}
          >
            Télécharger le PDF
          </button>
          <p className={styles.exportHint}>
            Le rapport inclut toujours les indicateurs temps réel en tête.
          </p>
        </div>
      )}

      {/* Rapport rendu hors-ecran, uniquement pendant la capture */}
      {jobPeriods.length > 0 && (
        <div
          ref={stageRef}
          aria-hidden="true"
          style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
        >
          <ExportReport
            selectedMachine={selectedMachine}
            isAir={isAir}
            chartGroups={chartGroups}
            periods={jobPeriods}
            sections={activeSections}
          />
        </div>
      )}
    </div>
  );
}
