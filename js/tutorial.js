/**
 * Tutorial — Interactive step-by-step guide for new players.
 * Overlay-based, does not modify any game state.
 */
import { icon } from './icons.js';
export class Tutorial {
  constructor() {
    this.steps = [
      // ===========================
      // PARTIE 1 : INTRODUCTION
      // ===========================
      {
        title: 'Bienvenue dans Rail Empire !',
        text: `Ce tutoriel va vous guider <b>pas à pas</b> à travers <b>toutes</b> les fonctionnalités du jeu.<br><br>
        Vous allez apprendre à :<br>
        • Naviguer sur la carte et comprendre l'interface<br>
        • Créer des gares, poser des voies et tracer des tronçons<br>
        • Acheter du matériel roulant (locomotives, voitures, wagons)<br>
        • Composer des rames et les affecter à des services<br>
        • Planifier des horaires, créer des lignes et gérer les correspondances<br>
        • Gérer vos finances, votre personnel, vos dépôts et la maintenance<br>
        • Exploiter le fret avec les ITE, clients industriels et le triage<br>
        • Utiliser la météo live, le radar et les données satellite<br><br>
        <i>Vous pouvez quitter à tout moment en cliquant sur × et reprendre plus tard.</i>`,
        target: null,
        page: null,
      },
      {
        title: icon('info',14) + ' L\'interface du jeu',
        text: `L'écran de jeu est organisé en 3 zones principales :<br><br>
        <b>1. Le Header (bandeau supérieur) :</b><br>
        • Nom de votre compagnie<br>
        • Météo actuelle et température<br>
        • Solde financier (vert = positif, rouge = négatif)<br>
        • Horloge du jeu (heure et date)<br>
        • Boutons : Tutoriel, Sauvegarder, Charger<br><br>
        <b>2. La barre de navigation (onglets) :</b><br>
        • En dessous du header, une rangée d'onglets scrollable horizontalement<br>
        • Chaque onglet correspond à une section du jeu (Carte, Matériel, Rames, Horaires, etc.)<br>
        • L'onglet actif est surligné en bleu<br><br>
        <b>3. La zone principale :</b><br>
        • Affiche le contenu de l'onglet sélectionné<br>
        • Par défaut, c'est la <b>Carte</b> qui s'affiche`,
        target: null,
        page: null,
      },

      // ===========================
      // PARTIE 2 : LA CARTE
      // ===========================
      {
        title: icon('map',14) + ' La Carte — Le coeur du jeu',
        text: `La carte est le centre de tout. Elle affiche une carte avec les <b>voies ferrées réelles</b> (couche OpenRailwayMap).<br><br>
        <b>Navigation :</b><br>
        • <b>Déplacer</b> : clic gauche maintenu + glisser la souris<br>
        • <b>Zoomer</b> : molette de la souris (vers le haut = zoom avant, vers le bas = zoom arrière)<br>
        • <b>Rechercher un lieu</b> : utilisez la barre de recherche en bas à gauche pour aller directement à une ville<br><br>
        <b>Ce que vous voyez sur la carte :</b><br>
        • Les <b>voies ferrées</b> en gris (couche ORM = OpenRailwayMap)<br>
        • Vos <b>gares</b> : cercles bleus avec leur nom<br>
        • Vos <b>trains en circulation</b> : triangles colorés qui se déplacent<br>
        • Les <b>incidents</b> : cercles rouges clignotants sur les voies<br>
        • Les <b>tronçons</b> : lignes colorées représentant vos voies construites`,
        target: '#game-canvas',
        page: 'map',
      },
      {
        title: icon('map',14) + ' Options de la carte',
        text: `En bas de la carte, vous trouvez les <b>toggles</b> (cases à cocher) pour personnaliser l'affichage :<br><br>
        <b>Toggles disponibles :</b><br>
        • <b>Gares</b> : afficher/masquer les cercles des gares<br>
        • <b>Noms</b> : afficher/masquer les noms des gares<br>
        • <b>Trains</b> : afficher/masquer les trains en circulation<br>
        • <b>Points voie</b> : afficher/masquer les points de tracé de voie<br>
        • <b>Satellite</b> : basculer entre la carte sombre et l'imagerie satellite (photo aérienne)<br>
        • <b>Radar</b> : afficher le radar de précipitations en temps réel (pluie, neige)<br>
        • <b>Nuages</b> : afficher la couverture nuageuse en temps réel<br><br>
        <b>En mode Satellite</b>, les noms des communes restent affichés par-dessus l'image aérienne.`,
        target: null,
        page: 'map',
      },
      {
        title: icon('map',14) + ' Contrôles de vitesse du jeu',
        text: `En bas à gauche de la carte, les <b>contrôles de vitesse</b> permettent d'accélérer ou mettre en pause le temps du jeu :<br><br>
        • <b>Pause</b> : le temps s'arrête, rien ne bouge<br>
        • <b>x1</b> : vitesse normale (1 minute de jeu = 1 seconde réelle)<br>
        • <b>x5</b> : 5 fois plus rapide (utile pour voir les trains circuler)<br>
        • <b>x15</b> : 15 fois plus rapide (pour avancer rapidement dans la journée)<br>
        • <b>x60</b> : 60 fois plus rapide (pour passer une journée entière en quelques minutes)<br><br>
        <b>Le temps du jeu</b> est affiché dans le header en orange. Il avance en continu sauf en pause.<br><br>
        <b>Astuce :</b> Mettez en pause quand vous configurez des services pour prendre le temps de bien planifier.`,
        target: null,
        page: 'map',
      },

      // ===========================
      // PARTIE 3 : CREER DES GARES
      // ===========================
      {
        title: icon('station',14) + ' Créer une gare — Étape par étape',
        text: `Les gares sont les points d'arrêt de vos trains. Voici comment en créer une :<br><br>
        <b>1.</b> Cliquez sur le bouton <b>"+ Créer une gare"</b> en haut à gauche de la carte<br>
        <b>2.</b> Votre curseur se transforme en croix de visée<br>
        <b>3.</b> Cliquez à l'endroit voulu sur la carte<br>
        <b>4.</b> Un formulaire apparaît : remplissez le <b>nom</b> de la gare<br>
        <b>5.</b> Choisissez le <b>nombre de quais</b> (2 par défaut, augmentable plus tard)<br>
        <b>6.</b> Choisissez le <b>type</b> : voyageur ou fret<br>
        <b>7.</b> Cliquez <b>"Créer"</b><br><br>
        <b>Placement important :</b> Placez vos gares <b>sur ou très près</b> des voies ferrées existantes (lignes grises ORM). Le routage automatique utilise ces voies pour calculer les itinéraires entre vos gares.<br><br>
        <b>Minimum requis :</b> Il faut au moins <b>2 gares</b> pour créer un trajet.`,
        target: '#btn-create-station',
        page: 'map',
      },
      {
        title: icon('station',14) + ' Déplacer et gérer les gares',
        text: `<b>Déplacer une gare :</b><br>
        Maintenez <b>Shift + clic-glisser</b> sur le cercle d'une gare pour la repositionner. Relâchez quand elle est à la bonne place.<br><br>
        <b>Cliquer sur une gare :</b><br>
        Un clic simple sur une gare affiche ses informations : nom, coordonnées, quais, services qui la desservent.<br><br>
        <b>Supprimer une gare :</b><br>
        Attention, supprimer une gare supprime aussi tous les tronçons et services associés. Faites-le avec précaution.<br><br>
        <b>Astuce :</b> Commencez par 2 gares proches (20-50 km) pour tester le système avant de construire un grand réseau.`,
        target: null,
        page: 'map',
      },

      // ===========================
      // PARTIE 4 : TRONCONS ET VOIES
      // ===========================
      {
        title: icon('track',14) + ' Tronçons — Relier vos gares',
        text: `Un <b>tronçon</b> est un segment de voie ferrée reliant deux gares. C'est par là que circulent vos trains.<br><br>
        <b>Création automatique :</b><br>
        Quand vous créez un service (onglet Horaires), le système crée automatiquement les tronçons entre les gares en utilisant le routage ORM (voies réelles).<br><br>
        <b>Création manuelle — Bouton "+ Tronçon" :</b><br>
        1. Cliquez <b>"+ Tronçon"</b> en haut de la carte<br>
        2. Cliquez sur la <b>gare de départ</b><br>
        3. Cliquez sur la <b>gare d'arrivée</b><br>
        4. Le système calcule automatiquement la route via les voies ORM existantes<br><br>
        <b>Tracé manuel — Bouton "+ Tracé manuel" :</b><br>
        1. Cliquez <b>"+ Tracé manuel"</b><br>
        2. Cliquez sur la carte pour placer des points intermédiaires (waypoints)<br>
        3. Cliquez sur la gare d'arrivée pour terminer<br>
        4. Le tronçon suivra exactement votre tracé point par point`,
        target: '#btn-create-troncon',
        page: 'map',
      },
      {
        title: icon('track',14) + ' Points de voie et tracé de ligne',
        text: `<b>Points de voie :</b><br>
        Les points de voie sont des marqueurs géographiques sur la carte. Ils servent à définir la géométrie précise des voies.<br>
        • Bouton <b>"+ Point de voie"</b> pour en placer<br>
        • Cochez <b>"Points voie"</b> dans les toggles pour les voir sur la carte<br>
        • Le système détecte automatiquement les <b>cisaillements</b> (croisements de voies)<br><br>
        <b>Tracer une ligne :</b><br>
        Le bouton <b>"Tracer ligne"</b> permet de dessiner une ligne complète directement sur la carte :<br>
        1. Cliquez "Tracer ligne"<br>
        2. Cliquez sur la carte pour créer des gares le long du tracé<br>
        3. Les tronçons sont créés automatiquement entre chaque gare<br><br>
        C'est le moyen le plus rapide pour créer un réseau de plusieurs gares d'un coup.`,
        target: '#btn-create-voie-point',
        page: 'map',
      },

      // ===========================
      // PARTIE 5 : BARRE LATERALE
      // ===========================
      {
        title: icon('info',14) + ' La barre latérale — Suivi en direct',
        text: `Sur la droite de la carte, la <b>barre latérale</b> affiche les informations en temps réel :<br><br>
        <b>Onglet "Trains" :</b><br>
        • Liste de tous les trains en circulation<br>
        • Pour chaque train : nom, état (en route / en gare / en attente), vitesse actuelle, retard<br>
        • Le prochain arrêt et l'heure prévue d'arrivée<br>
        • Cliquez sur un train pour le <b>centrer sur la carte</b><br><br>
        <b>Onglet "Fret" :</b><br>
        • Contrats de fret disponibles (marchandises à transporter d'un point A à un point B)<br>
        • Chaque contrat indique : type de marchandise, tonnage, gares, rémunération<br>
        • Cliquez "Accepter" pour prendre un contrat<br><br>
        <b>Onglet "Infos" :</b><br>
        • Statistiques globales du réseau (nombre de gares, km de voies, trains actifs)`,
        target: '#sidebar',
        page: 'map',
      },

      // ===========================
      // PARTIE 6 : MATERIEL ROULANT
      // ===========================
      {
        title: icon('train',14) + ' Matériel Roulant — Le catalogue',
        text: `L'onglet <b>"Matériel"</b> est votre catalogue d'achat de matériel roulant. Tout commence ici.<br><br>
        <b>3 catégories d'engins :</b><br><br>
        <b>Locomotives :</b><br>
        • Tirent les voitures et wagons<br>
        • Caractéristiques : vitesse max (km/h), puissance (kW), coût d'achat<br>
        • Exemples : BB 22200 (160 km/h), CC 72000 (140 km/h), BB 27000 (200 km/h)<br><br>
        <b>Voitures voyageurs :</b><br>
        • Transportent les passagers<br>
        • Caractéristiques : nombre de places assises, classe (1re/2e), coût<br><br>
        <b>Wagons fret :</b><br>
        • Transportent les marchandises<br>
        • Types : trémie (vrac), plat (conteneurs), citerne (liquides), porte-auto, couvert`,
        target: '[data-page="rolling-stock"]',
        page: 'rolling-stock',
      },
      {
        title: icon('train',14) + ' Acheter du matériel — Pas à pas',
        text: `<b>Pour acheter un engin :</b><br><br>
        <b>1.</b> Allez dans l'onglet <b>"Matériel"</b><br>
        <b>2.</b> Cliquez sur le bouton <b>"+ Ajouter un engin"</b><br>
        <b>3.</b> Un formulaire s'ouvre avec les champs suivants :<br>
        &nbsp;&nbsp;• <b>Nom</b> : donnez un nom à votre engin (ex: "Loco Paris-1")<br>
        &nbsp;&nbsp;• <b>Type</b> : choisissez Locomotive, Voiture ou Wagon<br>
        &nbsp;&nbsp;• <b>Modèle</b> : sélectionnez dans la liste des modèles disponibles<br>
        <b>4.</b> Cliquez <b>"Enregistrer"</b><br>
        <b>5.</b> Le prix est automatiquement déduit de votre solde<br><br>
        <b>Votre premier achat :</b><br>
        Achetez au minimum <b>1 locomotive + 2 voitures voyageurs</b>. C'est le strict nécessaire pour faire rouler un train.<br><br>
        <b>Inventaire :</b> Tous vos engins achetés apparaissent dans la liste en dessous. Les engins non affectés à une rame sont marqués comme "disponibles".`,
        target: '[data-page="rolling-stock"]',
        page: 'rolling-stock',
      },

      // ===========================
      // PARTIE 7 : RAMES
      // ===========================
      {
        title: icon('train',14) + ' Rames — Assembler vos trains',
        text: `Une <b>rame</b> est un train complet : une ou plusieurs locomotives + des voitures ou wagons assemblés ensemble. C'est la rame qui circule sur le réseau.<br><br>
        <b>Pour créer une rame :</b><br>
        <b>1.</b> Allez dans l'onglet <b>"Rames"</b><br>
        <b>2.</b> Cliquez sur <b>"+ Nouvelle rame"</b><br>
        <b>3.</b> Un formulaire s'ouvre :<br>
        &nbsp;&nbsp;• <b>Nom de la rame</b> : donnez un nom parlant (ex: "TER Lyon-Saint-Étienne")<br>
        &nbsp;&nbsp;• <b>Ajouter des engins</b> : sélectionnez dans la liste les engins disponibles (non affectés à une autre rame)<br>
        &nbsp;&nbsp;• Ajoutez d'abord la <b>locomotive</b>, puis les <b>voitures</b> ou <b>wagons</b><br>
        <b>4.</b> Cliquez <b>"Enregistrer la rame"</b><br><br>
        <b>Règle importante :</b> Un engin ne peut appartenir qu'à <b>une seule rame</b> à la fois. Si un engin est déjà dans une rame, il n'apparaîtra pas dans la liste des engins disponibles.`,
        target: '[data-page="rames"]',
        page: 'rames',
      },
      {
        title: icon('train',14) + ' Caractéristiques d\'une rame',
        text: `Une fois créée, votre rame affiche ses caractéristiques :<br><br>
        • <b>Vitesse max</b> : déterminée par l'engin <b>le plus lent</b> de la rame. Si vous mettez une loco à 200 km/h avec des voitures à 160 km/h, la rame roulera à 160 km/h max.<br>
        • <b>Capacité</b> : somme de toutes les places assises (voitures) ou tonnage (wagons)<br>
        • <b>Composition</b> : liste des engins dans l'ordre<br>
        • <b>Usure</b> : indicateur d'état mécanique (0% = neuf, 100% = usé). Augmente avec les km parcourus.<br>
        • <b>Km parcourus</b> : compteur kilométrique total de la rame<br><br>
        <b>Usure et pannes :</b><br>
        Quand l'usure dépasse 80%, le risque de <b>panne en ligne</b> augmente fortement. Un train en panne est immobilisé sur la voie et bloque la circulation.<br><br>
        <b>Astuce :</b> Envoyez vos rames en <b>maintenance préventive</b> (onglet Dépôts) avant qu'elles ne tombent en panne.`,
        target: '[data-page="rames"]',
        page: 'rames',
      },

      // ===========================
      // PARTIE 8 : HORAIRES
      // ===========================
      {
        title: icon('calendar',14) + ' Horaires — Créer un service',
        text: `Un <b>service</b> est un trajet planifié d'un train (= une rame qui roule selon un horaire). C'est le cœur de l'exploitation.<br><br>
        <b>Pour créer un service :</b><br>
        <b>1.</b> Allez dans l'onglet <b>"Horaires"</b><br>
        <b>2.</b> Cliquez sur <b>"+ Créer un trajet"</b><br>
        <b>3.</b> Un formulaire s'ouvre avec :<br>
        &nbsp;&nbsp;• <b>Nom du service</b> : ex: "TER 42 Paris-Lille"<br>
        &nbsp;&nbsp;• <b>Rame</b> : sélectionnez la rame qui effectuera ce trajet<br>
        &nbsp;&nbsp;• <b>Arrêts</b> : ajoutez les gares une par une (départ → intermédiaires → arrivée)<br>
        &nbsp;&nbsp;• <b>Heures de départ</b> : définissez l'heure à chaque arrêt<br><br>
        <b>4.</b> Le système <b>calcule automatiquement</b> le temps de trajet entre chaque gare, basé sur :<br>
        &nbsp;&nbsp;• La <b>distance réelle</b> le long des voies ORM (pas en vol d'oiseau)<br>
        &nbsp;&nbsp;• La <b>vitesse max</b> de la rame ET de l'infrastructure<br>
        &nbsp;&nbsp;• Les temps d'accélération et décélération<br>
        <b>5.</b> Cliquez <b>"Créer"</b>`,
        target: '[data-page="schedules"]',
        page: 'schedules',
      },
      {
        title: icon('calendar',14) + ' Options avancées des services',
        text: `<b>Aller-retour automatique :</b><br>
        Cochez "Aller-retour" pour que le train fasse le trajet dans les deux sens automatiquement. Le système génère les arrêts retour avec les bons horaires.<br><br>
        <b>Bouton "Auto 24h" :</b><br>
        Génère automatiquement des départs toute la journée avec un intervalle régulier. Pratique pour les lignes à haute fréquence.<br><br>
        <b>Tri des services :</b><br>
        Utilisez le sélecteur <b>"Trier par"</b> en haut de la page pour classer vos services par :<br>
        • Ordre de création (défaut)<br>
        • Heure de départ (chronologique)<br>
        • Rame affectée (groupés par train)<br>
        • Nom du service (alphabétique)<br>
        • Itinéraire (groupés par gares)<br><br>
        <b>Attention :</b> Une rame ne peut assurer qu'<b>un seul service à la fois</b>. Vérifiez que votre rame est libre avant de créer un nouveau service.`,
        target: '[data-page="schedules"]',
        page: 'schedules',
      },

      // ===========================
      // PARTIE 9 : LIGNES
      // ===========================
      {
        title: icon('track',14) + ' Lignes — Organiser votre réseau',
        text: `Les <b>lignes</b> regroupent plusieurs services sous un même nom et une même couleur. C'est purement organisationnel mais très utile.<br><br>
        <b>Exemple concret :</b><br>
        • <b>Ligne A</b> (bleu) : regroupe les 3 services Paris → Lyon de la journée<br>
        • <b>Ligne B</b> (rouge) : regroupe les 2 services Lyon → Marseille<br>
        • <b>Ligne Fret</b> (vert) : tous les services de marchandises<br><br>
        <b>Pour créer une ligne :</b><br>
        1. Allez dans l'onglet <b>"Lignes"</b><br>
        2. Cliquez <b>"+ Créer une ligne"</b><br>
        3. Donnez un <b>nom</b> et choisissez une <b>couleur</b><br>
        4. Assignez des <b>services existants</b> à cette ligne<br><br>
        <b>Avantages :</b><br>
        • Sur la carte, les tronçons s'affichent dans la <b>couleur de la ligne</b><br>
        • Le Graphique de Marche permet de <b>filtrer par ligne</b><br>
        • Vue d'ensemble claire de votre réseau`,
        target: '[data-page="lines"]',
        page: 'lines',
      },

      // ===========================
      // PARTIE 10 : PERSONNEL
      // ===========================
      {
        title: icon('people',14) + ' Personnel — Vos conducteurs',
        text: `Chaque train a besoin d'un <b>conducteur</b> pour circuler.<br><br>
        <b>Embaucher :</b><br>
        1. Allez dans l'onglet <b>"Personnel"</b><br>
        2. Cliquez <b>"Embaucher un conducteur"</b><br>
        3. Coût d'embauche : <b>2 000 €</b> (une seule fois)<br>
        4. Salaire quotidien : <b>120 €/jour</b> (déduit automatiquement chaque jour)<br><br>
        <b>Affecter à un service :</b><br>
        • Dans l'onglet Horaires, chaque service a un champ "Conducteur"<br>
        • Sélectionnez un conducteur disponible dans la liste<br>
        • Un conducteur ne peut être affecté qu'à <b>un seul service</b><br><br>
        <b>Licencier :</b><br>
        • Vous pouvez licencier un conducteur <b>non affecté</b> à un service<br>
        • Le coût d'embauche n'est pas remboursé<br><br>
        <b>Astuce :</b> Embauchez toujours <b>1 conducteur de plus</b> que le nombre de services pour avoir un remplaçant.`,
        target: '[data-page="staff"]',
        page: 'staff',
      },

      // ===========================
      // PARTIE 11 : DEPOTS ET MAINTENANCE
      // ===========================
      {
        title: icon('wrench',14) + ' Dépôts — Maintenance de vos rames',
        text: `Les <b>dépôts</b> sont indispensables pour entretenir vos rames et éviter les pannes.<br><br>
        <b>Créer un dépôt :</b><br>
        1. Allez dans l'onglet <b>"Dépôts/ITE"</b><br>
        2. Cliquez <b>"+ Ajouter"</b><br>
        3. Sélectionnez la gare où installer le dépôt<br><br>
        <b>Maintenance préventive :</b><br>
        • Quand l'usure d'une rame monte (visible dans l'onglet Rames), envoyez-la en maintenance<br>
        • La maintenance remet l'usure à <b>0%</b><br>
        • Elle prend du temps (proportionnel au niveau d'usure)<br>
        • Coût : quelques milliers d'euros<br><br>
        <b>Réparation d'urgence :</b><br>
        • Si un train tombe en panne en ligne, il est <b>immobilisé</b><br>
        • Envoyez une <b>locomotive de secours</b> pour le remorquer au dépôt<br>
        • La réparation coûte <b>2 à 3 fois plus cher</b> que la maintenance préventive<br><br>
        <b>Astuce :</b> Planifiez la maintenance pendant les heures creuses (la nuit) pour ne pas interrompre le service.`,
        target: '[data-page="depots"]',
        page: 'depots',
      },

      // ===========================
      // PARTIE 12 : INCIDENTS
      // ===========================
      {
        title: icon('warning',14) + ' Incidents — Gérer les imprévus',
        text: `Des incidents peuvent survenir à tout moment sur votre réseau :<br><br>
        <b>Types d'incidents :</b><br>
        • <b>Panne de rame</b> : usure trop élevée → train immobilisé en pleine voie<br>
        • <b>Travaux sur les voies</b> : ralentissement (60 km/h) ou interruption totale d'un tronçon<br>
        • <b>Personne sur les voies</b> : arrêt complet temporaire (0 km/h)<br>
        • <b>Panne de signalisation</b> : vitesse limitée à 30 km/h<br>
        • <b>Panne caténaire</b> : vitesse limitée à 40 km/h<br><br>
        <b>Créer un incident (test) :</b><br>
        Vous pouvez simuler un incident avec le bouton <b>"+ Créer un incident"</b> pour tester la réaction de votre réseau.<br><br>
        <b>Impact financier :</b><br>
        Les retards de plus de 15 minutes causent une <b>pénalité de -25%</b> sur les revenus du service concerné.`,
        target: '[data-page="incidents"]',
        page: 'incidents',
      },

      // ===========================
      // PARTIE 13 : FINANCES
      // ===========================
      {
        title: icon('money',14) + ' Finances — Gérer votre trésorerie',
        text: `L'onglet <b>"Finances"</b> est votre comptabilité complète.<br><br>
        <b>Revenus (en vert) :</b><br>
        • Passagers transportés : revenu proportionnel à la distance et au nombre de voyageurs<br>
        • Contrats de fret réalisés : paiement à la livraison<br><br>
        <b>Dépenses (en rouge) :</b><br>
        • Coûts d'exploitation quotidiens par service actif<br>
        • Salaires des conducteurs (120€/jour/conducteur)<br>
        • Maintenance et réparations au dépôt<br>
        • Remboursement d'emprunts bancaires<br>
        • Achats de matériel, gares, modules<br><br>
        <b>Ce que vous voyez :</b><br>
        • Solde actuel (aussi affiché en permanence dans le header)<br>
        • Revenus et dépenses du jour<br>
        • Historique complet des transactions<br>
        • Km totaux parcourus par le réseau<br><br>
        <b>Attention :</b> En solde négatif, vos trains roulent toujours mais les dettes s'accumulent. Prenez un emprunt bancaire si nécessaire.`,
        target: '[data-page="economy"]',
        page: 'economy',
      },

      // ===========================
      // PARTIE 14 : BANQUE
      // ===========================
      {
        title: icon('bank',14) + ' Banque — Emprunts et investissement',
        text: `La <b>Banque</b> vous permet d'emprunter pour investir dans votre réseau.<br><br>
        <b>4 niveaux d'emprunt :</b><br>
        • <b>Petit prêt</b> : 50 000 € à 3% sur 30 jours (remboursement ~1 717€/j)<br>
        • <b>Prêt moyen</b> : 200 000 € à 5% sur 60 jours (~3 500€/j)<br>
        • <b>Gros prêt</b> : 500 000 € à 7% sur 90 jours (~5 944€/j)<br>
        • <b>Méga prêt</b> : 1 000 000 € à 10% sur 120 jours (~9 167€/j)<br><br>
        <b>Comment ça marche :</b><br>
        1. Cliquez sur le type de prêt souhaité<br>
        2. L'argent est <b>crédité immédiatement</b> sur votre solde<br>
        3. Le remboursement est <b>automatique et quotidien</b><br>
        4. Maximum <b>5 emprunts simultanés</b><br><br>
        <b>Stratégie :</b> Empruntez pour acheter du matériel et créer des services rentables. Les revenus générés doivent couvrir les remboursements.`,
        target: '[data-page="bank"]',
        page: 'bank',
      },

      // ===========================
      // PARTIE 15 : INFOGARE
      // ===========================
      {
        title: icon('screen',14) + ' Infogare — Panneaux d\'information',
        text: `L'<b>Infogare</b> reproduit fidèlement les panneaux d'information voyageurs des gares SNCF.<br><br>
        <b>Comment l'utiliser :</b><br>
        1. Allez dans l'onglet <b>"Infogare"</b><br>
        2. Sélectionnez une <b>gare</b> dans la liste déroulante<br>
        3. Cliquez <b>"Afficher"</b><br><br>
        <b>Ce qui s'affiche :</b><br>
        • Les <b>prochains départs</b> avec : heure, destination, numéro de quai<br>
        • Les <b>retards</b> en temps réel (en rouge)<br>
        • Le <b>style visuel</b> fidèle aux vrais écrans de gare<br><br>
        <b>Utilité :</b><br>
        • Vérifier que vos services desservent bien toutes les gares prévues<br>
        • Identifier les retards récurrents sur certaines lignes<br>
        • C'est un outil de supervision : rien à configurer, juste à consulter.`,
        target: '[data-page="infogare"]',
        page: 'infogare',
      },

      // ===========================
      // PARTIE 16 : DASHBOARD
      // ===========================
      {
        title: icon('dashboard',14) + ' Dashboard — Tableau de bord',
        text: `Le <b>Dashboard</b> rassemble les statistiques clés de votre réseau en un coup d'oeil.<br><br>
        <b>6 KPIs principaux :</b><br>
        • <b>Ponctualité</b> : % de trains arrivés à l'heure (objectif : > 90%)<br>
        • <b>Trains actifs</b> : nombre de services en circulation actuellement<br>
        • <b>Retard moyen</b> : en minutes, sur l'ensemble du réseau<br>
        • <b>Usure moyenne</b> : état mécanique global de votre flotte<br>
        • <b>Solde</b> : trésorerie actuelle<br>
        • <b>Km parcourus</b> : total réseau cumulé<br><br>
        <b>Graphiques 24h :</b><br>
        • Courbe de ponctualité heure par heure<br>
        • Courbe de revenus par tranche horaire<br><br>
        <b>Tableau des trains :</b> Liste de tous les trains actifs avec nom, état, vitesse et retard.`,
        target: '[data-page="dashboard"]',
        page: 'dashboard',
      },

      // ===========================
      // PARTIE 17 : GRAPHIQUE DE MARCHE
      // ===========================
      {
        title: icon('chart',14) + ' Graphique de Marche — Diagramme SNCF',
        text: `Le <b>Graphique de Marche</b> est l'outil professionnel utilisé par les régulateurs SNCF pour superviser le trafic.<br><br>
        <b>Comment le lire :</b><br>
        • <b>Axe horizontal</b> = le temps (0h à 24h)<br>
        • <b>Axe vertical</b> = la distance (km depuis l'origine)<br>
        • Chaque <b>ligne colorée</b> = un train<br>
        • La <b>pente</b> = la vitesse (raide = rapide, plat = arrêt en gare)<br>
        • Les <b>paliers horizontaux</b> = arrêts en gare<br><br>
        <b>Ce qu'on peut voir :</b><br>
        • Deux trains qui se <b>croisent</b> sur le graphique = potentiel conflit<br>
        • Des lignes parallèles rapprochées = trains qui se suivent de près<br>
        • Un écart entre le tracé prévu et réel = retard<br><br>
        <b>Filtrage :</b> Sélectionnez une ligne spécifique pour n'afficher que ses trains.`,
        target: '[data-page="graph-marche"]',
        page: 'graph-marche',
      },

      // ===========================
      // PARTIE 18 : METEO
      // ===========================
      {
        title: icon('weather',14) + ' Météo LIVE — Données en temps réel',
        text: `Le système météo utilise les <b>vraies données météorologiques</b> via l'API Open-Meteo.<br><br>
        <b>Données affichées :</b><br>
        • Température et température ressentie<br>
        • Humidité et point de rosée<br>
        • Vitesse et direction du vent<br>
        • Précipitations (mm)<br>
        • Couverture nuageuse (3 couches : basses, moyennes, hautes)<br>
        • Pression atmosphérique, visibilité, indice UV<br><br>
        <b>Basées sur la position réelle</b> du centre de la carte. Déplacez la carte vers une autre ville pour voir sa météo locale.<br><br>
        <b>Badge LIVE vert</b> = données réelles. Mise à jour toutes les 5 minutes.`,
        target: '[data-page="weather"]',
        page: 'weather',
      },
      {
        title: icon('weather',14) + ' Impact météo sur les trains',
        text: `La météo affecte directement la <b>vitesse de vos trains</b> :<br><br>
        <b>6 conditions et leur impact :</b><br>
        • <b>Dégagé</b> : 100% de la vitesse (aucun impact)<br>
        • <b>Canicule</b> : 85% (rails qui se dilatent)<br>
        • <b>Pluie</b> : 90% (adhérence réduite)<br>
        • <b>Brouillard</b> : 75% (visibilité réduite)<br>
        • <b>Neige</b> : 70% (risque de gel des aiguillages)<br>
        • <b>Tempête</b> : 60% (vents violents)<br><br>
        <b>Radar et nuages sur la carte :</b><br>
        • Cochez <b>"Radar"</b> dans les toggles de la carte pour voir le <b>radar de précipitations</b> en temps réel (données RainViewer)<br>
        • Cochez <b>"Nuages"</b> pour voir la <b>couverture nuageuse</b><br>
        • Les couleurs du radar vont du bleu (pluie faible) au rouge (pluie forte)`,
        target: '[data-page="weather"]',
        page: 'weather',
      },

      // ===========================
      // PARTIE 19 : SYNDICATS
      // ===========================
      {
        title: icon('shield',14) + ' Syndicats — Relations sociales',
        text: `Les <b>Syndicats</b> représentent la satisfaction de vos employés. Une satisfaction basse = risque de grève.<br><br>
        <b>Satisfaction sociale (0-100%) :</b><br>
        • > 70% : risque de grève quasi nul<br>
        • 50-70% : risque faible, revendications possibles<br>
        • 30-50% : risque moyen (10% de chance de grève par jour)<br>
        • < 30% : risque élevé (25% par jour)<br><br>
        <b>Facteurs qui influencent la satisfaction :</b><br>
        • Salaires, santé financière de la compagnie, ponctualité, charge de travail<br><br>
        <b>En cas de grève :</b><br>
        • Durée : 1 à 3 jours<br>
        • 30-80% de vos services sont bloqués<br>
        • Pertes de revenus importantes<br><br>
        <b>Négocier (préventivement) :</b><br>
        • <b>Prime</b> (10 000 €) : +15% satisfaction<br>
        • <b>Augmentation</b> (25 000 €) : +25% satisfaction<br>
        • <b>Amélioration des conditions</b> (50 000 €) : +35% satisfaction`,
        target: '[data-page="unions"]',
        page: 'unions',
      },

      // ===========================
      // PARTIE 20 : SAISONS
      // ===========================
      {
        title: icon('calendar',14) + ' Saisons — Grilles horaires été/hiver',
        text: `Les <b>Horaires Saisonniers</b> permettent d'adapter vos services selon la saison.<br><br>
        <b>3 modes :</b><br>
        • <b>Normal</b> : tous les services actifs<br>
        • <b>Grille été</b> (1er juin → 30 sept) : renforcez les lignes touristiques<br>
        • <b>Grille hiver</b> (1er oct → 31 mai) : réduisez les services peu fréquentés<br><br>
        <b>Configuration :</b><br>
        • Pour chaque service, cochez s'il doit être actif en été, en hiver, ou les deux<br>
        • Le changement de grille est <b>automatique</b> selon la date du jeu<br>
        • Vous pouvez aussi forcer manuellement la grille active<br><br>
        <b>Stratégie :</b> Désactivez les services peu rentables en hiver et ajoutez des renforts sur les lignes touristiques en été.`,
        target: '[data-page="seasonal"]',
        page: 'seasonal',
      },

      // ===========================
      // PARTIE 21 : CORRESPONDANCES
      // ===========================
      {
        title: icon('transfer',14) + ' Correspondances — Transferts entre trains',
        text: `Les <b>Correspondances</b> gèrent les transferts de passagers entre deux trains en gare.<br><br>
        <b>Créer une correspondance :</b><br>
        1. Choisissez le <b>service arrivant</b> (le train qui amène les passagers)<br>
        2. Choisissez le <b>service partant</b> (le train de correspondance)<br>
        3. Choisissez la <b>gare commune</b> aux deux services<br><br>
        <b>Politique d'attente :</b><br>
        • <b>Stricte (0 min)</b> : le train partant ne attend jamais → ponctualité max mais correspondances ratées si retard<br>
        • <b>Modérée (5 min)</b> : attend jusqu'à 5 min → bon compromis<br>
        • <b>Flexible (15 min)</b> : attend jusqu'à 15 min → correspondances réussies mais risque de retard en cascade<br><br>
        <b>Suivi :</b> Taux de correspondances réussies vs ratées avec historique complet.`,
        target: '[data-page="connections"]',
        page: 'connections',
      },

      // ===========================
      // PARTIE 22 : GARES MODULAIRES
      // ===========================
      {
        title: icon('upgrade',14) + ' Gares+ — Améliorations modulaires',
        text: `Améliorez vos gares avec des <b>modules</b> qui augmentent la fréquentation et la satisfaction.<br><br>
        <b>8 modules disponibles :</b><br>
        • <b>Quai supplémentaire</b> (15 000 €) : +1 quai pour accueillir plus de trains<br>
        • <b>Parking voyageurs</b> (20 000 €) : +5% de fréquentation<br>
        • <b>Hall voyageurs</b> (50 000 €) : +10% fréquentation, +5% satisfaction<br>
        • <b>Écrans Infogare</b> (8 000 €) : +3% satisfaction voyageurs<br>
        • <b>Voie de garage</b> (25 000 €) : stationnement et retournement de rames<br>
        • <b>Terminal fret</b> (40 000 €) : chargement/déchargement de marchandises<br>
        • <b>Restauration</b> (12 000 €) : +3% satisfaction<br>
        • <b>WiFi gratuit</b> (5 000 €) : +2% satisfaction<br><br>
        <b>Niveau de gare :</b> Le niveau augmente automatiquement avec l'investissement total (+1 niveau par 50 000 € investis). Les gares de haut niveau attirent plus de voyageurs.`,
        target: '[data-page="station-upgrades"]',
        page: 'station-upgrades',
      },

      // ===========================
      // PARTIE 23 : AIGUILLAGES
      // ===========================
      {
        title: icon('junction',14) + ' Aiguillages — Bifurcations',
        text: `Les <b>aiguillages</b> gèrent les bifurcations et voies de garage en gare.<br><br>
        <b>3 types d'aiguillages (5 000 € chacun) :</b><br>
        • <b>Simple</b> : dévie un train sur une voie adjacente<br>
        • <b>Double</b> : passage dans les deux sens<br>
        • <b>Croisement</b> : croisement de deux voies<br><br>
        <b>États possibles :</b><br>
        • <b>Normal</b> : le train continue tout droit<br>
        • <b>Dévié</b> : le train est redirigé vers la voie secondaire<br>
        • <b>Verrouillé</b> : aucun changement possible<br><br>
        <b>Voies de garage (10 000 € chacune) :</b><br>
        • Stationnez des rames inutilisées<br>
        • Capacité : 2 rames par voie de garage<br>
        • Utile pour garer les trains la nuit ou entre deux services`,
        target: '[data-page="junctions"]',
        page: 'junctions',
      },

      // ===========================
      // PARTIE 24 : FRET - MARCHANDISES
      // ===========================
      {
        title: icon('cargo',14) + ' Marchandises — Les 7 catégories',
        text: `Le fret est une source de revenus importante. Voici les 7 types de marchandises :<br><br>
        • <b>Vrac</b> : charbon, sable, gravier, minerai, céréales (wagon trémie)<br>
        • <b>Conteneurs</b> : 20', 40', réfrigérés (wagon plat)<br>
        • <b>Liquides</b> : carburant, produits chimiques, GPL (wagon citerne, max 80 km/h)<br>
        • <b>Matières dangereuses (TMD)</b> : explosifs, toxiques, radioactifs (max 60 km/h)<br>
        • <b>Automobiles</b> : voitures et camions neufs (wagon porte-auto)<br>
        • <b>Sidérurgie</b> : bobines d'acier, poutrelles, aluminium<br>
        • <b>Bois et Papier</b> : bois brut, pâte à papier, rouleaux<br><br>
        Chaque type a un <b>temps de chargement</b> et un <b>prix/unité</b> spécifique. Les TMD imposent une vitesse réduite obligatoire.`,
        target: '[data-page="cargo-types"]',
        page: 'cargo-types',
      },

      // ===========================
      // PARTIE 25 : FRET - CONTRATS
      // ===========================
      {
        title: icon('cargo',14) + ' Contrats de fret — Comment ça marche',
        text: `Le fret fonctionne par <b>contrats</b> :<br><br>
        <b>1. Voir les contrats disponibles :</b><br>
        • Dans la barre latérale de la carte, onglet <b>"Fret"</b><br>
        • Chaque contrat indique : type de marchandise, tonnage, gare de départ, gare d'arrivée, rémunération<br><br>
        <b>2. Accepter un contrat :</b><br>
        • Cliquez <b>"Accepter"</b> sur le contrat qui vous intéresse<br>
        • Vous devez avoir une rame avec des <b>wagons adaptés</b> au type de marchandise<br><br>
        <b>3. Livrer :</b><br>
        • Créez un service fret (onglet Horaires) avec la rame de wagons<br>
        • Le chargement et déchargement se font automatiquement en gare<br>
        • Le paiement est versé à la livraison<br><br>
        <b>Astuce :</b> Les gros contrats (ports, raffineries) rapportent beaucoup mais nécessitent des ITE bien équipées.`,
        target: null,
        page: 'map',
      },

      // ===========================
      // PARTIE 26 : ITE MODULES
      // ===========================
      {
        title: icon('factory',14) + ' ITE+ — Équiper vos installations fret',
        text: `Les <b>ITE (Installations Terminales Embranchées)</b> sont les infrastructures de chargement/déchargement du fret.<br><br>
        <b>Modules de chargement :</b><br>
        • <b>Voie de chargement</b> (25K€) : +1 voie de chargement simultané<br>
        • <b>Grue</b> (45K€) : -20% de temps de chargement<br>
        • <b>Portique conteneurs</b> (120K€) : chargement rapide des conteneurs<br>
        • <b>Faisceau de triage</b> (90K€) : manoeuvres 30% plus rapides<br><br>
        <b>Modules de stockage :</b><br>
        • <b>Silo</b> (35K€) : 500 tonnes de vrac<br>
        • <b>Entrepôt</b> (55K€) : 300 tonnes, protégé du vol<br>
        • <b>Parc de citernes</b> (80K€) : 200m3 de liquides + TMD<br>
        • <b>Pont-bascule</b> (20K€) : pesée automatique<br><br>
        Plus l'ITE est équipée, plus elle attire de clients industriels et plus les opérations sont rapides.`,
        target: '[data-page="ite-modules"]',
        page: 'ite-modules',
      },

      // ===========================
      // PARTIE 27 : INDUSTRIELS
      // ===========================
      {
        title: icon('factory',14) + ' Industriels — Clients gros volume',
        text: `Attirez des <b>entreprises</b> qui génèrent du fret massif et régulier :<br><br>
        <b>10 types d'industries :</b><br>
        • Cimenterie (200-800 t/j) — 80K€<br>
        • Raffinerie (500-2000 t/j) — 200K€<br>
        • Port maritime (800-5000 t/j) — 350K€<br>
        • Aciérie (400-1500 t/j) — 150K€<br>
        • Usine automobile (100-500 unités/j) — 120K€<br>
        • Terminal céréalier (300-1200 t/j) — 90K€<br>
        • Usine chimique (150-600 t/j) — 130K€<br>
        • Papeterie (200-700 t/j) — 75K€<br>
        • Plateforme logistique (400-3000 t/j) — 250K€<br>
        • Centrale thermique (500-2500 t/j) — 100K€<br><br>
        Les clients génèrent <b>automatiquement des contrats fret chaque jour</b>. Leur satisfaction dépend de la qualité de votre ITE.`,
        target: '[data-page="industrial-clients"]',
        page: 'industrial-clients',
      },

      // ===========================
      // PARTIE 28 : TRIAGE
      // ===========================
      {
        title: icon('shunting',14) + ' Triage — Manoeuvres réalistes',
        text: `Le <b>triage</b> simule les opérations de manoeuvre en ITE, comme dans la vraie vie :<br><br>
        <b>8 phases par opération :</b><br>
        1. <b>Arrivée</b> (5 min) — le train entre dans l'ITE<br>
        2. <b>Découplage</b> (8 min) — séparation des wagons de la locomotive<br>
        3. <b>Poussage</b> (10 min) — wagons poussés vers la voie de chargement<br>
        4. <b>Chargement/Déchargement</b> (variable) — proportionnel au tonnage<br>
        5. <b>Tirage</b> (8 min) — wagons tirés hors de la voie de chargement<br>
        6. <b>Recouplage</b> (6 min) — rattachement des wagons à la locomotive<br>
        7. <b>Inspection</b> (5 min) — vérification des freins et attelages<br>
        8. <b>Départ</b> (3 min) — le train quitte l'ITE<br><br>
        Les durées sont réduites par les modules ITE (grues, faisceaux de triage).`,
        target: '[data-page="shunting"]',
        page: 'shunting',
      },

      // ===========================
      // PARTIE 29 : SAUVEGARDE
      // ===========================
      {
        title: icon('save',14) + ' Sauvegarde — Ne perdez rien',
        text: `Le jeu sauvegarde votre progression de plusieurs façons :<br><br>
        <b>Sauvegarde automatique :</b><br>
        • Le jeu sauvegarde <b>automatiquement toutes les 10 secondes</b> dans le navigateur (localStorage)<br>
        • Quand vous relancez le jeu, cliquez "Reprendre la partie" pour recharger<br><br>
        <b>Sauvegarde manuelle (fichier) :</b><br>
        • Cliquez le bouton <b>Sauvegarder</b> dans le header pour exporter en fichier<br>
        • Le fichier est au format <b>.json.gz</b> (compressé) ou <b>.json</b><br>
        • Très léger : un réseau de 300 gares + 100K km tient en ~250 KB<br><br>
        <b>Charger une sauvegarde :</b><br>
        • Cliquez le bouton <b>Charger</b> dans le header<br>
        • Sélectionnez votre fichier .json ou .json.gz<br>
        • Compatible avec les anciennes sauvegardes (rétrocompatible)<br><br>
        <b>Astuce :</b> Exportez régulièrement une sauvegarde fichier comme backup. Le localStorage peut être effacé si vous videz les données du navigateur.`,
        target: null,
        page: null,
      },

      // ===========================
      // PARTIE 30 : GUIDE DE DEMARRAGE RAPIDE
      // ===========================
      {
        title: icon('info',14) + ' Guide de démarrage rapide',
        text: `Voici les étapes recommandées pour vos <b>premières 10 minutes</b> de jeu :<br><br>
        <b>Étape 1 — Créer 2 gares :</b><br>
        Naviguez vers une zone avec des voies ferrées (ex: autour de Paris). Créez 2 gares sur ou près des voies.<br><br>
        <b>Étape 2 — Acheter du matériel :</b><br>
        Onglet "Matériel" → "+ Ajouter un engin". Achetez 1 locomotive + 2 voitures voyageurs.<br><br>
        <b>Étape 3 — Créer une rame :</b><br>
        Onglet "Rames" → "+ Nouvelle rame". Ajoutez la loco + les 2 voitures.<br><br>
        <b>Étape 4 — Embaucher un conducteur :</b><br>
        Onglet "Personnel" → "Embaucher un conducteur".<br><br>
        <b>Étape 5 — Créer un service :</b><br>
        Onglet "Horaires" → "+ Créer un trajet". Sélectionnez votre rame, ajoutez les 2 gares, définissez l'heure de départ.<br><br>
        <b>Étape 6 — Lancer !</b><br>
        Accélérez le temps (x5 ou x15) et regardez votre premier train circuler !`,
        target: null,
        page: null,
      },

      // ===========================
      // PARTIE 31 : CONSEILS AVANCES
      // ===========================
      {
        title: icon('info',14) + ' Conseils avancés pour progresser',
        text: `<b>Développer votre réseau :</b><br>
        • Commencez petit (2-3 gares, 1 ligne) puis étendez progressivement<br>
        • Ajoutez des gares intermédiaires pour augmenter les revenus d'un trajet<br>
        • Créez des lignes radiales (en étoile) depuis une gare centrale<br><br>
        <b>Optimiser la rentabilité :</b><br>
        • Les lignes longue distance rapportent plus mais coûtent plus en exploitation<br>
        • Les correspondances augmentent le nombre de passagers<br>
        • Améliorez vos gares principales en priorité (hall + parking)<br><br>
        <b>Gérer les problèmes :</b><br>
        • Surveillez l'usure des rames dans l'onglet Rames (maintenance avant 80%)<br>
        • Négociez avec les syndicats dès que la satisfaction passe sous 60%<br>
        • Prenez un emprunt si votre solde est trop bas pour investir<br><br>
        <b>Le fret :</b><br>
        • Commencez le fret avec une ITE simple + 1 locomotive + 3-4 wagons<br>
        • Les ports maritimes et raffineries sont les clients les plus rentables<br>
        • Investissez dans les modules ITE pour accélérer les opérations<br><br>
        <b>Bonne chance, Directeur !</b>`,
        target: null,
        page: null,
      },
    ];
    this.currentStep = 0;
    this.active = false;
    this._overlay = null;
  }

