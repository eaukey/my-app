"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Edit, Save, X, Search, Plus, Loader2, Trash2, Check } from "lucide-react";
import styles from "./AdminMobile.module.css";

const BACKEND_URL = "https://backend-eaukey.duckdns.org";

const splitEmails = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((e) => (e || "").trim()).filter(Boolean);
  return String(value)
    .replace(/;/g, ",")
    .split(",")
    .map((e) => (e || "").trim())
    .filter(Boolean);
};

const normalizeEmailList = (list) =>
  splitEmails(list).map((e) => e.toLowerCase()).filter((v, idx, arr) => arr.indexOf(v) === idx);

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [automates, setAutomates] = useState([]);
  const [form, setForm] = useState({ nom_automate: "", client: "", lieu: "", emails: [""] });
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ client: "", lieu: "", emails: [""] });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const isAdmin = user && (user["https://app.com/role"] || user.role) === "admin";

  const fetchAutomates = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch(`${BACKEND_URL}/recherche/automate_LCA`);
      const data = await res.json();
      setAutomates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la récupération des automates");
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAutomates();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEmailChange = (index, value) => {
    setForm((prev) => {
      const next = [...(prev.emails || [])];
      next[index] = value;
      return { ...prev, emails: next };
    });
  };

  const addEmailField = () => {
    setForm((prev) => ({ ...prev, emails: [...(prev.emails || []), ""] }));
  };

  const removeEmailField = (index) => {
    setForm((prev) => {
      const next = [...(prev.emails || [])];
      next.splice(index, 1);
      return { ...prev, emails: next.length ? next : [""] };
    });
  };

  const handleEditEmailChange = (index, value) => {
    setEditValues((prev) => {
      const next = [...(prev.emails || [])];
      next[index] = value;
      return { ...prev, emails: next };
    });
  };

  const addEditEmailField = () => {
    setEditValues((prev) => ({ ...prev, emails: [...(prev.emails || []), ""] }));
  };

  const removeEditEmailField = (index) => {
    setEditValues((prev) => {
      const next = [...(prev.emails || [])];
      next.splice(index, 1);
      return { ...prev, emails: next.length ? next : [""] };
    });
  };

  const getEmailList = (item) => (item?.emails && item.emails.length ? item.emails : splitEmails(item?.email));

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const payload = {
        nom_automate: form.nom_automate,
        client: form.client,
        lieu: form.lieu,
      };
      const normalizedEmails = normalizeEmailList(form.emails);
      if (normalizedEmails.length > 0) {
        payload.email = normalizedEmails;
        payload.emails = normalizedEmails;
      }
      const res = await fetch(`${BACKEND_URL}/automate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      setForm({ nom_automate: "", client: "", lieu: "", emails: [""] });
      fetchAutomates();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const askDelete = (nom) => {
    setPendingDelete(nom);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/automate/${pendingDelete}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      fetchAutomates();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const startEdit = (a) => {
    setEditingId(a.nom_automate);
    setEditValues({
      client: a.client || "",
      lieu: a.lieu || "",
      emails: (a.emails && a.emails.length ? a.emails : splitEmails(a.email)).concat([""]).slice(0),
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ client: "", lieu: "", emails: [""] });
  };

  const saveEdit = async (nom) => {
    try {
      setSavingId(nom);
      setError("");
      const normalizedEmails = normalizeEmailList(editValues.emails);
      const payload = {
        client: editValues.client,
        lieu: editValues.lieu,
        email: normalizedEmails,
        emails: normalizedEmails,
      };
      const res = await fetch(`${BACKEND_URL}/automate/${encodeURIComponent(nom)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erreur ${res.status}: ${txt || "échec de la mise à jour"}`);
      }
      const normalizedEmail = (normalizedEmails || []).join(",");
      setAutomates((prev) =>
        prev.map((it) =>
          it.nom_automate === nom
            ? { ...it, client: editValues.client, lieu: editValues.lieu, email: normalizedEmail, emails: normalizedEmails }
            : it
        )
      );
      cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const filteredAutomates = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return automates;
    return automates.filter((a) =>
      [a.nom_automate, a.client, a.lieu, getEmailList(a).join(",")].some((v) => (v || "").toLowerCase().includes(term))
    );
  }, [automates, searchTerm]);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated || !isAdmin) return <p>Accès refusé.</p>;

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Administration</p>
          <h1 className={styles.pageTitle}>Gestion des automates</h1>
          <p className={styles.subTitle}>Ajout, édition et suppression des automates.</p>
        </div>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.sectionGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.eyebrow}>Automate</p>
              <h2 className={styles.cardTitle}>Ajouter un automate</h2>
              <p className={styles.cardHint}>Renseignez les champs puis validez pour ajouter à la liste.</p>
            </div>
          </div>

          <form onSubmit={handleAdd} className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Nom automate</span>
              <input
                name="nom_automate"
                value={form.nom_automate}
                onChange={handleChange}
                placeholder="Ex: 20240101.0"
                required
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Client</span>
              <input
                name="client"
                value={form.client}
                onChange={handleChange}
                placeholder="Client"
                required
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Lieu</span>
              <input
                name="lieu"
                value={form.lieu}
                onChange={handleChange}
                placeholder="Site / Ville"
                required
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Emails (optionnel)</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(form.emails || []).map((email, idx) => (
                  <div key={`email-${idx}`} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(idx, e.target.value)}
                      placeholder={`Email ${idx + 1}`}
                className={styles.input}
              />
                    {form.emails.length > 1 && (
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => removeEmailField(idx)}
                        aria-label="Supprimer cet email"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.button} onClick={addEmailField}>
                  <Plus size={14} />
                  Ajouter un email
                </button>
              </div>
            </label>
            <div className={styles.actionCell}>
              <button type="submit" className={`${styles.button} ${styles.primaryButton}`} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className={styles.spin} />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Ajouter
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.eyebrow}>Liste</p>
              <h2 className={styles.cardTitle}>Liste des automates</h2>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.searchBox}>
                <Search size={16} />
                <input
                  className={styles.searchInput}
                  placeholder="Rechercher (nom, client, lieu, email)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className={styles.countBadge}>{filteredAutomates.length} automates</div>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nom automate</th>
                    <th>Client</th>
                    <th>Lieu</th>
                    <th>Email</th>
                    <th className={styles.actionsCol}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingList &&
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className={styles.skeletonRow}>
                        <td colSpan={5} />
                      </tr>
                    ))}

                  {!isLoadingList && filteredAutomates.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.emptyState}>
                        <div>
                          <p className={styles.emptyTitle}>Aucun automate trouvé</p>
                          <p className={styles.emptyText}>Ajoutez un automate ou ajustez votre recherche.</p>
                          <button
                            type="button"
                            className={`${styles.button} ${styles.primaryButton}`}
                            onClick={() => {
                              setSearchTerm("");
                            }}
                          >
                            <Plus size={16} />
                            Ajouter un automate
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!isLoadingList &&
                    filteredAutomates.map((a) => (
                      <tr key={a.nom_automate}>
                        <td>
                          <span className={styles.mono}>{a.nom_automate}</span>
                        </td>
                        <td>
                          {editingId === a.nom_automate ? (
                            <input
                              value={editValues.client}
                              onChange={(e) => setEditValues((v) => ({ ...v, client: e.target.value }))}
                              className={`${styles.input} ${styles.cellInput}`}
                            />
                          ) : (
                            <span className={styles.textStrong}>{a.client}</span>
                          )}
                        </td>
                        <td>
                          {editingId === a.nom_automate ? (
                            <input
                              value={editValues.lieu}
                              onChange={(e) => setEditValues((v) => ({ ...v, lieu: e.target.value }))}
                              className={`${styles.input} ${styles.cellInput}`}
                            />
                          ) : (
                            a.lieu
                          )}
                        </td>
                        <td>
                          {editingId === a.nom_automate ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {(editValues.emails || []).map((email, idx) => (
                                <div key={`edit-email-${idx}`} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <input
                              type="email"
                                    value={email}
                                    onChange={(e) => handleEditEmailChange(idx, e.target.value)}
                              className={`${styles.input} ${styles.cellInput}`}
                                    placeholder={`Email ${idx + 1}`}
                            />
                                  {editValues.emails.length > 1 && (
                                    <button
                                      type="button"
                                      className={styles.iconButton}
                                      onClick={() => removeEditEmailField(idx)}
                                      aria-label="Supprimer cet email"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button type="button" className={styles.iconButton} onClick={addEditEmailField} aria-label="Ajouter un email">
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className={styles.ellipsis} title={(getEmailList(a).join(", ")) || ""}>
                              {getEmailList(a).join(", ") || "—"}
                            </span>
                          )}
                        </td>
                        <td className={styles.actionsCol}>
                          {editingId === a.nom_automate ? (
                            <div className={styles.actionGroup}>
                              <button
                                type="button"
                                onClick={() => saveEdit(a.nom_automate)}
                                className={`${styles.iconButton} ${styles.primaryGhost}`}
                                data-tooltip="Enregistrer"
                              >
                                {savingId === a.nom_automate ? <Loader2 size={16} className={styles.spin} /> : <Check size={16} />}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className={styles.iconButton}
                                data-tooltip="Annuler"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className={styles.actionGroup}>
                              <button
                                type="button"
                                onClick={() => startEdit(a)}
                                className={`${styles.iconButton} ${styles.primaryGhost}`}
                                data-tooltip="Modifier"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => askDelete(a.nom_automate)}
                                className={`${styles.iconButton} ${styles.dangerGhost}`}
                                data-tooltip="Supprimer"
                                aria-label="Supprimer"
                              >
                                {deletingId === a.nom_automate ? (
                                  <Loader2 size={16} className={styles.spin} />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {pendingDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Confirmation</p>
                <h3 className={styles.cardTitle}>Supprimer l&apos;automate ?</h3>
                <p className={styles.cardHint}>Cette action est définitive pour {pendingDelete}.</p>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.button} onClick={() => setPendingDelete(null)}>
                <X size={16} />
                Annuler
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={confirmDelete}
                disabled={deletingId === pendingDelete}
              >
                {deletingId === pendingDelete ? <Loader2 size={16} className={styles.spin} /> : <Trash2 size={16} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
