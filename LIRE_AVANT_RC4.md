# Rail Empire — RC4 TypeScript / performances

Build : S3_GAMEPLAY_REPAIR_RC4_TS_PERF. Jeu déjà compilé.

Exportez votre sauvegarde et conservez RC3. Extrayez cette version dans un dossier neuf, sans mélanger les fichiers. Ouvrez index.html. Pour l’administration, ouvrez admin.html (bundle autonome inclus).

Commencez avec une copie de partie. Le comportement des règlements quotidiens et les réparations RC1–RC3 sont conservés. Cette RC ne prétend pas terminer tous les bugs : lisez RE_REPARATION_RC4_RAPPORT.md et RE_REGISTRE_CORRECTIONS_RC4.md.

Les gains annoncés sont des mesures de tâches isolées, pas un nombre de FPS certifié. Les 84 modules applicatifs ont leur source TS ; les données, bundles compilés, scripts d’outillage et dépendances tierces restent distincts. Le typage historique conserve de la dette.

Pour reconstruire : npm run build:repair après installation des dépendances. Pour jouer, aucune installation de compilateur n’est nécessaire. La reconstruction modifie les fichiers et rend donc l’ancien manifeste de livraison inapplicable jusqu’à sa régénération.

Les preuves récentes sont dans QA/RE_REPAIR_RC4. Les autres rapports QA sont historiques.
