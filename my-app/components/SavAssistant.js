"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Droplet, X } from "lucide-react";
import { API_BASE } from "../lib/apiBase";
import { useAuth } from "../lib/auth";
import { renderMarkdown } from "../lib/markdownLite";
import styles from "./SavAssistant.module.css";

// Assistant SAV (agent Wardian, read-only) — widget flottant.
// Le front NE VOIT JAMAIS la cle Wardian : il appelle notre proxy backend
// (/sav/message) avec le token Eaukey ; le backend injecte la cle et re-streame
// le SSE. On concatene les token.delta jusqu'a l'evenement done (ou error).

function convStorageKey(userId) {
  return `sav_conv_${userId}`;
}

// Parse le buffer SSE accumule : renvoie [frames completes, reste].
function drainFrames(buffer) {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  return [frames, rest];
}

export default function SavAssistant() {
  const { isAuthenticated, user, authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant'|'error', text}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const listRef = useRef(null);

  // Restaure le conversation_id persiste pour cet utilisateur.
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = window.localStorage.getItem(convStorageKey(user.id));
      if (saved) setConversationId(saved);
    } catch {}
  }, [user?.id]);

  // Auto-scroll en bas a chaque nouveau contenu.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const persistConv = useCallback(
    (id) => {
      setConversationId(id);
      if (!user?.id || !id) return;
      try {
        window.localStorage.setItem(convStorageKey(user.id), id);
      } catch {}
    },
    [user?.id]
  );

  const dropConv = useCallback(() => {
    setConversationId(null);
    if (!user?.id) return;
    try {
      window.localStorage.removeItem(convStorageKey(user.id));
    } catch {}
  }, [user?.id]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setLoading(true);

    const applyDelta = (delta) =>
      setMessages((m) => {
        const next = [...m];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = { ...next[i], text: next[i].text + delta };
            break;
          }
        }
        return next;
      });

    const fail = (msg) =>
      setMessages((m) => {
        const next = [...m];
        // Remplace la bulle assistant vide par un message d'erreur.
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = { role: "error", text: msg };
            break;
          }
        }
        return next;
      });

    try {
      const resp = await authFetch(`${API_BASE}/sav/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversation_id: conversationId }),
      });

      if (!resp.ok) {
        let detail = "";
        try {
          detail = (await resp.json())?.detail || "";
        } catch {}
        if (resp.status === 409) {
          // conversation_id perime : on repart sur un fil neuf.
          dropConv();
          fail("La conversation a expire. Renvoyez votre message pour repartir a zero.");
        } else if (resp.status === 429) {
          fail("Trop de demandes en ce moment. Merci de reessayer dans un instant.");
        } else {
          fail(detail || "L'assistant est momentanement indisponible.");
        }
        return;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let gotError = false;

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
          if (!evLine || !dataLine) continue; // ignore ": keepalive" et commentaires
          const event = evLine.slice(6).trim();
          let data;
          try {
            data = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }
          if (event === "conversation") persistConv(data.conversation_id);
          else if (event === "token") applyDelta(data.delta || "");
          else if (event === "done") {
            if (data.conversation_id) persistConv(data.conversation_id);
          } else if (event === "error") {
            gotError = true;
            fail(data.message || data.code || "Une erreur est survenue.");
          }
        }
      }

      // Stream ferme sans contenu ni erreur explicite.
      if (!gotError) {
        setMessages((m) => {
          const next = [...m];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant") {
              if (!next[i].text.trim()) {
                next[i] = { role: "error", text: "Reponse vide de l'assistant. Reessayez." };
              }
              break;
            }
          }
          return next;
        });
      }
    } catch (e) {
      fail("Connexion a l'assistant impossible. Verifiez votre reseau et reessayez.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, authFetch, conversationId, persistConv, dropConv]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!isAuthenticated) return null;

  if (!open) {
    return (
      <button className={styles.launcher} onClick={() => setOpen(true)} aria-label="Ouvrir l'assistant SAV">
        <MessageCircle size={18} strokeWidth={2} />
        <span>Assistance</span>
      </button>
    );
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Assistant SAV">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatar}>
            <Droplet size={16} strokeWidth={2} />
          </div>
          <div>
            <div className={styles.headerTitle}>Assistant Eaukey</div>
            <div className={styles.headerSub}>
              <span className={styles.dot} />
              En ligne
            </div>
          </div>
        </div>
        <button className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="Fermer">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className={styles.messages} ref={listRef}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            {"Posez votre question sur votre installation, la maintenance ou l'utilisation. L'assistant vous repond ; il ne réalise aucune action."}
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === "error") {
            return (
              <div key={i} className={styles.errorMsg}>
                {m.text}
              </div>
            );
          }
          if (m.role === "user") {
            return (
              <div key={i} className={`${styles.msg} ${styles.user}`}>
                {m.text}
              </div>
            );
          }
          // assistant
          const isLast = i === messages.length - 1;
          if (!m.text) {
            // bulle « en train d'écrire » tant que rien n'est arrivé
            return isLast && loading ? (
              <div key={i} className={styles.typing}>
                <span />
                <span />
                <span />
              </div>
            ) : null;
          }
          return (
            <div key={i} className={`${styles.msg} ${styles.assistant} ${styles.md}`}>
              {renderMarkdown(m.text)}
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <div className={styles.inputRow}>
          <textarea
            className={styles.textarea}
            rows={1}
            placeholder="Votre question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <button className={styles.sendBtn} onClick={send} disabled={loading || !input.trim()}>
            {loading ? "…" : "Envoyer"}
          </button>
        </div>
        <div className={styles.escape}>
          {"Besoin d'un humain ? "}
          <Link href="/chat">Contacter le support</Link>
        </div>
        <div className={styles.poweredBy}>
          Powered by{" "}
          <a href="https://www.wardian-ai.com" target="_blank" rel="noopener noreferrer">
            Wardian
          </a>
        </div>
      </div>
    </div>
  );
}
