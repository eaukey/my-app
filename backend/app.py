from fastapi import FastAPI, Query
from typing import List, Tuple
import psycopg2
from fastapi.middleware.cors import CORSMiddleware

# Création de l'instance FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Autorisez cette origine
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
def calculer_consommation_par_intervalle(resultat_sql: List[Tuple]) -> dict:
    if not resultat_sql or len(resultat_sql) < 2:
        return {"labels": [], "data": []}

    labels = []
    data = []
    for i in range(1, len(resultat_sql)):
        intervalle_actuel = resultat_sql[i][0]
        valeur_actuelle = resultat_sql[i][1]
        valeur_precedente = resultat_sql[i - 1][1]
        consommation = max(valeur_actuelle - valeur_precedente, 0)
        labels.append(intervalle_actuel)
        data.append(consommation)

    return {"labels": labels, "data": data}

# Calcul du taux de recyclage par intervalle
def calculer_taux_recyclage_par_intervalle(resultats_adoucie, resultats_relevage):
    if not resultats_adoucie or not resultats_relevage:
        return {"labels": [], "data": []}

    labels = []
    taux_recyclage = []

    for i in range(1, len(resultats_adoucie)):
        # Calcul des volumes d'eau adoucie et relevage pour l'intervalle
        intervalle_actuel = resultats_adoucie[i][0]  # Date ou heure selon l'intervalle
        volume_adoucie = max(resultats_adoucie[i][1] - resultats_adoucie[i - 1][1], 0)
        volume_relevage = max(resultats_relevage[i][1] - resultats_relevage[i - 1][1], 0)

        # Calcul du taux de recyclage pour l'intervalle
        if volume_relevage > 0:  # Éviter une division par zéro
            taux = 1 - (volume_adoucie / volume_relevage) * 100
        else:
            taux = 0

        labels.append(intervalle_actuel)
        taux_recyclage.append(max(taux, 0)*100)  # Évite les valeurs négatives

    return {"labels": labels, "data": taux_recyclage}

# Endpoints pour renvoi
@app.get("/renvoi/jour")
def volume_renvoi_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT DATE(rounded_timestamp) AS jour,  
               MAX(compteur_eau_renvoi) AS derniere_valeur,
               EXTRACT(HOUR FROM rounded_timestamp) AS heure
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY DATE(rounded_timestamp), EXTRACT(HOUR FROM rounded_timestamp)
        ORDER BY jour, heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

@app.get("/renvoi/semaine")
def volume_renvoi_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT DATE(rounded_timestamp) AS jour, 
               MAX(compteur_eau_renvoi) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(rounded_timestamp)
        ORDER BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

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
    return calculer_consommation_par_intervalle(result)


@app.get("/renvoi/annee")
def volume_renvoi_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT DISTINCT ON (DATE_TRUNC('month', rounded_timestamp)) 
       DATE_TRUNC('month', rounded_timestamp)::DATE AS mois_debut, 
       MAX(compteur_eau_renvoi) AS derniere_valeur
FROM moyenne
WHERE nom_automate = %s 
  AND rounded_timestamp >= NOW() - INTERVAL '1 year'
GROUP BY DATE_TRUNC('month', rounded_timestamp)
ORDER BY DATE_TRUNC('month', rounded_timestamp), MAX(rounded_timestamp) DESC;

    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)


@app.get("/adoucie/jour")
def volume_adoucie_jour(nom_automate: str = Query(...)):
    query = """
        SELECT DATE(rounded_timestamp) AS jour,  
               MAX(compteur_eau_adoucie) AS derniere_valeur,
               EXTRACT(HOUR FROM rounded_timestamp) AS heure
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY DATE(rounded_timestamp), EXTRACT(HOUR FROM rounded_timestamp)
        ORDER BY jour, heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

@app.get("/adoucie/semaine")
def volume_adoucie_semaine(nom_automate: str = Query(...)):
    query = """
        SELECT DATE(rounded_timestamp) AS jour, 
               MAX(compteur_eau_adoucie) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(rounded_timestamp)
        ORDER BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

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
    return calculer_consommation_par_intervalle(result)

