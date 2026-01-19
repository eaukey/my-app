"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE } from "../../lib/apiBase";
import styles from "./Pannes.module.css";

const emptyForm = {
  client: "",
  lieu: "",
  nom_automate: "",
  panne: "",
  probleme: "",
  date_debut: "",
  date_fin: "",
};

const TAB_OPTIONS = [
  { key: "in_progress", label: "Pannes en cours" },
  { key: "resolved", label: "Pannes résolues" },
  { key: "all", label: "Toutes les pannes" },
];

export default function PannesPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const appRole = user?.["https://app.com/role"] || user?.role;
  const roles = user?.["https://app.com/roles"] || user?.roles;
  const isAdmin = appRole === "admin" || (Array.isArray(roles) && roles.includes("admin"));

  const [form, setForm] = useState(emptyForm);
  const [clients, setClients] = useState([]);
  const [stations, setStations] = useState([]);
  const [panneTypes, setPanneTypes] = useState([]);
  const [customPanneType, setCustomPanneType] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [pannes, setPannes] = useState([]);
  const [activeTab, setActiveTab] = useState("in_progress");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const NEW_PANNE_VALUE = "__NEW_PANNE__";

  const baseHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-user-role": isAdmin ? "admin" : "",
      "x-user-email": user?.email || "",
    }),
    [isAdmin, user?.email]
  );

  const fetchPanneTypes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pannes/types`, { headers: baseHeaders });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list = Array.isArray(data) ? data.filter(Boolean).map((s) => String(s).trim()).filter(Boolean) : [];
      list.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      setError("");
      setPanneTypes(list);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des types de pannes");
    }
  }, [baseHeaders]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pannes/clients`, { headers: baseHeaders });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setError("");
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des clients");
    }
  }, [baseHeaders]);

  const fetchStations = useCallback(async (client) => {
    if (!client) {
      setStations([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/pannes/stations?client=${encodeURIComponent(client)}`,
        { headers: baseHeaders }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setError("");
      setStations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des stations");
    }
  }, [baseHeaders]);

  const fetchAutomate = useCallback(async (client, lieu) => {
    if (!client || !lieu) return;
    try {
      const res = await fetch(
        `${API_BASE}/pannes/automate?client=${encodeURIComponent(client)}&lieu=${encodeURIComponent(lieu)}`,
        { headers: baseHeaders }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setError("");
      setForm((prev) => ({ ...prev, nom_automate: data?.nom_automate || "" }));
    } catch (e) {
      setError(e.message || "Automate introuvable");
      setForm((prev) => ({ ...prev, nom_automate: "" }));
    }
  }, [baseHeaders]);

  const fetchPannes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pannes`, { headers: baseHeaders });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setError("");
      setPannes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des pannes");
    }
  }, [baseHeaders]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    fetchClients();
    fetchPanneTypes();
    fetchPannes();
  }, [fetchClients, fetchPanneTypes, fetchPannes, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!form.client || !isAdmin) return;
    setForm((prev) => ({ ...prev, lieu: "", nom_automate: "" }));
    fetchStations(form.client);
  }, [fetchStations, form.client, isAdmin]);

  useEffect(() => {
    if (form.client && form.lieu && isAdmin) {
      fetchAutomate(form.client, form.lieu);
    }
  }, [fetchAutomate, form.client, form.lieu, isAdmin]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toIso = (value) => (value ? new Date(value).toISOString() : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const isNewType = form.panne === NEW_PANNE_VALUE;
    const panneValue = isNewType ? customPanneType.trim() : form.panne;

    if (!form.client || !form.lieu || !form.nom_automate || !panneValue || !form.probleme || !form.date_debut) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (!inProgress && !form.date_fin) {
      setError("Renseignez une date de fin ou cochez « En cours de traitement ».");
      return;
    }
    if (!inProgress && form.date_fin && new Date(form.date_fin) < new Date(form.date_debut)) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        client: form.client,
        lieu: form.lieu,
        nom_automate: form.nom_automate,
        panne: panneValue,
        probleme: form.probleme,
        date_debut: toIso(form.date_debut),
        date_fin: inProgress ? null : form.date_fin ? toIso(form.date_fin) : null,
      };
      const url = editingId ? `${API_BASE}/pannes/${editingId}` : `${API_BASE}/pannes`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: baseHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setForm(emptyForm);
      setCustomPanneType("");
      setInProgress(false);
      setEditingId(null);
      fetchPannes();
      fetchPanneTypes();
    } catch (e) {
      setError(e.message || "Erreur lors de la création de la panne");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/pannes/${id}`, {
        method: "DELETE",
        headers: baseHeaders,
      });
      if (!res.ok) throw new Error(await res.text());
      setError("");
      fetchPannes();
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  const handleEdit = (p) => {
    if (!p) return;
    setEditingId(p.id);
    setForm({
      client: p.client || "",
      lieu: p.lieu || "",
      nom_automate: p.nom_automate || "",
      panne: p.panne || "",
      probleme: p.probleme || "",
      date_debut: p.date_debut ? new Date(p.date_debut).toISOString().slice(0, 16) : "",
      date_fin: p.date_fin ? new Date(p.date_fin).toISOString().slice(0, 16) : "",
    });
    setCustomPanneType("");
    setInProgress(!p.date_fin);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCustomPanneType("");
    setInProgress(false);
  };

  const filteredPannes = useMemo(() => {
    if (activeTab === "resolved") return pannes.filter((p) => p.date_fin);
    if (activeTab === "in_progress") return pannes.filter((p) => !p.date_fin);
    return pannes;
  }, [activeTab, pannes]);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) return <p>Veuillez vous connecter…</p>;
  if (!isAdmin) return <p>Accès refusé.</p>;

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div className={styles.title}>Créer une panne</div>
        {error ? <div className={styles.error}>{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div>
              <label>Client *</label>
              <select
                name="client"
                value={form.client}
                onChange={handleChange}
                className={styles.select}
                required
              >
                <option value="">Sélectionner</option>
                {clients.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Station *</label>
              <select
                name="lieu"
                value={form.lieu}
                onChange={handleChange}
                className={styles.select}
                disabled={!form.client}
                required
              >
                <option value="">Sélectionner</option>
                {stations.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Automate *</label>
              <input
                name="nom_automate"
                value={form.nom_automate}
                className={styles.input}
                disabled
                placeholder="Auto-rempli"
                required
              />
            </div>
            <div>
              <label>Type de panne *</label>
              <select
                name="panne"
                value={form.panne}
                onChange={handleChange}
                className={styles.select}
                required
              >
                <option value="">Sélectionner</option>
                {panneTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value={NEW_PANNE_VALUE}>Nouvelle panne</option>
              </select>
            </div>
            {form.panne === NEW_PANNE_VALUE ? (
              <div>
                <label>Nouveau type de panne *</label>
                <input
                  name="custom_panne"
                  value={customPanneType}
                  onChange={(e) => setCustomPanneType(e.target.value)}
                  className={styles.input}
                  placeholder="Ex: Capteur pression HS"
                  required
                />
              </div>
            ) : null}
            <div>
              <label>Date début *</label>
              <input
                type="datetime-local"
                name="date_debut"
                value={form.date_debut}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </div>
            <div>
              <label>Date fin</label>
              <div className={styles.inlineField}>
                <input
                  type="datetime-local"
                  name="date_fin"
                  value={form.date_fin}
                  onChange={handleChange}
                  className={styles.input}
                  disabled={inProgress}
                />
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={inProgress}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setInProgress(checked);
                      if (checked) {
                        setForm((prev) => ({ ...prev, date_fin: "" }));
                      }
                    }}
                  />
                  <span>En cours de traitement</span>
                </label>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Problème rencontré *</label>
            <textarea
              name="probleme"
              value={form.probleme}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="Décrivez le problème"
              required
            />
          </div>
        <div className={styles.actions}>
          {editingId ? (
            <>
              <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={cancelEdit} disabled={loading}>
                Annuler
              </button>
              <button type="submit" className={styles.button} disabled={loading}>
                {loading ? "Mise à jour..." : "Mettre à jour"}
              </button>
            </>
          ) : (
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Création..." : "Créer"}
            </button>
          )}
        </div>
        </form>
      </div>

      <div className={styles.section}>
        <div className={styles.titleRow}>
          <div className={styles.tabs}>
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Client</th>
                <th className={styles.th}>Station</th>
                <th className={styles.th}>Automate</th>
                <th className={styles.th}>Type de panne</th>
                <th className={styles.th}>Début</th>
                <th className={styles.th}>Fin</th>
                <th className={styles.th}>Problème</th>
                <th className={styles.th}>Créé par</th>
                <th className={styles.th}>Créé le</th>
                <th className={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPannes.length === 0 ? (
                <tr>
                  <td className={styles.td} colSpan={10}>Aucune panne</td>
                </tr>
              ) : (
                filteredPannes.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.td}>{p.client}</td>
                    <td className={styles.td}>{p.lieu}</td>
                    <td className={styles.td}>{p.nom_automate}</td>
                    <td className={styles.td}>{p.panne}</td>
                    <td className={styles.td}>{p.date_debut ? new Date(p.date_debut).toLocaleString() : ""}</td>
                    <td className={styles.td}>{p.date_fin ? new Date(p.date_fin).toLocaleString() : <span className={styles.pill}>En cours</span>}</td>
                    <td className={styles.td}>{p.probleme}</td>
                    <td className={styles.td}>{p.created_by || "-"}</td>
                    <td className={styles.td}>{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                    <td className={`${styles.td} ${styles.tdActions}`}>
                      <button className={`${styles.iconButton} ${styles.iconButtonEdit}`} onClick={() => handleEdit(p)} title="Modifier">
                        ✏️
                      </button>
                      <button className={`${styles.iconButton} ${styles.iconButtonDelete}`} onClick={() => handleDelete(p.id)} title="Supprimer">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

