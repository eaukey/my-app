import React, { useEffect, useState } from "react";

const RealTimeIndicator = ({ title, value, unit, color, lastUpdate }) => {
  return (
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
        minWidth: "180px"
      }}
    >
      <h3 style={{ fontSize: "14px", marginBottom: "8px", textAlign: "center" }}>{title}</h3>
      <div style={{ fontSize: "24px", fontWeight: "bold", color: color }}>
        {value !== null ? value : "-"} <span style={{ fontSize: "14px" }}>{unit}</span>
      </div>
      <div style={{ fontSize: "10px", color: "#666", marginTop: "8px" }}>
        {lastUpdate ? `Mis à jour: ${lastUpdate}` : "Aucune donnée"}
      </div>
    </div>
  );
};

const RealTimeData = ({ selectedMachine }) => {
  const [data, setData] = useState({
    cuve_renvoi: { value: null, lastUpdate: null },
    cuve_adoucie: { value: null, lastUpdate: null },
    cuve_relevage: { value: null, lastUpdate: null },
    volume_renvoi: { value: null, lastUpdate: null },
    compteur_electrique: { value: null, lastUpdate: null }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRealTimeData = async () => {
      if (!selectedMachine) return;
      
      setLoading(true);
      try {
        // Créer un tableau de toutes les requêtes que nous devons faire
        const endpoints = [
          'cuve_renvoi',
          'cuve_adoucie',
          'cuve_relevage',
          'volume_renvoi',
          'compteur_electrique'
        ];
        
        // Faire toutes les requêtes en parallèle
        const results = await Promise.all(
          endpoints.map(endpoint => 
            fetch(`https://backend-eaukey.duckdns.org/temps_reel/${endpoint}?nom_automate=${selectedMachine}`)
              .then(res => res.ok ? res.json() : null)
          )
        );
        
        // Mettre à jour les données avec les résultats
        const newData = { ...data };
        endpoints.forEach((endpoint, index) => {
          if (results[index]) {
            const result = results[index];
            newData[endpoint] = {
              value: result.valeur,
              lastUpdate: result.horodatage ? new Date(result.horodatage).toLocaleTimeString() : null
            };
          }
        });
        
        setData(newData);
      } catch (err) {
        console.error("Erreur lors de la récupération des données en temps réel:", err);
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

  if (loading && !data.cuve_renvoi.value) {
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
          title="Cuve Renvoi" 
          value={data.cuve_renvoi.value ? Math.round(data.cuve_renvoi.value) : null} 
          unit="%" 
          color="#2196F3"
          lastUpdate={data.cuve_renvoi.lastUpdate}
        />
        <RealTimeIndicator 
          title="Cuve Adoucie" 
          value={data.cuve_adoucie.value ? Math.round(data.cuve_adoucie.value) : null} 
          unit="%" 
          color="#4CAF50"
          lastUpdate={data.cuve_adoucie.lastUpdate}
        />
        <RealTimeIndicator 
          title="Cuve Relevage" 
          value={data.cuve_relevage.value ? Math.round(data.cuve_relevage.value) : null} 
          unit="%" 
          color="#FF9800"
          lastUpdate={data.cuve_relevage.lastUpdate}
        />
        <RealTimeIndicator 
          title="Volume Renvoi" 
          value={data.volume_renvoi.value ? data.volume_renvoi.value.toFixed(2) : null} 
          unit="m³" 
          color="#2196F3"
          lastUpdate={data.volume_renvoi.lastUpdate}
        />
        <RealTimeIndicator 
          title="Compteur Électrique" 
          value={data.compteur_electrique.value ? data.compteur_electrique.value.toFixed(2) : null} 
          unit="kWh" 
          color="#795548"
          lastUpdate={data.compteur_electrique.lastUpdate}
        />
      </div>
    </div>
  );
};

export default RealTimeData; 