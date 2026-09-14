# Rail Empire RC5 — avant de jouer

Sauvegarder/exporter la partie précédente, conserver RC4, extraire cette archive dans un **nouveau dossier** et ouvrir `index.html`. Ne pas mélanger les builds. Aucun Node/TypeScript à installer pour jouer : les trois bundles sont compilés.

Version actuelle : RC5, cache 1199repair5. Corrections suivies : **63/77 = 81,8 %**, pas une certification d’absence de bugs. Lire `RE_REPARATION_RC5_RAPPORT.md` et `RE_REGISTRE_CORRECTIONS_RC5.md`.

Nouveautés : VIA lors d’insertion/ajout d’origine, coordonnées zéro, cargaison interrompue et réservations sauvegardées, index caténaire, péages de très longues routes. Un fret interrompu est restitué sans recette au prochain arrêt commercial utilisable. Les opérations/temps de simulation ne sont pas supprimés pour optimiser le calcul.

Le test de changement de pages à un train passe ; le cas utilisateur exact du blocage durable à 12 km/h reste ouvert partiellement. Les services externes, l’audio et les grandes flottes ne sont pas certifiés par le test navigateur isolé.

Développement : `npm run build:repair`, `npm run test:repair`, `npm test`, `npm run test:s3-regression`, `npm run benchmark:repair`. Intégrité avant toute modification : `npm run verify:repair`.

Les anciens sceaux et rapports sont conservés uniquement comme historique. Les journaux finaux actuels et mesures sont dans `QA/RE_REPAIR_RC5/`.
