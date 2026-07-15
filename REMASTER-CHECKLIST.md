# RAIL EMPIRE — REMASTER : CHECKLIST DE TRAÇABILITÉ

> Source de vérité = doc d'origine `RE REMASTER` + addendum `RE-REMASTER-COMPLET` (texte **et** 28 schémas).
> Une ligne = une exigence atomique. Rien n'est codé sans être ici ; rien d'ici n'est abandonné sans accord explicite.
>
> **Statut** : `[ ]` à faire · `[~]` en cours · `[x]` fait (+ PR) · `⚠️` à trancher avec le concepteur.
> **Priorité** : P0 = socle simulation · P1 = gestion/gameplay · P2 = confort/enrichissement.
> **Source** : § = section addendum (A1…A21) · annexe n = schéma.
>
> Convention IDs : préfixe domaine + numéro (ex. `R-01`). Ne jamais réutiliser un ID supprimé.

---

## 0. LÉGENDE DE COUVERTURE
- Total exigences : voir compteur en fin de fichier.
- Chaque PR référence les IDs couverts dans sa description.
- Vérification finale : 0 case non cochée hors P2 explicitement reporté.

---

## R — ROUTAGE & GRAPHE  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| R-01 | Graphe d'infrastructure **orienté** (edges avec sens A→B) | P0 | A12, A13, réponse #3 doc | [x] PR1 |
| R-02 | Routage réel sur voies ORM via Dijkstra/A* pondéré temps de parcours | P0 | A13 | [x] PR1 |
| R-03 | Supprimer le **fallback ligne droite** (orm.js ~699-711) | P0 | A14#2, annexe 10b | [x] PR1 |
| R-04 | Aucun retour arrière / contre-sens non prévu (hors tête-à-queue planifié) | P0 | A4.3, annexe 10c | [x] PR1 |
| R-05 | Routage fonctionne sur longue distance (**≥1200 km** vérifié) | P0 | annexe 10b | [x] PR1 |
| R-06 | Index spatial (grille/quadtree/R-tree) pour requêtes "edges proches" | P0 | A13 | [x] PR1 |
| R-07 | Plafonnement vitesse routage à V160 (matériel joueur) | P1 | A13 | [ ] |
| R-08 | Aiguillages branchés au routage (fin des aiguillages décoratifs) | P0 | A14#13, annexe 10d | [x] PR? (tronçons utilisateur injectés dans le graphe ORM) |
| R-09 | Points auto tous les 50 m maîtrisés (pas de points parasites) | P0 | A4.2 (d), A14#5 | [x] PR? (densification 50m, points editables/supprimables) |

## PH — PHYSIQUE DE TRACTION  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| PH-01 | Accél/décél selon puissance moteur + masse totale + pente | P0 | A3.1 | [~] PR2 (module + temps de parcours ; marche animée en PR ultérieure) |
| PH-02 | Résistance type Davis R=A+B·v+C·v² + composante pente | P0 | A3.1 | [x] PR2 |
| PH-03 | Force traction bornée par puissance/vitesse et par adhérence | P0 | A3.1 | [x] PR2 |
| PH-04 | Freinage borné par taux de freinage rame + adhérence (météo) | P0 | A3.1, A3.4 | [x] PR2 |
| PH-05 | Fret chargé accélère/freine visiblement plus lentement qu'un voyageur | P0 | A3.1, A18 | [~] PR2 (dans le temps de parcours ; marche animée en PR ultérieure) |
| PH-06 | Masse fret = selon charge réelle par wagon | P0 | A3.1 | [~] PR2 (masse+payload via getTotalMassWithPayload) |
| PH-07 | Arrivée ≈ horaire théorique (fin du bug "trains en avance") | P0 | A14#1, A18 | [~] PR2 (temps planifiés réalistes ; validation en jeu à venir) |

## VIT — VITESSES & TRANSITIONS  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| VIT-01 | Vitesse par tronçon lue depuis ORM (par sous-segment) | P0 | A3.3, A12 | [x] PR2 |
| VIT-02 | Transition POSITIVE : accélère seulement quand toute la rame (queue) a franchi le point | P0 | A3.3 | [x] PR1 (_getInfraSpeedLimit min sur longueur train) |
| VIT-03 | Transition NÉGATIVE : nouvelle vitesse atteinte 50-150 m avant la zone plus lente | P0 | A3.3 | [x] PR1 (_getNegativeTransitionCap marge 100m) |
| VIT-04 | Voie sans vitesse ORM = 30 km/h **uniquement** sur service=yard/siding/spur | P0 | A3.3, réponse #2 doc | [x] PR1 (parseWays : main/branch→160, autre/sans tag→30) |
| VIT-05 | Voie principale (usage=main/branch) non taguée = défaut élevé (pas 30) | P0 | A3.3 | [x] PR1 |

