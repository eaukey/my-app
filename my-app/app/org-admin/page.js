"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isOrgAdmin as checkOrgAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./OrgAdmin.module.css";

export default function OrgAdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, authFetch } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [members, setMembers] = useState([]);
  const [automates, setAutomates] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [memberAccess, setMemberAccess] = useState(new Set());
  const [initialAccess, setInitialAccess] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [adminOrgs, setAdminOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const isOrg = checkOrgAdmin(user);

  // Charger les organisations de l'org_admin
  useEffect(() => {
    if (!isAuthenticated || !isOrg) return;
    const loadOrgs = async () => {
      try {
        const res = await authFetch(`${API_BASE}/org-admin/organizations`);
        if (!res.ok) throw new Error(await res.text());
        const orgs = await res.json();
        setAdminOrgs(orgs);
        if (orgs.length > 0 && !selectedOrgId) setSelectedOrgId(orgs[0].id);
      } catch (e) {
        setError(e?.message || "Erreur chargement organisations");
      }
    };
    loadOrgs();
  }, [isAuthenticated, isOrg, authFetch]);

  // Charger membres et automates de l'organisation sélectionnée
  useEffect(() => {
    if (!isAuthenticated || !isOrg || !selectedOrgId) return;
    setSelectedMemberId(null);
    setMemberAccess(new Set());
    setInitialAccess(new Set());
    const load = async () => {
      try {
        setError("");
        const [resMembers, resAutomates] = await Promise.all([
          authFetch(`${API_BASE}/org-admin/members?org_id=${selectedOrgId}`),
          authFetch(`${API_BASE}/org-admin/automates?org_id=${selectedOrgId}`),
        ]);
        if (!resMembers.ok) throw new Error(await resMembers.text());
        if (!resAutomates.ok) throw new Error(await resAutomates.text());
        setMembers(await resMembers.json());
        setAutomates(await resAutomates.json());
      } catch (e) {
        setError(e?.message || "Erreur chargement");
      }
    };
    load();
  }, [isAuthenticated, isOrg, selectedOrgId, authFetch]);

  // Charger les accès du membre sélectionné
  const loadMemberAccess = useCallback(
    async (memberId) => {
      try {
        setError("");
        setSuccess("");
        const orgParam = selectedOrgId ? `?org_id=${selectedOrgId}` : "";
        const res = await authFetch(`${API_BASE}/org-admin/member/${memberId}/automates${orgParam}`);
        if (!res.ok) throw new Error(await res.text());
        const noms = await res.json();
        const s = new Set(noms);
        setMemberAccess(s);
        setInitialAccess(new Set(s));
      } catch (e) {
        setError(e?.message || "Erreur chargement accès");
      }
    },
    [authFetch, selectedOrgId]
  );

  useEffect(() => {
    if (selectedMemberId) loadMemberAccess(selectedMemberId);
  }, [selectedMemberId, loadMemberAccess]);

  const toggleStation = (nom) => {
    setMemberAccess((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      return next;
    });
  };

  const selectAll = () => {
    setMemberAccess(new Set(automates.map((a) => a.nom_automate)));
  };

  const deselectAll = () => {
    setMemberAccess(new Set());
  };

  const hasChanges =
    memberAccess.size !== initialAccess.size ||
    [...memberAccess].some((n) => !initialAccess.has(n));

  const saveAccess = async () => {
    if (!selectedMemberId) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const orgParam = selectedOrgId ? `?org_id=${selectedOrgId}` : "";
      const res = await authFetch(`${API_BASE}/org-admin/member/${selectedMemberId}/automates${orgParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automate_noms: [...memberAccess] }),
      });
      if (!res.ok) throw new Error(await res.text());
      setInitialAccess(new Set(memberAccess));
      setSuccess("Accès mis à jour");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e?.message || "Erreur sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (email) => {
    const parts = email.split("@")[0].split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) { router.replace("/"); return null; }
  if (!isOrg) return <p>{"Accès réservé aux administrateurs d'organisation."}</p>;

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Gestion des stations</div>
          <div className={styles.subtitle}>
            Gérez les accès de vos employés aux stations
          </div>
          {adminOrgs.length > 1 ? (
            <select
              className={styles.orgSelect}
              value={selectedOrgId || ""}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
            >
              {adminOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          ) : adminOrgs.length === 1 ? (
            <div className={styles.orgName}>{adminOrgs[0].name}</div>
          ) : null}
        </div>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      <div className={styles.content}>
        {/* Panel gauche : liste des employés */}
        <div className={styles.membersCard}>
          <div className={styles.cardTitle}>
            Employés{" "}
            <span className={styles.countBadge}>({members.length})</span>
          </div>
          <div className={styles.memberList}>
            {members.length === 0 && (
              <div className={styles.empty}>Aucun membre</div>
            )}
            {members.map((m) => (
              <div
                key={m.id}
                className={`${styles.memberItem} ${
                  selectedMemberId === m.id ? styles.memberItemActive : ""
                }`}
                onClick={() => setSelectedMemberId(m.id)}
              >
                <div className={styles.memberAvatar}>{getInitials(m.email)}</div>
                <div className={styles.memberInfo}>
                  <div className={styles.memberEmail}>{m.email}</div>
                  <div className={styles.memberRole}>{m.org_role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel droit : stations avec toggles */}
        <div className={styles.stationsCard}>
          {!selectedMemberId && (
            <div className={styles.empty}>
              Sélectionnez un employé pour gérer ses accès aux stations
            </div>
          )}
          {selectedMemberId && (
            <>
              <div className={styles.stationsHeader}>
                <div>
                  <div className={styles.cardTitle}>
                    Stations accessibles par {selectedMember?.email || ""}
                  </div>
                  <span className={styles.countBadge}>
                    {memberAccess.size} / {automates.length} stations
                  </span>
                </div>
                <div className={styles.stationsActions}>
                  <button className={styles.btnSmall} onClick={selectAll}>
                    Tout sélectionner
                  </button>
                  <button className={styles.btnSmall} onClick={deselectAll}>
                    Tout retirer
                  </button>
                </div>
              </div>

              <div className={styles.stationsGrid}>
                {automates.map((a) => {
                  const checked = memberAccess.has(a.nom_automate);
                  return (
                    <div
                      key={a.nom_automate}
                      className={`${styles.stationItem} ${
                        checked ? styles.stationItemActive : ""
                      }`}
                      onClick={() => toggleStation(a.nom_automate)}
                    >
                      <div className={styles.stationInfo}>
                        <div className={styles.stationName}>
                          {a.nom_automate}
                        </div>
                        {a.lieu && (
                          <div className={styles.stationLieu}>{a.lieu}</div>
                        )}
                      </div>
                      <label className={styles.toggle} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStation(a.nom_automate)}
                        />
                        <span className={styles.toggleTrack} />
                      </label>
                    </div>
                  );
                })}
              </div>

              {automates.length === 0 && (
                <div className={styles.empty}>{"Aucune station dans l'organisation"}</div>
              )}

              <div className={styles.saveBar}>
                {success && <span className={styles.successMsg}>{success}</span>}
                <button
                  className={styles.button}
                  disabled={!hasChanges || saving}
                  onClick={saveAccess}
                >
                  {saving ? "Sauvegarde..." : "Enregistrer"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
