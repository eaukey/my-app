"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, hasRole } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./SuperAdmin.module.css";

export default function SuperAdminPage() {
  const { isAuthenticated, isLoading, user, authFetch } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState("comptes");

  // --- Données globales ---
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [orphanClients, setOrphanClients] = useState([]);

  // --- Onglet Comptes ---
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editRoles, setEditRoles] = useState([]);
  const [editClientId, setEditClientId] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Onglet Organisations ---
  const [orgSearch, setOrgSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [orgAutomates, setOrgAutomates] = useState([]);
  const [orgUserEmail, setOrgUserEmail] = useState("");
  const [orgUserRole, setOrgUserRole] = useState("employee");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgAdminEmail, setOrgAdminEmail] = useState("");

  const toArray = (v, key) => (Array.isArray(v) ? v : Array.isArray(v?.[key]) ? v[key] : []);
  const isAdminOrSuper = useMemo(
    () => hasRole(user, "super_admin") || hasRole(user, "admin"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.roles]
  );

  // Rôles système (affichés dans l'onglet Comptes)
  const systemRoles = roles.filter((r) => r !== "client");

  // Chargement initial
  useEffect(() => {
    if (!isAuthenticated || !isAdminOrSuper) return;
    const load = async () => {
      try {
        const [resUsers, resRoles, resOrgs, resOrphans] = await Promise.all([
          authFetch(`${API_BASE}/access/users`),
          authFetch(`${API_BASE}/access/roles`),
          authFetch(`${API_BASE}/orgs`),
          authFetch(`${API_BASE}/automates/orphan-clients`),
        ]);
        if (!resUsers.ok) throw new Error(await resUsers.text());
        if (!resRoles.ok) throw new Error(await resRoles.text());
        if (!resOrgs.ok) throw new Error(await resOrgs.text());
        setUsers(toArray(await resUsers.json(), "users"));
        setRoles(toArray(await resRoles.json(), "roles"));
        setOrgs(toArray(await resOrgs.json(), "orgs"));
        if (resOrphans.ok) setOrphanClients(await resOrphans.json());
      } catch (e) {
        setError(e?.message || "Erreur chargement");
      }
    };
    load();
  }, [isAuthenticated, isAdminOrSuper, authFetch]);

  // Charger membres + automates quand on sélectionne une org
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

  // --- Helpers ---
  const getInitials = (email) => {
    const parts = email.split("@")[0].split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.slice(0, 2).toUpperCase();
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const selectUser = (u) => {
    setSelectedUserId(u.id);
    setEditMode(false);
    setError("");
    setSuccess("");
  };

  const enterEditMode = () => {
    const u = selectedUser;
    if (!u) return;
    setEditRoles((u.roles || []).filter((r) => r !== "client"));
    setEditClientId(u.client_id || "");
    setEditMode(true);
    setError("");
    setSuccess("");
  };

  const cancelEdit = () => {
    setEditMode(false);
    setError("");
    setSuccess("");
  };

  const selectOrg = (o) => {
    setSelectedOrgId(o.id);
    setOrgUserEmail("");
    setOrgUserRole("employee");
    setError("");
    setSuccess("");
  };

  // --- Filtres ---
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredOrgs = orgs.filter((o) =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);

  // --- Actions Comptes ---
  const saveUserRoles = async () => {
    if (!selectedUserId) return;
    try {
      setSaving(true);
      setError("");
      const res = await authFetch(`${API_BASE}/access/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          roles: editRoles,
          client_id: editClientId || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Recharger la liste pour refléter les changements
      const resUsers2 = await authFetch(`${API_BASE}/access/users`);
      if (resUsers2.ok) setUsers(toArray(await resUsers2.json(), "users"));
      setEditMode(false);
      showSuccess("Modifications enregistrées");
    } catch (e) {
      setError(e?.message || "Erreur sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // --- Actions Organisations ---
  const createOrg = async () => {
    if (!orgName || !orgAdminEmail) return;
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
      if (resOrgs.ok) setOrgs(toArray(await resOrgs.json(), "orgs"));
      const resOrph = await authFetch(`${API_BASE}/automates/orphan-clients`);
      if (resOrph.ok) setOrphanClients(await resOrph.json());
      setSelectedOrgId(created.id);
      setOrgName("");
      setOrgAdminEmail("");
      setShowCreateOrg(false);
      showSuccess("Organisation créée");
    } catch (e) {
      setError(e?.message || "Erreur création");
    } finally {
      setSaving(false);
    }
  };

  const addOrgUser = async () => {
    if (!orgUserEmail || !selectedOrgId) return;
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
      if (resUsers.ok) setOrgUsers(toArray(await resUsers.json(), "users"));
      setOrgUserEmail("");
      showSuccess("Membre ajouté");
    } catch (e) {
      setError(e?.message || "Erreur ajout membre");
    } finally {
      setSaving(false);
    }
  };

  const removeOrgUser = async (userId) => {
    try {
      setError("");
      const res = await authFetch(`${API_BASE}/orgs/${selectedOrgId}/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setOrgUsers((prev) => prev.filter((x) => x.id !== userId));
    } catch (e) {
      setError(e?.message || "Erreur suppression");
    }
  };

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) return <p>{"Veuillez vous connecter…"}</p>;
  if (!isAdminOrSuper) return <p>{"Accès refusé."}</p>;

  // --- Rendu fiche compte (mode lecture) ---
  const renderUserReadOnly = (u) => {
    const userRoles = (u.roles || []).filter((r) => r !== "client");
    return (
      <>
        {/* En-tête */}
        <div className={styles.ficheHeader}>
          <div className={styles.ficheAvatar}>{getInitials(u.email)}</div>
          <div>
            <div className={styles.ficheEmail}>{u.email}</div>
            <div className={styles.ficheSub}>Compte #{u.id}</div>
          </div>
          <button className={styles.buttonSecondary} onClick={enterEditMode}>
            Modifier la fiche
          </button>
        </div>

        <hr className={styles.divider} />

        {/* Rôles */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{"Rôles système"}</div>
          <div className={styles.rolesGrid}>
            {systemRoles.map((r) => {
              const active = userRoles.includes(r);
              return (
                <div
                  key={r}
                  className={`${styles.rolePill} ${active ? styles.rolePillActive : styles.rolePillInactive}`}
                >
                  {r}
                </div>
              );
            })}
          </div>
        </div>

        <hr className={styles.divider} />

        {/* Organisation */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Organisation</div>
          {u.org_name ? (
            <div className={styles.orgInfo}>
              <span className={styles.orgInfoName}>{u.org_name}</span>
              <span className={styles.badge}>{u.org_role || "employee"}</span>
            </div>
          ) : (
            <div className={styles.ficheMuted}>Aucune organisation</div>
          )}
          <div className={styles.ficheMuted}>
            {"Pour modifier l'organisation, utilisez l'onglet Organisations."}
          </div>
        </div>

        {success && <span className={styles.successMsg}>{success}</span>}
      </>
    );
  };

  // --- Rendu fiche compte (mode édition) ---
  const renderUserEdit = (u) => (
    <>
      {/* En-tête */}
      <div className={styles.ficheHeader}>
        <div className={styles.ficheAvatar}>{getInitials(u.email)}</div>
        <div>
          <div className={styles.ficheEmail}>{u.email}</div>
          <div className={styles.ficheSub}>Modification en cours</div>
        </div>
      </div>

      <hr className={styles.divider} />

      {/* Rôles (cliquables) */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{"Rôles système"}</div>
        <div className={styles.rolesGrid}>
          {systemRoles.map((r) => {
            const active = editRoles.includes(r);
            return (
              <div
                key={r}
                className={`${styles.rolePill} ${active ? styles.rolePillActive : styles.rolePillInactive} ${styles.rolePillClickable}`}
                onClick={() => {
                  setEditRoles((prev) =>
                    active ? prev.filter((x) => x !== r) : [...prev, r]
                  );
                }}
              >
                {r}
              </div>
            );
          })}
        </div>
      </div>

      <hr className={styles.divider} />

      {/* Organisation (select) */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Organisation</div>
        <select
          className={styles.input}
          value={editClientId}
          onChange={(e) => setEditClientId(e.target.value)}
        >
          <option value="">Aucune organisation</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.name}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Boutons */}
      <div className={styles.ficheActions}>
        {success && <span className={styles.successMsg}>{success}</span>}
        <button className={styles.buttonSecondary} onClick={cancelEdit}>
          Annuler
        </button>
        <button
          className={styles.button}
          disabled={saving}
          onClick={saveUserRoles}
        >
          {saving ? "Sauvegarde..." : "Enregistrer"}
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <datalist id="user-emails">
        {users.map((u) => (
          <option key={u.id} value={u.email} />
        ))}
      </datalist>

      <div className={styles.header}>
        <div>
          <div className={styles.title}>{"Gestion des accès"}</div>
          <div className={styles.subtitle}>{"Rôles, organisations et automates"}</div>
        </div>
      </div>

      {/* Onglets */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "comptes" ? styles.tabActive : ""}`}
          onClick={() => { setTab("comptes"); setError(""); setSuccess(""); }}
        >
          Comptes
        </button>
        <button
          className={`${styles.tab} ${tab === "organisations" ? styles.tabActive : ""}`}
          onClick={() => { setTab("organisations"); setError(""); setSuccess(""); }}
        >
          Organisations
        </button>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* =================== ONGLET COMPTES =================== */}
      {tab === "comptes" && (
        <div className={styles.content}>
          {/* Panel gauche : liste des comptes */}
          <div className={styles.listCard}>
            <div className={styles.cardTitle}>
              Comptes <span className={styles.countBadge}>({users.length})</span>
            </div>
            <input
              className={styles.searchInput}
              placeholder="Rechercher un email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className={styles.itemList}>
              {filteredUsers.length === 0 && (
                <div className={styles.empty}>Aucun résultat</div>
              )}
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className={`${styles.item} ${selectedUserId === u.id ? styles.itemActive : ""}`}
                  onClick={() => selectUser(u)}
                >
                  <div className={styles.itemAvatar}>{getInitials(u.email)}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{u.email}</div>
                    <div className={styles.itemSub}>
                      {[
                        ...(u.roles || []).filter((r) => r !== "client"),
                        ...(u.org_role ? [u.org_role] : []),
                      ].join(", ") || "aucun rôle"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel droit : fiche du compte */}
          <div className={styles.detailCard}>
            {!selectedUserId && (
              <div className={styles.empty}>
                {"Sélectionnez un compte pour voir sa fiche"}
              </div>
            )}
            {selectedUserId && selectedUser && (
              editMode ? renderUserEdit(selectedUser) : renderUserReadOnly(selectedUser)
            )}
          </div>
        </div>
      )}

      {/* =================== ONGLET ORGANISATIONS =================== */}
      {tab === "organisations" && (
        <div className={styles.content}>
          {/* Panel gauche : liste des organisations */}
          <div className={styles.listCard}>
            <div className={styles.cardTitle}>
              Organisations <span className={styles.countBadge}>({orgs.length})</span>
            </div>
            <input
              className={styles.searchInput}
              placeholder="Rechercher..."
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
            />

            <button
              className={showCreateOrg ? styles.buttonSecondary : styles.button}
              onClick={() => setShowCreateOrg(!showCreateOrg)}
              style={{ width: "100%", marginBottom: 12 }}
            >
              {showCreateOrg ? "Annuler" : "+ Créer une organisation"}
            </button>

            {showCreateOrg && (
              <div className={styles.createForm}>
                <select
                  className={styles.input}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                >
                  <option value="">Choisir un client...</option>
                  {orphanClients.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                  onClick={createOrg}
                >
                  {saving ? "Création..." : "Créer"}
                </button>
              </div>
            )}

            <div className={styles.itemList}>
              {filteredOrgs.length === 0 && (
                <div className={styles.empty}>Aucun résultat</div>
              )}
              {filteredOrgs.map((o) => (
                <div
                  key={o.id}
                  className={`${styles.item} ${selectedOrgId === o.id ? styles.itemActive : ""}`}
                  onClick={() => selectOrg(o)}
                >
                  <div className={styles.itemAvatar}>{o.name.slice(0, 2).toUpperCase()}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{o.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel droit : détails de l'organisation */}
          <div className={styles.detailCard}>
            {!selectedOrgId && (
              <div className={styles.empty}>
                {"Sélectionnez une organisation pour gérer ses membres"}
              </div>
            )}
            {selectedOrgId && selectedOrg && (
              <>
                {/* Membres */}
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    Membres de {selectedOrg.name}{" "}
                    <span className={styles.countBadge}>({orgUsers.length})</span>
                  </div>

                  <div className={styles.inlineForm}>
                    <input
                      className={styles.input}
                      placeholder="Email du nouveau membre"
                      value={orgUserEmail}
                      onChange={(e) => setOrgUserEmail(e.target.value)}
                      list="user-emails"
                    />
                    <select
                      className={styles.input}
                      value={orgUserRole}
                      onChange={(e) => setOrgUserRole(e.target.value)}
                      style={{ flex: "0 0 130px", minWidth: 130 }}
                    >
                      <option value="employee">employee</option>
                      <option value="org_admin">org_admin</option>
                    </select>
                    <button
                      className={styles.button}
                      disabled={!orgUserEmail || saving}
                      onClick={addOrgUser}
                    >
                      Ajouter
                    </button>
                  </div>

                  {orgUsers.length === 0 && (
                    <div className={styles.empty}>Aucun membre</div>
                  )}
                  {orgUsers.map((u) => (
                    <div key={u.id} className={styles.memberRow}>
                      <div className={styles.memberInfo}>
                        <div className={styles.itemAvatar}>{getInitials(u.email)}</div>
                        <span className={styles.memberEmail}>{u.email}</span>
                      </div>
                      <span className={styles.badge}>{u.org_role}</span>
                      <button className={styles.danger} onClick={() => removeOrgUser(u.id)}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>

                <hr className={styles.divider} />

                {/* Automates */}
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    Stations rattachées{" "}
                    <span className={styles.countBadge}>({orgAutomates.length})</span>
                  </div>
                  {orgAutomates.length === 0 && (
                    <div className={styles.empty}>Aucune station</div>
                  )}
                  {orgAutomates.map((a) => (
                    <div key={a.nom_automate} className={styles.memberRow}>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberEmail}>{a.nom_automate}</span>
                      </div>
                      {a.lieu && <span className={styles.badge}>{a.lieu}</span>}
                    </div>
                  ))}
                </div>

                {success && <span className={styles.successMsg}>{success}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
