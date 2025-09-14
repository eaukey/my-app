"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Settings, MessageCircle, FileText, Table } from "lucide-react";
import Image from "next/image";
import { useAuth0 } from "@auth0/auth0-react";
import styles from "./SideNav.module.css";

export default function SideNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth0();
  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
  const clientId =
    user?.["https://app.com/client"] ||
    (Array.isArray(user?.clients) ? user.clients[0] : user?.clients);

  const routeClientId = !isAdmin && typeof pathname === "string" && pathname.startsWith("/chat/")
    ? pathname.split("/").pop()
    : null;
  const effectiveClientId = clientId || routeClientId;

  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    let intervalId;
    const backendBase = "https://backend-eaukey.duckdns.org";

    const fetchUnreadForClient = async () => {
      if (!effectiveClientId) return;
      try {
        const ts = Date.now();
        const res = await fetch(
          `${backendBase}/notifications/client/${encodeURIComponent(effectiveClientId)}?t=${ts}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const next = Number(data?.count || 0);
        setChatUnreadCount(Number.isFinite(next) ? next : 0);
      } catch (e) {
        console.debug("Notif client: erreur fetch", e);
      }
    };

    const fetchUnreadForAdmin = async () => {
      try {
        const ts = Date.now();
        const resClients = await fetch(`${backendBase}/clients?is_admin=true&t=${ts}`);
        if (!resClients.ok) throw new Error(`HTTP ${resClients.status}`);
        const clients = await resClients.json();
        if (!Array.isArray(clients)) return;

        const counts = await Promise.all(
          clients.map(async (c) => {
            try {
              const r = await fetch(
                `${backendBase}/notifications/admin/${encodeURIComponent(c.client_id)}?t=${ts}`
              );
              if (!r.ok) return 0;
              const d = await r.json();
              return Number(d?.count || 0);
            } catch (e) {
              console.debug("Notif admin: erreur fetch client", c?.client_id, e);
              return 0;
            }
          })
        );
        const total = counts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
        setChatUnreadCount(total);
      } catch (e) {
        console.debug("Notif admin: erreur fetch liste clients", e);
      }
    };

    const tick = () => {
      if (isAdmin) fetchUnreadForAdmin();
      else fetchUnreadForClient();
    };

    tick();
    intervalId = setInterval(tick, 30000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isAdmin, effectiveClientId, pathname]);

  // Reset optimiste du badge côté client quand la conversation s'ouvre
  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    const handler = () => setChatUnreadCount(0);
    window.addEventListener("chat:conversation-opened", handler);
    return () => window.removeEventListener("chat:conversation-opened", handler);
  }, [isAuthenticated, isAdmin]);

  // Décrémentation optimiste pour admin quand il ouvre une conversation
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    const handler = async (e) => {
      const openedClientId = e?.detail?.clientId;
      if (!openedClientId) return;
      try {
        const backendBase = "https://backend-eaukey.duckdns.org";
        const ts = Date.now();
        const r = await fetch(`${backendBase}/notifications/admin/${encodeURIComponent(openedClientId)}?t=${ts}`);
        if (!r.ok) return;
        const d = await r.json();
        const delta = Number(d?.count || 0);
        if (delta > 0) setChatUnreadCount((prev) => Math.max(0, (prev || 0) - delta));
      } catch {}
    };
    window.addEventListener("chat:admin-opened-conversation", handler);
    return () => window.removeEventListener("chat:admin-opened-conversation", handler);
  }, [isAuthenticated, isAdmin]);

  const links = [
    { icon: Home, href: "/", title: "Accueil" },
    // { icon: BarChart2, href: "/stock", title: "Stock" }, // Masqué du menu (conservé côté routes)
    // { icon: Settings, href: "/pilotage", title: "Pilotage" }, // Masqué du menu (conservé côté routes)
    ...(isAdmin ? [{ icon: Table, href: "/admin", title: "Automates" }] : []),
    { icon: MessageCircle, href: "/chat", title: "Chat" },
    { icon: FileText, href: "/documents", title: "Documents" },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.logo}>
        <Image
          src="/images/eaukey-logo.svg.png"
          alt="Eaukey Logo"
          width={48}
          height={48}
          priority
        />
      </div>
      <div className={styles.links}>
        {links.map(({ icon: Icon, href, title }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${pathname === href ? styles.active : ""}`}
            title={title}
          >
            <Icon size={24} className={styles.icon} />
            {href === "/chat" && chatUnreadCount > 0 && (
              <span className={styles.badge}>
                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
} 