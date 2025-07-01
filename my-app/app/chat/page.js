"use client";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ConversationList from "../../components/ConversationList";
import SideNav from "../../components/SideNav";

export default function ChatPage() {
  const { user, isAuthenticated } = useAuth0();
  const router = useRouter();

  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
  const clientId =
    user?.["https://app.com/client"] ||
    (Array.isArray(user?.clients) ? user.clients[0] : user?.clients);

  useEffect(() => {
    console.log("user =", user);
    console.log("isAdmin =", isAdmin, "clientId =", clientId);
    // Pour les clients → redirection directe vers leur conversation
    if (isAuthenticated && !isAdmin && clientId) {
      router.replace(`/chat/${clientId}`);
    }
  }, [isAuthenticated, isAdmin, clientId, router]);

  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;

  if (isAdmin) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SideNav />
        <div className="flex-1 p-8 ml-16">
          <h1 className="text-xl font-semibold mb-4">Conversations clients</h1>
          <ConversationList />
        </div>
      </div>
    );
  }

  // Client : en attente redirection
  return <p>Chargement…</p>;
}