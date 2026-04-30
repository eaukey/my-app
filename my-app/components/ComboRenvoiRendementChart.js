'use client';

import React, { useCallback, useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
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

const fillZerosRendement = (dataArray) => {
  let lastPositive = null;
  const filled = dataArray.map((point) => {
    const val = point.rendement;
    if (typeof val === "number" && val > 0) {
      lastPositive = val;
      return point;
    }
    if (typeof val === "number" && val === 0 && lastPositive !== null) {
      return { ...point, rendement: lastPositive };
    }
    return point;
  });
  const firstPositive = filled.find(
    (p) => typeof p.rendement === "number" && p.rendement > 0
  );
  if (firstPositive) {
    return filled.map((point) =>
      typeof point.rendement === "number" && point.rendement === 0
        ? { ...point, rendement: firstPositive.rendement }
        : point
    );
  }
  return filled;
};

const ComboRenvoiRendementChart = ({
  title = "Volume renvoi & rendement recycleur",
  selectedPeriod,
  selectedMachine,
  volumeEndpoint,
  rendementEndpoint,
  onRequestFallback,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!volumeEndpoint || !rendementEndpoint) {
        throw new Error("Endpoints non définis");
      }
      if (!selectedMachine) {
        setData([]);
        setLoading(false);
        return;
      }
      const [volRes, rendRes] = await Promise.all([
        fetch(`${API_BASE}${volumeEndpoint}?nom_automate=${selectedMachine}`),
        fetch(`${API_BASE}${rendementEndpoint}?nom_automate=${selectedMachine}`),
      ]);
      if (!volRes.ok) throw new Error(`Erreur volume: ${volRes.status}`);
      if (!rendRes.ok) throw new Error(`Erreur rendement: ${rendRes.status}`);
      const volJson = await volRes.json();
      const rendJson = await rendRes.json();

      if (!volJson.labels || !Array.isArray(volJson.data)) {
        throw new Error("Format volume incorrect");
      }
      if (!rendJson.labels || !Array.isArray(rendJson.data)) {
        throw new Error("Format rendement incorrect");
      }

      const rendByLabel = new Map();
      rendJson.labels.forEach((lbl, i) => {
        const raw = rendJson.data[i];
        const pct =
          typeof raw === "number" && Number.isFinite(raw)
            ? Math.min(100, Math.round(raw * 100))
            : null;
        rendByLabel.set(String(lbl), pct);
      });

      const merged = volJson.labels.map((lbl, i) => ({
        time: String(lbl),
        renvoi: typeof volJson.data[i] === "number" ? volJson.data[i] : null,
        rendement: rendByLabel.has(String(lbl))
          ? rendByLabel.get(String(lbl))
          : null,
      }));

      setData(fillZerosRendement(merged));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [volumeEndpoint, rendementEndpoint, selectedMachine]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData =
    Array.isArray(data) &&
    data.some(
      (d) =>
        (d.renvoi != null && !Number.isNaN(parseFloat(d.renvoi))) ||
        (d.rendement != null && !Number.isNaN(parseFloat(d.rendement)))
    );

  const isEmpty = !loading && !error && !hasData;

  const fmtValue = (val, name) => {
    if (val == null) return ["—", name];
    if (name === "Rendement") return [`${Math.min(100, Math.round(val))}%`, name];
    return [`${val} m³`, name];
  };

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
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              dataKey="time"
              tickFormatter={(t) => formatTick(t, selectedPeriod)}
              {...axisStyle}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => `${v}`}
              label={{
                value: "m³",
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)",
                fontSize: 12,
              }}
              {...axisStyle}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              {...axisStyle}
            />
            <Tooltip {...tooltipStyle} formatter={fmtValue} />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="renvoi"
              name="Volume renvoi"
              fill="var(--primary)"
              fillOpacity={0.5}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="rendement"
              name="Rendement"
              stroke="#22d3ee"
              strokeWidth={2.4}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};

export default ComboRenvoiRendementChart;
