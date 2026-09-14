# Rail Empire v1.1.31 — AUDIT MAXIMUM TERMINÉ

Base auditée: Rail_Empire_v1.1.31_FIELD_REGRESSION_REPAIR.zip
Comparaison architecturale: Rail_Empire_v1.1.19_OSM_ORM_IS_THE_GAME.zip

## Critiques confirmés

1. Régression de lignée v1.1.20+
- v1.1.31 recharge data/railnet/stations/manifest.js.
- main.js exige _ensureRailNetGameplayStations().
- world.stations est reconstruit depuis le pack fixe RailNet ~17 817.
- Le streaming direct des gares OSM natif de v1.1.19 a disparu.
- Le test osm-direct-world-v1119.test.js a disparu de la suite.

2. Fallbacks ferroviaires droits réintroduits
- orm.js: _maxFallbackKm = 1.0 au lieu de 0 en v1.1.19.
- line.js: si ORM échoue, addTrack() à vol d'oiseau.
- ui.js édition de ligne: même fallback droit en catch.
- ui.js création de gare: liaison provisoire droite créée immédiatement et conservée si ORM échoue.
- ui.js ancien calcul horaire: route synthétique droite utilisée pour le temps de marche si ORM manque.

3. Sauvegarde OSM native régressée
- v1.1.19: world.toSave({pinNativeStationIds}) + nativeRefs pour les gares OSM gameplay utilisées.
- v1.1.31: pinNativeStationIds/nativeRefs absents.

4. Validation V2 structurellement insuffisante
- validateScheduleVersion() vérifie seulement path.routePoints global >= 2.
- Ne vérifie pas legs.length === locations.length-1.
- Ne vérifie pas un leg >=2 points pour chaque paire de gares.
- Ne vérifie pas couverture VIA/constraintIds ni continuité de tous les legs.
- Test minimal confirmé: 3 gares + 1 seul leg => canValidate=true, 0 issue.

5. Recalcul éditeur avale l'échec
- _recomputeActivePath() catch écrit path.error mais conserve l'ancien path.legs/path.routePoints.
- validateAndSave() ne teste pas path.error et peut valider l'ancien tracé partiel.

6. blocked_route verrouille potentiellement le matériel à vie
- ActiveService V2 passe state='blocked_route' si route manquante.
- moveUpdate() ne s'exécute que si state==='moving'.
- Aucun autre traitement blocked_route trouvé.
- ScheduleV2Runtime._finalizeServices() ne libère le matériel que si completed/cancelled.
- Donc blocked_route peut laisser available=false indéfiniment et empêcher les occurrences suivantes.

7. Cache ORM peut transformer une erreur Overpass en voie vide valide
- fetchArea() considère tout HTTP 200 JSON comme valide.
- data.remark n'est jamais contrôlé.
- parseWays({remark,error,elements:[]}) => [].
- [] est persisté en IndexedDB comme tuile valide pendant 7 jours sous cache v5.
- v1.1.29, v1.1.30 et v1.1.31 réutilisent ce même v5.

8. Revalidation V2 trop stricte et couplée au cache empoisonné
- _exactWayStillExists exige l'ancien wayId exact dans un rayon de 65 m.
- Contradictoire avec le contrat v1.1.25: position curseur autoritaire, way OSM pouvant être scindé/renuméroté.
- Réponse vide cache valide => way absent => horaire NEEDS_REPAIR au lieu de revalidation différée.
- Le revalidateur ne réécrit pas les nouveaux snaps/wayIds résolus comme l'éditeur.

9. Version de roulement incohérente
- Rotation V2 calcule avec occ.versionId.
- Runtime _resolveVersion() préfère scheduleV2.resolveVersion(date) puis occ.versionId seulement en fallback.
- Le train peut donc exécuter une autre version que celle affichée/épinglée dans le roulement.
- resolveVersion() sélectionne tout état != DRAFT, donc NEEDS_REPAIR peut masquer une ancienne VALID; runtime la rejette ensuite.

10. occ.cancelled ignoré par le runtime
- RotationOccurrence possède cancelled.
- planRotationForDate()/sync() ne filtrent pas occ.cancelled.

11. Actions de roulement à l'origine ignorées
- _applyActionsAtStop() est branché via svc._v2OnArrive.
- Pas d'application équivalente avant le premier départ.

