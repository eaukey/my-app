'use client';

import React from "react";
import styles from "./RealTimeData.module.css";

const STATUS_LABELS = {
  ok: "Système stable",
  watch: "Vigilance",
  critical: "Critique",
  neutral: "En observation",
};

const ExecutiveSummaryBar = ({ siteName, status = "ok", lastUpdate, insight }) => {
  return (
    <div className={styles.summaryBar}>
      <div className={styles.summaryLeft}>
        <p className={styles.summaryEyebrow}>Performance du site – {siteName || "Site non sélectionné"}</p>
        <div className={styles.summaryStatusRow}>
          <span className={`${styles.statusPill} ${styles[`${status}Status`]}`}>
            <span className={styles.statusDot} />
            {STATUS_LABELS[status] || STATUS_LABELS.neutral}
          </span>
          {lastUpdate && <span className={styles.summaryMeta}>Dernière mise à jour : {lastUpdate}</span>}
        </div>
      </div>
      {insight && <p className={styles.summaryInsight}>{insight}</p>}
    </div>
  );
};

export default ExecutiveSummaryBar;

