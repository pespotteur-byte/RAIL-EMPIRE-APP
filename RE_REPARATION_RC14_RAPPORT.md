# Rail Empire — RC14 : stockage partagé et édition légère

**Livraison vérifiée depuis le ZIP RC13 fourni.** Aucun code RC14 n'était accessible lors de cette reprise : l'implémentation a été reconstruite depuis RC13, pas déclarée récupérée. Les chiffres de cette livraison remplacent ceux de la tentative non livrée.

## Bilan

Registre historique inchangé : **83/87 dossiers clos (95,4 %)**. LM03, TIME05, DDS03 et DDS04 ne sont pas clôturés. La présente version vise la taille des données et du dossier, pas une certification de tous les bugs ni du fournisseur OSM.

Deux distributions : `Rail_Empire_S3_RC14_LIGHT.zip` pour jouer par serveur HTTP local, et `Rail_Empire_S3_GAMEPLAY_REPAIR_RC14.zip` pour conserver également toutes les sources, les tests et l'historique technique. L'archive complète n'est pas le dossier allégé. Les deux contiennent la même logique applicative compilée.

## 1. SC : partage exact des colonnes

Le codec RC13 partageait déjà des blocs entiers identiques. RC14 conserve ce chemin et sait aussi référencer séparément les colonnes identiques d'un chemin compact SC8P1 : coordonnées, dictionnaires et index de voies, index de segments et métadonnées. Un changement de métadonnée ne force plus à stocker à nouveau toutes les coordonnées.

Les références sont construites uniquement après comparaison exacte du JSON. Aucun retrait de point, aucun nouvel arrondi, aucune fusion par simple proximité géographique. La précision de départ est celle de `SchedulePath.toJSON`, qui possédait déjà son propre format compact. La restauration crée des copies indépendantes : éditer une variante n'altère pas ses voisines.

Le dictionnaire demeure borné ; des colonnes numériques différentes ne se confondent pas. Le petit scénario ne grossit pas. Le candidat de partage comprend aussi des références/snapshots de gares. Il ne s'agit pas d'un partage universel de sous-séquences entre toutes les lignes : une colonne modifiée n'est pas partagée intégralement.

**Compatibilité du jeu** : les enveloppes `RE13-JSON-1` et `RE13/gzip` restent inchangées. Les tests utilisent les lecteurs RC13 et RC14 dans les deux directions. L'export portable reste le même. Cette compatibilité ne s'étend pas au nouveau stockage administrateur décrit plus bas.

### Mesures RC13 / RC14

Cinq paires par cas en ordre alterné ; vrai `GameStorage.saveGame` / `loadGame`, vraie compression gzip Node, modèle transactionnel IndexedDB en mémoire. Les deux versions reçoivent exactement les mêmes objets produits par `SchedulePath.toJSON` et l'option faible mémoire. Les deux fichiers sources baseline sont identiques à ceux du ZIP RC13 ; seule l'URL d'import du banc de mesure est réorientée en mémoire. L'égalité est vérifiée après chacune des 70 lectures.

**Octets de charge utile enregistrée (Blob.size), pas fichiers physiques du navigateur :**

| Scénario synthétique | RC13, octets | RC14, octets | Division |
|---|---:|---:|---:|
| Tracé unique  1 500 points | 15 845 | 15 845 | ×1.00 |
| Tracé unique  15 000 points | 40 407 | 40 407 | ×1.00 |
| 30 copies exactement identiques | 41 368 | 41 368 | ×1.00 |
| 30 variantes  même géométrie / métadonnées différentes | 1 202 240 | 42 687 | ×28.16 |
| 128 variantes  même géométrie / métadonnées différentes | 5 126 917 | 48 357 | ×106.02 |
| 10 géométries distinctes | 400 106 | 373 589 | ×1.07 |
| 30 variantes  une coordonnée différente et métadonnées différentes | 1 202 282 | 1 030 109 | ×1.17 |

Le cas ×106 utilise 128 variantes conservant leurs grandes colonnes géométriques, mais différant par des métadonnées de restriction/vitesse. Ce n'est pas la sauvegarde de PE. Les scénarios réellement différents, et celui où une coordonnée varie, sont inclus pour montrer les limites du partage. Le ×100 n'est pas atteint sur tous les cas.

