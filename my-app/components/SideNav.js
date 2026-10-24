"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  MessageCircle,
  Cpu,
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Shield,
  Building2,
  Download,
  Eye,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  FileText,
  Camera,
} from "lucide-react";
import { API_BASE } from "../lib/apiBase";
import styles from "./SideNav.module.css";
import { useAuth, isAdmin as checkAdmin, isSuperAdmin as checkSuperAdmin, isOrgAdmin as checkOrgAdmin } from "../lib/auth";

export default function SideNav({
  expanded = false,
  onToggle = () => {},
  mobileOpen = false,
  setMobileOpen = () => {},
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, authFetch, logout } = useAuth();
  const router = useRouter();
  const isAdmin = checkAdmin(user);
  const isSuperAdmin = checkSuperAdmin(user);
  const isOrgAdmin = checkOrgAdmin(user);
  const clientId = user?.client_id || null;

  const routeClientId = !isAdmin && typeof pathname === "string" && pathname.startsWith("/chat/")
    ? pathname.split("/").pop()
    : null;
  const effectiveClientId = clientId || routeClientId;

  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [alertesNouvelles, setAlertesNouvelles] = useState(0);

  // Badge « Alertes » (admins) : nombre d'alertes nouvelles, rafraîchi toutes les
  // 60 s et après chaque action sur la page /alertes (événement « alertes:maj »).
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;
    const fetchAlertes = async () => {
      try {
        const res = await authFetch(`${API_BASE}/alertes/compteurs?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const n = Number(data?.nouvelles || 0);
        setAlertesNouvelles(Number.isFinite(n) ? n : 0);
      } catch (e) {
        console.debug("Alertes: erreur fetch compteurs", e);
      }
    };
    fetchAlertes();
    const id = setInterval(fetchAlertes, 60000);
    window.addEventListener("alertes:maj", fetchAlertes);
    return () => {
      clearInterval(id);
      window.removeEventListener("alertes:maj", fetchAlertes);
    };
  }, [isAuthenticated, isAdmin, authFetch]);

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
        // Boîte de réception : nombre de fils à traiter (équipe demandée ou non lus).
        const resBoite = await authFetch(`${API_BASE}/chat/boite/compteur?t=${ts}`);
        if (resBoite.ok) {
          const n = Number((await resBoite.json())?.a_traiter || 0);
          setChatUnreadCount(Number.isFinite(n) ? n : 0);
          return;
        }
        // Backend sans boîte de réception : total des messages clients non lus.
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
    window.addEventListener("chat:boite-changed", tick);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("chat:boite-changed", tick);
    };
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
        // Boîte de réception : on relit le compteur une fois les messages marqués lus.
        await new Promise((r) => setTimeout(r, 1500));
        const rb = await authFetch(`${API_BASE}/chat/boite/compteur?t=${Date.now()}`);
        if (rb.ok) {
          const n = Number((await rb.json())?.a_traiter || 0);
          if (Number.isFinite(n)) setChatUnreadCount(n);
          return;
        }
      } catch {}
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

  // On referme le tiroir mobile à chaque changement de page
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Sections du menu.
  // NB: la visibilité par rôle reprend EXACTEMENT les conditions existantes :
  //   - "/"            : tous
  //   - "/admin", "/pannes", "/alertes", "/base-sav", "/rapports", "/export", "/view-as" : isAdmin
  //   - "/org-admin"   : isOrgAdmin
  //   - "/super-admin", "/a-verifier" : isSuperAdmin
  //   - "/chat"        : tous
  const sections = [
    {
      title: "Supervision",
      items: [
        { icon: Home, href: "/", label: "Tableau de bord" },
        ...(isAdmin
          ? [
              { icon: Activity, href: "/parc", label: "Remontée de données" },
              { icon: Cpu, href: "/admin", label: "Automates" },
              { icon: AlertTriangle, href: "/pannes", label: "Pannes" },
              { icon: Bell, href: "/alertes", label: "Alertes", badge: "alertes" },
              { icon: BookOpen, href: "/base-sav", label: "Base SAV" },
              { icon: FileText, href: "/rapports", label: "Rapports mensuels" },
            ]
          : []),
        ...(isSuperAdmin ? [{ icon: Camera, href: "/a-verifier", label: "Photos à vérifier" }] : []),
      ],
    },
    {
      title: "Échanges",
      items: [
        { icon: MessageCircle, href: "/chat", label: "Messagerie", badge: "chat" },
        ...(isAdmin ? [{ icon: Download, href: "/export", label: "Exports" }] : []),
      ],
    },
    {
      title: "Administration",
      items: [
        ...(isAdmin ? [{ icon: Eye, href: "/view-as", label: "Vue client" }] : []),
        ...(isOrgAdmin ? [{ icon: Building2, href: "/org-admin", label: "Stations" }] : []),
        ...(isSuperAdmin ? [{ icon: Shield, href: "/super-admin", label: "Super admin" }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  const rootClassName = [
    styles.root,
    expanded ? styles.expanded : "",
    mobileOpen ? styles.mobileOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Déclencheur hamburger (mobile uniquement) */}
      <button
        type="button"
        className={styles.mobileTrigger}
        aria-label="Ouvrir le menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={22} />
        {(chatUnreadCount > 0 || alertesNouvelles > 0) && <span className={styles.triggerBadge} />}
      </button>

      {/* Fond sombre cliquable pour refermer le tiroir mobile */}
      <div
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropVisible : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav className={rootClassName} aria-label="Navigation principale">
        {/* En-tête : logo + bascule */}
        <div className={styles.header}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="Accueil Eaukey"
            title="Accueil Eaukey"
          >
            <Image
              src="/images/Logo Eaukey.png"
              alt="Logo Eaukey"
              width={40}
              height={50}
              className={styles.brandMark}
              priority
            />
            <span className={styles.brandText}>Eaukey</span>
          </Link>

          {/* Bascule rangé / déployé (desktop) */}
          <button
            type="button"
            className={styles.toggle}
            onClick={onToggle}
            aria-label={expanded ? "Ranger le menu" : "Déployer le menu"}
            title={expanded ? "Ranger le menu" : "Déployer le menu"}
          >
            {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          {/* Fermeture du tiroir (mobile) */}
          <button
            type="button"
            className={styles.mobileClose}
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sections */}
        <div className={styles.sections}>
          {sections.map((section) => (
            <div key={section.title} className={styles.section}>
              <div className={styles.sectionTitle}>{section.title}</div>
              <div className={styles.links}>
                {section.items.map(({ icon: Icon, href, label, badge }) => {
                  const active = pathname === href;
                  const badgeCount = badge === "chat" ? chatUnreadCount : badge === "alertes" ? alertesNouvelles : 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`${styles.link} ${active ? styles.active : ""}`}
                      title={label}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className={styles.iconWrap}>
                        <Icon size={22} className={styles.icon} />
                        {badgeCount > 0 && (
                          <span className={styles.badge}>
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </span>
                      <span className={styles.label}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Profil + déconnexion, toujours en bas du menu */}
        {isAuthenticated && (
          <div className={styles.footer}>
            <div className={styles.profile} title={user?.email || ""}>
              <span className={styles.avatar} aria-hidden="true">
                {(user?.name || user?.email || "?").trim().charAt(0).toUpperCase()}
              </span>
              <span className={styles.profileText}>
                <span className={styles.profileName}>{user?.name || user?.email}</span>
                <span className={styles.profileRole}>
                  {isSuperAdmin ? "Super admin" : isAdmin ? "Équipe Eaukey" : isOrgAdmin ? "Admin client" : "Client"}
                  {!isAdmin && clientId ? ` · ${clientId}` : ""}
                </span>
              </span>
            </div>
            <button
              type="button"
              className={`${styles.link} ${styles.logout}`}
              title="Se déconnecter"
              onClick={() => {
                setMobileOpen(false);
                logout();
                router.replace("/");
              }}
            >
              <span className={styles.iconWrap}>
                <LogOut size={22} className={styles.icon} />
              </span>
              <span className={styles.label}>Se déconnecter</span>
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
