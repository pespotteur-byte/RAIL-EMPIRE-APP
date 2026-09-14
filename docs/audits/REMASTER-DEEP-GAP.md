# RAIL EMPIRE REMASTER — Analyse de profondeur : écarts vs. cahier des charges

## Méthode d'analyse

1. Extraction du texte complet du doc `RE+REMASTER+3.docx` (310 paragraphes, 28 images).
2. Lecture intégrale de la checklist `REMASTER-CHECKLIST.md` (374 lignes, 214 exigences).
3. Croisement section par section avec les sources `js/*.js` et `index.html`.
4. Description manuelle des 18 annexes visuelles les plus parlantes.
5. Exécution de la suite de tests : `npm test` → **66/66 passent**.

---

## Synthèse globale

- Le **cœur fonctionnel** (routage ORM, physique temps réel, horaires, sauvegarde, économie, personnel, incidents, météo, fret, ITE, DDS) est implémenté et testé.
- Les 214 exigences de la checklist sont cochées `[x]`, mais une partie est marquée `PR?` : cela signifie que le code existe mais n'a pas été validé visuellement ou en condition réelle.
- Les **écarts les plus visibles** concernent le **livemap** (noms de voies 1/1bis/2/2bis, flèches de direction, style du panneau détail), l'**Infogare** (reproduction pixel-perfect des écrans SNCF) et le **Graphique de marche** (jTrainGraph).
- La cible **100 k trains simultanés à 30 FPS sur Windows 7 32 bits / 3 Go RAM** ne peut pas être atteinte en navigateur : il faudrait une application native 32 bits (hors scope actuel).

---

## Détails par section du document

### I – Livemap (page Carte)

#### Ce qui est en place
- Icônes directionnelles par catégorie (Voyageur / Fret / Travaux / Machine) avec rotation selon le cap (`js/renderer.js:761`).
- Clic sur un train : sélection + panneau détail avec heures barrées/recalculées, prochain arrêt, situation "Se situe entre A et B" (`js/ui.js:663`).
- Bandeau latéral défilant avec distance jusqu'au prochain arrêt et icône catégorie (`js/ui.js` bandeau).
- Affichage des points de voie, tronçons, gares, dépôts, ITE, industriels (`js/renderer.js`).
- Toggle Satellite / Radar / Nuages / ORM (`js/renderer.js:89`).
- Carte basique : le toggle ORM permet de masquer les tracés ORM.

#### Écarts / à valider
- **Langage de la carte Annexe 3A** : les noms de voies `1 / 1bis / 2 / 2bis` ne sont pas rendus en bulles bleues. ORM parse `name`/`ref` (`js/orm.js:165`) mais le renderer ne les affiche pas.
- **Flèches de direction** `Direction PARIS` / `Direction DIJON` en haut de carte : non implémentées.
- **Barre de rame "sensible même en marche"** : le survol/scroll dans le bandeau fonctionne, mais la barre de composition de la rame n'est pas affichée en mode mouvement.
- **Superposition des arrêts cliquables sur le tracé** : la distinction visuelle entre `tracé objectif` (rose) et `tracé actuel` (jaune) du doc (image 015/018) n'existe pas ; seul le tracé ORM/final est affiché.
- **Occupation des points de voie** : `voie ${vp.voie}` est affichée en tooltip, mais pas les noms de voie OSM (`1bis`, `2bis`, etc.).

### II – Matériel

#### Ce qui est en place
- Création d'engin avec Visuel / Identification / Caractéristiques / Capacités / Tarification (`js/ui.js`, `index.html`).
- Suppression du champ "Numéro" (séries auto) (`js/ui.js:1482`).
- Traction multi-sélection : Diesel, Vapeur, 1,5 kV, 3 kV, 15 kV, 25 kV, 3e Rail (`index.html:628`).
- Tonnage automatique = masse à vide + capacité fret (`js/rolling-stock.js`).
- Prix d'achat automatique (`js/ui.js:1424`).
- Sous-catégories wagon (`index.html` / `js/rolling-stock.js`).

#### Écarts
- L'image 008 (modal d'ajout d'engin V1) est remplacée par un formulaire plus compact. C'est acceptable, mais le style final n'a pas été comparé à l'annexe 6b/7.

### III – Rames

#### Ce qui est en place
- Composition avec recherche, filtres, statistiques live (`js/ui.js` page Rames).
- Numérotation automatique des séries (`BB26000` → `BB26001` …) (`js/schedule-creator.js:156`).
- Affichage 50/100/1000 rames par page (`js/ui.js`).

