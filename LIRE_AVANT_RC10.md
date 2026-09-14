# Rail Empire — Bien démarrer RC10

## Sauvegarde et ouverture

Exportez d'abord votre partie depuis RC9 et gardez son ZIP. Extrayez RC10 dans un nouveau dossier : ne remplacez pas quelques fichiers au milieu d'un ancien build. Le jeu est fourni précompilé, avec les sources TypeScript.

Conservez le lancement HTTP local de RC9 : `LANCER_RE.cmd`, adresse `http://127.0.0.1:8765/`. Le serveur Node reste disponible par `npm run serve:local` lorsqu'un Node compatible est installé. Le lanceur Windows/C# est hérité de RC9, sans validation Win7/Opera dans cet environnement. Aucune modification RC10 ne prétend résoudre sa compatibilité.

La même adresse, le même port et le même profil de navigateur permettent de garder la même origine de stockage. Une ouverture différente (`file://`, `localhost`, autre port) peut montrer un stockage distinct : réimportez alors l'export de votre partie. N'effacez pas l'ancienne copie et ne réinitialisez pas le navigateur pour la retrouver.

## Ce qui devient réellement actif

**Consommables :** vérifiez les niveaux de vos rames après import. Un réservoir déclaré de capacité positive avec zéro gazole interdit désormais la traction thermique et le départ ; en marche, le train freine jusqu'à l'arrêt. L'huile moteur, le refroidissement et les fluides de transmission/hydraulique ont également des conséquences. Le ravitaillement au dépôt ne restaure la traction qu'à la fin de l'opération. Une panne sèche n'est pas artificiellement transformée en panne mécanique. La logistique complète de remorquage en ligne n'est pas livrée dans RC10 : DDS03/DDS04 restent ouverts. Prévenez donc la panne sèche par la préparation au dépôt.

Les données anciennes sans niveau exploitable ou avec capacité nulle ne reçoivent pas une panne inventée. Les bimodes ne brûlent pas de gazole sous une alimentation compatible. Le sable et le lave-glace manquants agissent par précipitations ; l'AdBlue concerne uniquement un équipement déjà déclaré. La propreté agit sur la demande nouvelle et la satisfaction observée, sans supprimer les voyageurs déjà à bord.

**Gares :** les modules déjà payés sont réappliqués à l'import sans refacturation. Le quai ajoute une capacité logique de réservation ; le garage crée une place au dépôt de gare. Ils ne fabriquent ni voie OSM ni itinéraire de manœuvre. Les terminaux fret permettent le chargement/déchargement dans une gare non équipée ; les gares fret/mixte et ITE construits restent reconnus.

**Clients industriels :** une offre exige une destination reliée dans les itinéraires et voies valides connus du jeu. Sans liaison connue, l'écran explique l'absence d'offres ; il ne lance pas une exploration OSM automatique. Ajoutez ou validez la liaison ferroviaire : la génération suivante la prend en compte. Ce contrôle n'est pas une garantie de disponibilité de n'importe quel sillon ou matériel.

## Carte et limites

Les protections OSM/ORM de RC9 sont conservées. Un refus 403 n'est ni contourné ni déclaré levé. L'ouverture directe `file://` laisse le fond OSM standard suspendu préventivement ; un serveur HTTP local n'est pas un proxy vers OSM.

Le registre est à **79/87, soit 90,8 %**, pas « zéro bug ». Le blocage durable utilisateur vers 12 km/h, les manœuvres physiques inter-voies, le replay complet et le secours physique restent à travailler. Le rapport décrit les tests et les limites de l'environnement.
