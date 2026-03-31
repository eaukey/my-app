"use client";
import { useAuth, isAdmin as checkAdmin } from "../../../lib/auth";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ChatConversation from "../../../components/ChatConversation";

export default function ConversationPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { conversationId } = params;

  const isAdmin = checkAdmin(user);
  const clientId = user?.client_id || null;

  useEffect(() => {
    // Pour les clients → redirection directe vers leur conversation
    if (isAuthenticated && !isAdmin && clientId) {
      router.replace(`/chat/${clientId}`);
    }
  }, [isAuthenticated, isAdmin, clientId, router]);

  if (!isAuthenticated) { router.replace("/"); return null; }

  // Pas de redirection pour admin : on montre la conversation demandée

  if (!conversationId) return <p>Client introuvable.</p>;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6">
        <ChatConversation clientId={conversationId} />
      </div>
    </div>
  );
} 