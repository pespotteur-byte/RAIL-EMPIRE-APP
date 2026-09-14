# RC20 — registre des demandes de PE

| Demande | État dans RC20 FULL | Preuves |
|---|---|---|
| Incidents à bord « en gare » limités aux arrêts réellement prévus | Corrigé sur les cas reproduits | `INCIDENT_BEFORE_AFTER.json`, `re-rc20-scheduled-incidents.test.mjs` |
| Duplication SC plus rapide sans perte de données ni liens entre copies | Implémentée et comparée à RC19 | `DUPLICATION_BENCHMARK.json`, `re-rc20-duplicates.test.mjs` |
| Numérotation des rames et noms de trains dans le SC | Implémentée, collisions/zéros/parités testés | Tests duplications et `browser-liveries/results.json` |
| Page Livrées wagon + import simple hors wagon | Implémentée | `browser-liveries/results.json` |
| Chargement déplaçable et échelle proportionnelle | Implémenté et manipulé dans Chromium | PNG, aperçu et preuves navigateur |
| Canvas agrandi sans déformation ni découpe à l’export | Implémenté, égalité pixel par pixel | `pngPixelReference`, tests de dépassement sur les quatre côtés |
| Choix par véhicule, original conservé, bibliothèque non tronquée | Implémenté | 1 200 entrées sauvegardées/rechargées, rames/engins physiques testés |
| Export/import de partie et échec de stockage | Vérifiés dans le navigateur isolé | Fichier gzip réel, import par champ fichier, rollback de refus d’écriture |

Les chemins courts des preuves sont relatifs à `QA/RE_REPAIR_RC20/` ; les tests sont dans `js/__tests__/`. Ce registre décrit ces demandes, pas un recensement exhaustif de tous les bugs possibles. Les limites de plateforme, de stockage, de rendu et de typage figurent dans le rapport RC20. Les registres historiques sont conservés, sans transformer leur ancien compteur en certification générale.
