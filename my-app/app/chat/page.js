"use client";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ConversationList from "../../components/ConversationList";

export default function ChatPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const isAdmin = checkAdmin(user);
  const clientId = user?.client_id || null;

  useEffect(() => {
    // Pour les clients → redirection directe vers leur conversation
    if (isAuthenticated && !isAdmin && clientId) {
      router.replace(`/chat/${clientId}`);
    }
  }, [isAuthenticated, isAdmin, clientId, router]);

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Support
            </span>
            <h1 className="text-2xl font-semibold">Conversations clients</h1>
            <p className="text-[var(--text-secondary)]">
              Retrouvez en un coup d’œil les demandes en attente et accédez aux échanges.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 shadow-[var(--shadow-soft)] backdrop-blur">
            <ConversationList />
          </div>
        </div>
      </div>
    );
  }

  // Client : en attente redirection
  return <p>Chargement…</p>;
}