# Saison 3 — TypeScript Alpha 25

Objectif : durcir le modèle Schedule V2 et ses frontières avec Routing / Rotation sans modifier le runtime navigateur.

- `schedule-v2-model.ts` : 125 → 0 `any` explicites comptés par l’audit de propriétés/callbacks.
- Une seule frontière legacy dynamique est conservée : `Record<string, any>` pour les données brutes avant normalisation.
- Dette globale : 7 116 → 6 991 `any` explicites.
- Calendriers, voies, contraintes, segments, legs, profils de performance, versions, groupes aller-retour et persistance disposent de contrats de domaine explicites.
- Les 9 incompatibilités inter-modules révélées par le nouveau typage ont été résolues aux frontières Schedule / Routing / Rotation.
- `schedule-v2-model.js`, `schedule-v2-routing.js` et `rotation-v2-model.js` restent byte-identiques à l’Alpha 24 après compilation.
- Cache navigateur conservé à `1199ts23` tant que le runtime reste identique.
- Validation ciblée Schedule / Rotation : 157/157 tests verts avant la gate cumulative.
- Gate cumulative finale : 173/173 fonctionnels + 32/32 lourds/performance = 205/205 fichiers actifs verts.
- Parité finale : 147/147 fichiers runtime + index.html + deux bundles byte-identiques à l’Alpha 24 officielle.