  start(game) {
    this.currentStep = 0;
    this.active = true;
    this._game = game;
    this._createOverlay();
    this._renderStep();
  }

  stop() {
    this.active = false;
    this._removeOverlay();
  }

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this._renderStep();
    } else {
      this.stop();
    }
  }

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this._renderStep();
    }
  }

  _createOverlay() {
    this._removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-box">
        <div class="tutorial-header">
          <span class="tutorial-step-counter"></span>
          <button class="tutorial-close">&times;</button>
        </div>
        <h3 class="tutorial-title"></h3>
        <div class="tutorial-text"></div>
        <div class="tutorial-progress"></div>
        <div class="tutorial-nav">
          <button class="tutorial-prev">← Précédent</button>
          <button class="tutorial-next">Suivant →</button>
        </div>
      </div>
      <div class="tutorial-highlight"></div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;

    overlay.querySelector('.tutorial-close').addEventListener('click', () => this.stop());
    overlay.querySelector('.tutorial-prev').addEventListener('click', () => this.prev());
    overlay.querySelector('.tutorial-next').addEventListener('click', () => this.next());
    overlay.querySelector('.tutorial-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.stop();
    });
  }

  _removeOverlay() {
    const el = document.getElementById('tutorial-overlay');
    if (el) el.remove();
    this._overlay = null;
  }

  _renderStep() {
    if (!this._overlay || !this.active) return;
    const step = this.steps[this.currentStep];

    // Navigate to correct page if needed
    if (step.page && this._game?.ui) {
      this._game.ui.switchPage(step.page);
    }

    // Update content
    this._overlay.querySelector('.tutorial-title').innerHTML = step.title;
    this._overlay.querySelector('.tutorial-text').innerHTML = step.text;
    this._overlay.querySelector('.tutorial-step-counter').textContent = `Étape ${this.currentStep + 1} sur ${this.steps.length}`;

    // Progress bar
    const pct = ((this.currentStep + 1) / this.steps.length * 100).toFixed(0);
    this._overlay.querySelector('.tutorial-progress').innerHTML =
      `<div style="background:var(--bg3);height:4px;border-radius:2px;margin:12px 0"><div style="background:var(--blue);height:4px;border-radius:2px;width:${pct}%"></div></div>`;

    // Navigation buttons
    const prevBtn = this._overlay.querySelector('.tutorial-prev');
    const nextBtn = this._overlay.querySelector('.tutorial-next');
    prevBtn.style.visibility = this.currentStep > 0 ? 'visible' : 'hidden';
    nextBtn.textContent = this.currentStep < this.steps.length - 1 ? 'Suivant →' : 'Terminer ✓';

    // Highlight target element
    const highlight = this._overlay.querySelector('.tutorial-highlight');
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        highlight.style.display = 'block';
        highlight.style.top = (rect.top - 4) + 'px';
        highlight.style.left = (rect.left - 4) + 'px';
        highlight.style.width = (rect.width + 8) + 'px';
        highlight.style.height = (rect.height + 8) + 'px';
      } else {
        highlight.style.display = 'none';
      }
    } else {
      highlight.style.display = 'none';
    }

    // Scroll tutorial box to top
    const box = this._overlay.querySelector('.tutorial-box');
    if (box) box.scrollTop = 0;
  }
}
