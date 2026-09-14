RAIL EMPIRE v1.1.15 — RAILNET EUROPE GAMEPLAY NATIVE
=====================================================

UTILISATION
-----------
1. Extraire tout le ZIP dans un dossier neuf.
2. Ouvrir index.html.
3. Créer ou charger une partie normalement.

Aucune commande .cmd, aucun préparateur et aucun téléchargement de gares n'est nécessaire.

GARES
-----
- 17 817 gares ferroviaires européennes RailNet intégrées.
- Elles sont de vraies gares gameplay dès le chargement : world.stations.
- Elles ne nécessitent aucun double-clic d'activation.
- La couche de référence séparée n'est pas utilisée pour ces gares.

SAUVEGARDES
-----------
Les gares RailNet natives non modifiées sont reconstruites depuis les données locales et ne
sont pas recopiées intégralement dans chaque sauvegarde. Les modifications/suppressions sont
conservées sous forme de delta.

CORRECTIF 1.1.15
----------------
La 1.1.14 avait accidentellement perdu des méthodes centrales d'initialisation du catalogue,
ce qui pouvait interrompre startGame(). La 1.1.15 les restaure et ajoute un test de contrat
de démarrage empêchant cette régression de repasser silencieusement.

NE PAS UTILISER LA v1.1.14.
