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
import { useAuth, isSuperAdmin } from "../lib/auth";
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

const formatPhotoDate = (ts) =>
  ts
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      }).format(new Date(ts))
    : null;

/**
 * Carte "Qualité d'eau" : courbe de l'indice qualité par jour (prédiction IA
 * sur les photos du recycleur) + photo prise par l'automate à côté.
 * Données : /eau/qualite_eau/mois (1 point/jour sur 30j) et /eau/derniere_photo.
 *
 * Pour les SUPER ADMINS, le panneau photo devient éditable : on parcourt les
 * photos récentes (/eau/photos) et on peut valider / corriger la qualité et
 * l'opacité prédites (PUT /eau/photo/{id}/validation). Le graphe affiche alors
 * COALESCE(correction, prédiction). Pour les autres utilisateurs : lecture seule.
 */
const QualiteEauCard = ({ title, color, selectedMachine }) => {
  const { user, authFetch } = useAuth();
  const superAdmin = isSuperAdmin(user);

  const [data, setData] = useState([]);
  const [photo, setPhoto] = useState(null);   // mode lecture seule
  const [photos, setPhotos] = useState([]);   // mode super admin (liste éditable)
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Édition (super admin)
  const [editQualite, setEditQualite] = useState("");
  const [editOpacite, setEditOpacite] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const current = superAdmin ? (photos[idx] || null) : null;
  const displayPhoto = superAdmin ? current : photo;

  // Fermeture de la photo agrandie avec la touche Échap.
  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setLightboxOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const fetchSerie = useCallback(async () => {
    const res = await fetch(
      `${API_BASE}/eau/qualite_eau/mois?nom_automate=${selectedMachine}&include_bac_vide=true`
    );
    if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
    const serie = await res.json();
    if (!serie.labels) throw new Error("Format des données incorrect depuis le backend");
    setData(serie.labels.map((label, i) => ({
      time: label,
      qualite: serie.qualite_eau ? serie.qualite_eau[i] : null,
      opacite: serie.opacite ? serie.opacite[i] : null,
    })));
  }, [selectedMachine]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      if (!selectedMachine) {
        setData([]); setPhoto(null); setPhotos([]);
        setLoading(false);
        return;
      }
      if (superAdmin) {
        // include_bac_vide=true : on affiche aussi les photos classées "bac vide".
        const [, photosRes] = await Promise.all([
          fetchSerie(),
          authFetch(`${API_BASE}/eau/photos?nom_automate=${selectedMachine}&period=mois`),
        ]);
        if (photosRes.ok) {
          const j = await photosRes.json();
          setPhotos(Array.isArray(j.photos) ? j.photos : []);
        } else {
          setPhotos([]);
        }
        setIdx(0);
      } else {
        const [, photoRes] = await Promise.all([
          fetchSerie(),
          fetch(`${API_BASE}/eau/derniere_photo?nom_automate=${selectedMachine}&include_bac_vide=true`),
        ]);
        setPhoto(photoRes.ok ? await photoRes.json() : null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMachine, superAdmin, fetchSerie, authFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Synchronise les champs éditables avec la photo courante.
  useEffect(() => {
    if (!superAdmin) return;
    const p = photos[idx];
    setEditQualite(p && p.qualite != null ? String(p.qualite) : "");
    setEditOpacite(p && p.opacite != null ? String(p.opacite) : "");
    setSaveMsg(null);
  }, [superAdmin, photos, idx]);

  // Enregistre une validation / correction / réinitialisation.
  const saveValidation = async (mode) => {
    if (!current) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      let body;
      if (mode === "reset") {
        body = { reset: true };
      } else if (mode === "correct") {
        const q = editQualite === "" ? null : parseFloat(editQualite);
        const o = editOpacite === "" ? null : parseFloat(editOpacite);
        const bad = (v) => v != null && (Number.isNaN(v) || v < 0 || v > 10);
        if (bad(q) || bad(o)) {
          setSaveMsg({ ok: false, text: "Valeurs attendues entre 0 et 10." });
          setSaving(false);
          return;
        }
        body = { qualite_eau: q, opacite: o };
      } else {
        body = {}; // validation simple : le modèle était bon
      }
      const res = await authFetch(`${API_BASE}/eau/photo/${current.id}/validation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(res.status === 403 ? "Réservé au super admin." : `Erreur ${res.status}`);
      }
      const upd = await res.json();
      setPhotos((prev) => prev.map((p, i) => (i === idx ? {
        ...p,
        qualite: upd.qualite,
        opacite: upd.opacite,
        corr_qualite: upd.corr_qualite,
        corr_opacite: upd.corr_opacite,
        validated_by: upd.validated_by,
        validated_at: upd.validated_at,
      } : p)));
      setSaveMsg({ ok: true, text: mode === "reset" ? "Réinitialisé ✓" : "Enregistré ✓" });
      fetchSerie().catch(() => {}); // le graphe reflète la correction
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const hasData = Array.isArray(data) && data.some(
    (d) => (d.qualite != null && !Number.isNaN(parseFloat(d.qualite)))
        || (d.opacite != null && !Number.isNaN(parseFloat(d.opacite)))
  );
  const isEmpty = !loading && !error && !hasData;

  const photoDate = formatPhotoDate(displayPhoto && displayPhoto.timestamp);
  const bacVideProb =
    displayPhoto && displayPhoto.bac_vide_prob != null ? displayPhoto.bac_vide_prob : null;
  const photoBacVide = bacVideProb != null && bacVideProb >= 0.5;
  const isCorrigee = !!(current && (current.corr_qualite != null || current.corr_opacite != null));

  return (
    <ChartCard
      title={title}
      wide
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
        <div style={{ width: "100%" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-muted)" }}>
            Indices notés sur 10
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {/* Courbe qualité par jour — garde la taille d'une carte normale */}
          <div style={{ flex: "1 1 460px", minWidth: 300 }}>
            <ResponsiveContainer width="100%" height={260}>
              <RechartsLineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                <XAxis dataKey="time" {...axisStyle} />
                <YAxis domain={[0, 10]} {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="qualite"
                  name="Qualité"
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

          {/* Photo prise par l'automate */}
          <div style={{ flex: "0 0 240px", minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
            {displayPhoto && displayPhoto.url ? (
              <>
                <img
                  src={displayPhoto.url}
                  alt="Photo du recycleur"
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

                {/* Navigation entre photos (super admin) */}
                {superAdmin && photos.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => Math.max(0, i - 1))}
                      disabled={idx <= 0}
                      style={navBtnStyle(idx <= 0)}
                      title="Photo plus récente"
                    >◀</button>
                    <span style={{ color: "var(--text-muted)" }}>
                      {idx + 1} / {photos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => Math.min(photos.length - 1, i + 1))}
                      disabled={idx >= photos.length - 1}
                      style={navBtnStyle(idx >= photos.length - 1)}
                      title="Photo plus ancienne"
                    >▶</button>
                  </div>
                )}

                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {photoDate && <div>Photo du {photoDate}</div>}
                  {!superAdmin && displayPhoto.qualite != null && (
                    <div>Indice : <strong>{displayPhoto.qualite.toFixed(1)}/10</strong></div>
                  )}
                  {photoBacVide && (
                    <div style={{
                      marginTop: 6,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: "rgba(245, 158, 11, 0.15)",
                      border: "1px solid var(--amber, #f59e0b)",
                      color: "var(--amber, #f59e0b)",
                      fontSize: 12,
                      fontWeight: 600,
                      lineHeight: 1.3,
                    }}>
                      ⚠ Bac détecté comme vide ({Math.round(bacVideProb * 100)}%)
                      <div style={{ fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
                        Vérifiez visuellement.
                      </div>
                    </div>
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

          {/* Panneau critères (super admin) : valider / corriger qualité & opacité, à côté de la photo */}
          {superAdmin && current && (
            <div style={{
              flex: "0 0 250px",
              minWidth: 230,
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border-strong)",
              background: "var(--bg-elevated)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Critères de notation
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Modèle : qualité {current.pred_qualite != null ? current.pred_qualite.toFixed(1) : "—"}
                {" · "}opacité {current.pred_opacite != null ? current.pred_opacite.toFixed(1) : "—"}
              </div>

              <label style={editLabelStyle}>
                <span>Qualité</span>
                <input
                  type="number" min={0} max={10} step={0.1}
                  value={editQualite}
                  onChange={(e) => setEditQualite(e.target.value)}
                  style={editInputStyle}
                />
              </label>
              <label style={editLabelStyle}>
                <span>Opacité</span>
                <input
                  type="number" min={0} max={10} step={0.1}
                  value={editOpacite}
                  onChange={(e) => setEditOpacite(e.target.value)}
                  style={editInputStyle}
                />
              </label>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" disabled={saving} onClick={() => saveValidation("correct")} style={primaryBtnStyle(saving)}>
                  Enregistrer
                </button>
                <button type="button" disabled={saving} onClick={() => saveValidation("validate")} style={ghostBtnStyle(saving)} title="Le modèle est bon, valider sans corriger">
                  Valider
                </button>
                {isCorrigee && (
                  <button type="button" disabled={saving} onClick={() => saveValidation("reset")} style={ghostBtnStyle(saving)} title="Revenir à la prédiction du modèle">
                    ↺
                  </button>
                )}
              </div>

              {current.validated_at && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  ✓ {isCorrigee ? "Corrigé" : "Validé"} par {current.validated_by || "?"}
                  {" le "}{formatPhotoDate(current.validated_at)}
                </div>
              )}
              {saveMsg && (
                <div style={{ fontSize: 12, color: saveMsg.ok ? "var(--success, #10b981)" : "var(--danger, #ef4444)" }}>
                  {saveMsg.text}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Photo agrandie (lightbox) : clic sur le fond ou le bouton pour fermer */}
      {lightboxOpen && displayPhoto && displayPhoto.url && (
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
            src={displayPhoto.url}
            alt="Photo du recycleur (agrandie)"
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

const navBtnStyle = (disabled) => ({
  width: 28, height: 24, borderRadius: 6,
  border: "1px solid var(--border-strong)",
  background: "var(--bg-elevated)",
  color: disabled ? "var(--text-muted)" : "var(--text-primary)",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const editLabelStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 8, fontSize: 12, color: "var(--text-secondary)",
};

const editInputStyle = {
  width: 80, padding: "4px 6px", borderRadius: 6,
  border: "1px solid var(--border-strong)",
  background: "var(--bg-base, transparent)", color: "var(--text-primary)",
};

const primaryBtnStyle = (disabled) => ({
  flex: 1, padding: "5px 8px", borderRadius: 6, border: "none",
  background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 12,
  cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
});

const ghostBtnStyle = (disabled) => ({
  padding: "5px 8px", borderRadius: 6,
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--text-primary)", fontSize: 12,
  cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
});

export default QualiteEauCard;
