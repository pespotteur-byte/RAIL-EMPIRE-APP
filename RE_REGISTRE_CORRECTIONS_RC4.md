# Rail Empire — Registre des corrections RC4

**77,9 % — 60 dossiers gameplay clos sur 77 dossiers suivis.**

Date : 11 septembre 2026. Base : RC3 livrée. Les clôtures héritées ne sont pas réauditées exhaustivement dans cette passe ; leurs tests sont conservés.

## Calcul et périmètre

RC3 : 58 clos sur 76 (76,3 %). RC4 ferme LM17 et ajoute le nouveau défaut SC30, découvert puis corrigé. Cela donne 59 clos sur les 76 dossiers antérieurs, plus SC30 clos : **60 / 77 = 77,922 %**. Les dossiers partiels ne valent aucun point. Le taux n’est ni une proportion de code garanti correct, ni un taux de FPS, ni une estimation du travail restant ou des bugs inconnus.

| État | RC3 | RC4 |
|---|---:|---:|
| Clos | 58 | 60 |
| Partiel | 9 | 8 |
| Ouvert | 7 | 7 |
| À confirmer | 2 | 2 |
| Total | 76 | 77 |

Les migrations TypeScript, les optimisations et les corrections complémentaires de l’administration sont décrites séparément : aucun point artificiel pour un fichier converti ou un microbenchmark accéléré.

## Clôtures de cette passe

**LM17.** La boucle réelle ne considère plus un secours hors écran comme du mouvement visible. Les secours et services immobiles hors champ sont exclus du lot de dessin. Le rafraîchissement statique et le mouvement des trains continuent ; une page masquée continue d’actualiser le moteur. Preuve : `js/__tests__/re-rc4-render.test.mjs` (six scénarios exécutant la vraie méthode compilée). Le nettoyage du marquee était déjà intégré.

**SC30 (nouveau).** La RC3 dépasse la limite d’arguments JavaScript avec 140 000 segments. Les assemblages massifs SC, validation, runtime et certains agrégats ORM utilisent désormais des boucles. Test des extrémités, des 140 000 contraintes et des vrais validateurs. Preuve : `js/__tests__/re-rc4-long-route.test.mjs`.

**SC28 reste ouvert.** La mémoire et le temps CPU du calcul physique sont réduits, sans supprimer de segments ni de cellules. Aucun plafond absolu de 45 000 cellules n’est prétendu.

## Registre complet

