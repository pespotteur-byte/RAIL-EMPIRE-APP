# Rail Empire 1.1.99 — RC27 MARKETING FINAL

Build : `S3_GAMEPLAY_REPAIR_RC27_MARKETING_FINAL_1199repair24`

## Dernier module livré : Marketing & Expérience client

La page Marketing est une vraie couche gameplay persistante, reliée à l'économie et aux statistiques de la partie.

### Catalogue commercial
- 24 offres clients intégrées : tarifs, abonnements, fidélité, promotions, confort et services.
- Création d'offres personnalisées, activation/désactivation, duplication et suppression des variantes créées par le joueur.
- Politique tarifaire et demande voyageurs influencées de façon bornée pour préserver l'équilibrage.

### Restauration et expérience à bord
- 34 références de restauration intégrées.
- Prix de vente, coût matière, qualité, sourcing local, végétarien, activation et best-sellers.
- Produits personnalisés ajoutables et supprimables.
- 18 services/équipements à bord avec coût par voyageur et effets sur satisfaction/demande.
- Recettes et coûts annexes enregistrés dans l'économie du jeu à partir des voyageurs réellement transportés.

### Campagnes & publicité
- 10 modèles de campagnes préconfigurées + campagnes personnalisées.
- Canaux, cibles, objectifs, budget/jour, durée, notoriété, demande et satisfaction.
- 12 emplacements de régie publicitaire configurables ; contrats annonceurs et recettes quotidiennes réelles.

### Satisfaction, clients et presse
- Satisfaction calculée à partir des données réelles de la partie : voyageurs cumulés, satisfaction voyageurs native, ponctualité, retard moyen, annulations, occupation, propreté, recettes et performances d'exploitation.
- Dimensions suivies : ponctualité, confort, propreté, restauration, rapport qualité/prix, information, service client, digital et marque.
- Avis clients rédigés automatiquement en fonction des points forts/faibles réels ; aucun avis automatique sans voyageurs réels.
- Réponses de l'entreprise, suivi et clôture des retours.
- Articles/avis presse rédigés à partir de la réputation et des résultats réels ; pas de presse automatique avant transport de voyageurs.
- Historique des KPI, dépenses et revenus marketing.

### Interface
- Navigation Marketing dédiée et aide contextuelle.
- 8 vues : Vue d'ensemble, À bord, Offres, Campagnes, Publicité, Satisfaction, Retours clients, Presse.
- Icônes SVG internes vérifiées : aucune police d'icônes ni dépendance externe pour cette page.
- Mise en page responsive intégrée à `style.css`.

## Persistance / compatibilité
- État Marketing inclus dans les sauvegardes.
- Anciennes sauvegardes sans état Marketing : catalogue par défaut initialisé automatiquement.
- Compatibilité conservée avec les replays/tests historiques construisant un RailEmpire partiel.
- Les règles RC26 (W/HLP/TM vides et incidents voyageurs) restent intactes.

## Validation finale
- Build TypeScript / tous typechecks RC : PASS.
- Audit TypeScript : PASS, 0 régression de dette.
- Bundle FILE généré avec le module Marketing : PASS.
- Tests ciblés RC27 / aide / build / replay : 15/15 PASS.
- Replay gameplay réel 48 h : PASS.
- Tests Repair : 1084/1084 PASS.
- Porte S3 finale : 279/279 fichiers actifs PASS (71 + 70 + 69 + 69).

## Catalogue externe Windows
- `catalogue-externe/RailEmpireCatalogEditor.exe` : Windows x64.
- `catalogue-externe/RailEmpireCatalogEditor-x86.exe` : Windows x86 / 32 bits.
- SHA-256 du binaire x86 : `4a4acc9dec6e62adda909eefc94c776a81be76d3e5afb1c92210626f3402ad05`.