@app.get("/adoucie/annee")
def volume_adoucie_annee(nom_automate: str = Query(...)):
    query = """
        SELECT DISTINCT ON (DATE_TRUNC('month', rounded_timestamp)) 
       DATE_TRUNC('month', rounded_timestamp)::DATE AS mois_debut, 
       MAX(compteur_eau_adoucie) AS derniere_valeur
FROM moyenne
WHERE nom_automate = %s 
  AND rounded_timestamp >= NOW() - INTERVAL '1 year'
GROUP BY DATE_TRUNC('month', rounded_timestamp)
ORDER BY DATE_TRUNC('month', rounded_timestamp), MAX(rounded_timestamp) DESC;

    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

@app.get("/relevage/jour")
def volume_relevage_jour(nom_automate: str = Query(...)):
    query = """
        SELECT DATE(rounded_timestamp) AS jour,  
               MAX(compteur_eau_relevage) AS derniere_valeur,
               EXTRACT(HOUR FROM rounded_timestamp) AS heure
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY DATE(rounded_timestamp), EXTRACT(HOUR FROM rounded_timestamp)
        ORDER BY jour, heure;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

@app.get("/relevage/semaine")
def volume_relevage_semaine(nom_automate: str = Query(...)):
    query = """
        SELECT DATE(rounded_timestamp) AS jour, 
               MAX(compteur_eau_relevage) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(rounded_timestamp)
        ORDER BY jour;
    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

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
    return calculer_consommation_par_intervalle(result)

@app.get("/relevage/annee")
def volume_relevage_annee(nom_automate: str = Query(...)):
    query = """
        SELECT DISTINCT ON (DATE_TRUNC('month', rounded_timestamp)) 
       DATE_TRUNC('month', rounded_timestamp)::DATE AS mois_debut, 
       MAX(compteur_eau_relevage) AS derniere_valeur
FROM moyenne
WHERE nom_automate = %s 
  AND rounded_timestamp >= NOW() - INTERVAL '1 year'
GROUP BY DATE_TRUNC('month', rounded_timestamp)
ORDER BY DATE_TRUNC('month', rounded_timestamp), MAX(rounded_timestamp) DESC;

    """
    result = executer_requete_sql(query, (nom_automate,))
    return calculer_consommation_par_intervalle(result)

@app.get("/avg_pression5/jour")
def avg_pression5_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    """
    Retourne la moyenne horaire de avg_pression5 pour les dernières 24 heures glissantes.
    Les labels affichent uniquement le numéro de l'heure (0 à 23).
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
        "labels": [int(row[0]) for row in result],  # Convertit les heures en entiers (0 à 23)
        "data": [float(row[1]) for row in result]  # Moyenne pression
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
            'Semaine ' || EXTRACT(WEEK FROM rounded_timestamp) AS semaine,
            AVG(avg_pression5) AS moyenne_pression
        FROM moyenne
        WHERE nom_automate = %s
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY EXTRACT(WEEK FROM rounded_timestamp)
        ORDER BY MIN(rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0] for row in result], "data": [row[1] for row in result]}

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
    query_adoucie = """
        SELECT DATE(rounded_timestamp) AS jour, 
               EXTRACT(HOUR FROM rounded_timestamp) AS heure, 
               MAX(compteur_eau_adoucie) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY DATE(rounded_timestamp), EXTRACT(HOUR FROM rounded_timestamp)
        ORDER BY jour, heure;
    """

    query_renvoi = """
        SELECT DATE(rounded_timestamp) AS jour, 
               EXTRACT(HOUR FROM rounded_timestamp) AS heure, 
               MAX(compteur_eau_renvoi) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY DATE(rounded_timestamp), EXTRACT(HOUR FROM rounded_timestamp)
        ORDER BY jour, heure;
    """

    # Exécution des requêtes pour les volumes d'eau adoucie et relevée
    resultats_adoucie = executer_requete_sql(query_adoucie, (nom_automate,))
    resultats_renvoi = executer_requete_sql(query_renvoi, (nom_automate,))

    # Calcul du taux de recyclage
    taux_recyclage = calculer_taux_recyclage_par_intervalle(resultats_adoucie, resultats_renvoi)

    return taux_recyclage

