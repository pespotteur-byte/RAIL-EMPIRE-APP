# Rail Empire — RC16 FULL : voisins physiques et reprise chronologique

Livraison du 12 septembre 2026, issue de RC15 FULL. Jeu, sources, ressources et historique conservés ; aucune édition LIGHT.

## Bilan

**84 dossiers clos sur 87 (96,6 %), comme RC15.** Les corrections ci-dessous sont vérifiées sur leur périmètre, mais ne justifient pas de déclarer les trois dossiers restants intégralement clos. LM03 et TIME05 restent partiels ; DDS04 reste ouvert.

## 1. Un voisin disparu ne devient plus un obstacle fantôme

Un cache de proximité ou une ancienne grille pouvait conserver un ancien objet train après suppression/rechargement, y compris lorsqu’un nouveau train portait le même identifiant. Les candidats sont maintenant validés contre les objets réellement présents dans la flotte du calcul courant. L’index spatial n’est réutilisé que dans son cadre synchrone ; autrement, la liste courante fait autorité. Les voisins locaux sont également nettoyés lors des changements de niveau de détail. Le cadre est libéré même en cas d’exception.

Sept des dix premiers cas ciblés échouent sur les modules RC15 extraits, puis passent après correction. Les essais couvrent un voisin retiré, remplacé avec le même ID, une grille ancienne, une flotte vide, un nouvel obstacle, le remplacement pendant un cadre et la reprise full/macro. Les vrais obstacles restent protégés. Ce défaut fournit une cause reproduite de retenue injustifiée, **pas l’identification certaine du blocage personnel de PE vers 12 km/h**.

Une phase de filtrage géométrique complémentaire évite certaines projections coûteuses sur de courtes routes : une position située au-delà de toutes les latitudes de la ligne, avec une marge supérieure aux 50 m du modèle, ne peut pas être un voisin sur cette ligne. Cette limite est recalculée à chaque appel, sans cache durable ni approximation supplémentaire de route ; les longues géométries conservent le chemin de calcul habituel.

## 2. Le temps restant à simuler est conservé

Le moteur de jeu dispose d’un curseur temporel persistant. Le temps réel est sa cible ; chaque minute, chaque seconde et chaque pas de mouvement reçoivent leur instant de simulation. La boucle entrelace ces callbacks au lieu d’exécuter de nombreux déplacements tous datés de l’instant actuel ou de sauter au point théorique du sillon lors du retour sur l’onglet.

Un appel traite au maximum 50 pas physiques de 100 ms (fraction adaptée pour rejoindre une frontière de seconde), sous un budget coopératif de 12 ms. Ce budget est vérifié entre les callbacks : **un callback lourd peut le dépasser**, et il ne garantit ni fréquence d’image ni temps de rattrapage. Le reste de l’écart n’est pas effacé ; il attend les appels suivants. L’état de l’horloge reste de taille constante, sans construire une liste contenant tous les événements de l’absence.

L’interface affiche « Rattrapage chronologique » avec la durée encore en attente. Les appels d’enrichissement OSM du viewport sont retenus pendant le rattrapage pour ne pas multiplier ces demandes. Cela ne lève aucun refus du fournisseur et ne précharge pas des cartes hors ligne.

Les sauvegardes automatiques **et** les exports portables conservent le curseur appliqué, la cible connue et les frontières déjà traitées. Le registre des tâches utilise l’instant simulé. Les snapshots V2 sont datés de cet instant, pas du moment où le fichier est écrit : une pause de douze heures ne rend plus automatiquement obsolète une position encore en attente de reprise.

Les temps de déplacement accumulés dans les niveaux de détail distant/intermédiaire sont également sauvegardés et restaurés. Une importation runtime réussie invalide son ancienne seconde de synchronisation ; une importation invalide conserve les données précédentes. Une erreur d’un callback suspend le moteur et mémorise l’erreur plutôt que de réessayer automatiquement une opération possiblement appliquée en partie, y compris après rechargement.

Les sauvegardes antérieures ne possèdent pas de curseur précis : la migration utilise leur horodatage de sauvegarde ou d’export lorsqu’il existe. **Elle ne reconstruit pas le temps déjà perdu dans les anciennes versions.** La conservation des anciennes conventions de jours d’exploitation, des effets externes asynchrones et de toutes les interactions de circulation reste à qualifier avant clôture complète de TIME05. La suite valide des transitions d’heure dans l’horloge ; ce n’est pas une certification de tous les horaires ambigus autour d’un changement d’heure.

## 3. Qualification exécutée

