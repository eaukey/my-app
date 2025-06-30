"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const fetchClients = async () => {
      try {
        const res = await fetch("https://backend-eaukey.duckdns.org/clients?is_admin=true");
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

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (loading) return <p>Chargement des clients…</p>;
  if (clients.length === 0) return <p>Aucun client.</p>;

  const list = clients.map((client) => (
    <li key={client.client_id} className="border-b last:border-none">
      {onSelect ? (
        <button
          onClick={() => onSelect(client.client_id)}
          className="w-full text-left px-4 py-3 hover:bg-gray-100"
        >
          {client.client_name}
        </button>
      ) : (
        <Link
          href={`/chat/${client.client_id}`}
          className={`block px-4 py-3 hover:bg-gray-100 ${
            pathname === `/chat/${client.client_id}` ? "bg-gray-100" : ""
          }`}
        >
          {client.client_name}
        </Link>
      )}
    </li>
  ));

  return <ul className="divide-y rounded-lg border w-full max-w-md bg-white">{list}</ul>;
} 