"use client";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ChatConversation from "../../../components/ChatConversation";

export default function ConversationPage() {
  const { user, isAuthenticated } = useAuth0();
  const router = useRouter();
  const params = useParams();
  const { conversationId } = params;

  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
  const clientId =
    user?.["https://app.com/client"] ||
    (Array.isArray(user?.clients) ? user.clients[0] : user?.clients);

  useEffect(() => {
    // Pour les clients → redirection directe vers leur conversation
    if (isAuthenticated && !isAdmin && clientId) {
      router.replace(`/chat/${clientId}`);
    }
  }, [isAuthenticated, isAdmin, clientId, router]);

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;

  // Pas de redirection pour admin : on montre la conversation demandée

  if (!conversationId) return <p>Client introuvable.</p>;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="max-w-6xl mx-auto px-3 md:px-5 pt-3 md:pt-4 pb-3">
        <ChatConversation clientId={conversationId} />
      </div>
    </div>
  );
} 