"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, Lightbulb, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import base from "../pannes/Pannes.module.css";
import styles from "./Problemes.module.css";

// Problèmes fréquents (tâche S4) : pannes, escalades de l'assistant SAV et alertes
// les plus fréquentes sur la période, comparées à la période précédente, avec des
// recommandations calculées par des règles simples côté backend (GET /rapport/problemes).
// « Copier le rapport » récupère la version texte (GET /rapport/problemes/texte)
// pour la coller dans un e-mail à l'équipe.

const PERIODES = [7, 30, 90];

const dateCourte = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
};

const delai = (h) => {
  if (h == null) return "—";
  if (h < 48) return `${String(Math.round(h * 10) / 10).replace(".", ",")} h`;
  return `${String(Math.round((h / 24) * 10) / 10).replace(".", ",")} j`;
};

const nomStation = (s) => [s.client, s.lieu].filter(Boolean).join(" — ") || s.nom_automate;

// Pour des problèmes, une hausse est une mauvaise nouvelle (rouge), une baisse une bonne (vert).
function Variation({ v }) {
  if (!v) return null;
  const { actuel, precedent, pct } = v;
  let cls = styles.varFlat;
  let Icon = Minus;
  let txt = "stable";
  if (pct == null) {
    if (actuel > 0) {
      cls = styles.varUp;
      Icon = TrendingUp;
      txt = "nouveau";
    }
  } else if (pct > 0) {
    cls = styles.varUp;
    Icon = TrendingUp;
    txt = `+${pct} %`;
  } else if (pct < 0) {
    cls = styles.varDown;
    Icon = TrendingDown;
    txt = `${pct} %`;
  }
  return (
    <span className={`${styles.variation} ${cls}`}>
      <Icon size={14} aria-hidden="true" />
      {txt}
      <span className={styles.varPrev}>avant : {precedent}</span>
    </span>
  );
}

function Stat({ label, value, v, hint }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {v ? <Variation v={v} /> : null}
      {hint ? <div className={styles.statHint}>{hint}</div> : null}
    </div>
  );
}

