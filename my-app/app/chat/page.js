"use client";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatInbox from "../../components/ChatInbox";

export default function ChatPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const isAdmin = checkAdmin(user);
  const clientId = user?.client_id || null;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    // Pour les clients → redirection directe vers leur conversation
    if (isAuthenticated && !isAdmin && clientId) {
      router.replace(`/chat/${clientId}`);
    }
  }, [isLoading, isAuthenticated, isAdmin, clientId, router]);

  if (!isAuthenticated) return null;

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
              Les demandes qui ont besoin de vous d’abord : l’assistant répond aux clients et vous signale quand l’équipe doit intervenir.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 shadow-[var(--shadow-soft)] backdrop-blur">
            <ChatInbox />
          </div>
        </div>
      </div>
    );
  }

  // Client rattaché à un client : redirection vers son fil en cours.
  if (clientId) return <p>Chargement…</p>;

  // Compte client pas (encore) rattaché à un client : le dire au lieu de charger sans fin.
  // Le rattachement est lu à la connexion ; s'il vient d'être fait, une actualisation suffit.
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="max-w-xl mx-auto px-6 py-16 space-y-4">
        <h1 className="text-xl font-semibold">Votre compte n’est rattaché à aucun client</h1>
        <p className="text-[var(--text-secondary)]">
          La messagerie s’ouvre dès que l’équipe Eaukey a rattaché votre compte à votre société. Si c’est déjà
          fait, actualisez la page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl border border-[var(--primary)] text-[var(--text-primary)]"
        >
          Actualiser
        </button>
      </div>
    </div>
  );
}