# HOTFIX80 — rangement du paquet Rail Empire

La racine du jeu a été nettoyée sans déplacer les fichiers nécessaires au lancement ni les sources de catalogue utilisées par les scripts de maintenance.

## Racine conservée
- `index.html`, `admin.html`, `style.css`
- `package.json`, `package-lock.json`, `VERSION.txt`
- `README.md`, `TUTORIEL.md`
- `catalog_mlg.xlsx`, `catalog_france.xlsx`, `CATALOG_NAME_RENAMES_v1.1.95.csv`

## Archives déplacées
- `docs/release-notes/` : anciennes notes de versions
- `docs/audits/` : audits techniques
- `docs/hotfix-history/` : rapports, diffs, checksums et traces des anciens hotfixes
- `docs/development-notes/` : notes de développement et statuts futurs
- `QA/archive-root/` : anciens résultats QA et captures de validation auparavant à la racine
- `tools/probes/` : scripts de reproduction/probes ponctuels

Les dossiers runtime existants (`js/`, `data/`, `img/`, `audio/`, `scripts/`) n'ont pas été déplacés afin de préserver tous les chemins utilisés par le jeu.
