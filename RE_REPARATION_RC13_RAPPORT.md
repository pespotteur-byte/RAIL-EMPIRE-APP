# Rail Empire — RC13 : stockage compact et protection des sauvegardes

Build : `S3_GAMEPLAY_REPAIR_RC13_1199repair13`. Base : archive RC12 effectivement fournie par PE. Travail du 12 septembre 2026. Sources, tests, bundles jouables et ressources sont inclus.

## Résultat et périmètre

La demande porte sur le **stockage persistant du navigateur**, pas sur le poids du ZIP ni sur une division de la RAM par 100. RC13 compresse les grosses sauvegardes, déduplique les blocs de géométrie exactement identiques et permet de compacter les anciens caches sans effacer les données cartographiques qu’ils contiennent.

**×100 n’est pas garanti pour toutes les parties ni pour le disque physique du profil du navigateur.** Le meilleur des cinq scénarios de sauvegarde documentés atteint ×175,16 sur la valeur écrite, avec 30 horaires utilisant le même grand tracé. Dix tracés distincts donnent ×6,13 ; un petit tracé déjà compressé dans RC12 donne ×1,33. La partie personnelle du joueur n’a pas été fournie.

Le registre historique reste **83/87 dossiers clos, soit 95,4 %**. Le stockage est suivi séparément : aucun des quatre dossiers restants n’est fictivement clôturé.

## 1. Causes observées dans le code RC12

`GameStorage.saveGame` désactivait la compression lorsque `lowMemory` était demandé ou quand les géométries compactées dépassaient 12 000 points. Le cas volumineux, précisément celui exposé au quota, devenait du JSON brut. Les petites sauvegardes compressées passaient par une chaîne gzip/base64 `RELZ:` même dans IndexedDB, qui accepte des blocs binaires.

Les caches `rail-empire-orm/areas` et `rail-empire-world-rail/tiles` persistaient des objets géométriques non compactés par l’application. Le succès d’une requête d’écriture pouvait être confondu avec la validation complète de la transaction. La migration d’un ancien `orm-area-*` local supprimait la source même si la nouvelle écriture n’avait pas été validée. Le nettoyage de démarrage pouvait aussi supprimer ces anciens caches avant leur migration.

Enfin, un repli localStorage récent pouvait être masqué au rechargement par une sauvegarde IndexedDB plus ancienne. Les métadonnées du tableau de stockage pouvaient également rester périmées si seule leur petite écriture échouait après un repli pourtant enregistré.

La référence JS du stockage est conservée dans `QA/RE_REPAIR_RC13/storage-rc12.mjs`, vérifiée directement contre le ZIP RC12. Elle n’a pas été réécrite pour amplifier les mesures.

## 2. Nouveau format de sauvegarde

### Déduplication exacte

Les blocs candidats volumineux (`routePacked`, points, géométries, segments, nœuds, etc.) sont comparés par leur représentation JSON exacte. Deux tracés seulement proches, ou deux vitesses différentes, ne sont pas fusionnés. Les références sont stockées **hors du document de partie**, dans une enveloppe versionnée ; un nom utilisateur ressemblant à une référence ne devient pas une commande.

Le dictionnaire temporaire est limité par défaut à 8 millions d’unités UTF-16 environ. Il n’est pas un catalogue permanent de toutes les anciennes sauvegardes. Les blocs dépassant les contraintes de référence restent stockés normalement. Une partie JSON valide profondément imbriquée ne reçoit pas de références que le lecteur refuserait ensuite.

La restauration recrée des copies indépendantes : modifier un horaire ne modifie pas un autre horaire simplement parce que leur tracé était identique sur disque. **Aucun nouvel arrondi de coordonnées, retrait de point ou effacement d’historique n’est introduit par RC13.** L’égalité est celle du document JSON produit par le jeu ; les conventions de sérialisation déjà présentes dans `SchedulePath.toJSON`, dont SC8P1, restent inchangées.

### Compression binaire, y compris en faible mémoire

Le corps est compressé en gzip puis écrit comme `Blob` dans IndexedDB (`RE13/gzip`). Le mode faible mémoire ne copie plus l’état complet vers un Worker, mais **ne désactive plus gzip**. L’encodage UTF-8 alimente le compresseur par fragments de 32 768 unités UTF-16 maximum, sans couper une paire de substitution Unicode. Cela borne les fragments d’entrée, pas toute la mémoire du jeu : le JSON, les données décompressées et le dictionnaire occupent toujours de la RAM.

Les petits états peuvent utiliser le Worker existant. Si les API natives de compression/décompression manquent, le format JSON compact `RE13/json` reste utilisable, avec un gain potentiellement moindre. Aucune bibliothèque distante ni dépendance réseau n’est ajoutée.

La base IndexedDB, son magasin et la clé `main` ne changent pas. Le localStorage reste un **repli**, avec base64 parce qu’il ne stocke que des chaînes. RC13 lit le JSON historique, les anciennes chaînes `RELZ:` et les nouveaux corps binaires. Une simple lecture ne réécrit pas de force la sauvegarde.