## SIG — CANTONNEMENT & SIGNALISATION  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| SIG-01 | Taille de canton fonction de la vitesse ligne (barème A3.2) | P0 | A3.2 | [x] PR3 (cantonLengthKm branché sur CantonManager) |
| SIG-02 | Un seul train par canton | P0 | A3.2, A18 | [x] PR3 (CantonManager occupancy, existant + confirmé) |
| SIG-03 | État "voie libre" = vitesse limite du tronçon | P0 | A3.2 | [x] PR3 |
| SIG-04 | État "avertissement" = réduire pour pouvoir s'arrêter + alerte régulation | P0 | A3.2 | [x] PR? (cap ≤60 + signalAlert='caution' → 'Régulation du trafic') |
| SIG-05 | État "carré/fermé" = arrêt obligatoire 25-50 m en amont + alerte | P0 | A3.2, annexe 3B | [x] PR? (arrêt ~30 m via VISA=0 + signalAlert='closed' → 'Arrêt pour signal fermé') |
| SIG-06 | VISA : 30 km/h à 300 m, 20 à 200 m, 10 à 100 m du carré | P0 | A3.2 | [x] PR3 |
| SIG-07 | Repartir d'un carré ouvert à l'avertissement : ≤60 km/h puis VISA | P0 | A3.2 | [x] PR? (cap ≤60 en avertissement, VISA ensuite) |
| SIG-08 | Signaux ajoutables par le joueur (facultatif) | P2 | A15 P2 | [ ] |

## SC — SCHEDULE CREATOR  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| SC-01 | Définitions Gare / Waypoint / Aller-retour respectées | P0 | A4.1 | [x] PR5 (types arret/passage/waypoint + A/R) |
| SC-02 | Heure de passage calculée à **CHAQUE gare réelle** rencontrée (point g) | P0 | A4.3, annexe 5 | [x] PR? (ActiveService._computePassageStops + affichage dans la liste) |
| SC-03 | Numérotation auto impair (aller) / pair (retour) | P0 | A4.3 | [x] PR4 (schedule-logic + ActiveService) |
| SC-04 | Aller-retour : tracé retour **indépendant** de l'aller | P0 | A4.1, A14#3 | [x] PR4/PR5 (UI "Tracer le retour", stop/route buffers distincts, save/load, simulation via _returnRoutes/_returnStopsData) |
| SC-05 | Auto 24h génère les **duplicata réels** (pas juste un décompte) | P0 | A4.3, A14#4 | [x] PR? (createAutoRoundTripDuplicates + duplicateService shift return stops + numéros) |
| SC-06 | Attente terminus minimum 5 min, modifiable par le joueur | P0 | A4.3, réponse #5 doc | [x] PR4 (défaut 5 min, modifiable) |
| SC-07 | Tableau horaires : 50 trajets par défaut, tri chronologique (départ A) | P1 | A4.3 | [~] tri chrono ajouté, pagination 50 à faire |
| SC-08 | Clic ligne = menu déroulant détaillé du trajet | P1 | A4.3 | [x] PR5 (toggleSchedDetail, détail repliable) |
| SC-09 | Traçage manuel d'itinéraire | P0 | A4.3 | [x] PR? (mode 'Tracer manuellement' + points de contrôle + interpolation 50m) |
| SC-10 | Insertion de waypoint intermédiaire **sans supprimer** les suivants | P1 | A4.3 | [x] PR5 (insertion au segment le plus proche + recalcStopsFrom) |
| SC-11 | Affichage du VRAI tracé (voies ORM), pas des traits 1-2-3 / plus de fallback droit | P0 | A4.3, annexe 10b | [x] PR? (_resolveRouteForLeg + preview magenta, pas de fallback droit) |
| SC-12 | Nouvelle interface : carte à gauche, formulaire à droite | P1 | annexe 10a | [x] PR5 (.sched-layout carte-gauche/form-droite) |
| SC-13 | Champs menu : Rame, Nom service, Nom retour si ≠, A/R, Nb A/R + Auto 24h, Attente terminus, Train travaux, Jours circ., Dates spécifiques | P1 | annexe 9 | [x] PR5 (tous les champs présents) |
| SC-14 | Légende heures par gare (départ/passage/arrivée) aller ET retour | P1 | annexe 10a | [x] PR5 (heures + légende sur aller ET retour) |

