# CHECKPOINT RC28 — Référentiel ferroviaire complet

- Socle embarqué conservé : 31 009 gares RailNet strictes.
- Synchronisation complémentaire automatique des gares ferroviaires lourdes dans les pays déjà desservis.
- Métro / tram / bus purs exclus.
- Gares marchandises / triages : railway=yard et tags fret associés.
- ITE : service=spur / usage=industrial, regroupées par site pour éviter les voies dupliquées.
- France : Cerema ITE 3000 prioritaire (2 864 ITE, mise à jour 08/07/2026).
- Cache IndexedDB 60 jours + bouton de resynchronisation manuelle dans Paramètres.
- Les points fret/ITE restent distincts d'une gare voyageurs accolée.
