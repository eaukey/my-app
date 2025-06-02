from fastapi import FastAPI, Query
from typing import List, Tuple
import psycopg2
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
import decimal

# Création de l'instance FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://my-app-zeta-blue.vercel.app"],  # Autorisez cette origine
    allow_credentials=True,
    allow_methods=["*"],  # Autorisez toutes les méthodes (GET, POST, etc.)
    allow_headers=["*"],  # Autorisez tous les en-têtes
)

# Fonction de connexion PostgreSQL
def get_connection():
    return psycopg2.connect(
        dbname="EaukeyCloudSQLv1",
        user="romain",
        password="Lzl?h<P@zxle6xuL",
        host="35.195.185.218"
    )

def executer_requete_sql(requete_sql: str, params: tuple = None) -> List[Tuple]:
    """
    Exécute une requête SQL avec des paramètres optionnels.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                if params:  # Si des paramètres sont fournis
                    cur.execute(requete_sql, params)  # Utilise les paramètres
                else:
                    cur.execute(requete_sql)  # Aucune valeur supplémentaire
                resultats = cur.fetchall()
        return resultats
    except Exception as e:
        print(f"Erreur SQL : {e}")
        return []

# Fonction pour calculer la consommation
def calculer_consommation_par_intervalle(resultat_sql: List[Tuple], timeframe: str = "jour") -> dict:
    if not resultat_sql or len(resultat_sql) < 2:
        return {"labels": [], "data": []}

    labels = []
    data = []
    for i in range(1, len(resultat_sql)):
        intervalle_actuel = resultat_sql[i][0]  # First column: could be hour or date
        valeur_actuelle = resultat_sql[i][1]
        valeur_precedente = resultat_sql[i - 1][1]
        consommation = max(valeur_actuelle - valeur_precedente, 0)

        # Format the label based on the timeframe
        if timeframe.lower() == "jour":
            labels.append(intervalle_actuel.strftime("%H:%M"))
        elif timeframe.lower() == "semaine":
            labels.append(str(intervalle_actuel).strip())  # Format as day name (e.g., "Monday")
        elif timeframe.lower() == "mois":
            labels.append(intervalle_actuel.strftime("%Y-%m-%d"))  # Format as "YYYY-MM-DD"
        elif timeframe.lower() == "annee":
            labels.append(intervalle_actuel.strftime("%B"))  # Format as full month name (e.g., "March")
        else:
            labels.append(str(intervalle_actuel))  # Fallback

        data.append(consommation)

    return {"labels": labels, "data": data}

# ---------------------------------------------------------------------------
# Nouvelle fonction : formatte les labels + valeurs pour l'API
# ---------------------------------------------------------------------------
from typing import List, Tuple
import decimal
import datetime as dt

def formater_series(resultat_sql: List[Tuple], timeframe: str = "jour") -> dict:
    """
    Convertit la sortie d'une requête SQL en deux listes :
      - labels  : abscisses formatées (heure, jour, date, mois)
      - data    : valeurs numériques (float)

    Hypothèse : la requête SQL renvoie déjà une ligne par intervalle
                (heure, jour, semaine, mois…), PAS un compteur cumulatif.
    """
    if not resultat_sql:
        return {"labels": [], "data": []}

    labels: List[str] = []
    data:   List[float] = []

    tf = timeframe.lower()

    for row in resultat_sql:
        # 1) Récupère l'abscisse et la valeur
        x = row[0]
        y = row[1] if row[1] is not None else 0

        # 2) Formate le label selon la période demandée
        if tf == "jour":           # x = datetime (heure) -> "HH:MM"
            label = x.strftime("%H:%M") if hasattr(x, "strftime") else str(x)
        elif tf == "semaine":      # x = 'Monday' ou datetime -> nom du jour en anglais
            label = x.strftime("%A") if hasattr(x, "strftime") else str(x).strip()
        elif tf == "mois":         # x = date du lundi -> "YYYY-MM-DD"
            label = x.strftime("%Y-%m-%d") if hasattr(x, "strftime") else str(x)
        elif tf == "annee":        # x = date 1er mois -> "March"
            label = x.strftime("%B") if hasattr(x, "strftime") else str(x)
        else:
            label = str(x)

        # 3) Ajoute aux listes
        labels.append(label)
        data.append(float(y))

    return {"labels": labels, "data": data}


# Endpoints pour renvoi
@app.get("/renvoi/jour")
def volume_renvoi_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_renvoi_m3
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= now() - INTERVAL '24 hours'
      AND  horodatage  <  now()
),
deltas AS ( 
    SELECT
        date_trunc('hour', horodatage) AS heure,
        GREATEST(
            compteur_eau_renvoi_m3
          - LAG(compteur_eau_renvoi_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS d_renvoi_m3
    FROM w
)
SELECT
    heure,
    ROUND(SUM(d_renvoi_m3)::numeric, 2) AS vol_renvoi_m3
FROM   deltas
GROUP  BY heure
ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result, timeframe="jour")

@app.get("/renvoi/semaine")
def volume_renvoi_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
  WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_renvoi_m3
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= date_trunc('day', now()) - INTERVAL '7 days'
      AND  horodatage  <  date_trunc('day', now()) + INTERVAL '1 day'
),
deltas AS (
    SELECT
        date_trunc('day', horodatage)::date AS jour,
        GREATEST(
            compteur_eau_renvoi_m3
          - LAG(compteur_eau_renvoi_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS d_renvoi
    FROM w
),
vols AS (
    SELECT
        jour,
        ROUND(SUM(d_renvoi)::numeric, 2) AS vol_renvoi_m3
    FROM   deltas
    GROUP  BY jour
),
series AS (
    SELECT generate_series(
              date_trunc('day', now()) - INTERVAL '7 days',
              date_trunc('day', now()),
              '1 day'
           )::date AS jour
)
SELECT
    to_char(s.jour, 'FMDay')      AS day_name,
    COALESCE(v.vol_renvoi_m3, 0)  AS vol_renvoi_m3
FROM   series s
LEFT   JOIN vols v USING (jour)
ORDER  BY s.jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="semaine")


@app.get("/renvoi/mois")
def volume_renvoi_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT DATE_TRUNC('week', rounded_timestamp)::DATE AS semaine_debut, 
               MAX(compteur_eau_renvoi) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY semaine_debut;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result, timeframe="mois")

@app.get("/renvoi/annee")
def volume_renvoi_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        WITH month_max AS (
    SELECT
        date_trunc('month', rounded_timestamp)::date AS mois,
        MAX(compteur_eau_renvoi)                  AS renvoi_max
    FROM   moyenne
    WHERE  nom_automate      = %s
      AND  rounded_timestamp >= date_trunc('month', now()) - INTERVAL '12 months'
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY mois
),

/* 3) Volumes mensuels = Δ entre deux mois consécutifs */
vols AS (
    SELECT
        mois,
        GREATEST(
            renvoi_max
          - LAG(renvoi_max) OVER (ORDER BY mois),
            0
        ) AS vol_renvoi_m3
    FROM month_max
),

/* 4) Grille complète des 13 mois (J−12 ➜ J) */
grille AS (
    SELECT generate_series(
              date_trunc('month', now()) - INTERVAL '12 months',
              date_trunc('month', now()),
              '1 month'
           )::date AS mois
)

/* 5) Assemblage final avec month_label */
SELECT
    TO_CHAR(grille.mois, 'FMMonth')   AS month_label,    -- May, June, July…
    COALESCE(vols.vol_renvoi_m3, 0)    AS vol_renvoi_m3
FROM   grille
LEFT   JOIN vols USING (mois)
ORDER  BY grille.mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="annee")

@app.get("/adoucie/jour")
def volume_adoucie_jour(nom_automate: str = Query(...)):
    query = """
WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_adoucie_m3
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= now() - INTERVAL '24 hours'
      AND  horodatage  <  now()
),
deltas AS (
    SELECT
        date_trunc('hour', horodatage) AS heure,
        GREATEST(
            compteur_eau_adoucie_m3
          - LAG(compteur_eau_adoucie_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS d_adoucie_m3
    FROM w
)
SELECT
    heure,
    ROUND(SUM(d_adoucie_m3)::numeric, 2) AS vol_adoucie_m3
FROM   deltas
GROUP  BY heure
ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="jour")

@app.get("/adoucie/semaine")
def volume_adoucie_semaine(nom_automate: str = Query(...)):
    query = """
        WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_adoucie_m3
    FROM   mesures
    WHERE  nom_automate =%s
      AND  horodatage  >= date_trunc('day', now()) - INTERVAL '7 days'
      AND  horodatage  <  date_trunc('day', now()) + INTERVAL '1 day'
),
deltas AS (
    SELECT
        date_trunc('day', horodatage)::date AS jour,
        GREATEST(
            compteur_eau_adoucie_m3
          - LAG(compteur_eau_adoucie_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS d_adoucie
    FROM w
),
vols AS (
    SELECT
        jour,
        ROUND(SUM(d_adoucie)::numeric, 2) AS vol_adoucie_m3
    FROM   deltas
    GROUP  BY jour
),
series AS (
    SELECT generate_series(
              date_trunc('day', now()) - INTERVAL '7 days',
              date_trunc('day', now()),
              '1 day'
           )::date AS jour
)
SELECT
    TO_CHAR(s.jour, 'FMDay')       AS day_name,
    COALESCE(v.vol_adoucie_m3, 0)  AS vol_adoucie_m3
FROM   series s
LEFT   JOIN vols v USING (jour)
ORDER  BY s.jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="semaine")

@app.get("/adoucie/mois")
def volume_adoucie_mois(nom_automate: str = Query(...)):
    query = """
        SELECT DATE_TRUNC('week', rounded_timestamp)::DATE AS semaine_debut, 
               MAX(compteur_eau_adoucie) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY semaine_debut;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result, timeframe="mois")

