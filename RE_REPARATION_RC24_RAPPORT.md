# Rail Empire S3 — RC24 FULL

## Objet
RC24 ajoute trois fonctionnalités demandées sur la base RC23 FULL, sans retirer les fonctions existantes :

1. **Quartier général (QG)** avec cumuls historiques de fret livré et de voyageurs transportés, plus une vue des trains en exploitation et de leurs compositions.
2. **Random 750 m avec maximum d'engins**, et remélange des wagons au départ si le Random a été utilisé, sans déplacer les locomotives.
3. **Infogare Rail Empire** entièrement remplacé par un panneau natif RE à défilement vertical continu et horizon extensible.

## Quartier général
- Nouvelle page `qg` dans la navigation et l'aide contextuelle.
- Les cumuls utilisent les compteurs persistants de la partie. Le fret complet utilise le compteur cargo lorsqu'il est disponible afin d'éviter le double comptage des contrats et du fret ordinaire.
- Les voyageurs sont issus du compteur de voyageurs réellement transportés.
- Les trains actifs affichent nom/numéro, origine et destination, heures prévues et composition visuelle.
- Les images proviennent des éléments de rame réellement affectés ; les trains achevés ou non encore matérialisés ne sont pas présentés comme actifs.
- La liste est verticale ; les compositions longues peuvent déborder horizontalement sans écraser les sprites.

## Random 750 m
- Le champ « maximum d'engins » est optionnel et compte les locomotives.
- La contrainte de 750 m reste obligatoire.
- Quand le Random est utilisé, la rame peut être marquée pour remélange aux prochains départs.
- Seuls les wagons déjà présents sont réordonnés ; les locomotives gardent leur position.
- Identifiants, livrées, masses, capacités et longueur totale sont conservés.
- Le remélange n'a lieu qu'après autorisation effective d'une nouvelle course, pas pendant une attente au départ ni à chaque tick.
- Les arrêts intermédiaires ne déclenchent pas de nouveau mélange.

## Infogare Rail Empire
- L'ancien sélecteur de panneaux photographiques est retiré de l'interface principale.
- Nouveau panneau natif RE avec Départs / Arrivées, heure, destination/provenance, desserte, état et voie.
- Liste verticale continue ; aucune boucle artificielle vers le début.
- Horizon initial puis chargement de 24 h supplémentaires à la demande ou en approchant de la fin de liste.
- Les prévisions suivent les horaires et jours de circulation disponibles ; elles ne dupliquent pas aveuglément une journée.
- Le rendu est borné au DOM utile afin de limiter le coût sur les grosses listes.

## Validation finale
- `npm run build:repair` : réussi.
- TypeScript + configurations historiques : réussi.
- Suite de réparation : **1084/1084**.
- Suite standard : **102834/102834**.
- Régression S3 : **277/277 fichiers actifs**, dont 240 fonctionnels et 37 timing, exécutés en isolation de processus.
- Reconstruction indépendante : **132 modules JS + 132 déclarations + 3 bundles**, sans différence avec la construction livrée.
- Ressources originales comparées à RC23 : **37152 inchangées**, hors CSS volontairement modifiée.
- Contrôle navigateur ciblé RC24 : QG, Infogare et Random passent sans erreur.
- Contrôle navigateur historique enregistré : **600/600 trains** progressent aux quatre observations pendant les changements de page ; cycle de secours, stockage, OSM et replay précédents repassent dans ce banc.
- Ouverture native `file://` : non exécutable dans l'environnement de QA (`ERR_BLOCKED_BY_ADMINISTRATOR`). RC24 conserve toutefois le bundle prévu pour l'ouverture directe de `index.html`.

## Performance
L'ajout des trois fonctions avait initialement fait dépasser légèrement le budget historique du bundle de démarrage. Une passe d'allègement a ramené `rail-empire.file.bundle.js` d'environ **5,72 Mo à 5,35 Mo**, sans retirer de fonctionnalité. Le test de budget repasse.

## Limites
- L'environnement de QA ne certifie pas Opera/Windows 7 ni le quota disque réel du navigateur.
- Les services externes (OSM, météo, etc.) sont simulés ou bloqués dans certains tests ; aucune levée de 403 externe n'est garantie.
- Les cumuls historiques ne peuvent pas recréer des données qui auraient été supprimées avant qu'un compteur persistant n'existe.
- Le nombre d'éléments affichables au QG/Infogare dépend toujours des capacités de la machine, même si le rendu évite des travaux inutiles.

