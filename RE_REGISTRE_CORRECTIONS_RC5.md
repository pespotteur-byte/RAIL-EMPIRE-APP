# Rail Empire — Registre des corrections RC5

**81,8 % — 63 dossiers gameplay clos sur 77 dossiers suivis.**

Date : 11 septembre 2026. Base : la RC4 livrée. Les clôtures héritées ne sont pas réauditées exhaustivement dans cette passe ; leurs suites de non-régression sont conservées.

## Calcul et périmètre

RC4 : 60/77 (77,9 %). RC5 clôt **SC27, LM16 et ECO08**, soit **63/77 = 81,818 %**. Aucun dossier n’est retiré ; les partiels ne rapportent aucun point. L’optimisation caténaire et le complément péages du dossier SC30 ne créent aucun point artificiel.

| État | RC4 | RC5 |
|---|---:|---:|
| Clos dans le périmètre vérifié | 60 | 63 |
| Partiel | 8 | 6 |
| Ouvert | 7 | 7 |
| À confirmer | 2 | 1 |
| Total | 77 | 77 |

Ce pourcentage mesure les dossiers connus, pas une proportion de code garanti correct, un nombre de bugs inconnus, un gain de FPS ou le temps de travail restant.

## Clôtures de cette passe

**SC27 — VIA et insertion.** Reproduction en U dans les deux sens et exécution du vrai chemin de validation du point cliqué. Les ancrages et leur ordre sont conservés ; les VIA des liaisons suivantes sont décalés. Ajouter une nouvelle origine décale aussi toutes les anciennes liaisons. Une géométrie absente ou ambiguë ne permet pas d’inférer avec certitude le passage choisi : le repli maintient l’ordre sans disperser les VIA.

**LM16 — Coordonnées zéro dans les vues identifiées.** La longitude ou latitude 0 ne déclenche plus le repli sur la coordonnée d’origine. Les marqueurs, le centrage et la sélection des VIA utilisent le même validateur de position. Les données absentes/invalides ne créent pas une fausse position à 0/0. Les contrôles géographiques réparés précédemment sont conservés.

**ECO08 — Cargaison interrompue.** Annulation, suppression, client devenu inactif, réaffectation, fin/suppression du service et F5 sont testés. L’identifiant du cargo ne change pas lorsque l’affectation change. Les réservations des instantanés V2 en attente sont maintenues, celles des services disparus libérées. Une restitution n’est jamais une livraison payée.

## Registre complet