## ARR — TYPES D'ARRÊT  (P2 gameplay)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| ARR-01 | C = Circulation, S = Service | P1 | A3.8, réponse #1 | [x] PR4 (parseStopType) |
| ARR-02 | Sautable uniquement entre crochets [C] / [S] | P1 | A3.8, réponse #1 | [x] PR4 (parseStopType.skippable) |
| ARR-03 | Arrêt non crocheté = incompressible (toujours marqué) | P1 | A3.8 | [x] PR4 (bare C/S = non skippable) |
| ARR-04 | Probabilité de saut 25 % | P2 | A3.8 | [x] PR? (rollSkip 25% + _buildAdjustedStops) |
| ARR-05 | Tirage rejoué **à chaque circulation** (indépendant du seed) | P2 | A3.8, A17, réponse #2 | [x] PR? (shouldSkipStop avec Math.random, recalculé par _buildAdjustedStops à chaque départ) |

## OCC — OCCUPATION VOIES & PRIORITÉS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| OCC-01 | Occupation gare = occupation d'un point de voie | P0 | A3.5 | [~] PR6 (voie point occupé + probe voies libres à l'arrivée) |
| OCC-02 | 2 trains même voie n'entrent pas ensemble en gare (sauf points ≠) | P0 | A3.5 | [x] PR6 (arrivée bloquée si aucune voie libre → attente en approche) |
| OCC-03 | Priorité au départ : au train qui part en premier (voyageurs) | P1 | A3.5 | [x] PR? (voyageur avec départ le plus tôt en priorité) |
| OCC-04 | Priorité en ligne : plus rapide = prioritaire | P1 | A3.5, réponse #3 | [x] PR? (espacement sécurité fonction vitesse/freinage) |
| OCC-05 | Écart recommandé ≥ 2 min entre 2 trains (peut descendre au bloc) | P1 | A3.5 | [x] PR? (2 min après libération du canton) |
| OCC-06 | Plafond d'attente : max 2 h sur voie de garage → reprise forcée au-delà | P1 | A3.5, réponse #3 | [x] PR? (départ forcé après 120 min) |

## REG — RÉGULATION  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| REG-01 | Régulateur : zone d'axe ~150 km | P1 | A3.6 | [x] PR? (StaffManager.getRegulationEffects) |
| REG-02 | Agent Circulation (AC) : zone 10-30 km sous supervision | P1 | A3.6 | [x] PR? (signal box + agents réduit écart canton) |
| REG-03 | Décisions (garage, ordre passage) prises par le JEU ; joueur embauche seulement | P1 | A3.6 | [ ] |
| REG-04 | Suppression des cercles d'influence des postes (découpage par axe) | P1 | A3.6 | [ ] |

## CVO — TYPES DE CONVOIS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| CVO-01 | W = vide voyageur (repositionnement, voyageurs only, créé par joueur) | P1 | A3.7 | [x] PR? (serviceType='w', non-revenus) |
| CVO-02 | HLP = loco(s) seule(s), max 2, auto | P1 | A3.7 | [x] PR? (validation max 2 locos) |
| CVO-03 | TM = train de machines, 3 à 12 locos (jamais >12) | P1 | A3.7 | [x] PR? (validation 3-12 locos) |
| CVO-04 | EVO = mouvement rame garage→gare, auto | P1 | A3.7 | [x] PR? (ensureEVOForService + attente service principal) |
| CVO-05 | M- = machine de manœuvre, rattachée dépôt, usure identique | P1 | A3.7 | [x] PR? (option serviceType 'm-' + validation 1 loco + dépôt) |
| CVO-06 | S- = machine de secours, max 2/dépôt, payante, usure identique | P1 | A3.7, A6.3 | [x] PR? (max 2 secours + vitesse DDS 10/30 km/h) |

## RET — RETARDS, SUPPRESSION & REPRISE  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| RET-01 | Rame en retard au terminus : rouler retour en retard OU supprimer | P1 | A3.9 | [x] PR? |
| RET-02 | Loi : 1/3 supprimer, 2/3 rouler en retard | P1 | A3.9 | [x] PR? |
| RET-03 | Si supprimé : repart au prochain trajet prévu depuis cette gare | P1 | A3.9 | [ ] |
| RET-04 | Retard causé par train devant = motif "régulation du trafic" | P1 | A3.9 | [x] PR? (train.delayReason + panneau Livemap) |

