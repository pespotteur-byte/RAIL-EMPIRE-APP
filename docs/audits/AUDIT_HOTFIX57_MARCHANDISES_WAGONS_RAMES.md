# Rail Empire v1.1.99 — HOTFIX57 — Audit Marchandises / Wagons / Rames

## Verdict avant correction

L'audit croisé a détecté plusieurs incohérences fonctionnelles :

1. **Capacité de rame non filtrée par marchandise**
   - Le moteur utilisait `rame.totalFreightCapacity` pour un contrat dès qu'au moins un wagon était compatible.
   - Une rame mixte pouvait donc affecter la capacité de wagons incompatibles à la marchandise du contrat.

2. **Trois logiques tarifaires parallèles**
   - contrats génériques : `CargoType.pricePerUnit` ;
   - contrats industriels : `industry.pricePerTonne` ;
   - fret générique en circulation : ancien `Economy.freightPricePerTKm = 0.08`.
   - Le tarif affiché dans Marchandises n'était donc pas la source unique du revenu fret.

3. **Catalogue incomplet côté capacités**
   Audit après assemblage complet du catalogue v1.1.99 :
   - 36 307 engins ;
   - 6 010 entrées classées wagon ;
   - 200 wagons avec `freightCapacity > 0` ;
   - 82 wagons avec à la fois une capacité positive et au moins une marchandise explicitement autorisée ;
   - 118 wagons avec capacité positive mais aucun chargement renseigné ;
   - 5 581 wagons avec chargements renseignés mais capacité fret à 0 ;
   - 0 référence de marchandise inconnue parmi les cargoTypes après normalisation ;
   - aucune capacité négative/non finie détectée.

Aucune capacité manquante n'a été inventée dans HOTFIX57.

## Corrections HOTFIX57

- `Marchandises.pricePerUnit` devient le **tarif opérationnel RE par tonne livrée**.
- La page affiche maintenant `Tarif RE / t`; l'ancienne unité métier reste visible à titre descriptif.
- Les nouveaux contrats génériques et industriels utilisent la tonne comme unité physique d'exploitation.
- Les contrats industriels prennent en priorité le tarif défini dans Marchandises.
- Le fret générique ne calcule plus son revenu avec le vieux 0,08 €/t-km ; il utilise le tarif de la marchandise réellement chargée.
- `FreightManager.getRameCargoCapacity()` additionne uniquement les wagons réellement compatibles avec la marchandise/contrat.
- Un wagon à capacité 0 ne peut plus satisfaire un contrat ou augmenter artificiellement la capacité de la rame.
- `FreightManager.getRameCargoTypes()` ignore les wagons dont la capacité fret n'est pas validée.
- `Rame.freightCapacityByCargo` expose la capacité réelle par marchandise.
- La page Rames affiche la masse à vide, la capacité fret maximale et la capacité détaillée par marchandise.
- Les coûts de circulation fret utilisent maintenant masse à vide + quantité réellement transportée sur le tronçon, au lieu de dépendre d'un champ `tonnage` historiquement ambigu.

## Limite volontaire

HOTFIX57 ne complète pas automatiquement les capacités manquantes du catalogue. Les lignes sans valeur documentée restent à 0 afin de ne pas créer de données fictives. Elles pourront faire l'objet d'une passe catalogue dédiée avec sources fiables.

## QA

- Syntaxe des modules modifiés : PASS.
- Tests fret/catalogue/rames ciblés : 27/27 PASS.
- Tests HOTFIX57 : 8/8 PASS.
- Suite cumulative `v1199-hotfix*.test.mjs` : 267 tests, 238 PASS / 29 anciens FAIL HOTFIX18–28.
- Aucun nouvel échec introduit par HOTFIX57.
- Bundle FILE:// reconstruit.
- Cache runtime : 1199dep51.
