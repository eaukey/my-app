import React, { useEffect, useState } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const GraphComponent = ({ title, color, selectedPeriod, selectedMachine }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
  
    // Associe les titres aux endpoints du backend
    const getEndpoint = () => {
      switch (title) {
        case "Volume renvoi (m³)":
          return `/renvoi/${selectedPeriod.toLowerCase()}`;
        case "Volume adoucie (m³)":
          return `/adoucie/${selectedPeriod.toLowerCase()}`;
        case "Volume relevage (m³)":
          return `/relevage/${selectedPeriod.toLowerCase()}`;
        case "Pression station (mbar)":
          return `/avg_pression5/${selectedPeriod.toLowerCase()}`;
        case "Taux recyclage (%)":
          return `/taux_recyclage/${selectedPeriod.toLowerCase()}`;
        case "Taux désinfection (%)":
          return `/taux_desinfection/${selectedPeriod.toLowerCase()}`;
        default:
          return "";
      }
    };

  // Fonction pour récupérer les données depuis le backend
  const fetchData = async () => {
    setLoading(true); // Début du chargement
    setError(null); // Réinitialiser les erreurs

    try {
      const endpoint = getEndpoint(); // Obtenir l'URL appropriée
      if (!endpoint) throw new Error("Endpoint non défini");

      const response = await fetch(
        `https://backend-eaukey.duckdns.org${endpoint}?nom_automate=${selectedMachine}`
      );

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const result = await response.json();

      // Vérification du format des données reçues
      if (!result.labels || !result.data) {
        throw new Error("Format des données incorrect depuis le backend");
      }

      // Formatage des données pour Recharts
      const formattedData = result.heure.map((hour, index) => ({
        x: result.derniere_valeur[index], // ✅ Afficher la valeur sur l'axe X
        y: hour, // ✅ Afficher l'heure sur l'axe Y
      }));
      
      setData(formattedData); // Mettre à jour les données dans le state
    } catch (error) {
      console.error("Erreur lors de la récupération des données :", error);
      setError(error.message); // Sauvegarde l'erreur pour affichage
    } finally {
      setLoading(false); // Fin du chargement
    }
  };

  // Appel de fetchData chaque fois que la période ou la machine change
  useEffect(() => {
    fetchData();
  }, [selectedPeriod, selectedMachine]);

  // Affichage du composant
  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginBottom: "16px" }}>{title}</h3>

      {/* Gestion des états : chargement, erreur ou affichage du graphique */}
      {loading ? (
        <p>Chargement...</p>
      ) : error ? (
        <p style={{ color: "red" }}>Erreur : {error}</p>
      ) : (
        <ResponsiveContainer height={200}>
          <RechartsLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name"
              tickFormatter={(value) => `${value}`} // ✅ Affichage propre des heures
            />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} />
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default GraphComponent;