## LG — PAGE LIGNE / SILLONS AUTO  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| LG-01 | Bibliothèque de sillons nommés + orientés + réutilisables | P1 | A5 | [x] PR1 (SillonManager + page Ligne) |
| LG-02 | Chaque sillon = nom + orientation + tracé complet orienté (polyligne) | P1 | A5.1 | [x] PR1 (from/to + route ORM) |
| LG-03 | Sens respecté : A→B ne propose que sillons A→B | P1 | A5.1 | [x] PR1 (getBetween from→to) |
| LG-04 | Nombre de sillons illimité | P1 | A5.1 | [x] PR1 (array dynamique) |
| LG-05 | Au clic gare B : fenêtre propose sillons compatibles | P1 | A5.1 | [x] PR1 (modal-sillon-picker) |
| LG-06 | Chaînage de plusieurs sillons pour un long trajet | P1 | A5.1 | [x] PR1 (un sillon par segment, chaînables) |
| LG-07 | Continuité : fin sillon N = début sillon N+1 ; refuser discontinu | P1 | A5.2 | [x] PR1 (gare B = gare A du segment suivant) |
| LG-08 | Politique d'arrêt indépendante du sillon (arrêt/passage au raccord) | P1 | A5.2 | [x] PR1 (sillon ne force pas l'arrêt, stopCode libre) |
| LG-09 | Réemploi de la page Lignes existante | P1 | A5 | [x] PR1 (section Sillons dans page Lignes) |
| LG-10 | Mode création alternatif (liste/recherche) pour 200+ gares | P1 | A5.2 note | [ ] |

## DEP — DÉPÔTS & PARC  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| DEP-01 | Infrastructure dépôt : remisage / rotondes / technicentres | P1 | A6.1 | [ ] |
| DEP-02 | Affectation engin à un dépôt à l'achat | P1 | A6.1 | [x] PR1 (depotId dans Rame, dropdown achat, liste dépôt) |
| DEP-03 | ID interne jeu EN PLUS du n° série (n° série non obligatoire) | P1 | A6.1 | [ ] |
| DEP-04 | Localisation permanente de chaque engin + rame d'affectation | P0 | A6.1 | [x] PR1 (depotId persistant, rames listées sur fiche dépôt) |
| DEP-05 | "1 rame = 1 trajet" via position/états horodatés | P0 | A6.1, A12 | [x] PR? (currentLocation mise à jour au départ/arrivée/mouvement + affichage) |
| DEP-06 | Trains en maintenance : absents livemap ET bandeau train | P1 | A6.1 | [x] PR? (filter drawServices + updateTrainsList) |

## MNT — MAINTENANCE & PIÈCES  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| MNT-01 | Stock pièces : moteur / clim / fanaux / freins / portes | P1 | A6.2 | [x] PR? (Depot.spareParts + consume/add + UI) |
| MNT-02 | Risque de panne par pièce + alerte bandeau train | P1 | A6.2 | [x] PR? (breakdown aléatoire par type + delayReason panne) |
| MNT-03 | Pannes bénignes (clim, portes) : pas de technicentre obligatoire | P1 | A6.2 | [x] PR? (limité à 80 km/h, réparé en gare avec +5 min retard) |
| MNT-04 | Pannes moteur/freins : arrêt urgence (plus long si freins) → DDS | P1 | A6.2 | [x] PR? (panne → arrêt → secours) |
| MNT-05 | Notification d'achat pièces à valider + livraisons groupées multi-dépôts | P1 | A6.2 | [ ] |
| MNT-06 | Maintenance préventive mensuelle recommandée | P1 | A6.2 | [ ] |

## DDS — DEMANDE DE SECOURS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| DDS-01 | Train bloqué → loco secours l'attelle et le rapatrie au dépôt adapté le plus proche | P1 | A6.3, A18 | [x] PR? (dispatch + rapatriement) |
| DDS-02 | Secours diesel ou électrique, choisi par joueur | P1 | A6.3 | [ ] |
| DDS-03 | Max 2 secours/dépôt, numérotées S- | P1 | A6.3 | [x] PR? |
| DDS-04 | Loco secours ≤ 30 km/h dans canton occupé | P1 | A6.3 | [x] PR? (10/30/100 selon distance) |
| DDS-05 | Trafic perturbé : les autres trains laissent le secours s'effectuer | P1 | A6.3 | [ ] |

## ITE — INSTALLATIONS TERMINALES  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| ITE-01 | ITE = point chargement/livraison fret, créé via modal Dépôts/ITE, terme unique "ITE" | P1 | A6.4 | [~] PR1 (UI ITE existante, tracé livemap à venir) |
| ITE-02 | Tracé manuel des voies ITE, chacune nommée, longueur saisie/calculée | P1 | A6.4 | [x] PR? (UI depot-ite-tracks : nom + longueur) |
| ITE-03 | Longueur = contrainte : train trop long ne rentre pas | P1 | A6.4, A18 | [x] PR? (getITEInfo canFit + dwell extra) |
| ITE-04 | Alternative : garer sur grand faisceau puis tranches (600=2×300/3×200) | P1 | A6.4 | [x] PR? (trancheCount + trancheManeuver dwell) |
| ITE-05 | Types d'ITE selon cargaison (ex. intermodal) | P1 | A6.4 | [x] PR1 (type ITE + cargoType par voie) |
| ITE-06 | Temps en ITE : arrivée/coupe/déchargement/rechargement selon type+longueur | P1 | A6.4 | [x] PR? (dwell selon cargo/longueur/tranches) |
| ITE-07 | Intermodal : simuler grues/portiques | P1 | A6.4 | [ ] |
| ITE-08 | ⚠️ Synchronisation bateaux ANNULÉE ; fret peut partir vide | — | A6.4, réponse #6 | [x] décidé |

