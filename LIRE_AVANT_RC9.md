# Rail Empire — RC9

Build : `S3_GAMEPLAY_REPAIR_RC9_1199repair9`. Base : votre archive RC8 complète.

## Première ouverture : préserver la partie

**Dans RC8, exportez d’abord la sauvegarde sur votre ordinateur.** Gardez RC8, ses données de navigateur et le fichier exporté. Extrayez RC9 dans un nouveau dossier, sans mélanger les versions.

Sous Windows, ouvrez `LANCER_RE.cmd`, puis gardez la fenêtre du lanceur ouverte. Il propose l’adresse `http://127.0.0.1:8765/index.html`. Ne changez ni d’hôte ni de port pour retrouver le même stockage local. Importez votre sauvegarde dans ce lancement HTTP : les données associées à `file://` ne sont pas automatiquement transférées. Un accueil vide n’est donc pas une suppression de votre ancienne partie.

Le lanceur PowerShell/C# n’a pas été exécuté sous votre Windows 7/Opera dans l’environnement de qualification. En cas d’échec, son message reste affiché. L’alternative `node scripts/serve-local.cjs`, avec Node.js déjà installé, a été testée en local sous Linux. Ni installation de dépendances ni accès administrateur ne sont nécessaires pour jouer avec les bundles fournis.

## Fond OSM et couche ORM

Le panneau « Fond OSM » de la LiveMap affiche séparément l’état du fond et de la couche ferroviaire ORM. Un HTTP 403 effectivement lisible arrête le fournisseur et ses chargements en cours ; aucun nouvel essai automatique n’est tenté. Une reprise manuelle ne devient possible qu’après au moins quinze minutes et après correction de la cause. Ce délai ne garantit pas une levée du blocage côté fournisseur.

Un 429 temporise les demandes, avec respect de `Retry-After` lorsqu’il est lisible. Un statut inaccessible pour cause de CORS est présenté comme tel, sans inventer un code HTTP. Le cache et les tuiles déjà chargées sont conservés lors des changements de style. Une pause ne désactive ni les trains ni les horaires.

En lancement direct par `index.html` / `file://`, le fond OSM standard est suspendu préventivement : utilisez une vraie origine HTTP locale. La couche ORM et le graphe vectoriel du calculateur ne sont pas le même composant. Ce chantier concerne les images de carte ; il ne refond pas les requêtes Overpass ou le routage longue distance.

Un fournisseur XYZ personnel ou autorisé peut être configuré avec son attribution et son zoom natif. Le jeu ne choisit pas secrètement un autre serveur et ne contourne pas un refus par un relais ou un faux référent. N’entrez pas de secret privé dans une URL visible du navigateur.

Le guide `AIDE_CARTE_OSM.html` détaille les états, le lancement et les références officielles. `RE_REPARATION_RC9_RAPPORT.md` contient les résultats et les limites. Les sources TypeScript, les bundles reconstruits, les ressources et les preuves de qualification figurent dans cette archive.
