# Rail Empire — Tutoriel en Français

## Démarrage

1. **Ouvrir le jeu** : Ouvrez `index.html` dans un navigateur (Chrome/Firefox recommandé). Il faut un serveur local car le jeu utilise des modules ES6 :
   ```bash
   python3 -m http.server 8000
   # ou
   npx serve .
   ```
   Puis ouvrir http://localhost:8000

2. **Nouvelle partie** : Entrez un nom de compagnie et cliquez "Nouvelle Partie".

3. **Reprendre** : Cliquez "Reprendre la partie" pour charger la sauvegarde auto, ou "Charger un fichier" pour importer un `.json`.

---

## La Carte (Livemap)

La carte affiche le réseau ferré réel de France via OpenRailwayMap. Vous pouvez :
- **Zoomer** : molette de la souris
- **Naviguer** : clic + glisser
- **Rechercher** : barre de recherche en haut à droite

### Boutons d'action (en haut à gauche)
- **+ Créer une gare** : cliquez sur la carte pour poser une gare (se snappe à la voie ferrée la plus proche)
- **+ Point de voie** : pose un point de voie manuellement
- **+ Tronçon** : relie deux points de voie avec un tronçon ORM (calcul automatique de la géométrie)
- **+ Tracé manuel** : tracé libre de tronçon sur la carte
- **Tracer ligne** : **(NOUVEAU)** import automatique de l'infrastructure OSM entre deux points

### Filtres visuels
- Gares / Noms / Trains / Points voie : cochez/décochez pour afficher/masquer

---

## Tracer Ligne (Import Automatique)

C'est la feature principale pour construire votre réseau rapidement.

### Comment l'utiliser
1. Cliquez le bouton vert **"Tracer ligne"**
2. Cliquez sur la carte pour définir le **point A** (départ)
3. Cliquez sur la carte pour définir le **point B** (arrivée)
4. Le système importe automatiquement toute l'infrastructure OSM entre A et B

### Ce qui est créé automatiquement
- **Points de voie** aux vrais aiguillages (nœuds OSM où les voies divergent/convergent)
- **Tronçons** entre chaque paire d'aiguillages, avec la géométrie exacte des rails
- **Double voie** détectée automatiquement (voies parallèles dans un rayon de 100m)
- **Vitesses max** issues des données OSM

### Conseils d'utilisation
- **Importez gare par gare** pour de meilleurs résultats : Meaux → Trilport, puis Trilport → La Ferté, etc.
- Les voies de service (garage, triage, spur) sont exclues automatiquement pour éviter le bruit
- Si une voie manque, ajoutez-la manuellement avec "+ Point de voie" et "+ Tronçon"
- Les imports successifs se **connectent automatiquement** aux nœuds OSM partagés

### Supprimer un import
Après un import, appuyez sur la touche **Suppr** pour supprimer d'un coup tous les points et tronçons du dernier import.

---

## Gares

### Créer une gare
1. Cliquez **"+ Créer une gare"**
2. Cliquez sur la carte près d'une voie ferrée
3. La gare se snappe au nœud ferroviaire le plus proche (rayon 2km)
4. Donnez un nom et configurez le nombre de voies à quai (1–30)

### Voies à quai
- Chaque gare peut avoir plusieurs voies (Voie 1, Voie 2, Quai A...)
- Les voies à quai sont des points de voie liés à la gare
- Dans le schedule creator, vous choisissez sur quelle voie le train s'arrête

---

## Matériel Roulant

### Onglet "Matériel"
- Ajoutez des **locomotives** et **wagons** avec leur masse (tonnes) et puissance (kW)
- Les valeurs de masse et puissance affectent la physique du train (accélération, freinage)

### Onglet "Rames"
- Composez des trains en associant locomotives + wagons
- La masse totale et la puissance combinée déterminent les performances

---

## Horaires (Schedule Creator)