@app.get("/taux_recyclage/semaine")
def taux_recyclage_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query_adoucie = """
        SELECT DATE(rounded_timestamp) AS jour, 
               MAX(compteur_eau_adoucie) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(rounded_timestamp)
        ORDER BY jour;
    """

    query_renvoi = """
        SELECT DATE(rounded_timestamp) AS jour, 
               MAX(compteur_eau_renvoi) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(rounded_timestamp)
        ORDER BY jour;
    """

    # Exécution des requêtes pour les volumes d'eau adoucie et relevée
    resultats_adoucie = executer_requete_sql(query_adoucie, (nom_automate,))
    resultats_renvoi = executer_requete_sql(query_renvoi, (nom_automate,))

    # Calcul du taux de recyclage par jour
    taux_recyclage = calculer_taux_recyclage_par_intervalle(resultats_adoucie, resultats_renvoi)

    return taux_recyclage


@app.get("/taux_recyclage/mois")
def taux_recyclage_mois(nom_automate: str = Query(..., description="Nom de l'automate")):
    query_adoucie = """
        SELECT DATE_TRUNC('week', rounded_timestamp)::DATE AS semaine, 
               MAX(compteur_eau_adoucie) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY semaine;
    """

    query_renvoi = """
        SELECT DATE_TRUNC('week', rounded_timestamp)::DATE AS semaine, 
               MAX(compteur_eau_renvoi) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 month'
        GROUP BY DATE_TRUNC('week', rounded_timestamp)
        ORDER BY semaine;
    """

    # Exécution des requêtes pour les volumes d'eau adoucie et relevée
    resultats_adoucie = executer_requete_sql(query_adoucie, (nom_automate,))
    resultats_renvoi = executer_requete_sql(query_renvoi, (nom_automate,))

    # Calcul du taux de recyclage par semaine
    taux_recyclage = calculer_taux_recyclage_par_intervalle(resultats_adoucie, resultats_renvoi)

    return taux_recyclage


@app.get("/taux_recyclage/annee")
def taux_recyclage_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query_adoucie = """
        SELECT DATE_TRUNC('month', rounded_timestamp)::DATE AS mois, 
               MAX(compteur_eau_adoucie) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 year'
        GROUP BY DATE_TRUNC('month', rounded_timestamp)
        ORDER BY mois;
    """

    query_renvoi = """
        SELECT DATE_TRUNC('month', rounded_timestamp)::DATE AS mois, 
               MAX(compteur_eau_renvoi) AS derniere_valeur
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 year'
        GROUP BY DATE_TRUNC('month', rounded_timestamp)
        ORDER BY mois;
    """

    # Exécution des requêtes pour les volumes d'eau adoucie et relevée
    resultats_adoucie = executer_requete_sql(query_adoucie, (nom_automate,))
    resultats_renvoi = executer_requete_sql(query_renvoi, (nom_automate,))

    # Calcul du taux de recyclage par mois
    taux_recyclage = calculer_taux_recyclage_par_intervalle(resultats_adoucie, resultats_renvoi)

    return taux_recyclage


@app.get("/taux_desinfection/jour")
def taux_desinfection_jour(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(rounded_timestamp, 'HH24') AS heure,
            MAX(avg_chlore) / 2.5 AS max_chlore_divise
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 day'
        GROUP BY TO_CHAR(rounded_timestamp, 'HH24')
        ORDER BY TO_CHAR(rounded_timestamp, 'HH24');
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [f"{row[0]}:00" for row in result], "data": [row[1] for row in result]}

@app.get("/taux_desinfection/semaine")
def taux_desinfection_semaine(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(DATE(rounded_timestamp), 'YYYY-MM-DD') AS jour,
            MAX(avg_chlore) / 2.5 AS max_chlore_divise
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(rounded_timestamp)
        ORDER BY DATE(rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0] for row in result], "data": [row[1] for row in result]}

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
    return {"labels": [row[0] for row in result], "data": [row[1] for row in result]}

@app.get("/taux_desinfection/annee")
def taux_desinfection_annee(nom_automate: str = Query(..., description="Nom de l'automate")):
    query = """
        SELECT 
            TO_CHAR(DATE_TRUNC('month', rounded_timestamp), 'YYYY-MM') AS mois,
            MAX(avg_chlore) / 2.5 AS max_chlore_divise
        FROM moyenne
        WHERE nom_automate = %s 
          AND rounded_timestamp >= NOW() - INTERVAL '1 year'
        GROUP BY DATE_TRUNC('month', rounded_timestamp)
        ORDER BY DATE_TRUNC('month', rounded_timestamp);
    """
    result = executer_requete_sql(query, (nom_automate,))
    return {"labels": [row[0] for row in result], "data": [row[1] for row in result]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
