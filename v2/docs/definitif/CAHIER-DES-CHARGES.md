# Rail Empire définitif — cahier des charges (gravé dans le marbre)

Décortication exhaustive du chat n°1 (voir `chat-01-messages-utilisateur.md` pour le texte brut).
Chaque puce est une exigence à tenir dans la V2. Rien n'est optionnel sauf mention « idée ».

## 0. Contraintes globales
- Jouable **téléphone et PC**, **hors connexion** (`file://`, sans serveur).
- **1 500 trains simultanés** sans latence, OOM ni ralentissement avec **500 Mo de RAM dispo** ;
  **1 000 rames** sur un « merguez PC ». Ces chiffres sont des **plafonds minimum** sur la config la plus pourrie.
- Allègement **sans rien perdre** : une seule couche définitive par système, plus d'empilement.
- Toutes les pages **communiquent entre elles** (données partagées, une vérité par domaine).
- Tycoon poussé au max ; accélération du temps payante **uniquement hors livemap**.
- **Crash impossible lors d'une sauvegarde.**
- Sandbox mais rentabilité et parts de marché visées (si IA activée). **Réaliste à l'euro près.**
- Le joueur peut rouvrir des lignes / modifier les specs via **requête au gestionnaire d'infrastructure**
  (propriété intégrale du réseau par le GI, comme IRL). Les trains INFRA appartiennent au GI.
- Paramètres : mode **facile / expert**. Facile = systèmes expert utilisables sans pénalité.
  Expert = roulements + personnel + dépôts obligatoires avec impact, IA concurrentes ON.
- Concurrence IA (type OpenTTD) activable/désactivable dans les paramètres.
- Toutes les pages compréhensibles par un **rookie**.

## 1. Livemap
- Légère refonte UI.
- Bug « en panne » à durée infinie empêchant le train de repartir : à corriger.
- Aider le joueur quand une DDS (demande de secours) est requise.
- Aucune gare perdue ; **finir les ajouts** (ORM en manque plein), corriger placements foireux,
  supprimer les gares inexistantes, **jamais 2 gares aux mêmes coordonnées GPS**.
- Barre de scroll du panneau rame qui revient au début : à réparer.
- Les **frets ne partent jamais à vide** ; les trains peuvent être remplis à **100 %**.
- Remplissage voyageurs **raccord avec la démographie**.
- Seuls les trains cochés **Voyageurs** transportent des passagers ; seuls **FRET / TTX / INFRA**
  transportent des tonnes ; les autres ne transportent **rien**.
- Vue GPS pas 100 % stable : à fixer ; **relief 3D** cochable/décochable.
- Bandeau gauche au clic train : beau, moderne, lisible, flèche fluide, **sans supprimer de donnée**.
- Bandeaux d'incidents qui font ramer : à optimiser.
- Pas de trains de roulement affichés à l'envers ni de tailles d'images modifiées.
- IA concurrentes qui grignotent des parts de marché + petits journaux « presse européenne »
  fêtant les nouveautés (lien service presse / marketing).

## 2. Matériel → « Catalogue du jeu »
- Mieux classer, finir le catalogue.
- Outil externe pour travailler dessus, fournissant un **JSON à recharger** qui met le catalogue à jour
  **sans impacter les rames des joueurs** (sauf nom des engins et données).
- L'ancien « Inventaire » devient « Catalogue du jeu ».

## 3. Inventaire (nouvelle page)
- Engins possédés par le joueur : vendre, radier, envoyer en entretien, voir les affectations par rame.
- Aide aux roulements (retrouver locs et voitures).
- Automotrices : **toujours 2 numéros** (ex. Z26501/2).
- Barre de recherche stable et bien faite.
- Changer la **livrée** d'un engin (même type uniquement, ex. BB26001 béton → en voyage).

## 4. Concession (nouvelle page)
- Achat en quantité ; le jeu demande le **numéro de série du premier engin** et poursuit la numérotation ;
  mémorise où il en est dans la série pour les achats suivants.
