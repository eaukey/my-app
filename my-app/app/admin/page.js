// Nouvelle page Admin Automates
"use client";

import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const BACKEND_URL = "https://backend-eaukey.duckdns.org";

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [automates, setAutomates] = useState([]);
  const [form, setForm] = useState({ nom_automate: "", client: "", lieu: "" });
  const [error, setError] = useState("");

  const isAdmin = user && (user["https://app.com/role"] || user.role) === "admin";

  // Charge la liste
  const fetchAutomates = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/recherche/automate_LCA`);
      const data = await res.json();
      setAutomates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la récupération des automates");
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
    try {
      const res = await fetch(`${BACKEND_URL}/automate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      setForm({ nom_automate: "", client: "", lieu: "" });
      fetchAutomates();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (nom) => {
    if (!confirm(`Supprimer l'automate ${nom} ?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/automate/${nom}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      fetchAutomates();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1>Gestion des automates</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Formulaire d'ajout */}
      <form onSubmit={handleAdd} style={{ marginBottom: "24px" }}>
        <input
          name="nom_automate"
          value={form.nom_automate}
          onChange={handleChange}
          placeholder="Nom automate"
          required
          style={{ marginRight: 8 }}
        />
        <input
          name="client"
          value={form.client}
          onChange={handleChange}
          placeholder="Client"
          required
          style={{ marginRight: 8 }}
        />
        <input
          name="lieu"
          value={form.lieu}
          onChange={handleChange}
          placeholder="Lieu"
          required
          style={{ marginRight: 8 }}
        />
        <button type="submit">Ajouter</button>
      </form>

      {/* Tableau */}
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: 4 }}>Nom automate</th>
            <th style={{ border: "1px solid #ccc", padding: 4 }}>Client</th>
            <th style={{ border: "1px solid #ccc", padding: 4 }}>Lieu</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {automates.map((a) => (
            <tr key={a.nom_automate}>
              <td style={{ border: "1px solid #ccc", padding: 4 }}>{a.nom_automate}</td>
              <td style={{ border: "1px solid #ccc", padding: 4 }}>{a.client}</td>
              <td style={{ border: "1px solid #ccc", padding: 4 }}>{a.lieu}</td>
              <td style={{ border: "1px solid #ccc", padding: 4 }}>
                <button onClick={() => handleDelete(a.nom_automate)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}