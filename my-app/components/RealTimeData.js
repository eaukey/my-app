'use client';

import React, { useEffect, useState } from "react";
import { Edit, Save, X } from "lucide-react";

import styles from "./RealTimeData.module.css";

const RealTimeIndicator = ({ title, value, unit, color, lastUpdate }) => {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <div className={styles.value} style={{ color }}>
        {value !== null ? value : "-"} <span className={styles.valueUnit}>{unit}</span>
      </div>
      <div className={styles.timestamp}>
        {lastUpdate ? `Mis à jour: ${lastUpdate}` : "Aucune donnée"}
      </div>
    </div>
  );
};

const RealTimeData = ({ selectedMachine }) => {
  const [data, setData] = useState({
    taux_recyclage: { value: null, lastUpdate: null },
    hauteur_cuve_traitement: { value: null, lastUpdate: null },
    hauteur_cuve_disconnection: { value: null, lastUpdate: null },
    volume_renvoi: { value: null, lastUpdate: null },
    compteur_electrique: { value: null, lastUpdate: null }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");

  const handleEdit = (field) => {
    setEditingField(field);
    setEditValue(data[field].value ? data[field].value.toString() : "");
  };

  const handleSave = async (field) => {
    try {
      const response = await fetch(`https://backend-eaukey.duckdns.org/temps_reel/${field}?nom_automate=${selectedMachine}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valeur: parseFloat(editValue)
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Mettre à jour les données locales
          setData(prev => ({
            ...prev,
            [field]: {
              value: parseFloat(editValue),
              lastUpdate: new Date().toLocaleTimeString()
            }
          }));
          alert("Valeur mise à jour avec succès !");
        } else {
          alert(`Erreur: ${result.error}`);
        }
      } else {
        alert("Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("Erreur lors de la sauvegarde");
    }
    
    setEditingField(null);
    setEditValue("");
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  useEffect(() => {
    const fetchRealTimeData = async () => {
      if (!selectedMachine) return;
      
      console.log("Récupération des données en temps réel pour la machine:", selectedMachine);
      setLoading(true);
      try {
        // Créer un tableau de toutes les requêtes que nous devons faire
        const endpoints = [
          'taux_recyclage',
          'hauteur_cuve_traitement',
          'hauteur_cuve_disconnection',
          'volume_renvoi',
          'compteur_electrique'
        ];
        
        // Faire toutes les requêtes en séquentiel pour mieux déboguer
        const newData = { ...data };
        
        for (const endpoint of endpoints) {
          try {
            if (endpoint === 'taux_recyclage') {
              let value = null;
              let lastUpdate = null;
              const url1 = `https://backend-eaukey.duckdns.org/temps_reel/taux_recyclage?nom_automate=${selectedMachine}`;
              console.log(`Requête vers ${url1}`);
              const res1 = await fetch(url1);
              console.log(`Réponse pour taux_recyclage:`, res1.status);
              if (res1.ok) {
                const json1 = await res1.json();
                console.log(`Données pour taux_recyclage:`, json1);
                const raw = (json1.valeur !== undefined ? json1.valeur : json1.value);
                if (raw !== undefined && raw !== null && !isNaN(parseFloat(raw))) {
                  let v = parseFloat(raw);
                  if (v >= 0 && v <= 1) v = v * 100;
                  value = v;
                }
                lastUpdate = json1.horodatage ? new Date(json1.horodatage).toLocaleTimeString() : null;
              } else {
                const url2 = `https://backend-eaukey.duckdns.org/taux_recyclage/jour?nom_automate=${selectedMachine}`;
                console.log(`Requête vers ${url2}`);
                const res2 = await fetch(url2);
                console.log(`Réponse pour taux_recyclage fallback:`, res2.status);
                if (res2.ok) {
                  const json2 = await res2.json();
                  const arr = Array.isArray(json2) ? json2 : (json2.data || json2.valeurs || json2.values || []);
                  for (let i = arr.length - 1; i >= 0; i--) {
                    const item = arr[i];
                    const rawItem = typeof item === 'number' ? item : (item && typeof item === 'object' ? (item.valeur ?? item.value ?? item.v) : null);
                    if (rawItem !== undefined && rawItem !== null && !isNaN(parseFloat(rawItem))) {
                      let v = parseFloat(rawItem);
                      if (v >= 0 && v <= 1) v = v * 100;
                      value = v;
                      if (item && typeof item === 'object') {
                        const ts = item.horodatage ?? item.timestamp ?? item.date;
                        if (ts) lastUpdate = new Date(ts).toLocaleTimeString();
                      }
                      break;
                    }
                  }
                } else {
                  console.error(`Erreur HTTP ${res2.status} pour taux_recyclage fallback`);
                }
              }
              newData[endpoint] = { value: value, lastUpdate: lastUpdate };
            } else {
              const url = `https://backend-eaukey.duckdns.org/temps_reel/${endpoint}?nom_automate=${selectedMachine}`;
              console.log(`Requête vers ${url}`);
              
              const response = await fetch(url);
              console.log(`Réponse pour ${endpoint}:`, response.status);
              
              if (response.ok) {
                const result = await response.json();
                console.log(`Données pour ${endpoint}:`, result);
                
                newData[endpoint] = {
                  value: result.valeur !== undefined ? result.valeur : null,
                  lastUpdate: result.horodatage ? new Date(result.horodatage).toLocaleTimeString() : null
                };
              } else {
                console.error(`Erreur HTTP ${response.status} pour ${endpoint}`);
                newData[endpoint] = { value: null, lastUpdate: null };
              }
            }
          } catch (err) {
            console.error(`Erreur lors de la récupération de ${endpoint}:`, err);
            newData[endpoint] = { value: null, lastUpdate: null };
          }
        }
        
        console.log("Toutes les données récupérées:", newData);
        setData(newData);
      } catch (err) {
        console.error("Erreur générale lors de la récupération des données en temps réel:", err);
        setError("Impossible de récupérer les données en temps réel");
      } finally {
        setLoading(false);
      }
    };

    fetchRealTimeData();
    // Rafraîchir les données toutes les 60 secondes
    const interval = setInterval(fetchRealTimeData, 60000);
    
    return () => clearInterval(interval);
  }, [selectedMachine]);

  if (loading && !data.hauteur_cuve_traitement.value) {
    return <div style={{ textAlign: "center", margin: "20px 0" }}>Chargement des données en temps réel...</div>;
  }

  if (error) {
    return <div style={{ textAlign: "center", margin: "20px 0", color: "red" }}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Données en temps réel</h2>
      <div className={styles.row}>
        <RealTimeIndicator 
          title="Taux de recyclage" 
          value={data.taux_recyclage.value != null ? parseFloat(data.taux_recyclage.value).toFixed(0) : null} 
          unit="%" 
          color="#4CAF50"
          lastUpdate={data.taux_recyclage.lastUpdate}
        />
        <RealTimeIndicator 
          title="Cuve de traitement" 
          value={data.hauteur_cuve_traitement.value != null ? parseFloat(data.hauteur_cuve_traitement.value).toFixed(0) : null} 
          unit="%" 
          color="#FF5722"
          lastUpdate={data.hauteur_cuve_traitement.lastUpdate}
        />
        <RealTimeIndicator 
          title="Cuve de renvoi" 
          value={data.hauteur_cuve_disconnection.value != null ? parseFloat(data.hauteur_cuve_disconnection.value).toFixed(0) : null} 
          unit="%" 
          color="#9C27B0"
          lastUpdate={data.hauteur_cuve_disconnection.lastUpdate}
        />
        <RealTimeIndicator 
          title="Volume Renvoi" 
          value={data.volume_renvoi.value ? parseFloat(data.volume_renvoi.value).toFixed(2) : null} 
          unit="m³" 
          color="#2196F3"
          lastUpdate={data.volume_renvoi.lastUpdate}
        />
        <RealTimeIndicator 
          title="Compteur Électrique" 
          value={data.compteur_electrique.value ? parseFloat(data.compteur_electrique.value).toFixed(2) : null} 
          unit="kWh" 
          color="#795548"
          lastUpdate={data.compteur_electrique.lastUpdate}
        />
      </div>
    </div>
  );
};

export default RealTimeData; 