| Contrôle | Résultat |
|---|---:|
| Suite de réparation | 791/791, dont 38 nouveaux |
| Suite standard | 102,834 réussites |
| Porte S3 | 260/260 fichiers actifs |
| Reconstruction indépendante | 109 modules JS, 109 déclarations, 3 bundles et 2 entrées HTML identiques |
| Ressources comparées à RC15 | 37,152 fichiers inchangés |
| Sources TypeScript | 109 modules ; 48 `any`, 28 `@ts-expect-error` |

Les suites se recouvrent : ne pas additionner leurs totaux. Les 11 exclusions historiques sont conservées à l’identique. Les anciens tests ne sont pas assouplis : les marqueurs de version changent, et un extracteur de source est adapté à la signature datée de la fonction Paris. Ses assertions de réutilisation du formateur restent intactes. Les trois nouveaux fichiers ajoutent les contrôles RC16.

L’essai de 48 heures valide 1 728 000 pas, 172 801 notifications de seconde, 2 881 notifications de minute et deux règlements journaliers de test, avec sauvegarde/reprise et aucune seconde perdue. C’est un essai du curseur et du registre temporel, **pas une partie de 48 heures avec tous les sous-systèmes réels**. Des essais complémentaires utilisent un vrai ActiveService, un incident intermédiaire et de vrais snapshots/compilations V2.

Dans Chromium, 15 pages sont vérifiées et les 600 trains des corridors synthétiques indépendants progressent aux quatre observations entre les pages. Le remorquage RC15 et l’interface de dépôt sont recontrôlés. Un nouveau scénario appelle les vraies méthodes du jeu pour sauvegarder, recharger, effectuer un premier pas borné vers une cible à une heure de distance, afficher le rattrapage, puis sauvegarder/recharger à nouveau au curseur exact. Il ne prétend pas simuler toute cette heure de la partie de PE.

Le premier essai navigateur lancé en concurrence avec les tests n’a pas fait avancer tous les trains en 3,6 secondes de temps d’attente. Ce résultat n’est pas compté comme une réussite ; le filtrage des voisins et la reprise finale sont contrôlés séparément. Les résultats finaux et leur contexte figurent dans les fichiers JSON navigateur.

La navigation native locale HTTP, fichier et origine de test est administrativement bloquée. Les vrais bundles sont fournis au DOM isolé, les services externes sont bloqués et le stockage Web est un banc en mémoire. **Ni Opera/Windows 7, ni le disque/quota natif, ni la partie réelle de PE ne sont certifiés.** Le lanceur Windows n’a pas été recompilé ou exécuté sous Windows.

## 4. Performance ciblée

Sur le scénario de recherche de voisin (300 appels, 100 voisins de voies parallèles et route de 201 points), la médiane des cinq paires passe de **164.110 ms en RC15 à 3.286 ms en RC16**, soit ×49.94 sur cette fonction et ces données. Les processus sont séparés, l’ordre alterné, avec trois échauffements et sept mesures par processus. Les réponses comparées sont identiques. **Ce n’est pas un gain de FPS du jeu ni la performance du rattrapage complet.**

## 5. Dossiers restant ouverts ou partiels

LM03 : le cas personnel de blocage durable reste à identifier ; le diagnostic de mouvement est conservé. TIME05 : le socle chronologique est intégré et testé, mais pas toutes les interactions de la partie entière. DDS04 : le moteur séparé des secours et son intégration complète aux cantons, travaux et traction ne sont pas refondus par cette livraison.

Les optimisations de stockage RC13/RC14 sont conservées. Aucun point du SC, son ou image n’est supprimé. Aucun nouveau facteur ×100, gain global de mémoire, ou déblocage de la 403 n’est annoncé.

## Preuves et installation

Voir `QA/RE_REPAIR_RC16/SUMMARY.json`, `SOURCE_DIFF.patch`, `TYPESCRIPT_AUDIT.json`, `INPUT_PARITY.json`, `REPRODUCIBLE_BUILD.json`, `PERFORMANCE_COMPARISON.json`, les journaux et le dossier navigateur. Le scellement de l’archive est contrôlé séparément dans `RE_RC16_PACK_INTEGRITY.json` livré à côté du ZIP.

Exporter la partie depuis RC15 avant migration, conserver cette copie, puis installer RC16 FULL dans un dossier séparé. Garder la même adresse locale et le même port. Ne pas vider les données du site. Un retour à RC15 doit utiliser l’export d’avant migration : l’ancien moteur ne connaît ni le curseur de reprise ni la dette physique ajoutée ici.
