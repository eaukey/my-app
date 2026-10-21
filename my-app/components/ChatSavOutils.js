"use client";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Wrench, AlertTriangle, FilePlus2, Loader2, Check } from "lucide-react";
import { API_BASE } from "../lib/apiBase";
import PanneWizard from "../app/pannes/PanneWizard";
import styles from "./ChatConversation.module.css";

// Outils de l'équipe (admin) dans une conversation avec l'assistant SAV :
// - PanneDuMessage : sur une réponse de l'assistant, la panne qu'il a créée
//   (messages.panne_id) ou la panne détectée dont la station reste à préciser
//   (messages.panne_suggeree) → « Créer la panne » ouvre le formulaire de panne
//   pré-rempli, puis lie la panne au message (POST /messages/{id}/panne).
// - ProposerFicheSav : demande à l'assistant un brouillon de fiche SAV tiré de la
//   conversation (POST /sav/fiches/proposer), à relire dans /base-sav.
// Rien de tout cela n'est affiché aux clients.

const lire = async (res) => {
  if (res.ok) return res.json();
  let detail = `HTTP ${res.status}`;
  try {
    detail = (await res.json()).detail || detail;
  } catch {}
  throw new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`);
};

const memeClient = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export function PanneDuMessage({ msg, clientId, authFetch, currentUser, onLinked }) {
  const [wizard, setWizard] = useState(null); // { stations, panneTypes }
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  if (msg.panne_id) {
    return (
      <Link href="/pannes" className={styles.panneBadge}>
        <Wrench className="w-3 h-3" />
        Panne #{msg.panne_id} créée
      </Link>
    );
  }
  const suggestion = msg.panne_suggeree;
  if (!suggestion) return null;

  const ouvrir = async () => {
    setErreur("");
    setChargement(true);
    try {
      const headers = { "Content-Type": "application/json" };
      const [st, types] = await Promise.all([
        authFetch(`${API_BASE}/recherche/automate_LCA`, { headers }).then(lire),
        authFetch(`${API_BASE}/pannes/types`, { headers }).then(lire),
      ]);
      const toutes = (Array.isArray(st) ? st : [])
        .filter((s) => s && s.client && s.lieu && s.nom_automate)
        .map(({ client, lieu, nom_automate, numero_automate }) => ({ client, lieu, nom_automate, numero_automate }))
        .sort((a, b) => `${a.client} ${a.lieu}`.localeCompare(`${b.client} ${b.lieu}`, "fr", { sensitivity: "base" }));
      const duClient = toutes.filter((s) => memeClient(s.client, clientId));
      setWizard({
        stations: duClient.length ? duClient : toutes,
        panneTypes: (Array.isArray(types) ? types : []).map((t) => String(t).trim()).filter(Boolean),
      });
    } catch (e) {
      setErreur(e.message || "Chargement des stations impossible");
    } finally {
      setChargement(false);
    }
  };

  const enregistrer = async (payload) => {
    const headers = { "Content-Type": "application/json" };
    const panne = await authFetch(`${API_BASE}/pannes`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).then(lire);
    await authFetch(`${API_BASE}/messages/${msg.id}/panne`, {
      method: "POST",
      headers,
      body: JSON.stringify({ panne_id: panne.id }),
    }).then(lire);
    setWizard(null);
    onLinked?.(msg.id, panne.id);
  };

  return (
    <div className={styles.panneSuggestion}>
      <div className={styles.panneSuggestionTitre}>
        <AlertTriangle className="w-3 h-3" />
        Panne détectée — station à préciser
      </div>
      <div className={styles.panneSuggestionTexte}>
        <strong>{suggestion.type}</strong>
        {suggestion.constat ? ` : ${suggestion.constat}` : ""}
      </div>
      {erreur ? <div className={styles.panneErreur}>{erreur}</div> : null}
      <button type="button" className={styles.panneBouton} onClick={ouvrir} disabled={chargement}>
        {chargement ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
        Créer la panne
      </button>
      {wizard ? createPortal(
        <div className={styles.wizardOverlay} role="dialog" aria-modal="true" aria-label="Créer la panne">
          <div className={styles.wizardBox}>
            <PanneWizard
              mode="create"
              stations={wizard.stations}
              panneTypes={wizard.panneTypes}
              currentUser={currentUser}
              initial={{ panne: suggestion.type || "", probleme: suggestion.constat || "" }}
              title="Créer la panne détectée par l'assistant"
              onSubmit={enregistrer}
              onCancel={() => setWizard(null)}
            />
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

export function ProposerFicheSav({ clientId, authFetch }) {
  const [etat, setEtat] = useState({ kind: "idle" }); // idle | loading | done | error

  const proposer = async () => {
    setEtat({ kind: "loading" });
    try {
      const fiche = await authFetch(`${API_BASE}/sav/fiches/proposer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: String(clientId) }),
      }).then(lire);
      setEtat({ kind: "done", fiche });
    } catch (e) {
      setEtat({ kind: "error", text: e.message || "Proposition impossible" });
    }
  };

  if (etat.kind === "done") {
    return (
      <Link href="/base-sav" className={styles.ficheLien}>
        <Check className="w-3 h-3" />
        Brouillon créé — relire dans la base SAV
      </Link>
    );
  }
  return (
    <span className={styles.ficheZone}>
      <button
        type="button"
        className={styles.ficheBouton}
        onClick={proposer}
        disabled={etat.kind === "loading"}
        title="L'assistant rédige un brouillon de fiche à partir de cette conversation"
      >
        {etat.kind === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePlus2 className="w-3 h-3" />}
        {etat.kind === "loading" ? "Rédaction…" : "Proposer une fiche SAV"}
      </button>
      {etat.kind === "error" ? <span className={styles.panneErreur}>{etat.text}</span> : null}
    </span>
  );
}
