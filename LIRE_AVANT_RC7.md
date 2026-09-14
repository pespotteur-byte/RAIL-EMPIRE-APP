# Rail Empire — RC7

Cette archive est le jeu complet. Conserver RC6R et exporter sa sauvegarde avant le premier essai. Extraire RC7 dans un nouveau dossier, sans fusionner avec une autre version, puis ouvrir `index.html`. Le jeu est déjà compilé : Node/TypeScript ne sont pas nécessaires pour jouer. Commencer avec une copie de partie.

La RC7 répare le freinage imposé aux passages sans arrêt, l’ancienne clé de route pouvant retarder le changement de liaison, les kilomètres facturés sur un retour indépendant, et complète les protections physiques du mouvement et de l’arrière des trains. Les limites physiques rétablies peuvent ralentir une rame qui profitait d’un comportement antérieur incorrect. Le cas utilisateur du blocage durable à 12 km/h reste partiel.

Rapport : `RE_REPARATION_RC7_RAPPORT.md`. Registre : `RE_REGISTRE_CORRECTIONS_RC7.md` (74/87 dossiers clos, 85,1 % ; pas une garantie d’absence de tout bug). Preuves de la présente version : `QA/RE_REPAIR_RC7/`. Les rapports et scellés de versions antérieures dans le dossier sont historiques. `QA/FILE_SHA256_MANIFEST.txt` est le manifeste global courant.

Sources applicatives en TS, sorties JS/bundles générés. Dette de typage historique encore présente. `QA/RE_REPAIR_RC7/baseline` est une petite référence de test RC6R, pas le jeu à lancer.

La navigation dans Chromium a été testée avec fichiers injectés et stockage isolé, y compris 600 vrais services ; les services externes, l’audio, le navigateur natif Opera et la sauvegarde spécifique du joueur ne sont pas certifiés par cet essai.
