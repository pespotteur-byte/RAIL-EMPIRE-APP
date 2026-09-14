# Rail Empire RC22 FULL — ouvrir uniquement index.html

## Démarrage

1. Dans ta version actuelle, exporte ta partie et conserve cet export ainsi que l'ancien dossier.
2. Extrais toute l'archive RC22 FULL dans un dossier distinct. Ne copie pas index.html seul : il utilise les dossiers js, data, img, audio, etc.
3. Double-clique sur **index.html**, puis sélectionne **OSM original** dans la LiveMap.

**Aucun .cmd, .exe, serveur local, extension, clé API ou compte n'est requis par ce nouveau chemin de lancement.** Les anciens outils de serveur restent dans la FULL pour compatibilité ; index.html ne les lance pas. Les instructions historiques RC9–RC21 demandant un serveur ne décrivent plus le fonctionnement de RC22.

Le jeu reste chargé depuis le dossier local. Internet est nécessaire pour obtenir de nouvelles tuiles cartographiques. Il ne s'agit pas d'une carte hors ligne ni d'un téléchargement de région.

## Pourquoi OSM peut être demandé depuis le HTML local

La documentation développeur OSM prévoit le cas file:// : la requête peut indiquer le vrai nom de l'application dans X-Requested-With. Le chargeur RC22 envoie **X-Requested-With: RailEmpire** uniquement à OSM standard en ouverture fichier. Tu n'as rien à saisir ou à configurer. Aucun faux Referer ou User-Agent, aucune identité empruntée, aucun proxy.

Source : https://wiki.openstreetmap.org/wiki/Referer (rubrique développeurs et exemples file://, consultée le 13 septembre 2026).

## Conserver ta partie

Le stockage HTTP local et celui d'un document fichier ne doivent pas être supposés communs. Changer le chemin du fichier peut aussi donner accès à un stockage différent selon le navigateur. Si la partie n'apparaît pas, **réimporte ton export de référence** : ne vide pas les données du navigateur et ne supprime pas ton ancien dossier/profil.

L'export peut contenir tes livrées et tes données personnelles de jeu ; conserve-le séparément. Garde ensuite le même dossier et le même navigateur/profil pour tes sessions. Ne fais pas fonctionner deux versions sur la même partie simultanément.

Source : https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage — comportement file:// non garanti de façon uniforme entre navigateurs.

## Un refus du fournisseur n'est pas effacé

RC22 retire l'interdiction préventive qui empêchait toutes les pages file:// d'utiliser OSM. **Il ne supprime pas les vrais refus 401/403 ou x-blocked déjà mémorisés.** S'ils sont affichés, consulte le panneau de source ; après la temporisation et correction de la cause, la reprise manuelle existante permet un essai. Pas de relance en boucle ni de rotation de fournisseur ou d'identité. Le délai ne garantit pas la levée d'un blocage externe.

Un problème réseau/CORS non lisible est présenté comme indisponibilité, pas comme une 403 certaine. Ne désactive pas les protections du navigateur pour le contourner. Si fetch n'est pas disponible, le chargeur n'effectue pas de requête anonyme de secours.

Le service public OSM peut refuser ou limiter l'accès et ne garantit pas sa disponibilité : https://operations.osmfoundation.org/policies/tiles/ .

## Ce qui a réellement été testé

Les compilations, tests Node et scénarios Chromium isolés passent. Les requêtes natives du navigateur depuis une origine opaque portent bien l'identification et les images de test sont décodées. Toutefois, le navigateur de l'environnement interdit la navigation native file:// et le serveur OSM n'était pas joignable (DNS). Les réponses de carte ont donc été simulées ; le protocole file: a été sélectionné dans le harnais de test. **L'accès réel OSM depuis ton Opera/Win7 reste à vérifier.** Aucun serveur caché n'est ajouté au jeu pour pallier cette limite de test.
