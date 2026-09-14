# Rail Empire — RC19 FULL

Jeu complet, sources TypeScript, ressources et historique des tests. Le build courant est `S3_GAMEPLAY_REPAIR_RC19_FIELD_SIGNALS_FINANCE_REPLAY_1199repair19` (version applicative historique 1.1.99).

**Commencer par [LIRE_AVANT_RC19.md](LIRE_AVANT_RC19.md).** Exporter la partie avant migration, ne pas superposer les dossiers, ne pas vider les données du site.

[Rapport RC19](RE_REPARATION_RC19_RAPPORT.md) · [Retour de terrain et critères](RE_REGISTRE_RETOUR_TERRAIN_RC19.md) · [Qualification](QA/RE_REPAIR_RC19/SUMMARY.json)

Lancer `LANCER_RE.cmd` et conserver l'adresse/port habituels. Les fichiers compilés nécessaires au jeu sont fournis. Le lanceur n'est pas modifié dans cette livraison.

## Développement

Environnement de qualification : Node 22.16.0, TypeScript 5.8.3, Chromium sous Linux. La compatibilité réelle Opera/Win7 reste à éprouver. Commandes :

```text
npm run build:repair
npm test
npm run test:repair
npm run test:s3-regression
python scripts/rc19-browser-field.py
node scripts/benchmark-rc19.cjs /chemin/vers/RC18
```

Les cinq nouveaux modules passent une configuration stricte isolée. Les anciennes déclarations globales permissives et la dette de typage documentée dans RC18 restent présentes ; aucune certification de typage strict intégral n'est annoncée.

L'ancien guide est conservé dans [README_HISTORIQUE_RC18.md](README_HISTORIQUE_RC18.md). Ses résultats et mentions « version actuelle » sont historiques.
