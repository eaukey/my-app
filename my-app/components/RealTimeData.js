import React, { useEffect, useState } from "react";
import { Edit, Save, X } from "lucide-react";

const RealTimeIndicator = ({ title, value, unit, color, lastUpdate, onEdit, isEditing, onSave, onCancel, editValue, onEditValueChange }) => {
  const [showEditModal, setShowEditModal] = useState(false);

  const handleEdit = () => {
    setShowEditModal(true);
    onEdit();
  };

  const handleSave = () => {
    onSave();
    setShowEditModal(false);
  };

  const handleCancel = () => {
    onCancel();
    setShowEditModal(false);
  };

  return (
    <>
      <div 
        style={{ 
          backgroundColor: "white", 
          padding: "16px", 
          borderRadius: "8px", 
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minWidth: "180px",
          position: "relative"
        }}
      >
        <div style={{ position: "absolute", top: "8px", right: "8px" }}>
          <button
            onClick={handleEdit}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              color: "#666"
            }}
            title="Modifier la valeur"
          >
            <Edit size={16} />
          </button>
        </div>
        
        <h3 style={{ fontSize: "14px", marginBottom: "8px", textAlign: "center" }}>{title}</h3>
        <div style={{ fontSize: "24px", fontWeight: "bold", color: color }}>
          {value !== null ? value : "-"} <span style={{ fontSize: "14px" }}>{unit}</span>
        </div>
        <div style={{ fontSize: "10px", color: "#666", marginTop: "8px" }}>
          {lastUpdate ? `Mis à jour: ${lastUpdate}` : "Aucune donnée"}
        </div>
      </div>

      {/* Modal d'édition */}
      {showEditModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "8px",
            minWidth: "300px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ marginBottom: "16px" }}>Modifier {title}</h3>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>
                Nouvelle valeur ({unit}):
              </label>
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "16px"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  background: "white",
                  cursor: "pointer"
                }}
              >
                <X size={16} style={{ marginRight: "4px" }} />
                Annuler
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  background: "#41AEAD",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                <Save size={16} style={{ marginRight: "4px" }} />
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
    <div style={{ marginBottom: "24px" }}>
      <h2 style={{ marginBottom: "16px" }}>Données en temps réel</h2>
      <div style={{ display: "flex", gap: "16px", overflowX: "auto", padding: "4px 0" }}>
        <RealTimeIndicator 
          title="Hauteur Cuve Traitement" 
          value={data.hauteur_cuve_traitement.value ? parseFloat(data.hauteur_cuve_traitement.value).toFixed(2) : null} 
          unit="m" 
          color="#FF5722"
          lastUpdate={data.hauteur_cuve_traitement.lastUpdate}
          onEdit={() => handleEdit('hauteur_cuve_traitement')}
          isEditing={editingField === 'hauteur_cuve_traitement'}
          onSave={() => handleSave('hauteur_cuve_traitement')}
          onCancel={handleCancel}
          editValue={editValue}
          onEditValueChange={(val) => setEditValue(val)}
        />
        <RealTimeIndicator 
          title="Hauteur Cuve Disconnection" 
          value={data.hauteur_cuve_disconnection.value ? parseFloat(data.hauteur_cuve_disconnection.value).toFixed(2) : null} 
          unit="m" 
          color="#9C27B0"
          lastUpdate={data.hauteur_cuve_disconnection.lastUpdate}
          onEdit={() => handleEdit('hauteur_cuve_disconnection')}
          isEditing={editingField === 'hauteur_cuve_disconnection'}
          onSave={() => handleSave('hauteur_cuve_disconnection')}
          onCancel={handleCancel}
          editValue={editValue}
          onEditValueChange={(val) => setEditValue(val)}
        />
        <RealTimeIndicator 
          title="Volume Renvoi" 
          value={data.volume_renvoi.value ? parseFloat(data.volume_renvoi.value).toFixed(2) : null} 
          unit="m³" 
          color="#2196F3"
          lastUpdate={data.volume_renvoi.lastUpdate}
          onEdit={() => handleEdit('volume_renvoi')}
          isEditing={editingField === 'volume_renvoi'}
          onSave={() => handleSave('volume_renvoi')}
          onCancel={handleCancel}
          editValue={editValue}
          onEditValueChange={(val) => setEditValue(val)}
        />
        <RealTimeIndicator 
          title="Compteur Électrique" 
          value={data.compteur_electrique.value ? parseFloat(data.compteur_electrique.value).toFixed(2) : null} 
          unit="kWh" 
          color="#795548"
          lastUpdate={data.compteur_electrique.lastUpdate}
          onEdit={() => handleEdit('compteur_electrique')}
          isEditing={editingField === 'compteur_electrique'}
          onSave={() => handleSave('compteur_electrique')}
          onCancel={handleCancel}
          editValue={editValue}
          onEditValueChange={(val) => setEditValue(val)}
        />
      </div>
    </div>
  );
};

export default RealTimeData; 