import { htmlText } from './html-text.js';
/**
 * Tutorial — Interactive step-by-step guide for new players.
 * Hyper-guided, beginner-friendly, no-panic version.
 */
import { icon } from './icons.js';
type TutorialStep = {
    title: string;
    text: string;
    target: string | null;
    page: string | null;
    image?: string;
    caption?: string;
};
type TutorialGame = { ui?: { switchPage: (page: string) => unknown } };
export const PAGE_HELP_LABELS = Object.freeze({
    map: 'Carte', qg: 'Quartier général', 'rolling-stock': 'Matériel roulant', rames: 'Rames', liveries: 'Livrées', schedules: 'Horaires / Schedule Creator',
    rotations: 'Roulements', lines: 'Lignes / Réseau', depots: 'Dépôts & ITE', incidents: 'Incidents & Travaux',
    infogare: 'Infogare', dashboard: 'Dashboard', 'graph-marche': 'Graphique de marche', staff: 'Personnel',
    weather: 'Météo', 'cargo-types': 'Marchandises', 'industrial-clients': 'Industriels', marketing: 'Marketing & expérience client',
});
const PAGE_GUIDES = Object.freeze({
    qg: [
        { title: 'Quartier général — vue compagnie', page: 'qg', target: '#page-qg', text: `Le <b>QG</b> réunit les cumuls de fret livré et de voyageurs transportés depuis la création de la partie, ainsi que les trains actuellement en exploitation.` },
        { title: 'Lire les compositions', page: 'qg', target: '#qg-fleet', text: `Chaque ligne montre le train, son parcours et sa composition réelle. Faites défiler verticalement la liste des trains et horizontalement une longue composition. La recherche filtre sans modifier la simulation.` },
    ],
    map: [
        { title: 'Carte — à quoi sert cette page ?', page: 'map', target: '#game-canvas', text: `La <b>Carte</b> est la vue d'exploitation en temps réel. Elle affiche le réseau ferroviaire, vos gares, trains, incidents, travaux et objets d'infrastructure.<br><br><b>Navigation :</b> clic-glissé pour déplacer la carte, molette pour zoomer. Utilisez la recherche pour rejoindre rapidement une ville ou une gare.` },
        { title: 'Créer et modifier l’infrastructure', page: 'map', target: '.map-controls', text: `Les boutons de création permettent d'ajouter une gare, un point de voie, un tronçon manuel, une ligne, un poste d'aiguillage, une zone de régulation, une ITE ou une industrie.<br><br><b>Conseil :</b> pour les sillons, laissez le Schedule Creator utiliser les voies OSM/ORM réelles. Les objets manuels servent surtout aux exceptions et aux réseaux personnalisés.` },
        { title: 'Affichage et diagnostic', page: 'map', target: '.map-toggles', text: `Les cases d'affichage masquent ou montrent les gares, trains, noms, réseau et couches complémentaires. Si vous cherchez un problème de routage, affichez les voies et les points utiles avant de modifier quoi que ce soit.` },
        { title: 'Suivre les circulations', page: 'map', target: '#sidebar', text: `Le panneau latéral liste les circulations et leur état. Cliquez un train pour ouvrir son détail : position, prochain arrêt, avance/retard, rame réelle et incidents éventuels. Le temps du jeu peut être accéléré ou mis en pause sans modifier les horaires enregistrés.` },
        { title: 'Vue 3D GPS optionnelle', page: 'map', target: '#livemap-train-panel', text: `Après avoir sélectionné un train, le bouton <b>Vue 3D GPS</b> ouvre une vue de suivi locale : fond satellite incliné, itinéraire mis en évidence et flèches GPS 2D pour les circulations proches. La luminosité et l'ambiance réagissent à l'heure du jeu et à la météo (pluie, neige, brouillard, orage, canicule).<br><br>Cette vue est volontairement un mode <b>lecture/suivi</b> : revenez en 2D pour créer ou déplacer des objets d'infrastructure. Le mode essaie automatiquement un <b>vrai relief DEM</b> local (Terrain Tiles) avec une grande portée visuelle. Si WebGL ou le DEM ne sont pas disponibles, RE retombe automatiquement sur la pseudo-3D légère sans interrompre le suivi.` },
    ],
    'rolling-stock': [
        { title: 'Matériel roulant — catalogue et parc', page: 'rolling-stock', target: '#stock-list', text: `Cette page sert à <b>acheter, rechercher et gérer les engins physiques</b> : locomotives, automotrices, voitures et wagons.<br><br>Le catalogue décrit le type de véhicule ; votre parc contient les exemplaires réellement possédés par la compagnie.` },
        { title: 'Rechercher sans parcourir tout le catalogue', page: 'rolling-stock', target: '.stock-toolbar', text: `Utilisez la recherche par nom/série/type puis les filtres de catégorie. Pour les wagons, un second filtre permet d'affiner la famille. Le sélecteur « par page » évite de charger inutilement des milliers de cartes à la fois.` },
        { title: 'Ajouter / acheter un engin', page: 'rolling-stock', target: '#btn-add-stock', text: `Ouvrez <b>+ Ajouter un engin</b>, choisissez le matériel et vérifiez ses caractéristiques avant validation. Une locomotive ou voiture achetée devient un objet physique que vous pourrez placer dans une Rame, matérialiser comme engin/coupon, puis affecter à une ligne de roulement. Un horaire seul reste théorique.` },
        { title: 'Valeurs techniques et compatibilité', page: 'rolling-stock', target: '#stock-list', text: `Vmax, masse, puissance, traction, systèmes électriques, gabarit et charges sont utilisés par la simulation. Une donnée inconnue ne doit pas être confondue avec une interdiction : RE distingue les incompatibilités certaines des informations non renseignées.` },
    ],
    rames: [
        { title: 'Rames — assembler le matériel', page: 'rames', target: '#rames-list', text: `Une <b>Rame</b> est une composition ordonnée de matériel roulant. Elle peut représenter une automotrice, une rame tractée, un train de fret, une HLP ou une composition plus complexe.` },
        { title: 'Créer une rame', page: 'rames', target: '#btn-new-rame', text: `Cliquez <b>+ Nouvelle rame</b>, ajoutez les véhicules dans leur ordre réel et contrôlez le sens des éléments. RE recalcule longueur, masse, capacité, Vmax et traction de la composition.` },
        { title: 'Sens, voiture-pilote et images', page: 'rames', target: '#rames-list', text: `L'orientation enregistrée sert à l'affichage réel du train et aux Roulements réversibles. Une voiture-pilote peut mener la circulation dans le sens inverse sans changer la locomotive de côté.` },
        { title: 'Faire rouler la rame via un roulement', page: 'rames', target: '#rames-list', text: `En mode simplifié, affectez directement cette Rame à un horaire validé : aucun Roulement n’est nécessaire. Le module <b>Roulements</b> reste disponible pour les joueurs qui veulent enchaîner les services et gérer changements de locomotive, UM, CV, coupes et réunions.` },
    ],
    liveries: [
        { title: 'Livrées — vos variantes visuelles', page: 'liveries', target: '#page-liveries', text: `Cette page crée des <b>variantes d’image</b> pour le matériel du catalogue. Une livrée ne remplace pas le matériel d’origine et n’achète aucun véhicule. Recherchez le matériel, sélectionnez-le, puis donnez un nom ou un numéro à votre création.` },
        { title: 'Wagon devant, chargement derrière', page: 'liveries', target: '#liv-canvas', text: `Importez le chargement : le wagon RE reste au premier plan. <b>Glissez le chargement</b>, ajustez X/Y ou utilisez les flèches (Maj : 10 pixels). La molette et le champ Échelle changent sa taille en conservant ses proportions. Une image opaque masque ce qui se trouve derrière elle.` },
        { title: 'Agrandir la composition sans déformer', page: 'liveries', target: '#liv-canvas', text: `La zone de dessin réserve la hauteur du wagon <b>plus celle du chargement</b> et s’agrandit si nécessaire. Le zoom d’aperçu ne modifie pas le PNG exporté. Pour les autres matériels, importez simplement la nouvelle image. Les dimensions maximales affichées protègent la mémoire ; aucune limite arbitraire n’est imposée au nombre de livrées.` },
        { title: 'Enregistrer puis choisir dans une rame', page: 'liveries', target: '#liv-save', text: `<b>Enregistrer la livrée</b> conserve les images et le placement dans la partie ; l’export PNG seul n’est pas une sauvegarde de jeu. Dans l’éditeur de rame, choisissez la livrée sur le véhicule concerné puis enregistrez la rame. Chaque véhicule peut garder l’image d’origine. Supprimer une livrée rétablit cette image, sans supprimer le matériel.` },
    ],
    schedules: [
        { title: 'Horaires — créer une circulation', page: 'schedules', target: '#schedules-list', text: `La page <b>Horaires</b> définit les circulations indépendamment du matériel physique. Chaque horaire possède son numéro, sa catégorie, son calendrier, ses arrêts, ses voies et son tracé ferroviaire exact.` },
        { title: 'Créer un horaire et ouvrir le Schedule Creator', page: 'schedules', target: '#btn-new-schedule', text: `Cliquez <b>+ Créer un horaire</b>. Dans le Schedule Creator, choisissez la gare/voie de départ, la destination, puis ajoutez des <b>VIA</b> uniquement si vous voulez imposer un passage précis. RE résout ensuite le chemin sur les données OSM/ORM.` },
        { title: 'Temps de marche et horaires manuels', page: 'schedules', target: '#schedules-list', text: `RE calcule un temps physique de référence à partir de la voie, des vitesses et de la composition-type. Vous pouvez saisir vos propres heures d'arrivée et de départ.<br><br><b>Depuis la 1.1.92 :</b> si votre temps est plus court que celui proposé par RE, un avertissement apparaît mais le bouton <b>Forcer et valider quand même</b> permet de conserver votre horaire. Les erreurs de voie ou d'incompatibilité restent bloquantes.` },
        { title: 'Couche OSM ferroviaire mondiale', page: 'schedules', target: '#schedules-list', text: `Depuis la <b>1.1.93</b>, le Schedule Creator possède une couche vectorielle OSM ferroviaire de couverture <b>mondiale</b>. Les zones réellement utilisées sont découpées en tuiles globales de 0,5° et conservées dans IndexedDB : une zone déjà chargée peut ensuite être réutilisée hors-ligne.<br><br><b>Sécurité 1.1.94 :</b> une réponse réseau contenant 0 voie n'est plus considérée comme vraie à elle seule. RE demande une confirmation indépendante ; les zones réellement sans rail ne sont mémorisées que temporairement, tandis que les anciennes tuiles vides douteuses de 1.1.93 sont invalidées automatiquement.<br><br><b>🌍 OSM monde</b> affiche l'état du cache. <b>↻ OSM zone</b> supprime et recharge les tuiles visibles si vous soupçonnez une donnée locale incomplète. OpenRailwayMap reste l'enrichissement ferroviaire ; l'existence géométrique de la voie vient de l'OSM vectoriel.` },
        { title: 'Si le tracé semble faux', page: 'schedules', target: '#schedules-list', text: `Un détour absurde ou « données réseau incomplètes » peut venir d'un chargement OSM temporairement incomplet. Utilisez d'abord <b>↻ OSM zone</b> si les traits vectoriels manquent, puis <b>↺ Auto segment</b> pour forcer un calcul neuf. N'ajoutez pas des VIA au hasard avant d'avoir vérifié le corridor réel.` },
        { title: 'Calendriers et mise en circulation', page: 'schedules', target: '#btn-schedule-calendars', text: `Les <b>Calendriers</b> déterminent les jours applicables à l’horaire. Après validation, vous pouvez soit <b>affecter directement une rame</b> en mode simplifié, soit utiliser une <b>ligne de roulement</b> pour une exploitation avancée.` },
    ],
    rotations: [
        { title: 'Roulements — module avancé facultatif', page: 'rotations', target: '.rv3-head', image: 'img/tutorial/roulements-v3.webp', caption: 'Exemple de feuille Roulements V3', text: `Les <b>Roulements sont facultatifs</b>. En mode simplifié, un horaire validé avec une rame affectée circule directement. Activez les Roulements avancés dans Paramètres si vous voulez enchaîner plusieurs services et suivre précisément chaque locomotive, rame ou coupon.` },
        { title: 'Bibliothèque à gauche', page: 'rotations', target: '.rv3-library', text: `La bibliothèque donne accès aux <b>Horaires, Matériels, Coupons et Rames</b>. Recherchez un objet puis glissez-le sur la feuille ou utilisez les boutons. Un coupon reste une seule ligne tant qu'il reste physiquement uni.` },
        { title: 'Feuille de roulement au centre', page: 'rotations', target: '.rv3-main', text: `La feuille affiche les trains, heures, codes de gare, temps d'attente et kilomètres. Les traits reflètent la participation réelle du matériel : après une coupe, le coupon détaché cesse d'être réservé par le train d'origine et peut repartir sur une autre branche.` },
        { title: 'Opérations en gare', page: 'rotations', target: '.rv3-main', text: `Le bouton <b>⊕</b> sur un arrêt permet d'ajouter une opération : changer de locomotive, couper, accrocher, réunir, former/séparer une UM, ajouter une pousse ou un engin en <b>CV</b>. Vérifiez toujours le matériel avant/après l'opération.` },
        { title: 'Inspecteur et vues matériel', page: 'rotations', target: '.rv3-inspector', text: `L'inspecteur détaille l'objet sélectionné. Les vues <b>Matériel / Coupon / Rame</b> montrent sa journée complète pour la date choisie, avec trains, attente et kilomètres. Les conflits de disponibilité ou de position doivent être corrigés avant exploitation.` },
    ],
    lines: [
        { title: 'Lignes / Réseau', page: 'lines', target: '#network-state', text: `Cette page regroupe les gares et lignes logiques de votre compagnie. Elle ne remplace pas la géométrie ferroviaire OSM/ORM utilisée par le routage : elle organise votre réseau de jeu.` },
        { title: 'Créer une gare', page: 'lines', target: '#btn-new-station-lines', text: `Le créateur de gare permet de saisir nom, type, coordonnées, voies et connexion. Utilisez les vraies coordonnées et vérifiez l'accrochage au réseau avant de créer des horaires.` },
        { title: 'Créer une ligne', page: 'lines', target: '#btn-new-line', text: `Une ligne regroupe des gares et services pour l'exploitation, les statistiques et l'affichage. Gardez des noms cohérents : la ligne n'impose pas à elle seule le chemin physique des trains.` },
    ],
    depots: [
        { title: 'Dépôts & ITE — rôle', page: 'depots', target: '#depots-list', text: `Les <b>Dépôts</b> servent au stationnement, à la maintenance et à la réparation du matériel. Les <b>ITE</b> représentent les installations terminales embranchées utilisées notamment par le fret.` },
        { title: 'Créer une installation', page: 'depots', target: '#btn-add-depot', text: `Cliquez <b>+ Ajouter</b>, choisissez le type et placez l'installation. La localisation compte : un matériel qui doit commencer un service doit pouvoir rejoindre physiquement son point de départ.` },
        { title: 'Maintenance et disponibilité', page: 'depots', target: '#depots-list', text: `Suivez l'état du matériel et planifiez les passages en dépôt. Une rame indisponible, en maintenance ou mal localisée peut bloquer un départ même si l'horaire est valide.` },
    ],
    incidents: [
        { title: 'Incidents & Travaux', page: 'incidents', target: '#active-incidents-list', text: `Cette page centralise les incidents actifs et les travaux programmés qui influencent l'exploitation : ralentissements, interruptions, obstacles, personnes sur les voies, pannes et autres événements.` },
        { title: 'Incidents aléatoires', page: 'incidents', target: '#incident-types-table', text: `Activez ou désactivez les familles d'incidents selon le niveau de simulation souhaité. Les événements actifs apparaissent avec leur impact, durée et zone concernée.` },
        { title: 'Programmer des travaux', page: 'incidents', target: '#btn-add-works', text: `Les travaux permettent de prévoir une contrainte avant qu'elle n'arrive. Indiquez la période et la zone puis contrôlez les conséquences sur les trains concernés.` },
    ],
    infogare: [
        { title: 'Infogare — créer un affichage voyageurs', page: 'infogare', target: '#infogare-station', text: `Choisissez une gare puis un type d'affichage. Infogare lit les circulations réelles de la partie pour reproduire différents écrans SNCF, RATP ou DB.` },
        { title: 'Choisir le bon format', page: 'infogare', target: '#infogare-display', image: 'img/infogare/CATI-COMPLET.png', caption: 'Exemple de palette CATI', text: `Chaque format a ses propres règles de présentation : départs, arrivées, quai, RER, DB, etc. Pour <b>DB Quai</b>, choisissez également le service précis à afficher.` },
        { title: 'Afficher et contrôler le résultat', page: 'infogare', target: '#btn-infogare-show', text: `Cliquez <b>Afficher</b>. Si aucun train n'apparaît, vérifiez la date/heure du jeu, le calendrier du service, la gare sélectionnée et l'existence de circulations valides.` },
    ],
    dashboard: [
        { title: 'Dashboard — vue de synthèse', page: 'dashboard', target: '#dashboard-container', text: `Le Dashboard rassemble les indicateurs principaux de la compagnie : activité, finances, ponctualité, parc et exploitation. Utilisez-le pour repérer rapidement une tendance anormale.` },
        { title: 'Lire avant d’agir', page: 'dashboard', target: '#dashboard-container', text: `Un chiffre isolé peut venir d'un incident ou d'une période creuse. Comparez les indicateurs entre eux puis ouvrez la page concernée (Horaires, Incidents, Matériel…) pour corriger la cause.` },
    ],
    'graph-marche': [
        { title: 'Graphique de marche', page: 'graph-marche', target: '#graph-marche-container', text: `Le graphique de marche représente les circulations dans le temps et l'espace. Il permet de visualiser les croisements, dépassements, intervalles et conflits potentiels.` },
        { title: 'Interpréter les lignes', page: 'graph-marche', target: '#graph-marche-container', text: `L'axe horizontal représente le temps et l'axe vertical les points du parcours. Une ligne plus inclinée correspond à une progression plus rapide. Analysez les trains proches avant de retoucher un sillon.` },
    ],
    staff: [
        { title: 'Personnel — module avancé facultatif', page: 'staff', target: '#staff-container', text: `Le <b>Personnel est facultatif</b> en mode simplifié. Vous pouvez recruter et organiser vos agents sans que leur absence bloque vos trains. Activez <b>Personnel opérationnel contraignant</b> dans Paramètres quand vous voulez gérer réellement conducteurs, 3×8, habilitations et équipes dépôt.` },
        { title: 'Quand le rendre contraignant', page: 'staff', target: '#staff-container', text: `En mode avancé seulement, un conducteur ou une équipe manquante peut bloquer un départ ou une opération dépôt. Tant que l'option reste désactivée, Rail Empire automatise cette couche pour les joueurs novices.` },
    ],
    weather: [
        { title: 'Météo', page: 'weather', target: '#weather-container', text: `La météo influence l'environnement de jeu et peut modifier les conditions d'exploitation. Cette page affiche les conditions actuelles et les informations météorologiques disponibles.` },
        { title: 'Impact exploitation', page: 'weather', target: '#weather-container', text: `Quand les conditions se dégradent, surveillez davantage les retards et incidents. Les temps théoriques d'un horaire ne garantissent pas qu'une rame réelle tiendra toujours sa marche dans toutes les conditions.` },
    ],
    'cargo-types': [
        { title: 'Marchandises', page: 'cargo-types', target: '#cargo-types-container', text: `Cette page présente les types de fret gérés par Rail Empire. Chaque marchandise peut imposer des familles de wagons ou des chaînes logistiques différentes.` },
        { title: 'Choisir le bon wagon', page: 'cargo-types', target: '#cargo-types-container', text: `Avant de créer un trafic fret, vérifiez la compatibilité du wagon avec la cargaison ainsi que les capacités et contraintes techniques du matériel.` },
    ],
    'industrial-clients': [
        { title: 'Industriels — générateurs de fret', page: 'industrial-clients', target: '#industrial-clients-container', text: `Les sites industriels produisent ou consomment des marchandises et donnent un but économique aux trains de fret. Leur position est liée au réseau et aux ITE disponibles.` },
        { title: 'Construire un flux fret', page: 'industrial-clients', target: '#industrial-clients-container', text: `Identifiez une origine, une destination et la marchandise échangée, puis choisissez les wagons compatibles. Créez ensuite les horaires et affectez les rames nécessaires.` },
    ],
    marketing: [
        { title: 'Marketing — expérience client complète', page: 'marketing', target: '#marketing-container', text: `Cette page pilote tout ce qui entoure le voyageur : <b>offres commerciales, abonnements, fidélité, services à bord, restauration, campagnes marketing, régie publicitaire, satisfaction, avis clients et presse</b>. Les KPI sont reliés aux données réelles de la partie.` },
        { title: 'Des statistiques issues de la partie', page: 'marketing', target: '#marketing-container', text: `Satisfaction native RE, voyageurs transportés, recettes billets, ponctualité, retard moyen, occupation et propreté des rames alimentent directement les scores. Les actions marketing viennent ensuite influer sur la demande, l’image, les coûts et les recettes annexes.` },
        { title: 'Offres, services et restauration', page: 'marketing', target: '#marketing-container', text: `Activez uniquement les services que vous voulez financer. La restauration calcule ses ventes à partir des voyageurs réellement transportés entre deux règlements journaliers ; prix, coût, qualité et best-sellers influencent la marge et la satisfaction.` },
        { title: 'Campagnes, publicité et réputation', page: 'marketing', target: '#marketing-container', text: `Les campagnes débitent un budget quotidien et améliorent notoriété/demande. La régie publicitaire fait l’inverse : les contrats vendus rapportent chaque jour. Les avis clients et articles de presse sont rédigés automatiquement à partir des performances observées.` },
    ],
});
export class Tutorial {
    steps: readonly TutorialStep[];
    globalSteps: readonly TutorialStep[];
    pageGuides: Readonly<Record<string, readonly TutorialStep[]>>;
    guidePage: string | null;
    currentStep: number;
    active: boolean;
    _overlay: HTMLElement | null;
    _game: TutorialGame | null;
    constructor() {
        this.steps = [
            {
                title: `Bienvenue dans Rail Empire !`,
                text: `Ce guide présente les fonctions essentielles avant d'aller vers les outils avancés.<br><br>
        Rail Empire est un simulateur ferroviaire. Vous construisez un réseau, achetez du matériel roulant, planifiez des horaires et regardez vos trains rouler en temps réel.<br><br>
        <b>Ce tutoriel est là pour vous accompagner pas à pas.</b> On va y aller doucement. Vous pouvez quitter à tout moment en cliquant sur la croix en haut à droite, et revenir plus tard en cliquant sur l'icône <b>?</b> dans le bandeau.<br><br>
        Cliquez sur <b>Suivant</b> quand vous êtes prêt.`,
                target: null,
                page: null,
            },
            {
                title: `Avant toute chose : le parcours conseillé`,
                text: `Rail Empire contient beaucoup d'outils ; voici un parcours simple pour les découvrir. Voici le plan :<br><br>
        1. <b>Observer</b> la carte et l'interface.<br>
        2. <b>Créer deux gares</b> proches l'une de l'autre.<br>
        3. <b>Acheter</b> une locomotive et des wagons ou voitures.<br>
        4. <b>Assembler</b> votre première rame.<br>
        5. <b>Optionnel :</b> embaucher un conducteur si le Personnel contraignant est activé.<br>
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
        Regardez votre première gare. Quand l'heure de départ arrive, une <b>pastille colorée avec une flèche</b> apparaît : c'est votre train !<br><br>
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
        4. <b>Personnel</b> : facultatif en mode simplifié ; activez-le plus tard si vous voulez gérer les conducteurs.<br>
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
        • <b>Un retard n'est pas forcément une erreur</b> : vérifiez d'abord le matériel, le trafic et les incidents.<br>
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
        this.globalSteps = this.steps;
        this.pageGuides = PAGE_GUIDES;
        this.guidePage = null;
        this.currentStep = 0;
        this.active = false;
        this._overlay = null;
        this._game = null;
    }
    start(game: TutorialGame) {
        this.steps = this.globalSteps;
        this.guidePage = null;
        this.currentStep = 0;
        this.active = true;
        this._game = game;
        this._createOverlay();
        this._renderStep();
    }
    startPage(page: unknown, game: TutorialGame) {
        const key = String(page || 'map');
        const guide = this.pageGuides?.[key];
        if (!Array.isArray(guide) || !guide.length)
            return this.start(game);
        this.steps = guide;
        this.guidePage = key;
        this.currentStep = 0;
        this.active = true;
        this._game = game;
        try {
            game?.ui?.switchPage?.(key);
        }
        catch { }
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
        }
        else {
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
        <div class="tutorial-media" style="display:none"></div>
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
        overlay.querySelector('.tutorial-close')!.addEventListener('click', () => this.stop());
        overlay.querySelector('.tutorial-prev')!.addEventListener('click', () => this.prev());
        overlay.querySelector('.tutorial-next')!.addEventListener('click', () => this.next());
        overlay.setAttribute('tabindex', '-1');
        overlay.focus();
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape')
                this.stop();
            if (e.key === 'ArrowRight')
                this.next();
            if (e.key === 'ArrowLeft')
                this.prev();
        });
        overlay.querySelector('.tutorial-backdrop')!.addEventListener('click', (e: MouseEvent) => {
            if (e.target === e.currentTarget)
                this.stop();
        });
    }
    _removeOverlay() {
        const el = document.getElementById('tutorial-overlay');
        if (el)
            el.remove();
        this._overlay = null;
    }
    _renderStep() {
        if (!this._overlay || !this.active)
            return;
        const step = this.steps[this.currentStep];
        if (step.page && this._game?.ui) {
            this._game.ui.switchPage(step.page);
        }
        this._overlay.querySelector('.tutorial-title').innerHTML = step.title;
        this._overlay.querySelector('.tutorial-text').innerHTML = step.text;
        const prefix = this.guidePage ? `Aide ${(PAGE_HELP_LABELS as Record<string, string>)[this.guidePage] || this.guidePage} · ` : '';
        this._overlay.querySelector('.tutorial-step-counter').textContent = `${prefix}Étape ${this.currentStep + 1} / ${this.steps.length}`;
        const media = this._overlay.querySelector('.tutorial-media');
        if (media) {
            if (step.image) {
                media.style.display = 'block';
                media.innerHTML = `<img src="${htmlText(step.image)}" alt="${htmlText(String(step.caption || step.title).replace(/"/g, '&quot;'))}" loading="lazy"><small>${step.caption || ''}</small>`;
            }
            else {
                media.style.display = 'none';
                media.innerHTML = '';
            }
        }
        const pct = ((this.currentStep + 1) / this.steps.length * 100).toFixed(0);
        this._overlay.querySelector('.tutorial-progress').innerHTML =
            `<div style="background:var(--bg3);height:4px;border-radius:2px;margin:12px 0"><div style="background:var(--blue);height:4px;border-radius:2px;width:${htmlText(pct)}%"></div></div>`;
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
            }
            else {
                highlight.style.display = 'none';
            }
        }
        else {
            highlight.style.display = 'none';
        }
        const box = this._overlay.querySelector('.tutorial-box');
        if (box)
            box.scrollTop = 0;
    }
}

