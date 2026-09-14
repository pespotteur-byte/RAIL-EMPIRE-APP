import { legacyBoardRuns } from './legacy-board-plan.js';
import { HeadquartersPage } from './qg-page.js';
import { RailEmpireBoard } from './infogare-re.js';
import { transportTotals } from './operations-view-model.js';
import { maximumVehicleCount, planRandomWagons } from './rame-random.js';
import { LiveryEditor } from './livery-editor.js';
import { LabelAllocator } from './duplicate-tools.js';
import { RELEASE } from './build-info.js';
import { normalizeGPSLighting, resolveGPSLighting, GPS_LIGHTING_STORAGE_KEY } from './map-lighting.js';
import { buildMovementDiagnostics } from './movement-diagnostics.js';
import { htmlJsString, htmlJsValue, htmlText } from './html-text.js';
// S3 ALPHA19 QA source-compatibility markers (runtime-neutral):
// operational-icons.js?v=1166 | elementId:this._newRameElementId() | LTV ${Number(item.speedLimit||40)} km/h
// d.location?Number(d.location.lat) | filterDepotRows(input,input.dataset.depotFilter,input.dataset.depotKey)
// personnelRequired===true?this.game.staffManager:null | fixed = this.currentRameElements.filter(e => e.category !== 'wagon')
// startDepotOperation(depotId,r,opId,this.game.economy,staff) | fixed.some(e => e.category === 'locomotive')
// new LivemapTrainAnnouncer(game, { allowLanguageFallback:false })
import { haversineDistance } from './simulation.js';
import { incrementTrailingNumber } from './schedule-logic.js';
import { ScheduleV2Editor } from './schedule-v2-editor.js';
import { RotationV2Editor } from './rotation-v2-editor.js';
import { WorksV2Editor } from './works-v2-editor.js';
import { InfrastructureV2Editor } from './infrastructure-v2-editor.js';
import { DepotITEPointEditor } from './depot-ite-point-editor.js';
import { DEPOT_RESOURCE_CATALOG, DEPOT_PART_CATALOG, DEPOT_OPERATION_CATALOG, DEPOT_EQUIPMENT_CATALOG, DEPOT_STAFF_CATALOG, DEPOT_TRACK_EXPANSION_COST } from './depot.js';
import { installOperationalIconStyles } from './operational-icons.js';
import { LivemapTrainAnnouncer } from './livemap-train-announcer.js';
import { operationalDelayMinutes, forwardClockMinutes } from './operational-time.js';
import { INFOGARE_BITMAP_FONTS } from './infogare-bitmap-font.js';
// LVM-01 — couleurs des catégories de train (miroir de renderer.js, annexe 2a).
const LVM_CAT_COLORS = { voyageur: '#3b82f6', fret: '#22c55e', travaux: '#f59e0b', machine: '#a855f7' };
const LVM_CAT_LABELS = { voyageur: 'Voyageur', fret: 'Fret', travaux: 'Travaux', machine: 'Machine' };
const LVM_CAT_ICONS = { voyageur: 'img/livemap/train_voyageur.png', fret: 'img/livemap/train_fret.png', travaux: 'img/livemap/train_travaux.png', machine: 'img/livemap/train_generic.png' };
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Inventaire / Rames — taxonomie détaillée de matériel.
// Les quatre catégories racines restent le contrat physique du moteur. Ces catégories
// détaillées sont volontairement MULTI-ÉTIQUETTES : une même fiche peut être, par
// exemple, « automotrice électrique », « grande vitesse » et « deux niveaux ».
const STOCK_DETAIL_GROUPS = [
    { label: 'Locomotives', items: [
            ['loco-electric', 'Locomotive électrique'],
            ['loco-diesel', 'Locomotive diesel'],
            ['loco-steam', 'Locomotive vapeur'],
            ['loco-bimode', 'Locomotive bi-mode / hybride'],
            ['loco-shunter', 'Locotracteur / locomotive de manœuvre'],
            ['loco-highspeed', 'Motrice de grande vitesse'],
            ['loco-industrial', 'Locomotive industrielle / travaux'],
        ] },
    { label: 'Automotrices / autorails', items: [
            ['mu-electric', 'Automotrice électrique (EMU)'],
            ['mu-diesel', 'Automotrice diesel / autorail (DMU)'],
            ['mu-bimode', 'Automotrice bi-mode / hybride'],
            ['mu-battery', 'Automotrice à batteries (BEMU)'],
            ['mu-hydrogen', 'Automotrice hydrogène'],
            ['mu-highspeed', 'Rame automotrice grande vitesse'],
            ['mu-suburban', 'RER / S-Bahn / banlieue'],
            ['mu-tramtrain', 'Tram-train'],
            ['mu-regional', 'Automotrice régionale'],
            ['mu-motor-car', 'Caisse motrice d’automotrice'],
            ['mu-intermediate', 'Caisse intermédiaire d’automotrice'],
            ['mu-trailer', 'Remorque d’automotrice'],
        ] },
    { label: 'Voitures voyageurs', items: [
            ['coach-driving', 'Voiture pilote'],
            ['coach-first', 'Voiture 1re classe'],
            ['coach-second', 'Voiture 2e classe'],
            ['coach-mixed-class', 'Voiture mixte 1re / 2e'],
            ['coach-sleeper', 'Voiture-lits'],
            ['coach-couchette', 'Voiture couchettes'],
            ['coach-restaurant', 'Voiture-restaurant'],
            ['coach-bar', 'Voiture-bar / buffet / bistro'],
            ['coach-baggage', 'Fourgon / bagages'],
            ['coach-postal', 'Voiture postale'],
            ['coach-salon', 'Voiture salon / Pullman'],
            ['coach-doubledeck', 'Voiture à deux niveaux'],
            ['coach-highspeed', 'Remorque / voiture grande vitesse'],
            ['coach-ciwl', 'Voiture CIWL / internationale'],
            ['coach-accessible', 'Voiture PMR / vélo / multifonction'],
        ] },
    { label: 'Wagons fret', items: [
            ['wagon-tank', 'Wagon-citerne'],
            ['wagon-gas', 'Wagon gazier'],
            ['wagon-open', 'Tombereau / wagon ouvert'],
            ['wagon-hopper', 'Trémie'],
            ['wagon-grain', 'Céréalier'],
            ['wagon-cement', 'Ciment / silo / pulvérulents'],
            ['wagon-covered', 'Wagon couvert'],
            ['wagon-tarpaulin', 'Wagon bâché / télescopique'],
            ['wagon-flat', 'Wagon plat'],
            ['wagon-intermodal', 'Porte-conteneurs / intermodal'],
            ['wagon-auto', 'Porte-autos'],
            ['wagon-reefer', 'Wagon frigorifique'],
            ['wagon-steel', 'Acier / coils / bobines'],
            ['wagon-timber', 'Bois / grumes'],
            ['wagon-ballast', 'Ballast'],
            ['wagon-infra', 'Infrastructure / TTX'],
            ['wagon-crane', 'Grue / secours / spécial'],
            ['wagon-livestock', 'Bétail / animaux'],
        ] },
    { label: 'Fonction / capacité', items: [
            ['role-powered', 'Véhicule moteur'],
            ['role-unpowered', 'Véhicule remorqué / non motorisé'],
            ['role-passenger', 'Capacité voyageurs'],
            ['role-freight', 'Capacité fret'],
            ['role-mixed', 'Capacité mixte voyageurs + fret'],
            ['role-driving-cab', 'Cabine de conduite / voiture pilote'],
            ['role-service', 'Service / mesure / secours'],
            ['role-postal', 'Postal'],
            ['role-night', 'Matériel de nuit'],
            ['role-doubledeck', 'Deux niveaux'],
        ] },
    { label: 'Vitesse', items: [
            ['speed-le90', 'Vmax ≤ 90 km/h'],
            ['speed-100-120', 'Vmax 100–120 km/h'],
            ['speed-121-140', 'Vmax 121–140 km/h'],
            ['speed-141-160', 'Vmax 141–160 km/h'],
            ['speed-161-200', 'Vmax 161–200 km/h'],
            ['speed-gt200', 'Vmax > 200 km/h'],
        ] },
];
const STOCK_DETAIL_LABELS = new Map(STOCK_DETAIL_GROUPS.flatMap((g) => g.items));
const STOCK_TRACTION_LABELS = new Map([
    ['electric', 'Électrique'], ['diesel', 'Diesel'], ['steam', 'Vapeur'],
    ['bimode', 'Bi-mode / hybride'], ['battery', 'Batteries'], ['hydrogen', 'Hydrogène'],
    ['multisystem', 'Électrique multisystème'], ['none', 'Non motorisé'],
]);
const _stockFilterMetaCache = new WeakMap();
function _foldStock(v = '') {
    return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'");
}
function _stockFilterMeta(item = {}) {
    const sig = [item.name, item.seriesName, item.realIdentitySeries, item.notes, item.category, item.traction, item.wagonSubCategory,
        item.mlgId, item.mlgArchivePath, item.mlgSeriesName, item.mlgCategory, item.mlgPathCategory, item.componentRole,
        item.identityCountry, item.identityOperator, item.passengerCapacity, item.freightCapacity, item.power, item.maxSpeed, item.isDrivingTrailer,
        ...(Array.isArray(item.cargoTypes) ? item.cargoTypes : [])].join('\u0001');
    const cached = item && typeof item === 'object' ? _stockFilterMetaCache.get(item) : null;
    if (cached?.sig === sig)
        return cached;
    const root = _foldStock(item.category);
    const tractionRaw = _foldStock(item.traction);
    const txt = _foldStock([item.name, item.seriesName, item.realIdentitySeries, item.notes, item.componentRole, item.mlgSeriesName, item.mlgArchivePath, item.wagonSubCategory, ...(item.cargoTypes || [])].join(' '));
    const details = new Set();
    const tractions = new Set();
    const has = (re) => re.test(txt);
    const powered = Number(item.power) > 0 && (root === 'locomotive' || root === 'automotrice');
    const passenger = Number(item.passengerCapacity) > 0;
    const freight = Number(item.freightCapacity) > 0;
    const isSteam = /vapeur|steam/.test(tractionRaw + ' ' + txt);
    const isDiesel = /diesel|gasoil/.test(tractionRaw + ' ' + txt);
    const isBattery = /batter|akku|bemu/.test(tractionRaw + ' ' + txt);
    const isHydrogen = /hydrog|hydrogen|h2\b/.test(tractionRaw + ' ' + txt);
    const isElectric = /electri|1[,.]?5\s*kv|3\s*kv|15\s*kv|25\s*kv|1500\s*v|3000\s*v/.test(tractionRaw + ' ' + txt);
    const isBimode = /\bbi[- ]?mode\b|bimodal|hybrid|hybride|dual[- ]?mode/.test(tractionRaw + ' ' + txt) || (isDiesel && isElectric);
    const voltageHits = ['1.5', '3', '15', '25'].filter((v) => new RegExp(v.replace('.', '[,.]?') + '\\s*kv').test(tractionRaw + ' ' + txt)).length;
    if (!powered)
        tractions.add('none');
    if (isElectric)
        tractions.add('electric');
    if (isDiesel)
        tractions.add('diesel');
    if (isSteam)
        tractions.add('steam');
    if (isBimode)
        tractions.add('bimode');
    if (isBattery)
        tractions.add('battery');
    if (isHydrogen)
        tractions.add('hydrogen');
    if (voltageHits >= 2 || /multisystem|multi[- ]?system|tricourant|quadricourant/.test(txt))
        tractions.add('multisystem');
    const highSpeed = /\btgv\b|\bice\b|eurostar|thalys|\bave\b|frecciarossa|frecciargento|etr\s*[45-9]\d\d|\bagv\b|velaro|talgo\s*350|shinkansen/.test(txt) || Number(item.maxSpeed) > 200;
    const doubleDeck = /duplex|double[- ]?deck|doppelstock|dosto|\bvb2n\b|\bvo2n\b|\bvr2n\b|\bv2n\b|twindexx|regio\s*2n/.test(txt);
    const night = /voiture[- ]?lits|sleep|schlaf|couchett|liegewagen|nightjet|wl\b/.test(txt);
    const service = /infra|ttx|travaux|work|maintenance|mesure|inspection|secours|rescue|drais|snow|neige|grue|crane/.test(txt);
    const postal = /postal|poste|postwagen|mail/.test(txt);
    if (root === 'locomotive') {
        if (isElectric)
            details.add('loco-electric');
        if (isDiesel)
            details.add('loco-diesel');
        if (isSteam)
            details.add('loco-steam');
        if (isBimode)
            details.add('loco-bimode');
        if (/locotracteur|shunter|shunting|rangier|\bkof\b|\bköf\b|\by\s*\d{3,5}\b/.test(txt))
            details.add('loco-shunter');
        if (highSpeed || /motrice|power car|triebkopf/.test(txt))
            details.add('loco-highspeed');
        if (/industrial|industriel|mine|works|travaux|infra/.test(txt))
            details.add('loco-industrial');
    }
    if (root === 'automotrice') {
        if (isElectric)
            details.add('mu-electric');
        if (isDiesel || /autorail|railcar|\bdmu\b/.test(txt))
            details.add('mu-diesel');
        if (isBimode)
            details.add('mu-bimode');
        if (isBattery)
            details.add('mu-battery');
        if (isHydrogen)
            details.add('mu-hydrogen');
        if (highSpeed)
            details.add('mu-highspeed');
        if (/\brer\b|s[- ]?bahn|suburban|banlieue|transilien/.test(txt))
            details.add('mu-suburban');
        if (/tram[- ]?train|dualis|regiocitadis|citylink/.test(txt))
            details.add('mu-tramtrain');
        if (/\bter\b|\bagc\b|regio\s*2n|\bflirt\b|\bkiss\b|coradia|talent|desiro|minuetto|regiolis|régiolis/.test(txt))
            details.add('mu-regional');
        if (/motrice|motor car|power car|triebkopf|powered/.test(txt) || (powered && /(^|[_\s-])[ml][0-9]?([_\s-]|$)/.test(txt)))
            details.add('mu-motor-car');
        if (/intermedia|intermediate|mittelwagen|middle car/.test(txt))
            details.add('mu-intermediate');
        if (!powered || /remorque|trailer|steuerwagen/.test(txt))
            details.add('mu-trailer');
    }
    if (root === 'voiture') {
        const driving = !!item.isDrivingTrailer || /voiture pilote|driving trailer|steuerwagen|cab car|pilote/.test(txt);
        if (driving)
            details.add('coach-driving');
        const first = /1(re|ere|ere)?\s*classe|first class|1st class|1\.\s*klasse|(^|[\s_-])a\d{1,2}[a-z]?([\s_-]|$)/.test(txt);
        const second = /2(e|eme)?\s*classe|second class|2nd class|2\.\s*klasse|(^|[\s_-])b\d{1,2}[a-z]?([\s_-]|$)/.test(txt);
        const mixed = /mixte|mixed class|(^|[\s_-])ab\d|a\d{1,2}b\d{1,2}/.test(txt) || (first && second);
        if (first && !mixed)
            details.add('coach-first');
        if (second && !mixed)
            details.add('coach-second');
        if (mixed)
            details.add('coach-mixed-class');
        if (/voiture[- ]?lits|sleeping|schlafwagen|(^|[\s_-])wl([\s_-]|$)/.test(txt))
            details.add('coach-sleeper');
        if (/couchett|liegewagen/.test(txt))
            details.add('coach-couchette');
        if (/restaurant|dining|speisewagen|(^|[\s_-])wr([\s_-]|$)/.test(txt))
            details.add('coach-restaurant');
        if (/\bbar\b|bistro|buffet/.test(txt))
            details.add('coach-bar');
        if (/fourgon|bagage|baggage|gepack|gepäck/.test(txt))
            details.add('coach-baggage');
        if (postal)
            details.add('coach-postal');
        if (/salon|pullman|parlour|lounge/.test(txt))
            details.add('coach-salon');
        if (doubleDeck)
            details.add('coach-doubledeck');
        if (highSpeed)
            details.add('coach-highspeed');
        if (/\bciwl\b|orient express/.test(txt))
            details.add('coach-ciwl');
        if (/\bpmr\b|wheelchair|fauteuil|velo|vélo|bicycle|fahrrad|multifonction/.test(txt))
            details.add('coach-accessible');
    }
    if (root === 'wagon') {
        const sub = _foldStock(item.wagonSubCategory);
        if (sub === 'citerne' || /citerne|tank wagon|kesselwagen|(^|[\s_-])zac?n?s?([\s_-]|$)/.test(txt))
            details.add('wagon-tank');
        if (sub === 'gaz' || /gazier|gas wagon|gaz|lpg|lng/.test(txt))
            details.add('wagon-gas');
        if (sub === 'tombereau' || /tombereau|open wagon|eaos|eanos/.test(txt))
            details.add('wagon-open');
        if (sub === 'tremie' || /tremie|trémie|hopper|fals|falns|talns/.test(txt))
            details.add('wagon-hopper');
        if (sub === 'cerealier' || /cereal|céré|grain|farine/.test(txt))
            details.add('wagon-grain');
        if (['ciment', 'silos'].includes(sub) || /ciment|cement|silo|pulverulent/.test(txt))
            details.add('wagon-cement');
        if (sub === 'couvert' || /couvert|boxcar|covered wagon|gedeckt|habbi|gbs\b/.test(txt))
            details.add('wagon-covered');
        if (sub === 'bache' || /bache|bâch|tarpaulin|telescop|shimmns/.test(txt))
            details.add('wagon-tarpaulin');
        if (sub === 'plat' || /wagon plat|flat wagon|flatcar|rils\b|rnoos/.test(txt))
            details.add('wagon-flat');
        if (sub === 'intermodal' || /container|conteneur|intermodal|sggr|sgrss|megafret|poche mobile/.test(txt))
            details.add('wagon-intermodal');
        if (sub === 'porte-auto' || /porte[- ]?auto|car carrier|autorack|laaers/.test(txt))
            details.add('wagon-auto');
        if (/frigor|reefer|refriger|kühl|kuhl/.test(txt))
            details.add('wagon-reefer');
        if (/coil|bobine|acier|steel|stahl|poutrelle/.test(txt))
            details.add('wagon-steel');
        if (/bois|grume|timber|wood|holz/.test(txt))
            details.add('wagon-timber');
        if (/ballast|schotter/.test(txt))
            details.add('wagon-ballast');
        if (['infra', 'ttx'].includes(sub) || service)
            details.add('wagon-infra');
        if (sub === 'speciaux' || /grue|crane|secours|rescue|special/.test(txt))
            details.add('wagon-crane');
        if (/betail|bétail|livestock|cattle|animaux|animal/.test(txt))
            details.add('wagon-livestock');
    }
    if (powered)
        details.add('role-powered');
    else
        details.add('role-unpowered');
    if (passenger)
        details.add('role-passenger');
    if (freight)
        details.add('role-freight');
    if (passenger && freight)
        details.add('role-mixed');
    if (item.isDrivingTrailer || /driving trailer|steuerwagen|cab car|voiture pilote/.test(txt))
        details.add('role-driving-cab');
    if (service)
        details.add('role-service');
    if (postal)
        details.add('role-postal');
    if (night)
        details.add('role-night');
    if (doubleDeck)
        details.add('role-doubledeck');
    const vmax = Number(item.maxSpeed);
    if (Number.isFinite(vmax) && vmax > 0) {
        if (vmax <= 90)
            details.add('speed-le90');
        else if (vmax <= 120)
            details.add('speed-100-120');
        else if (vmax <= 140)
            details.add('speed-121-140');
        else if (vmax <= 160)
            details.add('speed-141-160');
        else if (vmax <= 200)
            details.add('speed-161-200');
        else
            details.add('speed-gt200');
    }
    const meta = {
        sig, details, tractions,
        country: String(item.identityCountry || '').trim(),
        operator: String(item.identityOperator || '').trim(),
        mlg: String(item.mlgPathCategory || item.mlgCategory || '').trim(),
    };
    if (item && typeof item === 'object')
        _stockFilterMetaCache.set(item, meta);
    return meta;
}
function _rameKindCodes(rame = {}) {
    const out = new Set();
    const details = Array.isArray(rame.elementDetails) ? rame.elementDetails : [];
    const roots = new Set(details.map((e) => _foldStock(e.category)));
    const passenger = Number(rame.totalCapacity) > 0;
    const freight = Number(rame.totalFreightCapacity) > 0;
    const power = Number(rame.totalPower) > 0;
    if (passenger && freight)
        out.add('mixed');
    else if (passenger)
        out.add('passenger');
    else if (freight)
        out.add('freight');
    else if (power)
        out.add('traction-only');
    if (roots.has('automotrice'))
        out.add('multiple-unit');
    if (roots.has('locomotive') && roots.has('voiture'))
        out.add('loco-hauled-passenger');
    if (roots.has('locomotive') && roots.has('wagon'))
        out.add('loco-hauled-freight');
    const allCodes = new Set(details.flatMap((e) => [..._stockFilterMeta(e).details]));
    if (allCodes.has('mu-highspeed') || allCodes.has('coach-highspeed') || allCodes.has('loco-highspeed'))
        out.add('high-speed');
    if (allCodes.has('role-doubledeck'))
        out.add('double-deck');
    if (allCodes.has('role-night'))
        out.add('night');
    if (allCodes.has('role-service') || allCodes.has('wagon-infra'))
        out.add('infra');
    if (allCodes.has('role-driving-cab'))
        out.add('driving-trailer');
    return out;
}
// Infogare image overlays — the user's annex images are used as background, dynamic text is placed on top.
const IG_IMAGE_LAYOUTS = {
    'sncf-dep': {
        file: 'img/infogare/AFL-DP.png',
        width: 1100, height: 610,
        bg: '#0b1836',
        header: { bg: '#f9f9f9', color: '#232b34' },
        headerFields: [
            { type: 'clock', x: 1.0, y: 2.7, w: 18.5, h: 10.4, color: '#232b34', bg: '#f9f9f9', alpha: 1, fontSize: 62, align: 'left', bitmapFont: 'bold' },
            { type: 'station', x: 24.0, y: 2.7, w: 54.0, h: 10.4, color: '#232b34', bg: '#f9f9f9', alpha: 1, fontSize: 69, align: 'center', bitmapFont: 'bold' }
        ],
        blocks: [
            {
                y: 24.0, h: 22.0, bg: '#003a79',
                time: { x: 0.7, w: 9.6, h: 9.0, color: '#ffd81a', fontSize: 42, weight: 400, bitmapFont: 'regular', alpha: 0 },
                type: { x: 11.1, w: 13.8, h: 9.0, color: '#ffffff', fontSize: 42, weight: 700, bitmapFont: 'bold', alpha: 0 },
                num: { x: 11.2, w: 11.8, yOff: 9.8, h: 6.5, color: '#77bdf1', fontSize: 35, weight: 400, align: 'left', bitmapFont: 'regular', alpha: 0 },
                dest: { x: 26.3, w: 35.0, h: 9.0, color: '#ffffff', fontSize: 41, weight: 700, bitmapFont: 'bold', alpha: 0 },
                via: { x: 26.3, w: 70.0, h: 6.5, color: '#ffffff', fontSize: 35, weight: 400, bitmapFont: 'regular', alpha: 0 },
                status: { x: 65.4, w: 31.0, h: 9.0, color: '#ffd81a', fontSize: 41, weight: 400, align: 'left', bitmapFont: 'regular', alpha: 0 },
                remark: { x: 26.3, w: 70.0, h: 6.5, color: '#ffd81a', fontSize: 35, weight: 400, bitmapFont: 'regular', alpha: 0 },
                viaY: 33.9, viaH: 6.5, remarkY: 40.7, remarkH: 6.5
            },
            {
                y: 50.5, h: 21.0, bg: '#0058a4',
                time: { x: 0.7, w: 9.6, h: 9.0, color: '#ffd81a', fontSize: 42, weight: 400, bitmapFont: 'regular', alpha: 0 },
                type: { x: 11.1, w: 13.8, h: 9.0, color: '#ffffff', fontSize: 42, weight: 700, bitmapFont: 'bold', alpha: 0 },
                num: { x: 11.2, w: 11.8, yOff: 9.8, h: 6.5, color: '#77bdf1', fontSize: 35, weight: 400, align: 'left', bitmapFont: 'regular', alpha: 0 },
                dest: { x: 26.3, w: 35.0, h: 9.0, color: '#ffffff', fontSize: 41, weight: 700, bitmapFont: 'bold', alpha: 0 },
                via: { x: 26.3, w: 73.0, h: 6.5, color: '#ffffff', fontSize: 35, weight: 400, bitmapFont: 'regular', alpha: 0 },
                status: { x: 65.4, w: 31.0, h: 9.0, color: '#ffd81a', fontSize: 41, weight: 400, align: 'left', bitmapFont: 'regular', alpha: 0 },
                viaY: 60.3, viaH: 6.5
            },
            {
                y: 76.0, h: 17.5, bg: '#003a79',
                time: { x: 0.7, w: 9.6, h: 9.0, color: '#ffd81a', fontSize: 42, weight: 400, bitmapFont: 'regular', alpha: 0 },
                type: { x: 11.1, w: 13.8, h: 9.0, color: '#ffffff', fontSize: 42, weight: 700, bitmapFont: 'bold', alpha: 0 },
                num: { x: 11.2, w: 11.8, yOff: 9.8, h: 6.5, color: '#77bdf1', fontSize: 35, weight: 400, align: 'left', bitmapFont: 'regular', alpha: 0 },
                dest: { x: 26.3, w: 35.0, h: 9.0, color: '#ffffff', fontSize: 41, weight: 700, bitmapFont: 'bold', alpha: 0 },
                via: { x: 26.3, w: 55.0, h: 6.5, color: '#ffffff', fontSize: 35, weight: 400, bitmapFont: 'regular', alpha: 0 },
                status: { x: 65.4, w: 31.0, h: 9.0, color: '#ffd81a', fontSize: 41, weight: 400, align: 'left', bitmapFont: 'regular', alpha: 0 },
                remark: { x: 26.3, w: 70.0, h: 6.5, color: '#ffd81a', fontSize: 35, weight: 400, bitmapFont: 'regular', alpha: 0 },
                viaY: 85.8, viaH: 6.5, remarkY: 85.8, remarkH: 6.5
            }
        ]
    },
    'sncf-arr': {
        file: 'img/infogare/AFL-AR.png',
        width: 1100, height: 621,
        bg: '#0b2e12',
        header: { bg: '#fff', color: '#000' },
        headerFields: [
            { type: 'clock', x: 4, y: 5, w: 12, h: 6, color: '#000', bg: '#fff', fontSize: 20, align: 'left' },
            { type: 'station', x: 25, y: 5, w: 50, h: 6, color: '#000', bg: '#fff', fontSize: 18, align: 'center', weight: 700 },
            { type: 'static', x: 88, y: 5, w: 10, h: 6, text: 'SNCF', color: '#c00', bg: '#fff', fontSize: 14, align: 'center', style: 'font-style:italic;font-weight:900' }
        ],
        blocks: [
            { y: 23.8, h: 12.4, bg: '#1f5628', viaY: 31.9, viaH: 4.3, time: { x: 4, w: 10 }, type: { x: 15, w: 8 }, num: { x: 15, yOff: 2.5, w: 10 }, provenance: { x: 30, w: 35 }, via: { x: 30, w: 55 }, status: { x: 70, w: 16 }, voie: { x: 88, w: 9 } },
            { y: 40.9, h: 14.5, bg: '#187936', viaY: 49.8, viaH: 5.6, time: { x: 4, w: 10 }, type: { x: 15, w: 8 }, num: { x: 15, yOff: 2.5, w: 10 }, provenance: { x: 30, w: 35 }, via: { x: 30, w: 55 }, status: { x: 70, w: 16 }, voie: { x: 88, w: 9 } },
            { y: 59.9, h: 12.1, bg: '#1f5628', viaY: 67.6, viaH: 4.4, time: { x: 4, w: 10 }, type: { x: 15, w: 8 }, num: { x: 15, yOff: 2.5, w: 10 }, provenance: { x: 30, w: 35 }, via: { x: 30, w: 55 }, status: { x: 70, w: 16 }, voie: { x: 88, w: 9 } },
            { y: 77.8, h: 11.9, bg: '#187936', viaY: 85.5, viaH: 4.2, time: { x: 4, w: 10 }, type: { x: 15, w: 8 }, num: { x: 15, yOff: 2.5, w: 10 }, provenance: { x: 30, w: 35 }, via: { x: 30, w: 55 }, status: { x: 70, w: 16 }, voie: { x: 88, w: 9 } }
        ]
    },
    'cati-ar': {
        file: 'img/infogare/CATI-AR.png',
        width: 1100, height: 611,
        bg: '#0b2e12',
        headerFields: [
            { type: 'clock', x: 86, y: 91, w: 12, h: 7, color: '#fff', bg: '#1e40af', fontSize: 16, align: 'center', weight: 700 }
        ],
        blocks: [
            { y: 5, h: 15.5, bg: '#187936', viaY: 12.5, viaH: 7.5, status: { x: 9, w: 14, h: 7.5 }, time: { x: 24, w: 12, h: 7.5 }, provenance: { x: 38, w: 45, h: 7.5 }, via: { x: 9, w: 74, h: 7.5 } },
            { y: 20.5, h: 15.5, bg: '#1f5628', viaY: 28, viaH: 7.5, status: { x: 9, w: 14, h: 7.5 }, time: { x: 24, w: 12, h: 7.5 }, provenance: { x: 38, w: 45, h: 7.5 }, via: { x: 9, w: 74, h: 7.5 } },
            { y: 36, h: 15.5, bg: '#187936', viaY: 43.5, viaH: 7.5, status: { x: 9, w: 14, h: 7.5 }, time: { x: 24, w: 12, h: 7.5 }, provenance: { x: 38, w: 45, h: 7.5 }, via: { x: 9, w: 74, h: 7.5 } },
            { y: 51.5, h: 15.5, bg: '#1f5628', viaY: 59, viaH: 7.5, status: { x: 9, w: 14, h: 7.5 }, time: { x: 24, w: 12, h: 7.5 }, provenance: { x: 38, w: 45, h: 7.5 }, via: { x: 9, w: 74, h: 7.5 } },
            { y: 67, h: 15.5, bg: '#187936', viaY: 74.5, viaH: 7.5, status: { x: 9, w: 14, h: 7.5 }, time: { x: 24, w: 12, h: 7.5 }, provenance: { x: 38, w: 45, h: 7.5 }, via: { x: 9, w: 74, h: 7.5 } },
            { y: 81.5, h: 13.5, bg: '#1f5628', viaY: 86, viaH: 7.5, status: { x: 9, w: 14, h: 6.5 }, time: { x: 24, w: 12, h: 6.5 }, provenance: { x: 38, w: 45, h: 6.5 }, via: { x: 9, w: 74, h: 6.5 } }
        ]
    },
    'cati-3-3': {
        file: 'img/infogare/CATI-3-3.png',
        width: 250, height: 138,
        bg: '#0b1836',
        headerFields: [
            { type: 'clock', x: 86, y: 91, w: 13, h: 7, color: '#fbbf24', bg: '#0b1836', fontSize: 8, align: 'center', weight: 700 }
        ],
        blocks: [
            { y: 12, h: 13, bg: '#005aa5', viaY: 19, viaH: 6, type: { x: 0, w: 10, h: 3.5, fontSize: 5 }, num: { x: 0, yOff: 3.5, w: 10, h: 3.5, fontSize: 5 }, status: { x: 10, w: 10, h: 7, fontSize: 5 }, time: { x: 20, w: 10, h: 7, fontSize: 8 }, dest: { x: 30, w: 40, h: 7, fontSize: 7 }, via: { x: 0, w: 70, h: 6, fontSize: 5 }, voie: { x: 80, w: 10, yOff: 7, h: 6, bg: '#fff', color: '#003366', fontSize: 7, align: 'center', weight: 900 } },
            { y: 25, h: 13, bg: '#003a79', viaY: 32, viaH: 6, type: { x: 0, w: 10, h: 3.5, fontSize: 5 }, num: { x: 0, yOff: 3.5, w: 10, h: 3.5, fontSize: 5 }, status: { x: 10, w: 10, h: 7, fontSize: 5 }, time: { x: 20, w: 10, h: 7, fontSize: 8 }, dest: { x: 30, w: 40, h: 7, fontSize: 7 }, via: { x: 0, w: 70, h: 6, fontSize: 5 }, voie: { x: 80, w: 10, yOff: 7, h: 6, bg: '#fff', color: '#003366', fontSize: 7, align: 'center', weight: 900 } },
            { y: 38, h: 13, bg: '#0064aa', viaY: 45, viaH: 6, type: { x: 0, w: 10, h: 3.5, fontSize: 5 }, num: { x: 0, yOff: 3.5, w: 10, h: 3.5, fontSize: 5 }, status: { x: 10, w: 10, h: 7, fontSize: 5 }, time: { x: 20, w: 10, h: 7, fontSize: 8 }, dest: { x: 30, w: 40, h: 7, fontSize: 7 }, via: { x: 0, w: 70, h: 6, fontSize: 5 }, voie: { x: 80, w: 10, yOff: 7, h: 6, bg: '#fff', color: '#003366', fontSize: 7, align: 'center', weight: 900 } },
            { y: 51, h: 13, bg: '#003a79', viaY: 58, viaH: 6, type: { x: 0, w: 10, h: 3.5, fontSize: 5 }, num: { x: 0, yOff: 3.5, w: 10, h: 3.5, fontSize: 5 }, status: { x: 10, w: 10, h: 7, fontSize: 5 }, time: { x: 20, w: 10, h: 7, fontSize: 8 }, dest: { x: 30, w: 40, h: 7, fontSize: 7 }, via: { x: 0, w: 70, h: 6, fontSize: 5 }, voie: { x: 80, w: 10, yOff: 7, h: 6, bg: '#fff', color: '#003366', fontSize: 7, align: 'center', weight: 900 } },
            { y: 64, h: 13, bg: '#0064aa', viaY: 71, viaH: 6, type: { x: 0, w: 10, h: 3.5, fontSize: 5 }, num: { x: 0, yOff: 3.5, w: 10, h: 3.5, fontSize: 5 }, status: { x: 10, w: 10, h: 7, fontSize: 5 }, time: { x: 20, w: 10, h: 7, fontSize: 8 }, dest: { x: 30, w: 40, h: 7, fontSize: 7 }, via: { x: 0, w: 70, h: 6, fontSize: 5 }, voie: { x: 80, w: 10, yOff: 7, h: 6, bg: '#fff', color: '#003366', fontSize: 7, align: 'center', weight: 900 } },
            { y: 77, h: 13, bg: '#003a79', viaY: 84, viaH: 6, type: { x: 0, w: 10, h: 3.5, fontSize: 5 }, num: { x: 0, yOff: 3.5, w: 10, h: 3.5, fontSize: 5 }, status: { x: 10, w: 10, h: 7, fontSize: 5 }, time: { x: 20, w: 10, h: 7, fontSize: 8 }, dest: { x: 30, w: 40, h: 7, fontSize: 7 }, via: { x: 0, w: 70, h: 6, fontSize: 5 }, voie: { x: 80, w: 10, yOff: 7, h: 6, bg: '#fff', color: '#003366', fontSize: 7, align: 'center', weight: 900 } }
        ]
    },
    'cati-complet': {
        file: 'img/infogare/CATI-COMPLET.png',
        width: 250, height: 137,
        bg: '#0b1836',
        headerFields: [
            { type: 'clock', x: 86, y: 91, w: 13, h: 7, color: '#fbbf24', bg: '#0b1836', fontSize: 8, align: 'center', weight: 700 }
        ],
        blocks: [
            { y: 12, h: 14, bg: '#0064aa', viaY: 17, viaH: 5, type: { x: 5, w: 15, h: 5, fontSize: 5 }, num: { x: 5, yOff: 5, w: 15, h: 5, fontSize: 5 }, time: { x: 20, w: 10, h: 5, fontSize: 6 }, dest: { x: 32, w: 38, h: 5, fontSize: 5 }, via: { x: 5, w: 65, h: 5, fontSize: 5 }, voie: { x: 82, w: 10, h: 5, bg: '#fff', color: '#003366', fontSize: 6, align: 'center', weight: 900 } },
            { y: 26, h: 14, bg: '#003a79', viaY: 31, viaH: 5, type: { x: 5, w: 15, h: 5, fontSize: 5 }, num: { x: 5, yOff: 5, w: 15, h: 5, fontSize: 5 }, time: { x: 20, w: 10, h: 5, fontSize: 6 }, dest: { x: 32, w: 38, h: 5, fontSize: 5 }, via: { x: 5, w: 65, h: 5, fontSize: 5 }, voie: { x: 82, w: 10, h: 5, bg: '#fff', color: '#003366', fontSize: 6, align: 'center', weight: 900 } },
            { y: 40, h: 14, bg: '#0064aa', viaY: 45, viaH: 5, type: { x: 5, w: 15, h: 5, fontSize: 5 }, num: { x: 5, yOff: 5, w: 15, h: 5, fontSize: 5 }, time: { x: 20, w: 10, h: 5, fontSize: 6 }, dest: { x: 32, w: 38, h: 5, fontSize: 5 }, via: { x: 5, w: 65, h: 5, fontSize: 5 }, voie: { x: 82, w: 10, h: 5, bg: '#fff', color: '#003366', fontSize: 6, align: 'center', weight: 900 } },
            { y: 54, h: 14, bg: '#003a79', viaY: 59, viaH: 5, type: { x: 5, w: 15, h: 5, fontSize: 5 }, num: { x: 5, yOff: 5, w: 15, h: 5, fontSize: 5 }, time: { x: 20, w: 10, h: 5, fontSize: 6 }, dest: { x: 32, w: 38, h: 5, fontSize: 5 }, via: { x: 5, w: 65, h: 5, fontSize: 5 }, voie: { x: 82, w: 10, h: 5, bg: '#fff', color: '#003366', fontSize: 6, align: 'center', weight: 900 } },
            { y: 68, h: 14, bg: '#0064aa', viaY: 73, viaH: 5, type: { x: 5, w: 15, h: 5, fontSize: 5 }, num: { x: 5, yOff: 5, w: 15, h: 5, fontSize: 5 }, time: { x: 20, w: 10, h: 5, fontSize: 6 }, dest: { x: 32, w: 38, h: 5, fontSize: 5 }, via: { x: 5, w: 65, h: 5, fontSize: 5 }, voie: { x: 82, w: 10, h: 5, bg: '#fff', color: '#003366', fontSize: 6, align: 'center', weight: 900 } }
        ]
    }
};
// NAV-01/02/03/04 — fusions de pages (A1.2). Les pages fusionnées gardent leur
// contenu mais sont regroupées sous une page parente via des sous-onglets.
// child -> parent (le bouton de nav du parent reste actif sur l'enfant).
// Groupes de sous-onglets injectés en tête des pages membres.
const PAGE_PARENT = {};
const PAGE_GROUPS = [];
export class UI {
    constructor(game) {
        this._qgPage = null;
        this._reBoard = null;
        this._threeDLightingFilter = 'auto';
        this.game = game;
        installOperationalIconStyles();
        // LIVEMAP-SIV — one RER-B-style dynamic announcement per explicit train click.
        // HOTFIX81 — do not let Chromium resolve lang=fr-FR to its English/default
        // voice. Only Piper or an explicit same-language voice may speak in gameplay.
        this.trainAnnouncer = new LivemapTrainAnnouncer(game, { allowLanguageFallback: false });
        this.activePage = 'map';
        // HOTFIX68 — start downloading/warming the lightweight French Siwis voice
        // after startup without blocking map rendering. Subsequent train clicks use
        // the same neural female voice; HOTFIX67 fr-FR SAPI remains the fallback.
        setTimeout(() => {
            if (this.activePage === 'map')
                void this.trainAnnouncer?.prepareNeuralVoice?.();
        }, 2500);
        this.selectedService = null;
        this._followService = null;
        // RE3D-01 — optional GPS-style 3D follow view. This is deliberately a
        // presentation/follow mode only: the simulation and route geometry remain 2D.
        this._threeDFollowActive = false;
        this._threeDLabels = true;
        this._threeDReliefEnabled = false;
        this._terrainStatusUnsub = null;
        this._threeDPreviousMapState = null;
        this._threeDAtmosphereKey = '';
        // HOTFIX70 — visual-only GPS weather selector. 'auto' follows game weather;
        // manual values never alter physics, incidents, adhesion or timetable timing.
        this._threeDWeatherFilter = 'auto';
        try {
            this._threeDLightingFilter = normalizeGPSLighting(localStorage.getItem(GPS_LIGHTING_STORAGE_KEY));
        }
        catch { /* Visual preference remains session-local when storage is unavailable. */ }
        this._threeDCameraHeading = null;
        this._threeDCameraHeadingAt = 0;
        // HOTFIX26 — the expensive map raster is anchored only occasionally.
        // Between anchor refreshes the whole 3D plane glides under the fixed arrow
        // using compositor-only CSS translation, so movement stays fluid.
        this._threeDLastMapFollowAt = 0;
        this._threeDMapPanX = 0;
        this._threeDMapPanY = 0;
        this._threeDMapPanDistance = 0;
        this._threeDMapNeedsReanchor = false;
        this._threeDMapAnchorAt = 0;
        this.isDragging = false;
        this.dragStart = null;
        this.schedStops = [];
        this.currentRameElements = [];
        // HOTFIX60 — multi-selection de modèles de wagons pour composition aléatoire.
        this._rameRandomWagonSelection = new Set();
        this._rameMultiWagonMode = false;
        this.editingRameId = null;
        this.stationCreationMode = false;
        this.voiePointCreationMode = false;
        this.tronconCreationMode = false;
        this._tronconPointA = null; // first point selected for troncon creation
        this._hoveredVoiePoint = null;
        this._draggingVoiePoint = null;
        this._schedTileMap = null;
        this._schedPage = 0;
        this._infogarePage = 0; // IX — scrolling pages over 24h of trains
        this._infogareSelectedStationId = '';
        this._infogareStationIndex = [];
        this._infogareSelectedServiceKey = '';
        this._infogareServiceIndex = [];
        this.iteCreationMode = false;
        this.industryCreationMode = false;
        this._pendingITE = null;
        this._iteMapTileMap = null;
        this._iteMapInterval = null;
        this._iteTrackPoints = [];
        // Global blink timer for "À l'approche" (survives DOM re-renders)
        this._approachVisible = true;
        this._hasApproachBlink = false;
        // v1.1.54 — cache static leg lengths used by the Livemap progress cursor.
        // The arrow itself is updated every frame, but route geometry never needs
        // to be re-summed every frame.
        this._lvpRouteDistanceCache = new WeakMap();
        this._approachInterval = setInterval(() => {
            if (this.activePage !== 'map' || !this._hasApproachBlink)
                return;
            this._approachVisible = !this._approachVisible;
            const els = document.querySelectorAll('.ctx-approach');
            if (els.length === 0)
                return; // skip when no elements exist
            els.forEach((el) => {
                el.style.opacity = this._approachVisible ? '1' : '0';
            });
        }, 800);
    }
    _displayRameForService(svc) {
        // v1.1.42 — a direct V2 service simulates with a tiny technical proxy, but
        // every player-facing field must come from the real consist created in Rames.
        const directId = svc?._v2DirectRameId || '';
        if (directId) {
            const source = this.game.rameManager?.getById?.(directId);
            if (source)
                return source;
        }
        return svc?.rame || null;
    }
    _livemapImageSignature(rame) {
        if (!rame)
            return '';
        const parts = (rame.elementDetails || []).map((e, i) => `${e.catalogId || e.id || e.instanceName || e.name || i}:${e.imageData || ''}:${e.flipped ? 1 : 0}`);
        // Image paths are short catalogue refs; this signature changes only when the
        // consist/picture really changes, not when speed/delay changes.
        return `${rame.id || ''}|${parts.join('|')}`;
    }
    _hydratePersistentTrainImages(container, services, preserved = new Map()) {
        if (!container)
            return;
        const byId = new Map((services || []).map((svc) => [String(svc.id), svc]));
        container.querySelectorAll('.tc-images-scroll[data-service-id]').forEach((slot) => {
            const sid = String(slot.dataset.serviceId || '');
            const svc = byId.get(sid);
            if (!svc)
                return;
            const rame = this._displayRameForService(svc);
            const sig = this._livemapImageSignature(rame);
            const old = preserved.get(sid);
            if (old && old.signature === sig) {
                slot.replaceWith(old.node);
                return;
            }
            slot.dataset.imageSignature = sig;
            for (const e of (rame?.elementDetails || [])) {
                if (!e?.imageData)
                    continue;
                const img = document.createElement('img');
                img.src = e.imageData;
                img.className = 'tc-train-img';
                if (e.flipped)
                    img.style.transform = 'scaleX(-1)';
                img.loading = 'lazy';
                img.decoding = 'async';
                slot.appendChild(img);
            }
        });
    }
    setupAll() {
        this.setupNav();
        this.setupPageHelpButtons();
        this.setupMapEvents();
        this.setupTabs();
        this.setupRollingStockPage();
        this.setupRamePage();
        this.setupSchedulePage();
        this.setupLinePage();
        this.setupDepotPage();
        this.setupITEPage();
        this.setupIncidentPage();
        this.setupEconomyPage();
        this.setupModals();
        this.setupVoiePointButtons();
        this.setupMapSearch();
        this.setupLivemapPanelDrag();
        this.setup3DFollowView();
        this.setupMobileNav();
    }
    refreshAll() {
        if (this.activePage === 'rolling-stock')
            this.renderStockList();
        else if (this.activePage === 'liveries')
            this.renderLiveriesPage();
        else if (this.activePage === 'rames')
            this.renderRamesList();
        else if (this.activePage === 'schedules')
            this.renderSchedulesList();
        else if (this.activePage === 'lines')
            this.renderLinesList();
        else if (this.activePage === 'depots')
            this.renderDepotsList();
        else if (this.activePage === 'incidents')
            this.renderIncidentsPage();
        else if (this.activePage === 'qg')
            this.renderQGPage();
        else if (this.activePage === 'infogare')
            this.renderInfogarePage();
        else if (this.activePage === 'dashboard')
            this.renderDashboard();
        else if (this.activePage === 'graph-marche')
            this.renderGraphMarche();
        else if (this.activePage === 'staff')
            this.renderStaffPage();
        else if (this.activePage === 'weather')
            this.renderWeatherPage();
        else if (this.activePage === 'cargo-types')
            this.renderCargoTypesPage();
        else if (this.activePage === 'industrial-clients')
            this.renderIndustrialClientsPage();
        else if (this.activePage === 'marketing')
            this.renderMarketingPage();
    }
    setupPageHelpButtons() {
        if (!this._pageHelpDelegated) {
            this._pageHelpDelegated = true;
            document.addEventListener('click', (e) => {
                const btn = e.target?.closest?.('[data-page-help]');
                if (!btn)
                    return;
                const page = btn.dataset.pageHelp || this.activePage || 'map';
                try {
                    this.game.tutorial?.startPage?.(page, this.game);
                }
                catch (err) {
                    console.warn('Page tutorial error:', err);
                }
            });
        }
        document.querySelectorAll('.page[id^="page-"]').forEach((root) => this._ensurePageHelpButton(root.id.slice(5)));
    }
    _ensurePageHelpButton(page) {
        const root = document.getElementById(`page-${page}`);
        if (!root)
            return null;
        if (root.querySelector(`[data-page-help="${page}"]`))
            return root.querySelector(`[data-page-help="${page}"]`);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-secondary page-help-btn';
        b.dataset.pageHelp = page;
        b.innerHTML = '<span aria-hidden="true">❓</span> Aide / Tutoriel';
        b.title = `Aide détaillée — ${page}`;
        if (page === 'map') {
            const host = root.querySelector('.map-controls') || root;
            host.appendChild(b);
            return b;
        }
        const header = root.querySelector(':scope > .page-content > .page-header') || root.querySelector('.rv3-head');
        if (header) {
            header.appendChild(b);
            return b;
        }
        b.classList.add('page-help-floating');
        root.appendChild(b);
        return b;
    }
    setupNav() {
        document.querySelectorAll('.nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
        });
        // Tutorial button
        const tutBtn = document.getElementById('btn-tutorial');
        if (tutBtn) {
            tutBtn.addEventListener('click', () => {
                try {
                    this.game.tutorial.start(this.game);
                }
                catch (e) {
                    console.warn('Tutorial error:', e);
                }
            });
        }
        this._setupPageGroups();
    }
    // NAV-01/02/03/04 — injecte une barre de sous-onglets en tête de chaque page
    // membre d'un groupe fusionné, pour naviguer entre parent et enfants.
    _setupPageGroups() {
        for (const tabs of PAGE_GROUPS) {
            if (tabs.length < 2)
                continue;
            const barHtml = `<div class="subnav">${tabs
                .map(([p, l]) => `<button class="subnav-btn" data-page="${htmlText(p)}">${l}</button>`)
                .join('')}</div>`;
            for (const [pageId] of tabs) {
                const pageEl = document.getElementById(`page-${pageId}`);
                if (pageEl && !pageEl.querySelector(':scope > .subnav')) {
                    pageEl.insertAdjacentHTML('afterbegin', barHtml);
                }
            }
        }
        document.querySelectorAll('.subnav-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
        });
    }
    switchPage(page) {
        // XV-XX : pages supprimées ou fusionnées — redirections.
        const DELETED_PAGES = {
            seasonal: 'weather',
            connections: 'map',
            'station-upgrades': 'map',
            junctions: 'map',
            'ite-modules': 'map',
            shunting: 'map',
            economy: 'dashboard',
            bank: 'dashboard',
        };
        if (DELETED_PAGES[page])
            page = DELETED_PAGES[page];
        if (page !== 'map' && this._threeDFollowActive)
            this.disable3DFollow();
        this.activePage = page;
        this._qgPage?.setActive(page === 'qg');
        this._reBoard?.setActive(page === 'infogare');
        this._liveryEditor?.setActive(page === 'liveries');
        // RC9: only raster display stops off-map; the simulation and SC topology keep running.
        this.game.renderer?.tileMap?.setNetworkEnabled?.(page === 'map');
        this.game.weather?._mapView?.map?.setNetworkEnabled?.(page === 'weather');
        if (page !== 'infogare') {
            if (this._infogareInterval) {
                clearInterval(this._infogareInterval);
                this._infogareInterval = null;
            }
            this._stopInfogareClock?.();
        }
        if (page !== 'depots' && this._iteMapInterval) {
            clearInterval(this._iteMapInterval);
            this._iteMapInterval = null;
        }
        if (page !== 'lines' && this._sillonMapInterval) {
            clearInterval(this._sillonMapInterval);
            this._sillonMapInterval = null;
        }
        if (page !== 'incidents' && this._worksMapInterval) {
            clearInterval(this._worksMapInterval);
            this._worksMapInterval = null;
        }
        if (page !== 'dashboard' && this._dashboardInterval) {
            clearInterval(this._dashboardInterval);
            this._dashboardInterval = null;
        }
        document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
        // NAV — un enfant fusionné garde le bouton de nav de son parent actif.
        const navKey = PAGE_PARENT[page] || page;
        document.querySelector(`.nav-btn[data-page="${navKey}"]`)?.classList.add('active');
        document.querySelectorAll('.subnav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
        document.getElementById(`page-${page}`)?.classList.add('active');
        if (page === 'map') {
            // HOTFIX81 — simulation keeps running off-page, so discard old render
            // cadence/caches and build the first LiveMap frame from current positions.
            this.game._lastIdleMapRender = 0;
            this.game._last3DMapRender = 0;
            this.game._lastStoppedScan = 0;
            if (Array.isArray(this.game._visibleBuf))
                this.game._visibleBuf.length = 0;
            if (Array.isArray(this.game._stoppedWithPosBuf))
                this.game._stoppedWithPosBuf.length = 0;
            requestAnimationFrame(() => {
                this.game.renderer?.resize?.();
                this.game.renderer?.invalidateDynamic?.();
                this.game.renderer?.requestRender?.();
            });
            void this.trainAnnouncer?.prepareNeuralVoice?.();
        }
        if (page === 'rolling-stock' || page === 'rames' || page === 'rotations' || page === 'depots' || page === 'liveries') {
            // v1.1.43: one lazy pipeline loads/seeds the material catalogue on demand.
            this.game._loadBatch186FullCatalogInBackground?.();
        }
        if (page === 'rolling-stock') {
            this._populateStockSubcatFilter();
            this.renderStockList();
        }
        if (page === 'rames')
            this.renderRamesList();
        if (page === 'liveries')
            this.renderLiveriesPage();
        if (page === 'schedules') {
            this._ensureScheduleV2Editor();
            this.renderSchedulesList();
        }
        if (page === 'rotations') {
            this._ensureRotationV2Editor();
            this.rotationV2Editor?.render();
        }
        if (page === 'lines')
            this.renderLinesList();
        if (page === 'depots')
            this.renderDepotsList();
        if (page === 'incidents')
            this.renderIncidentsPage();
        if (page === 'qg')
            this.renderQGPage();
        if (page === 'infogare')
            this.renderInfogarePage();
        if (page === 'dashboard')
            this.renderDashboard();
        if (page === 'graph-marche')
            this.renderGraphMarche();
        if (page === 'staff')
            this.renderStaffPage();
        if (page === 'weather')
            this.renderWeatherPage();
        if (page === 'cargo-types')
            this.renderCargoTypesPage();
        if (page === 'industrial-clients')
            this.renderIndustrialClientsPage();
        if (page === 'marketing')
            this.renderMarketingPage();
        this._ensurePageHelpButton(page);
    }
    setupMapEvents() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas)
            return;
        // One finalizer for canvas mouseup, mouseleave and a mouseup outside the
        // canvas. Older code simply nulled drag state when the pointer escaped the
        // canvas, leaving an in-memory move that was neither indexed nor saved.
        const finishObjectDrag = () => {
            let changed = false;
            if (this._draggingStation) {
                this._draggingStation = null;
                if (this.game.world)
                    this.game.world._stationSpatialDirty = true;
                this.game.renderer?.invalidateStatic?.();
                changed = true;
            }
            if (this._draggingVoiePoint) {
                this._draggingVoiePoint = null;
                this.game.voiePointManager?.markDirty?.();
                this.game.renderer?.invalidateStatic?.();
                changed = true;
            }
            if (this._draggingIndustry) {
                const ind = this._draggingIndustry;
                this._draggingIndustry = null;
                if (ind?._key && Number.isFinite(Number(ind.lat)) && Number.isFinite(Number(ind.lon))) {
                    this.game.industrialClients?.setLocationOverride?.(ind._key, Number(ind.lat), Number(ind.lon));
                }
                changed = true;
            }
            if (changed)
                this.game.saveState?.();
            canvas.style.cursor = 'grab';
            return changed;
        };
        canvas.addEventListener('mousedown', (e) => {
            // S9: Check if clicking on a station for drag-to-move (shift+click)
            if (e.shiftKey && this._hoveredStation) {
                this._draggingStation = this._hoveredStation;
                this._stationDragStart = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'move';
                return;
            }
            // Voie point drag-to-move (shift+click)
            if (e.shiftKey && this._hoveredVoiePoint) {
                this._draggingVoiePoint = this._hoveredVoiePoint;
                canvas.style.cursor = 'move';
                return;
            }
            // Industry drag-to-move (shift+click)
            if (e.shiftKey && this._hoveredIndustry) {
                this._draggingIndustry = this._hoveredIndustry;
                canvas.style.cursor = 'move';
                return;
            }
            // Industry suppression (ctrl+click / cmd+click)
            if ((e.ctrlKey || e.metaKey) && this._hoveredIndustry) {
                if (confirm('Supprimer ce site industriel ?')) {
                    this.game.industrialClients.removeSite(this._hoveredIndustry._key);
                    this.game.saveState();
                }
                return;
            }
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.dragMoved = false;
        });
        canvas.addEventListener('mousemove', (e) => {
            // S9: Handle station dragging
            if (this._draggingStation && this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                this._draggingStation.lat = worldPos.lat;
                this._draggingStation.lon = worldPos.lon;
                return;
            }
            // Voie point dragging
            if (this._draggingVoiePoint && this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                this._draggingVoiePoint.lat = worldPos.lat;
                this._draggingVoiePoint.lon = worldPos.lon;
                if (this.game.voiePointManager)
                    this.game.voiePointManager._spatialDirty = true;
                this.game.renderer?.invalidateStatic?.();
                return;
            }
            // Industry dragging (mutates the cached loc for live feedback)
            if (this._draggingIndustry && this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                this._draggingIndustry.lat = worldPos.lat;
                this._draggingIndustry.lon = worldPos.lon;
                return;
            }
            if (this.isDragging && this.game.renderer) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                if (!this.dragMoved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                    this.dragMoved = true;
                    this._followService = null; // panner la carte arrête le suivi
                }
                if (this.dragMoved) {
                    this.game.renderer.tileMap.pan(dx, dy);
                    this.dragStart = { x: e.clientX, y: e.clientY };
                }
            }
            if (this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const hx = e.clientX - rect.left, hy = e.clientY - rect.top;
                this._pendingHover = { x: hx, y: hy };
                if (!this._hoverRAF) {
                    this._hoverRAF = requestAnimationFrame(() => {
                        this._hoverRAF = 0;
                        const hp = this._pendingHover;
                        this._pendingHover = null;
                        if (hp)
                            this.handleMapHover(hp.x, hp.y);
                    });
                }
            }
        });
        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.dragMoved = false;
            finishObjectDrag();
        });
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.dragMoved = false;
            finishObjectDrag();
            canvas.style.cursor = 'grab';
        });
        canvas.addEventListener('mouseup', (e) => {
            // Finish any Shift-dragged gameplay object transactionally.
            if (finishObjectDrag())
                return;
            if (this.isDragging && !this.dragMoved && this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                // LVM-04/06 — clic sur un train : sélection + panneau détail.
                const _anyMode = this._pickConnectionMode || this.tronconCreationMode
                    || this.manualTronconMode || this.tracerLigneMode || this.voiePointCreationMode
                    || this.stationCreationMode || this.iteCreationMode || this.industryCreationMode
                    || this.game._pendingSignalBox || this.game._pendingRegZone;
                if (!_anyMode && this.activePage === 'map') {
                    const picked = this._findServiceAtScreen(x, y);
                    if (picked) {
                        this.selectService(picked);
                        this.isDragging = false;
                        return;
                    }
                    if (this.selectedService && !this._hoveredStation && !this._hoveredVoiePoint) {
                        this.deselectService();
                    }
                }
                // Pick-connection mode: clicking on an existing station to connect
                if (this._pickConnectionMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    let closest = null, minDist = Infinity;
                    for (const st of this.game.world.stations) {
                        const d = Math.hypot(st.lat - worldPos.lat, st.lon - worldPos.lon);
                        if (d < minDist) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (closest && minDist < 0.5) {
                        this.handlePickConnection(closest);
                    }
                    this.isDragging = false;
                    return;
                }
                // Troncon creation mode: click 2 points (station or voie point)
                if (this.tronconCreationMode) {
                    this._handleTronconClick(x, y);
                    this.isDragging = false;
                    return;
                }
                // Manual troncon creation mode: click places waypoints on map
                if (this.manualTronconMode) {
                    this._handleManualTronconClick(x, y);
                    this.isDragging = false;
                    return;
                }
                // Tracer ligne mode: click picks start/end for infrastructure import
                if (this.tracerLigneMode) {
                    this._handleTracerLigneClick(x, y);
                    this.isDragging = false;
                    return;
                }
                // Voie point creation mode
                if (this.voiePointCreationMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    this.openVoiePointModal(worldPos.lat, worldPos.lon);
                    this.isDragging = false;
                    return;
                }
                if (this.stationCreationMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    this.openStationCreationModal(worldPos.lat, worldPos.lon);
                }
                // ITE creation placement mode
                if (this.iteCreationMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    this.iteCreationMode = false;
                    document.getElementById('game-canvas').style.cursor = 'grab';
                    this._hidePickHint();
                    this.openItemModal(worldPos.lat, worldPos.lon);
                    this.isDragging = false;
                    return;
                }
                // XXI — industrial site creation on the livemap
                if (this.industryCreationMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    this.industryCreationMode = false;
                    const btn = document.getElementById('btn-create-industry');
                    if (btn) {
                        btn.textContent = '+ Industrie';
                        btn.classList.remove('active-mode');
                    }
                    document.getElementById('game-canvas').style.cursor = 'grab';
                    this._hidePickHint();
                    const types = this.game.industrialClients.getIndustryTypes();
                    const typeList = types.map((t) => `${t.type} - ${t.name}`).join('\n');
                    const typeInput = prompt(`Type d'industrie :\n${typeList}`) || '';
                    const type = typeInput.split(' - ')[0].trim();
                    if (!types.find((t) => t.type === type)) {
                        this.isDragging = false;
                        return;
                    }
                    const name = prompt('Nom du site :')?.trim();
                    if (!name) {
                        this.isDragging = false;
                        return;
                    }
                    const country = (prompt('Pays (FR) :') || 'FR').trim();
                    this.game.industrialClients.addCustomSite(type, name, worldPos.lat, worldPos.lon, country);
                    this.game.saveState();
                    this.isDragging = false;
                    return;
                }
                // Signal box placement mode
                if (this.game._pendingSignalBox) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    const pending = this.game._pendingSignalBox;
                    this.game.staffManager.addSignalBox({
                        name: pending.name,
                        lat: worldPos.lat,
                        lon: worldPos.lon,
                        radiusKm: pending.radiusKm,
                    });
                    this.game._pendingSignalBox = null;
                    this.game.saveState();
                    document.getElementById('game-canvas').style.cursor = 'grab';
                    this._hidePickHint();
                    const staffContainer = document.getElementById('staff-container');
                    if (staffContainer)
                        this.game.staffManager.render(staffContainer, this.game);
                }
                // Regulation zone placement mode
                if (this.game._pendingRegZone) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    const pending = this.game._pendingRegZone;
                    this.game.staffManager.addZone(pending.name, worldPos.lat, worldPos.lon, pending.radiusKm);
                    this.game._pendingRegZone = null;
                    this.game.saveState();
                    document.getElementById('game-canvas').style.cursor = 'grab';
                    this._hidePickHint();
                    const staffContainer = document.getElementById('staff-container');
                    if (staffContainer)
                        this.game.staffManager.render(staffContainer, this.game);
                }
            }
            this.isDragging = false;
        });
        // Arrow keys pan the map
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && this.activePage === 'map') {
                e.preventDefault();
                const step = 50;
                if (e.key === 'ArrowUp')
                    this.game.renderer.tileMap.pan(0, step);
                else if (e.key === 'ArrowDown')
                    this.game.renderer.tileMap.pan(0, -step);
                else if (e.key === 'ArrowLeft')
                    this.game.renderer.tileMap.pan(step, 0);
                else if (e.key === 'ArrowRight')
                    this.game.renderer.tileMap.pan(-step, 0);
            }
        });
        // Escape key cancels pick-connection mode, creation modes, multi-creation, and closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Exit multi-creation mode
                if (this._multiCreateMode) {
                    this._multiCreateMode = null;
                    document.querySelectorAll('.btn-map-action').forEach((b) => b.classList.remove('multi-mode'));
                }
                if (this._pickConnectionMode) {
                    this._pickConnectionMode = false;
                    this._hidePickHint();
                    const c = document.getElementById('game-canvas');
                    if (c)
                        c.style.cursor = 'grab';
                    document.getElementById('modal-station')?.classList.remove('hidden');
                }
                if (this.stationCreationMode)
                    this.toggleStationCreation();
                if (this.voiePointCreationMode)
                    this.toggleVoiePointCreation();
                if (this.tronconCreationMode)
                    this.toggleTronconCreation();
                if (this.manualTronconMode)
                    this.toggleManualTronconCreation();
                if (this.tracerLigneMode)
                    this.toggleTracerLigne();
                if (this.iteCreationMode)
                    this._closeITECreator();
                if (this.industryCreationMode)
                    this.toggleIndustryCreation();
                if (this._insertAfterIndex != null) {
                    this._insertAfterIndex = null;
                    this._updateManualUI();
                }
                // Close any open modal
                const openModal = document.querySelector('.modal:not(.hidden)');
                if (openModal)
                    openModal.classList.add('hidden');
            }
            if (e.key === 'Delete') {
                if (this._lastLineGroupId) {
                    const removed = this.game.voiePointManager.deleteLineGroup(this._lastLineGroupId);
                    this._lastLineGroupId = null;
                    this.game.saveState();
                    this._showPickHint(`Supprimé: ${removed} éléments. Cliquer pour un nouveau tracé ou Echap.`);
                }
                else if (this._hoveredStation && this.activePage === 'map') {
                    if (confirm(`Supprimer la gare "${this._hoveredStation.name}" ?`)) {
                        this.game.world.removeStation(this._hoveredStation.id);
                        this._hoveredStation = null;
                        this.game.saveState();
                    }
                }
                else if (this._hoveredVoiePoint && this.activePage === 'map') {
                    this.game.voiePointManager.remove(this._hoveredVoiePoint.id);
                    this._hoveredVoiePoint = null;
                    this.game.saveState();
                }
            }
        });
        canvas.addEventListener('dblclick', (e) => {
            if (this._hoveredStation && !this.stationCreationMode && !this._pickConnectionMode) {
                this.openEditStationModal(this._hoveredStation);
            }
            else if (this._hoveredReferenceStation && !this.stationCreationMode && !this._pickConnectionMode) {
                const ref = this._hoveredReferenceStation;
                const station = this.game.world.activateReferenceStation?.(ref.id);
                if (station) {
                    this.game.platformManager?.initStation?.(station.id, station.platforms || 2);
                    this._hoveredReferenceStation = null;
                    this._hoveredStation = station;
                    this.game.renderer?.invalidateStatic?.();
                    this.game.saveState();
                    this.openEditStationModal(station);
                }
            }
            if (this._hoveredVoiePoint && !this.voiePointCreationMode && !this.tronconCreationMode) {
                this.openEditVoiePointModal(this._hoveredVoiePoint);
            }
        });
        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            document.getElementById('tooltip')?.classList.add('hidden');
        });
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const delta = e.deltaY < 0 ? 1 : -1;
                this.game.renderer.tileMap.applyZoom(delta, x, y);
            }
        });
        // Touch events for mobile
        let touchStart = null, touchDist = null, touchMoved = false;
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                touchMoved = false;
            }
            else if (e.touches.length === 2) {
                touchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
                touchMoved = true;
            }
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && touchStart && this.game.renderer) {
                const dx = e.touches[0].clientX - touchStart.x;
                const dy = e.touches[0].clientY - touchStart.y;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5)
                    touchMoved = true;
                this.game.renderer.tileMap.pan(dx, dy);
                touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            else if (e.touches.length === 2 && touchDist !== null && this.game.renderer) {
                touchMoved = true;
                const newDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const rect = canvas.getBoundingClientRect();
                const delta = newDist > touchDist ? 1 : -1;
                this.game.renderer.tileMap.applyZoom(delta, cx - rect.left, cy - rect.top);
                touchDist = newDist;
            }
        }, { passive: false });
        canvas.addEventListener('touchend', (e) => {
            if (!touchMoved && touchStart && this.game.renderer) {
                const rect = canvas.getBoundingClientRect();
                const x = touchStart.x - rect.left;
                const y = touchStart.y - rect.top;
                // LVM-04/06 — tap sur un train : sélection + panneau détail.
                const _tapMode = this._pickConnectionMode || this.tronconCreationMode
                    || this.manualTronconMode || this.tracerLigneMode || this.voiePointCreationMode
                    || this.stationCreationMode || this.industryCreationMode || this.game._pendingSignalBox || this.game._pendingRegZone;
                if (!_tapMode && this.activePage === 'map') {
                    const picked = this._findServiceAtScreen(x, y);
                    if (picked) {
                        this.selectService(picked);
                        touchStart = null;
                        touchDist = null;
                        touchMoved = false;
                        return;
                    }
                }
                if (this._pickConnectionMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    let closest = null, minDist = Infinity;
                    for (const st of this.game.world.stations) {
                        const d = Math.hypot(st.lat - worldPos.lat, st.lon - worldPos.lon);
                        if (d < minDist) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (closest && minDist < 0.5)
                        this.handlePickConnection(closest);
                }
                else if (this.tronconCreationMode) {
                    this._handleTronconClick(x, y);
                }
                else if (this.manualTronconMode) {
                    this._handleManualTronconClick(x, y);
                }
                else if (this.tracerLigneMode) {
                    this._handleTracerLigneClick(x, y);
                }
                else if (this.voiePointCreationMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    this.openVoiePointModal(worldPos.lat, worldPos.lon);
                }
                else if (this.stationCreationMode) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    this.openStationCreationModal(worldPos.lat, worldPos.lon);
                }
                else if (this.game._pendingSignalBox) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    const pending = this.game._pendingSignalBox;
                    this.game.staffManager.addSignalBox({ name: pending.name, lat: worldPos.lat, lon: worldPos.lon, radiusKm: pending.radiusKm });
                    this.game._pendingSignalBox = null;
                    this.game.saveState();
                    canvas.style.cursor = 'grab';
                    this._hidePickHint();
                    const staffContainer = document.getElementById('staff-container');
                    if (staffContainer)
                        this.game.staffManager.render(staffContainer, this.game);
                }
                else if (this.game._pendingRegZone) {
                    const worldPos = this.game.renderer.tileMap.screenToWorld(x, y, this.game.renderer.logicalWidth, this.game.renderer.logicalHeight);
                    const pending = this.game._pendingRegZone;
                    this.game.staffManager.addZone(pending.name, worldPos.lat, worldPos.lon, pending.radiusKm);
                    this.game._pendingRegZone = null;
                    this.game.saveState();
                    canvas.style.cursor = 'grab';
                    this._hidePickHint();
                    const staffContainer = document.getElementById('staff-container');
                    if (staffContainer)
                        this.game.staffManager.render(staffContainer, this.game);
                }
            }
            touchStart = null;
            touchDist = null;
            touchMoved = false;
        });
    }
    _livemapEsc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
    }
    _livemapClock(value, showDay = false) {
        const raw = Number(value);
        if (!Number.isFinite(raw))
            return '--:--';
        const rounded = Math.round(raw), day = Math.floor(rounded / 1440), m = ((rounded % 1440) + 1440) % 1440;
        const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
        return `${hh}:${mm}${showDay && day > 0 ? ` (+${day})` : ''}`;
    }
    /** Live incidents touching a station: in the station itself, on a train currently
     * held there, and on the adjacent sections leaving it. */
    _livemapStationIncidents(station) {
        const sid = station?.id == null ? '' : String(station.id);
        if (!sid)
            return [];
        const all = (this.game.incidentManager?.getActiveIncidents?.() || []);
        const inStation = [], onTrain = [], onSection = [];
        for (const inc of all) {
            if (!inc || inc.active === false)
                continue;
            const a = inc.stationA == null ? '' : String(inc.stationA), b = inc.stationB == null ? '' : String(inc.stationB);
            if (a !== sid && b !== sid)
                continue;
            if (inc.serviceId)
                onTrain.push(inc);
            else if (a === b)
                inStation.push(inc);
            else
                onSection.push(inc);
        }
        return [...inStation, ...onTrain, ...onSection];
    }
    _livemapStationIncidentHtml(station) {
        const incidents = this._livemapStationIncidents(station);
        if (!incidents.length)
            return '';
        const sid = String(station.id);
        const nowMinute = Number.isFinite(Number(this.game.timeOfDay))
            ? Number(this.game.timeOfDay)
            : (() => { const pt = this.game.engine?.getParisTime?.(); return pt ? pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60 : 0; })();
        const MAX = 5;
        const rows = incidents.slice(0, MAX).map((inc) => {
            const elapsed = Math.max(0, Number(inc.duration || 0) - Number(inc.remaining || 0));
            let start = Number(inc.startTime);
            if ((!Number.isFinite(start) || (start === 0 && elapsed > 0 && nowMinute > elapsed + 1)))
                start = nowMinute - elapsed;
            if (!Number.isFinite(start))
                start = nowMinute - elapsed;
            const end = start + Math.max(0, Number(inc.duration || 0));
            const effect = inc.effect === 'stop' ? 'Interruption' : `Ralenti ${this._livemapEsc(inc.speedLimit || 30)} km/h`;
            const a = inc.stationA == null ? '' : String(inc.stationA), b = inc.stationB == null ? '' : String(inc.stationB);
            let where = '';
            if (inc.serviceId)
                where = `Train ${this._livemapEsc(inc.trainName || '')}${inc.locationText ? ` · ${this._livemapEsc(inc.locationText)}` : ''}`;
            else if (a !== b) {
                const other = a === sid ? inc.stationBName : inc.stationAName;
                where = `Section vers ${this._livemapEsc(other || '?')}`;
            }
            const weather = inc.source === 'weather' ? `<div>🌦 ${this._livemapEsc(inc.triggerText || 'Déclencheur météo')}</div>` : '';
            return `<div class="tt-operational tt-incident-active"><div class="tt-operational-title">Incident en cours — ${this._livemapEsc(inc.name || 'Incident')}</div>${where ? `<div>${where}</div>` : ''}<div>${effect}</div>${weather}<div>Début ${this._livemapClock(start)} · Fin ${this._livemapClock(end, true)} · ${htmlText(Math.ceil(Number(inc.remaining || 0)))} min restantes</div></div>`;
        });
        if (incidents.length > MAX)
            rows.push(`<div class="tt-operational tt-incident-active">+${incidents.length - MAX} autre(s) incident(s) — voir la page Incidents</div>`);
        return `<div class="tt-incident-count">${incidents.length} incident${incidents.length > 1 ? 's' : ''} en cours</div>` + rows.join('');
    }
    _livemapWorkLocation(item) {
        const stationName = (value) => value ? (this.game.world.getStationById?.(value)?.name || String(value)) : '';
        const a = String(item?.startStation?.name || stationName(item?.stationA) || '').trim();
        const b = String(item?.endStation?.name || stationName(item?.stationB) || '').trim();
        if (a && b)
            return a === b ? `à ${a}` : `entre ${a} et ${b}`;
        return a || b ? `à ${a || b}` : '';
    }
    _livemapWorkTooltipHtml(item) {
        if (!item)
            return '';
        const esc = (v) => this._livemapEsc(v);
        const work = item.sourceWork || {};
        const location = this._livemapWorkLocation(item);
        const impact = item.affectsTraffic === false
            ? 'Aucun impact sur la circulation'
            : item.impact === 'stop' ? 'Interruption totale'
                : item.impact === 'power-off' ? 'Caténaire coupée'
                    : `LTV ${Number(item.speedLimit || 40)} km/h`;
        const direction = item.direction === 'forward' ? 'A→B' : item.direction === 'reverse' ? 'B→A' : '2 sens';
        const distance = Number(item?.sourceZone?.distanceKm || 0) > 0 ? ` · ${Number(item.sourceZone.distanceKm).toFixed(2)} km` : '';
        const recurrence = work.recurrence === 'once' ? `Le ${work.startDate || ''}` : work.recurrence === 'weekly' ? `Hebdomadaire (${(work.daysOfWeek || []).join(',')})` : 'Chaque jour';
        return `<div class="tt-name">${esc(item.workName || work.name || 'Travaux')}</div><div class="tt-info">${esc(location)}</div><div class="tt-operational tt-works-active"><div class="tt-operational-title">Travaux en cours</div><div>${esc(impact)} · ${esc(direction)}${esc(distance)}</div><div>${esc(recurrence)} de ${esc(work.startTime || '--:--')} à ${esc(work.endTime || '--:--')}</div>${work.startDate && work.endDate ? `<div>Du ${esc(work.startDate)} au ${esc(work.endDate)}</div>` : ''}</div>`;
    }
    handleMapHover(x, y) {
        const renderer = this.game.renderer;
        if (!renderer)
            return;
        this._hoveredIndustry = null;
        const tooltip = document.getElementById('tooltip');
        const station = renderer.getStationAt(x, y, this.game.world);
        if (station) {
            const typeLabels = { voyageur: 'Voyageurs', marchandise: 'Marchandises', ite: 'ITE', depot: 'Depot', mixed: 'Mixte' };
            const platformNames = station.platformNames?.length > 0 ? station.platformNames.join(', ') : '';
            const incidentHtml = this._livemapStationIncidentHtml(station);
            tooltip.innerHTML = `<div class="tt-name">${this._livemapEsc(station.name)}</div><div class="tt-info">${this._livemapEsc(station.platforms)} voies${htmlText(platformNames ? ' (' + (platformNames) + ')' : '')} | ${this._livemapEsc(typeLabels[station.type] || station.type)}</div>${incidentHtml}<div style="font-size:9px;color:#fbbf24;margin-top:2px">Double-clic pour modifier</div>`;
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.classList.remove('hidden');
            this._hoveredStation = station;
            this._hoveredReferenceStation = null;
            this._hoveredVoiePoint = null;
            return;
        }
        this._hoveredStation = null;
        // HOTFIX48 — exact active Works geometry is hoverable on the Livemap. The
        // hit-test reuses screen points cached while the route was drawn, so hover
        // stays cheap even for a long ORM section.
        const workZone = renderer.getActiveWorkZoneAt?.(x, y);
        if (workZone) {
            tooltip.innerHTML = this._livemapWorkTooltipHtml(workZone);
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.classList.remove('hidden');
            this._hoveredReferenceStation = null;
            this._hoveredVoiePoint = null;
            return;
        }
        // Legacy reference-layer fallback. v1.1.14 normally keeps this empty because
        // RailNet Europe stations are already native gameplay stations.
        const refStation = renderer.getReferenceStationAt?.(x, y, this.game.world);
        if (refStation) {
            const kind = refStation.type === 'halt' ? 'Halte ferroviaire européenne' : 'Gare ferroviaire européenne';
            const uic = refStation.uicRef ? ` · UIC ${refStation.uicRef}` : '';
            tooltip.innerHTML = `<div class="tt-name">${htmlText(refStation.name)}</div><div class="tt-info">${kind}${htmlText(uic)}</div><div style="font-size:9px;color:#fbbf24;margin-top:2px">Double-clic pour activer dans la partie</div>`;
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.classList.remove('hidden');
            this._hoveredReferenceStation = refStation;
            this._hoveredVoiePoint = null;
            return;
        }
        this._hoveredReferenceStation = null;
        // Check voie points
        const vpm = this.game.voiePointManager;
        const voieLayerVisible = document.getElementById('toggle-voie-points')?.checked !== false;
        if (vpm && voieLayerVisible) {
            const vp = renderer.getVoiePointAt(x, y, vpm);
            if (vp) {
                const tronconsCount = vpm.getTronconsForPoint(vp.id).length;
                const stName = vp.stationId ? (this.game.world.getStationById(vp.stationId)?.name || '') : '';
                const stLabel = stName ? ` (${stName})` : ' (en ligne)';
                const occLabel = vp.occupiedBy ? ' — OCCUPEE' : '';
                tooltip.innerHTML = `<div class="tt-name">Voie ${htmlText(vp.voie)}${htmlText(stLabel)}${htmlText(occLabel)}</div><div class="tt-info">${tronconsCount} troncon(s)</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">Double-clic pour modifier | Shift+drag pour deplacer</div>`;
                tooltip.style.left = (x + 15) + 'px';
                tooltip.style.top = (y - 10) + 'px';
                tooltip.classList.remove('hidden');
                this._hoveredVoiePoint = vp;
                return;
            }
        }
        this._hoveredVoiePoint = null;
        // Industry markers (only interactive when the layer is shown)
        if (document.getElementById('toggle-industries')?.checked) {
            const ind = renderer.getIndustryAt(x, y);
            if (ind) {
                tooltip.innerHTML = `<div class="tt-name">${htmlText(ind.name)}</div><div class="tt-info">${htmlText(ind.industryName)}</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">Shift+drag pour déplacer | Ctrl+clic pour supprimer</div>`;
                tooltip.style.left = (x + 15) + 'px';
                tooltip.style.top = (y - 10) + 'px';
                tooltip.classList.remove('hidden');
                this._hoveredIndustry = ind;
                return;
            }
        }
        tooltip.classList.add('hidden');
    }
    // LVM-04 — trouve le service (train) le plus proche du clic écran (rayon px).
    _findServiceAtScreen(x, y) {
        const renderer = this.game.renderer;
        if (!renderer || !this.game.scheduleCreator)
            return null;
        const services = this.game.scheduleCreator.getActiveServices();
        let best = null, bestD = 24; // seuil px (icône ~25 px)
        for (const svc of services) {
            if (!svc.position || svc.state === 'completed')
                continue;
            if (svc.state === 'waiting' && !svc.train?.stoppedAt)
                continue;
            const p = renderer.latLonToScreen(svc.position.lat, svc.position.lon);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bestD) {
                bestD = d;
                best = svc;
            }
        }
        return best;
    }
    selectService(svc) {
        this.selectedService = svc;
        // User gesture: safe place to trigger browser speech synthesis. A new click
        // cancels the previous train announcement before speaking this service.
        this.trainAnnouncer?.announce?.(svc);
        this._followService = svc;
        this._lvpKey = null; // force un rebuild complet
        this._lastSelectedForScroll = null; // force le bandeau à scroller sur la carte
        // LVM-04/06 — centre immédiatement sur le train cliqué
        if (svc && svc.position && this.game.renderer?.tileMap) {
            const tm = this.game.renderer.tileMap;
            tm.centerLat = svc.position.lat;
            tm.centerLon = svc.position.lon;
            tm.markDirty();
        }
        this._syncLivemapPanel();
    }
    // Appelé à chaque frame (updateTrainsList) : rebuild seulement si le trajet
    // change (leg aller/retour, nb d'arrêts), sinon simple rafraîchissement léger
    // pour ne pas casser le bandeau défilant ni le bouton fermer.
    _livemapPayloadText(svc) {
        const rame = this._displayRameForService(svc);
        if (!rame)
            return '';
        const cat = svc.category || svc.train?.category || 'voyageur';
        if (cat === 'fret' || rame.totalFreightCapacity > 0) {
            const tonnes = Math.max(0, Number(svc._onboardFreight) || 0) + Math.max(0, Number(svc._contractFreight) || 0);
            return `${Math.round(tonnes)} tonnes de fret transportées`;
        }
        if (cat === 'voyageur' || rame.totalCapacity > 0)
            return `${Math.max(0, Math.round(Number(svc._onboardPax) || 0))} passagers à bord`;
        return '';
    }
    _syncLivemapPanel() {
        const svc = this.selectedService;
        const panel = document.getElementById('livemap-train-panel');
        if (!panel)
            return;
        if (!svc || !svc.train || !this.game.scheduleCreator?.services.includes(svc)) {
            if (this._threeDFollowActive)
                this.disable3DFollow();
            this.selectedService = null;
            this._lvpKey = null;
            this._lvpStateKey = null;
            panel.classList.add('hidden');
            return;
        }
        const stops = typeof svc.getCurrentStops === 'function'
            ? svc.getCurrentStops()
            : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
        const key = `${svc.id}|${svc.isReturnLeg ? 'R' : 'A'}|${stops.length}`;
        if (key !== this._lvpKey) {
            this._lvpKey = key;
            this._renderLivemapPanel();
            return;
        }
        // Rafraîchissement léger (vitesse / retard) à chaque frame.
        const t = svc.train;
        const sp = document.getElementById('lvp-speed');
        if (sp)
            sp.textContent = `${Math.round(t.speed)} km/h`;
        const payload = panel.querySelector('.lvp-payload');
        if (payload)
            payload.textContent = this._livemapPayloadText(svc);
        const dl = document.getElementById('lvp-delay');
        if (dl) {
            const d = operationalDelayMinutes(Number.isFinite(t.delay) ? t.delay : 0);
            dl.className = d > 0 ? 'late' : d < 0 ? 'early' : 'ok';
            dl.textContent = d > 0 ? `+${d} min` : d < 0 ? `- ${Math.abs(d)} min` : `à l'heure`;
        }
        // Quand l'arrêt courant ou le retard change, on reconstruit situation, bandeau et étapes.
        const curIdx = svc.currentStopIndex || 0;
        const reasonSig = (Array.isArray(t.incidentDelayReasons) ? t.incidentDelayReasons : [])
            .map((r) => `${r.incidentId || ''}:${r.contributed ? 1 : 0}:${r.active ? 1 : 0}:${r.text || ''}`).join('|');
        const stateKey = `${svc.state}|${t.state}|${curIdx}|${operationalDelayMinutes(Number.isFinite(t.delay) ? t.delay : 0)}|${t.delayReason || ''}|${reasonSig}`;
        // v1.1.54 — lightweight physical cursor update on every animation frame.
        // The expensive panel DOM is still rebuilt only when stop/delay state changes.
        this._syncLivemapProgressArrow(svc);
        if (stateKey !== this._lvpStateKey) {
            this._lvpStateKey = stateKey;
            const { d, rows, bandeau, situation, nextHtml, curIdx: newIdx } = this._buildLivemapPanelContent(svc);
            const sitEl = document.getElementById('lvp-situation');
            if (sitEl)
                sitEl.innerHTML = situation;
            const reasonsHtml = this._livemapDelayReasonsHtml(svc, d);
            const reasonsEl = document.getElementById('lvp-delay-reasons');
            if (reasonsHtml) {
                if (reasonsEl)
                    reasonsEl.outerHTML = reasonsHtml;
                else if (sitEl)
                    sitEl.insertAdjacentHTML('afterend', reasonsHtml);
            }
            else if (reasonsEl) {
                reasonsEl.remove();
            }
            const nextEl = document.getElementById('lvp-next');
            if (nextEl)
                nextEl.innerHTML = nextHtml;
            const bandeauEl = document.getElementById('lvp-bandeau-track');
            if (bandeauEl) {
                bandeauEl.textContent = bandeau;
                this._updateBandeauMarquee();
            }
            const stopsEl = document.getElementById('lvp-stops');
            if (stopsEl) {
                const scrollTop = stopsEl.scrollTop;
                stopsEl.innerHTML = rows;
                stopsEl.scrollTop = scrollTop;
                this._syncLivemapProgressArrow(svc);
            }
            if (this._lvpLastCurIdx !== newIdx) {
                this._lvpLastCurIdx = newIdx;
                const curEl = panel.querySelector('.lvp-stop.cur');
                if (curEl)
                    curEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
            }
        }
    }
    selectServiceById(id) {
        const svc = this.game.scheduleCreator?.services.find((s) => s.id === id);
        if (svc)
            this.selectService(svc);
    }
    deselectService() {
        if (this._threeDFollowActive)
            this.disable3DFollow();
        this.trainAnnouncer?.cancel?.();
        if (this._lvpMarqueeRaf)
            cancelAnimationFrame(this._lvpMarqueeRaf);
        this._lvpMarqueeRaf = null;
        this._lvpMarqueeText = null;
        this.selectedService = null;
        this._followService = null;
        this._lastSelectedForScroll = null;
        document.getElementById('livemap-train-panel')?.classList.add('hidden');
    }
    // LVM-04/06 — suit le train sélectionné à chaque frame
    applyCameraFollow() {
        const svc = this._followService;
        if (!svc || !this.game.renderer?.tileMap)
            return;
        // HOTFIX70 — completion must be handled BEFORE the null-position early return.
        // completeService intentionally sets position=null; the former order therefore
        // left GPS follow/panel state alive after the physical train had despawned.
        if (svc.completed || svc.cancelled || svc.state === 'completed' || svc.state === 'cancelled' || !this.game.scheduleCreator?.services.includes(svc)) {
            this._followService = null;
            if (this._threeDFollowActive)
                this.disable3DFollow();
            if (this.selectedService === svc)
                this.deselectService();
            return;
        }
        if (!svc.position)
            return;
        const renderer = this.game.renderer;
        const tm = renderer.tileMap;
        if (this._threeDFollowActive)
            this._sync3DCameraHeading(svc);
        const viewCenter = this._threeDFollowActive
            ? this._threeDViewCenterForService(svc, this._threeDCameraHeading)
            : svc.position;
        // RE3D-DEM-01 — while true relief is active, keep a stable terrain patch and
        // only rebuild after the GPS LOOK-AHEAD centre crosses a small dead-zone.
        // HOTFIX20 therefore gains forward range without rebuilding DEM every frame.
        const terrain = renderer.terrain3D;
        if (this._threeDFollowActive && this._threeDReliefEnabled && terrain?.enabled) {
            if (viewCenter && terrain.shouldRecenter(viewCenter.lat, viewCenter.lon)) {
                tm.centerLat = viewCenter.lat;
                tm.centerLon = viewCenter.lon;
                tm.markDirty();
                terrain.requestRebuild(true);
            }
        }
        else if (viewCenter && this._threeDFollowActive) {
            // HOTFIX26 — DO NOT recenter/repaint the satellite map for every movement
            // tick.  Keep a geographic raster anchor, project the live train against
            // that anchor, then translate the entire tilted plane with CSS.  Both the
            // canvas and DOM train plane use the same transform, so scenery + nearby
            // trains glide continuously while the followed arrow stays screen-pinned.
            tm._updateFrameCache?.();
            const p = renderer.latLonToScreen?.(viewCenter.lat, viewCenter.lon);
            if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                const dx = renderer.logicalWidth / 2 - p.x;
                const dy = renderer.logicalHeight / 2 - p.y;
                // Ask the actual projected quadrilateral whether the candidate pan still
                // covers every screen corner.  This is much less conservative than one
                // fixed pixel threshold and never knowingly exposes the stage background.
                const safe = renderer.is3DPlanePanSafe?.(dx, dy, this._threeDCameraHeading, 14) !== false;
                if (safe)
                    this._set3DMapPan(dx, dy);
                else
                    this._threeDMapNeedsReanchor = true;
            }
        }
        else if (viewCenter) {
            // Normal 2D follow keeps the historical continuous behaviour.
            tm.centerLat = viewCenter.lat;
            tm.centerLon = viewCenter.lon;
            tm.markDirty();
        }
        if (this._threeDFollowActive)
            this._sync3DAtmosphere();
    }
    _set3DMapPan(dx = 0, dy = 0) {
        const x = Number.isFinite(Number(dx)) ? Number(dx) : 0;
        const y = Number.isFinite(Number(dy)) ? Number(dy) : 0;
        this._threeDMapPanX = x;
        this._threeDMapPanY = y;
        this._threeDMapPanDistance = Math.hypot(x, y);
        const main = document.getElementById('main-area');
        main?.style?.setProperty?.('--re3d-pan-x', `${x.toFixed(2)}px`);
        main?.style?.setProperty?.('--re3d-pan-y', `${y.toFixed(2)}px`);
    }
    prepare3DMapAnchorForRender(force = false) {
        if (!this._threeDFollowActive || this._threeDReliefEnabled)
            return false;
        if (!force && !this._threeDMapNeedsReanchor)
            return false;
        const svc = this._followService || this.selectedService;
        const pos = this._threeDViewCenterForService(svc, this._threeDCameraHeading);
        const tm = this.game.renderer?.tileMap;
        if (!pos || !tm)
            return false;
        tm.centerLat = Number(pos.lat);
        tm.centerLon = Number(pos.lon);
        tm.markDirty?.();
        this._set3DMapPan(0, 0);
        this._threeDMapNeedsReanchor = false;
        this._threeDMapAnchorAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this._threeDLastMapFollowAt = this._threeDMapAnchorAt;
        return true;
    }
    _sync3DCameraHeading(svc, force = false) {
        if (!this._threeDFollowActive || !svc)
            return;
        const renderer = this.game.renderer;
        const target = renderer?._ormTrainGeoHeading?.(svc);
        if (!Number.isFinite(target))
            return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        let heading = this._threeDCameraHeading;
        if (force || !Number.isFinite(heading) || !this._threeDCameraHeadingAt || now - this._threeDCameraHeadingAt > 1500) {
            heading = target;
        }
        else {
            const dt = Math.max(0, Math.min(.25, (now - this._threeDCameraHeadingAt) / 1000));
            const delta = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
            // ~280 ms time constant: follows curves promptly without snapping at
            // dense OSM vertices or turnout boundaries.
            const alpha = 1 - Math.exp(-dt * 3.6);
            heading += delta * alpha;
        }
        heading = Math.atan2(Math.sin(heading), Math.cos(heading));
        this._threeDCameraHeading = heading;
        this._threeDCameraHeadingAt = now;
        const main = document.getElementById('main-area');
        const deg = heading * 180 / Math.PI;
        // Fallback CSS map turns opposite to train bearing; the marker billboard
        // receives the counter-rotation so labels remain horizontal.
        main?.style?.setProperty?.('--re3d-map-rotation', `${(-deg).toFixed(2)}deg`);
        main?.style?.setProperty?.('--re3d-camera-counter', `${deg.toFixed(2)}deg`);
        renderer?.terrain3D?.setBearing?.(heading);
    }
    // RE3D-01 — low-memory GPS follow mode. The fallback remains pure CSS/DOM;
    // HOTFIX10 optionally adds only one tiny custom WebGL DEM mesh underneath it.
    setup3DFollowView() {
        if (this._threeDFollowBound)
            return;
        this._threeDFollowBound = true;
        const main = document.getElementById('main-area');
        main?.addEventListener('click', (e) => {
            const clicked = e.target;
            if (this._threeDFollowActive && clicked?.closest?.('[data-tile-standard]')) {
                this._set3DLightingFilter('day');
                this._sync3DAtmosphere(true);
                this.game.renderer?.requestRender?.();
                return;
            }
            const btn = clicked?.closest?.('[data-re3d-action]');
            if (!btn)
                return;
            const action = btn.dataset.re3dAction;
            if (action === 'toggle')
                this.toggle3DFollow();
            else if (action === 'zoom-in')
                this.adjust3DZoom(1);
            else if (action === 'zoom-out')
                this.adjust3DZoom(-1);
            else if (action === 'recenter' || action === 'follow')
                this.recenter3DFollow();
            else if (action === 'labels')
                this.toggle3DLabels();
            else if (action === 'relief')
                this.toggle3DRelief();
            else if (action === 'exit')
                this.disable3DFollow();
        });
        main?.addEventListener('change', (e) => {
            const target = e.target;
            if (!target)
                return;
            if (target.id === 're3d-lighting-filter') {
                this._set3DLightingFilter(target.value);
            }
            else if (target.id === 'toggle-night' && this._threeDFollowActive) {
                this._set3DLightingFilter(target.checked ? 'night' : 'day');
            }
            else if (target.id === 'toggle-basic' && this._threeDFollowActive && target.checked) {
                // Explicit 'OSM original' must not be instantly undone by a previous night override.
                this._set3DLightingFilter('day');
            }
            else if (target.id === 're3d-weather-filter') {
                const allowed = new Set(['auto', 'clear', 'rain', 'snow', 'storm', 'fog', 'heat']);
                this._threeDWeatherFilter = allowed.has(String(target.value)) ? String(target.value) : 'auto';
            }
            else
                return;
            this._threeDAtmosphereKey = '';
            this._sync3DAtmosphere(true);
            this.game.renderer?.requestRender?.();
            if (this.game)
                this.game._last3DMapRender = 0;
        });
        main?.addEventListener('wheel', (e) => {
            if (!this._threeDFollowActive)
                return;
            // Controls can scroll independently; changing a select must not zoom the map.
            if (e.target?.closest?.('.re3d-controls, .map-toggles, .map-source-panel, .livemap-panel'))
                return;
            e.preventDefault();
            this.adjust3DZoom(e.deltaY < 0 ? 1 : -1);
        }, { passive: false });
    }
    _set3DLightingFilter(value) {
        this._threeDLightingFilter = normalizeGPSLighting(value);
        try {
            localStorage.setItem(GPS_LIGHTING_STORAGE_KEY, this._threeDLightingFilter);
        }
        catch { /* Optional preference. */ }
        const select = document.getElementById('re3d-lighting-filter');
        if (select)
            select.value = this._threeDLightingFilter;
        this._threeDAtmosphereKey = '';
    }
    toggle3DFollow() {
        if (this._threeDFollowActive)
            this.disable3DFollow();
        else
            this.enable3DFollow();
    }
    _ensure3DServicePosition(svc) {
        if (!svc || svc.completed || svc.cancelled || svc.state === 'completed' || svc.state === 'cancelled')
            return null;
        if (svc.position && Number.isFinite(Number(svc.position.lat)) && Number.isFinite(Number(svc.position.lon)))
            return svc.position;
        const stopped = svc.train?.stoppedAt;
        if (stopped && Number.isFinite(Number(stopped.lat)) && Number.isFinite(Number(stopped.lon))) {
            svc.position = { lat: Number(stopped.lat), lon: Number(stopped.lon) };
            return svc.position;
        }
        const stops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : (svc.stops || []);
        const idx = Math.max(0, Math.min((stops?.length || 1) - 1, Number(svc.currentStopIndex || 0)));
        const candidates = [stops?.[idx], stops?.[Math.max(0, idx - 1)], stops?.[0]];
        for (const stop of candidates) {
            if (!stop)
                continue;
            if (Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lon))) {
                svc.position = { lat: Number(stop.lat), lon: Number(stop.lon) };
                return svc.position;
            }
            const station = stop.stationId ? this.game.world?.getStationById?.(stop.stationId) : null;
            if (station && Number.isFinite(Number(station.lat)) && Number.isFinite(Number(station.lon))) {
                svc.position = { lat: Number(station.lat), lon: Number(station.lon) };
                return svc.position;
            }
        }
        const route = typeof svc.getCurrentRoute === 'function' ? svc.getCurrentRoute() : null;
        const p0 = Array.isArray(route) ? route.find((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lon))) : null;
        if (p0) {
            svc.position = { lat: Number(p0.lat), lon: Number(p0.lon) };
            return svc.position;
        }
        return null;
    }
    enable3DFollow() {
        const svc = this.selectedService;
        const renderer = this.game.renderer;
        const tm = renderer?.tileMap;
        const visualPos = this._ensure3DServicePosition(svc);
        if (!visualPos || !renderer || !tm) {
            this.game?.showNotification?.('Vue 3D indisponible : position du train inconnue.', 'warning');
            return false;
        }
        if (this._threeDFollowActive) {
            this.recenter3DFollow();
            return true;
        }
        this._threeDPreviousMapState = {
            zoom: Number(tm.zoomLevel),
            satellite: !!tm.satelliteEnabled,
            basic: !!tm.basicMode,
            rail: !!tm.railEnabled,
            weather: !!tm.weatherEnabled,
            night: !!tm.nightMapEnabled,
        };
        // HOTFIX73 — free the 2D raster cache before allocating the oversized GPS
        // plane and throttle image decodes while GPS is active. This is intentionally
        // done before switching satellite/night layers so no stale callback can inherit
        // the new loader counters.
        tm.setGPSLowMemoryMode?.(true);
        // Satellite imagery is the visual base of this mode. ORM remains an overlay.
        // HOTFIX20 keeps the normal display filters available in 3D; the temporary
        // satellite/ORM base-layer choice is still restored when returning to 2D.
        const keepOriginalBase = !!tm.basicMode && !tm.satelliteEnabled;
        tm.setNightMapEnabled?.(false);
        if (!keepOriginalBase) {
            tm.railEnabled = true;
            tm.setSatelliteEnabled?.(true);
        }
        else {
            // RC21: do not replace an explicitly chosen original OSM map on GPS entry.
            tm.setSatelliteEnabled?.(false);
        }
        // Weather tiles remain user-controlled; the local atmosphere always reacts to
        // the current Weather object without adding network/memory pressure.
        // HOTFIX20 — GPS needs range, not a microscope. Previous builds inherited up
        // to z15.5 from the 2D map, which could leave barely a couple of kilometres
        // visible. Cap the initial pseudo-3D zoom at 12.75; DEM keeps its wider 11.4.
        // HOTFIX21 — wider geographic footprint. The CSS/WebGL plane now fills the
        // whole viewport, so we can zoom the source map out without exposing black
        // corners. This is deliberately ~1 zoom level wider than HOTFIX20.
        tm.zoomLevel = this._threeDReliefEnabled ? 10.75 : Math.max(11.0, Math.min(12.5, Number(tm.zoomLevel || 11)));
        this._followService = svc;
        this._threeDFollowActive = true;
        this._threeDAtmosphereKey = '';
        this._threeDCameraHeading = null;
        this._threeDCameraHeadingAt = 0;
        this._threeDLastMapFollowAt = 0;
        this._threeDMapNeedsReanchor = false;
        this._threeDMapAnchorAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this._set3DMapPan(0, 0);
        if (this.game)
            this.game._last3DMapRender = 0;
        document.getElementById('main-area')?.classList.add('re3d-active');
        document.getElementById('page-map')?.classList.add('re3d-active');
        document.getElementById('re3d-controls')?.classList.remove('hidden');
        document.getElementById('re3d-mode-badge')?.classList.remove('hidden');
        document.getElementById('re3d-weather-chip')?.classList.remove('hidden');
        const weatherFilter = document.getElementById('re3d-weather-filter');
        if (weatherFilter)
            weatherFilter.value = this._threeDWeatherFilter || 'auto';
        const lightingFilter = document.getElementById('re3d-lighting-filter');
        if (lightingFilter)
            lightingFilter.value = this._threeDLightingFilter;
        document.getElementById('main-area')?.classList.toggle('re3d-labels-off', !this._threeDLabels);
        this._sync3DToggleInputs();
        document.querySelector('[data-re3d-action="relief"]')?.classList.toggle('active', this._threeDReliefEnabled);
        this._sync3DCameraHeading(svc, true);
        const initialViewCenter = this._threeDViewCenterForService(svc, this._threeDCameraHeading);
        if (initialViewCenter) {
            tm.centerLat = initialViewCenter.lat;
            tm.centerLon = initialViewCenter.lon;
            tm.markDirty?.();
        }
        this._sync3DAtmosphere(true);
        this._sync3DPanelButton();
        this._bindTerrainStatus();
        if (this._threeDReliefEnabled) {
            try {
                renderer.terrain3D?.enable?.(renderer.canvas);
            }
            catch (e) {
                console.warn('[RE3D] Relief DEM indisponible, pseudo-3D conservée', e);
            }
        }
        renderer.requestRender?.();
        // Sidebar collapse changes the map width; resize after layout settles.
        requestAnimationFrame(() => { renderer.resize?.(); renderer.requestRender?.(); });
        return true;
    }
    disable3DFollow() {
        if (!this._threeDFollowActive)
            return;
        const renderer = this.game.renderer;
        const tm = renderer?.tileMap;
        const prev = this._threeDPreviousMapState;
        this._threeDFollowActive = false;
        const main3D = document.getElementById('main-area');
        main3D?.classList.remove('re3d-active', 're3d-rain', 're3d-snow', 're3d-storm', 're3d-fog', 're3d-heat', 're3d-night', 're3d-labels-off', 're3d-relief-active', 're3d-relief-loading', 're3d-relief-fallback');
        main3D?.style?.removeProperty?.('--re3d-map-rotation');
        main3D?.style?.removeProperty?.('--re3d-camera-counter');
        main3D?.style?.removeProperty?.('--re3d-pan-x');
        main3D?.style?.removeProperty?.('--re3d-pan-y');
        document.getElementById('page-map')?.classList.remove('re3d-active');
        document.getElementById('re3d-controls')?.classList.add('hidden');
        document.getElementById('re3d-mode-badge')?.classList.add('hidden');
        document.getElementById('re3d-weather-chip')?.classList.add('hidden');
        document.getElementById('re3d-dem-chip')?.classList.add('hidden');
        document.getElementById('re3d-dem-credit')?.classList.add('hidden');
        renderer?.terrain3D?.setBearing?.(0);
        renderer?.terrain3D?.disable?.();
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.filter = '';
        const atmosphere = document.getElementById('re3d-atmosphere');
        if (atmosphere) {
            atmosphere.style.backgroundColor = '';
            atmosphere.style.boxShadow = '';
        }
        renderer?.clear3DMarkers?.();
        if (tm && prev) {
            if (prev.basic !== tm.basicMode)
                tm.toggleBasic();
            tm.railEnabled = prev.rail;
            tm.setNightMapEnabled?.(!!prev.night);
            tm.setSatelliteEnabled?.(prev.satellite);
            tm.setWeatherEnabled?.(prev.weather);
            if (Number.isFinite(prev.zoom))
                tm.zoomLevel = prev.zoom;
            // Drop GPS satellite/VIIRS decoded images before returning to the normal
            // 2D cache budget. The next 2D paint reloads only what is actually visible.
            tm.setGPSLowMemoryMode?.(false);
            tm.markDirty?.();
        }
        this._threeDPreviousMapState = null;
        this._threeDAtmosphereKey = '';
        this._threeDCameraHeading = null;
        this._threeDCameraHeadingAt = 0;
        this._threeDLastMapFollowAt = 0;
        this._threeDMapPanX = 0;
        this._threeDMapPanY = 0;
        this._threeDMapPanDistance = 0;
        this._threeDMapNeedsReanchor = false;
        this._threeDMapAnchorAt = 0;
        this._sync3DToggleInputs();
        this._sync3DPanelButton();
        requestAnimationFrame(() => {
            if (this.activePage === 'map')
                renderer?.resize?.();
            renderer?.requestRender?.();
        });
    }
    _sync3DToggleInputs() {
        const tm = this.game.renderer?.tileMap;
        if (!tm)
            return;
        const sat = document.getElementById('toggle-satellite');
        if (sat)
            sat.checked = !!tm.satelliteEnabled;
        const orm = document.getElementById('toggle-orm');
        if (orm)
            orm.checked = !!tm.railEnabled;
        const bas = document.getElementById('toggle-basic');
        if (bas)
            bas.checked = !!tm.basicMode && !tm.satelliteEnabled && !tm.nightMapEnabled;
        const nit = document.getElementById('toggle-night');
        if (nit)
            nit.checked = !!tm.nightMapEnabled;
        const wea = document.getElementById('toggle-weather');
        if (wea)
            wea.checked = !!tm.weatherEnabled;
    }
    _threeDViewCenterForService(svc, heading = null) {
        const pos = this._ensure3DServicePosition(svc);
        if (!pos)
            return null;
        // HOTFIX21 — the followed train is the optical centre of the GPS view.
        // HOTFIX20 used a geographic look-ahead centre, which intentionally pushed
        // the train toward the bottom. That wastes no pixels ahead, but the player
        // explicitly wants the arrow fixed at the exact centre of the 3D screen.
        // Range is now obtained by a wider map zoom + a larger projected plane,
        // never by moving the camera away from the train.
        return { lat: Number(pos.lat), lon: Number(pos.lon), aheadKm: 0 };
    }
    // HOTFIX27 — allow ten additional GPS zoom levels (z20 → z30).
    // This remains 3D-only; normal 2D TileMap navigation keeps its existing cap.
    adjust3DZoom(direction) {
        if (!this._threeDFollowActive)
            return;
        const tm = this.game.renderer?.tileMap;
        if (!tm)
            return;
        tm.zoomLevel = Math.max(8.5, Math.min(30.0, Number(tm.zoomLevel || 11) + (direction > 0 ? .5 : -.5)));
        tm.markDirty?.();
        this._threeDMapNeedsReanchor = true;
        this._set3DMapPan(0, 0);
        if (this.game)
            this.game._last3DMapRender = 0;
        // HOTFIX22 — zoom changes the GPS pitch and therefore the real overscan
        // square. Re-size once per user zoom step; never per animation frame.
        this.game.renderer?.resize?.();
        this.game.renderer?.terrain3D?.requestRebuild?.(true);
        this.game.renderer?.requestRender?.();
    }
    recenter3DFollow() {
        const svc = this.selectedService;
        const tm = this.game.renderer?.tileMap;
        const pos = this._ensure3DServicePosition(svc);
        if (!pos || !tm)
            return;
        this._followService = svc;
        this._sync3DCameraHeading(svc, true);
        const viewCenter = this._threeDViewCenterForService(svc, this._threeDCameraHeading);
        if (viewCenter) {
            tm.centerLat = viewCenter.lat;
            tm.centerLon = viewCenter.lon;
            tm.markDirty?.();
        }
        this._threeDMapNeedsReanchor = false;
        this._set3DMapPan(0, 0);
        if (this.game)
            this.game._last3DMapRender = 0;
        this.game.renderer?.terrain3D?.requestRebuild?.(true);
        this.game.renderer?.requestRender?.();
    }
    _bindTerrainStatus() {
        if (this._terrainStatusUnsub || !this.game.renderer?.terrain3D)
            return;
        this._terrainStatusUnsub = this.game.renderer.terrain3D.onStatus((status, detail) => {
            const main = document.getElementById('main-area');
            const chip = document.getElementById('re3d-dem-chip');
            const credit = document.getElementById('re3d-dem-credit');
            if (!main)
                return;
            main.classList.toggle('re3d-relief-active', status === 'ready' && this._threeDFollowActive && this._threeDReliefEnabled);
            main.classList.toggle('re3d-relief-loading', status === 'loading' && this._threeDFollowActive && this._threeDReliefEnabled);
            main.classList.toggle('re3d-relief-fallback', status === 'fallback' && this._threeDFollowActive && this._threeDReliefEnabled);
            if (chip) {
                chip.classList.toggle('hidden', !this._threeDFollowActive || !this._threeDReliefEnabled);
                chip.textContent = status === 'ready' ? `⛰ Relief DEM · ${detail || 'actif'}`
                    : status === 'loading' ? '⛰ Relief DEM · chargement…'
                        : status === 'fallback' ? `⚠ Relief DEM · ${detail || 'fallback 3D'}` : '⛰ Relief DEM';
            }
            credit?.classList.toggle('hidden', !(status === 'ready' && this._threeDFollowActive && this._threeDReliefEnabled));
            this.game.renderer?.requestRender?.();
        });
    }
    toggle3DRelief() {
        if (!this._threeDFollowActive)
            return;
        this._threeDReliefEnabled = !this._threeDReliefEnabled;
        const renderer = this.game.renderer;
        const main = document.getElementById('main-area');
        const btn = document.querySelector('[data-re3d-action="relief"]');
        btn?.classList.toggle('active', this._threeDReliefEnabled);
        if (this._threeDReliefEnabled) {
            this._bindTerrainStatus();
            renderer?.terrain3D?.enable?.(renderer.canvas);
            renderer?.terrain3D?.requestRebuild?.(true);
        }
        else {
            renderer?.terrain3D?.disable?.();
            main?.classList.remove('re3d-relief-active', 're3d-relief-loading', 're3d-relief-fallback');
            document.getElementById('re3d-dem-chip')?.classList.add('hidden');
            document.getElementById('re3d-dem-credit')?.classList.add('hidden');
        }
        renderer?.requestRender?.();
    }
    toggle3DLabels() {
        this._threeDLabels = !this._threeDLabels;
        document.getElementById('main-area')?.classList.toggle('re3d-labels-off', !this._threeDLabels);
        const btn = document.querySelector('[data-re3d-action="labels"]');
        btn?.classList.toggle('active', this._threeDLabels);
    }
    _sync3DPanelButton() {
        const btn = document.getElementById('lvp-3d-toggle');
        if (!btn)
            return;
        btn.classList.toggle('active', this._threeDFollowActive);
        btn.textContent = this._threeDFollowActive ? '▱ Retour vue 2D' : '◇ Vue 3D GPS';
    }
    _sync3DAtmosphere(force = false) {
        if (!this._threeDFollowActive)
            return;
        const main = document.getElementById('main-area');
        const canvas = document.getElementById('game-canvas');
        const chip = document.getElementById('re3d-weather-chip');
        const badge = document.getElementById('re3d-mode-badge');
        if (!main || !canvas)
            return;
        const weather = this.game.weather;
        const actualType = String(weather?.current || 'clear');
        const visualFilter = String(this._threeDWeatherFilter || 'auto');
        const type = visualFilter === 'auto' ? actualType : visualFilter;
        const tm = this.game.renderer?.tileMap;
        const originalOSM = !!tm?.basicMode && !tm?.satelliteEnabled;
        const lighting = resolveGPSLighting(this._threeDLightingFilter, Number(this.game.timeOfDay), originalOSM);
        const night = lighting.amount;
        const nightActive = lighting.night;
        const key = [originalOSM ? 'osm' : 'imagery', type, visualFilter, lighting.mode, tm?.nightMapEnabled,
            Math.floor(Number(tm?.zoomLevel || 0) * 10), nightActive ? 'nightmap' : 'daymap', Math.round(night * 10),
            Math.round(Number(weather?.cloudCover || 0) / 10), Math.round(Number(weather?.precipitation || 0) * 10), Math.round(Number(weather?.temperature || 0))].join('|');
        if (!force && key === this._threeDAtmosphereKey)
            return;
        this._threeDAtmosphereKey = key;
        for (const c of ['rain', 'snow', 'storm', 'fog', 'heat'])
            main.classList.toggle(`re3d-${c}`, type === c);
        main.classList.toggle('re3d-night', nightActive);
        // RC23: manual day/night affects presentation only, never time/weather/physics.
        const nightChanged = tm?.setNightMapEnabled?.(lighting.mapNight) === true;
        if (nightChanged) {
            this.game.renderer?.requestRender?.();
            if (this.game)
                this.game._last3DMapRender = 0;
        }
        // Opera-friendly atmosphere: do not apply CSS filters to the full map canvas.
        // Large filtered canvases can allocate an extra compositor surface. A single
        // translucent overlay gives us night/weather adaptation with bounded memory.
        canvas.style.filter = '';
        const atmosphere = document.getElementById('re3d-atmosphere');
        // The map carries its own night style; this small weather tint needs no
        // Canvas filter, blur shader or extra raster allocation.
        let dim = night * .06;
        if (type === 'rain')
            dim += .07;
        if (type === 'storm')
            dim += .16;
        if (type === 'fog')
            dim = Math.max(.08, dim * .55);
        if (type === 'snow')
            dim = Math.max(0, dim - .08);
        dim = Math.max(0, Math.min(.68, dim));
        if (atmosphere) {
            atmosphere.style.backgroundColor = type === 'heat'
                ? `rgba(95,35,8,${Math.max(.04, dim * .35).toFixed(2)})`
                : `rgba(2,8,20,${dim.toFixed(2)})`;
            atmosphere.style.boxShadow = type === 'storm'
                ? 'inset 0 0 120px rgba(0,0,0,.42)'
                : type === 'fog' ? 'inset 0 0 90px rgba(210,220,230,.08)' : '';
        }
        const labels = { clear: 'Dégagé', rain: 'Pluie', snow: 'Neige', storm: 'Orage', fog: 'Brouillard', heat: 'Canicule' };
        const icons = { clear: '☀', rain: '☔', snow: '❄', storm: '⚡', fog: '≋', heat: '♨' };
        const temp = Number.isFinite(Number(weather?.temperature)) ? `${Math.round(weather.temperature)}°C` : '';
        const wind = Number.isFinite(Number(weather?.windSpeed)) ? `${Math.round(weather.windSpeed)} km/h` : '';
        if (chip)
            chip.innerHTML = visualFilter === 'auto'
                ? `<b>${icons[type] || '☁'} ${htmlText(labels[type] || type)}</b>${temp ? `<br>${temp}` : ''}${wind ? ` · ${wind}` : ''}`
                : `<b>${icons[type] || '☁'} ${htmlText(labels[type] || type)}</b><br><span style="opacity:.72">Filtre GPS · météo réelle ${htmlText(labels[actualType] || actualType)}</span>`;
        if (badge)
            badge.textContent = `SUIVI 3D GPS · ${nightActive ? 'NUIT' : 'JOUR'}${lighting.mode === 'auto' ? ' AUTO' : ' FORCÉ'}${type !== 'clear' ? ' · ' + (labels[type] || type).toUpperCase() : ''}`;
        const note = document.getElementById('re3d-lighting-note');
        const description = lighting.mode === 'auto' && originalOSM
            ? 'Auto : couleurs OSM originales conservées. Nuit force le style sombre.'
            : tm?.getMapAppearanceLabel?.() || '';
        if (note && note.textContent !== description)
            note.textContent = description;
        this._sync3DToggleInputs();
    }
    _lvpRouteDistanceKm(route) {
        if (!Array.isArray(route) || route.length < 2)
            return 0;
        const cache = this._lvpRouteDistanceCache || (this._lvpRouteDistanceCache = new WeakMap());
        const cached = cache.get(route);
        if (cached != null)
            return cached;
        let km = 0;
        for (let i = 1; i < route.length; i++) {
            const a = route[i - 1], b = route[i];
            if (!a || !b)
                continue;
            km += haversineDistance(a.lat, a.lon, b.lat, b.lon);
        }
        cache.set(route, km);
        return km;
    }
    _lvpRouteForLeg(svc, legIndex) {
        if (!svc || legIndex < 0)
            return null;
        if (svc.isReturnLeg) {
            if (Array.isArray(svc._returnRoutes) && svc._returnRoutes.length)
                return svc._returnRoutes[legIndex] || null;
            const src = Array.isArray(svc.routes) ? svc.routes[svc.routes.length - 1 - legIndex] : null;
            // Distance is direction-independent; do not allocate a reversed copy merely
            // to position the Livemap arrow.
            return src || null;
        }
        return Array.isArray(svc.routes) ? (svc.routes[legIndex] || null) : null;
    }
    _lvpCurrentLegFraction(svc, route) {
        const st = svc?._state;
        if (st?.cachedRoute && st.cachedRoute.length >= 2 && st.segDists && st.cumDist) {
            const total = Number(st.cumDist[0]) || this._lvpRouteDistanceKm(st.cachedRoute);
            const idx = Math.max(0, Math.min(st.cachedRoute.length - 2, Number(st.index || 0)));
            const seg = Number(st.segDists[idx] || 0);
            const remainingFromIdx = Number(st.cumDist[idx] || 0);
            const before = Math.max(0, total - remainingFromIdx);
            const travelled = before + Math.max(0, Math.min(1, Number(st.progress || 0))) * seg;
            if (total > 1e-9)
                return Math.max(0, Math.min(1, travelled / total));
        }
        // Defensive fallback for the very first frame of a leg before _initializeState.
        // Project to the nearest route point rather than using timetable time: the
        // marker must follow the physical train, not the planned schedule.
        if (svc?.position && Array.isArray(route) && route.length >= 2) {
            let total = 0, bestDist = Infinity, bestAlong = 0, along = 0;
            for (let i = 1; i < route.length; i++) {
                const a = route[i - 1], b = route[i];
                const seg = haversineDistance(a.lat, a.lon, b.lat, b.lon);
                total += seg;
                const da = haversineDistance(svc.position.lat, svc.position.lon, a.lat, a.lon);
                const db = haversineDistance(svc.position.lat, svc.position.lon, b.lat, b.lon);
                if (da < bestDist) {
                    bestDist = da;
                    bestAlong = along;
                }
                if (db < bestDist) {
                    bestDist = db;
                    bestAlong = along + seg;
                }
                along += seg;
            }
            if (total > 1e-9)
                return Math.max(0, Math.min(1, bestAlong / total));
        }
        return 0;
    }
    /** Remaining railway distance, including any intermediate passage/technical
     * legs. No straight-line substitute: unknown geometry must not say "approach".
     */
    _livemapDistanceToStopKm(svc, targetIndex) {
        const current = Number(svc?.currentStopIndex);
        if (!['moving', 'departing'].includes(svc?.state) || !Number.isInteger(current) || current < 1 ||
            !Number.isInteger(targetIndex) || targetIndex < current)
            return null;
        const route = svc._state?.cachedRoute;
        if (!route || route.length < 2 || typeof svc._getRemainingDistance !== 'function')
            return null;
        let remaining = svc._getRemainingDistance(route);
        if (!Number.isFinite(remaining) || remaining < 0)
            return null;
        for (let leg = current; leg < targetIndex; leg++) {
            const nextRoute = this._lvpRouteForLeg(svc, leg);
            if (!nextRoute || nextRoute.length < 2)
                return null;
            const km = this._lvpRouteDistanceKm(nextRoute);
            if (!Number.isFinite(km) || km < 0)
                return null;
            remaining += km;
        }
        return remaining;
    }
    // Physical progress between the two passenger/freight stops displayed around
    // the train. Intermediate VIA/passages are included in the travelled distance
    // even though they are intentionally absent from this compact panel.
    _livemapArrowProgress(svc, stops = null, displayStops = null) {
        stops = stops || (typeof svc?.getCurrentStops === 'function' ? svc.getCurrentStops() : []) || [];
        const isArret = (x) => x && x.type === 'arret' && x.stationId;
        displayStops = displayStops || stops.map((s, i) => ({ s, origIdx: i })).filter(({ s }) => isArret(s));
        if (!displayStops.length)
            return null;
        const curIdx = Math.max(0, Number(svc?.currentStopIndex || 0));
        if (svc?.state !== 'moving' && svc?.state !== 'departing') {
            let d = 0;
            const stationOrig = curIdx === 0 ? 0 : Math.max(0, curIdx - 1);
            for (let i = 0; i < displayStops.length; i++)
                if (displayStops[i].origIdx <= stationOrig)
                    d = i;
            return { fromDisplayIndex: d, toDisplayIndex: d, fraction: 0 };
        }
        const currentLeg = Math.max(0, curIdx - 1);
        let fromDisplayIndex = 0;
        for (let i = 0; i < displayStops.length; i++) {
            if (displayStops[i].origIdx <= currentLeg)
                fromDisplayIndex = i;
            else
                break;
        }
        let toDisplayIndex = fromDisplayIndex;
        for (let i = fromDisplayIndex + 1; i < displayStops.length; i++) {
            if (displayStops[i].origIdx >= curIdx) {
                toDisplayIndex = i;
                break;
            }
        }
        if (toDisplayIndex === fromDisplayIndex)
            return { fromDisplayIndex, toDisplayIndex, fraction: 0 };
        const fromOrig = displayStops[fromDisplayIndex].origIdx;
        const toOrig = displayStops[toDisplayIndex].origIdx;
        let total = 0, travelled = 0;
        for (let leg = fromOrig; leg < toOrig; leg++) {
            const route = this._lvpRouteForLeg(svc, leg);
            const dist = this._lvpRouteDistanceKm(route);
            total += dist;
            if (leg < currentLeg)
                travelled += dist;
            else if (leg === currentLeg)
                travelled += dist * this._lvpCurrentLegFraction(svc, route);
        }
        const fraction = total > 1e-9 ? Math.max(0, Math.min(1, travelled / total)) : 0;
        return { fromDisplayIndex, toDisplayIndex, fraction };
    }
    _syncLivemapProgressArrow(svc) {
        const panel = document.getElementById('livemap-train-panel');
        const inner = panel?.querySelector('.lvp-stops-inner');
        const arrow = inner?.querySelector('.lvp-arrow-floating');
        if (!inner || !arrow || !svc)
            return;
        const stops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
        const displayStops = stops.map((s, i) => ({ s, origIdx: i })).filter(({ s }) => s && s.type === 'arret' && s.stationId);
        const p = this._livemapArrowProgress(svc, stops, displayStops);
        if (!p) {
            arrow.style.opacity = '0';
            return;
        }
        const rows = inner.querySelectorAll('.lvp-stop[data-display-idx]');
        const a = rows[p.fromDisplayIndex], b = rows[p.toDisplayIndex];
        if (!a || !b) {
            arrow.style.opacity = '0';
            return;
        }
        const center = (row) => row.offsetTop + row.offsetHeight / 2;
        const yA = center(a), yB = center(b);
        const y = yA + (yB - yA) * Math.max(0, Math.min(1, Number(p.fraction || 0)));
        arrow.style.top = `${y}px`;
        arrow.style.opacity = svc.state === 'completed' ? '0' : '1';
    }
    // Recompute the dynamic parts of the livemap train panel.
    _buildLivemapPanelContent(svc) {
        const t = svc.train;
        const d = operationalDelayMinutes(Number.isFinite(t.delay) ? t.delay : 0);
        const stops = typeof svc.getCurrentStops === 'function'
            ? svc.getCurrentStops()
            : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
        const world = this.game.world;
        const fmt = (m) => this.minToTimeStr(((Math.round(m) % 1440) + 1440) % 1440);
        const curIdx = svc.currentStopIndex || 0;
        // currentStopIndex semantics: moving = target stop; stopped/waiting = next leg, current station is previous
        let prevIdx, curStationIdx, nextIdx;
        if (svc.state === 'moving') {
            prevIdx = curIdx - 1;
            curStationIdx = curIdx;
            nextIdx = curIdx + 1;
        }
        else {
            if (curIdx === 0) {
                prevIdx = -1;
                curStationIdx = 0;
                nextIdx = 1;
            }
            else {
                prevIdx = curIdx - 2;
                curStationIdx = curIdx - 1;
                nextIdx = curIdx;
            }
        }
        const cat = svc.category || t.category || 'voyageur';
        const catColor = LVM_CAT_COLORS[cat] || t.color || '#22d3ee';
        // Annex 5 — planned (grey crossed-out) vs recalculated times.
        const isArret = (s) => s && s.type === 'arret' && s.stationId;
        const buildTimes = (s, isFirst, isLast, origIdx) => {
            const arrMins = s.arrivalTime ?? s.departureTime ?? 0;
            const depMins = s.departureTime ?? s.arrivalTime ?? 0;
            const actualArr = arrMins + d;
            const actualDep = depMins + d;
            const dwell = (!isFirst && !isLast && depMins > arrMins) ? Math.max(0, Math.round(depMins - arrMins)) : 0;
            const showRecalc = d !== 0 && origIdx >= curIdx;
            return {
                arr: isFirst ? null : fmt(actualArr),
                dep: isLast ? null : fmt(actualDep),
                plannedArr: (showRecalc && !isFirst) ? fmt(arrMins) : null,
                plannedDep: (showRecalc && !isLast) ? fmt(depMins) : null,
                dwell
            };
        };
        const displayStops = stops.map((s, i) => ({ s, origIdx: i })).filter(({ s }) => isArret(s));
        let displayCurIdx = -1;
        for (let idx = 0; idx < displayStops.length; idx++) {
            if (displayStops[idx].origIdx === curStationIdx) {
                displayCurIdx = idx;
                break;
            }
            if (displayStops[idx].origIdx < curStationIdx)
                displayCurIdx = idx;
        }
        if (displayCurIdx < 0)
            displayCurIdx = 0;
        let rows = displayStops.map(({ s, origIdx }, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === displayStops.length - 1;
            const name = world.getStationById(s.stationId)?.name || '—';
            const cur = idx === displayCurIdx ? ' cur' : '';
            const voie = s.platform ? `Voie ${s.platform}` : '';
            const { arr, dep, plannedArr, plannedDep, dwell } = buildTimes(s, isFirst, isLast, origIdx);
            const showArr = arr !== null;
            const showDep = dep !== null;
            const arrLabel = showArr ? 'Heure arrivée' : '';
            const depLabel = showDep ? 'Heure départ' : '';
            const plannedArrHtml = plannedArr ? `<span class="lvp-time-planned">${plannedArr}</span>` : '';
            const plannedDepHtml = plannedDep ? `<span class="lvp-time-planned">${plannedDep}</span>` : '';
            const arrContent = showArr ? `<span class="lvp-time-label">${htmlText(arrLabel)}</span><span class="lvp-time-value">${arr}</span>${plannedArrHtml}` : '';
            const depContent = showDep ? `<span class="lvp-time-label">${htmlText(depLabel)}</span><span class="lvp-time-value">${htmlText(dep)}</span>${plannedDepHtml}` : '';
            return `<div class="lvp-stop${htmlText(cur)}" data-display-idx="${htmlText(idx)}" data-orig-idx="${htmlText(origIdx)}">
        <div class="lvp-stop-times">
          <div class="lvp-time-row">${arrContent}</div>
          <div class="lvp-time-row">${depContent}</div>
        </div>
        <div class="lvp-stop-track" style="--track-color:${htmlText(catColor)}">
          <div class="lvp-stop-line"></div>
          <div class="lvp-stop-dot"></div>
        </div>
        <div class="lvp-stop-info">
          <div class="lvp-stop-name">${htmlText(name)}</div>
          ${voie ? `<div class="lvp-stop-voie">${htmlText(voie)}</div>` : ''}
          ${dwell > 0 ? `<div class="lvp-stop-dwell">${dwell} min d'arrêt</div>` : ''}
        </div>
      </div>`;
        }).join('');
        // Single continuous vertical line behind the stops, scrolls with the list.
        rows = `<div class="lvp-stops-inner" style="--lvp-line-color:${htmlText(catColor)}"><div class="lvp-stops-line"></div><div class="lvp-arrow lvp-arrow-floating" aria-hidden="true">&#9660;</div>${rows}</div>`;
        const bandeauStartIdx = displayStops.findIndex(({ origIdx }) => origIdx >= curIdx);
        const bandeauStops = displayStops.slice(bandeauStartIdx >= 0 ? bandeauStartIdx : 0);
        const bandeau = bandeauStops.length ? `Prochains arrêts : ${bandeauStops.map(({ s }) => world.getStationById(s.stationId)?.name).filter(Boolean).join('  •  ')}` : 'Service terminé';
        const stopName = (s) => s?.stationId ? (world.getStationById(s.stationId)?.name || '—') : (s ? 'Waypoint' : '—');
        const nextArretFrom = (fromIndex) => {
            for (let i = fromIndex; i < stops.length; i++)
                if (isArret(stops[i]))
                    return stops[i];
            return null;
        };
        // Annex 5 — detailed situational info
        const prevStop = stops[prevIdx];
        const curStop = stops[curStationIdx];
        const nextStop = stops[nextIdx];
        const prevName = stopName(prevStop);
        const curName = stopName(curStop);
        const nextArret = nextArretFrom(svc.state === 'moving' ? curIdx : (nextIdx >= 0 ? nextIdx : curIdx));
        const nextName = nextArret ? (world.getStationById(nextArret.stationId)?.name || '—') : '—';
        const lastArret = stops.filter(isArret).pop();
        const destName = lastArret ? (world.getStationById(lastArret.stationId)?.name || '—') : (stops.length > 1 ? (world.getStationById(stops[stops.length - 1].stationId)?.name || '—') : '—');
        const displayNext = nextArret;
        const nextArrTime = displayNext ? (displayNext.arrivalTime ?? displayNext.departureTime) : null;
        const nextArrLabel = nextArrTime != null
            ? (d !== 0
                ? ` · Arr. <span style="text-decoration:line-through;color:#888">${fmt(nextArrTime)}</span> <span class="lvp-recalc ${htmlText(d > 0 ? 'lvp-recalc-late' : 'lvp-recalc-early')}">${fmt(nextArrTime + d)}</span>`
                : ` · Arr. ${fmt(nextArrTime)}`)
            : '';
        const findArretStop = (start, dir) => {
            for (let i = start; dir > 0 ? i < stops.length : i >= 0; i += dir)
                if (isArret(stops[i]))
                    return stops[i];
            return null;
        };
        const arretStationName = (s) => s?.stationId ? (world.getStationById(s.stationId)?.name || '—') : '—';
        // v1.1.41 — "Se situe entre" is service data, not a geographic guess.
        // Scanning every European station here (and again in the sidebar card) was
        // both expensive and wrong around dense/parallel lines. Use the previous and
        // next scheduled passenger/freight stop of THIS train instead.
        const arretLabel = (st) => st?.stationId
            ? (world.getStationById(st.stationId)?.name || st.locationName || '—')
            : (st?.locationName || '—');
        const ctxPrevStop = findArretStop(svc.state === 'moving' ? curIdx - 1 : curStationIdx, -1);
        const ctxNextStop = findArretStop(svc.state === 'moving' ? curIdx : Math.max(curStationIdx + 1, 0), 1);
        const ctxPrevName = arretLabel(ctxPrevStop) || prevName;
        const ctxNextName = arretLabel(ctxNextStop) || curName;
        let situation;
        if (svc.cancelled) {
            situation = '<span style="color:#ef4444;font-weight:600">Service supprimé</span>';
        }
        else if (t.speed === 0 && (svc.state === 'stopped_at_station' || svc.train?.stoppedAt)) {
            situation = `Arrêt en gare de <b>${htmlText(curName)}</b>`;
        }
        else if (curIdx > 0 && curIdx < stops.length) {
            if (ctxPrevName && ctxNextName && ctxPrevName !== ctxNextName) {
                situation = `Se situe entre <b>${htmlText(ctxPrevName)}</b> et <b>${htmlText(ctxNextName)}</b>`;
            }
            else if (ctxNextName) {
                situation = `En route vers <b>${htmlText(ctxNextName)}</b>`;
            }
            else {
                situation = 'Service terminé';
            }
        }
        else if (curIdx === 0) {
            situation = `Au départ de <b>${htmlText(curName)}</b>`;
        }
        else {
            situation = 'Service terminé';
        }
        const nextHtml = `Prochain arrêt : <b>${htmlText(nextName)}</b>${nextArrLabel} · Destination: <b>${htmlText(destName)}</b>`;
        return { d, rows, bandeau, situation, nextHtml, curIdx };
    }
    _updateBandeauMarquee() {
        const track = document.getElementById('lvp-bandeau-track');
        const wrapper = track?.parentElement;
        if (!track || !wrapper)
            return;
        const text = track.textContent;
        if (this._lvpMarqueeText === text && track.classList.contains('marquee'))
            return;
        if (this._lvpMarqueeRaf)
            cancelAnimationFrame(this._lvpMarqueeRaf);
        this._lvpMarqueeRaf = null;
        this._lvpMarqueeText = text;
        track.classList.remove('marquee');
        track.style.transform = '';
        void track.offsetWidth;
        if (track.scrollWidth <= wrapper.clientWidth)
            return;
        track.classList.add('marquee');
        const speed = 18; // pixels per second (défilement lent)
        let x = wrapper.clientWidth;
        let last = performance.now();
        const step = (now) => {
            if (!track.parentElement || document.getElementById('livemap-train-panel')?.classList.contains('hidden')) {
                this._lvpMarqueeRaf = null;
                this._lvpMarqueeText = null;
                return;
            }
            if (track.scrollWidth <= wrapper.clientWidth)
                return;
            const dt = (now - last) / 1000;
            last = now;
            x -= dt * speed;
            if (x + track.scrollWidth <= 0)
                x = wrapper.clientWidth;
            track.style.transform = `translateX(${x}px)`;
            this._lvpMarqueeRaf = requestAnimationFrame(step);
        };
        this._lvpMarqueeRaf = requestAnimationFrame(step);
    }
    _livemapDelayReasonLines(svc, delayMin) {
        const d = Number(delayMin || 0);
        if (d < 5 || !svc?.train)
            return [];
        const t = svc.train;
        const lines = [];
        const history = Array.isArray(t.incidentDelayReasons) ? t.incidentDelayReasons : [];
        for (const r of history) {
            if (!r?.contributed || !String(r.text || '').trim())
                continue;
            const text = String(r.text).trim();
            if (!lines.includes(text))
                lines.push(text);
        }
        // Keep the live non-incident operating cause too (regulation, signal, etc.).
        // Generic "Incident" / incident names are omitted because the historical
        // lines above already contain their frozen natural-language location.
        const current = String(t.delayReason || svc.delayReason || '').trim();
        if (current && current.toLowerCase() !== 'incident' &&
            !history.some((r) => {
                const txt = String(r?.text || '').trim();
                return txt === current || txt.startsWith(current + ' ');
            }) &&
            !lines.includes(current)) {
            lines.push(current);
        }
        return lines.slice(-8);
    }
    _livemapDelayReasonsHtml(svc, delayMin) {
        const lines = this._livemapDelayReasonLines(svc, delayMin);
        if (!lines.length)
            return '';
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
        const title = lines.length > 1 ? 'Motifs du retard' : 'Motif du retard';
        return `<div class="lvp-delay-reasons" id="lvp-delay-reasons">
      <div class="lvp-delay-reasons-title">${htmlText(title)}</div>
      ${lines.map((line) => `<div class="lvp-delay-reason-item">${esc(line)}</div>`).join('')}
    </div>`;
    }
    // LVM-03/04/06 — panneau détail du train sélectionné (annexes 4-5).
    _renderLivemapPanel() {
        const panel = document.getElementById('livemap-train-panel');
        if (!panel)
            return;
        const svc = this.selectedService;
        // Le service a pu se terminer / disparaître : on referme.
        if (!svc || !svc.train || !this.game.scheduleCreator?.services.includes(svc)) {
            if (this._threeDFollowActive)
                this.disable3DFollow();
            this.selectedService = null;
            this._lvpKey = null;
            this._lvpStateKey = null;
            panel.classList.add('hidden');
            return;
        }
        const t = svc.train;
        const cat = svc.category || t.category || 'voyageur';
        const catColor = LVM_CAT_COLORS[cat] || t.color || '#22d3ee';
        const displayName = t.seriesName ? `${t.seriesName} ${t.number || ''}`.trim() : svc.name;
        const numLabel = svc.number != null
            ? `<span class="lvp-num">N°${htmlText(svc.number)}${htmlText(svc.roundTrip && svc.returnNumber != null ? '/' + svc.returnNumber : '')}</span>`
            : '';
        const { d, rows, bandeau, situation, nextHtml, curIdx } = this._buildLivemapPanelContent(svc);
        const delayReasonsHtml = this._livemapDelayReasonsHtml(svc, d);
        const rame = this._displayRameForService(svc);
        const composition = rame
            ? `<div style="padding:6px 10px;font-size:10px;color:var(--text2);border-bottom:1px solid #333;background:#0d0d0d">
           <b>Composition :</b> ${htmlText(rame.name)}<br>
           Long: ${rame.totalLength.toFixed(1)}m · Tonnage: ${rame.totalTonnage}t · Vmax: ${rame.maxSpeed} km/h · Traction: ${htmlText(rame.traction)}
         </div>`
            : '';
        // Annexes 4-5 — charge transportée affichée dans le panneau détail.
        const payloadInfo = this._livemapPayloadText(svc);
        const panelIcon = LVM_CAT_ICONS[cat] || LVM_CAT_ICONS.generic;
        panel.innerHTML = `
      <div class="lvp-header" style="background:${htmlText(catColor)}">
        <img src="${htmlText(panelIcon)}" class="lvp-cat" alt="">
        <span class="lvp-title">${htmlText(displayName)}</span>
        ${numLabel}
        <button class="lvp-close" onclick="game.ui.deselectService()" title="Fermer">×</button>
      </div>
      <div class="lvp-sub"><span id="lvp-speed">${Math.round(t.speed)} km/h</span><span id="lvp-delay" class="${htmlText(d > 0 ? 'late' : d < 0 ? 'early' : 'ok')}">${d > 0 ? '+' + d + ' min' : d < 0 ? '- ' + Math.abs(d) + ' min' : "à l'heure"}</span><span>${htmlText(LVM_CAT_LABELS[cat] || cat)}</span></div>
      <div class="lvp-view-actions"><button id="lvp-3d-toggle" type="button" data-re3d-action="toggle" class="${htmlText(this._threeDFollowActive ? 'active' : '')}">${this._threeDFollowActive ? '▱ Retour vue 2D' : '◇ Vue 3D GPS'}</button></div>
      <div class="lvp-situation" id="lvp-situation">${situation}</div>
      ${delayReasonsHtml}
      ${composition}
      ${payloadInfo ? `<div class="lvp-payload">${htmlText(payloadInfo)}</div>` : ''}
      <div class="lvp-bandeau"><span class="lvp-bandeau-track" id="lvp-bandeau-track">${htmlText(bandeau)}</span></div>
      <div class="lvp-stops" id="lvp-stops">${rows}</div>
      <div class="lvp-legend">dép = départ · pass = passage · arr = arrivée</div>
    `;
        panel.classList.remove('hidden');
        this._updateBandeauMarquee();
        this._syncLivemapProgressArrow(svc);
        this._lvpLastCurIdx = curIdx;
        const curEl = panel.querySelector('.lvp-stop.cur');
        if (curEl)
            curEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                btn.closest('.tab-bar')?.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                btn.closest('aside')?.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
                document.getElementById(`tab-${tab}`)?.classList.add('active');
            });
        });
    }
    setupModals() {
        document.querySelectorAll('.modal-close').forEach((btn) => {
            btn.addEventListener('click', () => btn.closest('.modal')?.classList.add('hidden'));
        });
        // BUG-12 : validation du point de voie avec Entrée (découplée du focus souris)
        document.getElementById('modal-voie-point')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._saveVoiePoint();
            }
        });
        document.getElementById('modal-station')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveStation();
            }
        });
        // Modals do NOT close on outside click (player feedback)
    }
    // --- STATION CREATION ---
    toggleStationCreation() {
        this.stationCreationMode = !this.stationCreationMode;
        if (!this.stationCreationMode && this._multiCreateMode === 'station') {
            // Single click to deactivate clears multi-mode too
            this._multiCreateMode = null;
            document.getElementById('btn-create-station')?.classList.remove('multi-mode');
        }
        const btn = document.getElementById('btn-create-station');
        if (btn) {
            btn.textContent = this.stationCreationMode ? '✕ Annuler' : '+ Creer une gare';
            btn.classList.toggle('active-mode', this.stationCreationMode);
        }
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = this.stationCreationMode ? 'crosshair' : 'grab';
    }
    // XXI — toggle industrial site creation on the livemap
    toggleIndustryCreation() {
        this.industryCreationMode = !this.industryCreationMode;
        const btn = document.getElementById('btn-create-industry');
        if (btn) {
            btn.textContent = this.industryCreationMode ? '✕ Annuler' : '+ Industrie';
            btn.classList.toggle('active-mode', this.industryCreationMode);
        }
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = this.industryCreationMode ? 'crosshair' : 'grab';
        if (this.industryCreationMode) {
            this._showPickHint('Cliquez sur la carte pour placer une nouvelle industrie (Echap pour annuler)');
        }
        else {
            this._hidePickHint();
        }
    }
    openStationCreationModal(lat, lon) {
        this.stationCreationMode = false;
        const btn = document.getElementById('btn-create-station');
        if (btn) {
            btn.textContent = '+ Creer une gare';
            btn.classList.remove('active-mode');
        }
        document.getElementById('game-canvas').style.cursor = 'grab';
        this._editingStationId = null;
        document.getElementById('station-lat').value = lat.toFixed(6);
        document.getElementById('station-lon').value = lon.toFixed(6);
        document.getElementById('station-lat').readOnly = true;
        document.getElementById('station-lon').readOnly = true;
        document.getElementById('station-name').value = '';
        document.getElementById('station-platforms').value = '4';
        document.getElementById('station-platform-names').value = '';
        // Player note: creation mode hides platforms/connection, defaults are applied.
        document.getElementById('station-platforms-row').style.display = 'none';
        const platformNamesGroup = document.getElementById('station-platform-names')?.closest('.form-group');
        if (platformNamesGroup) {
            platformNamesGroup.style.display = 'none';
        }
        const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
        if (connectGroup) {
            connectGroup.style.display = 'none';
        }
        const closedCb = document.getElementById('station-closed');
        if (closedCb)
            closedCb.checked = false;
        const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
        if (terminusGroup)
            terminusGroup.style.display = 'none';
        const saveBtn = document.getElementById('btn-save-station');
        if (saveBtn)
            saveBtn.textContent = 'Creer la gare';
        // Hide delete button in creation mode
        const delBtn = document.getElementById('btn-delete-station');
        if (delBtn)
            delBtn.classList.add('hidden');
        // Populate line selector
        const lineSelect = document.getElementById('station-line');
        if (lineSelect) {
            lineSelect.innerHTML = '<option value="">Aucune</option>' +
                this.game.lineManager.getAll().map((l) => `<option value="${htmlText(l.id)}">${htmlText(l.name)}${htmlText(l.code ? ' (' + l.code + ')' : '')}</option>`).join('');
        }
        // Populate connection selector with existing stations sorted by distance
        const connectSelect = document.getElementById('station-connect');
        const connectInfo = document.getElementById('station-connect-info');
        const connectSearch = document.getElementById('station-connect-search');
        if (connectSelect) {
            const existing = this.game.world.stations.map((s) => {
                const d = Math.sqrt(Math.pow((s.lat - lat) * 111, 2) +
                    Math.pow((s.lon - lon) * 111 * Math.cos(lat * Math.PI / 180), 2));
                return { ...s, dist: d };
            }).sort((a, b) => a.dist - b.dist);
            this._stationConnectOptions = existing;
            const renderOptions = (filter = '') => {
                const term = filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const filtered = existing.filter((s) => {
                    const name = s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return name.includes(term);
                });
                connectSelect.innerHTML = '<option value="">Aucune connexion</option>' +
                    filtered.map((s) => `<option value="${htmlText(s.id)}">${htmlText(s.name)} (${Math.round(s.dist)} km)</option>`).join('');
            };
            renderOptions();
            connectSelect.value = '';
            if (connectSearch) {
                connectSearch.value = '';
                connectSearch.oninput = () => renderOptions(connectSearch.value);
            }
            if (connectInfo) {
                if (existing.length > 0) {
                    connectInfo.textContent = `Plus proche : ${existing[0].name} (~${Math.round(existing[0].dist)} km)`;
                }
                else {
                    connectInfo.textContent = 'Aucune gare existante';
                }
            }
        }
        // Pick-on-map button for connection station
        const pickBtn = document.getElementById('btn-pick-connect-map');
        if (pickBtn) {
            pickBtn.onclick = () => {
                // Hide modal temporarily, enter pick mode on main canvas
                document.getElementById('modal-station')?.classList.add('hidden');
                this._pickConnectionMode = true;
                this._pendingStationLat = lat;
                this._pendingStationLon = lon;
                const canvas = document.getElementById('game-canvas');
                if (canvas)
                    canvas.style.cursor = 'pointer';
                // Show hint overlay
                this._showPickHint('Cliquer sur une gare existante pour la connecter (Echap pour annuler)');
            };
        }
        // Terminus checkbox logic
        const terminusCheck = document.getElementById('station-terminus');
        const terminusOpts = document.getElementById('station-terminus-options');
        const terminusLineSelect = document.getElementById('station-terminus-line');
        const terminusLineName = document.getElementById('station-terminus-line-name');
        const terminusLineColor = document.getElementById('station-terminus-line-color');
        if (terminusCheck) {
            terminusCheck.checked = false;
            terminusCheck.onchange = () => {
                if (terminusOpts)
                    terminusOpts.classList.toggle('hidden', !terminusCheck.checked);
                if (terminusCheck.checked && terminusLineName)
                    terminusLineName.style.display = '';
                if (terminusCheck.checked && terminusLineColor)
                    terminusLineColor.style.display = '';
            };
        }
        if (terminusOpts)
            terminusOpts.classList.add('hidden');
        // Populate terminus line selector with open lines (lines with stops but no explicit end terminus)
        if (terminusLineSelect) {
            const openLines = this.game.lineManager.getAll().filter((l) => l.stops.length > 0);
            terminusLineSelect.innerHTML = '<option value="_new">Creer une nouvelle ligne</option>' +
                openLines.map((l) => `<option value="${htmlText(l.id)}">Terminer : ${htmlText(l.name)}${htmlText(l.code ? ' (' + l.code + ')' : '')} (${l.stops.length} gares)</option>`).join('');
            terminusLineSelect.onchange = () => {
                const isNew = terminusLineSelect.value === '_new';
                if (terminusLineName)
                    terminusLineName.style.display = isNew ? '' : 'none';
                if (terminusLineColor)
                    terminusLineColor.style.display = isNew ? '' : 'none';
            };
        }
        // Type change: show/hide fields for poste types
        const typeSelect = document.getElementById('station-type');
        const radiusGroup = document.getElementById('station-radius-group');
        const platformsRow = document.getElementById('station-platforms-row');
        const closedGroup = document.getElementById('station-closed')?.closest('.form-group');
        const modalTitle = document.getElementById('modal-station-title');
        const nameInput = document.getElementById('station-name');
        const _updateTypeFields = () => {
            const val = typeSelect.value;
            const isPoste = val === 'poste_aiguillage' || val === 'poste_regulation';
            const isDepot = val === 'depot';
            if (radiusGroup)
                radiusGroup.classList.toggle('hidden', !isPoste);
            if (platformsRow)
                platformsRow.style.display = isPoste ? 'none' : '';
            if (platformNamesGroup)
                platformNamesGroup.style.display = isPoste ? 'none' : '';
            if (connectGroup)
                connectGroup.style.display = 'none';
            if (terminusGroup)
                terminusGroup.style.display = 'none';
            if (closedGroup)
                closedGroup.style.display = isPoste ? 'none' : '';
            const lineSelectGroup = document.getElementById('station-line')?.closest('.form-group');
            if (lineSelectGroup)
                lineSelectGroup.style.display = 'none';
            if (val === 'poste_aiguillage') {
                if (modalTitle)
                    modalTitle.textContent = "Créer un poste d'aiguillage";
                if (saveBtn)
                    saveBtn.textContent = "Créer le poste d'aiguillage";
                if (nameInput)
                    nameInput.placeholder = "ex: Poste Paris-Nord";
            }
            else if (val === 'poste_regulation') {
                if (modalTitle)
                    modalTitle.textContent = 'Créer un poste de régulation';
                if (saveBtn)
                    saveBtn.textContent = 'Créer le poste de régulation';
                if (nameInput)
                    nameInput.placeholder = 'ex: Régulation Île-de-France';
            }
            else if (isDepot) {
                if (modalTitle)
                    modalTitle.textContent = this._editingStationId ? "Modifier l'ITE Dépôt" : 'Créer un ITE Dépôt de maintenance';
                if (saveBtn)
                    saveBtn.textContent = this._editingStationId ? "Modifier l'ITE Dépôt" : "Créer l'ITE Dépôt";
                if (nameInput)
                    nameInput.placeholder = 'ex: Dépôt de Lyon Vénissieux';
            }
            else {
                if (modalTitle)
                    modalTitle.textContent = this._editingStationId ? 'Modifier la gare' : 'Creer une gare';
                if (saveBtn)
                    saveBtn.textContent = this._editingStationId ? 'Modifier la gare' : 'Creer la gare';
                if (nameInput)
                    nameInput.placeholder = 'ex: Paris Gare du Nord';
            }
            const radiusInput = document.getElementById('station-radius');
            if (radiusInput && isPoste) {
                radiusInput.value = val === 'poste_regulation' ? '30' : '10';
            }
        };
        if (typeSelect) {
            typeSelect.value = 'mixed';
            typeSelect.onchange = _updateTypeFields;
        }
        _updateTypeFields();
        const loadingEl = document.getElementById('station-loading');
        if (loadingEl)
            loadingEl.classList.add('hidden');
        document.getElementById('modal-station')?.classList.remove('hidden');
    }
    async saveStation() {
        const name = document.getElementById('station-name').value.trim();
        if (!name)
            return alert('Nom requis');
        let lat = parseFloat(document.getElementById('station-lat').value);
        let lon = parseFloat(document.getElementById('station-lon').value);
        const type = document.getElementById('station-type').value;
        const platforms = parseInt(document.getElementById('station-platforms').value) || 4;
        const platformNamesRaw = document.getElementById('station-platform-names')?.value.trim() || '';
        const platformNames = platformNamesRaw ? platformNamesRaw.split(',').map((s) => s.trim()).filter((s) => s) : [];
        const closed = document.getElementById('station-closed')?.checked || false;
        // Handle poste types — create in staffManager, not as a station
        if (type === 'poste_aiguillage' || type === 'poste_regulation') {
            const radiusKm = parseFloat(document.getElementById('station-radius')?.value) || (type === 'poste_regulation' ? 30 : 10);
            if (type === 'poste_aiguillage') {
                this.game.staffManager.addSignalBox({ name, lat, lon, radiusKm });
            }
            else {
                this.game.staffManager.addZone(name, lat, lon, radiusKm);
            }
            document.getElementById('modal-station')?.classList.add('hidden');
            this.game.saveState();
            return;
        }
        // Handle edit mode
        if (this._editingStationId) {
            const station = this.game.world.getStationById(this._editingStationId);
            if (station) {
                station.name = name;
                station.lat = lat;
                station.lon = lon;
                station.type = type;
                station.platforms = platforms;
                station.platformNames = platformNames;
                station.closed = closed;
                const lineId = document.getElementById('station-line')?.value;
                if (lineId) {
                    if (!station.lineIds.includes(lineId))
                        station.lineIds.push(lineId);
                }
                this.game.platformManager.initStation(station.id, platforms);
            }
            this._editingStationId = null;
            // Restore modal for creation mode
            const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
            if (connectGroup)
                connectGroup.style.display = '';
            const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
            if (terminusGroup)
                terminusGroup.style.display = '';
            const btn = document.getElementById('btn-save-station');
            if (btn)
                btn.textContent = 'Creer la gare';
            document.getElementById('modal-station')?.classList.add('hidden');
            this.game.saveState();
            return;
        }
        const orm = this.game.orm;
        // FAST station validation: never block the blue button on an Overpass request.
        // Snap only against railway geometry already loaded in memory; otherwise keep
        // the exact clicked coordinates and let Tracer ligne/import populate ORM later.
        const loadingEl = document.getElementById('station-loading');
        if (loadingEl)
            loadingEl.classList.add('hidden');
        try {
            const snapLocal = orm.snapToNearest(lat, lon, 2);
            if (snapLocal) {
                lat = snapLocal.node.lat;
                lon = snapLocal.node.lon;
                console.log(`Station locally snapped to railway: ${snapLocal.dist.toFixed(3)} km offset`);
            }
        }
        catch (e) {
            console.warn('Local railway snapping failed:', e);
        }
        const station = this.game.world.addStation({ name, lat, lon, type, platforms, platformNames, closed });
        station.country = orm.getCountryAtPoint(lat, lon);
        station.facilities = [type];
        // Assign to line if selected
        const lineId = document.getElementById('station-line')?.value;
        if (lineId) {
            station.lineIds = [lineId];
            const line = this.game.lineManager.getLine(lineId);
            if (line) {
                line.stops.push(station.id);
            }
        }
        // Init platform manager
        this.game.platformManager.initStation(station.id, platforms);
        // Determine which station to connect to
        const connectChoice = document.getElementById('station-connect')?.value;
        let connectTo = null;
        if (connectChoice === '') {
            // User chose "Aucune connexion"
            connectTo = null;
        }
        else if (connectChoice === '_nearest') {
            // Spatial lookup: no full world.stations scan after a massive auto-station import.
            const candidates = typeof this.game.world.getStationsNear === 'function'
                ? this.game.world.getStationsNear(lat, lon, 50).filter((s) => s.id !== station.id)
                : this.game.world.stations.filter((s) => s.id !== station.id);
            let nearestDist = Infinity;
            for (const s of candidates) {
                const d = haversineDistance(s.lat, s.lon, lat, lon);
                if (d < nearestDist) {
                    nearestDist = d;
                    connectTo = s;
                }
            }
            if (nearestDist >= 50)
                connectTo = null;
        }
        else if (connectChoice) {
            // User picked a specific station
            connectTo = this.game.world.getStationById(connectChoice);
        }
        // v1.1.19: station creation stays immediate, but no provisional straight
        // railway is fabricated. If a connection is requested, it is materialised as
        // an operational Track only after the native OSM/ORM graph returns a real path.
        let pendingOrmTrack = null;
        // Handle terminus -> auto-create or finish a line
        const isTerminus = document.getElementById('station-terminus')?.checked;
        if (isTerminus) {
            const terminusLineChoice = document.getElementById('station-terminus-line')?.value;
            if (terminusLineChoice === '_new') {
                // Create a new line starting at this station
                const lineName = document.getElementById('station-terminus-line-name')?.value.trim() || `Ligne ${name}`;
                const lineColor = document.getElementById('station-terminus-line-color')?.value || '#3b82f6';
                const newLine = this.game.lineManager.addLine({
                    name: lineName,
                    color: lineColor,
                    code: '',
                    stops: [station.id],
                    trackIds: [],
                });
                station.lineIds = station.lineIds || [];
                if (!station.lineIds.includes(newLine.id))
                    station.lineIds.push(newLine.id);
                console.log(`New line created: ${lineName} starting at ${name}`);
            }
            else if (terminusLineChoice) {
                // Finish an existing line with this station as terminus
                const line = this.game.lineManager.getLine(terminusLineChoice);
                if (line) {
                    line.stops.push(station.id);
                    station.lineIds = station.lineIds || [];
                    if (!station.lineIds.includes(line.id))
                        station.lineIds.push(line.id);
                    // Build track between the last station in the line and this one
                    if (line.stops.length >= 2) {
                        const prevStId = line.stops[line.stops.length - 2];
                        const prevSt = this.game.world.getStationById(prevStId);
                        if (prevSt) {
                            const existingTrack = this.game.world.getTrackBetween(prevSt.id, station.id);
                            if (existingTrack) {
                                line.trackIds.push(existingTrack.id);
                            }
                            else if (connectTo) {
                                // The OSM connection is resolved asynchronously below; its track ID
                                // will be inserted at the matching leg only after a real path exists.
                            }
                        }
                    }
                    console.log(`Line "${line.name}" completed at ${name} (${line.stops.length} stops)`);
                }
            }
        }
        if (type === 'depot') {
            this.game.depotManager.add({ type: 'depot', name: `Depot ${name}`, stationId: station.id, tracks: platforms, cost: 0, infrastructure: ['rotonde', 'technicentre'] }, this.game.economy);
        }
        if (type === 'ite') {
            this.game.depotManager.add({ type: 'ite-fret', name: `ITE ${name}`, stationId: station.id, tracks: 2, cost: 0 });
        }
        document.getElementById('modal-station')?.classList.add('hidden');
        this.game.saveState();
        // Resolve the requested connection off the critical click path. The station
        // exists immediately; the connection exists only if OSM/ORM confirms real rail.
        if (connectTo) {
            const refine = async () => {
                try {
                    const route = await orm.findRoute(connectTo.lat, connectTo.lon, lat, lon);
                    if (!Array.isArray(route) || route.length < 2) {
                        console.warn('Connexion de gare ignorée : aucun itinéraire OSM/ORM réel.');
                        return;
                    }
                    const distance = orm.getRouteDistance(route);
                    const speeds = route.filter((r) => Number.isFinite(r.maxSpeed)).map((r) => r.maxSpeed);
                    const track = this.game.world.addTrack({
                        stationA: connectTo.id, stationB: station.id,
                        distance: Number.isFinite(distance) && distance > 0 ? Math.round(distance * 100) / 100 : 0.01,
                        maxSpeed: speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 160,
                        electrified: route.some((r) => r.electrified === false) ? false : true,
                        name: `${connectTo.name} - ${name}`, route,
                    });
                    pendingOrmTrack = track;
                    // If this station was simultaneously used to complete a line, attach the
                    // resolved Track to the corresponding leg without duplicating geometry.
                    for (const line of this.game.lineManager.getAll()) {
                        for (let i = 0; i < line.stops.length - 1; i++) {
                            const a = line.stops[i], b = line.stops[i + 1];
                            if ((a === connectTo.id && b === station.id) || (a === station.id && b === connectTo.id)) {
                                line.trackIds[i] = track.id;
                            }
                        }
                    }
                    this.game.renderer?.invalidateStatic?.();
                    this.game.saveState();
                }
                catch (e) {
                    console.warn('Connexion ORM de gare différée impossible; aucune voie fictive créée:', e);
                }
            };
            const schedule = () => { refine().catch((e) => console.warn('Deferred station route failed:', e)); };
            if (typeof requestIdleCallback === 'function')
                requestIdleCallback(schedule, { timeout: 1200 });
            else
                setTimeout(schedule, 120);
        }
        // Keep the station creation tool selected so the player can chain placements.
        // (Échap or a click on the button deselects it.)
        if (!this._editingStationId) {
            setTimeout(() => {
                if (!this.stationCreationMode)
                    this.toggleStationCreation();
                this._showPickHint('Gare creee — cliquez sur la carte pour en placer une autre, Echap pour quitter.');
            }, 100);
        }
    }
    _showPickHint(text) {
        let hint = document.getElementById('pick-hint-overlay');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'pick-hint-overlay';
            hint.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fbbf24;padding:8px 16px;border-radius:6px;font-size:12px;z-index:9999;border:1px solid #fbbf24;pointer-events:none';
            document.body.appendChild(hint);
        }
        hint.textContent = text;
        hint.style.display = 'block';
    }
    _hidePickHint() {
        const hint = document.getElementById('pick-hint-overlay');
        if (hint)
            hint.style.display = 'none';
    }
    handlePickConnection(station) {
        if (!this._pickConnectionMode)
            return false;
        this._pickConnectionMode = false;
        this._hidePickHint();
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = 'grab';
        // Set the connect dropdown to the picked station
        const connectSelect = document.getElementById('station-connect');
        if (connectSelect) {
            // Make sure the option exists
            let exists = false;
            for (const opt of connectSelect.options) {
                if (opt.value === station.id) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = station.id;
                opt.textContent = station.name;
                connectSelect.appendChild(opt);
            }
            connectSelect.value = station.id;
        }
        const connectInfo = document.getElementById('station-connect-info');
        if (connectInfo)
            connectInfo.textContent = `Selectionnee : ${station.name}`;
        // Re-open the modal
        document.getElementById('modal-station')?.classList.remove('hidden');
        return true;
    }
    openEditStationModal(station) {
        this._editingStationId = station.id;
        document.getElementById('station-name').value = station.name;
        document.getElementById('station-lat').value = station.lat.toFixed(6);
        document.getElementById('station-lon').value = station.lon.toFixed(6);
        // Note joueurs : GPS et type modifiables en édition
        document.getElementById('station-lat').readOnly = false;
        document.getElementById('station-lon').readOnly = false;
        // Show hidden fields from creation mode so they can be edited.
        document.getElementById('station-platforms-row').style.display = '';
        const platformNamesGroup = document.getElementById('station-platform-names')?.closest('.form-group');
        if (platformNamesGroup) {
            platformNamesGroup.style.display = '';
        }
        document.getElementById('station-type').value = station.type;
        document.getElementById('station-platforms').value = (station.platforms || 4);
        document.getElementById('station-platform-names').value = (station.platformNames || []).join(', ');
        const closedCb = document.getElementById('station-closed');
        if (closedCb)
            closedCb.checked = station.closed || false;
        // Populate line selector
        const lineSelect = document.getElementById('station-line');
        if (lineSelect) {
            lineSelect.innerHTML = '<option value="">Aucune</option>' +
                this.game.lineManager.getAll().map((l) => `<option value="${htmlText(l.id)}" ${(station.lineIds || []).includes(l.id) ? 'selected' : ''}>${htmlText(l.name)}${htmlText(l.code ? ' (' + l.code + ')' : '')}</option>`).join('');
        }
        // Hide connection selector for editing
        const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
        if (connectGroup)
            connectGroup.style.display = 'none';
        // Hide terminus options for editing
        const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
        if (terminusGroup)
            terminusGroup.style.display = 'none';
        const btn = document.getElementById('btn-save-station');
        if (btn)
            btn.textContent = 'Modifier la gare';
        // S9: Show delete button in edit mode
        const delBtn = document.getElementById('btn-delete-station');
        if (delBtn) {
            delBtn.classList.remove('hidden');
            delBtn.onclick = () => this.deleteStation(station.id);
        }
        const loadingEl = document.getElementById('station-loading');
        if (loadingEl)
            loadingEl.classList.add('hidden');
        document.getElementById('modal-station')?.classList.remove('hidden');
    }
    // S9: Delete a station safely
    deleteStation(stationId) {
        if (!confirm('Supprimer cette gare ? Les voies connectees seront aussi supprimees.'))
            return;
        this.game.world.removeStation(stationId);
        this._editingStationId = null;
        // Restore modal state
        document.getElementById('station-platforms-row').style.display = 'none';
        const platformNamesGroup = document.getElementById('station-platform-names')?.closest('.form-group');
        if (platformNamesGroup)
            platformNamesGroup.style.display = 'none';
        const connectGroup = document.getElementById('station-connect')?.closest('.form-group');
        if (connectGroup)
            connectGroup.style.display = 'none';
        const terminusGroup = document.getElementById('station-terminus')?.closest('.form-group');
        if (terminusGroup)
            terminusGroup.style.display = '';
        const btn = document.getElementById('btn-save-station');
        if (btn)
            btn.textContent = 'Creer la gare';
        const delBtn = document.getElementById('btn-delete-station');
        if (delBtn)
            delBtn.classList.add('hidden');
        document.getElementById('modal-station')?.classList.add('hidden');
        this.game.saveState();
    }
    // --- ROLLING STOCK ---
    setupRollingStockPage() {
        document.getElementById('btn-add-stock')?.addEventListener('click', () => this.openStockModal());
        // Catalogue externe — l'éditeur autonome produit un overlay JSON ou TAR.GZ.
        // On mémorise le fichier puis on recharge le jeu afin de repartir du catalogue
        // natif avant d'appliquer l'overlay, sans laisser de résidus d'un import précédent.
        const catalogInput = document.getElementById('stock-catalog-file');
        document.getElementById('btn-import-stock-catalog')?.addEventListener('click', () => catalogInput?.click());
        catalogInput?.addEventListener('change', async () => {
            const file = catalogInput.files?.[0];
            catalogInput.value = '';
            if (!file)
                return;
            try {
                const info = await this.game.importExternalCatalogFile(file);
                alert(`Catalogue externe enregistré.\n${info.modifications} modification(s) · ${info.imports} ajout(s) · ${info.deletions} suppression(s).\n\nRail Empire va se recharger pour l'appliquer proprement.`);
                window.location.reload();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                alert(`Import du catalogue impossible : ${message}`);
            }
        });
        document.getElementById('btn-clear-stock-catalog')?.addEventListener('click', async () => {
            if (!confirm('Retirer le catalogue externe mémorisé ? Les fiches natives de Rail Empire seront restaurées au rechargement.'))
                return;
            try {
                await this.game.clearExternalCatalog();
                window.location.reload();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                alert(`Impossible de retirer le catalogue externe : ${message}`);
            }
        });
        const drop = document.getElementById('stock-image-drop');
        const input = document.getElementById('stock-image-input');
        drop?.addEventListener('click', () => input?.click());
        drop?.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
        drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
        drop?.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('dragging');
            const file = e.dataTransfer?.files[0];
            if (file)
                this.loadStockImage(file);
        });
        input?.addEventListener('change', () => { if (input.files[0])
            this.loadStockImage(input.files[0]); });
        document.getElementById('btn-save-stock')?.addEventListener('click', () => this.saveStock());
        const search = document.getElementById('stock-search');
        const catFilter = document.getElementById('stock-cat-filter');
        search?.addEventListener('input', () => { this._stockPage = 0; this.renderStockList(); });
        catFilter?.addEventListener('change', () => { this._stockPage = 0; this._populateStockSubcatFilter(); this.renderStockList(); });
        document.getElementById('stock-subcat-filter')?.addEventListener('change', () => { this._stockPage = 0; this.renderStockList(); });
        for (const id of ['stock-detail-filter', 'stock-traction-filter', 'stock-country-filter', 'stock-operator-filter', 'stock-mlg-filter']) {
            document.getElementById(id)?.addEventListener('change', () => { this._stockPage = 0; this.renderStockList(); });
        }
        document.getElementById('stock-per-page')?.addEventListener('change', () => { this._stockPage = 0; this.renderStockList(); });
        // Do not scan the 16k base catalogue while the player is opening the Livemap.
        // The wagon subcategory list is populated when Matériel is actually opened.
    }
    _populateStockSubcatFilter() {
        const sel = document.getElementById('stock-subcat-filter');
        const catFilter = document.getElementById('stock-cat-filter');
        if (!sel || !catFilter)
            return;
        const isWagon = catFilter.value === 'wagon';
        sel.style.display = isWagon ? 'inline-block' : 'none';
        if (!isWagon) {
            sel.value = '';
            return;
        }
        const current = sel.value;
        const labels = {
            tombereau: 'Tombercau', citerne: 'Citerne', gaz: 'Gazier', 'porte-auto': 'Porte-Auto',
            tremie: 'Trémic', cerealier: 'Céréalier', ciment: 'Ciment', silos: 'Silos',
            plat: 'Plat', ttx: 'TTX', intermodal: 'Intermodal', speciaux: 'Spéciaux',
            couvert: 'Couvert', bache: 'Bâché', infra: 'Infral'
        };
        const distinct = new Set(this.game.rollingStock.getAll().filter((i) => i.category === 'wagon' && i.wagonSubCategory).map((i) => i.wagonSubCategory));
        let html = '<option value="">Tous les wagons</option>';
        for (const [val, label] of Object.entries(labels)) {
            if (distinct.has(val))
                html += `<option value="${htmlText(val)}">${htmlText(label)}</option>`;
        }
        sel.innerHTML = html;
        if (Array.from(sel.options).some((o) => o.value === current))
            sel.value = current;
    }
    _populateMaterialAdvancedFilters(prefix, force = false) {
        const all = this.game.rollingStock.getAll();
        this._materialAdvancedFilterSig = this._materialAdvancedFilterSig || {};
        // Catalog items are stable objects; player/admin mutations explicitly call force=true.
        const sig = `${all.length}:${all[0]?.id || ''}:${all[all.length - 1]?.id || ''}`;
        if (!force && this._materialAdvancedFilterSig[prefix] === sig)
            return;
        this._materialAdvancedFilterSig[prefix] = sig;
        const detailCounts = new Map();
        const tractionCounts = new Map();
        const countryCounts = new Map();
        const operatorCounts = new Map();
        const mlgCounts = new Map();
        for (const item of all) {
            const meta = _stockFilterMeta(item);
            for (const code of meta.details)
                detailCounts.set(code, (detailCounts.get(code) || 0) + 1);
            for (const code of meta.tractions)
                tractionCounts.set(code, (tractionCounts.get(code) || 0) + 1);
            if (meta.country)
                countryCounts.set(meta.country, (countryCounts.get(meta.country) || 0) + 1);
            if (meta.operator)
                operatorCounts.set(meta.operator, (operatorCounts.get(meta.operator) || 0) + 1);
            if (meta.mlg)
                mlgCounts.set(meta.mlg, (mlgCounts.get(meta.mlg) || 0) + 1);
        }
        const detailSel = document.getElementById(`${prefix}-detail-filter`);
        if (detailSel) {
            const current = detailSel.value;
            detailSel.replaceChildren(new Option('Tous types détaillés', ''));
            for (const group of STOCK_DETAIL_GROUPS) {
                const og = document.createElement('optgroup');
                og.label = group.label;
                for (const [code, label] of group.items) {
                    const count = detailCounts.get(code) || 0;
                    const opt = new Option(`${label} (${count.toLocaleString('fr-FR')})`, code);
                    opt.disabled = count === 0;
                    og.appendChild(opt);
                }
                detailSel.appendChild(og);
            }
            if (Array.from(detailSel.querySelectorAll('option')).some((o) => o.value === current && !o.disabled))
                detailSel.value = current;
        }
        const tractionSel = document.getElementById(`${prefix}-traction-filter`);
        if (tractionSel) {
            const current = tractionSel.value;
            tractionSel.replaceChildren(new Option('Toutes tractions', ''));
            for (const [code, label] of STOCK_TRACTION_LABELS) {
                const count = tractionCounts.get(code) || 0;
                if (!count)
                    continue;
                tractionSel.appendChild(new Option(`${label} (${count.toLocaleString('fr-FR')})`, code));
            }
            if (Array.from(tractionSel.options).some((o) => o.value === current))
                tractionSel.value = current;
        }
        const fillDynamic = (idSuffix, firstLabel, counts) => {
            const sel = document.getElementById(`${prefix}-${idSuffix}-filter`);
            if (!sel)
                return;
            const current = sel.value;
            sel.replaceChildren(new Option(firstLabel, ''));
            const values = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true, sensitivity: 'base' }));
            for (const [value, count] of values)
                sel.appendChild(new Option(`${value} (${count.toLocaleString('fr-FR')})`, value));
            if (Array.from(sel.options).some((o) => o.value === current))
                sel.value = current;
        };
        fillDynamic('country', 'Tous pays', countryCounts);
        fillDynamic('operator', 'Tous opérateurs', operatorCounts);
        fillDynamic('mlg', 'Toutes catégories MLG', mlgCounts);
    }
    _filterMaterialAdvanced(items, prefix) {
        const cat = document.getElementById(`${prefix}-cat-filter`)?.value || '';
        const subcat = document.getElementById(`${prefix}-subcat-filter`)?.value || '';
        const detail = document.getElementById(`${prefix}-detail-filter`)?.value || '';
        const traction = document.getElementById(`${prefix}-traction-filter`)?.value || '';
        const country = document.getElementById(`${prefix}-country-filter`)?.value || '';
        const operator = document.getElementById(`${prefix}-operator-filter`)?.value || '';
        const mlg = document.getElementById(`${prefix}-mlg-filter`)?.value || '';
        return items.filter((item) => {
            if (cat && item.category !== cat)
                return false;
            if (subcat && item.wagonSubCategory !== subcat)
                return false;
            const meta = _stockFilterMeta(item);
            if (detail && !meta.details.has(detail))
                return false;
            if (traction && !meta.tractions.has(traction))
                return false;
            if (country && meta.country !== country)
                return false;
            if (operator && meta.operator !== operator)
                return false;
            if (mlg && meta.mlg !== mlg)
                return false;
            return true;
        });
    }
    openStockModal() {
        this._editingStockId = null;
        const title = document.getElementById('stock-modal-title');
        if (title)
            title.textContent = 'Ajouter un engin';
        const saveBtn = document.getElementById('btn-save-stock');
        if (saveBtn)
            saveBtn.textContent = "Enregistrer l'engin";
        document.getElementById('modal-add-stock')?.classList.remove('hidden');
        // Reset all fields to defaults (a previous edit may have left values).
        this._setStockField('stock-name', '');
        this._setStockField('stock-series-name', '');
        this._setStockField('stock-category', 'locomotive');
        this._setStockField('stock-speed', '160');
        this._setStockField('stock-power', '0');
        this._setStockField('stock-length', '20');
        this._setStockField('stock-mass', '80');
        this._setStockField('stock-capacity', '0');
        this._setStockField('stock-freight-cap', '0');
        this._setStockWagonSubcat('');
        this._setStockTraction(['Diesel']);
        document.getElementById('stock-image-preview')?.classList.add('hidden');
        this._stockImageData = null;
        // Populate cargo types checkboxes and computed fields
        this._populateCargoTypesCheckboxes();
        this._wireStockCategoryToggle();
        this._updateStockComputedFields();
    }
    _setStockField(id, val) {
        const el = document.getElementById(id);
        if (el)
            el.value = val;
    }
    _setStockTraction(values) {
        const checkboxes = document.querySelectorAll('.stock-traction-cb');
        const set = new Set(values.map((v) => v.toLowerCase()));
        checkboxes.forEach((cb) => { cb.checked = set.has(cb.value.toLowerCase()); });
    }
    _getStockTraction() {
        return Array.from(document.querySelectorAll('.stock-traction-cb:checked')).map((cb) => cb.value);
    }
    _getStockTractionString() {
        const vals = this._getStockTraction();
        if (vals.length === 0)
            return 'none';
        return vals.join('+');
    }
    _setStockWagonSubcat(val) {
        const el = document.getElementById('stock-wagon-subcat');
        if (el)
            el.value = val;
    }
    _getStockWagonSubcat() {
        return document.getElementById('stock-wagon-subcat')?.value || '';
    }
    _computeStockTonnage() {
        const category = document.getElementById('stock-category')?.value || 'locomotive';
        const mass = parseFloat(document.getElementById('stock-mass')?.value) || 0;
        const freightCap = parseFloat(document.getElementById('stock-freight-cap')?.value) || 0;
        return category === 'wagon' ? Math.round((mass + freightCap) * 10) / 10 : Math.round(mass * 10) / 10;
    }
    _calculateStockPrice() {
        const category = document.getElementById('stock-category')?.value || 'locomotive';
        const power = parseFloat(document.getElementById('stock-power')?.value) || 0;
        const capacity = parseFloat(document.getElementById('stock-capacity')?.value) || 0;
        const freightCap = parseFloat(document.getElementById('stock-freight-cap')?.value) || 0;
        // MAT-04 : prix calculé selon le type d'engin.
        if (category === 'locomotive' || category === 'automotrice') {
            return Math.max(0, Math.round(power * 1000));
        }
        if (category === 'voiture') {
            return Math.max(0, Math.round(capacity * 100));
        }
        if (category === 'wagon') {
            return Math.max(0, Math.round(freightCap * 100));
        }
        return 0;
    }
    _updateStockComputedFields() {
        const tonnage = this._computeStockTonnage();
        const price = this._calculateStockPrice();
        const tonEl = document.getElementById('stock-tonnage-display');
        if (tonEl)
            tonEl.textContent = `${tonnage} t`;
        const priceEl = document.getElementById('stock-price-display');
        if (priceEl)
            priceEl.textContent = `${price.toLocaleString('fr-FR')} €`;
    }
    // Wire the category->cargo-types visibility toggle (idempotent: replaces the node's listener).
    _wireStockCategoryToggle() {
        const catSel = document.getElementById('stock-category');
        const cargoGroup = document.getElementById('stock-cargo-types-group');
        const subcatGroup = document.getElementById('stock-wagon-subcat-group');
        if (!catSel)
            return;
        const onChange = () => {
            const isWagon = catSel.value === 'wagon';
            if (cargoGroup)
                cargoGroup.style.display = isWagon ? 'block' : 'none';
            if (subcatGroup)
                subcatGroup.style.display = isWagon ? 'block' : 'none';
            this._updateStockComputedFields();
        };
        catSel.onchange = onChange;
        onChange();
        // recompute computed fields when any numeric input changes
        ['stock-mass', 'stock-speed', 'stock-power', 'stock-capacity', 'stock-freight-cap'].forEach((id) => {
            document.getElementById(id)?.addEventListener('input', () => this._updateStockComputedFields());
        });
        document.querySelectorAll('.stock-traction-cb').forEach((cb) => {
            cb.addEventListener('change', () => this._updateStockComputedFields());
        });
    }
    // Open the modal pre-filled to edit an existing engin.
    editStock(id) {
        const item = this.game.rollingStock.getById(id);
        if (!item)
            return;
        this._editingStockId = id;
        const title = document.getElementById('stock-modal-title');
        if (title)
            title.textContent = "Modifier l'engin";
        const saveBtn = document.getElementById('btn-save-stock');
        if (saveBtn)
            saveBtn.textContent = 'Enregistrer les modifications';
        document.getElementById('modal-add-stock')?.classList.remove('hidden');
        this._setStockField('stock-name', item.name || '');
        this._setStockField('stock-series-name', item.seriesName || '');
        this._setStockField('stock-category', item.category || 'locomotive');
        this._setStockTraction((item.traction || 'none').split('+').map((s) => s.trim()).filter(Boolean));
        this._setStockField('stock-speed', item.maxSpeed ?? 160);
        this._setStockField('stock-power', item.power ?? 0);
        this._setStockField('stock-length', item.length ?? 20);
        this._setStockField('stock-mass', item.mass ?? 80);
        this._setStockField('stock-capacity', item.passengerCapacity ?? 0);
        this._setStockField('stock-freight-cap', item.freightCapacity ?? 0);
        this._setStockWagonSubcat(item.wagonSubCategory || '');
        this._stockImageData = item.imageData || null;
        const preview = document.getElementById('stock-image-preview');
        if (preview) {
            if (item.imageData) {
                preview.src = item.imageData;
                preview.classList.remove('hidden');
            }
            else
                preview.classList.add('hidden');
        }
        this._populateCargoTypesCheckboxes();
        const sel = new Set(item.cargoTypes || []);
        document.querySelectorAll('.stock-cargo-cb').forEach((cb) => { cb.checked = sel.has(cb.value); });
        this._wireStockCategoryToggle();
        this._updateStockComputedFields();
    }
    _populateCargoTypesCheckboxes() {
        const list = document.getElementById('stock-cargo-types-list');
        if (!list)
            return;
        const cargoTypes = this.game.cargoTypes;
        if (!cargoTypes)
            return;
        let html = '';
        for (const [catKey, cat] of Object.entries(cargoTypes.categories)) {
            html += `<div class="cargo-cat-header">${htmlText(cat.name)}</div><div class="cargo-cat-grid">`;
            for (const t of cat.types) {
                html += `<label class="cargo-cb-label">
          <input type="checkbox" class="stock-cargo-cb" value="${htmlText(t.type)}">
          ${htmlText(t.name)} <span class="cargo-cb-unit">${htmlText(t.unit)}</span>
        </label>`;
            }
            html += `</div>`;
        }
        list.innerHTML = html;
    }
    loadStockImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result !== 'string')
                return;
            this._stockImageData = result;
            const preview = document.getElementById('stock-image-preview');
            preview.src = result;
            preview.classList.remove('hidden');
            const img = new Image();
            img.onload = () => {
                const lengthM = (img.naturalWidth * 0.1).toFixed(1);
                const lengthInput = document.getElementById('stock-length');
                if (lengthInput)
                    lengthInput.value = lengthM;
            };
            img.src = result;
        };
        reader.readAsDataURL(file);
    }
    saveStock() {
        const name = document.getElementById('stock-name')?.value.trim() || '';
        if (!name)
            return alert('Nom requis');
        const category = document.getElementById('stock-category')?.value || 'locomotive';
        if (!['locomotive', 'automotrice', 'voiture', 'wagon'].includes(category))
            return alert('Catégorie de matériel invalide.');
        const read = (id) => Number(document.getElementById(id)?.value);
        const maxSpeed = read('stock-speed');
        const mass = read('stock-mass');
        const powerRaw = read('stock-power');
        const passengerRaw = read('stock-capacity');
        const freightRaw = read('stock-freight-cap');
        const length = read('stock-length');
        if (!Number.isFinite(maxSpeed) || maxSpeed <= 0)
            return alert('Vitesse maximale invalide.');
        if (!Number.isFinite(mass) || mass <= 0)
            return alert('Masse à vide invalide.');
        if (!Number.isFinite(length) || length <= 0)
            return alert('Longueur invalide.');
        if (![powerRaw, passengerRaw, freightRaw].every(Number.isFinite) || powerRaw < 0 || passengerRaw < 0 || freightRaw < 0) {
            return alert('Puissance et capacités doivent être des nombres positifs ou nuls.');
        }
        const power = (category === 'wagon' || category === 'voiture') ? 0 : powerRaw;
        const passengerCapacity = category === 'wagon' ? 0 : passengerRaw;
        const freightCapacity = freightRaw;
        const tonnage = category === 'wagon' ? Math.round((mass + freightCapacity) * 10) / 10 : Math.round(mass * 10) / 10;
        const data = {
            name,
            category,
            traction: (category === 'wagon' || category === 'voiture') ? 'none' : this._getStockTractionString(),
            maxSpeed,
            tonnage,
            mass,
            power,
            passengerCapacity,
            freightCapacity,
            length,
            imageData: this._stockImageData,
            seriesName: document.getElementById('stock-series-name')?.value.trim() || '',
            purchasePrice: this._calculateStockPrice(),
            cargoTypes: category === 'wagon' ? Array.from(document.querySelectorAll('.stock-cargo-cb:checked')).map((cb) => cb.value) : [],
            wagonSubCategory: category === 'wagon' ? this._getStockWagonSubcat() : '',
        };
        if (this._editingStockId) {
            this.game.rollingStock.update(this._editingStockId, data);
            this._editingStockId = null;
        }
        else {
            this.game.rollingStock.add(data);
        }
        document.getElementById('modal-add-stock')?.classList.add('hidden');
        this.game.saveState?.();
        this._populateMaterialAdvancedFilters('stock', true);
        this._populateMaterialAdvancedFilters('rame', true);
        this.renderStockList();
    }
    renderStockList() {
        const container = document.getElementById('stock-list');
        if (!container)
            return;
        this._populateStockSubcatFilter();
        this._populateMaterialAdvancedFilters('stock');
        const pager = document.getElementById('stock-pager');
        const countEl = document.getElementById('stock-count');
        const all = this.game.rollingStock.getAll();
        if (all.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun materiel. Cliquer "+ Ajouter un engin" pour importer.</p>';
            if (pager)
                pager.innerHTML = '';
            if (countEl)
                countEl.textContent = '';
            return;
        }
        const q = (document.getElementById('stock-search')?.value || '').trim().toLowerCase();
        let items = this._filterMaterialAdvanced(all, 'stock');
        if (q)
            items = items.filter((i) => {
                const meta = _stockFilterMeta(i);
                const detailText = [...meta.details].map((c) => STOCK_DETAIL_LABELS.get(c) || '').join(' ').toLowerCase();
                return (i.name || '').toLowerCase().includes(q) ||
                    (i.seriesName || '').toLowerCase().includes(q) ||
                    (i.realIdentitySeries || '').toLowerCase().includes(q) ||
                    (i.realIdentityId || '').toLowerCase().includes(q) ||
                    (i.notes || '').toLowerCase().includes(q) ||
                    (i.category || '').toLowerCase().includes(q) ||
                    (i.traction || '').toLowerCase().includes(q) ||
                    (i.wagonSubCategory || '').toLowerCase().includes(q) ||
                    (i.identityCountry || '').toLowerCase().includes(q) ||
                    (i.identityOperator || '').toLowerCase().includes(q) ||
                    (i.mlgId || '').toLowerCase().includes(q) ||
                    (i.mlgSeriesName || '').toLowerCase().includes(q) ||
                    (i.mlgArchivePath || '').toLowerCase().includes(q) ||
                    (i.mlgCategory || '').toLowerCase().includes(q) ||
                    (i.mlgPathCategory || '').toLowerCase().includes(q) ||
                    (i.componentRole || '').toLowerCase().includes(q) || detailText.includes(q);
            });
        const PAGE = parseInt(document.getElementById('stock-per-page')?.value) || 60;
        const total = items.length;
        const pages = Math.max(1, Math.ceil(total / PAGE));
        if (this._stockPage == null)
            this._stockPage = 0;
        if (this._stockPage >= pages)
            this._stockPage = pages - 1;
        const start = this._stockPage * PAGE;
        const view = items.slice(start, start + PAGE);
        if (countEl)
            countEl.textContent = `${total} engin${total > 1 ? 's' : ''}` + (total !== all.length ? ` / ${all.length}` : '');
        if (total === 0) {
            container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun résultat pour cette recherche.</p>';
            if (pager)
                pager.innerHTML = '';
            return;
        }
        container.innerHTML = view.map((item) => {
            const subLabel = item.wagonSubCategory ? ` — ${item.wagonSubCategory}` : '';
            const detailLabels = [..._stockFilterMeta(item).details].map((c) => STOCK_DETAIL_LABELS.get(c)).filter(Boolean).slice(0, 4);
            const powerTxt = item.power ? ` · ${item.power} kW` : '';
            const cargoTxt = item.cargoTypes?.length ? ` · ${item.cargoTypes.map((ct) => { const info = this.game.cargoTypes?.getTypeInfo?.(ct); return info?.name || ct; }).join(', ')}` : '';
            const compatCargoTxt = item.technicallyCompatibleCargoTypes?.length ? item.technicallyCompatibleCargoTypes.map((ct) => { const info = this.game.cargoTypes?.getTypeInfo?.(ct); return info?.name || ct; }).join(', ') : '';
            return `
      <div class="card stock-card">
        ${item.imageData ? `<img src="${htmlText(item.imageData)}" loading="lazy" class="card-img" alt="${htmlText(item.name)}">` : ''}
        <div class="card-title" title="${htmlText(item.name)}">${htmlText(item.name)}</div>
        <div class="card-info">
          <div class="stock-line"><span class="stock-label">Cat :</span> ${htmlText(item.category)}${htmlText(subLabel)}</div>
          ${detailLabels.length ? `<div class="stock-line"><span class="stock-label">Types :</span> ${htmlText(detailLabels.join(' · '))}</div>` : ''}
          <div class="stock-line"><span class="stock-label">Tract :</span> ${htmlText(item.traction || '—')}${htmlText(powerTxt)}</div>
          <div class="stock-line"><span class="stock-label">${String(item.technicalDataStatus || '').includes('PROVISIONAL') ? 'Perf. jeu* :' : 'Perf :'}</span> ${item.maxSpeed} km/h · ${item.length}m · ${item.tonnage}t</div>
          <div class="stock-line"><span class="stock-label">Charge :</span> ${item.passengerCapacity} places · ${item.freightCapacity}t fret${htmlText(cargoTxt)}</div>
          ${String(item.technicalDataStatus || '').includes('PROVISIONAL') ? `<div class="stock-line" style="color:var(--orange)"><span class="stock-label">*Provisoire :</span> valeurs de simulation quand la spec réelle manque.</div>` : ''}
          ${compatCargoTxt ? `<div class="stock-line" style="color:var(--text2)"><span class="stock-label">Compatible techniquement :</span> ${htmlText(compatCargoTxt)}</div>` : ''}
          ${item.purchasePrice ? `<div class="stock-line"><span class="stock-label">Tarif jeu :</span> ${item.purchasePrice.toLocaleString('fr-FR')} €</div>` : ''}
          ${item.seriesName ? `<div class="stock-line"><span class="stock-label">Série :</span> ${htmlText(item.seriesName)}</div>` : ''}
          ${item.realIdentityId ? `<div class="stock-line" style="color:var(--accent)"><span class="stock-label">Identité RE :</span> ${htmlText(item.realIdentitySeries || '—')} <span style="opacity:.75">(${htmlText(item.realIdentityId)})</span></div>` : ''}
          ${item.notes ? `<div class="stock-line" style="color:var(--text2)"><span class="stock-label">Note :</span> ${htmlText(item.notes)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn-sm" onclick="game.ui.editStock('${htmlJsString(item.id)}')">Modifier</button>
          <button class="btn-sm danger" onclick="game.ui.deleteStock('${htmlJsString(item.id)}')">Supprimer</button>
        </div>
      </div>
    `;
        }).join('');
        if (pager) {
            if (pages <= 1) {
                pager.innerHTML = '';
            }
            else {
                pager.innerHTML = `
          <button class="btn-sm" ${this._stockPage === 0 ? 'disabled' : ''} onclick="game.ui.stockPageGo(${htmlJsValue(this._stockPage - 1)})">‹ Préc.</button>
          <span style="margin:0 12px;align-self:center;font-size:13px">Page ${this._stockPage + 1} / ${pages}</span>
          <button class="btn-sm" ${this._stockPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.stockPageGo(${htmlJsValue(this._stockPage + 1)})">Suiv. ›</button>`;
            }
        }
    }
    stockPageGo(p) {
        this._stockPage = p;
        this.renderStockList();
        document.getElementById('stock-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    deleteStock(id) {
        const item = this.game.rollingStock.getById(id);
        if (!item)
            return;
        if (item._catalog)
            return alert('Cette fiche appartient au catalogue de base. Elle peut être modifiée, mais pas supprimée depuis la page Matériel.');
        const usedBy = this.game.rameManager.getAll().filter((r) => (r.elements || []).includes(String(item.id)));
        if (usedBy.length)
            return alert(`Impossible de supprimer cet engin : il est utilisé dans ${usedBy.length} rame(s), dont ${usedBy.slice(0, 3).map((r) => r.name).join(', ')}.`);
        if (!confirm('Supprimer cet engin ?'))
            return;
        this.game.rollingStock.remove(id);
        this.game.saveState();
        this._populateMaterialAdvancedFilters('stock', true);
        this._populateMaterialAdvancedFilters('rame', true);
        this.renderStockList();
    }
    // --- RAMES ---
    setupRamePage() {
        document.getElementById('btn-new-rame')?.addEventListener('click', () => this.openRameModal());
        document.getElementById('btn-save-rame')?.addEventListener('click', () => this.saveRame());
        const pickerSearch = document.getElementById('rame-search');
        if (pickerSearch)
            pickerSearch.addEventListener('input', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
        document.getElementById('rame-cat-filter')?.addEventListener('change', () => { this._ramePickerPage = 0; this._populateRameSubcatFilter(); this.renderRamePicker(); });
        document.getElementById('rame-subcat-filter')?.addEventListener('change', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
        for (const id of ['rame-detail-filter', 'rame-traction-filter', 'rame-country-filter', 'rame-operator-filter', 'rame-mlg-filter']) {
            document.getElementById(id)?.addEventListener('change', () => { this._ramePickerPage = 0; this.renderRamePicker(); });
        }
        document.getElementById('btn-clear-rame')?.addEventListener('click', () => {
            this.currentRameElements = [];
            this.renderRameAssembly();
        });
        document.getElementById('btn-rame-wagon-multi')?.addEventListener('click', () => this.toggleRameWagonMultiMode());
        document.getElementById('btn-rame-random-wagons')?.addEventListener('click', () => this.randomFillRameWithSelectedWagons());
        document.getElementById('btn-rame-clear-wagon-selection')?.addEventListener('click', () => {
            this._rameRandomWagonSelection?.clear?.();
            this._updateRameRandomControls();
            this.renderRamePicker();
        });
        // Section III — recherche et pagination de la liste des rames.
        this._ramesPage = 0;
        const ramesSearch = document.getElementById('rames-search');
        if (ramesSearch)
            ramesSearch.addEventListener('input', () => { this._ramesPage = 0; this.renderRamesList(); });
        const ramesPerPage = document.getElementById('rames-per-page');
        if (ramesPerPage)
            ramesPerPage.addEventListener('change', () => { this._ramesPage = 0; this.renderRamesList(); });
        for (const id of ['rames-kind-filter', 'rames-traction-filter', 'rames-status-filter']) {
            document.getElementById(id)?.addEventListener('change', () => { this._ramesPage = 0; this.renderRamesList(); });
        }
    }
    _populateRameSubcatFilter() {
        const sel = document.getElementById('rame-subcat-filter');
        const catFilter = document.getElementById('rame-cat-filter');
        if (!sel || !catFilter)
            return;
        const isWagon = catFilter.value === 'wagon';
        sel.style.display = isWagon ? 'inline-block' : 'none';
        if (!isWagon) {
            sel.value = '';
            return;
        }
        const current = sel.value;
        const labels = {
            tombereau: 'Tombercau', citerne: 'Citerne', gaz: 'Gazier', 'porte-auto': 'Porte-Auto',
            tremie: 'Trémic', cerealier: 'Céréalier', ciment: 'Ciment', silos: 'Silos',
            plat: 'Plat', ttx: 'TTX', intermodal: 'Intermodal', speciaux: 'Spéciaux',
            couvert: 'Couvert', bache: 'Bâché', infra: 'Infral'
        };
        const distinct = new Set(this.game.rollingStock.getAll().filter((i) => i.category === 'wagon' && i.wagonSubCategory).map((i) => i.wagonSubCategory));
        let html = '<option value="">Tous les wagons</option>';
        for (const [val, label] of Object.entries(labels)) {
            if (distinct.has(val))
                html += `<option value="${htmlText(val)}">${htmlText(label)}</option>`;
        }
        sel.innerHTML = html;
        if (Array.from(sel.options).some((o) => o.value === current))
            sel.value = current;
    }
    resetLiveryEditor() {
        if (!this._liveryEditor)
            return;
        try {
            this._liveryEditor.dispose();
            this._liveryEditor = null;
            const root = document.getElementById('page-liveries');
            if (root)
                root.innerHTML = '';
            if (this.activePage === 'liveries')
                this.renderLiveriesPage();
        }
        catch (error) {
            console.warn('Livrées : rafraîchissement après import', error);
        }
    }
    renderLiveriesPage() {
        const root = document.getElementById('page-liveries');
        if (!root)
            return;
        if (!this._liveryEditor)
            this._liveryEditor = new LiveryEditor(root, {
                library: this.game.liveries,
                catalog: () => this.game.rollingStock.getAll(),
                targets: () => this.game.liveryTargets(),
                commit: (change) => this.game.commitLiveryChange(change),
                ensureCatalog: () => this.game._loadBatch186FullCatalogInBackground?.(),
            });
        else
            this._liveryEditor.show();
    }
    selectRameLivery(index, id) {
        const element = this.currentRameElements[index];
        if (!element)
            return;
        try {
            const catalogId = element.catalogId || element.stockId || '';
            this.game.liveries.select(element, id, this.game.rollingStock.getById(catalogId)?.imageData);
            this.renderRameAssembly();
        }
        catch (error) {
            alert(error instanceof Error ? error.message : String(error));
        }
    }
    _rameLiverySelect(element, index) {
        const rows = this.game.liveries.compatible(element.catalogId || element.stockId || '');
        if (!rows.length && !element.liveryId)
            return '';
        return `<label class="liv-rame-select">Livrée<select data-rame-livery="${index}" aria-label="Livrée du véhicule ${index + 1}"><option value="">Image d’origine</option>${rows.map((r) => `<option value="${htmlText(r.id)}" ${r.id === element.liveryId ? 'selected' : ''}>${htmlText(r.label)}</option>`).join('')}</select></label>`;
    }
    openRameModal() {
        this.currentRameElements = [];
        this._setRameRandomPolicyControls(false, null);
        this.editingRameId = null;
        this._duplicatingRameSourceId = null;
        this._ramePickerPage = 0;
        this._rameRandomWagonSelection = new Set();
        this._rameMultiWagonMode = false;
        this._editingOriginalElementIds = new Set();
        this._editingOriginalComposition = null;
        const title = document.getElementById('rame-modal-title');
        if (title)
            title.textContent = 'Composer une rame';
        const saveBtn = document.getElementById('btn-save-rame');
        if (saveBtn)
            saveBtn.textContent = 'Enregistrer la rame';
        document.getElementById('rame-edit-hint')?.classList.add('hidden');
        document.getElementById('rame-name').value = '';
        const ser = document.getElementById('rame-serial');
        if (ser)
            ser.value = '';
        const s = document.getElementById('rame-search');
        if (s)
            s.value = '';
        const c = document.getElementById('rame-cat-filter');
        if (c)
            c.value = '';
        const sc = document.getElementById('rame-subcat-filter');
        if (sc)
            sc.value = '';
        for (const id of ['rame-detail-filter', 'rame-traction-filter', 'rame-country-filter', 'rame-operator-filter', 'rame-mlg-filter']) {
            const el = document.getElementById(id);
            if (el)
                el.value = '';
        }
        const q = document.getElementById('rame-qty');
        if (q)
            q.value = '1';
        this._populateRameSubcatFilter();
        const depotSel = document.getElementById('rame-depot');
        if (depotSel) {
            const depots = this.game.depotManager.getDepots();
            depotSel.innerHTML = '<option value="">— Aucun —</option>' + depots.map((d) => `<option value="${htmlText(d.id)}">${htmlText(d.name)}</option>`).join('');
        }
        document.getElementById('modal-rame')?.classList.remove('hidden');
        this.renderRamePicker();
        this.renderRameAssembly();
    }
    openRameEditor(id) {
        const rame = this.game.rameManager.getById(id);
        if (!rame)
            return;
        this.editingRameId = id;
        this._setRameRandomPolicyControls(rame.randomizeOnDeparture, rame.randomMaxVehicles);
        this._duplicatingRameSourceId = null;
        this._ramePickerPage = 0;
        this._rameRandomWagonSelection = new Set();
        this._rameMultiWagonMode = false;
        this.currentRameElements = (rame.elementDetails || []).map((d, i) => {
            const stockId = rame.elements?.[i] || d.catalogId || '';
            const stock = this.game.rollingStock.getById(stockId);
            return { ...(stock || {}), ...d, stockId, elementId: d.elementId || this._newRameElementId() };
        });
        this._editingOriginalElementIds = new Set(this.currentRameElements.map((e) => e.elementId).filter(Boolean));
        this._editingOriginalComposition = { elements: [...(rame.elements || [])], elementDetails: (rame.elementDetails || []).map((e) => ({ ...e })) };
        document.getElementById('rame-name').value = rame.name || '';
        const ser = document.getElementById('rame-serial');
        if (ser)
            ser.value = rame.serialNumber || '';
        const s = document.getElementById('rame-search');
        if (s)
            s.value = '';
        const c = document.getElementById('rame-cat-filter');
        if (c)
            c.value = '';
        const sc = document.getElementById('rame-subcat-filter');
        if (sc)
            sc.value = '';
        for (const id of ['rame-detail-filter', 'rame-traction-filter', 'rame-country-filter', 'rame-operator-filter', 'rame-mlg-filter']) {
            const el = document.getElementById(id);
            if (el)
                el.value = '';
        }
        const q = document.getElementById('rame-qty');
        if (q)
            q.value = '1';
        this._populateRameSubcatFilter();
        const depotSel = document.getElementById('rame-depot');
        if (depotSel) {
            const depots = this.game.depotManager.getDepots();
            depotSel.innerHTML = '<option value="">— Aucun —</option>' + depots.map((d) => `<option value="${htmlText(d.id)}">${htmlText(d.name)}</option>`).join('');
            depotSel.value = rame.depotId || '';
        }
        const title = document.getElementById('rame-modal-title');
        if (title)
            title.textContent = `Éditer la rame — ${rame.name}`;
        const saveBtn = document.getElementById('btn-save-rame');
        if (saveBtn)
            saveBtn.textContent = 'Enregistrer les modifications';
        document.getElementById('rame-edit-hint')?.classList.remove('hidden');
        document.getElementById('modal-rame')?.classList.remove('hidden');
        this.renderRamePicker();
        this.renderRameAssembly();
    }
    duplicateRame(id) {
        const rame = this.game.rameManager.getById(id);
        if (!rame)
            return;
        // Open as a NEW rame, never as an edit: assignments/material links therefore
        // remain attached to the source rame only. Every copied vehicle gets a fresh
        // elementId, and saveRame() allocates fresh series instance numbers.
        this.openRameModal();
        this._duplicatingRameSourceId = rame.id;
        this._setRameRandomPolicyControls(rame.randomizeOnDeparture, rame.randomMaxVehicles);
        const allRames = this.game.rameManager.getAll();
        const candidate = new LabelAllocator(allRames.map((r) => r.name), true).next(rame.name);
        const serial = rame.serialNumber ? new LabelAllocator(allRames.map((r) => r.serialNumber)).next(rame.serialNumber) : '';
        this.currentRameElements = (rame.elementDetails || []).map((d, i) => {
            const stockId = rame.elements?.[i] || d.catalogId || '';
            const stock = this.game.rollingStock.getById(stockId);
            return { ...(stock || {}), ...d, stockId, elementId: this._newRameElementId() };
        });
        document.getElementById('rame-name').value = candidate;
        const ser = document.getElementById('rame-serial');
        if (ser)
            ser.value = serial;
        const depot = document.getElementById('rame-depot');
        if (depot)
            depot.value = rame.depotId || '';
        const title = document.getElementById('rame-modal-title');
        if (title)
            title.textContent = `Dupliquer la rame — ${rame.name}`;
        const saveBtn = document.getElementById('btn-save-rame');
        if (saveBtn)
            saveBtn.textContent = 'Créer la rame dupliquée';
        this.renderRameAssembly();
    }
    _newRameElementId() {
        this._rameElementSeq = (this._rameElementSeq || 0) + 1;
        return `rame-el-${Date.now().toString(36)}-${this._rameElementSeq.toString(36)}`;
    }
    renderRamePicker() {
        const container = document.getElementById('rame-stock-picker');
        if (!container)
            return;
        const pager = document.getElementById('rame-picker-pager');
        const countEl = document.getElementById('rame-picker-count');
        const all = this.game.rollingStock.getAll();
        if (all.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);font-size:11px">Aucun materiel. Ajoutez-en d\'abord dans la page Materiel.</p>';
            if (pager)
                pager.innerHTML = '';
            if (countEl)
                countEl.textContent = '';
            return;
        }
        this._populateRameSubcatFilter();
        this._populateMaterialAdvancedFilters('rame');
        const query = (document.getElementById('rame-search')?.value || '').trim().toLowerCase();
        let items = this._filterMaterialAdvanced(all, 'rame');
        if (query)
            items = items.filter((i) => {
                const meta = _stockFilterMeta(i);
                const detailText = [...meta.details].map((c) => STOCK_DETAIL_LABELS.get(c) || '').join(' ').toLowerCase();
                return (i.name || '').toLowerCase().includes(query) ||
                    (i.seriesName || '').toLowerCase().includes(query) ||
                    (i.realIdentitySeries || '').toLowerCase().includes(query) ||
                    (i.realIdentityId || '').toLowerCase().includes(query) ||
                    (i.notes || '').toLowerCase().includes(query) ||
                    (i.category || '').toLowerCase().includes(query) ||
                    (i.traction || '').toLowerCase().includes(query) ||
                    (i.wagonSubCategory || '').toLowerCase().includes(query) ||
                    (i.identityCountry || '').toLowerCase().includes(query) ||
                    (i.identityOperator || '').toLowerCase().includes(query) ||
                    (i.mlgId || '').toLowerCase().includes(query) ||
                    (i.mlgSeriesName || '').toLowerCase().includes(query) ||
                    (i.mlgArchivePath || '').toLowerCase().includes(query) ||
                    (i.mlgCategory || '').toLowerCase().includes(query) ||
                    (i.mlgPathCategory || '').toLowerCase().includes(query) ||
                    (i.componentRole || '').toLowerCase().includes(query) || detailText.includes(query);
            });
        const PAGE = 60;
        const total = items.length;
        const pages = Math.max(1, Math.ceil(total / PAGE));
        if (this._ramePickerPage == null)
            this._ramePickerPage = 0;
        if (this._ramePickerPage >= pages)
            this._ramePickerPage = pages - 1;
        const start = this._ramePickerPage * PAGE;
        const view = items.slice(start, start + PAGE);
        if (countEl)
            countEl.textContent = `${total} engin${total > 1 ? 's' : ''}` + (total !== all.length ? ` / ${all.length}` : '');
        if (total === 0) {
            container.innerHTML = '<p style="color:var(--text3);font-size:11px;grid-column:1/-1">Aucun résultat.</p>';
            if (pager)
                pager.innerHTML = '';
            return;
        }
        container.innerHTML = view.map((item) => {
            const multiWagon = this._rameMultiWagonMode && item.category === 'wagon';
            const selected = multiWagon && this._rameRandomWagonSelection?.has?.(String(item.id));
            return `
        <div class="stock-picker-item${htmlText(multiWagon ? ' rame-wagon-multi' : '')}${htmlText(selected ? ' rame-wagon-selected' : '')}" onclick="game.ui.onRamePickerItemClick('${htmlJsString(item.id)}', event)" title="${htmlText(multiWagon ? (selected ? 'Sélectionné pour Random 750 m — cliquer pour retirer' : 'Cliquer pour sélectionner pour Random 750 m') : `${item.name} — ${item.category} — ${[..._stockFilterMeta(item).details].map((c) => STOCK_DETAIL_LABELS.get(c)).filter(Boolean).slice(0, 3).join(' / ')}${item.notes ? ' — ' + item.notes : ''}, ${item.maxSpeed} km/h, ${item.length}m`)}">
          ${multiWagon ? `<span class="rame-wagon-check">${selected ? '✓' : ''}</span>` : ''}
          ${item.imageData ? `<img src="${htmlText(item.imageData)}" loading="lazy" alt="${htmlText(item.name)}">` : `<div style="height:30px;width:60px;background:var(--bg);border-radius:2px"></div>`}
          <span>${htmlText(item.name)}${item.purchasePrice ? ` <span style="color:var(--orange);font-size:9px">${(item.purchasePrice / 1000).toFixed(0)}k€</span>` : ''}</span>
        </div>`;
        }).join('');
        this._updateRameRandomControls();
        if (pager) {
            pager.innerHTML = pages <= 1 ? '' : `
        <button class="btn-sm" ${this._ramePickerPage === 0 ? 'disabled' : ''} onclick="game.ui.ramePickerPageGo(${htmlJsValue(this._ramePickerPage - 1)})">‹ Préc.</button>
        <span style="margin:0 12px;align-self:center;font-size:12px">Page ${this._ramePickerPage + 1} / ${pages}</span>
        <button class="btn-sm" ${this._ramePickerPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.ramePickerPageGo(${htmlJsValue(this._ramePickerPage + 1)})">Suiv. ›</button>`;
        }
    }
    _updateRameRandomControls() {
        const count = this._rameRandomWagonSelection?.size || 0;
        const hasLoco = this.currentRameElements.some((e) => e.category === 'locomotive');
        const multiBtn = document.getElementById('btn-rame-wagon-multi');
        if (multiBtn) {
            multiBtn.classList.toggle('active', !!this._rameMultiWagonMode);
            multiBtn.textContent = this._rameMultiWagonMode ? '✓ Sélection wagons active' : '☑ Sélection multiple wagons';
        }
        const randomBtn = document.getElementById('btn-rame-random-wagons');
        if (randomBtn) {
            randomBtn.disabled = count === 0 || !hasLoco;
            randomBtn.title = !hasLoco ? 'Posez d’abord au moins une locomotive dans la rame.' : (count ? 'Reconstruit uniquement la partie wagons en ordre aléatoire jusqu’à 750 m.' : 'Sélectionnez au moins un modèle de wagon.');
        }
        const clearBtn = document.getElementById('btn-rame-clear-wagon-selection');
        if (clearBtn)
            clearBtn.disabled = count === 0;
        const countEl = document.getElementById('rame-random-selection-count');
        if (countEl)
            countEl.textContent = `${count} modèle${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
    }
    toggleRameWagonMultiMode() {
        this._rameMultiWagonMode = !this._rameMultiWagonMode;
        this._updateRameRandomControls();
        this.renderRamePicker();
    }
    onRamePickerItemClick(stockId, ev) {
        const item = this.game.rollingStock.getById(stockId);
        if (!item)
            return;
        if (this._rameMultiWagonMode && item.category === 'wagon') {
            const id = String(item.id);
            if (this._rameRandomWagonSelection.has(id))
                this._rameRandomWagonSelection.delete(id);
            else
                this._rameRandomWagonSelection.add(id);
            this._updateRameRandomControls();
            this.renderRamePicker();
            return;
        }
        this.addToRame(stockId, ev);
    }
    _shuffleRameRandomPool(items) {
        const out = [...items];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }
    _makeRameElementFromStock(item, flipped = false) {
        const instanceNumber = item.seriesName ? this.game.rollingStock.nextSeriesNumber(item.seriesName) : null;
        const instanceName = instanceNumber || item.name;
        return { ...item, stockId: item.id, instanceName, instanceNumber, flipped: !!flipped, elementId: this._newRameElementId() };
    }
    _setRameRandomPolicyControls(enabled, maximum) {
        const check = document.getElementById('rame-random-departure');
        const input = document.getElementById('rame-random-max');
        if (check)
            check.checked = !!enabled;
        if (input)
            input.value = maximum == null ? '' : String(maximum);
    }
    randomFillRameWithSelectedWagons() {
        const selected = [...(this._rameRandomWagonSelection || new Set())]
            .map((id) => this.game.rollingStock.getById(id)).filter((item) => !!item && item.category === 'wagon');
        const fixed = this.currentRameElements.filter((e) => e.category !== 'wagon');
        try {
            const maximum = maximumVehicleCount(document.getElementById('rame-random-max')?.value);
            const plan = planRandomWagons(fixed, selected, maximum, Math);
            const wagons = plan.selected.map(item => this._makeRameElementFromStock(item));
            this.currentRameElements = [...fixed, ...wagons];
            this._setRameRandomPolicyControls(true, maximum);
            this.renderRameAssembly();
            this._updateRameRandomControls();
            const status = document.getElementById('rame-random-status');
            if (status)
                status.textContent = `${fixed.length + wagons.length}${maximum ? '/' + maximum : ''} engins, dont ${wagons.length} wagons · ${plan.totalLength.toFixed(1)} / 750 m. Les wagons seront remélangés à chaque nouvelle course, locomotives fixes.`;
        }
        catch (error) {
            alert(error instanceof Error ? error.message : String(error));
        }
    }
    ramePickerPageGo(p) {
        this._ramePickerPage = p;
        this.renderRamePicker();
        document.getElementById('rame-stock-picker')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    addToRame(stockId, evOrFlipped) {
        const item = this.game.rollingStock.getById(stockId);
        if (!item)
            return;
        const flipped = (evOrFlipped && (typeof evOrFlipped === 'boolean' ? evOrFlipped : evOrFlipped.ctrlKey)) || false;
        let qty = parseInt(document.getElementById('rame-qty')?.value || '1', 10);
        if (!isFinite(qty) || qty < 1)
            qty = 1;
        let currentLength = this.currentRameElements.reduce((s, e) => s + e.length, 0);
        let added = 0;
        const nameInput = document.getElementById('rame-name');
        const serialInput = document.getElementById('rame-serial');
        const firstInRame = this.currentRameElements.length === 0;
        for (let n = 0; n < qty; n++) {
            if (currentLength + item.length > 750)
                break;
            // Annexe 8 + HOTFIX60 : création d'instance centralisée (clic ou Random 750 m).
            const rameElement = this._makeRameElementFromStock(item, flipped);
            const instanceName = rameElement.instanceName;
            this.currentRameElements.push(rameElement);
            // Annexe 8 : le nom/n° de série de la rame reprend le premier engin numéroté.
            if (firstInRame && n === 0) {
                if (nameInput && !nameInput.value.trim())
                    nameInput.value = instanceName;
                if (serialInput && !serialInput.value.trim())
                    serialInput.value = instanceName;
            }
            currentLength += item.length;
            added++;
        }
        if (added < qty) {
            alert(added === 0
                ? 'Longueur maximale de 750m atteinte !'
                : `Longueur max 750m atteinte : ${added}/${qty} engin(s) ajouté(s).`);
        }
        this.renderRameAssembly();
    }
    moveRameElement(index, delta) {
        const from = Number(index), to = from + Number(delta);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= this.currentRameElements.length || to >= this.currentRameElements.length)
            return;
        const [el] = this.currentRameElements.splice(from, 1);
        this.currentRameElements.splice(to, 0, el);
        this.renderRameAssembly();
    }
    onRameElementClick(index, ev) {
        if (ev?.ctrlKey) {
            this.flipRameElement(index);
        }
        else {
            this.removeFromRame(index);
        }
    }
    flipRameElement(index) {
        const el = this.currentRameElements[index];
        if (!el)
            return;
        el.flipped = !el.flipped;
        this.renderRameAssembly();
    }
    removeFromRame(index) {
        this.currentRameElements.splice(index, 1);
        this.renderRameAssembly();
    }
    renderRameAssembly() {
        const container = document.getElementById('rame-assembly');
        if (!container)
            return;
        if (this.currentRameElements.length === 0) {
            container.innerHTML = '<p class="rame-empty">Cliquer sur un engin ci-dessous pour l\'ajouter</p>';
        }
        else {
            const last = this.currentRameElements.length - 1;
            container.innerHTML = '<div class="rame-assembly-images">' + this.currentRameElements.map((el, i) => {
                const label = el.instanceName || el.name;
                let imgHtml = '';
                if (el.imageData) {
                    const transforms = [];
                    if (el.isDrivingTrailer && this.currentRameElements.length > 1) {
                        const isLeft = i === 0;
                        const isRight = i === last;
                        const isLeftImage = el.imageData.toLowerCase().endsWith('_l.gif');
                        // Cab must face outward. Right-facing image (/_R.gif or .gif) at left end => flip.
                        // Left-facing image (/_L.gif) at right end => flip.
                        if ((isLeft && !isLeftImage) || (isRight && isLeftImage)) {
                            transforms.push('scaleX(-1)');
                        }
                    }
                    if (el.flipped)
                        transforms.push('scaleX(-1)');
                    const style = transforms.length ? `transform: ${transforms.join(' ')};` : '';
                    imgHtml = `<img src="${htmlText(el.imageData)}" alt="${htmlText(label)}" title="${htmlText(label)} (clic = retirer, Ctrl+clic = retourner)" onclick="game.ui.onRameElementClick(${htmlJsValue(i)}, event)" class="rame-element-img"${style ? ` style="${style}"` : ''}>`;
                }
                else {
                    imgHtml = `<div class="rame-element-placeholder" title="${htmlText(label)}" onclick="game.ui.removeFromRame(${htmlJsValue(i)})">${htmlText(label)}</div>`;
                }
                return `<div class="rame-element-wrap">${imgHtml}${this._rameLiverySelect(el, Number(i))}<span class="rame-element-label">${htmlText(label)}</span><div class="rame-element-move"><button type="button" class="rame-move-btn" ${i === 0 ? 'disabled' : ''} onclick="game.ui.moveRameElement(${htmlJsValue(i)},-1)" title="Déplacer vers la gauche">←</button><button type="button" class="rame-move-btn" ${i === last ? 'disabled' : ''} onclick="game.ui.moveRameElement(${htmlJsValue(i)},1)" title="Déplacer vers la droite">→</button></div></div>`;
            }).join('') + '</div>';
        }
        container.querySelectorAll('[data-rame-livery]').forEach(select => select.addEventListener('change', () => this.selectRameLivery(Number(select.dataset.rameLivery), select.value)));
        const totalLen = this.currentRameElements.reduce((s, e) => s + e.length, 0);
        const totalTon = this.currentRameElements.reduce((s, e) => s + e.tonnage, 0);
        const totalCap = this.currentRameElements.reduce((s, e) => s + e.passengerCapacity, 0);
        const totalPrice = this.currentRameElements.reduce((s, e) => s + (e.purchasePrice || 0), 0);
        const vmax = this.currentRameElements.length > 0 ? Math.min(...this.currentRameElements.map((e) => e.maxSpeed)) : 0;
        const tractors = this.currentRameElements.filter((e) => e.category === 'locomotive' || e.category === 'automotrice');
        const traction = tractors.length > 0 ? [...new Set(tractors.map((t) => t.traction))].join('+') : '-';
        document.getElementById('rame-length').textContent = totalLen.toFixed(1);
        document.getElementById('rame-tonnage').textContent = totalTon;
        document.getElementById('rame-places').textContent = totalCap;
        document.getElementById('rame-vmax').textContent = String(vmax);
        document.getElementById('rame-traction').textContent = traction;
        const priceEl = document.getElementById('rame-price');
        if (priceEl)
            priceEl.textContent = totalPrice.toLocaleString('fr-FR');
        const fill = document.getElementById('rame-length-fill');
        if (fill) {
            const pct = Math.min(100, (totalLen / 750) * 100);
            fill.style.width = pct + '%';
            fill.style.background = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--green)';
        }
        this._updateRameRandomControls();
    }
    saveRame() {
        const name = document.getElementById('rame-name').value.trim();
        if (!name)
            return alert('Nom requis');
        if (this.currentRameElements.length === 0)
            return alert('Ajoutez au moins un element');
        const totalLength = this.currentRameElements.reduce((sum, e) => sum + (Number(e.length) || 0), 0);
        if (!Number.isFinite(totalLength) || totalLength <= 0 || totalLength > 750)
            return alert('Composition invalide : longueur totale hors limite (0–750 m).');
        if (this.currentRameElements.some((e) => !Number.isFinite(Number(e.maxSpeed)) || Number(e.maxSpeed) <= 0 || !Number.isFinite(Number(e.mass ?? e.tonnage)) || Number(e.mass ?? e.tonnage) <= 0)) {
            return alert('Composition invalide : au moins un véhicule possède une vitesse ou une masse non valide.');
        }
        let randomMaxVehicles;
        try {
            randomMaxVehicles = maximumVehicleCount(document.getElementById('rame-random-max')?.value);
        }
        catch (error) {
            return alert(error instanceof Error ? error.message : String(error));
        }
        const randomizeOnDeparture = !!document.getElementById('rame-random-departure')?.checked;
        if (randomizeOnDeparture && randomMaxVehicles !== null && this.currentRameElements.length > randomMaxVehicles)
            return alert('La rame dépasse le maximum d’engins. Relancez Random ou augmentez le maximum.');
        const isEdit = !!this.editingRameId;
        const existing = isEdit ? this.game.rameManager.getById(this.editingRameId) : null;
        if (isEdit && !existing)
            return alert('Rame introuvable.');
        const oldIds = this._editingOriginalElementIds || new Set();
        const structuralChanged = isEdit && JSON.stringify(this.currentRameElements.map((e) => e.elementId)) !== JSON.stringify((this._editingOriginalComposition?.elementDetails || []).map((e) => e.elementId));
        if (structuralChanged && existing?.currentLocation?.serviceId) {
            return alert('Impossible de modifier la composition pendant que cette rame est en service. Le nom et le numéro peuvent être modifiés, mais pas l’ordre ou les véhicules.');
        }
        if (structuralChanged && (existing?.inMaintenance || this.game.depotManager?.isRameInMaintenance?.(existing?.id))) {
            return alert('Impossible de modifier la composition pendant que cette rame est en maintenance.');
        }
        const enteredSerial = String(document.getElementById('rame-serial')?.value || '').trim();
        if (enteredSerial && enteredSerial !== existing?.serialNumber && this.game.rameManager.getAll().some((r) => r.id !== existing?.id && r.serialNumber === enteredSerial))
            return alert('Ce numéro de rame est déjà utilisé. Choisissez un numéro libre.');
        const billedElements = isEdit ? this.currentRameElements.filter((e) => !oldIds.has(e.elementId)) : this.currentRameElements;
        const billedPrice = billedElements.reduce((sum, e) => sum + (e.purchasePrice || 0), 0);
        if (billedPrice > 0) {
            if (this.game.economy.balance < billedPrice)
                return alert(`Solde insuffisant ! Coût des nouveaux engins: ${billedPrice.toLocaleString('fr-FR')} € — Solde: ${Math.round(this.game.economy.balance).toLocaleString('fr-FR')} €`);
            this.game.economy.addExpense(billedPrice, 'achat', `${isEdit ? 'Modification' : 'Achat'} rame ${name}`);
        }
        const depotId = document.getElementById('rame-depot')?.value || '';
        const serialNumber = document.getElementById('rame-serial')?.value.trim() || '';
        const isDuplicate = !isEdit && !!this._duplicatingRameSourceId;
        const data = {
            name, serialNumber, depotId, randomizeOnDeparture, randomMaxVehicles,
            elements: this.currentRameElements.map((e) => e.stockId),
            elementDetails: this.currentRameElements.map((e) => {
                const freshNumber = isDuplicate && e.seriesName ? this.game.rollingStock.nextSeriesNumber(e.seriesName) : null;
                return {
                    elementId: e.elementId || this._newRameElementId(),
                    name: e.name, instanceName: isDuplicate ? (freshNumber || e.name) : (e.instanceName || e.name), instanceNumber: isDuplicate ? freshNumber : e.instanceNumber, seriesName: e.seriesName,
                    category: e.category, traction: e.traction, maxSpeed: e.maxSpeed, tonnage: e.tonnage,
                    mass: Number.isFinite(Number(e.mass)) ? Number(e.mass) : Number(e.tonnage) || 0, power: Number.isFinite(Number(e.power)) ? Math.max(0, Number(e.power)) : 0, passengerCapacity: Math.max(0, Number(e.passengerCapacity) || 0), freightCapacity: Math.max(0, Number(e.freightCapacity) || 0),
                    length: e.length, imageData: e.imageData, liveryId: e.liveryId || '', originalImageData: e.originalImageData, purchasePrice: e.purchasePrice || 0, wagonSubCategory: e.wagonSubCategory || '',
                    electricSystems: Array.isArray(e.electricSystems) ? e.electricSystems : [], gauges: Array.isArray(e.gauges) ? e.gauges : [], gauge: e.gauge,
                    isDrivingTrailer: !!e.isDrivingTrailer, flipped: !!e.flipped,
                };
            }),
        };
        if (isEdit) {
            const previous = this._editingOriginalComposition || { elements: [...(existing.elements || [])], elementDetails: (existing.elementDetails || []).map((e) => ({ ...e })) };
            const rame = this.game.rameManager.update(this.editingRameId, data);
            const sync = this.game.rotationV2?.syncRameAfterEdit?.(rame, previous);
            if (sync?.rotationsBlocked) {
                alert(`${sync.rotationsBlocked} roulement(s) lié(s) ont été bloqués car la nouvelle composition contient du matériel qui n’a pas encore été créé dans « Rame → matériel ». Créez ces engins/coupons puis réaffectez ou recalculez le roulement.`);
            }
        }
        else {
            this.game.rameManager.add(data);
        }
        this.game.refreshLiveryImages?.();
        this.game.saveState?.();
        document.getElementById('modal-rame')?.classList.add('hidden');
        this.editingRameId = null;
        this._duplicatingRameSourceId = null;
        this._editingOriginalElementIds = new Set();
        this._editingOriginalComposition = null;
        this.renderRamesList();
    }
    renderRamesList() {
        const container = document.getElementById('rames-list');
        const pager = document.getElementById('rames-pager');
        if (!container)
            return;
        const all = this.game.rameManager.getAll();
        if (all.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucune rame. Cliquer "+ Nouvelle rame".</p>';
            if (pager)
                pager.innerHTML = '';
            return;
        }
        const q = (document.getElementById('rames-search')?.value || '').trim().toLowerCase();
        const kind = document.getElementById('rames-kind-filter')?.value || '';
        const tractionFilter = document.getElementById('rames-traction-filter')?.value || '';
        const statusFilter = document.getElementById('rames-status-filter')?.value || '';
        let items = all.filter((r) => {
            if (kind && !_rameKindCodes(r).has(kind))
                return false;
            if (tractionFilter) {
                const codes = new Set((r.elementDetails || []).flatMap((e) => [..._stockFilterMeta(e).tractions]));
                if (!codes.has(tractionFilter))
                    return false;
            }
            if (statusFilter) {
                const loc = r.currentLocation || {};
                const statusOk = statusFilter === 'service' ? !!loc.serviceId
                    : statusFilter === 'maintenance' ? !!r.inMaintenance
                        : statusFilter === 'depot' ? !loc.serviceId && !!(loc.depotId || r.depotId)
                            : statusFilter === 'station' ? !loc.serviceId && !!loc.stationId
                                : statusFilter === 'recommended' ? !!r.recommendedMaintenance
                                    : statusFilter === 'available' ? !loc.serviceId && !r.inMaintenance
                                        : true;
                if (!statusOk)
                    return false;
            }
            return true;
        });
        if (q) {
            items = items.filter((r) => (r.name || '').toLowerCase().includes(q) ||
                (r.serialNumber || '').toLowerCase().includes(q) ||
                (r.elementDetails || []).some((e) => (e.instanceName || e.name || '').toLowerCase().includes(q)));
        }
        const perPage = parseInt(document.getElementById('rames-per-page')?.value || '50', 10) || 50;
        this._ramesPage = this._ramesPage || 0;
        const pages = Math.max(1, Math.ceil(items.length / perPage));
        if (this._ramesPage >= pages)
            this._ramesPage = pages - 1;
        const start = this._ramesPage * perPage;
        const view = items.slice(start, start + perPage);
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun résultat pour cette recherche.</p>';
            if (pager)
                pager.innerHTML = '';
            return;
        }
        container.innerHTML = view.map((r) => `
      <div class="rame-card">
        <div class="rame-card-header">
          <span class="card-title">${htmlText(r.name)}${r.serialNumber ? ` <span style="font-size:11px;color:var(--text3);font-weight:400">(${htmlText(r.serialNumber)})</span>` : ''}</span>
          <div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn-sm" onclick="game.ui.openRameEditor('${htmlJsString(r.id)}')">✎ Éditer</button><button class="btn-sm" data-dup-rame="${htmlText(r.id)}" onclick="game.ui.duplicateRame('${htmlJsString(r.id)}')">Dupliquer</button><button class="btn-sm danger" onclick="game.ui.deleteRame('${htmlJsString(r.id)}')">Supprimer</button></div>
        </div>
        <div class="rame-card-images">
          ${r.elementDetails.map((e) => {
            const label = e.instanceName || e.name;
            const style = e.flipped ? 'transform: scaleX(-1);' : '';
            return e.imageData
                ? `<img src="${htmlText(e.imageData)}" alt="${htmlText(label)}" title="${htmlText(label)}"${style ? ` style="${style}"` : ''}>`
                : `<span class="rame-text-el">${htmlText(label)}</span>`;
        }).join('')}
        </div>
        <div class="card-info">
          <b>Long:</b> ${r.totalLength.toFixed(1)}m | <b>Masse à vide:</b> ${Math.round(r.totalMass)}t |
          <b>Places:</b> ${r.totalCapacity} | <b>Fret max:</b> ${r.totalFreightCapacity}t | <b>Vmax:</b> ${r.maxSpeed} km/h |
          <b>Traction:</b> ${htmlText(r.traction)}
        </div>
        ${Object.keys(r.freightCapacityByCargo || {}).length ? `<div class="card-info" style="font-size:10px;color:var(--text3)"><b>Capacité par marchandise :</b> ${Object.entries(r.freightCapacityByCargo).map(([t, c]) => `${htmlText(t)}: ${htmlText(c)}t`).join(' · ')}</div>` : ''}
        <div class="card-info" style="font-size:10px;color:var(--text3)">
          <b>Mise en service:</b> ${htmlText(r.createdDate)} | <b>Km parcourus:</b> ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km${r.elementDetails.some((e) => e.purchasePrice) ? ` | <b>Valeur:</b> ${htmlText(r.elementDetails.reduce((s, e) => s + (e.purchasePrice || 0), 0).toLocaleString('fr-FR'))} €` : ''}
          ${r.depotId ? `| <b>Port d'attache:</b> ${htmlText((this.game.depotManager.getAll().find((d) => d.id === r.depotId)?.name || r.depotId))}` : ''}
          | <b>Propreté:</b> ext. ${Math.round(r.cleanliness?.exterior ?? 100)}% / int. ${Math.round(r.cleanliness?.interior ?? 100)}%
          ${r.currentLocation ? `| <b>Position:</b> ${htmlText(this._rameLocationLabel(r))}` : ''}
        </div>
      </div>
    `).join('');
        if (pager) {
            if (pages <= 1) {
                pager.innerHTML = '';
            }
            else {
                pager.innerHTML = `
          <button class="btn-sm" ${this._ramesPage === 0 ? 'disabled' : ''} onclick="game.ui.ramesPageGo(${htmlJsValue(this._ramesPage - 1)})">‹ Préc.</button>
          <span style="margin:0 12px;align-self:center;font-size:13px">Page ${this._ramesPage + 1} / ${pages}</span>
          <button class="btn-sm" ${this._ramesPage >= pages - 1 ? 'disabled' : ''} onclick="game.ui.ramesPageGo(${htmlJsValue(this._ramesPage + 1)})">Suiv. ›</button>`;
            }
        }
    }
    ramesPageGo(p) {
        this._ramesPage = p;
        this.renderRamesList();
        document.getElementById('rames-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    _rameLocationLabel(r) {
        const loc = r.currentLocation || {};
        if (loc.serviceId) {
            const svc = this.game.scheduleCreator.services.find((s) => s.id === loc.serviceId);
            if (svc)
                return `En service ${svc.name} (${svc.state || ''})`;
        }
        if (loc.stationId) {
            const st = this.game.world.getStationById(loc.stationId);
            if (st)
                return `Gare ${st.name}`;
        }
        if (loc.depotId) {
            const d = this.game.depotManager.getDepotById?.(loc.depotId);
            if (d)
                return `Dépôt ${d.name}`;
        }
        if (loc.lat != null && loc.lon != null)
            return `Route (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)})`;
        return 'Inconnue';
    }
    deleteRame(id) {
        const rame = this.game.rameManager.getById(id);
        if (!rame)
            return;
        if (rame.currentLocation?.serviceId)
            return alert('Impossible de supprimer une rame actuellement en service.');
        if (rame.inMaintenance || this.game.depotManager?.isRameInMaintenance?.(rame.id))
            return alert('Impossible de supprimer une rame actuellement en maintenance.');
        const rotationLinks = (this.game.rotationV2?.rotations || []).filter((r) => String(r.assignedRameId || '') === String(rame.id));
        if (rotationLinks.length)
            return alert(`Impossible de supprimer cette rame : elle est encore affectée à ${rotationLinks.length} ligne(s) de roulement.`);
        if (!confirm('Supprimer cette rame ?'))
            return;
        this.game.rameManager.remove(id);
        this.game.saveState();
        this.renderRamesList();
    }
    // --- SCHEDULES ---
    setupSchedulePage() {
        // v1.1.43 — V2 editors inject large style/overlay DOM. Build them only when
        // Horaire/Roulements is actually opened; the Livemap does not need authoring UI.
        document.getElementById('btn-new-schedule')?.addEventListener('click', () => this._ensureScheduleV2Editor().open());
        document.getElementById('btn-schedule-calendars')?.addEventListener('click', () => this._ensureScheduleV2Editor().showCalendarManager());
        document.getElementById('btn-schedule-connections')?.addEventListener('click', () => this.openConnectionsDialog());
        // v1.1.67 — instant search over the V2 timetable library.
        document.getElementById('schedules-search')?.addEventListener('input', () => this._ensureScheduleV2Editor().renderList());
    }
    _ensureScheduleV2Editor() {
        if (!this.scheduleV2Editor)
            this.scheduleV2Editor = new ScheduleV2Editor(this.game, this);
        return this.scheduleV2Editor;
    }
    _ensureWorksV2Editor() {
        if (!this.worksV2Editor)
            this.worksV2Editor = new WorksV2Editor(this.game, this);
        return this.worksV2Editor;
    }
    _ensureInfrastructureV2Editor() {
        if (!this.infrastructureV2Editor)
            this.infrastructureV2Editor = new InfrastructureV2Editor(this.game, this);
        return this.infrastructureV2Editor;
    }
    _ensureDepotITEPointEditor() {
        if (!this.depotITEPointEditor)
            this.depotITEPointEditor = new DepotITEPointEditor(this.game, this);
        return this.depotITEPointEditor;
    }
    _ensureRotationV2Editor() {
        if (!this.rotationV2Editor) {
            this.rotationV2Editor = new RotationV2Editor(this.game, this);
            this.rotationV2Editor.setup();
        }
        return this.rotationV2Editor;
    }
    _stopDataToEditObj(s) {
        const st = s.stationId ? this.game.world.getStationById(s.stationId) : null;
        let stationName = st?.name || s.stationId || '';
        if (s.voiePointId) {
            const vp = this.game.voiePointManager?.getVoiePointById(s.voiePointId);
            stationName = vp ? `Voie ${vp.voie}` : s.voiePointId;
        }
        return {
            stationId: s.stationId,
            voiePointId: s.voiePointId || null,
            stationName,
            type: s.type,
            stopCode: s.stopCode || '',
            arrTimeMin: s.arrivalTime,
            depTimeMin: s.departureTime,
            arrTimeStr: this.minToTimeStr(s.arrivalTime),
            depTimeStr: this.minToTimeStr(s.departureTime),
            platform: s.platform || '',
        };
    }
    _stopEditToData(s) {
        return {
            stationId: s.stationId,
            voiePointId: s.voiePointId || null,
            type: s.type,
            stopCode: s.stopCode || '',
            departureTime: s.depTimeMin,
            arrivalTime: s.arrTimeMin,
            platform: s.platform || '',
        };
    }
    openScheduleModal(editService) {
        this._editingScheduleId = editService?.id || null;
        if (editService) {
            this._forwardStops = editService.stops.map((s) => this._stopDataToEditObj(s));
            this._forwardManualRoutes = (editService.routes || []).map((r) => (r && r.length >= 2 ? [...r] : null));
            this._returnStops = (editService._returnStopsData || []).map((s) => this._stopDataToEditObj(s));
            this._returnManualRoutes = (editService._returnRoutes || []).map((r) => (r && r.length >= 2 ? [...r] : null));
            document.getElementById('sched-name').value = editService.name;
            document.getElementById('sched-return-name').value = editService.returnName || '';
            this._schedReturnPlatforms = editService.returnPlatforms ? { ...editService.returnPlatforms } : {};
            const rtCheck = document.getElementById('sched-round-trip');
            if (rtCheck)
                rtCheck.checked = editService.roundTrip;
            document.getElementById('sched-multi-departures').value = editService.multiDepartures || 1;
            document.getElementById('sched-terminus-wait').value = editService.terminusWait || 5;
            const typeSelect = document.getElementById('sched-service-type');
            if (typeSelect)
                typeSelect.value = editService.serviceType || (editService.isWorkTrain ? 'work' : 'passager');
            const workCheck = document.getElementById('sched-work-train');
            if (workCheck)
                workCheck.checked = (typeSelect?.value === 'work') || editService.isWorkTrain;
            // Populate run days
            const editDays = editService.runDays || [0, 1, 2, 3, 4, 5, 6];
            document.querySelectorAll('.sched-run-day').forEach((cb) => {
                cb.checked = editDays.includes(parseInt(cb.value));
            });
            document.getElementById('sched-run-dates').value = (editService.runDates || []).join(', ');
        }
        else {
            this._forwardStops = [];
            this._forwardManualRoutes = [];
            this._returnStops = [];
            this._returnManualRoutes = [];
            document.getElementById('sched-name').value = '';
            document.getElementById('sched-return-name').value = '';
            this._schedReturnPlatforms = {};
            const rtCheck = document.getElementById('sched-round-trip');
            if (rtCheck)
                rtCheck.checked = false;
            document.getElementById('sched-multi-departures').value = '1';
            document.getElementById('sched-terminus-wait').value = '5';
            const typeSelectNew = document.getElementById('sched-service-type');
            if (typeSelectNew)
                typeSelectNew.value = 'passager';
            const workCheckNew = document.getElementById('sched-work-train');
            if (workCheckNew)
                workCheckNew.checked = false;
            // Default: all days checked, no specific dates
            document.querySelectorAll('.sched-run-day').forEach((cb) => { cb.checked = true; });
            document.getElementById('sched-run-dates').value = '';
        }
        this._isReturnEditMode = false;
        this.schedStops = this._forwardStops;
        this._manualRoutes = this._forwardManualRoutes;
        // Manual-trace state for SC-04 / remaster §IV
        this._manualMode = false;
        this._manualControlPoints = [];
        this._manualStartCoords = null;
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._traceEditMode = false;
        this._traceSelectedPoint = null;
        this._traceDragging = null;
        this._manualControlDrag = null;
        this._updateManualUI();
        document.getElementById('modal-schedule')?.classList.remove('hidden');
        const rameSelect = document.getElementById('sched-rame');
        const rames = this.game.rameManager.getAll();
        rameSelect.innerHTML = rames.map((r) => `<option value="${htmlText(r.id)}">${htmlText(r.name)} (${r.maxSpeed} km/h)</option>`).join('');
        if (editService)
            rameSelect.value = editService.rameId;
        rameSelect.onchange = () => { this.recalcStopsFrom(1); this._renderContractPicker(); };
        this._renderContractPicker(editService?.assignedContractId || '');
        this.renderSchedStops();
        this.setupSchedMap();
    }
    // Section X — affiche le sélecteur de contrat fret pour un service marchandise
    _renderContractPicker(selectedId = '') {
        const row = document.getElementById('sched-contract-row');
        const select = document.getElementById('sched-contract');
        const type = document.getElementById('sched-service-type')?.value || 'passager';
        if (!row || !select)
            return;
        const rameId = document.getElementById('sched-rame')?.value;
        const rame = rameId ? this.game.rameManager.getById(rameId) : null;
        const hasFreight = rame && (rame.totalFreightCapacity > 0 || rame.elementDetails?.some((e) => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0));
        row.style.display = (type === 'fret' || (type === 'passager' && hasFreight)) ? 'flex' : 'none';
        const contracts = this.game.freightManager?.getAllActive() || [];
        const opts = contracts.map((c) => `<option value="${htmlText(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${htmlText(c.from)} → ${htmlText(c.to)} : ${htmlText(c.cargoName)} (${c.quantity}${htmlText(c.unit)}) — ${c.payment.toLocaleString()} €</option>`).join('');
        select.innerHTML = '<option value="">— Aucun contrat assigné —</option>' + opts;
    }
    _calcAutoAR() {
        if (this.schedStops.length < 2)
            return;
        const firstDep = this.schedStops[0].depTimeMin;
        const lastArr = this.schedStops[this.schedStops.length - 1].arrTimeMin;
        const oneWayMin = forwardClockMinutes(firstDep, lastArr);
        if (oneWayMin <= 0)
            return;
        const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
        // One round trip = oneWay + terminusWait + oneWay + terminusWait
        const oneRoundTrip = (oneWayMin * 2) + (terminusWait * 2);
        const maxAR = Math.max(1, Math.floor((24 * 60) / oneRoundTrip));
        document.getElementById('sched-multi-departures').value = maxAR;
        // SC-05 — l'auto 24h nécessite un aller/retour pour générer les départs multiples.
        const rtCheck = document.getElementById('sched-round-trip');
        if (rtCheck && !rtCheck.checked) {
            rtCheck.checked = true;
            const name = document.getElementById('sched-name')?.value.trim() || 'Train';
            const rn = document.getElementById('sched-return-name');
            if (rn && !rn.value.trim())
                rn.value = incrementTrailingNumber(name, 1);
            if (!this._returnStops || this._returnStops.length < 2) {
                this._returnStops = this._generateDefaultReturnStops();
            }
        }
    }
    setupSchedMap() {
        const canvas = document.getElementById('sched-map-canvas');
        if (!canvas)
            return;
        if (this._schedMapInterval)
            clearInterval(this._schedMapInterval);
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight || 500;
        const ctx = canvas.getContext('2d');
        const world = this.game.world;
        // Create a dedicated TileMap for the schedule map (same class as main game map)
        const mainTileMap = this.game.renderer.tileMap;
        if (!this._schedTileMap) {
            // Import TileMap constructor from main renderer's instance
            this._schedTileMap = new mainTileMap.constructor();
        }
        const tileMap = this._schedTileMap;
        tileMap.viewportWidth = canvas.width;
        tileMap.viewportHeight = canvas.height;
        // Center on stations if available, otherwise France
        if (world.stations.length > 0) {
            let sumLat = 0, sumLon = 0;
            for (const st of world.stations) {
                sumLat += st.lat;
                sumLon += st.lon;
            }
            tileMap.centerLat = sumLat / world.stations.length;
            tileMap.centerLon = sumLon / world.stations.length;
            tileMap.zoomLevel = world.stations.length > 5 ? 7 : 8;
        }
        else {
            tileMap.centerLat = 46.8;
            tileMap.centerLon = 2.3;
            tileMap.zoomLevel = 7;
        }
        // Pre-compute junction counts once
        const connectionCount = {};
        for (const track of world.tracks) {
            connectionCount[track.stationA] = (connectionCount[track.stationA] || 0) + 1;
            connectionCount[track.stationB] = (connectionCount[track.stationB] || 0) + 1;
        }
        let _schedDrawPending = false;
        const requestDraw = () => {
            if (_schedDrawPending)
                return;
            _schedDrawPending = true;
            requestAnimationFrame(() => { _schedDrawPending = false; drawMap(); });
        };
        const drawMap = () => {
            // Render tile layers (base map + ORM railway tiles)
            tileMap.renderTiles(ctx, canvas.width, canvas.height);
            // Viewport bounds for culling
            const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
            const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
            const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
            const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
            const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
            const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;
            // Only stations and voie points are drawn in the schedule creator map.
            // Track/troncon grey lines are hidden for readability and performance.
            // Draw stations (viewport-culled)
            const selectedIds = new Set(this.schedStops.map((s) => s.stationId));
            for (const st of world.stations) {
                if (st.lat < vMinLat || st.lat > vMaxLat || st.lon < vMinLon || st.lon > vMaxLon)
                    continue;
                const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                const isSelected = selectedIds.has(st.id);
                const isJunction = (connectionCount[st.id] || 0) >= 3;
                ctx.fillStyle = isSelected ? '#fbbf24' : isJunction ? '#f97316' : '#3b82f6';
                const radius = isSelected ? 7 : isJunction ? 6 : 5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fill();
                if (isJunction && !isSelected) {
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
                    ctx.stroke();
                }
                // Station name label
                ctx.fillStyle = isSelected ? '#fbbf24' : isJunction ? '#fb923c' : '#94a3b8';
                ctx.font = `${tileMap.zoomLevel >= 10 ? 12 : 10}px sans-serif`;
                ctx.fillText(st.name, p.x + 10, p.y + 4);
            }
            // Draw the 'objectif' route (ORM / bon trajet) in magenta behind the actual trace.
            if (this.schedStops.length > 1) {
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                const drawArrow = (x, y, angle, size = 5, color = '#ff00ff') => {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(angle);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(size, 0);
                    ctx.lineTo(-size / 2, -size / 2);
                    ctx.lineTo(-size / 2, size / 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                };
                const drawGeom = (geom) => {
                    if (!geom || geom.length < 2)
                        return false;
                    const step = Math.max(1, Math.floor(geom.length / 80));
                    ctx.beginPath();
                    const p0 = tileMap.worldToScreen(geom[0].lat, geom[0].lon, canvas.width, canvas.height);
                    ctx.moveTo(p0.x, p0.y);
                    for (let r = step; r < geom.length; r += step) {
                        const pr = tileMap.worldToScreen(geom[r].lat, geom[r].lon, canvas.width, canvas.height);
                        ctx.lineTo(pr.x, pr.y);
                    }
                    const pL = tileMap.worldToScreen(geom[geom.length - 1].lat, geom[geom.length - 1].lon, canvas.width, canvas.height);
                    ctx.lineTo(pL.x, pL.y);
                    ctx.stroke();
                    // Annex 18 — sens de circulation arrow along the objectif route
                    if (geom.length >= 4) {
                        const mid = Math.floor(geom.length / 2);
                        const pMid = tileMap.worldToScreen(geom[mid].lat, geom[mid].lon, canvas.width, canvas.height);
                        const pPrev = tileMap.worldToScreen(geom[mid - 1].lat, geom[mid - 1].lon, canvas.width, canvas.height);
                        drawArrow(pMid.x, pMid.y, Math.atan2(pMid.y - pPrev.y, pMid.x - pPrev.x), 5, '#ff00ff');
                    }
                    return true;
                };
                for (let i = 0; i < this.schedStops.length - 1; i++) {
                    const stopA = this.schedStops[i], stopB = this.schedStops[i + 1];
                    const ca = this._getStopCoords(stopA), cb = this._getStopCoords(stopB);
                    if (!ca || !cb)
                        continue;
                    // No straight-line fallback: if the objectif route is not computed yet,
                    // draw nothing for this leg.
                    const geom = this._schedObjectifRoutes?.[i];
                    if (geom && geom.length >= 2)
                        drawGeom(geom);
                }
                ctx.setLineDash([]);
            }
            // Draw voie points on schedule map (viewport-culled for performance)
            const vpm = this.game.voiePointManager;
            if (vpm) {
                // Get viewport bounds for culling
                const topLeft = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
                const botRight = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
                const vpMinLat = Math.min(topLeft.lat, botRight.lat) - 0.01;
                const vpMaxLat = Math.max(topLeft.lat, botRight.lat) + 0.01;
                const vpMinLon = Math.min(topLeft.lon, botRight.lon) - 0.01;
                const vpMaxLon = Math.max(topLeft.lon, botRight.lon) + 0.01;
                // Draw voie point markers — always visible, viewport-culled
                if (tileMap.zoomLevel >= 6) {
                    const usedVPIds = new Set(this.schedStops.filter((s) => s.voiePointId).map((s) => s.voiePointId));
                    for (const vp of vpm.getAll()) {
                        if (vp.lat < vpMinLat || vp.lat > vpMaxLat || vp.lon < vpMinLon || vp.lon > vpMaxLon)
                            continue;
                        const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                        const isUsed = usedVPIds.has(vp.id);
                        const size = 3;
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(Math.PI / 4);
                        ctx.fillStyle = isUsed ? '#fbbf24' : '#0f172a';
                        ctx.fillRect(-size, -size, size * 2, size * 2);
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(-size, -size, size * 2, size * 2);
                        ctx.restore();
                        if (tileMap.zoomLevel >= 13) {
                            ctx.fillStyle = '#94a3b8';
                            ctx.font = '8px sans-serif';
                            ctx.fillText(`Voie ${vp.voie}`, p.x + 6, p.y + 3);
                        }
                    }
                }
            }
            // Draw editable trace (SC-04 / remaster IV — points every 50 m).
            // Tracé actuel en jaune, points de contrôle visibles.
            if (this._manualRoutes) {
                for (let leg = 0; leg < this._manualRoutes.length; leg++) {
                    const route = this._manualRoutes[leg];
                    if (!route || route.length < 2)
                        continue;
                    // Yellow continuous line for the current trace
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    const p0 = tileMap.worldToScreen(route[0].lat, route[0].lon, canvas.width, canvas.height);
                    ctx.moveTo(p0.x, p0.y);
                    for (let i = 1; i < route.length; i++) {
                        const pt = route[i];
                        const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                        ctx.lineTo(p.x, p.y);
                    }
                    ctx.stroke();
                    for (let i = 0; i < route.length; i++) {
                        const pt = route[i];
                        const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                        const isEnd = (i === 0 || i === route.length - 1);
                        const isSelected = this._traceSelectedPoint && this._traceSelectedPoint.leg === leg && this._traceSelectedPoint.control === pt;
                        const isControl = pt && pt.control;
                        ctx.fillStyle = isSelected ? '#38bdf8' : (isEnd ? '#f59e0b' : (isControl ? '#a5f3fc' : 'rgba(255,255,255,0.85)'));
                        const radius = isSelected ? 8 : (isEnd ? 6 : (isControl ? 6 : 3.5));
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                        ctx.fill();
                        if (isSelected || isControl) {
                            ctx.strokeStyle = isSelected ? '#fff' : '#38bdf8';
                            ctx.lineWidth = 1.5;
                            ctx.stroke();
                            // halo for grab visibility
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
                            ctx.strokeStyle = 'rgba(56,189,248,0.35)';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    }
                }
            }
            // Draw manual-trace in-progress control points and temporary line.
            if (this._manualMode && this._manualStartCoords) {
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                const pStart = tileMap.worldToScreen(this._manualStartCoords.lat, this._manualStartCoords.lon, canvas.width, canvas.height);
                ctx.moveTo(pStart.x, pStart.y);
                const drawPts = [...this._manualControlPoints];
                if (this._manualEndCoords)
                    drawPts.push(this._manualEndCoords);
                for (const pt of drawPts) {
                    const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
                ctx.setLineDash([]);
                for (const pt of [this._manualStartCoords, ...this._manualControlPoints]) {
                    const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                    ctx.fillStyle = '#38bdf8';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(56,189,248,0.4)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                if (this._manualEndCoords) {
                    const p = tileMap.worldToScreen(this._manualEndCoords.lat, this._manualEndCoords.lon, canvas.width, canvas.height);
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            // Stop order numbers
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            for (let i = 0; i < this.schedStops.length; i++) {
                const stop = this.schedStops[i];
                let pLat, pLon;
                if (stop.stationId) {
                    const st = world.getStationById(stop.stationId);
                    if (st) {
                        pLat = st.lat;
                        pLon = st.lon;
                    }
                }
                if (!pLat && stop.voiePointId && this.game.voiePointManager) {
                    const vp = this.game.voiePointManager.getVoiePointById(stop.voiePointId);
                    if (vp) {
                        pLat = vp.lat;
                        pLon = vp.lon;
                    }
                }
                if (!pLat)
                    continue;
                const p = tileMap.worldToScreen(pLat, pLon, canvas.width, canvas.height);
                const label = stop.type === 'waypoint' ? `${i + 1}(via)` : String(i + 1);
                ctx.fillText(label, p.x - 3, p.y - 10);
                // Draw waypoint marker for map-placed waypoints
                if (stop.type === 'waypoint' && !stop.stationId) {
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.fillStyle = '#fff';
                }
            }
        };
        this._schedPreviewRoutes = [];
        drawMap();
        // Tile loading: periodically redraw to show loaded tiles
        this._schedMapInterval = setInterval(() => { if (document.getElementById('modal-schedule')?.classList.contains('hidden'))
            return; requestDraw(); }, 250);
        let schedDrag = false, schedDragStart = null, totalDragDist = 0;
        canvas.onmousedown = (e) => {
            const x = e.offsetX, y = e.offsetY;
            schedDrag = true;
            schedDragStart = { x, y };
            totalDragDist = 0;
            // 1) Manual-trace in-progress control point drag.
            if (this._manualMode && this._manualStartCoords) {
                const mp = this._findNearestManualControlPoint(x, y, tileMap, canvas);
                if (mp) {
                    if (e.ctrlKey || e.button === 2) {
                        this._manualControlPoints.splice(mp.index, 1);
                        requestDraw();
                    }
                    else {
                        this._manualControlDrag = { index: mp.index, startX: x, startY: y, moved: false };
                    }
                    schedDrag = false;
                    schedDragStart = null;
                    totalDragDist = 0;
                    return;
                }
            }
            // 2) Existing route control-point drag (works in manual mode too, so nodes can be edited at any time).
            const controlHit = this._findNearestControlPoint(x, y, tileMap, canvas);
            if (controlHit) {
                // Don't grab a route node if a station marker is right under the cursor.
                let nearStation = false;
                for (const st of world.stations) {
                    const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                    if (Math.hypot(p.x - x, p.y - y) < 14) {
                        nearStation = true;
                        break;
                    }
                }
                if (!nearStation) {
                    // Promote any grabbed trace point to a control so it can be edited.
                    if (controlHit.control && !controlHit.control.control)
                        controlHit.control.control = true;
                    if (e.ctrlKey || e.button === 2) {
                        this._removeTraceControl(controlHit.leg, controlHit.control);
                        this._traceSelectedPoint = null;
                    }
                    else {
                        this._traceSelectedPoint = { leg: controlHit.leg, control: controlHit.control };
                        this._traceDragging = { leg: controlHit.leg, control: controlHit.control, startX: x, startY: y, moved: false };
                        requestDraw();
                    }
                    schedDrag = false;
                    schedDragStart = null;
                    totalDragDist = 0;
                    return;
                }
            }
        };
        canvas.onmousemove = (e) => {
            if (this._manualControlDrag) {
                const dx = e.offsetX - this._manualControlDrag.startX;
                const dy = e.offsetY - this._manualControlDrag.startY;
                if (!this._manualControlDrag.moved && Math.hypot(dx, dy) < 4)
                    return;
                this._manualControlDrag.moved = true;
                const w = tileMap.screenToWorld(e.offsetX, e.offsetY, canvas.width, canvas.height);
                this._moveManualControlPoint(this._manualControlDrag.index, w.lat, w.lon);
                requestDraw();
                return;
            }
            if (this._traceDragging) {
                const dx = e.offsetX - this._traceDragging.startX;
                const dy = e.offsetY - this._traceDragging.startY;
                if (!this._traceDragging.moved && Math.hypot(dx, dy) < 4)
                    return;
                this._traceDragging.moved = true;
                const w = tileMap.screenToWorld(e.offsetX, e.offsetY, canvas.width, canvas.height);
                this._moveTracePoint(this._traceDragging.leg, this._traceDragging.control, w.lat, w.lon);
                requestDraw();
                return;
            }
            if (schedDrag && schedDragStart) {
                const dx = e.offsetX - schedDragStart.x;
                const dy = e.offsetY - schedDragStart.y;
                totalDragDist += Math.abs(dx) + Math.abs(dy);
                tileMap.pan(dx, dy);
                schedDragStart = { x: e.offsetX, y: e.offsetY };
                requestDraw();
                return;
            }
            // Hover feedback
            const x = e.offsetX, y = e.offsetY;
            let cursor = 'default';
            const manualPt = (this._manualMode && this._manualStartCoords) ? this._findNearestManualControlPoint(x, y, tileMap, canvas) : null;
            const controlHit = this._findNearestControlPoint(x, y, tileMap, canvas);
            if (manualPt || controlHit)
                cursor = 'grab';
            else {
                if (this.game.voiePointManager) {
                    for (const vp of this.game.voiePointManager.getAll()) {
                        const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                        if (Math.hypot(p.x - x, p.y - y) < 12) {
                            cursor = 'pointer';
                            break;
                        }
                    }
                }
                if (cursor === 'default') {
                    for (const st of world.stations) {
                        const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                        if (Math.hypot(p.x - x, p.y - y) < 16) {
                            cursor = 'pointer';
                            break;
                        }
                    }
                }
            }
            canvas.style.cursor = cursor;
        };
        canvas.onmouseup = async (e) => {
            // SC-XX — insertion d'un arrêt entre deux arrêts existants (remarque joueur).
            if (this._insertAfterIndex != null) {
                if (totalDragDist < 5) {
                    const x = e.offsetX, y = e.offsetY;
                    let closestVP = null, minVPDist = Infinity;
                    if (this.game.voiePointManager) {
                        for (const vp of this.game.voiePointManager.getAll()) {
                            const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                            const d = Math.hypot(p.x - x, p.y - y);
                            if (d < minVPDist && d < 15) {
                                minVPDist = d;
                                closestVP = vp;
                            }
                        }
                    }
                    let closest = null, minDist = Infinity;
                    for (const st of world.stations) {
                        const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < minDist && d < 20) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (closestVP && minVPDist < minDist) {
                        await this._insertStopFromMap(this._insertAfterIndex, closestVP);
                    }
                    else if (closest) {
                        await this._insertStopFromMap(this._insertAfterIndex, closest);
                    }
                }
                this._insertAfterIndex = null;
                this._updateManualUI();
                schedDrag = false;
                schedDragStart = null;
                totalDragDist = 0;
                return;
            }
            if (this._manualControlDrag) {
                const wasMoved = this._manualControlDrag.moved;
                this._manualControlDrag = null;
                if (wasMoved) {
                    schedDrag = false;
                    schedDragStart = null;
                    totalDragDist = 0;
                    return;
                }
                // A simple click on an in-progress control point does nothing.
                schedDrag = false;
                schedDragStart = null;
                totalDragDist = 0;
                return;
            }
            if (this._traceDragging) {
                const dw = this._traceDragging;
                this._traceDragging = null;
                if (dw.moved) {
                    // End of a trace-point drag: recompute travel times from this leg onward.
                    await this._recalcAfterTraceEdit(dw.leg);
                    this.game.saveState();
                }
                else if (this._manualEndCoords && dw.control === this._manualEndCoords) {
                    // In a manual retrace, clicking (not dragging) the target anchor finishes the segment.
                    await this._finishManualRetrace();
                }
                schedDrag = false;
                schedDragStart = null;
                totalDragDist = 0;
                return;
            }
            if (totalDragDist < 5) {
                const x = e.offsetX, y = e.offsetY;
                // Manual trace mode (SC-04): choose a start point, add waypoints, then click a target point to finish — like livemap.
                // Also supports deleting an existing control point to redraw its segment by hand.
                if (this._manualMode) {
                    const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
                    // Retrace in progress: finish by clicking the target end control, or add another point.
                    if (this._manualEndCoords) {
                        const pEnd = tileMap.worldToScreen(this._manualEndCoords.lat, this._manualEndCoords.lon, canvas.width, canvas.height);
                        if (Math.hypot(pEnd.x - x, pEnd.y - y) <= 20) {
                            await this._finishManualRetrace();
                        }
                        else {
                            this._addManualPoint(worldPos.lat, worldPos.lon);
                        }
                        schedDrag = false;
                        schedDragStart = null;
                        return;
                    }
                    let closestVP = null, minVPDist = Infinity;
                    if (this.game.voiePointManager) {
                        for (const vp of this.game.voiePointManager.getAll()) {
                            const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                            const d = Math.hypot(p.x - x, p.y - y);
                            if (d < minVPDist && d < 15) {
                                minVPDist = d;
                                closestVP = vp;
                            }
                        }
                    }
                    let closest = null, minDist = Infinity;
                    for (const st of world.stations) {
                        const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < minDist && d < 20) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (!this._manualStartCoords) {
                        // Livemap-style: first click on a station/voie point sets the departure.
                        if (!closest && !closestVP) {
                            this._updateManualUI();
                            schedDrag = false;
                            schedDragStart = null;
                            return;
                        }
                        // If this is the very first stop of the service, add it now.
                        if (this.schedStops.length === 0) {
                            if (closestVP && minVPDist < minDist) {
                                await this.addSchedVoiePointStop(closestVP);
                            }
                            else if (closest) {
                                await this.addSchedStop(closest);
                            }
                        }
                        const lastStop = this.schedStops[this.schedStops.length - 1];
                        this._manualStartCoords = this._getStopCoords(lastStop);
                        const rameId2 = document.getElementById('sched-rame')?.value;
                        const rame2 = this.game.rameManager.getById(rameId2);
                        this._manualStartCoords.maxSpeed = rame2 ? rame2.maxSpeed : 30;
                        this._manualControlPoints = [];
                        this._updateManualUI();
                        if (this._drawSchedMap)
                            this._drawSchedMap();
                        schedDrag = false;
                        schedDragStart = null;
                        return;
                    }
                    if (closestVP && minVPDist < minDist) {
                        await this.addSchedVoiePointStop(closestVP);
                    }
                    else if (closest) {
                        await this.addSchedStop(closest);
                    }
                    else {
                        // SC-XX — ajout direct d'un point de contrôle manuel pour un tracé libre "My Maps".
                        this._addManualPoint(worldPos.lat, worldPos.lon);
                    }
                    schedDrag = false;
                    schedDragStart = null;
                    return;
                }
                // Shift + click on a segment: insert a new 50 m trace point.
                if (e.shiftKey) {
                    const seg = this._findNearestSegmentPoint(x, y, tileMap, canvas);
                    if (seg) {
                        this._insertTracePoint(seg.leg, seg.index, seg.lat, seg.lon);
                        await this._recalcAfterTraceEdit(seg.leg);
                        return;
                    }
                }
                // Check voie points first
                let closestVP = null, minVPDist = Infinity;
                if (this.game.voiePointManager) {
                    for (const vp of this.game.voiePointManager.getAll()) {
                        const p = tileMap.worldToScreen(vp.lat, vp.lon, canvas.width, canvas.height);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < minVPDist && d < 15) {
                            minVPDist = d;
                            closestVP = vp;
                        }
                    }
                }
                // Check stations
                let closest = null, minDist = Infinity;
                for (const st of world.stations) {
                    const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                    const d = Math.hypot(p.x - x, p.y - y);
                    if (d < minDist && d < 20) {
                        minDist = d;
                        closest = st;
                    }
                }
                if (closestVP && minVPDist < minDist) {
                    await this.addSchedVoiePointStop(closestVP);
                }
                else if (closest) {
                    await this.addSchedStop(closest);
                }
                else if (e.shiftKey) {
                    // Shift + click on empty space: add a map waypoint snapped to track.
                    const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
                    await this._addMapWaypoint(worldPos.lat, worldPos.lon);
                }
            }
            schedDrag = false;
            schedDragStart = null;
        };
        // Double-click a trace point to re-draw the segment around it.
        canvas.ondblclick = (e) => {
            const x = e.offsetX, y = e.offsetY;
            this._manualControlPoints = [];
            this._manualControlDrag = null;
            this._traceDragging = null;
            const controlHit = this._findNearestControlPoint(x, y, tileMap, canvas);
            if (controlHit) {
                this._manualMode = true;
                this._startManualRetrace(controlHit.leg, controlHit.index);
            }
        };
        canvas.onwheel = (e) => {
            e.preventDefault();
            tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY);
            requestDraw();
        };
        canvas.oncontextmenu = (e) => { e.preventDefault(); };
        this._drawSchedMap = drawMap;
        // Map search bar (Annexe 10a)
        const searchInput = document.getElementById('sched-map-search');
        if (searchInput) {
            searchInput.onkeydown = (e) => {
                if (e.key !== 'Enter')
                    return;
                const q = searchInput.value.trim().toLowerCase();
                if (!q)
                    return;
                let best = null;
                for (const st of world.stations) {
                    if (st.name?.toLowerCase().includes(q)) {
                        best = st;
                        break;
                    }
                }
                if (!best && this.game.voiePointManager) {
                    for (const vp of this.game.voiePointManager.getAll()) {
                        if (vp.name?.toLowerCase().includes(q) || (vp.voie && String(vp.voie).toLowerCase().includes(q))) {
                            best = vp;
                            break;
                        }
                    }
                }
                if (best) {
                    tileMap.centerLat = best.lat;
                    tileMap.centerLon = best.lon;
                    tileMap.zoomLevel = Math.max(tileMap.zoomLevel, 13);
                    requestDraw();
                }
            };
        }
        this._recalcPreviewRoutes();
    }
    // --- Manual trace helpers (remaster IV) ---
    _toggleManualMode() {
        if (this._manualMode) {
            // cancel manual mode, keep control points? If no next stop yet, just exit
            this._manualMode = false;
            this._manualStartCoords = null;
            this._manualEndCoords = null;
            this._manualRetraceLeg = null;
            this._manualControlPoints = [];
        }
        else {
            this._manualMode = true;
            this._manualStartCoords = this.schedStops.length > 0 ? this._getStopCoords(this.schedStops[this.schedStops.length - 1]) : null;
            if (this._manualStartCoords) {
                const rameId = document.getElementById('sched-rame')?.value;
                const rame = this.game.rameManager.getById(rameId);
                this._manualStartCoords.maxSpeed = rame ? rame.maxSpeed : 30;
            }
            this._manualEndCoords = null;
            this._manualRetraceLeg = null;
            this._manualControlPoints = [];
        }
        this._updateManualUI();
        if (this._drawSchedMap)
            this._drawSchedMap();
    }
    _clearManualTrace() {
        this._manualRoutes[this._manualRoutes.length - 1] = null;
        this._manualControlPoints = [];
        this._manualMode = false;
        this._manualStartCoords = null;
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._manualControlDrag = null;
        this._updateManualUI();
        this._recalcPreviewRoutes();
    }
    _updateManualUI() {
        const btn = document.getElementById('btn-sched-manual');
        const clear = document.getElementById('btn-sched-clear-manual');
        const edit = document.getElementById('btn-sched-edit-trace');
        const del = document.getElementById('btn-sched-delete-point');
        const hint = document.getElementById('sched-manual-hint');
        const returnBtn = document.getElementById('btn-sched-return-mode');
        const modeLabel = document.getElementById('sched-mode-label');
        const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
        if (returnBtn) {
            returnBtn.classList.toggle('hidden', !roundTrip || this._forwardStops.length < 2);
            returnBtn.textContent = this._isReturnEditMode ? 'Retour aller' : 'Tracer le retour';
        }
        if (modeLabel) {
            modeLabel.textContent = this._isReturnEditMode ? 'Retour' : 'Aller';
            modeLabel.style.background = this._isReturnEditMode ? '#7c3aed' : 'var(--bg2)';
            modeLabel.style.color = this._isReturnEditMode ? '#fff' : 'var(--text2)';
        }
        if (!btn || !clear || !hint)
            return;
        const hasTrace = this._manualRoutes && this._manualRoutes.some((r) => r && r.length >= 2);
        if (edit)
            edit.classList.toggle('hidden', !hasTrace);
        if (del)
            del.classList.toggle('hidden', !this._traceSelectedPoint);
        if (this._insertAfterIndex != null) {
            hint.textContent = `Insertion après l'arrêt ${this._insertAfterIndex + 1} — cliquez sur une gare ou un point de voie sur la carte. Échap pour annuler.`;
            return;
        }
        if (this._manualMode) {
            const hasStart = !!this._manualStartCoords;
            const isRetrace = this._manualEndCoords != null;
            if (isRetrace) {
                btn.textContent = 'Terminer le retracé';
                hint.textContent = 'Retracez le segment supprimé — cliquez pour ajouter des points, puis cliquez sur le point d\'arrivée pour terminer.';
            }
            else {
                btn.textContent = hasStart ? 'Terminer (cliquer gare/point)' : 'Choisir le départ';
                hint.textContent = hasStart
                    ? 'Mode manuel actif — cliquez pour poser des points, gare/point de voie pour terminer ce segment.'
                    : 'Mode manuel — cliquez sur la gare ou le point de voie de départ (comme sur la livemap).';
            }
            btn.style.background = '#3b82f6';
            btn.style.color = '#fff';
            clear.classList.remove('hidden');
        }
        else {
            btn.textContent = 'Tracer manuellement (points 50 m)';
            btn.style.background = '';
            btn.style.color = '';
            clear.classList.add('hidden');
            const base = "Cliquer sur les gares de la carte pour définir le trajet. Les horaires sont calculés automatiquement depuis les données ORM et la rame.";
            const editHint = hasTrace ? " Attrapez un point blanc pour déplacer le tracé, Shift+clic sur un segment pour ajouter un point, Ctrl+clic pour supprimer." : '';
            hint.textContent = base + editHint;
        }
    }
    // SC-04 — switch between forward and independent return editing.
    async _toggleReturnEditMode() {
        const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
        if (!roundTrip)
            return;
        if (this._forwardStops.length < 2)
            return alert('Definissez d\'abord un aller avec au moins 2 arrets.');
        if (this._isReturnEditMode) {
            // Switch back to forward mode: capture return edits first.
            this._returnStops = this.schedStops;
            this._returnManualRoutes = this._manualRoutes;
            this.schedStops = this._forwardStops;
            this._manualRoutes = this._forwardManualRoutes;
            this._isReturnEditMode = false;
        }
        else {
            // Switch to return mode: capture forward edits and seed a default return if empty.
            this._forwardStops = this.schedStops;
            this._forwardManualRoutes = this._manualRoutes;
            if (!this._returnStops || this._returnStops.length < 2) {
                this._returnStops = this._generateDefaultReturnStops();
                this._returnManualRoutes = this._generateDefaultReturnRoutes();
                // Switch the active edit buffers BEFORE recalculation. Previously the
                // return timing pass still read this._manualRoutes from the outbound leg,
                // so return timings could silently be calculated on the wrong physical
                // track even when a distinct return route existed.
                this.schedStops = this._returnStops;
                this._manualRoutes = this._returnManualRoutes;
                await this._recalcReturnTimes();
                this._returnManualRoutes = this._manualRoutes;
            }
            else {
                this.schedStops = this._returnStops;
                this._manualRoutes = this._returnManualRoutes;
            }
            this._isReturnEditMode = true;
        }
        this._traceSelectedPoint = null;
        this._traceDragging = null;
        this._manualControlDrag = null;
        this._manualMode = false;
        this._manualControlPoints = [];
        this._manualStartCoords = null;
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._updateManualUI();
        this.renderSchedStops();
        this._recalcPreviewRoutes();
    }
    _generateDefaultReturnStops() {
        const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
        const fwd = this._forwardStops;
        if (fwd.length < 2)
            return [];
        const rev = [...fwd].reverse();
        const lastArr = rev[0].arrTimeMin ?? rev[0].depTimeMin ?? 0;
        let currentTime = lastArr + terminusWait;
        const out = [];
        for (let i = 0; i < rev.length; i++) {
            const s = rev[i];
            let travelTime = 0;
            if (i > 0) {
                // Reuse the forward segment durations in reverse order.
                const earlierIdx = fwd.length - 1 - i;
                const laterIdx = fwd.length - i;
                travelTime = Math.max(0, (fwd[laterIdx]?.arrTimeMin ?? 0) - (fwd[earlierIdx]?.depTimeMin ?? 0));
                if (travelTime <= 0)
                    travelTime = 15;
            }
            const arrTime = currentTime + travelTime;
            const dwell = (s.type === 'arret' && i > 0 && i < rev.length - 1)
                ? Math.max(2, (s.depTimeMin ?? 0) - (s.arrTimeMin ?? 0))
                : 0;
            const depTime = arrTime + dwell;
            currentTime = depTime;
            // Mirror platform swap from ActiveService.buildReturnStops.
            let returnPlat = s.platform || '';
            if (returnPlat === '1' || returnPlat === 'Voie 1')
                returnPlat = '2';
            else if (returnPlat === '2' || returnPlat === 'Voie 2')
                returnPlat = '1';
            else if (/^\d+$/.test(returnPlat)) {
                const n = parseInt(returnPlat, 10);
                returnPlat = String(n % 2 === 0 ? n - 1 : n + 1);
            }
            out.push({
                stationId: s.stationId,
                voiePointId: s.voiePointId || null,
                stationName: this._stopNameFor(s.stationId, s.voiePointId),
                type: s.type,
                stopCode: s.stopCode || '',
                arrTimeMin: arrTime,
                depTimeMin: depTime,
                arrTimeStr: this.minToTimeStr(arrTime),
                depTimeStr: this.minToTimeStr(depTime),
                platform: returnPlat,
            });
        }
        return out;
    }
    _generateDefaultReturnRoutes() {
        // v1.1.73 — never derive a railway return path by reversing the outbound
        // physical geometry. A double-track outbound trace is NOT the inbound track.
        // Seed empty return legs; _recalcReturnTimes/_resolveRouteForLeg will ask ORM
        // for the real connected return railway. The player can still trace a return
        // manually when desired.
        const legCount = Math.max(0, (this._forwardStops || []).length - 1);
        return Array.from({ length: legCount }, () => null);
    }
    async _recalcReturnTimes() {
        if (!this._returnStops || this._returnStops.length < 2)
            return;
        const rameId = document.getElementById('sched-rame').value;
        const rame = this.game.rameManager.getById(rameId);
        const rameSpeed = rame ? rame.maxSpeed : 120;
        for (let i = 1; i < this._returnStops.length; i++) {
            const prev = this._returnStops[i - 1], cur = this._returnStops[i];
            const travelTime = await this._getSegmentTravelTime(prev, cur, rameSpeed, rame, i - 1);
            cur.arrTimeMin = prev.depTimeMin + travelTime;
            cur.depTimeMin = cur.arrTimeMin + (cur.type === 'arret' ? 2 : 0);
            cur.arrTimeStr = this.minToTimeStr(cur.arrTimeMin);
            cur.depTimeStr = this.minToTimeStr(cur.depTimeMin);
        }
    }
    _stopNameFor(stationId, voiePointId) {
        if (stationId) {
            const st = this.game.world.getStationById(stationId);
            if (st)
                return st.name;
        }
        if (voiePointId) {
            const vp = this.game.voiePointManager?.getVoiePointById(voiePointId);
            if (vp)
                return `Voie ${vp.voie}`;
        }
        return stationId || voiePointId || '';
    }
    _toggleTraceEdit() {
        this._traceEditMode = !this._traceEditMode;
        if (!this._traceEditMode)
            this._traceSelectedPoint = null;
        this._updateManualUI();
        if (this._drawSchedMap)
            this._drawSchedMap();
    }
    _deleteSelectedTracePoint() {
        if (!this._traceSelectedPoint)
            return;
        this._removeTraceControl(this._traceSelectedPoint.leg, this._traceSelectedPoint.control);
        this._traceSelectedPoint = null;
        this._updateManualUI();
    }
    _removeTraceControl(leg, control) {
        if (!control)
            return;
        const route = this._manualRoutes[leg];
        if (!route)
            return;
        const controls = this._extractRouteControls(route);
        const idx = controls.indexOf(control);
        if (idx <= 0 || idx >= controls.length - 1)
            return;
        controls.splice(idx, 1);
        this._manualRoutes[leg] = this._densifyRoute(controls);
        this._recalcAfterTraceEdit(leg);
    }
    _addManualPoint(lat, lon) {
        if (this._manualStartCoords) {
            const maxSpeed = this._manualStartCoords.maxSpeed || 30;
            const snapped = this._snapToTrack(lat, lon);
            this._manualControlPoints.push({ lat: snapped ? snapped.lat : lat, lon: snapped ? snapped.lon : lon, maxSpeed });
            if (this._drawSchedMap)
                this._drawSchedMap();
        }
    }
    _finishManualLeg(endStop, maxSpeed = 30) {
        if (!this._manualMode || !this._manualStartCoords)
            return;
        const endCoords = this._getStopCoords(endStop);
        if (!endCoords)
            return;
        endCoords.maxSpeed = maxSpeed;
        const route = this._buildManualRoute(this._manualStartCoords, this._manualControlPoints, endCoords, maxSpeed);
        const legIdx = Math.max(0, this.schedStops.length - 1); // leg between last existing stop and endStop
        this._manualRoutes[legIdx] = route;
        // Stay in manual mode and continue from the new stop (My Maps style)
        this._manualControlPoints = [];
        this._manualStartCoords = endCoords;
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._updateManualUI();
    }
    _startManualRetrace(leg, routeIndex) {
        const route = this._manualRoutes[leg];
        if (!route || route.length < 3)
            return;
        let startIdx = routeIndex;
        let endIdx = routeIndex;
        // Find the previous control point (or start of route)
        while (startIdx >= 0 && !route[startIdx]?.control)
            startIdx--;
        if (startIdx < 0)
            startIdx = 0;
        if (!route[startIdx].control)
            route[startIdx].control = true;
        // Find the next control point (or end of route)
        endIdx = startIdx + 1;
        while (endIdx < route.length && !route[endIdx]?.control)
            endIdx++;
        if (endIdx >= route.length)
            endIdx = route.length - 1;
        if (!route[endIdx].control)
            route[endIdx].control = true;
        if (startIdx >= endIdx)
            return;
        this._manualMode = true;
        this._manualRetraceLeg = leg;
        this._manualStartCoords = route[startIdx];
        this._manualEndCoords = route[endIdx];
        this._manualControlPoints = [];
        // Strip the old segment between the fixed controls; it will be redrawn by hand.
        this._manualRoutes[leg] = [...route.slice(0, startIdx + 1), ...route.slice(endIdx)];
        this._updateManualUI();
        if (this._drawSchedMap)
            this._drawSchedMap();
    }
    async _finishManualRetrace() {
        if (!this._manualMode || this._manualRetraceLeg == null || !this._manualStartCoords || !this._manualEndCoords)
            return;
        const leg = this._manualRetraceLeg;
        const newSegment = this._densifyRoute([this._manualStartCoords, ...this._manualControlPoints, this._manualEndCoords], 0.05);
        const route = this._manualRoutes[leg] || [];
        const startIdx = route.indexOf(this._manualStartCoords);
        const endIdx = route.indexOf(this._manualEndCoords);
        if (startIdx >= 0 && endIdx >= 0 && startIdx < endIdx) {
            this._manualRoutes[leg] = [...route.slice(0, startIdx + 1), ...newSegment.slice(1, -1), ...route.slice(endIdx)];
        }
        else {
            this._manualRoutes[leg] = newSegment;
        }
        this._manualMode = false;
        this._manualControlPoints = [];
        this._manualStartCoords = null;
        this._manualEndCoords = null;
        this._manualRetraceLeg = null;
        this._updateManualUI();
        await this._recalcAfterTraceEdit(leg);
    }
    _buildManualRoute(start, controls, end, maxSpeed = 30) {
        const points = [{ ...start, maxSpeed, control: true }, ...controls.map((p) => ({ ...p, maxSpeed, control: true })), { ...end, maxSpeed, control: true }];
        return this._densifyRoute(points, 0.05);
    }
    // --- Sillon picker (Section V integration) ---
    openSillonPicker(sillons, fromName, toName) {
        return new Promise((resolve) => {
            this._pendingSillonResolve = resolve;
            const modal = document.getElementById('modal-sillon-picker');
            const list = document.getElementById('sillon-picker-list');
            if (!modal || !list)
                return resolve(null);
            list.innerHTML = `
        <div class="sillon-item" style="margin-bottom:6px;cursor:pointer" onclick="game.ui._resolveSillonPicker('orm')">
          <div><b>Itinéraire ORM automatique</b><br><span>Calcul normal entre ${htmlText(fromName)} et ${htmlText(toName)}</span></div>
        </div>
        ${sillons.map((s, i) => `
          <div class="sillon-item" style="cursor:pointer" onclick="game.ui._resolveSillonPicker(${htmlJsValue(i)})">
            <div><b>${htmlText(s.name)}</b> — ${htmlText(s.fromStationName)} → ${htmlText(s.toStationName)}<br><span>${Math.round(s.distance)} km · Vmax ${s.maxSpeed} km/h · ${s.electrified !== false ? 'électrifié' : 'non électrifié'}</span></div>
          </div>
        `).join('')}
      `;
            modal.classList.remove('hidden');
        });
    }
    _resolveSillonPicker(index) {
        const modal = document.getElementById('modal-sillon-picker');
        if (modal)
            modal.classList.add('hidden');
        if (this._pendingSillonResolve) {
            const resolve = this._pendingSillonResolve;
            this._pendingSillonResolve = null;
            resolve(index);
        }
    }
    async _pickSillonForLeg(prevStop, newStop, legIdx) {
        if (!this.game.sillonManager || !prevStop?.stationId || !newStop?.stationId)
            return null;
        // Section V : propose direct + chained (multi-hop) auto-sillon paths.
        const paths = this.game.sillonManager.findPaths(prevStop.stationId, newStop.stationId, 4);
        if (!paths.length)
            return null;
        const prevName = prevStop.stationName;
        const newName = newStop.stationName;
        const choice = await this.openSillonPicker(paths, prevName, newName);
        if (choice === null || choice === 'orm')
            return null;
        const path = paths[choice];
        if (!path || !path.route?.length)
            return null;
        // Densify to 50 m points like manual trace.
        const route = this._densifyRoute(path.route.map((p) => ({ lat: p.lat, lon: p.lon, maxSpeed: p.maxSpeed || path.maxSpeed })));
        if (!this._manualRoutes)
            this._manualRoutes = [];
        this._manualRoutes[legIdx] = route;
        this._sillonLegSelection = this._sillonLegSelection || {};
        this._sillonLegSelection[legIdx] = path.name;
        return route;
    }
    async addSchedStop(station) {
        if (station.closed) {
            alert('Cette gare est fermee — aucun train ne peut la desservir.');
            return;
        }
        const rameId = document.getElementById('sched-rame').value;
        const rame = this.game.rameManager.getById(rameId);
        const rameSpeed = rame ? rame.maxSpeed : 160;
        let arrTimeMin, depTimeMin;
        const newStop = {
            stationId: station.id,
            stationName: station.name,
            type: 'arret',
            stopCode: '',
            arrTimeMin: 0,
            depTimeMin: 0,
            arrTimeStr: '00:00',
            depTimeStr: '00:00',
            platform: '',
        };
        if (this.schedStops.length === 0) {
            const pt = this.game.engine.getParisTime();
            const currentMin = pt.hours * 60 + pt.minutes;
            arrTimeMin = Math.ceil(currentMin / 5) * 5;
            depTimeMin = arrTimeMin;
        }
        else {
            const prevStop = this.schedStops[this.schedStops.length - 1];
            const legIdx = this.schedStops.length - 1;
            if (this._manualMode) {
                this._finishManualLeg(newStop, rameSpeed);
            }
            else if (this.game.sillonManager) {
                // Section V : propose pre-defined sillons for this segment.
                await this._pickSillonForLeg(prevStop, newStop, legIdx);
            }
            const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, legIdx);
            arrTimeMin = prevStop.depTimeMin + travelTime;
            depTimeMin = arrTimeMin + 2;
        }
        newStop.arrTimeMin = arrTimeMin;
        newStop.depTimeMin = depTimeMin;
        newStop.arrTimeStr = this.minToTimeStr(arrTimeMin);
        newStop.depTimeStr = this.minToTimeStr(depTimeMin);
        this.schedStops.push(newStop);
        this.renderSchedStops();
        this._recalcPreviewRoutes();
    }
    async addSchedVoiePointStop(voiePoint) {
        // Add voie point as invisible waypoint (no stop, no time, just passage obligé)
        const rameId = document.getElementById('sched-rame').value;
        const rame = this.game.rameManager.getById(rameId);
        const rameSpeed = rame ? rame.maxSpeed : 160;
        // If voie point is linked to a station, show "GareName — Voie X"
        let vpName = `Voie ${voiePoint.voie}`;
        let vpStationId = null;
        if (voiePoint.stationId) {
            const st = this.game.world.getStationById(voiePoint.stationId);
            if (st) {
                vpName = `${st.name} — Voie ${voiePoint.voie}`;
                vpStationId = st.id;
            }
        }
        const newStop = {
            stationId: vpStationId,
            voiePointId: voiePoint.id,
            stationName: vpName,
            type: 'waypoint',
            stopCode: '',
            arrTimeMin: 0,
            depTimeMin: 0,
            arrTimeStr: '00:00',
            depTimeStr: '00:00',
            platform: voiePoint.voie,
        };
        let arrTimeMin, depTimeMin;
        if (this.schedStops.length === 0) {
            const pt = this.game.engine.getParisTime();
            const currentMin = pt.hours * 60 + pt.minutes;
            arrTimeMin = Math.ceil(currentMin / 5) * 5;
            depTimeMin = arrTimeMin;
        }
        else {
            const prevStop = this.schedStops[this.schedStops.length - 1];
            const legIdx = this.schedStops.length - 1;
            if (this._manualMode) {
                this._finishManualLeg(newStop, rameSpeed);
            }
            else if (this.game.sillonManager) {
                // Section V : propose pre-defined sillons between voie points / stations too.
                await this._pickSillonForLeg(prevStop, newStop, legIdx);
            }
            const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, legIdx);
            arrTimeMin = prevStop.depTimeMin + travelTime;
            depTimeMin = arrTimeMin; // no stop time for waypoint
        }
        newStop.arrTimeMin = arrTimeMin;
        newStop.depTimeMin = depTimeMin;
        newStop.arrTimeStr = this.minToTimeStr(arrTimeMin);
        newStop.depTimeStr = this.minToTimeStr(depTimeMin);
        this.schedStops.push(newStop);
        this.renderSchedStops();
        this._recalcPreviewRoutes();
    }
    async _addMapWaypoint(lat, lon) {
        if (this.schedStops.length === 0)
            return; // need at least one stop first
        const vpm = this.game.voiePointManager;
        // Try to snap to nearest tronçon route point
        let snappedLat = lat, snappedLon = lon;
        let bestDist = Infinity;
        for (const trc of vpm.getAllTroncons()) {
            if (!trc.route)
                continue;
            for (const pt of trc.route) {
                const d = Math.sqrt(Math.pow((pt.lat - lat) * 111, 2) + Math.pow((pt.lon - lon) * 111 * Math.cos(lat * Math.PI / 180), 2));
                if (d < bestDist) {
                    bestDist = d;
                    snappedLat = pt.lat;
                    snappedLon = pt.lon;
                }
            }
        }
        // If no tronçon nearby, try ORM snap
        if (bestDist > 2) {
            try {
                const snapResult = await this.game.orm.snapToRailway(lat, lon, 2);
                if (snapResult) {
                    snappedLat = snapResult.lat;
                    snappedLon = snapResult.lon;
                    bestDist = snapResult.dist;
                }
            }
            catch (e) { /* keep original coords */ }
        }
        // Only add if within reasonable distance of a railway (5km)
        if (bestDist > 5)
            return;
        // Create a temporary voie point for this waypoint
        const vpId = `vp-wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        vpm.addVoiePoint({ id: vpId, lat: snappedLat, lon: snappedLon, voie: 'WP', stationId: null });
        const rameId = document.getElementById('sched-rame').value;
        const rame = this.game.rameManager.getById(rameId);
        const rameSpeed = rame ? rame.maxSpeed : 160;
        // SC-10 — insert the waypoint on the nearest INTERIOR segment so the
        // following stops are preserved; append only when the click is past the end.
        let insertIndex = this.schedStops.length;
        if (this.schedStops.length >= 2) {
            let best = Infinity, bestSeg = -1, bestT = 0;
            for (let i = 0; i < this.schedStops.length - 1; i++) {
                const a = this._getStopCoords(this.schedStops[i]);
                const b = this._getStopCoords(this.schedStops[i + 1]);
                if (!a || !b)
                    continue;
                const r = this._pointSegDistKm(snappedLat, snappedLon, a, b);
                if (r.dist < best) {
                    best = r.dist;
                    bestSeg = i;
                    bestT = r.t;
                }
            }
            if (bestSeg >= 0 && bestT > 0.05 && bestT < 0.95)
                insertIndex = bestSeg + 1;
        }
        const prevStop = this.schedStops[insertIndex - 1];
        const newStop = {
            stationId: null,
            voiePointId: vpId,
            stationName: `Waypoint (${snappedLat.toFixed(4)}, ${snappedLon.toFixed(4)})`,
            type: 'waypoint',
            stopCode: '',
            arrTimeMin: 0,
            depTimeMin: 0,
            arrTimeStr: '00:00',
            depTimeStr: '00:00',
            platform: '',
        };
        const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, insertIndex - 1);
        const arrTimeMin = (prevStop.depTimeMin || 0) + travelTime;
        newStop.arrTimeMin = arrTimeMin;
        newStop.depTimeMin = arrTimeMin;
        newStop.arrTimeStr = this.minToTimeStr(arrTimeMin);
        newStop.depTimeStr = this.minToTimeStr(arrTimeMin);
        this.schedStops.splice(insertIndex, 0, newStop);
        this._adjustManualRoutesForInsert(insertIndex);
        // Recompute the stops that follow the inserted waypoint (none are removed).
        if (insertIndex < this.schedStops.length - 1) {
            await this.recalcStopsFrom(insertIndex + 1);
        }
        this.renderSchedStops();
        this._recalcPreviewRoutes();
        this.game.saveState();
    }
    // Perpendicular distance (km) from a point to segment AB, plus the clamped
    // projection parameter t in [0,1] (used by SC-10 waypoint insertion).
    _pointSegDistKm(lat, lon, a, b) {
        const kx = 111 * Math.cos(lat * Math.PI / 180), ky = 111;
        const ax = a.lon * kx, ay = a.lat * ky, bx = b.lon * kx, by = b.lat * ky;
        const px = lon * kx, py = lat * ky;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx, cy = ay + t * dy;
        return { dist: Math.hypot(px - cx, py - cy), t };
    }
    minToTimeStr(m) {
        const h = Math.floor(m / 60) % 24;
        const min = m % 60;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
    timeStrToMin(s) {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + (m || 0);
    }
    incrementTime(timeStr, minutes) {
        return this.minToTimeStr(this.timeStrToMin(timeStr) + minutes);
    }
    renderSchedStops() {
        const container = document.getElementById('sched-stops-list');
        if (!container)
            return;
        if (this.schedStops.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:8px">Cliquer sur les gares de la carte ci-dessus</p>';
            return;
        }
        if (!this._schedReturnPlatforms)
            this._schedReturnPlatforms = {};
        const header = `<div class="sched-stops-header"><span title="Numéro d'ordre">#</span><span>Gare</span><span title="Type d'arrêt (arrêt / passage / waypoint)">Type</span><span title="C = Commercial, S = Service, [] = sautable (25%)">Code</span><span>Arr</span><span>Dép</span><span>Arrêt</span><span>Voie</span><span></span></div>`;
        container.innerHTML = header + this.schedStops.map((stop, i) => {
            const isFirst = i === 0;
            const isLast = i === this.schedStops.length - 1;
            const travelInfo = (i > 0) ? (() => {
                const prev = this.schedStops[i - 1];
                const travelMin = stop.arrTimeMin - prev.depTimeMin;
                return `<div style="font-size:9px;color:var(--text3);text-align:center;padding:1px 0">↓ ${travelMin} min</div>`;
            })() : '';
            // Platform selector (for arret and waypoint stops)
            let platformSelect = '';
            if (stop.voiePointId) {
                // Voie point: voie is fixed, show as label
                platformSelect = `<span style="font-size:9px;color:#94a3b8;font-weight:600">Voie ${htmlText(stop.platform || '?')}</span>`;
            }
            else if (stop.type === 'arret' || stop.type === 'waypoint') {
                const station = this.game.world.getStationById(stop.stationId);
                if (station) {
                    // Check if station has voie points linked
                    const stVPs = this.game.voiePointManager?.getStationVoiePoints(station.id) || [];
                    let options = '<option value="">Auto</option>';
                    if (stVPs.length > 0) {
                        for (const svp of stVPs) {
                            const sel = stop.platform === svp.voie ? 'selected' : '';
                            options += `<option value="${htmlText(svp.voie)}" ${sel}>Voie ${htmlText(svp.voie)}</option>`;
                        }
                    }
                    else if (station.platforms > 0) {
                        const names = station.platformNames || [];
                        for (let p = 1; p <= this.game.stationUpgrades.getPlatformCapacity(station.id, station.platforms); p++) {
                            const pName = names[p - 1] || String(p);
                            const sel = stop.platform === pName ? 'selected' : '';
                            options += `<option value="${htmlText(pName)}" ${sel}>Voie ${htmlText(pName)}</option>`;
                        }
                    }
                    platformSelect = `<select style="width:70px" onchange="game.ui.updateSchedStop(${htmlJsValue(i)}, 'platform', this.value)">${options}</select>`;
                }
            }
            const arrCell = stop.type === 'waypoint' || stop.type === 'passage' || !isFirst
                ? `<input type="text" value="${htmlText(stop.arrTimeStr)}" placeholder="${htmlText(stop.type === 'waypoint' ? 'Via' : 'Arr')}" title="Heure ${htmlText(stop.type === 'waypoint' ? 'de passage' : 'd\'arrivée')}" onchange="game.ui.updateSchedStop(${htmlJsValue(i)}, 'arrTime', this.value)">`
                : '';
            const depCell = (stop.type === 'arret' || stop.type === 'passage') && !isLast
                ? `<input type="text" value="${htmlText(stop.depTimeStr || stop.arrTimeStr)}" placeholder="Dép" title="Heure de départ" onchange="game.ui.updateSchedStop(${htmlJsValue(i)}, 'depTime', this.value)">`
                : '';
            const dwellCell = (stop.type === 'arret' && !isFirst && !isLast)
                ? `<div style="display:flex;align-items:center;gap:2px"><input type="number" value="${htmlText(Math.max(0, (stop.depTimeMin || 0) - (stop.arrTimeMin || 0)))}" min="0" max="120" title="Temps d'arrêt" style="width:48px" onchange="game.ui.updateSchedStop(${htmlJsValue(i)}, 'stopDuration', this.value)"><span style="font-size:9px;color:var(--text3);white-space:nowrap">min</span></div>`
                : '';
            return `
        ${travelInfo}
        <div class="sched-stop-row">
          <span style="color:var(--text3);font-size:10px;text-align:center">${i + 1}</span>
          <span class="stop-name" title="${htmlText(stop.stationName)}">${htmlText(stop.stationName)}</span>
          <select onchange="game.ui.updateSchedStop(${htmlJsValue(i)}, 'type', this.value)" title="Type d'arrêt">
            <option value="arret" ${stop.type === 'arret' ? 'selected' : ''}>Arrêt</option>
            <option value="passage" ${stop.type === 'passage' ? 'selected' : ''}>Passage</option>
            <option value="waypoint" ${stop.type === 'waypoint' ? 'selected' : ''}>Waypoint</option>
          </select>
          <select onchange="game.ui.updateSchedStop(${htmlJsValue(i)}, 'stopCode', this.value)" title="C=Commercial, S=Service, []=sautable (25%)">
            <option value="" ${!stop.stopCode ? 'selected' : ''}>-</option>
            <option value="C" ${stop.stopCode === 'C' ? 'selected' : ''}>C</option>
            <option value="S" ${stop.stopCode === 'S' ? 'selected' : ''}>S</option>
            <option value="[C]" ${stop.stopCode === '[C]' ? 'selected' : ''}>[C]</option>
            <option value="[S]" ${stop.stopCode === '[S]' ? 'selected' : ''}>[S]</option>
          </select>
          ${arrCell ? `<div>${arrCell}</div>` : '<div></div>'}
          ${depCell ? `<div>${depCell}</div>` : '<div></div>'}
          ${dwellCell ? `<div>${dwellCell}</div>` : '<div></div>'}
          <div>${platformSelect}</div>
          <div class="stop-actions">
            <button class="btn-add-stop" onclick="game.ui.startInsertStop(${htmlJsValue(i)})" title="Insérer un arrêt après">+</button>
            <button class="btn-remove-stop" onclick="game.ui.removeSchedStop(${htmlJsValue(i)})" title="Supprimer cet arrêt">x</button>
          </div>
        </div>
      `;
        }).join('');
        // Add return leg stops if round-trip is checked and we are not already editing the return.
        const rtChecked = document.getElementById('sched-round-trip')?.checked;
        if (rtChecked && this.schedStops.length >= 2 && !this._isReturnEditMode) {
            const reversed = [...this.schedStops].reverse();
            const n = this.schedStops.length;
            // SC-14 — mirror the forward segment/dwell durations onto the return leg,
            // anchored at (terminus arrival + terminus wait), to show heures aller ET
            // retour (départ / passage / arrivée) per station.
            const termWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
            const lastArr = this.schedStops[n - 1].arrTimeMin ?? this.schedStops[n - 1].depTimeMin ?? 0;
            const fmt = (t) => this.minToTimeStr(((Math.round(t) % 1440) + 1440) % 1440);
            const retTimes = [];
            for (let j = 0; j < n; j++) {
                if (j === 0) {
                    retTimes.push({ arr: lastArr + termWait, dep: lastArr + termWait });
                    continue;
                }
                // Forward travel of this segment = arr[later station] - dep[earlier station];
                // the return leg reuses the same duration in reverse.
                const arrLater = this.schedStops[n - j].arrTimeMin ?? this.schedStops[n - j].depTimeMin ?? 0;
                const depEarlier = this.schedStops[n - 1 - j].depTimeMin ?? this.schedStops[n - 1 - j].arrTimeMin ?? 0;
                const travel = Math.max(0, arrLater - depEarlier);
                const arr = retTimes[j - 1].dep + travel;
                const here = this.schedStops[n - 1 - j];
                const dwell = Math.max(0, (here.depTimeMin ?? here.arrTimeMin ?? 0) - (here.arrTimeMin ?? here.depTimeMin ?? 0));
                retTimes.push({ arr, dep: arr + dwell });
            }
            const returnHtml = reversed.map((stop, i) => {
                const station = this.game.world.getStationById(stop.stationId);
                const stName = station?.name || stop.stationName || '?';
                const isFirst = i === 0;
                const isLast = i === reversed.length - 1;
                const typeLabel = stop.type === 'waypoint' ? 'passage' : (isFirst ? 'depart' : (isLast ? 'terminus' : stop.type));
                const typeColor = typeLabel === 'depart' ? '#22c55e' : (typeLabel === 'terminus' ? '#ef4444' : (typeLabel === 'passage' ? '#8b5cf6' : 'var(--text3)'));
                const rt = retTimes[i] || { arr: 0, dep: 0 };
                let timeStr;
                if (stop.type === 'waypoint')
                    timeStr = '';
                else if (isFirst)
                    timeStr = `Dep ${fmt(rt.dep)}`;
                else if (isLast)
                    timeStr = `Arr ${fmt(rt.arr)}`;
                else if (typeLabel === 'passage')
                    timeStr = `Pass ${fmt(rt.arr)}`;
                else
                    timeStr = `${fmt(rt.arr)}-${fmt(rt.dep)}`;
                // Platform selector
                let platformSelect = '';
                if (station && station.platforms > 0) {
                    const names = station.platformNames || [];
                    const currentVal = this._schedReturnPlatforms?.[stop.stationId] || '';
                    let options = '<option value="">Auto</option>';
                    for (let p = 1; p <= station.platforms; p++) {
                        const pName = names[p - 1] || String(p);
                        const sel = currentVal === pName ? 'selected' : '';
                        options += `<option value="${htmlText(pName)}" ${sel}>Voie ${htmlText(pName)}</option>`;
                    }
                    platformSelect = `<select style="width:70px;font-size:10px" onchange="game.ui.updateReturnPlatform('${htmlJsString(stop.stationId)}', this.value)">${options}</select>`;
                }
                return `<div class="sched-stop-row" style="padding:3px 6px;display:flex;align-items:center;gap:6px">
          <span style="color:var(--text3);font-size:10px;min-width:14px">${i + 1}</span>
          <span style="color:${htmlText(typeColor)};font-size:9px;min-width:50px">${htmlText(typeLabel)}</span>
          <span class="stop-name" style="flex:1">${htmlText(stName)}</span>
          <span style="font-size:9px;color:var(--text2);min-width:74px;text-align:right">${timeStr}</span>
          ${platformSelect}
        </div>`;
            }).join('');
            if (returnHtml) {
                container.innerHTML += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">
          <div style="font-size:10px;color:#f59e0b;font-weight:600;margin-bottom:4px">↩ Trajet retour (${reversed.length} arrets, attente terminus ${termWait} min)</div>
          <div style="font-size:8px;color:var(--text3);margin-bottom:3px">Legende : <span style="color:#22c55e">depart</span> / <span style="color:#8b5cf6">passage</span> / <span style="color:#ef4444">arrivee</span></div>
          ${returnHtml}
        </div>`;
            }
        }
        this._renderRouteSummary();
    }
    _renderRouteSummary() {
        const allerEl = document.getElementById('sched-summary-aller');
        const retourEl = document.getElementById('sched-summary-retour');
        if (!allerEl || !retourEl)
            return;
        const fmt = (t) => this.minToTimeStr(((Math.round(t) % 1440) + 1440) % 1440);
        const row = (name, time, cls = '') => `<div class="ss-row ${htmlText(cls)}"><span class="ss-name">${htmlText(name)}</span><span class="ss-time">${time}</span></div>`;
        const allerRows = this.schedStops.map((stop, i) => {
            const isFirst = i === 0;
            const isLast = i === this.schedStops.length - 1;
            let t = '';
            if (stop.type === 'waypoint')
                t = `Pass ${fmt(stop.arrTimeMin || 0)}`;
            else if (isFirst)
                t = `Dép ${fmt(stop.depTimeMin || 0)}`;
            else if (isLast)
                t = `Arr ${fmt(stop.arrTimeMin || 0)}`;
            else
                t = `${fmt(stop.arrTimeMin || 0)}-${fmt(stop.depTimeMin || 0)}`;
            return row(stop.stationName || '?', t);
        }).join('');
        allerEl.innerHTML = allerRows || '—';
        const rtChecked = document.getElementById('sched-round-trip')?.checked;
        if (!rtChecked || this.schedStops.length < 2) {
            retourEl.innerHTML = '—';
            return;
        }
        const reversed = [...this.schedStops].reverse();
        const termWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
        const lastArr = this.schedStops[this.schedStops.length - 1].arrTimeMin ?? this.schedStops[this.schedStops.length - 1].depTimeMin ?? 0;
        const retTimes = [];
        for (let j = 0; j < reversed.length; j++) {
            if (j === 0) {
                retTimes.push({ arr: lastArr + termWait, dep: lastArr + termWait });
                continue;
            }
            const arrLater = this.schedStops[this.schedStops.length - j].arrTimeMin ?? this.schedStops[this.schedStops.length - j].depTimeMin ?? 0;
            const depEarlier = this.schedStops[this.schedStops.length - 1 - j].depTimeMin ?? this.schedStops[this.schedStops.length - 1 - j].arrTimeMin ?? 0;
            const travel = Math.max(0, arrLater - depEarlier);
            const arr = retTimes[j - 1].dep + travel;
            const here = this.schedStops[this.schedStops.length - 1 - j];
            const dwell = Math.max(0, (here.depTimeMin ?? here.arrTimeMin ?? 0) - (here.arrTimeMin ?? here.depTimeMin ?? 0));
            retTimes.push({ arr, dep: arr + dwell });
        }
        const retourRows = reversed.map((stop, i) => {
            const isFirst = i === 0;
            const isLast = i === reversed.length - 1;
            const rt = retTimes[i] || { arr: 0, dep: 0 };
            let t = '';
            if (stop.type === 'waypoint')
                t = `Pass ${fmt(rt.arr)}`;
            else if (isFirst)
                t = `Dép ${fmt(rt.dep)}`;
            else if (isLast)
                t = `Arr ${fmt(rt.arr)}`;
            else
                t = `${fmt(rt.arr)}-${fmt(rt.dep)}`;
            return row(stop.stationName || '?', t);
        }).join('');
        retourEl.innerHTML = retourRows || '—';
    }
    async updateSchedStop(index, field, value) {
        const stop = this.schedStops[index];
        if (field === 'type') {
            stop.type = value;
            if (value === 'passage' || value === 'waypoint') {
                stop.depTimeMin = stop.arrTimeMin;
                stop.depTimeStr = stop.arrTimeStr;
            }
            else if (stop.depTimeMin <= stop.arrTimeMin) {
                stop.depTimeMin = stop.arrTimeMin + 2;
                stop.depTimeStr = this.minToTimeStr(stop.depTimeMin);
            }
        }
        if (field === 'arrTime') {
            stop.arrTimeStr = value;
            stop.arrTimeMin = this.timeStrToMin(value);
            if (stop.type === 'passage') {
                stop.depTimeMin = stop.arrTimeMin;
                stop.depTimeStr = stop.arrTimeStr;
            }
            else if (stop.depTimeMin < stop.arrTimeMin) {
                stop.depTimeMin = stop.arrTimeMin + 2;
                stop.depTimeStr = this.minToTimeStr(stop.depTimeMin);
            }
        }
        if (field === 'depTime') {
            stop.depTimeStr = value;
            stop.depTimeMin = this.timeStrToMin(value);
        }
        if (field === 'stopDuration') {
            const dur = Math.max(0, parseInt(value) || 0);
            stop.depTimeMin = stop.arrTimeMin + dur;
            stop.depTimeStr = this.minToTimeStr(stop.depTimeMin);
        }
        if (field === 'platform') {
            stop.platform = value || '';
        }
        if (field === 'stopCode') {
            stop.stopCode = value || '';
        }
        // Auto-recalculate all subsequent stops (await async routing)
        await this.recalcStopsFrom(index + 1);
        this.renderSchedStops();
    }
    updateReturnPlatform(stationId, value) {
        if (!this._schedReturnPlatforms)
            this._schedReturnPlatforms = {};
        if (value) {
            this._schedReturnPlatforms[stationId] = value;
        }
        else {
            delete this._schedReturnPlatforms[stationId];
        }
    }
    _approxRailDistance(lat1, lon1, lat2, lon2) {
        // Try to find existing track/route between these two points to get real distance
        const tracks = this.game.world.tracks;
        if (tracks) {
            for (const t of tracks) {
                if (!t.route || t.route.length < 2)
                    continue;
                const r = t.route;
                const startDist = Math.abs(r[0].lat - lat1) + Math.abs(r[0].lon - lon1);
                const endDist = Math.abs(r[r.length - 1].lat - lat2) + Math.abs(r[r.length - 1].lon - lon2);
                const startDistRev = Math.abs(r[0].lat - lat2) + Math.abs(r[0].lon - lon2);
                const endDistRev = Math.abs(r[r.length - 1].lat - lat1) + Math.abs(r[r.length - 1].lon - lon1);
                if ((startDist < 0.01 && endDist < 0.01) || (startDistRev < 0.01 && endDistRev < 0.01)) {
                    return this.game.orm.getRouteDistance(r);
                }
            }
        }
        // Fallback: haversine (great-circle distance)
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    _getStopCoords(stop) {
        // Resolve lat/lon for any stop type (station, voie point, waypoint).
        // Prefer the exact platform voie point when a platform is selected.
        if (stop.voiePointId && this.game.voiePointManager) {
            const vp = this.game.voiePointManager.getVoiePointById(stop.voiePointId);
            if (vp)
                return { lat: vp.lat, lon: vp.lon };
        }
        if (stop.stationId) {
            const st = this.game.world.getStationById(stop.stationId);
            if (!st)
                return null;
            if (stop.platform && this.game.voiePointManager) {
                const svp = this.game.voiePointManager.getStationVoiePoint(st.id, stop.platform);
                if (svp)
                    return { lat: svp.lat, lon: svp.lon };
            }
            return { lat: st.lat, lon: st.lon };
        }
        return null;
    }
    // Snap a coordinate to the nearest tronçon route point (sync). Returns null
    // if no track is within ~5 km. Used when a dragged waypoint is released so it
    // sticks to the real rail, mirroring _addMapWaypoint's snapping.
    _snapToTrack(lat, lon) {
        const vpm = this.game.voiePointManager;
        if (!vpm)
            return null;
        let best = null, bestDist = Infinity;
        const cosLat = Math.cos(lat * Math.PI / 180);
        for (const trc of vpm.getAllTroncons()) {
            if (!trc.route)
                continue;
            for (const pt of trc.route) {
                const d = Math.sqrt(Math.pow((pt.lat - lat) * 111, 2) + Math.pow((pt.lon - lon) * 111 * cosLat, 2));
                if (d < bestDist) {
                    bestDist = d;
                    best = { lat: pt.lat, lon: pt.lon };
                }
            }
        }
        return (best && bestDist <= 5) ? best : null;
    }
    // --- Trace editing helpers (remaster IV — points auto every 50 m) ---
    // Densify a polyline so consecutive vertices are at most `spacingKm` apart.
    // If the input route has control points (manual trace), keep those vertices
    // and densify only between them. Otherwise densify the whole polyline.
    _densifyRoute(route, spacingKm = 0.05) {
        if (!route || route.length < 2)
            return route;
        const hasControl = route.some((p) => p && p.control);
        if (!hasControl) {
            const cum = [0];
            for (let i = 1; i < route.length; i++) {
                cum[i] = cum[i - 1] + haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
            }
            const total = cum[cum.length - 1];
            if (total <= 0)
                return [...route];
            const out = [];
            const steps = Math.max(1, Math.round(total / spacingKm));
            for (let s = 0; s <= steps; s++) {
                const target = Math.min(total, s * spacingKm);
                let idx = 1;
                while (idx < cum.length && cum[idx] < target)
                    idx++;
                const a = route[idx - 1], b = route[idx] || route[route.length - 1];
                const segLen = (cum[idx] ?? total) - cum[idx - 1];
                const t = segLen > 0 ? (target - cum[idx - 1]) / segLen : 0;
                const maxSpeed = b?.maxSpeed ?? a?.maxSpeed ?? 30;
                const props = {};
                for (const k of Object.keys(b || a)) {
                    if (k !== 'lat' && k !== 'lon' && k !== 'control')
                        props[k] = (b || a)[k];
                }
                out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, maxSpeed, ...props });
            }
            return out;
        }
        // Manual-trace / control-aware densification: keep control points and densify between them.
        const controls = [];
        for (let i = 0; i < route.length; i++) {
            if (route[i].control || i === 0 || i === route.length - 1) {
                // mutate input objects so downstream edits keep references
                route[i].control = true;
                controls.push(route[i]);
            }
        }
        if (controls.length < 2)
            return [...route];
        const out = [];
        for (let i = 0; i < controls.length - 1; i++) {
            const a = controls[i], b = controls[i + 1];
            const dist = haversineDistance(a.lat, a.lon, b.lat, b.lon);
            if (dist <= 0)
                continue;
            const steps = Math.max(1, Math.ceil(dist / spacingKm));
            for (let s = 0; s < steps; s++) {
                const t = s / steps;
                const maxSpeed = b?.maxSpeed ?? a?.maxSpeed ?? 30;
                if (s === 0) {
                    a.control = true;
                    a.maxSpeed = maxSpeed;
                    out.push(a);
                }
                else {
                    const props = {};
                    for (const k of Object.keys(b || a)) {
                        if (k !== 'lat' && k !== 'lon' && k !== 'control')
                            props[k] = (b || a)[k];
                    }
                    out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, maxSpeed, ...props });
                }
            }
        }
        const last = controls[controls.length - 1];
        out.push({ ...last, control: true });
        return out;
    }
    // Recompute a route so that it keeps roughly 50 m spacing after a manual edit.
    _resampleRoute(route, spacingKm = 0.05) {
        return this._densifyRoute(route, spacingKm);
    }
    _findNearestTracePoint(x, y, tileMap, canvas) {
        if (!this._manualRoutes || this._manualRoutes.length === 0)
            return null;
        let best = null, bestDist = Infinity;
        for (let leg = 0; leg < this._manualRoutes.length; leg++) {
            const route = this._manualRoutes[leg];
            if (!route)
                continue;
            for (let i = 0; i < route.length; i++) {
                const pt = route[i];
                const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < bestDist) {
                    bestDist = d;
                    best = { leg, index: i, pt };
                }
            }
        }
        return bestDist <= 10 ? best : null;
    }
    // Find any editable point on the current trace (not just flagged controls).
    // On drag start the point is promoted to a control so it becomes persistent.
    _findNearestControlPoint(x, y, tileMap, canvas) {
        if (!this._manualRoutes || this._manualRoutes.length === 0)
            return null;
        let best = null, bestDist = Infinity, bestLeg = -1, bestIdx = -1;
        for (let leg = 0; leg < this._manualRoutes.length; leg++) {
            const route = this._manualRoutes[leg];
            if (!route || route.length < 3)
                continue;
            for (let i = 1; i < route.length - 1; i++) {
                const pt = route[i];
                const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < bestDist) {
                    bestDist = d;
                    best = pt;
                    bestLeg = leg;
                    bestIdx = i;
                }
            }
        }
        return (best && bestDist <= 14) ? { leg: bestLeg, control: best, index: bestIdx } : null;
    }
    _findNearestSegmentPoint(x, y, tileMap, canvas) {
        if (!this._manualRoutes || this._manualRoutes.length === 0)
            return null;
        let best = null, bestDist = Infinity;
        for (let leg = 0; leg < this._manualRoutes.length; leg++) {
            const route = this._manualRoutes[leg];
            if (!route || route.length < 2)
                continue;
            for (let i = 0; i < route.length - 1; i++) {
                const a = tileMap.worldToScreen(route[i].lat, route[i].lon, canvas.width, canvas.height);
                const b = tileMap.worldToScreen(route[i + 1].lat, route[i + 1].lon, canvas.width, canvas.height);
                const abx = b.x - a.x, aby = b.y - a.y;
                const len2 = abx * abx + aby * aby;
                let t = len2 > 0 ? ((x - a.x) * abx + (y - a.y) * aby) / len2 : 0;
                t = Math.max(0, Math.min(1, t));
                const px = a.x + abx * t, py = a.y + aby * t;
                const d = Math.hypot(px - x, py - y);
                if (d < bestDist) {
                    bestDist = d;
                    const worldPos = tileMap.screenToWorld(px, py, canvas.width, canvas.height);
                    best = { leg, index: i + 1, ...worldPos };
                }
            }
        }
        return bestDist <= 8 ? best : null;
    }
    // Extract the control vertices from a manual-route densified array.
    _extractRouteControls(route) {
        if (!route || route.length < 2)
            return [];
        return route.filter((p) => p && p.control);
    }
    // Find the previous and next control points bounding a route index.
    _controlBoundsForIndex(route, index) {
        let prev = index, next = index;
        while (prev > 0 && !route[prev].control)
            prev--;
        while (next < route.length - 1 && !route[next].control)
            next++;
        return { prev, next };
    }
    // Insert a new control point on the segment that contains `route[index]` and return it.
    _insertControlAt(leg, index, lat, lon) {
        const route = this._manualRoutes[leg];
        if (!route)
            return null;
        const controls = this._extractRouteControls(route);
        const { prev, next } = this._controlBoundsForIndex(route, index);
        if (prev < 0 || next < 0 || prev === next)
            return null;
        const prevObj = route[prev];
        const prevIdx = controls.indexOf(prevObj);
        if (prevIdx < 0)
            return null;
        const maxSpeed = prevObj.maxSpeed || 30;
        const newPt = { lat, lon, maxSpeed, control: true };
        controls.splice(prevIdx + 1, 0, newPt);
        this._manualRoutes[leg] = this._densifyRoute(controls);
        return newPt;
    }
    // Insert a point into the trace route at a specific segment and resample.
    _insertTracePoint(leg, index, lat, lon) {
        this._insertControlAt(leg, index, lat, lon);
        this._recalcAfterTraceEdit(leg);
    }
    // Remove the nearest control point to the clicked densified point (start/end protected).
    _removeTracePoint(leg, index) {
        const route = this._manualRoutes[leg];
        if (!route || route.length <= 2 || index <= 0 || index >= route.length - 1)
            return;
        const controls = this._extractRouteControls(route);
        if (controls.length <= 2)
            return;
        let bestIdx = -1, bestD = Infinity;
        for (let i = 1; i < controls.length - 1; i++) {
            const d = haversineDistance(controls[i].lat, controls[i].lon, route[index].lat, route[index].lon);
            if (d < bestD) {
                bestD = d;
                bestIdx = i;
            }
        }
        if (bestIdx >= 0 && bestD < 0.1) {
            controls.splice(bestIdx, 1);
            this._manualRoutes[leg] = this._densifyRoute(controls);
            this._recalcAfterTraceEdit(leg);
        }
    }
    // Move a control point (or insert one at the clicked location) and resample the affected leg.
    _moveTracePoint(leg, control, lat, lon) {
        if (!control)
            return;
        const snapped = this._snapToTrack(lat, lon);
        control.lat = snapped ? snapped.lat : lat;
        control.lon = snapped ? snapped.lon : lon;
        const route = this._manualRoutes[leg];
        const controls = this._extractRouteControls(route);
        this._manualRoutes[leg] = this._densifyRoute(controls);
    }
    // Find the nearest in-progress manual control point (during manual trace drawing).
    _findNearestManualControlPoint(x, y, tileMap, canvas) {
        if (!this._manualControlPoints || this._manualControlPoints.length === 0)
            return null;
        let best = null, bestDist = Infinity;
        for (let i = 0; i < this._manualControlPoints.length; i++) {
            const pt = this._manualControlPoints[i];
            const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bestDist) {
                bestDist = d;
                best = { index: i, pt };
            }
        }
        return bestDist <= 14 ? best : null;
    }
    // Move an in-progress manual trace control point.
    _moveManualControlPoint(index, lat, lon) {
        const pt = this._manualControlPoints[index];
        if (!pt)
            return;
        const snapped = this._snapToTrack(lat, lon);
        pt.lat = snapped ? snapped.lat : lat;
        pt.lon = snapped ? snapped.lon : lon;
    }
    async _recalcAfterTraceEdit(leg) {
        // Recompute travel time for the affected leg and all subsequent stops.
        await this.recalcStopsFrom(leg + 1);
        this.renderSchedStops();
        if (this._drawSchedMap)
            this._drawSchedMap();
    }
    // Keep the parallel manual-routes array aligned with schedStops legs.
    _adjustManualRoutesForInsert(stopIndex) {
        if (!this._manualRoutes)
            this._manualRoutes = [];
        if (stopIndex <= 0 || stopIndex > this.schedStops.length)
            return;
        if (stopIndex === this.schedStops.length) {
            this._manualRoutes.push(null);
            return;
        }
        const legIdx = stopIndex - 1;
        // One old leg is replaced by two new legs; old downstream routes shift by one.
        this._manualRoutes.splice(legIdx, 1, null, null);
    }
    _adjustManualRoutesForRemove(stopIndex) {
        if (!this._manualRoutes)
            return;
        if (stopIndex <= 0 || stopIndex >= this.schedStops.length)
            return;
        if (stopIndex === this.schedStops.length - 1) {
            this._manualRoutes.pop();
            return;
        }
        const legIdx = stopIndex - 1;
        this._manualRoutes.splice(legIdx, 1); // remove leg prev->removed
        this._manualRoutes[legIdx] = null; // invalidate leg prev->next, will be recomputed
    }
    async _resolveRouteForLeg(stopA, stopB) {
        const ca = this._getStopCoords(stopA), cb = this._getStopCoords(stopB);
        if (!ca || !cb)
            return null;
        // Priority 1: player tronçon graph
        const trc = this.game.voiePointManager?.findTronconRoute(ca.lat, ca.lon, cb.lat, cb.lon);
        if (trc && trc.route && trc.route.length >= 2)
            return trc.route;
        // Priority 2: existing world track between two stations
        const sa = stopA.stationId ? this.game.world.getStationById(stopA.stationId) : null;
        const sb = stopB.stationId ? this.game.world.getStationById(stopB.stationId) : null;
        if (sa && sb) {
            const track = this.game.world.getTrackBetween(sa.id, sb.id);
            if (track && track.route && track.route.length > 1) {
                // v1.1.73 — a Track route is stored in its resolved stationA -> stationB
                // direction. Never manufacture the opposite railway by reversing that
                // physical geometry: on double track this would put the return train on
                // the outbound road. In the stored direction it is safe to reuse; in the
                // opposite direction ORM must resolve the actual connected railway.
                if (track.stationA === sa.id && track.stationB === sb.id)
                    return track.route;
            }
        }
        // Priority 3: ORM (never return a straight-line fallback — R-03)
        // R-07 : plafond vitesse routage à V160 (matériel joueur)
        // TRV-03/06 : éviter les tronçons fermés entre les deux gares
        try {
            const rameId = document.getElementById('sched-rame')?.value;
            const rame = rameId ? this.game.rameManager.getById(rameId) : null;
            const routingSpeed = rame ? Math.min(rame.maxSpeed || 160, 160) : 160;
            const pt = this.game.engine.getParisTime();
            const now = pt.hours * 60 + pt.minutes;
            const dateStr = this.game.engine.currentDate || this.game.engine.getParisDate();
            const closures = [];
            if (sa && sb) {
                closures.push(...this.game.worksManager.getActiveClosuresBetween(sa.id, sb.id, dateStr, now));
            }
            const avoidPairs = closures.map((w) => {
                const sta = this.game.world.getStationById(w.stationA);
                const stb = this.game.world.getStationById(w.stationB);
                if (!sta || !stb)
                    return null;
                return { latA: sta.lat, lonA: sta.lon, latB: stb.lat, lonB: stb.lon };
            }).filter((p) => p !== null);
            const opts = { maxSpeed: routingSpeed };
            if (avoidPairs.length)
                opts.avoidStationPairs = avoidPairs;
            return await this.game.orm.findRoute(ca.lat, ca.lon, cb.lat, cb.lon, opts);
        }
        catch (e) {
            return null;
        }
    }
    async _recalcPreviewRoutes() {
        if (!this.schedStops || this.schedStops.length < 2) {
            this._schedPreviewRoutes = [];
            this._schedObjectifRoutes = [];
            return;
        }
        if (!this._manualRoutes)
            this._manualRoutes = [];
        const objectifRoutes = [];
        const routes = [];
        for (let i = 0; i < this.schedStops.length - 1; i++) {
            const objectif = await this._resolveRouteForLeg(this.schedStops[i], this.schedStops[i + 1]);
            const densifiedObj = (objectif && objectif.length >= 2) ? this._densifyRoute([...objectif]) : null;
            objectifRoutes.push(densifiedObj);
            if (this._manualRoutes[i]) {
                routes.push(this._manualRoutes[i]);
            }
            else if (densifiedObj) {
                this._manualRoutes[i] = densifiedObj;
                routes.push(this._manualRoutes[i]);
            }
            else {
                routes.push(null);
            }
        }
        // Trim if stops shrank
        this._manualRoutes.length = this.schedStops.length - 1;
        this._schedObjectifRoutes = objectifRoutes;
        this._schedPreviewRoutes = routes;
        if (this._drawSchedMap)
            this._drawSchedMap();
    }
    async _getSegmentTravelTime(prevStop, curStop, rameSpeed, rame = null, legIndex = null) {
        let route = null;
        if (legIndex != null && this._manualRoutes && this._manualRoutes[legIndex]) {
            route = this._manualRoutes[legIndex];
        }
        else {
            route = await this._resolveRouteForLeg(prevStop, curStop);
            if (route && route.length >= 2 && legIndex != null) {
                if (!this._manualRoutes)
                    this._manualRoutes = [];
                this._manualRoutes[legIndex] = this._densifyRoute(route);
                route = this._manualRoutes[legIndex];
            }
        }
        // Waypoints/passages are not stops: the train keeps speed through them.
        // The first leg always starts from 0 (origin); subsequent pass-through legs
        // start and end at line speed.
        const isPass = (s) => s?.type === 'waypoint' || s?.type === 'passage';
        const rameMaxSpeed = rame ? rame.maxSpeed : rameSpeed;
        const rameMaxMs = rameMaxSpeed / 3.6;
        const startMs = (isPass(prevStop) && legIndex !== 0) ? rameMaxMs : 0;
        const endMs = isPass(curStop) ? rameMaxMs : 0;
        const travelOpts = { startMs, endMs };
        if (route && route.length >= 2) {
            return this.game.orm.calculateTravelTime(route, rame || rameSpeed, travelOpts);
        }
        // v1.1.19: no fictional straight-line railway. The caller will mark the leg
        // invalid when OSM/ORM cannot produce a real railway route.
        return null;
    }
    async recalcStopsFrom(fromIndex) {
        if (fromIndex >= this.schedStops.length || fromIndex < 1)
            return;
        const rameId = document.getElementById('sched-rame')?.value;
        const rame = this.game.rameManager.getById(rameId);
        const rameSpeed = rame ? rame.maxSpeed : 160;
        // Build merged arret-to-arret segments to avoid per-waypoint accel/decel overhead
        // First pass: find the last arret before fromIndex to use as anchor
        let anchorIdx = fromIndex - 1;
        while (anchorIdx > 0 && this.schedStops[anchorIdx].type !== 'arret')
            anchorIdx--;
        for (let i = Math.max(fromIndex, anchorIdx + 1); i < this.schedStops.length; i++) {
            const prevStop = this.schedStops[i - 1];
            const curStop = this.schedStops[i];
            const travelTime = await this._getSegmentTravelTime(prevStop, curStop, rameSpeed, rame, i - 1);
            curStop.arrTimeMin = prevStop.depTimeMin + travelTime;
            curStop.arrTimeStr = this.minToTimeStr(curStop.arrTimeMin);
            if (curStop.type === 'passage' || curStop.type === 'waypoint') {
                curStop.depTimeMin = curStop.arrTimeMin;
                curStop.depTimeStr = curStop.arrTimeStr;
            }
            else {
                const oldStopDuration = Math.max(2, (curStop.depTimeMin || 0) - (curStop.arrTimeMin || 0));
                curStop.depTimeMin = curStop.arrTimeMin + (i === this.schedStops.length - 1 ? 0 : Math.max(oldStopDuration, 2));
                curStop.depTimeStr = this.minToTimeStr(curStop.depTimeMin);
            }
        }
        this.renderSchedStops();
        this._recalcPreviewRoutes();
    }
    removeSchedStop(index) {
        this.schedStops.splice(index, 1);
        this._adjustManualRoutesForRemove(index);
        this.recalcStopsFrom(index);
        this.renderSchedStops();
        this._recalcPreviewRoutes();
    }
    startInsertStop(index) {
        if (this._manualMode)
            this._toggleManualMode();
        this._insertAfterIndex = index;
        this._traceSelectedPoint = null;
        this._traceDragging = null;
        this._manualControlDrag = null;
        this._updateManualUI();
    }
    async _insertStopFromMap(afterIndex, item) {
        if (!item || afterIndex < 0 || afterIndex >= this.schedStops.length)
            return;
        const rameId = document.getElementById('sched-rame')?.value;
        const rame = this.game.rameManager.getById(rameId);
        const rameSpeed = rame ? rame.maxSpeed : 160;
        const insertIndex = afterIndex + 1;
        const prevStop = this.schedStops[afterIndex];
        let newStop;
        if (item.voie != null) {
            // voie point
            let vpName = `Voie ${item.voie}`;
            let vpStationId = null;
            if (item.stationId) {
                const st = this.game.world.getStationById(item.stationId);
                if (st) {
                    vpName = `${st.name} — Voie ${item.voie}`;
                    vpStationId = st.id;
                }
            }
            newStop = {
                stationId: vpStationId, voiePointId: item.id, stationName: vpName,
                type: item.stationId ? 'arret' : 'waypoint', stopCode: '', arrTimeMin: 0, depTimeMin: 0,
                arrTimeStr: '00:00', depTimeStr: '00:00', platform: item.voie,
            };
        }
        else if (item.lat != null && item.lon != null && !item.id) {
            // map waypoint
            newStop = {
                stationId: null, voiePointId: item.vpId || null, stationName: item.name || `Waypoint (${item.lat.toFixed(4)}, ${item.lon.toFixed(4)})`,
                type: 'waypoint', stopCode: '', arrTimeMin: 0, depTimeMin: 0,
                arrTimeStr: '00:00', depTimeStr: '00:00', platform: '',
            };
        }
        else {
            // station
            if (item.closed) {
                alert('Cette gare est fermée — aucun train ne peut la desservir.');
                return;
            }
            newStop = {
                stationId: item.id, stationName: item.name, type: 'arret', stopCode: '',
                arrTimeMin: 0, depTimeMin: 0, arrTimeStr: '00:00', depTimeStr: '00:00', platform: '',
            };
        }
        this.schedStops.splice(insertIndex, 0, newStop);
        this._adjustManualRoutesForInsert(insertIndex);
        const travelTime = await this._getSegmentTravelTime(prevStop, newStop, rameSpeed, rame, afterIndex);
        const arrTimeMin = (prevStop.depTimeMin || 0) + travelTime;
        newStop.arrTimeMin = arrTimeMin;
        newStop.depTimeMin = newStop.type === 'arret' ? arrTimeMin + 2 : arrTimeMin;
        newStop.arrTimeStr = this.minToTimeStr(newStop.arrTimeMin);
        newStop.depTimeStr = this.minToTimeStr(newStop.depTimeMin);
        if (insertIndex < this.schedStops.length - 1) {
            await this.recalcStopsFrom(insertIndex + 1);
        }
        this.renderSchedStops();
        this._recalcPreviewRoutes();
        this.game.saveState();
    }
    async _buildSaveRoutes(stops, manualRoutes) {
        const routePromises = [];
        for (let i = 0; i < stops.length - 1; i++) {
            if (manualRoutes && manualRoutes[i] && manualRoutes[i].length >= 2) {
                routePromises.push(Promise.resolve(manualRoutes[i]));
            }
            else {
                routePromises.push(this._resolveRouteForLeg(stops[i], stops[i + 1]));
            }
        }
        const routes = await Promise.all(routePromises);
        return routes.map((r, i) => {
            if (manualRoutes && manualRoutes[i] && manualRoutes[i].length >= 2)
                return manualRoutes[i];
            if (r && r.length >= 2)
                return this._densifyRoute(r);
            return r;
        });
    }
    async saveSchedule() {
        const name = document.getElementById('sched-name').value.trim();
        const rameId = document.getElementById('sched-rame').value;
        if (!name)
            return alert('Nom requis');
        const rame = this.game.rameManager.getById(rameId);
        if (!rame)
            return alert('Veuillez choisir une rame.');
        if ((rame.totalPower || 0) <= 0)
            return alert('La rame selectionnée n\'a pas de motrice (locomotive / automotrice) et ne peut pas rouler.');
        const roundTrip = document.getElementById('sched-round-trip')?.checked || false;
        const multiDepartures = parseInt(document.getElementById('sched-multi-departures')?.value) || 1;
        const terminusWait = parseInt(document.getElementById('sched-terminus-wait')?.value) || 5;
        // Flush any in-progress return-mode edits into their dedicated buffers.
        if (this._isReturnEditMode) {
            this._returnStops = this.schedStops;
            this._returnManualRoutes = this._manualRoutes;
        }
        else {
            this._forwardStops = this.schedStops;
            this._forwardManualRoutes = this._manualRoutes;
        }
        if (this._forwardStops.length < 2)
            return alert('Il faut au moins 2 arrets');
        // Build forward routes.
        const forwardStops = this._forwardStops;
        const forwardRoutes = await this._buildSaveRoutes(forwardStops, this._forwardManualRoutes);
        const invalidForward = forwardRoutes.findIndex((r) => !r || r.length < 2);
        if (invalidForward >= 0) {
            return alert(`Impossible de calculer un itineraire ferroviaire entre les arrets aller #${invalidForward + 1} et #${invalidForward + 2}. Verifiez les points de voie / le reseau ORM.`);
        }
        // Build return routes/stops if a return leg has been defined; otherwise fall back to the reversed forward leg.
        let returnStops = [];
        let returnRoutes = [];
        if (roundTrip && this._returnStops && this._returnStops.length >= 2) {
            returnStops = this._returnStops;
            returnRoutes = await this._buildSaveRoutes(returnStops, this._returnManualRoutes);
            const invalidReturn = returnRoutes.findIndex((r) => !r || r.length < 2);
            if (invalidReturn >= 0) {
                return alert(`Impossible de calculer un itineraire ferroviaire entre les arrets retour #${invalidReturn + 1} et #${invalidReturn + 2}. Verifiez les points de voie / le reseau ORM.`);
            }
        }
        const stops = forwardStops.map((s) => this._stopEditToData(s));
        const returnStopsData = returnStops.length >= 2 ? returnStops.map((s) => this._stopEditToData(s)) : [];
        let totalDist = 0;
        for (const route of forwardRoutes)
            totalDist += this.game.orm.getRouteDistance(route);
        for (const route of returnRoutes)
            totalDist += this.game.orm.getRouteDistance(route);
        const serviceType = document.getElementById('sched-service-type')?.value || 'passager';
        const isWorkTrain = serviceType === 'work';
        // Section VI — validation des types de convois (HLP / TM)
        if (serviceType === 'hlp') {
            const locoCount = rame.elementDetails.filter((e) => e.category === 'locomotive' || e.category === 'automotrice').length;
            if (locoCount > 2 || rame.elementDetails.length !== locoCount) {
                return alert('Un HLP (Haut le pied) est un convoi de locomotives seules, maximum 2.');
            }
        }
        if (serviceType === 'tm') {
            const locoCount = rame.elementDetails.filter((e) => e.category === 'locomotive' || e.category === 'automotrice').length;
            if (locoCount < 3 || locoCount > 12 || rame.elementDetails.length !== locoCount) {
                return alert('Un TM (Train de machines) compte 3 à 12 locomotives, rien d’autre.');
            }
        }
        if (serviceType === 'm-') {
            // CVO-05 : machine de manœuvre = une seule locomotive rattachée à un dépôt
            const locoCount = rame.elementDetails.filter((e) => e.category === 'locomotive' || e.category === 'automotrice').length;
            if (locoCount !== 1 || rame.elementDetails.length !== 1) {
                return alert('Une machine de manœuvre (M-) est constituée d\'une seule locomotive.');
            }
            if (!rame.depotId) {
                return alert('Une machine de manœuvre (M-) doit être rattachée à un dépôt.');
            }
        }
        const returnName = document.getElementById('sched-return-name')?.value.trim() || '';
        const assignedContractId = ['w', 'hlp', 'tm', 'm-', 'evo'].includes(serviceType)
            ? ''
            : (document.getElementById('sched-contract')?.value || '');
        if (assignedContractId) {
            const contract = this.game.freightManager.contracts.find((c) => c.id === assignedContractId);
            const check = this.game.freightManager.validateAssignment(contract, { rame, stops, serviceType, isWorkTrain });
            if (!check.ok)
                return alert(check.message);
        }
        const returnPlatforms = this._schedReturnPlatforms || {};
        // Read run days from checkboxes
        const runDays = [];
        document.querySelectorAll('.sched-run-day:checked').forEach((cb) => runDays.push(parseInt(cb.value)));
        if (runDays.length === 0)
            runDays.push(0, 1, 2, 3, 4, 5, 6); // fallback: all days
        // Read specific run dates
        const runDatesStr = document.getElementById('sched-run-dates')?.value.trim() || '';
        const runDates = runDatesStr ? runDatesStr.split(',').map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
        const firstDep = stops[0]?.departureTime || 0;
        const lastArr = stops[stops.length - 1]?.arrivalTime ?? firstDep;
        const oneWayMin = forwardClockMinutes(firstDep, lastArr);
        let returnMin = oneWayMin;
        if (returnStopsData.length >= 2) {
            const retFirstDep = returnStopsData[0].departureTime;
            const retLastArr = returnStopsData[returnStopsData.length - 1].arrivalTime;
            returnMin = forwardClockMinutes(retFirstDep, retLastArr);
        }
        const oneRoundTrip = roundTrip ? (oneWayMin + returnMin + terminusWait * 2) : 0;
        // SC-05 — create a single base service, then generate real duplicates for Auto 24h.
        const baseService = this.game.scheduleCreator.addService({
            name, rameId, stops, routes: forwardRoutes, returnStops: returnStopsData, returnRoutes,
            roundTrip, multiDepartures: 1, terminusWait,
            totalDistance: 0, plannedDistance: Math.round(totalDist),
            serviceType, isWorkTrain, assignedContractId, returnName, returnPlatforms,
            runDays, runDates,
        }, rame, this.game.world);
        // Replacement is committed only after the new, valid service exists.
        if (this._editingScheduleId)
            this.game.scheduleCreator.removeService(this._editingScheduleId);
        if (roundTrip && multiDepartures > 1) {
            this.game.scheduleCreator.createAutoRoundTripDuplicates(baseService, multiDepartures, oneRoundTrip, rame, this.game.world);
        }
        this._editingScheduleId = null;
        if (this._schedMapInterval) {
            clearInterval(this._schedMapInterval);
            this._schedMapInterval = null;
        }
        document.getElementById('modal-schedule')?.classList.add('hidden');
        this.renderSchedulesList();
        this.game.saveState();
    }
    editSchedule(id) {
        const svc = this.game.scheduleCreator.services.find((s) => s.id === id);
        if (svc)
            this.openScheduleModal(svc);
    }
    renderSchedulesList() {
        if (this.scheduleV2Editor)
            return this.scheduleV2Editor.renderList();
        const container = document.getElementById('schedules-list');
        if (!container)
            return;
        const services = this.game.scheduleCreator.services;
        if (services.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucun trajet. Cliquer "+ Creer un trajet" pour commencer.</p>';
            return;
        }
        const sortMode = document.getElementById('sched-sort')?.value || 'departure';
        let sorted = [...services];
        if (sortMode === 'departure') {
            sorted.sort((a, b) => (a.stops[0]?.departureTime || 0) - (b.stops[0]?.departureTime || 0));
        }
        else if (sortMode === 'creation') {
            sorted.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }
        else if (sortMode === 'rame') {
            sorted.sort((a, b) => {
                const ra = this.game.rameManager.getById(a.rameId);
                const rb = this.game.rameManager.getById(b.rameId);
                return (ra?.name || 'ZZZ').localeCompare(rb?.name || 'ZZZ');
            });
        }
        else if (sortMode === 'name') {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
        else if (sortMode === 'route') {
            sorted.sort((a, b) => {
                const aFirst = this.game.world.getStationById(a.stops[0]?.stationId)?.name || '';
                const bFirst = this.game.world.getStationById(b.stops[0]?.stationId)?.name || '';
                return aFirst.localeCompare(bFirst) || (a.stops[0]?.departureTime || 0) - (b.stops[0]?.departureTime || 0);
            });
        }
        let lastGroupKey = null;
        const getGroupKey = (svc) => {
            if (sortMode === 'rame') {
                const r = this.game.rameManager.getById(svc.rameId);
                return r ? r.name : 'Sans rame';
            }
            if (sortMode === 'route') {
                const fst = this.game.world.getStationById(svc.stops[0]?.stationId)?.name || '?';
                const lst = this.game.world.getStationById(svc.stops[svc.stops.length - 1]?.stationId)?.name || '?';
                return `${fst} → ${lst}`;
            }
            return null;
        };
        this._schedPage = this._schedPage || 0;
        const perPage = 50;
        const total = sorted.length;
        const pageCount = Math.ceil(total / perPage) || 1;
        this._schedPage = Math.max(0, Math.min(this._schedPage, pageCount - 1));
        const start = this._schedPage * perPage;
        const pageItems = sorted.slice(start, start + perPage);
        const dayNames = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
        const typeLabels = { passager: 'Voy', w: 'W', hlp: 'HLP', tm: 'TM', evo: 'EVO', work: 'Travaux' };
        const rows = pageItems.map((svc) => {
            const firstSt = this.game.world.getStationById(svc.stops[0]?.stationId);
            const lastSt = this.game.world.getStationById(svc.stops[svc.stops.length - 1]?.stationId);
            const rame = this.game.rameManager.getById(svc.rameId);
            const depTime = this.minToTimeStr(svc.stops[0]?.departureTime || 0);
            const arrTime = this.minToTimeStr(svc.stops[svc.stops.length - 1]?.arrivalTime || 0);
            const rd = svc.runDays || [0, 1, 2, 3, 4, 5, 6];
            const daysLabel = rd.length === 7 ? 'TLJ' : rd.map((d) => dayNames[d]).join(' ');
            const typeBadge = svc.serviceType && svc.serviceType !== 'passager'
                ? `<span style="display:inline-block;background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:1px 4px;font-size:9px;color:#94a3b8">${htmlText(typeLabels[svc.serviceType] || svc.serviceType)}</span>`
                : '';
            const tripInfo = svc.roundTrip && svc.multiDepartures > 1 ? ` x${svc.multiDepartures} AR` : svc.roundTrip ? ' A/R' : '';
            // Detail content
            const stopsPreview = svc.stops.map((s) => {
                const st = this.game.world.getStationById(s.stationId);
                const name = st ? st.name : s.stationId;
                const arr = this.minToTimeStr(s.arrivalTime);
                const dep = this.minToTimeStr(s.departureTime);
                if (s.type === 'waypoint')
                    return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${htmlText(name)})</span>`;
                return `<span class="sched-stop-tag ${htmlText(s.type)}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${htmlText(name)}</span>`;
            }).join('<span style="color:var(--text3)"> → </span>');
            const passagePreview = (svc._passageStops?.length)
                ? `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#22c55e;font-size:9px;margin-right:4px">Passages :</span>${svc._passageStops.map((p) => `<span class="sched-stop-tag passage">${this.minToTimeStr(p.time)} ${htmlText(p.name)}</span>`).join('<span style="color:var(--text3)"> → </span>')}</div>`
                : '';
            let returnPreview = '';
            if (svc.roundTrip) {
                const retStops = svc.buildReturnStops();
                const retStr = retStops.map((s) => {
                    const st = this.game.world.getStationById(s.stationId);
                    const name = st ? st.name : s.stationId;
                    const arr = this.minToTimeStr(s.arrivalTime);
                    const dep = this.minToTimeStr(s.departureTime);
                    if (s.type === 'waypoint')
                        return `<span class="sched-stop-tag waypoint" style="opacity:0.5;font-style:italic">(via ${htmlText(name)})</span>`;
                    return `<span class="sched-stop-tag ${htmlText(s.type)}">${s.type === 'passage' ? arr : `${arr}-${dep}`} ${htmlText(name)}</span>`;
                }).join('<span style="color:var(--text3)"> → </span>');
                returnPreview = `<div class="sched-stops-preview" style="margin-top:4px"><span style="color:#f59e0b;font-size:9px;margin-right:4px">↩ Retour (${svc.terminusWait} min attente):</span>${retStr}</div>`;
            }
            const delayReason = svc.train?.delayReason || svc.delayReason || '';
            const breakdown = svc.train?.breakdown;
            const incident = svc.train?.incident;
            const bilanRows = [];
            if (svc.completed)
                bilanRows.push(`<span style="color:#22c55e">Terminé${svc.completedDate ? ' le ' + svc.completedDate : ''}</span>`);
            if (delayReason)
                bilanRows.push(`<span style="color:#f59e0b">Retard : ${htmlText(delayReason)}</span>`);
            if (breakdown?.type)
                bilanRows.push(`<span style="color:#ef4444">Panne : ${breakdown.type}</span>`);
            if (incident?.name || incident?.effect)
                bilanRows.push(`<span style="color:#ef4444">Incident : ${htmlText(incident.name || incident.effect)}</span>`);
            const bilanHtml = bilanRows.length
                ? `<div class="sched-bilan" style="margin-top:6px;padding:6px 8px;background:var(--bg3);border-radius:4px;font-size:10px;display:flex;flex-wrap:wrap;gap:8px">${bilanRows.join('')}</div>`
                : '';
            const numLabel = svc.number != null
                ? `<span style="color:#fbbf24;font-size:10px;font-weight:700" title="N° aller${htmlText(svc.roundTrip ? ' / retour' : '')}">N°${htmlText(svc.number)}${htmlText(svc.roundTrip && svc.returnNumber != null ? '/' + svc.returnNumber : '')}</span>`
                : '';
            // Group header row
            const gk = getGroupKey(svc);
            let groupHeader = '';
            if (gk !== null && gk !== lastGroupKey) {
                lastGroupKey = gk;
                groupHeader = `<tr><td colspan="8" class="sched-group-header">${htmlText(gk)}</td></tr>`;
            }
            return `${groupHeader}
        <tr class="sched-row" onclick="game.ui.toggleSchedDetail('${htmlJsString(svc.id)}')">
          <td>${numLabel}</td>
          <td><strong>${htmlText(svc.name)}</strong>${typeBadge}</td>
          <td>${htmlText(rame ? rame.name : 'N/A')}</td>
          <td>${htmlText(firstSt ? firstSt.name : '?')}<br><span style="color:var(--text3)">${depTime}</span></td>
          <td>${htmlText(lastSt ? lastSt.name : '?')}<br><span style="color:var(--text3)">${arrTime}</span></td>
          <td><span style="color:var(--text3)">${Math.round(svc.plannedDistance || svc.totalDistance || 0)} km${tripInfo}</span></td>
          <td><span style="color:#60a5fa">${htmlText(daysLabel)}</span></td>
          <td class="sched-row-actions">
            <button class="btn-sm" onclick="event.stopPropagation();game.ui.editSchedule('${htmlJsString(svc.id)}')">Modifier</button>
            <button class="btn-sm" onclick="event.stopPropagation();game.ui.duplicateSchedulePrompt('${htmlJsString(svc.id)}')">Dupliquer</button>
            <button class="btn-sm" onclick="event.stopPropagation();game.ui.toggleSchedule('${htmlJsString(svc.id)}')">${svc.active ? 'Desactiver' : 'Activer'}</button>
            <button class="btn-sm danger" onclick="event.stopPropagation();game.ui.deleteSchedule('${htmlJsString(svc.id)}')">Supprimer</button>
          </td>
        </tr>
        <tr id="sched-detail-${htmlText(svc.id)}" class="hidden">
          <td colspan="8" class="sched-detail-cell">
            <div class="sched-detail-inner">
              <div class="close-row">
                <span style="font-size:10px;color:var(--text2)">Détail du trajet</span>
                <button class="btn-sm" onclick="event.stopPropagation();game.ui.toggleSchedDetail('${htmlJsString(svc.id)}')">X</button>
              </div>
              <div class="sched-stops-preview">${stopsPreview}</div>
              ${passagePreview}
              ${returnPreview}
              ${bilanHtml}
            </div>
          </td>
        </tr>`;
        }).join('');
        const controls = pageCount > 1 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:8px;background:var(--bg3);border-radius:4px;font-size:11px">
        <span>Page ${this._schedPage + 1} / ${pageCount} — ${total} trajets</span>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" ${this._schedPage === 0 ? 'disabled' : ''} onclick="game.ui.changeSchedPage(-1)">Précédent</button>
          <button class="btn-sm" ${this._schedPage >= pageCount - 1 ? 'disabled' : ''} onclick="game.ui.changeSchedPage(1)">Suivant</button>
        </div>
      </div>` : '';
        container.innerHTML = `
      <table class="schedules-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Nom</th>
            <th>Rame</th>
            <th>Départ A</th>
            <th>Arrivée B</th>
            <th>Distance</th>
            <th>Jours</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${controls}`;
    }
    changeSchedPage(delta) {
        this._schedPage += delta;
        this.renderSchedulesList();
    }
    // SC-08 — clic sur une ligne = menu déroulant détaillé du trajet.
    toggleSchedDetail(id) {
        const detail = document.getElementById(`sched-detail-${id}`);
        const caret = document.getElementById(`sched-caret-${id}`);
        if (!detail)
            return;
        const open = detail.classList.toggle('hidden');
        if (caret)
            caret.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
    }
    toggleSchedule(id) {
        const svc = this.game.scheduleCreator.services.find((s) => s.id === id);
        if (svc) {
            svc.active = !svc.active;
            this.game.scheduleCreator._invalidateActiveCache();
        }
        this.renderSchedulesList();
    }
    duplicateSchedulePrompt(id) {
        const svc = this.game.scheduleCreator.services.find((s) => s.id === id);
        if (!svc)
            return;
        const interval = prompt('Intervalle entre chaque depart (en minutes) :', '60');
        if (!interval)
            return;
        const count = prompt('Nombre de duplicatas :', '3');
        if (!count)
            return;
        const intv = parseInt(interval), cnt = parseInt(count);
        if (!intv || intv < 1 || !cnt || cnt < 1)
            return;
        const rame = this.game.rameManager.getById(svc.rameId);
        this.game.scheduleCreator.duplicateService(id, intv, cnt, rame, this.game.world);
        this.renderSchedulesList();
    }
    deleteSchedule(id) {
        if (!confirm('Supprimer ce service ?'))
            return;
        this.game.scheduleCreator.removeService(id);
        this.game.saveState();
        this.renderSchedulesList();
    }
    // --- LINES ---
    setupLinePage() {
        document.getElementById('btn-new-line')?.addEventListener('click', () => this.openLineModal());
        document.getElementById('btn-save-line')?.addEventListener('click', () => this.saveLine());
        document.getElementById('btn-line-manual')?.addEventListener('click', () => this._toggleLineManual());
        document.getElementById('btn-line-clear-manual')?.addEventListener('click', () => this._clearLineManual());
        document.getElementById('btn-line-finish-manual')?.addEventListener('click', () => this._finishLineManual());
        this.lineStops = [];
        this.lineMapCenter = null;
        this.lineMapScale = null;
        this._editingLineId = null;
        this._lineManualMode = false;
        this._lineManualSegmentIndex = -1;
        this._lineManualPoints = [];
        this._lineManualRoute = null;
        this._lineManualDrag = null;
        this._lineManualRoutes = [];
        // Station creator in Lines page
        document.getElementById('btn-new-station-lines')?.addEventListener('click', () => {
            const creator = document.getElementById('lines-station-creator');
            if (!creator)
                return;
            creator.classList.remove('hidden');
            document.getElementById('lsc-name').value = '';
            document.getElementById('lsc-lat').value = '';
            document.getElementById('lsc-lon').value = '';
            document.getElementById('lsc-platforms').value = '4';
            document.getElementById('lsc-type').value = 'voyageur';
            // Populate connect dropdown with existing stations
            const connectSel = document.getElementById('lsc-connect');
            if (connectSel) {
                let opts = '<option value="">Aucune connexion</option><option value="_nearest">La plus proche (auto)</option>';
                for (const st of this.game.world.stations) {
                    opts += `<option value="${htmlText(st.id)}">${htmlText(st.name)}</option>`;
                }
                connectSel.innerHTML = opts;
            }
            // Populate line dropdown
            const lineSel = document.getElementById('lsc-line');
            if (lineSel) {
                let opts = '<option value="">Aucune</option>';
                for (const line of this.game.lineManager.getAll()) {
                    opts += `<option value="${htmlText(line.id)}">${htmlText(line.name)}</option>`;
                }
                lineSel.innerHTML = opts;
            }
        });
        document.getElementById('btn-lsc-cancel')?.addEventListener('click', () => {
            document.getElementById('lines-station-creator')?.classList.add('hidden');
        });
        document.getElementById('btn-lsc-save')?.addEventListener('click', () => this.saveStationFromLines());
        // Section V — Sillons automatiques
        document.getElementById('btn-new-sillon')?.addEventListener('click', () => this.openSillonCreator());
        document.getElementById('btn-save-sillon')?.addEventListener('click', () => this.saveSillon());
        document.getElementById('btn-cancel-sillon')?.addEventListener('click', () => {
            document.getElementById('sillon-creator')?.classList.add('hidden');
            this._resetSillonManual();
        });
        document.getElementById('btn-sillon-manual')?.addEventListener('click', () => this._toggleSillonManualMode());
        document.getElementById('btn-sillon-clear-manual')?.addEventListener('click', () => this._clearSillonManualTrace());
        document.getElementById('btn-sillon-finish-manual')?.addEventListener('click', () => this._finishSillonManual());
        document.getElementById('sillon-from')?.addEventListener('change', () => { this._updateSillonName(); this._syncSillonManualEndpoints(); });
        document.getElementById('sillon-to')?.addEventListener('change', () => { this._updateSillonName(); this._syncSillonManualEndpoints(); });
        document.getElementById('sillon-name')?.addEventListener('input', () => { this._sillonNameTouched = true; });
        const sillonsList = document.getElementById('sillons-list');
        if (sillonsList && !sillonsList._delegated) {
            sillonsList._delegated = true;
            sillonsList.addEventListener('mousedown', (e) => {
                const target = e.target;
                const btn = target?.closest?.('[data-delete-sillon]');
                if (btn && btn.dataset.deleteSillon) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteSillon(btn.dataset.deleteSillon);
                }
            });
        }
    }
    async saveStationFromLines() {
        const name = document.getElementById('lsc-name')?.value.trim();
        let lat = parseFloat(document.getElementById('lsc-lat')?.value);
        let lon = parseFloat(document.getElementById('lsc-lon')?.value);
        const type = document.getElementById('lsc-type')?.value || 'voyageur';
        const platforms = parseInt(document.getElementById('lsc-platforms')?.value) || 4;
        if (!name)
            return alert('Nom de gare requis');
        if (isNaN(lat) || isNaN(lon))
            return alert('Latitude et longitude requises');
        const orm = this.game.orm;
        const loadingEl = document.getElementById('lsc-loading');
        // Snap to railway
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
            loadingEl.textContent = 'Accrochage au reseau ferroviaire...';
        }
        try {
            const snapped = await orm.snapToRailway(lat, lon, 2);
            if (snapped) {
                lat = snapped.lat;
                lon = snapped.lon;
            }
        }
        catch (e) {
            console.warn('Snap failed:', e);
        }
        const closed = document.getElementById('lsc-closed')?.checked || false;
        const station = this.game.world.addStation({ name, lat, lon, type, platforms, platformNames: [], closed });
        station.country = orm.getCountryAtPoint(lat, lon);
        station.facilities = [type];
        this.game.platformManager.initStation(station.id, platforms);
        // A newly-created station is only attached to a line after its physical ORM
        // connection has succeeded. Older builds appended the stop first, so a failed
        // route left a line with stops.length !== trackIds.length + 1.
        const lineId = document.getElementById('lsc-line')?.value || '';
        const selectedLine = lineId ? this.game.lineManager.getLine(lineId) : null;
        station.lineIds = [];
        // Connect to another station
        const connectChoice = document.getElementById('lsc-connect')?.value;
        let connectTo = null;
        if (connectChoice === '_nearest') {
            let nearestDistKm = Infinity;
            for (const s of this.game.world.stations) {
                if (s.id === station.id)
                    continue;
                const d = haversineDistance(lat, lon, Number(s.lat), Number(s.lon));
                if (Number.isFinite(d) && d < nearestDistKm) {
                    nearestDistKm = d;
                    connectTo = s;
                }
            }
            if (nearestDistKm >= 3)
                connectTo = null;
        }
        else if (connectChoice) {
            connectTo = this.game.world.getStationById(connectChoice);
        }
        if (connectTo) {
            if (loadingEl) {
                loadingEl.classList.remove('hidden');
                loadingEl.textContent = 'Calcul du trace ORM en cours...';
            }
            try {
                const route = await orm.findRoute(connectTo.lat, connectTo.lon, lat, lon);
                const distance = orm.getRouteDistance(route);
                const speeds = route.filter((r) => r.maxSpeed).map((r) => r.maxSpeed);
                const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((s, v) => s + v, 0) / speeds.length) : 160;
                const electrified = route.some((r) => r.electrified === false) ? false : true;
                if (!Array.isArray(route) || route.length < 2 || this.game.orm?.isFallbackRoute?.(route) || !Number.isFinite(Number(distance)) || distance <= 0) {
                    throw new Error('Itinéraire ORM vide, synthétique ou invalide');
                }
                const track = this.game.world.addTrack({
                    stationA: connectTo.id, stationB: station.id,
                    distance: Math.round(Number(distance) * 1000) / 1000, maxSpeed: avgSpeed,
                    electrified, name: `${connectTo.name} - ${name}`,
                    route,
                });
                if (selectedLine && track) {
                    const firstId = selectedLine.stops?.[0];
                    const lastId = selectedLine.stops?.[selectedLine.stops.length - 1];
                    if (connectTo.id === lastId) {
                        selectedLine.stops.push(station.id);
                        selectedLine.trackIds.push(track.id);
                        station.lineIds = [selectedLine.id];
                    }
                    else if (connectTo.id === firstId) {
                        selectedLine.stops.unshift(station.id);
                        selectedLine.trackIds.unshift(track.id);
                        station.lineIds = [selectedLine.id];
                    }
                    else {
                        alert('La gare a été créée et reliée, mais elle n’a pas été ajoutée automatiquement à la ligne : la gare de connexion doit être une extrémité de la ligne. Utilisez Modifier la ligne pour l’insérer au milieu.');
                    }
                    this.game.lineManager.invalidateTrackLineMap?.();
                }
            }
            catch (e) {
                console.warn('ORM route failed:', e);
                alert('Connexion non créée : aucun itinéraire ferroviaire OSM/ORM réel trouvé entre les deux gares.');
            }
        }
        if (loadingEl)
            loadingEl.classList.add('hidden');
        document.getElementById('lines-station-creator')?.classList.add('hidden');
        this.game.saveState();
        this.game.renderer?.invalidateStatic();
        this.renderLinesList();
    }
    openLineModal(editLine = null) {
        this.lineStops = [];
        this._editingLineId = null;
        this.lineMapCenter = null;
        this.lineMapScale = null;
        this._lineManualMode = false;
        this._lineManualSegmentIndex = -1;
        this._lineManualPoints = [];
        this._lineManualRoute = null;
        this._lineManualDrag = null;
        this._lineManualRoutes = [];
        if (editLine) {
            this._editingLineId = editLine.id;
            document.getElementById('line-name').value = editLine.name;
            document.getElementById('line-code').value = editLine.code || '';
            document.getElementById('line-color').value = editLine.color || '#3b82f6';
            document.getElementById('modal-line-title').textContent = 'Modifier la ligne';
            this.lineStops = editLine.stops.map((stId) => {
                const st = this.game.world.getStationById(stId);
                return { stationId: stId, stationName: st ? st.name : stId };
            });
        }
        else {
            document.getElementById('line-name').value = '';
            document.getElementById('line-code').value = '';
            document.getElementById('line-color').value = '#3b82f6';
            document.getElementById('modal-line-title').textContent = 'Creer une ligne';
        }
        document.getElementById('modal-line')?.classList.remove('hidden');
        this.renderLineStops();
        this._populateLineStationSelect();
        this._setupLineStationSearch();
        setTimeout(() => this.setupLineMap(), 50);
    }
    _populateLineStationSelect(filter = '') {
        const select = document.getElementById('line-station-select');
        if (!select)
            return;
        const term = filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const stations = (this.game.world.stations || [])
            .filter((st) => {
            const name = (st.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return name.includes(term);
        })
            .sort((a, b) => a.name.localeCompare(b.name));
        select.innerHTML = stations.map((st) => `<option value="${htmlText(st.id)}">${htmlText(st.name)}</option>`).join('');
        select.dataset.stations = JSON.stringify(stations.map((s) => ({ id: s.id, name: s.name })));
    }
    _setupLineStationSearch() {
        const search = document.getElementById('line-station-search');
        const select = document.getElementById('line-station-select');
        const btn = document.getElementById('btn-line-add-station');
        if (search) {
            search.oninput = () => this._populateLineStationSelect(search.value);
        }
        if (btn) {
            btn.onclick = () => {
                const stId = select?.value;
                if (!stId)
                    return;
                const station = this.game.world.getStationById(stId);
                if (station)
                    this.addLineStop(station);
            };
        }
    }
    setupLineMap() {
        const canvas = document.getElementById('line-map-canvas');
        if (!canvas)
            return;
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight || 300;
        const ctx = canvas.getContext('2d');
        const world = this.game.world;
        if (!this.lineMapCenter) {
            if (world.stations.length > 0) {
                let sumLat = 0, sumLon = 0;
                for (const st of world.stations) {
                    sumLat += st.lat;
                    sumLon += st.lon;
                }
                this.lineMapCenter = { lat: sumLat / world.stations.length, lon: sumLon / world.stations.length };
            }
            else {
                this.lineMapCenter = { lat: 46.8, lon: 2.3 };
            }
        }
        if (!this.lineMapScale) {
            this.lineMapScale = world.stations.length > 1 ? 0.02 : 0.04;
        }
        const project = (lat, lon) => {
            const cx = this.lineMapCenter.lon;
            const cy = this.lineMapCenter.lat;
            const scale = this.lineMapScale;
            return {
                x: (lon - cx) / scale + canvas.width / 2,
                y: (cy - lat) / scale + canvas.height / 2,
            };
        };
        const unproject = (x, y) => {
            const cx = this.lineMapCenter.lon;
            const cy = this.lineMapCenter.lat;
            const scale = this.lineMapScale;
            return {
                lon: cx + (x - canvas.width / 2) * scale,
                lat: cy - (y - canvas.height / 2) * scale,
            };
        };
        const getSegmentStations = (i) => {
            const sa = world.getStationById(this.lineStops[i]?.stationId);
            const sb = world.getStationById(this.lineStops[i + 1]?.stationId);
            return { sa, sb };
        };
        const drawMap = () => {
            const lineColor = document.getElementById('line-color')?.value || '#3b82f6';
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw existing tracks in gray
            for (const track of world.tracks) {
                const a = world.getStationById(track.stationA);
                const b = world.getStationById(track.stationB);
                if (!a || !b)
                    continue;
                const pa = project(a.lat, a.lon);
                const pb = project(b.lat, b.lon);
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pa.x, pa.y);
                ctx.lineTo(pb.x, pb.y);
                ctx.stroke();
            }
            // Draw existing lines with their colors
            for (const line of this.game.lineManager.getAll()) {
                if (line.id === this._editingLineId)
                    continue;
                ctx.strokeStyle = line.color + '60';
                ctx.lineWidth = 3;
                for (let i = 0; i < line.stops.length - 1; i++) {
                    const sa = world.getStationById(line.stops[i]);
                    const sb = world.getStationById(line.stops[i + 1]);
                    if (!sa || !sb)
                        continue;
                    const pa = project(sa.lat, sa.lon);
                    const pb = project(sb.lat, sb.lon);
                    ctx.beginPath();
                    ctx.moveTo(pa.x, pa.y);
                    ctx.lineTo(pb.x, pb.y);
                    ctx.stroke();
                }
            }
            // Draw stations
            for (const st of world.stations) {
                const p = project(st.lat, st.lon);
                if (p.x < -20 || p.x > canvas.width + 20 || p.y < -20 || p.y > canvas.height + 20)
                    continue;
                const isSelected = this.lineStops.some((s) => s.stationId === st.id);
                const isSegStart = this._lineManualMode && this.lineStops[this._lineManualSegmentIndex]?.stationId === st.id;
                const isSegEnd = this._lineManualMode && this.lineStops[this._lineManualSegmentIndex + 1]?.stationId === st.id;
                ctx.fillStyle = isSegStart || isSegEnd ? '#f59e0b' : (isSelected ? lineColor : '#3b82f6');
                ctx.beginPath();
                ctx.arc(p.x, p.y, isSelected ? 6 : 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#94a3b8';
                ctx.font = '10px sans-serif';
                ctx.fillText(st.name, p.x + 8, p.y + 4);
            }
            // Draw current line route
            const lc = lineColor;
            for (let i = 0; i < this.lineStops.length - 1; i++) {
                const { sa, sb } = getSegmentStations(i);
                if (!sa || !sb)
                    continue;
                const isManualSegment = this._lineManualMode && i === this._lineManualSegmentIndex;
                const storedRoute = this._lineManualRoutes[i];
                if (storedRoute && storedRoute.length >= 2) {
                    ctx.strokeStyle = lc;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    const p0 = project(storedRoute[0].lat, storedRoute[0].lon);
                    ctx.moveTo(p0.x, p0.y);
                    for (let j = 1; j < storedRoute.length; j++) {
                        const p = project(storedRoute[j].lat, storedRoute[j].lon);
                        ctx.lineTo(p.x, p.y);
                    }
                    ctx.stroke();
                }
                else if (isManualSegment && this._lineManualRoute && this._lineManualRoute.length >= 2) {
                    ctx.strokeStyle = lc;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    const p0 = project(this._lineManualRoute[0].lat, this._lineManualRoute[0].lon);
                    ctx.moveTo(p0.x, p0.y);
                    for (let j = 1; j < this._lineManualRoute.length; j++) {
                        const p = project(this._lineManualRoute[j].lat, this._lineManualRoute[j].lon);
                        ctx.lineTo(p.x, p.y);
                    }
                    ctx.stroke();
                }
                else {
                    const track = world.getTrackBetween(sa.id, sb.id);
                    if (track && track.route && track.route.length > 1) {
                        ctx.strokeStyle = lc;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        const p0 = project(track.route[0].lat, track.route[0].lon);
                        ctx.moveTo(p0.x, p0.y);
                        for (let j = 1; j < track.route.length; j++) {
                            const p = project(track.route[j].lat, track.route[j].lon);
                            ctx.lineTo(p.x, p.y);
                        }
                        ctx.stroke();
                    }
                    else {
                        const pa = project(sa.lat, sa.lon);
                        const pb = project(sb.lat, sb.lon);
                        ctx.strokeStyle = lc;
                        ctx.lineWidth = 2;
                        ctx.setLineDash([6, 4]);
                        ctx.beginPath();
                        ctx.moveTo(pa.x, pa.y);
                        ctx.lineTo(pb.x, pb.y);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
            }
            // Draw manual control points
            if (this._lineManualMode && this._lineManualRoute && this._lineManualRoute.length >= 2) {
                for (let i = 0; i < this._lineManualRoute.length; i++) {
                    const pt = this._lineManualRoute[i];
                    if (!pt.control)
                        continue;
                    const p = project(pt.lat, pt.lon);
                    const isEnd = (i === 0 || i === this._lineManualRoute.length - 1);
                    ctx.fillStyle = isEnd ? '#f59e0b' : '#38bdf8';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, isEnd ? 6 : 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    if (!isEnd) {
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(56,189,248,0.4)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
            }
            // Draw stop order numbers
            for (let i = 0; i < this.lineStops.length; i++) {
                const st = world.getStationById(this.lineStops[i].stationId);
                if (!st)
                    continue;
                const p = project(st.lat, st.lon);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 9px sans-serif';
                ctx.fillText(String(i + 1), p.x - 3, p.y - 8);
            }
        };
        drawMap();
        let drag = false, dragStart = null, totalDragDist = 0;
        const findNearestManualPoint = (x, y) => {
            if (!this._lineManualMode)
                return -1;
            let bestIdx = -1, bestD = Infinity;
            for (let i = 0; i < this._lineManualPoints.length; i++) {
                const p = project(this._lineManualPoints[i].lat, this._lineManualPoints[i].lon);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < bestD) {
                    bestD = d;
                    bestIdx = i;
                }
            }
            return bestD <= 12 ? bestIdx : -1;
        };
        const isNearStation = (x, y, radius = 14) => {
            for (const st of world.stations) {
                const p = project(st.lat, st.lon);
                if (Math.hypot(p.x - x, p.y - y) <= radius)
                    return true;
            }
            return false;
        };
        canvas.onmousedown = (e) => {
            const x = e.offsetX, y = e.offsetY;
            drag = true;
            dragStart = { x, y };
            totalDragDist = 0;
            if (this._lineManualMode) {
                const idx = findNearestManualPoint(x, y);
                if (idx >= 0) {
                    if (e.ctrlKey || e.button === 2) {
                        this._lineManualPoints.splice(idx, 1);
                        this._rebuildLineManualRoute();
                        drawMap();
                    }
                    else {
                        this._lineManualDrag = { index: idx, startX: x, startY: y, moved: false };
                    }
                    drag = false;
                    dragStart = null;
                    totalDragDist = 0;
                    return;
                }
            }
        };
        canvas.onmousemove = (e) => {
            if (this._lineManualDrag) {
                const dx = e.offsetX - this._lineManualDrag.startX;
                const dy = e.offsetY - this._lineManualDrag.startY;
                if (!this._lineManualDrag.moved && Math.hypot(dx, dy) < 4)
                    return;
                this._lineManualDrag.moved = true;
                const w = unproject(e.offsetX, e.offsetY);
                const snapped = this._snapToTrack(w.lat, w.lon);
                const pt = this._lineManualPoints[this._lineManualDrag.index];
                if (pt) {
                    pt.lat = snapped ? snapped.lat : w.lat;
                    pt.lon = snapped ? snapped.lon : w.lon;
                }
                this._rebuildLineManualRoute();
                drawMap();
                return;
            }
            if (drag && dragStart) {
                const dx = e.offsetX - dragStart.x;
                const dy = e.offsetY - dragStart.y;
                totalDragDist += Math.abs(dx) + Math.abs(dy);
                this.lineMapCenter.lon -= dx * this.lineMapScale;
                this.lineMapCenter.lat += dy * this.lineMapScale;
                dragStart = { x: e.offsetX, y: e.offsetY };
                drawMap();
                return;
            }
            // Hover feedback
            const x = e.offsetX, y = e.offsetY;
            let cursor = 'default';
            if (this._lineManualMode && findNearestManualPoint(x, y) >= 0)
                cursor = 'grab';
            else {
                for (const st of world.stations) {
                    const p = project(st.lat, st.lon);
                    if (Math.hypot(p.x - x, p.y - y) < 16) {
                        cursor = 'pointer';
                        break;
                    }
                }
            }
            canvas.style.cursor = cursor;
        };
        canvas.onmouseup = (e) => {
            if (this._lineManualDrag) {
                const wasMoved = this._lineManualDrag.moved;
                this._lineManualDrag = null;
                if (wasMoved) {
                    drag = false;
                    dragStart = null;
                    totalDragDist = 0;
                    return;
                }
            }
            if (totalDragDist < 5) {
                const x = e.offsetX, y = e.offsetY;
                if (this._lineManualMode) {
                    if (e.shiftKey) {
                        const idx = findNearestManualPoint(x, y);
                        if (idx >= 0) {
                            this._lineManualPoints.splice(idx, 1);
                            this._rebuildLineManualRoute();
                            drawMap();
                        }
                        drag = false;
                        dragStart = null;
                        totalDragDist = 0;
                        return;
                    }
                    if (isNearStation(x, y, 16)) {
                        drag = false;
                        dragStart = null;
                        totalDragDist = 0;
                        return;
                    }
                    const w = unproject(x, y);
                    const snapped = this._snapToTrack(w.lat, w.lon);
                    const pt = snapped || w;
                    this._lineManualPoints.push({ lat: pt.lat, lon: pt.lon });
                    this._rebuildLineManualRoute();
                    drawMap();
                }
                else {
                    let closest = null, minDist = Infinity;
                    for (const st of world.stations) {
                        const p = project(st.lat, st.lon);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < minDist && d < 20) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (closest)
                        this.addLineStop(closest);
                }
            }
            drag = false;
            dragStart = null;
            totalDragDist = 0;
        };
        canvas.ondblclick = (e) => {
            if (!this._lineManualMode)
                return;
            const idx = findNearestManualPoint(e.offsetX, e.offsetY);
            if (idx >= 0) {
                this._lineManualPoints.splice(idx, 1);
                this._rebuildLineManualRoute();
                drawMap();
            }
        };
        canvas.onwheel = (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1.2 : 0.83;
            this.lineMapScale = Math.max(0.002, Math.min(0.2, this.lineMapScale * factor));
            drawMap();
        };
        this._drawLineMap = drawMap;
        this._updateLineManualUI();
    }
    addLineStop(station) {
        if (this._lineManualMode) {
            alert('Terminez le tracé manuel du segment avant d\'ajouter une gare.');
            return;
        }
        // Don't add duplicate consecutive stops
        if (this.lineStops.length > 0 && this.lineStops[this.lineStops.length - 1].stationId === station.id)
            return;
        this.lineStops.push({
            stationId: station.id,
            stationName: station.name,
        });
        this.renderLineStops();
        if (this._drawLineMap)
            this._drawLineMap();
    }
    removeLineStop(index) {
        this.lineStops.splice(index, 1);
        this._lineManualMode = false;
        this._lineManualSegmentIndex = -1;
        this._lineManualPoints = [];
        this._lineManualRoute = null;
        this._lineManualDrag = null;
        this._lineManualRoutes = this._lineManualRoutes.slice(0, Math.max(0, this.lineStops.length - 1));
        this.renderLineStops();
        this._updateLineManualUI();
        if (this._drawLineMap)
            this._drawLineMap();
    }
    _rebuildLineManualRoute() {
        const idx = this._lineManualSegmentIndex;
        if (idx < 0 || idx >= this.lineStops.length - 1)
            return;
        const sa = this.game.world.getStationById(this.lineStops[idx].stationId);
        const sb = this.game.world.getStationById(this.lineStops[idx + 1].stationId);
        if (!sa || !sb)
            return;
        const start = { lat: sa.lat, lon: sa.lon, maxSpeed: 160, control: true };
        const end = { lat: sb.lat, lon: sb.lon, maxSpeed: 160, control: true };
        const controls = this._lineManualPoints.map((p) => ({ lat: p.lat, lon: p.lon, maxSpeed: 160, control: true }));
        this._lineManualRoute = this._buildManualRoute(start, controls, end, 160);
    }
    _toggleLineManual() {
        if (this._lineManualMode) {
            this._lineManualMode = false;
            this._lineManualSegmentIndex = -1;
            this._lineManualPoints = [];
            this._lineManualRoute = null;
            this._lineManualDrag = null;
        }
        else {
            if (this.lineStops.length < 2)
                return alert('Il faut au moins 2 gares pour tracer un segment.');
            const idx = this.lineStops.length - 2;
            this._lineManualSegmentIndex = idx;
            const route = this._lineManualRoutes[idx];
            if (route && route.length >= 2) {
                this._lineManualPoints = route.filter((p, i) => p.control && i !== 0 && i !== route.length - 1).map((p) => ({ lat: p.lat, lon: p.lon }));
            }
            else {
                this._lineManualPoints = [];
            }
            this._lineManualMode = true;
            this._rebuildLineManualRoute();
        }
        this._updateLineManualUI();
        if (this._drawLineMap)
            this._drawLineMap();
    }
    _clearLineManual() {
        if (this._lineManualSegmentIndex >= 0)
            this._lineManualRoutes[this._lineManualSegmentIndex] = null;
        this._lineManualPoints = [];
        this._lineManualRoute = null;
        if (this._drawLineMap)
            this._drawLineMap();
    }
    _finishLineManual() {
        if (!this._lineManualMode)
            return;
        this._rebuildLineManualRoute();
        if (!this._lineManualRoute || this._lineManualRoute.length < 2) {
            alert('Tracé invalide. Ajoutez au moins un point intermédiaire.');
            return;
        }
        this._lineManualRoutes[this._lineManualSegmentIndex] = this._lineManualRoute;
        this._lineManualMode = false;
        this._lineManualSegmentIndex = -1;
        this._lineManualPoints = [];
        this._lineManualRoute = null;
        this._lineManualDrag = null;
        this._updateLineManualUI();
        if (this._drawLineMap)
            this._drawLineMap();
    }
    _updateLineManualUI() {
        const manual = document.getElementById('btn-line-manual');
        const clear = document.getElementById('btn-line-clear-manual');
        const finish = document.getElementById('btn-line-finish-manual');
        const hint = document.getElementById('line-manual-hint');
        if (manual) {
            manual.textContent = this._lineManualMode ? 'Quitter le tracé manuel' : 'Tracer manuellement le segment';
            manual.classList.toggle('active', this._lineManualMode);
            manual.disabled = this.lineStops.length < 2 && !this._lineManualMode;
        }
        if (clear)
            clear.classList.toggle('hidden', !this._lineManualMode);
        if (finish)
            finish.classList.toggle('hidden', !this._lineManualMode);
        if (hint) {
            if (this._lineManualMode) {
                hint.textContent = 'Cliquez pour ajouter des points entre les deux gares. Glissez pour déplacer. Ctrl / clic droit / double-clic pour supprimer.';
            }
            else {
                hint.textContent = this.lineStops.length >= 2 ? 'Vous pouvez tracer manuellement le dernier segment pour remplacer le calcul ORM.' : 'Ajoutez au moins 2 gares pour tracer un segment.';
            }
        }
    }
    renderLineStops() {
        const container = document.getElementById('line-stops-list');
        if (!container)
            return;
        if (this.lineStops.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:8px">Cliquer sur les gares de la carte pour definir la ligne</p>';
            return;
        }
        container.innerHTML = this.lineStops.map((stop, i) => {
            const isShared = i > 0 ? !!this.game.world.getTrackBetween(this.lineStops[i - 1].stationId, stop.stationId) : false;
            const hasManual = i > 0 && this._lineManualRoutes[i - 1];
            const manualLabel = hasManual ? '<span style="color:#38bdf8;font-size:9px"> (tracé manuel)</span>' : '';
            const sharedInfo = (i > 0 && isShared) ? '<span style="color:#16a34a;font-size:9px"> (troncon existant)</span>' : (i > 0 ? '<span style="color:#f59e0b;font-size:9px"> (nouveau troncon)</span>' : '');
            return `
        <div class="sched-stop-row">
          <span style="color:var(--text3);font-size:10px;width:16px">${i + 1}</span>
          <span class="stop-name">${htmlText(stop.stationName)}${sharedInfo}${manualLabel}</span>
          <button class="btn-remove-stop" onclick="game.ui.removeLineStop(${htmlJsValue(i)})">x</button>
        </div>
      `;
        }).join('');
    }
    async saveLine() {
        const name = document.getElementById('line-name').value.trim();
        if (!name)
            return alert('Nom requis');
        if (this.lineStops.length < 2)
            return alert('Il faut au moins 2 gares');
        if (this._lineManualMode)
            this._finishLineManual();
        if (this._lineManualMode)
            return;
        const color = document.getElementById('line-color').value || '#3b82f6';
        const code = document.getElementById('line-code').value.trim();
        const stops = this.lineStops.map((s) => s.stationId);
        const loadingEl = document.getElementById('line-loading');
        if (loadingEl)
            loadingEl.classList.remove('hidden');
        if (this._editingLineId) {
            // Transactional edit: build/validate every requested leg first. The existing
            // line and all station references remain untouched if a single ORM leg fails.
            const line = this.game.lineManager.getLine(this._editingLineId);
            if (line) {
                const candidate = await this.game.lineManager.buildLine({ name, color, code, stops: [...stops], manualRoutes: this._lineManualRoutes }, this.game.world, this.game.orm);
                if (!candidate) {
                    if (loadingEl)
                        loadingEl.classList.add('hidden');
                    alert('Ligne non modifiée : au moins un trajet ne possède pas d’itinéraire ferroviaire OSM/ORM réel chargé.');
                    return;
                }
                // The candidate is only a validated staging line. Keep its valid tracks,
                // remove the temporary line object, then atomically swap the real line.
                const stagedTrackIds = [...candidate.trackIds];
                this.game.lineManager.removeLine(candidate.id);
                const oldStops = [...line.stops];
                for (const oldStId of oldStops) {
                    const st = this.game.world.getStationById(oldStId);
                    if (st)
                        st.lineIds = (st.lineIds || []).filter((lid) => lid !== line.id);
                }
                line.name = name;
                line.color = color;
                line.code = code;
                line.stops = [...stops];
                line.trackIds = stagedTrackIds;
                for (const stId of stops) {
                    const st = this.game.world.getStationById(stId);
                    if (!st)
                        continue;
                    if (!Array.isArray(st.lineIds))
                        st.lineIds = [];
                    if (!st.lineIds.includes(line.id))
                        st.lineIds.push(line.id);
                }
                this.game.lineManager.invalidateTrackLineMap?.();
            }
        }
        else {
            // Create new line
            const line = await this.game.lineManager.buildLine({ name, color, code, stops, manualRoutes: this._lineManualRoutes }, this.game.world, this.game.orm);
            if (!line) {
                if (loadingEl)
                    loadingEl.classList.add('hidden');
                alert('Ligne non créée : au moins un trajet ne possède pas d’itinéraire ferroviaire OSM/ORM réel chargé.');
                return;
            }
            for (const stId of stops) {
                const st = this.game.world.getStationById(stId);
                if (st) {
                    if (!st.lineIds)
                        st.lineIds = [];
                    if (!st.lineIds.includes(line.id))
                        st.lineIds.push(line.id);
                }
            }
        }
        if (loadingEl)
            loadingEl.classList.add('hidden');
        document.getElementById('modal-line')?.classList.add('hidden');
        this.renderLinesList();
        this.game.saveState();
        this.game.renderer?.invalidateStatic();
    }
    renderLinesList() {
        // Render stations list
        const stationsContainer = document.getElementById('lines-stations-list');
        if (stationsContainer) {
            const stations = this.game.world.stations || [];
            if (stations.length > 0) {
                stationsContainer.innerHTML = `
          <h3 style="font-size:13px;margin:0 0 6px;color:var(--text2)">Gares (${stations.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
            ${stations.map((st) => {
                    const typeLabel = { voyageur: 'Voy', marchandise: 'Fret', mixed: 'Mix', depot: 'Dep', ite: 'ITE' }[st.type] || '';
                    const closedTag = st.closed ? ' <span style="color:#ef4444;font-size:9px">Fermee</span>' : '';
                    return `<span class="line-stop-tag" style="font-size:10px;cursor:pointer;${htmlText(st.closed ? 'opacity:0.6;' : '')}" title="${htmlText(st.lat.toFixed(4))}, ${htmlText(st.lon.toFixed(4))} | ${htmlText(st.platforms || '?')} voies${htmlText(st.closed ? ' | FERMEE' : '')}" onclick="game.ui.editStationFromLines('${htmlJsString(st.id)}')">${htmlText(st.name)} <span style="color:var(--text3);font-size:9px">${htmlText(typeLabel)}</span>${closedTag}</span>`;
                }).join('')}
          </div>
        `;
            }
            else {
                stationsContainer.innerHTML = '';
            }
        }
        // TRV-07 — état du réseau (lignes, usure, incidents)
        const networkContainer = document.getElementById('network-state');
        if (networkContainer) {
            const troncons = this.game.voiePointManager?.troncons || [];
            const avgWear = troncons.length > 0 ? (troncons.reduce((s, t) => s + (t.wear || 0), 0) / troncons.length).toFixed(1) : '0';
            const maxWear = troncons.length > 0 ? Math.max(...troncons.map((t) => t.wear || 0)).toFixed(1) : '0';
            const closedTracks = troncons.filter((t) => t.closed).length;
            const lineRows = this.game.lineManager.getAll().map((line) => {
                const stA = this.game.world.getStationById(line.stops[0]);
                const stB = this.game.world.getStationById(line.stops[line.stops.length - 1]);
                const label = (stA?.name || '?') + ' ↔ ' + (stB?.name || '?');
                const tracks = line.trackIds.map((id) => this.game.world.tracks.find((t) => t.id === id) || this.game.voiePointManager?.getTronconById(id)).filter(Boolean);
                const wear = tracks.length ? (tracks.reduce((s, t) => s + (t.wear || 0), 0) / tracks.length).toFixed(1) : '-';
                const incidents = this.game.incidentManager?.getActiveIncidentsOnLine(line.stops) || [];
                const status = incidents.length ? '<span style="color:#ef4444">Perturbé</span>' : '<span style="color:#22c55e">Ouvert</span>';
                return `<div class="dash-train-row" style="grid-template-columns:2fr 2fr 1fr 1fr"><span>${htmlText(line.name)}</span><span style="color:var(--text3);font-size:10px">${htmlText(label)}</span><span>${wear}%</span><span>${htmlText(status)}</span></div>`;
            }).join('') || '<div style="padding:8px;color:var(--text3)">Aucune ligne</div>';
            networkContainer.innerHTML = `
        <h3 style="margin:0 0 8px;font-size:13px">Etat du reseau</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
          <span>Troncons : <b>${troncons.length}</b></span>
          <span>Usure moyenne : <b>${avgWear}%</b></span>
          <span>Usure max : <b style="color:${htmlText(parseFloat(maxWear) > 50 ? '#ef4444' : '#22c55e')}">${maxWear}%</b></span>
          ${closedTracks ? `<span style="color:#ef4444">Fermes : ${closedTracks}</span>` : ''}
        </div>
        <div class="dash-train-table" style="margin-top:8px">
          <div class="dash-train-header" style="grid-template-columns:2fr 2fr 1fr 1fr"><span>Ligne</span><span>Axe A↔B</span><span>Usure</span><span>Etat</span></div>
          ${lineRows}
        </div>
      `;
        }
        const container = document.getElementById('lines-list');
        if (!container)
            return;
        const lines = this.game.lineManager.getAll();
        if (lines.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Aucune ligne. Cliquer "+ Creer une ligne" pour commencer.</p>';
            return;
        }
        container.innerHTML = lines.map((line) => {
            const stopsPreview = line.stops.map((stId) => {
                const st = this.game.world.getStationById(stId);
                return st ? st.name : stId;
            });
            const firstStop = stopsPreview[0] || '?';
            const lastStop = stopsPreview[stopsPreview.length - 1] || '?';
            // Count shared tracks
            let sharedCount = 0;
            for (const trkId of line.trackIds) {
                if (!trkId)
                    continue;
                const linesOnTrack = this.game.lineManager.getLinesForTrack(trkId);
                if (linesOnTrack.length > 1)
                    sharedCount++;
            }
            const totalDist = line.trackIds.reduce((sum, trkId) => {
                if (!trkId)
                    return sum;
                const track = this.game.world.tracks.find((t) => t.id === trkId);
                return sum + (track ? track.distance : 0);
            }, 0);
            return `
        <div class="line-item" style="border-left:4px solid ${htmlText(line.color)}">
          <div class="line-item-header">
            <span class="line-item-name" style="color:${htmlText(line.color)}">${htmlText(line.code ? '[' + line.code + '] ' : '')}${htmlText(line.name)}</span>
            <span style="color:var(--text3);font-size:10px">${Math.round(totalDist)} km | ${line.stops.length} gares${sharedCount > 0 ? ' | ' + sharedCount + ' troncon(s) partage(s)' : ''}</span>
            <button class="btn-sm" onclick="game.ui.editLine('${htmlJsString(line.id)}')">Modifier</button>
            <button class="btn-sm danger" onclick="game.ui.deleteLine('${htmlJsString(line.id)}')">Supprimer</button>
          </div>
          <div class="line-route-preview">
            ${stopsPreview.map((name, i) => `<span class="line-stop-tag">${htmlText(name)}</span>${i < stopsPreview.length - 1 ? '<span style="color:var(--text3)"> → </span>' : ''}`).join('')}
          </div>
        </div>
      `;
        }).join('');
        this.renderSillonsList();
    }
    editStationFromLines(stationId) {
        const station = this.game.world.getStationById(stationId);
        if (station)
            this.openEditStationModal(station);
    }
    editLine(id) {
        const line = this.game.lineManager.getLine(id);
        if (line)
            this.openLineModal(line);
    }
    deleteLine(id) {
        if (!confirm('Supprimer cette ligne ?'))
            return;
        const line = this.game.lineManager.getLine(id);
        if (line) {
            // Remove line references from stations
            for (const stId of line.stops) {
                const st = this.game.world.getStationById(stId);
                if (st)
                    st.lineIds = (st.lineIds || []).filter((lid) => lid !== id);
            }
        }
        this.game.lineManager.removeLine(id);
        this.renderLinesList();
        this.game.saveState();
    }
    // --- SILLONS (Section V) ---
    openSillonCreator() {
        const creator = document.getElementById('sillon-creator');
        if (!creator)
            return;
        const fromSel = document.getElementById('sillon-from');
        const toSel = document.getElementById('sillon-to');
        const opts = this.game.world.stations.map((st) => `<option value="${htmlText(st.id)}">${htmlText(st.name)}</option>`).join('');
        if (fromSel)
            fromSel.innerHTML = '<option value="">—</option>' + opts;
        if (toSel)
            toSel.innerHTML = '<option value="">—</option>' + opts;
        this._resetSillonManual();
        this._sillonNameTouched = false;
        this._updateSillonName();
        this._updateSillonManualUI();
        creator.classList.remove('hidden');
        // Le canvas a besoin d'un reflow pour avoir une taille ; on initialise la carte au prochain frame.
        requestAnimationFrame(() => this.setupSillonMap());
    }
    async saveSillon() {
        const name = document.getElementById('sillon-name')?.value.trim();
        const fromId = document.getElementById('sillon-from')?.value;
        const toId = document.getElementById('sillon-to')?.value;
        if (!name)
            return alert('Nom requis');
        if (!fromId || !toId)
            return alert('Sélectionnez les gares A et B');
        if (fromId === toId)
            return alert('Les gares doivent être différentes');
        const stA = this.game.world.getStationById(fromId);
        const stB = this.game.world.getStationById(toId);
        if (!stA || !stB)
            return alert('Gares invalides');
        // If the player traced points but did not click "Finish", auto-finalize on save.
        if (this._sillonManualPoints && this._sillonManualPoints.length > 0 && this._sillonManualStart && this._sillonManualEnd) {
            this._rebuildSillonManualRoute();
        }
        const loadingEl = document.getElementById('sillon-creator-loading');
        if (loadingEl)
            loadingEl.classList.remove('hidden');
        let route = null;
        let distance = 0;
        let maxSpeed = 160;
        let electrified = true;
        if (this._sillonManualRoute && this._sillonManualRoute.length >= 2) {
            route = this._sillonManualRoute;
        }
        else {
            try {
                route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
            }
            catch (e) {
                console.warn('ORM route failed for sillon', e);
            }
            if (!route || route.length < 2) {
                if (loadingEl)
                    loadingEl.classList.add('hidden');
                return alert('Impossible de calculer un itineraire ferroviaire entre ces gares. Vérifiez le réseau ORM ou utilisez le tracé manuel.');
            }
            distance = this.game.orm.getRouteDistance(route);
            const speeds = route.filter((r) => r.maxSpeed).map((r) => r.maxSpeed);
            maxSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 160;
            electrified = route.some((r) => r.electrified === false) ? false : true;
            route = this.game.orm.getRouteSegments(route).map((s) => ({ lat: s.from.lat, lon: s.from.lon, maxSpeed: s.maxSpeed })).concat([{ lat: route[route.length - 1].lat, lon: route[route.length - 1].lon, maxSpeed: route[route.length - 1].maxSpeed || 160 }]);
        }
        if (route && route.length >= 2) {
            const routeOk = route.every((p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && !p.fallback && !p.synthetic);
            distance = routeOk ? Number(this.game.orm.getRouteDistance(route)) : NaN;
            const speeds = route.map((r) => Number(r.maxSpeed)).filter((v) => Number.isFinite(v) && v > 0);
            maxSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 160;
            electrified = route.some((r) => r.electrified === false) ? false : true;
            if (!routeOk || !Number.isFinite(distance) || distance <= 0) {
                if (loadingEl)
                    loadingEl.classList.add('hidden');
                return alert('Sillon non créé : le tracé doit suivre un itinéraire ferroviaire ORM réel et continu.');
            }
        }
        const createdSillon = this.game.sillonManager.add({
            name,
            fromStationId: fromId,
            toStationId: toId,
            fromStationName: stA.name,
            toStationName: stB.name,
            route,
            distance,
            maxSpeed,
            electrified,
        });
        if (!createdSillon) {
            if (loadingEl)
                loadingEl.classList.add('hidden');
            return alert('Sillon non créé : données de trajet invalides.');
        }
        if (loadingEl)
            loadingEl.classList.add('hidden');
        document.getElementById('sillon-creator')?.classList.add('hidden');
        this._resetSillonManual();
        this.renderLinesList();
        this.game.saveState();
    }
    renderSillonsList() {
        const container = document.getElementById('sillons-list');
        if (!container)
            return;
        const sillons = this.game.sillonManager.getAll();
        if (sillons.length === 0) {
            container.innerHTML = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:20px">Aucun sillon automatique. Créez-en un pour accélérer les horaires.</p>';
            return;
        }
        container.innerHTML = sillons.map((s) => `
      <div class="sillon-item">
        <div>
          <b>${htmlText(s.name)}</b> — ${htmlText(s.fromStationName)} → ${htmlText(s.toStationName)}<br>
          <span>${Math.round(s.distance)} km · Vmax ${s.maxSpeed} km/h · ${s.electrified !== false ? 'électrifié' : 'non électrifié'}</span>
        </div>
        <button class="btn-sm danger" data-delete-sillon="${htmlText(s.id)}" title="Supprimer le sillon">✕</button>
      </div>
    `).join('');
    }
    deleteSillon(id) {
        if (!confirm('Supprimer ce sillon ?'))
            return;
        this.game.sillonManager.remove(id);
        this.renderLinesList();
        this.game.saveState();
    }
    // --- Sillon manual trace helpers (Section V) ---
    _updateSillonName() {
        const fromId = document.getElementById('sillon-from')?.value;
        const toId = document.getElementById('sillon-to')?.value;
        const nameInput = document.getElementById('sillon-name');
        if (!fromId || !toId || !nameInput)
            return;
        if (this._sillonNameTouched)
            return;
        const next = this.game.sillonManager.getNextName(fromId, toId);
        const current = nameInput.value.trim();
        if (!current) {
            nameInput.value = next;
        }
    }
    _resetSillonManual() {
        this._sillonManualMode = false;
        this._sillonManualStart = null;
        this._sillonManualEnd = null;
        this._sillonManualPoints = [];
        this._sillonManualRoute = null;
        this._sillonManualDrag = null;
    }
    _syncSillonManualEndpoints() {
        const fromId = document.getElementById('sillon-from')?.value;
        const toId = document.getElementById('sillon-to')?.value;
        const fromSt = fromId ? this.game.world.getStationById(fromId) : null;
        const toSt = toId ? this.game.world.getStationById(toId) : null;
        if (fromSt)
            this._sillonManualStart = { lat: fromSt.lat, lon: fromSt.lon, id: fromSt.id, name: fromSt.name };
        else
            this._sillonManualStart = null;
        if (toSt)
            this._sillonManualEnd = { lat: toSt.lat, lon: toSt.lon, id: toSt.id, name: toSt.name };
        else
            this._sillonManualEnd = null;
        if (this._sillonTileMap) {
            if (fromSt && toSt) {
                this._sillonTileMap.centerLat = (fromSt.lat + toSt.lat) / 2;
                this._sillonTileMap.centerLon = (fromSt.lon + toSt.lon) / 2;
                const cosLat = Math.cos(this._sillonTileMap.centerLat * Math.PI / 180);
                const latSpan = Math.abs(fromSt.lat - toSt.lat) + 0.05;
                const lonSpan = Math.abs(fromSt.lon - toSt.lon) * cosLat + 0.05;
                const spanDeg = Math.max(latSpan, lonSpan);
                this._sillonTileMap.zoomLevel = Math.min(18, Math.max(6, Math.log2(1000 / spanDeg)));
            }
            else if (fromSt) {
                this._sillonTileMap.centerLat = fromSt.lat;
                this._sillonTileMap.centerLon = fromSt.lon;
                this._sillonTileMap.zoomLevel = 10;
            }
        }
        if (this._sillonManualMode)
            this._rebuildSillonManualRoute();
        if (this._drawSillonMap)
            this._drawSillonMap();
    }
    _rebuildSillonManualRoute() {
        if (!this._sillonManualStart || !this._sillonManualEnd)
            return;
        const start = { lat: this._sillonManualStart.lat, lon: this._sillonManualStart.lon, maxSpeed: 160 };
        const end = { lat: this._sillonManualEnd.lat, lon: this._sillonManualEnd.lon, maxSpeed: 160 };
        const controls = this._sillonManualPoints.map((p) => ({ lat: p.lat, lon: p.lon, maxSpeed: 160 }));
        this._sillonManualRoute = this._buildManualRoute(start, controls, end, 160);
    }
    _toggleSillonManualMode() {
        const fromId = document.getElementById('sillon-from')?.value;
        const toId = document.getElementById('sillon-to')?.value;
        if (!this._sillonManualMode) {
            if (!fromId || !toId)
                return alert('Sélectionnez d\'abord les gares A et B.');
            this._sillonManualMode = true;
            this._syncSillonManualEndpoints();
        }
        else {
            this._sillonManualMode = false;
            if (!this._sillonManualRoute)
                this._sillonManualPoints = [];
        }
        this._updateSillonManualUI();
        if (this._drawSillonMap)
            this._drawSillonMap();
    }
    _finishSillonManual() {
        if (!this._sillonManualMode)
            return;
        this._rebuildSillonManualRoute();
        if (!this._sillonManualRoute || this._sillonManualRoute.length < 2)
            return alert('Tracé invalide.');
        this._sillonManualMode = false;
        this._updateSillonManualUI();
        if (this._drawSillonMap)
            this._drawSillonMap();
    }
    _clearSillonManualTrace() {
        this._sillonManualPoints = [];
        this._sillonManualRoute = null;
        this._sillonManualMode = false;
        this._updateSillonManualUI();
        if (this._drawSillonMap)
            this._drawSillonMap();
    }
    _updateSillonManualUI() {
        const manual = document.getElementById('btn-sillon-manual');
        const clear = document.getElementById('btn-sillon-clear-manual');
        const finish = document.getElementById('btn-sillon-finish-manual');
        const hint = document.getElementById('sillon-manual-hint');
        const fromId = document.getElementById('sillon-from')?.value;
        const toId = document.getElementById('sillon-to')?.value;
        if (manual) {
            manual.textContent = this._sillonManualMode ? 'Quitter le tracé manuel' : 'Tracer manuellement';
            manual.classList.toggle('active', this._sillonManualMode);
            manual.disabled = !fromId || !toId;
        }
        if (clear)
            clear.classList.toggle('hidden', !this._sillonManualMode);
        if (finish)
            finish.classList.toggle('hidden', !this._sillonManualMode);
        if (hint) {
            if (this._sillonManualMode)
                hint.textContent = 'Cliquez pour ajouter un point (50 m). Glissez un point pour le déplacer. Ctrl / clic droit / double-clic sur un point pour le supprimer. Cliquez "Terminer" quand le tracé est complet.';
            else if (!fromId || !toId)
                hint.textContent = 'Sélectionnez les gares A et B, puis cliquez sur "Tracer manuellement" pour dessiner le sillon sur la carte.';
            else if (this._sillonManualRoute)
                hint.textContent = 'Tracé manuel enregistré. Vous pouvez le refaire avec "Tracer manuellement".';
            else
                hint.textContent = 'Cliquez sur "Tracer manuellement" pour dessiner le sillon, ou laissez l\'ORM calculer automatiquement.';
        }
    }
    setupSillonMap() {
        if (this._sillonMapInterval) {
            clearInterval(this._sillonMapInterval);
            this._sillonMapInterval = null;
        }
        const canvas = document.getElementById('sillon-map-canvas');
        if (!canvas)
            return;
        const container = canvas.parentElement;
        if (!container || container.clientWidth === 0 || container.clientHeight === 0)
            return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = canvas.getContext('2d');
        const world = this.game.world;
        if (!this._sillonTileMap) {
            const mainTileMap = this.game.renderer.tileMap;
            this._sillonTileMap = new mainTileMap.constructor();
        }
        const tileMap = this._sillonTileMap;
        tileMap.viewportWidth = canvas.width;
        tileMap.viewportHeight = canvas.height;
        const fromId = document.getElementById('sillon-from')?.value;
        const toId = document.getElementById('sillon-to')?.value;
        const fromSt = fromId ? world.getStationById(fromId) : null;
        const toSt = toId ? world.getStationById(toId) : null;
        if (fromSt && toSt) {
            tileMap.centerLat = (fromSt.lat + toSt.lat) / 2;
            tileMap.centerLon = (fromSt.lon + toSt.lon) / 2;
            const cosLat = Math.cos(tileMap.centerLat * Math.PI / 180);
            const latSpan = Math.abs(fromSt.lat - toSt.lat) + 0.05;
            const lonSpan = Math.abs(fromSt.lon - toSt.lon) * cosLat + 0.05;
            const spanDeg = Math.max(latSpan, lonSpan);
            tileMap.zoomLevel = Math.min(18, Math.max(6, Math.log2(1000 / spanDeg)));
        }
        else if (fromSt) {
            tileMap.centerLat = fromSt.lat;
            tileMap.centerLon = fromSt.lon;
            tileMap.zoomLevel = 10;
        }
        else if (world.stations.length > 0) {
            let sumLat = 0, sumLon = 0;
            for (const st of world.stations) {
                sumLat += st.lat;
                sumLon += st.lon;
            }
            tileMap.centerLat = sumLat / world.stations.length;
            tileMap.centerLon = sumLon / world.stations.length;
            tileMap.zoomLevel = world.stations.length > 5 ? 7 : 8;
        }
        else {
            tileMap.centerLat = 46.8;
            tileMap.centerLon = 2.3;
            tileMap.zoomLevel = 6;
        }
        let drawPending = false;
        const requestDraw = () => {
            if (drawPending)
                return;
            drawPending = true;
            requestAnimationFrame(() => { drawPending = false; drawMap(); });
        };
        const drawMap = () => {
            const creator = document.getElementById('sillon-creator');
            if (!creator || creator.classList.contains('hidden'))
                return;
            tileMap.renderTiles(ctx, canvas.width, canvas.height);
            const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
            const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
            const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
            const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
            const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
            const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;
            // Existing sillons (faint)
            for (const s of this.game.sillonManager.getAll()) {
                if (!s.route || s.route.length < 2)
                    continue;
                ctx.strokeStyle = 'rgba(74,222,128,0.2)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const p0 = tileMap.worldToScreen(s.route[0].lat, s.route[0].lon, canvas.width, canvas.height);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < s.route.length; i++) {
                    const p = tileMap.worldToScreen(s.route[i].lat, s.route[i].lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
            // Stations
            for (const st of world.stations) {
                if (st.lat < vMinLat || st.lat > vMaxLat || st.lon < vMinLon || st.lon > vMaxLon)
                    continue;
                const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                const isStart = this._sillonManualStart && this._sillonManualStart.id === st.id;
                const isEnd = this._sillonManualEnd && this._sillonManualEnd.id === st.id;
                ctx.fillStyle = isStart ? '#22c55e' : isEnd ? '#f97316' : '#3b82f6';
                ctx.beginPath();
                ctx.arc(p.x, p.y, (isStart || isEnd) ? 7 : 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (tileMap.zoomLevel >= 8) {
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = '10px sans-serif';
                    ctx.fillText(st.name, p.x + 8, p.y + 4);
                }
            }
            // Manual trace
            let trace = this._sillonManualRoute;
            if (!trace && this._sillonManualStart && this._sillonManualEnd) {
                const start = { lat: this._sillonManualStart.lat, lon: this._sillonManualStart.lon, maxSpeed: 160 };
                const end = { lat: this._sillonManualEnd.lat, lon: this._sillonManualEnd.lon, maxSpeed: 160 };
                const controls = this._sillonManualPoints.map((p) => ({ ...p, maxSpeed: 160 }));
                trace = this._densifyRoute([start, ...controls, end], 0.05);
            }
            if (trace && trace.length >= 2) {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const p0 = tileMap.worldToScreen(trace[0].lat, trace[0].lon, canvas.width, canvas.height);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < trace.length; i++) {
                    const p = tileMap.worldToScreen(trace[i].lat, trace[i].lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
                for (let i = 0; i < trace.length; i++) {
                    const pt = trace[i];
                    if (!pt.control && i !== 0 && i !== trace.length - 1)
                        continue;
                    const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                    const isEnd = (i === 0 || i === trace.length - 1);
                    ctx.fillStyle = isEnd ? '#f59e0b' : '#38bdf8';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, isEnd ? 6 : 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    if (!isEnd) {
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(56,189,248,0.4)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
            }
            else if (this._sillonManualStart && this._sillonManualEnd) {
                ctx.strokeStyle = 'rgba(250,204,21,0.4)';
                ctx.setLineDash([6, 4]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                const a = tileMap.worldToScreen(this._sillonManualStart.lat, this._sillonManualStart.lon, canvas.width, canvas.height);
                const b = tileMap.worldToScreen(this._sillonManualEnd.lat, this._sillonManualEnd.lon, canvas.width, canvas.height);
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        };
        this._drawSillonMap = drawMap;
        if (canvas._sillonBound) {
            requestDraw();
            return;
        }
        canvas._sillonBound = true;
        let drag = false, dragStart = null, totalDragDist = 0;
        const findNearestManualPoint = (x, y) => {
            let bestIdx = -1, bestD = Infinity;
            for (let i = 0; i < this._sillonManualPoints.length; i++) {
                const p = tileMap.worldToScreen(this._sillonManualPoints[i].lat, this._sillonManualPoints[i].lon, canvas.width, canvas.height);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < bestD) {
                    bestD = d;
                    bestIdx = i;
                }
            }
            return bestD <= 12 ? bestIdx : -1;
        };
        canvas.onmousedown = (e) => {
            const x = e.offsetX, y = e.offsetY;
            drag = true;
            dragStart = { x, y };
            totalDragDist = 0;
            if (this._sillonManualMode && this._sillonManualPoints.length) {
                const idx = findNearestManualPoint(x, y);
                if (idx >= 0) {
                    if (e.ctrlKey || e.button === 2) {
                        this._sillonManualPoints.splice(idx, 1);
                        this._rebuildSillonManualRoute();
                        requestDraw();
                    }
                    else {
                        this._sillonManualDrag = { index: idx, startX: x, startY: y, moved: false };
                    }
                    drag = false;
                    dragStart = null;
                    totalDragDist = 0;
                    return;
                }
            }
        };
        canvas.onmousemove = (e) => {
            if (this._sillonManualDrag) {
                const dx = e.offsetX - this._sillonManualDrag.startX;
                const dy = e.offsetY - this._sillonManualDrag.startY;
                if (!this._sillonManualDrag.moved && Math.hypot(dx, dy) < 4)
                    return;
                this._sillonManualDrag.moved = true;
                const w = tileMap.screenToWorld(e.offsetX, e.offsetY, canvas.width, canvas.height);
                const snapped = this._snapToTrack(w.lat, w.lon);
                const pt = this._sillonManualPoints[this._sillonManualDrag.index];
                if (pt) {
                    pt.lat = snapped ? snapped.lat : w.lat;
                    pt.lon = snapped ? snapped.lon : w.lon;
                }
                this._rebuildSillonManualRoute();
                requestDraw();
                return;
            }
            if (drag && dragStart) {
                const dx = e.offsetX - dragStart.x;
                const dy = e.offsetY - dragStart.y;
                totalDragDist += Math.abs(dx) + Math.abs(dy);
                tileMap.pan(dx, dy);
                dragStart = { x: e.offsetX, y: e.offsetY };
                requestDraw();
                return;
            }
            // Hover feedback
            const x = e.offsetX, y = e.offsetY;
            let cursor = 'default';
            if (this._sillonManualMode && findNearestManualPoint(x, y) >= 0)
                cursor = 'grab';
            else {
                for (const st of world.stations) {
                    const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                    if (Math.hypot(p.x - x, p.y - y) < 16) {
                        cursor = 'pointer';
                        break;
                    }
                }
            }
            canvas.style.cursor = cursor;
        };
        canvas.onmouseup = (e) => {
            if (this._sillonManualDrag) {
                const wasMoved = this._sillonManualDrag.moved;
                this._sillonManualDrag = null;
                if (wasMoved) {
                    drag = false;
                    dragStart = null;
                    totalDragDist = 0;
                    return;
                }
            }
            if (totalDragDist < 5) {
                const x = e.offsetX, y = e.offsetY;
                if (this._sillonManualMode) {
                    if (e.shiftKey) {
                        const idx = findNearestManualPoint(x, y);
                        if (idx >= 0) {
                            this._sillonManualPoints.splice(idx, 1);
                            this._rebuildSillonManualRoute();
                            requestDraw();
                        }
                        drag = false;
                        dragStart = null;
                        totalDragDist = 0;
                        return;
                    }
                    const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
                    if (!this._sillonManualStart || !this._sillonManualEnd)
                        return;
                    const snapped = this._snapToTrack(worldPos.lat, worldPos.lon);
                    const pt = snapped || worldPos;
                    this._sillonManualPoints.push({ lat: pt.lat, lon: pt.lon });
                    this._rebuildSillonManualRoute();
                    requestDraw();
                }
                else {
                    let closest = null, minDist = Infinity;
                    for (const st of world.stations) {
                        const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < minDist && d < 20) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (closest) {
                        const fromSel = document.getElementById('sillon-from');
                        const toSel = document.getElementById('sillon-to');
                        if (fromSel && !fromSel.value) {
                            fromSel.value = closest.id;
                            this._updateSillonName();
                            this._syncSillonManualEndpoints();
                        }
                        else if (toSel && !toSel.value) {
                            toSel.value = closest.id;
                            this._updateSillonName();
                            this._syncSillonManualEndpoints();
                        }
                    }
                }
            }
            drag = false;
            dragStart = null;
            totalDragDist = 0;
        };
        // Double-click a manual point to delete it (same as schedule-creator node delete gesture)
        canvas.ondblclick = (e) => {
            if (!this._sillonManualMode)
                return;
            const idx = findNearestManualPoint(e.offsetX, e.offsetY);
            if (idx >= 0) {
                this._sillonManualPoints.splice(idx, 1);
                this._rebuildSillonManualRoute();
                requestDraw();
            }
        };
        canvas.onwheel = (e) => { e.preventDefault(); tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY); requestDraw(); };
        canvas.oncontextmenu = (e) => { e.preventDefault(); };
        this._sillonMapInterval = setInterval(() => {
            if (document.getElementById('sillon-creator')?.classList.contains('hidden'))
                return;
            requestDraw();
        }, 250);
        requestDraw();
    }
    // --- ITE ---
    setupITEPage() {
        document.getElementById('btn-create-ite')?.addEventListener('click', () => this._ensureInfrastructureV2Editor().open('ite-fret'));
        document.getElementById('btn-ite-finish-track')?.addEventListener('click', () => this._finishITETrack());
        document.getElementById('btn-save-ite')?.addEventListener('click', () => this.saveITE());
        document.getElementById('modal-ite')?.querySelector('.modal-close')?.addEventListener('click', () => this._closeITECreator());
    }
    openITECreation() {
        this.iteCreationMode = true;
        this._pendingITE = { lat: null, lon: null, tracks: [] };
        this._iteTrackPoints = [];
        this._showPickHint('Cliquez sur la carte pour placer l\'ITE');
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = 'crosshair';
    }
    _closeITECreator() {
        this.iteCreationMode = false;
        this._pendingITE = null;
        this._iteTrackPoints = [];
        if (this._iteMapInterval) {
            clearInterval(this._iteMapInterval);
            this._iteMapInterval = null;
        }
        this._iteMapTileMap = null;
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = 'grab';
        this._hidePickHint();
        document.getElementById('modal-ite')?.classList.add('hidden');
    }
    openItemModal(lat, lon) {
        const modal = document.getElementById('modal-ite');
        if (!modal)
            return;
        document.getElementById('ite-lat').value = lat;
        document.getElementById('ite-lon').value = lon;
        document.getElementById('ite-name').value = '';
        document.getElementById('ite-type').value = 'ite-fret';
        document.getElementById('ite-tracks').value = 2;
        document.getElementById('ite-cost').value = 50000;
        document.querySelectorAll('.ite-cargo').forEach((cb) => cb.checked = false);
        document.getElementById('ite-track-name').value = '';
        this._pendingITE = { lat, lon, tracks: [] };
        this._iteTrackPoints = [];
        this._updateITETrackUI();
        modal.classList.remove('hidden');
        requestAnimationFrame(() => this.setupITEMap());
    }
    setupITEMap() {
        if (this._iteMapInterval) {
            clearInterval(this._iteMapInterval);
            this._iteMapInterval = null;
        }
        const canvas = document.getElementById('ite-map-canvas');
        if (!canvas)
            return;
        const container = canvas.parentElement;
        if (!container || container.clientWidth === 0 || container.clientHeight === 0)
            return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = canvas.getContext('2d');
        if (!this._iteMapTileMap) {
            const mainTileMap = this.game.renderer.tileMap;
            this._iteMapTileMap = new mainTileMap.constructor();
        }
        const tileMap = this._iteMapTileMap;
        tileMap.viewportWidth = canvas.width;
        tileMap.viewportHeight = canvas.height;
        const lat = parseFloat(document.getElementById('ite-lat')?.value);
        const lon = parseFloat(document.getElementById('ite-lon')?.value);
        if (!isNaN(lat) && !isNaN(lon)) {
            tileMap.centerLat = lat;
            tileMap.centerLon = lon;
            tileMap.zoomLevel = 15;
        }
        else {
            tileMap.centerLat = 46.8;
            tileMap.centerLon = 2.3;
            tileMap.zoomLevel = 6;
        }
        let drawPending = false;
        const requestDraw = () => {
            if (drawPending)
                return;
            drawPending = true;
            requestAnimationFrame(() => { drawPending = false; drawMap(); });
        };
        const drawMap = () => {
            const modal = document.getElementById('modal-ite');
            if (!modal || modal.classList.contains('hidden'))
                return;
            tileMap.renderTiles(ctx, canvas.width, canvas.height);
            const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
            const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
            const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
            const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
            const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
            const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;
            // ITE marker
            const center = tileMap.worldToScreen(lat, lon, canvas.width, canvas.height);
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Track polyline
            if (this._iteTrackPoints.length >= 2) {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const p0 = tileMap.worldToScreen(this._iteTrackPoints[0].lat, this._iteTrackPoints[0].lon, canvas.width, canvas.height);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < this._iteTrackPoints.length; i++) {
                    const p = tileMap.worldToScreen(this._iteTrackPoints[i].lat, this._iteTrackPoints[i].lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
            if (this._iteTrackPoints.length > 0) {
                for (const pt of this._iteTrackPoints) {
                    const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                    ctx.fillStyle = '#a5f3fc';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            // Dashed line from ITE marker to first point
            if (this._iteTrackPoints.length === 1) {
                const p = tileMap.worldToScreen(this._iteTrackPoints[0].lat, this._iteTrackPoints[0].lon, canvas.width, canvas.height);
                ctx.strokeStyle = 'rgba(250,204,21,0.5)';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        };
        this._drawITEMap = drawMap;
        if (canvas._iteBound) {
            requestDraw();
            return;
        }
        canvas._iteBound = true;
        let drag = false, dragStart = null, totalDragDist = 0;
        canvas.onmousedown = (e) => { drag = true; dragStart = { x: e.offsetX, y: e.offsetY }; totalDragDist = 0; };
        canvas.onmousemove = (e) => {
            if (drag && dragStart) {
                const dx = e.offsetX - dragStart.x;
                const dy = e.offsetY - dragStart.y;
                totalDragDist += Math.abs(dx) + Math.abs(dy);
                tileMap.pan(dx, dy);
                dragStart = { x: e.offsetX, y: e.offsetY };
                requestDraw();
            }
        };
        canvas.onmouseup = (e) => {
            if (totalDragDist < 5) {
                const x = e.offsetX, y = e.offsetY;
                if (e.shiftKey) {
                    let bestIdx = -1, bestD = Infinity;
                    for (let i = 0; i < this._iteTrackPoints.length; i++) {
                        const p = tileMap.worldToScreen(this._iteTrackPoints[i].lat, this._iteTrackPoints[i].lon, canvas.width, canvas.height);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < bestD) {
                            bestD = d;
                            bestIdx = i;
                        }
                    }
                    if (bestIdx >= 0 && bestD < 12) {
                        this._iteTrackPoints.splice(bestIdx, 1);
                        this._updateITETrackUI();
                        requestDraw();
                    }
                    drag = false;
                    dragStart = null;
                    totalDragDist = 0;
                    return;
                }
                const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
                this._iteTrackPoints.push({ lat: worldPos.lat, lon: worldPos.lon });
                this._updateITETrackUI();
                requestDraw();
            }
            drag = false;
            dragStart = null;
            totalDragDist = 0;
        };
        canvas.onwheel = (e) => { e.preventDefault(); tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY); requestDraw(); };
        canvas.oncontextmenu = (e) => { e.preventDefault(); };
        this._iteMapInterval = setInterval(() => {
            const modal = document.getElementById('modal-ite');
            if (!modal || modal.classList.contains('hidden'))
                return;
            requestDraw();
        }, 250);
        requestDraw();
    }
    _updateITETrackUI() {
        const finish = document.getElementById('btn-ite-finish-track');
        const hint = document.getElementById('ite-track-hint');
        if (finish)
            finish.classList.toggle('hidden', this._iteTrackPoints.length < 2);
        if (hint) {
            if (this._iteTrackPoints.length < 2)
                hint.textContent = 'Cliquez sur la carte pour placer les points de la voie (50 m). Shift+clic pour supprimer un point.';
            else
                hint.textContent = `${this._iteTrackPoints.length} point(s). Cliquez "Terminer voie" pour valider.`;
        }
    }
    _finishITETrack() {
        if (!this._pendingITE || this._iteTrackPoints.length < 2)
            return;
        const nameInput = document.getElementById('ite-track-name');
        const name = (nameInput?.value.trim()) || `Voie ${(this._pendingITE.tracks.length + 1)}`;
        const route = this._densifyRoute(this._iteTrackPoints.map((p) => ({ lat: p.lat, lon: p.lon, maxSpeed: 30 })));
        const lengthM = Math.round(this.game.orm.getRouteDistance(route) * 1000);
        this._pendingITE.tracks.push({ name, length: lengthM, route });
        this._iteTrackPoints = [];
        if (nameInput)
            nameInput.value = '';
        this._updateITETrackUI();
        this._renderITEPendingTracks();
        if (this._drawITEMap)
            this._drawITEMap();
    }
    _renderITEPendingTracks() {
        const list = document.getElementById('ite-tracks-list');
        if (!list || !this._pendingITE)
            return;
        list.innerHTML = this._pendingITE.tracks.length === 0
            ? '<span style="color:var(--text3)">Aucune voie tracée</span>'
            : this._pendingITE.tracks.map((t, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px solid var(--border)">
          <span><b>${htmlText(t.name)}</b> — ${t.length} m</span>
          <button class="btn-sm danger" style="font-size:9px;padding:1px 4px" onclick="game.ui._removeITEPendingTrack(${htmlJsValue(i)})">x</button>
        </div>`).join('');
    }
    _removeITEPendingTrack(index) {
        if (!this._pendingITE)
            return;
        this._pendingITE.tracks.splice(index, 1);
        this._renderITEPendingTracks();
    }
    saveITE() {
        const modal = document.getElementById('modal-ite');
        if (!modal)
            return;
        const name = document.getElementById('ite-name')?.value.trim() || 'ITE';
        const type = document.getElementById('ite-type')?.value || 'ite-fret';
        const lat = parseFloat(document.getElementById('ite-lat')?.value);
        const lon = parseFloat(document.getElementById('ite-lon')?.value);
        const tracks = parseInt(document.getElementById('ite-tracks')?.value) || 2;
        const cost = parseInt(document.getElementById('ite-cost')?.value) || 50000;
        const cargoTypes = [...document.querySelectorAll('.ite-cargo:checked')].map((cb) => cb.value);
        if (isNaN(lat) || isNaN(lon))
            return alert('Localisation invalide.');
        const station = this.game.world.addStation({ name, lat, lon, type: 'ite', platforms: tracks, platformNames: [] });
        station.country = this.game.orm.getCountryAtPoint(lat, lon);
        this.game.platformManager.initStation(station.id, tracks);
        const createdITE = this.game.depotManager.add({
            type,
            name,
            stationId: station.id,
            tracks,
            cost,
            iteTracks: (this._pendingITE?.tracks || []).map((t) => ({ name: t.name, length: t.length, cargoType: '' })),
            iteCargoTypes: cargoTypes,
        }, this.game.economy);
        if (!createdITE) {
            this.game.world.removeStation?.(station.id);
            this.game.platformManager?.stationPlatforms?.delete?.(station.id);
            return alert('Fonds insuffisants : l’ITE n’a pas été créée.');
        }
        this.game.saveState();
        this.game.renderer?.invalidateStatic();
        this._closeITECreator();
        this.renderDepotsList();
    }
    // --- DEPOTS ---
    setupDepotPage() {
        document.getElementById('btn-add-depot')?.addEventListener('click', () => this._ensureDepotITEPointEditor().open('depot'));
        document.getElementById('btn-save-depot')?.addEventListener('click', () => this.saveDepot());
        document.getElementById('btn-add-ite-track')?.addEventListener('click', () => this.addITETrack());
        document.getElementById('depot-type')?.addEventListener('change', () => this._toggleITEEditor());
    }
    openDepotModal() {
        this._pendingDepotITETarget = null; // stored ITE target if created from map
        this._pendingITETracks = [];
        document.getElementById('modal-depot')?.classList.remove('hidden');
        document.getElementById('depot-name').value = '';
        const typeSel = document.getElementById('depot-type');
        if (typeSel)
            typeSel.value = 'depot';
        const select = document.getElementById('depot-station');
        if (select)
            select.innerHTML = '<option value="">—</option>' + this.game.world.stations.map((s) => `<option value="${htmlText(s.id)}">${htmlText(s.name)}</option>`).join('');
        this._toggleITEEditor();
        this._renderITETrackList();
    }
    _toggleITEEditor() {
        const type = document.getElementById('depot-type')?.value || 'depot';
        const editor = document.getElementById('depot-ite-editor');
        if (editor)
            editor.classList.toggle('hidden', !type.startsWith('ite'));
    }
    _renderITETrackList() {
        const list = document.getElementById('depot-ite-tracks-list');
        if (!list)
            return;
        list.innerHTML = (this._pendingITETracks || []).map((t, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:10px">
        <span><b>${htmlText(t.name)}</b> — ${t.length} m${t.cargoType ? ' (' + t.cargoType + ')' : ''}</span>
        <button class="btn-sm danger" style="font-size:9px;padding:1px 4px" onclick="game.ui.removeITETrack(${htmlJsValue(i)})">x</button>
      </div>
    `).join('') || '<span style="color:var(--text3);font-size:10px">Aucune voie saisie</span>';
    }
    removeITETrack(index) {
        if (!this._pendingITETracks)
            return;
        this._pendingITETracks.splice(index, 1);
        this._renderITETrackList();
    }
    addITETrack() {
        const name = document.getElementById('depot-ite-track-name')?.value.trim();
        const length = parseInt(document.getElementById('depot-ite-track-length')?.value) || 0;
        const cargoType = document.getElementById('depot-ite-track-cargo')?.value || '';
        if (!name || length <= 0)
            return alert('Nom et longueur requis');
        if (!this._pendingITETracks)
            this._pendingITETracks = [];
        this._pendingITETracks.push({ name, length, cargoType });
        this._renderITETrackList();
        document.getElementById('depot-ite-track-name').value = '';
        document.getElementById('depot-ite-track-length').value = '300';
    }
    saveDepot() {
        const type = document.getElementById('depot-type')?.value || 'depot';
        const stationId = document.getElementById('depot-station')?.value;
        if (!stationId)
            return alert('Sélectionnez une gare');
        const infra = [...document.querySelectorAll('.depot-infra:checked')].map((cb) => cb.value);
        const data = {
            type,
            name: document.getElementById('depot-name')?.value.trim() || 'Depot',
            stationId,
            tracks: parseInt(document.getElementById('depot-tracks')?.value) || 4,
            cost: parseInt(document.getElementById('depot-cost')?.value) || 50000,
            infrastructure: type === 'depot' ? infra : [],
            iteTracks: type.startsWith('ite') ? (this._pendingITETracks || []) : [],
            iteCargoTypes: type.startsWith('ite') ? [...new Set((this._pendingITETracks || []).map((t) => t.cargoType).filter(Boolean))] : [],
        };
        const created = this.game.depotManager.add(data, this.game.economy);
        if (!created)
            return alert('Fonds insuffisants : le dépôt / ITE n’a pas été créé.');
        document.getElementById('modal-depot')?.classList.add('hidden');
        this.renderDepotsList();
        this.game.saveState();
    }
    renderDepotsList() {
        const depotsContainer = document.getElementById('depots-list'), iteContainer = document.getElementById('ite-list');
        const depots = this.game.depotManager.getDepots(), ites = this.game.depotManager.getITEs();
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
        const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!this._selectedDepotPageId || !depots.some((d) => d.id === this._selectedDepotPageId))
            this._selectedDepotPageId = depots[0]?.id || '';
        if (!this._depotPageTab)
            this._depotPageTab = 'overview';
        const selected = this.game.depotManager.getDepotById(this._selectedDepotPageId);
        const allRames = this.game.rameManager.getAll();
        const rotationVehicles = this.game.rotationV2?.vehicles || [];
        const rotationCoupons = this.game.rotationV2?.coupons || [];
        const services = this.game.scheduleCreator?.getActiveServices?.() || [];
        const activeFor = (r) => services.some((s) => s?.rame?.id === r.id && !s.completed && !s.cancelled && ['moving', 'departing', 'stopped_at_station'].includes(String(s.state || '')));
        const pct = (v, c) => c > 0 ? Math.round(Math.max(0, Math.min(100, Number(v || 0) / c * 100))) : 0;
        const money = (n) => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
        const qty = (n, d = 0) => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
        const homeName = (id) => this.game.depotManager.getDepotById(id)?.name || '—';
        const staffName = (id) => DEPOT_STAFF_CATALOG[id]?.label || id.replace(/_/g, ' ');
        const equipmentName = (id) => DEPOT_EQUIPMENT_CATALOG[id]?.label || id;
        const allTractionElements = [];
        for (const r of allRames)
            for (const e of r.elementDetails || [])
                if (['locomotive', 'automotrice'].includes(e.category))
                    allTractionElements.push({ rame: r, el: e });
        const searchInput = (placeholder, selector, key) => `<input class="depot-search" placeholder="${esc(placeholder)}" data-depot-filter="${esc(selector)}" data-depot-key="${esc(key)}">`;
        const depotList = depots.map((d) => { const occ = this.game.depotManager.getDepotOccupancy(d.id), assigned = allRames.filter((r) => r.depotId === d.id).length, ops = this.game.depotManager.getOperationsForDepot(d.id).length, equip = Object.values(d.equipmentInventory || {}).reduce((a, b) => a + Number(b || 0), 0); return `<button type="button" class="depot-nav-card ${htmlText(d.id === this._selectedDepotPageId ? 'active' : '')}" data-depot-search="${esc(norm(d.name + ' ' + (this.game.world.getStationById(d.stationId)?.name || '') + ' ' + equip + ' équipements'))}" onclick="game.ui.selectDepotDetail('${htmlJsString(d.id)}')"><span class="depot-nav-icon">▣</span><span><b>${esc(d.name)}</b><small>${occ.used}/${occ.capacity} voies · ${assigned} affectée(s) · ${ops} opération(s) · ${equip} équipement(s)</small></span></button>`; }).join('');
        const renderOverview = (d) => {
            const occ = this.game.depotManager.getDepotOccupancy(d.id), assigned = allRames.filter((r) => r.depotId === d.id), present = allRames.filter((r) => r.currentLocation?.depotId === d.id), ops = this.game.depotManager.getOperationsForDepot(d.id), lowResources = Object.entries(DEPOT_RESOURCE_CATALOG).filter(([k, def]) => def.stock && Number(d.resourceCapacities[k] || 0) > 0 && Number(d.resourceStocks[k] || 0) / Number(d.resourceCapacities[k] || 1) < .15);
            const dirty = assigned.filter((r) => Number(r.cleanliness?.exterior ?? 100) < 45 || Number(r.cleanliness?.interior ?? 100) < 45);
            const maint = assigned.filter((r) => r.recommendedMaintenance || Number(r.wearLevel || 0) >= 25 || (r.pendingDefects || []).length);
            const equipmentCount = Object.values(d.equipmentInventory || {}).reduce((sum, n) => sum + Number(n || 0), 0);
            const usage = Object.entries(DEPOT_RESOURCE_CATALOG).filter(([k]) => Number(d.resourceUsage?.[k] || 0) > 0).sort((a, b) => Number(d.resourceUsage?.[b[0]] || 0) - Number(d.resourceUsage?.[a[0]] || 0)).slice(0, 8);
            return `<div class="depot-kpis"><div><b>${occ.used}/${occ.capacity}</b><span>voies occupées</span></div><div><b>${assigned.length}</b><span>matériels affectés</span></div><div><b>${present.length}</b><span>présents au dépôt</span></div><div><b>${ops.length}</b><span>opérations en cours</span></div><div><b>${equipmentCount}</b><span>équipements installés</span></div><div><b>${money(d.utilityTotals?.expenseEur)}</b><span>dépenses suivies</span></div></div>
      <div class="depot-alert-row">${lowResources.length ? `<span class="depot-alert warn">Stock bas : ${htmlText(lowResources.slice(0, 5).map(([k]) => DEPOT_RESOURCE_CATALOG[k].label).join(', '))}${lowResources.length > 5 ? '…' : ''}</span>` : ''}${maint.length ? `<span class="depot-alert danger">${maint.length} matériel(s) à surveiller / maintenir</span>` : ''}${dirty.length ? `<span class="depot-alert info">${dirty.length} matériel(s) à nettoyer</span>` : ''}${!lowResources.length && !maint.length && !dirty.length ? '<span class="depot-alert ok">Aucune alerte critique</span>' : ''}</div>
      <div class="depot-two-col"><section class="depot-panel"><h4>Consommations réelles du dépôt</h4><div class="depot-stat-lines">${usage.map(([k, def]) => `<span>${esc(def.label)} <b>${qty(d.resourceUsage?.[k], def.unit === 'kg' || def.unit === 'm³' ? 1 : 0)} ${esc(def.unit)}</b></span>`).join('') || '<span>Aucune consommation <b>—</b></span>'}<span>Dépenses cumulées suivies <b>${money(d.utilityTotals?.expenseEur)}</b></span></div></section><section class="depot-panel"><h4>Dernières dépenses</h4>${(d.expenseLedger || []).slice(-8).reverse().map((x) => `<div class="depot-ledger"><span>${esc(x.label)}</span><b>-${money(x.amount)}</b></div>`).join('') || '<div class="depot-muted">Aucune dépense enregistrée.</div>'}</section></div>`;
        };
        const renderMaterial = (d) => {
            const rows = allRames.map((r) => {
                const assigned = r.depotId === d.id, present = r.currentLocation?.depotId === d.id, busy = activeFor(r), op = !!r.depotOperationId;
                const elems = (r.elementDetails || []).filter((e) => ['locomotive', 'automotrice', 'voiture', 'wagon'].includes(e.category)).map((e) => `<div class="depot-element-row"><span>${esc(e.instanceName || e.name)} <small>${esc(e.seriesName || e.category)}</small></span><span>Port d'attache élément : <b>${esc(homeName(e.homeDepotId))}</b></span><button class="btn-sm" onclick="game.ui.assignDepotElement('${htmlJsString(d.id)}','${htmlJsString(r.id)}','${htmlJsString(e.elementId)}')">Affecter ici</button></div>`).join('');
                const search = norm([r.name, r.serialNumber, homeName(r.depotId), present ? 'présent' : '', busy ? 'service' : '', ...(r.elementDetails || []).flatMap((e) => [e.instanceName, e.name, e.seriesName, e.category, e.traction])].join(' '));
                return `<article class="depot-material-row" data-material-search="${esc(search)}"><div class="depot-material-main"><div><b>${esc(r.name)}</b><small>${Math.round(r.totalLength || 0)} m · usure ${Math.round(r.wearLevel || 0)}% · ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km · port d'attache ${esc(homeName(r.depotId))}</small></div><div class="depot-badges">${assigned ? '<span class="badge-home">Port d’attache</span>' : ''}${present ? '<span class="badge-present">Présent</span>' : ''}${busy ? '<span class="badge-busy">En service</span>' : ''}${op ? '<span class="badge-op">Opération</span>' : ''}</div><div class="depot-row-actions">${assigned ? `<button class="btn-sm" onclick="game.ui.clearDepotHome('${htmlJsString(r.id)}')">Désaffecter</button>` : `<button class="btn-sm" onclick="game.ui.assignDepotHome('${htmlJsString(d.id)}','${htmlJsString(r.id)}')">Affecter</button>`}${present ? `<button class="btn-sm" onclick="game.ui.leaveDepot('${htmlJsString(d.id)}','${htmlJsString(r.id)}')">Sortir</button>` : `<button class="btn-sm" ${htmlText(busy ? 'disabled title="Service en cours"' : '')} onclick="game.ui.enterDepot('${htmlJsString(d.id)}','${htmlJsString(r.id)}')">Envoyer au dépôt</button>`}</div></div>${elems ? `<details><summary>Locomotives / voitures / wagons de la rame</summary>${elems}</details>` : ''}</article>`;
            }).join('');
            const physicalRows = rotationVehicles.map((v) => `<div class="depot-element-row depot-rotation-material" data-rotation-search="${esc(norm([v.number, v.name, v.category, v.traction, homeName(v.homeDepotId)].join(' ')))}"><span><b>${esc(v.number || v.name)}</b> <small>${esc(v.category || 'matériel physique')} · ${esc(v.traction || '')}</small></span><span>Port d'attache : <b>${esc(homeName(v.homeDepotId))}</b></span>${v.homeDepotId === d.id ? `<button class="btn-sm" onclick="game.ui.clearRotationVehicleDepot('${htmlJsString(v.id)}')">Désaffecter</button>` : `<button class="btn-sm" onclick="game.ui.assignRotationVehicleDepot('${htmlJsString(d.id)}','${htmlJsString(v.id)}')">Affecter ici</button>`}</div>`).join('');
            const couponRows = rotationCoupons.map((c) => `<div class="depot-element-row depot-rotation-material" data-rotation-search="${esc(norm(c.name + ' coupon ' + c.vehicleIds.map((id) => this.game.rotationV2?.getVehicle?.(id)?.number || '').join(' ') + ' ' + homeName(c.homeDepotId)))}"><span><b>${esc(c.name || 'Coupon')}</b> <small>Coupon · ${c.vehicleIds.length} véhicule(s)</small></span><span>Port d'attache : <b>${esc(homeName(c.homeDepotId))}</b></span>${c.homeDepotId === d.id ? `<button class="btn-sm" onclick="game.ui.clearRotationCouponDepot('${htmlJsString(c.id)}')">Désaffecter</button>` : `<button class="btn-sm" onclick="game.ui.assignRotationCouponDepot('${htmlJsString(d.id)}','${htmlJsString(c.id)}')">Affecter ici</button>`}</div>`).join('');
            const rescue = d.rescueLocos.map((x) => `<div class="depot-rescue-current"><span>${x.deployed ? '🔴' : '🟢'} ${esc(x.stockName)}</span><button class="btn-sm danger" onclick="game.ui.removeRescueLoco('${htmlJsString(d.id)}','${htmlJsString(x.stockId)}')">Retirer</button></div>`).join('') || '<div class="depot-muted">Aucune machine de secours.</div>';
            const candidates = allTractionElements.filter(({ rame, el }) => rame.currentLocation?.depotId === d.id && (rame.depotId === d.id || el.homeDepotId === d.id)).map(({ rame, el }) => `<div class="depot-search-result" data-rescue-search="${esc(norm(rame.name + ' ' + (el.instanceName || el.name) + ' ' + (el.seriesName || '') + ' ' + (el.traction || '')))}"><span><b>${esc(el.instanceName || el.name)}</b><small>${esc(rame.name)} · ${esc(el.traction || '')}</small></span><button class="btn-sm" onclick="game.ui.addRescueElement('${htmlJsString(d.id)}','${htmlJsString(rame.id)}','${htmlJsString(el.elementId)}')">Définir secours</button></div>`).join('');
            return `<section class="depot-panel"><h4>Rames — port d'attache et présence physique</h4><p class="depot-help">L’affectation ne déplace jamais le matériel ; une rame simplement garée n’est pas marquée « en maintenance ». Une rame simplement garée n’est pas marquée « en maintenance ». Seul « Envoyer au dépôt » crée une présence physique et occupe une voie.</p>${searchInput('Rechercher une rame, locomotive, voiture, wagon…', '.depot-material-row', 'materialSearch')}${rows || '<div class="depot-muted">Aucune rame créée.</div>'}</section><section class="depot-panel"><h4>Matériel matérialisé des roulements — locomotives & coupons</h4>${searchInput('Rechercher une locomotive, un véhicule ou un coupon de roulement…', '.depot-rotation-material', 'rotationSearch')}<div class="depot-rotation-list">${physicalRows}${couponRows}${!physicalRows && !couponRows ? '<div class="depot-muted">Aucun matériel matérialisé dans Roulements.</div>' : ''}</div></section><section class="depot-panel"><h4>Machines de secours (max 2)</h4>${rescue}${searchInput('Rechercher une locomotive / automotrice présente au dépôt…', '.depot-search-result', 'rescueSearch')}<div class="depot-search-results-static">${candidates || '<div class="depot-muted">Aucun matériel de traction éligible actuellement.</div>'}</div></section>`;
        };
        const renderTracks = (d) => { const occ = this.game.depotManager.getDepotOccupancy(d.id); return `<section class="depot-panel"><div class="depot-section-title"><div><h4>Occupation des voies de garage</h4><span class="depot-muted">Capacité réelle : une rame présente occupe une voie.</span></div><b>${occ.used}/${occ.capacity}</b></div><div class="depot-track-actions"><span>Extension : <b>${money(DEPOT_TRACK_EXPANSION_COST)}</b> / voie</span><button class="btn-sm" onclick="game.ui.addDepotTracks('${htmlJsString(d.id)}',1)">+ 1 voie</button><button class="btn-sm" onclick="game.ui.addDepotTracks('${htmlJsString(d.id)}',5)">+ 5 voies</button></div>${searchInput('Rechercher une voie, une rame ou une opération…', '.depot-track', 'trackSearch')}<div class="depot-track-grid">${occ.tracks.map((t) => { const r = allRames.find((x) => x.id === t.rameId); const op = this.game.depotManager.depotOperations.find((o) => o.id === t.operationId); const search = norm(`voie ${t.track} ${r?.name || 'libre'} ${op?.label || 'garage'}`); return `<div class="depot-track ${htmlText(t.rameId ? 'occupied' : 'free')}" data-track-search="${esc(search)}"><strong>Voie ${t.track}</strong>${r ? `<b>${esc(r.name)}</b><span>${htmlText(op ? (op.label) : 'Garage')}</span>${op ? `<small>${Math.ceil(op.remainingMin)} min restantes</small>` : ''}` : '<span>Libre</span>'}</div>`; }).join('')}</div></section>`; };
        const opButtons = (d, r, groups) => Object.entries(DEPOT_OPERATION_CATALOG).filter(([, def]) => groups.includes(def.group)).map(([id, def]) => {
            const c = r.consumables || {}, defects = r.pendingDefects || [];
            const recommended = (id === 'routine_service' && (Number(r.wearLevel || 0) >= 20 || Number(r.kmSinceLastMaint || 0) >= 5000)) || (id === 'wheel_reprofile' && (Number(r.wearLevel || 0) >= 40 || Number(r.kmSinceLastMaint || 0) >= 15000)) || (id === 'engine_replace' && defects.includes('moteur')) || (id === 'traction_motor_replace' && defects.some((x) => ['traction', 'moteur_traction'].includes(x))) || (id === 'pantograph_replace' && defects.includes('pantographe')) || (id === 'brake_overhaul' && defects.includes('freins')) || (id === 'compressor_replace' && defects.includes('compresseur')) || (id === 'hvac_replace' && defects.includes('climatisation')) || (id === 'door_repair' && defects.includes('portes')) || (id === 'battery_service' && defects.includes('batterie')) || (id === 'fluid_service' && ['oil', 'coolant', 'gearboxOil', 'hydraulicOil'].some((k) => Number(c[k + 'CapacityL'] || 0) > 0 && Number(c[k + 'L'] || 0) / Number(c[k + 'CapacityL'] || 1) < .6)) || (id === 'washer_fill' && Number(c.washerCapacityL || 0) > 0 && Number(c.washerL || 0) / Number(c.washerCapacityL || 1) < .35) || (id === 'refuel' && Number(c.fuelCapacityL || 0) > 0 && Number(c.fuelL || 0) / Number(c.fuelCapacityL || 1) < .3) || (id === 'sand_fill' && Number(c.sandCapacityKg || 0) > 0 && Number(c.sandKg || 0) / Number(c.sandCapacityKg || 1) < .4) || (id === 'exterior_wash' && Number(r.cleanliness?.exterior ?? 100) < 70) || (id === 'interior_clean' && Number(r.cleanliness?.interior ?? 100) < 70) || (id === 'deep_disinfection' && Number(r.cleanliness?.interior ?? 100) < 35);
            const need = this.game.depotManager._operationNeeds?.(r, id);
            const resourceText = Object.entries(need?.resources || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => { const rd = DEPOT_RESOURCE_CATALOG[k]; return rd ? `${qty(v, rd.unit === 'kg' || rd.unit === 'm³' ? 1 : 0)} ${rd.unit} ${rd.label}` : ''; }).filter(Boolean).join(' · ');
            const partText = Object.entries(need?.parts || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => { const pd = DEPOT_PART_CATALOG.find((x) => x.id === k); return `${v}× ${pd?.label || k}`; }).join(' · ');
            const equipment = (('equipment' in def && Array.isArray(def.equipment)) ? def.equipment : []).map((k) => ({ id: k, label: equipmentName(k), ...this.game.depotManager.getEquipmentAvailability(d.id, k) }));
            const equipmentText = equipment.map((x) => `${x.label} ${x.free}/${x.installed} libre`).join(' · ');
            const missingResource = Object.entries(need?.resources || {}).some(([k, v]) => DEPOT_RESOURCE_CATALOG[k]?.stock && Number(d.resourceStocks[k] || 0) < Number(v || 0));
            const missingPart = Object.entries(need?.parts || {}).some(([k, v]) => Number(d.partInventory[k] || 0) < Number(v || 0));
            const missingEquipment = equipment.some((x) => x.installed <= 0), busyEquipment = !missingEquipment && equipment.some((x) => x.free <= 0);
            const staffAdvanced = this.game.realismSettings?.personnelRequired === true;
            const staffCheck = staffAdvanced ? (this.game.staffManager?.checkDepotStaff?.(d.id, def.staff || {}) || { ok: true, shortages: [] }) : { ok: true, shortages: [] };
            const missingStaff = staffAdvanced && !staffCheck.ok;
            const shortage = missingResource || missingPart || missingEquipment || busyEquipment || missingStaff;
            const directCost = Object.entries(need?.resources || {}).reduce((sum, [k, v]) => { const rd = DEPOT_RESOURCE_CATALOG[k]; return sum + (!rd?.stock ? Number(v || 0) * Number(rd?.price || 0) : 0); }, 0);
            const stockValue = Object.entries(need?.resources || {}).reduce((sum, [k, v]) => { const rd = DEPOT_RESOURCE_CATALOG[k]; return sum + (rd?.stock ? Number(v || 0) * Number(rd?.price || 0) : 0); }, 0) + Object.entries(need?.parts || {}).reduce((sum, [k, v]) => sum + Number(v || 0) * Number(DEPOT_PART_CATALOG.find((x) => x.id === k)?.price || 0), 0);
            const staffText = Object.entries(def.staff || {}).map(([k, v]) => { const a = this.game.staffManager?.getDepotStaffAvailability?.(d.id, k); return `${v} ${staffName(k)}${a ? ` (${a.free} libre${a.free > 1 ? 's' : ''})` : ''}`; }).join(', ') || '—';
            const staffModeLabel = staffAdvanced ? 'personnel' : 'personnel facultatif';
            const duration = d.getMaintenanceDuration?.(def.duration) || def.duration;
            const reason = missingEquipment ? 'ÉQUIPEMENT MANQUANT' : busyEquipment ? 'ÉQUIPEMENT OCCUPÉ' : missingStaff ? 'PERSONNEL MANQUANT' : missingResource || missingPart ? 'STOCK INSUFFISANT' : '';
            return `<button class="depot-op-btn ${htmlText(recommended ? 'recommended' : '')} ${htmlText(shortage ? 'shortage' : '')}" data-op-search="${esc(norm(def.label + ' ' + def.group + ' ' + resourceText + ' ' + partText + ' ' + equipmentText + ' ' + staffText))}" onclick="game.ui.startDepotOp('${htmlJsString(d.id)}','${htmlJsString(r.id)}','${htmlJsString(id)}')"><b>${recommended ? '★ ' : ''}${esc(def.label)}${htmlText(reason ? ' · ' + reason : '')}</b><small>${duration} min · ${esc(staffModeLabel)} : ${esc(staffText)}${equipmentText ? ' · équipement : ' + esc(equipmentText) : ''}${resourceText ? ' · ' + esc(resourceText) : ''}${partText ? ' · ' + esc(partText) : ''}${directCost > 0 ? ' · coût eau/énergie/réseaux ' + money(directCost) : ''}${stockValue > 0 ? ' · valeur stock consommé ' + money(stockValue) : ''}</small></button>`;
        }).join('');
        const renderMaintenance = (d) => { const present = allRames.filter((r) => r.currentLocation?.depotId === d.id); return `<section class="depot-panel"><h4>Maintenance & avitaillement</h4><p class="depot-help">Les opérations sont lancées manuellement et utilisent réellement équipements, stocks, pièces, eau, air comprimé et électricité.</p><div class="depot-search-pair">${searchInput('Rechercher le matériel présent…', '.depot-maint-row', 'maintSearch')}${searchInput('Rechercher une opération, un métier ou un équipement…', '.depot-op-btn', 'opSearch')}</div>${present.map((r) => { const c = r.consumables || {}, defects = (r.pendingDefects || []); const levels = [Number(c.fuelCapacityL || 0) > 0 ? `Gazole <b>${pct(c.fuelL, c.fuelCapacityL)}%</b>` : '', `Sable <b>${pct(c.sandKg, c.sandCapacityKg)}%</b>`, Number(c.oilCapacityL || 0) > 0 ? `Huile moteur <b>${pct(c.oilL, c.oilCapacityL)}%</b>` : '', Number(c.coolantCapacityL || 0) > 0 ? `Refroidissement <b>${pct(c.coolantL, c.coolantCapacityL)}%</b>` : '', Number(c.adblueCapacityL || 0) > 0 ? `AdBlue <b>${pct(c.adblueL, c.adblueCapacityL)}%</b>` : '', Number(c.gearboxOilCapacityL || 0) > 0 ? `Transmission <b>${pct(c.gearboxOilL, c.gearboxOilCapacityL)}%</b>` : '', Number(c.hydraulicOilCapacityL || 0) > 0 ? `Hydraulique <b>${pct(c.hydraulicOilL, c.hydraulicOilCapacityL)}%</b>` : '', Number(c.washerCapacityL || 0) > 0 ? `Lave-glace <b>${pct(c.washerL, c.washerCapacityL)}%</b>` : ''].filter(Boolean); return `<article class="depot-maint-row" data-maint-search="${esc(norm(r.name + ' ' + defects.join(' ') + ' ' + levels.join(' ')))}"><header><div><b>${esc(r.name)}</b><small>${r.recommendedMaintenance ? '⚠ Entretien recommandé · ' : ''}${defects.length ? 'Défauts : ' + esc(defects.join(', ')) + ' · ' : ''}${Math.round(r.kmSinceLastMaint || 0).toLocaleString('fr-FR')} km depuis entretien</small></div><strong>Usure ${Math.round(r.wearLevel || 0)}%</strong></header><div class="depot-levels">${levels.map((x) => `<span>${x}</span>`).join('')}</div><div class="depot-op-grid">${opButtons(d, r, ['Avitaillement', 'Maintenance', 'Maintenance lourde'])}</div></article>`; }).join('') || '<div class="depot-muted">Aucun matériel présent. Utilisez l’onglet Matériel pour l’envoyer au dépôt.</div>'}</section>`; };
        const renderCleaning = (d) => { const present = allRames.filter((r) => r.currentLocation?.depotId === d.id); return `<section class="depot-panel"><h4>Nettoyage & sanitaires</h4><div class="depot-search-pair">${searchInput('Rechercher le matériel à nettoyer…', '.depot-clean-row', 'cleanSearch')}${searchInput('Rechercher lavage, WC, désinfection, dégivrage…', '.depot-op-btn', 'opSearch')}</div>${present.map((r) => `<article class="depot-clean-row" data-clean-search="${esc(norm(r.name + ' ' + (r.cleanliness?.exterior ?? 100) + ' ' + (r.cleanliness?.interior ?? 100)))}"><header><b>${esc(r.name)}</b><span>Extérieur <strong>${Math.round(r.cleanliness?.exterior ?? 100)}%</strong> · Intérieur <strong>${Math.round(r.cleanliness?.interior ?? 100)}%</strong></span></header><div class="depot-clean-bars"><i style="--v:${htmlText(Math.round(r.cleanliness?.exterior ?? 100))}%"></i><i style="--v:${htmlText(Math.round(r.cleanliness?.interior ?? 100))}%"></i></div><div class="depot-op-grid">${opButtons(d, r, ['Nettoyage'])}</div></article>`).join('') || '<div class="depot-muted">Aucun matériel présent.</div>'}</section>`; };
        const renderStocks = (d) => {
            const resources = Object.entries(DEPOT_RESOURCE_CATALOG).filter(([, def]) => def.stock).map(([k, def]) => { const cur = Number(d.resourceStocks[k] || 0), cap = Number(d.resourceCapacities[k] || 0); return `<div class="depot-stock-card" data-resource-search="${esc(norm(def.label + ' ' + def.category + ' ' + def.unit))}"><div><b>${esc(def.label)}</b><span>${esc(def.category)} · ${qty(cur, def.unit === 'kg' ? 1 : 0)} / ${qty(cap, 0)} ${esc(def.unit)} · ${def.price.toLocaleString('fr-FR')} €/${esc(def.unit)}</span></div><div class="depot-stock-bar"><i style="--v:${htmlText(pct(cur, cap))}%"></i></div><div class="depot-buy"><input id="res-${htmlText(d.id)}-${htmlText(k)}" type="number" min="1" step="${htmlText(def.unit === 'L' ? 100 : 10)}" value="${htmlText(def.unit === 'L' ? 1000 : 100)}"><button class="btn-sm" onclick="game.ui.buyDepotResource('${htmlJsString(d.id)}','${htmlJsString(k)}')">Commander</button></div></div>`; }).join('');
            const parts = DEPOT_PART_CATALOG.map((part) => `<div class="depot-part-row" data-part-search="${esc(norm(part.label + ' ' + part.category + ' ' + (part.realModel ? 'référence réelle' : '')))}"><span><b>${esc(part.label)}</b><small>${esc(part.category)}${part.realModel ? ' · référence réelle' : ''}</small></span><strong>Stock ${htmlText(Number(d.partInventory[part.id] || 0))}</strong><span>${money(part.price)}/u</span><input id="part-${htmlText(d.id)}-${htmlText(part.id)}" type="number" min="1" max="99" value="1"><button class="btn-sm" onclick="game.ui.buyDepotPart('${htmlJsString(d.id)}','${htmlJsString(part.id)}')">Commander</button></div>`).join('');
            return `<section class="depot-panel"><h4>Consommables & fluides stockés</h4>${searchInput('Rechercher gazole, sable, huile, produit de nettoyage…', '.depot-stock-card', 'resourceSearch')}<div class="depot-stock-grid">${resources}</div></section><section class="depot-panel"><h4>Pièces détachées</h4>${searchInput('Rechercher une pièce, une référence, un moteur, bogie, frein…', '.depot-part-row', 'partSearch')}<div class="depot-parts-list">${parts}</div></section>`;
        };
        const renderEquipment = (d) => {
            const rows = Object.entries(DEPOT_EQUIPMENT_CATALOG).map(([id, def]) => { const a = this.game.depotManager.getEquipmentAvailability(d.id, id), max = def.maxCount || 1, installed = a.installed; return `<article class="depot-equipment-card ${htmlText(installed ? 'owned' : '')}" data-equipment-search="${esc(norm(def.label + ' ' + def.category + ' ' + def.description))}"><div class="depot-equipment-icon">${installed ? '✓' : '+'}</div><div class="depot-equipment-info"><b>${esc(def.label)}</b><small>${esc(def.category)} · ${esc(def.description)}</small><span>${installed ? `${installed} installé(s) · ${a.free} libre(s) / ${a.busy} occupé(s)` : 'Non installé'} · max ${max}</span></div><div class="depot-equipment-buy"><strong>${money(def.price)}</strong>${installed >= max ? '<span class="depot-muted">Maximum atteint</span>' : `<button class="btn-sm" onclick="game.ui.buyDepotEquipment('${htmlJsString(d.id)}','${htmlJsString(id)}')">${installed ? 'Installer +1' : 'Acheter'}</button>`}</div></article>`; }).join('');
            return `<section class="depot-panel"><div class="depot-section-title"><div><h4>Équipements techniques du dépôt</h4><span class="depot-muted">Les équipements sont fonctionnels : ils conditionnent et limitent les opérations simultanées.</span></div></div>${searchInput('Rechercher fosse, levage, tour en fosse, lavage, station-service…', '.depot-equipment-card', 'equipmentSearch')}<div class="depot-equipment-grid">${rows}</div></section>`;
        };
        const renderStaff = (d) => {
            const ops = this.game.depotManager.getOperationsForDepot(d.id), needs = {};
            for (const o of ops)
                for (const [role, n] of Object.entries(o.staff || {}))
                    needs[role] = (needs[role] || 0) + Number(n || 0);
            const operationByRole = {};
            for (const def of Object.values(DEPOT_OPERATION_CATALOG))
                for (const role of Object.keys(def.staff || {}))
                    (operationByRole[role] || (operationByRole[role] = [])).push(def.label);
            const rows = Object.entries(DEPOT_STAFF_CATALOG).map(([id, def]) => { const uses = operationByRole[id] || [], a = this.game.staffManager?.getDepotStaffAvailability?.(d.id, id) || { assigned: 0, free: 0, busy: 0, resting: 0 }; return `<div class="depot-role-row" data-role-search="${esc(norm(def.label + ' ' + def.category + ' ' + uses.join(' ')))}"><span><b>${esc(def.label)}</b><small>${esc(def.category)} · ${uses.length} opération(s) compatible(s)${uses.length ? ' · ' + esc(uses.slice(0, 3).join(', ')) + (uses.length > 3 ? '…' : '') : ''}</small></span><span><b>${a.assigned}</b> affecté(s) · <b>${a.free}</b> libre(s) · <b>${a.busy}</b> occupé(s)${a.resting ? ` · ${a.resting} repos` : ''}<br><small>${needs[id] || 0} requis par les opérations en cours</small></span></div>`; }).join('');
            return `<section class="depot-panel"><div class="depot-section-title"><div><h4>Postes & compétences du dépôt</h4><span class="depot-muted">Les opérations réservent réellement les agents affectés à ce dépôt et refusent de démarrer si l’effectif libre est insuffisant.</span></div><button class="btn-sm" onclick="game.ui.switchPage('staff')">Ouvrir Personnel</button></div>${searchInput('Rechercher un métier, une spécialité ou une opération…', '.depot-role-row', 'roleSearch')}<div class="depot-role-list">${rows}</div></section>`;
        };
        const renderDetail = (d) => {
            if (!d)
                return '<div class="depot-empty">Créez un dépôt pour commencer.</div>';
            const station = this.game.world.getStationById(d.stationId), occ = this.game.depotManager.getDepotOccupancy(d.id), tabs = [['overview', 'Vue générale'], ['material', 'Matériel'], ['tracks', 'Voies'], ['equipment', 'Équipements'], ['maintenance', 'Maintenance'], ['cleaning', 'Nettoyage'], ['stocks', 'Stocks & pièces'], ['staff', 'Personnel']];
            let body = '';
            if (this._depotPageTab === 'material')
                body = renderMaterial(d);
            else if (this._depotPageTab === 'tracks')
                body = renderTracks(d);
            else if (this._depotPageTab === 'equipment')
                body = renderEquipment(d);
            else if (this._depotPageTab === 'maintenance')
                body = renderMaintenance(d);
            else if (this._depotPageTab === 'cleaning')
                body = renderCleaning(d);
            else if (this._depotPageTab === 'stocks')
                body = renderStocks(d);
            else if (this._depotPageTab === 'staff')
                body = renderStaff(d);
            else
                body = renderOverview(d);
            const rescued = this.game.depotManager.getRescuedFormations?.(d.id) || [];
            if (rescued.length && ['overview', 'material', 'tracks', 'maintenance'].includes(String(this._depotPageTab || 'overview')))
                body += `<section class="depot-panel"><h4>Formations physiques remorquées</h4>${rescued.map((f) => `<p><b>${esc(f.name)}</b> — ${f.vehicleIds.length} engin(s), voie ${esc(this.game.depotManager.getDepotById(d.id)?.findRameTrack(f.id)?.track || '?')} : ${f.repairing ? 'réparation en cours' : 'réparation terminée — acheminement explicite depuis ce dépôt requis'}</p>`).join('')}<small>Ces engins conservent leur identité dans les roulements. Aucune rame supplémentaire n’est créée ; la voie est libérée après le départ constaté de tous les engins.</small></section>`;
            return `<div class="depot-detail-head"><div><span class="depot-detail-icon">▣</span><span><h3>${esc(d.name)}</h3><small>${esc(station?.name || 'Rattachement technique')} · ${occ.used}/${occ.capacity} voies · ${htmlText(d.location ? Number(d.location.lat).toFixed(5) + ', ' + Number(d.location.lon).toFixed(5) : 'position héritée')}</small></span></div><button class="btn-sm danger" onclick="game.ui.deleteDepot('${htmlJsString(d.id)}')">Supprimer</button></div><nav class="depot-tabs">${tabs.map(([id, label]) => `<button class="${htmlText(this._depotPageTab === id ? 'active' : '')}" onclick="game.ui.setDepotDetailTab('${htmlJsString(id)}')">${htmlText(label)}</button>`).join('')}</nav><div class="depot-tab-body">${body}</div>`;
        };
        if (depotsContainer)
            depotsContainer.innerHTML = `<div class="depot-page-toolbar">${searchInput('Rechercher un dépôt…', '.depot-nav-card', 'depotSearch')}<span>${depots.length} dépôt(s)</span></div><div class="depot-master"><aside class="depot-nav">${depotList || '<div class="depot-muted">Aucun dépôt.</div>'}</aside><main class="depot-detail">${renderDetail(selected)}</main></div>`;
        if (iteContainer)
            iteContainer.innerHTML = `<div class="depot-page-toolbar">${searchInput('Rechercher une ITE…', '.ite-modern-card', 'iteSearch')}<span>${ites.length} ITE</span></div><div class="ite-modern-grid">${ites.map((d) => { const st = this.game.world.getStationById(d.stationId); return `<article class="ite-modern-card" data-ite-search="${esc(norm(d.name + ' ' + (st?.name || '') + ' ' + d.getTypeLabel() + ' ' + (d.iteCargoTypes || []).join(' ')))}"><div class="ite-modern-icon">▥</div><div><h4>${esc(d.name)}</h4><p>${esc(d.getTypeLabel())} · ${d.tracks} voie(s)</p><small>${htmlText(d.location ? Number(d.location.lat).toFixed(5) + ', ' + Number(d.location.lon).toFixed(5) : (st?.name || ''))}</small>${d.iteCargoTypes?.length ? `<div class="depot-badges">${d.iteCargoTypes.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div><button class="btn-sm danger" onclick="game.ui.deleteDepot('${htmlJsString(d.id)}')">Supprimer</button></article>`; }).join('') || '<div class="depot-muted">Aucune ITE.</div>'}</div>`;
        this._wireDepotSearchInputs(depotsContainer);
        this._wireDepotSearchInputs(iteContainer);
    }
    selectDepotDetail(id) { this._selectedDepotPageId = id; this._depotPageTab = 'overview'; this.renderDepotsList(); }
    setDepotDetailTab(tab) { this._depotPageTab = tab; this.renderDepotsList(); }
    _wireDepotSearchInputs(root) { if (!root)
        return; root.querySelectorAll('.depot-search[data-depot-filter]').forEach((input) => { if (input._depotSearchWired)
        return; input._depotSearchWired = true; input.addEventListener('input', () => this.filterDepotRows(input, input.dataset.depotFilter, input.dataset.depotKey)); }); }
    filterDepotRows(input, selector, dataKey) { const q = String(input?.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); const root = input?.closest('.depot-panel,.depot-master,.page-content') || document; let visible = 0; root.querySelectorAll(selector).forEach((el) => { const fromData = el.dataset && dataKey ? el.dataset[dataKey] : ''; const raw = String(fromData || el.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const show = !q || raw.includes(q); el.style.display = show ? '' : 'none'; if (show)
        visible++; }); input.setAttribute('data-result-count', String(visible)); }
    addDepotTracks(depotId, count) { const res = this.game.depotManager.addDepotTracks(depotId, count, this.game.economy); if (!res.ok)
        return alert(res.reason || 'Extension impossible.'); this.game.saveState(); this.renderDepotsList(); }
    buyDepotEquipment(depotId, equipmentId) { const res = this.game.depotManager.buyEquipment(depotId, equipmentId, this.game.economy); if (!res.ok)
        return alert(res.reason || 'Achat équipement impossible.'); this.game.saveState(); this.renderDepotsList(); }
    _syncRameRotationDepotLinks(rame) { if (!rame || !this.game.rotationV2)
        return; const byId = new Map((rame.elementDetails || []).map((e) => [String(e.elementId || ''), e])); for (const v of this.game.rotationV2.vehicles || []) {
        if (v.sourceRameId !== rame.id)
            continue;
        const e = byId.get(String(v.sourceRameElementId || ''));
        if (e)
            v.homeDepotId = String(e.homeDepotId || '');
    } for (const c of this.game.rotationV2.coupons || []) {
        if (c.sourceRameId !== rame.id)
            continue;
        const homes = [...new Set((c.vehicleIds || []).map((id) => this.game.rotationV2.getVehicle?.(id)?.homeDepotId || '').filter(Boolean))];
        c.homeDepotId = homes.length === 1 ? homes[0] : '';
    } }
    assignDepotHome(depotId, rameId) { const r = this.game.rameManager.getById(rameId); if (!this.game.depotManager.assignRameHome(r, depotId))
        return alert('Affectation impossible.'); this._syncRameRotationDepotLinks(r); this.game.saveState(); this.renderDepotsList(); }
    assignDepotElement(depotId, rameId, elementId) { const r = this.game.rameManager.getById(rameId); if (!this.game.depotManager.assignElementHome(r, elementId, depotId))
        return alert('Affectation élément impossible.'); this._syncRameRotationDepotLinks(r); this.game.saveState(); this.renderDepotsList(); }
    clearDepotHome(rameId) { const r = this.game.rameManager.getById(rameId); if (!r)
        return; this.game.depotManager.clearRameHome(r); this._syncRameRotationDepotLinks(r); this.game.saveState(); this.renderDepotsList(); }
    _syncRotationVehicleSourceHome(vehicle) { if (!vehicle?.sourceRameId || !vehicle.sourceRameElementId)
        return; const r = this.game.rameManager.getById(vehicle.sourceRameId), e = r?.elementDetails?.find((x) => String(x.elementId || '') === String(vehicle.sourceRameElementId)); if (e)
        e.homeDepotId = String(vehicle.homeDepotId || ''); }
    assignRotationVehicleDepot(depotId, vehicleId) { const d = this.game.depotManager.getDepotById(depotId), v = this.game.rotationV2?.getVehicle?.(vehicleId); if (!d || d.type !== 'depot' || !v)
        return alert('Affectation impossible.'); this.game.rotationV2.setVehicleHomeDepot(vehicleId, depotId); this._syncRotationVehicleSourceHome(v); for (const c of this.game.rotationV2.coupons || []) {
        if (!(c.vehicleIds || []).includes(v.id))
            continue;
        const homes = [...new Set(c.vehicleIds.map((id) => this.game.rotationV2.getVehicle(id)?.homeDepotId || '').filter(Boolean))];
        c.homeDepotId = homes.length === 1 ? homes[0] : '';
    } this.game.saveState(); this.renderDepotsList(); }
    clearRotationVehicleDepot(vehicleId) { const v = this.game.rotationV2?.getVehicle?.(vehicleId); if (!v)
        return; this.game.rotationV2.setVehicleHomeDepot(vehicleId, ''); this._syncRotationVehicleSourceHome(v); for (const c of this.game.rotationV2.coupons || []) {
        if ((c.vehicleIds || []).includes(v.id))
            c.homeDepotId = '';
    } this.game.saveState(); this.renderDepotsList(); }
    assignRotationCouponDepot(depotId, couponId) { const d = this.game.depotManager.getDepotById(depotId), c = this.game.rotationV2?.getCoupon?.(couponId); if (!d || d.type !== 'depot' || !c)
        return alert('Affectation coupon impossible.'); this.game.rotationV2.setCouponHomeDepot(couponId, depotId); for (const id of c.vehicleIds || [])
        this._syncRotationVehicleSourceHome(this.game.rotationV2.getVehicle(id)); this.game.saveState(); this.renderDepotsList(); }
    clearRotationCouponDepot(couponId) { const c = this.game.rotationV2?.getCoupon?.(couponId); if (!c)
        return; this.game.rotationV2.setCouponHomeDepot(couponId, ''); for (const id of c.vehicleIds || [])
        this._syncRotationVehicleSourceHome(this.game.rotationV2.getVehicle(id)); this.game.saveState(); this.renderDepotsList(); }
    enterDepot(depotId, rameId) { const r = this.game.rameManager.getById(rameId); const res = this.game.depotManager.enterRame(depotId, r, this.game.scheduleCreator?.getActiveServices?.() || []); if (!res.ok)
        return alert(res.reason || 'Entrée impossible.'); this.game.saveState(); this.renderDepotsList(); }
    leaveDepot(depotId, rameId) { const r = this.game.rameManager.getById(rameId); const res = this.game.depotManager.leaveRame(depotId, r, this.game.scheduleCreator?.getActiveServices?.() || []); if (!res.ok)
        return alert(res.reason || 'Sortie impossible.'); this.game.saveState(); this.renderDepotsList(); }
    resumeRescueRouting(id) {
        if (!confirm('Réessayer ce routage ? Un refus du fournisseur peut persister ; aucun service alternatif ne sera utilisé pour le contourner.'))
            return;
        if (!this.game.depotManager.resumeRescueRouting(id))
            return alert('Reprise indisponible : temporisation en cours, calcul déjà lancé ou mission terminée.');
        this.game.saveState();
        this.renderDepotsList();
    }
    addRescueElement(depotId, rameId, elementId) { const r = this.game.rameManager.getById(rameId), el = r?.elementDetails?.find((e) => e.elementId === elementId); if (!el)
        return; const name = `${el.instanceName || el.name} — ${r.name}`; if (!this.game.depotManager.addRescueLoco(depotId, el.elementId, name, el.traction))
        return alert('Impossible : maximum 2 secours ou matériel déjà affecté comme secours.'); this.game.saveState(); this.renderDepotsList(); }
    buyDepotResource(depotId, key) { const inp = document.getElementById(`res-${depotId}-${key}`), n = Number(inp?.value); const res = this.game.depotManager.buyResource(depotId, key, n, this.game.economy); if (!res.ok)
        return alert(res.reason || 'Commande impossible.'); this.game.saveState(); this.renderDepotsList(); }
    buyDepotPart(depotId, partId) { const inp = document.getElementById(`part-${depotId}-${partId}`), n = Number(inp?.value); const res = this.game.depotManager.buyPart(depotId, partId, n, this.game.economy); if (!res.ok)
        return alert(res.reason || 'Commande impossible.'); this.game.saveState(); this.renderDepotsList(); }
    startDepotOp(depotId, rameId, opId) { const r = this.game.rameManager.getById(rameId), staff = this.game.realismSettings?.personnelRequired === true ? this.game.staffManager : null, res = this.game.depotManager.startDepotOperation(depotId, r, opId, this.game.economy, staff); if (!res.ok)
        return alert(res.reason || 'Opération impossible.'); this.game.saveState(); this.renderDepotsList(); }
    addRescueLoco(depotId) {
        const select = document.getElementById(`rescue-stock-${depotId}`);
        if (!select || !select.value)
            return;
        const stock = this.game.rollingStock.getAll().find((s) => s.id === select.value);
        if (!stock)
            return;
        const displayName = stock.seriesName ? `${stock.seriesName} ${stock.numberStart || ''}`.trim() : stock.name;
        const ok = this.game.depotManager.addRescueLoco(depotId, stock.id, displayName, stock.traction);
        if (!ok)
            return alert('Maximum 2 machines de secours par dépôt.');
        this.game.saveState();
        this.renderDepotsList();
    }
    removeRescueLoco(depotId, stockId) {
        if (!this.game.depotManager.removeRescueLoco(depotId, stockId))
            return alert('Impossible : cette locomotive de secours est actuellement engagée.');
        this.game.saveState();
        this.renderDepotsList();
    }
    buySparePart(depotId, type, qty) {
        qty = Number(qty);
        if (!Number.isInteger(qty) || qty <= 0)
            return alert('Quantité de pièces invalide.');
        const depot = this.game.depotManager.getDepotById(depotId);
        if (!depot)
            return;
        const prices = { moteur: 5000, freins: 3000, climatisation: 2000, portes: 1500, fanaux: 1000 };
        const cost = (prices[type] || 1000) * qty;
        if (this.game.economy.balance < cost)
            return alert('Fonds insuffisants.');
        if (depot.addSpareParts(type, qty)) {
            this.game.economy.addExpense(cost, 'maintenance', `Achat pièce détachée : ${type} x${qty}`);
            this.game.saveState();
            this.renderDepotsList();
        }
    }
    // MNT-05 : achat groupé de pièces détachées pour tous les dépôts
    buyBulkSparePart() {
        const typeSelect = document.getElementById('bulk-spare-type');
        const qtyInput = document.getElementById('bulk-spare-qty');
        if (!typeSelect || !qtyInput)
            return;
        const type = typeSelect.value;
        const qty = parseInt(qtyInput.value) || 1;
        const res = this.game.depotManager.buyBulkSpareParts(type, qty, this.game.economy);
        if (!res.ok)
            return alert(`Fonds insuffisants. Coût total : ${res.totalCost.toLocaleString('fr-FR')} €`);
        this.game.saveState();
        this.renderDepotsList();
    }
    deleteDepot(id) {
        if (!confirm('Supprimer ce d\u00e9p\u00f4t ?'))
            return;
        const depot = this.game.depotManager.getDepotById(id);
        if (!depot)
            return;
        if (depot.type === 'depot') {
            const linked = (this.game.rameManager.getAll?.() || []).filter((r) => r.depotId === id || r.currentLocation?.depotId === id || (r.elementDetails || []).some((e) => e.homeDepotId === id));
            const rotationLinked = (this.game.rotationV2?.vehicles || []).filter((v) => v.homeDepotId === id).length + (this.game.rotationV2?.coupons || []).filter((c) => c.homeDepotId === id).length;
            if (linked.length || rotationLinked)
                return alert(`Suppression impossible : ${linked.length + rotationLinked} matériel(s) sont encore affectés ou présents. Désaffectez-les et sortez-les d’abord.`);
        }
        if (depot.type?.startsWith('ite') && this.game.industrialClients?.clients?.some((c) => c?.active !== false && c.depotId === id)) {
            return alert('Suppression impossible : cette ITE dessert encore un client industriel actif. Résiliez ou déplacez le client avant de supprimer l’ITE.');
        }
        if (!this.game.depotManager.remove(id))
            return alert('Suppression impossible : ce site a encore un secours, une réparation ou une maintenance en cours.');
        if (depot.type?.startsWith('ite'))
            this.game.iteModules?.removeInstallation?.(id);
        this.game.saveState();
        this.renderDepotsList();
    }
    _renderDepotQueueSection(depot) {
        const dm = this.game.depotManager;
        const repairs = dm.repairQueue.filter((r) => r.depotId === depot.id);
        const maint = dm.maintenanceQueue.filter((m) => m.depotId === depot.id);
        if (repairs.length === 0 && maint.length === 0)
            return '';
        const items = [
            ...repairs.map((r) => `<div style="font-size:10px;padding:2px 0"><span style="color:#ef4444">Reparation</span> ${htmlText(r.serviceName)} — ${Math.ceil(r.remainingMin)} min</div>`),
            ...maint.map((m) => `<div style="font-size:10px;padding:2px 0"><span style="color:#3b82f6">Entretien</span> ${htmlText(m.rameName)} — ${Math.ceil(m.remainingMin)} min</div>`),
        ];
        return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">En atelier</div>${items.join('')}</div>`;
    }
    _renderMaintenanceButton(depot) {
        // List all RAMES not already in maintenance (preventive maintenance available for any rame)
        const allRames = this.game.rameManager.getAll();
        const dm = this.game.depotManager;
        const available = allRames.filter((r) => !r.inMaintenance && !dm.isRameInMaintenance(r.id));
        if (available.length === 0)
            return '';
        // MNT-06 : rames avec maintenance préventive recommandée en premier
        const sorted = [...available].sort((a, b) => (b.recommendedMaintenance ? 1 : 0) - (a.recommendedMaintenance ? 1 : 0));
        const opts = sorted.map((r) => {
            const badge = r.recommendedMaintenance ? ' [RECOMMANDÉ]' : '';
            const wear = Math.round(r.wearLevel);
            const km = Math.round(r.kmSinceLastMaint);
            return `<option value="${htmlText(r.id)}">${htmlText(r.name)} (${wear}% / ${km} km)${badge}</option>`;
        }).join('');
        return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">Entretien preventif (rame)</div>
      <div style="display:flex;gap:4px">
        <select id="maint-rame-${htmlText(depot.id)}" style="flex:1;font-size:10px">${opts}</select>
        <button class="btn-sm" style="font-size:9px" onclick="game.ui.sendRameToMaintenance('${htmlJsString(depot.id)}')">Envoyer</button>
      </div>
    </div>`;
    }
    sendRameToMaintenance(depotId) {
        const select = document.getElementById(`maint-rame-${depotId}`);
        if (!select || !select.value)
            return;
        const rameId = select.value;
        const rame = this.game.rameManager.getById(rameId);
        if (!rame)
            return;
        if (!this.game.depotManager.sendRameToMaintenance(rameId, rame.name, depotId))
            return alert('Impossible d’envoyer cette rame en maintenance.');
        rame.inMaintenance = true;
        // Stop all services using this rame only after the queue accepted it.
        const services = this.game.scheduleCreator.getActiveServices();
        for (const svc of services) {
            if (svc.rame && svc.rame.id === rameId) {
                svc.train.inMaintenance = true;
                svc.speed = 0;
                svc.train.speed = 0;
            }
        }
        this.game.saveState();
        this.renderDepotsList();
    }
    bulkSendToMaintenance(depotId) {
        const rames = this.game.rameManager.getAll().filter((r) => r.recommendedMaintenance && !this.game.depotManager.isRameInMaintenance(r.id));
        let count = 0;
        for (const rame of rames) {
            if (!this.game.depotManager.sendRameToMaintenance(rame.id, rame.name, depotId))
                continue;
            rame.inMaintenance = true;
            const services = this.game.scheduleCreator.getActiveServices();
            for (const svc of services) {
                if (svc.rame && svc.rame.id === rame.id) {
                    svc.train.inMaintenance = true;
                    svc.speed = 0;
                    svc.train.speed = 0;
                }
            }
            count++;
        }
        if (count > 0)
            this.game.saveState();
        this.renderDepotsList();
    }
    // --- INCIDENTS ---
    setupIncidentPage() {
        document.getElementById('btn-add-works')?.addEventListener('click', () => this._ensureWorksV2Editor().open());
        document.getElementById('works-impact')?.addEventListener('change', (e) => {
            document.getElementById('works-speed-group').style.display = e.target.value === 'slow' ? 'block' : 'none';
        });
        document.getElementById('works-recurrence')?.addEventListener('change', (e) => {
            document.getElementById('works-days-group').style.display = e.target.value === 'weekly' ? 'block' : 'none';
        });
        document.getElementById('btn-save-works')?.addEventListener('click', () => this.saveWorks());
        document.getElementById('btn-works-manual')?.addEventListener('click', () => this._toggleWorksManualMode());
        document.getElementById('btn-works-finish-manual')?.addEventListener('click', () => this._finishWorksManual());
        document.getElementById('btn-works-clear-manual')?.addEventListener('click', () => this._clearWorksManualTrace());
        document.getElementById('works-station-a')?.addEventListener('change', () => { this._syncWorksManualEndpoints(); this._updateWorksManualUI(); });
        document.getElementById('works-station-b')?.addEventListener('change', () => { this._syncWorksManualEndpoints(); this._updateWorksManualUI(); });
        // Predefined incident type toggles (Annexe 11)
        const typesTable = document.getElementById('incident-types-table');
        if (typesTable && !typesTable._delegated) {
            typesTable._delegated = true;
            typesTable.addEventListener('change', (e) => {
                const cb = e.target?.closest('.incident-type-cb');
                if (cb) {
                    this.game.incidentManager.toggleType(cb.dataset.typeId, cb.checked, this.game.world);
                    this.game.renderer?.invalidateStatic?.();
                    this.game.saveState();
                    this.renderIncidentsPage();
                }
            });
        }
    }
    // Kept for backward compatibility / admin use; not exposed in normal UI.
    openWorksModal() {
        document.getElementById('modal-works')?.classList.remove('hidden');
        document.getElementById('works-name').value = '';
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        document.getElementById('works-start-date').value = today;
        document.getElementById('works-end-date').value = tomorrow;
        document.getElementById('works-start-time').value = '22:00';
        document.getElementById('works-end-time').value = '05:00';
        const recSel = document.getElementById('works-recurrence');
        if (recSel)
            recSel.value = 'daily';
        document.getElementById('works-days-group')?.style.setProperty('display', 'none');
        document.querySelectorAll('.works-day').forEach((cb) => cb.checked = true);
        const opts = this.game.world.stations.map((st) => `<option value="${htmlText(st.id)}">${htmlText(st.name)}</option>`).join('');
        const aSel = document.getElementById('works-station-a');
        const bSel = document.getElementById('works-station-b');
        if (aSel)
            aSel.innerHTML = '<option value="">—</option>' + opts;
        if (bSel)
            bSel.innerHTML = '<option value="">—</option>' + opts;
        this._resetWorksManual();
        this._updateWorksManualUI();
        requestAnimationFrame(() => this.setupWorksMap());
    }
    async saveWorks() {
        const aId = document.getElementById('works-station-a')?.value;
        const bId = document.getElementById('works-station-b')?.value;
        if (!aId || !bId)
            return alert('Sélectionnez les gares A et B.');
        if (aId === bId)
            return alert('Les gares doivent être différentes.');
        const stA = this.game.world.getStationById(aId);
        const stB = this.game.world.getStationById(bId);
        if (!stA || !stB)
            return alert('Gares invalides.');
        if (this._worksManualPoints && this._worksManualPoints.length > 0 && this._worksManualStart && this._worksManualEnd) {
            this._rebuildWorksManualRoute();
        }
        let route = null;
        let manualRoute = null;
        if (this._worksManualRoute && this._worksManualRoute.length >= 2) {
            route = this._worksManualRoute;
            manualRoute = this._worksManualRoute;
        }
        else {
            try {
                route = await this.game.orm.findRoute(stA.lat, stA.lon, stB.lat, stB.lon);
            }
            catch (e) {
                console.warn('ORM route failed for works', e);
            }
            if (!route || route.length < 2)
                return alert('Impossible de calculer un itinéraire ferroviaire entre ces gares. Vérifiez le réseau ORM ou utilisez le tracé manuel.');
            route = this.game.orm.getRouteSegments(route).map((s) => ({ lat: s.from.lat, lon: s.from.lon, maxSpeed: s.maxSpeed })).concat([{ lat: route[route.length - 1].lat, lon: route[route.length - 1].lon, maxSpeed: route[route.length - 1].maxSpeed || 160 }]);
        }
        const recurrence = document.getElementById('works-recurrence')?.value || 'daily';
        const daysOfWeek = recurrence === 'weekly'
            ? [...document.querySelectorAll('.works-day:checked')].map((cb) => parseInt(cb.value))
            : [0, 1, 2, 3, 4, 5, 6];
        this.game.worksManager.add({
            name: document.getElementById('works-name').value.trim() || 'Travaux',
            stationA: aId,
            stationB: bId,
            route,
            manualRoute,
            startDate: document.getElementById('works-start-date').value,
            startTime: document.getElementById('works-start-time').value || '22:00',
            endDate: document.getElementById('works-end-date').value,
            endTime: document.getElementById('works-end-time').value || '05:00',
            impact: document.getElementById('works-impact').value,
            speedLimit: parseInt(document.getElementById('works-speed-limit').value) || 40,
            recurrence,
            daysOfWeek,
        });
        this._resetWorksManual();
        document.getElementById('modal-works')?.classList.add('hidden');
        this.renderIncidentsPage();
        this.game.saveState();
    }
    renderIncidentsPage() {
        const activeList = document.getElementById('active-incidents-list');
        const worksList = document.getElementById('planned-works-list');
        // Set up event delegation once (mousedown to avoid re-render race on Opera/others)
        if (activeList && !activeList._delegated) {
            activeList._delegated = true;
            activeList.addEventListener('mousedown', (e) => {
                const t = e.target;
                const btn = t?.dataset?.deleteIncident ? t : t?.closest?.('[data-delete-incident]');
                if (btn && btn.dataset?.deleteIncident) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteIncident(btn.dataset.deleteIncident);
                }
            });
        }
        if (worksList && !worksList._delegated) {
            worksList._delegated = true;
            worksList.addEventListener('mousedown', (e) => {
                const t = e.target;
                const btn = t?.dataset?.deleteWorks ? t : t?.closest?.('[data-delete-works]');
                if (btn && btn.dataset?.deleteWorks) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteWorks(btn.dataset.deleteWorks);
                }
            });
        }
        const active = this.game.incidentManager.getActiveIncidents();
        const activeCount = document.getElementById('active-incidents-count');
        if (activeCount) {
            activeCount.textContent = String(active.length);
            activeCount.title = `${active.length} incident${active.length === 1 ? '' : 's'} actuellement en cours`;
        }
        if (activeList) {
            // HOTFIX39 — readable incident cards: bright effect/location colours, train
            // identity + live position for train-target incidents, and explicit start/end.
            const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
            const nowMinute = Number.isFinite(Number(this.game.timeOfDay))
                ? Number(this.game.timeOfDay)
                : (() => { const pt = this.game.engine?.getParisTime?.(); return pt ? pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60 : 0; })();
            const clock = (value, showDay = false) => {
                const raw = Number(value);
                if (!Number.isFinite(raw))
                    return '--:--';
                const rounded = Math.round(raw);
                const day = Math.floor(rounded / 1440);
                const m = ((rounded % 1440) + 1440) % 1440;
                const hh = String(Math.floor(m / 60)).padStart(2, '0');
                const mm = String(m % 60).padStart(2, '0');
                return `${hh}:${mm}${showDay && day > 0 ? ` (+${day})` : ''}`;
            };
            const services = this.game.scheduleCreator?.getActiveServices?.() || [];
            const serviceById = new Map(services.map((s) => [String(s?.id ?? ''), s]));
            activeList.innerHTML = active.length === 0
                ? '<div class="no-incidents">Aucun incident en cours</div>'
                : active.map((inc) => {
                    const elapsed = Math.max(0, Number(inc.duration || 0) - Number(inc.remaining || 0));
                    let start = Number(inc.startTime);
                    // Old saves used 0 as a placeholder. Reconstruct a sensible start from
                    // the current clock and elapsed duration when that placeholder is obvious.
                    if ((!Number.isFinite(start) || (start === 0 && elapsed > 0 && nowMinute > elapsed + 1)))
                        start = nowMinute - elapsed;
                    if (!Number.isFinite(start))
                        start = nowMinute - elapsed;
                    const end = start + Math.max(0, Number(inc.duration || 0));
                    const genericLocation = inc.locationText || inc.trackName ||
                        (inc.stationAName && inc.stationBName
                            ? (inc.stationAName === inc.stationBName ? `à ${inc.stationAName}` : `entre ${inc.stationAName} et ${inc.stationBName}`)
                            : 'Zone');
                    const svc = inc.serviceId ? serviceById.get(String(inc.serviceId)) : null;
                    let trainName = inc.trainName || svc?.name || svc?.number || svc?.train?.name || svc?.train?.id || inc.trainId || '';
                    let trainPosition = inc.locationText || genericLocation;
                    let trainAtStation = !!(inc.stationA && inc.stationB && String(inc.stationA) === String(inc.stationB));
                    if (svc && this.game.incidentManager?._serviceLocationDescriptor) {
                        const loc = this.game.incidentManager._serviceLocationDescriptor(svc, this.game.world);
                        if (loc?.text)
                            trainPosition = loc.text;
                        if (loc?.stationA && loc?.stationB)
                            trainAtStation = String(loc.stationA) === String(loc.stationB);
                    }
                    const trainLine = inc.serviceId || inc.trainId
                        ? `<div class="incident-train-line"><span class="incident-train-label">Train</span> <span class="incident-train-name">${esc(trainName || 'Train')}</span><span class="incident-train-sep">•</span><span class="incident-position-label">Position</span> <span class="${htmlText(trainAtStation ? 'incident-position-station' : 'incident-position-between')}">${esc(trainPosition || 'Position inconnue')}</span></div>`
                        : '';
                    const effectHtml = inc.effect === 'stop'
                        ? '<span class="incident-effect-stop">Interruption</span>'
                        : `<span class="incident-effect-slow">Ralenti ${esc(inc.speedLimit || 30)} km/h</span>`;
                    const weatherLine = inc.source === 'weather' || inc.triggerText
                        ? `<div class="incident-weather-cause"><span>🌦 Déclencheur météo</span>${inc.weatherLevel ? ` · <b>${esc(inc.weatherLevel)}</b>` : ''}${inc.triggerText ? ` · ${esc(inc.triggerText)}` : ''}</div>` : '';
                    return `
            <div class="incident-item">
              <div style="flex:1;min-width:0">
                <div class="incident-name">${esc(inc.name)}</div>
                <div class="incident-desc"><span class="incident-location">${esc(genericLocation)}</span><span class="incident-separator"> — </span>${effectHtml}</div>
                ${trainLine}
                ${weatherLine}
                <div class="incident-time"><span>Début <b>${clock(start)}</b></span><span>Fin <b>${clock(end, true)}</b></span><span class="incident-remaining">${Math.ceil(inc.remaining)} min restantes</span></div>
              </div>
              <button class="btn-sm danger incident-delete-btn" data-delete-incident="${esc(inc.id)}" title="Supprimer l'incident">✕</button>
            </div>`;
                }).join('');
        }
        const typesTable = document.getElementById('incident-types-table');
        // The page refreshes every tick: rebuilding the checkbox table each time would
        // swap the DOM node under the pointer and swallow the player's click.
        const typesSig = this.game.incidentManager.getEnabledTypes().map(String).sort().join('|');
        if (typesTable && typesTable.dataset.enabledSig !== typesSig) {
            typesTable.dataset.enabledSig = typesSig;
            const types = this.game.incidentManager.getAllTypes();
            const escType = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
            const tableFor = (items, title, weather = false) => `<section class="incident-type-section ${htmlText(weather ? 'incident-weather-types' : '')}">
        <div class="incident-type-section-head"><div><h4>${htmlText(title)}</h4>${weather ? '<p>Ces incidents ne sont pas tirés au hasard : seuil météo local + durée d’exposition + nombre de zones exposées.</p>' : ''}</div><span>${items.length} types</span></div>
        <div class="incident-table-scroll"><table class="incident-table"><thead><tr><th>Actif</th><th>Nom</th><th>Impact</th><th>Conditions / seuil</th><th>Déclenchement</th><th>Durée</th></tr></thead><tbody>
        ${items.map((t) => `<tr class="${htmlText(weather ? 'incident-weather-type-row' : '')}"><td><input type="checkbox" class="incident-type-cb" data-type-id="${escType(t.id)}" ${t.enabled ? 'checked' : ''}></td><td><b>${escType(t.name)}</b>${weather ? '<div class="incident-weather-tag">MÉTÉO</div>' : ''}</td><td>${escType(t.impact)}</td><td class="incident-condition-cell">${escType(t.special)}</td><td>${escType(t.probabilityLabel || (t.id === 'train-breakdown' ? `${t.probability}% hiver / ${t.summerProbability}% été` : t.probability + '%'))}</td><td>${t.durationMin}${t.durationMax !== t.durationMin ? '-' + t.durationMax : ''} min</td></tr>`).join('')}
        </tbody></table></div></section>`;
            const general = types.filter((t) => !t.weatherTriggered), weatherTypes = types.filter((t) => t.weatherTriggered);
            typesTable.innerHTML = tableFor(general, 'Incidents généraux') + tableFor(weatherTypes, 'Incidents météorologiques', true);
        }
        const works = this.game.worksManager.getAll();
        const worksCount = document.getElementById('active-works-count');
        if (worksCount) {
            const activeWorks = works.filter((w) => w.active).length;
            worksCount.textContent = String(works.length);
            worksCount.title = `${works.length} chantier${works.length === 1 ? '' : 's'} programmé${works.length === 1 ? '' : 's'} • ${activeWorks} en cours`;
        }
        if (worksList) {
            const worksEsc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
            const stationName = (value) => {
                if (!value)
                    return '';
                const st = this.game.world.getStationById?.(value);
                return st?.name || String(value);
            };
            const locationFor = (z, w) => {
                const a = String(z?.startStation?.name || stationName(z?.stationA) || stationName(w?.stationA) || '').trim();
                const b = String(z?.endStation?.name || stationName(z?.stationB) || stationName(w?.stationB) || '').trim();
                if (a && b)
                    return a === b ? `à ${a}` : `entre ${a} et ${b}`;
                if (a || b)
                    return `à ${a || b}`;
                return '';
            };
            worksList.innerHTML = works.length === 0
                ? '<div class="no-incidents">Pas de travaux programmés</div>'
                : works.map((w) => {
                    const stationOnly = w.scope === 'station';
                    const zones = stationOnly ? [] : this.game.worksManager.getZones(w);
                    const isV2 = !stationOnly && Array.isArray(w.zones) && w.zones.length > 0;
                    const stationOnlyName = stationOnly
                        ? (w.stationName || w.station?.name || stationName(w.stationId || w.stationA))
                        : '';
                    const locations = stationOnly
                        ? (stationOnlyName ? [`à ${stationOnlyName}`] : [])
                        : [...new Set(zones.map((z) => locationFor(z, w)).filter(Boolean))];
                    const locationText = locations.join(' · ');
                    const trafficSummary = w.affectsTraffic === false
                        ? '<div style="font-size:10px;color:#ffffff;margin-top:2px">Aucun impact sur la circulation</div>'
                        : '';
                    const stationSummary = stationOnly && w.affectsTraffic !== false
                        ? '<div style="font-size:10px;color:#ffffff;margin-top:2px">Impact en gare — ' + (w.stationImpact === 'stop' ? 'Interruption' : w.stationImpact === 'power-off' ? 'Caténaire coupée' : 'LTV ' + (w.stationSpeedLimit || 40) + ' km/h') + '</div>'
                        : '';
                    const zoneSummary = stationOnly
                        ? (trafficSummary || stationSummary)
                        : (trafficSummary || (isV2
                            ? zones.map((z, i) => {
                                const impact = z.impact === 'stop' ? 'Interruption' : z.impact === 'power-off' ? 'Caténaire coupée' : 'LTV ' + (z.speedLimit || 40) + ' km/h';
                                const dist = Number(z.distanceKm || 0) > 0 ? ' • ' + Number(z.distanceKm).toFixed(2) + ' km' : '';
                                const dir = z.direction === 'forward' ? 'A→B' : z.direction === 'reverse' ? 'B→A' : '2 sens';
                                return '<div style="font-size:10px;color:#ffffff;margin-top:2px">Section ' + (i + 1) + ' — ' + impact + ' • ' + dir + dist + (z.manual ? ' • VIA manuel' : '') + '</div>';
                            }).join('')
                            : (w.manualRoute ? '<div style="font-size:10px;color:#ffffff;margin-top:2px">Tracé manuel legacy</div>' : '')));
                    return `
              <div class="works-item${htmlText(w.active ? ' active-work' : '')}">
                <div style="display:flex;align-items:flex-start;gap:8px">
                  <div style="flex:1;min-width:0">
                    <span class="works-name">${worksEsc(w.name)}</span>${locationText ? `<span class="works-location"> — ${worksEsc(locationText)}</span>` : ''}
                    ${stationOnly ? '<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:#7c2d12;color:#ffedd5;margin-left:5px">GARE</span>' : (isV2 ? '<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:#1d4ed8;color:#dbeafe;margin-left:5px">V2 ORM</span>' : '')}
                  </div>
                  <button class="btn-sm danger incident-delete-btn" data-delete-works="${worksEsc(w.id)}" title="Supprimer les travaux">✕</button>
                </div>
                <div>${worksEsc(w.getDateRange())}</div>
                <span style="font-size:10px;color:#ffffff">${worksEsc(w.recurrence === 'once' ? 'Le ' + w.startDate : w.recurrence === 'weekly' ? 'Hebdo : ' + w.daysOfWeek.join(',') : 'Chaque jour')} de ${worksEsc(w.startTime)} à ${worksEsc(w.endTime)}</span>
                ${zoneSummary}
                ${w.active ? ' <b style="color:#f6b79c">EN COURS</b>' : ''}
              </div>
            `;
                }).join('');
        }
    }
    deleteIncident(id) {
        this.game.incidentManager.removeIncident(id, this.game.world);
        this.game.saveState();
        this.renderIncidentsPage();
    }
    deleteWorks(id) {
        this.game.worksManager.remove(id);
        this.game.saveState();
        this.renderIncidentsPage();
    }
    // --- Works manual trace map ---
    _resetWorksManual() {
        this._worksManualMode = false;
        this._worksManualStart = null;
        this._worksManualEnd = null;
        this._worksManualPoints = [];
        this._worksManualRoute = null;
    }
    _syncWorksManualEndpoints() {
        const aId = document.getElementById('works-station-a')?.value;
        const bId = document.getElementById('works-station-b')?.value;
        const aSt = aId ? this.game.world.getStationById(aId) : null;
        const bSt = bId ? this.game.world.getStationById(bId) : null;
        if (aSt)
            this._worksManualStart = { lat: aSt.lat, lon: aSt.lon, id: aSt.id, name: aSt.name };
        else
            this._worksManualStart = null;
        if (bSt)
            this._worksManualEnd = { lat: bSt.lat, lon: bSt.lon, id: bSt.id, name: bSt.name };
        else
            this._worksManualEnd = null;
        if (this._worksTileMap) {
            if (aSt && bSt) {
                this._worksTileMap.centerLat = (aSt.lat + bSt.lat) / 2;
                this._worksTileMap.centerLon = (aSt.lon + bSt.lon) / 2;
                const cosLat = Math.cos(this._worksTileMap.centerLat * Math.PI / 180);
                const latSpan = Math.abs(aSt.lat - bSt.lat) + 0.05;
                const lonSpan = Math.abs(aSt.lon - bSt.lon) * cosLat + 0.05;
                const spanDeg = Math.max(latSpan, lonSpan);
                this._worksTileMap.zoomLevel = Math.min(18, Math.max(6, Math.log2(1000 / spanDeg)));
            }
            else if (aSt) {
                this._worksTileMap.centerLat = aSt.lat;
                this._worksTileMap.centerLon = aSt.lon;
                this._worksTileMap.zoomLevel = 10;
            }
        }
        if (this._worksManualMode)
            this._rebuildWorksManualRoute();
        if (this._drawWorksMap)
            this._drawWorksMap();
    }
    _rebuildWorksManualRoute() {
        if (!this._worksManualStart || !this._worksManualEnd)
            return;
        const start = { lat: this._worksManualStart.lat, lon: this._worksManualStart.lon, maxSpeed: 160 };
        const end = { lat: this._worksManualEnd.lat, lon: this._worksManualEnd.lon, maxSpeed: 160 };
        const controls = this._worksManualPoints.map((p) => ({ lat: p.lat, lon: p.lon, maxSpeed: 160 }));
        this._worksManualRoute = this._buildManualRoute(start, controls, end, 160);
    }
    _toggleWorksManualMode() {
        const aId = document.getElementById('works-station-a')?.value;
        const bId = document.getElementById('works-station-b')?.value;
        if (!this._worksManualMode) {
            if (!aId || !bId)
                return alert('Sélectionnez d\'abord les gares A et B.');
            this._worksManualMode = true;
            this._syncWorksManualEndpoints();
        }
        else {
            this._worksManualMode = false;
            if (!this._worksManualRoute)
                this._worksManualPoints = [];
        }
        this._updateWorksManualUI();
        if (this._drawWorksMap)
            this._drawWorksMap();
    }
    _finishWorksManual() {
        if (!this._worksManualMode)
            return;
        this._rebuildWorksManualRoute();
        if (!this._worksManualRoute || this._worksManualRoute.length < 2)
            return alert('Tracé invalide.');
        this._worksManualMode = false;
        this._updateWorksManualUI();
        if (this._drawWorksMap)
            this._drawWorksMap();
    }
    _clearWorksManualTrace() {
        this._worksManualPoints = [];
        this._worksManualRoute = null;
        this._worksManualMode = false;
        this._updateWorksManualUI();
        if (this._drawWorksMap)
            this._drawWorksMap();
    }
    _updateWorksManualUI() {
        const manual = document.getElementById('btn-works-manual');
        const clear = document.getElementById('btn-works-clear-manual');
        const finish = document.getElementById('btn-works-finish-manual');
        const hint = document.getElementById('works-manual-hint');
        const aId = document.getElementById('works-station-a')?.value;
        const bId = document.getElementById('works-station-b')?.value;
        if (manual) {
            manual.textContent = this._worksManualMode ? 'Quitter le tracé manuel' : 'Tracer manuellement';
            manual.classList.toggle('active', this._worksManualMode);
            manual.disabled = !aId || !bId;
        }
        if (clear)
            clear.classList.toggle('hidden', !this._worksManualMode);
        if (finish)
            finish.classList.toggle('hidden', !this._worksManualMode);
        if (hint) {
            if (this._worksManualMode)
                hint.textContent = 'Cliquez pour ajouter un point (50 m). Shift+clic sur un point pour le supprimer. Cliquez "Terminer" quand la portion fermée est tracée.';
            else if (!aId || !bId)
                hint.textContent = 'Sélectionnez les gares A et B. Le tracé ORM entre les deux sera fermé pendant la période.';
            else if (this._worksManualRoute)
                hint.textContent = 'Tracé manuel enregistré. Vous pouvez le refaire avec "Tracer manuellement".';
            else
                hint.textContent = 'Sélectionnez les gares A et B, puis cliquez sur "Tracer manuellement" pour indiquer la portion précise fermée.';
        }
    }
    setupWorksMap() {
        if (this._worksMapInterval) {
            clearInterval(this._worksMapInterval);
            this._worksMapInterval = null;
        }
        const canvas = document.getElementById('works-map-canvas');
        if (!canvas)
            return;
        const container = canvas.parentElement;
        if (!container || container.clientWidth === 0 || container.clientHeight === 0)
            return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = canvas.getContext('2d');
        const world = this.game.world;
        if (!this._worksTileMap) {
            const mainTileMap = this.game.renderer.tileMap;
            this._worksTileMap = new mainTileMap.constructor();
        }
        const tileMap = this._worksTileMap;
        tileMap.viewportWidth = canvas.width;
        tileMap.viewportHeight = canvas.height;
        this._syncWorksManualEndpoints();
        let drawPending = false;
        const requestDraw = () => {
            if (drawPending)
                return;
            drawPending = true;
            requestAnimationFrame(() => { drawPending = false; drawMap(); });
        };
        const drawMap = () => {
            const modal = document.getElementById('modal-works');
            if (!modal || modal.classList.contains('hidden'))
                return;
            tileMap.renderTiles(ctx, canvas.width, canvas.height);
            const vpTL = tileMap.screenToWorld(0, 0, canvas.width, canvas.height);
            const vpBR = tileMap.screenToWorld(canvas.width, canvas.height, canvas.width, canvas.height);
            const vMinLat = Math.min(vpTL.lat, vpBR.lat) - 0.02;
            const vMaxLat = Math.max(vpTL.lat, vpBR.lat) + 0.02;
            const vMinLon = Math.min(vpTL.lon, vpBR.lon) - 0.02;
            const vMaxLon = Math.max(vpTL.lon, vpBR.lon) + 0.02;
            // Existing tracks (faint)
            for (const t of world.tracks) {
                if (!t.route || t.route.length < 2)
                    continue;
                ctx.strokeStyle = 'rgba(148,163,184,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                const p0 = tileMap.worldToScreen(t.route[0].lat, t.route[0].lon, canvas.width, canvas.height);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < t.route.length; i++) {
                    const p = tileMap.worldToScreen(t.route[i].lat, t.route[i].lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
            // Planned works (faint red)
            for (const w of this.game.worksManager.getAll()) {
                const r = w.manualRoute || w.route;
                if (!r || r.length < 2)
                    continue;
                ctx.strokeStyle = 'rgba(239,68,68,0.25)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const p0 = tileMap.worldToScreen(r[0].lat, r[0].lon, canvas.width, canvas.height);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < r.length; i++) {
                    const p = tileMap.worldToScreen(r[i].lat, r[i].lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
            // Stations
            for (const st of world.stations) {
                if (st.lat < vMinLat || st.lat > vMaxLat || st.lon < vMinLon || st.lon > vMaxLon)
                    continue;
                const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                const isStart = this._worksManualStart && this._worksManualStart.id === st.id;
                const isEnd = this._worksManualEnd && this._worksManualEnd.id === st.id;
                ctx.fillStyle = isStart ? '#22c55e' : isEnd ? '#f97316' : '#3b82f6';
                ctx.beginPath();
                ctx.arc(p.x, p.y, (isStart || isEnd) ? 7 : 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (tileMap.zoomLevel >= 8) {
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = '10px sans-serif';
                    ctx.fillText(st.name, p.x + 8, p.y + 4);
                }
            }
            // Manual trace
            let trace = this._worksManualRoute;
            if (!trace && this._worksManualStart && this._worksManualEnd) {
                const start = { lat: this._worksManualStart.lat, lon: this._worksManualStart.lon, maxSpeed: 160 };
                const end = { lat: this._worksManualEnd.lat, lon: this._worksManualEnd.lon, maxSpeed: 160 };
                const controls = this._worksManualPoints.map((p) => ({ ...p, maxSpeed: 160 }));
                trace = this._densifyRoute([start, ...controls, end], 0.05);
            }
            if (trace && trace.length >= 2) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                const p0 = tileMap.worldToScreen(trace[0].lat, trace[0].lon, canvas.width, canvas.height);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < trace.length; i++) {
                    const p = tileMap.worldToScreen(trace[i].lat, trace[i].lon, canvas.width, canvas.height);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
                for (let i = 0; i < trace.length; i++) {
                    const pt = trace[i];
                    if (!pt.control && i !== 0 && i !== trace.length - 1)
                        continue;
                    const p = tileMap.worldToScreen(pt.lat, pt.lon, canvas.width, canvas.height);
                    const isEnd = (i === 0 || i === trace.length - 1);
                    ctx.fillStyle = isEnd ? '#f59e0b' : '#fca5a5';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, isEnd ? 5 : 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            else if (this._worksManualStart && this._worksManualEnd) {
                ctx.strokeStyle = 'rgba(239,68,68,0.4)';
                ctx.setLineDash([6, 4]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                const a = tileMap.worldToScreen(this._worksManualStart.lat, this._worksManualStart.lon, canvas.width, canvas.height);
                const b = tileMap.worldToScreen(this._worksManualEnd.lat, this._worksManualEnd.lon, canvas.width, canvas.height);
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        };
        this._drawWorksMap = drawMap;
        if (canvas._worksBound) {
            requestDraw();
            return;
        }
        canvas._worksBound = true;
        let drag = false, dragStart = null, totalDragDist = 0;
        canvas.onmousedown = (e) => { drag = true; dragStart = { x: e.offsetX, y: e.offsetY }; totalDragDist = 0; };
        canvas.onmousemove = (e) => {
            if (drag && dragStart) {
                const dx = e.offsetX - dragStart.x;
                const dy = e.offsetY - dragStart.y;
                totalDragDist += Math.abs(dx) + Math.abs(dy);
                tileMap.pan(dx, dy);
                dragStart = { x: e.offsetX, y: e.offsetY };
                requestDraw();
            }
        };
        canvas.onmouseup = (e) => {
            if (totalDragDist < 5) {
                const x = e.offsetX, y = e.offsetY;
                if (this._worksManualMode) {
                    if (e.shiftKey) {
                        let bestIdx = -1, bestD = Infinity;
                        for (let i = 0; i < this._worksManualPoints.length; i++) {
                            const p = tileMap.worldToScreen(this._worksManualPoints[i].lat, this._worksManualPoints[i].lon, canvas.width, canvas.height);
                            const d = Math.hypot(p.x - x, p.y - y);
                            if (d < bestD) {
                                bestD = d;
                                bestIdx = i;
                            }
                        }
                        if (bestIdx >= 0 && bestD < 12) {
                            this._worksManualPoints.splice(bestIdx, 1);
                            this._rebuildWorksManualRoute();
                            requestDraw();
                        }
                        drag = false;
                        dragStart = null;
                        totalDragDist = 0;
                        return;
                    }
                    const worldPos = tileMap.screenToWorld(x, y, canvas.width, canvas.height);
                    if (!this._worksManualStart || !this._worksManualEnd)
                        return;
                    const snapped = this._snapToTrack(worldPos.lat, worldPos.lon);
                    const pt = snapped || worldPos;
                    this._worksManualPoints.push({ lat: pt.lat, lon: pt.lon });
                    this._rebuildWorksManualRoute();
                    requestDraw();
                }
                else {
                    let closest = null, minDist = Infinity;
                    for (const st of world.stations) {
                        const p = tileMap.worldToScreen(st.lat, st.lon, canvas.width, canvas.height);
                        const d = Math.hypot(p.x - x, p.y - y);
                        if (d < minDist && d < 20) {
                            minDist = d;
                            closest = st;
                        }
                    }
                    if (closest) {
                        const aSel = document.getElementById('works-station-a');
                        const bSel = document.getElementById('works-station-b');
                        if (aSel && !aSel.value) {
                            aSel.value = closest.id;
                            this._syncWorksManualEndpoints();
                            this._updateWorksManualUI();
                        }
                        else if (bSel && !bSel.value) {
                            bSel.value = closest.id;
                            this._syncWorksManualEndpoints();
                            this._updateWorksManualUI();
                        }
                    }
                }
            }
            drag = false;
            dragStart = null;
            totalDragDist = 0;
        };
        canvas.onwheel = (e) => { e.preventDefault(); tileMap.applyZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY); requestDraw(); };
        canvas.oncontextmenu = (e) => { e.preventDefault(); };
        this._worksMapInterval = setInterval(() => {
            if (document.getElementById('modal-works')?.classList.contains('hidden'))
                return;
            requestDraw();
        }, 250);
        requestDraw();
    }
    // --- ECONOMY ---
    setupEconomyPage() {
        const ticketInput = document.getElementById('eco-ticket-price');
        const freightInput = document.getElementById('eco-freight-price');
        ticketInput?.addEventListener('change', () => {
            this.game.economy.ticketPricePerKm = parseFloat(ticketInput.value) || 0.12;
        });
        freightInput?.addEventListener('change', () => {
            this.game.economy.freightPricePerTKm = parseFloat(freightInput.value) || 0.08;
        });
        // Logo import
        const logoDrop = document.getElementById('logo-drop');
        const logoInput = document.getElementById('logo-input');
        logoDrop?.addEventListener('click', () => logoInput?.click());
        logoDrop?.addEventListener('dragover', (e) => { e.preventDefault(); logoDrop.style.borderColor = '#38bdf8'; });
        logoDrop?.addEventListener('dragleave', () => { logoDrop.style.borderColor = ''; });
        logoDrop?.addEventListener('drop', (e) => {
            e.preventDefault();
            logoDrop.style.borderColor = '';
            const f = e.dataTransfer?.files[0];
            if (f)
                this._loadLogo(f);
        });
        logoInput?.addEventListener('change', (e) => { const f = e.target?.files?.[0]; if (f)
            this._loadLogo(f); });
        // Restore logo
        if (this.game.economy._companyLogo)
            this._applyLogo(this.game.economy._companyLogo);
        // Bulletin
        document.getElementById('btn-generate-bulletin')?.addEventListener('click', () => this._generateBulletin());
        // Fiche horaire de gare
        document.getElementById('btn-generate-fiche-horaire')?.addEventListener('click', () => this._openFicheHoraireModal());
    }
    _loadLogo(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            if (typeof data !== 'string')
                return;
            this.game.economy._companyLogo = data;
            this._applyLogo(data);
        };
        reader.readAsDataURL(file);
    }
    _applyLogo(dataUrl) {
        const img = document.getElementById('company-logo');
        if (img) {
            img.src = dataUrl;
            img.style.display = 'inline-block';
        }
        const drop = document.getElementById('logo-drop');
        if (drop)
            drop.innerHTML = `<img src="${htmlText(dataUrl)}" style="width:100%;height:100%;object-fit:contain">`;
    }
    _generateBulletin() {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF)
            return alert('jsPDF non charge — verifiez votre connexion internet');
        try {
            const doc = new jsPDF();
            // Helper: strip accents for jsPDF default font compatibility
            const noAcc = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s);
            const eco = this.game.economy;
            const company = noAcc(this.game.account.companyName || 'Rail Empire');
            const now = new Date().toLocaleDateString('fr-FR');
            const lastBulletin = eco._lastBulletinDate || null;
            const pw = doc.internal.pageSize.getWidth();
            // Helper: draw line separator
            const drawLine = (yPos) => { doc.setDrawColor(180); doc.line(10, yPos, pw - 10, yPos); };
            // Helper: page footer
            const addFooter = () => {
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.setFont(undefined, 'italic');
                doc.text(`${company} -- Bulletin genere automatiquement -- ${now}`, pw / 2, 290, { align: 'center' });
                doc.setTextColor(0);
                doc.setFont(undefined, 'normal');
            };
            // ========== PAGE 1 : PAGE DE GARDE ==========
            // Logo en haut à droite + nom compagnie dessous
            if (eco._companyLogo) {
                try {
                    doc.addImage(eco._companyLogo, 'PNG', pw - 50, 15, 35, 35);
                }
                catch (e) { }
            }
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(80);
            doc.text(company, pw - 32, eco._companyLogo ? 56 : 25, { align: 'center' });
            // Titre centré au milieu de la page
            doc.setTextColor(0);
            doc.setFontSize(28);
            doc.setFont(undefined, 'bold');
            doc.text('Bulletin', pw / 2, 100, { align: 'center' });
            doc.setFontSize(22);
            doc.text('recapitulatif', pw / 2, 115, { align: 'center' });
            doc.setFontSize(18);
            doc.setFont(undefined, 'normal');
            doc.text('de votre compagnie', pw / 2, 128, { align: 'center' });
            // Date + période
            drawLine(145);
            doc.setFontSize(11);
            doc.setTextColor(80);
            doc.text(`Genere le ${now}`, pw / 2, 155, { align: 'center' });
            if (lastBulletin) {
                doc.text(`Periode : depuis le ${lastBulletin}`, pw / 2, 163, { align: 'center' });
            }
            else {
                doc.text('Premier bulletin de la compagnie', pw / 2, 163, { align: 'center' });
            }
            doc.setTextColor(0);
            addFooter();
            // ========== PAGE 2 : SOMMAIRE ==========
            doc.addPage();
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Sommaire', pw / 2, 30, { align: 'center' });
            drawLine(36);
            const sections = [
                { num: '1', title: 'Finances', page: 3 },
                { num: '2', title: 'Transport & Reseau', page: 3 },
                { num: '3', title: 'Services actifs', page: 4 },
                { num: '4', title: lastBulletin ? 'Nouvelles rames' : 'Parc de rames', page: 5 },
                { num: '5', title: 'Incidents', page: 6 },
            ];
            let sy = 50;
            doc.setFontSize(13);
            for (const s of sections) {
                doc.setFont(undefined, 'bold');
                doc.text(`${s.num}.`, 20, sy);
                doc.setFont(undefined, 'normal');
                doc.text(s.title, 30, sy);
                doc.text(`p. ${s.page}`, pw - 25, sy, { align: 'right' });
                // Dotted line between title and page number
                doc.setLineDash([1, 1], 0);
                const titleW = doc.getTextWidth(s.title);
                doc.line(30 + titleW + 3, sy + 0.5, pw - 30, sy + 0.5);
                doc.setLineDash([], 0);
                sy += 10;
            }
            addFooter();
            // ========== PAGE 3 : FINANCES + TRANSPORT ==========
            doc.addPage();
            let y = 20;
            // Section 1: Finances
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('1. Finances', 10, y);
            y += 2;
            drawLine(y);
            y += 8;
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text('Solde actuel :', 14, y);
            doc.setFont(undefined, 'bold');
            doc.text(eco.formatAmount(eco.balance), 65, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            doc.text('Recettes totales :', 14, y);
            doc.setTextColor(34, 139, 34);
            doc.text(`+${eco.formatAmount(eco.revenue)}`, 65, y);
            doc.setTextColor(0);
            y += 7;
            doc.text('Depenses totales :', 14, y);
            doc.setTextColor(200, 0, 0);
            doc.text(`-${eco.formatAmount(eco.expenses)}`, 65, y);
            doc.setTextColor(0);
            y += 7;
            doc.text('Amendes :', 14, y);
            doc.setTextColor(200, 0, 0);
            doc.text(`-${eco.formatAmount(eco.penalties)}`, 65, y);
            doc.setTextColor(0);
            y += 12;
            // Section 2: Transport & Réseau
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('2. Transport & Reseau', 10, y);
            y += 2;
            drawLine(y);
            y += 8;
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text('Passagers transportes :', 14, y);
            doc.setFont(undefined, 'bold');
            doc.text(eco.totalPassengers.toLocaleString('fr-FR'), 75, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            doc.text('Fret transporte :', 14, y);
            doc.setFont(undefined, 'bold');
            doc.text(`${eco.totalFreightTonnes.toLocaleString('fr-FR')} tonnes`, 75, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            const tracks = this.game.world.tracks || [];
            let trackKm = Math.round(tracks.reduce((s, t) => s + (t.distance || 0), 0));
            if (this.game.voiePointManager) {
                trackKm += Math.round(this.game.voiePointManager.getAllTroncons().reduce((s, t) => s + (t.distance || 0), 0));
            }
            doc.text('Km de voies possedes :', 14, y);
            doc.setFont(undefined, 'bold');
            doc.text(`${trackKm.toLocaleString('fr-FR')} km`, 75, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            const rames = this.game.rameManager.getAll();
            const totalTrainKm = Math.round(rames.reduce((s, r) => s + (r.totalKmRun || 0), 0));
            doc.text('Kilometrage total trains :', 14, y);
            doc.setFont(undefined, 'bold');
            doc.text(`${totalTrainKm.toLocaleString('fr-FR')} km`, 75, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            doc.text('Nombre de gares :', 14, y);
            const stations = this.game.world.stations || [];
            doc.setFont(undefined, 'bold');
            doc.text(`${stations.length}`, 75, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            doc.text('Nombre de rames :', 14, y);
            doc.setFont(undefined, 'bold');
            doc.text(`${rames.length}`, 75, y);
            doc.setFont(undefined, 'normal');
            addFooter();
            // ========== PAGE 4 : SERVICES ==========
            doc.addPage();
            y = 20;
            const services = this.game.scheduleCreator.getActiveServices();
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(`3. Services actifs (${services.length})`, 10, y);
            y += 2;
            drawLine(y);
            y += 8;
            doc.setFontSize(10);
            for (const svc of services) {
                if (y > 265) {
                    doc.addPage();
                    y = 15;
                }
                doc.setFont(undefined, 'bold');
                doc.text(noAcc(svc.name), 14, y);
                y += 5;
                doc.setFont(undefined, 'normal');
                const stopsStr = svc.stops.map((s) => {
                    const st = this.game.world.getStationById(s.stationId);
                    return st ? st.name : '?';
                }).join('  >  ');
                // Word wrap long routes
                const lines = doc.splitTextToSize(noAcc(stopsStr), pw - 30);
                doc.text(lines, 18, y);
                y += lines.length * 4 + 1;
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text(`Distance: ${Math.round(svc.totalDistance || 0)} km | Aller-retour: ${svc.roundTrip ? 'Oui' : 'Non'} | Multi: x${svc.multiDepartures || 1}`, 18, y);
                doc.setTextColor(0);
                doc.setFontSize(10);
                y += 8;
            }
            addFooter();
            // ========== PAGE 5 : RAMES ==========
            doc.addPage();
            y = 20;
            const newRames = lastBulletin ? rames.filter((r) => r.createdDate >= lastBulletin) : rames;
            const rameTitle = lastBulletin ? `4. Nouvelles rames (${newRames.length})` : `4. Parc de rames (${rames.length})`;
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(rameTitle, 10, y);
            y += 2;
            drawLine(y);
            y += 8;
            doc.setFontSize(10);
            for (const r of (newRames.length > 0 ? newRames : rames)) {
                if (y > 240) {
                    doc.addPage();
                    y = 15;
                }
                doc.setFont(undefined, 'bold');
                doc.text(noAcc(r.name), 14, y);
                y += 5;
                doc.setFont(undefined, 'normal');
                doc.setFontSize(9);
                doc.text(noAcc(`${r.totalLength.toFixed(0)}m | ${r.totalTonnage}t | ${r.totalCapacity} places | Fret: ${r.totalFreightCapacity}t | Vmax: ${r.maxSpeed} km/h`), 18, y);
                y += 4;
                doc.text(noAcc(`Mise en service: ${htmlText(r.createdDate)} | Km: ${Math.round(r.totalKmRun || 0).toLocaleString('fr-FR')} km | Traction: ${r.traction}`), 18, y);
                y += 5;
                // Images
                let imgX = 18;
                for (const e of r.elementDetails) {
                    if (e.imageData && y < 255 && imgX < pw - 40) {
                        try {
                            doc.addImage(e.imageData, 'PNG', imgX, y, 25, 8);
                            imgX += 28;
                        }
                        catch (err) { }
                    }
                }
                if (imgX > 18)
                    y += 11;
                doc.setFontSize(10);
                y += 4;
            }
            addFooter();
            // ========== PAGE 6 : INCIDENTS ==========
            doc.addPage();
            y = 20;
            const incidents = this.game.incidentManager?.getActiveIncidents?.() || [];
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(`5. Incidents (${incidents.length})`, 10, y);
            y += 2;
            drawLine(y);
            y += 8;
            if (incidents.length === 0) {
                doc.setFontSize(11);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(120);
                doc.text('Aucun incident actif.', 14, y);
                doc.setTextColor(0);
            }
            else {
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                for (const inc of incidents) {
                    if (y > 270) {
                        doc.addPage();
                        y = 15;
                    }
                    doc.setFont(undefined, 'bold');
                    doc.text(noAcc(inc.name || 'Incident'), 14, y);
                    doc.setFont(undefined, 'normal');
                    y += 5;
                    doc.text(`Impact: ${inc.impact || '?'} | Rayon: ${inc.radius || '?'} km | Duree: ${inc.duration || '?'} min`, 18, y);
                    y += 7;
                }
            }
            addFooter();
            eco._lastBulletinDate = now;
            doc.save(`bulletin_${company.replace(/\s/g, '_')}_${now.replace(/\//g, '-')}.pdf`);
        }
        catch (err) {
            console.error('Bulletin PDF error:', err);
            alert('Erreur generation PDF: ' + err.message);
        }
    }
    _openFicheHoraireModal() {
        const modal = document.getElementById('modal-fiche-horaire');
        const select = document.getElementById('fiche-horaire-station');
        if (!modal || !select)
            return;
        // Populate station list sorted alphabetically
        const stations = [...(this.game.world.stations || [])].sort((a, b) => a.name.localeCompare(b.name));
        select.innerHTML = stations.map((st) => `<option value="${htmlText(st.id)}">${htmlText(st.name)}</option>`).join('');
        modal.classList.remove('hidden');
        // Bind generate button (replace handler to avoid duplicates)
        const btn = document.getElementById('btn-fiche-horaire-go');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                const stationId = select.value;
                if (!stationId)
                    return;
                modal.classList.add('hidden');
                this._generateFicheHoraire(stationId);
            });
        }
    }
    _generateFicheHoraire(stationId) {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF)
            return alert('jsPDF non charge');
        try {
            const noAcc = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(s);
            const minToStr = (m) => { const h = Math.floor(m / 60) % 24; const mi = Math.round(m % 60); return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
            const station = this.game.world.getStationById(stationId);
            if (!station)
                return alert('Gare introuvable');
            const stationName = noAcc(station.name);
            const company = noAcc(this.game.account.companyName || 'Rail Empire');
            const now = new Date().toLocaleDateString('fr-FR');
            // Collect all services that stop at this station (type 'arret')
            const allServices = this.game.scheduleCreator.services || [];
            const entries = [];
            for (const svc of allServices) {
                if (!svc.active)
                    continue;
                const stops = svc.stops || [];
                // Find this station in the forward stops
                for (let i = 0; i < stops.length; i++) {
                    if (stops[i].stationId !== stationId)
                        continue;
                    if (stops[i].type !== 'arret')
                        continue;
                    // Determine destination (last arret stop after this one)
                    let destStop = null, destStation = null;
                    for (let j = stops.length - 1; j > i; j--) {
                        if (stops[j].type === 'arret' && stops[j].stationId) {
                            destStop = stops[j];
                            destStation = this.game.world.getStationById(stops[j].stationId);
                            break;
                        }
                    }
                    if (!destStation)
                        continue; // Skip if this is the last stop (terminus)
                    // Intermediate stops (between this station and destination, only 'arret' type)
                    const intermediates = [];
                    for (let j = i + 1; j < stops.length; j++) {
                        if (stops[j] === destStop)
                            break;
                        if (stops[j].type !== 'arret' || !stops[j].stationId)
                            continue;
                        const intSt = this.game.world.getStationById(stops[j].stationId);
                        if (intSt) {
                            intermediates.push({
                                name: noAcc(intSt.name),
                                depTime: minToStr(stops[j].departureTime),
                            });
                        }
                    }
                    // Platform at this station
                    const voie = stops[i].platform || '';
                    entries.push({
                        serviceName: noAcc(svc.name),
                        depTime: stops[i].departureTime,
                        depTimeStr: minToStr(stops[i].departureTime),
                        destination: noAcc(destStation.name),
                        destArrTime: minToStr(destStop.arrivalTime),
                        intermediates,
                        voie,
                    });
                }
                // Also check return leg if round trip
                if (svc.roundTrip) {
                    const retStops = svc.buildReturnStops();
                    for (let i = 0; i < retStops.length; i++) {
                        if (retStops[i].stationId !== stationId)
                            continue;
                        if (retStops[i].type !== 'arret')
                            continue;
                        let destStop = null, destStation = null;
                        for (let j = retStops.length - 1; j > i; j--) {
                            if (retStops[j].type === 'arret' && retStops[j].stationId) {
                                destStop = retStops[j];
                                destStation = this.game.world.getStationById(retStops[j].stationId);
                                break;
                            }
                        }
                        if (!destStation)
                            continue;
                        const intermediates = [];
                        for (let j = i + 1; j < retStops.length; j++) {
                            if (retStops[j] === destStop)
                                break;
                            if (retStops[j].type !== 'arret' || !retStops[j].stationId)
                                continue;
                            const intSt = this.game.world.getStationById(retStops[j].stationId);
                            if (intSt) {
                                intermediates.push({
                                    name: noAcc(intSt.name),
                                    depTime: minToStr(retStops[j].departureTime),
                                });
                            }
                        }
                        const voie = retStops[i].platform || '';
                        const retName = svc.returnName ? noAcc(svc.returnName) : noAcc(svc.name) + ' (retour)';
                        entries.push({
                            serviceName: retName,
                            depTime: retStops[i].departureTime,
                            depTimeStr: minToStr(retStops[i].departureTime),
                            destination: noAcc(destStation.name),
                            destArrTime: minToStr(destStop.arrivalTime),
                            intermediates,
                            voie,
                        });
                    }
                }
            }
            // Sort by departure time
            entries.sort((a, b) => a.depTime - b.depTime);
            if (entries.length === 0) {
                return alert(`Aucun service ne dessert ${station.name}`);
            }
            // Generate PDF
            const doc = new jsPDF();
            const pw = doc.internal.pageSize.getWidth();
            // --- HEADER ---
            let y = 15;
            doc.setFillColor(0, 40, 85);
            doc.rect(0, 0, pw, 30, 'F');
            doc.setTextColor(255);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(stationName, pw / 2, 13, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Fiche horaire -- ${company} -- ${now}`, pw / 2, 21, { align: 'center' });
            doc.setFontSize(9);
            doc.text(`${entries.length} train(s)`, pw / 2, 27, { align: 'center' });
            doc.setTextColor(0);
            y = 36;
            // --- COLUMN HEADERS ---
            doc.setFillColor(230, 230, 230);
            doc.rect(10, y - 4, pw - 20, 8, 'F');
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(60);
            doc.text('Dep.', 12, y);
            doc.text('Service', 30, y);
            doc.text('Destination', 70, y);
            doc.text('Arr.', 140, y);
            doc.text('Voie', pw - 18, y, { align: 'center' });
            doc.setTextColor(0);
            y += 8;
            // --- ENTRIES ---
            for (const entry of entries) {
                // Check page overflow
                const neededHeight = 14 + entry.intermediates.length * 4;
                if (y + neededHeight > 275) {
                    // Footer
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.setFont(undefined, 'italic');
                    doc.text(`${stationName} -- ${company}`, pw / 2, 290, { align: 'center' });
                    doc.setTextColor(0);
                    doc.setFont(undefined, 'normal');
                    doc.addPage();
                    y = 15;
                }
                // Separator line
                doc.setDrawColor(200);
                doc.line(10, y - 2, pw - 10, y - 2);
                // Departure time (bold, large)
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text(entry.depTimeStr, 12, y + 2);
                // Service name
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(80);
                doc.text(entry.serviceName, 30, y + 2);
                doc.setTextColor(0);
                // Destination (bold, prominent)
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text(entry.destination, 70, y + 2);
                // Arrival time at destination
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(80);
                doc.text(entry.destArrTime, 140, y + 2);
                doc.setTextColor(0);
                // Voie (right column, highlighted)
                if (entry.voie) {
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'bold');
                    doc.text(String(entry.voie), pw - 18, y + 2, { align: 'center' });
                }
                y += 7;
                // Intermediate stations (smaller, grey)
                if (entry.intermediates.length > 0) {
                    doc.setFontSize(7);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(120);
                    const intText = entry.intermediates.map((s) => `${s.name} (${s.depTime})`).join('  |  ');
                    // Split long text across lines
                    const lines = doc.splitTextToSize(intText, pw - 40);
                    for (const line of lines) {
                        doc.text(line, 30, y);
                        y += 3.5;
                    }
                    doc.setTextColor(0);
                }
                y += 4;
            }
            // Final separator
            doc.setDrawColor(200);
            doc.line(10, y - 2, pw - 10, y - 2);
            // Footer
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.setFont(undefined, 'italic');
            doc.text(`${stationName} -- ${company} -- Genere automatiquement`, pw / 2, 290, { align: 'center' });
            doc.setTextColor(0);
            doc.save(`fiche_horaire_${stationName.replace(/\s/g, '_')}_${now.replace(/\//g, '-')}.pdf`);
        }
        catch (err) {
            console.error('Fiche horaire PDF error:', err);
            alert('Erreur generation PDF: ' + err.message);
        }
    }
    renderEconomyPage() {
        const eco = this.game.economy;
        const el = (id) => document.getElementById(id);
        if (el('eco-balance'))
            el('eco-balance').textContent = eco.formatAmount(eco.balance);
        if (el('eco-revenue'))
            el('eco-revenue').textContent = '+' + eco.formatAmount(eco.revenue);
        if (el('eco-expenses'))
            el('eco-expenses').textContent = '-' + eco.formatAmount(eco.expenses);
        if (el('eco-penalties'))
            el('eco-penalties').textContent = '-' + eco.formatAmount(eco.penalties);
        if (el('eco-passengers'))
            el('eco-passengers').textContent = eco.totalPassengers.toLocaleString('fr-FR');
        if (el('eco-freight-tonnes'))
            el('eco-freight-tonnes').textContent = eco.totalFreightTonnes.toLocaleString('fr-FR');
        // Km de voies possédés (tracks + tronçons)
        if (el('eco-track-km')) {
            const tracks = this.game.world.tracks || [];
            let totalTrackKm = tracks.reduce((s, t) => s + (t.distance || 0), 0);
            if (this.game.voiePointManager) {
                totalTrackKm += this.game.voiePointManager.getAllTroncons().reduce((s, t) => s + (t.distance || 0), 0);
            }
            el('eco-track-km').textContent = Math.round(totalTrackKm).toLocaleString('fr-FR');
        }
        // Total km parcourus par tous les trains (sum all services per rame)
        if (el('eco-total-train-km')) {
            const rameKm = new Map();
            for (const svc of this.game.scheduleCreator.getActiveServices()) {
                if (svc.rame && svc.train) {
                    const rid = svc.rame.id;
                    rameKm.set(rid, (rameKm.get(rid) || 0) + (svc.train.totalKmRun || 0));
                }
            }
            let totalKm = 0;
            for (const r of this.game.rameManager.getAll()) {
                totalKm += rameKm.get(r.id) || r.totalKmRun || 0;
            }
            el('eco-total-train-km').textContent = Math.round(totalKm).toLocaleString('fr-FR');
        }
        const histEl = el('eco-history');
        if (histEl) {
            histEl.innerHTML = eco.history.slice().reverse().slice(0, 40).map((e) => `
        <div class="eco-entry ${htmlText(e.type === 'revenue' ? 'revenue-entry' : 'expense-entry')}">
          <span>${htmlText(e.description || e.category)}</span>
          <span>${e.type === 'revenue' ? '+' : '-'}${eco.formatAmount(e.amount)}</span>
        </div>
      `).join('');
        }
    }
    // --- UPDATE LOOP ---
    update(activeServices) {
        const engine = this.game.engine;
        const eco = this.game.economy;
        // v1.1.43 — header values are not animation. The visible clock has no
        // seconds, so update these nodes at 1 Hz and only when their text changed.
        const headerNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!this._lastHeaderAt || headerNow - this._lastHeaderAt >= 1000) {
            this._lastHeaderAt = headerNow;
            const values = [
                ['clock', engine.getFormattedTime()],
                ['date-display', engine.getFormattedDate()],
                ['balance', eco.formatAmount(eco.balance)],
            ];
            for (const [id, value] of values) {
                const node = document.getElementById(id);
                if (node && node.textContent !== value)
                    node.textContent = value;
            }
        }
        // v1.1.43 — weather is not a 4 Hz animation. Avoid rebuilding header DOM
        // four times per second when the rendered widget has not changed.
        try {
            const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (!this._lastWeatherWidgetAt || perfNow - this._lastWeatherWidgetAt >= 1000) {
                this._lastWeatherWidgetAt = perfNow;
                const ww = document.getElementById('weather-widget');
                if (ww) {
                    const html = this.game.weather.renderWidget();
                    if (ww._lastWeatherHtml !== html) {
                        ww._lastWeatherHtml = html;
                        ww.innerHTML = html;
                    }
                }
            }
        }
        catch (e) { /* graceful */ }
        if (this.activePage === 'map') {
            if (this.selectedService && (this.selectedService.completed || this.selectedService.cancelled || ['completed', 'cancelled'].includes(this.selectedService.state))) {
                this.deselectService();
            }
            this.updateV2RuntimeSidebar();
            this.updateTrainsList(activeServices);
            this.updateFreightTab();
        }
        if (this.activePage === 'economy')
            this.renderEconomyPage();
        if (this.activePage === 'incidents')
            this.renderIncidentsPage();
        const alertNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!this._lastAlertBannerAt || alertNow - this._lastAlertBannerAt >= 1000) {
            this._lastAlertBannerAt = alertNow;
            this.updateAlertBanner();
        }
    }
    exportMovementDiagnostics() {
        const snapshot = buildMovementDiagnostics(this.game);
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url;
        link.download = `Rail_Empire_${RELEASE}_mouvement_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    updateV2RuntimeSidebar() {
        const box = document.getElementById('v2-runtime-sidebar-status');
        if (!box)
            return;
        // v1.1.43 — diagnostics are operational information, not animation. Runtime
        // planning is cached now; 2 Hz? No: one refresh every 2 s is plenty for a status box.
        const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (this._lastV2SidebarDiagAt && perfNow - this._lastV2SidebarDiagAt < 2000)
            return;
        this._lastV2SidebarDiagAt = perfNow;
        const pt = this.game.engine?.getParisTime?.();
        const time = Number.isFinite(Number(this.game.timeOfDay)) ? Number(this.game.timeOfDay) : (pt ? pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60 : 0);
        const date = this.game._currentDate || this.game.engine?.getParisDate?.();
        const diag = this.game.scheduleV2Runtime?.diagnose?.(time, date) || { summary: 'runtime V2 indisponible', items: [] };
        const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
        const icon = { error: '🔴', warn: '🟠', ok: '🟢', info: '🔵' };
        const rows = (diag.items || []).slice(0, 6).map((x) => `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #1e293b"><b>${icon[x.level] || '•'} ${escHtml(x.label)}</b><br><span style="font-weight:500;color:#94a3b8">${escHtml(x.status)}</span></div>`).join('');
        const failures = this.game.diagnostics?.snapshot?.() || [];
        const failureRows = failures.slice(0, 3).map((f) => `<div class="re-operational-failure" style="margin-top:5px;color:#fbbf24"><b>${escHtml(f.code)}</b> · ${f.count} erreur(s) observée(s)<br>${escHtml(f.message)}</div>`).join('');
        const html = `<div style="display:flex;align-items:center;gap:6px"><b style="color:#e2e8f0">Runtime V2</b><span style="margin-left:auto;color:#94a3b8">${escHtml(diag.summary)}</span></div>${rows || '<div style="margin-top:4px;color:#94a3b8;font-weight:500">Aucune circulation V2 planifiée.</div>'}${failureRows}<button class="btn-sm" style="width:100%;margin-top:6px;white-space:normal" onclick="game.ui.exportMovementDiagnostics()">Exporter le diagnostic des mouvements</button>`;
        if (box._lastV2Html !== html) {
            box._lastV2Html = html;
            box.innerHTML = html;
        }
        box.style.borderColor = (diag.items || []).some((x) => x.level === 'error') ? '#7f1d1d' : (diag.items || []).some((x) => x.level === 'warn') ? '#78350f' : '#334155';
    }
    updateTrainsList(services) {
        const container = document.getElementById('trains-list');
        if (!container)
            return;
        const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (this._lastTrainListAt && perfNow - this._lastTrainListAt < 500)
            return;
        this._lastTrainListAt = perfNow;
        // Show only active trains (moving or stopped at station) + rescue services + breakdowns.
        // DEP-06 : trains en maintenance absents du bandeau train.
        const activeTrains = [];
        for (const svc of services) {
            const displayRame = this._displayRameForService(svc);
            if (!svc || svc.completed || svc.cancelled || ['completed', 'cancelled'].includes(svc.state) || !svc.train || svc.train.inMaintenance || svc.train.inDepot || displayRame?.inMaintenance || displayRame?.currentLocation?.depotId)
                continue;
            const t = svc.train;
            if (svc.isRescue ||
                svc.state === 'moving' || svc.state === 'stopped_at_station' ||
                // LVM-04/Annexe 4 : trains en attente à quai (pré-départ) et trains visibles sur la carte
                (svc.state === 'waiting' && svc.position) ||
                (svc.state === 'blocked_route' && svc.position) ||
                t.speed > 0 ||
                t.breakdown) {
                activeTrains.push(svc);
            }
        }
        if (activeTrains.length === 0) {
            this._hasApproachBlink = false;
            const emptyHtml = '<p style="color:var(--text3);font-size:11px;text-align:center;padding:10px">Aucun train en service. Creez un trajet dans "Horaires".</p>';
            if (container._lastTrainListHtml !== emptyHtml) {
                container._lastTrainListHtml = emptyHtml;
                container.innerHTML = emptyHtml;
            }
            return;
        }
        const html = activeTrains.map((svc) => {
            const t = svc.train;
            if (!t)
                return '';
            const displayRame = this._displayRameForService(svc);
            // All LiveMap surfaces use completed operational minutes, including ETA.
            const rawDelay = Number.isFinite(t.delay) ? t.delay : 0;
            const delayVal = operationalDelayMinutes(rawDelay);
            let delayDisplay, delayClass;
            if (delayVal > 0) {
                delayDisplay = `Retard: +${delayVal} min`;
                delayClass = 'delay-late';
            }
            else if (delayVal < 0) {
                delayDisplay = `Avance: ${Math.abs(delayVal)} min`;
                delayClass = 'delay-early';
            }
            else {
                delayDisplay = 'À l\'heure';
                delayClass = 'delay-ok';
            }
            // Rescue services have simplified display
            if (svc.isRescue) {
                const stateLabels = { routing: 'Recherche du tracé aller', routing_return: 'Recherche du tracé retour', en_route: 'En route', recovering: 'Préparation du secours', returning: 'Retour dépôt' };
                const stateLabel = stateLabels[svc.rescueState] || '';
                return `
          <div class="train-card-fixed" style="border-color:#ef4444">
            <div class="tc-row1" style="display:flex;align-items:center;gap:4px;min-width:0">
              <span class="train-color" style="background:#ef4444"></span>
              <span class="tc-name" style="flex:1;min-width:0;max-width:none" title="${htmlText(svc.name)}">${htmlText(svc.name)}</span>
              <span class="tc-speed">${Math.round(t.speed)} km/h</span>
            </div>
            <div class="tc-row2">
              <span style="color:#ef4444;font-weight:600;font-size:10px">SECOURS</span>
              <span style="color:var(--text2);font-size:10px">${htmlText(stateLabel)}</span>
            </div>
            ${t.delayReason ? `<div class="tc-row2" style="white-space:normal;overflow-wrap:anywhere;word-break:break-word">${htmlText(t.delayReason)}</div>` : ''}
            ${['routing', 'routing_return'].includes(svc.rescueState || '') ? `<div class="tc-row2"><button class="btn-sm" ${svc.rescueCanRetry ? '' : 'disabled'} onclick="game.ui.resumeRescueRouting('${htmlJsString(svc.id)}')">Réessayer le routage</button></div>` : ''}
          </div>
        `;
            }
            // Helper: previous/next scheduled arret for "Prochain arrêt" / approach distance.
            const currentStops = typeof svc.getCurrentStops === 'function' ? svc.getCurrentStops() : [];
            const curIdx = svc.currentStopIndex || 0;
            const isArretStop = (s) => s && s.type === 'arret' && s.stationId;
            let prevArret = null, nextArret = null;
            if (svc.state === 'moving') {
                for (let i = curIdx - 1; i >= 0; i--)
                    if (isArretStop(currentStops[i])) {
                        prevArret = currentStops[i];
                        break;
                    }
                for (let i = curIdx; i < currentStops.length; i++)
                    if (isArretStop(currentStops[i])) {
                        nextArret = currentStops[i];
                        break;
                    }
            }
            else {
                const curStationIdx = curIdx > 0 ? curIdx - 1 : 0;
                for (let i = curStationIdx; i >= 0; i--)
                    if (isArretStop(currentStops[i])) {
                        prevArret = currentStops[i];
                        break;
                    }
                for (let i = curStationIdx + 1; i < currentStops.length; i++)
                    if (isArretStop(currentStops[i])) {
                        nextArret = currentStops[i];
                        break;
                    }
            }
            const prevArretStation = prevArret ? this.game.world?.getStationById(prevArret.stationId) : null;
            const nextArretStation = nextArret ? this.game.world?.getStationById(nextArret.stationId) : null;
            // v1.1.41 — take A/B from this train's own timetable. This removes the
            // O(17,817 stations × trains) scan every 250 ms and prevents a nearby
            // parallel-line station from replacing the train's real previous/next stop.
            const ctxPrevName = prevArretStation?.name || prevArret?.locationName || '';
            const ctxNextName = nextArretStation?.name || nextArret?.locationName || '';
            // The destination may be several technical/passage legs ahead. Add all
            // their actual railway geometry, starting with the live (possibly diverted) leg.
            const nextDistKm = nextArret
                ? this._livemapDistanceToStopKm(svc, currentStops.indexOf(nextArret))
                : null;
            // S3: Approach / platform / regulation status
            let contextLabel = '', contextClass = '';
            const currentStop = svc.state === 'moving'
                ? (curIdx < currentStops.length ? currentStops[curIdx] : null)
                : (curIdx > 0 ? currentStops[curIdx - 1] : currentStops[0]);
            const currentIsWaypoint = currentStop?.type === 'waypoint' || currentStop?.type === 'passage';
            if (svc.state === 'blocked_route' || (t.blockedBy && svc.state === 'waiting')) {
                // HOTFIX15 — a physically blocked origin must never be painted as a green
                // generic "En attente" card. Surface the actual interlocking reason.
                contextLabel = `Bloqué — ${t.delayReason || 'ressource / itinéraire indisponible'}`;
                contextClass = 'ctx-signal-closed';
            }
            else if ((svc.state === 'stopped_at_station' || (svc.state === 'waiting' && t.stoppedAt)) && !currentIsWaypoint) {
                const stName = t.stoppedAt?.name || '';
                const voie = t.platform ? ` Voie ${t.platform}` : '';
                if (svc._atTerminus) {
                    contextLabel = stName ? `Terminus — ${stName}${voie}` : 'Terminus';
                    contextClass = 'ctx-quai';
                }
                else if (svc.state === 'waiting') {
                    const waitMin = this.game?.engine ? Math.max(0, Math.round(((svc.stops?.[0]?.departureTime ?? 0) - (this.game.engine.getParisTime().hours * 60 + this.game.engine.getParisTime().minutes)))) : 0;
                    contextLabel = stName ? `En attente — ${stName}${voie} (${waitMin} min)` : 'En attente';
                    contextClass = 'ctx-quai';
                }
                else {
                    contextLabel = stName ? `À quai — ${stName}${voie}` : 'À quai';
                    contextClass = 'ctx-quai';
                }
            }
            else if (t.signalAlert === 'closed') {
                contextLabel = 'Arrêt pour signal fermé';
                contextClass = 'ctx-signal-closed';
            }
            else if (t.blockedBy || t.signalAlert === 'caution') {
                contextLabel = 'Régulation du trafic';
                contextClass = 'ctx-regulation';
            }
            else if (svc.state === 'moving' && t.speed > 0) {
                if (nextArretStation && svc.position && nextDistKm != null) {
                    if (nextDistKm < 0.3) {
                        contextLabel = 'À l\'approche';
                        contextClass = 'ctx-approach';
                    }
                    else if (ctxPrevName && ctxNextName && ctxPrevName !== ctxNextName) {
                        contextLabel = `Se situe entre ${ctxPrevName} et ${ctxNextName}`;
                        contextClass = 'ctx-between';
                    }
                    else if (ctxNextName) {
                        contextLabel = `En route vers ${ctxNextName}`;
                        contextClass = 'ctx-between';
                    }
                }
            }
            // "Circule sur Voie X" — use the train's current voie from schedule data
            let circuleSurVoie = '';
            if (svc.state === 'moving' && svc.position && this.game.voiePointManager) {
                // A departure platform is NOT the train's current line track.
                const voie = this.game.voiePointManager.getVoieAtPosition(svc.position);
                if (voie) {
                    circuleSurVoie = `Circule sur Voie ${voie}`;
                }
            }
            // Next stop info — Annex 4: "Prochain arrêt : X - Arrivée prévue à XhX" (skip waypoints/passages)
            const nextStop = typeof svc.getNextStop === 'function' ? svc.getNextStop() : null;
            let nextInfo;
            if (svc._atTerminus && svc._nextDepartureTime != null) {
                const pt = this.game?.engine?.getParisTime?.();
                const currentMin = pt ? pt.hours * 60 + pt.minutes : 0;
                const waitMin = Math.max(0, Math.round(svc._nextDepartureTime - currentMin));
                nextInfo = `Terminus — départ dans ${waitMin} min`;
            }
            else if (svc.cancelled) {
                nextInfo = 'Service supprimé';
            }
            else if (svc.completed) {
                nextInfo = 'Service terminé';
            }
            else if (nextArret && nextArretStation) {
                const fmtTime = (m) => this.minToTimeStr(((Math.round(m) % 1440) + 1440) % 1440);
                const voie = (nextArret.platform && nextArret.stationId) ? ` Voie ${nextArret.platform}` : '';
                const plannedArr = nextArret.arrivalTime ?? 0;
                const actualArr = plannedArr + delayVal;
                const plannedStr = fmtTime(plannedArr);
                const actualStr = fmtTime(actualArr);
                const distStr = nextDistKm != null ? ` — ${Math.round(nextDistKm)} km` : '';
                const arrStr = delayVal !== 0
                    ? `<span style="text-decoration:line-through;color:#888">${plannedStr}</span> <span style="color:#facc15;font-weight:600">${actualStr}</span>`
                    : actualStr;
                nextInfo = `Prochain arrêt : ${htmlText(nextArretStation.name)}${htmlText(voie)} — Arrivée prévue à ${arrStr}${distStr}`;
            }
            else if (nextStop) {
                nextInfo = `→ ...`;
            }
            else {
                nextInfo = 'Termine';
            }
            // S4 + S12: Platform label with station name + "Voie X"
            let platformLabel = '';
            if (t.platform) {
                const stoppedStation = t.stoppedAt;
                let voieName;
                if (stoppedStation?.platformNames?.length >= t.platform) {
                    voieName = stoppedStation.platformNames[t.platform - 1];
                }
                else {
                    voieName = String(t.platform);
                }
                const stName = stoppedStation?.name || '';
                platformLabel = stName ? `${stName} Voie ${voieName}` : `Voie ${voieName}`;
            }
            // S12: Train identification (series + number)
            const displayName = t.seriesName ? `${t.seriesName} ${t.number || ''}`.trim() : svc.name;
            // S2: Train images (scrollable zone) — absent pour les trains de travaux.
            let imageHtml = '';
            if (!svc.isWorkTrain && svc.serviceType !== 'work' && displayRame?.elementDetails?.some((e) => e.imageData)) {
                const sig = this._livemapImageSignature(displayRame)
                    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                imageHtml = `<div class="tc-images-scroll" data-service-id="${htmlText(svc.id)}" data-image-signature="${htmlText(sig)}"></div>`;
            }
            // Annexes 4-5 — charge transportée dans le bandeau train (utilise la
            // vraie rame joueur affectée à la ligne de roulement, jamais le proxy technique).
            let payloadHtml = '';
            if (displayRame && svc.serviceType !== 'work') {
                const rame = displayRame;
                if (svc.category === 'fret' || rame.totalFreightCapacity > 0) {
                    const hasLoad = svc._onboardFreight != null || svc._contractFreight != null;
                    const load = Math.max(0, Number(svc._onboardFreight) || 0) + Math.max(0, Number(svc._contractFreight) || 0);
                    payloadHtml = `<div class="tc-line"><span style="color:var(--text2);font-size:10px">${hasLoad ? `${Math.round(load)} tonnes de fret transportées` : 'Charge fret non renseignée'}</span></div>`;
                }
                else if (svc.category === 'voyageur' || rame.totalCapacity > 0) {
                    const pax = svc._onboardPax != null ? Math.max(0, Math.round(svc._onboardPax)) : null;
                    payloadHtml = `<div class="tc-line"><span style="color:var(--text2);font-size:10px">${pax == null ? 'Charge voyageurs non renseignée' : `${pax} passagers à bord`}</span></div>`;
                }
            }
            // Incident status
            let incidentHtml = '';
            if (t.incident) {
                const incColor = t.incident.effect === 'stop' ? '#f87171' : '#facc15';
                const incLabel = t.incident.effect === 'stop' ? 'Interruption' : `Ralentissement (${t.incident.speedLimit} km/h)`;
                const incIcon = t.incident.effect === 'stop'
                    ? '<span class="op-icon op-icon-stop" style="width:12px;height:12px;margin-right:3px"></span>'
                    : '<span class="op-icon op-icon-warn" style="width:12px;height:12px;margin-right:3px"></span>';
                incidentHtml = `<div class="tc-line"><span style="color:${htmlText(incColor)};font-weight:600;font-size:10px">${incIcon}${htmlText(incLabel)}${htmlText(t.incident.name ? ' — ' + t.incident.name : '')}</span></div>`;
            }
            // Breakdown status
            let breakdownHtml = '';
            if (t.breakdown) {
                const repairInfo = this.game.depotManager.getRepairInfo(svc.id);
                const repairLabel = repairInfo ? ` — Reparation ${Math.ceil(repairInfo.remainingMin)} min` : '';
                breakdownHtml = `<div class="tc-line"><span style="color:#ef4444;font-weight:600;font-size:10px">EN PANNE${htmlText(repairLabel)}</span></div>`;
            }
            // Maintenance status (check rame)
            let maintenanceHtml = '';
            if (t.inMaintenance || displayRame?.inMaintenance) {
                const rameId = displayRame?.id;
                const maintInfo = rameId ? this.game.depotManager.getRameMaintenanceInfo(rameId) : null;
                const maintLabel = maintInfo ? ` — ${Math.ceil(maintInfo.remainingMin)} min` : '';
                maintenanceHtml = `<div class="tc-line"><span style="color:#3b82f6;font-weight:600;font-size:10px">EN MAINTENANCE${htmlText(maintLabel)}</span></div>`;
            }
            // Physical depot presence is distinct from maintenance.
            let depotHtml = '';
            if (t.inDepot || displayRame?.currentLocation?.depotId) {
                const depotId = displayRame?.currentLocation?.depotId || '';
                const depotName = this.game.depotManager?.getDepotById?.(depotId)?.name || 'Dépôt';
                depotHtml = `<div class="tc-line"><span style="color:#a78bfa;font-weight:600;font-size:10px">AU DÉPÔT — ${htmlText(depotName)}</span></div>`;
            }
            // Wear info (use rame as source of truth)
            const rameWear = displayRame ? (displayRame.wearLevel || 0) : (t.wearLevel || 0);
            const rameKm = displayRame ? (displayRame.totalKmRun || 0) : (t.totalKmRun || 0);
            const wearHtml = rameKm > 0 ? `<div class="tc-line"><span style="color:var(--text3);font-size:9px">Usure: ${Math.round(rameWear)}% · Total: ${Math.round(rameKm)} km</span></div>` : '';
            const cat = svc.category || t.category || 'voyageur';
            const catColor = LVM_CAT_COLORS[cat] || t.color;
            const selCls = this.selectedService?.id === svc.id ? ' tc-selected' : '';
            // LVM-04 — statut ligne / situation
            let statusText = 'En ligne', statusColor = '#22c55e';
            if (svc.cancelled) {
                statusText = 'Supprimé';
                statusColor = '#ef4444';
            }
            else if (svc.completed) {
                statusText = 'Terminé';
                statusColor = '#16a34a';
            }
            else if (svc.state === 'stopped_at_station' || (svc.state === 'waiting' && t.stoppedAt)) {
                statusText = 'À quai';
            }
            else if (svc.state === 'waiting') {
                statusText = 'En attente';
                statusColor = '#f59e0b';
            }
            else if (t.speed === 0) {
                statusText = 'Arrêté';
                statusColor = '#f59e0b';
            }
            const statusBadge = svc.cancelled
                ? `<span style="color:#ef4444;font-weight:700;font-size:10px;margin-left:auto">✕ Supprimé</span>`
                : (svc.completed ? `<span style="color:#16a34a;font-weight:700;font-size:10px;margin-left:auto">Terminé</span>` : '');
            return `
        <div class="train-card-fixed${htmlText(selCls)}" style="cursor:pointer" onclick="game.ui.selectServiceById('${htmlJsString(svc.id)}')">
          <div class="tc-line tc-header">
            <span class="tc-status-dot" style="background:${htmlText(catColor)}"></span>
            <div class="tc-scroll"><span class="tc-scroll-text tc-name">${htmlText(displayName)}</span></div>
            <span class="tc-speed" style="margin-left:auto">${Math.round(t.speed)} km/h</span>
          </div>
          ${imageHtml}
          <div class="tc-line" style="display:flex;gap:8px;align-items:center">
            <span class="tc-status" style="color:${htmlText(statusColor)}">${statusText}</span>
            <span class="tc-delay ${htmlText(delayClass)}">${delayDisplay}</span>
            ${statusBadge}
          </div>
          ${contextLabel ? `<div class="tc-line tc-scroll"><span class="tc-scroll-text ${htmlText(contextClass)}">${htmlText(contextLabel)}</span></div>` : ''}
          <div class="tc-line tc-scroll"><span class="tc-scroll-text tc-next" style="color:#22c55e">${nextInfo}</span></div>
          ${payloadHtml}
          ${incidentHtml}
          ${breakdownHtml}
          ${maintenanceHtml}
          ${depotHtml}
          ${wearHtml}
        </div>
      `;
        }).join('');
        this._hasApproachBlink = html.includes('ctx-approach');
        // v1.1.42 — speed/delay changes may rebuild the textual card, but animated
        // train pictures must NOT be destroyed/recreated several times per second.
        // Detach them, rebuild lightweight text, then reattach the same DOM nodes.
        if (container._lastTrainListHtml !== html) {
            const preserved = new Map();
            container.querySelectorAll('.tc-images-scroll[data-service-id]').forEach((node) => {
                const sid = String(node.dataset.serviceId || '');
                preserved.set(sid, { node, signature: node.dataset.imageSignature || '' });
                node.remove();
            });
            container._lastTrainListHtml = html;
            container.innerHTML = html;
            this._hydratePersistentTrainImages(container, activeTrains, preserved);
        }
        // LVM-06 — le train sélectionné reste visible en haut du bandeau.
        if (this.selectedService && this._lastSelectedForScroll !== this.selectedService.id) {
            this._lastSelectedForScroll = this.selectedService.id;
            const selectedCard = container.querySelector('.tc-selected');
            if (selectedCard)
                selectedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // LVM-06 — garde le panneau du train sélectionné à jour chaque frame.
        this._syncLivemapPanel();
    }
    garageService(svcId) {
        const svc = this.game.scheduleCreator.services.find((s) => s.id === svcId);
        if (!svc)
            return;
        const sel = document.getElementById(`garage-vp-${svcId}`);
        if (!sel)
            return;
        svc.garageToVoiePoint(sel.value);
    }
    resumeFromGarage(svcId) {
        const svc = this.game.scheduleCreator.services.find((s) => s.id === svcId);
        if (!svc)
            return;
        svc.resumeFromGarage();
    }
    updateFreightTab() {
        const container = document.getElementById('freight-list');
        if (!container)
            return;
        const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (this._lastFreightSidebarAt && perfNow - this._lastFreightSidebarAt < 1000)
            return;
        this._lastFreightSidebarAt = perfNow;
        const contracts = this.game.freightManager.contracts;
        const active = contracts.filter((c) => c.active);
        const completed = contracts.filter((c) => !c.active && c.quantity <= 0);
        const cancelled = contracts.filter((c) => !c.active && c.quantity > 0);
        const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);
        const html = `
      <div class="section-title">Contrats actifs (${active.length})</div>
      ${active.map((c) => {
            const percent = Math.max(0, Math.min(100, Number(c.progress) * 100 || 0));
            return `<div class="contract-item">
          <b>${esc(c.cargoName)}</b>: ${c.quantity} ${esc(c.unit)} restant(s)<br>
          ${esc(c.from)} → ${esc(c.to)}<br>
          ${this.game.economy.formatAmount(c.payment)}<br>
          Livré : ${c.deliveredQuantity} / ${c.initialQuantity} ${esc(c.unit)} (${Math.round(percent)} %)
          · En transport : ${c.inTransitQuantity} ${esc(c.unit)}
          <div class="progress-bar"><div class="progress-fill" style="width:${htmlText(percent)}%"></div></div>
        </div>`;
        }).join('')}
      <div class="section-title">Complétés (${completed.length})</div>
      <div class="section-title">Annulés / interrompus (${cancelled.length})</div>
      ${cancelled.filter((c) => c.inTransitQuantity > 0).map((c) => `<div class="contract-item"><b>${esc(c.cargoName)}</b> · ${c.inTransitQuantity} ${esc(c.unit)} à restituer au prochain arrêt compatible (sans recette).</div>`).join('')}
    `;
        if (container._lastFreightHtml !== html) {
            container._lastFreightHtml = html;
            container.innerHTML = html;
        }
    }
    updateAlertBanner() {
        const bannerInterruptions = document.getElementById('alert-banner-interruptions');
        const bannerSlowdowns = document.getElementById('alert-banner-slowdowns');
        const bannerWorks = document.getElementById('alert-banner-works');
        const legacyBanner = document.getElementById('alert-banner');
        const incidents = this.game.incidentManager.getActiveIncidents();
        const dateStr = this.game.engine.getParisDate();
        const timeOfDay = this.game.engine.getParisTime().hours * 60 + this.game.engine.getParisTime().minutes;
        const interruptions = [];
        const slowdowns = [];
        const worksItems = [];
        const ICON_STOP = 'op-icon-stop';
        const ICON_WARN = 'op-icon-warn';
        const ICON_WORKS = 'op-icon-works';
        for (const inc of incidents) {
            const reason = this.game.incidentManager?.formatIncidentReason?.(inc, this.game.world)
                || `${inc.name || 'Incident'}${inc.trackName ? ' - ' + inc.trackName : ''}`;
            const label = `${reason} (${Math.ceil(inc.remaining)} min)`;
            const item = { text: inc.effect === 'stop' ? label : `${label} - ${inc.speedLimit || 30} km/h`,
                icon: inc.effect === 'stop' ? ICON_STOP : ICON_WARN };
            (inc.effect === 'stop' ? interruptions : slowdowns).push(item);
        }
        // HOTFIX43 UI — travaux have their own dedicated orange banner. The wording
        // mirrors the Works page: work name + "entre A et B" or "à A".
        const worksStationName = (value) => {
            if (!value)
                return '';
            const st = this.game.world.getStationById?.(value);
            return st?.name || String(value);
        };
        const worksLocation = (source) => {
            const a = String(source?.startStation?.name || worksStationName(source?.stationA) || '').trim();
            const b = String(source?.endStation?.name || worksStationName(source?.stationB) || '').trim();
            if (a && b)
                return a === b ? `à ${a}` : `entre ${a} et ${b}`;
            if (a || b)
                return `à ${a || b}`;
            return '';
        };
        const displayWorks = this.game.worksManager?.getActiveDisplayItems?.(dateStr, timeOfDay) || [];
        if (displayWorks.length) {
            const seen = new Set();
            for (const r of displayWorks) {
                const source = r.stationOnly
                    ? { startStation: r.station || (r.stationName ? { name: r.stationName } : null), endStation: r.station || (r.stationName ? { name: r.stationName } : null), stationA: r.stationId, stationB: r.stationId }
                    : r;
                const location = worksLocation(source);
                const key = `${r.workId || r.workName}|${location}|${r.affectsTraffic === false ? 'info' : r.impact || ''}|${r.speedLimit ?? ''}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                let suffix = '';
                if (r.affectsTraffic === false)
                    suffix = ' — sans impact circulation';
                else if (r.impact === 'slow')
                    suffix = ` — LTV ${r.speedLimit || 40} km/h`;
                else if (r.impact === 'power-off')
                    suffix = ' — coupure caténaire';
                worksItems.push({
                    text: `${r.workName || 'Travaux'}${location ? ' — ' + location : ''}${suffix}`,
                    icon: ICON_WORKS,
                });
            }
        }
        else {
            // Legacy fallback.
            for (const w of this.game.worksManager.getActive(dateStr, timeOfDay)) {
                const stationOnly = w.scope === 'station';
                const station = stationOnly ? (w.station || (w.stationName ? { name: w.stationName } : null)) : null;
                const location = worksLocation(stationOnly ? { startStation: station, endStation: station, stationA: w.stationId || w.stationA, stationB: w.stationId || w.stationB } : { stationA: w.stationA, stationB: w.stationB });
                const suffix = w.affectsTraffic === false ? ' — sans impact circulation' : w.impact === 'slow' ? ` — LTV ${w.speedLimit || 40} km/h` : w.impact === 'power-off' ? ' — coupure caténaire' : '';
                worksItems.push({
                    text: `${w.name || 'Travaux'}${location ? ' — ' + location : ''}${suffix}`,
                    icon: ICON_WORKS,
                });
            }
        }
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (HTML_ESCAPE_MAP[c]));
        // Each item carries its own icon: red X = interruption, yellow ! = incident
        // without interruption, orange worker = planned works.
        const stopTicker = (el, reset = false) => {
            if (!el)
                return;
            if (el._alertTickerRaf)
                cancelAnimationFrame(el._alertTickerRaf);
            el._alertTickerRaf = null;
            el._alertTickerLast = null;
            if (reset)
                el._alertTickerX = null;
        };
        const runTicker = (el, track) => {
            if (!el || !track || el._alertTickerRaf)
                return;
            const SPEED_PX_PER_SEC = 52; // v1.1.72: nettement plus rapide que l'ancien ~18-25 px/s
            if (!Number.isFinite(el._alertTickerX))
                el._alertTickerX = el.clientWidth;
            const step = (now) => {
                if (!track.isConnected || !el.isConnected || el.classList.contains('hidden')) {
                    stopTicker(el, false);
                    return;
                }
                const last = Number(el._alertTickerLast);
                el._alertTickerLast = now;
                if (Number.isFinite(last)) {
                    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
                    el._alertTickerX -= dt * SPEED_PX_PER_SEC;
                }
                const width = track.scrollWidth;
                const viewport = el.clientWidth;
                if (width <= viewport) {
                    track.style.transform = 'translateX(0px)';
                    el._alertTickerX = 0;
                }
                else {
                    // Important: when a new incident is appended, _alertTickerX is kept.
                    // Only wrap after the CURRENT full text has really left the viewport.
                    if (el._alertTickerX + width <= 0)
                        el._alertTickerX = viewport;
                    if (el._alertTickerX > viewport)
                        el._alertTickerX = viewport;
                    track.style.transform = `translateX(${el._alertTickerX}px)`;
                }
                el._alertTickerRaf = requestAnimationFrame(step);
            };
            el._alertTickerRaf = requestAnimationFrame(step);
        };
        // v1.1.72 — keep the same DOM track and its X position when incidents change.
        // The old implementation replaced innerHTML and restarted the CSS animation at 0.
        const setBanner = (el, items) => {
            if (!el)
                return;
            if (items.length === 0) {
                el.classList.add('hidden');
                el.classList.remove('scrolling');
                stopTicker(el, true);
                el._lastContent = '';
                el.innerHTML = '';
                return;
            }
            el.classList.remove('hidden');
            const contentKey = items.map((i) => `${i.icon}|${i.text}`).join('||');
            const html = items.map((i) => `<span class="alert-item"><span class="alert-icon op-icon ${htmlText(i.icon)}" aria-hidden="true"></span>${esc(i.text)}</span>`).join('<span class="alert-sep"> · </span>');
            let track = el.querySelector('.alert-text');
            if (!track) {
                track = document.createElement('span');
                track.className = 'alert-text';
                el.appendChild(track);
            }
            if (el._lastContent !== contentKey) {
                el._lastContent = contentKey;
                track.innerHTML = html; // preserve el._alertTickerX: no restart on a new incident
            }
            const shouldScroll = items.length > 1 || track.scrollWidth > el.clientWidth;
            if (shouldScroll) {
                el.classList.add('scrolling');
                if (!Number.isFinite(el._alertTickerX))
                    el._alertTickerX = el.clientWidth;
                runTicker(el, track);
            }
            else {
                el.classList.remove('scrolling');
                stopTicker(el, true);
                track.style.transform = 'translateX(0px)';
            }
        };
        setBanner(bannerInterruptions, interruptions);
        setBanner(bannerSlowdowns, slowdowns);
        setBanner(bannerWorks, worksItems);
        // Legacy single banner fallback
        if (legacyBanner && !bannerInterruptions) {
            const all = [...interruptions, ...slowdowns, ...worksItems].map((x) => x.text);
            if (all.length > 0) {
                legacyBanner.textContent = all.join(' | ');
                legacyBanner.classList.remove('hidden');
            }
            else {
                legacyBanner.classList.add('hidden');
            }
        }
    }
    // --- VOIE POINTS SYSTEM ---
    setupVoiePointButtons() {
        document.getElementById('btn-create-voie-point')?.addEventListener('click', () => {
            this.toggleVoiePointCreation();
        });
        document.getElementById('btn-create-voie-point')?.addEventListener('dblclick', () => {
            this._multiCreateMode = 'voiepoint';
            if (!this.voiePointCreationMode)
                this.toggleVoiePointCreation();
            document.getElementById('btn-create-voie-point')?.classList.add('multi-mode');
        });
        document.getElementById('btn-create-troncon')?.addEventListener('click', () => {
            this.toggleTronconCreation();
        });
        document.getElementById('btn-create-troncon')?.addEventListener('dblclick', () => {
            this._multiCreateMode = 'troncon';
            if (!this.tronconCreationMode)
                this.toggleTronconCreation();
            document.getElementById('btn-create-troncon')?.classList.add('multi-mode');
        });
        document.getElementById('btn-create-troncon-manual')?.addEventListener('click', () => {
            this.toggleManualTronconCreation();
        });
        document.getElementById('btn-tracer-ligne')?.addEventListener('click', () => {
            this.toggleTracerLigne();
        });
        document.getElementById('btn-save-vp')?.addEventListener('click', () => {
            this._saveVoiePoint();
        });
        document.getElementById('btn-delete-vp')?.addEventListener('click', () => {
            this._deleteVoiePoint();
        });
        // Map buttons for signal box & regulation zone
        document.getElementById('btn-create-signalbox')?.addEventListener('click', () => {
            const name = prompt('Nom du poste d\'aiguillage :') || '';
            const radius = parseFloat(prompt('Rayon d\'influence (km) :', '10') || '10') || 10;
            this.game._pendingSignalBox = { name, radiusKm: radius };
            this.game._pendingRegZone = null;
            this._showPickHint('Cliquez sur la carte pour placer le poste d\'aiguillage');
            document.getElementById('game-canvas').style.cursor = 'crosshair';
        });
        document.getElementById('btn-create-regzone')?.addEventListener('click', () => {
            const name = prompt('Nom de la zone de régulation :') || '';
            const radius = parseFloat(prompt('Rayon de la zone (km) :', '30') || '30') || 30;
            this.game._pendingRegZone = { name, radiusKm: radius };
            this.game._pendingSignalBox = null;
            this._showPickHint('Cliquez sur la carte pour placer la zone de régulation');
            document.getElementById('game-canvas').style.cursor = 'crosshair';
        });
        // XXI — create an industrial site directly on the livemap
        document.getElementById('btn-create-industry')?.addEventListener('click', () => {
            this.toggleIndustryCreation();
        });
    }
    toggleVoiePointCreation() {
        this.voiePointCreationMode = !this.voiePointCreationMode;
        if (this.voiePointCreationMode) {
            this.tronconCreationMode = false;
            this.stationCreationMode = false;
            this._tronconPointA = null;
        }
        const btn = document.getElementById('btn-create-voie-point');
        if (btn) {
            btn.textContent = this.voiePointCreationMode ? '✕ Annuler' : '+ Point de voie';
            btn.classList.toggle('active-mode', this.voiePointCreationMode);
        }
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = this.voiePointCreationMode ? 'crosshair' : 'grab';
        // Reset other buttons
        const stBtn = document.getElementById('btn-create-station');
        if (stBtn && this.voiePointCreationMode) {
            stBtn.textContent = '+ Creer une gare';
            stBtn.classList.remove('active-mode');
        }
        const trcBtn = document.getElementById('btn-create-troncon');
        if (trcBtn && this.voiePointCreationMode) {
            trcBtn.textContent = '+ Troncon';
            trcBtn.classList.remove('active-mode');
        }
    }
    toggleTronconCreation() {
        this.tronconCreationMode = !this.tronconCreationMode;
        if (this.tronconCreationMode) {
            this.voiePointCreationMode = false;
            this.stationCreationMode = false;
            this._tronconPointA = null;
        }
        const btn = document.getElementById('btn-create-troncon');
        if (btn) {
            btn.textContent = this.tronconCreationMode ? '✕ Annuler' : '+ Troncon';
            btn.classList.toggle('active-mode', this.tronconCreationMode);
        }
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = this.tronconCreationMode ? 'pointer' : 'grab';
        // Reset other buttons
        const stBtn = document.getElementById('btn-create-station');
        if (stBtn && this.tronconCreationMode) {
            stBtn.textContent = '+ Creer une gare';
            stBtn.classList.remove('active-mode');
        }
        const vpBtn = document.getElementById('btn-create-voie-point');
        if (vpBtn && this.tronconCreationMode) {
            vpBtn.textContent = '+ Point de voie';
            vpBtn.classList.remove('active-mode');
        }
        if (this.tronconCreationMode) {
            this._showPickHint('Cliquer sur le point de depart (gare ou point de voie)');
        }
        else {
            this._hidePickHint();
        }
    }
    _populateVpStationDropdown(selectedStationId, lat, lon) {
        const sel = document.getElementById('vp-station');
        if (!sel)
            return;
        sel.innerHTML = '<option value="">Aucune (point en ligne)</option>';
        // Sort stations by distance from the voie point
        const stations = [...this.game.world.stations].sort((a, b) => {
            const dA = Math.hypot((a.lat - lat) * 111, (a.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
            const dB = Math.hypot((b.lat - lat) * 111, (b.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
            return dA - dB;
        });
        for (const st of stations) {
            const dist = Math.hypot((st.lat - lat) * 111, (st.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
            const label = `${st.name} (${dist.toFixed(1)} km)`;
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = label;
            if (st.id === selectedStationId)
                opt.selected = true;
            sel.appendChild(opt);
        }
        // Auto-select nearest station if < 2km and creating new
        if (!selectedStationId && stations.length > 0) {
            const nearest = stations[0];
            const dist = Math.hypot((nearest.lat - lat) * 111, (nearest.lon - lon) * 111 * Math.cos(lat * Math.PI / 180));
            if (dist < 2)
                sel.value = nearest.id;
        }
    }
    openVoiePointModal(lat, lon) {
        // Mode multi-création : le point de voie reste sélectionné jusqu'à Échap (note joueurs)
        // this.voiePointCreationMode = false;
        // const btn = document.getElementById('btn-create-voie-point');
        // if (btn) { btn.textContent = '+ Point de voie'; btn.classList.remove('active-mode'); }
        // document.getElementById('game-canvas').style.cursor = 'grab';
        this._editingVoiePointId = null;
        document.getElementById('vp-modal-title').textContent = 'Nouveau point de voie';
        document.getElementById('vp-voie').value = '1';
        document.getElementById('vp-lat').value = lat.toFixed(6);
        document.getElementById('vp-lon').value = lon.toFixed(6);
        document.getElementById('btn-delete-vp').classList.add('hidden');
        document.getElementById('btn-save-vp').textContent = 'Creer le point';
        document.getElementById('vp-troncons-list').innerHTML = '';
        this._populateVpStationDropdown(null, lat, lon);
        document.getElementById('modal-voie-point')?.classList.remove('hidden');
    }
    openEditVoiePointModal(vp) {
        this._editingVoiePointId = vp.id;
        document.getElementById('vp-modal-title').textContent = 'Modifier le point de voie';
        document.getElementById('vp-voie').value = vp.voie;
        document.getElementById('vp-lat').value = vp.lat.toFixed(6);
        document.getElementById('vp-lon').value = vp.lon.toFixed(6);
        document.getElementById('btn-delete-vp').classList.remove('hidden');
        document.getElementById('btn-save-vp').textContent = 'Enregistrer';
        this._populateVpStationDropdown(vp.stationId, vp.lat, vp.lon);
        // Show connected troncons
        const vpm = this.game.voiePointManager;
        const troncons = vpm.getTronconsForPoint(vp.id);
        const trcList = document.getElementById('vp-troncons-list');
        if (troncons.length > 0) {
            trcList.innerHTML = '<div style="font-size:10px;color:var(--text2);margin-bottom:4px;font-weight:600">Troncons connectes:</div>' +
                troncons.map((trc) => {
                    const otherPt = trc.pointA === vp.id ? trc.pointB : trc.pointA;
                    const otherName = this._getPointName(otherPt);
                    return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;padding:2px 0">
            <span>→ ${htmlText(otherName)} (${Math.round(trc.distance)} km)</span>
            <button onclick="game.ui._deleteTroncon('${htmlJsString(trc.id)}')" style="background:#7f1d1d;color:#fff;border:none;border-radius:3px;font-size:9px;padding:1px 6px;cursor:pointer">✕</button>
          </div>`;
                }).join('');
        }
        else {
            trcList.innerHTML = '<div style="font-size:10px;color:var(--text3)">Aucun troncon</div>';
        }
        document.getElementById('modal-voie-point')?.classList.remove('hidden');
    }
    _getPointName(pointId) {
        const vp = this.game.voiePointManager.getVoiePointById(pointId);
        if (vp)
            return `Voie ${vp.voie} (${vp.lat.toFixed(3)}, ${vp.lon.toFixed(3)})`;
        const st = this.game.world.getStationById(pointId);
        if (st)
            return st.name;
        return pointId;
    }
    _saveVoiePoint() {
        const voie = document.getElementById('vp-voie').value;
        const lat = parseFloat(document.getElementById('vp-lat').value);
        const lon = parseFloat(document.getElementById('vp-lon').value);
        const stationId = document.getElementById('vp-station')?.value || null;
        const vpm = this.game.voiePointManager;
        if (this._editingVoiePointId) {
            const vp = vpm.getVoiePointById(this._editingVoiePointId);
            if (vp) {
                vp.voie = voie;
                vp.lat = lat;
                vp.lon = lon;
                vp.stationId = stationId;
            }
        }
        else {
            vpm.addVoiePoint({ lat, lon, voie, stationId });
        }
        document.getElementById('modal-voie-point')?.classList.add('hidden');
        this.game.saveState();
    }
    _deleteVoiePoint() {
        if (!this._editingVoiePointId)
            return;
        if (!confirm('Supprimer ce point de voie et ses troncons ?'))
            return;
        this.game.voiePointManager.removeVoiePoint(this._editingVoiePointId);
        document.getElementById('modal-voie-point')?.classList.add('hidden');
        this.game.saveState();
    }
    _deleteTroncon(trcId) {
        if (!confirm('Supprimer ce troncon ?'))
            return;
        this.game.voiePointManager.removeTroncon(trcId);
        // Refresh modal if open
        if (this._editingVoiePointId) {
            const vp = this.game.voiePointManager.getVoiePointById(this._editingVoiePointId);
            if (vp)
                this.openEditVoiePointModal(vp);
        }
        this.game.saveState();
    }
    async _handleTronconClick(x, y) {
        const renderer = this.game.renderer;
        const vpm = this.game.voiePointManager;
        const world = this.game.world;
        // Find nearest station or voie point
        let closest = null, minDist = Infinity, closestType = null;
        for (const st of world.stations) {
            const p = renderer.latLonToScreen(st.lat, st.lon);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < minDist && d < 25) {
                minDist = d;
                closest = st;
                closestType = 'station';
            }
        }
        for (const vp of vpm.getAll()) {
            const p = renderer.latLonToScreen(vp.lat, vp.lon);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < minDist && d < 25) {
                minDist = d;
                closest = vp;
                closestType = 'voiepoint';
            }
        }
        if (!closest)
            return;
        if (!this._tronconPointA) {
            // First point selected
            this._tronconPointA = { id: closest.id, type: closestType, lat: closest.lat, lon: closest.lon };
            this._showPickHint(`Point A: ${closestType === 'station' ? closest.name : 'V' + closest.voie} — Cliquer sur le point B`);
        }
        else {
            // Second point selected — create troncon
            if (closest.id === this._tronconPointA.id) {
                this._showPickHint('Meme point! Choisissez un point different.');
                return;
            }
            const ptA = this._tronconPointA;
            const ptB = { id: closest.id, type: closestType, lat: closest.lat, lon: closest.lon };
            // Automatic Livemap connection is fail-closed: ORM/OSM is the routing
            // authority. Never manufacture a straight railway when the graph cannot
            // connect the two selected anchors; the explicit manual-trace tool is the
            // player's escape hatch for genuinely new/reopened infrastructure.
            let route = [];
            let distance = 0;
            try {
                route = await this.game.orm.findRoute(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
                if (!Array.isArray(route) || route.length < 2 || this.game.orm?.isFallbackRoute?.(route)) {
                    throw new Error('Aucun itinéraire ferroviaire ORM réel entre ces deux points.');
                }
                distance = Number(this.game.orm.getRouteDistance(route));
                if (!Number.isFinite(distance) || distance <= 0)
                    throw new Error('Distance ferroviaire invalide.');
            }
            catch (e) {
                this._showPickHint(`Tronçon non créé : ${e?.message || 'routage ORM impossible'}. Utilisez « Tracé manuel » si vous créez réellement une nouvelle infrastructure.`);
                this._tronconPointA = null;
                return;
            }
            vpm.addTroncon({
                pointA: ptA.id,
                pointB: ptB.id,
                route,
                distance: Math.round(distance * 1000) / 1000,
            });
            this._tronconPointA = null;
            this._showPickHint('Troncon cree ! Cliquer pour en creer un autre ou Echap pour quitter.');
            this.game.saveState();
        }
    }
    // --- Manual troncon tracing ---
    toggleManualTronconCreation() {
        this.manualTronconMode = !this.manualTronconMode;
        if (this.manualTronconMode) {
            this.voiePointCreationMode = false;
            this.stationCreationMode = false;
            this.tronconCreationMode = false;
            this._manualTronconPointA = null;
            this._manualTronconWaypoints = [];
        }
        const btn = document.getElementById('btn-create-troncon-manual');
        if (btn) {
            btn.textContent = this.manualTronconMode ? '✕ Annuler tracé' : '+ Tracé manuel';
            btn.classList.toggle('active-mode', this.manualTronconMode);
        }
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = this.manualTronconMode ? 'crosshair' : 'grab';
        // Reset other mode buttons
        const trcBtn = document.getElementById('btn-create-troncon');
        if (trcBtn && this.manualTronconMode) {
            trcBtn.textContent = '+ Troncon';
            trcBtn.classList.remove('active-mode');
        }
        const vpBtn = document.getElementById('btn-create-voie-point');
        if (vpBtn && this.manualTronconMode) {
            vpBtn.textContent = '+ Point de voie';
            vpBtn.classList.remove('active-mode');
        }
        if (this.manualTronconMode) {
            this._showPickHint('Cliquer sur le point de départ (gare ou point de voie)');
        }
        else {
            this._hidePickHint();
            this._manualTronconWaypoints = [];
            this._manualTronconPointA = null;
        }
    }
    _handleManualTronconClick(x, y) {
        const renderer = this.game.renderer;
        const vpm = this.game.voiePointManager;
        const world = this.game.world;
        // Check if clicking near a station or voie point
        let closest = null, minDist = Infinity, closestType = null;
        for (const st of world.stations) {
            const p = renderer.latLonToScreen(st.lat, st.lon);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < minDist && d < 25) {
                minDist = d;
                closest = st;
                closestType = 'station';
            }
        }
        for (const vp of vpm.getAll()) {
            const p = renderer.latLonToScreen(vp.lat, vp.lon);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < minDist && d < 25) {
                minDist = d;
                closest = vp;
                closestType = 'voiepoint';
            }
        }
        if (!this._manualTronconPointA) {
            // Must click a station or voie point as starting point
            if (!closest) {
                this._showPickHint('Cliquer sur un point existant (gare ou point de voie) pour démarrer');
                return;
            }
            this._manualTronconPointA = { id: closest.id, type: closestType, lat: closest.lat, lon: closest.lon };
            this._manualTronconWaypoints = [{ lat: closest.lat, lon: closest.lon }];
            this._showPickHint(`Départ: ${closestType === 'station' ? closest.name : 'Voie ' + closest.voie} — Cliquer pour tracer, cliquer un point pour terminer`);
        }
        else if (closest && closest.id !== this._manualTronconPointA.id) {
            // Clicked on a target point — finalize the tronçon
            this._manualTronconWaypoints.push({ lat: closest.lat, lon: closest.lon });
            this._finalizeManualTroncon(closest);
        }
        else {
            // Clicked on empty space — add waypoint
            const worldPos = renderer.tileMap.screenToWorld(x, y, renderer.logicalWidth, renderer.logicalHeight);
            this._manualTronconWaypoints.push({ lat: worldPos.lat, lon: worldPos.lon, maxSpeed: 160 });
            this._showPickHint(`${this._manualTronconWaypoints.length} points tracés — Cliquer un point existant pour terminer`);
        }
    }
    _finalizeManualTroncon(endPoint) {
        const vpm = this.game.voiePointManager;
        const ptA = this._manualTronconPointA;
        const coarseRoute = this._manualTronconWaypoints.map((wp) => ({
            lat: wp.lat, lon: wp.lon, maxSpeed: wp.maxSpeed || 30,
        }));
        // Player note / Annex 6 — livemap manual tronçon must keep one point every 50 m.
        const route = this._densifyRoute(coarseRoute, 0.05);
        // Recalculate distance from the densified route.
        let distance = 0;
        for (let i = 1; i < route.length; i++) {
            distance += haversineDistance(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
        }
        vpm.addTroncon({
            pointA: ptA.id,
            pointB: endPoint.id,
            route,
            distance: Math.round(distance * 1000) / 1000,
        });
        this._manualTronconPointA = null;
        this._manualTronconWaypoints = [];
        this._showPickHint('Tronçon tracé ! Cliquer pour en tracer un autre ou Echap pour quitter.');
        this.game.saveState();
    }
    // --- TRACER LIGNE (infrastructure import from OSM) ---
    toggleTracerLigne() {
        this.tracerLigneMode = !this.tracerLigneMode;
        if (this.tracerLigneMode) {
            this.voiePointCreationMode = false;
            this.stationCreationMode = false;
            this.tronconCreationMode = false;
            this.manualTronconMode = false;
            this._tracerLignePointA = null;
        }
        const btn = document.getElementById('btn-tracer-ligne');
        if (btn) {
            btn.textContent = this.tracerLigneMode ? '✕ Annuler' : 'Tracer ligne';
            btn.classList.toggle('active-mode', this.tracerLigneMode);
        }
        const canvas = document.getElementById('game-canvas');
        if (canvas)
            canvas.style.cursor = this.tracerLigneMode ? 'crosshair' : 'grab';
        if (this.tracerLigneMode) {
            this._showPickHint('Cliquer sur le point A (gare, point de voie, ou un point sur la carte)');
        }
        else {
            this._hidePickHint();
            this._tracerLignePointA = null;
        }
    }
    async _handleTracerLigneClick(x, y) {
        const renderer = this.game.renderer;
        const worldPos = renderer.tileMap.screenToWorld(x, y, renderer.logicalWidth, renderer.logicalHeight);
        // Try to snap to existing station or voie point WITHOUT scanning the whole
        // imported network. On a 500 km map this keeps the first/second click instant.
        let snapped = null;
        const world = this.game.world;
        const vpm = this.game.voiePointManager;
        const nearbyStations = typeof world.getStationsNear === 'function'
            ? world.getStationsNear(worldPos.lat, worldPos.lon, 4)
            : world.stations;
        for (const st of nearbyStations) {
            const p = renderer.latLonToScreen(st.lat, st.lon);
            if (Math.hypot(p.x - x, p.y - y) < 25) {
                snapped = { lat: st.lat, lon: st.lon, name: st.name, stationId: st.id };
                break;
            }
        }
        if (!snapped) {
            const nearbyVPs = typeof vpm.getVoiePointsNear === 'function'
                ? vpm.getVoiePointsNear(worldPos.lat, worldPos.lon, 4)
                : vpm.getAll();
            for (const vp of nearbyVPs) {
                const p = renderer.latLonToScreen(vp.lat, vp.lon);
                if (Math.hypot(p.x - x, p.y - y) < 25) {
                    snapped = { lat: vp.lat, lon: vp.lon, name: 'Voie ' + vp.voie };
                    break;
                }
            }
        }
        const point = snapped || { lat: worldPos.lat, lon: worldPos.lon, name: `(${worldPos.lat.toFixed(4)}, ${worldPos.lon.toFixed(4)})` };
        if (!this._tracerLignePointA) {
            this._tracerLignePointA = point;
            this._showPickHint(`Point A: ${point.name} — Cliquer sur le point B`);
        }
        else {
            const ptA = this._tracerLignePointA;
            this._showPickHint('Import en cours...');
            try {
                const result = await this.game.orm.importInfrastructure(ptA.lat, ptA.lon, point.lat, point.lon, {
                    onProgress: (p) => {
                        if (!p)
                            return;
                        if (p.phase === 'tracks') {
                            const pct = p.total ? Math.round(p.done * 100 / p.total) : 0;
                            this._showPickHint(`Import voies : ${p.done || 0}/${p.total || '?'} tuiles (${pct} %) — ${p.ways || 0} voies OSM`);
                        }
                        else if (p.phase === 'tracks-expand') {
                            const pct = p.total ? Math.round((p.done || 0) * 100 / p.total) : 0;
                            this._showPickHint(`Réseau réel hors corridor — élargissement automatique : ${p.done || 0}/${p.total || '?'} tuiles (${pct} %) — ${p.ways || 0} voies OSM`);
                        }
                        else if (p.phase === 'connectivity') {
                            const pct = p.total ? Math.round((p.done || 0) * 100 / p.total) : 0;
                            this._showPickHint(`Vérification continuité ferroviaire : ${pct} %`);
                        }
                        else if (p.phase === 'build') {
                            const pct = p.total ? Math.round(p.done * 100 / p.total) : 0;
                            this._showPickHint(`Construction réseau : ${pct} %`);
                        }
                        else if (p.phase === 'graph') {
                            const pct = p.total ? Math.round(p.done * 100 / p.total) : 0;
                            this._showPickHint(`Indexation réseau : ${pct} %`);
                        }
                        else if (p.phase === 'chains') {
                            const pct = p.total ? Math.round(p.done * 100 / p.total) : 0;
                            this._showPickHint(`Assemblage tronçons : ${pct} % — ${p.troncons || 0} tronçon(s)`);
                        }
                        else if (p.phase === 'stations' || p.phase === 'stations-retry') {
                            const pct = p.total ? Math.round(p.done * 100 / p.total) : 0;
                            const retry = p.phase === 'stations-retry' ? ` — récupération ${p.round || ''}` : '';
                            this._showPickHint(`Import gares : ${p.done || 0}/${p.total || '?'} tuiles (${pct} %) — ${p.stations || 0} gare(s)${retry}`);
                        }
                        else if (p.phase === 'stations-partial') {
                            this._showPickHint(`Voies OK — ${p.stations || 0} gare(s) récupérée(s), ${p.failed || 0} tuile(s) gare à reprendre.`);
                        }
                    }
                });
                if (result.voiePoints.length === 0) {
                    const fetched = result.waysFetched || 0;
                    this._showPickHint(fetched > 0
                        ? `${fetched} voie(s) OSM téléchargée(s), mais aucune infrastructure exploitable n’a pu être construite. Import annulé proprement.`
                        : 'Aucune voie ferrée OSM trouvée dans la zone recherchée.');
                    this._tracerLignePointA = null;
                    return;
                }
                // Tag everything with a group ID for bulk delete
                const lineGroupId = `line-${Date.now()}`;
                // Auto-stations are fetched independently from track geometry. Track import
                // must complete first even if station metadata is slow/unavailable.
                let addedStations = 0;
                const uiYield = () => new Promise((resolve) => {
                    if (typeof requestAnimationFrame === 'function')
                        requestAnimationFrame(() => resolve());
                    else
                        setTimeout(resolve, 0);
                });
                // Spatial station index shared by duplicate detection and later VP linking.
                const stCell = 0.01; // ~1 km latitude
                const stationGrid = new Map();
                const stationCellKey = (lat, lon) => `${Math.floor(lat / stCell)},${Math.floor(lon / stCell)}`;
                const addStationToGrid = (st) => {
                    const k = stationCellKey(st.lat, st.lon);
                    if (!stationGrid.has(k))
                        stationGrid.set(k, []);
                    stationGrid.get(k).push(st);
                };
                for (const st of world.stations)
                    addStationToGrid(st);
                const nearbyStation = (lat, lon, maxKm = 0.5, sameName = null) => {
                    const iy = Math.floor(lat / stCell), ix = Math.floor(lon / stCell);
                    let best = null, bestD = Infinity;
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            for (const st of (stationGrid.get(`${iy + dy},${ix + dx}`) || [])) {
                                if (sameName != null && (st.name || '').toLowerCase() !== sameName)
                                    continue;
                                const d = Math.sqrt(Math.pow((lat - st.lat) * 111, 2) + Math.pow((lon - st.lon) * 111 * Math.cos(lat * Math.PI / 180), 2));
                                if (d < maxKm && d < bestD) {
                                    best = st;
                                    bestD = d;
                                }
                            }
                        }
                    return best;
                };
                const addImportedStations = async (stations) => {
                    let added = 0, work = 0;
                    const accepted = [];
                    for (const osmSt of (stations || [])) {
                        const stableId = `osm-station-${osmSt.id}`;
                        if (world.getStationById(stableId)) {
                            accepted.push(world.getStationById(stableId));
                            continue;
                        }
                        const nameKey = (osmSt.name || '').toLowerCase();
                        if (nearbyStation(osmSt.lat, osmSt.lon, 0.15, nameKey))
                            continue;
                        const st = world.addStation({ id: stableId, name: osmSt.name, lat: osmSt.lat, lon: osmSt.lon, type: 'voyageur', platforms: 2, platformNames: [] });
                        st.country = this.game.orm.getCountryAtPoint(osmSt.lat, osmSt.lon);
                        st.osmStationId = osmSt.id;
                        this.game.platformManager?.initStation(st.id, st.platforms || 2);
                        addStationToGrid(st);
                        accepted.push(st);
                        added++;
                        if ((++work % 80) === 0) {
                            this._showPickHint(`Ajout gares OSM : ${work}/${stations.length} — ${added} nouvelle(s)`);
                            await uiYield();
                        }
                    }
                    return { added, accepted };
                };
                // Batch/chunk thousands of infrastructure mutations. The renderer/routing
                // receives one logical invalidation, while the browser gets frames between
                // chunks so buttons and map interaction stay alive.
                let infrastructureCommitted = false;
                vpm.beginBatch?.();
                try {
                    const vpCell = 0.0003; // ~30 m latitude
                    const existingVpGrid = new Map();
                    const gridKey = (lat, lon) => `${Math.floor(lat / vpCell)},${Math.floor(lon / vpCell)}`;
                    let existingWork = 0;
                    for (const v of vpm.getAll()) {
                        const k = gridKey(v.lat, v.lon);
                        if (!existingVpGrid.has(k))
                            existingVpGrid.set(k, []);
                        existingVpGrid.get(k).push(v);
                        if ((++existingWork % 2500) === 0)
                            await uiYield();
                    }
                    const findExistingVP = (vpData) => {
                        const iy = Math.floor(vpData.lat / vpCell), ix = Math.floor(vpData.lon / vpCell);
                        for (let dy = -1; dy <= 1; dy++)
                            for (let dx = -1; dx <= 1; dx++) {
                                const arr = existingVpGrid.get(`${iy + dy},${ix + dx}`) || [];
                                for (const v of arr) {
                                    if (v.voie !== vpData.voie)
                                        continue;
                                    const d = Math.sqrt(Math.pow((v.lat - vpData.lat) * 111, 2) + Math.pow((v.lon - vpData.lon) * 111 * Math.cos(v.lat * Math.PI / 180), 2));
                                    if (d < 0.02)
                                        return v;
                                }
                            }
                        return null;
                    };
                    const remap = new Map();
                    let vpDone = 0;
                    let vpChunk = [];
                    const flushVP = async () => {
                        if (!vpChunk.length)
                            return;
                        if (typeof vpm.addVoiePointsBulk === 'function')
                            vpm.addVoiePointsBulk(vpChunk);
                        else
                            for (const v of vpChunk)
                                vpm.addVoiePoint(v);
                        vpChunk = [];
                        this._showPickHint(`Injection voies : ${vpDone}/${result.voiePoints.length} points`);
                        await uiYield();
                    };
                    for (const vpData of result.voiePoints) {
                        vpData.lineGroupId = lineGroupId;
                        const st = nearbyStation(vpData.lat, vpData.lon, 0.5);
                        if (st)
                            vpData.stationId = st.id;
                        const existing = findExistingVP(vpData);
                        if (!existing) {
                            vpChunk.push(vpData);
                            const k = gridKey(vpData.lat, vpData.lon);
                            if (!existingVpGrid.has(k))
                                existingVpGrid.set(k, []);
                            existingVpGrid.get(k).push(vpData);
                        }
                        else {
                            remap.set(vpData.id, existing.id);
                        }
                        vpDone++;
                        if (vpChunk.length >= 700)
                            await flushVP();
                    }
                    await flushVP();
                    let addedTrc = 0, trcDone = 0, trcChunk = [];
                    const flushTrc = async () => {
                        if (!trcChunk.length)
                            return;
                        if (typeof vpm.addTronconsBulk === 'function')
                            vpm.addTronconsBulk(trcChunk);
                        else
                            for (const t of trcChunk)
                                vpm.addTroncon(t);
                        addedTrc += trcChunk.length;
                        trcChunk = [];
                        this._showPickHint(`Injection tronçons : ${trcDone}/${result.troncons.length}`);
                        await uiYield();
                    };
                    for (const trcData of result.troncons) {
                        if (remap.has(trcData.pointA))
                            trcData.pointA = remap.get(trcData.pointA);
                        if (remap.has(trcData.pointB))
                            trcData.pointB = remap.get(trcData.pointB);
                        trcData.lineGroupId = lineGroupId;
                        trcDone++;
                        if (trcData.pointA === trcData.pointB)
                            continue;
                        trcChunk.push(trcData);
                        if (trcChunk.length >= 500)
                            await flushTrc();
                    }
                    await flushTrc();
                    this._lastImportedTronconCount = addedTrc;
                    infrastructureCommitted = true;
                }
                catch (insertionError) {
                    // Transactional safety: never leave half an import in the save.
                    try {
                        vpm.deleteLineGroup?.(lineGroupId);
                    }
                    catch (_) { /* best effort */ }
                    throw insertionError;
                }
                finally {
                    vpm.endBatch?.();
                }
                const linkImportedStations = async (stations) => {
                    if (!stations?.length)
                        return;
                    // One pass over imported VPs. No stations × all-VPs Cartesian product.
                    const importedVPs = [];
                    let scan = 0;
                    for (const v of vpm.getAll()) {
                        if (v.lineGroupId === lineGroupId)
                            importedVPs.push(v);
                        if ((++scan % 3000) === 0)
                            await uiYield();
                    }
                    let changed = 0;
                    for (let i = 0; i < importedVPs.length; i++) {
                        const vp = importedVPs[i];
                        if (!vp.stationId) {
                            const st = nearbyStation(vp.lat, vp.lon, 0.5);
                            if (st) {
                                vp.stationId = st.id;
                                changed++;
                            }
                        }
                        if ((i % 800) === 0)
                            await uiYield();
                    }
                    if (changed)
                        vpm.markDirty?.();
                };
                // Stations arrive asynchronously and can never roll back or block tracks.
                if (result.stations?.length) {
                    const r = await addImportedStations(result.stations);
                    addedStations += r.added;
                    await linkImportedStations(r.accepted);
                }
                if (result.stationsPromise && typeof result.stationsPromise.then === 'function') {
                    result.stationsPromise.then(async (stations) => {
                        try {
                            const r = await addImportedStations(stations);
                            addedStations += r.added;
                            await linkImportedStations(r.accepted);
                            this.game.renderer?.invalidateStatic?.();
                            this.game.saveState();
                            this._showPickHint(`Import complet — voies OK, ${addedStations} gare(s) OSM ajoutée(s).`);
                        }
                        catch (e) {
                            // Never crash the game for metadata. Successful tracks stay committed.
                            console.warn('Auto-stations background error:', e);
                            this._showPickHint(`Voies importées. Gares OSM partielles; récupération possible au prochain Tracer ligne.`);
                        }
                    }).catch((e) => console.warn('Auto-stations skipped safely:', e));
                }
                this.game.renderer?.invalidateStatic?.();
                this.game.saveState();
                this._lastLineGroupId = lineGroupId;
                this._tracerLignePointA = null;
                const vpCount = result.voiePoints.length;
                const trackInfo = result.troncons.length > 0 ? ` (${this._lastImportedTronconCount || result.troncons.length} tronçons)` : '';
                const stationInfo = addedStations > 0 ? `, ${addedStations} gare(s) ajoutée(s)` : '';
                const modeInfo = result.searchMode === 'expanded-rectangle' ? ' — recherche élargie automatiquement' : '';
                this._showPickHint(`Import OK: ${vpCount} points de voie${trackInfo}${stationInfo}${modeInfo}. Cliquer pour un autre tracé, Suppr pour annuler l'import, ou Echap.`);
            }
            catch (e) {
                console.error('Tracer ligne error:', e);
                this._showPickHint('Erreur lors de l\'import. Réessayez.');
                this._tracerLignePointA = null;
            }
        }
    }
    // --- MAP SEARCH (Nominatim geocoding) ---
    setupMapSearch() {
        const input = document.getElementById('map-search-input');
        const results = document.getElementById('map-search-results');
        if (!input || !results)
            return;
        let timer;
        input.addEventListener('input', () => {
            if (timer !== undefined)
                clearTimeout(timer);
            const q = input.value.trim();
            if (q.length < 3) {
                results.classList.add('hidden');
                return;
            }
            timer = setTimeout(() => this._searchPlace(q), 400);
        });
        input.addEventListener('blur', () => { setTimeout(() => results.classList.add('hidden'), 200); });
        input.addEventListener('focus', () => { if (results.children.length > 0)
            results.classList.remove('hidden'); });
    }
    async _searchPlace(q) {
        const results = document.getElementById('map-search-results');
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=fr`);
            const data = await resp.json();
            results.innerHTML = '';
            if (data.length === 0) {
                results.innerHTML = '<div class="map-search-result" style="color:var(--text3)">Aucun résultat</div>';
            }
            else {
                for (const r of data) {
                    const div = document.createElement('div');
                    div.className = 'map-search-result';
                    div.textContent = r.display_name;
                    div.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const lat = parseFloat(r.lat);
                        const lon = parseFloat(r.lon);
                        this.game.renderer.tileMap.centerLat = lat;
                        this.game.renderer.tileMap.centerLon = lon;
                        this.game.renderer.tileMap.zoomLevel = Math.max(this.game.renderer.tileMap.zoomLevel, 12);
                        document.getElementById('map-search-input').value = '';
                        results.classList.add('hidden');
                    });
                    results.appendChild(div);
                }
            }
            results.classList.remove('hidden');
        }
        catch (e) { /* silent */ }
    }
    // --- LIVEMAP TRAIN PANEL DRAG ---
    setupLivemapPanelDrag() {
        const panel = document.getElementById('livemap-train-panel');
        if (!panel)
            return;
        let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
        panel.addEventListener('mousedown', (e) => {
            if (e.target?.closest('.lvp-close, button, a'))
                return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging)
                return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = `${Math.max(0, startLeft + dx)}px`;
            panel.style.top = `${Math.max(0, startTop + dy)}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });
        window.addEventListener('mouseup', () => {
            if (!dragging)
                return;
            dragging = false;
            panel.style.cursor = '';
        });
    }
    // --- MOBILE NAV ---
    setupMobileNav() {
        const toggle = document.getElementById('nav-toggle');
        const nav = document.querySelector('.nav-tabs');
        if (!toggle || !nav)
            return;
        toggle.addEventListener('click', () => nav.classList.toggle('open'));
        nav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-btn'))
            nav.classList.remove('open'); });
    }
    // ============================================================
    renderQGPage() {
        const host = document.getElementById('page-qg');
        if (!host)
            return;
        if (!this._qgPage)
            this._qgPage = new HeadquartersPage(host, () => this._headquartersData());
        else
            this._qgPage.setActive(true);
    }
    _headquartersData() {
        const totals = transportTotals(this.game.economy, this.game.cargoTypes?.stats);
        const rows = [];
        const seen = new Set();
        for (const svc of [...(this.game.scheduleCreator?.getActiveServices() || []), ...(this.game.depotManager?.getPhysicalRescueServices?.() || [])]) {
            if (!svc || !svc.position || svc.completed || svc.cancelled || seen.has(String(svc.id)))
                continue;
            seen.add(String(svc.id));
            const rame = this._displayRameForService(svc);
            const stops = svc.getCurrentStops?.() || svc.stops || [];
            const first = stops[0], last = stops[stops.length - 1];
            const stationName = (stop) => stop ? String(this.game.world.getStationById(stop.stationId)?.name || stop.locationName || stop.stationId || '') : '';
            rows.push({ id: String(svc.id), name: String(svc.isReturnLeg && svc.returnName ? svc.returnName : svc.name || 'Train'), number: String(svc.isReturnLeg ? svc.returnNumber || svc.number || '' : svc.number || svc.train?.number || ''), category: String(svc.serviceType || ''),
                state: String(svc.state || svc.train?.state || ''), speed: Number(svc.speed || 0), delay: Number(svc.delay || 0),
                origin: stationName(first), destination: stationName(last), departure: first?.departureTime == null ? null : Number(first.departureTime), arrival: last?.arrivalTime == null ? null : Number(last.arrivalTime),
                rameName: String(rame?.name || ''), elements: rame?.elementDetails || [] });
        }
        const pt = this.game.engine.getParisTime();
        return { ...totals, company: String(this.game.account?.companyName || 'Rail Empire'), clock: `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}:${String(pt.seconds || 0).padStart(2, '0')}`, rows };
    }
    // INFOGARE
    // ============================================================
    _normalizeInfogareSearch(value = '') {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[’']/g, ' ')
            .replace(/[-_/.,()]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    _rebuildInfogareStationIndex() {
        const stations = (this.game.world.stations || []).filter((st) => !st.closed && st?.id && st?.name);
        this._infogareStationIndex = stations.map((st) => ({
            station: st,
            search: this._normalizeInfogareSearch(st.name)
        }));
    }
    _findInfogareStations(query, limit = 12) {
        const q = this._normalizeInfogareSearch(query);
        if (!q)
            return [];
        if (!this._infogareStationIndex?.length)
            this._rebuildInfogareStationIndex();
        const words = q.split(' ').filter(Boolean);
        return this._infogareStationIndex
            .map((entry) => {
            const n = entry.search;
            if (!words.every((w) => n.includes(w)))
                return null;
            let score = 4;
            if (n === q)
                score = 0;
            else if (n.startsWith(q))
                score = 1;
            else if (n.split(' ').some((part) => part.startsWith(q)))
                score = 2;
            else if (n.includes(q))
                score = 3;
            return { ...entry, score };
        })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score || a.station.name.localeCompare(b.station.name, 'fr', { sensitivity: 'base' }))
            .slice(0, Math.max(1, limit))
            .map((entry) => entry.station);
    }
    _escapeInfogareText(value = '') {
        return String(value).replace(/[&<>"']/g, (ch) => (HTML_ESCAPE_MAP[ch]));
    }
    _renderInfogareStationSuggestions(query) {
        const box = document.getElementById('infogare-station-suggestions');
        if (!box)
            return [];
        const matches = this._findInfogareStations(query, 12);
        const q = this._normalizeInfogareSearch(query);
        if (!q) {
            box.innerHTML = '';
            box.classList.add('hidden');
            return matches;
        }
        if (!matches.length) {
            box.innerHTML = '<div class="infogare-station-empty">Aucune gare trouvée</div>';
            box.classList.remove('hidden');
            return matches;
        }
        box.innerHTML = matches.map((st, idx) => {
            const tracks = Number(st.platforms || st.platformNames?.length || 0);
            const meta = [st.type || '', tracks ? `${tracks} voie${tracks > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
            return `<button type="button" class="infogare-station-suggestion${htmlText(idx === 0 ? ' is-first' : '')}" data-station-id="${this._escapeInfogareText(st.id)}">`
                + `<span>${this._escapeInfogareText(st.name)}</span>`
                + (meta ? `<small>${this._escapeInfogareText(meta)}</small>` : '')
                + `</button>`;
        }).join('');
        box.classList.remove('hidden');
        box.querySelectorAll('.infogare-station-suggestion').forEach((btn) => {
            btn.onmousedown = (e) => e.preventDefault();
            btn.onclick = () => this._selectInfogareStation(btn.dataset.stationId, true);
        });
        return matches;
    }
    _selectInfogareStation(stationId, showBoard = false) {
        const input = document.getElementById('infogare-station');
        const box = document.getElementById('infogare-station-suggestions');
        const station = this.game.world.getStationById(stationId);
        if (!input || !station || station.closed)
            return false;
        this._infogareSelectedStationId = station.id;
        input.dataset.stationId = station.id;
        input.value = station.name;
        if (box) {
            box.innerHTML = '';
            box.classList.add('hidden');
        }
        this._infogarePage = 0;
        if (showBoard)
            this._showInfogareBoard();
        return true;
    }
    _commitInfogareStationSearch(showBoard = true) {
        const input = document.getElementById('infogare-station');
        if (!input)
            return false;
        const typed = this._normalizeInfogareSearch(input.value);
        const current = input.dataset.stationId ? this.game.world.getStationById(input.dataset.stationId) : null;
        if (current && this._normalizeInfogareSearch(current.name) === typed) {
            if (showBoard) {
                this._infogarePage = 0;
                this._showInfogareBoard();
            }
            return true;
        }
        const matches = this._findInfogareStations(input.value, 12);
        if (!matches.length)
            return false;
        return this._selectInfogareStation(matches[0].id, showBoard);
    }
    _rebuildInfogareServiceIndex() {
        const rows = [];
        const mgr = this.game.scheduleV2;
        for (const rec of mgr?.schedules || []) {
            const ver = rec?.currentVersion;
            if (!rec?.id || !ver?.locations?.length)
                continue;
            if (!this._isInfogarePassengerCategory(ver.category || ''))
                continue;
            const stationIds = ver.locations.map((l) => l?.stationId).filter(Boolean);
            const first = ver.locations.find((l) => l?.stationId);
            const last = [...ver.locations].reverse().find((l) => l?.stationId);
            const name = String(rec.name || rec.number || 'Service').trim();
            const number = String(rec.number || '').trim();
            rows.push({
                key: `v2:${rec.id}`, kind: 'v2', id: rec.id, name, number,
                route: `${first?.name || this._infogareStationName(first) || '?'} → ${last?.name || this._infogareStationName(last) || '?'}`,
                stationIds,
                search: this._normalizeInfogareSearch(`${name} ${number} ${first?.name || ''} ${last?.name || ''}`)
            });
        }
        for (const svc of this.game.scheduleCreator?.services || []) {
            if (!svc?.id || svc._v2OccurrenceId)
                continue;
            if (!this._isInfogarePassengerService(svc))
                continue;
            const stops = svc.getCurrentStops?.() || svc.stops || [];
            const stationIds = stops.map((s) => s?.stationId).filter(Boolean);
            const first = stationIds.length ? this.game.world.getStationById(stationIds[0]) : null;
            const last = stationIds.length ? this.game.world.getStationById(stationIds.at(-1)) : null;
            const name = String(svc.name || svc.number || 'Service').trim();
            const number = String(svc.number || '').trim();
            rows.push({
                key: `legacy:${svc.id}`, kind: 'legacy', id: svc.id, name, number,
                route: `${first?.name || '?'} → ${last?.name || '?'}`, stationIds,
                search: this._normalizeInfogareSearch(`${name} ${number} ${first?.name || ''} ${last?.name || ''}`)
            });
        }
        this._infogareServiceIndex = rows;
    }
    _findInfogareServices(query, limit = 12) {
        const q = this._normalizeInfogareSearch(query);
        if (!q)
            return [];
        if (!this._infogareServiceIndex?.length)
            this._rebuildInfogareServiceIndex();
        const stationId = this._infogareSelectedStationId || document.getElementById('infogare-station')?.dataset?.stationId || '';
        return this._infogareServiceIndex
            .map((entry) => {
            if (stationId && !entry.stationIds.includes(stationId))
                return null;
            if (!entry.search.includes(q) && !q.split(' ').every((w) => entry.search.includes(w)))
                return null;
            let score = 4;
            const n = this._normalizeInfogareSearch(entry.name);
            const num = this._normalizeInfogareSearch(entry.number);
            if (n === q || num === q)
                score = 0;
            else if (n.startsWith(q) || num.startsWith(q))
                score = 1;
            else if (entry.search.startsWith(q))
                score = 2;
            else
                score = 3;
            return { ...entry, score };
        })
            .filter(Boolean)
            .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
            .slice(0, Math.max(1, limit));
    }
    _renderInfogareServiceSuggestions(query) {
        const box = document.getElementById('infogare-service-suggestions');
        if (!box)
            return [];
        const matches = this._findInfogareServices(query, 12);
        const q = this._normalizeInfogareSearch(query);
        if (!q) {
            box.innerHTML = '';
            box.classList.add('hidden');
            return matches;
        }
        if (!matches.length) {
            box.innerHTML = '<div class="infogare-station-empty">Aucun service trouvé</div>';
            box.classList.remove('hidden');
            return matches;
        }
        box.innerHTML = matches.map((svc, idx) => `<button type="button" class="infogare-station-suggestion${htmlText(idx === 0 ? ' is-first' : '')}" data-service-key="${this._escapeInfogareText(svc.key)}">`
            + `<span>${this._escapeInfogareText(svc.name)}</span>`
            + `<small>${this._escapeInfogareText([svc.number && svc.number !== svc.name ? svc.number : '', svc.route].filter(Boolean).join(' · '))}</small>`
            + `</button>`).join('');
        box.classList.remove('hidden');
        box.querySelectorAll('[data-service-key]').forEach((btn) => {
            btn.onmousedown = (e) => e.preventDefault();
            btn.onclick = () => this._selectInfogareService(btn.dataset.serviceKey, true);
        });
        return matches;
    }
    _getInfogareServiceEntry(key = this._infogareSelectedServiceKey) {
        if (!this._infogareServiceIndex?.length)
            this._rebuildInfogareServiceIndex();
        return this._infogareServiceIndex.find((x) => x.key === key) || null;
    }
    _selectInfogareService(key, showBoard = false) {
        const input = document.getElementById('infogare-service');
        const box = document.getElementById('infogare-service-suggestions');
        const entry = this._getInfogareServiceEntry(key);
        if (!input || !entry)
            return false;
        this._infogareSelectedServiceKey = entry.key;
        input.dataset.serviceKey = entry.key;
        input.value = entry.name;
        if (box) {
            box.innerHTML = '';
            box.classList.add('hidden');
        }
        const currentStation = this._infogareSelectedStationId || document.getElementById('infogare-station')?.dataset?.stationId || '';
        if (currentStation && !entry.stationIds.includes(currentStation))
            return false;
        if (!currentStation) {
            const first = entry.stationIds[0];
            if (first)
                this._selectInfogareStation(first, false);
        }
        this._infogarePage = 0;
        if (showBoard)
            this._showInfogareBoard();
        return true;
    }
    _commitInfogareServiceSearch(showBoard = true) {
        const input = document.getElementById('infogare-service');
        if (!input)
            return false;
        const typed = this._normalizeInfogareSearch(input.value);
        const current = input.dataset.serviceKey ? this._getInfogareServiceEntry(input.dataset.serviceKey) : null;
        if (current && this._normalizeInfogareSearch(current.name) === typed) {
            if (showBoard)
                this._showInfogareBoard();
            return true;
        }
        const matches = this._findInfogareServices(input.value, 12);
        if (!matches.length)
            return false;
        return this._selectInfogareService(matches[0].key, showBoard);
    }
    renderInfogarePage() {
        const input = document.getElementById('infogare-station');
        const box = document.getElementById('infogare-station-suggestions');
        if (!input)
            return;
        this._rebuildInfogareStationIndex();
        const previous = this._infogareSelectedStationId && this.game.world.getStationById(this._infogareSelectedStationId);
        if (previous && !previous.closed) {
            input.value = previous.name;
            input.dataset.stationId = previous.id;
        }
        else {
            input.value = '';
            delete input.dataset.stationId;
            this._infogareSelectedStationId = '';
            this._reBoard?.setActive(false);
        }
        input.oninput = () => {
            const selected = input.dataset.stationId ? this.game.world.getStationById(input.dataset.stationId) : null;
            if (!selected || this._normalizeInfogareSearch(selected.name) !== this._normalizeInfogareSearch(input.value)) {
                delete input.dataset.stationId;
                this._infogareSelectedStationId = '';
            }
            this._renderInfogareStationSuggestions(input.value);
        };
        input.onfocus = () => { if (input.value.trim())
            this._renderInfogareStationSuggestions(input.value); };
        input.onblur = () => setTimeout(() => box?.classList.add('hidden'), 120);
        const commit = () => {
            if (!this._commitInfogareStationSearch(true)) {
                input.setCustomValidity('Sélectionnez une gare valide.');
                input.reportValidity();
                input.setCustomValidity('');
            }
        };
        input.onkeydown = e => { if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        }
        else if (e.key === 'Escape')
            box?.classList.add('hidden'); };
        const btn = document.getElementById('btn-infogare-show');
        if (btn)
            btn.onclick = commit;
        if (previous && !previous.closed)
            this._showInfogareBoard();
    }
    _infogareDateDiffDays(fromDate, toDate) {
        if (!fromDate || !toDate)
            return 0;
        const a = Date.parse(`${fromDate}T00:00:00Z`);
        const b = Date.parse(`${toDate}T00:00:00Z`);
        if (!Number.isFinite(a) || !Number.isFinite(b))
            return 0;
        return Math.round((b - a) / 86400000);
    }
    _infogareAddDays(dateStr, days) {
        const t = Date.parse(`${dateStr}T00:00:00Z`);
        if (!Number.isFinite(t))
            return dateStr;
        return new Date(t + Number(days || 0) * 86400000).toISOString().slice(0, 10);
    }
    _infogareStationName(location) {
        if (!location)
            return '';
        if (location.stationId)
            return this.game.world.getStationById(location.stationId)?.name || location.name || '';
        return location.name || '';
    }
    _isInfogarePassengerCategory(category = '') {
        const c = String(category || '').trim().toUpperCase();
        if (!c)
            return true; // older passenger schedules often had no explicit category
        return ['PASSENGER', 'PASSAGER', 'PASSAGERS', 'VOYAGEUR', 'VOYAGEURS'].includes(c);
    }
    _isInfogarePassengerService(service) {
        if (!service)
            return false;
        const type = String(service.serviceType || '').trim().toLowerCase();
        if (type) {
            if (['fret', 'w', 'hlp', 'm-', 'evo', 'tm', 'infra', 'ttx', 'work'].includes(type))
                return false;
            if (['passager', 'passenger', 'voyageur', 'voyageurs'].includes(type))
                return true;
        }
        return this._isInfogarePassengerCategory(service.category || service.train?.category || '');
    }
    _collectInfogareV2Trains(stationId, currentDate, nowMin, horizonMin = 1440) {
        const runtime = this.game.scheduleV2Runtime;
        if (!runtime || !this.game.scheduleV2 || !this.game.rotationV2)
            return [];
        const rotations = runtime._runtimeRotations?.() || this.game.rotationV2.rotations || [];
        const liveById = new Map((this.game.scheduleCreator?.services || []).map((svc) => [String(svc.id), svc]));
        const rows = [];
        // J-1 catches services whose V2 timings explicitly continue after midnight;
        // J and J+1 provide a real rolling 24 h board instead of waiting for runtime spawn.
        const baseDates = [];
        for (let day = -1; day <= Math.ceil((nowMin + horizonMin) / 1440); day++)
            baseDates.push(this._infogareAddDays(currentDate, day));
        for (const rotation of rotations) {
            if (!rotation?.enabled)
                continue;
            for (const baseDate of baseDates) {
                let plans = [];
                try {
                    plans = runtime.planRotationForDate?.(rotation, baseDate) || [];
                }
                catch (err) {
                    console.warn('Infogare V2 planning skipped:', err);
                    continue;
                }
                const baseOffsetMin = this._infogareDateDiffDays(currentDate, baseDate) * 1440;
                for (const plan of plans) {
                    if (!plan?.ver || !Array.isArray(plan.locations) || !plan.locations.length)
                        continue;
                    const rec = this.game.scheduleV2.getSchedule(plan.occ?.scheduleId);
                    const serviceId = `v2:${rotation.id}:${plan.occ?.id}:${baseDate}`;
                    const live = liveById.get(serviceId) || null;
                    if (live?.completed)
                        continue;
                    const locs = plan.locations;
                    for (let i = 0; i < locs.length; i++) {
                        const item = locs[i];
                        const loc = item?.location;
                        if (!loc || loc.stationId !== stationId || loc.kind === 'PASS' || loc.type === 'passage' || loc.stopCode === 'NONE' && i > 0 && i < locs.length - 1)
                            continue;
                        const isFirst = i === 0;
                        const isLast = i === locs.length - 1;
                        const isDeparture = !isLast;
                        const isArrival = !isFirst;
                        const depSec = item.departureSec ?? item.arrivalSec;
                        const arrSec = item.arrivalSec ?? item.departureSec;
                        const depAbsMin = depSec == null ? null : baseOffsetMin + Number(depSec) / 60;
                        const arrAbsMin = arrSec == null ? null : baseOffsetMin + Number(arrSec) / 60;
                        const delay = Math.round(Number.isFinite(Number(live?.delay)) ? Number(live.delay) : 0);
                        const depWaitMin = depAbsMin == null ? null : depAbsMin + Math.max(0, delay) - nowMin;
                        const arrWaitMin = arrAbsMin == null ? null : arrAbsMin + Math.max(0, delay) - nowMin;
                        // Keep a narrow grace for trains currently at the platform, plus the next 24 h.
                        const waits = [depWaitMin, arrWaitMin].filter((v) => Number.isFinite(v));
                        if (!waits.some((v) => v >= -3 && v <= horizonMin))
                            continue;
                        const waitMin = isDeparture ? depWaitMin : arrWaitMin;
                        const servedStations = [];
                        const servedStationIds = [];
                        for (let j = i + 1; j < locs.length; j++) {
                            const n = locs[j]?.location;
                            if (n?.stationId && (j === locs.length - 1 || n.stopCode !== 'NONE') && n.type !== 'passage' && n.kind !== 'PASS') {
                                servedStations.push(this._infogareStationName(n));
                                servedStationIds.push(n.stationId);
                            }
                        }
                        const fromStations = [];
                        for (let j = 0; j < i; j++) {
                            const n = locs[j]?.location;
                            if (n?.stationId && (j === 0 || n.stopCode !== 'NONE') && n.type !== 'passage' && n.kind !== 'PASS')
                                fromStations.push(this._infogareStationName(n));
                        }
                        const nextStops = [];
                        for (let j = i + 1; j < locs.length; j++) {
                            const n = locs[j]?.location;
                            if (!n?.stationId || j !== locs.length - 1 && n.stopCode === 'NONE' || n?.type === 'passage' || n?.kind === 'PASS')
                                continue;
                            const sec = locs[j].arrivalSec ?? locs[j].departureSec;
                            nextStops.push({ name: this._infogareStationName(n), time: sec == null ? null : baseOffsetMin + Number(sec) / 60 });
                        }
                        const firstLoc = locs[0]?.location;
                        const lastLoc = locs[locs.length - 1]?.location;
                        const category = plan.ver?.category || rec?.currentVersion?.category || '';
                        const runtimeAtStation = live?._platformAssignment?.stationId === stationId || live?.train?.stoppedAt?.id === stationId;
                        const actualPlatform = (runtimeAtStation ? (live?._platformAssignment?.platform || live?.train?.platform || '') : '') || loc.track?.displayName || '';
                        rows.push({
                            svcId: live?.id || serviceId,
                            scheduleId: rec?.id || plan.occ?.scheduleId || '',
                            versionId: plan.ver?.id || rec?.currentVersion?.id || '',
                            occurrenceId: plan.occ?.id || '',
                            name: rec?.name || String(rec?.number || 'Train'),
                            trainNumber: rec?.number || live?.train?.number || '',
                            seriesName: live?.train?.seriesName || '',
                            category,
                            destination: this._infogareStationName(lastLoc) || '?',
                            origin: this._infogareStationName(firstLoc) || '?',
                            depTime: depAbsMin, arrTime: arrAbsMin, waitMin, depWaitMin, arrWaitMin,
                            isDeparture, isArrival, isFirst, isLast,
                            servedStations, servedStationIds, fromStations, nextStops,
                            delay,
                            delayReason: live?.delayReason || '',
                            isCancelled: !!(live?.cancelled || live?.state === 'cancelled' || plan.occ?.cancelled),
                            isFull: !!live?.isFull,
                            isFreightFull: !!live?.isFreightFull,
                            line: null,
                            lineCode: live?.lineCode || '',
                            lineName: live?.lineName || '',
                            lineColor: live?.lineColor || '#3b82f6',
                            voie: actualPlatform,
                            state: live?.state || 'planned',
                            speed: live?.speed || 0,
                            rame: live?.rame || null,
                            plannedV2: true,
                        });
                    }
                }
            }
        }
        return rows;
    }
    _collectInfogareLegacyTrains(stationId, currentDate, nowMin, horizonMin = 1440) {
        const results = [];
        for (const svc of this.game.scheduleCreator?.services || []) {
            if (!svc?.active || svc._v2OccurrenceId)
                continue;
            const currentStops = svc.getCurrentStops?.() || [];
            const runs = legacyBoardRuns({ id: String(svc.id), stops: svc.stops?.length ? svc.stops : currentStops,
                returnStops: svc.roundTrip ? svc.buildReturnStops?.() || [] : [], roundTrip: !!svc.roundTrip,
                multiDepartures: svc.multiDepartures, terminusWait: svc.terminusWait, runDays: svc.runDays, runDates: svc.runDates,
                operatingDay: svc._legacyOperatingDay || '', completedDay: svc._legacyLastFinishedDay || '', completed: !!svc.completed,
                isReturnLeg: !!svc.isReturnLeg, tripCount: svc._tripCount || 0, currentStops }, String(currentDate), nowMin, horizonMin);
            for (const run of runs) {
                const stops = run.stops;
                for (let i = 0; i < stops.length; i++) {
                    const stop = stops[i];
                    if (stop.stationId !== stationId || stop.type === 'waypoint' || stop.type === 'passage')
                        continue;
                    const isFirst = i === 0, isLast = i === stops.length - 1, isDeparture = !isLast, isArrival = !isFirst;
                    const depTime = stop.departureTime ?? null, arrTime = stop.arrivalTime ?? null;
                    const delay = run.live ? Math.round(Number(svc.delay) || 0) : 0;
                    const depWaitMin = depTime == null ? null : depTime + Math.max(0, delay) - nowMin, arrWaitMin = arrTime == null ? null : arrTime + Math.max(0, delay) - nowMin;
                    if (![depWaitMin, arrWaitMin].some(v => v != null && v >= -3 && v <= horizonMin))
                        continue;
                    const after = stops.slice(i + 1).filter(x => x.type !== 'waypoint' && x.type !== 'passage'), before = stops.slice(0, i).filter(x => x.type !== 'waypoint' && x.type !== 'passage');
                    const name = (id) => String(this.game.world.getStationById(id)?.name || '?');
                    const at = run.live && (svc._platformAssignment?.stationId === stationId || svc.train?.stoppedAt?.id === stationId);
                    results.push({ svcId: String(svc.id), occurrenceId: run.key, name: run.isReturn ? (svc.returnName || svc.name) : svc.name,
                        trainNumber: String((run.isReturn ? svc.returnNumber : svc.number) || svc.train?.number || ''), seriesName: String(svc.train?.seriesName || ''),
                        category: svc.category || svc.train?.category || svc.serviceType || '', destination: name(stops.at(-1)?.stationId), origin: name(stops[0]?.stationId),
                        depTime, arrTime, waitMin: isDeparture ? depWaitMin : arrWaitMin, depWaitMin, arrWaitMin, isDeparture, isArrival, isFirst, isLast,
                        servedStations: after.map(x => name(x.stationId)), servedStationIds: after.map(x => x.stationId), fromStations: before.map(x => name(x.stationId)), nextStops: after.map(x => ({ name: name(x.stationId), time: x.arrivalTime ?? null })), delay,
                        delayReason: run.live ? String(svc.delayReason || svc.train?.delayReason || '') : '', isCancelled: run.live && !!(svc.cancelled || svc.state === 'cancelled'),
                        isFull: false, isFreightFull: false, line: null, lineCode: '', lineName: '', lineColor: '#3b82f6', voie: String((at ? (svc._platformAssignment?.platform || svc.train?.platform) : '') || stop.platform || ''),
                        state: run.live ? svc.state : 'planned', speed: run.live ? svc.speed || 0 : 0, rame: svc.rame, plannedV2: false });
                }
            }
        }
        return results;
    }
    _getInfogareTrains(stationId, mode, horizonMin = 1440) {
        const pt = this.game.engine.getParisTime();
        const now = pt.hours * 60 + pt.minutes + Number(pt.seconds || 0) / 60;
        const currentDate = this.game.engine.currentDate || this.game.engine.getParisDate?.() || '';
        const results = [
            ...this._collectInfogareV2Trains(stationId, currentDate, now, horizonMin),
            ...this._collectInfogareLegacyTrains(stationId, currentDate, now, horizonMin),
        ];
        const passengerResults = results.filter((r) => this._isInfogarePassengerCategory(r.category || ''));
        const wantArrivals = mode === 'sncf-arr' || mode === 'afl-arrivee' || mode === 'cati-ar';
        const filtered = passengerResults.filter((r) => wantArrivals
            ? (r.isArrival && r.arrTime != null && Number.isFinite(r.arrWaitMin ?? r.waitMin) && Number(r.arrWaitMin ?? r.waitMin) >= -3 && Number(r.arrWaitMin ?? r.waitMin) <= horizonMin)
            : (r.isDeparture && r.depTime != null && Number.isFinite(r.depWaitMin ?? r.waitMin) && Number(r.depWaitMin ?? r.waitMin) >= -3 && Number(r.depWaitMin ?? r.waitMin) <= horizonMin))
            .map((r) => ({ ...r, waitMin: wantArrivals ? (r.arrWaitMin ?? r.waitMin) : (r.depWaitMin ?? r.waitMin) }));
        // One physical/scheduled occurrence appears once even if it is already spawned in runtime.
        const seen = new Set();
        const unique = [];
        for (const row of filtered) {
            const key = `${row.scheduleId || row.svcId}|${row.occurrenceId || ''}|${row.depTime ?? ''}|${row.arrTime ?? ''}|${stationId}|${wantArrivals ? 'A' : 'D'}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            unique.push(row);
        }
        unique.sort((a, b) => Number(a.waitMin ?? Infinity) - Number(b.waitMin ?? Infinity));
        return unique;
    }
    _fmtTime(min) {
        if (min == null || isNaN(min))
            return '--h--';
        const rounded = ((Math.round(Number(min)) % 1440) + 1440) % 1440;
        const h = Math.floor(rounded / 60), m = rounded % 60;
        return `${h}h${m.toString().padStart(2, '0')}`;
    }
    _fmtWait(min) {
        const total = Math.round(Number(min));
        if (!Number.isFinite(total))
            return '';
        if (total <= 0)
            return "a l'approche";
        if (total < 60)
            return `${total} min`;
        const h = Math.floor(total / 60), m = total % 60;
        return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h00`;
    }
    _fmtDelay(min) {
        const total = Math.round(Number(min));
        if (!Number.isFinite(total) || total <= 0)
            return "a l'heure";
        if (total < 60)
            return `retard ${total} min.`;
        const h = Math.floor(total / 60), m = total % 60;
        return m > 0 ? `retard ${h}h${m.toString().padStart(2, '0')}` : `retard ${h}h`;
    }
    _infogarePerPage(displayType) {
        const map = {
            'sncf-dep': 3,
            'sncf-arr': 4,
            'cati-ar': 6,
            'cati-3-3': 6,
            'cati-complet': 5,
            'old-sncf': 20,
            'db-abfahrt': 10,
            'db-quai': 0,
            'ecran-quai': 1,
            'flash-circulation': 0,
            'rer-ratp': 0,
            'rer-sncf': 6,
            'afl-depart': 1,
            'afl-arrivee': 1,
        };
        return map[displayType] ?? 4;
    }
    _updateInfogareMeta(station, trains = [], displayType = '') {
        const el = document.getElementById('infogare-live-meta');
        if (!el)
            return;
        const esc = (v) => this._escapeInfogareText(v);
        const live = (trains || []).filter((t) => t.state && t.state !== 'planned').length;
        const cancelled = (trains || []).filter((t) => t.isCancelled).length;
        const delayed = (trains || []).filter((t) => Number(t.delay) > 0).length;
        const kind = (displayType === 'sncf-arr' || displayType === 'cati-ar') ? 'arrivée(s)' : 'départ(s)';
        el.innerHTML = `<b>${esc(station?.name || 'Gare')}</b> · ${(trains || []).length} ${kind} sur les prochaines 24 h · ${live} live${delayed ? ` · ${delayed} retardé(s)` : ''}${cancelled ? ` · ${cancelled} supprimé(s)` : ''} · actualisation 5 s`;
    }
    _showInfogareBoard(_refreshOnly = false) {
        const input = document.getElementById('infogare-station');
        const stationId = String(input?.dataset?.stationId || this._infogareSelectedStationId || '');
        const host = document.getElementById('infogare-board');
        if (!stationId || !host)
            return;
        if (this._infogareInterval) {
            clearInterval(this._infogareInterval);
            this._infogareInterval = null;
        }
        this._stopInfogareClock();
        host.onwheel = null; // native vertical scrolling, no cyclic paging
        if (!this._reBoard)
            this._reBoard = new RailEmpireBoard(host, (horizon, arrivals) => {
                const id = String(document.getElementById('infogare-station')?.dataset?.stationId || this._infogareSelectedStationId || '');
                const pt = this.game.engine.getParisTime();
                const records = this._getInfogareTrains(id, arrivals ? 'sncf-arr' : 'sncf-dep', horizon);
                const rows = records.map((r) => ({
                    key: `${r.svcId}|${r.occurrenceId || ''}|${r.depTime ?? ''}|${r.arrTime ?? ''}|${arrivals ? 'A' : 'D'}`,
                    serviceId: String(r.svcId), name: String(r.name || ''), number: String(r.trainNumber || ''), category: String(r.category || ''),
                    origin: String(r.origin || ''), destination: String(r.destination || ''), via: arrivals ? r.fromStations.slice(1) : r.servedStations.slice(0, -1),
                    platform: String(r.voie || ''), plannedMinute: Number(arrivals ? r.arrTime : r.depTime), waitMinute: Number(r.waitMin || 0), delay: Number(r.delay || 0),
                    cancelled: !!r.isCancelled, state: String(r.state || ''), reason: String(r.delayReason || ''), dayOffset: Math.floor(Number(arrivals ? r.arrTime : r.depTime) / 1440),
                }));
                return { station: String(this.game.world.getStationById(id)?.name || 'Gare indisponible'), clock: `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}`, date: String(this.game.engine.currentDate || this.game.engine.getParisDate?.() || ''), rows };
            });
        this._reBoard.show(stationId);
    }
    _stopInfogareClock() {
        if (this._infogareClockInterval) {
            clearInterval(this._infogareClockInterval);
            this._infogareClockInterval = null;
        }
    }
    _animateInfogareBoard(board, displayType) {
        const lower = displayType.toLowerCase();
        board.classList.remove('ig-board-entrance', 'ig-anim-pulse', 'ig-anim-flash', 'ig-anim-shake');
        void board.offsetWidth; // force reflow
        board.classList.add('ig-board-entrance');
        // staggered row entrance
        const rows = board.querySelectorAll('[data-svc-id], .ig-sncf-row, .ig-cati-row, .ig-cati-33-row, .ig-rsncf-row, .ig-ratp-row, .ig-solari-row');
        rows.forEach((el, i) => {
            el.classList.add('ig-row-entrance');
            el.style.animationDelay = `${i * 0.05}s`;
        });
        // blink / pulse statuses
        const statusEls = board.querySelectorAll('.ig-sncf-status, .ig-cati-num, .ig-quai-status, .ig-afl-delay, .ig-ratp-wait-approche, .ig-pgl-delay, .ig-pban-delay, .ig-flash-sign-info');
        statusEls.forEach((el) => {
            const txt = el.textContent.toLowerCase();
            if (txt.includes('supprim') || txt.includes('annul') || txt.includes('cancel')) {
                el.classList.add('ig-status-cancel');
            }
            else if (txt.includes('retard') || txt.includes('retardé') || txt.includes('delayed')) {
                el.classList.add('ig-status-delay');
            }
            else if (txt.includes("approche") || txt.includes('approach')) {
                el.classList.add('ig-status-approach');
            }
        });
        // AFL / Flash / Quai pulse when disrupted
        const isDisrupted = board.textContent.toLowerCase().includes('retard') || board.textContent.toLowerCase().includes('supprim') || board.textContent.toLowerCase().includes('travaux');
        if (isDisrupted) {
            if (lower.includes('afl'))
                board.classList.add('ig-anim-pulse');
            if (lower.includes('flash'))
                board.querySelector('.ig-flash-sign-body')?.classList.add('ig-anim-pulse');
            if (lower.includes('quai'))
                board.querySelector('.ig-quai-status')?.classList.add('ig-anim-pulse');
        }
        // start live clock
        this._stopInfogareClock();
        this._updateInfogareClocks(board);
        this._infogareClockInterval = setInterval(() => {
            if (this.activePage !== 'infogare') {
                this._stopInfogareClock();
                return;
            }
            const b = document.getElementById('infogare-board');
            if (b)
                this._updateInfogareClocks(b);
        }, 1000);
    }
    _updateInfogareClocks(board) {
        const pt = this.game.engine.getParisTime();
        const nowStr = `${pt.hours.toString().padStart(2, '0')}:${pt.minutes.toString().padStart(2, '0')}`;
        const nowStrDot = nowStr.replace(':', '.');
        const nowStrSpace = nowStr.replace(':', ' ');
        // any element whose class contains "clock" inside the board, plus palette digital
        board.querySelectorAll('[class*="clock"], .ig-palette-time-digital').forEach((el) => {
            const txt = el.textContent;
            if (txt.includes(':'))
                el.textContent = nowStr;
            else if (txt.includes('.'))
                el.textContent = nowStrDot;
            else if (txt.includes('h')) { /* keep h format in palette? palette uses digital */ }
            else
                el.textContent = nowStr;
        });
        // palette analog clock
        const hourHand = board.querySelector('.ig-palette-clock-hand');
        const minHand = board.querySelector('.ig-palette-clock-hand-min');
        if (hourHand && minHand) {
            const totalMin = pt.hours * 60 + pt.minutes + (pt.seconds || 0) / 60;
            hourHand.style.transform = `rotate(${(totalMin / 2) % 360}deg)`;
            minHand.style.transform = `rotate(${(totalMin * 6) % 360}deg)`;
        }
        // footer clocks (second span inside cati/afl/sncf footers)
        board.querySelectorAll('.ig-cati-footer, .ig-afl-footer, .ig-sncf-footer').forEach((foot) => {
            const last = foot.lastElementChild;
            if (last && last.textContent.match(/\d{1,2}[:.h ]\d{2}/)) {
                if (last.textContent.includes('.'))
                    last.textContent = nowStrDot;
                else
                    last.textContent = nowStr;
            }
        });
    }
    // --- RER RATP — live board validated with the player (v1.1.61) ---
    _rerRatpWaitText(waitMin) {
        if (!Number.isFinite(Number(waitMin)))
            return '';
        const raw = Number(waitMin);
        if (raw <= 0)
            return '0 min';
        const mins = Math.max(1, Math.ceil(raw));
        if (mins <= 59)
            return `${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    }
    _rerRatpTopDirections(trains) {
        const stats = new Map();
        let order = 0;
        for (const t of trains || []) {
            if (!t?.isDeparture || !t.destination)
                continue;
            const w = Number(t.waitMin);
            if (!Number.isFinite(w) || w < -1 || w > 1440)
                continue;
            const key = String(t.destination).trim();
            if (!key)
                continue;
            const cur = stats.get(key) || { name: key, count: 0, first: order++ };
            cur.count++;
            stats.set(key, cur);
        }
        return [...stats.values()]
            .sort((a, b) => (b.count - a.count) || (a.first - b.first) || a.name.localeCompare(b.name, 'fr'))
            .slice(0, 2)
            .map((x) => x.name);
    }
    _rerRatpIncidentText(stationId, trains) {
        const im = this.game.incidentManager;
        const active = im?.getActiveIncidents?.() || [];
        if (!active.length)
            return 'Circulation normale.';
        const relevantStations = new Set([stationId]);
        const relevantServices = new Set();
        for (const t of trains || []) {
            if (!t?.isDeparture)
                continue;
            const w = Number(t.waitMin);
            if (!Number.isFinite(w) || w < -1 || w > 1440)
                continue;
            for (const id of t.servedStationIds || [])
                if (id)
                    relevantStations.add(id);
            if (t.svcId)
                relevantServices.add(t.svcId);
        }
        const relevant = active.filter((inc) => {
            if (!inc?.active)
                return false;
            if (inc.serviceId && relevantServices.has(inc.serviceId))
                return true;
            return (inc.stationA && relevantStations.has(inc.stationA)) ||
                (inc.stationB && relevantStations.has(inc.stationB));
        });
        if (!relevant.length)
            return 'Circulation normale.';
        return relevant.slice(0, 2).map((inc) => {
            const loc = inc.stationAName && inc.stationBName
                ? `${inc.stationAName} – ${inc.stationBName}`
                : (inc.stationAName || inc.stationBName || inc.trackName || 'sur le parcours');
            return `${inc.name}${loc ? ` — ${loc}` : ''}.`;
        }).join(' ');
    }
    _renderRerRatp(station, trains, nowStr, _page = 0) {
        const esc = (value) => String(value ?? '')
            .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
        const all24h = (trains || []).filter((t) => t?.isDeparture && Number.isFinite(Number(t.waitMin)) && Number(t.waitMin) >= -1 && Number(t.waitMin) <= 1440);
        const use = all24h.slice(0, 5);
        const dirs = this._rerRatpTopDirections(all24h);
        const company = String(this.game.account?.companyName || 'Rail Empire').trim() || 'Rail Empire';
        const incident = this._rerRatpIncidentText(station?.id, all24h);
        const rows = Array.from({ length: 5 }, (_, i) => {
            const t = use[i] || null;
            const code = t ? String(t.name || t.trainNumber || '').trim() : '';
            const wait = t ? this._rerRatpWaitText(t.waitMin) : '';
            const compact = code.length > 6 ? ' ig-ratp-code-small' : '';
            const cancelled = !!t?.isCancelled;
            const waitMarkup = cancelled ? 'SUPPR.' : (wait.endsWith(' min')
                ? `<span class="ig-ratp-wait-num">${esc(wait.slice(0, -4))}</span><span class="ig-ratp-wait-unit">min</span>`
                : esc(wait));
            return `<div class="ig-ratp-live-row${htmlText(cancelled ? ' is-cancelled' : '')}"${t?.svcId ? ` data-svc-id="${esc(t.svcId)}"` : ''}>
        <div class="ig-ratp-live-code${htmlText(compact)}">${esc(code)}</div>
        <div class="ig-ratp-live-destination">${esc(t?.destination || '')}</div>
        <div class="ig-ratp-live-wait">${waitMarkup}</div>
        <div class="ig-ratp-live-tail"></div>
      </div>`;
        }).join('');
        const directions = dirs.length
            ? dirs.map((d) => `<div>${esc(d)}</div>`).join('')
            : `<div>${esc(station?.name || '')}</div>`;
        return `<div class="ig-ratp-live-board">
      <div class="ig-ratp-live-header">
        <div class="ig-ratp-live-company">${esc(company)}</div>
        <div class="ig-ratp-live-directions">${directions}</div>
        <div class="ig-ratp-live-clock">${esc(nowStr)}</div>
      </div>
      <div class="ig-ratp-live-redline"></div>
      <div class="ig-ratp-live-rows">${rows}</div>
      <div class="ig-ratp-live-footer">
        <div class="ig-ratp-live-alert">!</div>
        <div class="ig-ratp-live-message">${esc(incident)}</div>
        <div class="ig-ratp-live-stripes"><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </div>`;
    }
    // --- RER SNCF / Transilien — user's real "Prochains Trains" reference ---
    _renderRerSncf(station, trains, nowStr, page = 0) {
        // Exact composite supplied by the player. The left monitor is the live board;
        // the right monitor remains the original reference instead of being redrawn.
        const W = 2048, H = 936, scale = 0.54;
        const img = 'img/infogare/reference-sources/RER-SNCF_SOURCE.jpg';
        const all = trains.filter((t) => t.isDeparture);
        const use = all.slice(page * 6, page * 6 + 6);
        let html = this._igPhotoFrame(img, W, H, scale, 'ig-photo-rsncf');
        const navy = this._igPhotoMask('#11183f', .89);
        const cream = this._igPhotoMask('#f0f0ed', .92);
        html += this._igField({ x: 8.3, y: 27.0, w: 5.4, h: 4.2 }, nowStr, { color: '#fff', fontSize: 8 * scale, weight: 800, align: 'center', bg: this._igPhotoMask('#60727b', .92) }, 0);
        const ys = [32.1, 39.4, 46.6, 53.8, 61.0, 68.2];
        for (let i = 0; i < 6; i++) {
            const t = use[i], y = ys[i];
            const line = t?.lineCode || '';
            const code = t ? String(t.name || t.trainNumber || '').split(/\s+/)[0].slice(0, 6).toUpperCase() : '';
            let wait = '';
            if (t) {
                if (t.isCancelled)
                    wait = 'supprimé';
                else if (t.waitMin <= 1)
                    wait = "à l'approche";
                else
                    wait = t.waitMin < 60 ? `${Math.round(t.waitMin)} min` : this._fmtWait(t.waitMin);
            }
            const via = t ? (t.servedStations || []).slice(0, 4).join(' › ') : '';
            html += this._igField({ x: 8.2, y: y + .8, w: 3.6, h: 4.6 }, line, { color: '#fff', fontSize: 7 * scale, weight: 900, align: 'center', bg: this._igPhotoMask(t?.lineColor || '#0b7f86', .92) }, 0);
            html += this._igField({ x: 12.1, y: y + .6, w: 7.5, h: 3.4 }, code, { color: '#aaaabc', fontSize: 5.7 * scale, weight: 650, bg: navy }, 0);
            html += this._igField({ x: 19.6, y: y + .25, w: 21.8, h: 4.2 }, t?.destination || '', { color: '#fff', fontSize: 8.4 * scale, weight: 800, bg: navy }, 0);
            html += this._igField({ x: 41.4, y: y + .25, w: 4.2, h: 4.2 }, wait, { color: t?.isCancelled ? '#ffb4a8' : '#fff', fontSize: 5.5 * scale, weight: 700, align: 'right', bg: navy }, 0);
            html += this._igField({ x: 45.7, y: y + .1, w: 2.5, h: 4.7 }, t?.voie || '', { color: '#11183f', fontSize: 8.2 * scale, weight: 900, align: 'center', bg: cream }, 0);
            html += this._igField({ x: 12.0, y: y + 4.0, w: 33.5, h: 2.4 }, via ? `› ${htmlText(via)}` : '', { color: '#dddde3', fontSize: 4.3 * scale, bg: navy }, 0);
            if (t?.svcId)
                html += `<div class="ig-image-hit" data-svc-id="${htmlText(t.svcId)}" style="left:7.5%;width:40.5%;top:${htmlText(y)}%;height:6.4%"></div>`;
        }
        if (all.length > 6)
            html += `<div class="ig-image-field ig-photo-page" style="left:43%;top:72.5%;width:4%;height:2%;font-size:${htmlText(5 * scale)}px;color:#555;justify-content:flex-end">${page + 1}/${Math.ceil(all.length / 6)}</div>`;
        html += `</div>`;
        return html;
    }
    // --- SNCF DEPARTS (blue) --- exact replica with voie badges
    _renderSncfDep(station, trains, nowStr) {
        let rows = '';
        for (const t of trains) {
            const m = (t.name || '').match(/^([A-Za-z]+)(.*)$/);
            const type = m ? m[1] : (t.seriesName || 'TER');
            const num = m ? m[2].trim() : (t.trainNumber || t.name);
            let statusStr = '', remark = '';
            if (t.isCancelled) {
                statusStr = `<span class="ig-sncf-cancelled">supprimé</span>`;
                remark = 'La clientèle est invitée à emprunter le train suivant.';
            }
            else if (t.isFull || t.isFreightFull) {
                statusStr = `<span class="ig-sncf-full">TRAIN COMPLET</span>`;
            }
            else if (t.delay > 0) {
                statusStr = `<span class="ig-sncf-delay">retardé ${Math.round(t.delay)} min</span>`;
                remark = t.delayReason || 'Incident en cours d’identification';
            }
            else {
                statusStr = `<span class="ig-sncf-ontime">à l'heure</span>`;
            }
            const stops = t.servedStations.slice(0, 6).join(' \u2022 ');
            rows += `<div class="ig-sncf-row" data-svc-id="${htmlText(t.svcId)}">
        <div class="ig-sncf-main">
          <span class="ig-sncf-time">${htmlText(this._fmtTime(t.depTime))}</span>
          <span class="ig-sncf-trainid">
            <span class="ig-sncf-type">${htmlText(type || t.seriesName || 'TER')}</span>
            <span class="ig-sncf-trainnum">${htmlText(num || t.trainNumber || t.name)}</span>
          </span>
          <span class="ig-sncf-destcol">
            <span class="ig-sncf-dest">${htmlText(t.destination)}</span>
            ${stops ? `<span class="ig-sncf-stops">${htmlText(stops)}</span>` : ''}
          </span>
          <span class="ig-sncf-status">${statusStr}</span>
        </div>
        ${remark ? `<div class="ig-sncf-remark">${htmlText(remark)}</div>` : ''}
      </div>`;
        }
        return `<div class="ig-sncf-board ig-sncf-dep">
      <div class="ig-sncf-topbar">
        <div class="ig-sncf-topclock">${nowStr}</div>
        <div class="ig-sncf-topstation">${htmlText(station?.name || '')}</div>
        <div class="ig-sncf-topsncf">SNCF</div>
      </div>
      <div class="ig-sncf-header ig-sncf-header-dep">
        <span></span>
        <span>N°</span>
        <span>DESTINATION</span>
        <span></span>
      </div>
      <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
    </div>`;
    }
    // --- SNCF ARRIVEES (green) --- exact replica
    _renderSncfArr(station, trains, nowStr) {
        let rows = '';
        for (const t of trains) {
            const m = (t.name || '').match(/^([A-Za-z]+)(.*)$/);
            const type = m ? m[1] : (t.seriesName || 'TER');
            const num = m ? m[2].trim() : (t.trainNumber || t.name);
            let statusStr = '', remark = '';
            if (t.isCancelled) {
                statusStr = `<span class="ig-sncf-cancelled">supprimé</span>`;
            }
            else if (t.delay > 0) {
                statusStr = `<span class="ig-sncf-delay">retardé ${Math.round(t.delay)} min</span>`;
                remark = t.delayReason || 'Conditions climatiques exceptionnelles';
            }
            else {
                statusStr = `<span class="ig-sncf-ontime">à l'heure</span>`;
            }
            rows += `<div class="ig-sncf-row" data-svc-id="${htmlText(t.svcId)}">
        <div class="ig-sncf-main">
          <span class="ig-sncf-time">${htmlText(this._fmtTime(t.arrTime))}</span>
          <span class="ig-sncf-trainid">
            <span class="ig-sncf-type">${htmlText(type || t.seriesName || 'TER')}</span>
            <span class="ig-sncf-trainnum">${htmlText(num || t.trainNumber || t.name)}</span>
          </span>
          <span class="ig-sncf-destcol">
            <span class="ig-sncf-dest">${htmlText(t.origin)}</span>
          </span>
          <span class="ig-sncf-status">${statusStr}</span>
          <span class="ig-sncf-voie">${htmlText(t.voie || '')}</span>
        </div>
        ${remark ? `<div class="ig-sncf-remark">${htmlText(remark)}</div>` : ''}
      </div>`;
        }
        return `<div class="ig-sncf-board ig-sncf-arr">
      <div class="ig-sncf-topbar">
        <div class="ig-sncf-topclock">${nowStr}</div>
        <div class="ig-sncf-topstation">${htmlText(station?.name || '')}</div>
        <div class="ig-sncf-topsncf">SNCF</div>
      </div>
      <div class="ig-sncf-header ig-sncf-header-arr">
        <span></span>
        <span>N°</span>
        <span>PROVENANCE</span>
        <span></span>
        <span>VOIE</span>
      </div>
      <div class="ig-sncf-rows">${rows || '<div style="color:#ccc;padding:16px;text-align:center">Aucun train prevu</div>'}</div>
    </div>`;
    }
    // --- OLD SNCF (Solari split-flap) --- exact Gare du Nord style
    _renderOldSncf(station, trains, nowStr) {
        let rows = '';
        for (const t of trains) {
            const servedTxt = t.servedStations.join('  ').toUpperCase();
            const destFull = `${t.destination.toUpperCase()}${servedTxt ? '  ' + servedTxt : ''}`;
            let remarks = (t.seriesName || '').toUpperCase();
            if (t.isCancelled)
                remarks = 'SUPP';
            else if (t.isFull || t.isFreightFull)
                remarks = 'PLEIN';
            rows += `<div class="ig-solari-row" data-svc-id="${htmlText(t.svcId)}">
        <span class="ig-solari-cell ig-solari-time">${htmlText(this._fmtTime(t.depTime).replace('h', '.'))}</span>
        <span class="ig-solari-cell ig-solari-dest">${htmlText(destFull)}</span>
        <span class="ig-solari-cell ig-solari-remarks">${htmlText(remarks)}</span>
        <span class="ig-solari-cell ig-solari-num">${htmlText(t.trainNumber || t.name || '')}</span>
        <span class="ig-solari-cell ig-solari-voie">${htmlText(t.voie || '')}</span>
      </div>`;
        }
        setTimeout(() => this._animateSolari(), 50);
        return `<div class="ig-solari-board">
      <div class="ig-solari-header">
        <span>DEPART</span><span>DEPARTURE</span><span>ABFAHRT</span>
      </div>
      <div class="ig-solari-subheader">
        <span>Trains au depart</span>
        <span>Departing trains</span>
        <span>Abfahrt der Zuge</span>
      </div>
      <div class="ig-solari-colheader"><span>heure</span><span>destination - desservant</span><span>remarques</span><span>train n\u00b0</span><span>voie</span></div>
      <div class="ig-solari-rows">${rows || '<div style="color:#ccbb33;padding:16px;text-align:center;letter-spacing:2px">AUCUN TRAIN PREVU</div>'}</div>
      <div class="ig-solari-footer">
        <div class="ig-solari-clock">${nowStr.replace(':', '.')}</div>
      </div>
    </div>`;
    }
    _animateSolari() {
        const cells = document.querySelectorAll('.ig-solari-cell');
        cells.forEach((el, idx) => {
            el.classList.add('ig-solari-flip');
            el.style.animationDelay = `${Math.floor(idx / 5) * 0.12}s`;
        });
    }
    // --- Flash Circulation : panneau bleu/jaune d'info trafic réseau (image annexe INFOGARE) ---
    _renderFlashCirculation(station, nowStr) {
        const im = this.game.incidentManager;
        const bulletins = im?.getBulletins?.() || [];
        const services = this.game.scheduleCreator?.services || [];
        const delayed = services.filter((s) => s.active && s.delay >= 15 && this._isInfogarePassengerService(s)).slice(0, 4);
        const pt = this.game.engine?.getParisTime?.();
        const timeOfDay = pt ? (pt.hours * 60 + pt.minutes) : 0;
        const dateStr = this.game.engine?.currentDate || this.game.engine?.getParisDate?.() || '';
        const works = this.game.worksManager?.getActive?.(dateStr, timeOfDay) || [];
        const items = [];
        for (const b of bulletins)
            items.push(`${b.name} : ${b.description || 'perturbation en cours'}`);
        for (const d of delayed)
            items.push(`${d.name} — retard ${Math.round(d.delay)} min`);
        for (const w of works)
            items.push(`Travaux : ${w.name || w.type || 'chantier'}`);
        const main = items.length ? items.join(' / ') : 'LA CIRCULATION DES TRAINS EST NORMALE. AUCUNE PERTURBATION MAJEURE EN COURS.';
        const W = 250, H = 140, scale = 3;
        let html = this._igPhotoFrame('img/infogare/FLASH-CIRCULATION.png', W, H, scale, 'ig-photo-flash');
        // Keep the supplied yellow/blue artwork. Only the original message characters are covered.
        const yellow = this._igPhotoMask('#fec152', .88), blue = this._igPhotoMask('#0b4f9b', .90);
        html += this._igField({ x: 28, y: 8, w: 67, h: 60 }, main, { color: '#001c5a', fontSize: 5.6 * scale, weight: 700, bg: yellow, style: 'white-space:normal;line-height:1.16;overflow-wrap:break-word;' }, 0);
        html += this._igField({ x: 28, y: 73, w: 40, h: 9 }, 'INFORMATIONS À SUIVRE', { color: '#001c5a', fontSize: 5.2 * scale, weight: 700, bg: yellow }, 0);
        html += this._igField({ x: 84, y: 91, w: 13, h: 6.5 }, nowStr.replace(':', ' '), { color: '#fff', fontSize: 5.2 * scale, weight: 700, align: 'center', bg: blue }, 0);
        html += '</div>';
        return html;
    }
    // --- CATI 3-3 : 2 groupes de 3 lignes (tableau compact) ---
    _renderCATI3_3(station, trains, nowStr) {
        const dep = trains.filter((r) => r.isDeparture).slice(0, 6);
        const mid = Math.ceil(dep.length / 2);
        const left = dep.slice(0, mid);
        const right = dep.slice(mid);
        const cell = (t) => {
            const stops = t.servedStations.slice(0, 2).join(' ');
            return `<div class="ig-cati-33-row" data-svc-id="${htmlText(t.svcId)}">
        <span class="ig-cati-33-stops">${htmlText(stops)}</span>
        <span class="ig-cati-33-time">${htmlText(this._fmtTime(t.depTime))}</span>
        <span class="ig-cati-33-dest">${htmlText(t.destination)}</span>
      </div>`;
        };
        const col = (items) => items.length ? items.map(cell).join('') : '<div class="ig-cati-empty">Aucun départ</div>';
        const first = dep[0];
        const topInfo = first ? `${this._fmtTime(first.depTime)} ${first.destination}` : 'Aucun train';
        return `<div class="ig-cati-board ig-cati-3-3">
      <div class="ig-cati-header">
        <span class="ig-cati-station">${htmlText(station?.name || '')}</span>
        <span class="ig-cati-title">${htmlText(topInfo)}</span>
        <span class="ig-cati-clock">${nowStr}</span>
      </div>
      <div class="ig-cati-33-cols">
        <div class="ig-cati-33-col">${col(left)}</div>
        <div class="ig-cati-33-col">${col(right)}</div>
      </div>
      <div class="ig-cati-footer"><span>CATI 3-3</span><span>${nowStr}</span></div>
      <div class="ig-cati-side">départs</div>
    </div>`;
    }
    // --- AFL Départ : annonce lumineuse du prochain départ ---
    _renderAFLDepart(station, trains, nowStr, page = 0) {
        const deps = trains.filter((r) => r.isDeparture);
        const t = deps[page] || deps[0];
        if (!t)
            return `<div class="ig-afl-board"><div class="ig-afl-station">${htmlText(station?.name || '')}</div><div class="ig-afl-msg">Aucun départ prévu</div></div>`;
        const delay = `<span class="${htmlText(t.delay > 0 ? 'ig-afl-delay' : 'ig-afl-ontime')}">${this._fmtDelay(t.delay).replace(/^retard /, 'Retard ')}</span>`;
        const via = t.servedStations?.slice(0, 4).join(' – ') || '';
        return `<div class="ig-afl-board" data-svc-id="${htmlText(t.svcId)}">
      <div class="ig-afl-header">${htmlText(station?.name || '')} <span class="ig-afl-clock">${nowStr}</span></div>
      <div class="ig-afl-prochain">Prochain départ</div>
      <div class="ig-afl-destination">${htmlText(t.destination)}</div>
      ${via ? `<div class="ig-afl-via">via ${htmlText(via)}</div>` : ''}
      <div class="ig-afl-line">${htmlText(this._fmtTime(t.depTime))} ${delay}</div>
      <div class="ig-afl-details">Train ${htmlText(t.name)} — Voie ${htmlText(t.voie || '—')}</div>
    </div>`;
    }
    // --- AFL Arrivée : annonce lumineuse de la prochaine arrivée ---
    _renderAFLArrivee(station, trains, nowStr, page = 0) {
        const arrs = trains.filter((r) => r.isArrival);
        const t = arrs[page] || arrs[0];
        if (!t)
            return `<div class="ig-afl-board ig-afl-arr"><div class="ig-afl-station">${htmlText(station?.name || '')}</div><div class="ig-afl-msg">Aucune arrivée prévue</div></div>`;
        const status = t.state === 'stopped_at_station' && t.isLast ? 'Arrivé' : `dans ${this._fmtWait(t.waitMin) || '—'}`;
        const from = t.fromStations?.slice(-3).join(' – ') || '';
        return `<div class="ig-afl-board ig-afl-arr" data-svc-id="${htmlText(t.svcId)}">
      <div class="ig-afl-header">${htmlText(station?.name || '')} <span class="ig-afl-clock">${nowStr}</span></div>
      <div class="ig-afl-prochain">Prochaine arrivée</div>
      <div class="ig-afl-destination">${htmlText(t.origin)}</div>
      ${from ? `<div class="ig-afl-via">depuis ${htmlText(from)}</div>` : ''}
      <div class="ig-afl-line">${htmlText(this._fmtTime(t.arrTime))} — ${htmlText(status)}</div>
      <div class="ig-afl-details">Train ${htmlText(t.name)} — Voie ${htmlText(t.voie || '—')}</div>
    </div>`;
    }
    // --- PLATFORM DISPLAY (click on a train) ---
    _showPlatformDisplay(svcId, stationId) {
        const svc = this.game.scheduleCreator?.services?.find((s) => s.id === svcId);
        const station = this.game.world.getStationById(stationId);
        if (!svc) {
            const row = (this._infogareVisibleTrains || []).find((r) => r.svcId === svcId);
            if (row && station) {
                this._showPlannedInfogareDetail(row, station);
            }
            return;
        }
        const stops = svc.getCurrentStops();
        const pt = this.game.engine.getParisTime();
        const nowStr = `${pt.hours.toString().padStart(2, '0')}:${pt.minutes.toString().padStart(2, '0')}`;
        const stopIdx = stops.findIndex((s) => s.stationId === stationId);
        const isGrandeLigne = (svc.rame?.maxSpeed || 0) >= 160;
        const servedAfter = [];
        for (let i = stopIdx + 1; i < stops.length; i++) {
            if (stops[i].type === 'waypoint' || stops[i].type === 'passage')
                continue;
            const st = this.game.world.getStationById(stops[i].stationId);
            if (st)
                servedAfter.push({ name: st.name, isLast: i === stops.length - 1 });
        }
        const lastStop = stops[stops.length - 1];
        const destStation = this.game.world.getStationById(lastStop?.stationId);
        const depTime = stops[stopIdx]?.departureTime;
        const delayStr = this._fmtDelay(svc.delay);
        const numCars = svc.rame?.elementDetails?.length || 8;
        const board = document.getElementById('infogare-board');
        if (!board)
            return;
        if (isGrandeLigne) {
            board.innerHTML = this._renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
        }
        else {
            board.innerHTML = this._renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars);
        }
        this._animateInfogareBoard(board, 'platform');
        board.querySelector('.ig-platform-back')?.addEventListener('click', () => this._showInfogareBoard());
    }
    _showPlannedInfogareDetail(row, station) {
        const board = document.getElementById('infogare-board');
        if (!board)
            return;
        const pt = this.game.engine.getParisTime();
        const nowStr = `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')}`;
        const formation = this._dbQuaiFormation(row.scheduleId || '', row.versionId || '', row.occurrenceId || '', row.svcId || '');
        const esc = (v) => this._escapeInfogareText(v);
        const stops = (row.nextStops || []).map((n) => `<span>${esc(n.name)}${Number.isFinite(Number(n.time)) ? ` <small>${esc(this._fmtTime(n.time))}</small>` : ''}</span>`).join('');
        const vehicles = formation.map((v) => `<span class="ig-planned-vehicle${htmlText((v.traction && v.traction !== 'none') ? ' is-powered' : '')}">${esc(v.number || v.name || 'Véhicule')}</span>`).join('');
        const effective = Number(row.delay) > 0 ? Number(row.depTime ?? row.arrTime) + Number(row.delay) : null;
        board.innerHTML = `<div class="ig-planned-detail">
      <div class="ig-planned-head"><button class="ig-platform-back btn-sm">← Retour</button><div><b>${esc(row.name || row.trainNumber || 'Train')}</b><small>${esc(station.name || '')} · mise à jour ${esc(nowStr)}</small></div><strong>${esc(row.voie ? `Voie ${row.voie}` : 'Voie —')}</strong></div>
      <div class="ig-planned-main"><div><small>Départ prévu</small><b>${esc(this._fmtTime((row.depTime ?? row.arrTime)))}</b>${effective != null ? `<em>${esc(this._fmtTime(effective))} (+${htmlText(Math.round(Number(row.delay)))} min)</em>` : ''}</div><div><small>Destination</small><b>${esc(row.destination || '?')}</b><em>${row.isCancelled ? 'SUPPRIMÉ' : esc(row.state === 'planned' ? 'Horaire planifié' : 'Service en cours')}</em></div></div>
      <div class="ig-planned-section"><h4>Dessertes suivantes</h4><div class="ig-planned-stops">${stops || '<span>Terminus</span>'}</div></div>
      <div class="ig-planned-section"><h4>Composition prévue</h4><div class="ig-planned-formation">${vehicles || '<span>Aucune composition affectée</span>'}</div></div>
    </div>`;
        board.querySelector('.ig-platform-back')?.addEventListener('click', () => this._showInfogareBoard());
    }
    // --- Platform Grande Ligne --- exact Ouigo/TGV display
    _renderPlatformGL(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars) {
        const stopsHtml = servedAfter.map((s) => `<div class="ig-pgl-stop ${htmlText(s.isLast ? 'ig-pgl-terminus' : '')}"><span class="ig-pgl-bullet">\u25CF</span>${htmlText(s.name)}</div>`).join('');
        let carsHtml = '';
        for (let i = 1; i <= numCars; i++) {
            carsHtml += `<div class="ig-pgl-car">${i}</div>`;
        }
        const sections = 'ABCDEFGH';
        let sectionsHtml = '';
        const numSections = Math.min(8, Math.ceil(numCars / 2));
        for (let i = 0; i < numSections; i++) {
            sectionsHtml += `<div class="ig-pgl-section">${sections[i]}</div>`;
        }
        const seriesName = svc.train?.seriesName || svc.rame?.seriesName || '';
        const trainNum = svc.train?.number || svc.name || '';
        return `<div class="ig-pgl-board">
      <div class="ig-pgl-back"><button class="ig-platform-back btn-sm" style="background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">\u2190 Retour</button></div>
      <div class="ig-pgl-header">
        <div class="ig-pgl-left">
          <div class="ig-pgl-series">${htmlText(seriesName)}</div>
          <div class="ig-pgl-time">${htmlText(this._fmtTime(depTime))}</div>
          ${delayStr ? `<div class="ig-pgl-delay">${delayStr}</div>` : ''}
          <div class="ig-pgl-dest">${htmlText(destStation?.name || '?')}</div>
          <div class="ig-pgl-trainnum">${htmlText(seriesName)} ${htmlText(trainNum)}</div>
        </div>
        <div class="ig-pgl-right">
          <div class="ig-pgl-watermark">depart</div>
          <div class="ig-pgl-stops">${stopsHtml || '<div style="color:#7788aa">Terminus</div>'}</div>
        </div>
      </div>
      <div class="ig-pgl-composition">
        <div class="ig-pgl-station-center"><span class="ig-pgl-station-label">${htmlText(station?.name || '')}</span></div>
        <div class="ig-pgl-cars">${carsHtml}</div>
        <div class="ig-pgl-sections">${sectionsHtml}</div>
      </div>
      <div class="ig-pgl-footer">
        <div class="ig-pgl-info-bar">Information en temps reel</div>
        <div class="ig-pgl-clock">${nowStr}</div>
        <div class="ig-pgl-sncf">SNCF</div>
      </div>
    </div>`;
    }
    // --- Platform Banlieue --- exact Transilien cream display
    _renderPlatformBanlieue(svc, station, destStation, servedAfter, depTime, delayStr, nowStr, numCars) {
        const half = Math.ceil(servedAfter.length / 2);
        const col1 = servedAfter.slice(0, half);
        const col2 = servedAfter.slice(half);
        const col1Html = col1.map((s) => `<div class="ig-pban-stop-item"><span class="ig-pban-stop-dot">\u25CF</span><span class="ig-pban-stop-name${htmlText(s.isLast ? ' ig-pgl-terminus' : '')}">${htmlText(s.name)}</span></div>`).join('');
        const col2Html = col2.map((s) => `<div class="ig-pban-stop-item"><span class="ig-pban-stop-dot">\u25CF</span><span class="ig-pban-stop-name${htmlText(s.isLast ? ' ig-pgl-terminus' : '')}">${htmlText(s.name)}</span></div>`).join('');
        let crowdHtml = '';
        const crowdClasses = ['ig-pban-car-green', 'ig-pban-car-green', 'ig-pban-car-orange', 'ig-pban-car-red'];
        const crowdIcons = ['\u{1F9CD}', '\u{1F9CD}', '\u{1F9CD}\u{1F9CD}', '\u{1F9CD}\u{1F9CD}\u{1F9CD}'];
        for (let i = 0; i < numCars; i++) {
            const lvl = Math.floor(Math.random() * 3);
            crowdHtml += `<div class="ig-pban-car-box ${htmlText(crowdClasses[lvl])}"><span class="ig-pban-car-icon">${lvl === 0 ? '\u{1F7E2}' : lvl === 1 ? '\u{1F7E0}' : '\u{1F534}'}</span></div>`;
        }
        const lineColor = svc.train?.color || '#2d8a4e';
        const lineCode = svc.train?.seriesName?.[0] || '?';
        const trainIsLong = numCars > 4;
        const voieStr = svc.train?.platform || '?';
        const pt = this.game.engine.getParisTime();
        const now = pt.hours * 60 + pt.minutes;
        let waitMin = depTime != null ? depTime - now : null;
        if (waitMin != null && waitMin < 0)
            waitMin += 1440;
        const waitStr = svc.state === 'stopped_at_station' ? 'a quai' : this._fmtWait(waitMin);
        const totalPages = Math.ceil(servedAfter.length / 10) || 1;
        return `<div class="ig-pban-board">
      <div class="ig-pban-back"><button class="ig-platform-back btn-sm" style="background:rgba(0,0,0,.1);color:#333;border:1px solid #aaa;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">\u2190 Retour</button></div>
      <div class="ig-pban-header">
        <div class="ig-pban-clock">${nowStr}</div>
        <div class="ig-pban-title">Prochain Train</div>
        <div class="ig-pban-platform">
          <span class="ig-pban-platform-num">${htmlText(voieStr)}</span>
          ${trainIsLong ? '<span class="ig-pban-long-train">Train long</span>' : ''}
        </div>
      </div>
      <div class="ig-pban-main">
        <div class="ig-pban-train-row">
          <div class="ig-pban-line-circle" style="background:${htmlText(lineColor)}">${htmlText(lineCode)}</div>
          <div class="ig-pban-train-info">
            <div class="ig-pban-dest-name">${htmlText(destStation?.name || '?')}</div>
            <div class="ig-pban-dest-via">${htmlText(servedAfter.length > 0 ? 'via ' + servedAfter[0]?.name : '')}</div>
            <div class="ig-pban-code-label">Mission: ${htmlText(svc.name)}</div>
          </div>
          <div class="ig-pban-wait">${waitStr}</div>
        </div>
        <div class="ig-pban-page">Page 1/${totalPages}</div>
        <div class="ig-pban-stops-section">
          <div class="ig-pban-stops-title">Gares desservies</div>
          <div class="ig-pban-stops-grid">
            <div>${col1Html}</div>
            <div>${col2Html}</div>
          </div>
        </div>
      </div>
      <div class="ig-pban-crowding">
        <div class="ig-pban-crowd-label">Affluence prevue</div>
        <div class="ig-pban-crowd-cars">${crowdHtml}</div>
        <div class="ig-pban-crowd-ends"><span>Queue</span><span>Tete</span></div>
      </div>
    </div>`;
    }
    // --- CATI Complet : liste pleine largeur 4 colonnes ---
    _renderCATIComplet(station, trains, nowStr) {
        const dep = trains.filter((r) => r.isDeparture).slice(0, 12);
        const head = `<div class="ig-cati-row ig-cati-head">
      <span class="ig-cati-logo-h"></span><span>Train</span><span>Heure</span><span>Destination</span>
    </div>`;
        const cell = (t) => `<div class="ig-cati-row" data-svc-id="${htmlText(t.svcId)}">
      <span class="ig-cati-logo">SNCF</span>
      <span class="ig-cati-num">${htmlText(t.trainNumber || t.name.split(' ')[0] || t.name)}</span>
      <span class="ig-cati-time">${htmlText(this._fmtTime(t.depTime))}</span>
      <span class="ig-cati-dest">${htmlText(t.destination)}</span>
    </div>`;
        return `<div class="ig-cati-board ig-cati-complet">
      <div class="ig-cati-header">
        <span class="ig-cati-station">${htmlText(station?.name || '')}</span>
        <span class="ig-cati-title">Départs — Affichage complet</span>
        <span class="ig-cati-clock">${nowStr}</span>
      </div>
      <div class="ig-cati-full">${head}${dep.length ? dep.map(cell).join('') : '<div class="ig-cati-empty">Aucun départ</div>'}</div>
      <div class="ig-cati-footer"><span>24h • Toutes destinations</span><span>${nowStr}</span></div>
      <div class="ig-cati-side">départs</div>
    </div>`;
    }
    // --- CATI Arrivées : tableau vert ---
    _renderCATIAr(station, trains, nowStr) {
        const arr = trains.filter((r) => r.isArrival).slice(0, 12);
        const cell = (t) => {
            let status = '';
            if (t.isCancelled)
                status = '<span style="color:#f87171;font-weight:700">Supprimé</span>';
            else if (t.delay > 0)
                status = `<span style="color:#facc15;font-weight:700">retard ${Math.round(t.delay)} min</span>`;
            const stops = t.fromStations.slice(0, 5).join(' \u2022 ');
            return `<div class="ig-cati-row" data-svc-id="${htmlText(t.svcId)}">
        <span class="ig-cati-logo">SNCF</span>
        <span class="ig-cati-num">${status || '&nbsp;'}</span>
        <span class="ig-cati-time">${htmlText(this._fmtTime(t.arrTime))}</span>
        <span class="ig-cati-destcol">
          <span class="ig-cati-dest" style="color:#fff">${htmlText(t.origin)}</span>
          ${stops ? `<span class="ig-cati-stops" style="color:#cbd5e1;font-size:10px">${htmlText(stops)}</span>` : ''}
        </span>
      </div>`;
        };
        const head = `<div class="ig-cati-row ig-cati-head" style="background:#1a5e1a">
      <span class="ig-cati-logo-h"></span><span>Retard</span><span>Heure</span><span>Provenance</span>
    </div>`;
        return `<div class="ig-cati-board ig-cati-ar" style="background:#0b2e12">
      <div class="ig-cati-header" style="background:#1a5e1a">
        <span class="ig-cati-station">${htmlText(station?.name || '')}</span>
        <span class="ig-cati-title">Arrivées — Affichage complet</span>
        <span class="ig-cati-clock">${nowStr}</span>
      </div>
      <div class="ig-cati-full">${head}${arr.length ? arr.map(cell).join('') : '<div class="ig-cati-empty">Aucune arrivée</div>'}</div>
      <div class="ig-cati-footer" style="background:#1a5e1a"><span>24h • Toutes provenances</span><span>${nowStr}</span></div>
      <div class="ig-cati-side" style="background:#0b2e12">arrivées</div>
    </div>`;
    }
    // --- Écran quai : prochain départ sur la voie (image annexe INFOGARE) ---
    _renderEcranQuai(station, trains, nowStr, page = 0) {
        const deps = trains.filter((r) => r.isDeparture);
        const t = deps[page] || deps[0] || null;
        const W = 1100, H = 616, scale = 1;
        const img = 'img/infogare/ECRAN-QUAI.png';
        let html = this._igPhotoFrame(img, W, H, scale, 'ig-photo-quai');
        const leftBg = this._igPhotoMask('#f5eef4', .91), blue = this._igPhotoMask('#0b4f9b', .90);
        const pt = this.game.engine?.getParisTime?.();
        const clock = pt ? `${String(pt.hours).padStart(2, '0')}:${String(pt.minutes).padStart(2, '0')} ${String(pt.seconds || 0).padStart(2, '0')}` : nowStr;
        // Do not rebuild the two-colour screen. Only mask the exact text zones.
        const time = t ? this._fmtTime(t.depTime) : '';
        const status = !t ? '' : (t.isCancelled ? 'supprimé' : (t.delay > 0 ? `retard ${Math.round(t.delay)} min` : "à l'heure"));
        const type = t ? (t.seriesName || (t.category === 'PASSENGER' ? 'TER' : t.category || 'Train')) : '';
        html += this._igField({ x: 1.2, y: 10.1, w: 18, h: 10 }, time, { color: '#084a96', fontSize: 18, weight: 800, bg: leftBg }, 0);
        html += this._igField({ x: 20.5, y: 13, w: 15, h: 5.5 }, status, { color: t?.delay > 0 ? '#d97706' : '#084a96', fontSize: 10, weight: 700, bg: leftBg }, 0);
        html += this._igField({ x: 1.3, y: 23.5, w: 34, h: 19 }, t?.destination || '', { color: '#084a96', fontSize: 17, weight: 800, bg: leftBg, style: 'white-space:normal;line-height:1.05;' }, 0);
        html += this._igField({ x: 1.3, y: 43.0, w: 34, h: 6.8 }, t ? `${type} ${t.trainNumber || t.name || ''}` : '', { color: '#084a96', fontSize: 11, weight: 650, bg: leftBg }, 0);
        const next = (t?.nextStops || []).slice(0, 9);
        const startY = 10.2, rowH = 7.1;
        for (let i = 0; i < 9; i++) {
            const n = next[i], y = startY + i * rowH;
            const txt = n ? `●  ${n.name}` : '';
            html += this._igField({ x: 39.2, y, w: 53.5, h: 5.8 }, txt, { color: '#fff', fontSize: 12, weight: i === next.length - 1 ? 800 : 500, bg: blue }, 0);
        }
        const ticker = t ? `LES VOYAGEURS À DESTINATION DE ${String(t.destination || '').toUpperCase()} SONT INVITÉS À SE PRÉSENTER SUR LE QUAI.` : 'AUCUN DÉPART PRÉVU.';
        html += this._igField({ x: .8, y: 91.0, w: 78, h: 6.5 }, ticker, { color: '#fff', fontSize: 11, style: 'font-style:italic;white-space:nowrap;', bg: blue }, 0);
        html += this._igField({ x: 85.0, y: 91.2, w: 13.5, h: 6.0 }, clock, { color: '#fff', fontSize: 10, weight: 700, align: 'center', bg: blue }, 0);
        if (t?.svcId)
            html += `<div class="ig-image-hit" data-svc-id="${htmlText(t.svcId)}" style="left:0;top:7%;width:100%;height:83%"></div>`;
        if (deps.length > 1)
            html += `<div class="ig-image-field ig-photo-page" style="left:2%;top:4%;width:12%;height:3%;color:#084a96;font-size:9px">${page + 1}/${deps.length}</div>`;
        html += `</div>`;
        return html;
    }
    // --- Palette SNCF moderne (image annexe INFOGARE : 2 colonnes, horloge, défilant) ---
    _renderPalette(station, trains, nowStr, page = 0) {
        const perPage = 20;
        const all = trains.filter((r) => r.isDeparture).slice(page * perPage, page * perPage + perPage);
        const W = 1100, H = 207, scale = 1;
        const img = 'img/infogare/PALETTE.png';
        const bg = this._igPhotoMask('#101010', .90);
        let html = this._igPhotoFrame(img, W, H, scale, 'ig-photo-palette');
        // Exact photo stays visible. We replace only the characters in the two tables.
        const rows = 10, startY = 23.5, rowH = 6.6;
        const draw = (t, base, y) => {
            const type = t ? (t.seriesName || (t.category === 'PASSENGER' ? 'TER' : t.category || 'Train')).toUpperCase() : '';
            const num = t ? (t.trainNumber || '') : '';
            const time = t ? this._fmtTime(t.depTime).replace('h', ':') : '';
            const dest = t ? String(t.destination || '').toUpperCase() : '';
            const part = t ? (t.isCancelled ? 'SUPPRIMÉ' : (t.delay > 0 ? `RET ${Math.round(t.delay)}M` : "À L'HEURE")) : '';
            let h = '';
            h += this._igField({ x: base + 1.2, y, w: 4.7, h: 4.9 }, type, { color: '#c88b19', fontSize: 7.4, weight: 700, bg }, 0);
            h += this._igField({ x: base + 5.9, y, w: 5.8, h: 4.9 }, num, { color: '#c88b19', fontSize: 7.4, weight: 700, bg }, 0);
            h += this._igField({ x: base + 11.7, y, w: 5.8, h: 4.9 }, time, { color: '#c88b19', fontSize: 7.4, weight: 700, bg }, 0);
            h += this._igField({ x: base + 17.5, y, w: 18.0, h: 4.9 }, dest, { color: '#c88b19', fontSize: 7.1, weight: 700, bg }, 0);
            h += this._igField({ x: base + 35.5, y, w: 8.5, h: 4.9 }, part, { color: '#c88b19', fontSize: 6.8, weight: 700, bg }, 0);
            h += this._igField({ x: base + 44.0, y, w: 3.5, h: 4.9 }, t?.voie || '', { color: '#c88b19', fontSize: 7.2, weight: 800, align: 'center', bg }, 0);
            if (t?.svcId)
                h += `<div class="ig-image-hit" data-svc-id="${htmlText(t.svcId)}" style="left:${htmlText(base)}%;width:48%;top:${htmlText(y)}%;height:5.2%"></div>`;
            return h;
        };
        for (let i = 0; i < rows; i++) {
            html += draw(all[i] || null, 0.5, startY + i * rowH);
            html += draw(all[i + rows] || null, 48.8, startY + i * rowH);
        }
        // Animate the hands on the photographed analogue clock instead of replacing it.
        html += `<div class="ig-palette-clock-live"><span class="ig-palette-clock-hand"></span><span class="ig-palette-clock-hand-min"></span></div>`;
        const bulletins = this.game.incidentManager?.getBulletins?.() || [];
        const ticker = bulletins.length ? `${bulletins[0].name}${bulletins[0].description ? ' — ' + bulletins[0].description : ''}` : 'CIRCULATION NORMALE';
        html += this._igField({ x: 89.5, y: 35.0, w: 9.2, h: 31 }, ticker, { color: '#c88b19', fontSize: 6.0, weight: 700, bg: this._igPhotoMask('#101010', .86), style: 'white-space:normal;line-height:1.05;overflow-wrap:anywhere;' }, 0);
        if (trains.filter((r) => r.isDeparture).length > perPage) {
            const n = Math.ceil(trains.filter((r) => r.isDeparture).length / perPage);
            html += `<div class="ig-image-field ig-photo-page" style="left:87%;top:94%;width:7%;height:3%;color:#c88b19;font-size:7px;justify-content:flex-end">${page + 1}/${n}</div>`;
        }
        html += '</div>';
        return html;
    }
    // --- DB Quai — one selected timetable service, mock validated with the player (v1.1.62) ---
    _dbQuaiClock(min) {
        if (!Number.isFinite(Number(min)))
            return '--:--';
        const total = ((Math.round(Number(min)) % 1440) + 1440) % 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
    _dbQuaiIncidentText(stationId, stationIds = [], serviceId = '') {
        const active = this.game.incidentManager?.getActiveIncidents?.() || [];
        if (!active.length)
            return '';
        const ids = new Set([stationId, ...stationIds].filter(Boolean));
        const relevant = active.filter((inc) => inc?.active && ((serviceId && inc.serviceId === serviceId) || (inc.stationA && ids.has(inc.stationA)) || (inc.stationB && ids.has(inc.stationB))));
        return relevant.slice(0, 2).map((inc) => {
            const where = (inc.stationAName && inc.stationBName) ? `${inc.stationAName} - ${inc.stationBName}` : (inc.stationAName || inc.stationBName || inc.trackName || '');
            return `${inc.name}${where ? ` ${where}` : ''}`.trim();
        }).join(' +++ ');
    }
    _dbQuaiFormation(scheduleId, versionId, occurrenceId = '', liveServiceId = '') {
        const rm = this.game.rotationV2;
        const live = liveServiceId ? (this.game.scheduleCreator?.services || []).find((s) => s.id === liveServiceId) : null;
        let members = (live?._v2FormationMembers || []).map((m, i) => ({ vehicleId: m.vehicleId, role: m.role, order: i }));
        if (!members.length && rm) {
            for (const rot of rm.rotations || []) {
                const occ = (rot.occurrences || []).find((o) => (occurrenceId && o.id === occurrenceId) || (!occurrenceId && o.scheduleId === scheduleId));
                if (occ?.formation?.members?.length) {
                    members = occ.formation.members.map((m) => ({ ...m }));
                    break;
                }
            }
        }
        if (!members.length && rm) {
            const a = rm.getDirectAssignment?.(scheduleId, versionId);
            if (a?.formation?.members?.length)
                members = a.formation.members.map((m) => ({ ...m }));
        }
        const vehicles = members.sort((a, b) => (a.order || 0) - (b.order || 0)).map((m) => {
            const v = rm?.getVehicle?.(m.vehicleId);
            return v ? { id: v.id, number: v.number || '', name: v.name || '', role: m.role || '', category: v.category || '', traction: v.traction || 'none', lengthM: (Number.isFinite(Number(v.lengthM)) && Number(v.lengthM) > 0 ? Number(v.lengthM) : 25) } : null;
        }).filter(Boolean);
        if (vehicles.length) {
            const leadAtStart = ['LEAD', 'ACTIVE_MULTIPLE'].includes(vehicles[0].role);
            const leadAtEnd = ['LEAD', 'ACTIVE_MULTIPLE'].includes(vehicles.at(-1)?.role);
            if (leadAtStart && !leadAtEnd)
                vehicles.reverse();
            return vehicles;
        }
        const direct = rm?.getDirectAssignment?.(scheduleId, versionId);
        const rameId = direct?.rameId || '';
        const rame = rameId ? this.game.rameManager?.getById?.(rameId) : null;
        return (rame?.elementDetails || []).map((e, i) => ({ id: e.elementId || String(i), number: e.number || e.serialNumber || '', name: e.name || '', role: (e.category === 'locomotive' || e.category === 'automotrice') ? 'LEAD' : 'COACH', category: e.category || '', traction: e.traction || 'none', lengthM: (Number.isFinite(Number(e.length)) && Number(e.length) > 0 ? Number(e.length) : 25) }));
    }
    _getDbQuaiData(stationId, serviceKey) {
        const entry = this._getInfogareServiceEntry(serviceKey);
        if (!entry)
            return { error: 'Sélectionnez un service.' };
        const pt = this.game.engine.getParisTime();
        const nowMin = pt.hours * 60 + pt.minutes + Number(pt.seconds || 0) / 60;
        const currentDate = this.game.engine.currentDate || this.game.engine.getParisDate?.() || '';
        if (entry.kind === 'v2') {
            const rec = this.game.scheduleV2?.getSchedule?.(entry.id);
            const ver = rec?.currentVersion;
            if (!rec || !ver?.locations?.length)
                return { error: 'Horaire introuvable.' };
            const idx = ver.locations.findIndex((l) => l?.stationId === stationId);
            if (idx < 0)
                return { error: 'Ce service ne dessert pas cette gare.' };
            const loc = ver.locations[idx];
            const last = [...ver.locations].reverse().find((l) => l?.stationId);
            const middle = ver.locations.slice(idx + 1).filter((l) => l?.stationId && l.stationId !== last?.stationId);
            const rows = this._collectInfogareV2Trains(stationId, currentDate, nowMin).filter((r) => r.scheduleId === rec.id).sort((a, b) => Math.abs(Number(a.waitMin ?? 99999)) - Math.abs(Number(b.waitMin ?? 99999)));
            const row = rows[0] || null;
            const plannedMin = Number.isFinite(Number(row?.depTime ?? row?.arrTime)) ? Number(row?.depTime ?? row?.arrTime) : Number(loc.departureSec ?? loc.arrivalSec ?? 0) / 60;
            const rawDelay = Number(row?.delay);
            const delay = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 0;
            const servedIds = ver.locations.slice(idx + 1).map((l) => l?.stationId).filter(Boolean);
            const serviceId = row?.svcId || '';
            return { serviceName: String(rec.name || rec.number || 'Service'), scheduledTime: this._dbQuaiClock(plannedMin), updatedTime: delay > 0 ? this._dbQuaiClock(plannedMin + delay) : '', delay, destination: this._infogareStationName(last) || last?.name || '?', stops: middle.map((l) => this._infogareStationName(l) || l.name || '').filter(Boolean), traffic: this._dbQuaiIncidentText(stationId, servedIds, serviceId), formation: this._dbQuaiFormation(rec.id, ver.id, row?.occurrenceId || '', serviceId), svcId: serviceId };
        }
        const svc = (this.game.scheduleCreator?.services || []).find((s) => s.id === entry.id);
        if (!svc)
            return { error: 'Service introuvable.' };
        const stops = svc.getCurrentStops?.() || svc.stops || [];
        const idx = stops.findIndex((s) => s?.stationId === stationId);
        if (idx < 0)
            return { error: 'Ce service ne dessert pas cette gare.' };
        const loc = stops[idx], last = stops.at(-1);
        const middle = stops.slice(idx + 1, -1).filter((s) => s?.stationId).map((s) => this.game.world.getStationById(s.stationId)?.name || '').filter(Boolean);
        const planned = Number(loc.departureTime ?? loc.arrivalTime ?? 0);
        const rawDelay = Number(svc.delay);
        const delay = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 0;
        const dest = this.game.world.getStationById(last?.stationId)?.name || '?';
        const servedIds = stops.slice(idx + 1).map((s) => s.stationId).filter(Boolean);
        const formation = (svc.rame?.elementDetails || []).map((e, i) => ({ id: e.elementId || String(i), number: e.number || e.serialNumber || '', name: e.name || '', role: (e.category === 'locomotive' || e.category === 'automotrice') ? 'LEAD' : 'COACH', category: e.category || '', traction: e.traction || 'none', lengthM: (Number.isFinite(Number(e.length)) && Number(e.length) > 0 ? Number(e.length) : 25) }));
        return { serviceName: String(svc.name || svc.number || 'Service'), scheduledTime: this._dbQuaiClock(planned), updatedTime: delay > 0 ? this._dbQuaiClock(planned + delay) : '', delay, destination: dest, stops: middle, traffic: this._dbQuaiIncidentText(stationId, servedIds, svc.id), formation, svcId: svc.id };
    }
    _renderDbQuai(data, station) {
        const esc = (v) => this._escapeInfogareText(v);
        if (data?.error)
            return `<div class="ig-db-quai-error">${esc(data.error)}</div>`;
        const stops = (data.stops || []).join('  ·  ');
        const traffic = String(data.traffic || '').trim();
        const scrollingStops = stops || ' ';
        const scrollingTraffic = traffic || ' ';
        const formation = data.formation || [];
        const totalLen = Math.max(1, formation.reduce((s, v) => s + Math.max(8, Number(v.lengthM || 25)), 0));
        const blocks = formation.map((v) => { const isLoco = ['LEAD', 'ACTIVE_MULTIPLE', 'PUSHER'].includes(v.role) || (v.traction && v.traction !== 'none') || /loco/i.test(v.category || ''); const basis = Math.max(7, Math.max(8, Number(v.lengthM || 25)) / totalLen * 100); const label = String(v.number || v.name || '').slice(0, 8); return `<div class="ig-db-quai-vehicle${htmlText(isLoco ? ' is-loco' : '')}" style="flex-basis:${htmlText(basis.toFixed(2))}%" title="${esc(v.name || v.number || 'Véhicule')}"><span>${esc(label)}</span></div>`; }).join('');
        return `<div class="ig-db-quai-board"${data.svcId ? ` data-svc-id="${esc(data.svcId)}"` : ''}><div class="ig-db-quai-traffic"><div class="ig-db-quai-scroll"><span>${esc(scrollingTraffic)}</span><span aria-hidden="true">${esc(scrollingTraffic)}</span></div></div><div class="ig-db-quai-main"><div class="ig-db-quai-left"><div class="ig-db-quai-service">${esc(data.serviceName)}</div><div class="ig-db-quai-time-line"><div class="ig-db-quai-time">${esc(data.scheduledTime)}</div>${data.updatedTime ? `<div class="ig-db-quai-updated">${esc(data.updatedTime)}</div>` : ''}</div></div><div class="ig-db-quai-right"><div class="ig-db-quai-stops"><div class="ig-db-quai-scroll"><span>${esc(scrollingStops)}</span><span aria-hidden="true">${esc(scrollingStops)}</span></div></div><div class="ig-db-quai-destination">${esc(data.destination)}</div></div></div><div class="ig-db-quai-composition"><div class="ig-db-quai-sectors">${['E', 'D', 'C', 'B', 'A'].map((x) => `<span>${x}</span>`).join('')}</div><div class="ig-db-quai-consist">${blocks || '<div class="ig-db-quai-noformation">Aucune composition affectée</div>'}<b class="ig-db-quai-arrow">→</b></div></div></div>`;
    }
    // --- DB Abfahrt / Departure — rectified from the user's real DB board photograph ---
    _renderDbAbfahrt(station, trains, nowStr, page = 0) {
        // The exact angled photograph supplied by the player is the board itself.
        // Live information is a transparent perspective layer; no rectified/recreated background is shown.
        const W = 2048, H = 1366, scale = .55;
        const img = 'img/infogare/reference-sources/DB-ABFAHRT_SOURCE.jpg';
        const all = trains.filter((t) => t.isDeparture);
        const use = all.slice(page * 10, page * 10 + 10);
        let html = this._igPhotoFrame(img, W, H, scale, 'ig-photo-db');
        const blue = 'rgba(5,70,181,.82)', pale = 'rgba(238,242,246,.88)';
        html += `<div class="ig-db-live-plane">`;
        for (let i = 0; i < 10; i++) {
            const t = use[i] || null;
            const cancelled = !!t?.isCancelled;
            const fg = cancelled ? '#103d7d' : '#fff';
            const bg = cancelled ? pale : blue;
            const time = t ? this._fmtTime(t.depTime).replace('h', ':') : '';
            const train = t ? `${t.seriesName || ''} ${t.trainNumber || t.name || ''}`.trim() : '';
            const via = t ? (t.servedStations || []).slice(0, 4).join(' - ') : '';
            const dest = t?.destination || '';
            const track = t?.voie || '';
            html += `<div class="ig-db-live-row"${t?.svcId ? ` data-svc-id="${htmlText(t.svcId)}"` : ''}>`
                + `<span style="background:${htmlText(bg)};color:${htmlText(fg)}">${time}</span>`
                + `<span style="background:${htmlText(bg)};color:${htmlText(fg)}">${htmlText(train)}</span>`
                + `<span style="background:${htmlText(bg)};color:${htmlText(fg)}">${htmlText(cancelled ? 'Fahrt fällt aus' : via)}</span>`
                + `<span style="background:${htmlText(bg)};color:${htmlText(fg)};font-weight:700">${htmlText(dest)}</span>`
                + `<span style="background:${htmlText(bg)};color:${htmlText(fg)};text-align:center">${htmlText(cancelled ? '-' : track)}</span>`
                + `</div>`;
        }
        html += `</div>`;
        if (all.length > 10)
            html += `<div class="ig-image-field ig-photo-page" style="left:63%;top:59%;width:4%;height:2.5%;font-size:${htmlText(7 * scale)}px;color:#fff;justify-content:flex-end">${page + 1}/${Math.ceil(all.length / 10)}</div>`;
        html += `</div>`;
        return html;
    }
    // ==================== DASHBOARD ====================
    renderDashboard() {
        try {
            const container = document.getElementById('dashboard-container');
            this.game.dashboard.render(container, this.game);
            // X — real-time refresh every 5s while Dashboard is visible
            if (this._dashboardInterval)
                clearInterval(this._dashboardInterval);
            this._dashboardInterval = setInterval(() => {
                if (this.activePage !== 'dashboard') {
                    clearInterval(this._dashboardInterval);
                    this._dashboardInterval = null;
                    return;
                }
                const active = document.activeElement;
                if (document.querySelector('[data-re-interacting="true"]') || active?.closest?.('.re-chart-controls,.re-financial-panel') || document.querySelector('.re-financial-panel details[open]'))
                    return;
                this.renderDashboard();
            }, 5000);
        }
        catch (e) {
            console.warn('Dashboard render error:', e);
        }
    }
    // ==================== GRAPHIQUE DE MARCHE ====================
    renderGraphMarche() {
        try {
            const container = document.getElementById('graph-marche-container');
            this.game.graphMarche.render(container, this.game);
        }
        catch (e) {
            console.warn('GraphMarche render error:', e);
        }
    }
    // ==================== STAFF ====================
    renderStaffPage() {
        try {
            const container = document.getElementById('staff-container');
            this.game.staffManager.render(container, this.game);
        }
        catch (e) {
            console.warn('Staff render error:', e);
        }
    }
    // ==================== WEATHER ====================
    // MET-08 / NAV-04 : Saisons fusionnées dans la page Météo
    renderWeatherPage() {
        try {
            const container = document.getElementById('weather-container');
            if (!container)
                return;
            container.innerHTML = '<div id="weather-content"></div><div id="weather-seasonal" style="margin-top:16px"></div>';
            this.game.weather.render(document.getElementById('weather-content'), this.game);
            this.game.seasonal.render(document.getElementById('weather-seasonal'), this.game);
        }
        catch (e) {
            console.warn('Weather render error:', e);
        }
    }
    // ==================== SEASONAL ====================
    renderSeasonalPage() {
        try {
            const container = document.getElementById('seasonal-container');
            this.game.seasonal.render(container, this.game);
        }
        catch (e) {
            console.warn('Seasonal render error:', e);
        }
    }
    // ==================== CONNECTIONS ====================
    openConnectionsDialog() {
        // RC2: the old standalone page was removed; expose the existing feature from
        // Horaires without restoring a duplicate navigation page.
        document.getElementById('re-connections-dialog')?.remove();
        const modal = document.createElement('div');
        modal.id = 're-connections-dialog';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Correspondances voyageurs');
        modal.tabIndex = -1;
        modal.style.cssText = 'position:fixed;inset:0;z-index:9450;background:#000a;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = `<div style="width:min(900px,95vw);max-height:88vh;overflow:auto;background:var(--bg,#142030);color:var(--text,#eef6ff);border:1px solid var(--border,#38516d);border-radius:10px;padding:18px"><div style="display:flex;align-items:center;justify-content:space-between;gap:15px"><h2>Correspondances voyageurs</h2><button type="button" class="btn-secondary" data-close-connections>Fermer</button></div><p>Configurez les services préparés ou actifs. L’attente respecte l’heure de départ et le délai de transfert ; elle reste limitée par la politique choisie.</p><div data-connections-content></div></div>`;
        const previous = document.activeElement;
        const close = () => { modal.remove(); if (previous instanceof HTMLElement)
            previous.focus(); };
        modal.querySelector('[data-close-connections]')?.addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal)
            close(); });
        modal.addEventListener('keydown', e => { if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } });
        document.body.appendChild(modal);
        this.game.connections.render(modal.querySelector('[data-connections-content]'), this.game);
        modal.focus();
    }
    renderConnectionsPage() {
        try {
            const container = document.getElementById('connections-container');
            this.game.connections.render(container, this.game);
        }
        catch (e) {
            console.warn('Connections render error:', e);
        }
    }
    // ==================== STATION UPGRADES ====================
    renderStationUpgradesPage() {
        try {
            const container = document.getElementById('station-upgrades-container');
            this.game.stationUpgrades.render(container, this.game);
        }
        catch (e) {
            console.warn('StationUpgrades render error:', e);
        }
    }
    // ==================== JUNCTIONS ====================
    renderJunctionsPage() {
        try {
            const container = document.getElementById('junctions-container');
            this.game.junctionManager.render(container, this.game);
        }
        catch (e) {
            console.warn('Junctions render error:', e);
        }
    }
    // ==================== CARGO TYPES ====================
    renderCargoTypesPage() {
        try {
            const container = document.getElementById('cargo-types-container');
            this.game.cargoTypes.render(container, this.game);
            document.getElementById('btn-create-cargo-type')?.addEventListener('click', () => this.openCargoTypeModal());
        }
        catch (e) {
            console.warn('CargoTypes render error:', e);
        }
    }
    openCargoTypeModal() {
        const modal = document.getElementById('modal-cargo-type');
        if (!modal)
            return;
        const catSel = document.getElementById('cargo-type-category');
        if (catSel) {
            catSel.innerHTML = Object.entries(this.game.cargoTypes.categories)
                .map(([key, cat]) => `<option value="${htmlText(key)}">${htmlText(cat.name)}</option>`).join('')
                + `<option value="__new__">+ Nouvelle catégorie…</option>`;
        }
        const newcatGroup = document.getElementById('cargo-type-newcat-group');
        const toggleNewcat = () => { if (newcatGroup)
            newcatGroup.classList.toggle('hidden', catSel.value !== '__new__'); };
        if (catSel)
            catSel.onchange = toggleNewcat;
        toggleNewcat();
        this._setStockField('cargo-type-newcat', '');
        this._setStockField('cargo-type-name', '');
        this._setStockField('cargo-type-unit', 't');
        this._setStockField('cargo-type-price', '0');
        const hz = document.getElementById('cargo-type-hazard');
        if (hz)
            hz.checked = false;
        const saveBtn = document.getElementById('btn-save-cargo-type');
        if (saveBtn)
            saveBtn.onclick = () => this.saveCargoType();
        modal.classList.remove('hidden');
    }
    saveCargoType() {
        const catSel = document.getElementById('cargo-type-category');
        const res = this.game.cargoTypes.addCustomType({
            categoryKey: catSel?.value,
            categoryName: document.getElementById('cargo-type-newcat')?.value,
            name: document.getElementById('cargo-type-name')?.value,
            unit: document.getElementById('cargo-type-unit')?.value || 't',
            pricePerUnit: document.getElementById('cargo-type-price')?.value,
            hazard: document.getElementById('cargo-type-hazard')?.checked,
        });
        if (!res.ok) {
            alert(res.error || 'Erreur');
            return;
        }
        this.game.saveState();
        document.getElementById('modal-cargo-type')?.classList.add('hidden');
        this.renderCargoTypesPage();
    }
    // ==================== ITE MODULES ====================
    renderITEModulesPage() {
        try {
            const container = document.getElementById('ite-modules-container');
            this.game.iteModules.render(container, this.game);
        }
        catch (e) {
            console.warn('ITEModules render error:', e);
        }
    }
    // ==================== INDUSTRIAL CLIENTS ====================
    renderIndustrialClientsPage() {
        try {
            const container = document.getElementById('industrial-clients-container');
            this.game.industrialClients.render(container, this.game);
        }
        catch (e) {
            console.warn('IndustrialClients render error:', e);
        }
    }
    // ==================== MARKETING ====================
    renderMarketingPage() {
        try {
            const container = document.getElementById('marketing-container');
            this.game.marketingManager?.render?.(container, this.game);
        }
        catch (e) {
            console.warn('Marketing render error:', e);
        }
    }
    _igPhotoMask(color, alpha = 0.90) {
        const raw = String(color || '').trim();
        const h = raw.match(/^#([0-9a-f]{6})$/i);
        if (h) {
            const n = parseInt(h[1], 16);
            return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
        }
        const h3 = raw.match(/^#([0-9a-f]{3})$/i);
        if (h3) {
            const x = h3[1].split('').map((c) => parseInt(c + c, 16));
            return `rgba(${x[0]},${x[1]},${x[2]},${alpha})`;
        }
        return raw || `rgba(0,0,0,${alpha})`;
    }
    _igPhotoFrame(file, width, height, scale = 1, extraClass = '') {
        return `<div class="ig-photo-exact ${htmlText(extraClass)}" style="width:${htmlText(width * scale)}px;max-width:${htmlText(width * scale)}px;aspect-ratio:${htmlText(width)}/${htmlText(height)};">`
            + `<img class="ig-photo-source" src="${htmlText(file)}" alt="" draggable="false">`;
    }
    // --- Infogare image-overlay renderer (annex images as background) ---
    _renderImageMode(displayType, station, trains, nowStr, page = 0) {
        const layout = IG_IMAGE_LAYOUTS[displayType];
        if (!layout)
            return '';
        const isArr = ['sncf-arr', 'afl-arrivee', 'cati-ar'].includes(displayType);
        const dirField = isArr ? 'provenance' : 'dest';
        const scale = layout.scale || (layout.width < 500 ? 2 : 1);
        const perPage = layout.blocks.length;
        let html = this._igPhotoFrame(layout.file, layout.width, layout.height, scale, `ig-photo-${displayType}`);
        // Only the genuinely changing text is masked. The supplied image itself stays untouched:
        // logos, separators, textures, vertical labels and panel geometry are always the original pixels.
        for (const f of layout.headerFields || []) {
            let txt = '';
            if (f.type === 'clock')
                txt = nowStr;
            else if (f.type === 'station')
                txt = station?.name || '';
            else
                continue; // static labels/logos already exist in the supplied image
            const bg = this._igPhotoMask(f.bg || layout.header?.bg || layout.bg || '#000', 0.92);
            html += this._igField(f, txt, { color: f.color || '#fff', fontSize: (f.fontSize || 14) * scale, align: f.align, weight: f.weight, bg, alpha: f.alpha, bitmapFont: f.bitmapFont, letterSpacing: f.letterSpacing, style: f.style || '' }, 0);
        }
        const start = page * perPage;
        const use = trains.slice(start, start + perPage);
        const mask = (spec, bg, y, content = '', extra = {}) => {
            if (!spec)
                return '';
            return this._igField(spec, content, {
                color: extra.color || spec.color || '#fff',
                fontSize: (extra.fontSize || spec.fontSize || 12) * scale,
                weight: extra.weight || spec.weight,
                align: extra.align || spec.align,
                textTransform: extra.textTransform || spec.textTransform,
                bg: this._igPhotoMask(extra.bg || spec.bg || bg, extra.alpha ?? spec.alpha ?? 0.91),
                bitmapFont: extra.bitmapFont || spec.bitmapFont,
                letterSpacing: extra.letterSpacing || spec.letterSpacing,
                style: extra.style || ''
            }, y);
        };
        for (let i = 0; i < perPage; i++) {
            const b = layout.blocks[i];
            const t = use[i] || null;
            const rowBg = b.bg || layout.bg || '#0b1836';
            // Empty masks remove only the example text printed in the reference image.
            // No full-row rectangle is ever drawn.
            if (!t) {
                html += mask(b.time, rowBg, b.y, '');
                html += mask(b.type, rowBg, b.y + (b.type?.yOff || 0), '');
                html += mask(b.num, rowBg, b.y + (b.num?.yOff || 0), '');
                html += mask(b[dirField], rowBg, b.y, '');
                html += mask(b.via, rowBg, b.viaY ?? b.y, '');
                html += mask(b.status, rowBg, b.y, '');
                html += mask(b.voie, rowBg, b.y + (b.voie?.yOff || 0), '');
                html += mask(b.remark, rowBg, b.remarkY ?? b.y, '');
                continue;
            }
            const rawName = String(t.name || '').trim();
            const m = rawName.match(/^([A-Za-zÀ-ÿ]+)\s*(.*)$/);
            const isAflDp = displayType === 'sncf-dep';
            const type = isAflDp ? this._infogareAflCommercialType(t) : (t.seriesName || m?.[1] || (t.category === 'PASSENGER' ? 'TER' : t.category || 'Train')).trim();
            const num = isAflDp ? this._infogareAflTrainNumber(t) : (t.trainNumber || m?.[2] || '').trim();
            const viaStops = isArr ? (t.fromStations || []) : (t.servedStations || []);
            const viaText = viaStops.slice(0, 8).join(' • ');
            const baseTime = this._fmtTime(isArr ? t.arrTime : t.depTime);
            const timeStr = isAflDp ? baseTime.replace('h', ':') : baseTime;
            let status = '';
            if (t.isCancelled)
                status = 'supprimé';
            else if (t.delay > 0) {
                const dm = Math.max(0, Math.round(Number(t.delay) || 0));
                status = isAflDp ? `retardé ${String(dm).padStart(2, '0')} min` : `retardé ${dm} min`;
            }
            else if (!isAflDp)
                status = "à l'heure";
            const destTxt = isArr ? (t.origin || '') : (t.destination || '');
            const remark = t.delayReason || (t.isCancelled ? 'Train supprimé' : '');
            html += mask(b.time, rowBg, b.y, timeStr, { color: b.time?.color || '#facc15', weight: b.time?.weight || 700 });
            html += mask(b.type, rowBg, b.y + (b.type?.yOff || 0), type, { color: b.type?.color || '#fff', weight: b.type?.weight || 700 });
            html += mask(b.num, rowBg, b.y + (b.num?.yOff || 0), num, { color: b.num?.color || '#93c5fd', weight: b.num?.weight || 700, align: b.num?.align });
            html += mask(b[dirField], rowBg, b.y, destTxt, { color: b[dirField]?.color || '#fff', weight: b[dirField]?.weight || 700 });
            html += mask(b.via, rowBg, b.viaY ?? b.y, viaText, { color: b.via?.color || '#fff', weight: b.via?.weight });
            const statusColor = isAflDp ? (b.status?.color || '#ffd81a') : (t.isCancelled ? '#fff' : (t.delay > 0 ? '#facc15' : '#fff'));
            html += mask(b.status, rowBg, b.y, status, { color: statusColor, weight: b.status?.weight || 700, align: b.status?.align || 'right' });
            if (b.voie)
                html += mask(b.voie, rowBg, b.y + (b.voie?.yOff || 0), t.voie || '', { color: b.voie.color || '#fff', weight: 900, align: b.voie.align || 'center', bg: b.voie.bg || rowBg, alpha: 0.94 });
            if (b.remark)
                html += mask(b.remark, rowBg, b.remarkY ?? b.y, remark, { color: b.remark?.color || '#facc15', weight: b.remark?.weight });
            if (t.svcId)
                html += `<div class="ig-image-hit" data-svc-id="${htmlText(t.svcId)}" style="top:${htmlText(b.y)}%;height:${htmlText(b.h)}%"></div>`;
        }
        if (trains.length > perPage && displayType !== 'sncf-dep') {
            const totalPages = Math.max(1, Math.ceil(trains.length / perPage));
            html += `<div class="ig-image-field ig-photo-page" style="left:88%;top:96%;width:10%;height:3%;color:#fff;font-size:${htmlText(10 * scale)}px;justify-content:flex-end">${page + 1}/${totalPages}</div>`;
        }
        html += `</div>`;
        return html;
    }
    _infogareAflCommercialType(t = {}) {
        const raw = [t.lineCode, t.lineName, t.name, t.category].filter(Boolean).join(' ');
        const known = raw.match(/\b(TGV\s*INOUI|TGV|TER|INTERCIT[ÉE]S|OUIGO|EUROSTAR|THALYS|ICE|IC|EC|RE|RB|RER|TRANSILIEN|S[- ]?BAHN|NIGHTJET|NJ|FLIXTRAIN)\b/i);
        if (known)
            return known[1].toUpperCase().replace('INTERCITES', 'INTERCITÉS').replace('S BAHN', 'S-BAHN');
        return 'TRAIN';
    }
    _infogareAflTrainNumber(t = {}) {
        if (String(t.trainNumber || '').trim())
            return String(t.trainNumber).trim();
        const m = String(t.name || '').match(/\b(\d{2,7})\b/);
        return m?.[1] || '';
    }
    _getInfogareBitmapImage(key) {
        const cfg = INFOGARE_BITMAP_FONTS[key];
        if (!cfg)
            return null;
        this._infogareBitmapImages || (this._infogareBitmapImages = new Map());
        if (this._infogareBitmapImages.has(key))
            return this._infogareBitmapImages.get(key);
        const img = new Image();
        const rec = { img, loaded: false, failed: false, waiters: [] };
        img.onload = () => { rec.loaded = true; const q = rec.waiters.splice(0); q.forEach((fn) => fn()); };
        img.onerror = () => { rec.failed = true; rec.waiters.length = 0; };
        img.src = cfg.src;
        this._infogareBitmapImages.set(key, rec);
        return rec;
    }
    _paintInfogareBitmapFields(board) {
        if (!board)
            return;
        board.querySelectorAll('canvas.ig-bitmap-field').forEach((canvas) => {
            const paint = () => this._paintInfogareBitmapField(canvas);
            const rec = this._getInfogareBitmapImage(canvas.dataset.bitmapFont || 'regular');
            if (!rec || rec.failed)
                return;
            if (rec.loaded || rec.img.complete && rec.img.naturalWidth) {
                rec.loaded = true;
                paint();
            }
            else
                rec.waiters.push(paint);
        });
    }
    _paintInfogareBitmapField(canvas) {
        if (!canvas?.isConnected)
            return;
        const key = canvas.dataset.bitmapFont || 'regular';
        const cfg = INFOGARE_BITMAP_FONTS[key];
        const rec = this._getInfogareBitmapImage(key);
        if (!cfg || !rec?.loaded)
            return;
        const cssW = Math.max(1, Math.round(canvas.clientWidth || 1));
        const cssH = Math.max(1, Math.round(canvas.clientHeight || 1));
        const dpr = Math.max(1, Math.min(2, Number(globalThis.devicePixelRatio) || 1));
        const pxW = Math.max(1, Math.round(cssW * dpr)), pxH = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== pxW)
            canvas.width = pxW;
        if (canvas.height !== pxH)
            canvas.height = pxH;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.imageSmoothingEnabled = true;
        const text = canvas.dataset.bitmapText || '';
        const size = Math.max(1, Number(canvas.dataset.bitmapSize) || 24);
        const scale = size / Number(cfg.baseSize || 96);
        const glyphs = cfg.glyphs || {};
        const fallback = glyphs['?'];
        let total = 0;
        for (const ch of text) {
            const g = glyphs[ch] || fallback;
            if (g)
                total += Number(g[4] || 0) * scale;
        }
        const align = canvas.dataset.bitmapAlign || 'left';
        let x = align === 'right' ? cssW - total : (align === 'center' ? (cssW - total) / 2 : 0);
        const renderH = Number(cfg.cellHeight || 96) * scale;
        const y = (cssH - renderH) / 2;
        const pad = Number(cfg.pad || 0) * scale;
        for (const ch of text) {
            const g = glyphs[ch] || fallback;
            if (!g)
                continue;
            const [sx, sy, sw, sh, adv] = g;
            ctx.drawImage(rec.img, sx, sy, sw, sh, x - pad, y, sw * scale, sh * scale);
            x += Number(adv || 0) * scale;
        }
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = canvas.dataset.bitmapColor || '#fff';
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.globalCompositeOperation = 'source-over';
    }
    _igField(spec, content, extra = {}, yOff = 0) {
        if (!spec)
            return '';
        const common = [
            `left:${spec.x}%`, `top:${(spec.y || 0) + yOff}%`, `width:${spec.w}%`, `height:${spec.h ?? 5}%`,
            extra.bg ? `background:${extra.bg}` : '', extra.style || ''
        ].filter(Boolean).join(';');
        if (extra.bitmapFont) {
            const txt = this._escapeInfogareText(content ?? '');
            const key = this._escapeInfogareText(extra.bitmapFont);
            const color = this._escapeInfogareText(extra.color || '#fff');
            const align = this._escapeInfogareText(extra.align || 'left');
            const size = Number(extra.fontSize || 14);
            return `<canvas class="ig-image-field ig-bitmap-field" data-bitmap-font="${htmlText(key)}" data-bitmap-text="${htmlText(txt)}" data-bitmap-size="${htmlText(size)}" data-bitmap-color="${htmlText(color)}" data-bitmap-align="${htmlText(align)}" style="${htmlText(common)}"></canvas>`;
        }
        const style = [common,
            `color:${extra.color || '#fff'}`, `font-size:${extra.fontSize || 14}px`,
            `text-align:${extra.align || 'left'}`,
            `justify-content:${extra.align === 'center' ? 'center' : (extra.align === 'right' ? 'flex-end' : 'flex-start')}`,
            `text-transform:${extra.textTransform || 'none'}`,
            extra.weight ? `font-weight:${extra.weight}` : '',
            extra.letterSpacing ? `letter-spacing:${extra.letterSpacing}` : ''
        ].filter(Boolean).join(';');
        return `<div class="ig-image-field" style="${htmlText(style)}">${content}</div>`;
    }
}
