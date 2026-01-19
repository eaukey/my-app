'use client';

import React, { useCallback, useEffect, useState } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { API_BASE } from "../lib/apiBase";
import ChartCard from "./ChartCard";

const GraphComponent = ({ title, color, selectedPeriod, selectedMachine, endpoint, onRequestFallback }) => {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!endpoint) throw new Error("Endpoint non défini");
      if (!selectedMachine) {
        setData([]);
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_BASE}${endpoint}?nom_automate=${selectedMachine}`);
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      const result = await response.json();

      if (result.labels && Array.isArray(result.data)) {
        const formattedData = result.labels.map((label, index) => {
          const raw = result.data[index];
          let value = raw;
          if (isRecyclingRate && typeof raw === "number" && Number.isFinite(raw)) {
            const needsScaling = selectedPeriod === "jour" || selectedPeriod === "semaine";
            const scaled = needsScaling ? raw * 100 : raw;
            value = Math.min(100, Math.round(scaled));
          }
          return { time: label, value };
        });
        setData(formattedData);
      } else {
        throw new Error("Format des données incorrect depuis le backend");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, endpoint, isRecyclingRate, selectedMachine, selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData =
    Array.isArray(data) &&
    data.some((d) => d && d.value !== null && d.value !== undefined && !Number.isNaN(parseFloat(d.value)));
  const isEmpty = !loading && !error && !hasData;

  return (
    <ChartCard
      title={title}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      onRetry={fetchData}
      onViewLastAvailable={onRequestFallback}
      emptyTitle={!selectedMachine ? "Sélectionnez un site" : undefined}
      emptyDescription={
        !selectedMachine ? "Choisissez un site pour afficher les données." : undefined
      }
    >
      {hasData && (
        <ResponsiveContainer height={240}>
          <RechartsLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTick}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border-strong)" }}
              tickLine={{ stroke: "var(--border-strong)" }}
            />
            <YAxis
              tickFormatter={(val) => (isRecyclingRate ? `${Math.min(100, Math.round(val))}%` : val)}
              {...(isRecyclingRate ? { domain: [0, 100] } : {})}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border-strong)" }}
              tickLine={{ stroke: "var(--border-strong)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                borderRadius: 12,
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
              formatter={(val, name) => (isRecyclingRate ? [`${Math.min(100, Math.round(val))}%`, name] : [val, name])}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color || "var(--primary)"}
              strokeWidth={2.4}
              dot={false}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};

export default GraphComponent;
