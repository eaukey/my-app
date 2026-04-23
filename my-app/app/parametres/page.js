"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Loader2, Sliders } from "lucide-react";
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

export default function ParametresPage() {
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [automates, setAutomates] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
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

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      setError("");
      try {
        const res = await authFetch(
          `${API_BASE}/donnees_modifiables/${encodeURIComponent(selected)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json?.data || null);
      } catch (e) {
        if (!cancelled) {
          setError("Impossible de charger les paramètres pour cet automate.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, authFetch]);

  const lastUpdate = useMemo(() => formatLastUpdate(data?.horodatage), [data]);

  if (isLoading) return <p style={{ padding: 24 }}>Chargement...</p>;
  if (!isAuthenticated || !isAdmin) return <p style={{ padding: 24 }}>Accès refusé.</p>;

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Pilotage</p>
          <h1 className={styles.pageTitle}>Paramètres modifiables</h1>
          <p className={styles.subTitle}>
            Consignes et réglages pouvant être appliqués à l&apos;automate.
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
        </div>
      </div>

      <div className={styles.infoBanner}>
        <Sliders size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
        Les boutons + / − sont visibles mais non actifs pour l&apos;instant —
        la prise en compte côté automate sera ajoutée dans une prochaine étape.
      </div>

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
            ) : !data ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>Aucune donnée enregistrée</p>
                <p className={styles.emptyText}>
                  Aucun paramètre n&apos;a encore été reçu pour cet automate.
                </p>
              </div>
            ) : (
              <div className={styles.paramList}>
                {section.fields.map((f) => (
                  <ParamRow key={f.name} field={f} value={data[f.name]} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ParamRow({ field, value }) {
  // onClick intentionnellement no-op : la logique d'application
  // des modifications sera branchée dans une étape ultérieure.
  const noop = () => {};

  if (field.type === "bool") {
    const on = value === true;
    const isNull = value === null || value === undefined;
    return (
      <div className={styles.paramRow}>
        <div className={styles.paramLabel}>
          <span className={styles.paramName}>{field.label}</span>
          <span className={styles.paramUnit}>{formatValue(value, "bool")}</span>
        </div>
        <button
          type="button"
          onClick={noop}
          className={`${styles.toggle} ${on ? styles.toggleOn : ""} ${isNull ? styles.toggleNull : ""}`}
          aria-label={`Basculer ${field.label}`}
          aria-pressed={on}
        />
      </div>
    );
  }

  const isNull = value === null || value === undefined;
  return (
    <div className={styles.paramRow}>
      <div className={styles.paramLabel}>
        <span className={styles.paramName}>{field.label}</span>
        {field.unit && <span className={styles.paramUnit}>{field.unit}</span>}
      </div>
      <div className={styles.stepper}>
        <button
          type="button"
          onClick={noop}
          className={styles.stepBtn}
          aria-label={`Diminuer ${field.label}`}
        >
          <Minus size={16} />
        </button>
        <span className={`${styles.stepValue} ${isNull ? styles.stepValueNull : ""}`}>
          {formatValue(value, field.type)}
        </span>
        <button
          type="button"
          onClick={noop}
          className={styles.stepBtn}
          aria-label={`Augmenter ${field.label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
