"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UserRound, Droplet, CheckCheck, RotateCcw } from "lucide-react";
import { useAuth } from "../lib/auth";
import { API_BASE } from "../lib/apiBase";
import ConversationList from "./ConversationList";
import styles from "./ChatInbox.module.css";

// Boîte de réception de l'équipe (admin) : un fil par client, les plus urgents d'abord
// (GET /chat/boite). Statuts : equipe_demandee (l'assistant demande l'équipe),
// non_lu, assistant (l'assistant a répondu), a_jour. « Marquer traité » lève
// l'escalade et marque lus les messages du client ; un nouveau message rouvre le fil.
// Sans la route (backend plus ancien), on retombe sur l'ancienne liste des clients.

const TABS = [
  { key: "a_traiter", label: "À traiter" },
  { key: "assistant", label: "Gérés par l'assistant" },
  { key: "tous", label: "Tous" },
  { key: "clients", label: "Tous les clients" },
];

const STATUT_LABEL = {
  equipe_demandee: "Équipe demandée",
  non_lu: "Non lu",
  assistant: "Assistant",
  a_jour: "À jour",
};

const AUTEUR_LABEL = { client: "Client", assistant: "Assistant", equipe: "Vous" };

function quand(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function ChatInbox() {
  const { isAuthenticated, authFetch } = useAuth();
  const [fils, setFils] = useState(null); // null = chargement, false = route absente
  const [clients, setClients] = useState([]);
  const [tab, setTab] = useState("a_traiter");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`${API_BASE}/chat/boite?t=${Date.now()}`);
      if (r.status === 404 || r.status === 405) {
        setFils(false);
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setFils(await r.json());
    } catch (e) {
      console.error("Erreur boîte de réception", e);
      setFils((prev) => (prev === null ? [] : prev));
    }
  }, [authFetch]);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, load]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const r = await authFetch(`${API_BASE}/clients?is_admin=true&t=${Date.now()}`);
        if (r.ok) setClients((await r.json()) || []);
      } catch {}
    })();
  }, [isAuthenticated, authFetch]);

  const nomClient = useMemo(() => {
    const m = {};
    (Array.isArray(clients) ? clients : []).forEach((c) => {
      m[String(c.client_id)] = c.client_name || String(c.client_id);
    });
    return m;
  }, [clients]);

  const marquer = async (clientId, traite) => {
    setBusy(clientId);
    try {
      const r = await authFetch(`${API_BASE}/chat/${encodeURIComponent(clientId)}/traite`, {
        method: traite ? "POST" : "DELETE",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      try {
        window.dispatchEvent(new CustomEvent("chat:boite-changed"));
      } catch {}
      await load();
    } catch (e) {
      console.error("Erreur marquer traité", e);
    } finally {
      setBusy(null);
    }
  };

  const ouvrir = (clientId) => {
    try {
      window.dispatchEvent(new CustomEvent("chat:admin-opened-conversation", { detail: { clientId: String(clientId) } }));
    } catch {}
  };

  if (fils === false) return <ConversationList />;
  if (fils === null) return <p className={styles.muted}>Chargement des conversations…</p>;

  const counts = {
    a_traiter: fils.filter((f) => f.statut === "equipe_demandee" || f.statut === "non_lu").length,
    assistant: fils.filter((f) => f.statut === "assistant").length,
    tous: fils.length,
  };
  const avecFil = new Set(fils.map((f) => f.client_id));
  const sansFil = (Array.isArray(clients) ? clients : []).filter((c) => !avecFil.has(String(c.client_id)));

  const visibles =
    tab === "a_traiter"
      ? fils.filter((f) => f.statut === "equipe_demandee" || f.statut === "non_lu")
      : tab === "assistant"
        ? fils.filter((f) => f.statut === "assistant")
        : fils;

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key !== "clients" && counts[t.key] > 0 && <span className={styles.tabCount}>{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab === "clients" ? (
        <ul className={styles.list}>
          {sansFil.length === 0 && <li className={styles.empty}>Tous les clients ont déjà une conversation.</li>}
          {sansFil.map((c) => (
            <li key={c.client_id}>
              <Link href={`/chat/${c.client_id}`} className={styles.row}>
                <div className={styles.main}>
                  <span className={styles.name}>{c.client_name || c.client_id}</span>
                  <span className={styles.preview}>Aucun message — démarrer la conversation</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.list}>
          {visibles.length === 0 && (
            <li className={styles.empty}>
              {tab === "a_traiter" ? "Rien à traiter : l'assistant et l'équipe sont à jour." : "Aucune conversation."}
            </li>
          )}
          {visibles.map((f) => {
            const urgent = f.statut === "equipe_demandee";
            const aTraiter = urgent || f.statut === "non_lu";
            return (
              <li key={f.client_id} className={`${styles.item} ${urgent ? styles.urgent : ""}`}>
                <Link href={`/chat/${f.client_id}`} className={styles.row} onClick={() => ouvrir(f.client_id)}>
                  <div className={styles.main}>
                    <div className={styles.top}>
                      <span className={styles.name}>{nomClient[f.client_id] || f.client_id}</span>
                      <span className={styles.time}>{quand(f.dernier_message?.created_at)}</span>
                    </div>
                    <span className={styles.preview}>
                      {f.dernier_message?.auteur === "assistant" && <Droplet className={styles.inlineIcon} />}
                      <strong>{AUTEUR_LABEL[f.dernier_message?.auteur] || ""} : </strong>
                      {f.dernier_message?.apercu}
                    </span>
                    <div className={styles.badges}>
                      <span className={`${styles.statut} ${styles["s_" + f.statut] || ""}`}>
                        {urgent && <UserRound className={styles.inlineIcon} />}
                        {STATUT_LABEL[f.statut]}
                        {urgent && f.escalade_motif ? ` : ${f.escalade_motif}` : ""}
                      </span>
                      {f.non_lus > 0 && <span className={styles.unread}>{f.non_lus > 99 ? "99+" : f.non_lus} non lu{f.non_lus > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                </Link>
                <div className={styles.actions}>
                  {aTraiter || f.statut === "assistant" ? (
                    <button type="button" className={styles.action} disabled={busy === f.client_id}
                      onClick={() => marquer(f.client_id, true)} title="Marquer comme traité">
                      <CheckCheck size={16} />
                      <span>Traité</span>
                    </button>
                  ) : f.traite_at ? (
                    <button type="button" className={`${styles.action} ${styles.actionGhost}`} disabled={busy === f.client_id}
                      onClick={() => marquer(f.client_id, false)} title="Rouvrir">
                      <RotateCcw size={16} />
                      <span>Rouvrir</span>
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
