"use client";

import { useEffect, useState } from "react";
import { useAuth, isAdmin as checkAdmin } from "../../lib/auth";
import { API_BASE } from "../../lib/apiBase";
import styles from "./Export.module.css";

const COLUMN_OPTIONS = [
  { key: "vol_renvoi_m3", label: "Volume renvoi (m³)" },
  { key: "vol_adoucie_m3", label: "Volume adoucie (m³)" },
  { key: "vol_relevage_m3", label: "Volume relevage (m³)" },
  { key: "taux_recyclage", label: "Rendement recycleur" },
  { key: "taux_desinfection_avg", label: "Taux désinfection (moy)" },
  { key: "p1_mbar", label: "Pression 1 (mbar)" },
  { key: "p2_mbar", label: "Pression 2 (mbar)" },
  { key: "p3_mbar", label: "Pression 3 (mbar)" },
  { key: "p4_mbar", label: "Pression 4 (mbar)" },
  { key: "p5_mbar", label: "Pression 5 (mbar)" },
  { key: "temp_moy_c", label: "Température moy (°C)" },
  { key: "chlore_moy_mg_l", label: "Chlore moy (mg/L)" },
  { key: "ph_moyen", label: "pH moyen" },
  { key: "conso_kwh", label: "Consommation (kWh)" },
];

const SOURCE_OPTIONS = [
  { key: "semaine", label: "Journalier" },
  { key: "mois", label: "Hebdomadaire" },
  { key: "annee", label: "Mensuel" },
];

