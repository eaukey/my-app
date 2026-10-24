"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, EyeOff, Pencil, Droplets, ImageOff } from "lucide-react";
import { useAuth, isSuperAdmin as checkSuperAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import base from "../pannes/Pannes.module.css";
import styles from "./AVerifier.module.css";

// Photos à vérifier (super admins) : file de relecture des notes du modèle de vision.
// Le backend (GET /eau/a_verifier) choisit une photo par station et par heure, parmi :
//   - « alerte »      : le modèle signale un problème (bac vide, MES, indice bas) ;
//   - « incertain »   : le modèle hésite ;
//   - « echantillon » : ~10 % tirées au hasard, notées À L'AVEUGLE (la note du modèle est cachée
//                       jusqu'à ce que l'admin ait donné la sienne) pour mesurer honnêtement l'erreur.
// L'enregistrement passe par la route existante PUT /eau/photo/{id}/validation.

const PERIODES = [
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "3 derniers mois" },
  { value: 365, label: "12 derniers mois" },
];

const MOTIFS = {
  alerte: { label: "Alerte du modèle", cls: "motifAlerte" },
  incertain: { label: "Le modèle hésite", cls: "motifIncertain" },
  echantillon: { label: "Échantillon à l'aveugle", cls: "motifEchantillon" },
};

