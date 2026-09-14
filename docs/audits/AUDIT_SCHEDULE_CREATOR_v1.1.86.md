# Audit Schedule Creator V2 — v1.1.86

## Conclusion
L'audit global a confirmé que les régressions récentes ne provenaient pas d'un seul aiguillage ou endpoint. Le Schedule Creator avait accumulé plusieurs chemins de routage, politiques de cache, fallbacks et cycles de revalidation pouvant produire des résultats différents selon la distance et l'état de session.

La v1.1.86 remplace cette logique de hotfixs successifs par un pipeline exact commun et ferme les défauts structurels qui pouvaient produire latence, faux « aucun itinéraire », mauvaise voie sélectionnée, kilométrage désynchronisé ou mutations partielles.

## Défauts structurels confirmés et traités

1. Seuil de stratégie autour de 3 km.
2. Pipeline exact contourné pour certains trajets courts.
3. Politiques Overpass différentes selon les branches.
4. Hedging perdu dans un wrapper intermédiaire (héritage 1.1.84).
5. Scan IndexedDB historique massif avant un routage interactif.
6. Route cache invalidé par simple lecture d'une tuile persistée.
7. Route-memory rendue inaccessible après changement artificiel d'epoch.
8. Préfetch partiel pouvant être confondu avec acquisition complète.
9. Tuile centrale manquante transformant un long trajet en faux NO_CONNECTED_PATH.
10. Élargissement de corridor avant réparation ciblée du trou réseau.
11. Diagnostics de fetch globaux et exposés aux courses.
12. Broad-area incapable de distinguer réponse vide valide et panne fetch.
13. Routage régional pouvant conclure « aucun trajet » sur topologie partielle.
14. Routage long pouvant conclure « aucun trajet » sur topologie partielle.
15. Revalidation réseau automatique des horaires au boot.
16. Revalidation pouvant concurrencer l'édition interactive.
17. Recalcul réseau déclenché par changements sans topologie.
18. Validation déclenchant inutilement un reroutage complet.
19. Ancien calcul async non réellement annulé.
20. Cache résident capable de voler un clic à une voie parallèle plus proche.
21. Réponse OSM-main partielle capable d'empêcher la recherche de la vraie voie.
22. Plusieurs copies de l'assemblage legs → path.
23. Distance de preview non cumulée après plusieurs arrêts.
24. Préfixe résolu effacé lors de certains échecs suffixe.
25. Validation ne vérifiant pas assez strictement points/segments/kilomètres.
26. Runtime plus permissif que la validation sur intégrité de route.
27. Profil de référence incomplet sur gabarit/charges.
28. U-turn dans un leg seulement pénalisé mais encore possible.
29. Changement de sens entre legs non lié explicitement à TAQ.
30. loadFromSave Schedule destructif avant validation.
31. loadFromSave Rotation destructif avant validation/migration.
32. loadFromSave Runtime destructif avant validation.
33. Undo/redo pouvant muter les stacks avant restauration confirmée.
34. Génération de fréquence non atomique.
35. Génération aller/retour non atomique.
36. Suppression de point technique pouvant laisser des VIA indexés sur les anciens legs.
37. Suppression calendrier et références croisées insuffisamment synchronisées.
38. Métadonnées nom/numéro passant encore par des chemins de mutation Schedule.
39. Helper de secours régional existant mais historiquement non appelé.
40. Micro-coupures OSM réelles non couvertes au-delà des rescues 1,2/1,8 m.
41. Première version du rescue 4 m potentiellement O(n²) sur un grand graphe — détectée pendant l'audit et remplacée avant release par un index spatial.
42. Identité de release dispersée entre index/package/VERSION/package-lock/build script.

## Principes imposés après refactor

- La longueur change la quantité de données à acquérir, pas le modèle de vérité du routage.
- Les voies/nœuds OSM sont la géométrie finale autoritaire.
- Une acquisition réseau incomplète n'est jamais une preuve d'absence d'itinéraire.
- Les réparations topologiques sont locales, bornées, graph-only et ne modifient jamais les ways OSM source.
- Un cache ne doit pas changer le résultat logique du trajet.
- Une mutation composée est atomique.
- Un horaire VALID sauvegardé n'est pas remis en cause au boot uniquement parce qu'Overpass n'est pas disponible.
- L'UI, le kilométrage, le timing et le runtime doivent partager la même géométrie canonique.
