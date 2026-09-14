# Rail Empire RC14 — stockage partagé et édition légère

## Jouer

1. Exporter la partie dans RC13 et fermer les anciens onglets / arrêter l'ancien lanceur.
2. Extraire **Rail_Empire_S3_RC14_LIGHT.zip** dans un nouveau dossier. Ne pas superposer deux versions.
3. Lancer **LANCER_RE.cmd**, puis conserver `http://127.0.0.1:8765/` et le même port. Autre lanceur : `node scripts/serve-local.cjs`.
4. Dans le jeu, ouvrir **Stockage**, puis **Optimiser sans supprimer**. Une sauvegarde normale utilise également le partage SC étendu.

**L'édition LIGHT requiert le serveur local.** Les `.js.gz`, `.json.gz`, `.svg.gz`, etc. sont les fichiers normaux précompressés ; leurs adresses dans le jeu ne changent pas. Ne pas les renommer en supprimant `.gz`. Le serveur fournit gzip aux clients qui l'acceptent ; sinon il décompresse par fragments, sans extraire une seconde copie du jeu.

Un double-clic sur `index.html` (`file://`) affiche une aide au lancement. Pour le mode classique non précompressé, l'archive COMPLETE conserve les bundles ordinaires. La couche OSM garde les restrictions RC9 en `file://`.

Le lanceur Node a été exécuté et testé sous Linux. Le code C# Windows a été adapté, mais n'a **pas été compilé/exécuté sous Windows 7** dans cet environnement. Aucune certification Opera/Win7 n'est annoncée.

## Sauvegardes et caches

Le format compact interne reste `RE13-JSON-1` / `RE13/gzip` : RC14 ajoute des candidats de référence, sans changer le lecteur. Les nouveaux partages de colonnes SC sont lisibles par le lecteur RC13. Les exports portables du jeu restent inchangés. La compaction des caches issue de RC13 reste présente ; RC14 ne purge pas les cartes et n'ajoute pas de requêtes OSM.

**Ne pas vider les données du site.** Changer protocole/hôte/port change normalement l'origine et peut rendre l'ancienne sauvegarde invisible sans l'effacer. Conserver l'export personnel et la version précédente.

## Administrateur : changement distinct

À l'ouverture d'`admin.html`, les quatre grands ensembles `admin_catalog_mods`, `admin_catalog_deleted`, `admin_catalog_imported`, `admin_incidents` sont chargés et migrés vers une base IndexedDB compressée. L'ancienne copie locale n'est retirée qu'après validation de la transaction ; un échec de migration la conserve. Les modifications de l'interface ne sont appliquées qu'après enregistrement. Les autres paramètres et le jeton GitHub ne sont pas migrés.

En cas d'échec d'IndexedDB lors d'une écriture, un repli local compact `RE14A:` est tenté. Si les deux échouent, l'erreur est affichée et l'ancienne copie n'est pas supprimée. Une base inaccessible ou des données illisibles peuvent bloquer l'administration plutôt que présenter silencieusement un catalogue vide.

**Les anciennes pages admin RC13 ne savent pas lire ces nouveaux ensembles.** Exporter les catalogues avant migration ; conserver une copie du profil du navigateur pour sauvegarder aussi modifications, suppressions et incidents administrateur. Ne pas utiliser deux versions ou deux pages administrateur en même temps. La gestion concurrente complète entre onglets n'est pas certifiée. L'export de partie ordinaire n'est pas une sauvegarde des données administrateur.

## Ce que signifie ×100

Le facteur dépend des données. La mesure synthétique à 128 variantes partageant leurs grandes colonnes SC dépasse ×100 face à RC13. Les petits tracés uniques ne gagnent rien ; des géométries réellement différentes gagnent beaucoup moins. Pas de suppression de coordonnées ni d'arrondi nouveau.

Le poids du dossier installé, le poids du ZIP, le contenu écrit par l'application et l'occupation physique des bases du navigateur sont quatre mesures différentes. Le dossier LIGHT n'inclut ni sources, ni tests historiques, mais garde tous les visuels, sons et données runtime sélectionnés (identiques après décompression). Ces éléments de développement restent dans l'archive COMPLETE.
