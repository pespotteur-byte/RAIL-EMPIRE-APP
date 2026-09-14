# Rail Empire RC16 FULL — avant installation

Exporter la partie depuis RC15 et conserver cet export ainsi que l’archive précédente. Fermer les anciens onglets et leur serveur. Extraire RC16 FULL dans un nouveau dossier, sans superposer les versions. Lancer `LANCER_RE.cmd`, ou `node scripts/serve-local.cjs` avec Node disponible. Garder la même adresse locale et le même port, habituellement `http://127.0.0.1:8765/`. Ne pas vider les données du site.

## Rattrapage visible

Après une absence, le jeu reprend au curseur sauvegardé puis travaille vers l’heure réelle. Le bandeau « Rattrapage chronologique » montre la durée restant à simuler. Une longue absence peut donc laisser l’heure simulée en retard pendant la reprise. Le temps restant est conservé dans les sauvegardes et exports ; il n’est pas éliminé pour faire artificiellement coïncider les horaires.

Le rattrapage est limité par appel pour laisser la main au navigateur. Un traitement lourd peut néanmoins dépasser le budget coopératif. Aucun rattrapage instantané ni performance sous Opera/Win7 n’est garanti. Les vieux fichiers sans curseur utilisent leur horodatage de sauvegarde/export lorsqu’il existe ; leurs pertes de temps antérieures ne peuvent pas être recréées.

Si « Simulation suspendue » apparaît, le moteur a rencontré une erreur. Ne pas multiplier les réimportations du même fichier dans l’espoir de rejouer automatiquement l’opération : l’erreur est conservée pour éviter une application en double. Conserver le fichier, le diagnostic de mouvement et l’export précédant l’incident. Les états ordinaires reprennent normalement ; une sauvegarde déjà marquée en erreur reste suspendue.

## Retour arrière

RC15 ne connaît pas le nouveau curseur ni les temps de mouvement distant en attente. Pour revenir à cette version, employer l’export réalisé AVANT migration. Ne pas ouvrir simultanément RC15 et RC16 sur la même origine. Les formats compressés et les précautions administrateur historiques de RC14 sont conservés.

## Périmètre

84/87 dossiers historiques clos. Le cache de proximité est corrigé et la reprise chronologique progresse ; le cas personnel de blocage durable, la qualification complète de toutes les interactions après absence et l’autorité de circulation des secours restent partiels/ouverts. Le remorquage et les optimisations de stockage déjà livrés sont conservés. La 403 n’est pas déclarée levée. Aucune édition LIGHT n’est produite.

Lire `RE_REPARATION_RC16_RAPPORT.md`, `RE_REGISTRE_CORRECTIONS_RC16.md` et `QA/RE_REPAIR_RC16/SUMMARY.json`.