12. Granularité horaire V2 incohérente
- V2 calcule et stocke les heures à la seconde.
- formatScheduleClock() n'affiche que HH:MM, secondes masquées.
- SimulationEngine.onTick ne s'exécute qu'au changement de minute entière.
- Un départ réel 16:19:37 n'est évalué qu'à 16:20:00.

13. Sens de circulation incomplet
- parseWays() lit railway:preferred_direction et railway:bidirectional.
- Ne lit pas oneway=*.
- Les deux directions sont systématiquement ajoutées au graphe; le sens préféré n'est qu'une pénalité.

## Autres points confirmés
- Le bundle file:// v1.1.31 contient bien les patchs source v1.1.31; ce n'est pas un bundle ancien.
- ScheduleV2Runtime.sync() est appelé avant scheduleTick(), donc pas de raté T0 par ordre global.
- Le renderer sait dessiner un service V2 si svc.position existe.

## Audit adversarial supplémentaire

14. Calendrier de roulement supprimé/introuvable = fail-open
- _rotationRuns(): si rotation.calendarId existe mais calendrier introuvable, retourne true.
- Un roulement orphelin circule tous les jours au lieu d'être bloqué/alerté.

15. TrackBinding incomplet devient coordonnée 0,0
- Des coordonnées absentes sont normalisées en 0.
- La validation les considère finies/valides, donc un arrêt incomplet peut devenir Golfe de Guinée au lieu d'une erreur TRACK_MISSING.

16. Suppression d'un arrêt intermédiaire peut laisser un VIA sur un leg inexistant
- removeStop() ajuste imparfaitement legIndex.
- Exemple reproduit: 2 lieux restants (seul legIndex 0 valide), VIA reste legIndex 1.

17. Alertes UNKNOWN non dédupliquées
- VMAX_UNKNOWN_30 et ELECTRIFICATION_UNKNOWN sont émises par segment.
- Plusieurs segments du même way => messages répétés.

18. Localisation matériel par coordonnées ignorée
- _knownLocationMismatch() compare les IDs si présents mais ne compare jamais lat/lon.
- Un engin localisé à 0,0 sans id est considéré présent au départ en France.

19. Formation diesel + électrique mal traitée
- Si au moins un engin actif est diesel, _electricalProblem() retourne immédiatement aucun problème.
- Le profil de performance additionne pourtant la puissance des engins électriques actifs, même s'ils sont inutilisables sur la section.
- Temps de marche/traction peuvent donc être surestimés.

20. Runtime compile des legs vides
- _compile() pousse [] dans routes si un leg manque.
- Le service est créé et le matériel verrouillé, puis ActiveService tombe en blocked_route au départ.

21. Calendrier horaire bypassé par le fallback de version
- _resolveVersion(): resolveVersion(date) || getVersion(occ.versionId).
- Si la version épinglée n'est pas applicable ce jour, resolveVersion retourne null puis le fallback relance quand même occ.versionId.
- Reproduit: version calendrier lundi retourne quand même VALID le dimanche.

22. WayId sticky peut affamer les bons candidats de snap
- _cursorSegmentCandidates trie d'abord tous les segments du preferredWayId et limite à 6.
- Un wayId stale/déconnecté avec plusieurs segments proches peut remplir les 6 places et exclure une voie connectée pourtant voisine.
- Très pertinent pour VIA -> gare après changement/split OSM ou mauvais snap mémorisé.

23. Chargement de nouvelles ways ne purge pas toujours routeCache
- fetchArea() pose _graphDirty=true directement.
- markGraphDirty() purge routeCache, mais fetchArea() ne l'appelle pas.
- Une route mise en cache peut donc survivre après enrichissement/modification du graphe.

24. Rotation désactivée encore comptée dans les conflits matériels
- validateMaterialConflicts() considère aussi les rotations enabled=false.
- Peut créer des doubles-bookings fantômes et empêcher/parasiter une affectation.

25. Fenêtre de compilation runtime étroite
- sync() compile seulement de start-300 s à end+60 s.
- Un chargement/reprise après end+60 s ne recrée jamais l'occurrence, même si on voulait reconstruire/rapporter une circulation retardée.
- À classer politique/robustesse, moins directement critique qu'un service avant départ.