## FRT — FRET, CLIENTS & CONTRATS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| FRT-01 | Train complet = 1 type de wagon ; MLMC = wagons variés (diffus) | P1 | A7 | [x] PR? (flag diffuse + cargoTypes multiples, fulfillment par wagon) |
| FRT-02 | Clients = entreprises ; but = qualité de service / parts de marché | P1 | A7 | [x] PR? (marketShare par client, tonnage/fiabilité, affichage) |
| FRT-03 | Contrat = besoins matériels + lieu livraison (ITE), assignable à un service | P1 | A7 | [x] PR? (picker contrat dans Horaires + fulfillment) |
| FRT-04 | Retard → pénalité 25 % | P1 | A7, A18 | [x] PR? (sur contrat et fret générique) |
| FRT-05 | Avance/fiabilité → confiance accrue → plus d'offres | P1 | A7 | [x] PR? (satisfaction + tonnage offres liés) |
| FRT-06 | La demande peut manquer : fret peut partir vide | P1 | A7 | [x] PR? (chargement aléatoire 20-70%) |

## ECO — ÉCONOMIE  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| ECO-01 | Coût d'exploitation : péage circulation | P1 | A8.1 | [x] PR? |
| ECO-02 | Coût d'exploitation : composante distance | P1 | A8.1 | [x] PR? |
| ECO-03 | Coût d'exploitation : composante vitesse max | P1 | A8.1 | [x] PR? |
| ECO-04 | Prix voyageur au km différencié par classification du train | P1 | A8.2 | [x] PR? |
| ECO-05 | Prix au km **persistants** à la sauvegarde | P1 | A8.2 | [ ] |
| ECO-06 | Valeurs de prêt ×10 (50 000 → 500 000) | P1 | A8.3 | [x] PR? |
| ECO-07 | Plafond crédit RÉEL, adapté à la trésorerie de départ | P1 | A8.3, réponse #4 | [ ] |

## RH — PERSONNEL & SOCIAL  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| RH-01 | Embauche multiple + noms auto (FR/DE/CH/ES/BE/NL/IT/CZ) | P1 | A9 | [x] PR1 |
| RH-02 | Chaque poste/fonction précis et réaliste | P1 | A9 | [ ] |
| RH-03 | 3×8 : repos 24h/semaine + 8h entre services | P1 | A9 | [ ] |
| RH-04 | Non-respect → risque de mouvement social accru | P1 | A9 | [ ] |
| RH-05 | Grèves/syndicats réalistes (page Personnel, ex-Syndicats fusionnée) | P1 | A9 | [ ] |
| RH-06 | ⚠️ Congés TOTALEMENT écartés | — | A9, réponse #7 | [x] décidé |

## INC — INCIDENTS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| INC-01 | Plus de création manuelle : incidents pré-implémentés activables/désactivables | P1 | A10.1, annexe 11 | [x] PR1 (table PREDEFINED_INCIDENT_TYPES + UI toggle) |
| INC-02 | Zone d'impact LINÉAIRE 5-10 km (pas un cercle) | P1 | A10.1 | [x] PR1 (track/station route-based bbox, pas cercle) |
| INC-03 | Effets hors zone (bouchons en accordéon) | P1 | A10.1 | [ ] |
| INC-04 | Motifs affichés dans bilans de trajet | P1 | A10.1 | [ ] |
| INC-05 | Bulletins spéciaux à côté du récap de compagnie | P1 | A10.1 | [ ] |

## TRV — TRAVAUX & RÉSEAU  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| TRV-01 | Chaque section s'use ; axes fréquentés = + d'entretien ; suivi page Réseau | P1 | A10.2 | [ ] |
| TRV-02 | ITE et dépôts non soumis aux travaux | P1 | A10.2 | [ ] |
| TRV-03 | Fermeture de voie : cocher case + tracer portion ; trains reroutés en sécurité | P1 | A10.2 | [ ] |
| TRV-04 | Trains de travaux (TTX) fournis ; caténaire = lignes électrifiées only | P1 | A10.2 | [ ] |
| TRV-05 | Portée : journée/tranche, entre 2 gares, ou récurrente | P1 | A10.2 | [ ] |
| TRV-06 | Toutes voies fermées : aucun train ; itinéraires déroutement A/B/C/D ou renoncer (alerte) | P1 | A10.2 | [ ] |
| TRV-07 | Page Réseau : état lignes A↔B, usure, plages travaux | P1 | A2.3, A1.1 | [ ] |

