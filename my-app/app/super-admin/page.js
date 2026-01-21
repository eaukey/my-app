"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./SuperAdmin.module.css";

export default function SuperAdminPage() {
  const { isAuthenticated, isLoading, user, authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes("super_admin");

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    const load = async () => {
      try {
        const res = await authFetch(`${API_BASE}/super_admin/overview`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e?.message || "Erreur chargement");
      }
    };
    load();
  }, [isAuthenticated, isSuperAdmin, authFetch]);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (!isSuperAdmin) return <p>Accès refusé.</p>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Super admin</div>
          <div className={styles.subtitle}>Vue globale de l’architecture</div>
        </div>
      </div>

      {error && <div className={styles.empty}>{error}</div>}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Super admins</div>
          <div className={styles.list}>
            {(data?.super_admins || []).length === 0 && (
              <div className={styles.empty}>Aucun super admin</div>
            )}
            {(data?.super_admins || []).map((u) => (
              <div key={u.id} className={styles.pill}>
                {u.email}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Admins</div>
          <div className={styles.list}>
            {(data?.admins || []).length === 0 && (
              <div className={styles.empty}>Aucun admin</div>
            )}
            {(data?.admins || []).map((u) => (
              <div key={u.id} className={styles.pill}>
                {u.email}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Organisations</div>
          <div className={styles.list}>
            {(data?.organizations || []).length === 0 && (
              <div className={styles.empty}>Aucune organisation</div>
            )}
            {(data?.organizations || []).map((o) => (
              <div key={o} className={styles.pill}>
                {o}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Comptes (employés)</div>
          <div className={styles.list}>
            {(data?.accounts || []).length === 0 && (
              <div className={styles.empty}>Aucun compte</div>
            )}
            {(data?.accounts || []).map((u) => (
              <div key={u.id} className={styles.pill}>
                {u.email} {u.client_id ? `• ${u.client_id}` : ""}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Comptes clients</div>
          <div className={styles.list}>
            {(data?.clients || []).length === 0 && (
              <div className={styles.empty}>Aucun client</div>
            )}
            {(data?.clients || []).map((c) => (
              <div key={c} className={styles.pill}>
                {c}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
