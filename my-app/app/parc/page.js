"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, hasRole } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./Parc.module.css";

const STATUTS = {
  ok: { label: "Connectés", court: "OK", classe: "ok" },
  attention: { label: "À surveiller", court: "Retard", classe: "attention" },
  muet: { label: "Sans données", court: "Muet", classe: "muet" },
};

const ORDRE_URGENCE = { muet: 0, attention: 1, ok: 2 };

// "il y a 3 min", "il y a 2 h 15"
function depuis(minutes) {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `il y a ${h} h ${String(m).padStart(2, "0")}` : `il y a ${h} h`;
}

function dateLisible(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ParcPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, authFetch } = useAuth();

  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [majLe, setMajLe] = useState(null);
  const [filtre, setFiltre] = useState(null);
  const [recherche, setRecherche] = useState("");
  // Detail "derniere donnee connue", charge a la demande par automate
  const [details, setDetails] = useState({});

  const estAdmin = useMemo(
    () => hasRole(user, "admin") || hasRole(user, "super_admin"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.roles]
  );

  const charger = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/parc/etat`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setData(json);
      setMajLe(new Date());
      setErreur("");
    } catch (e) {
      setErreur(e.message || "Impossible de charger l'état du parc");
    } finally {
      setChargement(false);
    }
  }, [authFetch]);

  // Garde d'acces : page reservee a l'equipe interne
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/");
    else if (!estAdmin) router.replace("/");
  }, [isLoading, isAuthenticated, estAdmin, router]);

  // Chargement initial + rafraichissement auto toutes les 60 s
  useEffect(() => {
    if (!isAuthenticated || !estAdmin) return;
    charger();
    const id = setInterval(charger, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated, estAdmin, charger]);

  const chargerDetail = async (nom) => {
    if (details[nom]) return;
    setDetails((d) => ({ ...d, [nom]: { chargement: true } }));
    try {
      const res = await authFetch(
        `${API_BASE}/parc/etat/${encodeURIComponent(nom)}/derniere?jours=90`
      );
      const json = await res.json();
      setDetails((d) => ({ ...d, [nom]: { ...json, chargement: false } }));
    } catch {
      setDetails((d) => ({ ...d, [nom]: { chargement: false, erreur: true } }));
    }
  };

  const visibles = useMemo(() => {
    const automates = data?.automates || [];
    const q = recherche.trim().toLowerCase();
    return automates
      .filter((a) => (filtre ? a.statut === filtre : true))
      .filter((a) =>
        q
          ? [a.nom_automate, a.client, a.lieu]
              .filter(Boolean)
              .some((v) => v.toLowerCase().includes(q))
          : true
      )
      .sort(
        (a, b) =>
          ORDRE_URGENCE[a.statut] - ORDRE_URGENCE[b.statut] ||
          (a.client || "").localeCompare(b.client || "")
      );
  }, [data, filtre, recherche]);

  if (isLoading || !isAuthenticated || !estAdmin) return null;

  const compteurs = data?.compteurs || { ok: 0, attention: 0, muet: 0 };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>État du parc</h1>
          <p className={styles.subtitle}>
            Quels automates remontent encore des données. Lecture seule — aucun
            automate n&apos;est modifié.
          </p>
        </div>
        <div className={styles.majBloc}>
          <button className={styles.boutonMaj} onClick={charger} type="button">
            Actualiser
          </button>
          {majLe && (
            <span className={styles.majTexte}>
              Mis à jour à{" "}
              {majLe.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </header>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {/* Compteurs cliquables : servent aussi de filtres */}
      <div className={styles.resume}>
        {["ok", "attention", "muet"].map((cle) => (
          <button
            key={cle}
            type="button"
            onClick={() => setFiltre(filtre === cle ? null : cle)}
            className={`${styles.carteResume} ${styles[STATUTS[cle].classe]} ${
              filtre === cle ? styles.actif : ""
            }`}
          >
            <span className={styles.resumeNombre}>{compteurs[cle] ?? 0}</span>
            <span className={styles.resumeLabel}>{STATUTS[cle].label}</span>
            <span className={styles.resumeDetail}>
              {cle === "ok" && "données reçues il y a moins de 15 min"}
              {cle === "attention" && "rien depuis 15 min à 2 h"}
              {cle === "muet" && "rien depuis plus de 2 h"}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.barreOutils}>
        <input
          className={styles.recherche}
          type="search"
          placeholder="Rechercher un client, un lieu, un numéro…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        {(filtre || recherche) && (
          <button
            type="button"
            className={styles.boutonReset}
            onClick={() => {
              setFiltre(null);
              setRecherche("");
            }}
          >
            Tout afficher
          </button>
        )}
        <span className={styles.compteVisible}>
          {visibles.length} / {data?.total ?? 0} automates
        </span>
      </div>

      {chargement && !data && <p className={styles.vide}>Chargement…</p>}

      <div className={styles.grille}>
        {visibles.map((a) => {
          const detail = details[a.nom_automate];
          const estMuet = a.statut === "muet";
          return (
            <article
              key={a.nom_automate}
              className={`${styles.tuile} ${styles[STATUTS[a.statut].classe]}`}
            >
              <div className={styles.tuileHaut}>
                <span className={styles.pastille} aria-hidden="true" />
                <div className={styles.tuileTitres}>
                  <h2 className={styles.tuileClient}>
                    {a.client || "Client non renseigné"}
                  </h2>
                  <p className={styles.tuileLieu}>{a.lieu || "Lieu non renseigné"}</p>
                </div>
              </div>

              <p className={styles.tuileNumero}>{a.nom_automate}</p>

              <p className={styles.tuileEtat}>
                {estMuet
                  ? "Aucune donnée depuis plus de 2 h"
                  : `Données reçues ${depuis(a.minutes)}`}
              </p>

              {estMuet && (
                <div className={styles.tuileDetail}>
                  {!detail && (
                    <button
                      type="button"
                      className={styles.lienDetail}
                      onClick={() => chargerDetail(a.nom_automate)}
                    >
                      Voir la dernière donnée reçue
                    </button>
                  )}
                  {detail?.chargement && (
                    <span className={styles.detailTexte}>Recherche…</span>
                  )}
                  {detail && !detail.chargement && (
                    <span className={styles.detailTexte}>
                      {detail.erreur
                        ? "Recherche impossible"
                        : detail.trouve
                        ? `Dernière donnée : ${dateLisible(detail.derniere_mesure)}`
                        : "Rien reçu depuis plus de 90 jours"}
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!chargement && visibles.length === 0 && (
        <p className={styles.vide}>Aucun automate ne correspond à cette recherche.</p>
      )}
    </div>
  );
}