## MET — MÉTÉO & SAISONS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| MET-01 | Météo précise par lat/long (une même ligne peut varier) | P1 | A3.4, A11.4 | [x] PR? (cache par point lat/lon) |
| MET-02 | Dégagé/nuageux/vent : aucun impact | P1 | A3.4 | [x] PR? (pas de speedCap/brakeFactor pour ces cas) |
| MET-03 | Pluie faible : freiner un peu plus tôt | P1 | A3.4 | [x] PR? (brakeFactor > 1) |
| MET-04 | Pluie forte : freiner bien plus tôt | P1 | A3.4 | [x] PR? (brakeFactor plus élevé) |
| MET-05 | Orage/tempête : freiner encore plus tôt | P1 | A3.4 | [x] PR? (brakeFactor max) |
| MET-06 | Neige : −20 km/h si V ≥ 140 + freinage dégradé | P1 | A3.4 | [x] PR? (speedCap, brakeFactor) |
| MET-07 | Nuages via satellite, radar pluie amélioré | P2 | A11.4 | [x] PR? (RainViewer radar + cloud tiles) |
| MET-08 | Saisons fusionnées dans page Météo | P1 | A11.4 | [x] PR? (page Météo unique) |

## MAT — PAGE MATÉRIEL  (P1)  [schémas annexes 6-7]
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| MAT-01 | Fenêtre création : Visuel / Identification / Caractéristiques / Capacités / Tarification | P1 | annexe 6b | [x] PR1 (sections conservées, tarif auto) |
| MAT-02 | Suppression du champ "Numéro" dans Identification | P1 | annexe 7 | [x] PR1 (champ retiré du modal) |
| MAT-03 | Traction en **multi-sélection** | P1 | annexe 7 | [x] PR1 (checkboxes stock-traction-cb) |
| MAT-04 | Valeurs traction : Diesel, Vapeur, 1,5 kV, 3 kV, 15 kV, 25 kV, 3e rail | P1 | annexe 7 | [x] PR1 (7 cases à cocher) |
| MAT-05 | Tonnage supprimé → calculé auto (masse à vide + capacité) | P1 | annexe 7 | [x] PR1 (RollingStockItem.tonnage auto + UI) |
| MAT-06 | Prix d'achat supprimé → calcul automatique | P1 | annexe 7 | [x] PR1 (formule physiques UI/rolling-stock) |
| MAT-07 | Sous-catégories wagon si "wagon" : tombereau, citerne, gazier, porte-auto, trémie, céréalier, ciment, silos, plat, TTX, intermodal, spéciaux, couvert, bâchés, infra | P1 | annexe 7 | [x] PR1 (select stock-wagon-subcat) |
| MAT-08 | Contrainte électrification tronçon ↔ traction engin (multi-systèmes) | P1 | A21.2, A3.3 | [ ] |

## RAM — PAGE RAMES  (P1)  [schéma annexe 8]
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| RAM-01 | "Composer une rame" : recherche + catégories + grille matériel | P1 | annexe 8 | [x] PR1 (picker assombri + filtres) |
| RAM-02 | Agrégats direct : Vmax / tonnage / places / coût | P1 | annexe 8 | [x] PR1 (stats rame live) |
| RAM-03 | N° de série auto +1 | P1 | A1.1 | [x] PR1 (nextSeriesNumber par série) |

## LVM — LIVEMAP & AFFICHAGE  (P1)  [schémas annexes 1-5]
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| LVM-01 | Icônes train en 3 déclinaisons couleur + générique : Voyageur / Fret / Travaux | P1 | annexe 2a | [x] PR1 (assets img/livemap + _drawTrainIcon) |
| LVM-02 | Langage carte : voies 1/1bis/2/2bis, points de voie, tronçon [AB] | P1 | annexe 3A | [x] existant (voie points étiquetés + tronçons rendus) |
| LVM-03 | Bandeau train : indications qui défilent + barre de rame sensible même en marche | P1 | annexe 4 | [x] PR6 (bandeau défilant .lvp-bandeau + images rame sidebar) |
| LVM-04 | Clic sur train → panneau détail (arrêts + heures arr/dép) | P1 | annexe 5 | [x] PR6 (_findServiceAtScreen + panneau arrêts/horaires) |
| LVM-05 | Gares créées apparaissent sur la livemap (bug actuel) | P0 | A5.2, A14#10 | [x] drawStations lit world.stations en direct (rendu live) |
| LVM-06 | Sélection train depuis carte → affiché en haut du bandeau | P1 | annexe 4-5 | [x] PR1 (tc-selected + scrollIntoView start) |

