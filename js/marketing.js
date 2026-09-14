import { htmlText } from './html-text.js';
import { icon } from './icons.js';
const rec = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const s = (v, d = '') => typeof v === 'string' ? v : d;
const b = (v, d = false) => typeof v === 'boolean' ? v : d;
const esc = (v) => htmlText(String(v ?? ''));
const euro = (v) => `${Math.round(v).toLocaleString('fr-FR')} €`;
const pct = (v) => `${Math.round(v)} %`;
const fmt = (v, d = 0) => Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const stableId = (prefix, name) => `${prefix}_${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50)}`;
const randId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const dateText = (v) => s(v, new Date().toISOString().slice(0, 10));
const audiences = ['Tous', 'Pendulaires', 'Affaires', 'Loisirs', 'Familles', 'Premium', 'Jeunes', 'Seniors', 'Groupes'];
const offerTypes = ['tarif', 'abonnement', 'fidélité', 'service', 'confort', 'promotion'];
const FEEDBACK_NAMES = ['Camille', 'Nina', 'Mathis', 'Jules', 'Sarah', 'Lina', 'Tom', 'Louise', 'Emma', 'Hugo', 'Clara', 'Louis', 'Anaïs', 'Lucas', 'Manon', 'Gabriel', 'Chloé', 'Arthur'];
const PRESS_MEDIA = ['Le Rail Hebdo', 'Mobilités Magazine', 'Transports & Territoires', 'Voyager+', 'Le Quotidien Éco', 'Réseaux & Mobilités', 'L’Observateur du Rail', 'Mobilité Business'];
const DEFAULT_OFFERS = [
    ['Carte Week-end', 'tarif', 'Loisirs', 'Réduction sur les voyages de fin de semaine.', -15, 9, 4, false, true],
    ['Pack Famille', 'tarif', 'Familles', 'Prix réduit, placement groupé et souplesse d’échange.', -12, 12, 6, true, true],
    ['Business Flex', 'tarif', 'Affaires', 'Billet modifiable, priorité et conditions flexibles.', 8, 5, 5, true, true],
    ['Tarif Jeune', 'tarif', 'Jeunes', 'Prix allégé pour étudiants et jeunes voyageurs.', -18, 11, 4, false, false],
    ['Tarif Senior', 'tarif', 'Seniors', 'Réduction et assistance facilitée.', -12, 6, 5, false, false],
    ['Mini-groupe', 'tarif', 'Groupes', 'Prix dégressif pour 4 à 9 voyageurs.', -10, 8, 4, false, false],
    ['Groupe 10+', 'tarif', 'Groupes', 'Tarification groupe et réservation centralisée.', -16, 7, 5, false, false],
    ['Dernière minute', 'promotion', 'Tous', 'Remplit les sièges restants avec un prix dynamique.', -20, 10, 2, false, false],
    ['Early Bird', 'promotion', 'Loisirs', 'Récompense les réservations très anticipées.', -14, 9, 3, false, false],
    ['Happy Hours Rail', 'promotion', 'Tous', 'Promotion ciblée sur les trains creux.', -10, 7, 2, false, false],
    ['Abonnement Pendulaire', 'abonnement', 'Pendulaires', 'Forfait mensuel pour trajets récurrents.', -22, 14, 6, false, true],
    ['Pass Réseau', 'abonnement', 'Tous', 'Accès forfaitaire à un large panier de trains.', -9, 9, 5, false, false],
    ['Business Unlimited', 'abonnement', 'Affaires', 'Forfait premium très flexible.', 12, 7, 7, false, false],
    ['Rail Points', 'fidélité', 'Tous', 'Points, bons d’achat et récompenses de fréquence.', 0, 8, 6, true, true],
    ['Statut Gold', 'fidélité', 'Premium', 'Avantages renforcés pour clients très fréquents.', 5, 5, 8, false, false],
    ['Parrainage', 'fidélité', 'Tous', 'Bonus au parrain et au nouveau client.', -5, 10, 4, false, false],
    ['Silence Plus', 'confort', 'Premium', 'Accès garanti à une zone calme.', 5, 3, 7, false, false],
    ['Famille Zen', 'confort', 'Familles', 'Zone famille et kit enfant.', 3, 4, 8, false, false],
    ['Siège garanti', 'service', 'Pendulaires', 'Option de place assise garantie.', 6, 4, 7, false, false],
    ['Bagage Plus', 'service', 'Loisirs', 'Bagage supplémentaire et emplacement réservé.', 4, 3, 4, false, false],
    ['Vélo à bord', 'service', 'Loisirs', 'Réservation d’un emplacement vélo.', 3, 3, 5, false, false],
    ['Assistance Premium', 'service', 'Premium', 'Accompagnement personnalisé avant et pendant le voyage.', 12, 2, 9, false, false],
    ['Correspondance Sérénité', 'service', 'Tous', 'Protection commerciale en cas de correspondance manquée.', 4, 5, 8, false, false],
    ['Offre Événement', 'promotion', 'Loisirs', 'Pack train + avantage lors d’un événement.', -8, 8, 5, false, false],
].map((x) => ({ name: x[0], type: x[1], target: x[2], description: x[3], priceDeltaPct: x[4], demandBoost: x[5], satisfactionBoost: x[6], active: x[7], featured: x[8] }));
const DEFAULT_FOOD = [
    ['Espresso', 'Boissons chaudes', 2.5, .45, 82, false, true, true, true], ['Café allongé', 'Boissons chaudes', 2.9, .55, 82, false, true, true, false], ['Cappuccino', 'Boissons chaudes', 3.7, 1.05, 86, false, true, true, true], ['Thé premium', 'Boissons chaudes', 3.2, .75, 85, false, true, true, false], ['Chocolat chaud', 'Boissons chaudes', 3.6, 1.1, 83, false, true, true, false],
    ['Eau plate 50 cl', 'Boissons froides', 2.3, .4, 78, false, true, true, false], ['Eau gazeuse 50 cl', 'Boissons froides', 2.5, .48, 79, false, true, true, false], ['Jus de pomme local', 'Boissons froides', 3.8, 1.35, 90, true, true, true, false], ['Jus d’orange', 'Boissons froides', 3.6, 1.2, 86, false, true, true, false], ['Cola', 'Boissons froides', 3.4, .9, 77, false, true, true, false],
    ['Croissant pur beurre', 'Petit-déjeuner', 2.6, .8, 87, true, true, true, true], ['Pain au chocolat', 'Petit-déjeuner', 2.8, .9, 86, true, true, true, false], ['Menu petit-déjeuner', 'Petit-déjeuner', 8.9, 3.25, 89, true, false, true, true], ['Granola & yaourt', 'Petit-déjeuner', 5.2, 2.0, 90, true, true, false, false],
    ['Sandwich jambon-beurre', 'Snacks salés', 6.2, 2.15, 82, true, false, true, true], ['Club poulet', 'Snacks salés', 7.9, 3.1, 86, false, false, true, false], ['Wrap végétarien', 'Snacks salés', 7.4, 2.8, 91, true, true, true, false], ['Croque-monsieur', 'Snacks salés', 7.2, 2.6, 84, false, false, false, false], ['Salade César', 'Repas légers', 9.5, 4.0, 87, false, false, true, false], ['Salade veggie locale', 'Repas légers', 9.2, 3.7, 93, true, true, false, false],
    ['Bowl méditerranéen', 'Repas légers', 10.5, 4.4, 92, true, true, false, false], ['Pasta chaude', 'Plats chauds', 11.9, 5.1, 88, false, true, false, false], ['Parmentier du chef', 'Plats chauds', 13.5, 6.0, 92, true, false, false, false], ['Curry végétal', 'Plats chauds', 12.9, 5.5, 94, true, true, false, false],
    ['Menu enfant', 'Famille', 7.5, 2.9, 88, false, false, false, false], ['Compote enfant', 'Famille', 2.2, .65, 86, true, true, false, false], ['Cookie chocolat', 'Desserts', 3.3, .95, 89, true, true, true, true], ['Brownie', 'Desserts', 3.7, 1.15, 87, false, true, true, false], ['Tarte locale', 'Desserts', 4.8, 1.9, 93, true, true, false, false], ['Salade de fruits', 'Desserts', 4.9, 2.05, 92, true, true, false, false],
    ['Plateau Business', 'Premium', 18.5, 8.2, 95, true, false, false, false], ['Petit-déjeuner Premium', 'Premium', 16.0, 6.8, 96, true, false, false, false], ['Box apéritive', 'Premium', 14.5, 6.1, 92, true, false, false, false], ['Menu régional', 'Premium', 19.5, 8.9, 97, true, false, false, false],
].map((x) => ({ name: x[0], category: x[1], price: x[2], cost: x[3], quality: x[4], local: x[5], vegetarian: x[6], active: x[7], bestseller: x[8] }));
const DEFAULT_FEATURES = [
    ['Wi-Fi à bord', 'Digital', 'Accès Wi-Fi voyageurs avec portail captif.', .08, 5, 3, true], ['Prises électriques', 'Confort', 'Prises ou USB à la place.', .025, 3, 1, true], ['Zone calme', 'Confort', 'Espace silencieux identifié et contrôlé.', .03, 4, 1, true], ['Zone familles', 'Famille', 'Espace adapté aux familles et poussettes.', .035, 4, 2, true], ['Accessibilité renforcée', 'Accessibilité', 'Assistance et parcours PMR renforcés.', .05, 5, 1, true], ['Streaming à bord', 'Digital', 'Portail de contenus hors-ligne.', .06, 3, 2, false], ['Commande au siège', 'Restauration', 'Commande depuis le portail Wi-Fi avec livraison.', .10, 5, 2, false], ['Réservation vélo', 'Services', 'Emplacement vélo réservable.', .018, 3, 2, false], ['Espace bagages surveillé', 'Services', 'Zone bagages améliorée et clairement balisée.', .04, 4, 1, false], ['Kit enfant', 'Famille', 'Jeu, coloriage et petite attention.', .12, 5, 2, false], ['Presse numérique', 'Digital', 'Accès presse et magazines durant le trajet.', .035, 3, 1, false], ['Accueil Premium', 'Premium', 'Accueil dédié et petite attention.', .45, 7, 2, false], ['Salon en gare', 'Premium', 'Accès salon selon billet/offre.', .55, 8, 3, false], ['Service à la place', 'Premium', 'Restauration servie directement au siège.', .35, 7, 2, false], ['Info temps réel enrichie', 'Information', 'Correspondances, quai, retard et alternatives.', .02, 6, 2, true], ['Compensation automatique', 'Service client', 'Bon ou remboursement déclenché automatiquement.', .08, 7, 2, false], ['Objets trouvés express', 'Service client', 'Suivi numérique et restitution accélérée.', .015, 2, 1, false], ['Option animal', 'Services', 'Conditions claires et espace adapté.', .01, 2, 1, false],
].map((x) => ({ name: x[0], category: x[1], description: x[2], costPerPassenger: x[3], satisfactionBoost: x[4], demandBoost: x[5], active: x[6] }));
const DEFAULT_AD_SLOTS = [
    ['Écrans information à bord', 'À bord', 'Écran 16:9', 4200, 30, 'Display'], ['Portail Wi-Fi', 'À bord', 'Bannière / interstitiel', 2800, 30, 'Digital'], ['Tablettes dossier de siège', 'À bord', 'Print', 1800, 30, 'Print'], ['Sets de plateau restauration', 'À bord', 'Print', 950, 30, 'Restauration'], ['Habillage voiture', 'À bord', 'Covering partiel', 12500, 14, 'Branding'], ['Billet numérique', 'Digital', 'Encart confirmation', 3500, 30, 'Digital'], ['Application / espace client', 'Digital', 'Bannière native', 4800, 30, 'Digital'], ['Newsletter voyageurs', 'Digital', 'Bloc sponsorisé', 3200, 14, 'CRM'], ['Infogare / écrans gare', 'Gare', 'Display', 6700, 30, 'Display'], ['Affichage quai', 'Gare', 'Affiche / DOOH', 8200, 30, 'Affichage'], ['Salon Premium', 'Gare', 'Branding discret', 5100, 30, 'Premium'], ['Magazine de bord', 'À bord', 'Page entière', 2900, 30, 'Print'],
].map((x) => ({ name: x[0], placement: x[1], format: x[2], dailyPrice: x[3], contractDays: x[4], category: x[5] }));
const CAMPAIGN_PRESETS = [
    ['Grande campagne nationale', 'TV + Digital', 'Tous', 'Notoriété', 85000, 21, 11, 5, 1], ['Remplir les heures creuses', 'Digital', 'Pendulaires', 'Conversion', 18000, 14, 5, 9, 1], ['Escapades week-end', 'Social + Affichage', 'Loisirs', 'Conversion', 26000, 21, 6, 8, 2], ['Familles en vacances', 'Digital + Presse', 'Familles', 'Lancement offre', 22000, 28, 6, 7, 3], ['Business Rail', 'Presse + LinkedIn', 'Affaires', 'Image de marque', 32000, 30, 7, 5, 3], ['Jeunes à bord', 'Social + Influence', 'Jeunes', 'Acquisition', 16000, 21, 5, 9, 2], ['Montée en gamme', 'Presse + Display', 'Premium', 'Image de marque', 38000, 30, 8, 4, 4], ['Fidélisation clients', 'CRM + E-mail', 'Tous', 'Rétention', 9000, 30, 3, 4, 4], ['Communication verte', 'Presse + Digital', 'Tous', 'Image de marque', 24000, 30, 7, 4, 3], ['Lancement nouvelle ligne', 'TV + Affichage', 'Tous', 'Lancement offre', 65000, 28, 10, 8, 2],
];
export class MarketingManager {
    constructor() {
        this.offers = [];
        this.catering = [];
        this.features = [];
        this.campaigns = [];
        this.adSlots = [];
        this.feedbacks = [];
        this.pressReviews = [];
        this.history = [];
        this.settings = { farePolicy: 'équilibrée', compensationPolicy: 'équilibrée', loyaltyProgram: 'simple', brandPositioning: 'généraliste', customerCare: 'renforcé', greenCommunication: false };
        this.stats = { satisfaction: 70, awareness: 50, loyalty: 50, pressScore: 70, averageFeedback: 4, replyRate: 0, activeCampaigns: 0, activeOffers: 0, activeMenuItems: 0, activeFeatures: 0, onboardRevenueToday: 0, onboardCostToday: 0, adRevenueToday: 0, marketingSpendToday: 0, netMarketingToday: 0, dailyPassengers: 0, demandMultiplier: 1, fareMultiplier: 1, lastDay: '' };
        this._lastDailyDate = '';
        this._lastPassengerCount = 0;
        this._tab = 'overview';
        this._liveSnapshot = { totalPassengers: 0, dailyPassengers: 0, totalTicketRevenue: 0, passengerSatisfaction: 70, punctuality: 100, avgDelay: 0, cancelled: 0, passengerServices: 0, livePassengerServices: 0, cleanliness: 100, occupancy: 0, cumulativeRevenue: 0, cumulativeExpenses: 0 };
        this._dimensions = { global: 70, punctuality: 100, comfort: 75, cleanliness: 100, catering: 75, value: 75, information: 75, customerCare: 70, digital: 75, brand: 65 };
        this._mergeCatalogs();
        this._recomputeDerived();
    }
    _mergeCatalogs() {
        const addMissing = (current, defs, prefix) => { for (const d of defs) {
            if (current.some(x => x.name === d.name))
                continue;
            current.push({ id: stableId(prefix, d.name), ...d });
        } };
        addMissing(this.offers, DEFAULT_OFFERS, 'offer');
        addMissing(this.catering, DEFAULT_FOOD.map(x => ({ ...x, salesToday: 0 })), 'food');
        addMissing(this.features, DEFAULT_FEATURES, 'feature');
        addMissing(this.adSlots, DEFAULT_AD_SLOTS.map(x => ({ ...x, advertiser: '', daysRemaining: x.contractDays, active: false })), 'ad');
    }
    toSave() { return { schemaVersion: 2, offers: this.offers, catering: this.catering, features: this.features, campaigns: this.campaigns, adSlots: this.adSlots, feedbacks: this.feedbacks, pressReviews: this.pressReviews, settings: this.settings, stats: this.stats, history: this.history, lastDailyDate: this._lastDailyDate, lastPassengerCount: this._lastPassengerCount, tab: this._tab }; }
    loadFromSave(data) { const x = rec(data); this.offers = Array.isArray(x.offers) ? x.offers.map(v => this._normOffer(v)) : []; this.catering = Array.isArray(x.catering) ? x.catering.map(v => this._normFood(v)) : []; this.features = Array.isArray(x.features) ? x.features.map(v => this._normFeature(v)) : []; this.campaigns = Array.isArray(x.campaigns) ? x.campaigns.map(v => this._normCampaign(v)) : []; this.adSlots = Array.isArray(x.adSlots) ? x.adSlots.map(v => this._normAd(v)) : []; this.feedbacks = Array.isArray(x.feedbacks) ? x.feedbacks.map(v => this._normFeedback(v)) : []; this.pressReviews = Array.isArray(x.pressReviews) ? x.pressReviews.map(v => this._normPress(v)) : []; this.history = Array.isArray(x.history) ? x.history.map(v => this._normHistory(v)).slice(-120) : []; const st = rec(x.settings); this.settings = { farePolicy: (['éco', 'équilibrée', 'premium'].includes(s(st.farePolicy)) ? s(st.farePolicy) : 'équilibrée'), compensationPolicy: (['minimale', 'équilibrée', 'généreuse'].includes(s(st.compensationPolicy)) ? s(st.compensationPolicy) : 'équilibrée'), loyaltyProgram: (['aucun', 'simple', 'premium'].includes(s(st.loyaltyProgram)) ? s(st.loyaltyProgram) : 'simple'), brandPositioning: (['accessible', 'généraliste', 'premium', 'écologique'].includes(s(st.brandPositioning)) ? s(st.brandPositioning) : 'généraliste'), customerCare: (['standard', 'renforcé', 'excellence'].includes(s(st.customerCare)) ? s(st.customerCare) : 'renforcé'), greenCommunication: b(st.greenCommunication, false) }; const ss = rec(x.stats); Object.assign(this.stats, { satisfaction: clamp(n(ss.satisfaction, 70), 0, 100), awareness: clamp(n(ss.awareness, 50), 0, 100), loyalty: clamp(n(ss.loyalty, 50), 0, 100), pressScore: clamp(n(ss.pressScore, 70), 0, 100), averageFeedback: clamp(n(ss.averageFeedback, 4), 1, 5), replyRate: clamp(n(ss.replyRate, 0), 0, 100) }); this._lastDailyDate = s(x.lastDailyDate); this._lastPassengerCount = Math.max(0, n(x.lastPassengerCount, 0)); const tab = s(x.tab); if (['overview', 'onboard', 'offers', 'campaigns', 'ads', 'satisfaction', 'feedback', 'press'].includes(tab))
        this._tab = tab; this._mergeCatalogs(); this._recomputeDerived(); }
    getPassengerDemandMultiplier() { this._recomputeDerived(); return this.stats.demandMultiplier; }
    getPassengerFareMultiplier() { this._recomputeDerived(); return this.stats.fareMultiplier; }
    syncFromGame(game) { this._liveSnapshot = this._collectGameStats(game); this._dimensions = this._computeDimensions(this._liveSnapshot); this.stats.satisfaction = this._dimensions.global; this._recomputeDerived(); }
    dailyUpdate(game, dateStr) {
        const day = s(dateStr);
        if (!day || day === this._lastDailyDate)
            return;
        this.syncFromGame(game);
        const eco = game.economy;
        const totalPassengers = Math.max(0, n(eco.totalPassengers));
        let dailyPax = this._lastPassengerCount > 0 ? Math.max(0, totalPassengers - this._lastPassengerCount) : 0;
        this._liveSnapshot.dailyPassengers = dailyPax;
        this.stats.dailyPassengers = dailyPax;
        for (const f of this.catering)
            f.salesToday = 0;
        let campaignSpend = 0;
        for (const c of this.campaigns) {
            if (!c.active)
                continue;
            campaignSpend += c.budgetPerDay;
            c.daysRemaining = Math.max(0, c.daysRemaining - 1);
            if (c.daysRemaining === 0)
                c.active = false;
        }
        let adRevenue = 0;
        for (const a of this.adSlots) {
            if (!a.active)
                continue;
            adRevenue += a.dailyPrice;
            a.daysRemaining = Math.max(0, a.daysRemaining - 1);
            if (a.daysRemaining === 0) {
                a.active = false;
                a.advertiser = '';
                a.daysRemaining = a.contractDays;
            }
        }
        const menu = this.catering.filter(x => x.active);
        let onboardRevenue = 0, onboardCost = 0;
        if (dailyPax > 0 && menu.length) {
            const quality = menu.reduce((z, x) => z + x.quality, 0) / menu.length;
            const attach = clamp(.08 + menu.length * .008 + (quality - 70) / 500 + Math.max(0, this.stats.satisfaction - 65) / 700, .06, .46);
            const totalPurchases = Math.round(dailyPax * attach);
            const weights = menu.map(x => Math.max(.2, (x.quality / 100) * (x.bestseller ? 1.45 : 1) * (x.local ? 1.08 : 1)));
            const tw = weights.reduce((z, x) => z + x, 0) || 1;
            menu.forEach((item, i) => { const qty = Math.max(0, Math.round(totalPurchases * weights[i] / tw)); item.salesToday = qty; onboardRevenue += qty * item.price; onboardCost += qty * item.cost; });
        }
        const featureCost = dailyPax * this.features.filter(x => x.active).reduce((z, x) => z + x.costPerPassenger, 0);
        const loyaltyCost = dailyPax * (this.settings.loyaltyProgram === 'premium' ? .22 : this.settings.loyaltyProgram === 'simple' ? .08 : 0);
        const careCost = dailyPax * (this.settings.customerCare === 'excellence' ? .12 : this.settings.customerCare === 'renforcé' ? .045 : .015);
        const compensationCost = dailyPax * (this.settings.compensationPolicy === 'généreuse' ? .10 : this.settings.compensationPolicy === 'équilibrée' ? .04 : .012) * Math.max(0, (100 - this._liveSnapshot.punctuality) / 25);
        const marketingSpend = campaignSpend + featureCost + loyaltyCost + careCost + compensationCost;
        this.stats.onboardRevenueToday = Math.round(onboardRevenue);
        this.stats.onboardCostToday = Math.round(onboardCost);
        this.stats.adRevenueToday = Math.round(adRevenue);
        this.stats.marketingSpendToday = Math.round(marketingSpend);
        this.stats.netMarketingToday = Math.round(onboardRevenue + adRevenue - onboardCost - marketingSpend);
        this.stats.lastDay = day;
        if (campaignSpend > 0)
            game.economy?.addExpense?.(Math.round(campaignSpend), 'marketing', `Campagnes marketing ${day}`);
        if (featureCost + loyaltyCost + careCost + compensationCost > 0)
            game.economy?.addExpense?.(Math.round(featureCost + loyaltyCost + careCost + compensationCost), 'service_client', `Services voyageurs & fidélité ${day}`);
        if (onboardCost > 0)
            game.economy?.addExpense?.(Math.round(onboardCost), 'restauration', `Coût restauration à bord ${day}`);
        if (onboardRevenue > 0)
            game.economy?.addRevenue?.(Math.round(onboardRevenue), 'restauration', `Ventes restauration à bord ${day}`);
        if (adRevenue > 0)
            game.economy?.addRevenue?.(Math.round(adRevenue), 'publicite', `Recettes publicitaires ${day}`);
        const campLift = this.campaigns.filter(x => x.active).reduce((z, x) => z + x.awarenessGain, 0);
        const press = this.stats.pressScore;
        this.stats.awareness = clamp(Math.round(this.stats.awareness * .94 + 4 + campLift * .7 + Math.min(8, dailyPax / 1200) + (this.settings.greenCommunication ? 1 : 0)), 10, 100);
        this.stats.loyalty = clamp(Math.round(this.stats.loyalty * .86 + this.stats.satisfaction * .13 + (this.settings.loyaltyProgram === 'premium' ? 6 : this.settings.loyaltyProgram === 'simple' ? 3 : 0)), 5, 100);
        if (totalPassengers > 0)
            this._generateFeedback(day, game, Math.max(1, Math.min(6, Math.round(dailyPax / 700) + 1)));
        if (totalPassengers > 0 && (this.history.length === 0 || this._dayHash(day, 'press') < .34))
            this._generatePress(day, game);
        this._recomputeDerived();
        this.history.push({ date: day, passengers: dailyPax, satisfaction: this.stats.satisfaction, awareness: this.stats.awareness, loyalty: this.stats.loyalty, punctuality: this._liveSnapshot.punctuality, cateringRevenue: Math.round(onboardRevenue), adRevenue: Math.round(adRevenue), spend: Math.round(onboardCost + marketingSpend), net: this.stats.netMarketingToday });
        this.history = this.history.slice(-120);
        this._lastPassengerCount = totalPassengers;
        this._lastDailyDate = day;
        void press;
    }
    render(container, game) { if (!container)
        return; this.syncFromGame(game); container.innerHTML = this._renderPage(); this._bind(container, game); }
    _collectGameStats(game) { const eco = game.economy; const all = Array.isArray(game.scheduleCreator.services) ? (game.scheduleCreator.services) : []; const active = typeof game.scheduleCreator?.getActiveServices === 'function' ? game.scheduleCreator.getActiveServices() : []; const isPax = (v) => String(rec(v).serviceType || rec(v).category || '').toLowerCase() === 'passager'; const paxAll = all.filter(isPax); const live = active.filter(isPax); const moving = live.filter(v => s(rec(v).state) === 'moving'); let onTime = 0, totalDelay = 0; for (const v of moving) {
        const d = n(rec(rec(v).train).delay, 0);
        totalDelay += d;
        if (Math.abs(d) <= 5)
            onTime++;
    } const punctuality = moving.length ? onTime / moving.length * 100 : (this.history.at(-1)?.punctuality ?? 100); const cancelled = paxAll.filter(v => b(rec(v).cancelled) || s(rec(v).state) === 'cancelled').length; const rames = (game.rameManager?.getAll?.() || []); const passengerRames = rames.filter(v => n(rec(v).totalCapacity) > 0); let clean = 0; for (const r of passengerRames) {
        const c = rec(rec(r).cleanliness);
        clean += (n(c.interior, 100) * .72 + n(c.exterior, 100) * .28);
    } const cleanliness = passengerRames.length ? clean / passengerRames.length : 100; let onboard = 0, cap = 0; for (const v of live) {
        onboard += Math.max(0, n(rec(v)._onboardPax));
        cap += Math.max(0, n(rec(rec(v).rame).totalCapacity));
    } const actualSat = eco.passengerSatisfaction == null ? 70 : clamp(n(eco.passengerSatisfaction, 70), 0, 100); return { totalPassengers: Math.max(0, n(eco.totalPassengers)), dailyPassengers: this.stats.dailyPassengers, totalTicketRevenue: Math.max(0, n(eco.totalTicketRevenue)), passengerSatisfaction: actualSat, punctuality: clamp(punctuality, 0, 100), avgDelay: moving.length ? totalDelay / moving.length : 0, cancelled, passengerServices: paxAll.length, livePassengerServices: live.length, cleanliness: clamp(cleanliness, 0, 100), occupancy: cap ? clamp(onboard / cap * 100, 0, 100) : 0, cumulativeRevenue: Math.max(0, n(eco.revenue)), cumulativeExpenses: Math.max(0, n(eco.expenses)) }; }
    _computeDimensions(g) { const activeFeatures = this.features.filter(x => x.active); const featureSat = activeFeatures.reduce((z, x) => z + x.satisfactionBoost, 0); const featureIds = new Set(activeFeatures.map(x => x.id)); const menu = this.catering.filter(x => x.active); const menuQuality = menu.length ? menu.reduce((z, x) => z + x.quality, 0) / menu.length : 45; const variety = clamp(menu.length * 3, 0, 30); const offerSat = this.offers.filter(x => x.active).reduce((z, x) => z + x.satisfactionBoost, 0); const punctuality = clamp(g.punctuality - Math.max(0, g.avgDelay - 5) * .8, 0, 100); const cleanliness = clamp(g.cleanliness, 0, 100); const comfort = clamp(58 + featureSat * .7 + cleanliness * .22, 0, 100); const catering = clamp(menuQuality * .72 + variety + (menu.some(x => x.local) ? 4 : 0) + (menu.some(x => x.vegetarian) ? 3 : 0), 0, 100); const value = clamp((this.settings.farePolicy === 'éco' ? 88 : this.settings.farePolicy === 'équilibrée' ? 76 : 63) + offerSat * .45, 0, 100); const information = clamp(68 + (activeFeatures.some(x => x.name.includes('Info temps réel')) ? 16 : 0) + (this.settings.customerCare === 'excellence' ? 7 : this.settings.customerCare === 'renforcé' ? 3 : 0), 0, 100); const customerCare = clamp(52 + this.stats.replyRate * .35 + (this.settings.compensationPolicy === 'généreuse' ? 18 : this.settings.compensationPolicy === 'équilibrée' ? 10 : 3) + (this.settings.customerCare === 'excellence' ? 14 : this.settings.customerCare === 'renforcé' ? 8 : 2), 0, 100); const digital = clamp(55 + (activeFeatures.some(x => x.name.includes('Wi-Fi')) ? 18 : 0) + (activeFeatures.some(x => x.name.includes('Streaming')) ? 9 : 0) + (activeFeatures.some(x => x.name.includes('Presse numérique')) ? 6 : 0), 0, 100); const brand = clamp(this.stats.awareness * .55 + this.stats.pressScore * .35 + this.stats.loyalty * .1, 0, 100); const global = clamp(g.passengerSatisfaction * .38 + punctuality * .16 + comfort * .10 + cleanliness * .08 + catering * .07 + value * .06 + information * .05 + customerCare * .04 + digital * .03 + brand * .03, 0, 100); void featureIds; return { global: Math.round(global), punctuality: Math.round(punctuality), comfort: Math.round(comfort), cleanliness: Math.round(cleanliness), catering: Math.round(catering), value: Math.round(value), information: Math.round(information), customerCare: Math.round(customerCare), digital: Math.round(digital), brand: Math.round(brand) }; }
    _recomputeDerived() { const ratings = this.feedbacks.map(x => x.rating); this.stats.averageFeedback = ratings.length ? ratings.reduce((z, x) => z + x, 0) / ratings.length : 4; this.stats.replyRate = this.feedbacks.length ? this.feedbacks.filter(x => x.responded || x.status !== 'new').length / this.feedbacks.length * 100 : 0; this.stats.pressScore = this.pressReviews.length ? clamp(Math.round(this.pressReviews.slice(0, 12).reduce((z, x) => z + x.score, 0) / Math.min(12, this.pressReviews.length)), 0, 100) : 70; this.stats.activeCampaigns = this.campaigns.filter(x => x.active).length; this.stats.activeOffers = this.offers.filter(x => x.active).length; this.stats.activeMenuItems = this.catering.filter(x => x.active).length; this.stats.activeFeatures = this.features.filter(x => x.active).length; const offerDemand = this.offers.filter(x => x.active).reduce((z, x) => z + x.demandBoost, 0); const featDemand = this.features.filter(x => x.active).reduce((z, x) => z + x.demandBoost, 0); const campDemand = this.campaigns.filter(x => x.active).reduce((z, x) => z + x.demandGain, 0); this.stats.demandMultiplier = clamp(1 + (this.stats.awareness - 50) / 600 + (this.stats.loyalty - 50) / 900 + (offerDemand + featDemand + campDemand) / 700, .72, 1.55); const base = this.settings.farePolicy === 'éco' ? .90 : this.settings.farePolicy === 'premium' ? 1.12 : 1; const offerPrice = this.offers.filter(x => x.active).reduce((z, x) => z + x.priceDeltaPct, 0); this.stats.fareMultiplier = clamp(base * (1 + offerPrice / Math.max(1, this.offers.filter(x => x.active).length) / 100 * .35), .72, 1.28); }
    _dayHash(day, salt) { let h = 2166136261; for (const ch of `${day}|${salt}`) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    } return ((h >>> 0) % 100000) / 100000; }
    _pick(arr, day, salt) { return arr[Math.floor(this._dayHash(day, salt) * arr.length) % arr.length]; }
    _generateFeedback(day, game, count = 1) { this.syncFromGame(game); if (this._liveSnapshot.totalPassengers <= 0)
        return; const dims = this._dimensions; const ordered = Object.entries(dims).filter(([k]) => k !== 'global').sort((a, b) => a[1] - b[1]); for (let i = 0; i < count; i++) {
        const focus = i % 3 === 0 ? ordered[0] : i % 3 === 1 ? ordered.at(-1) : ordered[Math.min(ordered.length - 1, 2)];
        const category = this._dimensionLabel(focus[0]);
        const base = clamp(Math.round(dims.global / 20), 1, 5);
        const wobble = this._dayHash(day, `fb${this.feedbacks.length + i}`) < .32 ? -1 : this._dayHash(day, `fbp${i}`) > .8 ? 1 : 0;
        const rating = clamp(base + wobble + (focus[1] < 55 ? -1 : focus[1] > 88 ? 1 : 0), 1, 5);
        const tone = rating >= 4 ? 'positive' : rating === 3 ? 'mixed' : 'negative';
        const svc = this._reviewService(game, category, i);
        const msg = this._reviewText(category, rating, svc);
        this.feedbacks.unshift({ id: randId('fb'), date: day, author: this._pick(FEEDBACK_NAMES, day, `name${i}${this.feedbacks.length}`), rating, category, title: this._reviewTitle(category, rating), message: msg, sentiment: tone, status: 'new', responded: false, responseText: '', serviceName: svc?.name || '' });
    } this.feedbacks = this.feedbacks.slice(0, 160); this._recomputeDerived(); }
    _reviewService(game, _category, index) { const services = (game.scheduleCreator?.getActiveServices?.() || []); const pax = services.filter(v => String(rec(v).serviceType || '').toLowerCase() === 'passager'); if (!pax.length)
        return null; const raw = rec(pax[index % pax.length]); return { name: s(raw.name || rec(raw.train).name, 'mon train'), delay: n(rec(raw.train).delay, 0) }; }
    _reviewTitle(cat, rating) { if (rating === 5)
        return `${cat} : excellente expérience`; if (rating === 4)
        return `${cat} très satisfaisant`; if (rating === 3)
        return `${cat} correct, quelques détails à revoir`; if (rating === 2)
        return `${cat} décevant`; return `${cat} : grosse déception`; }
    _reviewText(cat, rating, svc) { const positive = rating >= 4, negative = rating <= 2; const train = svc?.name ? ` sur ${svc.name}` : ''; if (cat === 'Ponctualité') {
        if (positive)
            return `Trajet${train} fluide, départ bien tenu et arrivée sans mauvaise surprise. C’est exactement ce que j’attends du train.`;
        if (negative)
            return `Mon trajet${train} a accumulé du retard${svc && Math.abs(svc.delay) >= 5 ? ` (environ ${Math.round(Math.abs(svc.delay))} min)` : ''}. J’aurais aimé une prise en charge plus claire.`;
        return `Le trajet${train} s’est fait correctement, mais la régularité peut encore gagner en constance.`;
    } if (cat === 'Propreté')
        return positive ? 'Rame propre, tables et espaces communs bien tenus. Ça change vraiment la perception du voyage.' : negative ? 'La propreté de la rame m’a déçu, surtout dans les espaces communs.' : 'Ensemble correct côté propreté, avec encore quelques détails à améliorer.'; if (cat === 'Restauration')
        return positive ? `Bonne surprise au bar : ${this.catering.filter(x => x.active).length} références actives et un choix qui paraît enfin pensé pour plusieurs profils.` : negative ? 'La restauration manque encore de choix et le rapport qualité-prix ne m’a pas convaincu.' : 'La carte dépanne bien, mais j’aimerais davantage de choix et de produits réguliers.'; if (cat === 'Rapport qualité-prix')
        return positive ? 'Les offres sont lisibles et j’ai trouvé une formule adaptée sans devoir fouiller partout.' : negative ? 'Entre le prix et les services proposés, je n’ai pas vraiment senti la valeur ajoutée.' : 'Le tarif reste acceptable, mais les avantages pourraient être plus simples à comprendre.'; if (cat === 'Service client')
        return positive ? 'Retour rapide du service client et solution claire. Ça donne confiance.' : negative ? 'J’attends encore une réponse claire et une vraie prise en charge de mon problème.' : 'La réponse est correcte, mais pourrait être plus personnalisée.'; if (cat === 'Digital')
        return positive ? 'Le Wi-Fi et les informations temps réel rendent le trajet beaucoup plus simple.' : negative ? 'Les services numériques ne m’ont pas convaincu pendant ce trajet.' : 'Les services numériques sont utiles, mais pas encore indispensables.'; return positive ? 'Confort agréable et services cohérents pendant tout le trajet.' : negative ? 'Le niveau de confort n’était pas à la hauteur de ce que j’attendais.' : 'Voyage correct, mais l’expérience à bord peut encore progresser.'; }
    _dimensionLabel(k) { return { punctuality: 'Ponctualité', comfort: 'Confort', cleanliness: 'Propreté', catering: 'Restauration', value: 'Rapport qualité-prix', information: 'Information', customerCare: 'Service client', digital: 'Digital', brand: 'Image de marque', global: 'Satisfaction' }[k] || String(k); }
    _generatePress(day, game, forced = false) { this.syncFromGame(game); const g = this._liveSnapshot; if (g.totalPassengers <= 0)
        return; const score = clamp(Math.round(this.stats.satisfaction * .48 + g.punctuality * .20 + this.stats.awareness * .12 + this.stats.loyalty * .08 + this.stats.pressScore * .12 + (forced ? 4 : 0)), 25, 98); const tone = score >= 78 ? 'positive' : score >= 58 ? 'mixed' : 'negative'; const media = this._pick(PRESS_MEDIA, day, `press${this.pressReviews.length}`); const title = score >= 84 ? 'Une expérience voyageur qui devient une référence' : score >= 72 ? 'Rail Empire consolide son offre client' : score >= 58 ? 'Une stratégie commerciale ambitieuse, encore inégale' : 'L’expérience client reste le talon d’Achille'; const excerpt = score >= 78 ? `Avec ${fmt(g.totalPassengers)} voyageurs transportés et une ponctualité instantanée de ${pct(g.punctuality)}, la compagnie combine désormais offre à bord, fidélité et communication de manière cohérente.` : score >= 58 ? `La compagnie affiche ${fmt(g.totalPassengers)} voyageurs cumulés et multiplie les initiatives commerciales. La satisfaction (${this.stats.satisfaction}/100) progresse, mais certains irritants d’exploitation restent visibles.` : `Les investissements marketing sont visibles, mais un score de satisfaction de ${this.stats.satisfaction}/100 et une ponctualité de ${pct(g.punctuality)} montrent que la promesse client doit encore être mieux tenue.`; this.pressReviews.unshift({ id: randId('press'), date: day, media, title, excerpt, score, tone }); this.pressReviews = this.pressReviews.slice(0, 60); this._recomputeDerived(); }
    _tone(v) { return v >= 80 ? 'good' : v >= 60 ? 'mid' : 'bad'; }
    _renderPage() { const tab = this._tab; return `<div class="marketing-shell"><section class="marketing-hero"><div class="marketing-eyebrow">${icon('marketing', 18)} RAIL EMPIRE · EXPÉRIENCE CLIENT & MARKETING</div><div class="marketing-title"><div><h2>Marketing & expérience voyageurs</h2><p>Pilote les offres commerciales, les services à bord, la restauration, les campagnes, la publicité, la satisfaction, les retours clients et l’image presse. Les indicateurs ci-dessous sont recalculés à partir de ta partie.</p></div><div class="marketing-live">${icon('signal', 14)} ${fmt(this._liveSnapshot.totalPassengers)} voyageurs cumulés · ${this._liveSnapshot.livePassengerServices} train(s) voyageurs actif(s)</div></div><div class="marketing-grid-kpi">${this._kpi('Satisfaction', `${this.stats.satisfaction}/100`, `Base réelle RE : ${Math.round(this._liveSnapshot.passengerSatisfaction)}/100`, 'heart')}${this._kpi('Ponctualité', pct(this._liveSnapshot.punctuality), `Retard moyen ${fmt(this._liveSnapshot.avgDelay, 1)} min`, 'clock')}${this._kpi('Notoriété', `${this.stats.awareness}/100`, `${this.stats.activeCampaigns} campagne(s) active(s)`, 'megaphone')}${this._kpi('Fidélité', `${this.stats.loyalty}/100`, `Demande ×${this.stats.demandMultiplier.toFixed(2)}`, 'gift')}${this._kpi('Recettes annexes', euro(this.stats.onboardRevenueToday + this.stats.adRevenueToday), `Restauration + publicité · dernier jour`, 'money')}${this._kpi('Presse', `${this.stats.pressScore}/100`, `${this.pressReviews.length} article(s) conservé(s)`, 'newspaper')}</div></section>${this._renderTabs(tab)}${this._renderTab(tab)}</div>`; }
    _renderTabs(tab) { const items = [['overview', 'Vue générale', 'dashboard'], ['onboard', 'À bord & restauration', 'restaurant'], ['offers', 'Offres clients', 'ticket'], ['campaigns', 'Campagnes', 'megaphone'], ['ads', 'Publicité', 'ads'], ['satisfaction', 'Satisfaction', 'heart'], ['feedback', 'Avis clients', 'message'], ['press', 'Presse', 'newspaper']]; return `<nav class="marketing-tabs">${items.map(([id, label, ic]) => `<button class="${tab === id ? 'active' : ''}" data-mk-tab="${id}">${icon(ic, 15)} ${esc(label)}</button>`).join('')}</nav>`; }
    _renderTab(tab) { if (tab === 'onboard')
        return this._renderOnboard(); if (tab === 'offers')
        return this._renderOffers(); if (tab === 'campaigns')
        return this._renderCampaigns(); if (tab === 'ads')
        return this._renderAds(); if (tab === 'satisfaction')
        return this._renderSatisfaction(); if (tab === 'feedback')
        return this._renderFeedback(); if (tab === 'press')
        return this._renderPress(); return this._renderOverview(); }
    _renderOverview() { const g = this._liveSnapshot, d = this._dimensions; const alerts = []; if (g.punctuality < 70)
        alerts.push(['bad', 'Ponctualité dégradée', `Seulement ${pct(g.punctuality)} des trains voyageurs en mouvement sont à ±5 min.`]); if (g.cleanliness < 70)
        alerts.push(['bad', 'Propreté insuffisante', `Indice moyen des rames voyageurs : ${Math.round(g.cleanliness)}/100.`]); if (this.stats.replyRate < 60 && this.feedbacks.length)
        alerts.push(['mid', 'Retours clients en attente', `${Math.round(100 - this.stats.replyRate)} % des avis ne sont pas encore traités.`]); if (this.catering.filter(x => x.active).length < 6)
        alerts.push(['mid', 'Carte à bord courte', 'Active davantage de références pour améliorer le choix et le panier moyen.']); if (!alerts.length)
        alerts.push(['good', 'Expérience client maîtrisée', 'Aucun signal critique détecté dans les indicateurs actuels.']); return `<div class="marketing-sections"><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('chart', 18)} Indicateurs réels de la partie</h3><p class="marketing-sub">Ces valeurs viennent directement de l’économie, des circulations et des rames de ta sauvegarde.</p></div></div><div class="mk-stat-grid">${this._stat('Voyageurs transportés', fmt(g.totalPassengers), 'people')}${this._stat('Recettes billets', euro(g.totalTicketRevenue), 'ticket')}${this._stat('Services voyageurs', fmt(g.passengerServices), 'train')}${this._stat('Occupation live', pct(g.occupancy), 'people')}${this._stat('Propreté rames', `${Math.round(g.cleanliness)}/100`, 'sparkles')}${this._stat('Annulations constatées', fmt(g.cancelled), 'warning')}</div></section><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('target', 18)} Pilotage commercial</h3><p class="marketing-sub">Réglages globaux qui modifient la demande, la perception prix et les coûts de service.</p></div></div><div class="mk-settings">${this._select('farePolicy', 'Politique tarifaire', this.settings.farePolicy, [['éco', 'Éco / volume'], ['équilibrée', 'Équilibrée'], ['premium', 'Premium / valeur']])}${this._select('compensationPolicy', 'Compensation retard', this.settings.compensationPolicy, [['minimale', 'Minimale'], ['équilibrée', 'Équilibrée'], ['généreuse', 'Généreuse']])}${this._select('loyaltyProgram', 'Programme fidélité', this.settings.loyaltyProgram, [['aucun', 'Aucun'], ['simple', 'Rail Points'], ['premium', 'Premium / statuts']])}${this._select('brandPositioning', 'Positionnement marque', this.settings.brandPositioning, [['accessible', 'Accessible'], ['généraliste', 'Généraliste'], ['premium', 'Premium'], ['écologique', 'Écologique']])}${this._select('customerCare', 'Service client', this.settings.customerCare, [['standard', 'Standard'], ['renforcé', 'Renforcé'], ['excellence', 'Excellence']])}<label class="mk-toggle"><span><b>Communication environnementale</b><small>Valorise sobriété énergétique et report modal.</small></span><input type="checkbox" data-mk-setting="greenCommunication" ${this.settings.greenCommunication ? 'checked' : ''}></label></div><div class="mk-impact"><span>Tarif moyen ×<b>${this.stats.fareMultiplier.toFixed(2)}</b></span><span>Demande voyageurs ×<b>${this.stats.demandMultiplier.toFixed(2)}</b></span><span>Offres actives <b>${this.stats.activeOffers}</b></span><span>Services actifs <b>${this.stats.activeFeatures}</b></span></div></section><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('warning', 18)} Centre d’attention</h3><p class="marketing-sub">Priorités calculées depuis les métriques actuelles.</p></div></div><div class="mk-alerts">${alerts.map(a => `<article class="mk-alert ${a[0]}"><b>${esc(a[1])}</b><span>${esc(a[2])}</span></article>`).join('')}</div></section><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('money', 18)} Économie marketing — dernier jour</h3><p class="marketing-sub">Recettes et coûts réellement injectés dans l’économie de la partie au règlement journalier.</p></div></div><div class="mk-stat-grid">${this._stat('Voyageurs du jour', fmt(this.stats.dailyPassengers), 'people')}${this._stat('Restauration', euro(this.stats.onboardRevenueToday), 'restaurant')}${this._stat('Publicité', euro(this.stats.adRevenueToday), 'ads')}${this._stat('Coût produits', euro(this.stats.onboardCostToday), 'cargo')}${this._stat('Budget & services', euro(this.stats.marketingSpendToday), 'megaphone')}${this._stat('Résultat annexe', euro(this.stats.netMarketingToday), 'money')}</div></section></div>`; }
    _renderOnboard() { const activeFeatures = this.features.filter(x => x.active); const foods = this.catering; return `<div class="marketing-sections"><section class="marketing-panel wide"><div class="marketing-head"><div><h3>${icon('sparkles', 18)} Services et équipements à bord</h3><p class="marketing-sub">Chaque service a un coût par voyageur et agit sur satisfaction/demande.</p></div><div class="marketing-badges"><span class="mk-badge good">${activeFeatures.length} actifs</span><span class="mk-badge">Coût ${fmt(activeFeatures.reduce((z, x) => z + x.costPerPassenger, 0), 2)} €/voyageur</span></div></div><div class="mk-catalog">${this.features.map(f => `<article class="mk-card"><div class="mk-card-top"><div><b>${esc(f.name)}</b><div class="mk-mini">${esc(f.category)}</div></div><span class="mk-badge ${f.active ? 'good' : 'mid'}">${f.active ? 'Actif' : 'Inactif'}</span></div><p>${esc(f.description)}</p><div class="mk-meta"><span>${icon('money', 12)} ${fmt(f.costPerPassenger, 3)} €/voy.</span><span>${icon('heart', 12)} +${f.satisfactionBoost} sat.</span><span>${icon('people', 12)} +${f.demandBoost} demande</span></div><div class="mk-actions"><button data-mk-action="toggle-feature" data-id="${esc(f.id)}" class="${f.active ? 'warn' : 'good'}">${f.active ? 'Désactiver' : 'Activer'}</button></div></article>`).join('')}</div></section><section class="marketing-panel wide"><div class="marketing-head"><div><h3>${icon('restaurant', 18)} Carte de restauration à bord</h3><p class="marketing-sub">${foods.length} références disponibles. Prix, coût, qualité, sourcing et ventes du dernier jour sont gérés par produit.</p></div><div class="marketing-badges"><span class="mk-badge">${foods.filter(x => x.active).length} à la carte</span><span class="mk-badge">${foods.filter(x => x.bestseller).length} best-sellers</span></div></div><div class="mk-food-table">${foods.map(i => `<article class="mk-food-row"><div class="mk-food-name"><b>${esc(i.name)}</b><span>${esc(i.category)}${i.local ? ' · local' : ''}${i.vegetarian ? ' · végétarien' : ''}</span></div><label>Prix<input data-food-field="price" data-id="${esc(i.id)}" type="number" step="0.1" value="${i.price}"></label><label>Coût<input data-food-field="cost" data-id="${esc(i.id)}" type="number" step="0.1" value="${i.cost}"></label><label>Qualité<input data-food-field="quality" data-id="${esc(i.id)}" type="number" min="10" max="100" value="${i.quality}"></label><div class="mk-food-sales"><b>${i.salesToday}</b><span>ventes/j</span></div><div class="mk-actions"><button data-mk-action="save-food" data-id="${esc(i.id)}">Enregistrer</button><button data-mk-action="toggle-food" data-id="${esc(i.id)}" class="${i.active ? 'warn' : 'good'}">${i.active ? 'Retirer' : 'Activer'}</button><button data-mk-action="bestseller-food" data-id="${esc(i.id)}">${icon('star', 12, i.bestseller ? 'filled' : '')} Best-seller</button>${this._isDefaultFoodId(i.id) ? '' : `<button data-mk-action="delete-food" data-id="${esc(i.id)}" class="warn">Supprimer</button>`}</div></article>`).join('')}</div><details class="mk-add"><summary>+ Ajouter un produit personnalisé</summary><form class="mk-form" data-mk-form="food"><label><span>Nom</span><input name="name" required></label><label><span>Catégorie</span><input name="category" value="Snack"></label><label><span>Prix</span><input name="price" type="number" step="0.1" value="5"></label><label><span>Coût</span><input name="cost" type="number" step="0.1" value="2"></label><label><span>Qualité</span><input name="quality" type="number" min="10" max="100" value="80"></label><label class="mk-toggle"><span>Local</span><input type="checkbox" name="local"></label><label class="mk-toggle"><span>Végétarien</span><input type="checkbox" name="vegetarian"></label><div class="wide"><button type="submit">Ajouter</button></div></form></details></section></div>`; }
    _isDefaultOfferId(id) { return DEFAULT_OFFERS.some(x => stableId('offer', x.name) === id); }
    _isDefaultFoodId(id) { return DEFAULT_FOOD.some(x => stableId('food', x.name) === id); }
    _renderOffers() { return `<section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('ticket', 18)} Catalogue d’offres clients</h3><p class="marketing-sub">Tarifs, abonnements, fidélité, promotions et services commerciaux. Les offres actives alimentent réellement le multiplicateur de demande et, légèrement, le niveau tarifaire moyen.</p></div><div class="marketing-badges"><span class="mk-badge good">${this.stats.activeOffers} actives</span><span class="mk-badge">${this.offers.length} disponibles</span></div></div><div class="mk-catalog">${this.offers.map(o => `<article class="mk-card ${o.featured ? 'featured' : ''}"><div class="mk-card-top"><div><b>${esc(o.name)}</b><div class="mk-mini">${esc(o.type)} · ${esc(o.target)}</div></div><span class="mk-badge ${o.active ? 'good' : 'mid'}">${o.active ? 'Active' : 'Inactive'}</span></div><p>${esc(o.description)}</p><div class="mk-meta"><span>${icon('tag', 12)} tarif ${o.priceDeltaPct >= 0 ? '+' : ''}${o.priceDeltaPct}%</span><span>${icon('people', 12)} demande +${o.demandBoost}</span><span>${icon('heart', 12)} sat. +${o.satisfactionBoost}</span></div><div class="mk-actions"><button data-mk-action="toggle-offer" data-id="${esc(o.id)}" class="${o.active ? 'warn' : 'good'}">${o.active ? 'Désactiver' : 'Activer'}</button><button data-mk-action="duplicate-offer" data-id="${esc(o.id)}">Dupliquer</button>${this._isDefaultOfferId(o.id) ? '' : `<button data-mk-action="delete-offer" data-id="${esc(o.id)}" class="warn">Supprimer</button>`}</div></article>`).join('')}</div><details class="mk-add"><summary>+ Créer une offre personnalisée</summary><form class="mk-form" data-mk-form="offer"><label><span>Nom</span><input name="name" required></label><label><span>Type</span><select name="type">${offerTypes.map(x => `<option>${esc(x)}</option>`).join('')}</select></label><label><span>Cible</span><select name="target">${audiences.map(x => `<option>${esc(x)}</option>`).join('')}</select></label><label class="wide"><span>Description</span><input name="description" required></label><label><span>Écart tarif %</span><input name="priceDeltaPct" type="number" value="0" min="-50" max="50"></label><label><span>Boost demande</span><input name="demandBoost" type="number" value="5" min="-20" max="40"></label><label><span>Boost satisfaction</span><input name="satisfactionBoost" type="number" value="3" min="-10" max="20"></label><div class="wide"><button type="submit">Créer et activer</button></div></form></details></section>`; }
    _renderCampaigns() { return `<div class="marketing-sections"><section class="marketing-panel wide"><div class="marketing-head"><div><h3>${icon('megaphone', 18)} Campagnes actives & historiques</h3><p class="marketing-sub">Budgets débités chaque jour. Une campagne augmente notoriété, demande et parfois satisfaction.</p></div><span class="mk-badge">${euro(this.campaigns.filter(x => x.active).reduce((z, x) => z + x.budgetPerDay, 0))}/jour</span></div><div class="mk-catalog">${this.campaigns.map(c => `<article class="mk-card"><div class="mk-card-top"><div><b>${esc(c.name)}</b><div class="mk-mini">${esc(c.channel)} · ${esc(c.target)} · ${esc(c.objective)}</div></div><span class="mk-badge ${c.active ? 'good' : 'mid'}">${c.active ? `${c.daysRemaining} j` : 'Terminée'}</span></div><div class="mk-meta"><span>${euro(c.budgetPerDay)}/j</span><span>Notoriété +${c.awarenessGain}</span><span>Demande +${c.demandGain}</span><span>Satisfaction +${c.satisfactionGain}</span></div><div class="mk-actions"><button data-mk-action="${c.active ? 'stop-campaign' : 'restart-campaign'}" data-id="${esc(c.id)}" class="${c.active ? 'warn' : 'good'}">${c.active ? 'Arrêter' : 'Relancer'}</button></div></article>`).join('') || '<div class="mk-empty">Aucune campagne créée.</div>'}</div></section><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('target', 18)} Campagnes prêtes à lancer</h3><p class="marketing-sub">Modèles rapides avec budgets et objectifs préconfigurés.</p></div></div><div class="mk-preset-list">${CAMPAIGN_PRESETS.map((p, i) => `<button data-mk-action="preset-campaign" data-index="${i}"><b>${esc(p[0])}</b><span>${esc(p[1])} · ${esc(p[2])} · ${euro(p[4])}/j</span></button>`).join('')}</div></section><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('plus', 18)} Campagne personnalisée</h3></div></div><form class="mk-form" data-mk-form="campaign"><label><span>Nom</span><input name="name" required></label><label><span>Canal</span><select name="channel"><option>Digital</option><option>TV</option><option>Radio</option><option>Affichage</option><option>Presse</option><option>Social</option><option>Influence</option><option>CRM / E-mail</option><option>Partenariat</option></select></label><label><span>Cible</span><select name="target">${audiences.map(x => `<option>${esc(x)}</option>`).join('')}</select></label><label><span>Objectif</span><select name="objective"><option>Notoriété</option><option>Conversion</option><option>Acquisition</option><option>Rétention</option><option>Image de marque</option><option>Lancement offre</option></select></label><label><span>Budget/j (€)</span><input name="budgetPerDay" type="number" value="10000" min="500"></label><label><span>Durée (jours)</span><input name="durationDays" type="number" value="14" min="1" max="120"></label><label><span>Gain notoriété</span><input name="awarenessGain" type="number" value="5" min="1" max="25"></label><label><span>Gain demande</span><input name="demandGain" type="number" value="5" min="0" max="30"></label><label><span>Gain satisfaction</span><input name="satisfactionGain" type="number" value="1" min="0" max="10"></label><div class="wide"><button type="submit">Lancer</button></div></form></section></div>`; }
    _renderAds() { return `<section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('ads', 18)} Régie publicitaire</h3><p class="marketing-sub">Vends des emplacements à bord, en gare et sur les canaux digitaux. Les contrats actifs génèrent une recette quotidienne réelle.</p></div><div class="marketing-badges"><span class="mk-badge good">${euro(this.stats.adRevenueToday)}/jour</span><span class="mk-badge">${this.adSlots.filter(x => x.active).length} contrats</span></div></div><div class="mk-ad-grid">${this.adSlots.map(a => `<article class="mk-card"><div class="mk-card-top"><div><b>${esc(a.name)}</b><div class="mk-mini">${esc(a.placement)} · ${esc(a.format)}</div></div><span class="mk-badge ${a.active ? 'good' : 'mid'}">${a.active ? `${a.daysRemaining} j` : 'Disponible'}</span></div><label class="mk-inline-field">Annonceur<input data-ad-field="advertiser" data-id="${esc(a.id)}" value="${esc(a.advertiser)}" placeholder="Nom annonceur"></label><label class="mk-inline-field">Prix / jour<input data-ad-field="dailyPrice" data-id="${esc(a.id)}" type="number" value="${a.dailyPrice}"></label><label class="mk-inline-field">Durée<input data-ad-field="contractDays" data-id="${esc(a.id)}" type="number" value="${a.contractDays}" min="1" max="365"></label><div class="mk-actions"><button data-mk-action="save-ad" data-id="${esc(a.id)}">Enregistrer</button><button data-mk-action="toggle-ad" data-id="${esc(a.id)}" class="${a.active ? 'warn' : 'good'}">${a.active ? 'Résilier' : 'Signer le contrat'}</button></div></article>`).join('')}</div></section>`; }
    _renderSatisfaction() { const d = this._dimensions, g = this._liveSnapshot; const hist = this.history.slice(-20); return `<div class="marketing-sections"><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('heart', 18)} Satisfaction détaillée</h3><p class="marketing-sub">Score global ancré sur la satisfaction voyageur native de RE puis enrichi avec les dimensions marketing.</p></div><span class="mk-score-big ${this._tone(d.global)}">${d.global}/100</span></div><div class="mk-dimensions">${Object.entries(d).filter(([k]) => k !== 'global').map(([k, v]) => `<div><span>${esc(this._dimensionLabel(k))}</span><div class="mk-bar"><i style="width:${clamp(v, 0, 100)}%"></i></div><b>${v}</b></div>`).join('')}</div></section><section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('train', 18)} Ce qui vient réellement du jeu</h3></div></div><div class="mk-stat-grid">${this._stat('Satisfaction RE', `${Math.round(g.passengerSatisfaction)}/100`, 'heart')}${this._stat('Ponctualité', pct(g.punctuality), 'clock')}${this._stat('Retard moyen', `${fmt(g.avgDelay, 1)} min`, 'clock')}${this._stat('Propreté', `${Math.round(g.cleanliness)}/100`, 'sparkles')}${this._stat('Occupation', pct(g.occupancy), 'people')}${this._stat('Voyageurs cumulés', fmt(g.totalPassengers), 'people')}</div></section><section class="marketing-panel wide"><div class="marketing-head"><div><h3>${icon('chart', 18)} Historique marketing</h3><p class="marketing-sub">Les 20 derniers règlements journaliers conservés.</p></div></div>${hist.length ? `<div class="mk-history">${hist.map(h => `<article><span>${esc(h.date)}</span><div title="Satisfaction ${h.satisfaction}"><i style="height:${Math.max(4, h.satisfaction)}%"></i></div><b>${h.satisfaction}</b><small>${fmt(h.passengers)} voy.</small></article>`).join('')}</div>` : '<div class="mk-empty">L’historique se remplira au fil des journées de jeu.</div>'}</section></div>`; }
    _renderFeedback() { return `<section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('message', 18)} Avis & retours clients générés</h3><p class="marketing-sub">Les textes sont composés à partir des performances de la partie : retard, propreté, restauration, offres, numérique et prise en charge.</p></div><div class="marketing-badges"><span class="mk-badge">Moyenne ${this.stats.averageFeedback.toFixed(1)}/5</span><span class="mk-badge">Réponse ${Math.round(this.stats.replyRate)}%</span><button data-mk-action="generate-feedback">Générer un échantillon maintenant</button></div></div><div class="mk-review-list">${this.feedbacks.map(f => `<article class="mk-review"><div class="mk-review-title"><div><b>${esc(f.title)}</b><div class="mk-mini">${esc(f.author)} · ${esc(f.date)} · ${esc(f.category)}${f.serviceName ? ` · ${esc(f.serviceName)}` : ''}</div></div><div class="mk-rating" aria-label="${f.rating} sur 5">${Array.from({ length: 5 }, (_, i) => icon('star', 14, i < f.rating ? 'filled' : '')).join('')}</div></div><p>${esc(f.message)}</p>${f.responseText ? `<div class="mk-response"><b>Réponse compagnie</b><span>${esc(f.responseText)}</span></div>` : ''}<div class="mk-actions"><span class="mk-badge ${f.status === 'new' ? 'bad' : f.status === 'replied' ? 'mid' : 'good'}">${f.status === 'new' ? 'À traiter' : f.status === 'replied' ? 'Répondu' : 'Clôturé'}</span><button data-mk-action="reply-feedback" data-id="${esc(f.id)}" ${f.responded ? 'disabled' : ''}>Répondre</button><button data-mk-action="close-feedback" data-id="${esc(f.id)}">Clôturer</button></div></article>`).join('') || '<div class="mk-empty">Aucun avis pour le moment.</div>'}</div></section>`; }
    _renderPress() { return `<section class="marketing-panel"><div class="marketing-head"><div><h3>${icon('newspaper', 18)} Revue de presse</h3><p class="marketing-sub">La tonalité des articles dépend de la satisfaction, de la ponctualité, de la notoriété et du volume réel de voyageurs.</p></div><div class="marketing-badges"><span class="mk-badge">Score ${this.stats.pressScore}/100</span><button data-mk-action="press-trip">Organiser un voyage presse · 25 000 €</button></div></div><div class="mk-press-list">${this.pressReviews.map(p => `<article class="mk-press ${p.tone}"><div><span>${esc(p.media)} · ${esc(p.date)}</span><b>${esc(p.title)}</b><p>${esc(p.excerpt)}</p></div><strong>${p.score}/100</strong></article>`).join('') || '<div class="mk-empty">Aucun article publié pour le moment.</div>'}</div></section>`; }
    _kpi(label, value, small, ic) { return `<div class="marketing-kpi"><span class="label">${icon(ic, 16)} ${esc(label)}</span><b>${esc(value)}</b><small>${esc(small)}</small></div>`; }
    _stat(label, value, ic) { return `<div class="mk-stat"><span>${icon(ic, 15)} ${esc(label)}</span><b>${esc(value)}</b></div>`; }
    _select(key, label, value, opts) { return `<label class="mk-setting"><span>${esc(label)}</span><select data-mk-setting="${esc(key)}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`; }
    _bind(container, game) {
        container.querySelectorAll('[data-mk-tab]').forEach(el => el.addEventListener('click', () => { this._tab = (el.getAttribute('data-mk-tab') || 'overview'); this.render(container, game); }));
        container.querySelectorAll('[data-mk-setting]').forEach(el => el.addEventListener('change', () => { const node = el; const key = node.getAttribute('data-mk-setting'); if (!key)
            return; this.settings[key] = node instanceof HTMLInputElement && node.type === 'checkbox' ? node.checked : node.value; this.syncFromGame(game); game.saveState?.(); this.render(container, game); }));
        container.querySelector('[data-mk-form="food"]')?.addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.currentTarget); this.catering.unshift({ id: randId('food'), name: s(fd.get('name'), 'Produit'), category: s(fd.get('category'), 'Snack'), price: clamp(n(fd.get('price'), 5), .1, 100), cost: clamp(n(fd.get('cost'), 2), 0, 100), quality: clamp(Math.round(n(fd.get('quality'), 80)), 10, 100), local: !!fd.get('local'), vegetarian: !!fd.get('vegetarian'), active: true, bestseller: false, salesToday: 0 }); game.saveState?.(); this.render(container, game); });
        container.querySelector('[data-mk-form="offer"]')?.addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.currentTarget); this.offers.unshift({ id: randId('offer'), name: s(fd.get('name'), 'Offre'), type: (offerTypes.includes(s(fd.get('type'))) ? s(fd.get('type')) : 'tarif'), target: (audiences.includes(s(fd.get('target'))) ? s(fd.get('target')) : 'Tous'), description: s(fd.get('description'), 'Offre personnalisée.'), priceDeltaPct: clamp(n(fd.get('priceDeltaPct')), -50, 50), demandBoost: clamp(n(fd.get('demandBoost'), 5), -20, 40), satisfactionBoost: clamp(n(fd.get('satisfactionBoost'), 3), -10, 20), active: true, featured: false }); this._recomputeDerived(); game.saveState?.(); this.render(container, game); });
        container.querySelector('[data-mk-form="campaign"]')?.addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.currentTarget); this._addCampaign({ name: s(fd.get('name'), 'Campagne'), channel: s(fd.get('channel'), 'Digital'), target: s(fd.get('target'), 'Tous'), objective: s(fd.get('objective'), 'Notoriété'), budgetPerDay: n(fd.get('budgetPerDay'), 10000), durationDays: n(fd.get('durationDays'), 14), awarenessGain: n(fd.get('awarenessGain'), 5), demandGain: n(fd.get('demandGain'), 5), satisfactionGain: n(fd.get('satisfactionGain'), 1) }, dateText(game._currentDate)); game.saveState?.(); this.render(container, game); });
        container.querySelectorAll('[data-mk-action]').forEach(el => el.addEventListener('click', () => { const action = el.getAttribute('data-mk-action') || '', id = el.getAttribute('data-id') || ''; if (action === 'toggle-feature') {
            const x = this.features.find(v => v.id === id);
            if (x)
                x.active = !x.active;
        }
        else if (action === 'toggle-offer') {
            const x = this.offers.find(v => v.id === id);
            if (x)
                x.active = !x.active;
        }
        else if (action === 'duplicate-offer') {
            const x = this.offers.find(v => v.id === id);
            if (x)
                this.offers.unshift({ ...x, id: randId('offer'), name: `${x.name} — variante`, active: false, featured: false });
        }
        else if (action === 'delete-offer') {
            this.offers = this.offers.filter(v => v.id !== id);
        }
        else if (action === 'toggle-food') {
            const x = this.catering.find(v => v.id === id);
            if (x)
                x.active = !x.active;
        }
        else if (action === 'delete-food') {
            if (!this._isDefaultFoodId(id))
                this.catering = this.catering.filter(v => v.id !== id);
        }
        else if (action === 'bestseller-food') {
            const x = this.catering.find(v => v.id === id);
            if (x)
                x.bestseller = !x.bestseller;
        }
        else if (action === 'save-food') {
            const x = this.catering.find(v => v.id === id);
            if (x) {
                x.price = clamp(n(container.querySelector(`[data-food-field="price"][data-id="${CSS.escape(id)}"]`)?.value, x.price), .1, 100);
                x.cost = clamp(n(container.querySelector(`[data-food-field="cost"][data-id="${CSS.escape(id)}"]`)?.value, x.cost), 0, 100);
                x.quality = clamp(Math.round(n(container.querySelector(`[data-food-field="quality"][data-id="${CSS.escape(id)}"]`)?.value, x.quality)), 10, 100);
            }
        }
        else if (action === 'stop-campaign') {
            const x = this.campaigns.find(v => v.id === id);
            if (x)
                x.active = false;
        }
        else if (action === 'restart-campaign') {
            const x = this.campaigns.find(v => v.id === id);
            if (x) {
                x.active = true;
                x.daysRemaining = x.durationDays;
            }
        }
        else if (action === 'preset-campaign') {
            const idx = Math.max(0, Math.round(n(el.getAttribute('data-index'))));
            const p = CAMPAIGN_PRESETS[idx];
            if (p)
                this._addCampaign({ name: p[0], channel: p[1], target: p[2], objective: p[3], budgetPerDay: p[4], durationDays: p[5], awarenessGain: p[6], demandGain: p[7], satisfactionGain: p[8] }, dateText(game._currentDate));
        }
        else if (action === 'save-ad') {
            const x = this.adSlots.find(v => v.id === id);
            if (x) {
                x.advertiser = s(container.querySelector(`[data-ad-field="advertiser"][data-id="${CSS.escape(id)}"]`)?.value, x.advertiser);
                x.dailyPrice = clamp(n(container.querySelector(`[data-ad-field="dailyPrice"][data-id="${CSS.escape(id)}"]`)?.value, x.dailyPrice), 0, 1e7);
                x.contractDays = clamp(Math.round(n(container.querySelector(`[data-ad-field="contractDays"][data-id="${CSS.escape(id)}"]`)?.value, x.contractDays)), 1, 365);
                if (!x.active)
                    x.daysRemaining = x.contractDays;
            }
        }
        else if (action === 'toggle-ad') {
            const x = this.adSlots.find(v => v.id === id);
            if (x) {
                if (!x.active && !x.advertiser)
                    x.advertiser = 'Annonceur partenaire';
                x.active = !x.active;
                x.daysRemaining = x.contractDays;
            }
        }
        else if (action === 'generate-feedback') {
            this._generateFeedback(dateText(game._currentDate), game, 3);
        }
        else if (action === 'reply-feedback') {
            const x = this.feedbacks.find(v => v.id === id);
            if (x) {
                x.responded = true;
                x.status = x.rating >= 4 ? 'closed' : 'replied';
                x.responseText = this._companyReply(x);
            }
        }
        else if (action === 'close-feedback') {
            const x = this.feedbacks.find(v => v.id === id);
            if (x) {
                x.responded = true;
                x.status = 'closed';
                if (!x.responseText)
                    x.responseText = this._companyReply(x);
            }
        }
        else if (action === 'press-trip') {
            game.economy?.addExpense?.(25000, 'marketing', 'Opération presse');
            this._generatePress(dateText(game._currentDate), game, true);
        } this.syncFromGame(game); game.saveState?.(); this.render(container, game); }));
    }
    _addCampaign(v, day) { const duration = clamp(Math.round(n(v.durationDays, 14)), 1, 120); this.campaigns.unshift({ id: randId('campaign'), name: s(v.name, 'Campagne'), channel: s(v.channel, 'Digital'), target: (audiences.includes(s(v.target)) ? s(v.target) : 'Tous'), objective: s(v.objective, 'Notoriété'), budgetPerDay: clamp(Math.round(n(v.budgetPerDay, 10000)), 500, 2e6), durationDays: duration, daysRemaining: duration, awarenessGain: clamp(n(v.awarenessGain, 5), 1, 25), demandGain: clamp(n(v.demandGain, 5), 0, 30), satisfactionGain: clamp(n(v.satisfactionGain, 1), 0, 10), active: true, createdAt: day }); }
    _companyReply(f) { if (f.rating >= 4)
        return `Merci ${f.author}. Heureux que votre expérience vous ait satisfait. Votre retour sur ${f.category.toLowerCase()} est transmis aux équipes pour maintenir ce niveau de service.`; if (f.rating === 3)
        return `Merci ${f.author} pour ce retour détaillé. Nous avons bien identifié votre remarque sur ${f.category.toLowerCase()} et l’intégrons à notre suivi qualité.`; return `Bonjour ${f.author}, merci d’avoir pris le temps de nous écrire. Nous sommes désolés que ${f.category.toLowerCase()} n’ait pas été au niveau attendu. Votre retour est enregistré comme point prioritaire et sera suivi par nos équipes.`; }
    _normOffer(v) { const x = rec(v); return { id: s(x.id, randId('offer')), name: s(x.name, 'Offre'), type: (offerTypes.includes(s(x.type)) ? s(x.type) : 'tarif'), target: (audiences.includes(s(x.target)) ? s(x.target) : 'Tous'), description: s(x.description), priceDeltaPct: clamp(n(x.priceDeltaPct), -50, 50), demandBoost: clamp(n(x.demandBoost), -20, 40), satisfactionBoost: clamp(n(x.satisfactionBoost), -10, 20), active: b(x.active, true), featured: b(x.featured, false) }; }
    _normFood(v) { const x = rec(v); return { id: s(x.id, randId('food')), name: s(x.name, 'Produit'), category: s(x.category, 'Snack'), price: clamp(n(x.price, 5), .1, 100), cost: clamp(n(x.cost, 2), 0, 100), quality: clamp(Math.round(n(x.quality, 75)), 10, 100), local: b(x.local), vegetarian: b(x.vegetarian), active: b(x.active, true), bestseller: b(x.bestseller), salesToday: Math.max(0, Math.round(n(x.salesToday))) }; }
    _normFeature(v) { const x = rec(v); return { id: s(x.id, randId('feature')), name: s(x.name, 'Service'), category: s(x.category, 'Service'), description: s(x.description), costPerPassenger: clamp(n(x.costPerPassenger), 0, 20), satisfactionBoost: clamp(n(x.satisfactionBoost), 0, 20), demandBoost: clamp(n(x.demandBoost), 0, 20), active: b(x.active) }; }
    _normCampaign(v) { const x = rec(v), dur = clamp(Math.round(n(x.durationDays, 14)), 1, 120); return { id: s(x.id, randId('campaign')), name: s(x.name, 'Campagne'), channel: s(x.channel, 'Digital'), target: (audiences.includes(s(x.target)) ? s(x.target) : 'Tous'), objective: s(x.objective, 'Notoriété'), budgetPerDay: clamp(n(x.budgetPerDay, 10000), 500, 2e6), durationDays: dur, daysRemaining: clamp(Math.round(n(x.daysRemaining, dur)), 0, dur), awarenessGain: clamp(n(x.awarenessGain, 5), 1, 25), demandGain: clamp(n(x.demandGain, 5), 0, 30), satisfactionGain: clamp(n(x.satisfactionGain, 1), 0, 10), active: b(x.active, true), createdAt: s(x.createdAt) }; }
    _normAd(v) { const x = rec(v), days = clamp(Math.round(n(x.contractDays, 30)), 1, 365); return { id: s(x.id, randId('ad')), name: s(x.name, 'Emplacement'), placement: s(x.placement, 'À bord'), format: s(x.format, 'Display'), advertiser: s(x.advertiser), category: s(x.category, 'Display'), dailyPrice: clamp(n(x.dailyPrice, 1000), 0, 1e7), contractDays: days, daysRemaining: clamp(Math.round(n(x.daysRemaining, days)), 0, days), active: b(x.active, false) }; }
    _normFeedback(v) { const x = rec(v), rating = clamp(Math.round(n(x.rating, 4)), 1, 5); return { id: s(x.id, randId('fb')), date: s(x.date), author: s(x.author, 'Client'), rating, category: s(x.category, 'Confort'), title: s(x.title, 'Avis client'), message: s(x.message), sentiment: (['positive', 'mixed', 'negative'].includes(s(x.sentiment)) ? s(x.sentiment) : rating >= 4 ? 'positive' : rating === 3 ? 'mixed' : 'negative'), status: (['new', 'replied', 'closed'].includes(s(x.status)) ? s(x.status) : 'new'), responded: b(x.responded), responseText: s(x.responseText), serviceName: s(x.serviceName) }; }
    _normPress(v) { const x = rec(v), score = clamp(Math.round(n(x.score, 70)), 0, 100); return { id: s(x.id, randId('press')), date: s(x.date), media: s(x.media, 'Presse'), title: s(x.title, 'Article'), excerpt: s(x.excerpt), score, tone: (['positive', 'mixed', 'negative'].includes(s(x.tone)) ? s(x.tone) : score >= 75 ? 'positive' : score >= 58 ? 'mixed' : 'negative') }; }
    _normHistory(v) { const x = rec(v); return { date: s(x.date), passengers: Math.max(0, n(x.passengers)), satisfaction: clamp(n(x.satisfaction, 70), 0, 100), awareness: clamp(n(x.awareness, 50), 0, 100), loyalty: clamp(n(x.loyalty, 50), 0, 100), punctuality: clamp(n(x.punctuality, 100), 0, 100), cateringRevenue: Math.max(0, n(x.cateringRevenue)), adRevenue: Math.max(0, n(x.adRevenue)), spend: Math.max(0, n(x.spend)), net: n(x.net) }; }
}
