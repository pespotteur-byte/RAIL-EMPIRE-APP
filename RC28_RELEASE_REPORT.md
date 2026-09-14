# Rail Empire 1.1.99 — RC28 RAIL REFERENCE FINAL

## Objet
RC28 complète le référentiel ferroviaire sans modifier le gameplay validé de RC27.

## Socle conservé
- 31 009 gares RailNet strictes déjà embarquées dans le jeu, immédiatement disponibles hors ligne.
- 35 pays présents dans le pack de gares historique ; le synchroniseur couvre l'union des pays déjà présents dans les données gares/industriels de Rail Empire (39 codes pays).
- Aucun remplacement massif du socle : les compléments sont fusionnés et dédoublonnés.

## Complément gares
- Source dynamique : OpenStreetMap via Overpass, avec conventions ferroviaires OpenRailwayMap.
- railway=station / railway=halt et public_transport=station + train=yes.
- Exclusion des stations métro, tram, light rail et monorail lorsqu'elles ne sont pas aussi des gares train.
- Déduplication par identifiant, UIC/référence, nom et proximité.
- Cache IndexedDB par pays pendant 60 jours ; les données déjà synchronisées restent disponibles hors ligne.
- Synchronisation automatique non bloquante après lancement + bouton de resynchronisation forcée dans Paramètres.

## Fret / gares marchandises / ITE
- railway=yard et gares explicitement taguées fret/marchandises -> type gameplay `marchandise`.
- service=spur et usage=industrial -> type gameplay `ite`.
- service=yard est également pris en compte comme point fret quand aucun operating-site plus précis n'est fourni.
- Les multiples voies d'un même embranchement industriel sont regroupées par proximité + nom/opérateur/référence.
- Une gare fret/ITE accolée à une gare voyageurs reste un point opérationnel distinct.
- Les métadonnées source, type de site, marchandises, opérateur et caractère officiel sont conservées quand disponibles.

## France — ITE officielles
- Source prioritaire : Cerema, base ITE 3000, mise à jour du 8 juillet 2026.
- 2 864 ITE annoncées par la source officielle ; la base vise l'identification de l'ensemble des ITE de France métropolitaine.
- Les doublons OSM proches d'une ITE Cerema sont écartés au profit de la référence officielle.

## Pays couverts par le synchroniseur
AL, AT, BA, BE, BG, BY, CH, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GR, HR, HU, IE, IT, LT, LU, LV, ME, MK, MT, NL, NO, NZ, PL, PT, RO, RS, RU, SE, SI, SK, UA.

## Limite assumée
Le terme « complet » signifie : tous les objets répondant aux critères et actuellement référencés par les sources interrogées. OSM et les registres officiels évoluent ; RC28 ne prétend pas qu'un ZIP figé puisse garantir l'existence de chaque installation physique non publiée. Le cache et la resynchronisation permettent justement de suivre ces évolutions.

## Qualification
- TypeScript strict / audit applicatif : PASS, aucune nouvelle dette.
- Tests ciblés gares/fret/ITE et contrats historiques : PASS.
- S3 regression gate : 280 / 280 fichiers actifs PASS.
- Repair : 1084 / 1084 tests PASS.
- Bundle final contient `rail-reference-sync` et le bouton de synchronisation des paramètres.

## Catalogue externe
Le dossier `catalogue-externe/` reste livré. RC28 ajoute explicitement les variantes Windows 7 x86 : installateur et exécutable autonome.
