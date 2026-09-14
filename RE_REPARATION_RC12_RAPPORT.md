# Rail Empire — Rapport de réparation RC12

Build : `S3_GAMEPLAY_REPAIR_RC12_1199repair12` — 12 septembre 2026. Base réelle : ZIP RC11 fourni par PE ; son SHA-256 et les comparaisons directes sont enregistrés dans `QA/RE_REPAIR_RC12/INPUT_PARITY.json` et `BEFORE_AFTER.json`.

## Bilan

**83 dossiers historiques clos sur 87 (95,4 %), inchangé.** LM03 et TIME05 restent partiels ; DDS03 et DDS04 restent ouverts. Cette passe apporte des corrections vérifiées à la détection de trafic et au cycle de routage des secours, ainsi qu'un export de diagnostic. Elle ne transforme pas ces sous-correctifs en clôture d'un remorquage physique ou d'un replay complet.

Trois modules applicatifs existants ont été modifiés : `schedule-creator.ts`, `depot.ts`, `ui.ts`. Deux modules TypeScript purs ont été ajoutés : `rescue-route-contract.ts` et `movement-diagnostics.ts`. Les documents d'entrée et le marqueur `RELEASE.txt`, qui mentionnaient encore RC10 dans l'archive RC11, sont harmonisés avec cette livraison. Les anciennes preuves sont conservées comme historiques, et non confondues avec la validation RC12.

## 1. Détection des face-à-face

### Défauts reproduits

En absence d'index spatial, la liste de voisins pouvait être vide ou partielle malgré une flotte fournie au contrôleur. Le filtre IPCS n'observait alors pas un autre train physiquement présent. La liste du demandeur est maintenant utilisée quand l'index est absent ou vide ; les recherches indexées normales restent utilisées lorsque l'index existe.

Comparer les identifiants de voie sous les deux cabines courantes n'est pas suffisant lorsque la ligne est découpée en plusieurs objets OSM. Le contrôle compare désormais les identités au **lieu projeté du conflit**. Il consulte également la tangente de notre itinéraire à cet endroit : deux trains roulant dans le même sens après une courbe en épingle ne sont pas des adversaires simplement parce que leurs cabines pointent momentanément dans des directions opposées.

La distance utilisée pour l'anticipation est la distance longitudinale sur l'itinéraire. Un train situé derrière, avec lequel la distance augmente, ne retient plus à tort notre train pour ce motif. Quand plusieurs contraintes existent, la limite la plus restrictive est conservée, indépendamment de l'ordre du tableau des voisins. Le contrôle de suivi reste distinct ; aucune voie parallèle connue n'est arbitrairement assimilée à la voie utilisée.

Les 16 essais comprennent absence d'index, cache partiel, index vide, éloignement, changement d'objet OSM, voies distinctes, même sens, annulation, ordre de candidats, deux courbes en épingle, garde géométrique, modification de géométrie et route dense. Deux scénarios exercent les vrais contrôleurs full et macro pendant 180 secondes simulées avec deux frets de 750 m : freinage, arrêt et maintien de l'écart sont vérifiés. Ils sont des régressions de sécurité, pas une certification de tout le réseau.

### Coût et optimisation

La première correction réalisait des projections inutiles sur des voies parallèles éloignées latéralement. Le microbenchmark a détecté ce surcoût avant livraison. Une phase géométrique conservatrice rejette maintenant les candidats dont la latitude est au-delà de toute la polyligne, avec une marge supérieure à la tolérance latérale du projecteur. Elle ne retire aucun candidat potentiellement dans cette tolérance.

Ce contrôle est facultatif, calculé à la demande pour les routes courtes et les groupes de plusieurs candidats. Il n'est pas mémorisé entre appels : modifier une route en place ne laisse pas un cache périmé. Sur une route longue, le contrôle détaillé reste actif sans parcourir l'intégralité de la route pour construire cette accélération. Le seuil de 2 048 points concerne uniquement cette optimisation, pas l'acceptation des routes ni leur précision.

Les chiffres de mesure finale figurent dans la section de qualification ci-dessous et dans `IPCS_BENCHMARK.json`. **Ce n'est pas une mesure de FPS ou de vitesse de tout le jeu.** Le gain dépend de la géométrie et de la densité de voisins ; aucune promesse universelle n'en est déduite.

## 2. Cycle de routage des secours

### Requêtes et réponses

Une deuxième demande pour le même service réutilise la mission existante. Un service déjà enregistré en réparation ne déclenche pas une nouvelle mission. Une position cible invalide est refusée sans déployer de locomotive.

La recherche de tracé est engagée dans une promesse protégée : une exception synchrone du fournisseur n'échappe plus à la boucle de jeu et ne laisse plus le drapeau « requête en cours » figé. Une réponse reçue pour une mission remplacée au rechargement ne réactive pas cet ancien objet.

Le tracé doit contenir au moins deux points valides, sans point intermédiaire synthétique ou de repli. Une coordonnée intérieure invalide entraîne le refus du tracé complet : supprimer ce point puis joindre ses voisins inventerait un raccord. Les extrémités sont vérifiées avec une tolérance de 50 m. Cette valeur est une règle de simulation, **pas une preuve de connectivité topologique ni une norme ferroviaire**.