| ID | Famille | Anomalie | RC1 | RC2 | RC3 | RC4 | RC5 | Suite / limite |
|---|---|---|---|---|---|---|---|---|
| SC01 | SC / physique | Une restriction V30 locale se propage sur toute la liaison | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC02 | SC / physique | Vmax inconnue héritée à distance illimitée et résolue différemment entre calculateurs | Clos | Clos | Clos | Clos | Clos | La vitesse inconnue reste une convention de simulation, pas une donnée réelle OSM. |
| SC03 | SC / physique | Perte de vitesse par puissance insuffisante en rampe ignorée | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC04 | SC / physique | Hausses de vitesse avant dégagement de la queue | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC05 | SC / physique | Discontinuité temporelle entre très courtes liaisons | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC06 | SC / physique | Validation d’une marche avec composition sans puissance | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC07 | SC / physique | Perte des contraintes, dépendance au seuil 12000 points et au rechargement | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC08 | SC / physique | Puissance électrique désactivée sur tout le parcours pour une courte section thermique | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC09 | SC / physique | Écartement inconnu court-circuite les contrôles de gabarit et charge | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC10 | SC / physique | Objet météo mal interprété selon le chemin de calcul | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC11 | SC / physique | Météo réelle/caméra modifie la grille théorique contrairement au runtime | Clos | Clos | Clos | Clos | Clos | Conditions théoriques de référence, pas prévision météo pour le futur horaire. |
| SC12 | SC / physique | Délai de mise en action du frein absent de la clé de cache | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC13 | SC / physique | Cache mutable partagé entre profil éditorial et profil runtime | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC14 | SC / physique | Durée d’aperçu oublie les arrêts et contredit l’arrivée affichée | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC15 | SC / horaires | Arrivée exactement à minuit remplacée par l’heure de départ | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC16 | SC / horaires | Retour legacy additionne les arrêts aux temps de marche et décale son premier départ | Ouvert | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC17 | SC / horaires | Auto-24h refuse ou fausse une liaison passant minuit | Ouvert | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC18 | SC / synchronisation | Horaire/version modifiés, supprimés ou invalidés laissent un ancien service préparé | Clos | Clos | Clos | Clos | Clos | Les services déjà partis conservent intentionnellement leur plan courant. |
| SC19 | SC / exploitation | Point technique traité comme gare commerciale et identité technique perdue | Clos | Clos | Clos | Clos | Clos | Ne signifie pas une certification de toutes les occupations de points techniques. |
| SC20 | SC / exploitation | Voie physique exacte remplacée par un nom modifiable au pont SC-runtime | Partiel | Partiel | Partiel | Partiel | Partiel | Libellés mieux protégés en RC2, mais identité canonique way/segment/voie encore à unifier. |
| SC21 | SC / exploitation | Continuité de rame à la gare seulement, permettant un changement de voie sans manœuvre | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | Trajet de manœuvre et occupation physique inter-voies non refondus. |
| SC22 | SC / exploitation | TAQ/rebroussement ne garantit pas l’exécution d’une manœuvre compatible avec la formation | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | Réversibilité, changement de cabine et contournement de rame doivent être distingués. |
| SC23 | SC / exploitation | Opération matériel au terminus libère la voie avant sa fin | Ouvert | Clos | Clos | Clos | Clos | Maintien testé pendant action et échec ; longues absences et toutes les restaurations d’opération restent dans TIME05. |
| SC24 | SC / exploitation | Mode simple ignore les conflits de matériel et affiche à tort PRÊT | Ouvert | Clos | Clos | Clos | Clos | Contrôle de planification ; toutes les indisponibilités futures dynamiques ne sont pas prévisibles. |
| SC25 | SC / routage | Changement de profil peut conserver une ancienne route sous-optimale | Ouvert | Ouvert | Clos | Clos | Clos | Correction RC3 vérifiée |
| SC26 | SC / routage | Revalidation perd des clés de cache de route | Ouvert | Ouvert | Clos | Clos | Clos | Correction RC3 vérifiée |
| SC27 | SC / routage | Insertion d’arrêt redistribue les VIA par proximité plutôt que par ordre ferroviaire | À confirmer | À confirmer | À confirmer | À confirmer | Clos | RC5 : ordre par abscisse sur la liaison ferroviaire résolue, y compris boucle et sens inverse ; origine ajoutée décale les indices. Si l’ancien tracé est absent/ambigu, partition unique conservant les VIA, sans prétendre deviner un passage indéterminé. |
| SC28 | SC / performances | Nombre de cellules physiques peut dépasser le plafond visé sur géométrie dense | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | RC4 réduit CPU et allocations en conservant toutes les cellules ; le plafond absolu reste ouvert, aucune décimation des contraintes. |
| SC29 | SC / horaires | Service legacy retardé après minuit peut perdre sa date d’exploitation | À confirmer | À confirmer | À confirmer | À confirmer | À confirmer | Cas legacy calendrier à reproduire ; ne pas confondre avec les occurrences datées V2. |
| SC30 | SC / longues routes | Assemblage de très grands tableaux dépasse la limite d’arguments JS (RangeError) | Non suivi | Non suivi | Non suivi | Clos | Clos | RC4 : assemblages de 140 000 segments sans spread d’arguments. Complément RC5 : péages de 150 000–200 000 points calculés sans Math.max(...liste), sans perdre les attributs de la route. |
| LM01 | LiveMap / mouvement | Retour de visibilité reconstruit un train dont le temps avait déjà été simulé | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM02 | LiveMap / mouvement | Catch-up traverse un STOP ou conserve une position en conflit et écrase le motif | Clos | Clos | Clos | Clos | Clos | Pas un replay de tous les obstacles rencontrés sur le chemin : TIME05 reste ouvert. |
| LM03 | LiveMap / mouvement | Blocage durable vers 12 km/h après changement de page, observé par le joueur | Partiel | Partiel | Partiel | Partiel | Partiel | Partiel : cas exact du blocage durable à 12 km/h sur le PC utilisateur non reproduit. Essai RC5 à un train réel, pages map→staff→incidents→map : il continue à avancer et passe de 80,47 à 83,84 km/h ; ce témoin ne certifie ni toutes les flottes ni tous les retours d’onglet. |
| LM04 | LiveMap / ressources | Objet d’affectation de quai pris pour une réservation réellement détenue | Partiel | Clos | Clos | Clos | Clos | Clôture de ce raccourci logique seulement ; identité physique générale suivie en SC20. |
| LM05 | LiveMap / ressources | Voies alphanumériques remplacées par une voie numérique libre | Ouvert | Clos | Clos | Clos | Clos | A, 1 bis et V1M préservés ; alias V1/voie 1 et évolution de capacité sans double réservation. |
| LM06 | LiveMap / mouvement | Différences de sécurité et de vitesse entre mouvement complet et macro | Partiel | Partiel | Partiel | Partiel | Partiel | RC1 traite empreinte, panne 80, freinage et cap ; équivalence générale multi-trains pas encore certifiée. |
| LM07 | LiveMap / ressources | Train blocked_route physiquement présent considéré disparu par le cantonnement | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM08 | LiveMap / maintenance | Train en maintenance continue de rouler, ou réparation remet un train en ligne en waiting | Clos | Clos | Clos | Clos | Clos | Remorquage DDS physique séparé en DDS03. |
| LM09 | LiveMap / maintenance | Dépôt d’attache inscrit comme présence physique lors d’un arrêt en ligne | Ouvert | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM10 | LiveMap / informations | Charge du panneau figée ou remplissage inventé quand l’information manque | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM11 | LiveMap / informations | Arrondis de retard incohérents entre carte, liste et panneau | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM12 | LiveMap / informations | Quai de la gare précédente affiché comme voie courante | Clos | Clos | Clos | Clos | Clos | Information exacte dépendante des données de voie disponibles. |
| LM13 | LiveMap / informations | Tracé sélectionné ignore la route réellement déviée | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM14 | LiveMap / 3D | Quota de 64 marqueurs rempli avant filtrage de visibilité | Clos | Clos | Clos | Clos | Clos | Une longue session GPU réelle n’est pas remplacée par ces contrôles. |
| LM15 | LiveMap / informations | Distance au prochain arrêt estimée à vol d’oiseau malgré les courbes ferroviaires | Partiel | Partiel | Clos | Clos | Clos | Correction RC3 vérifiée |
| LM16 | LiveMap / coordonnées | Coordonnées zéro confondues avec des valeurs manquantes dans certaines vues | Partiel | Partiel | Partiel | Partiel | Clos | RC5 : les derniers replis snapLat/snapLon || origine du SC sont remplacés ; dessin, centrage et sélection respectent zéro et ignorent les positions absentes/invalides. Clôture des cas identifiés, pas preuve universelle sur toute donnée géographique corrompue. |
| LM17 | LiveMap / performances | Travail de rendu inutile après fermeture ou pour des objets hors écran | Partiel | Partiel | Partiel | Clos | Clos | RC4 : secours hors écran sans redessin forcé, objets fixes/secours filtrés avant rendu ; nettoyage marquee RC1 conservé. Périmètre des chemins identifiés et testés, pas tout le budget GPU. |
| TIME01 | Temps / économie | Traitements quotidiens sautés à minuit ou facturés deux fois au rechargement | Clos | Clos | Clos | Clos | Clos | Rattrapage basé sur l’état disponible, pas une reconstruction historique de toute la société. |
| TIME02 | Temps / durées | Incidents, réparations et manœuvres ne reçoivent qu’une minute après une longue suspension | Clos | Clos | Clos | Clos | Clos | Ce rattrapage de durée n’est pas le replay ferroviaire complet TIME05. |
| TIME03 | Temps / personnel | Congés, formations et absences ne rattrapent pas plusieurs journées | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| TIME04 | Temps / fret | Génération fret dépend de HH:00 exact et cadence instable à minuit/reload | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| TIME05 | Temps / replay | Longue absence repositionne sans rejouer tous les arrêts, recettes et contraintes intermédiaires | Partiel | Partiel | Partiel | Partiel | Partiel | Relecture événementielle complète, occupations et opérations après longue absence encore à réaliser. |
| SAVE01 | Sauvegarde | Crash/erreur Worker laisse une promesse en attente et bloque les sauvegardes suivantes | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SAVE02 | Sauvegarde | Échec temporaire IndexedDB interdit une nouvelle tentative pour la session | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO01 | Économie / voyageurs | Voyageurs conservés à bord ne paient que le dernier tronçon | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO02 | Économie / voyageurs | Pénalité voyageurs 25 % débitée deux fois | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO03 | Économie / fret | Deux services peuvent charger le même stock contractuel | Clos | Clos | Clos | Clos | Clos | Cas de contrat interrompu ou expiré en cours de route suivis dans ECO08. |
| ECO04 | Économie / fret | Rame mixte charge un fret compatible puis le refuse à la livraison | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO05 | Économie / fret | Contrats industriels générés vers des destinations sans routabilité vérifiée | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | Validation réseau encore absente ; ne pas inventer une route entre réseaux isolés. |
| ECO06 | Économie / fret | Affectation d’un contrat sans vérifier l’origine, la destination et leur ordre | Ouvert | Ouvert | Clos | Clos | Clos | Correction RC3 vérifiée |
| ECO07 | Économie / fret | Pourcentage de contrat mélange progression du train et quantité livrée | Ouvert | Ouvert | Clos | Clos | Clos | Correction RC3 vérifiée |
| ECO08 | Économie / fret | Cycle complet du cargo réservé après annulation/expiration non garanti | Partiel | Partiel | Partiel | Partiel | Clos | RC5 : identité de cargaison conservée ; interruption/suppression restitue sans recette au prochain arrêt commercial utilisable ; suppression/fin du service libère les réservations ; sauvegardes legacy/V2 et instantanés V2 en attente réconciliés. La restitution est comptable, pas une simulation d’entrepôts ou de transport routier ; aucune échéance nouvelle inventée. |
| ECO09 | Économie / statistiques | Fret générique alimente les KPI des seuls clients industriels | Clos | Clos | Clos | Clos | Clos | La ligne d’incrément générique des KPI industriels a été retirée en RC1. |
| FEAT01 | Fonctionnalités | Correspondances configurées mais non consultées par les départs et statistiques inertes | Ouvert | Clos | Clos | Clos | Clos | Attente d’exploitation et compteurs ; pas de modèle individuel d’itinéraires voyageurs. |
| FEAT02 | Fonctionnalités | Améliorations de gare payées mais bonus non appliqués au moteur | Ouvert | Partiel | Partiel | Partiel | Partiel | Parking/hall branchés sur la fréquentation. Satisfaction, quais, fret et garage restent à raccorder. |
| FEAT03 | Fonctionnalités | Consommables et propreté du matériel sans toutes les conséquences annoncées | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | Règles de panne sèche, fluides, adhérence et satisfaction à définir/brancher sans confondre les contraintes. |
| SOC01 | Personnel / social | Satisfaction zéro comptée comme 70 | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SOC02 | Personnel / social | Bonus de négociation payé effacé au recalcul journalier | Ouvert | Clos | Clos | Clos | Clos | Bonus social additif persistant et sauvegardé ; aucune durée d’expiration nouvelle inventée. |
| RNG01 | Aléatoire | État RNG zéro produit indéfiniment zéro | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| MET01 | Météo | Point météo absent reçoit la météo du centre de caméra distant | Clos | Clos | Clos | Clos | Clos | Repli neutre : ce n’est pas une météo locale observée. |
| DDS01 | Secours | Échec d’envoi de secours marqué envoyé et non réessayé | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS02 | Secours | Tout incident STOP attaché à un train peut envoyer une locomotive de secours | Clos | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS03 | Secours | Secours rentre au dépôt sans déplacement physique du train remorqué | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | Trajet de l’ensemble remorqueur/remorqué non refondu. |
| DDS04 | Secours | Mouvement DDS contourne une partie des contraintes de cantons, travaux et traction | Ouvert | Ouvert | Ouvert | Ouvert | Ouvert | Faire passer le secours par une autorité de mouvement équivalente aux autres services. |
| QA01 | Robustesse | Exceptions de sous-systèmes avalées sans diagnostic opérationnel exploitable | Ouvert | Ouvert | Clos | Clos | Clos | Correction RC3 vérifiée |
| QA02 | Robustesse | Caches de zones ORM/stations sans éviction bornée sur très longue exploration | Ouvert | Ouvert | Clos | Clos | Clos | Correction RC3 vérifiée |
| QA03 | Robustesse | Noms non échappés dans certaines interpolations HTML | Partiel | Partiel | Partiel | Partiel | Partiel | RC2 échappe le module correspondances, pas toutes les vues historiques. |

## Compléments hors taux gameplay

Performances : index des ruptures d’électrification et calcul des péages en une passe. Comparaisons RC4/RC5 avec fonctions réelles et résultats identiques sur les charges mesurées ; pas de multiplication revendiquée des FPS du jeu complet.

TypeScript : **86 modules applicatifs avec 86 sorties JS et 86 déclarations recompilées identiquement**. Il reste **48 any explicites et 28 @ts-expect-error**. Les deux nouveaux modules passent également un contrôle strict isolé, sans les compatibilités globales permissives du jeu. Les données JS pures, outils de test et bibliothèques externes sont hors périmètre des sources applicatives.
