"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Wrench, Eye, CheckCircle2, BellOff, ChevronDown, ChevronUp, CheckCheck, RotateCcw } from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import PanneWizard, { fmt, toLocalInput } from "../pannes/PanneWizard";
import styles from "../pannes/Pannes.module.css";
import a from "./Alertes.module.css";

// Alertes envoyées par les automates (API d'ingestion POST /api/alertes).
// Le backend regroupe déjà les répétitions (même station + même code) : une carte
// = une alerte avec son nombre d'occurrences. Une alerte peut devenir une panne :
// le formulaire de panne s'ouvre pré-rempli (POST /alertes/{id}/panne).

const STATUT_TABS = [
  { key: "a_traiter", label: "À traiter", statut: "nouvelle,vue" },
  { key: "traitee", label: "Traitées", statut: "traitee" },
  { key: "ignoree", label: "Ignorées", statut: "ignoree" },
  { key: "all", label: "Toutes", statut: "" },
];
const CLASSES = [
  { key: "panne", label: "Panne" },
  { key: "seuil", label: "Seuil" },
  { key: "information", label: "Information" },
  { key: "maintenance", label: "Maintenance" },
];
const STATUT_LABEL = { nouvelle: "Nouvelle", vue: "Vue", traitee: "Traitée", ignoree: "Ignorée" };
const NIVEAU_LABEL = { critique: "Critique", avertissement: "Avertissement", info: "Info" };
const PERIODES = [
  { key: "1", label: "24 h" },
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
  { key: "", label: "Tout" },
];