### Conservation lors des échecs

Les écritures sont ordonnées dans la même instance de module, y compris la suppression explicitement demandée. L’état est capturé au moment de l’appel. Le remplacement n’est déclaré réussi qu’après la validation de la transaction. Si IndexedDB échoue, le repli local est tenté ; si les deux échouent, la copie précédemment validée n’est pas supprimée pour faire de la place.

Un repli RC13 local présent est prioritaire sur la vieille copie IndexedDB, même si l’horloge de l’ordinateur a reculé. Ses propres tailles et informations de codec priment sur des métadonnées périmées. Une suppression impossible côté IndexedDB laisse un marqueur empêchant la réapparition immédiate de l’ancienne partie. Cela ne remplace pas une sauvegarde exportée ni une garantie face à toute panne du disque ou suppression volontaire du profil.

## 3. Caches OSM/ORM existants et futurs

Les deux bases gardent leurs noms, versions, clés et politiques d’expiration. Les champs nécessaires aux recherches (zone, date, schéma, nombre de voies et marqueurs de résultat vide) restent disponibles sans décompresser toute la base. Les géométries ne sont décompressées que pour les lignes sélectionnées.

Le nouveau panneau permet de parcourir les anciens enregistrements **un par un**. Chaque remplacement vérifie d’abord le retour JSON sans perte, puis contrôle dans une transaction que le cache n’a pas changé entre-temps. Une réponse réseau plus récente est conservée. L’ancienne copie localStorage n’est retirée qu’après une migration validée et seulement si elle n’a pas été modifiée entre-temps.

Les valeurs IndexedDB non compatibles avec JSON sans altération (tableaux typés, dates, valeurs non finies, champs `undefined`, tableaux creux, etc.) restent dans leur forme d’origine plutôt que d’être converties silencieusement. Un cache corrompu n’est pas rendu artificiellement valide par une conversion de sa clé numérique en clé texte.

La compaction est interruptible entre enregistrements. Elle n’appelle pas OSM, ne vide pas le cache HTTP des images et ne contourne aucun refus. **La 403 signalée n’est pas déclarée levée.** Le format compact nécessite RC13 pour lire les caches modifiés : ne pas faire tourner RC12 et RC13 en même temps sur la même origine.

Pour les nouvelles écritures ordinaires de cache, une réserve indicative est conservée pour les sauvegardes quand une estimation est disponible : le plus petit de 64 Mio et 15 % du quota. À l’approche de cette réserve, la persistance de nouveaux caches est suspendue, sans effacer les géométries déjà présentes ; les données actives restent soumises aux limites mémoire existantes. La compaction explicite peut toujours tenter un remplacement réduisant la place occupée.

## 4. Mesures RC12/RC13

| Scénario synthétique | RC12, octets écrits dans `stored` | RC13, octets dans `stored` | Division |
|---|---:|---:|---:|
| Petit tracé unique (1 500 points) | 21 217 | 15 944 | ×1,33 |
| Grand tracé unique (15 000 points) | 249 274 | 40 519 | ×6,15 |
| 10 horaires, même grand tracé | 2 458 639 | 41 218 | ×59,65 |
| 30 horaires, même grand tracé | 7 368 435 | 42 068 | ×175,16 |
| 10 horaires, grands tracés distincts | 2 455 206 | 400 703 | ×6,13 |


Les cinq entrées sont **synthétiques**, avec des géométries produites par le vrai `SchedulePath.toJSON` et son format SC8P1 déjà utilisé par RC12. Chaque scénario est mesuré sur cinq paires RC12/RC13, en alternant l’ordre. Les corps enregistrés sont relus et comparés par égalité profonde au JSON d’entrée. Le Worker n’est pas disponible dans ce banc Node ; les deux versions utilisent leur repli natif correspondant.

Le tableau mesure `Blob.size` ou les octets UTF-8 de la valeur `stored`. Il **n’inclut pas** les pages/index/journaux de la base, ses éventuelles optimisations internes, les métadonnées du record, le cache d’images ou les autres données du navigateur. Le facteur ×175 n’est donc pas une mesure de division de la taille physique totale du profil.

Pour un cache synthétique de **600 voies / 24 000 points**, la représentation JSON du record ancien mesure **6 490 301 octets** ; le corps compact et ses métadonnées applicatives mesurent **323 459 octets**, soit ×20,07. Là encore, l’ancien objet IndexedDB est comparé par sa représentation JSON, pas par les blocs réellement occupés sur le disque.

Données, méthode et toutes les itérations : `QA/RE_REPAIR_RC13/STORAGE_BENCHMARK.json`. Script reproductible : `benchmark-storage.mjs` dans le même dossier.

### Coût CPU constaté

La compression économise de la place, pas gratuitement du calcul. Dans le scénario des dix grands tracés **distincts**, la médiane de sauvegarde passe d’environ **18,3 ms à 220,0 ms** et la lecture de **13,7 ms à 27,5 ms** dans le banc Node. Avec trente horaires partageant le tracé, les médianes sont **64,1 → 55,3 ms** en écriture et **42,8 → 68,7 ms** en lecture. Aucun gain de FPS ni délai identique sur Opera/Win7 n’est annoncé.

