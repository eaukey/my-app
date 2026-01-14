"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function PannesPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const appRole = user?.["https://app.com/role"] || user?.role;
  const roles = user?.["https://app.com/roles"] || user?.roles;
  const isAdmin = appRole === "admin" || (Array.isArray(roles) && roles.includes("admin"));

  const [form, setForm] = useState(emptyForm);
  const [clients, setClients] = useState([]);
  const [stations, setStations] = useState([]);
  const [pannes, setPannes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const baseHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-user-role": isAdmin ? "admin" : "",
      "x-user-email": user?.email || "",
    }),
    [isAdmin, user?.email]
  );

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_BASE}/pannes/clients`, { headers: baseHeaders });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setError("");
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des clients");
    }
  };

  const fetchStations = async (client) => {
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
  };

  const fetchAutomate = async (client, lieu) => {
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
  };

  const fetchPannes = async () => {
    try {
      const res = await fetch(`${API_BASE}/pannes`, { headers: baseHeaders });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setError("");
      setPannes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des pannes");
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    fetchClients();
    fetchPannes();
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!form.client || !isAdmin) return;
    setForm((prev) => ({ ...prev, lieu: "", nom_automate: "" }));
    fetchStations(form.client);
  }, [form.client, isAdmin]);

  useEffect(() => {
    if (form.client && form.lieu && isAdmin) {
      fetchAutomate(form.client, form.lieu);
    }
  }, [form.client, form.lieu, isAdmin]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toIso = (value) => (value ? new Date(value).toISOString() : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.client || !form.lieu || !form.nom_automate || !form.panne || !form.probleme || !form.date_debut) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (form.date_fin && new Date(form.date_fin) < new Date(form.date_debut)) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        client: form.client,
        lieu: form.lieu,
        nom_automate: form.nom_automate,
        panne: form.panne,
        probleme: form.probleme,
        date_debut: toIso(form.date_debut),
        date_fin: form.date_fin ? toIso(form.date_fin) : null,
      };
      const res = await fetch(`${API_BASE}/pannes`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setForm(emptyForm);
      fetchPannes();
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
              <label>Panne *</label>
              <input
                name="panne"
                value={form.panne}
                onChange={handleChange}
                className={styles.input}
                placeholder="Titre court"
                required
              />
            </div>
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
              <input
                type="datetime-local"
                name="date_fin"
                value={form.date_fin}
                onChange={handleChange}
                className={styles.input}
              />
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
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.section}>
        <div className={styles.title}>Pannes existantes</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Client</th>
                <th className={styles.th}>Station</th>
                <th className={styles.th}>Automate</th>
                <th className={styles.th}>Panne</th>
                <th className={styles.th}>Début</th>
                <th className={styles.th}>Fin</th>
                <th className={styles.th}>Problème</th>
                <th className={styles.th}>Créé par</th>
                <th className={styles.th}>Créé le</th>
                <th className={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pannes.length === 0 ? (
                <tr>
                  <td className={styles.td} colSpan={10}>Aucune panne</td>
                </tr>
              ) : (
                pannes.map((p) => (
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
                      <button className={styles.button} onClick={() => handleDelete(p.id)}>Supprimer</button>
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

