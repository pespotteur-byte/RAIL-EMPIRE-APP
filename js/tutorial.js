/**
 * Tutorial — Interactive step-by-step guide for new players.
 * Hyper-guided, beginner-friendly, no-panic version.
 */
import { icon } from './icons.js';

export class Tutorial {
  constructor() {
    this.steps = [
      {
        title: `Bienvenue dans Rail Empire !`,
        text: `Prenez une grande respiration. Vous n'avez rien à faire de complexe tout de suite.<br><br>
        Rail Empire est un simulateur ferroviaire. Vous construisez un réseau, achetez du matériel roulant, planifiez des horaires et regardez vos trains rouler en temps réel.<br><br>
        <b>Ce tutoriel est là pour vous accompagner pas à pas.</b> On va y aller doucement. Vous pouvez quitter à tout moment en cliquant sur la croix en haut à droite, et revenir plus tard en cliquant sur l'icône <b>?</b> dans le bandeau.<br><br>
        Cliquez sur <b>Suivant</b> quand vous êtes prêt.`,
        target: null,
        page: null,
      },
      {
        title: `Avant toute chose : pas de panique`,
        text: `Rail Empire a l'air immense, mais on va le découvrir ensemble. Voici le plan :<br><br>
        1. <b>Observer</b> la carte et l'interface.<br>
        2. <b>Créer deux gares</b> proches l'une de l'autre.<br>
        3. <b>Acheter</b> une locomotive et des wagons ou voitures.<br>
        4. <b>Assembler</b> votre première rame.<br>
        5. <b>Embaucher</b> un conducteur.<br>
        6. <b>Créer un service</b> entre vos deux gares.<br>
        7. <b>Accélérer le temps</b> et voir le train rouler.<br><br>
        C'est tout pour le début. Pas besoin de tout explorer. Cliquez sur <b>Suivant</b>.`,
        target: null,
        page: null,
      },
      {
        title: `Le bandeau du haut`,
        text: `En haut de l'écran, vous voyez plusieurs informations importantes :<br><br>
        • <b>Nom de votre compagnie</b> : c'est vous.<br>
        • <b>Solde</b> : l'argent disponible. En vert quand c'est positif, en rouge si vous dépensez trop.<br>
        • <b>Heure et date du jeu</b> : affichées en orange. Le temps avance en permanence, sauf si vous mettez en pause.<br>
        • <b>Météo actuelle</b> : température, conditions, icône.<br>
        • <b>Icônes</b> : Tutoriel (ce bouton <b>?</b>), Sauvegarder, Charger.<br><br>
        Vous ne devez retenir que deux choses : votre solde et l'heure. Le reste viendra avec le temps.`,
        target: null,
        page: null,
      },
      {
        title: `La barre de navigation`,
        text: `Juste sous le bandeau, vous trouvez les <b>onglets</b> du jeu. Il y en a 14, mais ne vous inquiétez pas : on va utiliser seulement 5 ou 6 au début.<br><br>
        Les onglets principaux pour démarrer :<br>
        • <b>Carte</b> : c'est ici que vous construisez et voyez vos trains.<br>
        • <b>Materiel</b> : acheter locomotives, voitures, wagons.<br>
        • <b>Rames</b> : assembler vos engins en trains complets.<br>
        • <b>Horaires</b> : planifier les trajets.<br>
        • <b>Personnel</b> : embaucher des conducteurs.<br><br>
        Les autres onglets seront utiles plus tard. On y viendra progressivement.`,
        target: '.nav-tabs',
        page: null,
      },
      {
        title: `La carte : votre terrain de jeu`,
        text: `Vous êtes maintenant sur la <b>Carte</b>. C'est le cœur du jeu. Vous voyez des voies ferrées grises, ce sont les <b>données OpenRailwayMap</b>, c'est-à-dire les vraies voies ferrées.<br><br>
        <b>Pour vous déplacer :</b><br>
        • Maintenez le <b>clic gauche</b> et glissez la souris pour déplacer la carte.<br>
        • Utilisez la <b>molette</b> pour zoomer et dézoomer.<br>
        • Trouvez votre région, une ville, ou un endroit que vous connaissez.<br><br>
        <b>Astuce :</b> utilisez la barre de recherche en bas de la carte pour taper une ville (par exemple "Lyon") et y aller directement.`,
        target: '#game-canvas',
        page: 'map',
      },
      {
        title: `Les options d'affichage de la carte`,
        text: `En bas de la carte, vous trouvez plusieurs <b>toggles</b> (cases à cocher). Ils permettent d'afficher ou masquer des éléments.<br><br>
        Au début, gardez tout coché, cela vous aidera à voir les gares, les noms, les trains, les points de voie et le réseau.<br><br>
        Vous trouverez aussi :<br>
        • <b>Satellite</b> : bascule vers une vue photo aérienne.<br>
        • <b>Météo</b> : affiche le radar + les nuages en temps réel.<br><br>
        Ne touchez pas à tout de suite si vous ne voulez pas. Le réglage de base suffit.`,
        target: '#map-controls',
        page: 'map',
      },
      {
        title: `Contrôler le temps`,
        text: `En bas à gauche, vous trouvez les <b>boutons de vitesse du temps</b> : Pause, x1, x5, x15, x60.<br><br>
        • <b>Pause</b> : le temps s'arrête. Pratique quand vous configurez un service.<br>
        • <b>x1</b> : vitesse normale.<br>
        • <b>x5 / x15 / x60</b> : accélère le temps pour voir vos trains avancer plus vite.<br><br>
        Quand vous créerez votre premier service, mettez le temps en <b>Pause</b>. Cela vous laisse le temps de tout vérifier sans stress.`,
        target: '#time-controls',
        page: 'map',
      },
      {
        title: `Première étape : créer deux gares (1/3)`,
        text: `Votre tout premier objectif est simple : créer <b>deux gares</b> proches l'une de l'autre, reliées par une voie ferrée.<br><br>
        Pour cela :<br>
        1. Cherchez un endroit avec des voies ferrées sur la carte.<br>
        2. Cliquez sur le bouton <b>+ Créer une gare</b> en haut à gauche.<br>
        3. Votre curseur devient une croix.<br>
        4. Cliquez sur la carte, <b>près d'une voie ferrée</b>.<br><br>
        Une fenêtre va s'ouvrir. On va la remplir ensemble à l'étape suivante.`,
        target: '#btn-create-station',
        page: 'map',
      },
      {
        title: `Créer une gare (2/3)`,
        text: `La fenêtre de création de gare est simple. Voici ce qu'il faut remplir :<br><br>
        • <b>Nom</b> : donnez un nom clair, par exemple <i>Gare de Meaux</i> ou <i>Meaux Centre</i>.<br>
        • <b>Nombre de quais</b> : mettez 2 pour commencer. Vous pourrez changer plus tard.<br>
        • <b>Type</b> : voyageur ou fret. Pour votre premier train, choisissez <b>voyageur</b>.<br><br>
        Cliquez sur <b>Créer</b>. Un cercle bleu apparaît sur la carte. Bravo, vous avez votre première gare !<br><br>
        Recommencez l'opération pour créer une <b>deuxième gare</b> à environ 10 à 50 km.`,
        target: null,
        page: 'map',
      },
      {
        title: `Créer une gare (3/3)`,
        text: `Vous avez maintenant <b>deux gares</b>. Vérifiez qu'elles sont bien reliées par une voie grise sur la carte. Si ce n'est pas le cas, déplacez-vous un peu pour en trouver une autre zone, ou rapprochez vos gares.<br><br>
        <b>Pas d'inquiétude si la ligne entre les deux gares n'apparaît pas encore.</b> Le tronçon sera créé automatiquement quand vous créerez un service.<br><br>
        Prenez le temps de bien placer vos gares. Vous pouvez les déplacer plus tard si besoin.`,
        target: null,
        page: 'map',
      },
      {
        title: `Deuxième étape : acheter du matériel (1/3)`,
        text: `Cliquez maintenant sur l'onglet <b>Materiel</b> dans la barre de navigation. C'est votre catalogue d'achat.<br><br>
        Vous allez y trouver des <b>locomotives</b>, des <b>voitures voyageurs</b> et des <b>wagons de fret</b>.<br><br>
        Pour un premier train voyageur, vous avez besoin de :<br>
        • <b>1 locomotive</b><br>
        • <b>2 voitures voyageurs</b> minimum<br><br>
        Cliquez sur <b>Suivant</b> pour voir comment acheter.`,
        target: '[data-page="rolling-stock"]',
        page: 'rolling-stock',
      },
      {
        title: `Acheter une locomotive (2/3)`,
        text: `Dans l'onglet <b>Materiel</b>, cliquez sur le bouton <b>+ Ajouter un engin</b>.<br><br>
        Un formulaire s'ouvre. Remplissez :<br>
        • <b>Nom</b> : par exemple <i>Loco 001</i>.<br>
        • <b>Type</b> : choisissez <b>Locomotive</b>.<br>
        • <b>Modèle</b> : sélectionnez un modèle dans la liste. Au début, prenez une locomotive pas trop chère et pas trop lente, par exemple une <i>BB 22200</i> ou une <i>BB 7200</i>.<br><br>
        Le prix se déduit automatiquement de votre solde. Si votre solde est trop faible, reprenez un modèle moins cher.`,
        target: null,
        page: 'rolling-stock',
      },
      {
        title: `Acheter des voitures (3/3)`,
        text: `Recommencez l'achat pour ajouter <b>2 voitures voyageurs</b>.<br><br>
        Dans le formulaire :<br>
        • <b>Type</b> : <b>Voiture</b>.<br>
        • <b>Modèle</b> : choisissez une voiture adaptée, par exemple une <i>Corail</i> ou <i>VO2N</i>.<br><br>
        Une fois que vous avez <b>1 locomotive + 2 voitures</b> dans votre inventaire, vous êtes prêt à assembler votre première rame. Cliquez sur <b>Suivant</b>.`,
        target: null,
        page: 'rolling-stock',
      },
      {
        title: `Troisième étape : assembler une rame`,
        text: `Allez dans l'onglet <b>Rames</b> et cliquez sur <b>+ Nouvelle rame</b>.<br><br>
        Une rame, c'est simplement un train complet : une locomotive + des voitures ou wagons attachés derrière.<br><br>
        Remplissez le formulaire :<br>
        • <b>Nom de la rame</b> : donnez un nom parlant, par exemple <i>TER Meaux-Trilport</i>.<br>
        • <b>Ajouter des engins</b> : sélectionnez d'abord votre locomotive, puis vos deux voitures.<br><br>
        La vitesse max de la rame sera celle de l'engin le plus lent. Cliquez sur <b>Enregistrer</b>.`,
        target: '[data-page="rames"]',
        page: 'rames',
      },
      {
        title: `Quatrième étape : embaucher un conducteur`,
        text: `Un train, ça ne roule pas tout seul. Allez dans l'onglet <b>Personnel</b> et cliquez sur <b>Embaucher un conducteur</b>.<br><br>
        Cela coûte un peu d'argent à l'embauche, puis un salaire quotidien. C'est normal, c'est un coût d'exploitation.<br><br>
        Votre conducteur est maintenant disponible. On va l'affecter à un service à l'étape suivante.`,
        target: '[data-page="staff"]',
        page: 'staff',
      },
      {
        title: `Cinquième étape : créer un service (1/4)`,
        text: `C'est le moment de faire rouler votre train. Allez dans l'onglet <b>Horaires</b> et cliquez sur <b>+ Créer un trajet</b>.<br><br>
        Un <b>service</b>, c'est un train qui part à une heure précise, passe par des gares, et arrive à destination. C'est le cœur de l'exploitation.<br><br>
        Remplissez :<br>
        • <b>Nom du service</b> : par exemple <i>TER 01 Meaux-Trilport</i>.<br>
        • <b>Rame</b> : sélectionnez la rame que vous venez de créer.<br><br>
        Cliquez sur <b>Suivant</b> pour ajouter les gares.`,
        target: '[data-page="schedules"]',
        page: 'schedules',
      },
      {
        title: `Créer un service (2/4)`,
        text: `Vous devez maintenant ajouter vos <b>deux gares</b> dans l'ordre du parcours.<br><br>
        1. Cliquez sur la gare de <b>départ</b>.<br>
        2. Cliquez sur la gare d'<b>arrivée</b>.<br><br>
        Le système calcule automatiquement :<br>
        • la distance réelle le long des voies,<br>
        • la vitesse maximale autorisée,<br>
        • le temps de trajet estimé.<br><br>
        Si vous voulez que le train s'arrête en gare d'arrivée, laissez le type <b>Arrêt</b>.`,
        target: null,
        page: 'schedules',
      },
      {
        title: `Créer un service (3/4)`,
        text: `Vous pouvez maintenant choisir l'<b>heure de départ</b>.<br><br>
        L'heure est en minutes depuis minuit. Par exemple, 8h00 = 480, 12h00 = 720, 18h00 = 1080.<br><br>
        Pour votre premier essai, choisissez une heure un peu dans le futur par rapport à l'heure actuelle du jeu. Vous pouvez aussi activer le mode <b>Aller-retour</b> si vous voulez que le train revienne automatiquement.<br><br>
        Ne vous inquiétez pas si les chiffres vous semblent étranges : vous verrez vite comment ça fonctionne.`,
        target: null,
        page: 'schedules',
      },
      {
        title: `Créer un service (4/4)`,
        text: `Avant de valider, vérifiez :<br><br>
        • Vous avez bien choisi une <b>rame</b>.<br>
        • Vous avez bien mis <b>deux gares</b>.<br>
        • Vous avez choisi un <b>conducteur</b> dans le champ correspondant.<br>
        • L'heure de départ est bien dans le futur.<br><br>
        Cliquez sur <b>Créer</b>. Félicitations : votre premier service est planifié !<br><br>
        Il ne reste plus qu'à le lancer.`,
        target: null,
        page: 'schedules',
      },
      {
        title: `Sixième étape : lancer le temps et observer`,
        text: `Retournez sur la <b>Carte</b>. Si vous aviez mis le temps en pause, cliquez maintenant sur <b>x5</b> ou <b>x15</b>.<br><br>
        Regardez votre première gare. Quand l'heure de départ arrive, un <b>triangle coloré</b> apparaît : c'est votre train !<br><br>
        Vous pouvez :<br>
        • Cliquer sur le train pour voir ses informations.<br>
        • Le suivre en cliquant sur sa carte dans le bandeau de droite.<br>
        • Observer son accélération, sa vitesse, son prochain arrêt.<br><br>
        Vous avez fait rouler votre premier train.`,
        target: '#time-controls',
        page: 'map',
      },
      {
        title: `Le bandeau latéral`,
        text: `Sur la droite de la carte, le <b>bandeau latéral</b> affiche la liste de vos trains en circulation.<br><br>
        Pour chaque train, vous voyez :<br>
        • son <b>nom</b>,<br>
        • son <b>état</b> (en route, en gare, en attente),<br>
        • sa <b>vitesse</b>,<br>
        • son <b>retard</b> éventuel,<br>
        • son <b>prochain arrêt</b>.<br><br>
        Cliquez sur un train pour le centrer sur la carte. Vous pouvez faire défiler la liste si elle est longue.`,
        target: '#sidebar',
        page: 'map',
      },
      {
        title: `Les lignes : organiser vos services`,
        text: `Quand vous aurez plusieurs services, vous pourrez les regrouper dans des <b>lignes</b>. Cela n'est pas obligatoire, mais c'est utile.<br><br>
        Une ligne, c'est juste un nom et une couleur. Par exemple, tous vos services entre Meaux et Trilport peuvent appartenir à la <b>Ligne Rose</b>.<br><br>
        Pour créer une ligne :<br>
        1. Allez dans l'onglet <b>Lignes</b>.<br>
        2. Cliquez sur <b>+ Créer une ligne</b>.<br>
        3. Donnez un nom et choisissez une couleur.<br>
        4. Assignez des services existants.<br><br>
        C'est optionnel pour le début.`,
        target: '[data-page="lines"]',
        page: 'lines',
      },
      {
        title: `La maintenance et les dépôts`,
        text: `Vos rames s'usent avec les kilomètres. Si l'usure devient trop élevée, elles risquent de tomber en panne.<br><br>
        Pour éviter cela :<br>
        1. Allez dans l'onglet <b>Depots/ITE</b>.<br>
        2. Créez un dépôt près d'une gare.<br>
        3. Envoyez vos rames en maintenance régulièrement.<br><br>
        La maintenance coûte de l'argent, mais une panne en ligne coûte beaucoup plus cher. Vous recevrez des alertes quand une rame approche de l'usure critique.`,
        target: '[data-page="depots"]',
        page: 'depots',
      },
      {
        title: `Les incidents`,
        text: `Des incidents peuvent arriver sur le réseau : personne sur les voies, panne de signalisation, travaux, défaut d'alimentation...<br><br>
        Quand un incident se produit, les trains concernés ralentissent ou s'arrêtent. Vous voyez un cercle rouge clignotant sur la carte.<br><br>
        Vous pouvez aussi créer un incident manuellement pour tester la réaction de votre réseau. Mais attention : cela perturbe le trafic !<br><br>
        Le jeu gère les incidents automatiquement, mais vous devez surveiller les retards.`,
        target: '[data-page="incidents"]',
        page: 'incidents',
      },
      {
        title: `L'Infogare`,
        text: `L'onglet <b>Infogare</b> affiche des tableaux d'information voyageurs inspirés des vraies gares SNCF.<br><br>
        Sélectionnez une gare, cliquez sur <b>Afficher</b>, et vous voyez les prochains départs et arrivées, avec les retards en temps réel.<br><br>
        C'est un outil de supervision. Vous n'avez rien à configurer : il affiche automatiquement les services de la gare. C'est idéal pour vérifier que tout fonctionne bien.`,
        target: '[data-page="infogare"]',
        page: 'infogare',
      },
      {
        title: `Le Dashboard`,
        text: `Le <b>Dashboard</b> est votre tableau de bord. Il montre :<br><br>
        • votre <b>solde</b> et vos finances du jour,<br>
        • le nombre de <b>trains actifs</b>,<br>
        • la <b>ponctualité</b> de votre réseau,<br>
        • le <b>retard moyen</b>,<br>
        • l'<b>usure moyenne</b> de vos rames,<br>
        • les <b>kilomètres parcourus</b>.<br><br>
        C'est l'endroit idéal pour faire un bilan rapide. Si vous voyez du rouge partout, c'est le moment de vérifier vos services, votre personnel et votre maintenance.`,
        target: '[data-page="dashboard"]',
        page: 'dashboard',
      },
      {
        title: `Le Graphique de marche`,
        text: `Le <b>Graphique</b> est un diagramme temps-distance. C'est l'outil des régulateurs ferroviaires.<br><br>
        • L'axe horizontal représente le <b>temps</b> (0h à 24h).<br>
        • L'axe vertical représente la <b>distance</b> depuis le point de départ.<br>
        • Chaque <b>ligne colorée</b> est un train.<br>
        • Plus une ligne est <b>raide</b>, plus le train va vite.<br>
        • Un <b>paliers horizontal</b> signifie que le train est arrêté en gare.<br><br>
        Ne soyez pas effrayé par cet écran. Il devient utile quand vous aurez beaucoup de trains.`,
        target: '[data-page="graph-marche"]',
        page: 'graph-marche',
      },
      {
        title: `La Météo`,
        text: `L'onglet <b>Météo</b> affiche les conditions météorologiques réelles à l'endroit que vous regardez sur la carte. Il utilise les données d'Open-Meteo.<br><br>
        La météo influence vos trains :<br>
        • <b>Pluie</b> : adhérence réduite.<br>
        • <b>Neige</b> : vitesse réduite.<br>
        • <b>Brouillard</b> : visibilité faible.<br><br>
        Vous pouvez activer le <b>radar</b> et les <b>nuages</b> sur la carte. C'est purement visuel et informatif, mais cela ajoute beaucoup d'immersion.`,
        target: '[data-page="weather"]',
        page: 'weather',
      },
      {
        title: `Le Fret et les marchandises`,
        text: `Quand vous serez à l'aise avec les trains voyageurs, vous pourrez essayer le <b>fret</b>.<br><br>
        Il y a 7 catégories de marchandises : vrac, conteneurs, liquides, matières dangereuses, automobiles, sidérurgie, bois et papier. Chacune nécessite un type de wagon adapté.<br><br>
        Pour commencer le fret :<br>
        1. Achetez des <b>wagons adaptés</b>.<br>
        2. Créez une <b>rame de fret</b>.<br>
        3. Acceptez un <b>contrat</b> dans le bandeau latéral.<br>
        4. Créez un <b>service fret</b> entre les deux gares du contrat.`,
        target: '[data-page="cargo-types"]',
        page: 'cargo-types',
      },
      {
        title: `Les clients industriels`,
        text: `Les <b>Industriels</b> sont des entreprises qui génèrent beaucoup de fret : cimenteries, raffineries, ports, aciéries, usines automobiles...<br><br>
        Vous pouvez installer un <b>client industriel</b> sur la carte. Il générera automatiquement des contrats de fret chaque jour.<br><br>
        C'est une étape avancée. Concentrez-vous d'abord sur les trains voyageurs, puis revenez ici quand vous serez prêt à développer votre activité fret.`,
        target: '[data-page="industrial-clients"]',
        page: 'industrial-clients',
      },
      {
        title: `Sauvegarder et reprendre`,
        text: `Votre progression est <b>sauvegardée automatiquement</b> toutes les 10 secondes dans le navigateur. Si vous fermez l'onglet et revenez, vous pouvez reprendre là où vous en étiez.<br><br>
        Néanmoins, il est conseillé d'<b>exporter</b> une sauvegarde fichier de temps en temps :<br>
        1. Cliquez sur l'icône <b>Sauvegarder</b> (disquette) dans le bandeau du haut.<br>
        2. Un fichier <b>.json</b> se télécharge.<br>
        3. Pour reprendre, cliquez sur <b>Charger</b> et sélectionnez votre fichier.<br><br>
        C'est votre backup. Gardez-le précieusement.`,
        target: null,
        page: null,
      },
      {
        title: `Votre premier quart d'heure : récapitulatif`,
        text: `Voici les étapes essentielles pour bien démarrer :<br><br>
        1. <b>Carte</b> : créez deux gares reliées par une voie.<br>
        2. <b>Materiel</b> : achetez 1 locomotive + 2 voitures.<br>
        3. <b>Rames</b> : assemblez-les en une rame.<br>
        4. <b>Personnel</b> : embauchez un conducteur.<br>
        5. <b>Horaires</b> : créez un service entre les deux gares.<br>
        6. <b>Carte</b> : mettez le temps en x5 ou x15 et regardez le train rouler.<br><br>
        C'est tout. Le reste s'apprend au fur et à mesure.`,
        target: null,
        page: null,
      },
      {
        title: `Conseils pour ne pas stresser`,
        text: `Quelques conseils pour bien profiter du jeu :<br><br>
        • <b>Commencez petit.</b> Deux gares, un train. Le reste viendra après.<br>
        • <b>Mettez le temps en pause</b> quand vous configurez des choses.<br>
        • <b>Sauvegardez souvent</b> votre partie dans un fichier.<br>
        • <b>Ne paniquez pas</b> si un train a du retard. C'est le jeu.<br>
        • <b>Lisez les bulles d'information</b> qui apparaissent dans les formulaires.<br>
        • <b>Utilisez la recherche de carte</b> pour trouver des villes rapidement.<br>
        • <b>Testez</b>, re-testez, amusez-vous.`,
        target: null,
        page: null,
      },
      {
        title: `Bienvenue, Directeur !`,
        text: `Vous avez terminé le tutoriel. Vous savez maintenant comment :<br><br>
        • naviguer dans l'interface,<br>
        • créer des gares,<br>
        • acheter et assembler du matériel roulant,<br>
        • embaucher du personnel,<br>
        • créer un service,<br>
        • observer un train rouler sur la carte.<br><br>
        Le reste, vous l'apprendrez en jouant. N'oubliez pas le bouton <b>?</b> si vous avez besoin de relire ce tutoriel.<br><br>
        Bonne route, et faites rouler vos trains !`,
        target: null,
        page: null,
      },
    ];
    this.currentStep = 0;
    this.active = false;
    this._overlay = null;
    this._game = null;
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
          <button class="tutorial-close" title="Quitter le tutoriel">&times;</button>
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
    overlay.setAttribute('tabindex', '-1');
    overlay.focus();
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.stop();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'ArrowLeft') this.prev();
    });
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

    if (step.page && this._game?.ui) {
      this._game.ui.switchPage(step.page);
    }

    this._overlay.querySelector('.tutorial-title').innerHTML = step.title;
    this._overlay.querySelector('.tutorial-text').innerHTML = step.text;
    this._overlay.querySelector('.tutorial-step-counter').textContent = `Étape ${this.currentStep + 1} / ${this.steps.length}`;

    const pct = ((this.currentStep + 1) / this.steps.length * 100).toFixed(0);
    this._overlay.querySelector('.tutorial-progress').innerHTML =
      `<div style="background:var(--bg3);height:4px;border-radius:2px;margin:12px 0"><div style="background:var(--blue);height:4px;border-radius:2px;width:${pct}%"></div></div>`;

    const prevBtn = this._overlay.querySelector('.tutorial-prev');
    const nextBtn = this._overlay.querySelector('.tutorial-next');
    prevBtn.style.visibility = this.currentStep > 0 ? 'visible' : 'hidden';
    nextBtn.textContent = this.currentStep < this.steps.length - 1 ? 'Suivant →' : 'Terminer ✓';

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

    const box = this._overlay.querySelector('.tutorial-box');
    if (box) box.scrollTop = 0;
  }
}
