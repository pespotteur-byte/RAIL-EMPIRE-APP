# Rail Empire — RC18 FULL

Version complète : jeu, sources TypeScript, ressources et historique des tests. Le numéro applicatif reste 1.1.99 ; le build courant est `S3_GAMEPLAY_REPAIR_RC18_AUDIT_FIXES_1199repair18`.

**Commencer par [LIRE_AVANT_RC18.md](LIRE_AVANT_RC18.md).** Ne pas extraire par-dessus une ancienne version, ne pas effacer les données du navigateur et ne pas garder deux versions ouvertes en même temps.

[Rapport RC18](RE_REPARATION_RC18_RAPPORT.md) · [Registre des corrections](RE_REGISTRE_AUDIT_RC18.md) · [Audit TypeScript](AUDIT_TYPESCRIPT_RC18.md) · [Preuves finales](QA/RE_REPAIR_RC18/SUMMARY.json)

## Démarrage

Lancer `LANCER_RE.cmd` et conserver l’adresse et le port habituels. Ce lanceur local et ses alternatives n’ont pas été modifiés dans RC18. Les fichiers nécessaires pour jouer sont fournis ; reconstruire le projet n’est pas nécessaire.

Les détails de développement et les guides antérieurs sont conservés dans [README_HISTORIQUE_RC17.md](README_HISTORIQUE_RC17.md). Leurs mentions « version actuelle » sont historiques ; elles ne remplacent pas ce guide.

## Qualification développeur

La qualification RC18 a utilisé Node 22.16.0, TypeScript 5.8.3 et Chromium sous Linux. Le poste de jeu Opera/Win7 n’est pas certifié par ces tests. Avec un environnement de développement compatible :

```text
npm run build:repair
npm test
npm run test:repair
npm run test:s3-regression
node scripts/audit-typescript-deep.cjs
```

Le dernier script produit volontairement le bilan des erreurs masquées par les déclarations historiques : il n’applique pas ses options au jeu et n’émet aucun JavaScript. Une compilation ordinaire sans erreur ne signifie pas que le typage strict est terminé.