## 5. Interface et mesure sur la partie réelle

Le bouton **Stockage** (icône de compression près des boutons de sauvegarde) ouvre un panneau proposant l’export portable de la partie, l’optimisation sans effacement et l’export d’un bilan de tailles.

Le panneau distingue la taille du contenu de la sauvegarde, son backend, le nombre de blocs dédupliqués, le ratio **par rapport au JSON brut** et l’estimation du stockage total de l’origine. Il enregistre les estimations avant/après une optimisation, avec les tailles de sauvegarde correspondantes, dans le bilan exportable. Ces estimations peuvent être indisponibles ou se mettre à jour avec retard ; elles ne sont pas une lecture exacte du système de fichiers.

Le bilan ne copie pas les routes, noms de trains, catalogue ou identifiants de connexion. Il n’est pas envoyé automatiquement. L’export de partie reste au format portable historique `.json` ou `.json.gz`, sans les références internes RC13, et peut servir pour un retour à la version précédente.

## 6. Qualification et limites

| Contrôle final | Résultat vérifié |
|---|---:|
| Suite standard | 102 834 / 102 834 |
| Suite réparation | 660 / 660, dont 61 nouveaux tests RC13 |
| Régressions S3 | 253 / 253 fichiers actifs |
| Reconstruction indépendante | 106 modules JS + 106 déclarations identiques |
| Bundles et entrées | 3 bundles + 2 HTML identiques |
| Ressources comparées au ZIP RC12 | 37 221 fichiers inchangés |
| Dette TypeScript | 48 `any`, 28 `@ts-expect-error`, sans augmentation |
| Chromium isolé | 15 pages ; 600/600 trains avancent aux quatre observations |
| Panneau Stockage | sauvegarde/relecture, bilan avant/après, 768/375 px, retour de focus |

La validation d’intégrité de l’archive est produite **après** le présent rapport, dans `RE_RC13_PACK_INTEGRITY.json` livré à côté du ZIP. Le manifeste interne exclut uniquement sa propre entrée pour éviter une empreinte autoréférente.

La synthèse finale et les chemins exacts des journaux sont dans `QA/RE_REPAIR_RC13/SUMMARY.json`. Les suites standard, réparation et S3 se recouvrent : **leurs nombres ne s’additionnent pas**. Les trois fichiers de régression RC13 ajoutent 61 tests au lot de réparation. L’ancien test HOTFIX8 exigeant du JSON brut a été remplacé par une vérification fonctionnelle du même impératif faible mémoire, avec compression ; il n’a pas été retiré de la suite. Le manifeste des 11 exclusions historiques est inchangé.

Les tests transactionnels utilisent `scripts/test-idb-harness.mjs`, un modèle déterministe **réservé aux tests**, et non une implémentation complète ou physique d’IndexedDB. Ils injectent notamment un échec de quota après le succès de la requête mais avant la validation de la transaction. Le modèle n’est ni une dépendance du jeu ni une preuve de comportement de tous les moteurs de stockage.

Les essais Chromium injectent les vrais bundles et les ressources locales dans un DOM isolé, avec stockage Web simulé en mémoire et réseau externe bloqué. Les API natives gzip, les sauvegardes/relectures par le repli, le téléchargement du bilan, la navigation et les largeurs 768/375 sont exercés. Le scénario de 600 trains utilise des corridors indépendants, pas une gare dense à 600 conflits. Les contrôles des mouvements sont distincts de la capture finale où la boucle est arrêtée pour permettre l’automatisation de l’interface.

Les tentatives de navigation HTTPS et `file://` sont refusées par la politique administrative de cet environnement ; aucun contournement n’est tenté. **L’espace physique d’IndexedDB, le quota réel de PE, Opera/Win7, une coupure électrique, l’audio et le réseau OSM réel ne sont pas certifiés par ces essais.** Les premières commandes combinant de longues qualifications ont été interrompues par leur enveloppe d’exécution ; leurs journaux partiels sont conservés et ne sont pas comptés comme des validations. Les journaux finaux sont explicitement désignés dans la synthèse.

Les sources applicatives TypeScript, leurs sorties recompilées et les bundles font l’objet de contrôles indépendants. Les 37 221 ressources suivies sont comparées directement à l’archive RC12. Le ZIP et le manifeste final sont vérifiés séparément avant livraison.

## Références techniques consultées

MDN, *Storage quotas and eviction criteria* : quotas distincts selon les stockages, portée par origine et caractère estimatif de `StorageManager.estimate()` ; `https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria`.

MDN, *IDBTransaction: complete event* : la confirmation utilisée est celle de la transaction validée ; `https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event`.

MDN, *Compression Streams API* : compression/décompression gzip natives, détection de capacité conservée ; `https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API`.

Ces références décrivent les API. Elles ne prouvent pas un gain ×100 sur la partie personnelle de PE. L’archive et le guide ne demandent pas de modifier les paramètres de sécurité du navigateur.
