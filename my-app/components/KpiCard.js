'use client';

import React from "react";
import styles from "./RealTimeData.module.css";

const formatDisplayValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value;
};

const KpiCard = ({
  label,
  value,
  unit,
  deltaLabel,
  deltaDirection = "flat",
  interpretation,
  status = "neutral",
  lastUpdate,
  tooltip,
}) => {
  return (
    <div className={`${styles.kpiCard} ${styles[`${status}Kpi`]}`} title={tooltip}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        {lastUpdate && <span className={styles.kpiTimestamp}>Maj {lastUpdate}</span>}
      </div>
      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{formatDisplayValue(value)}</span>
        {unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
      <div className={styles.kpiDeltaRow}>
        {deltaLabel ? (
          <span className={`${styles.delta} ${styles[deltaDirection]}`}>
            {deltaLabel}
          </span>
        ) : (
          <span className={styles.deltaMuted}>—</span>
        )}
      </div>
      <div className={styles.kpiInterpretation}>{interpretation}</div>
    </div>
  );
};

export default KpiCard;