### Créer un service
1. Allez dans l'onglet **"Horaires"**
2. Cliquez **"+ Créer un service"**
3. Sélectionnez une rame
4. Sur la carte, cliquez les gares dans l'ordre du parcours
5. Pour chaque arrêt, choisissez :
   - **Arrêt** : le train s'arrête (avec durée configurable)
   - **Passage** : le train passe sans s'arrêter
   - **Waypoint** : point de routage invisible (force le train par un chemin précis)
6. Configurez l'heure de départ
7. Validez

### Waypoints (forcer un itinéraire)
- Dans le schedule creator, cliquez sur la carte (pas sur une gare) pour poser un waypoint
- Le waypoint se snappe sur la voie OSM la plus proche
- Le train est forcé de passer par ce point → utile pour les sorties de gare avec plusieurs itinéraires possibles

### Multi-départs
- Ajoutez plusieurs horaires de départ pour le même service
- Bouton "Auto 24h" : remplit automatiquement les départs sur 24h avec un intervalle régulier

### Aller-retour
- Option pour créer automatiquement le trajet retour

---

## Simulation en Temps Réel

### Trains sur la carte
- Les trains circulent en temps réel sur la carte
- Cliquez sur un train pour voir ses infos dans le bandeau à droite :
  - Position actuelle
  - Vitesse
  - Prochain arrêt
  - Voie occupée
  - Retard éventuel

### Signalisation (Cantonnement)
- Les voies sont divisées en cantons automatiques
- Un canton occupé par un train bloque les trains suivants
- La longueur des cantons dépend de la vitesse (0.6 km à ≤80 km/h, 2.5 km à >200 km/h)

### Occupation des voies
- Les tronçons affichent leur état d'occupation
- Cisaillement détecté quand deux trains se croisent sur un tronçon à voie unique

---

## Incidents et Travaux

### Incidents
- Onglet **"Incidents"** → **"+ Nouvel incident"**
- Définissez : nom, position (clic carte), rayon d'impact, durée, effet (interruption ou ralentissement)
- Les trains dans la zone sont affectés en temps réel

### Travaux
- Planifiez des travaux avec des plages horaires récurrentes (ex: 22h-5h pendant 3 jours)
- Les trains ralentissent ou s'arrêtent dans la zone de travaux

---

## Lignes

- Onglet **"Lignes"** → créez des lignes nommées avec un code couleur
- Associez des services à une ligne
- Les tronçons partagés entre lignes sont affichés avec les couleurs de chaque ligne

---

## Dépôts et ITE

- Créez des dépôts pour garer les rames hors service
- Les ITE (Installations Terminales Embranchées) pour le fret

---

## Finances

- Onglet **"Finances"** : suivi des revenus et dépenses
- Tarif par km configurable
- Solde affiché en permanence dans l'en-tête

---

## Sauvegarde

- **Auto-save** : toutes les 10 secondes dans le localStorage du navigateur
- **Export** : bouton 💾 → télécharge un fichier `.json`
- **Import** : bouton 📂 ou écran d'accueil → charge un fichier `.json`
- **Reprise** : à la reconnexion, le temps écoulé est simulé (jusqu'à 24h) pour que les trains reprennent leur position correcte

---

## Raccourcis

| Touche | Action |
|--------|--------|
| Molette | Zoom |
| Clic + glisser | Navigation |
| Suppr | Supprimer le dernier import "Tracer ligne" |

---

## Astuces

1. **Commencez petit** : créez 2-3 gares proches, un service simple, puis étendez
2. **Tracer ligne gare par gare** : importez segment par segment pour de meilleurs résultats
3. **Complétez à la main** : si une voie manque après l'import, ajoutez-la avec les outils manuels
4. **Sauvegardez souvent** : exportez régulièrement votre partie en `.json`
5. **Navigation privée** : Ctrl+Shift+N pour tester sans interférer avec votre sauvegarde