26. Revalidation change la route sans mettre à jour les ancres sauvegardées
- Route reconstruite peut démarrer sur NEW way/snap tandis que TrackBinding reste OLD way/snap.
- Au prochain reload, l'ancien binding est revalidé de nouveau et peut échouer.

27. oneway OSM ignoré
- Test reproduit: way tags.oneway='yes' reste routable en sens inverse.
- Le graphe ajoute systématiquement les deux directions.

28. Leg manquant chronométré comme trajet zéro
- recalculateScheduleTiming() appelle calculatePhysicalTravelSeconds([]) quand leg absent.
- Résultat: la gare suivante peut être placée seulement après le dwell, sans temps de marche réel.

29. Horaire NEEDS_REPAIR = train invisible sans message runtime
- Reproduit: occurrence + loco affectée + version NEEDS_REPAIR => services=0, alerts=[].
- planRotationForDate() produit un plan erreur sans pousser d'alerte joueur.
- Explique directement un train absent de la Livemap sans feedback.

## 30. `blocked_route` services disappear from Livemap renderer feed — CONFIRMED
- `getMovingServices()` only includes `moving` and `departing`.
- Main gameLoop adds stopped services only for `stopped_at_station` or `waiting && train.stoppedAt`.
- A V2 service entering `blocked_route` may still have a valid `position`, remain active, and keep material locked, but is omitted from `allVisibleServices`.
- Direct field symptom: train can vanish from Livemap exactly when a missing/empty V2 leg blocks it.

## 31. Load-order race: V2 service is compiled before asynchronous ORM revalidation — CONFIRMED
- `main.loadState()` restores schedules/rotations, discards derived V2 ActiveServices, then immediately calls `scheduleV2Runtime.sync(loadTimeMin, loadDateStr)`.
- Only afterwards it schedules `scheduleV2Revalidator.run()` via `setTimeout(..., 0)`.
- A stale `VALID` schedule can therefore spawn a service from cached/partial geometry, then be mutated to `NEEDS_REPAIR` or receive rebuilt timing/geometry.
- Existing compiled service is neither cancelled nor rebuilt when revalidation changes the version.
- Runtime/domain state can diverge after reload.

## 32. Timing/runtime silently substitute the indexed leg when endpoint IDs do not match — CONFIRMED
- `recalculateScheduleTiming()` first searches a leg whose `fromLocationId/toLocationId` match the adjacent locations, then falls back to `outboundPath.legs[i]`.
- `ScheduleV2Runtime._compile()` uses the same `find(...) || legs[i]` pattern.
- After edits/rekeys/removals, a stale leg at the same array index can therefore be used for the wrong pair of locations.
- Consequences: wrong travel time and a train physically routed on geometry belonging to another stop pair, while the route is non-empty and may pass weak validation.

## 33. Multi-anchor routing is greedy and has no backtracking — REPRODUCED, DIRECT VIA→STATION ROOT CAUSE
- `findRouteViaCursorAnchors()` resolves each consecutive pair independently.
- Once a VIA endpoint is snapped by the first pair, `carriedStart` freezes that exact snap for the next pair.
- If the locally-best VIA snap is a nearby parallel/platform/dead-end track that cannot connect onward, the second pair fails and the whole route returns `null`.
- The router never retries the first pair with another VIA candidate to satisfy the entire A→VIA→B chain.
- Adversarial synthetic proof: two parallel disconnected rails, rail 101 slightly closer to A/VIA but ending early, rail 202 slightly farther and reaching B. A→VIA picked 101; A→VIA→B returned NULL. Pinning A/VIA to 202 returned a valid 6-point route.
- The pre-destination preview A→VIA can also populate the route cache with the locally-best snap before B exists, making this failure even more likely in the real editor workflow.

## 34. Global + VIA can target a non-existent post-terminus leg — CONFIRMED
- The generic/global + VIA workflow defaults `legIndex` to `locations.length - 1` once stops already exist.
- For an A→B schedule, the existing leg index is `locations.length - 2` (= 0), while the generic VIA can be assigned to index 1, effectively after B.
- Result: the VIA may only affect a preview after the terminus instead of being inserted into A→B; the per-stop insertion control uses the correct leg.

