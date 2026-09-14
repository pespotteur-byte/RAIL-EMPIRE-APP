# Rail Empire — Registre RC6R

**84,5 % — 71 dossiers clos sur 84 dossiers connus.**

Date : 11 septembre 2026. Base livrée précédente : RC5 (63/77). Base technique de cette reprise : archive RC6 CHECKPOINT TRAVAIL réellement disponible. RC6R est une nouvelle livraison distincte de la RC6 finale anciennement annoncée sans archive vérifiable.

## Comptage

SC29 est maintenant reproduit et clos. Sept nouveaux dossiers sont ajoutés et clos : SC31, DEP01, MNT01, TIME06, TIME07, ECO10 et ECO11. Ils regroupent les manifestations d’une même cause ; les 40 nouveaux tests ne constituent pas 40 nouveaux bugs.

| État | RC5 | RC6R |
|---|---:|---:|
| Clos, dans le périmètre vérifié | 63 | 71 |
| Partiels | 6 | 6 |
| Ouverts | 7 | 7 |
| À confirmer | 1 | 0 |
| Total connu | 77 | 84 |

71 / 84 = 84,5238 %. Le dénominateur augmente de sept : aucun ancien dossier n’est retiré. Les partiels ne rapportent aucun point. Les performances et l’inventaire TypeScript sont hors de ce taux. Ce chiffre n’est ni une mesure de couverture du code, ni la proportion des bugs inconnus éliminés, ni une estimation du temps restant.

Les 63 clôtures RC5 sont héritées, pas réauditées exhaustivement ligne par ligne. Leurs tests sont conservés et la suite générale a été rejouée sur cette version. « Clos » reste limité aux scénarios et garanties décrits ci-dessous.

## Registre intégral