### IV – Horaires (Schedule Creator)

#### Ce qui est en place
- Interface carte + formulaire, gares cliquables, waypoints, arrêts C/S/[C]/[S].
- Traçage manuel avec points tous les 50 m, déplacement et suppression des points (`js/ui.js:2402`).
- Calcul des temps de passage pour toutes les gares réelles du trajet (`js/schedule-creator.js`, `_passageStops`).
- Aller-retour et Auto 24h générant des duplicatas (`js/ui.js:2099`, `js/schedule-creator.js:2182`).
- Sillons automatiques proposés à la création (`js/ui.js:2860`).
- Recalcul auto à l'édition, gestion du minuit, 1440 min.
- Tableau de 50 trajets/pagination, détail déroulant (`js/ui.js:3967`).

#### Écarts
- **Schémas Annexe 10a/10b/10c** : les couleurs `Tracé objectif` vs `Tracé actuel` ne sont pas affichées dans l'UI. Le tracé manuel dessine un aperçu jaune, sans légende.
- **Aiguillages / IPCS** : les points blancs numérotés et la légende de l'image 009 ne sont pas affichés. Le graphe orienté existe (`js/orm.js` `_buildUnifiedGraph`), mais le visuel explicite des itinéraires alternatifs manque.
- **Insérer un arrêt entre deux existants** : bouton `+` présent (`js/ui.js:3213`), fonctionnel à vérifier en jeu.

### V – Lignes / Sillons automatiques

#### Ce qui est en place
- `LineManager` et `SillonManager` (`js/line.js`, `js/sillon.js`).
- Création de ligne via une mini-carte et liste d'arrêts (`js/ui.js:4319`).
- Sillons proposés dans le Schedule Creator (`js/ui.js:2860`).

#### Écarts
- La création de ligne repose encore sur une carte (même si réduite) ; le retour joueur demandait un système autre que la carte pour 200+ gares. Aucun mode "liste avec recherche" n'est disponible.

### VI – Dépôts / ITE

#### Ce qui est en place
- Dépôts avec rotonde / technicentre, voies de remisage (`js/depot.js`).
- Stocks de pièces détachées (moteur, climatisation, fanaux, freins, portes) (`js/depot.js:27`, `js/ui.js:5000`).
- Locomotives de secours (max 2 par dépôt) (`js/depot.js:195`).
- DDS : demande de secours, rapatriement, réparation (`js/depot.js:225`).
- ITE avec types de cargaison, longueur, tranches, grues/portiques (`js/industrial-clients.js`, `js/depot.js:177`).

#### Écarts
- Le doc mentionne que le joueur doit **tracer à la main les emprises (voies) de l'ITE** et les nommer. Le code permet de créer un ITE et d'ajouter des voies, mais le parcours utilisateur n'a pas été validé visuellement.
- **Notifications d'achat de pièces** : alerte de stock faible présente, mais le flux "notification → validation joueur → commande" est manuel ; il n'y a pas de prompt d'approbation automatique.

### VII – Incidents / Travaux

