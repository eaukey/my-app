"use client";
import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
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
        setMessages(data);
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

  const handleSend = async () => {
    const txt = newMessage.trim();
    if (!txt) return;
    setNewMessage("");

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        client_id: clientId,
        sender_id: senderId,
        content: txt,
        created_at: new Date().toISOString(),
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
    } catch (err) {
      console.error("Erreur envoi message", err);
    }
  };

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (loading) return <p>Chargement…</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Zone messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id == senderId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className="bg-gray-100 p-3 rounded-lg max-w-[80%]">
                <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                <span className="text-xs text-gray-500 block mt-1">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
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