Si le train cible se déplace pendant la recherche, avant l'arrivée du secours ou pendant sa préparation, la mission ne simule pas une prise en charge à l'ancienne position. Elle demande un nouveau tracé depuis sa position effective. Les points de route et coordonnées de mission sauvegardés sont copiés pour qu'un déplacement ultérieur ne modifie pas cet instantané.

### Refus et temporisation

Un statut **401/403 réellement exposé par l'erreur du fournisseur** suspend les relances automatiques de cette mission. L'utilisateur dispose d'une reprise manuelle après au moins 900 secondes réelles. Le statut et l'échéance murale sont sauvegardés ; une accélération de la simulation ne permet pas de franchir cette échéance.

Les autres échecs emploient une temporisation croissante. Pour les 429/503, `Retry-After` est respecté lorsqu'il est exposé, y compris si le délai dépasse la temporisation de base. Le code n'invente pas un statut 403 lorsqu'une erreur CORS/réseau n'en fournit pas. La protection est **par mission** ; elle ne constitue pas une limitation globale de tous les fournisseurs de routage.

Aucun proxy, changement automatique de fournisseur ou contournement d'un refus n'est ajouté. Les protections des images OSM/ORM héritées de RC9 restent inchangées. Le délai local de 15 minutes n'est pas une garantie de déblocage externe, et la 403 réelle du joueur n'est pas déclarée levée.

### Restauration et affichage

Une route sauvegardée incohérente, ou un index qui prétend avoir atteint une extrémité alors que la position est encore à l'origine, ne termine plus instantanément la mission. Un temps de préparation manquant reprend la valeur de cinq minutes, au lieu d'être assimilé à une durée déjà terminée. Les doublons de cible au chargement sont filtrés, et les locomotives inutilisées ne restent pas artificiellement déployées. Un delta de temps non fini ou négatif n'injecte pas de coordonnées invalides.

La LiveMap affiche les phases de recherche et le motif de routage. Le bouton **Réessayer le routage** respecte l'échéance et demande confirmation. Les messages et noms sont échappés ; le rendu navigateur vérifie le texte littéral et la conservation d'un identifiant contenant guillemets et apostrophes.

Les 30 essais de secours couvrent ces cas avec des fournisseurs simulés. **Le mouvement physique de la rame remorquée et l'autorité complète du secours ne sont pas implémentés dans cette passe.** Le moteur DDS reste distinct : le robustifier contre les réponses invalides n'équivaut pas à lui appliquer toutes les contraintes des ActiveService.

## 3. Diagnostic du blocage à basse vitesse

Le panneau **LiveMap → Runtime V2** propose **Exporter le diagnostic des mouvements**. L'action produit un JSON local, sans transmission réseau. Elle ne tourne pas à chaque frame et ne conserve pas un historique permanent.

L'instantané contient vitesses réelle et affichée, autorité de mouvement et motif d'attente, position/indice/progression dans la liaison, vitesse du segment, prochain arrêt, quelques caractéristiques du matériel, temps de mouvement LOD en attente et état sommaire des secours. Il ne sérialise pas les géométries complètes, catalogues, comptes ou contenus de stockage.

Le nombre de services exportés est borné à 512 par défaut, avec priorité aux services arrêtés par une autorité puis aux trains lents. Les compteurs restent ceux de toute la flotte et la troncature est explicite. Les noms et messages ont une longueur bornée ; les champs numériques non finis deviennent `null`. Les coordonnées et noms de jeu restent des données à relire avant partage. Huit tests exercent les limites, la priorité, la séparation d'avec les objets vivants et les données mal formées.

Dans l'essai navigateur, le bouton est réellement cliqué et le téléchargement relu : 600 services comptés, 512 enregistrés, 88 omis explicitement. Les quatre observations de mouvement ont lieu avant de mettre la simulation en pause pour interagir avec l'export. Cet essai utilise une partie synthétique, pas la sauvegarde de PE.

**Ce JSON n'est ni une sauvegarde restaurable ni un replay.** Les causes précises du blocage durable signalé vers 12 km/h ne sont toujours pas établies sur la sauvegarde du joueur. Les fausses détections corrigées dans cette livraison ne sont pas présentées sans preuve comme son explication.

## Qualification finale

| Contrôle | Résultat |
|---|---:|
| Compilation TypeScript et groupes de vérification stricts | Réussis |
| Suite standard | 102 834 / 102 834 |
| Suite de réparation | 599 / 599, dont 54 nouveaux |
| Régressions S3 | 250 / 250 fichiers actifs |
| Répartition S3 | 215 fonctionnels, 35 timing exécutés séparément |
| Archives de tests supersédées | 11, manifeste inchangé |
| Reconstruction indépendante | 102 JS + 102 déclarations identiques |
| Bundles et entrées reconstruits | 3 bundles + 2 pages HTML identiques |
| Ressources comparées directement au ZIP RC11 | 37 221 identiques, aucune retirée/modifiée |
| Sources applicatives TypeScript | 102 modules |
| Dette explicite | 48 `any`, 28 `@ts-expect-error`, sans augmentation |

