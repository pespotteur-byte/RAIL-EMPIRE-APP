# Rail Empire — Registre RC16 FULL

**84 dossiers historiques clos sur 87 (96,6 %), deux partiels et un ouvert.** RC16 corrige une cause de voisin fantôme et intègre le curseur de reprise chronologique ; aucune clôture supplémentaire complète n’est comptabilisée.

## Optimisations RC14 conservées — résultats historiques, non remesurés ici

| Sujet | État vérifié / limite |
|---|---|
| Partage des colonnes SC8P1 | Exact et indépendant à la restauration ; ×1 à ×106,02 face à RC13 sur 7 scénarios synthétiques |
| Références de gares | Candidats de partage JSON exact, aucune modification des identités |
| Données administrateur | Quatre ensembles compressés, transaction avant retrait local, UI après commit ; incompatibilité ancienne page admin signalée |
| Édition LIGHT historique | RC14 uniquement ; RC15 est livrée exclusivement en FULL |
| Serveur de fichiers précompressés | Node exécuté/testé ; C# Windows non compilé/exécuté ici |
| Quota / disque réel de PE | Non mesuré ; aucun ×100 universel annoncé |

## Stockage RC13 — acquis conservés (hors pourcentage historique)

| Sujet | État vérifié ou limite |
|---|---|
| Compression des sauvegardes volumineuses/faible mémoire | Implémentée ; aller-retour exact, absence de copie Worker sur le chemin volumineux |
| Déduplication des géométries identiques | Exacte par JSON ; copies indépendantes au rechargement ; pas de fusion de tracés seulement proches |
| Caches existants et nouveaux | Compression disque, lecture mixte ancienne/nouvelle, remplacement conditionnel un par un ; données non JSON laissées intactes |
| Échec de quota et migration locale | Source conservée avant validation ; repli récent et statistiques prioritaires ; tests d’échec de transaction |
| Mesure avant/après et panneau | Interface, téléchargement du bilan et largeurs 768/375 testés ; estimations du navigateur distinctes des tailles du contenu |
| Objectif physique ×100 sur la partie de PE | **Non certifié** : aucune partie personnelle ni mesure de disque natif disponible ; gains dépendants des données |

## Suivi du signalement OSM/ORM — hors pourcentage historique

| Sujet | État | Preuve ou limite |
|---|---|---|
| Refus lisible, temporisation et limites partagées | Corrigé côté client sur les scénarios testés | 28 tests réseau/cache/projection, dont OSM et ORM ; pas de contournement |
| Requêtes hors champ, annulations, cache de source et de style | Corrigé sur le périmètre testé | Comparaison réelle RC8/RC9, tests et buffers parent |
| Diagnostic, configuration autorisée et attribution | Implémenté et testé dans le DOM isolé | Captures à 768 × 1 024 ; résumé accessible et lien de licence cliquable |
| Lancement HTTP local | Partiel côté plateformes | Node testé sous Linux ; PowerShell/C# non compilé/exécuté ici, Win7/Opera à valider |
| Cause exacte de la 403 de l’utilisateur et levée côté fournisseur | À confirmer | Réponse HTTP réelle de son navigateur non disponible ; aucune promesse de déblocage |

## Registre historique conservé