## 35. Rotation operation durations are not consumed by runtime — CONFIRMED
- Rotation validation enforces minimum operation durations (typically 5 min), but `_applyActionsAtStop()` applies attach/detach/loco-change actions immediately on arrival.
- `resolvedEndSec` ends at terminal arrival and does not include terminal dwell or operation duration.
- Material can therefore become available too early and following occurrences can be planned optimistically, creating runtime conflicts or late starts.

## 36. T-5 compilation can create material reservation races — CONFIRMED
- V2 services are compiled up to 5 minutes before departure and immediately mark assigned material unavailable.
- If two occurrences/rotations contend for the same traction unit in that window, the iteration/order of rotations can determine which service reserves it first rather than the operationally nearest departure.
- The losing service may retry later and depart late or remain uncompiled depending on the subsequent material state.

## 37. Runtime no-spawn reasons are hidden from the main player workflow — CONFIRMED
- Runtime blockers such as `TITULAR_MISSING`, `NO_TRACTION`, physical incompatibility, material unavailable/wrong location, etc. are surfaced only in the Roulements UI.
- The Schedule Creator and Livemap do not expose these blockers where the player is observing the failed departure.
- Field symptom: schedule appears VALID, no train appears, and no local message explains why.

## 46. Le test terrain 16:19 s'arrête avant le premier frame de mouvement
- `field-regressions-v1131.test.js` vérifie 16:18: position, puis 16:19: `state === 'moving'` et position.
- Il n'appelle jamais `moveUpdate()` après le départ.
- Il ne vérifie jamais que le service reste visible dans la liste réellement transmise au renderer Livemap.
- Un service avec route vide peut donc satisfaire entièrement ce test puis passer `blocked_route`/disparaître au frame suivant.

## 47. Contrats QA de lignée contradictoires
- Le test anti-régression v1.1.19 `osm-direct-world-v1119.test.js` est absent de v1.1.31.
- Le vieux `startup-contract-v1115.test.js` reste présent et vérifie notamment l'existence de `_ensureRailNetGameplayStations()`.
- La QA actuelle protège donc encore une partie de l'ancienne architecture RailNet tout en ne protégeant plus le contrat v1.1.19 « OSM/ORM direct native world ».

## 48. Aucun test V2 n'exerce réellement `moveUpdate()`
- Les tests `schedule-v2-runtime.test.js` couvrent compilation/timing/formation mais n'appellent pas `moveUpdate()`.
- Le test terrain v1.1.31 vérifie seulement le passage à `moving`.
- Les tests de mouvement existants (`regulation.test.js`) concernent le moteur ActiveService/legacy, pas un service compilé V2 de bout en bout.
- La chaîne compile -> départ -> premier frame -> blocked_route/rendu n'est donc pas couverte.

## 49. Une annulation V2 téléporte le matériel au terminus prévu
- `_finalizeServices()` traite `svc.completed` et `svc.state==='cancelled'` par la même branche.
- Il positionne chaque véhicule sur `last = stops[stops.length-1]`, indépendamment de la position réelle ou du fait que le train ait roulé.
- Un train annulé avant départ peut donc faire apparaître sa locomotive au terminus dans l'état matériel.

## 50. Reload en plein trajet V2 reconstruit le train au départ, pas à sa position réelle
- `ScheduleCreator.toSave()` exclut tous les services `_v2OccurrenceId` comme « reproductibles ».
- Au chargement, `ScheduleV2Runtime.sync()` recompilera une occurrence encore dans `[start-300,end+60]`.
- `_compile()` crée toujours un nouvel ActiveService en état initial; aucune restauration du leg courant/progression/position n'existe.
- Un train en ligne au moment de la sauvegarde peut donc être recréé au point de départ avec du retard, au lieu de continuer depuis sa position réelle.

## 51. Le parseur de gares OSM a régressé par rapport à v1.1.19
Comparaison directe `js/orm.js`:
- v1.1.19 accepte `railway=station/halt` OU `public_transport=station + train=yes`; v1.1.31 n'accepte que `railway=station/halt`.
- v1.1.19 IDs natifs `osm-node-* / osm-way-* / osm-relation-*`; v1.1.31 revient à `node-* / way-* / relation-*`.
- v1.1.19 conserve une gare multimodale si `train=yes`; v1.1.31 marque urbanTransit via subway/tram/light_rail/monorail indépendamment du train=yes.
- v1.1.19 conserve `uicRef/ref/wikidata/wheelchair`; v1.1.31 a perdu ces métadonnées.