Les durées brutes sont conservées dans le JSON, mais une partie de la mesure s'est déroulée en même temps que d'autres qualifications. **Aucun gain CPU ou FPS n'est déduit de ces durées.** Les tailles et l'égalité ne dépendent pas de cette contention. Preuves : `QA/RE_REPAIR_RC14/STORAGE_BENCHMARK.json`, `benchmark-storage.mjs` et les deux sources baseline.

## 2. Administrateur : ne plus remplir localStorage de gros JSON

Les quatre ensembles `admin_catalog_mods`, `admin_catalog_deleted`, `admin_catalog_imported`, `admin_incidents` utilisent maintenant une base IndexedDB compressée, séparée de la partie. Les paramètres et le jeton GitHub restent hors migration.

À l'ouverture, une ancienne valeur locale est lue et migrée. Son retrait attend **la fin de transaction**, pas seulement le succès de la requête. Un changement détecté pendant la migration est conservé et déclenche une demande de rechargement. Les écritures d'une même clé dans l'instance sont ordonnées et capturent une copie JSON de la modification demandée.

Lors d'une écriture, si IndexedDB échoue, un repli local compact `RE14A:` est tenté. Si ce repli échoue aussi, une erreur est présentée sans supprimer l'ancienne copie. Dans l'interface, les éditions, suppressions et imports n'apparaissent comme appliqués qu'après enregistrement réussi. Une base inaccessible ou un enregistrement corrompu ne se transforme pas silencieusement en tableau vide.

**Attention : les anciennes pages administrateur RC13 ne savent pas lire cette nouvelle base ni `RE14A:`.** Exporter les catalogues avant migration et conserver une copie du profil pour les autres réglages/incidents administrateur. L'export ordinaire de partie ne sauvegarde pas ces quatre ensembles. Utiliser une seule version et un seul onglet administrateur ; aucun protocole complet de fusion multi-onglets n'est certifié.

Dix-neuf tests ciblés et le vrai bundle administrateur dans Chromium couvrent migration, transaction avortée, quotas, captures, éditions/suppressions, HTML littéral et refus de mise à jour visuelle en cas de double échec de stockage. Le modèle IndexedDB est explicite et ne mesure pas le disque natif.

## 3. Dossier LIGHT : ressources conservées, historique technique séparé

Le dossier léger conserve les images, les sons et les données du jeu. Il utilise les trois bundles (jeu, catalogue, administrateur) sans les copies de modules individuels déjà incorporées. Les sources et l'historique des tests restent dans COMPLETE.

Les fichiers texte volumineux sont précompressés sans perte en gzip déterministe, uniquement lorsque leur taille diminue. Le serveur local conserve les mêmes adresses et types de contenu. Il envoie gzip lorsque le client l'accepte, ou décompresse par fragments ; il ne crée pas une seconde extraction complète. Les fichiers ordinaires sont prioritaires sur un éventuel ancien `.gz` voisin. Les tests incluent gzip refusé par `q=0`, HEAD, ETag distinct par représentation, 304, traversées, liens symboliques, validation d'hôte et refus des fichiers hors liste.

Aucune minification, réécriture numérique ou réduction de qualité d'image n'est utilisée. Seul l'ajout déclaré d'un garde de lancement dans les deux entrées HTML change leur contenu : sous `file://`, une aide demande d'utiliser `LANCER_RE.cmd`. Les bundles et les données servis sont identiques à COMPLETE après décompression.

### Mesures du dossier

- Fichiers runtime retenus, **avant** précompression : **160,202,666 octets**, soit 152.78 Mio.
- Les mêmes fichiers runtime **après** précompression : **95,477,077 octets**, soit 91.05 Mio (**×1.68**).
- LIGHT, **manifeste et résumé inclus** : **98,013,461 octets**, soit **93.47 Mio**, 37,170 fichiers.
- Le ZIP RC13 fourni contenait **679.57 Mio** de fichiers développés. La comparaison avec LIGHT donne environ **×7.27**, mais inclut le retrait de l'historique technique : ce n'est pas le ratio de compression d'un contenu identique.
- Sur le système de fichiers Linux de contrôle, les blocs alloués aux seuls fichiers LIGHT représentent **161.11 Mio** (hors métadonnées de dossiers). Cette différence illustre pourquoi la somme des tailles de fichiers n'est pas une mesure universelle du disque Windows, et encore moins du profil Opera.

