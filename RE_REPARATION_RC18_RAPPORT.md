# Rail Empire — RC18 FULL
## Corrections de l’audit, recherche élargie et qualification technique

**Bilan : les sept défauts de l’audit RC17 et deux défauts supplémentaires sont corrigés dans le périmètre reproduit. La version FULL est conservée. Le typage strict intégral n’est pas terminé.**

Les 87 dossiers historiques ne définissent pas tous les bugs possibles du jeu. Cette passe ne reprend pas leur compteur comme certificat général : elle ajoute des reproductions ciblées, des erreurs injectées, un audit des déclarations TypeScript et des comparaisons de performance RC17/RC18. Le registre et les preuves sont dans [RE_REGISTRE_AUDIT_RC18.md](RE_REGISTRE_AUDIT_RC18.md) et [QA/RE_REPAIR_RC18/SUMMARY.json](QA/RE_REPAIR_RC18/SUMMARY.json).

## 1. Sauvegardes et imports : corriger la frontière entre état vivant et état enregistré

### Un import rejeté ne doit pas laisser une partie hybride

Avant toute mutation, RC18 contrôle le document et ses principaux conteneurs. Pendant l’import, un journal réversible conserve l’état des gestionnaires concernés, y compris les références partagées, tableaux, cartes, ensembles, dates et propriétés symboliques. Il ne s’agit pas d’un remplacement général de la sérialisation : ce journal ne vit que pendant l’import.

Un refus des modèles horaires, roulements ou runtime V2 devient une véritable erreur d’import. L’interface attend également la confirmation d’écriture avant d’annoncer le succès. Les gestionnaires sont restaurés si une étape testée refuse le fichier ou si la persistance échoue. Vingt-huit erreurs tardives injectées dans les chargeurs et un scénario avec un vrai secours déjà présent dans les cantons vérifient le retour à l’état antérieur.

Le contrôle élargi a aussi révélé une régression pendant le développement du correctif : charger l’horloge réactivait le moteur avant la fin de l’import. RC18 maintient maintenant la simulation et l’autosauvegarde suspendues jusqu’au résultat de l’écriture. Un verrou modal empêche les commandes concurrentes de modifier la partie pendant cette attente. Un second import simultané est refusé ; le verrou est retiré après succès ou échec.

Cette approche protège les frontières et gestionnaires testés. Elle ne prouve pas l’atomicité de toute future extension ou de toute interaction externe inconnue. Les objets du navigateur, promesses et services externes ne sont pas copiés comme des données ordinaires.

### Un export décrit un seul instant

Le contenu est capturé sous forme de JSON avant la première attente asynchrone de l’encodeur. Le worker de compression et les replis utilisent exactement ce contenu, pas une référence vers la partie qui continue à évoluer. Le test décompresse le véritable fichier gzip et compare solde, total des recettes et ventilation des recettes, même si une nouvelle opération comptable intervient immédiatement après la demande d’export.

La capture synchrone peut prendre du temps sur une très grosse partie. La correction garantit la cohérence du scénario ; elle n’est pas présentée comme une suppression de toutes les pauses de sauvegarde. La compression peut être déportée, mais la capture cohérente représente toujours du travail.

### Suppression logique et recul de l’horloge

Un marqueur indépendant de l’horloge remplace la dépendance à un instant de suppression. Si IndexedDB refuse sa transaction, ce marqueur maintient l’ancienne sauvegarde masquée. Une écriture nouvelle confirmée rétablit normalement la lisibilité. Si aucun backend ne permet de préserver la suppression logique, la méthode signale l’échec au lieu de prétendre avoir réussi.

**Masquer une ancienne sauvegarde après un refus de suppression ne signifie pas que ses octets physiques ont disparu.** Aucune libération de quota n’est déduite de ce test.

Preuves : [imports et export](QA/RE_REPAIR_RC18/browser-deep/results.json), [concurrence et cantons](QA/RE_REPAIR_RC18/browser-safety/results.json), [tests Node](QA/RE_REPAIR_RC18/repair-final.log).

## 2. Reprise des incidents et lancement de l’interface

La sauvegarde contient maintenant les crédits fractionnaires de génération d’incidents, les minutes déjà observées, les crédits météo, le curseur d’échantillonnage et l’identifiant suivant. Ces champs sont restaurés dans un gestionnaire neuf et pas seulement laissés en mémoire dans l’ancien.

Le nouveau banc du générateur couvre **48 heures, avec incidents actifs et quatre sauvegardes/rechargements dans des gestionnaires recréés**. Les événements et l’état du générateur aléatoire restent identiques à la branche continue. D’autres cas couvrent les minutes voisines de minuit, la relecture de la même minute et le curseur météo. Les véritables hooks du jeu sont également vérifiés dans Chromium. Ce banc de génération ne doit pas être confondu avec 48 heures de tous les systèmes physiques simultanés ; les tests chronologiques historiques restent dans la suite de réparation.

