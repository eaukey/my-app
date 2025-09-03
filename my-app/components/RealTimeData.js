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
          'hauteur_cuve_traitement',
          'hauteur_cuve_disconnection',
          'volume_renvoi',
          'compteur_electrique'
        ];
        
        // Faire toutes les requêtes en séquentiel pour mieux déboguer
        const newData = { ...data };
        
        for (const endpoint of endpoints) {
          try {
            const url = `https://backend-eaukey.duckdns.org/temps_reel/${endpoint}?nom_automate=${selectedMachine}`;
            // La bonne URL pourrait être différente, essayons l'URL qui correspondrait au backend
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