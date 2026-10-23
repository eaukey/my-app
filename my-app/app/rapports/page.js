"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import base from "../pannes/Pannes.module.css";
import styles from "./Rapports.module.css";

// Rapports mensuels (tâche 2) : l'équipe choisit un mois et un client, la page affiche
// le rapport de performance calculé par le backend (GET /rapport/mensuel/html, admin)
// et permet de l'imprimer ou de l'enregistrer en PDF pour l'envoyer au client.
// La liste des clients vient de GET /rapport/mensuel/clients (clients avec des données
// ce mois-là). Le HTML est récupéré avec le jeton puis affiché dans un cadre (srcDoc) :
// la route exige l'en-tête Authorization, une simple URL ne suffirait pas.

const PREMIER_MOIS = "2026-07"; // premier mois complet de mesures_aggregate (depuis le 23/06/2026)

function moisDisponibles() {
  const out = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1); // le mois en cours n'est pas terminé : on part du précédent
  for (let i = 0; i < 24; i += 1) {
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (v < PREMIER_MOIS) break;
    out.push({ value: v, label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export default function RapportsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);
  const mois = useMemo(moisDisponibles, []);

  const [moisChoisi, setMoisChoisi] = useState(mois[0]?.value || "");
  const [clients, setClients] = useState(null); // null = chargement
  const [client, setClient] = useState("");
  const [html, setHtml] = useState("");
  const [chargement, setChargement] = useState(false);
  const [error, setError] = useState("");
  const cadre = useRef(null);

  // Clients ayant des données pour le mois choisi
  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !moisChoisi) return;
    let annule = false;
    setClients(null);
    setHtml("");
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/rapport/mensuel/clients?mois=${moisChoisi}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (annule) return;
        const liste = Array.isArray(data?.clients) ? data.clients : [];
        setClients(liste);
        setClient((c) => (liste.some((x) => x.client === c) ? c : liste[0]?.client || ""));
        setError("");
      } catch (e) {
        if (!annule) {
          setClients([]);
          setError(e.message || "Erreur lors du chargement des clients");
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, isAdmin, moisChoisi, authFetch]);

  const charger = useCallback(async () => {
    if (!client || !moisChoisi) return;
    setChargement(true);
    try {
      const q = new URLSearchParams({ client, mois: moisChoisi });
      const res = await authFetch(`${API_BASE}/rapport/mensuel/html?${q}`);
      if (!res.ok) throw new Error(await res.text());
      setHtml(await res.text());
      setError("");
    } catch (e) {
      setHtml("");
      setError(e.message || "Erreur lors du chargement du rapport");
    } finally {
      setChargement(false);
    }
  }, [authFetch, client, moisChoisi]);

  useEffect(() => {
    if (client) charger();
  }, [client, charger]);

  const imprimer = () => {
    try {
      cadre.current?.contentWindow?.focus();
      cadre.current?.contentWindow?.print();
    } catch {
      setError("Impression impossible depuis ce navigateur : utilisez le bouton dans le rapport.");
    }
  };

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) {
    router.replace("/");
    return null;
  }
  if (!isAdmin) return <p>Accès refusé.</p>;

  return (
    <div className={base.container}>
      <section className={base.section}>
        <div className={styles.head}>
          <div>
            <h1 className={base.title}>Rapports mensuels</h1>
            <p className={styles.intro}>
              Le rapport de performance d’un client pour un mois : eau recyclée, économies, énergie, désinfection,
              interventions et évolution par rapport au mois précédent. Imprimez-le ou enregistrez-le en PDF pour
              l’envoyer au client.
            </p>
          </div>
        </div>

        <div className={styles.filtres}>
          <label className={base.inlineField}>
            <span className={styles.label}>Mois</span>
            <select id="rapport-mois" className={base.select} value={moisChoisi} onChange={(e) => setMoisChoisi(e.target.value)}>
              {mois.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className={base.inlineField}>
            <span className={styles.label}>Client</span>
            <select
              id="rapport-client"
              className={base.select}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              disabled={!clients || clients.length === 0}
            >
              {clients === null ? <option value="">Chargement…</option> : null}
              {clients && clients.length === 0 ? <option value="">Aucun client avec des données ce mois-ci</option> : null}
              {(clients || []).map((c) => (
                <option key={c.client} value={c.client}>
                  {c.client} ({c.stations_avec_donnees} station{c.stations_avec_donnees > 1 ? "s" : ""})
                </option>
              ))}
            </select>
          </label>
          <div className={styles.boutons}>
            <button type="button" className={base.button} onClick={imprimer} disabled={!html || chargement}>
              <Printer size={18} />
              <span>Imprimer / PDF</span>
            </button>
          </div>
        </div>

        {error ? <p className={base.error}>{error}</p> : null}
      </section>

      <section className={`${base.section} ${styles.apercu}`}>
        {chargement ? <p className={base.muted}>Calcul du rapport…</p> : null}
        {!chargement && !html && !error ? (
          <div className={styles.vide}>
            <FileText size={28} />
            <p>Choisissez un mois et un client pour afficher le rapport.</p>
          </div>
        ) : null}
        {html ? (
          <iframe
            ref={cadre}
            title={`Rapport mensuel ${client} ${moisChoisi}`}
            className={styles.cadre}
            srcDoc={html}
          />
        ) : null}
      </section>
    </div>
  );
}