Une sauvegarde ancienne ne contient pas les crédits perdus : leur état est initialisé sans rafale, mais aucune reconstruction exacte d’une histoire jamais sauvegardée n’est revendiquée. Le défaut rouvrait TIME05 et reste compris dans les sept constats, pas ajouté comme huitième problème distinct.

Le démarrage est exclusif pendant la préparation asynchrone et l’installation de l’interface devient idempotente. Deux clics rapprochés ne provoquent plus deux initialisations ; un clic d’export déclenche une seule action. Enfin, le diagnostic identifie réellement **RC18**, dans son nom et son contenu, à partir de l’identité de build générée.

Preuves : [test du lancement](QA/RE_REPAIR_RC18/browser-double-launch/results.json), [cadence dans le vrai jeu](QA/RE_REPAIR_RC18/browser-safety/results.json), [nouveaux tests permanents](js/__tests__/re-rc18-audit-fixes.test.mjs).

## 3. Deux défauts supplémentaires trouvés et corrigés

### Catégorie comptable interprétée comme HTML

Un libellé de catégorie fourni dans les données du dashboard était interpolé comme du balisage. Le scénario RC17 crée effectivement un élément HTML ; RC18 affiche le même nom comme texte, sans modifier la valeur sauvegardée. Le correctif porte sur cette frontière d’affichage, pas sur une certification générale de sécurité de toutes les pages.

### Dépôt : dépenses avant réservation effective du personnel

La disponibilité du personnel était contrôlée avant de dépenser, mais sa réservation effective arrivait après. Un refus tardif pouvait ainsi consommer du gazole, des pièces et de l’argent sans démarrer l’opération.

Dans la reproduction du ravitaillement RC17, le stock perd **3 000 litres** alors que l’opération est refusée. Le test de révision de freins retire quatre jeux de plaquettes, deux disques et 25,15 unités monétaires dans la même situation. RC18 réserve réellement le personnel avant ces consommations. Une absence tardive de pièces libère aussi la réservation, sans consommer les autres ressources.

Preuves avant/après : [RC17](QA/RE_REPAIR_RC18/baseline-depot.log), [RC18](QA/RE_REPAIR_RC18/current-depot.log), [dashboard](QA/RE_REPAIR_RC18/browser-safety/results.json). Cela porte le bilan à **huit défauts fonctionnels et un défaut de diagnostic corrigés**.

## 4. V12 Biturbo : mesurer les endroits réellement accélérés

Le chargeur des véhicules et coupons du module Roulements recherchait répétitivement chaque véhicule dans toute la liste. RC18 construit un index temporaire local au chargement, après validation des identifiants. Le temps de construction de l’index est compris dans la mesure. Aucun cache de flotte persistant susceptible de devenir périmé n’est ajouté.

| Scénario synthétique | RC17, médiane | RC18, médiane | Rapport RC17/RC18 |
|---|---:|---:|---:|
| Chargement Roulements, 1 000 véhicules | 5,962 ms | 2,030 ms | ×2,94 |
| Chargement Roulements, 5 000 véhicules | 56,860 ms | 5,582 ms | ×10,19 |
| Chargement Roulements, 15 000 véhicules | 458,212 ms | 12,795 ms | ×35,81 |
| Physique, petit profil de 300 segments | 0,801 ms | 0,814 ms | ×0,98 |
| Physique, profil dense de 150 000 segments | 291,722 ms | 296,605 ms | ×0,98 |
| Contrôleur de mouvement, 40 000 appels | 21,696 ms | 21,879 ms | ×0,99 |
| Voisinage, 300 recherches | 7,958 ms | 8,283 ms | ×0,96 |
| Stockage SC, 30 variantes partageant des colonnes | 96,886 ms | 91,984 ms | ×1,05 |
| Stockage SC, 10 géométries distinctes | 133,780 ms | 131,164 ms | ×1,02 |

Méthode : cinq paires de processus indépendants par scénario, ordre alterné, deux échauffements et cinq mesures par processus, médiane des médianes. Les sorties de tous les scénarios ont la même empreinte entre RC17 et RC18. L’horloge est fixée pour comparer les champs de création des véhicules. Les fichiers de mesure sont conservés dans [PERFORMANCE_COMPARISON.json](QA/RE_REPAIR_RC18/PERFORMANCE_COMPARISON.json).

**Le ×35,81 concerne `RotationV2Manager.loadFromSave`, pas l’import complet d’une partie ni les FPS.** Le journal transactionnel global et le verrou d’import ne sont pas inclus dans ce microbenchmark. Le coût global de cette nouvelle sécurité reste à profiler sur le PC cible.

La physique et le SC sont proches de RC17 dans ces essais, pas radicalement accélérés. Les petites variations ne prouvent pas un gain ou une régression globale. Les tailles enregistrées du SC sont identiques dans les comparaisons ; aucune géométrie n’a été décimée. Les optimisations RC13/RC14 sont conservées sans annoncer un nouveau facteur ×100. La mémoire haute du processus Node de benchmark n’est pas la mémoire du jeu complet.