| ID | Famille | Anomalie | RC1 | RC2 | RC3 | RC4 | Suite / limite |
|---|---|---|---|---|---|---|---|
| SC01 | SC / physique | Une restriction V30 locale se propage sur toute la liaison | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC02 | SC / physique | Vmax inconnue héritée à distance illimitée et résolue différemment entre calculateurs | Clos | Clos | Clos | Clos | La vitesse inconnue reste une convention de simulation, pas une donnée réelle OSM. |
| SC03 | SC / physique | Perte de vitesse par puissance insuffisante en rampe ignorée | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC04 | SC / physique | Hausses de vitesse avant dégagement de la queue | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC05 | SC / physique | Discontinuité temporelle entre très courtes liaisons | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC06 | SC / physique | Validation d’une marche avec composition sans puissance | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC07 | SC / physique | Perte des contraintes, dépendance au seuil 12000 points et au rechargement | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC08 | SC / physique | Puissance électrique désactivée sur tout le parcours pour une courte section thermique | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC09 | SC / physique | Écartement inconnu court-circuite les contrôles de gabarit et charge | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC10 | SC / physique | Objet météo mal interprété selon le chemin de calcul | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC11 | SC / physique | Météo réelle/caméra modifie la grille théorique contrairement au runtime | Clos | Clos | Clos | Clos | Conditions théoriques de référence, pas prévision météo pour le futur horaire. |
| SC12 | SC / physique | Délai de mise en action du frein absent de la clé de cache | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC13 | SC / physique | Cache mutable partagé entre profil éditorial et profil runtime | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC14 | SC / physique | Durée d’aperçu oublie les arrêts et contredit l’arrivée affichée | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC15 | SC / horaires | Arrivée exactement à minuit remplacée par l’heure de départ | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC16 | SC / horaires | Retour legacy additionne les arrêts aux temps de marche et décale son premier départ | Ouvert | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC17 | SC / horaires | Auto-24h refuse ou fausse une liaison passant minuit | Ouvert | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SC18 | SC / synchronisation | Horaire/version modifiés, supprimés ou invalidés laissent un ancien service préparé | Clos | Clos | Clos | Clos | Les services déjà partis conservent intentionnellement leur plan courant. |
| SC19 | SC / exploitation | Point technique traité comme gare commerciale et identité technique perdue | Clos | Clos | Clos | Clos | Ne signifie pas une certification de toutes les occupations de points techniques. |
| SC20 | SC / exploitation | Voie physique exacte remplacée par un nom modifiable au pont SC-runtime | Partiel | Partiel | Partiel | Partiel | Libellés mieux protégés en RC2, mais identité canonique way/segment/voie encore à unifier. |
| SC21 | SC / exploitation | Continuité de rame à la gare seulement, permettant un changement de voie sans manœuvre | Ouvert | Ouvert | Ouvert | Ouvert | Trajet de manœuvre et occupation physique inter-voies non refondus. |
| SC22 | SC / exploitation | TAQ/rebroussement ne garantit pas l’exécution d’une manœuvre compatible avec la formation | Ouvert | Ouvert | Ouvert | Ouvert | Réversibilité, changement de cabine et contournement de rame doivent être distingués. |
| SC23 | SC / exploitation | Opération matériel au terminus libère la voie avant sa fin | Ouvert | Clos | Clos | Clos | Maintien testé pendant action et échec ; longues absences et toutes les restaurations d’opération restent dans TIME05. |
| SC24 | SC / exploitation | Mode simple ignore les conflits de matériel et affiche à tort PRÊT | Ouvert | Clos | Clos | Clos | Contrôle de planification ; toutes les indisponibilités futures dynamiques ne sont pas prévisibles. |
| SC25 | SC / routage | Changement de profil peut conserver une ancienne route sous-optimale | Ouvert | Ouvert | Clos | Clos | Correction RC3 vérifiée |
| SC26 | SC / routage | Revalidation perd des clés de cache de route | Ouvert | Ouvert | Clos | Clos | Correction RC3 vérifiée |
| SC27 | SC / routage | Insertion d’arrêt redistribue les VIA par proximité plutôt que par ordre ferroviaire | À confirmer | À confirmer | À confirmer | À confirmer | Risque établi dans l’heuristique ; cas réel de boucle à reproduire avant correction. |
| SC28 | SC / performances | Nombre de cellules physiques peut dépasser le plafond visé sur géométrie dense | Ouvert | Ouvert | Ouvert | Ouvert | RC4 réduit CPU et allocations en conservant toutes les cellules ; le plafond absolu reste ouvert, aucune décimation des contraintes. |
| SC29 | SC / horaires | Service legacy retardé après minuit peut perdre sa date d’exploitation | À confirmer | À confirmer | À confirmer | À confirmer | Cas legacy calendrier à reproduire ; ne pas confondre avec les occurrences datées V2. |
| SC30 | SC / longues routes | Assemblage de très grands tableaux dépasse la limite d’arguments JS (RangeError) | Non suivi | Non suivi | Non suivi | Clos | RC4 : 140 000 segments assemblés, validés et transmis au runtime sans spread d’arguments ni perte de contraintes. |
| LM01 | LiveMap / mouvement | Retour de visibilité reconstruit un train dont le temps avait déjà été simulé | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM02 | LiveMap / mouvement | Catch-up traverse un STOP ou conserve une position en conflit et écrase le motif | Clos | Clos | Clos | Clos | Pas un replay de tous les obstacles rencontrés sur le chemin : TIME05 reste ouvert. |
| LM03 | LiveMap / mouvement | Blocage durable vers 12 km/h après changement de page, observé par le joueur | Partiel | Partiel | Partiel | Partiel | Causes de reconstruction corrigées ; symptôme exact sur le PC du joueur non reproduit de bout en bout. |
| LM04 | LiveMap / ressources | Objet d’affectation de quai pris pour une réservation réellement détenue | Partiel | Clos | Clos | Clos | Clôture de ce raccourci logique seulement ; identité physique générale suivie en SC20. |
| LM05 | LiveMap / ressources | Voies alphanumériques remplacées par une voie numérique libre | Ouvert | Clos | Clos | Clos | A, 1 bis et V1M préservés ; alias V1/voie 1 et évolution de capacité sans double réservation. |
| LM06 | LiveMap / mouvement | Différences de sécurité et de vitesse entre mouvement complet et macro | Partiel | Partiel | Partiel | Partiel | RC1 traite empreinte, panne 80, freinage et cap ; équivalence générale multi-trains pas encore certifiée. |
| LM07 | LiveMap / ressources | Train blocked_route physiquement présent considéré disparu par le cantonnement | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM08 | LiveMap / maintenance | Train en maintenance continue de rouler, ou réparation remet un train en ligne en waiting | Clos | Clos | Clos | Clos | Remorquage DDS physique séparé en DDS03. |
| LM09 | LiveMap / maintenance | Dépôt d’attache inscrit comme présence physique lors d’un arrêt en ligne | Ouvert | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM10 | LiveMap / informations | Charge du panneau figée ou remplissage inventé quand l’information manque | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM11 | LiveMap / informations | Arrondis de retard incohérents entre carte, liste et panneau | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM12 | LiveMap / informations | Quai de la gare précédente affiché comme voie courante | Clos | Clos | Clos | Clos | Information exacte dépendante des données de voie disponibles. |
| LM13 | LiveMap / informations | Tracé sélectionné ignore la route réellement déviée | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| LM14 | LiveMap / 3D | Quota de 64 marqueurs rempli avant filtrage de visibilité | Clos | Clos | Clos | Clos | Une longue session GPU réelle n’est pas remplacée par ces contrôles. |
| LM15 | LiveMap / informations | Distance au prochain arrêt estimée à vol d’oiseau malgré les courbes ferroviaires | Partiel | Partiel | Clos | Clos | Correction RC3 vérifiée |
| LM16 | LiveMap / coordonnées | Coordonnées zéro confondues avec des valeurs manquantes dans certaines vues | Partiel | Partiel | Partiel | Partiel | Cas corrigés localement, audit de tous les replis du SC encore incomplet. |
| LM17 | LiveMap / performances | Travail de rendu inutile après fermeture ou pour des objets hors écran | Partiel | Partiel | Partiel | Clos | RC4 : secours hors écran sans redessin forcé, objets fixes/secours filtrés avant rendu ; nettoyage marquee RC1 conservé. Périmètre des chemins identifiés et testés, pas tout le budget GPU. |
| TIME01 | Temps / économie | Traitements quotidiens sautés à minuit ou facturés deux fois au rechargement | Clos | Clos | Clos | Clos | Rattrapage basé sur l’état disponible, pas une reconstruction historique de toute la société. |
| TIME02 | Temps / durées | Incidents, réparations et manœuvres ne reçoivent qu’une minute après une longue suspension | Clos | Clos | Clos | Clos | Ce rattrapage de durée n’est pas le replay ferroviaire complet TIME05. |
| TIME03 | Temps / personnel | Congés, formations et absences ne rattrapent pas plusieurs journées | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| TIME04 | Temps / fret | Génération fret dépend de HH:00 exact et cadence instable à minuit/reload | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| TIME05 | Temps / replay | Longue absence repositionne sans rejouer tous les arrêts, recettes et contraintes intermédiaires | Partiel | Partiel | Partiel | Partiel | Relecture événementielle complète, occupations et opérations après longue absence encore à réaliser. |
| SAVE01 | Sauvegarde | Crash/erreur Worker laisse une promesse en attente et bloque les sauvegardes suivantes | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SAVE02 | Sauvegarde | Échec temporaire IndexedDB interdit une nouvelle tentative pour la session | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO01 | Économie / voyageurs | Voyageurs conservés à bord ne paient que le dernier tronçon | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO02 | Économie / voyageurs | Pénalité voyageurs 25 % débitée deux fois | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO03 | Économie / fret | Deux services peuvent charger le même stock contractuel | Clos | Clos | Clos | Clos | Cas de contrat interrompu ou expiré en cours de route suivis dans ECO08. |
| ECO04 | Économie / fret | Rame mixte charge un fret compatible puis le refuse à la livraison | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| ECO05 | Économie / fret | Contrats industriels générés vers des destinations sans routabilité vérifiée | Ouvert | Ouvert | Ouvert | Ouvert | Validation réseau encore absente ; ne pas inventer une route entre réseaux isolés. |
| ECO06 | Économie / fret | Affectation d’un contrat sans vérifier l’origine, la destination et leur ordre | Ouvert | Ouvert | Clos | Clos | Correction RC3 vérifiée |
| ECO07 | Économie / fret | Pourcentage de contrat mélange progression du train et quantité livrée | Ouvert | Ouvert | Clos | Clos | Correction RC3 vérifiée |
| ECO08 | Économie / fret | Cycle complet du cargo réservé après annulation/expiration non garanti | Partiel | Partiel | Partiel | Partiel | Réservation initiale et sauvegarde couvertes ; interruptions de contrat restent à tester. |
| ECO09 | Économie / statistiques | Fret générique alimente les KPI des seuls clients industriels | Clos | Clos | Clos | Clos | La ligne d’incrément générique des KPI industriels a été retirée en RC1. |
| FEAT01 | Fonctionnalités | Correspondances configurées mais non consultées par les départs et statistiques inertes | Ouvert | Clos | Clos | Clos | Attente d’exploitation et compteurs ; pas de modèle individuel d’itinéraires voyageurs. |
| FEAT02 | Fonctionnalités | Améliorations de gare payées mais bonus non appliqués au moteur | Ouvert | Partiel | Partiel | Partiel | Parking/hall branchés sur la fréquentation. Satisfaction, quais, fret et garage restent à raccorder. |
| FEAT03 | Fonctionnalités | Consommables et propreté du matériel sans toutes les conséquences annoncées | Ouvert | Ouvert | Ouvert | Ouvert | Règles de panne sèche, fluides, adhérence et satisfaction à définir/brancher sans confondre les contraintes. |
| SOC01 | Personnel / social | Satisfaction zéro comptée comme 70 | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| SOC02 | Personnel / social | Bonus de négociation payé effacé au recalcul journalier | Ouvert | Clos | Clos | Clos | Bonus social additif persistant et sauvegardé ; aucune durée d’expiration nouvelle inventée. |
| RNG01 | Aléatoire | État RNG zéro produit indéfiniment zéro | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| MET01 | Météo | Point météo absent reçoit la météo du centre de caméra distant | Clos | Clos | Clos | Clos | Repli neutre : ce n’est pas une météo locale observée. |
| DDS01 | Secours | Échec d’envoi de secours marqué envoyé et non réessayé | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS02 | Secours | Tout incident STOP attaché à un train peut envoyer une locomotive de secours | Clos | Clos | Clos | Clos | Clôture héritée ; tests antérieurs conservés |
| DDS03 | Secours | Secours rentre au dépôt sans déplacement physique du train remorqué | Ouvert | Ouvert | Ouvert | Ouvert | Trajet de l’ensemble remorqueur/remorqué non refondu. |
| DDS04 | Secours | Mouvement DDS contourne une partie des contraintes de cantons, travaux et traction | Ouvert | Ouvert | Ouvert | Ouvert | Faire passer le secours par une autorité de mouvement équivalente aux autres services. |
| QA01 | Robustesse | Exceptions de sous-systèmes avalées sans diagnostic opérationnel exploitable | Ouvert | Ouvert | Clos | Clos | Correction RC3 vérifiée |
| QA02 | Robustesse | Caches de zones ORM/stations sans éviction bornée sur très longue exploration | Ouvert | Ouvert | Clos | Clos | Correction RC3 vérifiée |
| QA03 | Robustesse | Noms non échappés dans certaines interpolations HTML | Partiel | Partiel | Partiel | Partiel | RC2 échappe le module correspondances, pas toutes les vues historiques. |

## Compléments hors taux gameplay

Administration : imports et suppressions rechargés même sans première modification de fiche ; noms affichés sans injection de balises ; résumé de sources borné et comptage en un passage. Vérifiés dans Chromium avec stockage isolé. Les images Blob persistées, les imports ZIP réels et la publication distante ne sont pas certifiés.

TypeScript : 84 modules applicatifs, mais 48 any explicites et des compatibilités globales historiques subsistent. L’inventaire de sources n’est pas une preuve de typage strict complet.