const jourIso = (joursAvant) => {
  const d = new Date(Date.now() - Number(joursAvant) * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const stationLabel = (al) => (al.client && al.lieu ? `${al.client} — ${al.lieu}` : `Automate ${al.nom_automate}`);
const valeurLabel = (al) => (al.valeur != null ? `${al.valeur}${al.unite ? ` ${al.unite}` : ""}` : "");

// Type de panne proposé : un type connu contenu dans le libellé de l'alerte, sinon rien
// (le formulaire s'ouvre alors sur la question « Quel problème ? »).
const typeDepuisLibelle = (libelle, types) => {
  const l = String(libelle || "").toLowerCase();
  return types.find((t) => t.toLowerCase() === l) || types.find((t) => t.length > 3 && l.includes(t.toLowerCase())) || "";
};

const constatDepuisAlerte = (al) => {
  const parts = [`${al.libelle} (alerte automate ${al.code}${valeurLabel(al) ? `, valeur ${valeurLabel(al)}` : ""})`];
  parts.push(
    al.occurrences > 1
      ? `${al.occurrences} occurrences du ${fmt(al.premiere_at)} au ${fmt(al.derniere_at)}.`
      : `Le ${fmt(al.premiere_at)}.`
  );
  return parts.join(" — ");
};

export default function AlertesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [alertes, setAlertes] = useState([]);
  const [compteurs, setCompteurs] = useState(null);
  const [panneTypes, setPanneTypes] = useState([]);
  const [tab, setTab] = useState("a_traiter");
  const [classe, setClasse] = useState("");
  const [periode, setPeriode] = useState("7");
  const [station, setStation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [parStation, setParStation] = useState(false);
  const [ouverte, setOuverte] = useState(null); // id de l'alerte dont l'historique est affiché
  const [detail, setDetail] = useState({});
  const [wizard, setWizard] = useState(null); // alerte à convertir en panne
  const [stationsVues, setStationsVues] = useState({}); // nom_automate -> libellé, cumulé (le filtre station ne vide pas la liste)
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);

  const call = useCallback(
    async (path, options = {}) => {
      const res = await authFetch(`${API_BASE}${path}`, { headers, ...options });
      if (!res.ok) {
        let msg = await res.text();
        try {
          msg = JSON.parse(msg).detail || msg;
        } catch {}
        throw new Error(typeof msg === "string" ? msg : "Erreur");
      }
      return res.json();
    },
    [authFetch, headers]
  );

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    const t = STATUT_TABS.find((x) => x.key === tab);
    if (t?.statut) qs.set("statut", t.statut);
    if (classe) qs.set("classe", classe);
    if (periode) qs.set("du", jourIso(periode));
    if (station) qs.set("nom_automate", station);
    return qs.toString();
  }, [tab, classe, periode, station]);

  const fetchAll = useCallback(async () => {
    try {
      const [list, cpt] = await Promise.all([call(`/alertes${query ? `?${query}` : ""}`), call("/alertes/compteurs")]);
      const L = Array.isArray(list) ? list : [];
      setAlertes(L);
      setStationsVues((prev) => {
        const next = { ...prev };
        L.forEach((al) => {
          next[al.nom_automate] = stationLabel(al);
        });
        return next;
      });
      setCompteurs(cpt);
      setError("");
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des alertes");
    } finally {
      setLoaded(true);
    }
  }, [call, query]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;
    fetchAll();
    const id = setInterval(fetchAll, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated, isAdmin, fetchAll]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    call("/pannes/types")
      .then((t) => setPanneTypes((Array.isArray(t) ? t : []).map((x) => String(x).trim()).filter(Boolean)))
      .catch(() => {});
  }, [isAuthenticated, isAdmin, call]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // Prévient le menu (badge) qu'il doit se mettre à jour
  const refresh = useCallback(async () => {
    await fetchAll();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("alertes:maj"));
  }, [fetchAll]);

  const majAlerte = async (al, patch, message) => {
    try {
      await call(`/alertes/${al.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (message) setNotice(message);
      await refresh();
    } catch (e) {
      setError(e.message || "Erreur lors de la mise à jour");
    }
  };

  const toutVu = async () => {
    try {
      const r = await call("/alertes/vues", { method: "POST", body: JSON.stringify({}) });
      setNotice(`${r.modifiees} alerte${r.modifiees > 1 ? "s" : ""} marquée${r.modifiees > 1 ? "s" : ""} comme vue${r.modifiees > 1 ? "s" : ""}`);
      await refresh();
    } catch (e) {
      setError(e.message || "Erreur");
    }
  };

  const toggleHistorique = async (al) => {
    if (ouverte === al.id) {
      setOuverte(null);
      return;
    }
    setOuverte(al.id);
    if (al.statut === "nouvelle") majAlerte(al, { statut: "vue" });
    if (!detail[al.id]) {
      try {
        const d = await call(`/alertes/${al.id}`);
        setDetail((prev) => ({ ...prev, [al.id]: d }));
      } catch (e) {
        setError(e.message || "Erreur lors du chargement de l'historique");
      }
    }
  };

  const creerPanne = async (payload) => {
    const r = await call(`/alertes/${wizard.id}/panne`, { method: "POST", body: JSON.stringify(payload) });
    setWizard(null);
    setNotice(`Panne créée depuis l'alerte ✓ (n° ${r?.panne?.id ?? ""})`);
    await refresh();
  };

  const stationsConnues = useMemo(() => {
    const m = new Map(Object.entries(stationsVues));
    if (station && !m.has(station)) m.set(station, `Automate ${station}`);
    return [...m.entries()].sort((x, y) => x[1].localeCompare(y[1], "fr", { sensitivity: "base" }));
  }, [stationsVues, station]);

  const filtered = useMemo(() => {
    const words = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return alertes;
    return alertes.filter((al) => {
      const hay = [al.client, al.lieu, al.nom_automate, al.code, al.libelle, al.commentaire].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [alertes, searchTerm]);

  const groupes = useMemo(() => {
    if (!parStation) return [{ key: "all", label: null, items: filtered }];
    const m = new Map();
    filtered.forEach((al) => {
      if (!m.has(al.nom_automate)) m.set(al.nom_automate, { key: al.nom_automate, label: stationLabel(al), items: [] });
      m.get(al.nom_automate).items.push(al);
    });
    return [...m.values()];
  }, [filtered, parStation]);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) {
    router.replace("/");
    return null;
  }
  if (!isAdmin) return <p>Accès refusé.</p>;

  const nbTab = (key) => {
    if (!compteurs) return "";
    const p = compteurs.par_statut || {};
    const n = key === "a_traiter" ? compteurs.a_traiter : key === "all" ? Object.values(p).reduce((s, x) => s + x, 0) : p[key];
    return ` (${n ?? 0})`;
  };

  return (
    <div className={styles.container}>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {wizard ? (
        <div className={styles.section}>
          <PanneWizard
            key={`alerte-${wizard.id}`}
            mode="create"
            title="Créer une panne depuis l'alerte"
            lockStation
            initial={{
              station: { client: wizard.client, lieu: wizard.lieu, nom_automate: wizard.nom_automate },
              panne: typeDepuisLibelle(wizard.libelle, panneTypes),
              probleme: constatDepuisAlerte(wizard),
              date_debut: toLocalInput(wizard.premiere_at),
            }}
            stations={[]}
            panneTypes={panneTypes}
            currentUser={user?.email || ""}
            onSubmit={creerPanne}
            onCancel={() => setWizard(null)}
          />
        </div>
      ) : null}

      <div className={styles.section}>
        <div className={a.head}>
          <div>
            <div className={styles.title}>Alertes des automates</div>
            <div className={a.sub}>
              {compteurs ? `${compteurs.nouvelles} nouvelle${compteurs.nouvelles > 1 ? "s" : ""} · ${compteurs.a_traiter} à traiter` : " "}
            </div>
          </div>
          {compteurs?.nouvelles > 0 ? (
            <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={toutVu}>
              <CheckCheck size={16} />
              <span>Tout marquer comme vu</span>
            </button>
          ) : null}
        </div>

        <div className={styles.tabs}>
          {STATUT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`${styles.tabButton} ${a.tab} ${tab === t.key ? styles.tabButtonActive : ""}`}
            >
              {t.label}
              {nbTab(t.key)}
            </button>
          ))}
        </div>

        <div className={a.filters}>
          <div className={a.chips} role="group" aria-label="Classe">
            <button type="button" className={`${a.chip} ${!classe ? a.chipOn : ""}`} onClick={() => setClasse("")}>
              Toutes classes
            </button>
            {CLASSES.map((c) => (
              <button key={c.key} type="button" className={`${a.chip} ${classe === c.key ? a.chipOn : ""}`} onClick={() => setClasse(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className={a.selects}>
            <select className={`${styles.select} ${a.select}`} value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Période">
              {PERIODES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key ? `Depuis ${p.label}` : "Toute la période"}
                </option>
              ))}
            </select>
            <select className={`${styles.select} ${a.select}`} value={station} onChange={(e) => setStation(e.target.value)} aria-label="Station">
              <option value="">Toutes les stations</option>
              {stationsConnues.map(([nom, label]) => (
                <option key={nom} value={nom}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className={a.searchRow}>
            <div className={`${styles.searchBox} ${a.search}`}>
              <Search size={16} />
              <input
                className={styles.searchInput}
                placeholder="Rechercher (station, code, libellé…)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={parStation} onChange={(e) => setParStation(e.target.checked)} />
              <span>Grouper par station</span>
            </label>
          </div>
        </div>

        {loaded && filtered.length === 0 ? <div className={styles.muted}>Aucune alerte</div> : null}
        {groupes.map((g) => (
          <div key={g.key} className={a.group}>
            {g.label ? (
              <div className={a.groupTitle}>
                {g.label} <span className={a.groupCount}>{g.items.length} alerte{g.items.length > 1 ? "s" : ""}</span>
              </div>
            ) : null}
            <div className={styles.cards}>
              {g.items.map((al) => (
                <AlerteCard
                  key={al.id}
                  al={al}
                  open={ouverte === al.id}
                  detail={detail[al.id]}
                  onToggle={() => toggleHistorique(al)}
                  onPanne={() => {
                    setWizard(al);
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onMaj={(patch, msg) => majAlerte(al, patch, msg)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlerteCard({ al, open, detail, onToggle, onPanne, onMaj }) {
  const actif = al.statut === "nouvelle" || al.statut === "vue";
  return (
    <div className={`${styles.card} ${a.card} ${a[`niv_${al.niveau}`] || ""} ${al.statut === "nouvelle" ? a.cardNew : ""}`} data-testid="alerte">
      <div className={a.cardTop}>
        <div className={styles.cardTitle}>{stationLabel(al)}</div>
        {al.occurrences > 1 ? (
          <span className={a.count} title={`${al.occurrences} occurrences regroupées`}>
            ×{al.occurrences}
          </span>
        ) : null}
      </div>
      <div className={styles.cardMeta}>
        <span className={`${styles.pill} ${a[`pill_${al.niveau}`] || ""}`}>{NIVEAU_LABEL[al.niveau] || al.niveau}</span>
        <span className={`${styles.pill} ${al.statut === "nouvelle" ? a.pillNew : ""}`}>{STATUT_LABEL[al.statut] || al.statut}</span>
        <span className={styles.pill}>Code {al.code}</span>
      </div>
      <div className={a.libelle}>{al.libelle}</div>
      <div className={a.facts}>
        {valeurLabel(al) ? <span>Valeur : <strong>{valeurLabel(al)}</strong></span> : null}
        <span>
          {al.occurrences > 1 ? `Du ${fmt(al.premiere_at)} au ${fmt(al.derniere_at)}` : `Le ${fmt(al.premiere_at)}`}
        </span>
      </div>
      <label className={a.classeRow}>
        <span className={styles.fieldLabel}>Classe</span>
        <select
          className={`${styles.select} ${a.classeSelect}`}
          value={al.classe}
          onChange={(e) => onMaj({ classe: e.target.value }, "Classe modifiée")}
          aria-label="Classe de l'alerte"
        >
          {CLASSES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {al.panne_id ? (
        <div className={a.panneLink}>
          <Wrench size={14} />
          <span>Panne n° {al.panne_id} créée</span>
          <Link href="/pannes">Voir les pannes</Link>
        </div>
      ) : null}
      {al.traitee_par && !actif ? <div className={styles.muted}>{STATUT_LABEL[al.statut]} par {al.traitee_par}</div> : null}

      {open ? (
        <div className={a.histo}>
          {!detail ? (
            <div className={styles.muted}>Chargement…</div>
          ) : (
            <>
              {detail.diagnostic && (detail.diagnostic.causes?.length > 0 || detail.diagnostic.fiches?.length > 0) ? (
                <div className={a.diag}>
                  <div className={styles.fieldLabel}>Diagnostic probable</div>
                  {detail.diagnostic.causes?.length > 0 ? (
                    <ul className={a.diagList}>
                      {detail.diagnostic.causes.map((c) => (
                        <li key={c.cause}>
                          <strong>{c.cause}</strong>
                          <span className={styles.muted}>
                            {" "}— constaté {c.occurrences} fois pour cette alerte
                            {c.action ? ` · dernière action : ${c.action}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {detail.diagnostic.fiches?.length > 0 ? (
                    <ul className={a.diagList}>
                      {detail.diagnostic.fiches.map((f) => (
                        <li key={f.id}>
                          <Link href="/base-sav">Fiche SAV : {f.titre}</Link>
                          {f.extrait ? <span className={styles.muted}> — {f.extrait}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <div className={styles.fieldLabel}>
                {detail.historique.length} dernière{detail.historique.length > 1 ? "s" : ""} occurrence{detail.historique.length > 1 ? "s" : ""}
              </div>
              <ul className={a.histoList}>
                {detail.historique.slice(0, 20).map((h) => (
                  <li key={h.horodatage}>
                    <span>{fmt(h.horodatage)}</span>
                    <span>{NIVEAU_LABEL[h.niveau] || h.niveau}</span>
                    <span>{h.valeur != null ? `${h.valeur}${al.unite ? ` ${al.unite}` : ""}` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <div className={`${styles.cardFoot} ${a.foot}`}>
        <button type="button" className={a.linkBtn} onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span>Historique</span>
        </button>
        <div className={a.actions}>
          {!al.panne_id ? (
            <button type="button" className={a.panneBtn} onClick={onPanne}>
              <Wrench size={16} />
              <span>Créer une panne</span>
            </button>
          ) : null}
          {al.statut === "nouvelle" ? (
            <button type="button" className={`${styles.iconButton} ${styles.primaryGhost}`} onClick={() => onMaj({ statut: "vue" })} aria-label="Marquer comme vue" data-tooltip="Vue">
              <Eye size={16} />
            </button>
          ) : null}
          {actif ? (
            <>
              <button type="button" className={`${styles.iconButton} ${a.okGhost}`} onClick={() => onMaj({ statut: "traitee" }, "Alerte traitée ✓")} aria-label="Marquer comme traitée" data-tooltip="Traitée">
                <CheckCircle2 size={16} />
              </button>
              <button type="button" className={styles.iconButton} onClick={() => onMaj({ statut: "ignoree" }, "Alerte ignorée")} aria-label="Ignorer" data-tooltip="Ignorer">
                <BellOff size={16} />
              </button>
            </>
          ) : (
            <button type="button" className={styles.iconButton} onClick={() => onMaj({ statut: "vue" }, "Alerte rouverte")} aria-label="Rouvrir" data-tooltip="Rouvrir">
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