const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
const indice = (q, o) => (q == null ? null : Math.max(0, Math.min(10, (q + (o == null ? 10 - q : 10 - o)) / 2)));
const lireNote = (s) => {
  if (s === "" || s == null) return null;
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isNaN(v) ? NaN : v;
};
const dateFr = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function AVerifierPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const superAdmin = checkSuperAdmin(user);

  const [jours, setJours] = useState(30);
  const [photos, setPhotos] = useState(null); // null = chargement
  const [restantes, setRestantes] = useState(0);
  const [stats, setStats] = useState(null);
  const [faites, setFaites] = useState(0); // relues pendant cette session
  const passees = useRef(new Set()); // « Passer » : on ne la remontre pas pendant la session
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Saisie (correction ou note à l'aveugle)
  const [mode, setMode] = useState("vue"); // vue | corriger
  const [q, setQ] = useState("");
  const [o, setO] = useState("");
  const [mes, setMes] = useState("");
  const [revele, setRevele] = useState(null); // note à l'aveugle enregistrée : {q, o, bacVide}
  const champQualite = useRef(null);

  const courante = photos && photos.length ? photos[0] : null;
  const aveugle = courante?.motif === "echantillon";

  const chargerStats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/eau/a_verifier/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
  }, [authFetch]);

  const enCours = useRef(false);
  const chargerFile = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const res = await authFetch(`${API_BASE}/eau/a_verifier?jours=${jours}&limit=40`);
      if (!res.ok) throw new Error(res.status === 403 ? "Réservé aux super admins." : `Erreur ${res.status}`);
      const data = await res.json();
      const liste = (data.photos || []).filter((p) => !passees.current.has(p.id));
      setPhotos(liste);
      setRestantes(data.restantes || 0);
      setError("");
    } catch (e) {
      setPhotos([]);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      enCours.current = false;
    }
  }, [authFetch, jours]);

  useEffect(() => {
    if (!isAuthenticated || !superAdmin) return;
    passees.current = new Set();
    setPhotos(null);
    chargerFile();
    chargerStats();
  }, [isAuthenticated, superAdmin, chargerFile, chargerStats]);

  // Nouvelle photo affichée : on remet la saisie à zéro.
  const idCourante = courante?.id;
  useEffect(() => {
    setMessage((m) => (m && m.ok && !m.texte.startsWith("Photo précédente") ? { ok: true, texte: `Photo précédente : ${m.texte}` } : null));
    setMode("vue");
    setRevele(null);
    setQ("");
    setO("");
    setMes("");
  }, [idCourante]);

  useEffect(() => {
    if ((mode === "corriger" || (aveugle && !revele)) && champQualite.current) champQualite.current.focus();
  }, [mode, aveugle, revele, idCourante]);

  // Retire la photo courante de la file locale ; recharge quand il en reste peu.
  const suivante = useCallback(
    (compter = true) => {
      setPhotos((prev) => (prev ? prev.slice(1) : prev));
      if (compter) {
        setFaites((n) => n + 1);
        setRestantes((n) => Math.max(0, n - 1));
      }
      setRevele(null);
    },
    []
  );

  useEffect(() => {
    // Recharge seulement s'il reste côté serveur des photos qui ne sont ni affichées ni « passées ».
    if (photos && photos.length < 5 && restantes - passees.current.size > photos.length) chargerFile();
  }, [photos, restantes, chargerFile]);

  const enregistrer = useCallback(
    async (body, texte) => {
      if (!courante || saving) return false;
      setSaving(true);
      setMessage(null);
      try {
        const res = await authFetch(`${API_BASE}/eau/photo/${courante.id}/validation`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, apply_to_hour: false }),
        });
        if (!res.ok) throw new Error(res.status === 403 ? "Réservé aux super admins." : `Erreur ${res.status}`);
        setMessage({ ok: true, texte });
        chargerStats();
        return true;
      } catch (e) {
        setMessage({ ok: false, texte: e.message || "Enregistrement impossible" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [authFetch, courante, saving, chargerStats]
  );

  const cEstJuste = useCallback(async () => {
    if (await enregistrer({}, "Validé ✓")) suivante();
  }, [enregistrer, suivante]);

  const bacVide = useCallback(
    async (vide) => {
      if (aveugle && !revele) {
        if (await enregistrer({ bac_vide: vide }, vide ? "Noté : bac vide ✓" : "Noté ✓")) setRevele({ bacVide: vide, q: null, o: null });
        return;
      }
      if (await enregistrer({ bac_vide: vide }, vide ? "Marqué : bac vide ✓" : "Marqué : contient de l'eau ✓")) suivante();
    },
    [aveugle, revele, enregistrer, suivante]
  );

  const valeursSaisies = () => {
    const vq = lireNote(q);
    const vo = lireNote(o);
    const vm = lireNote(mes);
    const hors10 = (v) => v != null && (Number.isNaN(v) || v < 0 || v > 10);
    if (hors10(vq) || hors10(vo)) return { erreur: "Qualité et opacité : un nombre entre 0 et 10." };
    if (vm != null && (Number.isNaN(vm) || vm < 0 || vm > 100)) return { erreur: "MES : un pourcentage entre 0 et 100." };
    return { vq, vo, vm };
  };

  const envoyerSaisie = async (e) => {
    e?.preventDefault();
    const { erreur, vq, vo, vm } = valeursSaisies();
    if (erreur) return setMessage({ ok: false, texte: erreur });
    if (aveugle) {
      // Note à l'aveugle : les deux valeurs sont obligatoires (c'est la mesure de l'erreur du modèle).
      if (vq == null || vo == null) return setMessage({ ok: false, texte: "Donnez la qualité et l'opacité." });
      const body = { qualite_eau: vq, opacite: vo, bac_vide: false };
      if (vm != null) body.matiere = vm / 10;
      if (await enregistrer(body, "Note enregistrée ✓")) setRevele({ q: vq, o: vo, bacVide: false });
      return undefined;
    }
    if (vq == null && vo == null && vm == null) return setMessage({ ok: false, texte: "Saisissez au moins une valeur." });
    const body = {};
    if (vq != null) body.qualite_eau = vq;
    if (vo != null) body.opacite = vo;
    if (vm != null) body.matiere = vm / 10; // MES stockée sur /10 côté backend
    if (await enregistrer(body, "Correction enregistrée ✓")) suivante();
    return undefined;
  };

  const passer = useCallback(() => {
    if (!courante) return;
    passees.current.add(courante.id);
    setMessage(null);
    suivante(false);
  }, [courante, suivante]);

  const ouvrirCorrection = useCallback(() => {
    if (!courante) return;
    setQ(courante.pred_qualite != null ? String(courante.pred_qualite) : "");
    setO(courante.pred_opacite != null ? String(courante.pred_opacite) : "");
    setMes(courante.pred_matiere != null ? String(Math.round(courante.pred_matiere * 10)) : "");
    setMode("corriger");
  }, [courante]);

  // Raccourcis : Entrée = c'est juste (ou photo suivante après une note à l'aveugle),
  // C = corriger, → = passer. Désactivés pendant la saisie dans un champ.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!courante || saving) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (revele) suivante();
        else if (!aveugle && mode === "vue") cEstJuste();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (revele) suivante();
        else passer();
      } else if ((e.key === "c" || e.key === "C") && !aveugle && mode === "vue") {
        e.preventDefault();
        ouvrirCorrection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [courante, saving, revele, aveugle, mode, cEstJuste, passer, ouvrirCorrection, suivante]);

  const predIndice = useMemo(() => (courante ? indice(courante.pred_qualite, courante.pred_opacite) : null), [courante]);
  const predVide = courante?.bac_vide_prob != null && courante.bac_vide_prob >= 0.5;

  if (isLoading) return <p>Chargement...</p>;
  if (!isAuthenticated) {
    router.replace("/");
    return null;
  }
  if (!superAdmin) return <p>Accès refusé.</p>;

  return (
    <div className={base.container}>
      <section className={base.section}>
        <div className={styles.head}>
          <div>
            <h1 className={base.title}>Photos à vérifier</h1>
            <p className={styles.intro}>
              Les photos où le modèle signale un problème ou hésite, et un échantillon tiré au hasard à noter sans voir la
              note du modèle. Chaque vérification sert à améliorer le modèle et à mesurer sa précision.
            </p>
          </div>
          <label className={base.inlineField}>
            <span className={base.fieldLabel}>Période</span>
            <select className={base.select} value={jours} onChange={(e) => setJours(Number(e.target.value))}>
              {PERIODES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.compteurs}>
          <div className={styles.compteur}>
            <strong>{photos === null ? "…" : restantes}</strong>
            <span>à vérifier</span>
          </div>
          <div className={styles.compteur}>
            <strong>{faites}</strong>
            <span>vérifiées maintenant</span>
          </div>
          <div className={styles.compteur}>
            <strong>{stats ? stats.validees_7j : "…"}</strong>
            <span>vérifiées sur 7 jours</span>
          </div>
          <div className={styles.compteur} title="Écart moyen entre la note de l'admin et celle du modèle, sur les photos notées à l'aveugle (90 derniers jours)">
            <strong>
              {stats && stats.erreur_qualite != null ? `± ${fmt(stats.erreur_qualite)}` : "—"}
            </strong>
            <span>
              erreur du modèle (qualité)
              {stats ? ` · ${stats.echantillon_notees} photo${stats.echantillon_notees > 1 ? "s" : ""} à l'aveugle` : ""}
            </span>
          </div>
        </div>
        {error ? <p className={base.error}>{error}</p> : null}
      </section>

      {photos === null ? <p className={base.muted}>Chargement des photos…</p> : null}

      {photos && !courante ? (
        <section className={base.section}>
          <div className={styles.vide}>
            <Check size={28} />
            <p>Rien à vérifier sur cette période.</p>
            {jours < 365 ? <p className={base.hint}>Élargissez la période pour revoir des photos plus anciennes.</p> : null}
          </div>
        </section>
      ) : null}

      {courante ? (
        <section className={`${base.section} ${styles.travail}`}>
          <a className={styles.photo} href={courante.url} target="_blank" rel="noreferrer" title="Ouvrir la photo en grand">
            {courante.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={courante.url} alt={`Photo du recycleur, station ${courante.nom_automate}, ${dateFr(courante.timestamp)}`} />
            ) : (
              <ImageOff size={32} />
            )}
          </a>

          <div className={styles.panneau}>
            <div>
              <span className={`${styles.motif} ${styles[MOTIFS[courante.motif]?.cls || "motifIncertain"]}`}>
                {aveugle ? <EyeOff size={14} /> : null}
                {MOTIFS[courante.motif]?.label || courante.motif}
              </span>
              <h2 className={styles.station}>{courante.lieu || courante.client || `Station ${courante.nom_automate}`}</h2>
              <p className={base.hint}>
                {courante.client ? `${courante.client} · ` : ""}
                {courante.nom_automate} · {dateFr(courante.timestamp)}
              </p>
            </div>

            {/* Note du modèle : cachée pour l'échantillon tant que l'admin n'a pas donné la sienne */}
            {!aveugle || revele ? (
              <div className={styles.notes}>
                <div className={styles.note}>
                  <span>Qualité</span>
                  <strong>{fmt(courante.pred_qualite)}<small>/10</small></strong>
                  {revele && revele.q != null ? <em>vous : {fmt(revele.q)}</em> : null}
                </div>
                <div className={styles.note}>
                  <span>Opacité</span>
                  <strong>{fmt(courante.pred_opacite)}<small>/10</small></strong>
                  {revele && revele.o != null ? <em>vous : {fmt(revele.o)}</em> : null}
                </div>
                <div className={styles.note}>
                  <span>Indice</span>
                  <strong>{fmt(predIndice)}<small>/10</small></strong>
                </div>
                <div className={styles.note}>
                  <span>MES</span>
                  <strong>{courante.pred_matiere != null ? `${Math.round(courante.pred_matiere * 10)} %` : "—"}</strong>
                </div>
                <div className={styles.note}>
                  <span>Bac vide</span>
                  <strong>{courante.bac_vide_prob != null ? `${Math.round(courante.bac_vide_prob * 100)} %` : "—"}</strong>
                  {revele && revele.bacVide ? <em>vous : vide</em> : null}
                </div>
              </div>
            ) : (
              <p className={styles.consigne}>
                Notez cette photo vous-même : la note du modèle s’affichera ensuite. Ces photos tirées au hasard mesurent
                sa précision réelle.
              </p>
            )}

            {revele ? (
              <div className={styles.actions}>
                <button type="button" className={base.button} onClick={() => suivante()}>
                  <span>Photo suivante</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : aveugle || mode === "corriger" ? (
              <form className={styles.saisie} onSubmit={envoyerSaisie}>
                <label className={base.inlineField}>
                  <span className={base.fieldLabel}>Qualité (0 à 10, 10 = eau claire)</span>
                  <input ref={champQualite} className={base.input} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                <label className={base.inlineField}>
                  <span className={base.fieldLabel}>Opacité (0 à 10, 0 = transparente)</span>
                  <input className={base.input} inputMode="decimal" value={o} onChange={(e) => setO(e.target.value)} />
                </label>
                <label className={base.inlineField}>
                  <span className={base.fieldLabel}>MES en % (facultatif)</span>
                  <input className={base.input} inputMode="decimal" value={mes} onChange={(e) => setMes(e.target.value)} />
                </label>
                <div className={styles.actions}>
                  <button type="submit" className={base.button} disabled={saving}>
                    <Check size={18} />
                    <span>{aveugle ? "Valider ma note" : "Enregistrer"}</span>
                  </button>
                  <button type="button" className={`${base.button} ${base.buttonGhost}`} disabled={saving} onClick={() => bacVide(true)}>
                    <Droplets size={18} />
                    <span>Bac vide</span>
                  </button>
                  {!aveugle ? (
                    <button type="button" className={`${base.button} ${base.buttonGhost}`} onClick={() => setMode("vue")}>
                      Annuler
                    </button>
                  ) : null}
                  <button type="button" className={`${base.button} ${base.buttonGhost}`} onClick={passer}>
                    <span>Passer</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.actions}>
                <button type="button" className={base.button} disabled={saving} onClick={cEstJuste}>
                  <Check size={18} />
                  <span>C’est juste</span>
                  <kbd>Entrée</kbd>
                </button>
                <button type="button" className={`${base.button} ${base.buttonGhost}`} disabled={saving} onClick={ouvrirCorrection}>
                  <Pencil size={18} />
                  <span>Corriger</span>
                  <kbd>C</kbd>
                </button>
                <button type="button" className={`${base.button} ${base.buttonGhost}`} disabled={saving} onClick={() => bacVide(!predVide)}>
                  <Droplets size={18} />
                  <span>{predVide ? "Il y a de l’eau" : "Bac vide"}</span>
                </button>
                <button type="button" className={`${base.button} ${base.buttonGhost}`} onClick={passer}>
                  <span>Passer</span>
                  <kbd>→</kbd>
                </button>
              </div>
            )}

            {message ? <p className={message.ok ? styles.ok : base.error}>{message.texte}</p> : null}
            <p className={base.hint}>
              Modèle {courante.modele || "ancien"}
              <span className={styles.raccourcis}>
                {" · Raccourcis : "}
                {revele ? "Entrée = photo suivante" : aveugle ? "→ = passer" : "Entrée = c’est juste, C = corriger, → = passer"}.
              </span>
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
