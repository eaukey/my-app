// Definitions des graphiques pour les automates "recycleur d'AIR".
// Memes conventions que le chartGroups "eau" du Dashboard : chaque entree a
// { title, color, endpoint: (period) => "...", seriesConfig? }.
// Le composant <Chart/> generique sait afficher single ou multi-courbes a partir
// de seriesConfig et du format backend { labels, <key>: [...] }.

const palette = {
  primary: "var(--primary)",
  green: "#34d399",
  amber: "#fbbf24",
  orange: "#f97316",
  teal: "#22d3ee",
  violet: "#a855f7",
  pink: "#f472b6",
  blueSoft: "#7dd3fc",
  slate: "#cbd5f5",
};

export const chartGroupsAir = {
  // Onglet "Synthese & performance"
  performance: [
    {
      title: "Débits d'air (m³/h)",
      color: palette.primary,
      endpoint: (period) => `/air/debit_all/${period}`,
      seriesConfig: [
        { key: "debit1_m3h", label: "Débit 1", color: palette.primary },
        { key: "debit2_m3h", label: "Débit 2", color: palette.green },
        { key: "debit3_m3h", label: "Débit 3", color: palette.amber },
      ],
    },
    {
      title: "Volume d'air traité (m³)",
      color: palette.green,
      endpoint: (period) => `/air/volume_air/${period}`,
      seriesConfig: [
        { key: "vol_air1_m3", label: "Volume 1", color: palette.primary },
        { key: "vol_air2_m3", label: "Volume 2", color: palette.green },
        { key: "vol_air3_m3", label: "Volume 3", color: palette.amber },
      ],
    },
  ],
  // Onglet "Donnees techniques"
  technical: [
    {
      title: "Pressions différentielles — encrassement filtres (Pa)",
      color: palette.primary,
      endpoint: (period) => `/air/pression_all/${period}`,
      seriesConfig: [
        { key: "p1_pa", label: "P1", color: palette.primary },
        { key: "p2_pa", label: "P2", color: palette.green },
        { key: "p3_pa", label: "P3", color: palette.amber },
        { key: "p4_pa", label: "P4", color: palette.orange },
      ],
    },
    {
      title: "Températures (°C)",
      color: palette.pink,
      endpoint: (period) => `/air/temperature_all/${period}`,
      seriesConfig: [
        { key: "temp1_c", label: "Temp 1", color: palette.pink },
        { key: "temp3_c", label: "Temp 3", color: palette.orange },
        { key: "temp4_c", label: "Temp 4", color: palette.amber },
      ],
    },
    {
      title: "Humidité (%)",
      color: palette.teal,
      endpoint: (period) => `/air/hygro_all/${period}`,
      seriesConfig: [
        { key: "hygro1_pc", label: "Hygro 1", color: palette.teal },
        { key: "hygro2_pc", label: "Hygro 2", color: palette.blueSoft },
        { key: "hygro3_pc", label: "Hygro 3", color: palette.primary },
      ],
    },
    {
      title: "Qualité d'air (CO₂ / COV / MES)",
      color: palette.violet,
      endpoint: (period) => `/air/qualite_air/${period}`,
      seriesConfig: [
        { key: "co2_ppm", label: "CO₂ (ppm)", color: palette.violet },
        { key: "cov_ppm", label: "COV (ppm)", color: palette.orange },
        { key: "mes_microg_l", label: "MES (µg/L)", color: palette.slate },
      ],
    },
  ],
};

export default chartGroupsAir;
