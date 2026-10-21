"use client";
import React, { useState, useEffect, useRef } from "react";
import { Send, Check, CheckCheck, Droplet, UserRound } from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../lib/auth";
import { getCachedAdminSenderIds, discoverAdminSenderIds, AGENT_SENDER_ID } from "./chatRoleUtils";
import { API_BASE } from "../lib/apiBase";
import { renderMarkdown } from "../lib/markdownLite";
import { useDictation, useSpeech } from "../lib/voice";
import { MicButton, DictationStatus, ListenButton, AutoReadToggle } from "./VoiceControls";
import styles from "./ChatConversation.module.css";

// Messagerie client <-> équipe Eaukey, avec l'assistant SAV dans le même fil.
// Côté client, un message part vers POST /chat/{clientId}/agent : il est
// enregistré, puis l'assistant répond en flux (SSE) et sa réponse est enregistrée
// dans le fil (sender_id AGENT_SENDER_ID). L'assistant prévient l'équipe quand
// un humain est nécessaire (message marqué `escalade`) et se tait quand un membre
// de l'équipe a répondu récemment. Côté admin, l'envoi reste POST /messages.

const AGENT_NAME = "Assistant Eaukey";

function normalizeSender(senderId) {
  if (senderId === AGENT_SENDER_ID) return AGENT_SENDER_ID;
  if (senderId === 677) return 0; // admin historique connu
  if (senderId === 6863) return 1; // client historique connu
  if (senderId === 0 || senderId === 1) return senderId; // déjà normalisé
  if (getCachedAdminSenderIds().has(senderId)) return 0; // détecté comme admin multi-clients
  return 1; // fallback: traite comme client
}

// Parse le buffer SSE accumulé : renvoie [frames complètes, reste].
function drainFrames(buffer) {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  return [frames, rest];
}

