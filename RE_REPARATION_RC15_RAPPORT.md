# Rail Empire — RC15 FULL : continuité du train remorqué

Livraison du 12 septembre 2026, issue de l’archive RC14 FULL fournie. Aucune édition LIGHT n’est produite. Les sources, les bundles jouables et l’historique des tests restent dans l’archive complète.

## Bilan du registre

**84 dossiers clos sur 87 (96,6 %), contre 83/87 en RC14.** DDS03 est clôturé pour le déplacement du train remorqué et sa réception au dépôt. LM03 et TIME05 restent partiels ; DDS04 reste ouvert. Ce pourcentage ne mesure pas tous les défauts possibles du jeu.

## Défaut corrigé et comportement nouveau

Dans la base RC14, le retour déplaçait le marqueur de la locomotive de secours puis créait la réparation, sans acheminer le train cible. La rame pouvait donc rester sur son ancien itinéraire pendant que le secours se déclarait revenu.

La mission prend désormais explicitement en charge le mouvement du service. La prise en charge exige une cible présente et immobilisée à proximité du secours (tolérance de raccordement existante : 50 m). Une cible en mouvement ou absente retient l’opération. Pendant le retour, le train suit les positions intermédiaires du même tracé que le secours ; sa traction propre et ses opérations de composition ne progressent plus en parallèle. La boucle principale l’exclut de la réinitialisation de ses liaisons horaires ordinaires.

Le jeu utilise ici un **point de référence commun de convoi**. Il ne représente pas séparément les attelages ni la distance exacte entre les cabines et la queue. L’occupation du train est publiée sur le tracé de retour, mais cela **ne signifie pas que toutes les contraintes ferroviaires du secours sont résolues** : voir DDS04 ci-dessous.

Une incohérence de composition, un dépôt supprimé, une cible absente/déplacée ou un matériel déjà localisé au dépôt retiennent le retour au lieu de terminer fictivement la mission. Si une sauvegarde RC14 contient un ancien retour sans train attaché, il repart chercher la cible à sa position connue ; il ne téléporte pas cette cible sur la locomotive.

## Réception au dépôt et réparation

L’admission est effectuée avant la clôture de mission. Un dépôt plein conserve le convoi à son arrivée, garde sa locomotive mobilisée et ne lance pas encore la réparation. Une fois la place accordée, le service est interrompu, le matériel est localisé au dépôt et la réparation n’est inscrite qu’une fois. La réparation du matériel ne remet pas cette circulation sur son ancien horaire.

Pour une rame persistante, son emplacement et son état d’entretien sont conservés. La sortie du dépôt reste refusée pendant la réparation, y compris après chargement ; la réconciliation de chargement tient maintenant compte de la file de réparation d’urgence, pas seulement de l’entretien préventif.

Pour une formation V2 faite d’engins individuels, les mêmes véhicules physiques sont localisés au dépôt. Un enregistrement de stationnement conserve leur liste et leur voie, sans acheter ni dupliquer une rame. La page Dépôts & ITE affiche « Formations physiques remorquées », avec l’état de réparation. Les caractères spéciaux du nom restent du texte.

Le moteur des roulements consulte la file d’urgence avant de rétablir la disponibilité d’un engin sans circulation active : il ne peut donc plus considérer cette absence de service comme une fin de réparation. La voie d’une formation individuelle reste réservée jusqu’à ce que les localisations connues de **tous** ses engins indiquent qu’ils ont quitté ce dépôt. Une nouvelle mission d’acheminement explicite reste nécessaire ; aucun trajet de sortie automatique n’est inventé.

## Sauvegardes, compteurs et restauration

L’attelage logique, les identités de rame/véhicules, le parcours de retour, sa progression, la distance remorquée et le stationnement sont conservés. Le moteur V2 restaure le curseur sur le **tracé du secours**, pas sur la liaison prévue à l’horaire. Les occurrences V2 interrompues et reçues au dépôt sont mémorisées pour empêcher leur recréation à l’import ou au rechargement.

Les kilomètres remorqués alimentent les odomètres du matériel et des véhicules concernés. Ils n’ajoutent ni kilomètres facturables au service initial ni consommation de gazole au train en panne. La traction et la consommation du remorqueur ne sont pas refondues dans cette passe.

Ces contrôles de restauration ne constituent pas le replay complet d’une longue absence. La reconstruction reste soumise au périmètre de dates et de plans du runtime existant ; aucune conservation universelle de missions arbitrairement anciennes n’est certifiée.

## Qualification exécutée sur la livraison

