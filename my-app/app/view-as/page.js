"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, isAdmin as checkAdmin, isSuperAdmin as checkSuperAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import { Search, Eye, Users, Monitor } from "lucide-react";
import styles from "./ViewAs.module.css";

export default function ViewAsPage() {
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);
  const isSuperAdmin = checkSuperAdmin(user);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingView, setLoadingView] = useState(false);

  // Charger la liste des utilisateurs
  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) return;
    const fetchUsers = async () => {
      try {
        const res = await authFetch(`${API_BASE}/access/users`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        // Filtrer les admins — on veut voir les comptes clients
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        console.error("Erreur chargement utilisateurs");
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [isAuthenticated, isAdmin, isSuperAdmin, authFetch]);

  // Charger les données d'un utilisateur sélectionné
  const handleSelectUser = useCallback(async (u) => {
    setSelectedUser(u);
    setLoadingView(true);
    setViewData(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/view-as/${u.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setViewData(data);
    } catch {
      console.error("Erreur chargement vue utilisateur");
    } finally {
      setLoadingView(false);
    }
  }, [authFetch]);

  if (isLoading) return <p style={{ padding: 40 }}>Chargement...</p>;
  if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) {
    return <p style={{ padding: 40 }}>Acc&egrave;s r&eacute;serv&eacute; aux administrateurs.</p>;
  }

  // Filtrer les utilisateurs par recherche
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.org_name || "").toLowerCase().includes(q) ||
      (u.client_id || "").toLowerCase().includes(q) ||
      (u.organizations || []).some((o) => (o.org_name || "").toLowerCase().includes(q))
    );
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vue client</h1>
          <p className={styles.subtitle}>
            Visualisez l&apos;interface et les acc&egrave;s d&apos;un utilisateur
          </p>
        </div>
      </div>

      {/* Sélecteur utilisateur */}
      <div>
        <div className={styles.selectorRow}>
          <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
            <Search
              size={16}
              style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)", pointerEvents: "none",
              }}
            />
            <input
              className={styles.searchInput}
              style={{ paddingLeft: 36, maxWidth: "100%" }}
              placeholder="Rechercher un utilisateur (email, organisation...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className={styles.badge}>{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}</span>
        </div>

        <div className={styles.userList} style={{ marginTop: 12 }}>
          {loadingUsers ? (
            <p className={styles.empty}>Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>Aucun utilisateur trouv&eacute;</p>
          ) : (
            filtered.map((u) => {
              const initials = (u.email || "?").substring(0, 2).toUpperCase();
              const orgNames = (u.organizations || []).map((o) => o.org_name).join(", ");
              const isActive = selectedUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  className={`${styles.userItem} ${isActive ? styles.userItemActive : ""}`}
                  onClick={() => handleSelectUser(u)}
                >
                  <div className={styles.userAvatar}>{initials}</div>
                  <div className={styles.userInfo}>
                    <div className={styles.userEmail}>{u.email}</div>
                    <div className={styles.userOrg}>
                      {orgNames || "Aucune organisation"}
                      {u.roles && u.roles.length > 0 && ` — ${u.roles.join(", ")}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Résultat : vue de l'utilisateur sélectionné */}
      {selectedUser && (
        <>
          {/* Banner */}
          <div className={styles.banner}>
            <Eye size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div className={styles.bannerText}>
              Vue en tant que <span className={styles.bannerEmail}>{selectedUser.email}</span>
            </div>
            <button className={styles.bannerButton} onClick={() => { setSelectedUser(null); setViewData(null); }}>
              Fermer
            </button>
          </div>

          {loadingView ? (
            <p className={styles.empty}>Chargement des donn&eacute;es...</p>
          ) : viewData ? (
            <>
              {/* Organisations */}
              {viewData.organizations && viewData.organizations.length > 0 && (
                <div className={styles.stationsCard}>
                  <h3 className={styles.cardTitle}>
                    <Users size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                    Organisations
                  </h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {viewData.organizations.map((o) => (
                      <span key={o.id} className={styles.badge} style={{ fontSize: 13, padding: "5px 12px" }}>
                        {o.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stations accessibles */}
              <div className={styles.stationsCard}>
                <h3 className={styles.cardTitle}>
                  <Monitor size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                  Stations accessibles
                  <span className={styles.badge}>{viewData.automates.length}</span>
                </h3>
                {viewData.automates.length === 0 ? (
                  <p className={styles.empty}>
                    Cet utilisateur n&apos;a acc&egrave;s &agrave; aucune station.
                  </p>
                ) : (
                  <div className={styles.stationGrid}>
                    {viewData.automates.map((a) => (
                      <div key={a.nom_automate} className={styles.stationItem}>
                        <div className={styles.stationDot} />
                        <div>
                          <div className={styles.stationName}>
                            {a.client} — {a.lieu || a.nom_automate}
                          </div>
                          <div className={styles.stationSub}>
                            ID: {a.nom_automate}
                            {a.emails && a.emails.length > 0 && ` | ${a.emails.join(", ")}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
