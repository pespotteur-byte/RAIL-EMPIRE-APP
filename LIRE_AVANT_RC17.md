# Rail Empire RC17 FULL — installation et migration

**Version complète, 87/87 dossiers historiques clos sur les critères documentés.** Pas d’édition LIGHT.

Avant de lancer RC17, exporter la partie depuis RC16 et conserver cette copie, ainsi que l’archive RC16. Fermer ses onglets et son serveur. Extraire RC17 dans un nouveau dossier sans superposition, puis utiliser `LANCER_RE.cmd` ou `node scripts/serve-local.cjs` lorsqu’un Node compatible est disponible. Garder le même protocole, la même adresse et le même port (habituellement `http://127.0.0.1:8765/`). **Ne pas vider les données du site.**

## Reprise de partie

Le rattrapage travaille vers l’heure réelle à partir du curseur sauvegardé. Le bandeau « Rattrapage chronologique » montre le temps restant. Il peut persister après une longue absence ; les événements ne sont pas sautés pour faire disparaître ce retard. Les coordonnées, vitesses, efforts et états opérationnels nouveaux sont conservés exactement à partir de RC17. Les informations déjà perdues par une ancienne version ne peuvent pas être recréées.

La simulation physique reçoit désormais la même cadence hors champ. Un grand réseau peut donc demander plus de CPU qu’avec l’ancien mouvement distant grossier. Aucun gain de FPS ou rattrapage instantané n’est promis.

## Secours

Les caractéristiques de locomotive, le parcours réel, les cantons, les travaux, la traction et le carburant conditionnent le départ et la progression. Une attente explicite peut révéler une incohérence qu’une ancienne version ignorait. Ne pas supprimer des occupations pour forcer un secours à traverser un conflit. Un dépôt plein garde le convoi immobilisé à l’arrivée. Un état physique importé invalide suspend la mission plutôt que de téléporter le matériel ou de libérer ses voies.

Les données OSM/ORM externes ne sont pas fabriquées et un refus 403 n’est pas contourné. Les protections des versions précédentes sont conservées.

## Retour arrière

Utiliser l’export fait **avant migration**. RC16 ne sait pas assurer la reprise exacte de tous les nouveaux champs de mouvement et de secours. Ne pas utiliser deux versions simultanément sur la même origine. Les précautions de catalogue administrateur introduites en RC14 restent applicables : les données administrateur ne sont pas toutes dans l’export ordinaire de partie.

## Qualification

836 tests de réparation et 102 834 tests standard passent ; les nombres se recouvrent. S3 : 264/264 fichiers actifs. Navigateur : véritables bundles dans Chromium isolé, 15 pages et 600 trains. Ni Opera/Win7, ni le disque natif personnel, ni l’accès réel OSM ne sont certifiés ici. Lire le rapport et le registre RC17 pour la portée exacte des clôtures.
