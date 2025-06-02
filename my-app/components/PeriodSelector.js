import React from 'react';

const PeriodSelector = ({ selectedPeriod, onPeriodChange }) => {
  return (
    <select
      value={selectedPeriod}
      onChange={(e) => onPeriodChange(e.target.value)}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #e0e0e0",
        backgroundColor: "white",
        minWidth: "150px",
        fontSize: "14px"
      }}
    >
      <option value="jour">24 dernières heures</option>
      <option value="semaine">7 derniers jours</option>
      <option value="mois">30 derniers jours</option>
      <option value="annee">12 derniers mois</option>
    </select>
  );
};

export default PeriodSelector; 