## IG — INFOGARE  (P2)  [schémas styles]
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| IG-01 | CATI : versions 3-3 / complète / arrivée (retard + voie) | P2 | A11.1, annexes | [x] PR? (CATI 3-3 + arrivals SNCF) |
| IG-02 | AFL départ (retardé X min / supprimé + texte incident) | P2 | A11.1, annexes | [x] PR? |
| IG-03 | AFL arrivée (colonne Voie) | P2 | A11.1, annexes | [x] PR? |
| IG-04 | Palettes animées (horloge + perturbation, liste arrêts défilante) | P2 | A11.1, annexes | [x] PR? (Old SNCF split-flap + Solari) |
| IG-05 | Info train (1 train) | P2 | A11.1 | [x] PR? (clic sur train → plateforme GL/banlieue) |
| IG-06 | Flash circulation (panneau bleu perturbation) | P2 | A11.1, annexes | [x] PR? |
| IG-07 | Scroll infini sur 24h | P2 | A11.1 | [x] PR? |

## DSH — DASHBOARD / FINANCE / BANQUE  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| DSH-01 | Dashboard reçoit Finances + Banque (fusion) | P1 | A1.1, A11.2 | [x] PR1 |
| DSH-02 | Schémas nets (fin du flou/pixélisé), MAJ temps réel, arrondi 0,1 | P1 | A11.2 | [~] PR1 (arrondi 0,1 + gros chiffres) |
| DSH-03 | Grandes valeurs : case s'agrandit pour ne pas disparaître | P1 | A11.2 | [x] PR1 (word-break, overflow visible) |
| DSH-04 | Vue synthèse + drill-down (rester lisible) | P1 | review | [ ] |

