# Rail Empire RC12 — lancement et sauvegardes

## Installer sans perdre la version précédente

Exportez votre sauvegarde depuis RC11 et conservez son dossier. Extrayez RC12 dans un **nouveau dossier**, sans mélanger ses fichiers avec les anciennes versions. Les sources TypeScript, les bundles compilés et les ressources sont inclus : aucune compilation n'est nécessaire pour jouer.

Lancez `LANCER_RE.cmd` et conservez l'adresse habituelle `http://127.0.0.1:8765/`, le même port et le même profil de navigateur. Le lanceur Windows/C# reste à valider sur votre machine ; cette session ne le certifie pas sous Win7/Opera. Le serveur Node alternatif est inchangé et ses régressions restent actives.

Une ouverture `file://`, `localhost` et `127.0.0.1`, ou deux ports différents, ne correspondent pas au même emplacement de stockage. Une sauvegarde qui n'apparaît pas sous une autre adresse n'est donc pas nécessairement effacée. Réimportez l'export si nécessaire. Les protections OSM du lancement HTTP local sont conservées.

## Capturer un train bloqué ou limité à basse vitesse

Dans la **LiveMap**, le panneau **Runtime V2** contient le bouton **Exporter le diagnostic des mouvements**. Cliquez lorsque le problème est visible, éventuellement après avoir mis le jeu en pause. Le navigateur produit `Rail_Empire_RC12_mouvement_<horodatage>.json`.

Cet instantané contient les vitesses, raisons d'attente, autorités de mouvement, position dans la liaison, prochain arrêt, temps LOD en attente et résumés des secours. Il est limité par défaut à 512 services, en donnant la priorité aux services arrêtés par une autorité puis aux trains lents ; les comptes globaux et le nombre omis restent indiqués. Les secours sont limités à 100 dans l'export. Les voies complètes, catalogues, objets de stockage et comptes ne sont pas exportés.

Le JSON reste **local** : le jeu ne l'envoie pas automatiquement. Il contient toutefois des noms de trains, identifiants et coordonnées de jeu ; relisez-le avant de le partager. Conservez aussi une sauvegarde complète pour une reproduction : l'instantané n'est ni une sauvegarde restaurable, ni un historique des événements.

Le blocage durable signalé vers 12 km/h **n'est pas annoncé résolu**. Certaines fausses détections de face-à-face sont corrigées, mais leur existence ne prouve pas qu'elles expliquaient ce cas précis.

## Secours et refus de routage

Deux demandes visant le même train ne doivent plus déployer deux locomotives. Un tracé reçu avec une géométrie invalide, un raccord artificiel ou des extrémités incohérentes est refusé plutôt qu'utilisé pour simuler une arrivée. Une cible déplacée impose un nouveau tracé. Des missions mal formées restaurées peuvent donc rester à l'arrêt avec un motif explicite.

Si une erreur expose réellement un statut 401/403, la mission suspend ses relances automatiques. La carte indique son motif ; **Réessayer le routage** nécessite une action manuelle après la temporisation locale d'au moins 15 minutes. Ce délai ne garantit pas que le fournisseur a débloqué l'accès. Un 429/503 respecte `Retry-After` quand ce champ est disponible. Une erreur réseau sans statut lisible n'est pas requalifiée arbitrairement en 403. La protection est locale à la mission ; les protections existantes des images OSM/ORM sont distinctes et inchangées.

Ces règles ne constituent pas un proxy et ne changent pas de fournisseur pour contourner un refus. **La 403 observée chez vous n'est pas déclarée levée.**

## Ce qui n'est pas fini

Le déplacement physique de l'ensemble remorqueur/remorqué et l'application complète des cantons, travaux et contraintes de traction aux secours restent à terminer. Le replay complet après une longue absence et la reproduction du blocage utilisateur à basse vitesse restent partiels. Les contrôles nouveaux de tracé et de restauration ne clôturent pas ces quatre dossiers.

Rapport : `RE_REPARATION_RC12_RAPPORT.md`. Registre : `RE_REGISTRE_CORRECTIONS_RC12.md`. Preuves : `QA/RE_REPAIR_RC12/README.md`.
