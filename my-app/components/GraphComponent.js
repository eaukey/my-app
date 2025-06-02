import React, { useEffect, useState } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Ajout d'une prop seriesConfig pour gérer les multi-séries
const GraphComponent = ({ title, color, selectedPeriod, selectedMachine, endpoint, seriesConfig }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction pour récupérer les données depuis le backend
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!endpoint) throw new Error("Endpoint non défini");
      const response = await fetch(
        `https://backend-eaukey.duckdns.org${endpoint}?nom_automate=${selectedMachine}`
      );
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      const result = await response.json();
      // Si seriesConfig est défini, on construit un tableau d'objets pour recharts
      if (seriesConfig && Array.isArray(seriesConfig) && result.labels) {
        const formattedData = result.labels.map((label, idx) => {
          const obj = { name: label };
          seriesConfig.forEach((serie) => {
            obj[serie.key] = result[serie.key] ? result[serie.key][idx] : null;
          });
          return obj;
        });
        setData(formattedData);
      } else if (result.labels && result.data) {
        // Cas simple (une seule série)
        const formattedData = result.labels.map((label, index) => ({
          name: label,
          value: result.data[index],
        }));
        setData(formattedData);
      } else {
        setData([]);
        throw new Error("Format des données incorrect depuis le backend");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [selectedPeriod, selectedMachine, endpoint]);

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
      {loading ? (
        <p>Chargement...</p>
      ) : error ? (
        <p style={{ color: "red" }}>Erreur : {error}</p>
      ) : (
        <ResponsiveContainer height={220}>
          <RechartsLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            {seriesConfig && Array.isArray(seriesConfig) ? (
              <>
                <Legend />
                {seriesConfig.map((serie, idx) => (
                  <Line
                    key={serie.key}
                    type="monotone"
                    dataKey={serie.key}
                    stroke={serie.color || color || `hsl(${idx * 60}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </>
            ) : (
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} />
            )}
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default GraphComponent;
