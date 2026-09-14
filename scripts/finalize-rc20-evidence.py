"""Assemble the release report only from successful, completed RC20 evidence."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, re, zipfile, difflib
root=Path(__file__).resolve().parents[1];qa=root/'QA/RE_REPAIR_RC20'
read=lambda name:json.loads((qa/name).read_text())
for name in ['build','repair','standard','s3','rebuild','browser-liveries','browser-historical','browser-field','benchmark-final']:
    assert (qa/(name+'.exit')).read_text().strip()=='0',f'Gate not complete: {name}'

def tap(name):
    text=(qa/name).read_text()
    result={key:int(re.findall(r'^# '+key+r' (\d+)\s*$',text,re.M)[-1]) for key in ['tests','pass','fail','cancelled','skipped']}
    assert result['fail']==result['cancelled']==result['skipped']==0 and result['tests']==result['pass']
    return result
standard=tap('standard.log');repair=tap('repair.log')
s3=json.loads([line for line in (qa/'s3.log').read_text().splitlines() if line.startswith('{')][-1]);assert s3['ok'] and s3['passed']==s3['totalActiveFiles'] and s3['archivedSupersededFiles']==11
build=read('INDEPENDENT_BUILD_AND_RESOURCES.json');assert build['pass']
audit=read('TYPESCRIPT_AUDIT.json');assert audit['pass'] and audit['explicitAnyTotal']==36 and audit['suppressions']=={'ignore':0,'nocheck':0,'expectError':28}
liveries=read('browser-liveries/results.json');assert not liveries['pageErrors'] and liveries['previewEqualsExport'] and liveries['pngPixelReference']['differences']==0 and liveries['failedWrite']['libraryRestored'] and liveries['saveReload']['libraryEqual'] and liveries['portableFileExportImport']['linked'] and liveries['deleteRestoresOriginal']['physicalRestored']
browser=read('browser-historique/rc19-memory-smoke.json');assert not browser['pageErrors'] and len(browser['navigation'])==16 and all(row['target']==row['active']for row in browser['navigation']);assert all(row['advanced']==600 for row in browser['fleetMovement']) and len(browser['fleetMovement'])==4 and browser['rc17RescueTow']['state']=='done'
field=read('browser-field/results.json');assert not field['pageErrors'] and all(row['changedChannels']==0 for row in field['pixels']) and field['financialDataUnchangedByDrag'] and field['replayPumpWithoutAdditionalPaint']['discardedPhysicsSeconds']==0
incidents=read('INCIDENT_BEFORE_AFTER.json');assert incidents['pass']
bench=read('DUPLICATION_BENCHMARK.json');assert len(bench['results'])==4 and all(len(row['runs']['RC19'])==len(row['runs']['RC20'])==5 for row in bench['results'])
changes=[];patch=[]
with zipfile.ZipFile(root.parent/'Rail_Empire_S3_GAMEPLAY_REPAIR_RC19.zip') as archive:
    for name in archive.namelist():
        if not name.startswith('js/__tests__/') or name.endswith('/'):continue
        p=root/name
        old=archive.read(name)
        if p.exists() and p.read_bytes()!=old:
            new=p.read_bytes();cacheOnly=old.replace(b'1199repair19',b'1199repair20')==new
            changes.append({'path':name,'cacheTokenOnly':cacheOnly})
            if not cacheOnly:patch.extend(difflib.unified_diff(old.decode().splitlines(True),new.decode().splitlines(True),fromfile='RC19/'+name,tofile='RC20/'+name))
(qa/'HISTORICAL_TEST_CHANGES.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2))
(qa/'HISTORICAL_FIXTURE_UPDATES.patch').write_text(''.join(patch))
summary={'build':json.loads((root/'package.json').read_text())['railEmpireBuild'],'edition':'FULL','base':'RC19 FULL','qualifiedUtc':datetime.now(timezone.utc).isoformat(),'pass':True,
 'scope':'Scheduled station incidents, exact duplication and numbering, user livery editor and per-vehicle integration. No zero-bug or whole-game FPS guarantee.',
 'typescriptConfigurations':17,'standard':standard,'repair':{**repair,'newComparedWithRC19':repair['tests']-908},'s3':s3,'independentBuild':build,
 'typescript':{'modules':125,'newStrictModules':5,'explicitAny':36,'expectError':28,'ignore':0,'nocheck':0,'strictEndToEndComplete':False},
 'browser':{'pages':16,'fleet':600,'allAdvanceAtFourObservations':True,'rescueFullCycle':True,'liveryPixelEquality':True,'actualPNGExport':True,'actualGzipGameExportAndFileInputImport':True,'liveryFailedWriteRollback':True,'referencesRestored':True,'financeAndRoutePixelsPreserved':True,'pageErrors':0,'harness':'Real production bundles, actual Chromium DOM/Canvas; injected local assets, isolated storage and external network blocked. Not native Opera/Win7 or disk quota validation.','responsiveCaveat':'Livery workshop fits 375px; pre-existing global header can overflow (document width 513px in test).'},
 'benchmark':{'file':'DUPLICATION_BENCHMARK.json','method':bench['method'],'wholeGameFpsClaim':False},
 'historicalTestUpdates':changes,'newTestExclusions':0,'nativeNavigation':read('NATIVE_NAVIGATION.json'),
 'limitations':['No native Windows 7/Opera qualification','No real browser disk quota measurement','No external OSM/ORM/audio validation or lifted 403','Livery count has no arbitrary cap but memory and quota remain finite','Livery images do not change physical stock or simulated cargo','Maximum 32 MiB source file, 8192 px per side and 16777216 px total; animated raster flattened','Purely descriptive SC names remain unchanged; numeric labels follow numbering rules','Historic strict TypeScript ambient declarations remain permissive']}
(qa/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
rows='\n'.join(f"| {r['points']:,} points × {r['copies']} copies ; {r['backgrounds']} autres horaires | {r['RC19_ms']:.3f} ms | {r['RC20_ms']:.3f} ms | ×{r['speedup']:.2f} |".replace(',',' ')for r in bench['results'])
report=f'''# Rail Empire — RC20 FULL
## Incidents aux arrêts prévus, duplications et atelier Livrées

Base : RC19 FULL, conservée. Livraison complète : jeu, sources TypeScript, ressources et historique. Pas de version LIGHT. Cette passe réalise les trois demandes de PE et les compléments de placement libre du chargement et de dimensions d’export.

## 1. Incidents de train en gare

Le défaut a été reproduit avec le véritable IncidentManager de RC19 extrait de l’archive d’origine : un direct Bonn Hbf–Köln Hbf immobilisé à Roisdorf recevait un malaise voyageur, alors que Roisdorf n’est pas un arrêt de son horaire. Dans RC20 le même scénario est refusé ; l’arrêt prévu à Cologne demeure éligible. Preuve : `QA/RE_REPAIR_RC20/INCIDENT_BEFORE_AFTER.json`.

La décision passe par un contrat unique : service non terminé/non annulé, état d’attente ou d’arrêt compatible, vitesse absolue au plus 0,1 km/h, occurrence d’arrêt réellement atteinte dans l’horaire courant et identité de gare cohérente avec `stoppedAt`. Le retour utilise ses propres arrêts. Un point de passage, un point technique ITE, un simple voisinage géographique ou un ancien marqueur d’arrêt d’un train reparti ne suffit pas.

Pour une ancienne sauvegarde sans marqueur de gare, seules les coordonnées explicites du point d’arrêt prévu, à moins de 100 m, sont utilisables. Le moteur ne remplace pas cette vérification par « la gare la plus proche ». L’origine en attente et le terminus réellement atteint sont couverts. Le libellé de l’incident provient de cette gare prévue, pas d’une gare voisine.

Les trois incidents de train qui exigent un arrêt — portes, affluence et malaise — utilisent le contrôle. Le malaise demande désormais aussi une capacité voyageurs, comme les autres incidents passagers. Il s’agit d’un contrôle de capacité, pas d’une preuve qu’un passager est effectivement à bord. Les incidents d’infrastructure ou affectant une gare entière ne sont pas désactivés : ils peuvent légitimement toucher un train direct. Les incidents déjà présents dans une sauvegarde ne sont pas effacés rétroactivement.

## 2. Duplication : copies exactes, numéros libres, pas de reconstruction du réseau entier

Le SC ne duplique plus un horaire par son format de sauvegarde. Ce détour réencodait les routes, imposait les arrondis du stockage et pouvait reconstruire tous les horaires pour préparer un retour arrière. RC20 conserve directement les données exactes, recrée les identifiants nécessaires et ne supprime que les nouvelles entrées du lot si celui-ci échoue. Les anciens horaires gardent leurs identités en mémoire.

Pour un lot, un plan de copie temporaire repère une seule fois le graphe d’objets et ses valeurs primitives. Chaque copie alloue ses objets éditables indépendants ; les références communes à l’intérieur d’une copie restent cohérentes sans être partagées avec la source ou une autre copie. Le plan est libéré en fin de lot, succès ou échec. Les coordonnées, contraintes, tronçons et métadonnées ne sont pas décimés ni réarrondis. Les essais couvrent notamment cycles, Maps/Sets/Dates, prototypes, tableaux creux, identifiants spéciaux, 50 profils de voies et rollback partiel.

Un index de numéros et de noms évite les scans répétés. Les zéros et suffixes sont conservés. Les répétitions du SC gardent le pas +2 ; une paire aller-retour conserve aller N et retour N+1, puis passe au couple suivant disponible. Un numéro présent dans le nom suit le nouveau numéro. **Un nom descriptif sans chiffre reste inchangé**, conformément au contrat historique, plutôt que recevoir arbitrairement un numéro.

L’éditeur de rame propose un nom/numéro libre : exemple navigateur `Fret 001` / `R-0007` vers `Fret 002` / `R-0008`. Une duplication obtient de nouveaux identifiants d’éléments, conserve les références de livrée et reste soumise aux règles d’achat habituelles. Une collision de numéro explicitement saisi est refusée avant de débiter. Le numéro ne remplace pas l’identifiant technique.

### Mesures de duplication complète d’un lot

| Charge synthétique | RC19 — médiane | RC20 — médiane | Rapport |
|---|---:|---:|---:|
{rows}

Méthode : cinq paires de processus indépendants, ordre alterné RC19/RC20 ; deux chauffes puis trois échantillons par processus. La mesure inclut plan de copie, allocation, renumérotation, réidentification et préparation du rollback. La construction initiale du réseau et des profils est hors mesure. Les résultats fonctionnels sont comparés entre les deux versions. Les mesures finales sont réalisées après les suites navigateur/compilation, sans autre banc RE simultané.

Ce sont les durées de cette opération, **pas les FPS, la vitesse du routage OSM ou l’import intégral d’une partie**. Un gros lot reste synchrone et utilise de la mémoire temporaire ; l’optimisation ne promet pas une absence totale de pause. Un prototype de copie initialement plus lent a été remplacé avant qualification. Les anciennes mesures de développement ne sont pas les chiffres de livraison. Fichier de référence : `QA/RE_REPAIR_RC20/DUPLICATION_BENCHMARK.json`.

## 3. Page Livrées : une bibliothèque séparée du catalogue

La nouvelle page présente recherche, catégorie, liste paginée de matériels, création, aperçu, modification, copie, suppression et export PNG. Le catalogue se charge à la demande. L’aide contextuelle décrit les opérations. Aucune livrée ne remplace une fiche de matériel d’origine et sa création n’achète aucun véhicule.

Pour un wagon, le sprite RE reste au premier plan et l’image importée est dessinée derrière. Le chargement se déplace à la souris ou avec X/Y ; flèches d’un pixel, Maj de dix pixels ; molette/échelle proportionnelle. Le zoom de l’aperçu est indépendant de l’échelle de l’image. Les valeurs négatives se saisissent normalement, sans que le signe « - » provisoire soit remplacé par zéro.

Le rectangle exporté réserve au moins hauteur wagon + hauteur mise à l’échelle du chargement, puis inclut tout débordement gauche/droite/haut/bas. Le wagon reste à sa taille native. La transparence et le rapport largeur/hauteur du chargement sont conservés ; le damier appartient au CSS et n’est pas exporté. Aucun détourage automatique : les pixels opaques du sprite fourni masquent normalement ce qui est derrière.

Pour un matériel hors catégorie wagon, seule l’image de remplacement est nécessaire. Les fichiers PNG/JPEG/GIF/WebP/BMP sont décodés et normalisés en PNG ; SVG et adresses externes ne sont pas autorisés. Les images animées deviennent une composition fixe.

### Vérification graphique réelle

Dans Chromium, un vrai sprite du jeu (`img/catalog/Wagons/Ks 55 6.gif`, 137 × 16 px) est combiné avec une image de chargement de test. Le scénario déplace l’image hors du cadre initial, ajuste X/Y et applique une échelle de 150 %. Le PNG final mesure 330 × 91 px. L’aperçu et le fichier téléchargé sont identiques **pixel par pixel** ; la comparaison indépendante place le wagon natif devant le chargement avec **zéro canal RGBA différent** et des pixels transparents conservés. Le chargement volontairement surdimensionné vérifie le non-rognage, pas un modèle de conteneur à l’échelle réelle.

### Rames, engins physiques et sauvegarde

Chaque véhicule compatible possède un choix de livrée, y compris « Image d’origine ». Deux wagons identiques peuvent afficher des variantes différentes. La sélection, les véhicules physiques matérialisés et les apparences des instantanés de services utilisent une synchronisation visuelle séparée des propriétés physiques. Ni masse, ni vitesse, ni puissance, ni chargement simulé ne sont modifiés par une image. La mise à jour est déclenchée par l’édition, pas par un nouveau travail à chaque pas physique.

Les rames enregistrent une référence de livrée et leur image d’origine de secours. La bibliothèque conserve les images sources, l’export et le placement, en mutualisant les images strictement identiques. Une copie de livrée réutilise ces ressources sans dupliquer inutilement les chaînes d’image. Les anciennes créations ne sont jamais tronquées. **1 200 enregistrements** sont conservés/rechargés dans le test sans plafond arbitraire.

L’enregistrement attend la réussite réelle de l’écriture. Un refus de quota restaure l’ancienne bibliothèque et les apparences, sans rembobiner le temps ni les comptes. Le test navigateur vérifie le refus d’écriture, l’absence d’achat, la sélection de deux apparences différentes, la copie d’une rame, puis le vrai fichier gzip d’export de partie et son import via le champ fichier de l’interface. Images, sources, placements et références sont retrouvés. Supprimer une livrée rétablit l’image d’origine sur les véhicules concernés, sans retirer le matériel du catalogue.

**Limites explicites :** aucune limite arbitraire de nombre, mais mémoire et quota finis. Une source importée est plafonnée à 32 Mio ; une image ou composition à 8 192 px par côté et 16 777 216 px au total. Le navigateur peut échouer avant ces plafonds sur une machine limitée. Les sources et le composite rendent la création rééditable, mais ils occupent réellement du stockage. Ce n’est pas une nouvelle promesse de division par 100. Le panneau Livrées tient dans 375 px ; le bandeau global historique peut encore déborder à cette largeur.

## 4. Qualification de l’édition livrée

| Contrôle exécuté | Résultat |
|---|---:|
| Configurations TypeScript | 17 réussies |
| Suite standard | {standard['tests']:,}/{standard['tests']:,} |
| Suite réparation | {repair['tests']}/{repair['tests']}, dont {repair['tests']-908} nouveaux |
| Régressions S3 | {s3['passed']}/{s3['totalActiveFiles']} fichiers actifs |
| Exclusions historiques S3 | 11, aucune nouvelle |
| Reconstruction indépendante | 125 modules JS + 125 déclarations + 3 bundles identiques |
| Ressources originales comparées à RC19 | 37 152 inchangées |
| Pages navigateur | 16 |
| Flotte inter-pages | 600/600 progressent aux quatre observations |
| Parcours du secours | Aller, intervention, retour et réception au dépôt réussis |
| Régressions dashboard et géométrie | 1 600 opérations / 64 jours, exports, 6 comparaisons de pixels identiques |

Les suites se recouvrent : leurs nombres ne s’additionnent pas. Le rattrapage conserve zéro temps physique abandonné dans le scénario navigateur. Les vrais bundles sont employés, mais les données réseau et le stockage sont isolés.

Les attentes de version/cache des tests historiques ont été actualisées de `1199repair19` à `1199repair20`. **Deux fixtures fonctionnelles historiques ont été ajustées** : le test de malaise fournit maintenant un arrêt prévu et une rame voyageurs tout en conservant l’ancien cas incomplet comme cas refusé ; le test de déduplication à Meaux utilise le bon curseur d’arrivée après l’arrêt concerné. Leurs assertions de durée, de déduplication et de coexistence restent présentes. L’absence d’aide contextuelle pour la nouvelle page a été corrigée dans le produit, pas en retirant le test. Diffs : `HISTORICAL_FIXTURE_UPDATES.patch` et inventaire `HISTORICAL_TEST_CHANGES.json`.

Seuls les journaux finaux `build.log`, `repair.log`, `standard.log`, `s3.log`, `rebuild.log`, `browser-liveries.log`, `browser-historical.log`, `browser-field.log` et `benchmark-final.log`, avec leurs sorties zéro et le résumé courant, forment la qualification RC20. Les journaux `dev`, `before`, `quick` et autres mesures provisoires sont conservés comme historique de travail ; ils peuvent montrer des essais échoués depuis corrigés.

### TypeScript et plateforme

Les cinq nouveaux modules passent une configuration stricte isolée sans les déclarations globales permissives. L’inventaire relève 125 modules applicatifs, aucun JS exécutable orphelin dans ce périmètre, **36 `any` explicites et 28 `@ts-expect-error`**, sans augmentation et sans nouveau `@ts-ignore` ou `@ts-nocheck`. Le typage strict intégral du reste du jeu n’est pas déclaré terminé.

Environnement : Node 22.16, TypeScript 5.8.3, Chromium Linux. La navigation HTTP locale native est bloquée par l’environnement ; les fichiers réels sont injectés pour les essais navigateur. Opera/Win7, le quota physique du profil de PE, l’audio, les appels OSM/ORM réels et une longue session sur son ordinateur ne sont pas certifiés. La 403 n’est pas déclarée levée. Aucun nouveau gain global de FPS, aucune suppression de ressource et aucune promesse d’absence absolue de bug.

## 5. Installation, conservation et intégrité

Conserver RC19 et un export de référence. Extraire RC20 FULL dans un nouveau dossier et fermer l’ancienne version. Garder le lancement HTTP local, la même adresse et le même port ; ne pas vider les données du site. L’export de partie inclut les livrées ; l’export PNG seul ne remplace pas cet export. Pour revenir à RC19, reprendre l’export d’avant migration.

Voir `LIRE_AVANT_RC20.md`. `RC20_SHA256_MANIFEST.json` est le manifeste de l’archive actuelle. Le contrôle de l’archive, effectué après création et relecture de chaque fichier, est fourni séparément dans `RE_RC20_PACK_INTEGRITY.json`. Ces empreintes contrôlent l’intégrité, pas une signature d’éditeur.
'''.replace(f"{standard['tests']:,}",f"{standard['tests']:,}".replace(',',' '))
(root/'RE_REPARATION_RC20_RAPPORT.md').write_text(report)
(root/'RE_REGISTRE_CORRECTIONS_RC20.md').write_text('''# RC20 — registre des demandes de PE

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
''')
print(json.dumps({'pass':True,'tests':repair['tests'],'s3':s3['passed'],'benchmark':[{k:v for k,v in row.items() if k!='runs'}for row in bench['results']],'modifiedHistoricalTests':len(changes)},ensure_ascii=False,indent=2))
