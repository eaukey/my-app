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
  Legend,
} from "recharts";
import { API_BASE } from "../lib/apiBase";
import ChartCard from "./ChartCard";

const dayNameMap = {
  Saturday: 'Samedi', Sunday: 'Dimanche', Monday: 'Lundi',
  Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi', Friday: 'Vendredi',
};

const monthNameMap = {
  January: 'Janvier', February: 'Février', March: 'Mars', April: 'Avril',
  May: 'Mai', June: 'Juin', July: 'Juillet', August: 'Août',
  September: 'Septembre', October: 'Octobre', November: 'Novembre', December: 'Décembre',
  Jan: 'Janvier', Feb: 'Février', Mar: 'Mars', Apr: 'Avril',
  Jun: 'Juin', Jul: 'Juillet', Aug: 'Août', Sep: 'Septembre',
  Sept: 'Septembre', Oct: 'Octobre', Nov: 'Novembre', Dec: 'Décembre',
};

const formatTick = (tick, selectedPeriod) => {
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

const axisStyle = {
  tick: { fill: "var(--text-muted)", fontSize: 12 },
  axisLine: { stroke: "var(--border-strong)" },
  tickLine: { stroke: "var(--border-strong)" },
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 12,
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)" },
};

/**
 * Composant graphique unifié (single ou multi-series).
 * - Sans seriesConfig : mode single-series (1 ligne "value")
 * - Avec seriesConfig : mode multi-series (N lignes + légende)
 */
const Chart = ({
  title, color, selectedPeriod, selectedMachine,
  endpoint, seriesConfig, onRequestFallback,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMulti = Array.isArray(seriesConfig) && seriesConfig.length > 0;

  const isRecyclingRate = (endpoint && endpoint.includes('/taux_recyclage/')) ||
    (isMulti && seriesConfig.some(s => String(s.key || s.label || '').toLowerCase().includes('recycl')));

  const scaleValue = (raw) => {
    if (isRecyclingRate && typeof raw === "number" && Number.isFinite(raw)) {
      return Math.min(100, Math.round(raw * 100));
    }
    return raw;
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
      if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
      const result = await response.json();

      if (!result.labels) throw new Error("Format des données incorrect depuis le backend");

      let formattedData;
      if (isMulti) {
        formattedData = result.labels.map((label, index) => {
          const point = { time: label };
          seriesConfig.forEach((serie) => {
            if (result[serie.key]) {
              point[serie.key] = scaleValue(result[serie.key][index]);
            }
          });
          return point;
        });
      } else {
        if (!Array.isArray(result.data)) throw new Error("Format des données incorrect depuis le backend");
        formattedData = result.labels.map((label, index) => ({
          time: label,
          value: scaleValue(result.data[index]),
        }));
      }
      setData(formattedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // scaleValue is stable when isRecyclingRate is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, selectedMachine, selectedPeriod, isMulti, isRecyclingRate, seriesConfig]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasData = Array.isArray(data) && data.some((d) => {
    if (isMulti) {
      return seriesConfig.some((s) => d[s.key] != null && !Number.isNaN(parseFloat(d[s.key])));
    }
    return d.value != null && !Number.isNaN(parseFloat(d.value));
  });

  const isEmpty = !loading && !error && !hasData;

  const fmtValue = (val, name) =>
    isRecyclingRate ? [`${Math.min(100, Math.round(val))}%`, name] : [val, name];

  return (
    <ChartCard
      title={title}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      onRetry={fetchData}
      onViewLastAvailable={onRequestFallback}
      emptyTitle={!selectedMachine ? "Sélectionnez un site" : undefined}
      emptyDescription={!selectedMachine ? "Choisissez un site pour afficher les données." : undefined}
    >
      {hasData && (
        <ResponsiveContainer height={240}>
          <RechartsLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              dataKey="time"
              tickFormatter={(t) => formatTick(t, selectedPeriod)}
              {...axisStyle}
            />
            <YAxis
              tickFormatter={(val) => isRecyclingRate ? `${Math.min(100, Math.round(val))}%` : val}
              {...(isRecyclingRate ? { domain: [0, 100] } : {})}
              {...axisStyle}
            />
            <Tooltip {...tooltipStyle} formatter={fmtValue} />
            {isMulti && <Legend />}
            {isMulti
              ? seriesConfig.map((serie) => (
                  <Line
                    key={serie.key}
                    type="monotone"
                    dataKey={serie.key}
                    name={serie.label || serie.key}
                    stroke={serie.color || color || "var(--primary)"}
                    strokeWidth={2.4}
                    dot={false}
                  />
                ))
              : <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color || "var(--primary)"}
                  strokeWidth={2.4}
                  dot={false}
                />
            }
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};

export default Chart;
