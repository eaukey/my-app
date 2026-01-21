"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./SuperAdmin.module.css";

export default function SuperAdminPage() {
  const { isAuthenticated, isLoading, user, authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes("super_admin");

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    const load = async () => {
      try {
        const [resOverview, resUsers, resRoles] = await Promise.all([
          authFetch(`${API_BASE}/super_admin/overview`),
          authFetch(`${API_BASE}/access/users`),
          authFetch(`${API_BASE}/access/roles`),
        ]);
        if (!resOverview.ok) throw new Error(await resOverview.text());
        if (!resUsers.ok) throw new Error(await resUsers.text());
        if (!resRoles.ok) throw new Error(await resRoles.text());
        setData(await resOverview.json());
        setUsers(await resUsers.json());
        setRoles(await resRoles.json());
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
          <div className={styles.cardTitle}>Gestion des accès</div>
          <div className={styles.list}>
            <select
              value={selectedUserId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedUserId(id);
                const found = users.find((u) => String(u.id) === id);
                setSelectedRoles(found?.roles || []);
                setSelectedOrg(found?.client_id || "");
              }}
              className={styles.pill}
            >
              <option value="">Choisir un compte</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>

            <div>
              <div className={styles.cardTitle}>Rôles</div>
              <div className={styles.list}>
                {roles.map((r) => (
                  <label key={r} className={styles.pill}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r)}
                      onChange={(e) => {
                        setSelectedRoles((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)
                        );
                      }}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className={styles.cardTitle}>Organisation</div>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className={styles.pill}
              >
                <option value="">Aucune</option>
                {(data?.clients || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={styles.pill}
              disabled={!selectedUserId || saving}
              onClick={async () => {
                try {
                  setSaving(true);
                  setError("");
                  const res = await authFetch(`${API_BASE}/access/assign`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      user_id: Number(selectedUserId),
                      roles: selectedRoles,
                      client_id: selectedOrg || null,
                    }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                } catch (e) {
                  setError(e?.message || "Erreur sauvegarde");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Sauvegarde..." : "Appliquer"}
            </button>
          </div>
        </div>
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
