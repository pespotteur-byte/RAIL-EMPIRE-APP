"""Assemble the RC19 report from completed qualification artifacts, without running the game."""
from pathlib import Path
import json, hashlib, statistics
from datetime import datetime, timezone

r=Path(__file__).resolve().parents[1]; q=r/'QA/RE_REPAIR_RC19'
load=lambda n:json.loads((q/n).read_text())
perf=load('PERFORMANCE_COMPARISON.json'); audit=load('TYPESCRIPT_AUDIT.json'); independent=load('INDEPENDENT_BUILD_AND_RESOURCES.json')
field=load('browser-field/results.json'); hist=load('browser-historique/rc19-memory-smoke.json'); freeze=load('SOURCE_FREEZE.json')
assert perf['complete'] and audit['pass'] and independent['pass']
assert not field['pageErrors'] and not hist['pageErrors']
assert all(p['changedChannels']==0 for p in field['pixels'])
assert all(x['advanced']==600 for x in hist['fleetMovement'])
assert all(hashlib.sha256((r/n).read_bytes()).hexdigest()==h for n,h in freeze['sourceAndBundleHashes'].items())
assert '# pass 908\n' in (q/'repair-final.log').read_text() and '# fail 0\n' in (q/'repair-final.log').read_text()
assert '# pass 102834\n' in (q/'standard-final.log').read_text()
s3=json.loads((q/'s3-qualified.log').read_text().strip().splitlines()[-1]);assert s3['ok'] and s3['passed']==269
assert (q/'final-qualification-driver.log').read_text().strip()=='RC19_EXIT_CODE:0'
assert (q/'final-evidence-driver.log').read_text().strip()=='RC19_EXIT_CODE:0'
freeze['stage']='sources and runtime unchanged after final independent, browser and performance verification'
freeze['finalVerificationUtc']=datetime.now(timezone.utc).isoformat();(q/'SOURCE_FREEZE.json').write_text(json.dumps(freeze,indent=2))
summary={
 'build':audit['build'],'edition':'FULL','baseline':'RC18 FULL','qualifiedUtc':datetime.now(timezone.utc).isoformat(),
 'pass':True,'scope':'Qualification of RC19 field fixes; not proof of zero defects or certification of the user PC.',
 'standard':{'passed':102834,'failed':0,'skipped':0,'evidence':'standard-final.log'},
 'repair':{'passed':908,'failed':0,'newTests':42,'newTestFiles':4,'skipped':0,'evidence':'repair-final.log'},
 'regression':s3,'suitesOverlap':True,
 'typescript':{'configsPassed':16,'applicationModules':120,'pairedDeclarations':120,'explicitAny':36,'expectError':28,'ignore':0,'nocheck':0,'newStrictModules':5,'newDebt':0,'strictEndToEndComplete':False,'evidence':'TYPESCRIPT_AUDIT.json'},
 'independentBuild':independent,
 'browser':{'views':len(hist['navigation']),'fleetObservations':hist['fleetMovement'],'pageErrors':[],
   'rescue':'cycle complete rechecked in historical browser harness',
   'finance':{'transactions':field['finance']['history'],'dailySnapshots':field['finance']['days'],'interactiveCanvases':field['finance']['canvases'],'exportedJSONRows':field['financeExportRows'],'csvRowsExcludingHeader':1600,'journalPageSize':100,'readOnlyChartDataUnchanged':field['financialDataUnchangedByDrag']},
   'pixelReference':'Exact unculled polyline, not the old subpixel-thinned renderer; six real Canvas rasterisations.','pixelComparisons':field['pixels'],
   'replayPump':field['replayPumpWithoutAdditionalPaint'],'replayPumpScope':'Real engine and main loop with one-hour time target, no populated 11-train user scenario; no extra requestAnimationFrame callbacks during measurement. Not a catchup speed guarantee.',
   'environment':'Chromium Linux with real bundles and isolated storage; external requests intercepted; not native Opera/Win7.'},
 'beforeAfter':{'RC18':load('reproduction-RC18.json'),'RC19':load('reproduction-RC19.json')},
 'performance':{'method':perf['method'],'results':[{k:t[k] for k in ['scenario','beforeMs','afterMs','speedup']} for t in perf['results']],'globalFPSMeasured':False},
 'limits':['Virtual block signalling, not a complete real-world surveyed signalling installation or all national regulations.',
 'The user 11-train two-hour save/profile was not supplied; no equivalence claim for that session.',
 'Retained financial history grows; old entries already deleted by earlier releases are unrecoverable; no unlimited browser quota.',
 'Fewer intermediate map draws during catchup, same geometry and fixed 100 ms physics. A very long absence may still take time.',
 'No full strict TypeScript claim, no all-bug-free claim, no new global storage compression ratio, no OSM 403 clearance.'],
 'testMaintenance':{'cacheExpectedVersionOnlyUpdates':49,'historicalClockTest':'Checks every chronological minute rather than the old per-call delivery limit.','newExclusions':0,'developmentLogs':'Files ending dev/first and intermediate build/test logs are historical failed attempts, not the final qualification.'}
}
(q/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
labels={
 'blocks-300':'Cantons — 300 points / 11 trains / 100 appels par train',
 'blocks-15000':'Cantons — 15 000 points / 11 trains / 100 appels par train',
 'blocks-60000':'Cantons — 60 000 points / 11 trains / 100 appels par train',
 'route-small-static':'Tracé — 300 points / 30 dessins, caméra fixe',
 'route-dense-static':'Tracé — 60 000 points / 30 dessins, caméra fixe',
 'route-dense-pan':'Tracé — 60 000 points / 30 dessins, caméra déplacée'}
perfrows='\n'.join(f"| {labels[t['scenario']]} | {t['beforeMs']:.3f} ms | {t['afterMs']:.3f} ms | ×{t['speedup']:.2f} |" for t in perf['results'])
coldrows='\n'.join(f"| {labels[t['scenario']]} | {statistics.median(p['before']['coldMs'] for p in t['pairs']):.3f} ms | {statistics.median(p['after']['coldMs'] for p in t['pairs']):.3f} ms |" for t in perf['results'])
report=f'''# Rail Empire — RC19 FULL
## Retour terrain : cantonnement, dashboard, LiveMap et reprise de partie

Base : RC18 FULL. L'archive conserve le jeu, les sources et l'historique. Cette livraison ne fournit pas d'édition LIGHT.

Le retour de PE est une session de deux heures avec onze trains, globalement fonctionnelle mais montrant quatre domaines à améliorer. Sa sauvegarde et son profil n'ont pas été fournis dans cette passe. Les reproductions ci-dessous sont contrôlées : elles ne prétendent pas mesurer ce PC ni expliquer chaque ralentissement rencontré.

## 1. Cantonnement : défaut d'infrastructure reproduit

Le nettoyage conservait les blocs occupés mais supprimait aussi des blocs vides encore référencés par un itinéraire. Dans la reproduction, les 24 blocs du trajet devenaient zéro. L'occupation d'un identifiant absent était ensuite acceptée et deux trains pouvaient obtenir le même bloc. RC19 conserve les blocs référencés par les routes en cache, les services actifs et les secours ; un itinéraire réutilisé peut reconstruire ses entrées manquantes. Les blocs devenus réellement inutilisés restent récupérables.

| Reproduction identique | RC18 | RC19 |
|---|---:|---:|
| Blocs avant nettoyage | 24 | 24 |
| Blocs après nettoyage | 0 | 24 |
| Premier train accepté | Oui | Oui |
| Deuxième train conflictuel accepté | Oui, défaut | Non |

Preuves : `QA/RE_REPAIR_RC19/reproduction-RC18.json`, `reproduction-RC19.json` et `scripts/rc19-block-reproduction.mjs`.

Les feux virtuels à la fin d'un bloc consultent maintenant le bloc **situé après leur position**, et non le bloc derrière eux. Bloc d'entrée indisponible : rouge ; bloc suivant indisponible : avertissement ; sinon voie libre pour le mouvement approchant. Une réservation appartenant au train approchant n'est plus interprétée comme un avertissement. Le train qui a déjà dépassé un signal ne le rend pas vert derrière lui. La déduplication garde séparés les deux sens. Les feux d'un itinéraire visible ne disparaissent pas simplement parce que la cabine est hors champ. Aucun feu terminal arbitraire n'est ajouté en fin de route.

Le contrôleur de mouvement conserve ses courbes de freinage, l'occupation de la queue, les contraintes de proximité, de gare, de croisement, de traction et de travaux. Les causes de retenue canton sont exposées par `CANTON_APPROACH` / `CANTON_STOP`. Les tables internes utilisent une recherche indexée ; les tables externes gardent la compatibilité linéaire. Les contrôles de sécurité n'ont pas été retirés pour gonfler un benchmark.

Le test physique fait partir un train à 60 km/h vers un bloc fermé. Pendant 240 secondes simulées à 100 ms, il freine sans chute instantanée, s'arrête avant le bloc avec plus de 25 m de marge et ne le franchit pas. Après libération réelle du train en tête, il repart et franchit le bloc. Le scénario passe en mode complet et distant. L'occupation d'un train de 750 m est également vérifiée jusqu'au dégagement de la queue.

**Périmètre :** c'est le cantonnement virtuel du jeu, pas une cartographie complète des signaux réels ni une certification réglementaire BAL/BAPR/ETCS. Les positions réelles des signaux, tous les aspects nationaux et toutes les situations géométriques ne sont pas certifiés. La compatibilité de l'API bas niveau pour un identifiant arbitraire totalement inconnu n'a pas été changée ; c'est la création/conservation des entrées utilisées par les routes actives qui est protégée.

## 2. Dashboard : poignées et récapitulatif financier

Les six graphiques deviennent consultables par poignée/curseur et clavier. Sur les courbes : saisie d'un point, molette, deux poignées de période, « Tout » et « Derniers points ». Les deux barres de ventilation disposent également d'une poignée de lecture. Ces commandes inspectent les valeurs, elles ne les éditent pas. Le rafraîchissement automatique ne détruit plus un glissement ou les champs financiers en cours de saisie.

Les recettes et dépenses cumulées partagent le même graphique. Les dépenses absentes d'une ancienne sauvegarde sont représentées comme inconnues, sans fabriquer des zéros historiques. Les courbes financières et les bilans journaliers ne sont plus tronqués. Les séries non financières ponctualité/voyageurs/kilomètres conservent leur fenêtre roulante historique.

Le nouveau panneau présente solde, recettes/dépenses cumulées, résultat, pénalités (déjà incluses dans les dépenses), chiffres du jour, dette, ventilations par catégorie/ligne, bilans journaliers et journal filtrable. Les dates du journal sont en heure de Paris ; les filtres de dates sont explicitement UTC. Les emprunts ne sont pas des revenus d'exploitation. Le JSON financier contient aussi l'état bancaire ; le CSV contient tout le journal économique.

Les limites de 500 opérations économiques, 30 bilans journaliers et 200 écritures du journal bancaire ont été retirées. La pagination à 100 lignes économise du DOM, sans supprimer les données. Les exports prennent toutes les écritures, pas seulement la page affichée. Le JSON financier n'est pas un export de partie restaurable.

La reproduction de conservation donne 1 500 opérations et 64 jours sous RC19, contre 500 et 30 sous RC18. Le navigateur teste 1 600 opérations, 64 jours, 600 échantillons de recettes/dépenses, les six contrôles, le zoom, la saisie du curseur, le clavier, la pagination, la recherche et les véritables téléchargements (1 600 lignes JSON ; 1 600 écritures CSV). Les données restent identiques après manipulation des graphiques.

**Limites :** les écritures déjà effacées par RC18 ne sont pas récupérables. Le drapeau d'historique ancien avertit de cette lacune. Un historique non tronqué continue à grandir ; les codecs de sauvegarde existants sont conservés, sans promettre un quota infini ou un nouveau facteur ×100. Une page de détail ouverte est un instantané ; fermer/réouvrir ou quitter/revenir permet de la rafraîchir sans perturber les interactions.

## 3. LiveMap : réutilisation exacte des tracés sélectionnés

Le nouveau cache garde les coordonnées exactes, avec au maximum huit routes et 200 000 points retenus. Des fenêtres de 128 segments permettent de projeter uniquement les portions pertinentes, en conservant les segments qui traversent l'écran et une marge pour les traits épais. À caméra fixe, les projections déjà calculées sont réutilisées. Une modification en place d'un point intérieur invalide correctement le résultat ; les coordonnées sont vérifiées, pas seulement les extrémités. Une route trop grande peut être dessinée sans être conservée dans le cache.

Aucune nouvelle décimation, résolution réduite, suppression de tuiles, d'image ou de son. La référence de qualité est la polyligne exacte non décimée. Six comparaisons avec le véritable rasteriseur Canvas (trois zooms, deux positions) donnent **zéro canal RGBA différent**. Ce test porte sur la géométrie du tracé, pas sur tous les effets de toute la carte.

Le benchmark exécute les vraies méthodes de projection/dessin avec un récepteur Canvas sans rasterisation. Les caches ordinaires de projection de la carte sont activés pour RC18 et RC19. Il mesure le CPU de ce traitement, pas les tuiles, les trains, le GPU ni les FPS. Le rendu RC18 employait déjà une réduction subpixel ; RC19 est comparée à cette méthode existante pour les temps, et à la géométrie exacte pour les pixels.

Cinq paires de processus indépendants alternent RC18/RC19 ; chaque processus comporte deux chauffes puis cinq échantillons. Les sorties des contrôles de cantons doivent être strictement identiques. Les coûts de premier appel, comprenant construction/réchauffement, sont conservés séparément.

### Médianes après chauffe

| Scénario | RC18 | RC19 | Rapport RC18 / RC19 |
|---|---:|---:|---:|
{perfrows}

### Premier appel complet, médiane des cinq processus

| Scénario | RC18 | RC19 |
|---|---:|---:|
{coldrows}

Sur les cantons, le petit scénario a un surcoût d'environ 6,5 %, le moyen d'environ 3 % et le grand est proche de l'égalité. Aucun gain global de simulation n'est annoncé. La conservation correcte des blocs garde davantage d'infrastructure que le nettoyage défectueux ; le cache de tracés borné utilise aussi de la mémoire. Ce n'est pas une promesse de réduction de toute la RAM.

Preuves : `QA/RE_REPAIR_RC19/PERFORMANCE_COMPARISON.json`, `benchmark.log`, `scripts/benchmark-rc19.cjs`, `scripts/benchmark-rc19-worker.mjs`.

## 4. Import / rechargement : donner la priorité à l'heure et aux mouvements

L'import transactionnel RC18 reste en place. Le format de partie n'est pas remplacé par le JSON financier. Après reprise, le temps réellement simulé demeure la référence ; le rattrapage vise l'heure réelle sans placer artificiellement les trains à une arrivée théorique.

Quand la dette dépasse deux secondes, le moteur peut effectuer jusqu'à 2 000 pas par tranche, contre 50 auparavant. Le budget coopératif est de 8 ms, mais **chaque pas physique reste de 100 ms**. Les événements de minute/seconde et les déplacements gardent leur ordre. Une tâche temporisée unique ajoute des tranches entre les dessins. Elle s'arrête en pause, pendant un import, lorsque la partie est inactive ou lorsque l'onglet est caché ; elle ne remplace pas le fonctionnement normal du moteur en arrière-plan. Une erreur ne crée pas une boucle de relance incontrôlée.

Pendant cette phase, les dessins intermédiaires de la carte sont espacés jusqu'à 200 ms afin de laisser du calcul à l'horloge et aux trains. La résolution reste la même ; la cadence normale revient après rattrapage. Le bandeau montre l'instant simulé et la dette. Une sauvegarde/reprise au milieu conserve exactement le curseur atteint.

Le scénario navigateur de reprise charge la vraie boucle, vise une heure plus tard, contrôle le premier lot borné, le compteur de temps physique non jeté et une nouvelle sauvegarde/relecture exacte. Un autre essai désactive les rafraîchissements supplémentaires : la tâche de reprise fait encore avancer l'horloge avec zéro temps physique abandonné. Ce dernier essai utilise un jeu de test sans la flotte de onze trains de PE ; ses secondes avancées ne sont pas un débit promis pour une partie chargée.

**Limites :** un callback indivisible peut dépasser 8 ms ; le budget n'est pas une garantie temps réel. Le rattrapage d'une longue absence reste proportionnel au travail à rejouer. Rien ne prouve une remise à jour instantanée sur Opera/Win7. Il n'y a ni saut des recettes/arrêts/incidents ni téléportation pour masquer ce coût.

## 5. Qualification finale de l'édition FULL

| Contrôle | Résultat final |
|---|---:|
| Configurations TypeScript | 16 réussies |
| Suite standard | 102 834 / 102 834 |
| Suite réparation | 908 / 908, dont 42 nouveaux |
| Régression S3 | 269 / 269 fichiers actifs |
| Exclusions historiques S3 | 11, aucune nouvelle |
| Reconstruction indépendante | 120 JS + 120 déclarations + 3 bundles identiques |
| Ressources comparées à RC18 | 37 152 inchangées |
| Pages du navigateur | 15 |
| Flotte inter-pages | 600/600 avancent aux quatre observations |
| Erreurs de page dans les essais navigateur | 0 |
| Comparaisons de pixels du tracé exact | 6/6 identiques |

Les suites se recouvrent : ne pas additionner leurs nombres. Le scénario de secours réalise toujours aller, intervention, retour et réception au dépôt. Les défauts et correctifs historiques restent testés.

Les 49 changements dans les attentes de cache des tests historiques ne font que remplacer `1199repair18` par `1199repair19`. Le test de chronologie vérifie désormais tous les événements intermédiaires au lieu d'exiger l'ancien petit plafond par appel. Aucune assertion de conflit, d'égalité de sauvegarde ou de conservation des données n'a été retirée pour faire passer la livraison. Les journaux de développement échoués sont conservés avec des noms `dev`, `first` ou intermédiaires ; seules les preuves `*-final.log`, `s3-qualified.log` et les deux pilotes finaux de sortie zéro constituent la qualification finale.

La reconstruction indépendante a d'abord échoué parce que son répertoire temporaire omettait les deux HTML requis par le constructeur de bundles. La préparation a été corrigée, puis la reconstruction et la comparaison ont réussi ; aucune erreur applicative n'a été masquée. Les sources/bundles sont restés inchangés pendant cette vérification finale (`SOURCE_FREEZE.json`).

### TypeScript

120 modules applicatifs, tous avec leurs sorties générées. Les cinq nouveaux modules passent une configuration stricte isolée (`tsconfig.rc19-core.json`) sans les anciennes déclarations globales permissives. La dette reste à **36 `any` explicites et 28 `@ts-expect-error`**, zéro nouveau `@ts-ignore`/`@ts-nocheck`. Les contrats globaux historiques demeurent : le typage strict intégral de bout en bout n'est pas déclaré terminé. Les outils de build/tests et les ressources de données sont un périmètre distinct.

### Environnement et portée

Node 22.16, TypeScript 5.8.3, Chromium Linux. Bundles réels et données fournies, stockage isolé et réseau extérieur intercepté. La navigation native locale avait été bloquée dans cet environnement ; les tests injectent les fichiers réels. Opera/Win7, les caches/quota physiques, l'audio, les services externes et le cas réel de PE ne sont pas certifiés. La 403 OSM n'est pas déclarée levée. Aucun nouvel essai de deux heures sur le PC de PE, aucune absence absolue de bug, aucun total « tous bugs possibles résolus ».

## 6. Installation et retour arrière

Conserver RC18 et un export de référence. Fermer les anciennes fenêtres et arrêter leur serveur. Extraire RC19 FULL dans un nouveau dossier, lancer `LANCER_RE.cmd`, garder la même adresse et le même port. Ne pas effacer le stockage du site, ne pas ouvrir les deux versions simultanément. Pour revenir à RC18, reprendre l'export d'avant migration : l'ancienne version peut à nouveau tronquer un historique chargé.

Voir `LIRE_AVANT_RC19.md`. L'intégrité de l'archive finale est consignée séparément dans `RE_RC19_PACK_INTEGRITY.json`, après création et relecture du ZIP. Le manifeste embarqué protège les fichiers de l'archive, mais n'est pas une signature cryptographique d'éditeur.
'''
(r/'RE_REPARATION_RC19_RAPPORT.md').write_text(report)
registry='''# RC19 — registre du retour de la session de deux heures

Ce registre suit les nouveaux retours de PE. Il ne remplace pas le registre historique et ne transforme pas une demande de réalisme/performance en certification absolue.

| Référence | Travail livré | Preuve | Validation restant extérieure |
|---|---|---|---|
| FIELD01 | Conservation/réhydratation des blocs actifs ; conflit interdit après nettoyage | RC18 : 24→0 blocs et conflit accepté ; RC19 : 24→24 et conflit refusé ; tests de queue 750 m | Le réseau réel de la sauvegarde de PE n'a pas été exécuté ici |
| FIELD02 | Indications à l'entrée du bon bloc, réservation propre, sens, cabine hors champ ; freinage/réouverture | 16 tests, dont moteur complet et distant vers signal fermé, puis reprise | Tous les systèmes réglementaires et la localisation réelle des signaux ne sont pas implémentés/certifiés |
| FIELD03 | Six graphiques manipulables en lecture, recettes et dépenses ensemble | Vrai navigateur : saisie, zoom, clavier, données inchangées | Ergonomie sur le PC de PE à confirmer |
| FIELD04 | Récapitulatif financier complet et historiques conservés ; exports intégrals | 1 600 opérations/64 jours, pagination et recherche, vrais JSON/CSV | Anciennes écritures supprimées irrécupérables ; quota pas illimité |
| FIELD05 | Cache exact borné du tracé sélectionné, sélection des portions pertinentes | Six images identiques à la référence exacte ; benchmark indépendant ×12,92 fixe et ×7,47 déplacement sur grand tracé | FPS/mémoire sur la session réelle de onze trains non mesurés |
| FIELD06 | Tranches de rattrapage prioritaires entre dessins, horloge et positions ensemble | 100 ms inchangés, minutes rejouées, zéro temps physique abandonné, sauvegarde/reprise au même curseur | Délai final d'une longue absence non garanti sur Opera/Win7 |

Les correctifs et fonctions ci-dessus sont livrés et passent leurs critères automatisés. La confirmation terrain des performances et du cantonnement sur la partie utilisateur reste nécessaire. Aucune nouvelle exclusion de test ; les 11 exclusions historiques S3 sont conservées.

Les limitations de typage strict historique (36 any, 28 expect-error et déclarations globales larges), de services externes et de plateforme ne sont pas reclassées en succès.
'''
(r/'RE_REGISTRE_RETOUR_TERRAIN_RC19.md').write_text(registry)
print('Reports, summary and source freeze verified/written')