- Barre de recherche. Prix du neuf = prix du catalogue.
- Livraison directe dans l'Inventaire. Plusieurs engins (en grand nombre chacun) en **une commande**.

## 5. Occasion (nouvelle page)
- Même concept, tarifs réduits, **enchères** (IA) + achats directs.
- Matériel plus usé, donc moins fiable.

## 6. Rames
- Faciliter **duplicata** et **affectations** ; ramener une rame à une gare moyennant un tarif.
- 1 000 rames sans souffrir.

## 7. Horaires / Schedule Creator
- Faciliter les duplicata. Consolider les fondations, corriger **tous** les bugs.
- Réviser l'UI (parfois incompréhensible), virer l'obsolète, faciliter la vie et les affectations.
- ITE et dépôts avec des **icônes différentes des gares**.
- Sélection « Voyageur » → choix de l'**offre** à appliquer ; fret → offre selon vitesse de rame.

## 8. Dashboard / QG
- RAS sauf optimisation, plus de data, et bug de la page qui **remonte toute seule** au scroll.
- **Export PDF** récapitulatif complet (rames incluses, sans image goofy ni collée), période **7 jours → 1 an**.
- QG = dashboard lite.

## 9. Roulements
- **Refonte intégrale**, graphiques parfaits, aucun rookie perdu.
- Pouvoir **forcer une validation**.

## 10. Infogare
- **Refonte complète** : belle, moderne, tous les arrêts **et les arrivées**.
- Plus d'OOM à la sélection ; changer de gare **sans changer de page ni F5**.

## 11. Dépôt / ITE
- Création facilitée (mêmes solutions que le Schedule Creator). Gestion facilitée.
- **Payer pour gagner du temps** sur commandes / réparations.
- ITE : prend en compte les **industriels dans un rayon de 15 km**.

## 12. Incidents / Travaux
- Scroll latéral bloqué : à réparer.
- Création de travaux plus facile, **condamner plusieurs voies** simplement.
- Incidents en gare **uniquement** quand le train est à une gare d'arrêt prévue à l'horaire.
- **Pas d'incidents au départ, ni lors des arrêts** (pas « 3 incidents au départ »).
- Panne → **freinage d'urgence**, jamais 160 → 0 en 0 s.
- **Curseur 0–10 par incident** : 0 = rien, 10 = « singe » (10 nouveaux incidents/min pendant 1 h).
- Tolérance : même durée → une panne de porte + forte affluence simultanées acceptable.
- **Ne jamais perdre les motifs de retard**, même si le train revient à l'heure.
- Interdire les pannes à **0 % d'usure**.

## 13. Usure
- Système complet refait : **100 % = 50 000 km** parcourus depuis mise en service/achat.

## 14. Marchandises / Industriels
- Marchandises : impeccable, à **raccorder au reste du jeu**.
- Industriels : **tous**, positions exactes, cohérents, reliés au jeu (ITE 15 km).

## 15. Personnel
- Optimiser, communication avec dépôts/ITE. **Payer pour former immédiatement.**
- Actions de **masse** (pas 100 clics). Recruter plus de monde.
- Régulateurs/aiguilleurs affectés à une **gare** ; nom du lieu modifiable **dans la page personnel seulement**
  (le nom livemap ne change pas).

## 16. Marketing
- Tout à revoir : images/photos, avis variés et cohérents (plus que 3, sans boucle), stats justes.
- Service presse (journaux) lié aux IA / nouveautés.

## 17. Offres (remplace l'idée de filiales)
- Offres **voyageur** (options libres) et **fret** (selon vitesse de rame), choisies dans le Schedule Creator.
- **TTX** roule pour le joueur et les compagnies TTX européennes par pays ; **INFRA** pour le GI.

## 18. Livrées
- Page livrée à fiabiliser.
