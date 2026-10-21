"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, X, Check, Search, Loader2, Pencil } from "lucide-react";
import styles from "./Pannes.module.css";

// Types proposés en gros boutons (les autres restent accessibles via « Autre… »)
const QUICK_TYPES = [
  "Filtre colmaté",
  "Pompe HS",
  "Pompe désamorcée",
  "Cuve pleine",
  "Manque produit chimique",
  "Fuite hydraulique",
  "Erreur automate",
];

// Heure locale au format <input type="datetime-local">
export const toLocalInput = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const toIso = (value) => (value ? new Date(value).toISOString() : null);
const fmt = (value) => (value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "");

const fromPanne = (p) => ({
  station: { client: p.client, lieu: p.lieu, nom_automate: p.nom_automate },
  panne: p.panne || "",
  probleme: p.probleme || "",
  regle: !!p.date_fin,
  cause: p.cause || "",
  action_realisee: p.action_realisee || "",
  pieces_changees: p.pieces_changees || "",
  deplacement: p.deplacement ?? null,
  date_debut: toLocalInput(p.date_debut),
  date_fin: p.date_fin ? toLocalInput(p.date_fin) : "",
  intervenant: p.intervenant || "",
  partage_sav: p.partage_sav !== false,
});

const emptyData = () => ({
  station: null,
  panne: "",
  probleme: "",
  regle: null,
  cause: "",
  action_realisee: "",
  pieces_changees: "",
  deplacement: null,
  date_debut: toLocalInput(),
  date_fin: "",
  intervenant: "",
  partage_sav: true,
});

const RESOLUTION_STEPS = ["cause", "action", "deplacement"];

/**
 * Formulaire de panne en étapes.
 * mode "create" : station → type → constat → réglé ? (→ résolution) → récapitulatif
 * mode "close"  : résolution d'une panne en cours → récapitulatif
 * mode "edit"   : récapitulatif d'une panne existante, chaque ligne rouvre son étape
 */
