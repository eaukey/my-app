'use client';

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

  const isRecyclingRate = endpoint && endpoint.includes('/taux_recyclage/');

  // Mapping anglais -> français pour les jours de la semaine
  const dayNameMap = {
    Saturday: 'Samedi',
    Sunday: 'Dimanche',
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi'
  };
  // Mapping anglais -> français pour les mois (formes longues et abréviations courantes)
  const monthNameMap = {
    January: 'Janvier', February: 'Février', March: 'Mars', April: 'Avril', May: 'Mai', June: 'Juin', July: 'Juillet', August: 'Août', September: 'Septembre', October: 'Octobre', November: 'Novembre', December: 'Décembre',
    Jan: 'Janvier', Feb: 'Février', Mar: 'Mars', Apr: 'Avril', Jun: 'Juin', Jul: 'Juillet', Aug: 'Août', Sep: 'Septembre', Sept: 'Septembre', Oct: 'Octobre', Nov: 'Novembre', Dec: 'Décembre'
  };
  const formatTick = (tick) => {
    const s = String(tick).trim();
    if (selectedPeriod === 'semaine') {
      if (dayNameMap[s]) return dayNameMap[s];
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        const name = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
      return tick;
    }
    if (selectedPeriod === 'annee') {
      if (monthNameMap[s]) return monthNameMap[s];
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        const name = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d);
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
      return tick;
    }
    return tick;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!endpoint) throw new Error("Endpoint non défini");
      if (!selectedMachine) {
        setData([]);
        setLoading(false);
        return;
      }
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
          value: isRecyclingRate && typeof result.data[index] === 'number' && Number.isFinite(result.data[index])
            ? Math.round(result.data[index] * 100)
            : result.data[index]
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
            <XAxis dataKey="time" tickFormatter={formatTick} />
            <YAxis tickFormatter={(val) => (isRecyclingRate ? `${val}%` : val)} />
            <Tooltip formatter={(val, name) => (isRecyclingRate ? [`${val}%`, name] : [val, name])} />
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
