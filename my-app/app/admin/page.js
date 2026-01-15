"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Edit, Save, X, Search, Plus, Loader2, Trash2, Check } from "lucide-react";
import styles from "./AdminMobile.module.css";

const BACKEND_URL = "https://backend-eaukey.duckdns.org";

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [automates, setAutomates] = useState([]);
  const [form, setForm] = useState({ nom_automate: "", client: "", lieu: "", email: "" });
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ client: "", lieu: "", email: "" });
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
      const trimmedEmail = (form.email || "").trim();
      if (trimmedEmail !== "") {
        payload.email = trimmedEmail;
      }
      const res = await fetch(`${BACKEND_URL}/automate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      setForm({ nom_automate: "", client: "", lieu: "", email: "" });
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
    setEditValues({ client: a.client || "", lieu: a.lieu || "", email: a.email || "" });
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ client: "", lieu: "", email: "" });
  };

  const saveEdit = async (nom) => {
    try {
      setSavingId(nom);
      setError("");
      const trimmedEmail = (editValues.email || "").trim();
      const payload = {
        client: editValues.client,
        lieu: editValues.lieu,
        email: trimmedEmail === "" ? null : trimmedEmail,
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
      const normalizedEmail = payload.email ?? "";
      setAutomates((prev) =>
        prev.map((it) =>
          it.nom_automate === nom ? { ...it, client: editValues.client, lieu: editValues.lieu, email: normalizedEmail } : it
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
      [a.nom_automate, a.client, a.lieu, a.email].some((v) => (v || "").toLowerCase().includes(term))
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
              <span className={styles.label}>Email (optionnel)</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="contact@email.com"
                className={styles.input}
              />
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
                            <input
                              type="email"
                              value={editValues.email ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))}
                              className={`${styles.input} ${styles.cellInput}`}
                            />
                          ) : (
                            <span className={styles.ellipsis} title={a.email || ""}>
                              {a.email || "—"}
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
