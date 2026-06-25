'use client';

import React, { useCallback, useEffect, useState } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { API_BASE } from "../lib/apiBase";
import ChartCard from "./ChartCard";

const axisStyle = {
  tick: { fill: "var(--text-muted)", fontSize: 12 },
  axisLine: { stroke: "var(--border-strong)" },
  tickLine: { stroke: "var(--border-strong)" },
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 12,
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)" },
};

/**
 * Carte "Qualité d'eau" : courbe de l'indice qualité par jour (prédiction IA
 * sur les photos du recycleur) + dernière photo prise par l'automate à côté.
 * Données : /eau/qualite_eau/mois (1 point/jour sur 30j) et /eau/derniere_photo.
 */
const QualiteEauCard = ({ title, color, selectedMachine }) => {
  const [data, setData] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Fermeture de la photo agrandie avec la touche Échap.
  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setLightboxOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!selectedMachine) {
        setData([]);
        setPhoto(null);
        setLoading(false);
        return;
      }
      const [serieRes, photoRes] = await Promise.all([
        fetch(`${API_BASE}/eau/qualite_eau/mois?nom_automate=${selectedMachine}`),
        fetch(`${API_BASE}/eau/derniere_photo?nom_automate=${selectedMachine}`),
      ]);
      if (!serieRes.ok) throw new Error(`Erreur serveur: ${serieRes.status}`);
      const serie = await serieRes.json();
      if (!serie.labels) throw new Error("Format des données incorrect depuis le backend");

      const formatted = serie.labels.map((label, i) => ({
        time: label,
        qualite: serie.qualite_eau ? serie.qualite_eau[i] : null,
        opacite: serie.opacite ? serie.opacite[i] : null,
      }));
      setData(formatted);

      // La photo est optionnelle : un échec ne casse pas la carte.
      if (photoRes.ok) {
        setPhoto(await photoRes.json());
      } else {
        setPhoto(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMachine]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const hasData = Array.isArray(data) && data.some(
    (d) => (d.qualite != null && !Number.isNaN(parseFloat(d.qualite)))
        || (d.opacite != null && !Number.isNaN(parseFloat(d.opacite)))
  );
  const isEmpty = !loading && !error && !hasData;

  const photoDate = photo && photo.timestamp
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      }).format(new Date(photo.timestamp))
    : null;

  return (
    <ChartCard
      title={title}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      onRetry={fetchAll}
      emptyTitle={!selectedMachine ? "Sélectionnez un site" : "Analyse d'image non disponible"}
      emptyDescription={
        !selectedMachine
          ? "Choisissez un site pour afficher les données."
          : "Cet automate ne collecte pas (ou ne transmet pas) l'analyse de la qualité d'eau par image."
      }
    >
      {hasData && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          {/* Courbe qualité par jour */}
          <div style={{ flex: "2 1 320px", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={240}>
              <RechartsLineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <XAxis dataKey="time" {...axisStyle} />
                <YAxis domain={[0, 10]} {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="qualite"
                  name="Qualité (/10)"
                  stroke={color || "var(--primary)"}
                  strokeWidth={2.4}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="opacite"
                  name="Opacité"
                  stroke="var(--amber, #f59e0b)"
                  strokeWidth={2.4}
                  dot={false}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>

          {/* Dernière photo prise par l'automate */}
          <div style={{ flex: "1 1 200px", minWidth: 180, display: "flex", flexDirection: "column", gap: 8 }}>
            {photo && photo.url ? (
              <>
                <img
                  src={photo.url}
                  alt="Dernière photo du recycleur"
                  onClick={() => setLightboxOpen(true)}
                  title="Cliquer pour agrandir"
                  style={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid var(--border-strong)",
                    cursor: "zoom-in",
                  }}
                />
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {photoDate && <div>Photo du {photoDate}</div>}
                  {photo.qualite != null && (
                    <div>Indice : <strong>{photo.qualite.toFixed(1)}/10</strong></div>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                height: 200, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 12, border: "1px dashed var(--border-strong)",
                color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 12,
              }}>
                Aucune photo disponible
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo agrandie (lightbox) : clic sur le fond ou le bouton pour fermer */}
      {lightboxOpen && photo && photo.url && (
        <div
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Fermer"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
          <img
            src={photo.url}
            alt="Dernière photo du recycleur (agrandie)"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      )}
    </ChartCard>
  );
};

export default QualiteEauCard;