## 52. Le cache stations a reculé de `stations-v5` à `stations-v3`
- v1.1.19 utilise `stations-v5` pour invalider d'anciens filtres.
- v1.1.31 utilise de nouveau `stations-v3`.
- La branche actuelle peut donc réutiliser d'anciennes entrées issues de règles de filtrage obsolètes si le streaming OSM des gares est réactivé.

## 38. Le même véhicule physique peut être compilé dans deux services V2 — REPRODUIT
- Test synthétique avec le vrai `ScheduleV2Runtime.sync()`: deux rotations dans la fenêtre T-5 utilisent le même `vehicleId`.
- Résultat: deux ActiveService créés, tous deux référencent la même locomotive, aucune alerte.
- Le verrou `available=false` n'est pas transactionnel entre compilations concurrentes d'un même sync.
- L'ordre de tentative suit `rotationV2.rotations`, pas l'heure de départ.

## 39. « Aucune traction » = warning UI mais blocage dur runtime
- `validateRotation()` produit `WARNING / NO_ACTIVE_TRACTION_ASSIGNED`.
- `_compile()` produit `ERROR / NO_TRACTION` et ne crée aucun service.
- Le contrat de validité affiché au joueur n'est donc pas celui du moteur de circulation.

## 40. Panne Overpass et absence réelle de voie sont confondues
- Les couches basses savent retourner `ok:false`, mais plusieurs fallbacks V2 rabattent l'échec vers `[]/null`.
- `ScheduleV2Routing` transforme ensuite cela en « Aucun tracé ferroviaire ORM valide ».
- Le joueur ne peut pas distinguer données indisponibles et topologie réellement absente.

## 41. Déduplication d'alertes runtime trop persistante
- `_alertKeys` persiste jusqu'au reload/reset.
- Une anomalie résolue puis réapparue le même jour sur le même code/rotation/occurrence/véhicule peut ne plus générer de nouvelle alerte.

## 42. Le garde-fou `isRameInUse` ne représente pas les véhicules physiques V2
- Chaque occurrence V2 reçoit un `rameId` synthétique unique.
- Deux services partageant la même locomotive mais pas le même `rameId` ne sont pas détectés par ce contrôle legacy.

## 43. Les services V2 sont exclus de l'index de rames normal
- `_addToTickIndexes()` fait `if (svc._v2OccurrenceId) return;`.
- `beginTick()` construit donc `_rameUsage` sans les V2.
- Pendant un tick normal, le fallback scan de `isRameInUse()` n'est pas utilisé puisque l'index existe.

## 44. Le leg courant n'est contrôlé qu'après le passage à `moving`
- À T0, `scheduleTick()` passe le train à `moving` et libère les occupations sans vérifier `route.length>=2`.
- Le premier `moveUpdate()` découvre ensuite le leg vide et passe V2 en `blocked_route`.
- Cela produit le cycle départ logique -> disparition Livemap -> matériel verrouillé.

## 45. Les actions de roulement peuvent viser une autre version que celle exécutée
- Le validateur vérifie `occ.versionId`.
- Le runtime choisit d'abord la version applicable du jour.
- Une nouvelle version régénère les IDs d'arrêts/VIA/legs, sans migration des `RotationAction.locationOccurrenceId`.
- Les opérations peuvent donc valider sur l'ancienne version puis ne correspondre à aucun arrêt runtime.

## 53. Régression du parseur de gares reproduite avec le vrai code v1.1.31
Test synthétique `_parseStations()`:
- `railway=station + train=yes + subway=yes` => station parsée mais `urbanTransit:true`.
- `public_transport=station + train=yes` => absente du résultat.
- ID généré `node-1` et non `osm-node-1`.

## 54. Cache gares empoisonné par `remark/error` Overpass — REPRODUIT
- Mock HTTP 200 JSON `{remark:'runtime error: Query timed out', elements:[]}`.
- `fetchStationsArea(...,{withStatus:true})` retourne `ok:true, source:'network', stations:[]`.
- `_saveCachedArea()` est appelée et persiste la tuile vide sous `stations-v3:*`.
- Une erreur serveur peut donc devenir une absence de gare persistante.

