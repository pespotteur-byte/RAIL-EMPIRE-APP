# Rail Empire — réparation gameplay consolidée RC1

**Build : S3_GAMEPLAY_REPAIR_RC1 — 11 septembre 2026**  
**Base : `Rail_Empire_S3_TS_CHECKPOINT_0_SEALED(1).zip`**  
**Statut : version candidate à tester sur une copie de partie. Ce document ne certifie pas l’absence de tout bug.**

## 1. Ce qui est livré

Une archive complète du jeu, avec les ressources d’origine, les sources TypeScript corrigées, le JavaScript compilé et les **deux bundles réellement utilisés par le lancement depuis `index.html`**. Le paramètre de cache du code et du catalogue est `1199repair1`. Il ne s’agit donc pas de sources TS modifiées sans effet dans le navigateur.

Les 14 défauts reproduits dans le dernier dossier d’audit sont corrigés selon leurs assertions originales. Des corrections supplémentaires couvrent le SC, la LiveMap, les états de circulation, la persistance, le passage des journées, le fret et l’économie. Cette livraison n’est pas une refonte complète de toutes les fonctionnalités signalées ou soupçonnées dans les anciens messages.

**Ne pas confondre : un build unique contenant les réparations et une garantie que tous les bugs possibles de RE ont disparu. Le premier est livré ; la seconde n’est pas établie.**

## 2. Résultats de validation

| Contrôle | Résultat consigné dans les preuves jointes |
|---|---|
| Compilation TypeScript 5.8.3 | Réussie |
| Recompilation indépendante | **74/74 modules JS et 74/74 déclarations identiques au livrable** |
| Suite standard `npm test` | 102 834 réussites, aucun échec |
| Gate S3 complète | **208/208 fichiers actifs réussis**, aucun échec ; les 11 archives déjà supersédées restent hors gate |
| Audit initial inchangé | 16/16 : 14 défauts corrigés et 2 cas témoins conservés |
| Tests ciblés de réparation ajoutés | 38 tests |
| `npm run test:repair` | 54/54 : les 38 nouveaux et les 16 de l’audit |
| Démarrage dans Chromium, environnement DOM isolé | Réussi ; 30 977 gares présentes au démarrage du scénario |
| Navigation dans cet environnement | Carte, horaires, incidents, dashboard, graphique, personnel, météo |
| Erreur JavaScript non gérée pendant cet essai DOM | Aucune |

Les fichiers de preuve sont dans `QA/RE_REPAIR_RC1/`. **La gate S3 et la suite standard se recouvrent : leurs volumes ne doivent pas être additionnés comme des tests indépendants.** Les tests incluent du fuzzing et des assertions de source ; leur nombre élevé ne remplace pas une longue partie réelle.

La navigation native vers les URL locales HTTP et `file://` était bloquée par la politique du navigateur de cet environnement. L’essai Chromium a donc utilisé les fichiers du jeu injectés dans un DOM réel, un stockage Web en mémoire et des réponses locales contrôlées. Les appels externes n’ont pas été servis. Les avertissements météo/admin attendus sont conservés dans le compte rendu.

Cela valide un démarrage et plusieurs interfaces, **pas** l’ouverture normale depuis le disque sur le PC du joueur, IndexedDB réel dans ce contexte, les téléchargements de voix, l’ORM distant ou une session de plusieurs heures. La navigation des pages qui chargent le gros catalogue n’a pas été certifiée dans cet essai : une première tentative du banc d’essai a dépassé sa limite en y passant. Les deux bundles sont néanmoins reconstruits et leurs contrats automatisés sont testés.

## 3. SC : erreurs de temps corrigées avec mesures

### 3.1 Une limitation locale ne ralentit plus rétroactivement toute la liaison

La détection des transitions de vitesse ne relit plus ses propres modifications comme de nouvelles limitations. La courbe de freinage utilise les limites d’infrastructure d’origine ; les contraintes successives liées à la longueur du train conservent la plus restrictive.

Scénario synthétique inchangé : train V160, 500 tonnes, 5 MW, 200 mètres ; ligne V160 suivie de 100 mètres explicitement limités à V30. Ce ne sont pas des temps prétendument mesurés sur une ligne réelle.

| Longueur initiale | Ancien temps avec les 100 m V30 | Temps corrigé avec les 100 m V30 |
|---:|---:|---:|
| 10 km | 20 min 24 s | **5 min 17 s** |
| 50 km | 1 h 40 min 24 s | **20 min 17 s** |
| 100 km | 3 h 20 min 24 s | **39 min 02 s** |
| 200 km | 6 h 40 min 24 s | **1 h 16 min 32 s** |
| 400 km | 13 h 20 min 24 s | **2 h 31 min 32 s** |

