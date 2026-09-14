# Rail Empire 1.1.99 — RC25 CATALOG FINAL

## Portée
RC25 conserve le gameplay RC24 et ajoute le dernier chantier de livraison : le catalogue externe autonome.

## Catalogue externe
- Exécutable Windows x64 : `catalogue-externe/RailEmpireCatalogEditor.exe`.
- Exécutable Windows x86 : `catalogue-externe/RailEmpireCatalogEditor-x86.exe`.
- Base embarquée : **36 307 engins**.
- Recherche/pagination, modification, ajout et suppression.
- Modèle de caractéristiques + copie des specs vers une sélection.
- Import d'un dossier/famille d'images avec specs communes et noms/images propres à chaque engin.
- Autosauvegarde du travail.
- Export JSON et TAR.GZ.
- Réimport d'un projet JSON/TAR.GZ dans l'éditeur.

## Intégration dans Rail Empire
La page **Matériel Roulant** contient désormais :
- `Importer un catalogue` ;
- `Retirer le catalogue externe`.

L'overlay externe est mémorisé en IndexedDB et appliqué après le chargement du catalogue complet. Les modifications effectuées ensuite par le joueur sur une fiche catalogue restent prioritaires.

## Validation
- TypeScript strict : PASS.
- Audit TypeScript : PASS.
- Repair : **1084/1084**.
- Régression S3 : **277/277 fichiers actifs**.
- Post-RC25 ciblé : **35/35**.
- E2E éditeur : édition, duplication specs, import famille, suppression, reset, JSON, TAR.GZ, réimport : PASS.
- E2E parseur jeu : JSON + TAR.GZ + images + priorité des fiches joueur : PASS.

## Note Windows
Les exécutables Windows sont cross-compilés depuis la même source Go que le binaire E2E validé. L'environnement de qualification est Linux : le PE Windows n'a pas été exécuté sous Windows dans cette session.
