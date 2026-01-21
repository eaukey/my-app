"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./SuperAdmin.module.css";

export default function SuperAdminPage() {
  const { isAuthenticated, isLoading, user, authFetch } = useAuth();
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [saving, setSaving] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [orgName, setOrgName] = useState("");
  const [orgAdminEmail, setOrgAdminEmail] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgUsers, setOrgUsers] = useState([]);
  const [orgUserEmail, setOrgUserEmail] = useState("");
  const [orgUserRole, setOrgUserRole] = useState("employee");
  const [orgAutomates, setOrgAutomates] = useState([]);
  const toArray = (v, key) => (Array.isArray(v) ? v : Array.isArray(v?.[key]) ? v[key] : []);
  const isAdminOrSuper = useMemo(
    () => Array.isArray(user?.roles) && (user.roles.includes("super_admin") || user.roles.includes("admin")),
    [user?.roles]
  );

  useEffect(() => {
    if (!isAuthenticated || !isAdminOrSuper) return;
    const load = async () => {
      try {
        const [resUsers, resRoles, resOrgs] = await Promise.all([
          authFetch(`${API_BASE}/access/users`),
          authFetch(`${API_BASE}/access/roles`),
          authFetch(`${API_BASE}/orgs`),
        ]);
        if (!resUsers.ok) throw new Error(await resUsers.text());
        if (!resRoles.ok) throw new Error(await resRoles.text());
        if (!resOrgs.ok) throw new Error(await resOrgs.text());
        setUsers(toArray(await resUsers.json(), "users"));
        setRoles(toArray(await resRoles.json(), "roles"));
        setOrgs(toArray(await resOrgs.json(), "orgs"));
      } catch (e) {
        setError(e?.message || "Erreur chargement");
      }
    };
    load();
  }, [isAuthenticated, isAdminOrSuper, authFetch]);

  useEffect(() => {
    if (!isAuthenticated || !isAdminOrSuper || !selectedOrgId) return;
    const loadOrg = async () => {
      try {
        const [resUsers, resAutomates] = await Promise.all([
          authFetch(`${API_BASE}/orgs/${selectedOrgId}/users`),
          authFetch(`${API_BASE}/orgs/${selectedOrgId}/automates`),
        ]);
        if (!resUsers.ok) throw new Error(await resUsers.text());
        if (!resAutomates.ok) throw new Error(await resAutomates.text());
        setOrgUsers(toArray(await resUsers.json(), "users"));
        setOrgAutomates(toArray(await resAutomates.json(), "automates"));
      } catch (e) {
        setError(e?.message || "Erreur chargement organisation");
      }
    };
    loadOrg();
  }, [isAuthenticated, isAdminOrSuper, selectedOrgId, authFetch]);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (!isAdminOrSuper) return <p>Accès refusé.</p>;

  return (
    <div className={styles.page}>
      <datalist id="user-emails">
        {users.map((u) => (
          <option key={u.id} value={u.email} />
        ))}
      </datalist>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Gestion des accès</div>
          <div className={styles.subtitle}>Rôles, organisations et automates</div>
        </div>
      </div>

      {error && <div className={styles.empty}>{error}</div>}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Rôles globaux</div>
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
              <div className={styles.cardTitle}>Organisation (legacy)</div>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className={styles.input}
              >
                <option value="">Aucune</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={styles.button}
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
                  const resUsers2 = await authFetch(`${API_BASE}/access/users`);
                  if (resUsers2.ok) setUsers(toArray(await resUsers2.json(), "users"));
                  if (selectedOrgId) {
                    const resOrgUsers2 = await authFetch(`${API_BASE}/orgs/${selectedOrgId}/users`);
                    if (resOrgUsers2.ok) setOrgUsers(toArray(await resOrgUsers2.json(), "users"));
                  }
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
          <div className={styles.cardTitle}>Organisations</div>
          <div className={styles.list}>
            <div className={styles.sectionRow}>
              <input
                className={styles.input}
                placeholder="Nom de l’organisation"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <input
                className={styles.input}
                placeholder="Email admin"
                value={orgAdminEmail}
                onChange={(e) => setOrgAdminEmail(e.target.value)}
                list="user-emails"
              />
              <button
                className={styles.button}
                disabled={!orgName || !orgAdminEmail || saving}
                onClick={async () => {
                  try {
                    setSaving(true);
                    setError("");
                    const res = await authFetch(`${API_BASE}/orgs`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: orgName, admin_email: orgAdminEmail }),
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const created = await res.json();
                    const resOrgs = await authFetch(`${API_BASE}/orgs`);
                    if (!resOrgs.ok) throw new Error(await resOrgs.text());
                    setOrgs(await resOrgs.json());
                    setSelectedOrgId(String(created.id));
                    setOrgName("");
                    setOrgAdminEmail("");
                  } catch (e) {
                    setError(e?.message || "Erreur création organisation");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Créer
              </button>
            </div>

            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
              }}
              className={styles.input}
            >
              <option value="">Choisir une organisation</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Membres de l’organisation</div>
          <div className={styles.list}>
            {!selectedOrgId && <div className={styles.empty}>Choisir une organisation</div>}
            {selectedOrgId && (
              <>
                <div className={styles.sectionRow}>
                  <input
                    className={styles.input}
                    placeholder="Email employé"
                    value={orgUserEmail}
                    onChange={(e) => setOrgUserEmail(e.target.value)}
                    list="user-emails"
                  />
                  <select
                    className={styles.input}
                    value={orgUserRole}
                    onChange={(e) => setOrgUserRole(e.target.value)}
                  >
                    <option value="employee">employee</option>
                    <option value="org_admin">org_admin</option>
                  </select>
                  <button
                    className={styles.button}
                    disabled={!orgUserEmail || saving}
                    onClick={async () => {
                      try {
                        setSaving(true);
                        setError("");
                        const res = await authFetch(`${API_BASE}/orgs/${selectedOrgId}/users`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: orgUserEmail, org_role: orgUserRole }),
                        });
                        if (!res.ok) throw new Error(await res.text());
                        const resUsers = await authFetch(`${API_BASE}/orgs/${selectedOrgId}/users`);
                        if (!resUsers.ok) throw new Error(await resUsers.text());
                        setOrgUsers(await resUsers.json());
                        setOrgUserEmail("");
                      } catch (e) {
                        setError(e?.message || "Erreur ajout membre");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Ajouter
                  </button>
                </div>

                {(orgUsers || []).length === 0 && <div className={styles.empty}>Aucun membre</div>}
                {(orgUsers || []).map((u) => (
                  <div key={u.id} className={styles.row}>
                    <span>{u.email}</span>
                    <span className={styles.badge}>{u.org_role}</span>
                    <button
                      className={styles.danger}
                      onClick={async () => {
                        try {
                          setError("");
                          const res = await authFetch(`${API_BASE}/orgs/${selectedOrgId}/users/${u.id}`, {
                            method: "DELETE",
                          });
                          if (!res.ok) throw new Error(await res.text());
                          setOrgUsers((prev) => prev.filter((x) => x.id !== u.id));
                        } catch (e) {
                          setError(e?.message || "Erreur suppression");
                        }
                      }}
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