## 55. Cache voies `v5` empoisonné par `remark/error` Overpass — REPRODUIT
- Mock HTTP 200 JSON `{remark:'runtime error: Query timed out', elements:[]}`.
- `fetchArea(...,{withStatus:true})` retourne `ok:true, source:'network', ways:[]`.
- `_saveCachedArea()` persiste la bbox vide sous `v5:*`.
- Comme v1.1.29/v1.1.30/v1.1.31 partagent `v5`, une erreur mise en cache par une ancienne version survit aux hotfixes.

## 56. Plusieurs tests verrouillent explicitement le vieux monde fixe à 17 817 gares
- `global-stations-v1114-gameplay-native.test.js`, `stations-all-zoom-v1120.test.js`, `global-stations-v1113-rail-only.test.js` attendent explicitement 17 817 entrées / `_builtInRailNet`.
- Ces contrats sont incompatibles avec la cible v1.1.19: OSM stations natives streamées par zone, pack RailNet seulement historique.

## 57. Les tests « no straight-line fallback » s'arrêtent au routeur ORM
- `orm-routing.test.js` vérifie correctement qu'un graphe déconnecté retourne `null`.
- Mais aucun contrat bout-en-bout n'interdit ensuite à `line.js`/`ui.js` de transformer ce `null` en track direct.
- v1.1.31 passe donc les tests R-03 tout en recréant effectivement des lignes droites dans les couches consommatrices.

## 58. Le cache `findRoute` peut violer `allowFallback:false` — REPRODUIT
- La clé de `routeCache` ne contient pas l'option `allowFallback`.
- Test avec graphe vide et deux points à moins de 1 km : premier appel `allowFallback:true` met une route synthétique en cache ; second appel aux mêmes coordonnées avec `allowFallback:false` renvoie exactement le même objet synthétique.
- Un consommateur strict peut donc recevoir une ligne droite fabriquée uniquement parce qu'un appel permissif antérieur a utilisé les mêmes coordonnées.

## 59. Collision de cache entre jeux `avoidStationPairs` différents — REPRODUIT
- La clé n'encode que `avoidStationPairs.length` (`-a1`, `-a2`, ...), jamais l'identité des paires.
- Test : PAIR_A puis PAIR_B avec une paire chacune. Le second appel reçoit la route cachée de PAIR_A.
- Les contraintes d'évitement ne sont donc pas fiables tant que le cache est chaud.

## 60. Arrêt anticipé des candidats curseur peut choisir un énorme détour — REPRODUIT
- `_routeCursorCandidatesOnWays()` arrête la recherche dès qu'un couple possède un snap total < 20 m et 0 arête à contre-sens préférentiel.
- Le `break` intervient même si d'autres candidats ont un score global bien meilleur.
- Test adversarial : premier couple proche => trajet 100 km ; candidat légèrement plus éloigné => trajet 1 km. La v1.1.31 choisit 100 km.
- Cela peut également figer une mauvaise voie parallèle/quai avant d'avoir examiné la meilleure solution globale.

## 61. Aucune monotonie chronologique entre arrêts — REPRODUIT
- `validateScheduleVersion()` vérifie seulement `departureSec >= arrivalSec` à l'intérieur d'un même arrêt.
- Il ne vérifie pas que l'arrivée au prochain arrêt est postérieure au départ de l'arrêt précédent.
- Test : A départ t=600, B arrivée/départ t=500, route ORM présente => `canValidate:true`, 0 issue.

## 62. Changer les calendriers d'un horaire VALID ne le repasse pas en DRAFT
- `_setCalendarChecked()` modifie `calendarIds`, lance le recalcul des roulements et autosave, mais n'appelle pas `_markRecordChanged()`.
- Cela viole le contrat v1.1.22 selon lequel toute modification d'un horaire VALIDE doit imposer une nouvelle validation.

## 63. Un membre de formation supprimé/inexistant passe la validation du roulement — REPRODUIT
- `validateRotation()` vérifie les `vehicleIds` des actions, mais pas ceux de `occ.formation.members`.
- Test : formation LEAD avec `vehicleId='ghost'`, aucun véhicule enregistré => `validateRotation()` retourne `[]`.
- Le runtime ignore ensuite silencieusement le membre absent et peut aboutir à `NO_TRACTION`/non-spawn.

