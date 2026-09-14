# Rail Empire — RC20 FULL : installation et atelier Livrées

## Installer sans perdre sa partie

Conservez RC19 FULL et exportez votre partie depuis cette version avant migration. Fermez les autres onglets de RE et arrêtez leur serveur. Extrayez **RC20 FULL dans un nouveau dossier**, sans mélanger les fichiers des deux versions. Lancez `LANCER_RE.cmd` et conservez exactement l’adresse et le port utilisés auparavant. Ne videz ni les données du site ni les caches du navigateur pour installer cette mise à jour.

L’ouverture HTTP locale reste le mode conseillé, et nécessaire au fonctionnement normal du fond OSM standard selon les protections déjà présentes. Les outils de lancement Windows sont conservés ; ils n’ont pas été revalidés sous Win7 dans cette passe. RC20 ne lève aucun refus du fournisseur de tuiles.

Une sauvegarde RC19 sans livrées reste acceptée : la bibliothèque démarre vide. Les anciens incidents actifs ne sont pas supprimés rétroactivement ; la nouvelle règle s’applique à leur génération. Conservez l’export **d’avant migration** pour revenir à RC19 : cette version ne connaît pas la bibliothèque ni ses références.

## Incidents liés à un arrêt

Un incident de train exigeant un arrêt en gare vérifie l’arrêt effectivement atteint dans l’horaire, l’identité de la gare et l’immobilité. Traverser une gare, s’arrêter à son signal ou se trouver à proximité ne suffit plus. Le malaise voyageur exige aussi une capacité voyageurs ; un fret ne reçoit pas cet incident.

Les incidents d’infrastructure, de voie ou de gare affectant les circulations de passage restent possibles : ils ne sont pas des incidents à bord déclenchés pendant un arrêt commercial.

## Dupliquer une rame ou un horaire

Les copies gardent leurs propres identifiants et leurs données éditables. Les noms/numéros libres sont recherchés en conservant les zéros : par exemple `Fret 001` → `Fret 002`, `R-0007` → `R-0008`. Si un numéro est déjà utilisé, il est sauté. Une duplication ne renomme pas la source.

Dans le SC, les répétitions conservent le pas de numérotation prévu (+2 par défaut) ; l’aller-retour conserve l’aller N / retour N+1, puis le couple suivant N+2 / N+3. Le numéro incorporé au nom est synchronisé. Un nom purement descriptif sans chiffre reste inchangé, conformément au comportement antérieur. Une rame dupliquée est une nouvelle composition, soumise aux règles d’achat et d’affectation habituelles : ce n’est pas une livrée gratuite transformée en matériel physique.

## Créer une livrée de wagon

Ouvrez **Livrées**, recherchez le matériel RE et choisissez le wagon de base. Le catalogue se charge à la demande ; le bouton Actualiser permet de revoir la liste après chargement. Saisissez un nom ou un numéro et importez l’image du chargement.

Le wagon est au premier plan, le chargement derrière. Glissez le chargement pour régler sa position, ou saisissez **X / Y en pixels**. Les flèches déplacent d’un pixel, Maj + flèches de dix pixels. La molette et le champ **Échelle (%)** modifient la taille de manière proportionnelle. Réinitialiser replace le chargement à son placement initial.

Le zoom d’aperçu est séparé : il ne modifie pas les dimensions du fichier. La zone de composition réserve au moins **hauteur du wagon + hauteur mise à l’échelle du chargement**, puis s’agrandit davantage si l’image déborde sur un côté. Aucun élément n’est étiré séparément en largeur/hauteur pour tenir dans la boîte.

Le PNG exporté garde la transparence et les dimensions indiquées sous l’aperçu ; le damier n’en fait pas partie. Le sprite RE n’est pas détouré ni modifié : ses parties opaques masquent naturellement le chargement derrière lui. Un fond opaque fourni dans une image reste opaque ; aucun détourage automatique de cette image n’est ajouté.

Cliquez **Enregistrer la livrée** pour sauvegarder les images et le placement dans la partie. **Exporter PNG** ne sauvegarde que l’image finale : ce fichier seul ne remplace pas l’export de votre partie ni le projet rééditable.

## Livrées des autres matériels

Pour une locomotive, automotrice, voiture ou autre matériel hors catégorie wagon, importez simplement la nouvelle image. Aucune image de chargement n’est requise. Les dimensions et proportions du raster importé sont conservées.

Formats importables : PNG, JPEG, GIF, WebP et BMP. Ils sont normalisés en PNG. Les GIF/WebP animés ne deviennent pas des livrées animées : la composition est une image fixe. Les SVG et liens externes ne sont pas acceptés comme images importées.

## Sélection dans une rame

Dans l’éditeur de rame, chaque véhicule compatible dispose d’un sélecteur **Livrée**, avec **Image d’origine** comme choix initial. Sélectionnez la variante puis enregistrez la rame. Deux wagons du même modèle peuvent ainsi avoir des apparences différentes.

La livrée n’altère ni le catalogue, ni la masse, ni la puissance, ni les capacités ou la marchandise simulée. Ajouter une image de conteneur ne charge pas physiquement le wagon : les marchandises restent gérées par les fonctionnalités de fret existantes. Créer une livrée n’achète aucun matériel.

La bibliothèque permet de modifier, copier, supprimer ou exporter vos créations. Modifier une livrée partagée met à jour ses utilisations ; faites une copie pour obtenir une variante indépendante. La suppression remet les véhicules qui l’utilisaient sur leur image d’origine, sans supprimer ces véhicules.

## Stockage et machine peu puissante

Il n’y a **pas de plafond arbitraire du nombre de livrées**, ni de suppression automatique d’anciennes créations. Les rames stockent une référence ; les images identiques sont mutualisées dans la bibliothèque. La compression de sauvegarde existante est conservée.

La capacité réelle reste celle du navigateur et de la mémoire disponible. Un fichier importé est limité à **32 Mio**, et une image / composition à **8 192 pixels par côté et 16 777 216 pixels au total**. Ce sont des protections contre les allocations excessives, pas une garantie que votre PC peut manipuler sans peine une image de cette taille. Des sprites proches de la résolution nécessaire sont préférables aux photographies géantes.

Un refus d’écriture n’annonce pas une réussite : l’ancienne bibliothèque et les anciennes apparences sont restaurées. Gardez malgré tout vos exports de partie indépendants. L’export complet inclut bibliothèque, sources, placements et affectations ; une simple capture PNG ne les contient pas.

## Portée des vérifications

Les essais emploient les vrais bundles dans Chromium Linux, avec stockage isolé et réseau extérieur intercepté. La navigation native locale est bloquée dans cet environnement. Opera/Win7, le quota physique de votre profil, l’audio et l’accès réel aux fournisseurs cartographiques ne sont pas certifiés par ces tests.

Le rapport `RE_REPARATION_RC20_RAPPORT.md`, les tests et les preuves se trouvent dans l’archive FULL. Le manifeste courant est `RC20_SHA256_MANIFEST.json` ; les manifestes et rapports des versions précédentes sont conservés comme historique, pas comme signature de RC20.