function TopList({ titre, items, vide = "Rien à signaler" }) {
  const max = Math.max(1, ...(items || []).map((i) => i.nombre));
  return (
    <div className={styles.top}>
      <div className={styles.topTitle}>{titre}</div>
      {!items || items.length === 0 ? <div className={base.muted}>{vide}</div> : null}
      <ol className={styles.topList}>
        {(items || []).map((it) => (
          <li key={it.cle || it.libelle} className={styles.topItem}>
            <div className={styles.topRow}>
              <span className={styles.topLabel}>{it.libelle}</span>
              <span className={styles.topCount}>{it.affichage ?? it.nombre}</span>
            </div>
            {it.detail ? <div className={styles.topDetail}>{it.detail}</div> : null}
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${Math.round((it.nombre / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ProblemesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [jours, setJours] = useState(30);
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [texte, setTexte] = useState("");
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await authFetch(`${API_BASE}/rapport/problemes?jours=${jours}`);
      if (!res.ok) throw new Error(await res.text());
      setRapport(await res.json());
      setError("");
    } catch (e) {
      setError(e.message || "Erreur lors du chargement du rapport");
    } finally {
      setChargement(false);
    }
  }, [authFetch, jours]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    setTexte("");
    charger();
  }, [isAuthenticated, isAdmin, charger]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const copier = async () => {
    setCopie(true);
    let t = "";
    try {
      const res = await authFetch(`${API_BASE}/rapport/problemes/texte?jours=${jours}`);
      if (!res.ok) throw new Error(await res.text());
      t = await res.text();
    } catch (e) {
      setError(e.message || "Erreur lors de la préparation du rapport");
      setCopie(false);
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("presse-papiers indisponible");
      await navigator.clipboard.writeText(t);
      setTexte("");
      setNotice("Rapport copié ✓ — collez-le dans un e-mail");
    } catch {
      // Repli : le texte s'affiche dans une zone sélectionnable
      setTexte(t);
    } finally {
      setCopie(false);
    }
  };

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) {
    router.replace("/");
    return null;
  }
  if (!isAdmin) return <p>Accès refusé.</p>;

  const r = rapport;
  const p = r?.pannes;
  const e = r?.escalades;
  const a = r?.alertes;

  return (
    <div className={base.container}>
      {notice ? <div className={base.notice}>{notice}</div> : null}
      {error ? <div className={base.error}>{error}</div> : null}

      <div className={styles.head}>
        <Link href="/pannes" className={styles.back}>
          <ChevronLeft size={16} aria-hidden="true" />
          Pannes
        </Link>
        <h1 className={styles.title}>Problèmes fréquents</h1>
        <div className={styles.subtitle}>
          {r ? `Du ${dateCourte(r.debut)} au ${dateCourte(r.fin)}, comparé aux ${r.jours} jours précédents` : " "}
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={`${base.chips} ${styles.periodes}`} role="group" aria-label="Période">
          {PERIODES.map((j) => (
            <button
              key={j}
              type="button"
              aria-pressed={jours === j}
              className={`${base.chip} ${jours === j ? base.chipActive : ""}`}
              onClick={() => setJours(j)}
            >
              {j} jours
            </button>
          ))}
        </div>
        <button type="button" className={`${base.button} ${styles.copyButton}`} onClick={copier} disabled={copie || !r}>
          <Copy size={16} aria-hidden="true" />
          <span>{copie ? "Préparation…" : "Copier le rapport"}</span>
        </button>
      </div>

      {texte ? (
        <div className={base.section}>
          <div className={styles.sectionTitle}>Rapport à copier</div>
          <p className={styles.hint}>La copie automatique n’est pas disponible : sélectionnez le texte ci-dessous puis copiez-le.</p>
          <textarea
            className={`${base.textarea} ${styles.texte}`}
            readOnly
            value={texte}
            onFocus={(ev) => ev.target.select()}
            aria-label="Texte du rapport"
          />
        </div>
      ) : null}

      {!r ? (
        <div className={base.muted}>{chargement ? "Chargement du rapport…" : "Aucune donnée"}</div>
      ) : (
        <>
          <div className={`${base.section} ${styles.recos}`}>
            <div className={styles.sectionTitle}>
              <Lightbulb size={18} aria-hidden="true" />
              Recommandations ({r.recommandations.length})
            </div>
            {r.recommandations.length === 0 ? (
              <div className={base.muted}>Aucune recommandation sur la période.</div>
            ) : (
              <ol className={styles.recoList}>
                {r.recommandations.map((reco, i) => (
                  <li key={`${reco.regle}-${i}`} className={`${styles.reco} ${reco.priorite === "haute" ? styles.recoHaute : ""}`}>
                    <span className={`${base.pill} ${reco.priorite === "haute" ? styles.pillHaute : styles.pillMoyenne}`}>
                      Priorité {reco.priorite}
                    </span>
                    <div className={styles.recoTexte}>{reco.texte}</div>
                    <div className={styles.recoPourquoi}>{reco.pourquoi}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.stats}>
            <Stat label="Pannes signalées" value={p.signalees.actuel} v={p.signalees} />
            <Stat label="Pannes résolues" value={p.resolues.actuel} v={p.resolues} />
            <Stat label="En cours aujourd'hui" value={p.en_cours} />
            <Stat label="Délai moyen de résolution" value={delai(p.delai_moyen_heures)} hint={p.delai_base ? `sur ${p.delai_base} pannes` : null} />
            <Stat
              label="Avec déplacement"
              value={p.deplacement.pct == null ? "—" : `${p.deplacement.pct} %`}
              hint={p.deplacement.renseignees ? `${p.deplacement.avec} sur ${p.deplacement.renseignees} renseignées` : "non renseigné"}
            />
            <Stat label="Escalades de l'assistant" value={e.nombre.actuel} v={e.nombre} hint={`${e.clients} client${e.clients > 1 ? "s" : ""} concerné${e.clients > 1 ? "s" : ""}`} />
            {a.disponible ? <Stat label="Alertes actives" value={a.nombre.actuel} v={a.nombre} hint={`${a.occurrences} occurrences`} /> : null}
          </div>

          <div className={base.section}>
            <div className={styles.sectionTitle}>Pannes</div>
            <div className={styles.grid}>
              <TopList titre="Types les plus fréquents" items={p.top_types} />
              <TopList titre="Causes les plus fréquentes" items={p.top_causes} vide="Aucune cause renseignée" />
              <TopList
                titre="Stations les plus touchées"
                vide="Aucune station avec 2 pannes ou plus"
                items={p.stations.map((s) => ({
                  cle: s.nom_automate,
                  libelle: nomStation(s),
                  nombre: s.nombre,
                  affichage: `${s.nombre} pannes`,
                  detail: [s.nom_automate, ...(s.types || [])].join(" · "),
                }))}
              />
              <TopList titre="Pièces les plus changées" items={p.top_pieces} vide="Aucune pièce renseignée" />
            </div>
          </div>

          <div className={base.section}>
            <div className={styles.sectionTitle}>Escalades de l’assistant SAV</div>
            <div className={styles.grid}>
              <TopList titre="Motifs les plus fréquents" items={e.top_motifs} vide="Aucune escalade" />
            </div>
            {e.sans_motif ? <div className={styles.hint}>{e.sans_motif} escalade(s) sans motif.</div> : null}
          </div>

          <div className={base.section}>
            <div className={styles.sectionTitle}>Alertes des automates</div>
            {!a.disponible ? (
              <div className={base.muted}>Pas encore disponible : les alertes ne remontent pas encore dans l’appli.</div>
            ) : (
              <>
                <div className={styles.hint}>
                  {a.devenues_pannes.nombre} alerte(s) sur {a.devenues_pannes.total} devenue(s) des pannes
                  {a.devenues_pannes.pct != null ? ` (${a.devenues_pannes.pct} %)` : ""}.
                </div>
                <div className={styles.grid}>
                  <TopList
                    titre="Codes les plus fréquents"
                    vide="Aucune alerte"
                    items={a.top_codes.map((c) => ({
                      cle: c.code,
                      libelle: `${c.code} · ${c.libelle}`,
                      nombre: c.occurrences,
                      affichage: `${c.occurrences} occ.`,
                      detail: `${c.stations} station(s) · ${c.pannes} panne(s)`,
                    }))}
                  />
                  <TopList
                    titre="Stations les plus bruyantes"
                    vide="Aucune alerte"
                    items={a.stations.map((s) => ({
                      cle: s.nom_automate,
                      libelle: nomStation(s),
                      nombre: s.occurrences,
                      affichage: `${s.occurrences} occ.`,
                      detail: `${s.nom_automate} · ${s.alertes} alerte(s)`,
                    }))}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