## GM — GRAPHIQUE DE MARCHE  (P1)  [schéma jTrainGraph]
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| GM-01 | Graphique A↔B reproduisant le modèle jTrainGraph | P1 | A11.3, annexe finale | [ ] |
| GM-02 | Une ligne par gare RÉELLE (alimenté par SC-02) | P1 | A11.3 | [ ] |
| GM-03 | Axe 24h, bandes horaires, diagonales, labels train/heure | P1 | annexe finale | [ ] |
| GM-04 | Distance réelle (pas vol d'oiseau), styles trait par type, multi-voies, croisements | P1 | A11.3 note | [ ] |

## IND — INDUSTRIELS  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| IND-01 | Page Industriels : création/modif/suppression/déplacement clients sur livemap | P1 | A7, A1.1 | [ ] |

## NAV — CONSOLIDATION DES PAGES  (P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| NAV-01 | Fusion Finances → Dashboard | P1 | A1.1/A1.2 | [x] PR6 (sous-onglet Finances sous Dashboard) |
| NAV-02 | Fusion Banque → Dashboard | P1 | A1.2 | [x] PR6 (sous-onglet Banque sous Dashboard) |
| NAV-03 | Fusion Syndicats → Personnel | P1 | A1.2 | [x] PR6 (sous-onglet Syndicats sous Personnel) |
| NAV-04 | Fusion Saisons → Météo | P1 | A1.2 | [x] PR6 (sous-onglet Saisons sous Météo) |
| NAV-05 | Suppression page Correspondances | P1 | A1.2 | [x] PR6 (bouton nav retiré) |
| NAV-06 | Suppression page Gares+ (fonction relogée dans détail gare) | P1 | A1.2 | [x] PR6 (bouton nav retiré ; page atteignable via détail gare) |
| NAV-07 | Suppression page Aiguillages (logique → graphe orienté) | P1 | A1.2 | [x] PR6 (bouton nav retiré) |
| NAV-08 | Suppression page ITE+ (doublon Dépôts/ITE) | P1 | A1.2 | [x] PR6 (bouton nav retiré) |
| NAV-09 | Suppression page Triage (lieu conservé via ORM service=yard) | P1 | A1.2, A2.2 | [x] PR6 (bouton nav retiré ; lieu ORM conservé) |
| NAV-10 | Barre de nav cible = 15 pages (au lieu de ~26) | P1 | A1.1 | [x] PR6 (24 → 14 boutons de nav) |
| NAV-11 | Incidents CONSERVÉE (page), seule la création manuelle supprimée | P1 | A2.1 | [x] page Incidents conservée dans la nav |

## SAV — SAUVEGARDE  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| SAV-01 | Persister l'état complet (rien à ressaisir à la réouverture) | P0 | A8.4, A18 | [ ] |
| SAV-02 | Delta-encoding des coordonnées conservé | P1 | A13 | [ ] |
| SAV-03 | Prix au km / réglages / positions / états persistés | P1 | A8.2, A8.4 | [ ] |

## DET — DÉTERMINISME  (P0)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| DET-01 | PRNG à seed unique de partie (suppression/pannes/incidents) | P0 | A17 | [ ] |
| DET-02 | Même seed + mêmes actions ⇒ même déroulé | P0 | A17 | [ ] |
| DET-03 | Exception : saut d'arrêt [C]/[S] hors seed (cf. ARR-05) | P2 | A17 | [ ] |
| DET-04 | Boucle simulation à pas fixe déterministe découplée du rendu | P0 | A13 | [ ] |
| DET-05 | Curseurs de réalisme (physique/météo/pannes/tolérance retard) | P2 | A17 | [ ] |

## ARC — ARCHITECTURE & PERFORMANCE  (P0/P1)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| ARC-01 | Modèle de données A12 implémenté (Node/Edge/Canton/Signal/Gare/Ligne/ITE/Dépôt/Engin/Rame/Trajet/Service/Contrat/Agent) | P0 | A12 | [ ] |
| ARC-02 | Rendu : n'afficher que les points de voie (FPS) | P1 | A13 | [ ] |
| ARC-03 | LOD selon zoom + culling hors écran | P1 | A13 | [ ] |
| ARC-04 | Option carte basique (sans tracés ORM) + satellite + .org/.app | P2 | A13 | [ ] |
| ARC-05 | Streaming/chargement progressif ORM par zone | P1 | A13 | [ ] |

## BUG — BUGS CONSOLIDÉS  (P0 majoritaire)
| ID | Exigence | Prio | Source | Statut |
|----|----------|------|--------|--------|
| BUG-01 | Trains en avance (cf. PH-07) | P0 | A14#1 | [x] PR? (delay clamped ≥0 dans arriveAtStation et _updateContinuousDelay) |
| BUG-02 | Routage étrange A→B (cf. R-03/R-04) | P0 | A14#2 | [x] PR? (manual trace 50m + ORM fallback droit supprimé) |
| BUG-03 | Aller-retour aléatoire (cf. SC-04) | P0 | A14#3 | [x] PR4/PR5 (returnRoutes/returnStopsData fixes the independent return path) |
| BUG-04 | Auto 24h sans effet (cf. SC-05) | P0 | A14#4 | [x] PR? (createAutoRoundTripDuplicates + duplicateService) |
| BUG-05 | Points random ajoutés (cf. R-09) | P0 | A14#5 | [x] PR? (points 50m provenant de _densifyRoute, pas de points parasites) |
| BUG-06 | Bug de minuit → horloge en minutes absolues | P0 | A14#6 | [x] comparaisons midnight-safe (timeDiff/timeGte/isInServiceWindow) + horloge Paris |
| BUG-07 | Bug 1440 min → modulo 24h propre | P0 | A14#7 | [x] normalisation ((m%1440)+1440)%1440 partout (affichage + fenêtres service) |
| BUG-08 | Horaires non MAJ → recalcul auto à l'édition | P0 | A14#8 | [x] PR? (recalcStopsFrom + recalcul terminus wait) |
| BUG-09 | "objectif avance 0%" → corriger calcul d'avancement | P1 | A14#9 | [ ] |
| BUG-10 | Gares créées invisibles (cf. LVM-05) | P0 | A14#10 | [x] PR? (world.addStation + renderer.drawStations) |
| BUG-11 | Images Dashboard/Graphique zoomées → recadrage/responsive | P1 | A14#11 | [ ] |
| BUG-12 | Point de voie qui s'efface (souris hors cadre) → découpler validation du focus + Échap/Entrée | P1 | A14#12 | [x] PR? (validation Entrée dans le modal) |
| BUG-13 | Aiguillages décoratifs (cf. R-08) | P0 | A14#13 | [x] PR? (R-08 intégration graphe) |

---

## COMPTEUR
- Domaines : 33
- Exigences atomiques : ~185 (hors décisions déjà tranchées marquées [x])
- P0 : socle simulation · P1 : gestion · P2 : confort

## TRANCHE VERTICALE (A16) — corridor pilote
**Paris Gare de Lyon → Villeneuve → Melun → Montereau → Sens → Laroche-Migennes → Dijon-Ville → Modane**
(= axe du graphique jTrainGraph fourni). Doit prouver : R-01→R-05, PH-01→PH-07, VIT-01→VIT-05, SIG-01→SIG-07, SC-02, GM-01→GM-02, SAV-01.
