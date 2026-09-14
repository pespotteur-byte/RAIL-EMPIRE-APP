# RC13 — Avant lancement et optimisation du stockage

## Installer sans perdre la partie

1. Dans RC12, exportez une sauvegarde `.json` ou `.json.gz`. Conservez-la avec le ZIP RC12. L’export de partie n’est pas une copie de tous les caches cartographiques du navigateur.
2. Fermez les onglets RC12. Extrayez RC13 dans un **nouveau dossier**, sans mélanger ses fichiers avec une version précédente.
3. Lancez le nouveau dossier par `LANCER_RE.cmd`, en conservant **la même adresse locale et le même port** que d’habitude (`http://127.0.0.1:8765/` par défaut). Arrêtez au préalable l’ancien serveur local : ouvrir un nouveau lanceur alors que l’ancien sert encore son dossier peut afficher l’ancienne version. Le serveur/lanceur Windows n’a pas été exécuté ici sous Win7/Opera.
4. Chargez la partie habituelle. RC13 lit les anciennes sauvegardes. Un changement entre `file://`, `localhost`, `127.0.0.1` ou un autre port n’utilise pas nécessairement le même stockage : réimportez l’export dans la bonne ouverture si nécessaire, sans effacer l’ancienne origine.

**Ne choisissez pas “Effacer les données du site” pour appliquer cette mise à jour.** Cela n’est ni demandé ni nécessaire, et peut supprimer la sauvegarde ainsi que les données cartographiques hors ligne.

## Réduire aussi les anciens caches

La prochaine sauvegarde valide utilisera automatiquement le nouveau format compact. Les anciennes géométries persistantes ne sont pas toutes réécrites automatiquement au démarrage.

Ouvrez **Stockage**, avec l’icône de compression dans la barre supérieure, près de l’export de sauvegarde. Cliquez sur **Exporter la partie** si une copie récente manque, puis sur **Optimiser sans supprimer**. La partie courante est enregistrée, les deux bases de caches ferroviaires sont parcourues un enregistrement à la fois, et les copies anciennes ne sont remplacées qu’après les contrôles prévus.

Gardez l’onglet ouvert pendant l’opération. Le bouton **Arrêter / fermer** interrompt le travail entre les enregistrements ; les remplacements déjà validés restent valides, et les caches suivants sont conservés. Aucun appel à OSM n’est nécessaire pour compacter les données présentes.

À la fin, **Exporter le bilan** produit `rail-empire-stockage-rc13.json`. Le bilan contient les tailles, le backend, l’état des caches et les estimations avant/après, pas les géométries de la partie. Le panneau n’envoie rien automatiquement.

## Lire les chiffres sans confusion

**“Réduction de la sauvegarde vs JSON brut”** compare le contenu compact au même état JSON non compressé. Ce n’est pas une comparaison automatique de toute votre installation RC12 et RC13, ni une mesure des fichiers physiques du profil.

**“Total de cette origine”** concerne le stockage rapporté par le navigateur pour cette adresse. L’estimation et le quota peuvent être indisponibles ou actualisés avec retard. Le cache HTTP d’images n’est pas supprimé. Une sauvegarde déjà fortement compressée n’obtiendra pas nécessairement un facteur 100 supplémentaire.

Dans les essais de référence, un grand tracé unique donne environ ×6 ; 10 copies du même tracé donnent ×60 ; 30 copies donnent ×175. Ce sont des états synthétiques, pas votre partie. La division par 100 de l’occupation physique totale n’est pas garantie.

## Quota, erreurs et compatibilité

La mention `indexeddb` indique la sauvegarde binaire normale. `localStorage-fallback` indique le repli en chaînes : il dispose de contraintes différentes et peut lui aussi être plein. Une écriture réussie ne signifie pas que le navigateur a accordé un quota illimité.

Un échec de compaction ne doit pas effacer le cache précédent. Le panneau indique les échecs et les modifications concurrentes conservées. Une opération peut encore échouer si le disque est réellement plein ou si l’écriture de remplacement nécessite une marge temporaire. Exportez la partie hors du stockage du navigateur ; n’effacez pas les données OSM pour obtenir artificiellement un chiffre plus bas.

La taille en RAM des géométries nécessaires à la simulation n’est pas divisée par le facteur de compression sur disque. La compression et la relecture peuvent prendre davantage de CPU, surtout sur les grands tracés tous différents. Les possibilités de compression sont détectées ; sans gzip natif, le format compact JSON reste disponible, avec moins de gain potentiel.

Ne faites pas tourner RC12 et RC13 en même temps sur la même origine : RC12 ne sait pas lire les nouveaux corps binaires. Pour revenir en arrière, exportez la partie **depuis RC13**, fermez RC13, relancez RC12 et importez cet export portable. Conserver le vieux ZIP seul ne constitue pas une sauvegarde du contenu du navigateur.

Le refus 403 du fournisseur, les manœuvres/seconds secours encore incomplets, le replay d’absence et le blocage durable à basse vitesse ne sont pas déclarés résolus par cette livraison de stockage.