Le test à 100 km retrouve une pointe de 160 km/h, au lieu d’un trajet entier artificiellement limité à 30.

### 3.2 Le seuil de 12 000 points ne change plus les contraintes ni la puissance retenue

Les copies globales des segments conservent l’électrification, les tensions, l’écartement, le gabarit et les charges. La compatibilité n’est plus différente avant et après le seuil de partage de géométrie.

Dans le scénario mixte de 200 km — dont le dernier kilomètre non électrifié — la description à **12 000 points et celle à 12 001 points donnent toutes deux 4 611 secondes, soit 1 h 16 min 51 s**. Le saut antérieur d’environ 56 minutes disparaît. La puissance électrique/thermique est choisie par segment au lieu de désactiver arbitrairement l’électrique sur toute la liaison.

Les anciennes vues globales de sauvegarde qui ont perdu des attributs peuvent les récupérer depuis les liaisons canoniques lorsque leur géométrie correspond exactement. Cette récupération ne doit pas écraser une restriction déjà documentée dans la vue globale ; ce cas possède également son test.

### 3.3 Autres invariants rétablis

La rampe peut réellement faire décélérer un train insuffisamment puissant. Les hausses de vitesse rapprochées attendent le dégagement de la queue. Les très courtes liaisons ne présentent plus la discontinuité reproduite entre 29 et 31 mètres. Une formation à puissance nulle n’obtient plus un horaire valide par déplacement fictif.

Le délai de mise en action du frein fait partie de la clé du cache. Le cache mutable d’un horaire runtime est séparé de celui de l’éditeur, tout en partageant la géométrie immutable. Les objets météo sont interprétés de manière cohérente par les chemins de calcul. Dans le flux normal d’édition/revalidation, le temps théorique utilise des conditions de référence plutôt que la météo de la caméra.

L’aperçu de durée reprend les temps et arrêts déjà planifiés : son total correspond à l’arrivée affichée moins le départ. L’arrivée `00:00` n’est plus remplacée par l’heure de départ.

**Fichiers principaux :** `train-physics.ts`, `schedule-v2-model.ts`, `schedule-v2-timing.ts`, `schedule-v2-validation.ts`, `schedule-v2-editor.ts`, `schedule-v2-revalidation.ts`, `schedule-v2-runtime.ts`.

## 4. Politique commune de vitesses inconnues

Le module `rail-speed.ts` est partagé par le calcul physique, le service actif, l’analyse de route et le cantonnement. Une donnée `FALLBACK_30` ne constitue pas une limitation documentée à V30. L’héritage local d’une vitesse reste borné à un kilomètre sur le même way OSM contigu et n’utilise pas une valeur déjà inférée comme nouvelle preuve.

**Deux conventions de simulation doivent être explicites :** une voie principale sans vitesse exploitable reçoit par défaut 160 km/h, plafonnés par le matériel ; une voie de service inconnue reçoit 30 km/h. Ces valeurs ne prétendent pas reconstituer les véritables limitations d’une infrastructure absentes d’OSM. Elles peuvent être revues comme choix de gameplay dans ce module unique.

Une valeur documentée demeure prioritaire. Un changement de Vmax de la composition invalide le cache runtime concerné. Le correctif empêche notamment qu’un V30 éloigné contamine des dizaines de kilomètres de données inconnues.

## 5. SC et trains préparés : réconciliation

Un service préparé avant son départ est désormais réconcilié avec son horaire, sa version et son affectation. Modification pertinente : reconstruction. Suppression, passage en DRAFT ou désactivation de la rotation : retrait du service préparé et libération de ses ressources. Un service déjà parti n’est pas arbitrairement détruit lors d’une modification éditoriale.

Les points techniques possèdent une identité distincte et ne sont plus facturés comme des arrêts commerciaux. Ils préservent les voyageurs à bord et la distance déjà parcourue, tout en conservant le traitement approprié des coûts de circulation.

Ce travail ne constitue pas une refonte du couplage exact way/segment/quai, de toutes les manœuvres de rebroussement, des opérations de formation au terminus ou de tous les conflits entre affectations directes.

## 6. LiveMap et exploitation

### Retour d’onglet et symptôme des 12 km/h

Le retour de visibilité ne déclenche plus un repositionnement horaire simplement parce que l’onglet est resté caché alors que le moteur a effectivement simulé ce temps. Le moteur distingue le temps écoulé du temps physique réellement abandonné.

