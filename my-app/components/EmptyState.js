'use client';

import React from "react";
import styles from "./ChartCard.module.css";

const EmptyState = ({ title, description, onRetry, onViewLastAvailable, hint }) => {
  return (
    <div className={styles.emptyState}>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <div className={styles.emptyActions}>
        {onViewLastAvailable && (
          <button className={styles.emptyButton} onClick={onViewLastAvailable}>
            Voir dernière période disponible
          </button>
        )}
        {onRetry && (
          <button className={styles.ghostButton} onClick={onRetry}>
            Actualiser
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;

