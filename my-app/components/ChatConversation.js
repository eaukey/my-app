"use client";
import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, Check, AlertCircle } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";

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
        // On marque tous les messages récupérés comme déjà envoyés
        setMessages(data.map((m) => ({ ...m, status: "sent" })));
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

  const senderId = (() => {
    // Tente d'extraire un entier de user.sub (ex: "auth0|123") ou d'autres métadonnées
    if (!user) return 0;
    const possible =
      user.sub?.split("|").pop() || user["https://app.com/user_id"] || user.id;
    const num = parseInt(possible, 10);
    return Number.isNaN(num) ? 0 : num;
  })();

  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
  const displayName =
    user?.["https://app.com/display_name"] || user?.name || (isAdmin ? "Support" : user?.["https://app.com/client"]);
  const otherName = isAdmin ? clientId : "Support";

  const handleSend = async () => {
    const txt = newMessage.trim();
    if (!txt) return;
    setNewMessage("");

    // Optimistic update avec statut "pending"
    const tempId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        client_id: clientId,
        sender_id: senderId,
        content: txt,
        created_at: new Date().toISOString(),
        status: "pending",
      },
    ]);

    try {
      await fetch(
        `https://backend-eaukey.duckdns.org/messages/${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender_id: senderId, content: txt }),
        }
      );
      // Passage au statut "sent"
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "sent" } : m
        )
      );
    } catch (err) {
      console.error("Erreur envoi message", err);
      // Passage au statut "error"
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "error" } : m
        )
      );
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
                      {isMe && msg.status === "pending" && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {isMe && msg.status === "sent" && (
                        <Check className="w-3 h-3 text-green-500" />
                      )}
                      {isMe && msg.status === "error" && (
                        <AlertCircle className="w-3 h-3 text-red-500" />
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