# Rail Empire RC11 — lancement et import

**Exporter la sauvegarde depuis RC10 avant tout changement.** Conserver le dossier RC10 et le fichier exporté. Extraire RC11 dans un nouveau dossier ; ne pas mélanger les versions et ne pas supprimer l’ancienne avant vérification.

## Ouverture

Lancer `LANCER_RE.cmd` sous Windows pour utiliser l’adresse locale `http://127.0.0.1:8765/`. Le lanceur et ses solutions de repli sont ceux de RC9/RC10. Le serveur Node a été testé sous Linux dans RC9 ; le lanceur Windows/C# n’a pas été exécuté ici sous Win7/Opera.

Garder la même adresse, le même protocole et le même port d’une session à l’autre. Passer de `file://` à HTTP, ou changer d’adresse/port, peut conduire le navigateur à présenter un autre espace de stockage. Une partie non visible n’est pas nécessairement effacée. Réimporter l’export dans RC11 au besoin ; ne pas écraser l’unique sauvegarde existante pendant l’essai.

Le fond OSM standard reste préventivement suspendu sous `file://`. Le serveur local sert les fichiers du jeu, pas un proxy pour contourner OSM. Le panneau conserve les blocages/temporisations des services OSM et ORM. La 403 réelle n’est pas déclarée levée par cette version.

## Changements visibles à connaître

Une rame localisée sur une voie ne peut plus partir depuis une autre voie de la même gare sans transfert explicite. Le motif indique l’acheminement W/HLP requis. Le retour automatique conserve la voie physique au lieu d’en changer par parité. Un ancien matériel dont la position est inconnue conserve une compatibilité initiale ; aucune identité de voie fictive n’est créée.

Un TAQ ou retour nécessite désormais une composition réversible et au moins cinq minutes réelles de changement de cabine, après les éventuelles opérations de composition. C’est une règle de simulation. Une rame terminée par un wagon ordinaire, une composition non renseignée ou une géométrie incohérente peut rester retenue. Le logiciel ne réalise pas encore de remise en tête automatique de la locomotive. Ne pas interpréter ce motif comme une preuve du bug durable à 12 km/h, qui reste un autre dossier.

Les noms avec apostrophes, guillemets ou esperluettes restent inchangés dans la sauvegarde et s’affichent comme du texte. Le calcul des longues marches limite le stockage simultané des cellules physiques, au prix d’un temps de calcul supérieur sur les grands profils mesurés ; cela ne garantit pas l’absence de manque de mémoire dans tout le navigateur.

Les consommables effectifs de RC10 restent actifs. Vérifier le gazole et les équipements déclarés après import. Le secours/remorquage physique complet reste à terminer.

## Vérification après import

Contrôler la liste des rames, leur position/voie, les départs, retours/TAQ et les motifs d’attente. Conserver un export de RC10 non modifié tant que la partie réelle n’a pas été vérifiée. Les tests de cette livraison n’utilisent pas la sauvegarde personnelle du joueur.

Rapport : `RE_REPARATION_RC11_RAPPORT.md`. Registre : `RE_REGISTRE_CORRECTIONS_RC11.md`. Preuves : `QA/RE_REPAIR_RC11/`.
