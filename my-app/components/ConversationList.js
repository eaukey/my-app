"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth, isAdmin as checkAdmin } from "../lib/auth";
import { API_BASE } from "../lib/apiBase";
import { usePathname } from "next/navigation";
import styles from "./ConversationList.module.css";

/**
 * Affiche la liste des conversations disponibles pour l'utilisateur.
 * – Admin : voit toutes les conversations (paramètre ?is_admin=true)
 * – Client : ne voit que ses conversations (paramètre ?user_id=<client_id>)
 *
 * Props :
 *   onSelect?: (id: number) => void       // facultatif si on souhaite callback au lieu de navigation
 */
export default function ConversationList({ onSelect }) {
  const { user, isAuthenticated, authFetch } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadByClient, setUnreadByClient] = useState({});
  const pathname = usePathname();

  const isAdmin = checkAdmin(user);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const fetchClients = async () => {
      try {
        const ts = Date.now();
        const res = await authFetch(`${API_BASE}/clients?is_admin=true&t=${ts}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setClients(data);
      } catch (err) {
        console.error("Erreur récupération clients", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [isAuthenticated, isAdmin, authFetch]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    if (!Array.isArray(clients) || clients.length === 0) return;

    let intervalId;
    const tick = async () => {
      try {
        const ts = Date.now();
        const r = await authFetch(`${API_BASE}/notifications/admin_all?t=${ts}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const byClient = (await r.json()) || {};
        setUnreadByClient(byClient);
      } catch {}
    };

    tick();
    intervalId = setInterval(tick, 30000);
    return () => clearInterval(intervalId);
  }, [clients, isAuthenticated, isAdmin, authFetch]);

  const handleAdminOpenConversation = (clickedClientId) => {
    setUnreadByClient((prev) => ({ ...prev, [clickedClientId]: 0 }));
    try {
      window.dispatchEvent(new CustomEvent("chat:admin-opened-conversation", { detail: { clientId: String(clickedClientId) } }));
    } catch {}
  };

  if (!isAuthenticated) return <p className="text-[var(--text-primary)]">Veuillez vous connecter…</p>;
  if (loading) return <p className="text-[var(--text-primary)]">Chargement des clients…</p>;
  if (clients.length === 0) return <p className="text-[var(--text-primary)]">Aucun client.</p>;

  const list = clients.map((client) => {
    const count = unreadByClient?.[client.client_id] || 0;
    return (
      <li key={client.client_id} className="border-b border-[var(--border-subtle)] last:border-none">
        {onSelect ? (
          <button
            onClick={() => {
              handleAdminOpenConversation(client.client_id);
              onSelect(client.client_id);
            }}
            className={`w-full text-left px-4 py-3 hover:bg-[var(--bg-highlight)] flex items-center justify-between text-[var(--text-primary)] ${styles.item || ''}`}
          >
            <span className={styles.name || ''}>{client.client_name}</span>
            {count > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--critical)] text-[#0a0f18] text-[10px] ${styles.badge || ''}`}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        ) : (
          <Link
            href={`/chat/${client.client_id}`}
            onClick={() => handleAdminOpenConversation(client.client_id)}
            className={`block px-4 py-3 hover:bg-[var(--bg-highlight)] ${
              pathname === `/chat/${client.client_id}` ? "bg-[var(--bg-highlight)]" : ""
            } flex items-center justify-between text-[var(--text-primary)] ${styles.item || ''}`}
          >
            <span className={styles.name || ''}>{client.client_name}</span>
            {count > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--critical)] text-[#0a0f18] text-[10px] ${styles.badge || ''}`}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        )}
      </li>
    );
  });

  return <ul className={`divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-strong)] w-full max-w-md bg-[var(--bg-elevated)] text-[var(--text-primary)] ${styles.container || ''}`}>{list}</ul>;
} 