| ID | Famille | Anomalie | RC15 | RC16 | Preuve ou limite |
|---|---|---|---|---|---|
| SC01 | SC / physique | Une restriction V30 locale se propage sur toute la liaison | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC02 | SC / physique | Vmax inconnue héritée à distance illimitée et résolue différemment entre calculateurs | Clos | Clos | La vitesse inconnue reste une convention de simulation, pas une donnée réelle OSM. |
| SC03 | SC / physique | Perte de vitesse par puissance insuffisante en rampe ignorée | Clos | Clos | RC7 complète la correction du calculateur théorique par celle du mouvement réel : accélération nette négative conservée en rampe et résistance sans puissance. Tests RC7-PHYS full/macro. Pas de nouvelle clôture comptabilisée pour cette même famille physique. |
| SC04 | SC / physique | Hausses de vitesse avant dégagement de la queue | Clos | Clos | RC7 ajoute la protection de la queue dans le mouvement macro et à travers les changements de liaison ; état sauvegardé en legacy/V2 et restauré sur rollback. Les anciens snapshots sans champ restent lisibles, sans reconstitution rétroactive garantie de toutes leurs restrictions passées. |
| SC05 | SC / physique | Discontinuité temporelle entre très courtes liaisons | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC06 | SC / physique | Validation d’une marche avec composition sans puissance | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC07 | SC / physique | Perte des contraintes, dépendance au seuil 12000 points et au rechargement | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC08 | SC / physique | Puissance électrique désactivée sur tout le parcours pour une courte section thermique | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC09 | SC / physique | Écartement inconnu court-circuite les contrôles de gabarit et charge | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC10 | SC / physique | Objet météo mal interprété selon le chemin de calcul | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC11 | SC / physique | Météo réelle/caméra modifie la grille théorique contrairement au runtime | Clos | Clos | Conditions théoriques de référence, pas prévision météo pour le futur horaire. |
| SC12 | SC / physique | Délai de mise en action du frein absent de la clé de cache | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC13 | SC / physique | Cache mutable partagé entre profil éditorial et profil runtime | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC14 | SC / physique | Durée d’aperçu oublie les arrêts et contredit l’arrivée affichée | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC15 | SC / horaires | Arrivée exactement à minuit remplacée par l’heure de départ | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC16 | SC / horaires | Retour legacy additionne les arrêts aux temps de marche et décale son premier départ | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC17 | SC / horaires | Auto-24h refuse ou fausse une liaison passant minuit | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC18 | SC / synchronisation | Horaire/version modifiés, supprimés ou invalidés laissent un ancien service préparé | Clos | Clos | Les services déjà partis conservent intentionnellement leur plan courant. |
| SC19 | SC / exploitation | Point technique traité comme gare commerciale et identité technique perdue | Clos | Clos | Ne signifie pas une certification de toutes les occupations de points techniques. |
| SC20 | SC / exploitation | Voie physique exacte remplacée par un nom modifiable au pont SC-runtime | Clos | Clos | RC8 : identité native/OSM séparée du nom affiché, propagée depuis TrackBinding vers les arrêts compilés, la réservation et le snapshot. Conflits après renommage, voies distinctes homonymes, alias de référence réelle, priorité du train de tête, restauration et libération sous la queue vérifiés. 35 tests ciblés + essai bundle Chromium. Les anciens bindings sans aucun identifiant physique restent en compatibilité exacte par libellé : aucune identité n’est inventée. |
| SC21 | SC / exploitation | Continuité de rame à la gare seulement, permettant un changement de voie sans manœuvre | Clos | Clos | RC11 : identité de voie conservée dans la rame, les véhicules détachés, les arrêts et les snapshots ; garde commune à l’origine et au retour. Refus d’un départ depuis une autre voie et retrait du changement pair/impair automatique. Un HLP explicite A/voie 1 → jonction → A/voie 2 parcourt réellement son itinéraire avant de rendre le matériel disponible. 17 tests. Pas de génération automatique d’un plan de manœuvres complet. |
| SC22 | SC / exploitation | TAQ/rebroussement ne garantit pas l’exécution d’une manœuvre compatible avec la formation | Clos | Clos | RC11 : TAQ conservé à la compilation/duplication ; 300 s réelles de changement de cabine, formation compatible, contrôle du tracé sous la rame et occupation maintenue. Changement de référence vers l’ancienne queue, sans déplacement de la rame ni kilométrage fictif. Composition non réversible retenue : une temporisation ne simule plus une remise en tête. 21 tests, dont sauvegarde et absence de rame. Pas de contournement automatique de locomotive ni de certification des télécommandes constructeur. |
| SC23 | SC / exploitation | Opération matériel au terminus libère la voie avant sa fin | Clos | Clos | Maintien testé pendant action et échec ; longues absences et toutes les restaurations d’opération restent dans TIME05. |
| SC24 | SC / exploitation | Mode simple ignore les conflits de matériel et affiche à tort PRÊT | Clos | Clos | Contrôle de planification ; toutes les indisponibilités futures dynamiques ne sont pas prévisibles. |
| SC25 | SC / routage | Changement de profil peut conserver une ancienne route sous-optimale | Clos | Clos | Correction RC3 vérifiée |
| SC26 | SC / routage | Revalidation perd des clés de cache de route | Clos | Clos | Correction RC3 vérifiée |
| SC27 | SC / routage | Insertion d’arrêt redistribue les VIA par proximité plutôt que par ordre ferroviaire | Clos | Clos | RC5 : ordre par abscisse sur la liaison ferroviaire résolue, y compris boucle et sens inverse ; origine ajoutée décale les indices. Si l’ancien tracé est absent/ambigu, partition unique conservant les VIA, sans prétendre deviner un passage indéterminé. |
| SC28 | SC / performances | Nombre de cellules physiques peut dépasser le plafond visé sur géométrie dense | Clos | Clos | RC11 : exécution par fenêtres de 20 000 cellules résidentes au maximum, sans décimer la géométrie ni les contraintes. Le calcul peut toujours évaluer 150 000 ou 1 000 000 cellules au total ; la borne concerne leur stockage simultané, pas le travail total. Métadonnées/source/sorties non bornées par cette limite. 12 tests, dont 700 profils aléatoires strictement égaux à RC10, et mesures mémoire/CPU. Les grands profils testés coûtent plus de CPU : voir PHYSICS_BENCHMARK.json. |
| SC29 | SC / horaires | Service legacy retardé après minuit peut perdre sa date d’exploitation | Clos | Clos | 14 tests re-rc6-calendar + 5 tests de réarmement ; jour d’exploitation, minuit, rechargement, absence de doublon. Le test RC5 archivé échoue sur 12 des 14 cas. |
| SC30 | SC / longues routes | Assemblage de très grands tableaux dépasse la limite d’arguments JS (RangeError) | Clos | Clos | RC4 : assemblages de 140 000 segments sans spread d’arguments. Complément RC5 : péages de 150 000–200 000 points calculés sans Math.max(...liste), sans perdre les attributs de la route. |
| LM01 | LiveMap / mouvement | Retour de visibilité reconstruit un train dont le temps avait déjà été simulé | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM02 | LiveMap / mouvement | Catch-up traverse un STOP ou conserve une position en conflit et écrase le motif | Clos | Clos | Pas un replay de tous les obstacles rencontrés sur le chemin : TIME05 reste ouvert. |
| LM03 | LiveMap / mouvement | Blocage durable vers 12 km/h après changement de page, observé par le joueur | Partiel | Partiel | RC16 : cause de cache fantôme reproduite puis corrigée (sept anciens échecs) ; index lié aux objets de la flotte courante. Cas personnel vers 12 km/h non identifié de façon certaine. |
| LM04 | LiveMap / ressources | Objet d’affectation de quai pris pour une réservation réellement détenue | Clos | Clos | Clôture de ce raccourci logique seulement ; identité physique générale suivie en SC20. |
| LM05 | LiveMap / ressources | Voies alphanumériques remplacées par une voie numérique libre | Clos | Clos | Complément RC7 dans VoiePointManager : A, 1 bis, V1M indisponibles ne deviennent plus une voie libre différente ; point appartenant à une autre gare refusé ; alias V1/voie 1 et choix automatique sans préférence conservés. Le pont d’identité SC20 est complété en RC8 pour les bindings dotés d’un identifiant physique. |
| LM06 | LiveMap / mouvement | Différences de sécurité et de vitesse entre mouvement complet et macro | Clos | Clos | RC10 : moveMacro délègue au contrôleur complet ; suppression de la logique dupliquée, conservation et consommation unique du temps accumulé lors des promotions/démotions LOD. 13 nouveaux tests : huit scénarios full/macro à pas identique, fin de liaison, deux contrôles du vrai moveTick, deux essais de 360 s avec deux frets de 750 m sur une voie partagée. La cadence grossière reste différente ; aucune équivalence numérique universelle ni clôture LM03/TIME05 déduite. RC12 : détection IPCS sur la flotte sans index, position longitudinale, identité au lieu du conflit, tangente après courbe et minimum de toutes les contraintes ; 16 essais, dont freinage de deux frets de 750 m en full/macro. Pas de nouvelle clôture comptée. |
| LM07 | LiveMap / ressources | Train blocked_route physiquement présent considéré disparu par le cantonnement | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM08 | LiveMap / maintenance | Train en maintenance continue de rouler, ou réparation remet un train en ligne en waiting | Clos | Clos | Remorquage DDS physique séparé en DDS03. |
| LM09 | LiveMap / maintenance | Dépôt d’attache inscrit comme présence physique lors d’un arrêt en ligne | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM10 | LiveMap / informations | Charge du panneau figée ou remplissage inventé quand l’information manque | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM11 | LiveMap / informations | Arrondis de retard incohérents entre carte, liste et panneau | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM12 | LiveMap / informations | Quai de la gare précédente affiché comme voie courante | Clos | Clos | Information exacte dépendante des données de voie disponibles. |
| LM13 | LiveMap / informations | Tracé sélectionné ignore la route réellement déviée | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM14 | LiveMap / 3D | Quota de 64 marqueurs rempli avant filtrage de visibilité | Clos | Clos | Une longue session GPU réelle n’est pas remplacée par ces contrôles. |
| LM15 | LiveMap / informations | Distance au prochain arrêt estimée à vol d’oiseau malgré les courbes ferroviaires | Clos | Clos | Correction RC3 vérifiée |
| LM16 | LiveMap / coordonnées | Coordonnées zéro confondues avec des valeurs manquantes dans certaines vues | Clos | Clos | RC5 : les derniers replis snapLat/snapLon |
| LM17 | LiveMap / performances | Travail de rendu inutile après fermeture ou pour des objets hors écran | Clos | Clos | RC4 : secours hors écran sans redessin forcé, objets fixes/secours filtrés avant rendu ; nettoyage marquee RC1 conservé. Périmètre des chemins identifiés et testés, pas tout le budget GPU. |
| TIME01 | Temps / économie | Traitements quotidiens sautés à minuit ou facturés deux fois au rechargement | Clos | Clos | Rattrapage basé sur l’état disponible, pas une reconstruction historique de toute la société. |
| TIME02 | Temps / durées | Incidents, réparations et manœuvres ne reçoivent qu’une minute après une longue suspension | Clos | Clos | Ce rattrapage de durée n’est pas le replay ferroviaire complet TIME05. |
| TIME03 | Temps / personnel | Congés, formations et absences ne rattrapent pas plusieurs journées | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| TIME04 | Temps / fret | Génération fret dépend de HH:00 exact et cadence instable à minuit/reload | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| TIME05 | Temps / replay | Longue absence repositionne sans rejouer tous les arrêts, recettes et contraintes intermédiaires | Partiel | Partiel | RC16 : curseur physique persistant, événements intercalés, dette LOD sauvegardée, snapshots datés du temps simulé, reprise bornée visible ; 48 h de callbacks et reprise du vrai jeu contrôlées. Toutes les interactions/absences longues du réseau et données anciennes restent à qualifier. |
| SAVE01 | Sauvegarde | Crash/erreur Worker laisse une promesse en attente et bloque les sauvegardes suivantes | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SAVE02 | Sauvegarde | Échec temporaire IndexedDB interdit une nouvelle tentative pour la session | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO01 | Économie / voyageurs | Voyageurs conservés à bord ne paient que le dernier tronçon | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO02 | Économie / voyageurs | Pénalité voyageurs 25 % débitée deux fois | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO03 | Économie / fret | Deux services peuvent charger le même stock contractuel | Clos | Clos | Cas de contrat interrompu ou expiré en cours de route suivis dans ECO08. |
| ECO04 | Économie / fret | Rame mixte charge un fret compatible puis le refuse à la livraison | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO05 | Économie / fret | Contrats industriels générés vers des destinations sans routabilité vérifiée | Clos | Clos | RC10 : offres limitées à une destination atteignable dans le graphe ferroviaire dirigé connu localement (voies valides et versions V2 VALID à jour, retours explicites). Aucun raccord par proximité, aucun appel HTTP. 25 tests, dont invalidation, réseau isolé, cycles, 15 000 sommets et terminal fret. Une liaison inconnue suspend l'offre, sans déclarer le trajet impossible dans le réseau réel. Compatibilité de la rame et disponibilité d'un sillon restent vérifiées séparément. |
| ECO06 | Économie / fret | Affectation d’un contrat sans vérifier l’origine, la destination et leur ordre | Clos | Clos | Correction RC3 vérifiée |
| ECO07 | Économie / fret | Pourcentage de contrat mélange progression du train et quantité livrée | Clos | Clos | Correction RC3 vérifiée |
| ECO08 | Économie / fret | Cycle complet du cargo réservé après annulation/expiration non garanti | Clos | Clos | RC5 : identité de cargaison conservée ; interruption/suppression restitue sans recette au prochain arrêt commercial utilisable ; suppression/fin du service libère les réservations ; sauvegardes legacy/V2 et instantanés V2 en attente réconciliés. La restitution est comptable, pas une simulation d’entrepôts ou de transport routier ; aucune échéance nouvelle inventée. |
| ECO09 | Économie / statistiques | Fret générique alimente les KPI des seuls clients industriels | Clos | Clos | La ligne d’incrément générique des KPI industriels a été retirée en RC1. |
| FEAT01 | Fonctionnalités | Correspondances configurées mais non consultées par les départs et statistiques inertes | Clos | Clos | Attente d’exploitation et compteurs ; pas de modèle individuel d’itinéraires voyageurs. |
| FEAT02 | Fonctionnalités | Améliorations de gare payées mais bonus non appliqués au moteur | Clos | Clos | RC10 : capacité de quais réellement allouable, garage relié au gestionnaire de dépôts, terminal fret consulté au chargement/déchargement, satisfaction issue des voyageurs réellement descendus. 16 tests et achats dans Chromium. Rechargements sans multiplication ni effacement d'occupation. Garage = capacité logique au point-gare, pas création de géométrie OSM ni exécution de manœuvre (RC11 bloque les transferts implicites ; les manœuvres automatiques générales restent hors périmètre). |
| FEAT03 | Fonctionnalités | Consommables et propreté du matériel sans toutes les conséquences annoncées | Clos | Clos | RC10 : épuisement des ressources déclarées agit sur la puissance, le départ et le freinage jusqu'à l'arrêt ; sable, lave-glace, AdBlue et propreté ont des effets séparés. Bimode sous tension compatible, diesel-électrique, rame mixte, ravitaillement réel au dépôt, sauvegarde et données anciennes testés (24 nouveaux cas). Règles de jeu explicites, pas spécifications constructeur ; aucun équipement inventé pour les anciennes capacités nulles. Le secours/remorquage physique reste DDS03/DDS04. |
| SOC01 | Personnel / social | Satisfaction zéro comptée comme 70 | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SOC02 | Personnel / social | Bonus de négociation payé effacé au recalcul journalier | Clos | Clos | Bonus social additif persistant et sauvegardé ; aucune durée d’expiration nouvelle inventée. |
| RNG01 | Aléatoire | État RNG zéro produit indéfiniment zéro | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| MET01 | Météo | Point météo absent reçoit la météo du centre de caméra distant | Clos | Clos | Repli neutre : ce n’est pas une météo locale observée. |
| DDS01 | Secours | Échec d’envoi de secours marqué envoyé et non réessayé | Clos | Clos | RC12 complète les protections : dédoublonnage de mission et au chargement, exception de fournisseur synchrone contenue, réponse ancienne ignorée, cible déplacée retracée, géométrie complète refusée si invalide, temporisation réelle et refus lisible persistants. 30 essais. Ne remplace ni le déplacement physique DDS03, ni l’autorité complète DDS04. |
| DDS02 | Secours | Tout incident STOP attaché à un train peut envoyer une locomotive de secours | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS03 | Secours | Secours rentre au dépôt sans déplacement physique du train remorqué | Clos | Clos | RC15 : train pris en charge et déplacé sur le retour, traction propre neutralisée, réception avant clôture, dépôt plein retenu, annulation sans respawn, identités et odomètres conservés, stationnement des formations V2 sans duplication. 28 tests supplémentaires, cycle complet et vrais snapshots/compilations V2 ; boucle principale et DOM Chromium. Point de référence commun, pas attelages indépendants ni autorité ferroviaire complète : DDS04 reste ouvert. |
| DDS04 | Secours | Mouvement DDS contourne une partie des contraintes de cantons, travaux et traction | Ouvert | Ouvert | Toujours ouvert : le moteur de déplacement DDS reste distinct des ActiveService et ne reprend pas toutes leurs contraintes de cantons, travaux et traction. RC12 sécurise l’acquisition/restauration du tracé, pas le contrôle complet de la circulation du secours. |
| QA01 | Robustesse | Exceptions de sous-systèmes avalées sans diagnostic opérationnel exploitable | Clos | Clos | Correction RC3 vérifiée |
| QA02 | Robustesse | Caches de zones ORM/stations sans éviction bornée sur très longue exploration | Clos | Clos | Correction RC3 vérifiée |
| QA03 | Robustesse | Noms non échappés dans certaines interpolations HTML | Clos | Clos | RC11 : échappement aux frontières HTML/attributs et arguments des anciens boutons, sans modifier les noms stockés. Revue de 25 modules d’interface ; 21 tests ciblés, 13 vues dans le vrai DOM Chromium et clics conservant les identifiants spéciaux. Reproduction RC10/RC11 dans l’AFL départ. Clôture du défaut d’affichage des noms, pas certification de sécurité générale des URL, CSS, extensions ou contenus importés. |
| SC31 | SC / horaires | Service legacy terminé non réarmé ou réutilisant un état de la veille | Clos | Clos | 14 tests calendrier + 5 réinitialisation. État de circulation/ITE/freinage et identité aller remis à zéro ; panne et maintenance réelles conservées. Matériel ailleurs non téléporté. |
| DEP01 | Dépôts / ressources | Admission refusée libère la voie d’origine ; départ depuis un mauvais dépôt modifie les états | Clos | Clos | 5 tests dépôt. Vérification de la place avant toute mutation, entrée répétée idempotente, refus sans libération ni modification des drapeaux. |
| MNT01 | Matériel / maintenance | Service préparé rétablit d’anciens compteurs et annule une maintenance | Clos | Clos | 6 tests kilométrage + vrai snapshot du jeu dans Chromium. Rame canonique, miroirs de service synchronisés, usure incrémentale conservant les réductions atelier ; distance totale non effacée. |
| TIME06 | Temps / manœuvres | Un grand delta gonfle la durée d’une opération au-delà de sa fin | Clos | Clos | 5 tests de manœuvres : phases successives, dépassement, fractionnement, rechargement et plusieurs opérations. Ne réalise pas un replay complet du réseau. |
| TIME07 | Temps / import | Dates civiles impossibles et horodatages hors domaine contaminent le registre temporel | Clos | Clos | 6 tests horloge. Rejet des dates impossibles et timestamps non représentables ; registre de tâches protégé ; 365 journées traitées en lots de 31 sans perte. Le règlement reste basé sur l’état disponible (TIME05 non clos). |
| ECO10 | Économie / banque | Éligibilité différente entre UI et moteur ; initialisation du plafond perdue au rechargement | Clos | Clos | Tests BANK01–06 + clic réel Chromium. Principal hors intérêts, même règle aux trois points, plafond prévisualisé sans mutation, limite de contrats et null de sauvegarde préservés. |
| ECO11 | Économie / banque | Dernière échéance peut supprimer un emprunt importé sans payer tout son reliquat | Clos | Clos | Tests BANK07–08. Paiement du solde final et maintien de l’idempotence après sauvegarde. Aucune réécriture des conditions de crédit existantes. |
| LM18 | LiveMap / passages | Freinage jusqu’à l’arrêt imposé aux passages et points de voie sans arrêt commercial | Clos | Clos | Tests RC7-PASS full/macro : franchissement direct, arrêt réel conservé, anticipation de la limitation/du prochain arrêt, route manquante ou discontinue bloquée, occupation et restrictions de queue conservées. Essai navigateur d’un passage à 30 km/h. Ne certifie pas tout le replay hors ligne. |
| LM19 | LiveMap / changement de liaison | Ancienne clé de route conserve le train dans un groupe LOD bas après un changement de liaison | Clos | Clos | Tests réels moveTick à 1 et 601 services (pool factice pour les autres), remise à zéro de clé et reconstitution de la bonne liaison. Chromium : deux observations successives après le passage montrent distance croissante, vitesse 30, LOD high ; pas d’attente du cycle macro de 3 secondes. Différent du blocage durable LM03. |
| ECO12 | Économie / trajet retour | Distance et métadonnées facturées du retour indépendant prises sur l’itinéraire aller | Clos | Clos | Test RC7-ECO-return sur une route aller de 1 km et un retour distinct de plus de 20 km : le callback économique reçoit les vrais kilomètres/points du retour. Aucun tarif n’est modifié. |


## Preuves RC15

Voir `RE_REPARATION_RC15_RAPPORT.md` et `QA/RE_REPAIR_RC15/SUMMARY.json`. Les anciennes clôtures restent historiques. LM03, TIME05, DDS04 et le refus OSM ne sont pas déclarés résolus.

## Preuves RC16

Voir `RE_REPARATION_RC16_RAPPORT.md` et `QA/RE_REPAIR_RC16/SUMMARY.json`. Les clôtures précédentes restent historiques ; les trois dossiers restants et la 403 ne sont pas déclarés résolus.
