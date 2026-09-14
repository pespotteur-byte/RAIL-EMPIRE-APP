# Rail Empire — RC19 FULL : installation et retour de test

## Préserver la partie

Depuis RC18, exporter une partie valide, conserver RC18 et son export séparément, puis fermer ses onglets et arrêter son serveur local. Extraire RC19 dans un nouveau dossier, sans superposer les fichiers. Lancer `LANCER_RE.cmd` avec la même adresse et le même port qu'auparavant. Ne pas effacer les données du site et ne pas ouvrir RC18 et RC19 simultanément.

Le lanceur et le serveur n'ont pas été modifiés. L'archive contient le jeu compilé : aucune reconstruction n'est nécessaire pour jouer. Les sources et tout l'historique de développement sont également conservés.

Pour revenir à RC18, utiliser la copie/export d'avant migration. RC18 peut à nouveau tronquer les journaux qu'elle charge ; elle ne connaît pas toutes les colonnes de dépenses ajoutées par RC19.

## Cantonnement

Les feux virtuels protègent désormais le bloc situé après leur position. Rouge : bloc à l'entrée indisponible ; jaune : bloc suivant indisponible ; vert : ces deux contrôles sont libres pour le mouvement approchant. Une réservation propre n'est pas un avertissement. Le nettoyage ne supprime plus des blocs toujours référencés par les itinéraires.

Les courbes de freinage et l'occupation jusqu'au dégagement de la queue sont conservées. Les motifs `CANTON_APPROACH` et `CANTON_STOP` apparaissent dans le diagnostic du mouvement. Les autres contraintes (travaux, gare, traction, proximité, croisements) restent actives.

Ce sont les cantons virtuels du modèle du jeu, pas un inventaire géolocalisé complet de signaux réels ni une reproduction réglementaire universelle. Aucune levée de 403 OSM n'est annoncée.

## Dashboard et finances

Sur les courbes : saisir le curseur ou un point pour lire ses valeurs, utiliser la molette pour zoomer, les deux poignées pour choisir la période, « Tout » pour parcourir l'historique conservé. Les flèches du clavier déplacent le curseur. Les barres de ventilation disposent également d'une poignée de lecture. Ces interactions ne modifient jamais l'argent.

Recettes et dépenses cumulées partagent désormais une courbe à deux séries. Les dépenses historiques absentes des anciennes sauvegardes sont inconnues, pas remplacées arbitrairement par zéro.

Le nouveau panneau financier contient les soldes/cumuls, les pénalités déjà incluses dans les dépenses, la dette, les ventilations par catégorie/ligne, tous les bilans journaliers conservés et le journal paginé à 100 écritures. La pagination et les filtres ne suppriment rien. Les dates du journal sont affichées en heure de Paris ; les filtres par date sont explicitement en UTC. Emprunter n'est pas une recette d'exploitation.

Les limites de 500 écritures/30 jours ont été retirées. Les nouveaux historiques financiers sont sauvegardés en entier. Les écritures déjà effacées par une ancienne version ne peuvent pas être récupérées. Un historique complet grandit : la compression existante reste active, mais aucun stockage illimité ni facteur de réduction global n'est garanti.

« Tout exporter (JSON financier) » et « Toutes les écritures (CSV) » exportent les finances, pas une sauvegarde restaurable du jeu. Utiliser le bouton normal d'export de partie pour sauvegarder le jeu.

## Rechargement et rattrapage

Après import ou rechargement, l'instant réellement simulé reste la référence. La cible est l'heure réelle. Lorsque la partie est active, non en pause et l'onglet visible, des tranches supplémentaires de calcul s'intercalent entre les dessins, avec un budget coopératif de 8 ms. Le plafond par tranche monte à 2 000 pas, mais chaque pas physique reste de 100 ms. Aucun événement n'est sauté pour afficher artificiellement l'heure réelle.

Pendant le rattrapage, les dessins intermédiaires de la carte sont espacés jusqu'à 200 ms. La résolution, les tuiles et les tracés ne sont pas dégradés. La cadence normale revient ensuite. Le bandeau affiche le temps de simulation courant et la dette restante. Une très longue absence ou une partie lourde peut encore demander du temps ; 8 ms n'est pas une garantie de durée maximale d'un callback indivisible.

L'heure et les positions doivent progresser ensemble. Sauvegarder pendant le rattrapage conserve le curseur atteint ; le rechargement suivant reprend à cet instant.

## Limites de qualification

Essais sous Node/TypeScript et Chromium Linux isolé, réseau extérieur intercepté et stockage de test. Opera/Win7, ton profil, ta partie et les caches physiques du navigateur ne sont pas certifiés par ces essais. Aucun nouveau test de deux heures sur ton PC n'a été réalisé ici. Les mesures de performance sont des traitements ciblés, pas les FPS du jeu complet.

Voir `RE_REPARATION_RC19_RAPPORT.md` et `QA/RE_REPAIR_RC19/SUMMARY.json` pour les résultats exacts et les éventuels compromis.