// enTete : contenu facultatif affiché sous l'en-tête (ex. adresses e-mail reconnues, admin).
export default function ChatConversation({ clientId, enTete = null }) {
  const { user, isAuthenticated, authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [agentBusy, setAgentBusy] = useState(false);
  const [notice, setNotice] = useState(null); // info affichée sous le fil (équipe en charge, erreur…)
  const busyRef = useRef(false); // pas de rafraîchissement pendant une réponse en cours
  const bottomRef = useRef(null);
  const inputRef = useRef("");
  inputRef.current = newMessage;

  const isAdmin = checkAdmin(user);

  // Contrôle vocal (côté client uniquement) : dictée dans le champ, lecture des réponses.
  const dictation = useDictation(() => inputRef.current, setNewMessage);
  const speech = useSpeech();
  const voice = !isAdmin;

  const fetchMessages = React.useCallback(async () => {
    if (busyRef.current) return;
    try {
      const res = await authFetch(`${API_BASE}/messages/${clientId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Découverte des IDs admin (asynchrone, sans bloquer l'affichage).
      // Réservée aux admins : pour un client, /clients?is_admin=true répond 403.
      if (isAdmin && getCachedAdminSenderIds().size === 0) {
        discoverAdminSenderIds().then(() => {
          // rien, le cache sera pris en compte au prochain poll
        });
      }

      if (busyRef.current) return;
      setMessages(
        data.map((m) => ({
          ...m,
          sender_id: normalizeSender(m.sender_id),
          is_read: ["true", true, 1, "1", "t", "T"].includes(m.is_read),
        }))
      );
    } catch (err) {
      console.error("Erreur fetch messages", err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, clientId, isAdmin]);

  // Fetch messages initially + poll every 30 s
  useEffect(() => {
    if (!isAuthenticated || !clientId) return;
    fetchMessages();
    const intervalId = setInterval(fetchMessages, 30000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, clientId, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, notice]);

  const senderId = isAdmin ? 0 : 1;
  const displayName =
    user?.name || user?.email || (isAdmin ? "Support" : user?.client_id) || "Utilisateur";
  const otherName = isAdmin ? clientId : "Équipe Eaukey";
  const conversationLabel = isAdmin ? `Client ${clientId}` : "Support Eaukey";
  const messageCount = messages.length;

  // Événement: conversation ouverte → mise à jour optimiste des badges
  useEffect(() => {
    if (!isAuthenticated || !clientId) return;
    try {
      window.dispatchEvent(new CustomEvent("chat:conversation-opened", { detail: { clientId: String(clientId) } }));
    } catch {}
  }, [isAuthenticated, clientId]);

  // Marquer les messages de l'admin comme lus lorsqu'un client ouvre la conversation
  useEffect(() => {
    // Seuls les clients (non-admin) doivent déclencher cette action
    if (!isAuthenticated || isAdmin || !clientId) return;

    const markAdminMessagesAsRead = async () => {
      try {
        await authFetch(
          `${API_BASE}/messages_client/${clientId}/marquer_non_lu`,
          {
            method: "POST",
          }
        );
      } catch (err) {
        console.error("Erreur lors du marquage des messages comme lus:", err);
      }
    };

    markAdminMessagesAsRead();
  }, [isAuthenticated, isAdmin, clientId, authFetch]);

  // Marquer les messages du client comme lus lorsqu'un admin ouvre la conversation
  useEffect(() => {
    // Seuls les admins déclenchent cette action
    if (!isAuthenticated || !isAdmin || !clientId) return;

    const markClientMessagesAsRead = async () => {
      try {
        await authFetch(
          `${API_BASE}/messages_admin/${clientId}/marquer_non_lu`,
          {
            method: "POST",
          }
        );
      } catch (err) {
        console.error("Erreur lors du marquage des messages client comme lus:", err);
      }
    };

    markClientMessagesAsRead();
  }, [isAuthenticated, isAdmin, clientId, authFetch]);

  // Admin : « Marquer traité » (POST /chat/{client}/traite) ; sans la route, le bouton ne fait rien.
  const [handled, setHandled] = useState(false);
  const markHandled = async () => {
    setHandled("busy");
    try {
      const r = await authFetch(`${API_BASE}/chat/${encodeURIComponent(clientId)}/traite`, { method: "POST" });
      setHandled(r.ok);
      if (r.ok) {
        try {
          window.dispatchEvent(new CustomEvent("chat:boite-changed"));
        } catch {}
      }
    } catch {
      setHandled(false);
    }
  };

  const postPlainMessage = async (txt) => {
    await authFetch(`${API_BASE}/messages/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_id: senderId, content: txt }),
    });
  };

  // Client : message + réponse de l'assistant en flux.
  const sendToAgent = async (txt, tempId) => {
    const agentTempId = `agent-${tempId}`;
    const updateAgent = (fn) =>
      setMessages((prev) => prev.map((m) => (m.id === agentTempId ? fn(m) : m)));
    const dropAgent = () => setMessages((prev) => prev.filter((m) => m.id !== agentTempId));

    setMessages((prev) => [
      ...prev,
      { id: agentTempId, client_id: clientId, sender_id: AGENT_SENDER_ID, content: "", streaming: true,
        created_at: new Date().toISOString() },
    ]);

    const resp = await authFetch(`${API_BASE}/chat/${clientId}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: txt }),
    });

    if (resp.status === 404 || resp.status === 405) {
      // Backend sans assistant dans la messagerie : envoi classique à l'équipe.
      dropAgent();
      await postPlainMessage(txt);
      return;
    }
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let finished = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const [frames, rest] = drainFrames(buf);
      buf = rest;

      for (const frame of frames) {
        const lines = frame.split("\n");
        const evLine = lines.find((l) => l.startsWith("event:"));
        const dataLine = lines.find((l) => l.startsWith("data:"));
        if (!evLine || !dataLine) continue;
        const event = evLine.slice(6).trim();
        let data;
        try {
          data = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }
        if (event === "message") {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: data.id ?? tempId } : m)));
        } else if (event === "token") {
          updateAgent((m) => ({ ...m, content: m.content + (data.delta || "") }));
        } else if (event === "saved") {
          finished = true;
          updateAgent((m) => ({
            ...m,
            id: data.id ?? agentTempId,
            content: data.content,
            escalade: !!data.escalade,
            created_at: data.created_at || m.created_at,
            streaming: false,
          }));
          if (voice && speech.autoReadRef.current && data.content) speech.speak(data.id ?? agentTempId, data.content);
        } else if (event === "humain") {
          finished = true;
          dropAgent();
          setNotice({ kind: "info", text: data.detail || "Un membre de l'équipe Eaukey suit votre conversation." });
        } else if (event === "error") {
          finished = true;
          dropAgent();
          setNotice({ kind: "warn", text: data.message || "Assistant indisponible : l'équipe Eaukey vous répondra ici." });
        }
      }
    }

    if (!finished) {
      dropAgent();
      setNotice({ kind: "warn", text: "Assistant indisponible : l'équipe Eaukey vous répondra ici." });
    }
  };

  const handleSend = async () => {
    const txt = newMessage.trim();
    if (!txt || agentBusy) return;
    dictation.abort();
    setNewMessage("");
    setNotice(null);

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

    if (isAdmin) {
      try {
        await postPlainMessage(txt);
        // L'envoi a réussi : rien à faire, le polling mettra à jour is_read lorsqu'il passera à true
      } catch (err) {
        console.error("Erreur envoi message", err);
      }
      return;
    }

    busyRef.current = true;
    setAgentBusy(true);
    try {
      await sendToAgent(txt, tempId);
    } catch (err) {
      console.error("Erreur envoi message", err);
      setMessages((prev) => prev.filter((m) => m.id !== `agent-${tempId}`));
      setNotice({ kind: "warn", text: "Envoi impossible. Vérifiez votre connexion et réessayez." });
    } finally {
      busyRef.current = false;
      setAgentBusy(false);
    }
  };

  if (!isAuthenticated) return null;
  if (loading) return <p>Chargement…</p>;

  return (
    <div
      className={`flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] ${styles.container || ""}`}
    >
      <div className={styles.header || ""}>
        <div>
          <p className={styles.kicker || ""}>Canal de support</p>
          <h2 className={styles.title || ""}>{conversationLabel}</h2>
          <p className={styles.subtitle || ""}>
            {isAdmin
              ? "L'assistant répond aux questions du client ; il vous signale les échanges qui demandent l'équipe. Il se met en retrait dès que vous écrivez."
              : "L'assistant Eaukey vous répond tout de suite. Si besoin, l'équipe Eaukey prend le relais dans cette conversation."}
          </p>
        </div>
        <div className={styles.headerMeta || ""}>
          {isAdmin && (
            <button
              type="button"
              className={styles.traiteBtn || ""}
              onClick={markHandled}
              disabled={handled === "busy"}
              title="Marquer comme traité : lève la demande d'intervention et marque les messages lus"
            >
              <CheckCheck className="w-4 h-4" />
              {handled === true ? "Traité" : "Marquer traité"}
            </button>
          )}
          <span className={styles.status || ""}>
            <span className={styles.statusDot || ""} />
            En ligne
          </span>
          <span className={styles.badge || ""}>
            {messageCount || "–"} {messageCount > 1 ? "messages" : "message"}
          </span>
        </div>
      </div>
      {enTete}

      {/* Zone messages */}
      <div
        className={`flex-1 overflow-y-auto p-4 flex flex-col justify-end bg-[var(--bg-base)] ${styles.messages || ""}`}
      >
        {/* Liste des messages */}
        {messages.map((msg, idx) => {
          const isAgent = msg.sender_id === AGENT_SENDER_ID;
          const isMe = !isAgent && msg.sender_id == senderId;
          const prev = messages[idx - 1];
          const showDate =
            !prev ||
            new Date(prev?.created_at).toDateString() !==
              new Date(msg.created_at).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="text-center text-xs text-[var(--text-muted)] my-2">
                  {new Date(msg.created_at).toLocaleDateString()}
                </div>
              )}

              <div className="flex mb-3">
                {/* Bulle */}
                <div className={`flex-1 flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`p-3 rounded-xl max-w-[70%] shadow-sm ${styles.bubble || ''} ${
                      isMe ? styles.me || '' : isAgent ? styles.agent || '' : styles.them || ''
                    }`}
                  >
                    <div className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1">
                      {isAgent && <Droplet className="w-3 h-3" />}
                      {isAgent ? AGENT_NAME : isMe ? displayName : otherName}
                    </div>

                    {isAgent ? (
                      msg.content ? (
                        <div className={`text-[var(--text-primary)] ${styles.md || ""}`}>{renderMarkdown(msg.content)}</div>
                      ) : (
                        <div className={styles.typing || ""} aria-label="L'assistant écrit">
                          <span />
                          <span />
                          <span />
                        </div>
                      )
                    ) : (
                      <p className="text-[var(--text-primary)] whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {voice && isAgent && !msg.streaming && (
                      <ListenButton speech={speech} id={msg.id} text={msg.content} />
                    )}

                    {isAgent && msg.escalade && (
                      <div className={styles.escalade || ""}>
                        <UserRound className="w-3 h-3" />
                        {isAdmin
                          ? `Intervention de l'équipe demandée${msg.escalade_motif ? ` : ${msg.escalade_motif}` : ""}`
                          : "L'équipe Eaukey est prévenue"}
                      </div>
                    )}

                    {!msg.streaming && (
                      <span className={`text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1 ${styles.meta || ''}`}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                        {msg.canal === "email" && <span className={styles.canalEmail || ""}>par e-mail</span>}
                        {/* Message non lu */}
                        {isMe && !msg.is_read && (
                          <div className="flex items-center gap-0.5">
                            <Check className="w-3 h-3 text-[var(--success)]" />
                            <span className="ml-1">Envoyé</span>
                          </div>
                        )}
                        {/* Message lu */}
                        {isMe && msg.is_read && (
                          <div className="flex items-center gap-0.5">
                            <Check className="w-3 h-3 text-[var(--success)]" />
                            <Check className="w-3 h-3 text-[var(--primary)]" />
                            <span className="ml-1">Lu</span>
                          </div>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {notice && (
          <div className={`${styles.notice || ""} ${notice.kind === "warn" ? styles.noticeWarn || "" : ""}`}>
            {notice.text}
          </div>
        )}
        <div ref={bottomRef}></div>
      </div>

      {/* Input */}
      <div
        className={`border-t px-4 py-3 bg-[var(--bg-elevated)] border-[var(--border-strong)] ${styles.inputBar || ""}`}
      >
        <div className={`${styles.inputShell || ""}`}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              isAdmin ? "Écrivez votre message…" : dictation.listening ? "Parlez, je vous écoute…" : "Posez votre question…"
            }
            className={`flex-1 focus:outline-none bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 ${styles.inputField || ""}`}
          />
          {voice && <MicButton dictation={dictation} disabled={agentBusy} />}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || agentBusy}
            className={`text-[var(--primary)] disabled:opacity-50 ${styles.sendBtn || ""}`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {voice && <DictationStatus dictation={dictation} />}
        {voice && <AutoReadToggle speech={speech} />}
      </div>
    </div>
  );
}
