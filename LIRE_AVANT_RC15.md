# Rail Empire RC15 — édition FULL uniquement

## Installation

Exporter la partie depuis RC14 et conserver cet export ainsi que l’archive RC14 FULL. Fermer les anciens onglets du jeu et arrêter leur serveur local. Extraire `Rail_Empire_S3_GAMEPLAY_REPAIR_RC15.zip` dans un nouveau dossier, sans mélanger les versions. Lancer `LANCER_RE.cmd` et garder l’adresse et le port utilisés précédemment (habituellement `http://127.0.0.1:8765/`). L’alternative Node demeure `node scripts/serve-local.cjs`.

Ne pas vider les données du site. L’installation n’exige ni purge de cache ni suppression de partie. Les optimisations de stockage de RC14 sont conservées ; le bouton Stockage → Optimiser sans supprimer reste disponible. RC15 ne produit pas d’édition LIGHT.

## Retour arrière et formats

Le codec compact reste celui des versions précédentes, mais RC15 ajoute des champs d’état du secours : ownership de remorquage, véhicules pris en charge, occurrences interrompues et formations stationnées. **La conservation fonctionnelle de ces états par RC14 n’est pas garantie.** Pour revenir à RC14, utiliser l’export conservé AVANT migration ; ne pas ouvrir les deux versions simultanément. Les restrictions historiques de compatibilité de l’administration RC13/RC14 restent celles du guide RC14.

## À surveiller après import

Un ancien retour de secours sans remorquage confirmé repart chercher le train à sa position connue. Il ne le téléporte pas au dépôt. La disponibilité du routage demeure nécessaire et un refus du fournisseur reste possible.

Un dépôt plein retient le convoi et sa locomotive. Une fois réceptionné, le service en panne est interrompu : réparer le matériel ne remet pas cette ancienne circulation en route. Les rames persistantes apparaissent au dépôt ; les formations d’engins individuels figurent dans « Formations physiques remorquées ». Elles conservent leurs identités de roulement et restent indisponibles jusqu’à la réparation. Un nouvel acheminement explicite depuis le dépôt est nécessaire.

## Limites de cette livraison

Le déplacement du train remorqué est corrigé, mais le contrôleur ferroviaire complet des secours, le replay après une longue absence et le blocage personnel vers 12 km/h restent ouverts/partiels. Le convoi emploie un point de référence commun, pas une géométrie d’attelages séparés. Aucune levée de la 403 OSM ni validation sous Opera/Windows 7 n’est annoncée.

Lire `RE_REPARATION_RC15_RAPPORT.md`, `RE_REGISTRE_CORRECTIONS_RC15.md` et `QA/RE_REPAIR_RC15/SUMMARY.json`. Le ZIP contient le jeu, toutes les sources et l’historique ; son poids ne représente pas le quota de sauvegarde du navigateur.