## 64. Dépendance d'opération vers une action ultérieure ignorée — REPRODUIT
- `operationWindowSec()` calcule les actions dans l'ordre du tableau et résout une dépendance via `endById.get(id) || 0`.
- Si A dépend de B mais B est située après A, la dépendance vaut 0 lors du calcul de A.
- Test A(5 min)->B(5 min), B située après A : fenêtre calculée 300 s au lieu de 600 s.
- Les cycles et dépendances topologiquement invalides ne sont pas détectés.

## 65. Le contrat exécutable v1.1.19 échoue massivement sur v1.1.31 — REPRODUIT
- Le fichier de tests historique exact `osm-direct-world-v1119.test.js` a été exécuté temporairement contre le code v1.1.31.
- Résultat : 13 tests, 1 PASS, 12 FAIL.
- Les échecs couvrent notamment : parsing RER/multimodal, stations OSM natives, absence de dépendance RailNet fixe, interdiction des fallbacks synthétiques, rollback de création de lignes, pinning des gares OSM et bundle direct-world.
- Log conservé : `/mnt/data/re_audit1131/AUDIT_V119_CONTRACT.log`.

## 66. L'écartement incompatible passe la validation horaire puis bloque le runtime — REPRODUIT
- `validateScheduleVersion()` contrôle l'électrification mais ne compare jamais `performanceProfile.gauges` à `segment.gauge`.
- Test : profil 1435 mm sur segment 1000 mm, vraie route présente => `canValidate:true`, 0 issue.
- `ScheduleV2Runtime._gaugeProblem()` effectue ensuite ce contrôle et bloque le départ via `PHYSICAL_INCOMPATIBILITY`.
- Nouveau cas concret où la fiche affiche VALIDE alors que le moteur refuse de créer la circulation.

# CONCLUSION — AUDIT TERMINÉ

## Résultat
- **66 anomalies distinctes confirmées ou reproduites** sur la branche v1.1.31 et sa lignée.
- L'audit a couvert : monde/gares OSM, routage ORM, caches, Schedule Creator V2, validation, timing, revalidation, roulements, matériel, ActiveService, Livemap, save/reload et bundle file://.
- Le contrat exécutable historique v1.1.19 a été relancé contre v1.1.31 : **1/13 PASS, 12/13 FAIL**.
- Les trois symptômes terrain remontés par PE ont désormais plusieurs chaînes causales concrètes et reproductibles.

## P0 — à corriger avant build jouable

### A. Restaurer le contrat OSM/ORM natif
Findings : **1, 2, 3, 51, 52, 53, 54, 55, 56, 57, 58, 65**.
- Reprendre le monde direct v1.1.19 : stations OSM natives dans `world.stations`, identité `osm-*`, RER/multimodal train=yes conservés, RailNet fixe non-runtime.
- Remettre le pinning/delta des gares OSM utilisées.
- Supprimer tous les fallbacks ferroviaires automatiques droits ; `allowFallback:false` doit être impossible à contourner via le cache.
- Bumper les caches stations/rails après correction et refuser de mettre en cache les réponses Overpass `remark/error`.

### B. Rendre le routage V2 atomique et global
Findings : **4, 5, 7, 8, 16, 22, 23, 26, 27, 32, 33, 34, 40, 54, 55, 59, 60**.
- Un trajet A→VIA(s)→B doit être résolu comme une chaîne globale avec backtracking sur les snaps intermédiaires.
- Aucun snap de VIA ne doit être figé tant que le reste de la chaîne n'est pas routable.
- Les caches doivent inclure l'identité complète des options/contraintes et être invalidés quand le graphe change.
- Échec réseau ≠ absence réelle de voie.
- Un recalcul échoué doit invalider le nouveau path, jamais conserver silencieusement l'ancien.

### C. Validation V2 fail-closed
Findings : **4, 5, 17, 20, 28, 32, 39, 44, 61, 62, 63, 66**.
Avant `VALID`, imposer :
- exactement N-1 legs pour N arrêts ;
- chaque leg >=2 points et bons IDs from/to ;
- tous les VIA couverts sur le bon leg ;
- continuité géométrique ;
- aucune `path.error` ;
- chronologie strictement monotone ;
- matériel/traction/écartement compatibles lorsque connus ;
- toute modification fonctionnelle remet en DRAFT.