Lorsqu’une reconstruction est nécessaire, elle utilise les vitesses résolues plutôt qu’un `FALLBACK_30` brut et réinitialise les efforts physiques hérités. Les services déjà bloqués par un STOP opérationnel ne sont pas rattrapés comme des trains libres. En cas de conflit détecté sur la position candidate, l’ancienne position est restaurée avec un motif de blocage explicite.

**Les causes démontrées autour du mauvais horaire et de la reconstruction à environ 12 km/h sont traitées. Le blocage durable exact observé sur le PC du joueur n’a pas été reproduit de bout en bout dans ce contexte : il n’est donc pas déclaré définitivement éradiqué.**

Le rattrapage longue durée ne rejoue pas encore intégralement tous les arrêts commerciaux et toutes les contraintes intermédiaires. La restauration exacte de certains états/resources mérite encore des essais d’intégration prolongés.

### Mouvement et maintenance

Les trains en maintenance n’accélèrent plus dans les chemins de mouvement complet ou macro. L’envoi en maintenance vérifie davantage la présence et l’utilisation de la rame. Une réparation ne transforme plus systématiquement un train au milieu de la ligne en état `waiting` sans reprise appropriée.

Un train `blocked_route` qui possède encore une position conserve son occupation dans le cantonnement et les ressources de voie ; une réservation réellement orpheline peut toujours être nettoyée. Le mode macro contrôle le résultat de la synchronisation de son empreinte, prend en compte les pannes bénignes limitées à 80 km/h, l’anticipation des ralentissements et la distance terminale de freinage.

Une demande de secours non aboutie reste réessayable. Les incidents STOP sans rapport avec une panne matérielle — par exemple un malaise — ne déclenchent plus indistinctement une locomotive de secours. **Le remorquage physique et la sécurité complète de tous les parcours DDS ne sont pas refondus ici.**

### Informations affichées

La charge voyageurs/fret du panneau est actualisée ; elle ne fabrique plus un remplissage de 70 % quand l’information manque. Les retards et ETA concernés partagent la même conversion en minutes. Un train physiquement bloqué reste visible dans la liste. La voie courante n’est plus prioritairement remplacée par le quai de la gare précédente.

Le tracé sélectionné peut prendre en compte la déviation réellement parcourue. Le choix des marqueurs 3D filtre la visibilité avant d’appliquer le quota. Les coordonnées zéro ne sont plus rejetées dans le chemin cartographique corrigé. Le défilement du panneau s’arrête lorsqu’il est fermé. La distance ferroviaire restante est utilisée lorsque le segment courant permet de la déterminer ; certains cas conservent un repli géographique.

### Rectification conservée

L’accumulateur LOD ne reçoit **pas** de remise à zéro aveugle. Les 2,9 secondes non encore simulées avant un changement de niveau restent une dette légitime. Le cas témoin de l’audit confirme toujours 5 secondes simulées pour 5 secondes écoulées ; l’ancienne accusation de double comptage dans ce scénario n’était pas démontrée.

## 7. Sauvegardes, temps et comptes

Le Worker de sérialisation rejette ses demandes en attente en cas d’erreur ou de message illisible, nettoie ses requêtes et autorise le repli de sauvegarde. Une demande dispose d’un délai de sécurité de 60 secondes. Les erreurs d’ouverture IndexedDB peuvent être réessayées, y compris une exception synchrone du cache ORM.

Cela ne garantit pas la récupération de tous les cas possibles de disque plein, de transaction navigateur bloquée ou de données déjà corrompues. Les tests injectent explicitement les erreurs Worker et les échecs d’ouverture, puis vérifient qu’une nouvelle sauvegarde peut aboutir.

`gameplay-clock.ts` dissocie minutes réelles et dates civiles, conserve un état de règlement journalier et protège les sous-tâches réussies d’une deuxième facturation. Les traitements quotidiens ne dépendent plus uniquement de l’observation exacte de `00:00`. Les réparations, opérations de dépôt, manœuvres et durées d’incidents reçoivent le temps effectivement écoulé. Les durées RH et la génération fret sont également reprises sur une base temporelle cohérente.

**Attention à une partie ancienne :** le rattrapage peut déclencher des frais et échéances sur les journées non traitées. Il utilise les états et paramètres actuellement disponibles, pas une reconstitution historique exhaustive de chaque flotte et effectif. Tester d’abord sur une copie et examiner le journal financier.