## 5. TypeScript : sources complètes, contrats incomplets

L’inventaire vérifie **115 modules applicatifs TypeScript**, leurs sorties compilées et les trois bundles. Aucun JavaScript applicatif orphelin n’a été détecté. Le worker de sauvegarde est maintenant rédigé et compilé comme un vrai module typé, plutôt que dissimulé dans une chaîne JavaScript.

Les douze `any` retirés concernent de vrais contrats de dépôt et d’annulation réseau : **48 → 36**. Le budget est réduit pour empêcher leur réintroduction. Les 28 `@ts-expect-error` n’augmentent pas. Les quatre nouveaux modules sont compilés dans une configuration stricte isolée, sans les déclarations globales historiques.

Cependant, cinq signatures d’index globales très permissives restent présentes. En les retirant expérimentalement et en vérifiant les déclarations, le compilateur expose **4 688 diagnostics**. La production n’est pas modifiée par cette expérience. Les surcharges DOM restantes signifient que même ce test n’est pas une preuve exhaustive de sûreté.

**Le portage des sources est vérifié ; le typage strict intégral demeure ouvert.** Ces diagnostics ne sont ni un pourcentage d’avancement fiable ni 4 688 bugs de jeu démontrés. Le détail, les fichiers prioritaires et les critères de fin sont dans [AUDIT_TYPESCRIPT_RC18.md](AUDIT_TYPESCRIPT_RC18.md).

## 6. Qualification finale et intégrité

| Contrôle | Résultat |
|---|---:|
| Compilation et contrôles TypeScript | 15 configurations réussies |
| Suite standard | 102 834 réussites, 0 échec |
| Suite de réparation | 866/866, dont 30 nouveaux tests |
| Régressions S3 | 265/265 fichiers actifs, dont 37 tests de timing exécutés en série |
| Scénarios navigateur ciblés | 34 imports/exports + 4 contrôles supplémentaires + double lancement |
| Navigation et circulation | 15 pages, 600/600 trains avancent aux quatre observations |
| Reconstruction indépendante | 115 modules + 115 déclarations + 3 bundles identiques |
| Ressources comparées à RC17 | 37 152 fichiers identiques, aucune ressource retirée |

Les nombres de tests se recouvrent et ne doivent pas être additionnés. Les onze fichiers historiquement supersédés restent documentés ; aucune nouvelle exclusion n’a été ajoutée. Trois contrôles basés sur la forme du code ont été adaptés au nouveau wrapper de chargement ou à l’identité du bundle ; les assertions de comportement restent présentes, et le contrôle du chargement utilise maintenant l’AST plutôt qu’une tranche de texte vide. Les changements sont enregistrés dans [RELEASE_TEST_UPDATES.json](QA/RE_REPAIR_RC18/RELEASE_TEST_UPDATES.json).

La reconstruction part d’un dossier sans modules compilés, déclarations émises ni bundles. Seuls les sources TypeScript, outils et fichiers JavaScript statiques nécessaires sont copiés avant compilation ; les 233 sorties comparées sont identiques octet pour octet. Les ressources, sources modifiées et comparaisons à l’entrée figurent dans [INPUT_PARITY.json](QA/RE_REPAIR_RC18/INPUT_PARITY.json) et [SOURCE_DIFF.patch](QA/RE_REPAIR_RC18/SOURCE_DIFF.patch).

L’archive FULL finale est scellée par `QA/FILE_SHA256_MANIFEST.txt`. Le contrôle CRC et la vérification de toutes les empreintes de l’archive sont consignés dans le fichier externe `RE_RC18_PACK_INTEGRITY.json`. Les anciens journaux et essais ayant échoué pendant le développement sont conservés, mais distingués des validations finales dans [RUN_INDEX.json](QA/RE_REPAIR_RC18/RUN_INDEX.json).

## 7. Ce qui n’est pas certifié

Les tests de navigateur exécutent les vrais bundles et les véritables gestionnaires, mais les fichiers sont injectés dans Chromium : la navigation locale native échoue ici avec `ERR_BLOCKED_BY_ADMINISTRATOR`. Le stockage est isolé ou modélisé transactionnellement et les appels externes sont neutralisés.

Opera/Win7, la vraie sauvegarde utilisateur, le quota disque réel, le lanceur C# sous Windows, la fluidité sur plusieurs heures, les voix et l’accès réel à OSM restent non certifiés. Aucune levée de 403, aucun rattrapage instantané, aucune réduction globale de RAM ou hausse générale de FPS n’est annoncée.

**Installation : lire [LIRE_AVANT_RC18.md](LIRE_AVANT_RC18.md). Conserver les exports valides et, pour une protection indépendante, le profil navigateur fermé ; extraire dans un nouveau dossier sans effacer les données de site.** Les nouveaux états d’incidents ne sont pas entièrement compris par les anciennes versions.