export default function PanneWizard({ mode, panne, stations, panneTypes, currentUser, onSubmit, onCancel }) {
  const [data, setData] = useState(() => {
    if (mode === "create") return emptyData();
    const d = fromPanne(panne);
    if (mode === "close") return { ...d, regle: true, date_fin: d.date_fin || toLocalInput(), intervenant: d.intervenant || currentUser || "" };
    return d;
  });
  const steps = useMemo(() => {
    if (mode === "close") return [...RESOLUTION_STEPS, "recap"];
    const base = ["station", "type", "detail", "regle"];
    return [...base, ...(data.regle ? RESOLUTION_STEPS : []), "recap"];
  }, [mode, data.regle]);
  const [step, setStep] = useState(mode === "edit" ? "recap" : steps[0]);
  const [fromRecap, setFromRecap] = useState(false);
  const [query, setQuery] = useState("");
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [customType, setCustomType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const focusRef = useRef(null);

  useEffect(() => {
    focusRef.current?.focus?.();
  }, [step]);

  const idx = steps.indexOf(step);
  const set = (patch) => setData((prev) => ({ ...prev, ...patch }));
  const next = (patch = {}) => {
    const merged = { ...data, ...patch };
    setData(merged);
    if (fromRecap) {
      // Depuis le récapitulatif : on y retourne, sauf si on vient de passer à « réglé » sans résolution
      if (patch.regle === true && !merged.cause && !merged.action_realisee) {
        setFromRecap(false);
        setStep("cause");
        return;
      }
      setFromRecap(false);
      setStep("recap");
      return;
    }
    const list = mode === "close" ? steps : ["station", "type", "detail", "regle", ...(merged.regle ? RESOLUTION_STEPS : []), "recap"];
    const i = list.indexOf(step);
    setStep(list[Math.min(i + 1, list.length - 1)]);
  };
  const back = () => {
    if (fromRecap) {
      setFromRecap(false);
      setStep("recap");
      return;
    }
    if (idx <= 0) return onCancel();
    setStep(steps[idx - 1]);
  };
  const goEdit = (target) => {
    setFromRecap(true);
    setStep(target);
  };

  const quickTypes = useMemo(() => {
    const known = new Set(panneTypes.map((t) => t.toLowerCase()));
    return QUICK_TYPES.filter((t) => known.size === 0 || known.has(t.toLowerCase()));
  }, [panneTypes]);

  const filteredStations = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const list = words.length
      ? stations.filter((s) => {
          const hay = `${s.client || ""} ${s.lieu || ""} ${s.nom_automate || ""} ${s.numero_automate || ""}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        })
      : stations;
    // Toutes les stations : la liste défile (une limite à 30 masquait les suivantes).
    return list;
  }, [query, stations]);

  const submit = async () => {
    setError("");
    if (!data.station || !data.panne || !data.probleme.trim() || !data.date_debut) {
      setError("Station, type de panne, constat et date de début sont obligatoires.");
      return;
    }
    const dateFin = data.regle ? data.date_fin || toLocalInput() : "";
    if (dateFin && new Date(dateFin) < new Date(data.date_debut)) {
      setError("La date de fin doit être après la date de début.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        client: data.station.client,
        lieu: data.station.lieu,
        nom_automate: data.station.nom_automate,
        panne: data.panne,
        probleme: data.probleme.trim(),
        date_debut: toIso(data.date_debut),
        date_fin: dateFin ? toIso(dateFin) : null,
        cause: data.cause,
        action_realisee: data.action_realisee,
        pieces_changees: data.pieces_changees,
        deplacement: data.deplacement,
        intervenant: data.intervenant,
        partage_sav: data.partage_sav,
      });
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement");
      setSaving(false);
    }
  };

  const title = mode === "close" ? "Clôturer la panne" : mode === "edit" ? "Modifier la panne" : "Signaler une panne";
  const stationLabel = data.station ? `${data.station.client} — ${data.station.lieu}` : "";

  return (
    <div className={styles.wizard}>
      <div className={styles.wizardHead}>
        <button type="button" className={styles.iconButton} onClick={back} aria-label="Retour" disabled={saving}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.wizardTitle}>
          {title}
          {mode !== "create" && stationLabel ? <span className={styles.wizardSub}>{stationLabel} · {data.panne}</span> : null}
        </div>
        <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="Fermer" disabled={saving}>
          <X size={18} />
        </button>
      </div>
      <div className={styles.progress}>
        <div className={styles.progressBar} style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
      </div>
      <div className={styles.stepCount}>Étape {idx + 1} / {steps.length}</div>

      {step === "station" && (
        <div className={styles.step}>
          <div className={styles.question}>Quelle station ?</div>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              ref={focusRef}
              className={styles.searchInput}
              placeholder="Client, lieu ou n° d'automate…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.muted}>
            {filteredStations.length === stations.length
              ? `${stations.length} stations`
              : `${filteredStations.length} station${filteredStations.length > 1 ? "s" : ""} sur ${stations.length}`}
          </div>
          <div className={styles.choiceList}>
            {filteredStations.length === 0 ? <div className={styles.muted}>Aucune station trouvée</div> : null}
            {filteredStations.map((s) => (
              <button
                key={s.nom_automate}
                type="button"
                className={`${styles.choice} ${data.station?.nom_automate === s.nom_automate ? styles.choiceActive : ""}`}
                onClick={() => next({ station: { client: s.client, lieu: s.lieu, nom_automate: s.nom_automate } })}
              >
                <span className={styles.choiceMain}>{s.client} — {s.lieu}</span>
                <span className={styles.choiceSub}>Automate {s.nom_automate}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "type" && (
        <div className={styles.step}>
          <div className={styles.question}>Quel problème ?</div>
          <div className={styles.chips}>
            {quickTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.chip} ${data.panne === t ? styles.chipActive : ""}`}
                onClick={() => next({ panne: t })}
              >
                {t}
              </button>
            ))}
            <button type="button" className={`${styles.chip} ${showAllTypes ? styles.chipActive : ""}`} onClick={() => setShowAllTypes((v) => !v)}>
              Autre…
            </button>
          </div>
          {showAllTypes ? (
            <div className={styles.stepBlock}>
              <select
                className={styles.select}
                value=""
                onChange={(e) => e.target.value && next({ panne: e.target.value })}
              >
                <option value="">Choisir dans la liste complète</option>
                {panneTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className={styles.inlineRow}>
                <input
                  className={styles.input}
                  placeholder="Ou nouveau type, ex : Capteur pression HS"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
                <button type="button" className={styles.button} disabled={!customType.trim()} onClick={() => next({ panne: customType.trim() })}>
                  OK
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {step === "detail" && (
        <div className={styles.step}>
          <div className={styles.question}>Qu&apos;est-ce que tu constates ?</div>
          <textarea
            ref={focusRef}
            className={styles.textarea}
            placeholder="Ex : la pression filtre reste au-dessus de 2 bars après contre-lavage"
            value={data.probleme}
            onChange={(e) => set({ probleme: e.target.value })}
          />
          <div className={styles.stepActions}>
            <button type="button" className={styles.button} disabled={!data.probleme.trim()} onClick={() => next()}>
              Suivant
            </button>
          </div>
        </div>
      )}

      {step === "regle" && (
        <div className={styles.step}>
          <div className={styles.question}>C&apos;est réglé ?</div>
          <div className={styles.bigChoices}>
            <button type="button" className={`${styles.bigChoice} ${data.regle === false ? styles.choiceActive : ""}`} onClick={() => next({ regle: false })}>
              Pas encore
              <span className={styles.choiceSub}>La panne reste « en cours »</span>
            </button>
            <button type="button" className={`${styles.bigChoice} ${data.regle === true ? styles.choiceActive : ""}`} onClick={() => next({ regle: true, date_fin: data.date_fin || toLocalInput() })}>
              Oui, c&apos;est réglé ✓
              <span className={styles.choiceSub}>3 questions sur la résolution</span>
            </button>
          </div>
        </div>
      )}

      {step === "cause" && (
        <div className={styles.step}>
          <div className={styles.question}>Quelle était la cause ?</div>
          <input
            ref={focusRef}
            className={styles.input}
            placeholder="Ex : crépine encrassée"
            value={data.cause}
            onChange={(e) => set({ cause: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && next()}
          />
          <div className={styles.stepActions}>
            <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={() => next({ cause: "" })}>
              Je ne sais pas
            </button>
            <button type="button" className={styles.button} disabled={!data.cause.trim()} onClick={() => next()}>
              Suivant
            </button>
          </div>
        </div>
      )}

      {step === "action" && (
        <div className={styles.step}>
          <div className={styles.question}>Qu&apos;as-tu fait pour régler ?</div>
          <textarea
            ref={focusRef}
            className={styles.textarea}
            placeholder="Étape par étape : ce qui a été fait, réglé, testé…"
            value={data.action_realisee}
            onChange={(e) => set({ action_realisee: e.target.value })}
          />
          <label className={styles.fieldLabel}>Pièces changées (facultatif)</label>
          <input
            className={styles.input}
            placeholder="Ex : joint pompe KVC"
            value={data.pieces_changees}
            onChange={(e) => set({ pieces_changees: e.target.value })}
          />
          <div className={styles.stepActions}>
            <button type="button" className={styles.button} disabled={!data.action_realisee.trim()} onClick={() => next()}>
              Suivant
            </button>
          </div>
        </div>
      )}

      {step === "deplacement" && (
        <div className={styles.step}>
          <div className={styles.question}>Il a fallu se déplacer ?</div>
          <div className={styles.bigChoices}>
            <button type="button" className={`${styles.bigChoice} ${data.deplacement === true ? styles.choiceActive : ""}`} onClick={() => next({ deplacement: true })}>
              Oui, sur place
            </button>
            <button type="button" className={`${styles.bigChoice} ${data.deplacement === false ? styles.choiceActive : ""}`} onClick={() => next({ deplacement: false })}>
              Non, à distance
            </button>
          </div>
        </div>
      )}

      {step === "recap" && (
        <div className={styles.step}>
          <div className={styles.question}>Récapitulatif</div>
          <div className={styles.recap}>
            {mode !== "close" ? (
              <>
                <RecapLine label="Station" value={stationLabel} onEdit={() => goEdit("station")} />
                <RecapLine label="Problème" value={data.panne} onEdit={() => goEdit("type")} />
                <RecapLine label="Constat" value={data.probleme} onEdit={() => goEdit("detail")} />
                <RecapLine label="Statut" value={data.regle ? "Réglée" : "En cours"} onEdit={() => goEdit("regle")} />
              </>
            ) : null}
            {data.regle ? (
              <>
                <RecapLine label="Cause" value={data.cause || "Non identifiée"} onEdit={() => goEdit("cause")} />
                <RecapLine
                  label="Action"
                  value={data.action_realisee + (data.pieces_changees ? ` (pièces : ${data.pieces_changees})` : "")}
                  onEdit={() => goEdit("action")}
                />
                <RecapLine
                  label="Déplacement"
                  value={data.deplacement === true ? "Sur place" : data.deplacement === false ? "À distance" : "Non renseigné"}
                  onEdit={() => goEdit("deplacement")}
                />
              </>
            ) : null}
          </div>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.fieldLabel}>Début</label>
              <input type="datetime-local" className={styles.input} value={data.date_debut} onChange={(e) => set({ date_debut: e.target.value })} />
            </div>
            {data.regle ? (
              <div>
                <label className={styles.fieldLabel}>Fin</label>
                <input type="datetime-local" className={styles.input} value={data.date_fin} onChange={(e) => set({ date_fin: e.target.value })} />
              </div>
            ) : null}
            <div>
              <label className={styles.fieldLabel}>Intervenant</label>
              <input className={styles.input} placeholder="Par défaut : vous" value={data.intervenant} onChange={(e) => set({ intervenant: e.target.value })} />
            </div>
          </div>
          <label className={styles.checkboxLabel} style={{ marginTop: 10 }}>
            <input type="checkbox" checked={data.partage_sav} onChange={(e) => set({ partage_sav: e.target.checked })} />
            <span>Utiliser cette fiche pour enrichir l&apos;assistant SAV</span>
          </label>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div className={styles.stepActions}>
            <button type="button" className={styles.button} onClick={submit} disabled={saving}>
              {saving ? <Loader2 size={16} className={styles.spin} /> : <Check size={16} />}
              <span>{mode === "close" ? "Clôturer la panne" : "Enregistrer"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecapLine({ label, value, onEdit }) {
  return (
    <button type="button" className={styles.recapLine} onClick={onEdit}>
      <span className={styles.recapLabel}>{label}</span>
      <span className={styles.recapValue}>{value || "—"}</span>
      <Pencil size={14} className={styles.recapEdit} />
    </button>
  );
}

export { fmt };