#### Ce qui est en place
- Table des incidents prédéfinis (Panne de signalisation, Accident de personne, Défaut d'alimentation, etc.) avec probabilités, saisons, durées (`js/incidents.js:6`).
- Zone d'impact par tronçon A-B, pas de cercle.
- Régulation : ordre de passage, garages, agents de circulation, régulateurs (`js/staff.js`, `js/simulation.js`).
- Travaux : fermeture de tronçon, récurrence, TTX, reroutage (`js/works.js`).

### VIII – Finances / Dashboard

#### Ce qui est en place
- Dashboard fusionné avec Finances et Banque (`js/ui.js`, `js/economy.js`, `js/bank.js`).
- Prêts ×10 (50 000 → 500 000, etc.), emprunts illimités, remboursements journaliers.
- Coût d'exploitation : énergie, péage, surcoût vitesse (`js/economy.js:82`).
- Prix au km différencié par classification de vitesse, persisté (`js/economy.js:130`).

#### Écarts
- Le **péage** est calculé de manière forfaitaire (`dist * 2 €/km`) et ne correspond pas à un "vrai calcul IRL".
- Les **grands chiffres** ne "s'agrandissent pas dans leur case" : `word-break` existe, mais les KPI peuvent disparaître en très haute valeur.

### IX – Infogare

#### Ce qui est en place
- 8 modes : CATI 3-3 / complet / arrivée, AFL départ/arrivée, palettes, info train, flash circulation (`js/ui.js:7357` et suivants).
- Couleurs SNCF, scroll infini 24h, langues multiples.

#### Écarts
- **Reproduction à l'identique** non validée. Les images 003, 013, 016, 019, 022 montrent des tableaux SNCF très spécifiques (colonne `Voie`, `Particularités`, horloge analogique, logos, pictogrammes bus). Le rendu actuel en est une approximation.
- Le **Flash Circulation** (image 010) affiche un bandeau jaune/bleu ; le code a un style `ig-flash-sign` mais le timing clignotant / exactitude des icônes n'a pas été vérifié.

### X – Dashboard / Graphique

#### Ce qui est en place
- Graphique de marche temps-distance avec axe 24h, stations en Y, diagonales, légende (`js/graph-marche.js`).
- Graphiques financiers arrondis au 0,1.

#### Écarts
- Le **Graphique de marche** doit reproduire à l'identique le **jTrainGraph** (image 005). Le code actuel gère les bases (stations, heures, traits) mais n'a pas la même mise en page (gares horizontales, numéros de trains, épaisseurs/couleurs par voie, croisements). Le doc attend un modèle très précis.

### XI – Personnel / Syndicats

#### Ce qui est en place
- 7 rôles, noms aléatoires par nationalité, embauche multiple.
- 3×8, repos 8h entre services, 24h consécutifs/semaine, risque social.
- Grèves / syndicats (`js/unions.js`).
- Zones de régulation / AC, priorité par axe (`js/staff.js`).

### XII – Banque

#### Ce qui est en place
- Fusion dans Dashboard, prêts à l'échelle ×10, remboursements.

### XIII – Météo / Saisons

#### Ce qui est en place
- Open-Meteo par lat/lon, cache par point, impact freinage/pluie/neige/orage, cap −20 km/h sous neige.
- RainViewer radar + satellite IR.
- Saisons fusionnées dans Météo.

#### Écarts
- Le **vent** n'a pas d'impact (c'est conforme au doc), mais il n'est pas affiché non plus.
- L'image satellite / radar dépend de la connectivité et des tuides RainViewer ; aucune fallback offline.

### XIV – Navigation

#### Ce qui est en place
- 14 pages au lieu de ~26, suppressions demandées (Correspondances, Gare+, Aiguillage, ITE+, Triage, Syndicats, Saisons, Finances, Banque fusionnées).

### XV – Sauvegarde / Déterminisme

#### Ce qui est en place
- Sauvegarde complète, delta-encoding des coordonnées, RNG seedé, temps de jeu persistant.
- Curseurs de réalisme en localStorage.

#### Écarts
- Les **curseurs de réalisme** ne sont pas inclus dans le `saveState` ; ils sont uniquement dans `localStorage`. Un chargement sur une autre machine perd ces valeurs.

### XVI – Performances / Architecture

#### Ce qui est en place
- Modèle A12 (`js/a12-model.js`).
- Culling, LOD, macro-update pour 100 k trains (`js/main.js:566`).

#### Écarts critiques
- **Windows 7 32 bits / 3 Go RAM** : Chrome 32 bits est limité à ~2 Go par processus. Le bench à 100 k trains a mesuré ~2,1 Go RSS totaux sur Chrome 64 bits. C'est **incompatible** avec la cible matérielle sans application native 32 bits.

---

## Annexes visuelles — identification et état

| Fichier | Description | Section doc | État code | Écart principal |
|---------|-------------|-------------|-----------|-----------------|
| `image_000.png` | Icône train générique (ovale + flèche vers le bas) | Annexe 2a | Utilisée avec rotation | Vérifier orientation exacte de la flèche |
| `image_001.png` | Schéma cantons/signaux (voie libre / avertissement / sémaphore) | Annexe 3B | Implémenté (`js/signaling.js`) | Visuel des signaux sur la livemap à valider |
| `image_002.jpg` | Tableau modifications création d'engin | Annexe 7 | Formulaire correspondant | OK |
| `image_003.png` | Infogare départs (retards, destinations, voie) | Infogare | Approximation | Reproduction exacte à valider |
| `image_004.jpg` | Schedule Creator (formulaire complet) | Annexe 9 | Formulaire correspondant | OK |
| `image_005.jpg` | jTrainGraph (Paris Gare de Lyon → Dijon) | Graphique | Base présente | Mise en page non fidèle |
| `image_006.jpg` | Livemap V1.0 (carte, bandeau, toggles) | Annexe 1 | Amélioré | Noms de voie / direction manquants |
| `image_007.png` | Schéma livemap voies 1/1bis/2/2bis | Annexe 3A | Non reproduit | Gros écart visuel |
| `image_008.jpg` | Modal "Ajouter un engin" V1 | Annexe 6b | Refondu | Vérifier cohérence avec Annexe 7 |
| `image_009.jpg` | Schedule Creator avec aiguillages numérotés | Annexe 10d | Graphe orienté, visuel absent | Légende aiguillages / IPCS manquante |
| `image_010.png` | Flash Circulation | Infogare | Style `ig-flash-sign` | Timing / icônes à valider |
| `image_011.jpg` | Page Matériel V1 | Matériel | Refondue | Style plus lisible, OK |
| `image_012.jpg` | Composer une rame | Rames | Implémenté | OK |
| `image_013.png` | Infogare Hettange-Grande départs | Infogare | Approximation | Reproduction exacte |
| `image_014.png` | Icône train colorée (voyageur?) | Annexe 2a | Utilisée | Vérifier couleurs |
| `image_015.jpg` | Schedule Creator : tracé objectif vs actuel | Annexe 10b/c | Non reproduit | Légende / double tracé manquants |
| `image_016.png` | Infogare arrivées (Bourg Saint Maurice) | Infogare | Approximation | Reproduction exacte |
| `image_017.png` | Bandeau + panneau détail train (timeline violet) | Annexes 4-5 | Panneau détail présent | Style timeline / voies non fidèle |
| `image_018.jpg` | Schedule Creator : nouveau tracé requis | Annexe 10b/c | Non reproduit | Mode "comparer tracés" absent |
| `image_019.png` | Infogare arrivées multiples | Infogare | Approximation | Reproduction exacte |
| `image_022.png` | Infogare départs avec colonnes + horloge | Infogare | Approximation | Colonnes `Voie`/`Particularités` à calquer |
| `image_024.png` | Bandeau train / panneau détail | Annexes 4-5 | Panneau détail présent | Style final à calquer |

---

## Top 10 écarts / risques restants

1. **Win7 32 bits / 3 Go RAM** : cible matérielle incompatible avec le navigateur. Nécessite un prototype natif (Rust/C++).
2. **Noms de voies 1/1bis/2/2bis** sur la livemap (Annexe 3A) : non rendus.
3. **Flèches de direction** `Direction PARIS / DIJON` en haut de livemap : absentes.
4. **Graphique jTrainGraph** : approximation, pas de reproduction fidèle.
5. **Infogare SNCF** : style approximatif ; les colonnes `Voie`, `Particularités`, pictogrammes et horloge ne sont pas calqués.
6. **Comparaison tracé objectif / actuel** dans le Schedule Creator : absente.
7. **Légende aiguillages / IPCS** dans le Schedule Creator : absente.
8. **Péage réaliste** : calcul forfaitaire, pas basé sur l'infrastructure réelle.
9. **Realism settings** non inclus dans `saveState`.
10. **Création de ligne** : toujours basée sur une mini-carte, pas de mode liste/recherche pour les grandes gares.

---

## Recommandations / prochain lot

### Option A — Polish visuel prioritaire (recommandé avant industrialisation)
1. Reproduire les noms de voies OSM (`ref`/`name`) sur la livemap.
2. Ajouter les flèches de direction en haut de la carte.
3. Calquer l'Infogare sur les images 003, 013, 016, 019, 022 (tableaux SNCF complets).
4. Améliorer le Graphique de marche pour coller au jTrainGraph.

### Option B — Gameplay / équilibrage
1. Valider le flux complet fret (contrat → chargement → ITE → déchargement → paiement).
2. Valider la maintenance / DDS sur une partie longue.
3. Remplacer le péage forfaitaire par un calcul plus réaliste.

### Option C — Performance / native
1. Prototyper une application Windows 32 bits native (Rust + SDL2/DirectX) pour le moteur simulation + rendering.
2. Conserver le navigateur uniquement pour l'édition UI.

---

## Vérifications techniques

- `npm test` : **66/66 passent** (snapshot de l'analyse).
- `node --check` sur `js/main.js`, `js/ui.js`, `js/schedule-creator.js`, `js/renderer.js` : OK.
- Serveur local `http://localhost:8000/` opérationnel.

---

*Rapport généré le 2026-07-15 — branche `devin/1778401672-orm-direct-system` / PR #1.*
