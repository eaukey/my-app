"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Settings, MessageCircle, FileText, Table } from "lucide-react";
import Image from "next/image";
import { useAuth0 } from "@auth0/auth0-react";

export default function SideNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth0();
  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
  const clientId =
    user?.["https://app.com/client"] ||
    (Array.isArray(user?.clients) ? user.clients[0] : user?.clients);

  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    let intervalId;
    const backendBase = "https://backend-eaukey.duckdns.org";

    const fetchUnreadForClient = async () => {
      if (!clientId) return setChatUnreadCount(0);
      try {
        const res = await fetch(
          `${backendBase}/notifications/client/${encodeURIComponent(clientId)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChatUnreadCount(Number(data?.count || 0));
      } catch {
        setChatUnreadCount(0);
      }
    };

    const fetchUnreadForAdmin = async () => {
      try {
        // Récupération des clients puis agrégation des counts
        const resClients = await fetch(`${backendBase}/clients?is_admin=true`);
        if (!resClients.ok) throw new Error(`HTTP ${resClients.status}`);
        const clients = await resClients.json();
        if (!Array.isArray(clients)) return setChatUnreadCount(0);

        const counts = await Promise.all(
          clients.map(async (c) => {
            try {
              const r = await fetch(
                `${backendBase}/notifications/admin/${encodeURIComponent(c.client_id)}`
              );
              if (!r.ok) return 0;
              const d = await r.json();
              return Number(d?.count || 0);
            } catch {
              return 0;
            }
          })
        );
        const total = counts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
        setChatUnreadCount(total);
      } catch {
        setChatUnreadCount(0);
      }
    };

    const tick = () => {
      if (isAdmin) fetchUnreadForAdmin();
      else fetchUnreadForClient();
    };

    tick();
    intervalId = setInterval(tick, 10000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isAdmin, clientId]);

  const links = [
    { icon: Home, href: "/", title: "Accueil" },
    { icon: BarChart2, href: "/stock", title: "Stock" },
    { icon: Settings, href: "/pilotage", title: "Pilotage" },
    ...(isAdmin ? [{ icon: Table, href: "/admin", title: "Automates" }] : []),
    { icon: MessageCircle, href: "/chat", title: "Chat" },
    { icon: FileText, href: "/documents", title: "Documents" },
  ];

  return (
    <div className="w-16 min-h-screen fixed bg-[#41AEAD] flex flex-col items-center">
      <div className="py-4">
        <Image
          src="/images/eaukey-logo.svg.png"
          alt="Eaukey Logo"
          width={48}
          height={48}
          className="w-12"
          priority
        />
      </div>
      <div className="flex flex-col items-center flex-grow space-y-6 mt-6">
        {links.map(({ icon: Icon, href, title }) => (
          <Link
            key={href}
            href={href}
            className={`relative w-12 h-12 flex items-center justify-center ${
              pathname === href ? "bg-white rounded-lg" : "hover:bg-white hover:bg-opacity-10 rounded-lg"
            }`}
            title={title}
          >
            <Icon size={24} className={pathname === href ? "text-[#41AEAD]" : "text-white"} />
            {href === "/chat" && chatUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">
                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
} 