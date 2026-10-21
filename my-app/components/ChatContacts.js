"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Mail, Plus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/apiBase";
import styles from "./ChatConversation.module.css";

// Adresses e-mail reconnues pour un client (admin, en-tête de la conversation).
// Un e-mail envoyé à l'adresse SAV depuis l'une de ces adresses arrive dans ce fil
// et l'assistant y répond par e-mail. Les e-mails des stations (fiche automate)
// sont reconnus automatiquement ; un expéditeur inconnu ne reçoit aucune réponse
// automatique (l'équipe est prévenue par e-mail).
// Routes : GET / POST / DELETE /clients/{clientId}/contacts.

const EMAIL_RE = /^[^@\s<>()[\],;:"]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export default function ChatContacts({ clientId }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null); // { contacts, stations } ; null = indisponible
  const [valeur, setValeur] = useState("");
  const [erreur, setErreur] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = `${API_BASE}/clients/${encodeURIComponent(clientId)}/contacts`;

  const charger = useCallback(async () => {
    try {
      const res = await authFetch(base);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData({ contacts: json.contacts || [], stations: json.stations || [] });
    } catch (err) {
      // Backend sans canal e-mail (route absente) : l'encart ne s'affiche pas.
      setData(null);
    }
  }, [authFetch, base]);

  useEffect(() => {
    if (clientId) charger();
  }, [clientId, charger]);

  const lireErreur = async (res, defaut) => {
    try {
      const json = await res.json();
      return typeof json.detail === "string" ? json.detail : defaut;
    } catch {
      return defaut;
    }
  };

  const ajouter = async (e) => {
    e.preventDefault();
    const adresse = valeur.trim().toLowerCase();
    if (!EMAIL_RE.test(adresse)) {
      setErreur("Adresse e-mail invalide.");
      return;
    }
    setBusy(true);
    setErreur(null);
    try {
      const res = await authFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valeur: adresse, canal: "email" }),
      });
      if (!res.ok) {
        setErreur(await lireErreur(res, "Ajout impossible."));
        return;
      }
      setValeur("");
      await charger();
    } catch {
      setErreur("Ajout impossible. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  };

  const supprimer = async (contact) => {
    setBusy(true);
    setErreur(null);
    try {
      const res = await authFetch(`${base}/${contact.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        setErreur(await lireErreur(res, "Suppression impossible."));
        return;
      }
      await charger();
    } catch {
      setErreur("Suppression impossible. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;
  const total = data.contacts.length + data.stations.length;

  return (
    <details className={styles.contacts || ""}>
      <summary className={styles.contactsSummary || ""}>
        <Mail className="w-4 h-4" />
        Adresses e-mail reconnues
        <span className={styles.contactsCount || ""}>{total}</span>
      </summary>

      <div className={styles.contactsBody || ""}>
        <p className={styles.contactsHint || ""}>
          Un e-mail envoyé à l&apos;adresse SAV depuis ces adresses arrive dans cette conversation et
          l&apos;assistant y répond par e-mail. Vos réponses partent aussi par e-mail tant que le client
          écrit par e-mail (14 jours). Les e-mails des stations sont reconnus automatiquement.
        </p>

        {data.contacts.length > 0 && (
          <ul className={styles.contactsList || ""} aria-label="Adresses ajoutées par l'équipe">
            {data.contacts.map((c) => (
              <li key={c.id} className={styles.contactChip || ""}>
                <span className={styles.contactValue || ""}>{c.valeur}</span>
                <button
                  type="button"
                  onClick={() => supprimer(c)}
                  disabled={busy}
                  className={styles.contactRemove || ""}
                  aria-label={`Retirer ${c.valeur}`}
                  title="Retirer cette adresse"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {data.stations.length > 0 && (
          <>
            <p className={styles.contactsLabel || ""}>E-mails des stations (automatique)</p>
            <ul className={styles.contactsList || ""} aria-label="E-mails des stations">
              {data.stations.map((a) => (
                <li key={a} className={`${styles.contactChip || ""} ${styles.contactChipAuto || ""}`}>
                  <span className={styles.contactValue || ""}>{a}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <form onSubmit={ajouter} noValidate className={styles.contactsForm || ""}>
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            value={valeur}
            onChange={(e) => {
              setValeur(e.target.value);
              setErreur(null);
            }}
            placeholder="adresse@client.fr"
            aria-label="Nouvelle adresse e-mail reconnue"
            className={styles.contactsInput || ""}
          />
          <button type="submit" disabled={busy || !valeur.trim()} className={styles.contactsAdd || ""}>
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </form>
        {erreur && <p className={styles.contactsError || ""} role="alert">{erreur}</p>}
      </div>
    </details>
  );
}
