"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Table, AlertTriangle, Shield } from "lucide-react";
import { API_BASE } from "../lib/apiBase";
import styles from "./SideNav.module.css";
import { useAuth } from "../lib/auth";

export default function SideNav({ collapsed = false }) {
  const pathname = usePathname();
  const { user, isAuthenticated, authFetch } = useAuth();
  const roles = user?.roles || [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  const isSuperAdmin = Array.isArray(roles) && roles.includes("super_admin");
  const clientId = user?.client_id || null;

  const routeClientId = !isAdmin && typeof pathname === "string" && pathname.startsWith("/chat/")
    ? pathname.split("/").pop()
    : null;
  const effectiveClientId = clientId || routeClientId;

  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    let intervalId;
    const fetchUnreadForClient = async () => {
      if (!effectiveClientId) return;
      try {
        const ts = Date.now();
        const res = await authFetch(
          `${API_BASE}/notifications/client/${encodeURIComponent(effectiveClientId)}?t=${ts}`
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
        const resClients = await authFetch(`${API_BASE}/clients?is_admin=true&t=${ts}`);
        if (!resClients.ok) throw new Error(`HTTP ${resClients.status}`);
        const clients = await resClients.json();
        if (!Array.isArray(clients)) return;

        const resCounts = await authFetch(`${API_BASE}/notifications/admin_all?t=${ts}`);
        if (!resCounts.ok) throw new Error(`HTTP ${resCounts.status}`);
        const byClient = (await resCounts.json()) || {};

        const total = clients.reduce((sum, c) => {
          const n = Number(byClient?.[String(c.client_id)] || 0);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
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
  }, [isAuthenticated, isAdmin, effectiveClientId, pathname, authFetch]);

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
        const ts = Date.now();
        const r = await authFetch(`${API_BASE}/notifications/admin/${encodeURIComponent(openedClientId)}?t=${ts}`);
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
    ...(isSuperAdmin ? [{ icon: Shield, href: "/super-admin", title: "Super admin" }] : []),
    ...(isAdmin ? [
      { icon: Table, href: "/admin", title: "Automates" },
      { icon: AlertTriangle, href: "/pannes", title: "Pannes" },
    ] : []),
    { icon: MessageCircle, href: "/chat", title: "Chat" },
    // { icon: FileText, href: "/documents", title: "Documents" }, // Masqué du menu (conservé côté routes)
  ];

  const navClassName = collapsed ? `${styles.root} ${styles.collapsed}` : styles.root;

  return (
    <div className={navClassName}>
      <Link
        href="/"
        className={styles.brand}
        aria-label="Accueil Eaukey"
        title="Accueil Eaukey"
      >
        <Image
          src="/images/Logo Eaukey.png"
          alt="Logo Eaukey"
          width={32}
          height={32}
          className={styles.brandMark}
          priority
        />
        <span className={styles.brandText}>Eaukey</span>
      </Link>
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