# Registre RC18 FULL — audit correctif et technique

Les sept constats de l’audit RC17 et deux nouveaux défauts fonctionnels sont clos selon les reproductions jointes. Cette fermeture n’est pas une garantie d’absence de bugs. Le typage strict intégral reste ouvert.

## AUD17-01 — Un import rejeté modifie quand même la partie active

**CLOS — critères reproduits et vérifiés dans RC18 · P1**

Validation avant mutation, journal de restauration des gestionnaires, import exclusif et verrou modal. Retour à la partie précédente lors des erreurs testées ; les cantons d’un secours actif sont restaurés.

Preuves : [results.json](QA/RE_REPAIR_RC18/browser-deep/results.json) · [results.json](QA/RE_REPAIR_RC18/browser-safety/results.json) · [repair-final.log](QA/RE_REPAIR_RC18/repair-final.log)

## AUD17-02 — Des schémas horaires et roulements incompatibles sont annoncés chargés

**CLOS — critères reproduits et vérifiés dans RC18 · P1**

Les refus des schémas horaires, roulements ET runtime V2 sont propagés. Aucun succès annoncé avant la confirmation de stockage ; l’écriture refusée provoque le retour à l’état précédent.

Preuves : [results.json](QA/RE_REPAIR_RC18/browser-deep/results.json)

## AUD17-03 — Un export peut mélanger deux instants comptables

**CLOS — critères reproduits et vérifiés dans RC18 · P1**

Capture JSON synchrone avant toute attente ; compression du même instantané dans le worker typé ou dans le repli. Vérification du véritable fichier gzip.

Preuves : [results.json](QA/RE_REPAIR_RC18/browser-deep/results.json) · [repair-final.log](QA/RE_REPAIR_RC18/repair-final.log)

## AUD17-04 — Un double lancement installe deux fois les actions de l’interface

**CLOS — critères reproduits et vérifiés dans RC18 · P2**

Garde de lancement asynchrone et initialisation idempotente ; deux clics rapprochés donnent un lancement et une action par clic d’export.

Preuves : [results.json](QA/RE_REPAIR_RC18/browser-double-launch/results.json)

## AUD17-05 — La génération locale des incidents diverge après rechargement

**CLOS — critères reproduits et vérifiés dans RC18 · P2**

Persistance des crédits d’incidents, minutes observées, curseurs météo et identifiant suivant. Essais sur 48 heures avec incidents actifs et quatre gestionnaires recréés, et contrôle des hooks réels de sauvegarde.

Preuves : [repair-final.log](QA/RE_REPAIR_RC18/repair-final.log) · [results.json](QA/RE_REPAIR_RC18/browser-safety/results.json)

## AUD17-06 — Une sauvegarde supprimée peut réapparaître après un recul d’horloge

**CLOS — critères reproduits et vérifiés dans RC18 · P2**

Marqueur de suppression logique indépendant de l’heure ; l’ancienne sauvegarde reste masquée si la suppression IndexedDB échoue. Retour d’échec si aucun mécanisme ne protège les données. Une sauvegarde confirmée retire le marqueur.

Preuves : [repair-final.log](QA/RE_REPAIR_RC18/repair-final.log)

## AUD17-07 — Le diagnostic de mouvement RC17 s’identifie encore comme RC12

**CLOS — critères reproduits et vérifiés dans RC18 · P3**

Identité RC18 générée depuis le build du package, utilisée dans le nom du diagnostic et son JSON.

Preuves : [repair-final.log](QA/RE_REPAIR_RC18/repair-final.log) · [rc18-memory-smoke.json](QA/RE_REPAIR_RC18/browser-historique/rc18-memory-smoke.json)

## AUD18-01 — Un libellé de catégorie comptable est interprété comme du HTML

**CLOS — reproduit sur RC17, corrigé sur RC18 · P2**

Échappement du texte au point d’affichage dans le dashboard. Le libellé reste identique dans les données. Le test vérifie le DOM réel.

Preuves : [results.json](QA/RE_REPAIR_RC18/baseline/browser-safety/results.json) · [results.json](QA/RE_REPAIR_RC18/browser-safety/results.json)

## AUD18-02 — Une opération de dépôt refusée consomme quand même ressources, pièces ou argent

**CLOS — reproduit sur RC17, corrigé sur RC18 · P1**

Réservation effective du personnel avant consommation ; libération du personnel si la consommation atomique de pièces échoue. Deux opérations et un échec tardif de pièces sont couverts.

Preuves : [baseline-depot.log](QA/RE_REPAIR_RC18/baseline-depot.log) · [current-depot.log](QA/RE_REPAIR_RC18/current-depot.log) · [repair-final.log](QA/RE_REPAIR_RC18/repair-final.log)

## Chantiers techniques restant ouverts ou non certifiés

### TECH18-01 — Typage strict de bout en bout

**OUVERT**. 115 modules applicatifs écrits en TypeScript ; 36 any explicites et 28 @ts-expect-error subsistent. Le retrait expérimental des cinq signatures globales permissives produit 4 688 diagnostics.

Critère de clôture : Remplacer les déclarations permissives par des contrats explicites, contrôler les erreurs réelles et retirer les suppressions justifiées devenues inutiles ; conserver compilation, tests et performances sans masquer les diagnostics.

### PERF18-01 — Performance globale et stabilité mémoire sur le PC cible

**NON CERTIFIÉ**. Gain mesuré du chargeur de véhicules/coupons ; pas de mesure de FPS, de profil complet d’import ou de session longue sur Opera/Win7.

Critère de clôture : Mesurer les temps de frame, l’utilisation CPU, la mémoire et les pauses de sauvegarde/import sur une partie représentative et la machine cible.

### ENV18-01 — Navigateur natif, quota physique, sons et fournisseurs externes

**NON CERTIFIÉ**. Navigation locale native bloquée dans cet environnement. Les vrais bundles ont été testés dans Chromium injecté, avec réseau et stockage isolés.

Critère de clôture : Vérifier Opera/Win7, la vraie sauvegarde utilisateur, le stockage natif et les réponses réseau/audio autorisées sur l’installation cible.

## Compteurs

Le défaut de reprise des incidents (AUD17-05) rouvrait TIME05 : ce n’est pas un dixième bug. Les anciens registres sont conservés comme historiques, pas réécrits pour dissimuler la découverte. Les diagnostics TypeScript ne représentent pas 4 688 bugs d’exécution démontrés.
