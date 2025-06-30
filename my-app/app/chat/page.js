"use client";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ConversationList from "../../components/ConversationList";

export default function ChatPage() {
  const { user, isAuthenticated } = useAuth0();
  const router = useRouter();

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

  if (isAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-4">Conversations clients</h1>
        <ConversationList />
      </div>
    );
  }

  // Client : en attente redirection
  return <p>Chargement…</p>;
}