# Rail Empire — RC8

Build : `S3_GAMEPLAY_REPAIR_RC8_1199repair8`.

**Avant lancement : exporter sa sauvegarde et conserver RC7. Extraire ce ZIP dans un nouveau dossier, sans fusion de fichiers, puis ouvrir `index.html`.** Le jeu est déjà compilé ; Node/TypeScript ne sont utiles que pour les contrôles de développement. Commencer avec une copie de partie.

La RC8 sépare le nom affiché d’une voie de son identité physique au pont SC-runtime. Un renommage ne doit plus créer une fausse voie libre ; l’occupation sous la queue et l’identité dans les snapshots sont conservées. Les bindings historiques sans identifiant physique gardent la compatibilité par libellé ; une sélection physique doit être refaite pour obtenir le contrat complet. Aucune voie ambiguë ne sera inventée.

L’index des propriétaires de ressources réduit le coût de ce contrôle précis ; les chiffres du rapport ne sont pas des multiplicateurs de FPS ou de vitesse globale du jeu.

**Bilan : 75/87 dossiers clos (86,2 %), cinq partiels, sept ouverts.** Suite standard 102 834 tests réussis ; réparation 363/363 ; gate S3 237/237 fichiers actifs. Les suites se recouvrent. La navigation native HTTP/file est bloquée dans le laboratoire ; essais par injection des vrais bundles dans Chromium, sur scénarios synthétiques. Ni l’audio, ni les services externes, ni Opera/Windows 7, ni une longue partie réelle ne sont certifiés par ces essais.

Lire `RE_REPARATION_RC8_RAPPORT.md` et `RE_REGISTRE_CORRECTIONS_RC8.md`. Preuves : `QA/RE_REPAIR_RC8/`. Les autres bilans sont historiques, pas des résultats de cette livraison. Pour vérifier l’intégrité avant modification : `npm run verify:repair`.