40 fichiers sont précompressés. Les 37,168 entrées runtime ont été relues et vérifiées par empreinte après décompression. 26 requêtes au véritable serveur Node sur les actifs sélectionnés confirment le contenu, le type, le mode gzip et le repli décompressé. Le manifeste détaillé est `LIGHT_MANIFEST.json.gz` ; le petit résumé est `LIGHT_SUMMARY.json`.

## 4. Qualification finale

| Contrôle | Résultat |
|---|---:|
| Suite standard relancée | 102 834 réussis, 0 échec |
| Suite de réparation relancée | 725/725, dont 65 nouveaux |
| Régression S3 | 256/256 fichiers actifs |
| Tests historiques remplacés/supersédés | 11, manifeste inchangé |
| Reconstruction indépendante | 108 JS + 108 déclarations identiques |
| Reconstruction bundles / entrées | 3 bundles + 2 HTML identiques |
| Ressources img/audio/data/js-data comparées au ZIP RC13 | 37 152 identiques |
| Sources applicatives TypeScript | 108 modules |
| Dette déclarée | 48 `any`, 28 `@ts-expect-error`, sans augmentation |

Les suites se recouvrent : leurs totaux ne s'additionnent pas. Les 65 nouveaux tests sont répartis en 30 pour le codec, 19 pour l'administration et 16 pour le serveur. Les 49 fichiers de tests historiques modifiés ne changent que l'attente du marqueur de cache `1199repair13` vers `1199repair14` ; aucune assertion fonctionnelle ni exclusion supplémentaire. La parité est vérifiée avec le ZIP d'entrée.

Le build initial a atteint les contrôles intermédiaires avant une limite d'exécution ; les étapes finales, le build scellé et la reconstruction indépendante ont ensuite réussi. Les journaux des premiers essais échoués (attentes de marqueur et ajustements du banc navigateur) sont conservés à côté des journaux finaux, pas présentés comme des validations.

Dans Chromium isolé : 15 pages, 600 trains avançant aux quatre observations carte/personnel/incidents/carte, panneau Stockage à 768 et 375 pixels, téléchargement du bilan, lecture/écriture, édition administrateur, chargement du catalogue différé. L'essai LIGHT lit exclusivement les fichiers de LIGHT (y compris `.gz`), pas une copie de secours du dossier complet. Aucune erreur de page dans les essais finaux.

**Limites du navigateur** : la navigation native locale renvoie `ERR_BLOCKED_BY_ADMINISTRATOR`. Elle n'a pas été contournée. Les vrais bundles sont injectés dans un navigateur isolé, les requêtes externes sont interceptées/refusées. Le stockage navigateur est un modèle en mémoire / un repli Web Storage de test ; pas une qualification du disque IndexedDB réel. Les requêtes HTTP Node sont un essai séparé, pas une prétention de test natif bout en bout sous Opera.

**Windows** : code C# adapté mais non compilé ni exécuté ici. Le lanceur Node est exécuté sous Linux. Aucun gain de RAM/FPS, aucune levée de 403 OSM, aucune certification de sauvegarde personnelle ou d'Opera/Win7.

## 5. Installation / retour arrière

Lire `LIRE_AVANT_RC14.md`. Exporter la partie depuis RC13, fermer les anciens onglets et le serveur, extraire dans un nouveau dossier, lancer `LANCER_RE.cmd`, conserver `http://127.0.0.1:8765/`, puis **Stockage → Optimiser sans supprimer**. Ne pas vider les données du site. Ne pas lancer deux versions simultanément. Exporter également les données administrateur avant de visiter la nouvelle page admin.

Les nouveaux gains SC s'appliquent à la prochaine sauvegarde (ou à l'optimisation). Les anciennes optimisations de caches RC13 restent présentes ; RC14 ne promet pas de recompacter chaque cache déjà compacté, ne purge pas les tuiles et n'ajoute pas de requêtes OSM. Une marge peut rester nécessaire pour valider le remplacement d'une ancienne sauvegarde.

## Références et preuves

Le résumé machine est `QA/RE_REPAIR_RC14/SUMMARY.json`. Les sources de mesure et bancs de test sont fournis. L'intégrité finale des deux ZIP est dans le fichier externe `RE_RC14_PACK_INTEGRITY.json`, créé après scellement pour éviter une empreinte circulaire.

Références techniques consultées le 12 septembre 2026 :
- MDN, quotas et séparation par origine : https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN, fin de transaction IndexedDB : https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event

Ces pages expliquent les règles des API ; les mesures du jeu proviennent des tests fournis, pas d'une documentation constructeur.
