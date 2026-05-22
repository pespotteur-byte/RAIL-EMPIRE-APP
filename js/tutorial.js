/**
 * Tutorial — Interactive step-by-step guide for new players.
 * Overlay-based, does not modify any game state.
 */
export class Tutorial {
  constructor() {
    this.steps = [
      // === INTRODUCTION ===
      {
        title: 'Bienvenue dans Rail Empire !',
        text: `Ce tutoriel va vous guider <b>pas à pas</b> à travers toutes les fonctionnalités du jeu pour construire votre empire ferroviaire.<br><br>
        Vous allez apprendre à :<br>
        • Créer des gares et poser des voies<br>
        • Acheter du matériel roulant et composer des rames<br>
        • Planifier des horaires et créer des lignes<br>
        • Gérer vos finances, votre personnel et vos dépôts<br>
        • Et bien plus encore !<br><br>
        <i>Vous pouvez quitter à tout moment en cliquant sur ×</i>`,
        target: null,
        page: null,
      },

      // === LA CARTE ===
      {
        title: '🗺️ La Carte — Vue d\'ensemble',
        text: `La carte est le cœur du jeu. Elle affiche une carte OpenStreetMap avec les <b>voies ferrées réelles</b> (couche OpenRailwayMap).<br><br>
        <b>Navigation :</b><br>
        • <b>Déplacer</b> : clic gauche + glisser<br>
        • <b>Zoomer</b> : molette de la souris<br>
        • <b>Zoom max</b> : vous verrez les voies ferrées détaillées<br><br>
        <b>Éléments visibles :</b><br>
        • 🔵 <b>Gares</b> : cercles bleus avec nom<br>
        • 🟢 <b>Trains en marche</b> : points qui se déplacent sur les voies<br>
        • 🔴 <b>Incidents</b> : cercles rouges clignotants<br>
        • ⚫ <b>Points de voie</b> : petits points pour le tracé des routes`,
        target: '#game-canvas',
        page: 'map',
      },
      {
        title: '🏗️ Créer une Gare',
        text: `Pour créer votre première gare :<br><br>
        1. Cliquez sur <b>"+ Créer une gare"</b> en haut à gauche de la carte<br>
        2. Le curseur se transforme en croix<br>
        3. Cliquez sur la carte à l'endroit où vous voulez placer la gare (idéalement sur une voie ferrée existante)<br>
        4. Donnez un nom à la gare et choisissez le nombre de quais<br>
        5. Cliquez <b>"Créer"</b><br><br>
        <b>💡 Astuce :</b> Créez vos gares <b>sur ou à côté des voies ferrées</b> existantes pour que le routage automatique fonctionne. Vous avez besoin d'au moins <b>2 gares</b> pour créer un service.<br><br>
        <b>Déplacer une gare :</b> Maintenez <b>Shift + clic-glisser</b> sur une gare pour la repositionner.`,
        target: '#btn-create-station',
        page: 'map',
      },
      {
        title: '📋 La Barre Latérale',
        text: `Sur la droite de la carte, la <b>barre latérale</b> affiche en temps réel :<br><br>
        <b>Onglet Trains :</b><br>
        • Liste de tous les trains en circulation<br>
        • État (en route, en gare, en attente)<br>
        • Vitesse actuelle et vitesse max<br>
        • Retard en minutes (+X ou -X)<br>
        • Prochain arrêt et heure prévue<br><br>
        <b>Onglet Fret :</b><br>
        • Contrats de fret disponibles (marchandises à transporter)<br>
        • Acceptez les contrats pour gagner de l'argent<br><br>
        <b>Onglet Infos :</b><br>
        • Statistiques globales du réseau`,
        target: '#sidebar',
        page: 'map',
      },

      // === MATÉRIEL ROULANT ===
      {
        title: '🚂 Matériel Roulant — Acheter des engins',
        text: `L'onglet <b>"Matériel"</b> est le catalogue de tout le matériel roulant que vous pouvez acheter.<br><br>
        <b>3 types d'engins :</b><br>
        • <b>🚂 Locomotives</b> : tirent les voitures. Chaque loco a une vitesse max, une puissance (kW) et un coût.<br>
        • <b>🚃 Voitures</b> : transportent les passagers. Capacité en places assises.<br>
        • <b>📦 Wagons</b> : transportent le fret. Capacité en tonnes.<br><br>
        <b>Pour acheter :</b><br>
        1. Cliquez <b>"Ajouter un engin"</b><br>
        2. Choisissez le type et le modèle<br>
        3. Le prix est déduit de votre solde<br><br>
        <b>💡 Astuce :</b> Commencez avec une locomotive et 2-3 voitures voyageurs. Vous pourrez toujours en acheter plus tard.`,
        target: '[data-page="rolling-stock"]',
        page: 'rolling-stock',
      },

      // === RAMES ===
      {
        title: '🚆 Rames — Composer vos trains',
        text: `Une <b>rame</b> est un train complet = locomotive(s) + voitures/wagons assemblés ensemble.<br><br>
        <b>Pour créer une rame :</b><br>
        1. Cliquez <b>"Créer une rame"</b><br>
        2. Donnez un nom (ex: "TER Toulouse-Montauban")<br>
        3. Ajoutez les engins depuis votre inventaire : d'abord la locomotive, puis les voitures<br>
        4. La rame affiche ses caractéristiques : vitesse max, capacité totale, tonnage<br><br>
        <b>Caractéristiques importantes :</b><br>
        • <b>Vitesse max</b> : déterminée par l'engin le plus lent de la rame<br>
        • <b>Capacité</b> : somme des places de toutes les voitures<br>
        • <b>Usure</b> : augmente avec les km parcourus, à surveiller<br>
        • <b>Km parcourus</b> : compteur kilométrique total<br><br>
        <b>⚠️ Important :</b> Un engin ne peut appartenir qu'à <b>une seule rame</b> à la fois.`,
        target: '[data-page="rames"]',
        page: 'rames',
      },

      // === HORAIRES ===
      {
        title: '🕐 Horaires — Planifier les services',
        text: `C'est ici que vous créez les <b>services</b> (= trajets planifiés de vos trains).<br><br>
        <b>Pour créer un service :</b><br>
        1. Cliquez <b>"Nouveau service"</b><br>
        2. Sélectionnez la <b>rame</b> qui effectuera le trajet<br>
        3. Ajoutez les <b>arrêts</b> : gare de départ, gares intermédiaires, gare d'arrivée<br>
        4. Définissez les <b>heures de départ</b> pour chaque arrêt<br>
        5. Le système calcule automatiquement le temps de trajet basé sur la distance et la vitesse de la rame<br><br>
        <b>Options avancées :</b><br>
        • <b>Aller-retour</b> : le train fait le trajet dans les deux sens<br>
        • <b>Répétition</b> : le service se répète automatiquement<br>
        • <b>Quai assigné</b> : choisir le quai de départ/arrivée<br><br>
        <b>💡 Astuce :</b> Vérifiez que votre rame n'est pas déjà utilisée par un autre service au même moment !`,
        target: '[data-page="schedules"]',
        page: 'schedules',
      },

      // === LIGNES ===
      {
        title: '🛤️ Lignes — Organiser votre réseau',
        text: `Les <b>lignes</b> regroupent plusieurs services sous un même nom et une même couleur.<br><br>
        <b>Exemple :</b><br>
        • Ligne A (bleu) : Paris → Lyon (3 services par jour)<br>
        • Ligne B (rouge) : Lyon → Marseille (2 services par jour)<br><br>
        <b>Pour créer une ligne :</b><br>
        1. Cliquez <b>"Créer une ligne"</b><br>
        2. Donnez un nom et choisissez une couleur<br>
        3. Assignez des services existants à cette ligne<br><br>
        <b>Avantages :</b><br>
        • Meilleure visualisation sur la carte (couleur par ligne)<br>
        • Filtrage dans le Graphique de Marche par ligne<br>
        • Organisation claire de votre réseau<br><br>
        <b>💡</b> C'est optionnel mais fortement recommandé quand votre réseau grandit.`,
        target: '[data-page="lines"]',
        page: 'lines',
      },

      // === DEPOTS ===
      {
        title: '🔧 Dépôts & ITE — Maintenance et fret',
        text: `Les <b>dépôts</b> sont essentiels pour entretenir vos rames.<br><br>
        <b>Maintenance :</b><br>
        • Chaque rame accumule de <b>l'usure</b> en roulant (km parcourus)<br>
        • Quand l'usure est élevée, risque de <b>panne en ligne</b> !<br>
        • Envoyez la rame en <b>maintenance préventive</b> au dépôt<br>
        • La maintenance remet l'usure à 0 et prend du temps<br><br>
        <b>Réparations :</b><br>
        • Si un train tombe en panne, il est immobilisé sur la voie<br>
        • Envoyez une <b>locomotive de secours</b> pour le rapatrier au dépôt<br>
        • La réparation coûte plus cher que la maintenance préventive<br><br>
        <b>ITE (Installations Terminales Embranchées) :</b><br>
        • Voies de garage privées pour le fret<br>
        • Permettent le chargement/déchargement de marchandises<br><br>
        <b>💡 Astuce :</b> Planifiez la maintenance aux heures creuses pour ne pas perturber le service.`,
        target: '[data-page="depots"]',
        page: 'depots',
      },

      // === INCIDENTS ===
      {
        title: '⚠️ Incidents — Gérer les imprévus',
        text: `L'onglet <b>"Incidents"</b> affiche tous les événements perturbateurs de votre réseau.<br><br>
        <b>Types d'incidents :</b><br>
        • <b>🔴 Pannes de rame</b> : un train est immobilisé (usure trop élevée)<br>
        • <b>🟠 Travaux sur les voies</b> : ralentissement ou interruption d'un tronçon<br>
        • <b>🟡 Retards importants</b> : un service a accumulé plus de 15 min de retard<br><br>
        <b>Actions possibles :</b><br>
        • Envoyer une loco de secours pour remorquer un train en panne<br>
        • Attendre la fin des travaux<br>
        • Détourner les services vers d'autres itinéraires<br><br>
        <b>Impact :</b> Les incidents créent des <b>pénalités financières</b> (-25% de revenus pour les retards >15 min).`,
        target: '[data-page="incidents"]',
        page: 'incidents',
      },

      // === FINANCES ===
      {
        title: '💰 Finances — Votre trésorerie',
        text: `L'onglet <b>"Finances"</b> est votre tableau de bord financier.<br><br>
        <b>Revenus (en vert) :</b><br>
        • Passagers transportés (par service complété)<br>
        • Contrats de fret réalisés<br>
        • Revenus proportionnels à la distance et au nombre de passagers<br><br>
        <b>Dépenses (en rouge) :</b><br>
        • Coûts d'exploitation quotidiens (par service actif)<br>
        • Salaires du personnel (conducteurs : 120€/jour)<br>
        • Maintenance et réparations<br>
        • Remboursement d'emprunts bancaires<br>
        • Achat de matériel et d'infrastructures<br><br>
        <b>Indicateurs :</b><br>
        • Solde actuel (affiché en permanence dans le header)<br>
        • Revenus et dépenses du jour<br>
        • Historique des transactions<br>
        • Km totaux parcourus<br><br>
        <b>⚠️ Attention :</b> Si votre solde passe en négatif, vos trains continuent de rouler mais vous accumulez les dettes.`,
        target: '[data-page="economy"]',
        page: 'economy',
      },

      // === INFOGARE ===
      {
        title: '📺 Infogare — Affichage voyageurs',
        text: `L'<b>Infogare</b> reproduit les panneaux d'information voyageurs qu'on trouve dans les gares réelles.<br><br>
        <b>Affichage :</b><br>
        • Prochains départs avec heure, destination et quai<br>
        • Retards affichés en temps réel<br>
        • Style visuel fidèle aux écrans SNCF<br><br>
        <b>Utilisation :</b><br>
        • Sélectionnez une gare pour voir ses départs/arrivées<br>
        • Vérifiez que vos services sont bien planifiés<br>
        • Identifiez rapidement les retards<br><br>
        <b>💡</b> C'est un outil de supervision : rien à configurer, juste à consulter.`,
        target: '[data-page="infogare"]',
        page: 'infogare',
      },

      // === DASHBOARD ===
      {
        title: '📊 Dashboard — KPIs en temps réel',
        text: `Le <b>Dashboard</b> agrège les statistiques clés de votre réseau.<br><br>
        <b>KPIs affichés :</b><br>
        • <b>Ponctualité</b> : % de trains arrivés à l'heure (objectif > 90%)<br>
        • <b>Trains actifs</b> : nombre de services en circulation<br>
        • <b>Retard moyen</b> : en minutes sur l'ensemble du réseau<br>
        • <b>Usure moyenne</b> : état mécanique de la flotte<br>
        • <b>Solde</b> : trésorerie actuelle<br>
        • <b>Km parcourus</b> : total réseau<br><br>
        <b>Graphiques 24h :</b><br>
        • Évolution de la ponctualité sur la journée<br>
        • Évolution des revenus par tranche horaire<br><br>
        <b>Tableau des trains :</b> Liste de tous les trains actifs avec leur état, vitesse et retard.`,
        target: '[data-page="dashboard"]',
        page: 'dashboard',
      },

      // === GRAPHIQUE DE MARCHE ===
      {
        title: '📈 Graphique de Marche — Diagramme SNCF',
        text: `Le <b>Graphique de Marche</b> est un outil professionnel utilisé par les régulateurs SNCF.<br><br>
        <b>Comment le lire :</b><br>
        • <b>Axe horizontal</b> : le temps (0h à 24h)<br>
        • <b>Axe vertical</b> : la distance (km depuis l'origine)<br>
        • Chaque <b>ligne colorée</b> représente un train<br>
        • La <b>pente</b> indique la vitesse : plus c'est raide, plus c'est rapide<br>
        • Les <b>paliers horizontaux</b> = arrêts en gare<br><br>
        <b>Utilisation :</b><br>
        • Identifiez les <b>conflits</b> (deux trains au même endroit en même temps)<br>
        • Optimisez les <b>correspondances</b> (trains qui se croisent en gare)<br>
        • Repérez les <b>retards</b> (ligne réelle vs ligne théorique)<br><br>
        <b>Filtrage :</b> Sélectionnez une ligne spécifique pour n'afficher que ses trains.`,
        target: '[data-page="graph-marche"]',
        page: 'graph-marche',
      },

      // === PERSONNEL ===
      {
        title: '👥 Personnel — Gérer les conducteurs',
        text: `L'onglet <b>"Personnel"</b> gère vos conducteurs de train.<br><br>
        <b>Embauche :</b><br>
        • Chaque conducteur coûte <b>2 000 €</b> à l'embauche<br>
        • Salaire quotidien de <b>120 €/jour</b> par conducteur<br>
        • Cliquez "Embaucher un conducteur" pour en recruter<br><br>
        <b>Affectation :</b><br>
        • Assignez un conducteur à un service (onglet Horaires)<br>
        • Un conducteur ne peut être affecté qu'à <b>un seul service</b> à la fois<br>
        • Les conducteurs disponibles apparaissent dans la liste<br><br>
        <b>Licenciement :</b><br>
        • Vous pouvez licencier un conducteur non affecté<br>
        • Pas de remboursement du coût d'embauche<br><br>
        <b>💡 Astuce :</b> Prévoyez un conducteur de réserve pour remplacer en cas de besoin.`,
        target: '[data-page="staff"]',
        page: 'staff',
      },

      // === BANQUE ===
      {
        title: '🏦 Banque — Emprunts et crédit',
        text: `La <b>Banque</b> vous permet d'emprunter de l'argent pour investir dans votre réseau.<br><br>
        <b>4 niveaux d'emprunt :</b><br>
        • <b>Petit prêt</b> : 50 000 € à 3% (30 jours) — remboursement 1 717€/j<br>
        • <b>Prêt moyen</b> : 200 000 € à 5% (60 jours) — remboursement 3 500€/j<br>
        • <b>Gros prêt</b> : 500 000 € à 7% (90 jours) — remboursement 5 944€/j<br>
        • <b>Méga prêt</b> : 1 000 000 € à 10% (120 jours) — remboursement 9 167€/j<br><br>
        <b>Fonctionnement :</b><br>
        • L'argent est crédité immédiatement sur votre solde<br>
        • Le remboursement est <b>automatique</b> et quotidien<br>
        • Maximum <b>5 emprunts simultanés</b><br>
        • Le montant restant à rembourser est visible à tout moment<br><br>
        <b>⚠️ Attention :</b> Ne surendettez pas votre compagnie ! Les remboursements quotidiens peuvent vite dépasser vos revenus.`,
        target: '[data-page="bank"]',
        page: 'bank',
      },

      // === MÉTÉO ===
      {
        title: '🌦️ Météo — Conditions climatiques',
        text: `Le système <b>Météo</b> simule les conditions climatiques et leurs impacts sur le réseau.<br><br>
        <b>6 conditions météo :</b><br>
        • ☀️ <b>Dégagé</b> : vitesse normale (100%)<br>
        • 🌧️ <b>Pluie</b> : vitesse réduite à 90%<br>
        • 🌨️ <b>Neige</b> : vitesse réduite à 70% — attention aux retards !<br>
        • ⛈️ <b>Orage</b> : vitesse réduite à 60% — risque élevé<br>
        • 🌡️ <b>Canicule</b> : vitesse réduite à 85% (rails qui se dilatent)<br>
        • 🌫️ <b>Brouillard</b> : vitesse réduite à 75%<br><br>
        <b>Saisons :</b><br>
        • La météo change selon la saison (plus de neige en hiver, canicule en été)<br>
        • La météo évolue toutes les ~60 minutes de jeu<br><br>
        <b>Widget :</b> La météo actuelle est affichée en temps réel dans le <b>header</b> du jeu (en haut à gauche du solde).`,
        target: '[data-page="weather"]',
        page: 'weather',
      },

      // === SYNDICATS ===
      {
        title: '✊ Syndicats — Relations sociales',
        text: `Les <b>Syndicats</b> représentent la satisfaction de vos employés.<br><br>
        <b>Satisfaction sociale (0-100%) :</b><br>
        • Influencée par : salaires, santé financière, charge de travail, ponctualité<br>
        • <b>> 70%</b> : risque de grève très faible<br>
        • <b>50-70%</b> : risque faible, des revendications apparaissent<br>
        • <b>30-50%</b> : risque moyen (10% par jour)<br>
        • <b>< 30%</b> : risque élevé (25% par jour) ⚠️<br><br>
        <b>Grève :</b><br>
        • Dure 1 à 3 jours<br>
        • Bloque un % de vos services (30-80% selon la gravité)<br>
        • Cause des pertes de revenus importantes<br><br>
        <b>Négocier :</b><br>
        • <b>Prime</b> (10 000 €) : +15% satisfaction<br>
        • <b>Augmentation</b> (25 000 €) : +25% satisfaction<br>
        • <b>Conditions</b> (50 000 €) : +35% satisfaction<br><br>
        <b>💡 Astuce :</b> Négociez préventivement quand la satisfaction descend sous 60%.`,
        target: '[data-page="unions"]',
        page: 'unions',
      },

      // === HORAIRES SAISONNIERS ===
      {
        title: '📅 Saisons — Grilles horaires été/hiver',
        text: `Les <b>Horaires Saisonniers</b> permettent de gérer des grilles horaires différentes selon la saison.<br><br>
        <b>3 modes :</b><br>
        • <b>Normal</b> : tous les services actifs<br>
        • <b>☀️ Grille été</b> (1er juin → 30 sept) : renforcez les lignes touristiques<br>
        • <b>❄️ Grille hiver</b> (1er oct → 31 mai) : réduisez les services peu fréquentés<br><br>
        <b>Configuration :</b><br>
        • Activez/désactivez chaque service individuellement pour l'été ou l'hiver<br>
        • Le <b>changement automatique</b> bascule la grille selon la date du jeu<br>
        • Vous pouvez aussi forcer manuellement la grille active<br><br>
        <b>Utilisation :</b> Désactivez les services peu rentables en hiver, ajoutez des renforts en été.`,
        target: '[data-page="seasonal"]',
        page: 'seasonal',
      },

      // === CORRESPONDANCES ===
      {
        title: '🔄 Correspondances — Transferts voyageurs',
        text: `Les <b>Correspondances</b> gèrent les transferts de passagers entre trains en gare.<br><br>
        <b>Créer une correspondance :</b><br>
        1. Choisissez le <b>service arrivant</b> (le train qui amène les passagers)<br>
        2. Choisissez le <b>service partant</b> (le train que les passagers veulent prendre)<br>
        3. Choisissez la <b>gare</b> de correspondance (commune aux deux services)<br><br>
        <b>Politique d'attente :</b><br>
        • <b>Stricte (0 min)</b> : le train partant ne jamais attend → ponctualité max mais correspondances ratées<br>
        • <b>Modérée (5 min)</b> : attend jusqu'à 5 min de retard → bon compromis<br>
        • <b>Flexible (15 min)</b> : attend jusqu'à 15 min → correspondances réussies mais risque de retard en cascade<br><br>
        <b>Statistiques :</b> Taux de correspondances réussies, ratées, historique complet.`,
        target: '[data-page="connections"]',
        page: 'connections',
      },

      // === GARES MODULAIRES ===
      {
        title: '🏗️ Gares+ — Améliorations modulaires',
        text: `<b>Gares Modulaires</b> permet d'agrandir et améliorer vos gares avec des modules.<br><br>
        <b>8 modules disponibles :</b><br>
        • 🚏 <b>Quai supplémentaire</b> (15 000 €) : +1 quai pour plus de trains simultanés<br>
        • 🅿️ <b>Parking voyageurs</b> (20 000 €) : +5% de fréquentation<br>
        • 🏛️ <b>Hall voyageurs</b> (50 000 €) : +10% fréquentation, +5% satisfaction<br>
        • 📺 <b>Écrans Infogare</b> (8 000 €) : +3% satisfaction<br>
        • 🔧 <b>Voie de garage</b> (25 000 €) : stationnement et retournement<br>
        • 📦 <b>Terminal fret</b> (40 000 €) : chargement/déchargement fret<br>
        • 🍽️ <b>Restauration</b> (12 000 €) : +3% satisfaction<br>
        • 📶 <b>WiFi gratuit</b> (5 000 €) : +2% satisfaction<br><br>
        <b>Niveaux de gare :</b> Le niveau augmente automatiquement avec l'investissement total (1 niveau / 50 000 € investis).`,
        target: '[data-page="station-upgrades"]',
        page: 'station-upgrades',
      },

      // === AIGUILLAGES ===
      {
        title: '🔀 Aiguillages — Bifurcations et voies de garage',
        text: `Les <b>Aiguillages</b> gèrent les bifurcations et voies de garage en gare.<br><br>
        <b>Aiguillages (5 000 € chacun) :</b><br>
        • <b>Simple</b> : permet de dévier un train sur une voie adjacente<br>
        • <b>Double</b> : permet le passage dans les deux sens<br>
        • <b>Croisement</b> : permet le croisement de deux voies<br>
        • États : ↑ <b>Normal</b> / ↗ <b>Dévié</b> / 🔒 <b>Verrouillé</b><br><br>
        <b>Voies de garage (10 000 € chacune) :</b><br>
        • Garez des rames inutilisées sur des voies dédiées<br>
        • Chaque voie a une capacité limitée (2 rames par défaut)<br>
        • Gérez le stationnement pour optimiser l'espace en gare<br><br>
        <b>💡 Astuce :</b> Utilisez les aiguillages pour gérer les croisements de trains en gare et éviter les conflits.`,
        target: '[data-page="junctions"]',
        page: 'junctions',
      },

      // === HEADER ===
      {
        title: '⏱️ Le Header — Contrôles du jeu',
        text: `Le bandeau supérieur contient les informations et contrôles essentiels :<br><br>
        <b>Informations :</b><br>
        • 🌤️ <b>Météo</b> : conditions actuelles et température<br>
        • 💰 <b>Solde</b> : votre trésorerie (vert = positif, rouge = négatif)<br>
        • ⏰ <b>Horloge</b> : heure actuelle dans le jeu (orange)<br>
        • 📅 <b>Date</b> : date du jeu<br><br>
        <b>Contrôles de vitesse (en bas de la carte) :</b><br>
        • <b>⏸️ Pause</b> : met le jeu en pause<br>
        • <b>▶️ x1</b> : vitesse normale (1 minute de jeu = 1 seconde réelle)<br>
        • <b>⏩ x5, x15, x60</b> : accélérer le temps<br><br>
        <b>Boutons :</b><br>
        • ❓ <b>Tutoriel</b> : relancer ce guide<br>
        • 💾 <b>Sauvegarder</b> : exporter la partie en fichier JSON<br>
        • 📂 <b>Charger</b> : importer une sauvegarde<br><br>
        <b>💡</b> Le jeu sauvegarde <b>automatiquement</b> toutes les 10 secondes dans le navigateur.`,
        target: null,
        page: null,
      },

      // === CONSEILS DE JEU ===
      {
        title: '🎯 Conseils pour bien démarrer',
        text: `Voici l'ordre recommandé pour vos premières minutes :<br><br>
        <b>Étape 1 :</b> Créez <b>2 gares</b> sur la carte (sur des voies ferrées existantes)<br>
        <b>Étape 2 :</b> Achetez <b>1 locomotive + 2 voitures</b> dans Matériel<br>
        <b>Étape 3 :</b> Assemblez-les en <b>1 rame</b> dans Rames<br>
        <b>Étape 4 :</b> Créez un <b>service</b> dans Horaires (aller-retour entre vos 2 gares)<br>
        <b>Étape 5 :</b> Embauchez <b>1 conducteur</b> dans Personnel et affectez-le<br>
        <b>Étape 6 :</b> Accélérez le temps (x5 ou x15) et regardez votre train circuler !<br><br>
        <b>Ensuite :</b><br>
        • Surveillez vos finances et prenez un emprunt si nécessaire<br>
        • Améliorez vos gares avec des modules<br>
        • Créez de nouvelles lignes et services<br>
        • Gérez les incidents et la maintenance<br>
        • Négociez avec les syndicats si la satisfaction baisse<br><br>
        <b>Bonne chance, Directeur ! 🚂</b>`,
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
    this._overlay.querySelector('.tutorial-title').textContent = step.title;
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
