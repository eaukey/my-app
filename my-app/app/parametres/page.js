"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Minus,
  Plus,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./Parametres.module.css";

// Groupes de paramètres, dans l'ordre d'affichage.
// L'ordre et les regroupements reprennent la structure de la table
// `donnees_modifiables` (cf. api.py db_donnees_modifiables).
const SECTIONS = [
  {
    key: "etat",
    title: "État général",
    hint: "Activation / désactivation des sous-systèmes.",
    fullWidth: true,
    fields: [
      { name: "relevage_on", label: "Relevage", type: "bool" },
      { name: "filtration_on", label: "Filtration", type: "bool" },
      { name: "renvoi_on", label: "Renvoi", type: "bool" },
    ],
  },
  {
    key: "relevage",
    title: "Relevage",
    hint: "Consignes et réglages de la pompe de relevage.",
    fields: [
      { name: "consigne_pompe_relevage", label: "Consigne pompe relevage", type: "int" },
      { name: "consigne_debit_max_pompe_relevage_m3h", label: "Consigne débit max pompe relevage", type: "real", unit: "m³/h" },
      { name: "choix_pompe_relevage", label: "Choix pompe relevage", type: "int" },
      { name: "temps_ouverture_decanteur_min", label: "Temps ouverture décanteur", type: "real", unit: "min" },
      { name: "volume_relevage_entre_pause_decal", label: "Volume relevage entre pause (décal)", type: "real", unit: "m³" },
      { name: "temps_pause_ms", label: "Temps pause", type: "int", unit: "ms" },
      { name: "hauteur_cuve_traitement_demarrage_relevage_pc", label: "Hauteur cuve traitement démarrage relevage", type: "real", unit: "%" },
    ],
  },
  {
    key: "filtration",
    title: "Filtration / Traitement",
    hint: "Paramètres du circuit de filtration.",
    fields: [
      { name: "consigne_vitesse_pompe_filtration", label: "Consigne vitesse pompe filtration", type: "int" },
      { name: "consigne_pression_max_filtre_mbar", label: "Consigne pression max filtre", type: "real", unit: "mbar" },
      { name: "hauteur_stop_filtration_pc", label: "Hauteur stop filtration", type: "real", unit: "%" },
      { name: "hauteur_relance_filtration_pc", label: "Hauteur relance filtration", type: "real", unit: "%" },
      { name: "choix_pompe_filtration", label: "Choix pompe filtration", type: "int" },
      { name: "hauteur_cuve_traitement_demarrage_filtration_pc", label: "Hauteur cuve traitement démarrage filtration", type: "real", unit: "%" },
    ],
  },
  {
    key: "renvoi",
    title: "Renvoi",
    hint: "Consignes pression / hauteur / conductivité pour le renvoi.",
    fields: [
      { name: "hauteur_min_remplissage_eau_adoucie_pc", label: "Hauteur min remplissage eau adoucie", type: "real", unit: "%" },
      { name: "hauteur_max_pc", label: "Hauteur max", type: "real", unit: "%" },
      { name: "valeur_min_conductivite_us_cm2", label: "Valeur min conductivité", type: "real", unit: "µS/cm²" },
      { name: "valeur_max_conductivite_us_cm2", label: "Valeur max conductivité", type: "real", unit: "µS/cm²" },
      { name: "volume_actualisation_renvoi_dilution_m3", label: "Volume actualisation renvoi (dilution)", type: "real", unit: "m³" },
      { name: "choix_pompe_renvoi", label: "Choix pompe renvoi", type: "int" },
      { name: "consigne_vitesse_pompe_renvoi", label: "Consigne vitesse pompe renvoi", type: "int" },
      { name: "consigne_pression_station_mbar", label: "Consigne pression station", type: "real", unit: "mbar" },
      { name: "hysteresis_renvoi_mbar", label: "Hystérésis renvoi", type: "real", unit: "mbar" },
      { name: "ouverture_electrovanne_station_mbar", label: "Ouverture électrovanne station", type: "real", unit: "mbar" },
      { name: "fermeture_electrovanne_station_mbar", label: "Fermeture électrovanne station", type: "real", unit: "mbar" },
    ],
  },
  {
    key: "vidange",
    title: "Vidange",
    hint: "Fréquences et temps de cycle de vidange.",
    fields: [
      { name: "temps_cl_filtre_media", label: "Temps CL filtre média", type: "real" },
      { name: "temps_cl_ca_filtre_transparent", label: "Temps CL + CA filtre transparent", type: "real" },
      { name: "frequence_vidange_cuve", label: "Fréquence vidange cuve", type: "real" },
      { name: "frequence_vidange_filtration", label: "Fréquence vidange filtration", type: "real" },
    ],
  },
  {
    key: "dosage",
    title: "Pompe doseuse",
    hint: "Temps de dosage du produit.",
    fields: [
      { name: "temps_dosage", label: "Temps dosage", type: "real" },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

const stepFor = (field) => {
  if (field.step !== undefined) return field.step;
  return field.type === "int" ? 1 : 0.1;
};

const formatValue = (value, type) => {
  if (value === null || value === undefined) return "—";
  if (type === "bool") return value ? "On" : "Off";
  if (type === "int") return Number(value).toString();
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
};

const formatLastUpdate = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return null;
  }
};

// Compare deux valeurs (cible vs etat automate) pour determiner si une modif
// est en attente d'application. Tolere les types int vs real equivalents.
const valuesDiffer = (a, b) => {
  const aNull = a === null || a === undefined || a === "";
  const bNull = b === null || b === undefined || b === "";
  if (aNull && bNull) return false;
  if (aNull || bNull) return true;
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) !== Boolean(b);
  return Number(a) !== Number(b);
};

