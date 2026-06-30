'use client';

import React from "react";
import styles from "./ChartCard.module.css";
import EmptyState from "./EmptyState";

const ChartCard = ({
  title,
  subtitle,
  loading,
  error,
  isEmpty,
  onRetry,
  onViewLastAvailable,
  lastAvailableText,
  emptyTitle = "Aucune donnée sur la période sélectionnée",
  emptyDescription = "Essayez une autre période ou vérifiez la connexion capteurs.",
  wide = false,
  children,
}) => {
  return (
    <div className={`${styles.card}${wide ? ` ${styles.spanFull}` : ""}`}>
      <div className={styles.header}>
        <div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          <h3 className={styles.title}>{title}</h3>
        </div>
        {lastAvailableText && <span className={styles.badge}>{lastAvailableText}</span>}
      </div>
      <div className={styles.body}>
        {loading ? (
          <div className={styles.skeleton} aria-label="Chargement du graphique" />
        ) : error ? (
          <div className={styles.error}>
            <p>Erreur : {error}</p>
            {onRetry && (
              <button onClick={onRetry}>
                Réessayer
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            onRetry={onRetry}
            onViewLastAvailable={onViewLastAvailable}
            hint={lastAvailableText}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default ChartCard;