Les suites se recouvrent : elles ne s'additionnent pas. La suite standard contient des essais générés ; ses réussites ne représentent pas autant de bugs indépendants. Les seules modifications des anciens tests concernent 69 occurrences du marqueur de cache dans 49 fichiers, inventoriées dans `VERSION_TEST_MIGRATION.json`. Aucune nouvelle exclusion ni suppression de test n'a été ajoutée.

Les 46 mêmes scénarios IPCS/secours exécutés sur le vrai JavaScript RC11 donnent **9 réussites et 37 échecs** ; RC12 obtient **46/46**. Ces échecs incluent les exigences des nouvelles capacités de reprise : ils ne sont pas dénombrés comme autant de bugs historiques. Les huit essais d'export, fonctionnalité nouvelle, ne sont pas artificiellement comparés à un module inexistant dans RC11.

### Mesure du contrôle IPCS

Scénario : 300 vérifications, 20 voies proches mais distinctes, 201 points par route. Toutes les réponses attendues sont identiques : aucune opposition physique. Cinq paires de processus Node indépendants, ordre RC11/RC12 alterné, trois échauffements puis neuf mesures par processus. Résultats : médiane des cinq médianes. Les mesures ne se superposent pas à la qualification S3 ou au navigateur.

| Version | Temps médian pour 300 vérifications |
|---|---:|
| RC11 | 5.717 ms |
| RC12 finale | 4.714 ms |

**Réduction du temps mesuré : 17.5 % sur ce contrôle et ce scénario.** La première version corrigée mais non optimisée de RC12 mesurait 23,561 ms dans un essai préalable ; elle n'est pas livrée comme version finale. Le filtrage conservateur a été ajouté avant la requalification complète. Cette mesure n'est ni une évolution du FPS, ni une comparaison de toute la simulation, ni une garantie sur une autre géométrie ou un autre matériel.

### Navigateur et présentation

Les vrais bundles sont injectés dans Chromium avec un DOM réel, un stockage mémoire isolé et le réseau externe intercepté. Quinze pages sont parcourues. Les 600 services progressent lors de chacune des quatre observations carte → personnel → incidents → carte. Les contrôles de voie, de queue, de sauvegarde après maintenance, de banque, des améliorations de gare, de TAQ, de protection HTML et d'OSM/ORM sont conservés.

Le diagnostic est téléchargé par le bouton réel puis relu ; la pause n'intervient qu'après les essais de mouvement. Les cartes de secours sont vérifiées à 768 × 1 024, avec messages longs échappés, nom tronqué visuellement sans modifier sa valeur, bouton accessible et absence de débordement horizontal de la carte. Les identifiants spéciaux transmis au clic restent intacts. Le bundle administrateur autonome démarre, affiche son catalogue et filtre correctement une recherche sans résultat.

Une première tentative d'automatisation du clic, en concurrence avec la flotte synthétique saturante, a dépassé son délai. Le harnais met désormais la simulation en pause après les quatre observations, sans retirer les services, pour contrôler le téléchargement séparément. Ce changement de harnais ne doit pas être interprété comme une preuve de fluidité à 600 trains ; **aucun FPS n'est certifié**. Les logs de la tentative initiale sont conservés explicitement comme intermédiaires.

La navigation native HTTP local et `file://` a été tentée et refusée par l'environnement avec `ERR_BLOCKED_BY_ADMINISTRATOR`. Le harnais mémoire n'en fait pas une réussite native. Win7/Opera, le lanceur C#, la sauvegarde réelle du joueur, l'audio et la levée de la 403 ne sont pas certifiés par ces essais.

### Couverture TypeScript

L'audit ne trouve aucun module applicatif JavaScript exécutable non apparié à une source TypeScript. Les données JS équivalentes JSON, bibliothèques tierces et outils de test/construction sont hors de cette couverture. Les signatures d'index permissives héritées dans les contrats globaux/UI/DOM/ORM affaiblissent encore le contrôle : écriture des sources en TypeScript ne signifie pas stricteté parfaite.

## Livraison et suite du chantier

Conserver RC11, exporter la sauvegarde et extraire RC12 dans un dossier neuf. Consulter `LIRE_AVANT_RC12.md` ; ne pas mélanger les fichiers et conserver l'adresse/port HTTP local. Un ancien secours incohérent peut désormais rester retenu au routage avec un motif explicite plutôt que simuler une arrivée.

Le registre reste à **83/87**. À poursuivre : reproduction LM03 sur données du joueur, replay TIME05, remorquage physique DDS03 et autorité complète DDS04. L'export de diagnostic aide à collecter l'état de LM03 ; il n'est pas compté comme sa résolution.

Les sources, ressources et preuves sont fournies. Le manifeste `QA/FILE_SHA256_MANIFEST.txt` est régénéré une fois les rapports figés. L'archive est ensuite relue par CRC et toutes ses empreintes sont vérifiées ; le compte exact et l'empreinte de l'archive sont enregistrés dans le contrôle externe `RE_RC12_PACK_INTEGRITY.json`, sans empreinte autoréférente.
