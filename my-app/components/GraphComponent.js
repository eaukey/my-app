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

const GraphComponent = ({ title, color, selectedPeriod, selectedMachine, endpoint }) => {
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
      console.log('RAW result', result);

      // Le backend renvoie toujours { labels: [...], data: [...] }
      if (result.labels && Array.isArray(result.data)) {
        const formattedData = result.labels.map((label, index) => ({
          time: label,
          value: result.data[index]
        }));
        console.log('DATA POUR RECHARTS', formattedData);
        setData(formattedData);
      } else {
        throw new Error("Format des données incorrect depuis le backend");
      }
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
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
              dot={false}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default GraphComponent;