| ID | Famille | Anomalie | RC5 | RC6R | Preuve / limite |
|---|---|---|---|---|---|
| SC01 | SC / physique | Une restriction V30 locale se propage sur toute la liaison | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC02 | SC / physique | Vmax inconnue héritée à distance illimitée et résolue différemment entre calculateurs | Clos | Clos | La vitesse inconnue reste une convention de simulation, pas une donnée réelle OSM. |
| SC03 | SC / physique | Perte de vitesse par puissance insuffisante en rampe ignorée | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC04 | SC / physique | Hausses de vitesse avant dégagement de la queue | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
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
| SC20 | SC / exploitation | Voie physique exacte remplacée par un nom modifiable au pont SC-runtime | Partiel | Partiel | Libellés mieux protégés en RC2, mais identité canonique way/segment/voie encore à unifier. |
| SC21 | SC / exploitation | Continuité de rame à la gare seulement, permettant un changement de voie sans manœuvre | Ouvert | Ouvert | Trajet de manœuvre et occupation physique inter-voies non refondus. |
| SC22 | SC / exploitation | TAQ/rebroussement ne garantit pas l’exécution d’une manœuvre compatible avec la formation | Ouvert | Ouvert | Réversibilité, changement de cabine et contournement de rame doivent être distingués. |
| SC23 | SC / exploitation | Opération matériel au terminus libère la voie avant sa fin | Clos | Clos | Maintien testé pendant action et échec ; longues absences et toutes les restaurations d’opération restent dans TIME05. |
| SC24 | SC / exploitation | Mode simple ignore les conflits de matériel et affiche à tort PRÊT | Clos | Clos | Contrôle de planification ; toutes les indisponibilités futures dynamiques ne sont pas prévisibles. |
| SC25 | SC / routage | Changement de profil peut conserver une ancienne route sous-optimale | Clos | Clos | Correction RC3 vérifiée |
| SC26 | SC / routage | Revalidation perd des clés de cache de route | Clos | Clos | Correction RC3 vérifiée |
| SC27 | SC / routage | Insertion d’arrêt redistribue les VIA par proximité plutôt que par ordre ferroviaire | Clos | Clos | RC5 : ordre par abscisse sur la liaison ferroviaire résolue, y compris boucle et sens inverse ; origine ajoutée décale les indices. Si l’ancien tracé est absent/ambigu, partition unique conservant les VIA, sans prétendre deviner un passage indéterminé. |
| SC28 | SC / performances | Nombre de cellules physiques peut dépasser le plafond visé sur géométrie dense | Ouvert | Ouvert | RC4 réduit CPU et allocations en conservant toutes les cellules ; le plafond absolu reste ouvert, aucune décimation des contraintes. |
| SC29 | SC / horaires | Service legacy retardé après minuit peut perdre sa date d’exploitation | À confirmer | Clos | 14 tests re-rc6-calendar + 5 tests de réarmement ; jour d’exploitation, minuit, rechargement, absence de doublon. Le test RC5 archivé échoue sur 12 des 14 cas. |
| SC30 | SC / longues routes | Assemblage de très grands tableaux dépasse la limite d’arguments JS (RangeError) | Clos | Clos | RC4 : assemblages de 140 000 segments sans spread d’arguments. Complément RC5 : péages de 150 000–200 000 points calculés sans Math.max(...liste), sans perdre les attributs de la route. |
| LM01 | LiveMap / mouvement | Retour de visibilité reconstruit un train dont le temps avait déjà été simulé | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM02 | LiveMap / mouvement | Catch-up traverse un STOP ou conserve une position en conflit et écrase le motif | Clos | Clos | Pas un replay de tous les obstacles rencontrés sur le chemin : TIME05 reste ouvert. |
| LM03 | LiveMap / mouvement | Blocage durable vers 12 km/h après changement de page, observé par le joueur | Partiel | Partiel | Partiel. Témoin réel Chromium à 1 puis 600 ActiveServices, quatre changements de page ; 600/600 progressent, dont 146 en LOD low. Corridors synthétiques indépendants, pas la sauvegarde utilisateur, ni toutes les contraintes partagées. Aucune certification du blocage durable observé à 12 km/h. |
| LM04 | LiveMap / ressources | Objet d’affectation de quai pris pour une réservation réellement détenue | Clos | Clos | Clôture de ce raccourci logique seulement ; identité physique générale suivie en SC20. |
| LM05 | LiveMap / ressources | Voies alphanumériques remplacées par une voie numérique libre | Clos | Clos | A, 1 bis et V1M préservés ; alias V1/voie 1 et évolution de capacité sans double réservation. |
| LM06 | LiveMap / mouvement | Différences de sécurité et de vitesse entre mouvement complet et macro | Partiel | Partiel | RC1 traite empreinte, panne 80, freinage et cap ; équivalence générale multi-trains pas encore certifiée. |
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
| TIME05 | Temps / replay | Longue absence repositionne sans rejouer tous les arrêts, recettes et contraintes intermédiaires | Partiel | Partiel | Relecture événementielle complète, occupations et opérations après longue absence encore à réaliser. |
| SAVE01 | Sauvegarde | Crash/erreur Worker laisse une promesse en attente et bloque les sauvegardes suivantes | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SAVE02 | Sauvegarde | Échec temporaire IndexedDB interdit une nouvelle tentative pour la session | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO01 | Économie / voyageurs | Voyageurs conservés à bord ne paient que le dernier tronçon | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO02 | Économie / voyageurs | Pénalité voyageurs 25 % débitée deux fois | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO03 | Économie / fret | Deux services peuvent charger le même stock contractuel | Clos | Clos | Cas de contrat interrompu ou expiré en cours de route suivis dans ECO08. |
| ECO04 | Économie / fret | Rame mixte charge un fret compatible puis le refuse à la livraison | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO05 | Économie / fret | Contrats industriels générés vers des destinations sans routabilité vérifiée | Ouvert | Ouvert | Validation réseau encore absente ; ne pas inventer une route entre réseaux isolés. |
| ECO06 | Économie / fret | Affectation d’un contrat sans vérifier l’origine, la destination et leur ordre | Clos | Clos | Correction RC3 vérifiée |
| ECO07 | Économie / fret | Pourcentage de contrat mélange progression du train et quantité livrée | Clos | Clos | Correction RC3 vérifiée |
| ECO08 | Économie / fret | Cycle complet du cargo réservé après annulation/expiration non garanti | Clos | Clos | RC5 : identité de cargaison conservée ; interruption/suppression restitue sans recette au prochain arrêt commercial utilisable ; suppression/fin du service libère les réservations ; sauvegardes legacy/V2 et instantanés V2 en attente réconciliés. La restitution est comptable, pas une simulation d’entrepôts ou de transport routier ; aucune échéance nouvelle inventée. |
| ECO09 | Économie / statistiques | Fret générique alimente les KPI des seuls clients industriels | Clos | Clos | La ligne d’incrément générique des KPI industriels a été retirée en RC1. |
| FEAT01 | Fonctionnalités | Correspondances configurées mais non consultées par les départs et statistiques inertes | Clos | Clos | Attente d’exploitation et compteurs ; pas de modèle individuel d’itinéraires voyageurs. |
| FEAT02 | Fonctionnalités | Améliorations de gare payées mais bonus non appliqués au moteur | Partiel | Partiel | Parking/hall branchés sur la fréquentation. Satisfaction, quais, fret et garage restent à raccorder. |
| FEAT03 | Fonctionnalités | Consommables et propreté du matériel sans toutes les conséquences annoncées | Ouvert | Ouvert | Règles de panne sèche, fluides, adhérence et satisfaction à définir/brancher sans confondre les contraintes. |
| SOC01 | Personnel / social | Satisfaction zéro comptée comme 70 | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SOC02 | Personnel / social | Bonus de négociation payé effacé au recalcul journalier | Clos | Clos | Bonus social additif persistant et sauvegardé ; aucune durée d’expiration nouvelle inventée. |
| RNG01 | Aléatoire | État RNG zéro produit indéfiniment zéro | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| MET01 | Météo | Point météo absent reçoit la météo du centre de caméra distant | Clos | Clos | Repli neutre : ce n’est pas une météo locale observée. |
| DDS01 | Secours | Échec d’envoi de secours marqué envoyé et non réessayé | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS02 | Secours | Tout incident STOP attaché à un train peut envoyer une locomotive de secours | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS03 | Secours | Secours rentre au dépôt sans déplacement physique du train remorqué | Ouvert | Ouvert | Trajet de l’ensemble remorqueur/remorqué non refondu. |
| DDS04 | Secours | Mouvement DDS contourne une partie des contraintes de cantons, travaux et traction | Ouvert | Ouvert | Faire passer le secours par une autorité de mouvement équivalente aux autres services. |
| QA01 | Robustesse | Exceptions de sous-systèmes avalées sans diagnostic opérationnel exploitable | Clos | Clos | Correction RC3 vérifiée |
| QA02 | Robustesse | Caches de zones ORM/stations sans éviction bornée sur très longue exploration | Clos | Clos | Correction RC3 vérifiée |
| QA03 | Robustesse | Noms non échappés dans certaines interpolations HTML | Partiel | Partiel | RC2 échappe le module correspondances, pas toutes les vues historiques. |
| SC31 | SC / horaires | Service legacy terminé non réarmé ou réutilisant un état de la veille | Non suivi | Clos | 14 tests calendrier + 5 réinitialisation. État de circulation/ITE/freinage et identité aller remis à zéro ; panne et maintenance réelles conservées. Matériel ailleurs non téléporté. |
| DEP01 | Dépôts / ressources | Admission refusée libère la voie d’origine ; départ depuis un mauvais dépôt modifie les états | Non suivi | Clos | 5 tests dépôt. Vérification de la place avant toute mutation, entrée répétée idempotente, refus sans libération ni modification des drapeaux. |
| MNT01 | Matériel / maintenance | Service préparé rétablit d’anciens compteurs et annule une maintenance | Non suivi | Clos | 6 tests kilométrage + vrai snapshot du jeu dans Chromium. Rame canonique, miroirs de service synchronisés, usure incrémentale conservant les réductions atelier ; distance totale non effacée. |
| TIME06 | Temps / manœuvres | Un grand delta gonfle la durée d’une opération au-delà de sa fin | Non suivi | Clos | 5 tests de manœuvres : phases successives, dépassement, fractionnement, rechargement et plusieurs opérations. Ne réalise pas un replay complet du réseau. |
| TIME07 | Temps / import | Dates civiles impossibles et horodatages hors domaine contaminent le registre temporel | Non suivi | Clos | 6 tests horloge. Rejet des dates impossibles et timestamps non représentables ; registre de tâches protégé ; 365 journées traitées en lots de 31 sans perte. Le règlement reste basé sur l’état disponible (TIME05 non clos). |
| ECO10 | Économie / banque | Éligibilité différente entre UI et moteur ; initialisation du plafond perdue au rechargement | Non suivi | Clos | Tests BANK01–06 + clic réel Chromium. Principal hors intérêts, même règle aux trois points, plafond prévisualisé sans mutation, limite de contrats et null de sauvegarde préservés. |
| ECO11 | Économie / banque | Dernière échéance peut supprimer un emprunt importé sans payer tout son reliquat | Non suivi | Clos | Tests BANK07–08. Paiement du solde final et maintien de l’idempotence après sauvegarde. Aucune réécriture des conditions de crédit existantes. |

## Chantiers non clos

Les treize dossiers restants sont : SC20, SC21, SC22, SC28, LM03, LM06, TIME05, ECO05, FEAT02, FEAT03, DDS03, DDS04, QA03. Ils sont conservés dans le tableau et dans REGISTRE.json.

Le prochain travail de fond reste la cohérence voie physique–manœuvre–rame, le secours/remorquage, le replay des longues absences et les effets gameplay des consommables/améliorations de gare. Les tests synthétiques ne remplacent pas la partie réelle de PE.