@app.get("/adoucie/annee")
def volume_adoucie_annee(nom_automate: str = Query(...)):
    query = """
        WITH month_max AS (
    SELECT
        date_trunc('month', rounded_timestamp)::date AS mois,
        MAX(compteur_eau_adoucie)                   AS adoucie_max
    FROM   moyenne
    WHERE  nom_automate      = '2022911.0'
      AND  rounded_timestamp >= date_trunc('month', now()) - INTERVAL '12 months'
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY mois
),

-- 3) Volumes mensuels = Δ entre deux mois consécutifs
vols AS (
    SELECT
        mois,
        GREATEST(
            adoucie_max
          - LAG(adoucie_max) OVER (ORDER BY mois),
            0
        ) AS vol_adoucie_m3
    FROM month_max
),

-- 4) Grille complète des 13 mois (J-12 ➜ J)
grille AS (
    SELECT generate_series(
              date_trunc('month', now()) - INTERVAL '12 months',
              date_trunc('month', now()),
              '1 month'
           )::date AS mois
)

-- 5) Résultat final avec month_label en clair
SELECT
    TO_CHAR(grille.mois, 'FMMonth')   AS month_label,   -- May, June, July...
    COALESCE(vols.vol_adoucie_m3, 0)   AS vol_adoucie_m3
FROM   grille
LEFT   JOIN vols USING (mois)
ORDER  BY grille.mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="annee")

@app.get("/relevage/jour")
def volume_relevage_jour(nom_automate: str = Query(...)):
    query = """
        WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_relevage_m3
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= now() - INTERVAL '24 hours'
      AND  horodatage  <  now()
),
deltas AS (               
    SELECT
        date_trunc('hour', horodatage) AS heure,
        GREATEST(
            compteur_eau_relevage_m3
          - LAG(compteur_eau_relevage_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS d_relevage_m3
    FROM w
)
SELECT
    heure,
    ROUND(SUM(d_relevage_m3)::numeric, 2) AS vol_relevage_m3
FROM   deltas
GROUP  BY heure
ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result, timeframe="jour")

@app.get("/relevage/semaine")
def volume_relevage_semaine(nom_automate: str = Query(...)):
    query = """
        WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_relevage_m3
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= date_trunc('day', now()) - INTERVAL '7 days'
      AND  horodatage  <  date_trunc('day', now()) + INTERVAL '1 day'
),
deltas AS (
    SELECT
        date_trunc('day', horodatage)::date AS jour,
        GREATEST(
            compteur_eau_relevage_m3
          - LAG(compteur_eau_relevage_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS d_relevage
    FROM w
),
vols AS (
    SELECT
        jour,
        ROUND(SUM(d_relevage)::numeric, 2) AS vol_relevage_m3
    FROM   deltas
    GROUP  BY jour
),
series AS (
    SELECT generate_series(
              date_trunc('day', now()) - INTERVAL '7 days',
              date_trunc('day', now()),
              '1 day'
           )::date AS jour
)
SELECT
    TO_CHAR(series.jour, 'FMDay') AS day_name,
    COALESCE(vols.vol_relevage_m3, 0) AS vol_relevage_m3
FROM   series
LEFT   JOIN vols USING (jour)
ORDER  BY series.jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="semaine")

@app.get("/relevage/mois")
def volume_relevage_mois(nom_automate: str = Query(...)):
    query = """
        SELECT DATE_TRUNC('week', rounded_timestamp)::DATE AS semaine_debut, 
               MAX(compteur_eau_relevage) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY semaine_debut;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result, timeframe="mois")

@app.get("/relevage/annee")
def volume_relevage_annee(nom_automate: str = Query(...)):
    query = """
        WITH month_max AS (
    SELECT
        date_trunc('month', rounded_timestamp)::date AS mois,
        MAX(compteur_eau_relevage)                  AS relevage_max
    FROM   moyenne
    WHERE  nom_automate      = %s
      AND  rounded_timestamp >= date_trunc('month', now()) - INTERVAL '12 months'
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY mois
),

-- 3) Volumes mensuels = Δ entre deux mois consécutifs
vols AS (
    SELECT
        mois,
        GREATEST(
            relevage_max
          - LAG(relevage_max) OVER (ORDER BY mois),
            0
        ) AS vol_relevage_m3
    FROM month_max
),

-- 4) Grille complète des 13 mois (J-12 ➜ J)
grille AS (
    SELECT generate_series(
              date_trunc('month', now()) - INTERVAL '12 months',
              date_trunc('month', now()),
              '1 month'
           )::date AS mois
)

-- 5) Résultat final avec month_label en clair
SELECT
    TO_CHAR(grille.mois, 'FMMonth')   AS month_label,   -- May, June, July...
    COALESCE(vols.vol_relevage_m3, 0)   AS vol_relevage_m3
FROM   grille
LEFT   JOIN vols USING (mois)
ORDER  BY grille.mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="annee")

@app.get("/avg_pression5/jour")
def avg_pression5_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    """
    Retourne la moyenne horaire de avg_pression5 pour les dernières 24 heures glissantes.
    Les labels affichent l'heure au format "HH:00".
    """
    query = """
        SELECT 
            EXTRACT(HOUR FROM rounded_timestamp) AS heure,
            AVG(avg_pression5) AS moyenne_pression
        FROM moyenne
        WHERE nom_automate = %s
          AND rounded_timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY EXTRACT(HOUR FROM rounded_timestamp)
        ORDER BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [f"{int(row[0]):02d}:00" for row in result],  # Format as "HH:00"
        "data": [float(row[1]) for row in result]
    }

@app.get("/avg_pression5/semaine")
def avg_pression5_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(rounded_timestamp, 'Day') AS jour_semaine,
            AVG(avg_pression5) AS moyenne_pression
        FROM moyenne
        WHERE nom_automate = %s
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(rounded_timestamp, 'Day')
        ORDER BY MIN(rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0].strip() for row in result], "data": [row[1] for row in result]}

@app.get("/avg_pression5/mois")
def avg_pression5_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            DATE_TRUNC('week', rounded_timestamp)::DATE AS semaine_debut,
            AVG(avg_pression5) AS moyenne_pression
        FROM moyenne
        WHERE nom_automate = %s
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY DATE_TRUNC('week', rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],  # Format as "YYYY-MM-DD"
        "data": [float(row[1]) for row in result]
    }

@app.get("/avg_pression5/annee")
def avg_pression5_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(DATE_TRUNC('month', rounded_timestamp), 'Month') AS mois,
            AVG(avg_pression5) AS moyenne_pression
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 year'
        GROUP BY DATE_TRUNC('month', rounded_timestamp)
        ORDER BY DATE_TRUNC('month', rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0].strip() for row in result], "data": [row[1] for row in result]}

