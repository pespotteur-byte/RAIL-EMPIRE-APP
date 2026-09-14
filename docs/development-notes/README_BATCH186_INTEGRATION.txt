RAIL EMPIRE — INTÉGRATION PASS12 BATCH186 STRICT100
===================================================

Base utilisée : RE-code-only.zip
Checkpoint identité : Pass12 RealIdentity100 Batch186 STRICT100

CE QUI EST INTÉGRÉ
- Couche d'identité documentaire Batch186 dans le runtime du catalogue.
- Les fiches reliées conservent leurs ID cat-*, noms MLG, descriptions, numérotation et valeurs gameplay.
- Champs ajoutés : realIdentityId, realIdentitySeries, identityDisposition, identitySource,
  identityScope, identityConfidence, identityCountry, identityOperator, mlgId, mlgArchivePath.
- La page Matériel affiche « Identité RE » et la recherche accepte le nom réel et l'ID RE-EU.
- Pack RE inchangé.

COUVERTURE DU CATALOGUE JEU
- 16 056 fiches dans catalog-data.js.
- 14 914 fiches à image simple (non composées).
- 14 593 reliées automatiquement et de façon conservatrice à Batch186.
- 321 anciens alias de fichiers ne reçoivent pas d'ID automatique dans cette passe.
- 1 142 fiches « composed » sont des images de rames générées à partir de plusieurs dessins MLG :
  elles ne correspondent pas à un dessin brut unique de Batch186 et gardent donc leur description MLG.
- Le référentiel Batch186 complet reste inclus dans data/ pour audit et futures résolutions.

IMPORTANT
Ce ZIP est une version CODE-ONLY mise à jour, comme la base fournie. Il ne contient pas le dossier complet
img/ de ton build local. Pour un build jouable complet, fusionner ce code dans le dossier/ZIP complet de Rail Empire
qui contient déjà img/catalog et img/pack_re.

FICHIERS MODIFIÉS/AJOUTÉS
- index.html (cache key main.js)
- js/main.js
- js/rolling-stock.js
- js/ui.js
- js/catalog-identity-batch186.js (nouveau)
- data/Pass12_RealIdentity100_Batch186_*.json/txt
- data/Rail_Empire_Grand_Inventaire_Europeen_V5.0_Pass12_RealIdentity100_Batch186.json
- data/Batch186_Game_Integration_Report.json

TESTS
- node --check : main.js / ui.js / rolling-stock.js / catalog-identity-batch186.js : PASS
- js/__tests__/rolling-stock.test.js : 3/3 PASS
- smoke test runtime identité : PASS
- suite globale : lancée, très longue (>45 s) ; aucun échec observé avant la limite d'exécution.
