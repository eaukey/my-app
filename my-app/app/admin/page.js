// Nouvelle page Admin Automates
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Edit,
  Save,
  X,
  Trash2,
  Search,
  Filter,
  Loader2,
  Check,
  AlertCircle,
  Plus,
} from "lucide-react";
import styles from "./AdminMobile.module.css";

const BACKEND_URL = "https://backend-eaukey.duckdns.org";

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [automates, setAutomates] = useState([]);
  const [form, setForm] = useState({ nom_automate: "", client: "", lieu: "", email: "" });
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // État d'édition inline
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ client: "", lieu: "", email: "" });

  const isAdmin = user && (user["https://app.com/role"] || user.role) === "admin";

  // Charge la liste
  const fetchAutomates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/recherche/automate_LCA`);
      const data = await res.json();
      setAutomates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la récupération des automates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomates();
  }, []);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated || !isAdmin) return <p>Accès refusé.</p>;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        nom_automate: form.nom_automate,
        client: form.client,
        lieu: form.lieu
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
      setSubmitting(false);
    }
  };

  const requestDelete = (automate) => setPendingDelete(automate);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/automate/${pendingDelete.nom_automate}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      fetchAutomates();
    } catch (err) {
      setError(err.message);
    } finally {
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
      setError("");
      const trimmedEmail = (editValues.email || "").trim();
      const payload = {
        client: editValues.client,
        lieu: editValues.lieu,
        email: trimmedEmail === "" ? null : trimmedEmail
      };
      const res = await fetch(`${BACKEND_URL}/automate/${encodeURIComponent(nom)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erreur ${res.status}: ${txt || 'échec de la mise à jour'}`);
      }
      // Mise à jour locale de la ligne sans refetch global
      const normalizedEmail = payload.email ?? "";
      setAutomates((prev) => prev.map((it) => it.nom_automate === nom ? { ...it, client: editValues.client, lieu: editValues.lieu, email: normalizedEmail } : it));
      cancelEdit();
    } catch (e) {
      setError(e.message);
    }
  };

  const clientOptions = useMemo(() => {
    const set = new Set();
    automates.forEach((a) => {
      if (a.client) set.add(a.client);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [automates]);

  const filteredAutomates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return automates.filter((a) => {
      const matchesClient = filterClient === "all" || (a.client || "").toLowerCase() === filterClient.toLowerCase();
      const matchesSearch =
        term === "" ||
        [a.nom_automate, a.client, a.lieu, a.email]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(term));
      return matchesClient && matchesSearch;
    });
  }, [automates, filterClient, searchTerm]);

  return (
    <div className={styles.screen}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.kicker}>Administration</p>
            <h1 className={styles.pageTitle}>Gestion des automates</h1>
            <p className={styles.pageSubtitle}>Ajout, édition et suppression des automates</p>
          </div>
          <div className={styles.headerBadge}>
            <Check size={16} />
            <span>{automates.length} automates suivis</span>
          </div>
        </header>

        {error && (
          <div className={styles.alert}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardKicker}>Ajout rapide</p>
              <h2 className={styles.cardTitle}>Ajouter un automate</h2>
              <p className={styles.cardDescription}>Renseignez les informations pour créer un nouvel automate.</p>
            </div>
            <div className={styles.badgeMuted}>
              <Plus size={16} />
              <span>Création</span>
            </div>
          </div>
          <form onSubmit={handleAdd} className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Nom automate</span>
              <input
                name="nom_automate"
                value={form.nom_automate}
                onChange={handleChange}
                placeholder="Ex : 20240714.0"
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
                placeholder="Ex : Albertini"
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
                placeholder="Ex : Sorbo - Ocagnano"
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
                placeholder="client@email.com"
                className={styles.input}
              />
            </label>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className={styles.spin} size={16} /> Ajout...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Ajouter
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardKicker}>Inventaire</p>
              <h2 className={styles.cardTitle}>Liste des automates</h2>
              <p className={styles.cardDescription}>Recherche, édition et suppression des automates existants.</p>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.searchBox}>
                <Search size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher (nom, client, lieu, email)"
                />
              </div>
              <div className={styles.filter}>
                <Filter size={14} />
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">Tous les clients</option>
                  {clientOptions.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.counter}>{filteredAutomates.length} automates</div>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Nom automate</th>
                    <th className={styles.th}>Client</th>
                    <th className={styles.th}>Lieu</th>
                    <th className={styles.th}>Email</th>
                    <th className={styles.th} style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && automates.length === 0 && (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className={styles.skeletonRow}>
                        <td colSpan={5}>
                          <div className={styles.skeletonBar} />
                        </td>
                      </tr>
                    ))
                  )}

                  {!loading && filteredAutomates.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>–</div>
                          <div>
                            <p className={styles.emptyTitle}>Aucun automate trouvé</p>
                            <p className={styles.emptyText}>Ajoutez un automate ou modifiez votre recherche.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredAutomates.map((a) => (
                    <tr key={a.nom_automate} className={styles.row}>
                      <td className={styles.td}>{a.nom_automate}</td>
                      <td className={styles.td}>
                        {editingId === a.nom_automate ? (
                          <input
                            value={editValues.client}
                            onChange={(e) => setEditValues((v) => ({ ...v, client: e.target.value }))}
                            className={styles.input}
                          />
                        ) : (
                          a.client
                        )}
                      </td>
                      <td className={styles.td}>
                        {editingId === a.nom_automate ? (
                          <input
                            value={editValues.lieu}
                            onChange={(e) => setEditValues((v) => ({ ...v, lieu: e.target.value }))}
                            className={styles.input}
                          />
                        ) : (
                          a.lieu
                        )}
                      </td>
                      <td className={styles.td}>
                        {editingId === a.nom_automate ? (
                          <input
                            type="email"
                            value={editValues.email ?? ""}
                            onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))}
                            className={styles.input}
                          />
                        ) : (
                          <span title={a.email || ""} className={styles.ellipsis}>
                            {a.email || "—"}
                          </span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actionsRow}>
                          {editingId === a.nom_automate ? (
                            <>
                              <button onClick={() => saveEdit(a.nom_automate)} className={styles.iconButton} title="Enregistrer">
                                <Save size={16} />
                              </button>
                              <button onClick={cancelEdit} className={styles.iconButton} title="Annuler">
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(a)} className={styles.iconButton} title="Modifier">
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => requestDelete(a)}
                                className={`${styles.iconButton} ${styles.dangerGhost}`}
                                title="Supprimer"
                                aria-label="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
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
              <AlertCircle size={18} />
              <span>Confirmer la suppression</span>
            </div>
            <p className={styles.modalText}>
              Voulez-vous vraiment supprimer l&apos;automate <strong>{pendingDelete.nom_automate}</strong> ?
            </p>
            <div className={styles.modalActions}>
              <button onClick={() => setPendingDelete(null)} className={styles.secondaryButton}>Annuler</button>
              <button onClick={confirmDelete} className={styles.dangerButton}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}