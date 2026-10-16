"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import PanneWizard, { fmt } from "./PanneWizard";
import styles from "./Pannes.module.css";

const TAB_OPTIONS = [
  { key: "in_progress", label: "En cours" },
  { key: "resolved", label: "Résolues" },
  { key: "all", label: "Toutes" },
];

export default function PannesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [pannes, setPannes] = useState([]);
  const [stations, setStations] = useState([]);
  const [panneTypes, setPanneTypes] = useState([]);
  const [activeTab, setActiveTab] = useState("in_progress");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // { mode: "create" | "close" | "edit", panne?: object }
  const [wizard, setWizard] = useState(null);

  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);

  const getJson = useCallback(
    async (path) => {
      const res = await authFetch(`${API_BASE}${path}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [authFetch, headers]
  );

  const fetchPannes = useCallback(async () => {
    try {
      const data = await getJson("/pannes");
      setPannes(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des pannes");
    }
  }, [getJson]);

  const fetchRefs = useCallback(async () => {
    try {
      const [st, types] = await Promise.all([getJson("/recherche/automate_LCA"), getJson("/pannes/types")]);
      const list = (Array.isArray(st) ? st : [])
        .filter((s) => s && s.client && s.lieu && s.nom_automate)
        .map(({ client, lieu, nom_automate, numero_automate }) => ({ client, lieu, nom_automate, numero_automate }))
        .sort((a, b) => `${a.client} ${a.lieu}`.localeCompare(`${b.client} ${b.lieu}`, "fr", { sensitivity: "base" }));
      setStations(list);
      setPanneTypes((Array.isArray(types) ? types : []).map((t) => String(t).trim()).filter(Boolean));
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des stations");
    }
  }, [getJson]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    fetchPannes();
    fetchRefs();
  }, [isAuthenticated, isAdmin, fetchPannes, fetchRefs]);

  const save = async (payload) => {
    const isNew = wizard.mode === "create";
    const res = await authFetch(`${API_BASE}/pannes${isNew ? "" : `/${wizard.panne.id}`}`, {
      method: isNew ? "POST" : "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    await res.json();
    setNotice(wizard.mode === "close" ? "Panne clôturée ✓" : isNew ? "Panne enregistrée ✓" : "Panne modifiée ✓");
    setWizard(null);
    if (isNew && !payload.date_fin) setActiveTab("in_progress");
    fetchPannes();
    fetchRefs();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Supprimer la panne « ${p.panne} » de ${p.client} — ${p.lieu} ?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/pannes/${p.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(await res.text());
      setNotice("Panne supprimée");
      fetchPannes();
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const counts = useMemo(
    () => ({ in_progress: pannes.filter((p) => !p.date_fin).length, resolved: pannes.filter((p) => p.date_fin).length, all: pannes.length }),
    [pannes]
  );

  const filtered = useMemo(() => {
    const base = activeTab === "resolved" ? pannes.filter((p) => p.date_fin) : activeTab === "in_progress" ? pannes.filter((p) => !p.date_fin) : pannes;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return base;
    return base.filter((p) =>
      [p.client, p.lieu, p.nom_automate, p.panne, p.probleme, p.cause, p.action_realisee, p.pieces_changees, p.intervenant, p.created_by]
        .some((v) => String(v || "").toLowerCase().includes(term))
    );
  }, [activeTab, pannes, searchTerm]);

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) {
    router.replace("/");
    return null;
  }
  if (!isAdmin) return <p>Accès refusé.</p>;

  return (
    <div className={styles.container}>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {wizard ? (
        <div className={styles.section}>
          <PanneWizard
            key={`${wizard.mode}-${wizard.panne?.id || "new"}`}
            mode={wizard.mode}
            panne={wizard.panne}
            stations={stations}
            panneTypes={panneTypes}
            currentUser={user?.email || ""}
            onSubmit={save}
            onCancel={() => setWizard(null)}
          />
        </div>
      ) : (
        <button type="button" className={styles.ctaButton} onClick={() => setWizard({ mode: "create" })}>
          <Plus size={20} />
          <span>Signaler une panne</span>
        </button>
      )}

      <div className={styles.section}>
        <div className={styles.listHead}>
          <div className={styles.tabs}>
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            ))}
          </div>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              className={styles.searchInput}
              placeholder="Rechercher (station, client, panne, cause…)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.cards}>
          {filtered.length === 0 ? <div className={styles.muted}>Aucune panne</div> : null}
          {filtered.map((p) => {
            const open = !p.date_fin;
            const hasResolution = p.cause || p.action_realisee || p.pieces_changees || p.deplacement != null;
            return (
              <div key={p.id} className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
                <div className={styles.cardTitle}>{p.client} — {p.lieu}</div>
                <div className={styles.cardMeta}>
                  <span className={`${styles.pill} ${open ? styles.pillOpen : styles.pillDone}`}>{open ? "En cours" : "Résolue"}</span>
                  <span className={styles.pill}>{p.panne}</span>
                  <span>{open ? `depuis le ${fmt(p.date_debut)}` : `du ${fmt(p.date_debut)} au ${fmt(p.date_fin)}`}</span>
                </div>
                <div className={styles.cardBody}>{p.probleme}</div>
                {hasResolution ? (
                  <div className={styles.resolution}>
                    {p.cause ? <div><strong>Cause :</strong> {p.cause}</div> : null}
                    {p.action_realisee ? <div><strong>Action :</strong> {p.action_realisee}</div> : null}
                    {p.pieces_changees ? <div><strong>Pièces :</strong> {p.pieces_changees}</div> : null}
                    {p.deplacement != null ? <div><strong>Déplacement :</strong> {p.deplacement ? "sur place" : "à distance"}</div> : null}
                  </div>
                ) : !open ? (
                  <div className={styles.muted}>Résolution non renseignée</div>
                ) : null}
                <div className={styles.cardFoot}>
                  <span className={styles.cardWho}>{p.intervenant || p.created_by || ""}</span>
                  <div className={styles.actionGroup}>
                    {open || !hasResolution ? (
                      <button type="button" className={styles.resolveButton} onClick={() => setWizard({ mode: "close", panne: p })}>
                        <CheckCircle2 size={16} />
                        <span>{open ? "Résolue" : "Compléter"}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.primaryGhost}`}
                      onClick={() => setWizard({ mode: "edit", panne: p })}
                      aria-label="Modifier"
                      data-tooltip="Modifier"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.dangerGhost}`}
                      onClick={() => handleDelete(p)}
                      aria-label="Supprimer"
                      data-tooltip="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