// Conversion JS -> payload PUT : string ou number -> bool/int/float selon le champ.
const coerceForPayload = (raw, type) => {
  if (raw === null || raw === undefined || raw === "") return null;
  if (type === "bool") return Boolean(raw);
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return type === "int" ? Math.trunc(n) : n;
};

// Construit la valeur initiale du formulaire : cible (si elle existe) sinon etat courant.
const buildFormValues = (current, target) => {
  const out = {};
  for (const f of ALL_FIELDS) {
    if (target && target[f.name] !== undefined && target[f.name] !== null) {
      out[f.name] = target[f.name];
    } else if (current && current[f.name] !== undefined) {
      out[f.name] = current[f.name];
    } else {
      out[f.name] = null;
    }
  }
  return out;
};

export default function ParametresPage() {
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [automates, setAutomates] = useState([]);
  const [selected, setSelected] = useState("");
  const [currentData, setCurrentData] = useState(null);
  const [targetData, setTargetData] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const res = await authFetch(`${API_BASE}/recherche/automate_LCA`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setAutomates(list);
        if (list.length > 0 && !selected) setSelected(list[0].nom_automate);
      } catch (e) {
        if (!cancelled) setError("Impossible de charger la liste des automates.");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin]);

  const loadAutomateData = useCallback(
    async (nomAutomate, { cancelledRef } = {}) => {
      if (!nomAutomate) return;
      setLoadingData(true);
      setError("");
      setSubmitMessage(null);
      try {
        const [donneesRes, consignesRes] = await Promise.all([
          authFetch(`${API_BASE}/donnees_modifiables/${encodeURIComponent(nomAutomate)}`),
          authFetch(`${API_BASE}/consignes_modifiables/${encodeURIComponent(nomAutomate)}`),
        ]);
        if (cancelledRef?.current) return;
        if (!donneesRes.ok) throw new Error(`HTTP donnees ${donneesRes.status}`);
        if (!consignesRes.ok) throw new Error(`HTTP consignes ${consignesRes.status}`);
        const donneesJson = await donneesRes.json();
        const consignesJson = await consignesRes.json();
        if (cancelledRef?.current) return;
        const current = donneesJson?.data || null;
        const target = consignesJson?.data || null;
        setCurrentData(current);
        setTargetData(target);
        setFormValues(buildFormValues(current, target));
      } catch (e) {
        if (cancelledRef?.current) return;
        setError("Impossible de charger les paramètres pour cet automate.");
        setCurrentData(null);
        setTargetData(null);
        setFormValues({});
      } finally {
        if (!cancelledRef?.current) setLoadingData(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    if (!selected) {
      setCurrentData(null);
      setTargetData(null);
      setFormValues({});
      return;
    }
    const cancelledRef = { current: false };
    loadAutomateData(selected, { cancelledRef });
    return () => {
      cancelledRef.current = true;
    };
  }, [selected, loadAutomateData]);

  const lastUpdate = useMemo(() => formatLastUpdate(currentData?.horodatage), [currentData]);

  // Detection des champs en attente d'application par l'automate :
  // formValues != currentData (l'utilisateur a une cible differente de l'etat envoye).
  const pendingNames = useMemo(() => {
    if (!currentData) return new Set();
    const names = new Set();
    for (const f of ALL_FIELDS) {
      if (valuesDiffer(formValues[f.name], currentData[f.name])) names.add(f.name);
    }
    return names;
  }, [currentData, formValues]);

  // Le formulaire est-il different du dernier snapshot enregistre (cible serveur ou etat) ?
  const isDirty = useMemo(() => {
    const baseline = targetData || currentData || {};
    return ALL_FIELDS.some((f) => valuesDiffer(formValues[f.name], baseline[f.name]));
  }, [formValues, targetData, currentData]);

  const handleFieldChange = useCallback((name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setSubmitMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      // Envoi de TOUTES les valeurs du formulaire : l'automate recupere ainsi
      // un set complet de consignes, plus safe que les seuls champs modifies.
      const payload = {};
      for (const f of ALL_FIELDS) {
        payload[f.name] = coerceForPayload(formValues[f.name], f.type);
      }
      const res = await authFetch(
        `${API_BASE}/consignes_modifiables/${encodeURIComponent(selected)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j?.detail || JSON.stringify(j);
        } catch {
          detail = await res.text().catch(() => "");
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      setSubmitMessage({
        type: "success",
        text: "Consigne enregistrée. L'automate l'appliquera à son prochain cycle.",
      });
      const cancelledRef = { current: false };
      await loadAutomateData(selected, { cancelledRef });
    } catch (e) {
      setSubmitMessage({
        type: "error",
        text: `Échec de l'enregistrement : ${e.message || e}`,
      });
    } finally {
      setSubmitting(false);
    }
  }, [selected, formValues, authFetch, loadAutomateData]);

  if (isLoading) return <p style={{ padding: 24 }}>Chargement...</p>;
  if (!isAuthenticated || !isAdmin) return <p style={{ padding: 24 }}>Accès refusé.</p>;

  const pendingCount = pendingNames.size;

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Pilotage</p>
          <h1 className={styles.pageTitle}>Paramètres modifiables</h1>
          <p className={styles.subTitle}>
            Consignes et réglages appliqués à l&apos;automate.
          </p>
        </div>
        <div className={styles.headerRight}>
          <select
            className={styles.automateSelect}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loadingList || automates.length === 0}
          >
            {loadingList && <option>Chargement...</option>}
            {!loadingList && automates.length === 0 && (
              <option value="">Aucun automate</option>
            )}
            {!loadingList &&
              automates.map((a) => (
                <option key={a.nom_automate} value={a.nom_automate}>
                  {a.nom_automate}
                  {a.client ? ` — ${a.client}` : ""}
                  {a.lieu ? ` (${a.lieu})` : ""}
                </option>
              ))}
          </select>
          {lastUpdate && (
            <span className={styles.lastUpdate}>Dernière MAJ : {lastUpdate}</span>
          )}
          <button
            type="button"
            className={styles.saveBtn}
            disabled={!selected || !isDirty || submitting || loadingData}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 size={14} className={styles.spin} />
            ) : (
              <Save size={14} />
            )}
            Enregistrer
          </button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className={styles.pendingBanner}>
          <Clock size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {pendingCount} paramètre{pendingCount > 1 ? "s" : ""} en cours de modification
          {" "}(en attente d&apos;application par l&apos;automate).
        </div>
      )}

      {submitMessage && (
        <div
          className={
            submitMessage.type === "success" ? styles.successBanner : styles.alert
          }
        >
          {submitMessage.type === "success" ? (
            <CheckCircle2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          ) : (
            <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          )}
          {submitMessage.text}
        </div>
      )}

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.sectionGrid}>
        {SECTIONS.map((section) => (
          <section
            key={section.key}
            className={`${styles.card} ${section.fullWidth ? styles.sectionFull : ""}`}
          >
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.eyebrow}>Section</p>
                <h2 className={styles.cardTitle}>{section.title}</h2>
                {section.hint && <p className={styles.cardHint}>{section.hint}</p>}
              </div>
            </div>

            {loadingData ? (
              <div className={styles.paramList}>
                {section.fields.map((f) => (
                  <div key={f.name} className={styles.skeletonRow} />
                ))}
              </div>
            ) : !currentData && !targetData ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Aucune donnée enregistrée</p>
                <p className={styles.emptyText}>
                  Aucun paramètre n&apos;a encore été reçu pour cet automate.
                </p>
              </div>
            ) : (
              <div className={styles.paramList}>
                {section.fields.map((f) => (
                  <ParamRow
                    key={f.name}
                    field={f}
                    formValue={formValues[f.name]}
                    isPending={pendingNames.has(f.name)}
                    onChange={(v) => handleFieldChange(f.name, v)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ParamRow({ field, formValue, isPending, onChange }) {
  if (field.type === "bool") {
    const on = formValue === true;
    const isNull = formValue === null || formValue === undefined;
    return (
      <div className={`${styles.paramRow} ${isPending ? styles.paramRowPending : ""}`}>
        <div className={styles.paramLabel}>
          <span className={styles.paramName}>{field.label}</span>
          <span className={styles.paramUnit}>{formatValue(formValue, "bool")}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(!on)}
          className={`${styles.toggle} ${on ? styles.toggleOn : ""} ${isNull ? styles.toggleNull : ""}`}
          aria-label={`Basculer ${field.label}`}
          aria-pressed={on}
        />
      </div>
    );
  }

  const isNull = formValue === null || formValue === undefined || formValue === "";
  const step = stepFor(field);

  const adjust = (delta) => {
    const base = Number(formValue);
    const start = Number.isFinite(base) ? base : 0;
    const next = start + delta;
    const rounded =
      field.type === "int" ? Math.trunc(next) : Math.round(next * 1000) / 1000;
    onChange(rounded);
  };

  const onInput = (e) => {
    const v = e.target.value;
    if (v === "") return onChange(null);
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    onChange(field.type === "int" ? Math.trunc(n) : n);
  };

  return (
    <div className={`${styles.paramRow} ${isPending ? styles.paramRowPending : ""}`}>
      <div className={styles.paramLabel}>
        <span className={styles.paramName}>{field.label}</span>
        {field.unit && <span className={styles.paramUnit}>{field.unit}</span>}
      </div>
      <div className={styles.stepper}>
        <button
          type="button"
          onClick={() => adjust(-step)}
          className={styles.stepBtn}
          aria-label={`Diminuer ${field.label}`}
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          step={step}
          value={isNull ? "" : formValue}
          onChange={onInput}
          className={`${styles.stepInput} ${isNull ? styles.stepValueNull : ""}`}
          aria-label={field.label}
        />
        <button
          type="button"
          onClick={() => adjust(step)}
          className={styles.stepBtn}
          aria-label={`Augmenter ${field.label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
