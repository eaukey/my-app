"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Archive, ArchiveRestore, X, Sparkles, Send } from "lucide-react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import { fmt } from "../pannes/PanneWizard";
import styles from "../pannes/Pannes.module.css";

// Base SAV : fiches de dépannage écrites par l'équipe SAV (admins).
// Les fiches actives sont jointes automatiquement aux questions posées à
// l'assistant SAV (backend POST /sav/message), sans nom de client ni de station.
// Les brouillons proposés par l'assistant (bouton « Proposer une fiche SAV » d'une
// conversation) ne sont jamais utilisés tant qu'un admin ne les a pas publiés.

const TAB_OPTIONS = [
  { key: "actives", label: "Actives" },
  { key: "archivees", label: "Archivées" },
];

const EMPTY = { titre: "", symptomes: "", solution: "", pieces: "", type_panne: "", mots_cles: "", archivee: false };

function FicheForm({ initial, panneTypes, onSubmit, onCancel }) {
  const [data, setData] = useState(() => {
    const d = { ...EMPTY };
    Object.keys(EMPTY).forEach((k) => {
      if (initial?.[k] != null) d[k] = initial[k];
    });
    return d;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => {
    setData((d) => ({ ...d, ...patch }));
    setError("");
  };
  const isNew = !initial?.id;
  const isDraft = !!initial?.brouillon;

  const submit = async (e) => {
    e.preventDefault();
    if (!data.titre.trim() || !data.solution.trim()) {
      setError("Le problème et la solution sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { titre, symptomes, solution, pieces, type_panne, mots_cles, archivee } = data;
      await onSubmit({ titre, symptomes, solution, pieces, type_panne, mots_cles, archivee });
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement");
      setSaving(false);
    }
  };

  return (
    <form className={styles.wizard} onSubmit={submit}>
      <div className={styles.wizardHead}>
        <div className={styles.wizardTitle}>
          {isNew ? "Nouvelle fiche" : isDraft ? "Relire le brouillon" : "Modifier la fiche"}
          <span className={styles.wizardSub}>
            {isDraft
              ? "Proposé par l'assistant : pas encore utilisé. Vérifiez chaque étape, puis publiez-le."
              : "Utilisée automatiquement par l'assistant SAV"}
          </span>
        </div>
        <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="Fermer" disabled={saving}>
          <X size={18} />
        </button>
      </div>
      <div className={styles.step} style={{ marginTop: 12 }}>
        <label className={styles.stepBlock}>
          <span className={styles.fieldLabel}>Problème *</span>
          <input
            className={styles.input}
            name="titre"
            placeholder="Ex : Pression filtre trop haute"
            value={data.titre}
            maxLength={200}
            onChange={(e) => set({ titre: e.target.value })}
            autoFocus
          />
        </label>
        <label className={styles.stepBlock}>
          <span className={styles.fieldLabel}>Symptômes (ce que voit le client ou le technicien)</span>
          <textarea
            className={styles.textarea}
            name="symptomes"
            placeholder="Ex : la pression reste au-dessus de 2 bars après un contre-lavage"
            value={data.symptomes}
            maxLength={4000}
            onChange={(e) => set({ symptomes: e.target.value })}
          />
        </label>
        <label className={styles.stepBlock}>
          <span className={styles.fieldLabel}>Solution, étape par étape *</span>
          <textarea
            className={styles.textarea}
            name="solution"
            style={{ minHeight: 160 }}
            placeholder={"1. Vérifier la crépine\n2. Relancer un contre-lavage manuel\n3. Si ça persiste, changer le joint…"}
            value={data.solution}
            maxLength={8000}
            onChange={(e) => set({ solution: e.target.value })}
          />
        </label>
        <div className={styles.formGrid}>
          <label className={styles.stepBlock}>
            <span className={styles.fieldLabel}>Pièces concernées</span>
            <input
              className={styles.input}
              name="pieces"
              placeholder="Ex : joint KVC"
              value={data.pieces}
              maxLength={1000}
              onChange={(e) => set({ pieces: e.target.value })}
            />
          </label>
          <label className={styles.stepBlock}>
            <span className={styles.fieldLabel}>Type de panne</span>
            <input
              className={styles.input}
              name="type_panne"
              list="sav-types"
              placeholder="Ex : Filtre colmaté"
              value={data.type_panne}
              maxLength={200}
              onChange={(e) => set({ type_panne: e.target.value })}
            />
            <datalist id="sav-types">
              {panneTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
        </div>
        <label className={styles.stepBlock}>
          <span className={styles.fieldLabel}>Mots-clés (autres façons de décrire le problème)</span>
          <input
            className={styles.input}
            name="mots_cles"
            placeholder="Ex : manomètre, colmatage, filtre bouché"
            value={data.mots_cles}
            maxLength={500}
            onChange={(e) => set({ mots_cles: e.target.value })}
          />
        </label>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.stepActions}>
          <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={onCancel} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className={styles.button} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function BaseSavPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [fiches, setFiches] = useState([]);
  const [panneTypes, setPanneTypes] = useState([]);
  const [activeTab, setActiveTab] = useState("actives");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // null | { fiche?: object }
  const [form, setForm] = useState(null);

  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);

  const call = useCallback(
    async (path, options = {}) => {
      const res = await authFetch(`${API_BASE}${path}`, { headers, ...options });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [authFetch, headers]
  );

  const fetchFiches = useCallback(async () => {
    try {
      const data = await call("/sav/fiches");
      setFiches(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e.message || "Erreur lors du chargement des fiches");
    }
  }, [call]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    fetchFiches();
    call("/pannes/types")
      .then((types) => setPanneTypes((Array.isArray(types) ? types : []).map((t) => String(t).trim()).filter(Boolean)))
      .catch(() => {});
  }, [isAuthenticated, isAdmin, fetchFiches, call]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const save = async (payload) => {
    const id = form?.fiche?.id;
    await call(id ? `/sav/fiches/${id}` : "/sav/fiches", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    setNotice(
      form?.fiche?.brouillon
        ? "Brouillon modifié ✓ — publiez-le pour que l'assistant l'utilise"
        : id
        ? "Fiche modifiée ✓"
        : "Fiche ajoutée ✓ — l'assistant SAV l'utilise dès maintenant"
    );
    setForm(null);
    if (!id) setActiveTab("actives");
    fetchFiches();
  };

  const toggleArchive = async (f) => {
    try {
      const { titre, symptomes, solution, pieces, type_panne, mots_cles } = f;
      await call(`/sav/fiches/${f.id}`, {
        method: "PUT",
        body: JSON.stringify({ titre, symptomes, solution, pieces, type_panne, mots_cles, archivee: !f.archivee }),
      });
      setNotice(f.archivee ? "Fiche réactivée" : "Fiche archivée : l'assistant ne l'utilise plus");
      fetchFiches();
    } catch (e) {
      setError(e.message || "Erreur lors de l'archivage");
    }
  };

  const publish = async (f) => {
    try {
      const { titre, symptomes, solution, pieces, type_panne, mots_cles } = f;
      await call(`/sav/fiches/${f.id}`, {
        method: "PUT",
        body: JSON.stringify({ titre, symptomes, solution, pieces, type_panne, mots_cles, archivee: false, brouillon: false }),
      });
      setNotice("Fiche publiée ✓ — l'assistant SAV l'utilise dès maintenant");
      setActiveTab("actives");
      fetchFiches();
    } catch (e) {
      setError(e.message || "Erreur lors de la publication");
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Supprimer définitivement la fiche « ${f.titre} » ?`)) return;
    try {
      await call(`/sav/fiches/${f.id}`, { method: "DELETE" });
      setNotice("Fiche supprimée");
      fetchFiches();
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  const counts = useMemo(
    () => ({
      actives: fiches.filter((f) => !f.brouillon && !f.archivee).length,
      archivees: fiches.filter((f) => !f.brouillon && f.archivee).length,
    }),
    [fiches]
  );
  const brouillons = useMemo(() => fiches.filter((f) => f.brouillon), [fiches]);

  const filtered = useMemo(() => {
    const base = fiches.filter((f) => !f.brouillon && (activeTab === "archivees" ? f.archivee : !f.archivee));
    const term = searchTerm.toLowerCase().trim();
    if (!term) return base;
    return base.filter((f) =>
      [f.titre, f.symptomes, f.solution, f.pieces, f.type_panne, f.mots_cles, f.created_by]
        .some((v) => String(v || "").toLowerCase().includes(term))
    );
  }, [activeTab, fiches, searchTerm]);

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

      {brouillons.length > 0 ? (
        <div className={styles.section} data-testid="brouillons">
          <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={18} />
            Brouillons proposés par l&apos;assistant ({brouillons.length})
          </div>
          <div className={styles.muted} style={{ fontStyle: "normal", marginBottom: 12 }}>
            Rédigés par l&apos;assistant à partir d&apos;une conversation. Ils ne sont pas utilisés tant que vous ne les avez pas
            relus et publiés.
          </div>
          <div className={styles.cards}>
            {brouillons.map((f) => (
              <div key={f.id} className={`${styles.card} ${styles.cardOpen}`}>
                <div className={styles.cardTitle}>{f.titre}</div>
                <div className={styles.cardMeta}>
                  <span className={`${styles.pill} ${styles.pillOpen}`}>Brouillon</span>
                  {f.type_panne ? <span className={styles.pill}>{f.type_panne}</span> : null}
                </div>
                {f.symptomes ? <div className={styles.cardBody}>{f.symptomes}</div> : null}
                <div className={styles.resolution}>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    <strong>Solution :</strong> {f.solution}
                  </div>
                  {f.pieces ? (
                    <div>
                      <strong>Pièces :</strong> {f.pieces}
                    </div>
                  ) : null}
                </div>
                <div className={styles.cardFoot} style={{ flexWrap: "wrap" }}>
                  <span className={styles.cardWho}>
                    Proposé par l&apos;assistant · {fmt(f.created_at)}
                    {f.updated_by ? ` · relu par ${f.updated_by}` : ""}
                  </span>
                  <div className={styles.actionGroup}>
                    <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={() => setForm({ fiche: f })}>
                      <Pencil size={16} />
                      <span>Relire</span>
                    </button>
                    <button type="button" className={styles.button} onClick={() => publish(f)}>
                      <Send size={16} />
                      <span>Publier</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.dangerGhost}`}
                      onClick={() => handleDelete(f)}
                      aria-label="Supprimer"
                      data-tooltip="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {form ? (
        <div className={styles.section}>
          <FicheForm
            key={form.fiche?.id || "new"}
            initial={form.fiche}
            panneTypes={panneTypes}
            onSubmit={save}
            onCancel={() => setForm(null)}
          />
        </div>
      ) : (
        <button type="button" className={styles.ctaButton} onClick={() => setForm({})}>
          <Plus size={20} />
          <span>Nouvelle fiche</span>
        </button>
      )}

      <div className={styles.section}>
        <div className={styles.muted} style={{ fontStyle: "normal", marginBottom: 12 }}>
          Chaque fiche active est utilisée automatiquement par l&apos;assistant SAV quand un client décrit un problème proche.
          Les pannes résolues partagées servent aussi.
        </div>
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
              placeholder="Rechercher (problème, solution, pièce…)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.cards}>
          {filtered.length === 0 ? (
            <div className={styles.muted}>{fiches.length === 0 ? "Aucune fiche pour l'instant : ajoutez la première !" : "Aucune fiche"}</div>
          ) : null}
          {filtered.map((f) => (
            <div key={f.id} className={styles.card}>
              <div className={styles.cardTitle}>{f.titre}</div>
              {f.type_panne || f.archivee ? (
                <div className={styles.cardMeta}>
                  {f.archivee ? <span className={styles.pill}>Archivée</span> : null}
                  {f.type_panne ? <span className={styles.pill}>{f.type_panne}</span> : null}
                </div>
              ) : null}
              {f.symptomes ? <div className={styles.cardBody}>{f.symptomes}</div> : null}
              <div className={styles.resolution}>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  <strong>Solution :</strong> {f.solution}
                </div>
                {f.pieces ? (
                  <div>
                    <strong>Pièces :</strong> {f.pieces}
                  </div>
                ) : null}
              </div>
              <div className={styles.cardFoot}>
                <span className={styles.cardWho}>
                  {f.updated_by || f.created_by} · {fmt(f.updated_at)}
                </span>
                <div className={styles.actionGroup}>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.primaryGhost}`}
                    onClick={() => setForm({ fiche: f })}
                    aria-label="Modifier"
                    data-tooltip="Modifier"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => toggleArchive(f)}
                    aria-label={f.archivee ? "Réactiver" : "Archiver"}
                    data-tooltip={f.archivee ? "Réactiver" : "Archiver"}
                  >
                    {f.archivee ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.dangerGhost}`}
                    onClick={() => handleDelete(f)}
                    aria-label="Supprimer"
                    data-tooltip="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
