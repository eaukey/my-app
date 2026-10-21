"use client";
import { useAuth, isAdmin as checkAdmin } from "../../../lib/auth";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ChatConversation from "../../../components/ChatConversation";
import ChatContacts from "../../../components/ChatContacts";

export default function ConversationPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  // L'identifiant arrive encodé depuis l'URL (« TEST%20EAUKEY ») : on le décode une fois ici,
  // sinon le titre l'affiche tel quel et les appels qui le ré-encodent visent un autre client.
  const conversationId = (() => {
    try {
      return params?.conversationId ? decodeURIComponent(params.conversationId) : params?.conversationId;
    } catch {
      return params?.conversationId;
    }
  })();

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

  // Pas de redirection pour admin : on montre la conversation demandée

  if (!conversationId) return <p>Client introuvable.</p>;

  return (
    <div className="bg-[var(--bg-base)]">
      <div className="w-full px-0 sm:px-5 lg:px-8 pt-16 sm:pt-5 pb-0 sm:pb-5">
        <ChatConversation
          clientId={conversationId}
          enTete={isAdmin ? <ChatContacts clientId={conversationId} /> : null}
        />
      </div>
    </div>
  );
} 