### D. Spawn/runtime/Livemap déterministes
Findings : **6, 9, 10, 12, 20, 21, 29, 30, 31, 36, 37, 38, 39, 42, 43, 44, 45, 50, 63, 66**.
- Respecter `occ.versionId`, calendriers et `occ.cancelled` sans fallback fail-open.
- Réserver chaque véhicule de façon transactionnelle, une seule occurrence gagnante.
- Ne jamais compiler un service avec un leg vide.
- `blocked_route` doit rester visible, libérer/récupérer proprement le matériel et afficher la cause.
- Revalidation doit précéder la compilation au reload.
- Un blocage runtime doit être visible depuis Horaire/Livemap, pas seulement Roulements.
- Un départ V2 doit utiliser une horloge à la seconde ou des horaires normalisés explicitement à la minute.

## P1 — réalisme et cohérence de roulement
Findings : **11, 14, 18, 19, 24, 25, 35, 41, 49, 64**.
- Exécuter les opérations à l'origine.
- Consommer réellement dwell + durée d'opération, y compris au terminus.
- Résoudre les dépendances par graphe topologique et détecter les cycles.
- Vérifier localisation coordonnée du matériel et rotations désactivées.
- Corriger traction mixte diesel/électrique et disponibilité après annulation/reload.

## P2 — diagnostics/UX
Findings : **15, 17, 37, 40, 41** et polish associés.
- Coordonnée manquante ne doit jamais devenir 0,0.
- Dédupliquer les warnings UNKNOWN par section/way.
- Afficher explicitement : réseau indisponible, route absente, horaire à réparer, traction absente, incompatibilité physique, matériel occupé.

# Correspondance avec le test Château-Thierry → Dormans

## Symptôme 1 — « WAYPOINT → gare ne marche pas »
Cause racine reproduite : **33** (routage glouton sans backtracking).
Amplificateurs : **22** (wayId sticky), **23** (cache non invalidé), **7/55** (cache rail vide empoisonné), **34** (+VIA mauvais leg), **60** (arrêt prématuré des candidats), **5** (ancien path conservé après échec).

## Symptôme 2 — « parfois le trajet VIA→VIA n'est pas dessiné en entier »
Chaîne principale : **4 + 5 + 16 + 28 + 32 + 34**.
Le jeu peut conserver un vieux path, accepter des legs manquants ou utiliser `legs[i]` appartenant à une autre paire de gares tout en restant VALID.

## Symptôme 3 — « train absent / ne part jamais »
Chaîne la plus dangereuse :
**route partielle acceptée (4/5) → leg vide compilé (20) → passage moving puis blocked_route (44) → disparition Livemap (30) → matériel verrouillé (6)**.
Autres causes indépendantes : **9/21/29** (version/calendrier/NEEDS_REPAIR), **31** (race reload), **12** (secondes vs ticks minute), **38** (double réservation), **39/63/66** (contrat validation/runtime différent).

## Symptôme 4 — « alertes alors que le trajet est correct et unisens »
Causes : **13/27** (`oneway` absent du modèle), **22/60** (mauvaise voie parallèle choisie), **17** (UNKNOWN segment par segment), plus les données potentiellement obsolètes issues de **7/55**.

# Ordre de réparation recommandé
1. **Restaurer v1.1.19 comme contrat architectural sans perdre Schedule V2/Batch186.**
2. **Réparer caches Overpass + bump versions.**
3. **Remplacer le routeur VIA glouton par résolution globale/backtracking.**
4. **Rendre la validation structurelle fail-closed.**
5. **Réparer compilation/runtime/Livemap et réservations de matériel.**
6. **Corriger horloge à la seconde, versions/calendriers et revalidation au reload.**
7. **Corriger roulements/opérations.**
8. **Ajouter une suite de tests terrain adversariaux issue des 66 findings puis rebundler file://.**
9. **Smoke réel prioritaire : Château-Thierry → VIA(s) → Dormans, 8398571, observation T−5 à T+2 et reload avant départ.**

## Règles à ne pas régresser lors du correctif
- OSM/OpenRailwayMap = infrastructure native du jeu.
- Stations OSM = objets gameplay natifs ; RER/rail lourd inclus ; métro/tram/light rail purs exclus.
- Aucun fallback ferroviaire automatique en ligne droite.
- Batch186/catalogue/fret conservés.
- Saves OSM par deltas/pinning, pas de duplication massive du monde natif.
- Bundle file:// reconstruit et testé, pas seulement les sources.