export default function ExportPage() {
  const { user, isAuthenticated, isLoading, authFetch } = useAuth();
  const isAdmin = checkAdmin(user);

  const [stations, setStations] = useState([]);
  const [selectedStations, setSelectedStations] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState(["vol_renvoi_m3", "vol_adoucie_m3", "vol_relevage_m3"]);
  const [source, setSource] = useState("semaine");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [exporting, setExporting] = useState(false);
  const [stationSearch, setStationSearch] = useState("");
  const [depuisMiseEnRoute, setDepuisMiseEnRoute] = useState(false);
  const [miseEnRouteLoading, setMiseEnRouteLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchStations = async () => {
      try {
        const res = await authFetch(`${API_BASE}/my/automates`);
        if (res.ok) {
          const data = await res.json();
          setStations(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Erreur chargement stations:", err);
      }
    };
    fetchStations();
  }, [isAuthenticated, authFetch]);

  // Desactive "Depuis la mise en route" si on n'a pas exactement une station
  useEffect(() => {
    if (selectedStations.length !== 1 && depuisMiseEnRoute) {
      setDepuisMiseEnRoute(false);
    }
  }, [selectedStations, depuisMiseEnRoute]);

  // Recupere la date de mise en route de la station et la place dans "Du"
  useEffect(() => {
    if (!depuisMiseEnRoute || selectedStations.length !== 1) return;
    const station = selectedStations[0];
    let cancelled = false;
    const fetchPremiereDate = async () => {
      setMiseEnRouteLoading(true);
      try {
        const params = new URLSearchParams({ station, source });
        const res = await authFetch(`${API_BASE}/export/premiere-date?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            if (data.premiere_date) {
              setDateDebut(data.premiere_date);
            } else {
              alert("Aucune donnée disponible pour cette station.");
              setDepuisMiseEnRoute(false);
            }
          }
        }
      } catch (err) {
        console.error("Erreur récupération mise en route:", err);
      } finally {
        if (!cancelled) setMiseEnRouteLoading(false);
      }
    };
    fetchPremiereDate();
    return () => {
      cancelled = true;
    };
  }, [depuisMiseEnRoute, selectedStations, source, authFetch]);

  const toggleMiseEnRoute = () => {
    setDepuisMiseEnRoute((prev) => {
      const next = !prev;
      if (!next) setDateDebut("");
      return next;
    });
  };

  const toggleStation = (nom) => {
    setSelectedStations((prev) =>
      prev.includes(nom) ? prev.filter((s) => s !== nom) : [...prev, nom]
    );
  };

  const selectAllStations = () => {
    const filtered = filteredStations.map((s) => s.nom_automate);
    const allSelected = filtered.every((s) => selectedStations.includes(s));
    if (allSelected) {
      setSelectedStations((prev) => prev.filter((s) => !filtered.includes(s)));
    } else {
      setSelectedStations((prev) => [...new Set([...prev, ...filtered])]);
    }
  };

  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedStations.length === 0 || selectedColumns.length === 0) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({
        stations: selectedStations.join(","),
        colonnes: selectedColumns.join(","),
        source,
      });
      if (dateDebut) params.append("date_debut", dateDebut);
      if (dateFin) params.append("date_fin", dateFin);

      const res = await authFetch(`${API_BASE}/export/csv?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export_eaukey.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur export:", err);
      alert("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <div className={styles.container}>Chargement...</div>;
  if (!isAuthenticated || !isAdmin) return <div className={styles.container}><p>Accès réservé aux administrateurs.</p></div>;

  const filteredStations = stationSearch.trim()
    ? stations.filter((s) => {
        const q = stationSearch.trim().toLowerCase();
        return (
          (s.nom_automate || "").toLowerCase().includes(q) ||
          (s.client || "").toLowerCase().includes(q) ||
          (s.lieu || "").toLowerCase().includes(q)
        );
      })
    : stations;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Export de données</h1>
        <p className={styles.subtitle}>Sélectionnez les stations, données et période puis exportez en CSV</p>
      </div>

      <div className={styles.grid}>
        {/* Stations */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Stations</h2>
            <button type="button" className={styles.selectAllBtn} onClick={selectAllStations}>
              {filteredStations.length > 0 && filteredStations.every((s) => selectedStations.includes(s.nom_automate))
                ? "Désélectionner tout"
                : "Tout sélectionner"}
            </button>
          </div>
          <input
            type="text"
            placeholder="Rechercher une station..."
            value={stationSearch}
            onChange={(e) => setStationSearch(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.checkboxList}>
            {filteredStations.map((s) => (
              <label key={s.nom_automate} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={selectedStations.includes(s.nom_automate)}
                  onChange={() => toggleStation(s.nom_automate)}
                />
                <span>{s.client} &ndash; {s.lieu || s.nom_automate}</span>
              </label>
            ))}
          </div>
          {selectedStations.length > 0 && (
            <p className={styles.selectionCount}>{selectedStations.length} station{selectedStations.length > 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Colonnes */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Données à exporter</h2>
          <div className={styles.checkboxList}>
            {COLUMN_OPTIONS.map((col) => (
              <label key={col.key} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(col.key)}
                  onChange={() => toggleColumn(col.key)}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Granularité + Période */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Granularité</h2>
          <div className={styles.radioGroup}>
            {SOURCE_OPTIONS.map((opt) => (
              <label key={opt.key} className={styles.radioItem}>
                <input
                  type="radio"
                  name="source"
                  value={opt.key}
                  checked={source === opt.key}
                  onChange={(e) => setSource(e.target.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <h2 className={styles.sectionTitle} style={{ marginTop: "16px" }}>Période</h2>
          <label
            className={styles.checkboxItem}
            style={{ marginBottom: "10px", opacity: selectedStations.length === 1 ? 1 : 0.5 }}
            title={selectedStations.length === 1 ? "" : "Sélectionnez une seule station"}
          >
            <input
              type="checkbox"
              checked={depuisMiseEnRoute}
              disabled={selectedStations.length !== 1}
              onChange={toggleMiseEnRoute}
            />
            <span>
              Depuis la mise en route
              {selectedStations.length !== 1 && " (une seule station)"}
              {miseEnRouteLoading && " …"}
            </span>
          </label>
          <div className={styles.dateRow}>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Du</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className={styles.dateInput}
                disabled={depuisMiseEnRoute}
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Au</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          </div>
          <p className={styles.hint}>Laissez vide pour exporter toutes les données disponibles</p>
        </div>
      </div>

      <button
        className={styles.exportBtn}
        onClick={handleExport}
        disabled={exporting || selectedStations.length === 0 || selectedColumns.length === 0}
      >
        {exporting ? "Export en cours..." : "Télécharger le CSV"}
      </button>
    </div>
  );
}
