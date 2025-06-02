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

const MultiSeriesGraphComponent = ({ title, color, selectedPeriod, selectedMachine, endpoint, seriesConfig }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      console.log('RAW result (multi-séries)', result);

      if (!result.labels) {
        throw new Error("Les données ne contiennent pas de labels");
      }

      // Formatage pour multi-séries
      const formattedData = result.labels.map((label, index) => {
        const dataPoint = { time: label };
        seriesConfig.forEach(serie => {
          if (result[serie.key]) {
            dataPoint[serie.key] = result[serie.key][index];
          }
        });
        return dataPoint;
      });
      
      console.log('DATA POUR RECHARTS (multi-séries)', formattedData);
      setData(formattedData);
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            {seriesConfig.map((serie) => (
              <Line
                key={serie.key}
                type="monotone"
                dataKey={serie.key}
                name={serie.label || serie.key}
                stroke={serie.color || color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default MultiSeriesGraphComponent; 