@app.get("/taux_recyclage/jour")
def taux_recyclage_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
    SELECT
        horodatage,
        nom_automate,
        compteur_eau_adoucie_m3,
        compteur_eau_renvoi_m3
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= NOW() - INTERVAL '24 hours'
      AND  horodatage  <  NOW()
),
deltas AS (
    SELECT
        date_trunc('hour', horodatage) AS heure_ts,
        GREATEST(
            compteur_eau_adoucie_m3
          - LAG(compteur_eau_adoucie_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS vol_adoucie,
        GREATEST(
            compteur_eau_renvoi_m3
          - LAG(compteur_eau_renvoi_m3)
              OVER (PARTITION BY nom_automate ORDER BY horodatage),
            0
        ) AS vol_renvoi
    FROM w
),
par_heure AS (
    SELECT
        heure_ts,
        SUM(vol_adoucie) AS vol_adoucie,
        SUM(vol_renvoi)  AS vol_renvoi
    FROM   deltas
    GROUP  BY heure_ts
)
SELECT
    TO_CHAR(heure_ts, 'HH24:MI')                AS heure_label,
    CASE
        WHEN vol_adoucie + vol_renvoi = 0 THEN 0
        ELSE ROUND( (vol_renvoi / (vol_adoucie + vol_renvoi))::numeric, 2 )
    END                                         AS taux_recyclage
FROM   par_heure
ORDER  BY heure_ts;
    """

    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="jour")

@app.get("/taux_recyclage/semaine")
def taux_recyclage_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            horodatage,
            nom_automate,
            compteur_eau_adoucie_m3,
            compteur_eau_renvoi_m3
        FROM   mesures
        WHERE  nom_automate = %s
          AND  horodatage  >= date_trunc('day', now()) - INTERVAL '7 days'
          AND  horodatage  <  date_trunc('day', now()) + INTERVAL '1 day'
    ),
    deltas AS (
        SELECT
            date_trunc('day', horodatage)::date AS jour,
            GREATEST(
                compteur_eau_adoucie_m3
              - LAG(compteur_eau_adoucie_m3)
                  OVER (PARTITION BY nom_automate ORDER BY horodatage), 0
            ) AS vol_adoucie,
            GREATEST(
                compteur_eau_renvoi_m3
              - LAG(compteur_eau_renvoi_m3)
                  OVER (PARTITION BY nom_automate ORDER BY horodatage), 0
            ) AS vol_renvoi
        FROM w
    ),
    par_jour AS (
        SELECT
            jour,
            SUM(vol_adoucie) AS vol_adoucie,
            SUM(vol_renvoi)  AS vol_renvoi
        FROM   deltas
        GROUP  BY jour
    ),
    grille AS (
        SELECT generate_series(
                  date_trunc('day', now()) - INTERVAL '7 days',
                  date_trunc('day', now()),
                  '1 day'
               )::date AS jour
    )
    SELECT
        TO_CHAR(grille.jour, 'FMDay')                            AS day_name,
        COALESCE(
            ROUND(
                (par_jour.vol_renvoi /
                 NULLIF(par_jour.vol_adoucie + par_jour.vol_renvoi, 0)
                )::numeric
            , 2),
            0
        )                                                        AS taux_recyclage
    FROM   grille
    LEFT   JOIN par_jour USING (jour)
    ORDER  BY grille.jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strip() for row in result],
        "data": [float(row[1]) for row in result]
    }

@app.get("/taux_recyclage/mois")
def taux_recyclage_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
WITH w AS (
    SELECT
        date_trunc('week', rounded_timestamp)::date AS semaine,
        MAX(compteur_eau_adoucie)                  AS adoucie_max,
        MAX(compteur_eau_renvoi)                   AS renvoi_max
    FROM   moyenne
    WHERE  nom_automate      = %s
      AND  rounded_timestamp >= date_trunc('month', now())
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY semaine
),
vols AS (
    SELECT
        semaine,
        GREATEST(adoucie_max - LAG(adoucie_max) OVER (ORDER BY semaine), 0) AS vol_adoucie,
        GREATEST(renvoi_max  - LAG(renvoi_max)  OVER (ORDER BY semaine), 0) AS vol_renvoi
    FROM   w
),
grille AS (
    SELECT generate_series(
              date_trunc('week', date_trunc('month', now())),
              date_trunc('week', now()),
              '1 week'
           )::date AS semaine
)
SELECT
    to_char(grille.semaine, 'YYYY-MM-DD')                    AS week_label,
    COALESCE(
        ROUND(
            100 * vols.vol_renvoi::numeric
              / NULLIF(vols.vol_adoucie + vols.vol_renvoi, 0)
        , 2),
        0
    )                                                        AS taux_recyclage
FROM   grille
LEFT   JOIN vols USING (semaine)
ORDER  BY grille.semaine;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0] for row in result],
        "data": [float(row[1]) for row in result]
    }

@app.get("/taux_recyclage/annee")
def taux_recyclage_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        WITH w AS (
            SELECT
                rounded_timestamp,
                nom_automate,
                compteur_eau_adoucie,
                compteur_eau_renvoi
            FROM   moyenne
            WHERE  nom_automate = %s
              AND  rounded_timestamp >= date_trunc('month', now()) - INTERVAL '12 months'
              AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
        ),
        mois_last AS (
            SELECT
                date_trunc('month', rounded_timestamp)::date AS mois,
                MAX(compteur_eau_adoucie)                   AS adoucie_max,
                MAX(compteur_eau_renvoi)                    AS renvoi_max
            FROM   w
            GROUP  BY mois
        ),
        vols AS (
            SELECT
                mois,
                GREATEST( adoucie_max - LAG(adoucie_max) OVER (ORDER BY mois), 0) AS vol_adoucie,
                GREATEST( renvoi_max  - LAG(renvoi_max)  OVER (ORDER BY mois), 0) AS vol_renvoi
            FROM   mois_last
        ),
        grille AS (
            SELECT generate_series(
                      date_trunc('month', now()) - INTERVAL '12 months',
                      date_trunc('month', now()),
                      '1 month'
                   )::date AS mois
        )
        SELECT
            TO_CHAR(grille.mois, 'FMMonth')                          AS month_label,
            COALESCE(
                ROUND(
                    100 * vols.vol_renvoi::numeric
                        / NULLIF(vols.vol_adoucie + vols.vol_renvoi, 0)
                , 2),
                0
            )                                                        AS taux_recyclage
        FROM   grille
        LEFT   JOIN vols USING (mois)
        ORDER  BY grille.mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0] for row in result],
        "data": [float(row[1]) for row in result]
    }

@app.get("/taux_desinfection/jour")
def taux_desinfection_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
WITH heures AS (
    SELECT generate_series(
               date_trunc('hour', NOW() - INTERVAL '23 hours'),
               date_trunc('hour', NOW()),
               '1 hour'
           ) AS heure_ts
),
mediane AS (
    SELECT
        date_trunc('hour', rounded_timestamp) AS heure_ts,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY avg_chlore / 2.5)
            AS taux_med
    FROM   moyenne
    WHERE  nom_automate      = %s
      AND  rounded_timestamp >= NOW() - INTERVAL '24 hours'
      AND  rounded_timestamp <  NOW()
    GROUP  BY heure_ts
)
SELECT
    TO_CHAR(h.heure_ts, 'HH24:MI')            AS heure_label,
    COALESCE(m.taux_med, 0)                  AS taux_desinfection
FROM   heures h
LEFT   JOIN mediane m USING (heure_ts)
ORDER  BY h.heure_ts;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="jour")

@app.get("/taux_desinfection/semaine")
def taux_desinfection_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        WITH w AS (
    SELECT
        date_trunc('day', horodatage)::date           AS jour,
        chlore_mv / 2.5                               AS taux
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= date_trunc('day', now()) - INTERVAL '7 days'
      AND  horodatage  <  date_trunc('day', now()) + INTERVAL '1 day'
),
par_jour AS (
    SELECT
        jour,
        ROUND(AVG(taux)::numeric, 2)     AS taux_desinfection
    FROM   w
    GROUP  BY jour
),
grille AS (
    SELECT generate_series(
              date_trunc('day', now()) - INTERVAL '7 days',
              date_trunc('day', now()),
              '1 day'
           )::date AS jour
)
SELECT
    TO_CHAR(g.jour, 'FMDay')                 AS day_name,
    COALESCE(par_jour.taux_desinfection, 0)  AS taux_desinfection
FROM   grille g
LEFT   JOIN par_jour USING (jour)
ORDER  BY g.jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0].strip() for row in result], "data": [row[1] for row in result]}

@app.get("/taux_desinfection/mois")
def taux_desinfection_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(DATE_TRUNC('week', rounded_timestamp), 'YYYY-MM-DD') AS semaine_debut,
            MAX(avg_chlore) / 2.5 AS max_chlore_divise
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY DATE_TRUNC('week', rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return formater_series(result, timeframe="semaine")

@app.get("/taux_desinfection/annee")
def taux_desinfection_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(DATE_TRUNC('month', rounded_timestamp), 'Month') AS mois,
            MAX(avg_chlore) / 2.5 AS max_chlore_divise
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 year'
        GROUP BY DATE_TRUNC('month', rounded_timestamp)
        ORDER BY DATE_TRUNC('month', rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0].strip() for row in result], "data": [row[1] for row in result]}

@app.get("/pression_medianes/jour")
def pression_medianes_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT
            date_trunc('hour', horodatage) AS heure,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY pression1_mbar) AS p1_med_mbar,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY pression2_mbar) AS p2_med_mbar,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY pression3_mbar) AS p3_med_mbar,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY pression4_mbar) AS p4_med_mbar,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY pression5_mbar) AS p5_med_mbar
        FROM   mesures
        WHERE  nom_automate = %s
          AND  horodatage  >= now() - INTERVAL '24 hours'
          AND  horodatage  <  now()
        GROUP  BY heure
        ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "p1_med_mbar": [row[1] for row in result],
        "p2_med_mbar": [row[2] for row in result],
        "p3_med_mbar": [row[3] for row in result],
        "p4_med_mbar": [row[4] for row in result],
        "p5_med_mbar": [row[5] for row in result],
    }

# -------------------
# ENDPOINTS PRESSION ALL
# -------------------

@app.get("/pression_all/jour")
def pression_all_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('hour', horodatage) AS heure,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY pression1_mbar) AS p1_med_mbar,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY pression2_mbar) AS p2_med_mbar,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY pression3_mbar) AS p3_med_mbar,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY pression4_mbar) AS p4_med_mbar,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY pression5_mbar) AS p5_med_mbar
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= now() - INTERVAL '24 hours'
      AND  horodatage  <  now()
    GROUP  BY heure
    ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "p1_med_mbar": [row[1] for row in result],
        "p2_med_mbar": [row[2] for row in result],
        "p3_med_mbar": [row[3] for row in result],
        "p4_med_mbar": [row[4] for row in result],
        "p5_med_mbar": [row[5] for row in result],
    }

@app.get("/pression_all/semaine")
def pression_all_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp) AS jour,
        ROUND(AVG(avg_pression1)) AS p1_mbar,
        ROUND(AVG(avg_pression2)) AS p2_mbar,
        ROUND(AVG(avg_pression3)) AS p3_mbar,
        ROUND(AVG(avg_pression4)) AS p4_mbar,
        ROUND(AVG(avg_pression5)) AS p5_mbar
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('day', now()) - INTERVAL '6 days'
      AND  rounded_timestamp <  date_trunc('day', now()) + INTERVAL '1 day'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%A") for row in result],
        "p1_mbar": [row[1] for row in result],
        "p2_mbar": [row[2] for row in result],
        "p3_mbar": [row[3] for row in result],
        "p4_mbar": [row[4] for row in result],
        "p5_mbar": [row[5] for row in result],
    }

@app.get("/pression_all/mois")
def pression_all_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp) AS jour,
        ROUND(AVG(avg_pression1))  AS pression1_mbar,
        ROUND(AVG(avg_pression2))  AS pression2_mbar,
        ROUND(AVG(avg_pression3))  AS pression3_mbar,
        ROUND(AVG(avg_pression4))  AS pression4_mbar,
        ROUND(AVG(avg_pression5))  AS pression5_mbar
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('day', now()) - INTERVAL '30 days'
      AND  rounded_timestamp <  date_trunc('day', now()) + INTERVAL '1 day'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],
        "pression1_mbar": [row[1] for row in result],
        "pression2_mbar": [row[2] for row in result],
        "pression3_mbar": [row[3] for row in result],
        "pression4_mbar": [row[4] for row in result],
        "pression5_mbar": [row[5] for row in result],
    }

@app.get("/pression_all/annee")
def pression_all_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('month', rounded_timestamp) AS mois,
        ROUND(AVG(avg_pression1))  AS pression1_mbar,
        ROUND(AVG(avg_pression2))  AS pression2_mbar,
        ROUND(AVG(avg_pression3))  AS pression3_mbar,
        ROUND(AVG(avg_pression4))  AS pression4_mbar,
        ROUND(AVG(avg_pression5))  AS pression5_mbar
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('year', now())
      AND  rounded_timestamp <  date_trunc('year', now()) + INTERVAL '1 year'
    GROUP  BY mois
    ORDER  BY mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%B") for row in result],
        "pression1_mbar": [row[1] for row in result],
        "pression2_mbar": [row[2] for row in result],
        "pression3_mbar": [row[3] for row in result],
        "pression4_mbar": [row[4] for row in result],
        "pression5_mbar": [row[5] for row in result],
    }

# -------------------
# ENDPOINTS VOLUMES RENVOI/ADOUCIE/RELEVAGE ALL
# -------------------

@app.get("/volumes_all/jour")
def volumes_all_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            horodatage,
            nom_automate,
            compteur_eau_renvoi_m3,
            compteur_eau_adoucie_m3,
            compteur_eau_relevage_m3
        FROM   mesures
        WHERE  nom_automate = %s
          AND  horodatage   >= now() - INTERVAL '24 hours'
          AND  horodatage   <  now()
    ),
    deltas AS (
        SELECT
            date_trunc('hour', horodatage) AS heure,
            GREATEST(compteur_eau_renvoi_m3 - LAG(compteur_eau_renvoi_m3) OVER (PARTITION BY nom_automate ORDER BY horodatage), 0) AS d_renvoi_m3,
            GREATEST(compteur_eau_adoucie_m3 - LAG(compteur_eau_adoucie_m3) OVER (PARTITION BY nom_automate ORDER BY horodatage), 0) AS d_adoucie_m3,
            GREATEST(compteur_eau_relevage_m3 - LAG(compteur_eau_relevage_m3) OVER (PARTITION BY nom_automate ORDER BY horodatage), 0) AS d_relevage_m3
        FROM w
    )
    SELECT
        heure,
        ROUND(SUM(d_renvoi_m3)::numeric, 2) AS vol_renvoi_m3,
        ROUND(SUM(d_adoucie_m3)::numeric, 2) AS vol_adoucie_m3,
        ROUND(SUM(d_relevage_m3)::numeric, 2) AS vol_relevage_m3
    FROM   deltas
    GROUP  BY heure
    ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "vol_renvoi_m3": [row[1] for row in result],
        "vol_adoucie_m3": [row[2] for row in result],
        "vol_relevage_m3": [row[3] for row in result],
    }

@app.get("/volumes_all/semaine")
def volumes_all_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            rounded_timestamp,
            nom_automate,
            compteur_eau_renvoi,
            compteur_eau_adoucie,
            compteur_eau_relevage
        FROM   moyenne
        WHERE  nom_automate = %s
          AND  rounded_timestamp >= date_trunc('day', now()) - INTERVAL '6 days'
          AND  rounded_timestamp <  date_trunc('day', now()) + INTERVAL '1 day'
    ),
    deltas AS (
        SELECT
            date_trunc('day', rounded_timestamp) AS jour,
            GREATEST(compteur_eau_renvoi - LAG(compteur_eau_renvoi) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_renvoi_m3,
            GREATEST(compteur_eau_adoucie - LAG(compteur_eau_adoucie) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_adoucie_m3,
            GREATEST(compteur_eau_relevage - LAG(compteur_eau_relevage) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_relevage_m3
        FROM w
    )
    SELECT
        jour,
        ROUND(SUM(d_renvoi_m3)::numeric, 2) AS vol_renvoi_m3,
        ROUND(SUM(d_adoucie_m3)::numeric, 2) AS vol_adoucie_m3,
        ROUND(SUM(d_relevage_m3)::numeric, 2) AS vol_relevage_m3
    FROM   deltas
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%A") for row in result],
        "vol_renvoi_m3": [row[1] for row in result],
        "vol_adoucie_m3": [row[2] for row in result],
        "vol_relevage_m3": [row[3] for row in result],
    }

@app.get("/volumes_all/mois")
def volumes_all_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            rounded_timestamp,
            nom_automate,
            compteur_eau_renvoi,
            compteur_eau_adoucie,
            compteur_eau_relevage
        FROM   moyenne
        WHERE  nom_automate = %s
          AND  rounded_timestamp >= date_trunc('month', now())
          AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    ),
    deltas AS (
        SELECT
            date_trunc('day', rounded_timestamp) AS jour,
            GREATEST(compteur_eau_renvoi - LAG(compteur_eau_renvoi) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_renvoi_m3,
            GREATEST(compteur_eau_adoucie - LAG(compteur_eau_adoucie) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_adoucie_m3,
            GREATEST(compteur_eau_relevage - LAG(compteur_eau_relevage) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_relevage_m3
        FROM w
    )
    SELECT
        jour,
        ROUND(SUM(d_renvoi_m3)::numeric, 2) AS vol_renvoi_m3,
        ROUND(SUM(d_adoucie_m3)::numeric, 2) AS vol_adoucie_m3,
        ROUND(SUM(d_relevage_m3)::numeric, 2) AS vol_relevage_m3
    FROM   deltas
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],
        "vol_renvoi_m3": [row[1] for row in result],
        "vol_adoucie_m3": [row[2] for row in result],
        "vol_relevage_m3": [row[3] for row in result],
    }

@app.get("/volumes_all/annee")
def volumes_all_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            rounded_timestamp,
            nom_automate,
            compteur_eau_renvoi,
            compteur_eau_adoucie,
            compteur_eau_relevage
        FROM   moyenne
        WHERE  nom_automate = %s
          AND  rounded_timestamp >= date_trunc('year', now())
          AND  rounded_timestamp <  date_trunc('year', now()) + INTERVAL '1 year'
    ),
    deltas AS (
        SELECT
            date_trunc('month', rounded_timestamp) AS mois,
            GREATEST(compteur_eau_renvoi - LAG(compteur_eau_renvoi) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_renvoi_m3,
            GREATEST(compteur_eau_adoucie - LAG(compteur_eau_adoucie) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_adoucie_m3,
            GREATEST(compteur_eau_relevage - LAG(compteur_eau_relevage) OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp), 0) AS d_relevage_m3
        FROM w
    )
    SELECT
        mois,
        ROUND(SUM(d_renvoi_m3)::numeric, 2) AS vol_renvoi_m3,
        ROUND(SUM(d_adoucie_m3)::numeric, 2) AS vol_adoucie_m3,
        ROUND(SUM(d_relevage_m3)::numeric, 2) AS vol_relevage_m3
    FROM   deltas
    GROUP  BY mois
    ORDER  BY mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%B") for row in result],
        "vol_renvoi_m3": [row[1] for row in result],
        "vol_adoucie_m3": [row[2] for row in result],
        "vol_relevage_m3": [row[3] for row in result],
    }

# -------------------
# ENDPOINTS TEMPÉRATURE
# -------------------

@app.get("/temperature/jour")
def temperature_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('hour', horodatage) AS heure,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY temperature_deg) AS temp_med_C
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= now() - INTERVAL '24 hours'
      AND  horodatage  <  now()
    GROUP  BY heure
    ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/temperature/semaine")
def temperature_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp)      AS jour,
        ROUND(AVG(avg_temperature)::numeric, 1)   AS temp_moy_C
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('day', now()) - INTERVAL '6 days'
      AND  rounded_timestamp <  date_trunc('day', now()) + INTERVAL '1 day'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%A") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/temperature/mois")
def temperature_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp)        AS jour,
        ROUND(AVG(avg_temperature)::numeric, 1)     AS temp_moy_C
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('month', now())
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/temperature/annee")
def temperature_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('month', rounded_timestamp)      AS mois,
        ROUND(AVG(avg_temperature)::numeric, 1)     AS temp_moy_C
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('year', now())
      AND  rounded_timestamp <  date_trunc('year', now()) + INTERVAL '1 year'
    GROUP  BY mois
    ORDER  BY mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%B") for row in result],
        "data": [row[1] for row in result],
    }

# -------------------
# ENDPOINTS CHLORE
# -------------------

@app.get("/chlore/jour")
def chlore_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('hour', horodatage) AS heure,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY chlore_mv) AS chlore_med_mv
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage  >= now() - INTERVAL '24 hours'
      AND  horodatage  <  now()
    GROUP  BY heure
    ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/chlore/semaine")
def chlore_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp)     AS jour,
        ROUND(AVG(avg_chlore)::numeric, 2)       AS chlore_moy_mg_L
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('day', now()) - INTERVAL '6 days'
      AND  rounded_timestamp <  date_trunc('day', now()) + INTERVAL '1 day'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%A") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/chlore/mois")
def chlore_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp)      AS jour,
        ROUND(AVG(avg_chlore)::numeric, 2)        AS chlore_moy_mg_L
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('month', now())
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/chlore/annee")
def chlore_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('month', rounded_timestamp)    AS mois,
        ROUND(AVG(avg_chlore)::numeric, 2)        AS chlore_moy_mg_L
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('year', now())
      AND  rounded_timestamp <  date_trunc('year', now()) + INTERVAL '1 year'
    GROUP  BY mois
    ORDER  BY mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%B") for row in result],
        "data": [row[1] for row in result],
    }

# -------------------
# ENDPOINTS PH
# -------------------

@app.get("/ph/jour")
def ph_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('hour', horodatage) AS heure,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ph) AS ph_mediane
    FROM   mesures
    WHERE  nom_automate = %s
      AND  horodatage   >= now() - INTERVAL '24 hours'
      AND  horodatage   <  now()
    GROUP  BY heure
    ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/ph/semaine")
def ph_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', horodatage)      AS jour,
        ROUND(AVG(ph)::numeric, 2)         AS ph_moyen
    FROM   mesures
    WHERE  nom_automate  = %s
      AND  horodatage   >= date_trunc('day', now()) - INTERVAL '6 days'
      AND  horodatage   <  date_trunc('day', now()) + INTERVAL '1 day'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%A") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/ph/mois")
def ph_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('day', rounded_timestamp)   AS jour,
        ROUND(AVG(avg_ph)::numeric, 2)         AS ph_moyen
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('month', now())
      AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/ph/annee")
def ph_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    SELECT
        date_trunc('month', rounded_timestamp) AS mois,
        ROUND(AVG(avg_ph)::numeric, 2)         AS ph_moyen
    FROM   moyenne
    WHERE  nom_automate = %s
      AND  rounded_timestamp >= date_trunc('year', now())
      AND  rounded_timestamp <  date_trunc('year', now()) + INTERVAL '1 year'
    GROUP  BY mois
    ORDER  BY mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%B") for row in result],
        "data": [row[1] for row in result],
    }

# -------------------
# ENDPOINTS COMPTEUR ÉLECTRIQUE
# -------------------

@app.get("/compteur_elec/jour")
def compteur_elec_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            horodatage,
            nom_automate,
            compteur_electrique_kwh
        FROM   mesures
        WHERE  nom_automate = %s
          AND  horodatage  >= now() - INTERVAL '24 hours'
          AND  horodatage  <  now()
    ),
    deltas AS (
        SELECT
            date_trunc('hour', horodatage) AS heure,
            GREATEST(
                compteur_electrique_kwh
              - LAG(compteur_electrique_kwh)
                  OVER (PARTITION BY nom_automate ORDER BY horodatage),
                0
            ) AS d_kwh
        FROM w
    )
    SELECT
        heure,
        ROUND(SUM(d_kwh)::numeric, 2) AS conso_kwh
    FROM   deltas
    GROUP  BY heure
    ORDER  BY heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%H:%M") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/compteur_elec/semaine")
def compteur_elec_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            rounded_timestamp,
            nom_automate,
            compteur_electrique
        FROM   moyenne
        WHERE  nom_automate = %s
          AND  rounded_timestamp >= date_trunc('day', now()) - INTERVAL '6 days'
          AND  rounded_timestamp <  date_trunc('day', now()) + INTERVAL '1 day'
    ),
    deltas AS (
        SELECT
            date_trunc('day', rounded_timestamp) AS jour,
            GREATEST(
                compteur_electrique
              - LAG(compteur_electrique)
                  OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp),
                0
            ) AS d_kwh
        FROM w
    )
    SELECT
        jour,
        ROUND(SUM(d_kwh)::numeric, 2) AS conso_kwh
    FROM   deltas
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%A") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/compteur_elec/mois")
def compteur_elec_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            rounded_timestamp,
            nom_automate,
            compteur_electrique
        FROM   moyenne
        WHERE  nom_automate = %s
          AND  rounded_timestamp >= date_trunc('month', now())
          AND  rounded_timestamp <  date_trunc('month', now()) + INTERVAL '1 month'
    ),
    deltas AS (
        SELECT
            date_trunc('day', rounded_timestamp) AS jour,
            GREATEST(
                compteur_electrique
              - LAG(compteur_electrique)
                  OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp),
                0
            ) AS d_kwh
        FROM w
    )
    SELECT
        jour,
        ROUND(SUM(d_kwh)::numeric, 2) AS conso_kwh
    FROM   deltas
    GROUP  BY jour
    ORDER  BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%Y-%m-%d") for row in result],
        "data": [row[1] for row in result],
    }

@app.get("/compteur_elec/annee")
def compteur_elec_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
    WITH w AS (
        SELECT
            rounded_timestamp,
            nom_automate,
            compteur_electrique
        FROM   moyenne
        WHERE  nom_automate = %s
          AND  rounded_timestamp >= date_trunc('year', now())
          AND  rounded_timestamp <  date_trunc('year', now()) + INTERVAL '1 year'
    ),
    deltas AS (
        SELECT
            date_trunc('month', rounded_timestamp) AS mois,
            GREATEST(
                compteur_electrique
              - LAG(compteur_electrique)
                  OVER (PARTITION BY nom_automate ORDER BY rounded_timestamp),
                0
            ) AS d_kwh
        FROM w
    )
    SELECT
        mois,
        ROUND(SUM(d_kwh)::numeric, 2) AS conso_kwh
    FROM   deltas
    GROUP  BY mois
    ORDER  BY mois;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {
        "labels": [row[0].strftime("%B") for row in result],
        "data": [row[1] for row in result],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)