| Contrôle | Résultat |
|---|---:|
| Suite de réparation RC14 de référence | 725 réussites |
| Suite de réparation RC15 | 753 réussites, dont 28 nouveaux tests |
| Suite standard | 102 834 réussites |
| Porte de régression S3 | 257/257 fichiers actifs |
| Fichiers timing exécutés seuls après les tests fonctionnels | 35 |
| Reconstruction indépendante | 108 modules JS, 108 déclarations, 3 bundles et 2 entrées HTML identiques |
| Ressources comparées à l’entrée RC14 | 37 152 fichiers inchangés |
| Sources applicatives TypeScript | 108 modules ; 48 `any`, 28 `@ts-expect-error`, aucun ajout de dette recensé |

Les suites se recouvrent : **ne pas additionner leurs totaux**. Les 11 anciens fichiers supersédés restent ceux du manifeste d’entrée ; aucune exclusion n’est ajoutée. Dans 49 anciens fichiers de tests, seul le marqueur de cache attendu passe de `1199repair14` à `1199repair15`. Le nouveau fichier de tests s’ajoute aux suites.

Les nouveaux essais utilisent les classes réelles du jeu sur des géométries contrôlées : aller, cinq minutes d’intervention, positions intermédiaires de retour, dépôt plein, réparation avec/sans pièces, conservation des identités, interruptions, snapshot et compilation V2 réels, refus de disponibilité en atelier, conservation puis libération du stationnement. Le premier lot de 13 essais échoue sur les modules RC14 extraits de l’archive ; ce contre-essai n’est pas un benchmark exhaustif de toutes les évolutions.

Dans Chromium, les vrais bundles passent 15 pages, les quatre observations carte → personnel → incidents → carte avec **600/600 trains progressant**, la sauvegarde/relecture compressée et les contrôles de stockage hérités. Un essai supplémentaire appelle réellement `moveTick`, puis vérifie le remorquage et son affichage au dépôt. Aucun `pageerror` n’a été enregistré. Les 600 corridors sont synthétiques et indépendants : ils ne valident pas une circulation dense dans des enclenchements partagés.

La navigation native HTTP, `file://` et l’origine de test est administrativement bloquée ici. Le harnais fournit les vrais fichiers au DOM Chromium et isole le réseau/stockage. Il ne certifie **ni Opera/Win7, ni le disque/quota natif, ni les services externes ou la sauvegarde de PE**. Le serveur Node est couvert par les tests locaux ; le lanceur C# n’a pas été compilé/exécuté sous Windows 7.

## Trois dossiers non clôturés

**LM03 — blocage durable à basse vitesse :** l’observation personnelle vers 12 km/h n’a pas été reproduite. L’export de diagnostic RC12 demeure disponible. Les essais synthétiques ne suffisent pas à conclure sur ce défaut précis.

**TIME05 — replay chronologique complet :** l’horloge et les routines héritées ne rejouent pas encore tous les événements ferroviaires après une longue absence. Aucune clôture n’est déduite de la restauration du remorquage.

**DDS04 — circulation du secours :** le déplacement DDS conserve son contrôleur séparé. Le respect complet des cantons, travaux, compatibilités de traction, signaux et géométrie du convoi n’est pas implémenté/certifié. Le retour utilise encore les règles de vitesse du secours préexistantes. Ne pas interpréter DDS03 comme une certification de sécurité d’exploitation.

## Stockage et intégrité

Les mécanismes de compression/partage RC13–RC14 sont conservés ; aucune géométrie du SC ni ressource de jeu n’est retirée. Aucun nouveau facteur ×100, gain de FPS ou réduction globale de RAM n’est revendiqué. Le poids de l’archive FULL inclut les sources et les preuves ajoutées.

Le scellement final génère `QA/FILE_SHA256_MANIFEST.txt`, puis vérifie le CRC de l’archive et le SHA-256 de chacun de ses fichiers. Le compte exact et l’empreinte de l’archive sont livrés dans `RE_RC15_PACK_INTEGRITY.json`, à côté du ZIP. Le refus OSM signalé n’est pas déclaré levé.

## Fichiers de preuve

`QA/RE_REPAIR_RC15/SUMMARY.json`, `SOURCE_DIFF.patch`, `INPUT_PARITY.json`, `REPRODUCIBLE_BUILD.json`, `TYPESCRIPT_AUDIT.json`, `RELEASE_TEST_UPDATES.json`, les journaux `logs/`, les résultats et captures `browser/`. Les checkpoints A/B documentent les étapes avant qualification ; les journaux d’essais infructueux sont conservés, pas maquillés en résultats verts. Le présent bilan utilise les exécutions finales indiquées dans SUMMARY.