Les passagers conservés à bord accumulent leurs kilomètres au lieu de payer seulement le dernier segment. La pénalité de retard voyageurs n’est prélevée qu’une fois. Les chargements contractuels réservent une quantité par service, sauvegardée, ce qui évite de charger plusieurs fois le même stock. La livraison d’une rame mixte vérifie le fret compatible dans l’ensemble des wagons plutôt que de prendre uniquement le premier.

La satisfaction `0` reste zéro et l’état RNG nul ne produit plus une suite aléatoire constamment nulle. Une météo locale non chargée n’utilise plus celle d’une caméra distante comme si elle était locale : le repli neutre est une convention provisoire, pas une prévision réelle.

## 8. Ce qui reste non certifié ou hors périmètre

Cette RC ne termine pas une refonte générale des secours/remorquages, des consommables comme contraintes physiques, des correspondances/améliorations de gare, du TAQ, des ressources exactes de quai ou de toutes les opérations matérielles au terminus. Certaines anciennes affirmations de l’audit étaient des hypothèses ou concernaient des chemins legacy ; elles n’ont pas été converties arbitrairement en modifications.

Restent notamment à éprouver : les absences longues avec replay économique complet, les enchaînements de plusieurs jours, les cas complexes de sauvegarde/restauration des occupations, tous les contrats affectés à des services incompatibles ou interrompus, le routage réseau externe sur de très longues distances et les interactions audio/GPS/3D dans le navigateur habituel.

Le typage global permissif hérité n’est pas supprimé. Le fichier de dépendances fixe TypeScript à 5.8.3, mais aucun nouveau lockfile exhaustif n’est prétendu livré. Les performances sur Windows 7/Opera et avec une mémoire réduite ne sont pas certifiées par ces tests Node/Chromium.

## 9. Pourquoi des tests historiques ont changé

Les assertions originales du dossier d’audit ont été conservées à l’identique. D’autres tests de la base devaient évoluer avec la correction : marqueurs de cache `1199ts23` vers `1199repair1`, vérification de la nouvelle version de signature physique, distinction d’un train bloqué physiquement présent d’une réservation orpheline, copie indépendante des caches tout en partageant la géométrie.

Quelques fixtures non physiques ont été rendues cohérentes : locomotive de 1 W remplacée par une puissance exploitable dans un test d’odomètre, locomotive électrique placée sur une route électrifiée dans un test d’images, wagon de test pourvu d’une capacité réelle. Le résultat métier de ces tests demeure vérifié.

L’objectif n’est pas de préserver des assertions qui exigeaient précisément un défaut. Les migrations sont visibles dans les fichiers livrés. Les 11 tests archivés sont ceux du manifeste historique, pas des nouveaux échecs dissimulés pour cette RC.

## 10. Utilisation et vérification

Exporter une sauvegarde depuis la version actuelle et conserver le ZIP d’origine. Extraire la RC1 dans **un nouveau dossier**, sans écraser ou mélanger les fichiers. Ouvrir son `index.html` complet, puis importer une copie de partie.

Pour les horaires touchés par les anciens calculs, ouvrir le SC et recalculer/revalider le sillon. Un horaire ancien forcé manuellement n’est pas réécrit d’autorité. Observer d’abord un trajet court, un trajet long et un retour LiveMap après passage sur une autre page ; contrôler aussi les recettes et les échéances après chargement.

Le jeu est précompilé : **Node et TypeScript ne sont pas requis pour le lancer**. Pour reproduire les contrôles de développement dans un environnement Node adapté :

```sh
npm run test:repair
npm test
npm run test:s3-regression
npm run verify:repair
```

Pour reconstruire réellement la version jouable :

```sh
npm run build:repair
```

Une recompilation modifie potentiellement les fichiers : vérifier le manifeste avant de modifier/reconstruire le paquet, ou le régénérer ensuite. Le manifeste SHA256 ne peut pas s’inclure lui-même ; tous les autres fichiers livrés sont contrôlés. Son succès certifie l’intégrité de la livraison, pas l’absence de défaut métier.

## 11. Traçabilité

SHA256 du ZIP source :

```text
9ba304ce1efc5a512763ba3e9ad0808eb458c603cb944d4ef9e1d4a054b8e575
```

Les preuves courantes sont `QA/RE_REPAIR_RC1/final-repair.tap`, `final-standard.tap`, `final-gate.log`, `measurements-after.json`, `build-parity.json`, `browser/memory-smoke.json` et `BUILD.json`. Les fichiers `audit-before/` décrivent le checkpoint d’origine. Les autres anciens rapports et sceaux QA sont archivés pour l’historique et ne constituent pas la certification de cette RC.
