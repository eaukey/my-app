// Nouvelle page Admin Automates
"use client";

import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Home, BarChart2, Settings, MessageCircle, FileText, Table } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import styles from "./AdminMobile.module.css";

const BACKEND_URL = "https://backend-eaukey.duckdns.org";

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const [automates, setAutomates] = useState([]);
  const [form, setForm] = useState({ nom_automate: "", client: "", lieu: "" });
  const [error, setError] = useState("");
  const pathname = usePathname();

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
    <div className="flex h-screen bg-gray-50">
      {/* Barre de navigation interne supprimée: s'appuie sur la side nav globale du layout */}

      {/* Contenu principal */}
      <div className={`flex-1 p-8 overflow-y-auto ${styles.mainFull || ''}`}>
        <h1>Gestion des automates</h1>

        {error && <p style={{ color: "red" }}>{error}</p>}

        {/* Formulaire d'ajout */}
        <form onSubmit={handleAdd} className={styles.form}>
          <input
            name="nom_automate"
            value={form.nom_automate}
            onChange={handleChange}
            placeholder="Nom automate"
            required
            className={styles.input}
          />
          <input
            name="client"
            value={form.client}
            onChange={handleChange}
            placeholder="Client"
            required
            className={styles.input}
          />
          <input
            name="lieu"
            value={form.lieu}
            onChange={handleChange}
            placeholder="Lieu"
            required
            className={styles.input}
          />
          <button type="submit" className={styles.button}>Ajouter</button>
        </form>

        {/* Tableau */}
        <div className={styles.tableWrapper}>
          <table className={styles.table} style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th className={styles.th} style={{ border: "1px solid #ccc", padding: 4 }}>Nom automate</th>
                <th className={styles.th} style={{ border: "1px solid #ccc", padding: 4 }}>Client</th>
                <th className={styles.th} style={{ border: "1px solid #ccc", padding: 4 }}>Lieu</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {automates.map((a) => (
                <tr key={a.nom_automate}>
                  <td className={styles.td} style={{ border: "1px solid #ccc", padding: 4 }}>{a.nom_automate}</td>
                  <td className={styles.td} style={{ border: "1px solid #ccc", padding: 4 }}>{a.client}</td>
                  <td className={styles.td} style={{ border: "1px solid #ccc", padding: 4 }}>{a.lieu}</td>
                  <td className={styles.td} style={{ border: "1px solid #ccc", padding: 4 }}>
                    <button onClick={() => handleDelete(a.nom_automate)} className={styles.button}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}