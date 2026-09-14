# Installation RC18 FULL — conserver la partie avant migration

## Ce qui change

RC18 sécurise les imports et les exports, conserve les cadences d’incidents et corrige deux défauts supplémentaires du dashboard et des dépôts. Les optimisations de stockage RC13/RC14 sont conservées. C’est la version FULL : aucune ressource de jeu n’a été retirée.

## Avant de remplacer la version en cours

Conserver les exports déjà vérifiés et le ZIP RC17. Pour une protection indépendante des exports, effectuer une copie du profil navigateur avec le navigateur complètement fermé. Ne pas se contenter d’un unique nouveau fichier exporté par RC17 : l’audit a précisément reproduit un mélange d’instants pendant son export. Ce défaut est corrigé dans RC18.

Un export de partie ne contient pas tous les réglages et catalogues administrateur. Conserver aussi leurs exports dédiés ou le profil fermé. Ne pas supprimer le profil ni vider les données du site.

## Installation

1. Fermer l’ancien onglet, fermer le navigateur après la sauvegarde du profil et arrêter l’ancien serveur local. Ne pas laisser un onglet RC17 et un onglet RC18 écrire simultanément.
2. Extraire RC18 dans un nouveau dossier, sans superposer les fichiers. Lancer `LANCER_RE.cmd` depuis ce dossier et conserver le même protocole, le même hôte et le même port que d’habitude. Le dossier FULL contient les fichiers de jeu prêts à exécuter.
3. Vérifier le nom de compagnie, les horaires et le solde après chargement. Produire ensuite un nouvel export depuis RC18 et le conserver séparément. Un import refusé doit afficher une erreur et garder la partie précédente ; attendre la fin de l’opération, sans fermer l’onglet pendant l’écriture.

Le jeu reçoit une cadence d’incidents persistante à la première sauvegarde RC18. Une ancienne sauvegarde n’a pas cette information : elle est initialisée proprement, pas reconstituée par invention. Cela ne garantit pas la même suite historique d’incidents qu’une ancienne session dont les crédits n’ont jamais été enregistrés.

## Retours en arrière

Pour revenir à RC17, privilégier une sauvegarde/profil d’avant migration plutôt que réutiliser aveuglément le stockage modifié par RC18. RC17 ignore la nouvelle cadence des incidents. Ne pas lancer l’ancien jeu en parallèle du nouveau.

## Quota et performances

L’import est exclusif pendant la validation et l’écriture : un panneau bloque temporairement les commandes, et la simulation et l’autosauvegarde sont suspendues. La capture d’un grand état peut consommer temporairement du CPU et de la mémoire ; le coût global sur le PC cible n’a pas été mesuré. Il n’y a pas de suppression de points de voie ni de purge destinée à embellir un benchmark.

Une suppression de sauvegarde peut être protégée par un marqueur local si IndexedDB refuse de supprimer physiquement son enregistrement. Cela empêche sa réapparition, mais ne garantit pas que le quota physique a été libéré. Le panneau de stockage continue de distinguer tailles de contenu et estimations.

## Limites de validation

Les tests RC18 ont utilisé les véritables bundles et gestionnaires. Dans cet environnement, la navigation native vers le serveur local est bloquée par une règle d’administration ; les essais Chromium injectent donc les fichiers fournis, avec réseau externe coupé et stockage de test. Opera/Win7, le profil personnel, le quota physique, l’audio, le lanceur C# Windows et l’accès réel à OSM restent non certifiés. Aucune levée de 403 n’est annoncée.

Voir [rapport](RE_REPARATION_RC18_RAPPORT.md), [registre](RE_REGISTRE_AUDIT_RC18.md) et [audit TypeScript](AUDIT_TYPESCRIPT_RC18.md).
