"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
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
  const { user, isAuthenticated } = useAuth0();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadByClient, setUnreadByClient] = useState({});
  const pathname = usePathname();

  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const fetchClients = async () => {
      try {
        const ts = Date.now();
        const res = await fetch(`https://backend-eaukey.duckdns.org/clients?is_admin=true&t=${ts}`);
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
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    if (!Array.isArray(clients) || clients.length === 0) return;

    let intervalId;
    const backendBase = "https://backend-eaukey.duckdns.org";

    const tick = async () => {
      try {
        const ts = Date.now();
        const entries = await Promise.all(
          clients.map(async (c) => {
            try {
              const r = await fetch(
                `${backendBase}/notifications/admin/${encodeURIComponent(c.client_id)}?t=${ts}`
              );
              if (!r.ok) return [c.client_id, 0];
              const d = await r.json();
              return [c.client_id, Number(d?.count || 0)];
            } catch (e) {
              console.debug("Notif admin (list): erreur fetch client", c?.client_id, e);
              return [c.client_id, 0];
            }
          })
        );
        const obj = Object.fromEntries(entries);
        setUnreadByClient(obj);
      } catch {}
    };

    tick();
    intervalId = setInterval(tick, 2000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isAdmin, JSON.stringify(clients)]);

  const handleAdminOpenConversation = (clickedClientId) => {
    setUnreadByClient((prev) => ({ ...prev, [clickedClientId]: 0 }));
    try {
      window.dispatchEvent(new CustomEvent("chat:admin-opened-conversation", { detail: { clientId: String(clickedClientId) } }));
    } catch {}
  };

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (loading) return <p>Chargement des clients…</p>;
  if (clients.length === 0) return <p>Aucun client.</p>;

  const list = clients.map((client) => {
    const count = unreadByClient?.[client.client_id] || 0;
    return (
      <li key={client.client_id} className="border-b last:border-none">
        {onSelect ? (
          <button
            onClick={() => {
              handleAdminOpenConversation(client.client_id);
              onSelect(client.client_id);
            }}
            className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center justify-between ${styles.item || ''}`}
          >
            <span className={styles.name || ''}>{client.client_name}</span>
            {count > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] ${styles.badge || ''}`}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        ) : (
          <Link
            href={`/chat/${client.client_id}`}
            onClick={() => handleAdminOpenConversation(client.client_id)}
            className={`block px-4 py-3 hover:bg-gray-100 ${
              pathname === `/chat/${client.client_id}` ? "bg-gray-100" : ""
            } flex items-center justify-between ${styles.item || ''}`}
          >
            <span className={styles.name || ''}>{client.client_name}</span>
            {count > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] ${styles.badge || ''}`}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        )}
      </li>
    );
  });

  return <ul className={`divide-y rounded-lg border w-full max-w-md bg-white ${styles.container || ''}`}>{list}</ul>;
} 