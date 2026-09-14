# RE RC23 — Enquête sur le fond nocturne

Consultation des sources officielles : 13 septembre 2026. Point de départ : RC22 FULL fournie. Cette note distingue données observées, choix de rendu et limites ; elle ne certifie ni un fournisseur externe ni une photographie nocturne à haute résolution.

## Pourquoi l’ancienne nuit était floue

Dans le vrai `src/ts/map.ts` de RC22, le fond Esri est disponible jusqu’au niveau natif 20, mais la couche lumineuse `VIIRS_Black_Marble` est bornée au niveau 8. Le moteur superpose cette dernière avec une opacité de 0,88, même en vue rapprochée. Il remplit aussi le fond satellite d’une teinte nocturne d’opacité 0,68. Agrandir la couche de lumières n’ajoute aucun détail : ses zones lumineuses deviennent simplement de très grands motifs.

La documentation NASA décrit notamment VNP46A1 sur une grille de 15 secondes d’arc, soit environ 460 m dans la direction nord-sud, généralement arrondis à 500 m. Il s’agit de mesures radiométriques nocturnes ; ce n’est pas une photographie permettant de distinguer les voies et les quais. La documentation GIBS distingue explicitement résolution du capteur, résolution de l’image et rééchantillonnage pour la projection. Le niveau de zoom du service RE est constaté dans le code et l’URL de sa couche, non déduit du seul produit VNP46A1.

Sources :
- NASA LAADS, VNP46A1 : https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP46A1/
- NASA GIBS, Available Visualizations et notes sur les résolutions : https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/

## Options examinées

| Option | Intérêt | Limite pour RE |
|---|---|---|
| Agrandir davantage VIIRS ou accentuer ses pixels | Facile | Ne crée aucune précision locale et amplifie les halos. Rejeté. |
| Conserver VIIRS, mais seulement à l’échelle adaptée | Lumières réellement issues de données nocturnes, lisibles en vue régionale | Toujours une couche grossière ; ne doit plus couvrir un GPS rapproché. Retenu à faible opacité. |
| CARTO Dark Matter | Carte sombre détaillée et stylisée | Ce n’est pas une photographie nocturne. Le dépôt officiel exige maintenant une clé pour les fonds et indique la retraite des fonds raster. Pas ajouté anonymement. |
| Assombrir localement le fond détaillé déjà choisi | Aucun nouveau service ni nouvelle clé, détail existant préservé, cache réutilisé | Rendu nocturne simulé, pas une acquisition satellite de nuit. Retenu pour la proximité. |
| Style sombre local sur OSM | Routes et libellés restent disponibles ; même source et transport | Pas une image satellite. Toujours annoncé comme un style local. Retenu lorsque le joueur garde OSM. |

Source CARTO : https://github.com/CartoDB/basemap-styles — README, « An API key is required », rubrique raster et Dark Matter. Les conditions du fournisseur doivent être relues avant toute future intégration ; RC23 n’ajoute aucune requête CARTO.

Cette recherche ne prouve pas qu’aucune image nocturne à haute résolution n’existe. Elle ne valide pas de mosaïque mondiale, accessible sans nouveau compte ni clé et substituable telle quelle au service existant. RC23 n’en prétend pas disposer.

## Stratégie implémentée

Le mode Nuit ne change pas automatiquement le fournisseur choisi. Pour Satellite :

- À z ≤ 8 : couche VIIRS limitée à son niveau natif 8, opacité maximale de 0,30 au lieu de 0,88.
- De z = 8 à z = 10 : disparition progressive suivant une interpolation lisse.
- À z ≥ 10 : aucune demande ni dessin de VIIRS pour la nouvelle vue. Seul le satellite détaillé existant est assombri par une teinte uniforme de 0,48. Les requêtes périmées suivent les mécanismes d’annulation du chargeur.

Le texte affiché en proximité est « Nuit détaillée · satellite de jour assombri, sans halos NASA ». En régional : « Nuit régionale · lumières NASA atténuées ». La mention NASA est retirée des crédits de la vue rapprochée où cette couche n’est plus dessinée. Les autres attributions restent visibles.

Sur OSM, Nuit applique un style sombre local, sans passer automatiquement à Esri ou à NASA. Rechoisir « OSM original » restaure volontairement les couleurs originales et annule la nuit forcée. En GPS Auto, le choix explicite d’OSM original reste prioritaire, comme dans RC22 ; choisir Nuit permet de l’assombrir.

Le niveau de zoom maximal et la résolution native du satellite ne sont pas augmentés. À un agrandissement extrême, l’image de base peut donc encore être rééchantillonnée. La correction supprime l’agrandissement excessif de la couche lumineuse, pas toutes les limites des images externes.

## Réseau et conditions d’utilisation

Le transport de tuiles de RC22, notamment son identification en ouverture HTML locale, est inchangé. L’attribution, le cache, la concurrence limitée et l’arrêt sur refus restent en place. Aucun proxy, faux référent, fournisseur automatique de secours ou préchargement de région n’a été ajouté. Les bascules Jour/Nuit réutilisent les images décodées au lieu de vider leur cache.

Politique officielle OSM : https://operations.osmfoundation.org/policies/tiles/ — attribution visible, cache normal, pas de collecte de région et disponibilité non garantie. Cette livraison ne déclare aucune ancienne 403 levée.

Les contrôles automatisés interceptent toutes les requêtes avec des images de calibration synthétiques. Ils ne téléchargent pas de tuiles réelles et ne constituent pas une validation des droits ou de l’accessibilité depuis Opera.

## Validation visuelle

`QA/RE_REPAIR_RC23/browser-night/results.json` compare le vrai Canvas de RC22 au vrai Canvas de RC23 sur une image de calibration. À z16, RC22 dessine la couche grossière et RC23 ne la demande plus. Le rendu RC23 est exactement égal au même fond détaillé plus la teinte annoncée : zéro canal de pixel différent. L’interface GPS complète est également dessinée avec les vrais bundles.

Toutes les captures de ce dossier montrent des tuiles synthétiques, pas une carte réelle. Elles prouvent les calculs, la superposition et l’accessibilité de l’interface, pas l’esthétique de toute région ni les performances sur un PC particulier.
