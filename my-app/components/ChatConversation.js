"use client";
import React, { useState, useEffect, useRef } from "react";
import { Send, Check } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { getCachedAdminSenderIds, discoverAdminSenderIds } from "./chatRoleUtils";

export default function ChatConversation({ clientId }) {
  const { user, isAuthenticated } = useAuth0();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  // Fetch messages initially + poll every 5 s
  useEffect(() => {
    if (!isAuthenticated || !clientId) return;

    let intervalId;
    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `https://backend-eaukey.duckdns.org/messages/${clientId}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Découverte des IDs admin (asynchrone, sans bloquer l'affichage)
        const cachedAdmins = getCachedAdminSenderIds();
        if (cachedAdmins.size === 0) {
          discoverAdminSenderIds().then(() => {
            // rien, le cache sera pris en compte au prochain poll
          });
        }

        // Normalisation sender_id et is_read
        setMessages(
          data.map((m) => {
            const isRead = ["true", true, 1, "1", "t", "T"].includes(m.is_read);
            const adminIds = getCachedAdminSenderIds();
            let senderNorm;
            if (m.sender_id === 677) senderNorm = 0; // admin historique connu
            else if (m.sender_id === 6863) senderNorm = 1; // client historique connu
            else if (m.sender_id === 0 || m.sender_id === 1) senderNorm = m.sender_id; // déjà normalisé
            else if (adminIds.has(m.sender_id)) senderNorm = 0; // détecté comme admin multi-clients
            else senderNorm = 1; // fallback: traite comme client

            return { ...m, sender_id: senderNorm, is_read: isRead };
          })
        );
      } catch (err) {
        console.error("Erreur fetch messages", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    intervalId = setInterval(fetchMessages, 5000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, clientId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appRole = user?.["https://app.com/role"] || user?.role;
  const roles = user?.["https://app.com/roles"] || user?.roles;
  const isAdmin = appRole === "admin" || (Array.isArray(roles) && roles.includes("admin"));
  const senderId = isAdmin ? 0 : 1;
  const displayName =
    user?.["https://app.com/display_name"] || user?.name || (isAdmin ? "Support" : user?.["https://app.com/client"]);
  const otherName = isAdmin ? clientId : "Support";

  // Marquer les messages de l'admin comme lus lorsqu'un client ouvre la conversation
  useEffect(() => {
    // Seuls les clients (non-admin) doivent déclencher cette action
    if (!isAuthenticated || isAdmin || !clientId) return;

    const markAdminMessagesAsRead = async () => {
      try {
        await fetch(
          `https://backend-eaukey.duckdns.org/messages_client/${clientId}/marquer_non_lu`,
          {
            method: "POST",
          }
        );
      } catch (err) {
        console.error("Erreur lors du marquage des messages comme lus:", err);
      }
    };

    markAdminMessagesAsRead();
  }, [isAuthenticated, isAdmin, clientId]);

  // Marquer les messages du client comme lus lorsqu'un admin ouvre la conversation
  useEffect(() => {
    // Seuls les admins déclenchent cette action
    if (!isAuthenticated || !isAdmin || !clientId) return;

    const markClientMessagesAsRead = async () => {
      try {
        await fetch(
          `https://backend-eaukey.duckdns.org/messages_admin/${clientId}/marquer_non_lu`,
          {
            method: "POST",
          }
        );
      } catch (err) {
        console.error("Erreur lors du marquage des messages client comme lus:", err);
      }
    };

    markClientMessagesAsRead();
  }, [isAuthenticated, isAdmin, clientId]);

  const handleSend = async () => {
    const txt = newMessage.trim();
    if (!txt) return;
    setNewMessage("");

    // Optimistic update (on part du principe que le message n'est pas encore lu)
    const tempId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        client_id: clientId,
        sender_id: senderId,
        content: txt,
        created_at: new Date().toISOString(),
        is_read: false,
      },
    ]);

    try {
      // Log de vérification du payload
      console.log("SEND payload =", { isAdmin, sender_id: senderId, content: txt });
      await fetch(
        `https://backend-eaukey.duckdns.org/messages/${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender_id: senderId, content: txt }),
        }
      );
      // L'envoi a réussi : rien à faire, le polling mettra à jour is_read lorsqu'il passera à true
    } catch (err) {
      console.error("Erreur envoi message", err);
    }
  };

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (loading) return <p>Chargement…</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Zone messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-end">
        {/* Liste des messages */}
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id == senderId;
          const prev = messages[idx - 1];
          const showDate =
            !prev ||
            new Date(prev?.created_at).toDateString() !==
              new Date(msg.created_at).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="text-center text-xs text-gray-500 my-2">
                  {new Date(msg.created_at).toLocaleDateString()}
                </div>
              )}

              <div className="flex mb-3">
                {/* Bulle */}
                <div className={`flex-1 flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className="p-3 rounded-xl max-w-[70%] shadow-sm"
                    style={{ backgroundColor: isMe ? "#E6F7F6" : "#F0F0F0" }}
                  >
                    <div className="text-xs text-gray-600 mb-1">
                      {isMe ? displayName : otherName}
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>

                    <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString()}
                      {/* Message non lu */}
                      {isMe && !msg.is_read && (
                        <div className="flex items-center gap-0.5">
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="ml-1">Envoyé</span>
                        </div>
                      )}
                      {/* Message lu */}
                      {isMe && msg.is_read && (
                        <div className="flex items-center gap-0.5">
                          <Check className="w-3 h-3 text-green-500" />
                          <Check className="w-3 h-3 text-blue-500" />
                          <span className="ml-1">Lu</span>
                        </div>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef}></div>
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 flex items-center gap-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Écrivez votre message…"
          className="flex-1 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="text-[#41AEAD] disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
} 