import { htmlText } from './html-text.js';
type __KPA177 = { "id": unknown };
type __KPStruct677 = { "shiftGroup"?: unknown };
type __KPStruct681 = { "onLeave": unknown; "absenceRemainingDays": number; "busyTaskId": unknown; "trainingRemainingDays": number; "role": unknown; "assignedTo": unknown; "leaveDaysRemaining": unknown; "leaveRemainingDays": unknown; "leavePending": unknown; "onDuty": unknown; "available": unknown; "id": unknown; "name": unknown; "nextLeaveDate": unknown };
type __KPStruct702 = { "id": unknown };
type __KPStruct714 = number;
import type { Economy } from './economy.js';
import type { RandomSource } from './rng.js';
/**
 * Staff Management — Multi-role personnel for Rail Empire.
 */
import { icon } from './icons.js';
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { haversineDistance, timeDiff } from './simulation.js?v=1784250033';
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { getGlobalRng } from './rng.js?v=1784250033';
// @ts-expect-error Browser cache-busted module specifier is resolved at runtime.
import { DEPOT_STAFF_CATALOG } from './depot.js?v=119951';

let nextStaffId = 1;

// RH-01 — noms aléatoires par nationalité
const NATIONALITY_NAMES: Record<string,{first:string[];last:string[]}> = {
  fr: {
    first: ['Jean','Pierre','Michel','André','Philippe','Alain','Nicolas','Christophe','Laurent','Patrick','Marie','Sophie','Isabelle','Nathalie','Céline','Virginie','Sandrine','Stéphanie','Camille','Emma'],
    last: ['Martin','Bernard','Thomas','Petit','Robert','Richard','Durand','Dubois','Moreau','Laurent','Simon','Michel','Lefèvre','Mercier','Dupont','Fournier','Girard','Bonnet','André','François']
  },
  de: {
    first: ['Hans','Peter','Klaus','Wolfgang','Thomas','Michael','Andreas','Stefan','Markus','Jürgen','Anna','Maria','Ursula','Monika','Petra','Sabine','Karin','Christine','Ingrid','Birgit'],
    last: ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann','Braun']
  },
  ch: {
    first: ['Andreas','Daniel','Markus','Thomas','Stefan','Michael','Peter','Christian','Simon','Rett','Anna','Laura','Sarah','Mia','Sophie','Lena','Nina','Julia','Elena','Vanessa'],
    last: ['Meier','Müller','Schmid','Keller','Weber','Fischer','Frei','Moser','Baumann','Gerber','Bachmann','Widmer','Zimmermann','Brunner','Huber','Schneider','Schärer','Graf','Wyss','Frei']
  },
  es: {
    first: ['Antonio','José','Manuel','Francisco','Juan','Carlos','Luis','Miguel','Pedro','Rafael','María','Carmen','Ana','Laura','Isabel','Marta','Sara','Paula','Lucía','Sofía'],
    last: ['García','Rodríguez','González','Fernández','López','Martínez','Sánchez','Pérez','Gómez','Martín','Jiménez','Ruiz','Hernández','Díaz','Moreno','Álvarez','Muñoz','Romero','Alonso','Gutiérrez']
  },
  be: {
    first: ['Jean','Pierre','Michel','Philippe','André','Luc','Thierry','Marc','Benoît','Laurent','Marie','Anne','Sophie','Isabelle','Véronique','Nathalie','Christine','Caroline','Sandrine','Aurélie'],
    last: ['Peeters','Janssens','Maes','Jacobs','Mertens','Willems','Claes','Goossens','Wouters','De Smet','Van den Berg','Pieters','Cools','Martens','Desmet','Vermeulen','Aerts','Smets','Depoorter','De Backer']
  },
  nl: {
    first: ['Jan','Peter','Hans','Willem','Klaas','Henk','Bert','Erik','Mark','Ruben','Maria','Anna','Laura','Sanne','Emma','Lieke','Noortje','Eva','Fleur','Sophie'],
    last: ['De Jong','Jansen','Van den Berg','Bakker','Van Dijk','Visser','Smit','Meijer','Mulder','De Vries','Van der Linden','Bos','Peters','Hendriks','Van Leeuwen','Dekker','Van der Meer','Brouwer','Verhoeven','Koster']
  },
  it: {
    first: ['Marco','Giuseppe','Antonio','Luigi','Giovanni','Francesco','Paolo','Mario','Roberto','Stefano','Maria','Anna','Giulia','Laura','Sara','Francesca','Chiara','Valentina','Elena','Alice'],
    last: ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Gallo','Costa','Fontana','Conti','Ricci','Bruno','De Luca','Moretti','Marino','Greco','Barbieri','Lombardi','Giordano','Cassano']
  },
  cz: {
    first: ['Jan','Petr','Tomáš','Jiří','Martin','Pavel','Jaroslav','Miroslav','Zdeněk','Václav','Eva','Anna','Hana','Lenka','Kateřina','Jana','Petra','Lucie','Veronika','Tereza'],
    last: ['Novák','Svoboda','Novotný','Dvořák','Černý','Procházka','Kučera','Veselý','Horák','Němec','Marek','Pokorný','Pánek','Král','Růžička','Beneš','Fiala','Sedláček','Kolář','Macháček']
  },
};

const BASE_ROLES = {
  conducteur:          { label:'Conducteur', salary:120, hiringCost:2000, assignTo:'service', department:'Exploitation', category:'Conduite', description:'Pilote les trains. Service en 3×8 : 8h de service, 16h avant le retour de la même équipe et repos hebdomadaire obligatoire.' },
  conducteur_manoeuvre:{ label:'Conducteur de manœuvre', salary:100, hiringCost:1500, assignTo:'depot', department:'Dépôts & ateliers', category:'Exploitation dépôt', description:'Effectue les manœuvres, mouvements internes et remontées dans les dépôts et ITE.' },
  agent_gare:          { label:'Agent en gare', salary:90, hiringCost:1000, assignTo:'station', department:'Gares', category:'Gare', description:"Gère l'accueil, la sécurité quai et l'information voyageurs en gare." },
  agent_maintenance:   { label:'Agent de maintenance', salary:110, hiringCost:1800, assignTo:'depot', department:'Dépôts & ateliers', category:'Maintenance', description:'Entretien général du matériel roulant. Affecté à un dépôt et réservé automatiquement par les opérations qui le nécessitent.' },
  controleur:          { label:'Contrôleur', salary:100, hiringCost:1500, assignTo:'zone', department:'Exploitation', category:'Contrôle', description:'Contrôle les billets dans les trains de sa zone et verbalise les fraudeurs.' },
  regulateur:          { label:'Régulateur', salary:150, hiringCost:3000, assignTo:'zone', department:'Circulation', category:'Régulation', description:'Organise la circulation sur une zone. Il faut 3 régulateurs par zone pour une couverture 24/7.' },
  agent_circulation:   { label:'Agent de circulation', salary:130, hiringCost:2500, assignTo:'signalbox', department:'Circulation', category:'Aiguillage', description:"Gère les postes d'aiguillage et le cantonnement sur un tronçon." },
};

type StaffRoleDefinition = { label: string; salary: number; hiringCost: number; assignTo: string; department: string; category: string; description: string; depotRole?: boolean };
type DepotRoleBalance = { salary: number; hiringCost: number };
type DepotStaffCatalogEntry = { label?: string; category?: string; [key: string]: unknown };
type HRIncidentDefinition = { label: string; minDays: number; maxDays: number; baseChance: number };
type StaffTrainingDefinition = { label: string; days: number; cost: number; skillGain: number; satisfactionGain: number; description: string; roles?: string[]; dynamic?: boolean; validityDays?: number };
type StaffServiceStop = { stationId?: string; departureTime?: unknown; arrivalTime?: unknown; [key: string]: unknown };

type StaffMaterialGame = {
  rollingStock?: { getById?: (id: string) => Record<string, unknown> | null | undefined; getAll?: () => Record<string, unknown>[] };
  rameManager?: { getAll?: () => Array<{ id?: unknown; elementDetails?: Array<Record<string, unknown>> }> };
  rotationV2?: { vehicles?: Array<Record<string, unknown>> };
  depotManager?: { getDepots?: () => Array<{ id: unknown; name?: unknown; built?: unknown }> };
  scheduleCreator?: { services?: StaffService[]; getActiveServices?: () => StaffService[] };
  world?: { stations?: Array<{ id: unknown; name?: unknown }> };
  _currentDate?: unknown;
};
type StaffRenderGame = {
  _currentDate: unknown; saveState: (...args: unknown[]) => unknown; timeOfDay: unknown; _gameTime: unknown;
  depotManager: { getDepots: (...args: unknown[]) => Array<{ id: unknown; name: unknown; built?: unknown }> };
  ui: { _selectedDepotPageId: unknown; _depotPageTab: unknown; switchPage: (...args: unknown[]) => unknown; renderDepotsList: (...args: unknown[]) => unknown };
  _pendingSignalBox: unknown; economy: Economy;
  scheduleCreator?: { getActiveServices?: () => StaffService[] };
  world?: { stations?: Array<{ id: unknown; name: unknown }> };
  unions?: { render?: (container: Element, game: unknown) => unknown };
  realismSettings?: { personnelRequired?: boolean };
};

type StaffService = {
  id?: unknown; name?: unknown; active?: unknown; completed?: unknown; cancelled?: unknown; state?: unknown;
  rame?: { totalCapacity?: number; elementDetails?: Array<Record<string, unknown>> } | null;
  _onboardPax?: number; lineId?: unknown; _lineId?: unknown; line?: { id?: unknown } | null;
  position?: { lat: unknown; lon: unknown } | null; stops?: StaffServiceStop[]; getCurrentStops?: () => StaffServiceStop[];
  currentStopIndex?: number; serviceType?: string; _regulationPriority?: number; _garageUntil?: unknown;
  _garageUntilDate?: unknown; _garageStationId?: unknown; train: { delayReason?: string }; [key: string]: unknown;
};
const DEPOT_ROLE_BALANCE: Readonly<Record<string, DepotRoleBalance>> = Object.freeze({
  chef_equipe:{salary:155,hiringCost:3000}, agent_manoeuvre:{salary:100,hiringCost:1500}, agent_visite:{salary:110,hiringCost:1800},
  agent_maintenance:{salary:110,hiringCost:1800}, electromecanicien:{salary:135,hiringCost:2400}, mecanicien_diesel:{salary:145,hiringCost:2600},
  technicien_traction_elec:{salary:150,hiringCost:2800}, technicien_pneumatique:{salary:135,hiringCost:2300}, specialiste_freinage:{salary:145,hiringCost:2600},
  specialiste_essieux:{salary:150,hiringCost:2800}, agent_levage:{salary:135,hiringCost:2400}, technicien_hvac:{salary:130,hiringCost:2200},
  chaudronnier_soudeur:{salary:140,hiringCost:2600}, electricien_bord:{salary:140,hiringCost:2500}, agent_avitaillement:{salary:95,hiringCost:1300},
  agent_lavage:{salary:85,hiringCost:900}, agent_nettoyage:{salary:80,hiringCost:800}, agent_assainissement:{salary:90,hiringCost:1100}, magasinier:{salary:95,hiringCost:1200},
});

const DEPOT_ROLE_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  chef_equipe:"Encadre les équipes techniques du dépôt et coordonne les interventions.",
  agent_manoeuvre:"Prépare les mouvements et opérations de manœuvre internes au dépôt.",
  agent_visite:"Réalise les visites techniques et contrôles préventifs du matériel.",
  electromecanicien:"Intervient sur les organes électromécaniques, portes et auxiliaires.",
  mecanicien_diesel:"Spécialiste moteurs diesel, alimentation, refroidissement et transmission.",
  technicien_traction_elec:"Intervient sur moteurs de traction, pantographes, convertisseurs et chaîne haute tension.",
  technicien_pneumatique:"Spécialiste circuits d'air, compresseurs et commandes pneumatiques.",
  specialiste_freinage:"Réalise contrôles, révisions et réparations des systèmes de freinage.",
  specialiste_essieux:"Réalise reprofilage, contrôle roues/essieux et opérations liées aux bogies.",
  agent_levage:"Réalise les opérations de levage et de dépose des organes lourds.",
  technicien_hvac:"Entretien et remplace les groupes de climatisation, chauffage et ventilation.",
  chaudronnier_soudeur:"Répare caisse, structures, supports et éléments métalliques.",
  electricien_bord:"Intervient sur batteries, éclairage, câblage et équipements électriques embarqués.",
  agent_avitaillement:"Assure gazole, sable, fluides et autres avitaillements du matériel.",
  agent_lavage:"Réalise le lavage extérieur et les opérations de dégivrage.",
  agent_nettoyage:"Réalise le nettoyage intérieur et les désinfections des rames voyageurs.",
  agent_assainissement:"Assure vidange, rinçage et remise en service des sanitaires.",
  magasinier:"Gère pièces détachées, consommables et approvisionnements de l'atelier.",
});

const ROLES: Record<string, StaffRoleDefinition> = {...BASE_ROLES};
for (const [id,cat] of Object.entries(DEPOT_STAFF_CATALOG as Record<string, DepotStaffCatalogEntry>)) {
  const existing=ROLES[id]||{};
  const bal=DEPOT_ROLE_BALANCE[id]||{salary:110,hiringCost:1800};
  ROLES[id]={
    ...existing,
    label:cat.label||existing.label||id,
    salary:existing.salary??bal.salary,
    hiringCost:existing.hiringCost??bal.hiringCost,
    assignTo:'depot',
    department:'Dépôts & ateliers',
    category:cat.category||existing.category||'Dépôt',
    description:existing.description||DEPOT_ROLE_DESCRIPTIONS[id]||`Personnel spécialisé de dépôt — ${cat.category||'atelier'}.`,
    depotRole:true,
  };
}

export { ROLES as STAFF_ROLES };

// HOTFIX53 — three permanent 8-hour operational teams.  The assignment
// remains attached to the workplace; only the active team changes with time.
export const STAFF_SHIFT_GROUPS = Object.freeze([
  { id:0, label:'Équipe A', short:'A', start:0, end:480, hours:'00:00–08:00' },
  { id:1, label:'Équipe B', short:'B', start:480, end:960, hours:'08:00–16:00' },
  { id:2, label:'Équipe C', short:'C', start:960, end:1440, hours:'16:00–00:00' },
]);

export const HR_INCIDENT_TYPES: Readonly<Record<string, HRIncidentDefinition>> = Object.freeze({
  sick_leave:{label:'Arrêt maladie',minDays:1,maxDays:3,baseChance:0.0015},
  family_emergency:{label:'Absence imprévue',minDays:1,maxDays:1,baseChance:0.0005},
  work_accident:{label:'Accident du travail',minDays:2,maxDays:7,baseChance:0.00025},
});

export const STAFF_TRAINING_CATALOG: Readonly<Record<string, StaffTrainingDefinition>> = Object.freeze({
  securite:{label:'Sécurité ferroviaire & prévention',days:2,cost:700,skillGain:4,satisfactionGain:3,description:'Rappels sécurité, prévention des accidents et procédures d’urgence.'},
  perfectionnement:{label:'Perfectionnement métier',days:3,cost:1400,skillGain:7,satisfactionGain:4,description:'Formation continue adaptée au métier actuel de l’agent.'},
  expertise:{label:'Expertise technique avancée',days:5,cost:2800,skillGain:12,satisfactionGain:5,roles:['agent_visite','agent_maintenance','electromecanicien','mecanicien_diesel','technicien_traction_elec','technicien_pneumatique','specialiste_freinage','specialiste_essieux','agent_levage','technicien_hvac','chaudronnier_soudeur','electricien_bord'],description:'Diagnostic avancé, méthodes d’atelier et interventions complexes.'},
  eco_conduite:{label:'Éco-conduite & gestion de l’énergie',days:3,cost:1600,skillGain:8,satisfactionGain:4,roles:['conducteur','conducteur_manoeuvre'],description:'Conduite souple, anticipation et gestion énergétique du matériel.'},
  relation_client:{label:'Relation voyageurs & gestion de conflit',days:2,cost:900,skillGain:5,satisfactionGain:4,roles:['agent_gare','controleur'],description:'Accueil, information voyageurs et gestion des situations conflictuelles.'},
  gestion_crise:{label:'Gestion de crise & coordination',days:3,cost:1900,skillGain:7,satisfactionGain:4,roles:['regulateur','agent_circulation','chef_equipe'],description:'Coordination d’incident, priorisation et communication opérationnelle.'},
  // Entrée dynamique : la famille (BB27000, BR185...) est choisie dans l'onglet Habilitations.
  material_authorization:{label:'Habilitation matériel',days:2,cost:1800,skillGain:4,satisfactionGain:2,validityDays:1095,roles:['conducteur','conducteur_manoeuvre'],dynamic:true,description:'Formation à une famille complète de matériel moteur. Validité gameplay : 3 ans.'},
});

export const MATERIAL_AUTHORIZATION_RULES = Object.freeze({
  trainingDays:2,
  trainingCost:1800,
  validityDays:1095,
  renewalWarningDays:90,
});

function _materialText(value: unknown='') {
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim();
}

export function normalizeMaterialFamily(value: unknown='') {
  const s=_materialText(value);
  if(!s)return '';
  const compact=s.replace(/\s+/g,'');
  // Common European traction-series designations. Keep the actual class number:
  // family metadata (realIdentitySeries / seriesName) is deliberately checked
  // before instance names, so BB 27143 still resolves to BB27000 when the
  // catalogue identifies it as such.
  const db=s.match(/\b(?:DB\s+CLASS|BAUREIHE)\s*[- ]?\s*(\d{1,4})\b/i);
  if(db)return `BR${db[1]}`;
  const m=s.match(/\b(BB|CC|BR|Z|X|Y|ET|VT|ICE|TGV|CLASS|RE|AE|RB|E)\s*[- ]?\s*(\d{1,6}(?:\/\d+)?)\b/i);
  if(m)return `${m[1].toUpperCase()}${m[2]}`;
  if(/\bREGIO\s*2N\b/.test(s))return 'REGIO2N';
  if(/\bREGIOLIS\b/.test(s))return 'REGIOLIS';
  if(/\bAGC\b/.test(s))return 'AGC';
  if(/^TGV\b/.test(s))return 'TGV';
  // Allow an already canonical family typed by the player (e.g. VECTRON,
  // TRAXX, EURODUAL) without accepting long catalogue descriptions.
  if(/^[A-Z][A-Z0-9./_-]{1,24}$/.test(compact))return compact;
  return '';
}

export function materialFamilyFromItem(item: Record<string, unknown>={}) {
  if(!item||typeof item!=='object')return '';
  // Highest-confidence metadata first. The identity pass is specifically a
  // family/type field and avoids turning individual numbers into 36k licences.
  const candidates=[
    item.realIdentitySeries,
    item.mlgSeriesName,
    item.seriesName,
    item.name,
    item.catalogId,
  ];
  for(const raw of candidates){
    const family=normalizeMaterialFamily(raw);
    if(family)return family;
  }
  return '';
}

type StaffAuthorization = { family: string; obtainedDate?: string; validUntil?: string; valid?: boolean; [key: string]: unknown };
type StaffMember = {
  id: string; name: string; role: string; nationality: string;
  assignedTo: string | null; available: boolean; hireDate: number;
  totalTrips: number; totalFines: number; totalFineRevenue: number;
  shiftStartMin: number; shiftWorkedMin: number; resting: boolean; restRemainingMin: number;
  restType: string | null; weeklyWorkMin: number; lastWeeklyRestDate: string | null;
  socialRisk: number; busyTaskId: string; busyTaskLabel: string;
  shiftGroup: number | null; onDuty: boolean; onLeave: boolean;
  leaveRemainingDays: number; leaveDaysRemaining: number; leaveYear: number;
  nextLeaveDate: string; leavePending: boolean; absenceType: string; absenceRemainingDays: number;
  pendingDismissal: boolean; weeklyRestDay: number | null; weeklyDayOff: boolean;
  shiftSessionKey: string; dailySalary: number; satisfaction: number; skillLevel: number;
  totalBonuses: number; trainingId: string; trainingLabel: string; trainingRemainingDays: number;
  materialAuthorizations: StaffAuthorization[]; trainingMaterialFamily: string;
  assignedServiceId?: string | null; overtime?: boolean; shiftOverdue?: boolean;
  [key: string]: unknown;
};
type HireOptions = { count?: unknown; generateEach?: boolean; nationality?: string | null; assignedTo?: unknown };
type CoverageStaffMember = {
  assignedTo?: string | null;
  shiftGroup?: number | null;
  weeklyRestDay?: number | null;
  onLeave?: boolean;
  absenceRemainingDays?: number;
  resting?: boolean;
  pendingDismissal?: boolean;
  trainingRemainingDays?: number;
};

type StaffSignalBox = { id:string; name:string; lat:number; lon:number; radiusKm:number; stationId: unknown | null; lineId: unknown | null };
type StaffZone = { id:string; name:string; lat:number|null; lon:number|null; radiusKm:number; lineId: unknown | null; stationId?: unknown | null };
type StaffHrEvent = { id:string; date:unknown; type:unknown; staffId:unknown; title:unknown; detail:unknown };
type StaffDismissal = { date:unknown; staffId:string; name:string; role:string };
type StaffPayroll = { date:unknown; amount:number; count:number };
type LegacyConductor = { id:unknown; name:unknown; assignedServiceId:unknown; available:boolean; hireDate:unknown; totalTrips:unknown };
type MaterialFamilyRow = { family:string; count:number };

export class StaffManager {
  staff: StaffMember[];
  declare signalBoxes: StaffSignalBox[];
  declare zones: StaffZone[];
  declare conductors: LegacyConductor[];
  declare baseSalary: number;
  declare hiringCost: number;
  declare hrEvents: StaffHrEvent[];
  declare dismissalHistory: StaffDismissal[];
  declare _lastHRDate: unknown;
  declare _lastAutoAssignKey: string;
  declare _lastWorkforceTickTime: number | null;
  declare _lastWorkforceTickDate: unknown;
  declare _lastPayrollDate: unknown;
  declare payrollHistory: StaffPayroll[];
  declare _uiTab: string;
  declare _materialFamilyCache: { key:string; rows:MaterialFamilyRow[] };
  declare _lastAssignmentError: string;
  declare _needsMaterialAuthMigration: boolean;
  declare _lastGeneratedNationality?: string;
  declare _lastTickTime: number | null;
  declare _lastTickDate: unknown;
  constructor() {
    this.staff = [] as StaffMember[];          // all personnel
    this.signalBoxes = [];    // { id, name, lat, lon, radiusKm, stationId? }
    this.zones = [];          // { id, name } for regulateurs/controleurs
    // Legacy compat
    this.conductors = [];
    this.baseSalary = 120;
    this.hiringCost = 2000;
    this.hrEvents = [];       // absences, congés, licenciements, alertes RH
    this.dismissalHistory = [];
    this._lastHRDate = '';
    this._lastAutoAssignKey = '';
    this._lastWorkforceTickTime = null;
    this._lastWorkforceTickDate = '';
    this._lastPayrollDate = '';
    this.payrollHistory = [];
    this._uiTab = 'overview';
    this._materialFamilyCache = { key:'', rows:[] };
    this._lastAssignmentError = '';
    // HOTFIX54 — legacy saves created before family authorizations are grandfathered
    // once for the player's currently owned powered fleet, so an upgrade does not
    // suddenly strand every existing service. New drivers/families still require training.
    this._needsMaterialAuthMigration = false;
  }

  // ── Hire ──
  // RH-01 : embauche multiple + noms aléatoires par nationalité quand non fourni.
  hire(economy: Economy, name: unknown, role: string, opts: HireOptions = {}) {
    role = role || 'conducteur';
    const def = ROLES[role];
    if (!def) return null;
    const count = Math.max(1, Math.min(100, parseInt(String(opts.count ?? '')) || 1));
    const totalCost = def.hiringCost * count;
    if (!economy || economy.balance < totalCost) return null;

    const hired = [];
    for (let i = 0; i < count; i++) {
      const generatedName = !name || opts.generateEach ? this.generateRandomName(opts.nationality) : null;
      const memberName = String(name && !opts.generateEach ? name : (generatedName || `${def.label} ${this.getByRole(role).length + 1}`));
      const member: StaffMember = {
        id: `staff-${nextStaffId++}`,
        name: memberName,
        role,
        nationality: generatedName ? String(opts.nationality || this._lastGeneratedNationality || '') : '',
        assignedTo: opts.assignedTo ? String(opts.assignedTo) : null,
        available: !opts.assignedTo,
        hireDate: Date.now(),
        totalTrips: 0,
        totalFines: 0,
        totalFineRevenue: 0,
        shiftStartMin: -1,
        shiftWorkedMin: 0,
        resting: false,
        restRemainingMin: 0,
        restType: null,          // 'daily' | 'weekly'
        weeklyWorkMin: 0,
        lastWeeklyRestDate: null,
        socialRisk: 0,
        busyTaskId: '',
        busyTaskLabel: '',
        // HOTFIX53 — real 3x8 / leave / HR lifecycle state
        shiftGroup: null,
        onDuty: false,
        onLeave: false,
        leaveRemainingDays: 0,
        leaveDaysRemaining: 25,
        leaveYear: 0,
        nextLeaveDate: '',
        leavePending: false,
        absenceType: '',
        absenceRemainingDays: 0,
        pendingDismissal: false,
        weeklyRestDay: null,
        weeklyDayOff: false,
        shiftSessionKey: '',
        // HOTFIX53 — rémunération, satisfaction et développement professionnel
        dailySalary: def.salary,
        satisfaction: 70,
        skillLevel: 50,
        totalBonuses: 0,
        trainingId: '',
        trainingLabel: '',
        trainingRemainingDays: 0,
        // HOTFIX54 — habilitations par famille, jamais par numéro d'engin.
        materialAuthorizations: [],
        trainingMaterialFamily: '',
      };

      economy.addExpense(def.hiringCost, 'personnel', `Embauche: ${member.name} (${def.label})`);
      this.staff.push(member);
      this._ensureWeeklyRestDay(member);
      if (member.assignedTo || role === 'conducteur') { this._ensureShiftGroup(member, member.assignedTo || 'conducteurs'); member.onDuty = true; }
      hired.push(member);
    }
    this._syncLegacy();
    return hired;
  }

  generateRandomName(preferredNationality: string | null | undefined) {
    const rng = getGlobalRng();
    const validPreferred = preferredNationality && NATIONALITY_NAMES[preferredNationality] ? preferredNationality : '';
    const nats = validPreferred ? [validPreferred] : Object.keys(NATIONALITY_NAMES);
    const nat = nats[Math.floor(rng.random() * nats.length)];
    this._lastGeneratedNationality = nat;
    const pool = NATIONALITY_NAMES[nat];
    const first = pool.first[Math.floor(rng.random() * pool.first.length)];
    const last = pool.last[Math.floor(rng.random() * pool.last.length)];
    return `${first} ${last}`;
  }

  // ── HOTFIX53 : 3x8 / congés / incidents RH / affectation automatique ──
  _hashInt(value: unknown='') {
    let h=2166136261;
    for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    return h>>>0;
  }

  _addDays(dateStr: unknown, days: unknown=0) {
    const m=String(dateStr||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';
    const ms=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0));
    return new Date(ms).toISOString().slice(0,10);
  }

  getCurrentShiftGroup(timeOfDay: unknown=0) {
    const t=((Number(timeOfDay)||0)%1440+1440)%1440;
    return STAFF_SHIFT_GROUPS.find((g) =>t>=g.start&&t<g.end)||STAFF_SHIFT_GROUPS[0];
  }

  _isShiftGroupOnDuty(member: __KPStruct677,timeOfDay: unknown=0) {
    if(member?.shiftGroup==null)return true; // old saves / pre-first-tick compatibility
    return Number(member.shiftGroup)===this.getCurrentShiftGroup(timeOfDay).id;
  }

  _ensureShiftGroup(member: StaffMember,targetId: unknown='') {
    if(!member)return 0;
    if(member.shiftGroup!==null&&[0,1,2].includes(Number(member.shiftGroup))){member.shiftGroup=Number(member.shiftGroup);return member.shiftGroup;}
    const target=String(targetId||member.assignedTo|| (member.role==='conducteur'?'conducteurs':''));
    const counts=[0,0,0];
    for(const other of this.staff){
      if(other===member||other.role!==member.role)continue;
      const otherTarget=String(other.assignedTo|| (other.role==='conducteur'?'conducteurs':''));
      if(otherTarget!==target)continue;
      const g=Number(other.shiftGroup);if(g>=0&&g<=2)counts[g]++;
    }
    const min=Math.min(...counts);member.shiftGroup=counts.indexOf(min);return member.shiftGroup;
  }

  _ensureWeeklyRestDay(member: { weeklyRestDay: unknown; id: unknown }) {
    if(!member)return 0;
    const raw=member.weeklyRestDay;const n=Number(raw);
    if(raw!==null&&raw!==''&&raw!==undefined&&Number.isInteger(n)&&n>=0&&n<=6)return n;
    member.weeklyRestDay=this._hashInt(`${member.id}|weekly-rest`)%7;
    return member.weeklyRestDay;
  }

  _weekday(dateStr: unknown='') {
    const m=String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return -1;
    return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))).getUTCDay();
  }

  _workforceDelta(timeOfDay: unknown,dateStr: unknown='') {
    const first=this._lastWorkforceTickTime==null;
    if(first){this._lastWorkforceTickTime=Number(timeOfDay)||0;this._lastWorkforceTickDate=dateStr;return 0;}
    const now=Number(timeOfDay)||0,prev=Number(this._lastWorkforceTickTime)||0;let delta=0;
    if(dateStr&&this._lastWorkforceTickDate){const days=this._daysBetween(this._lastWorkforceTickDate,dateStr);if(days>0)delta=days*1440+now-prev;else if(days===0&&now>=prev)delta=now-prev;}
    else delta=now>=prev?now-prev:(1440-prev)+now;
    this._lastWorkforceTickTime=now;this._lastWorkforceTickDate=dateStr;
    return Number.isFinite(delta)?Math.max(0,Math.min(delta,10080)):0;
  }

  _scheduleNextLeave(member: StaffMember,dateStr: unknown) {
    if(!member||!dateStr||Number(member.leaveDaysRemaining||0)<=0){if(member)member.nextLeaveDate='';return '';}
    const seed=this._hashInt(`${member.id}|${dateStr}|${member.leaveDaysRemaining}`);
    const offset=20+(seed%61); // 20..80 days: spread leave blocks across the year
    member.nextLeaveDate=this._addDays(dateStr,offset);
    return member.nextLeaveDate;
  }

  _pushHREvent(event: Record<string, unknown>={}) {
    this.hrEvents.push({id:`hr-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:event.date||'',type:event.type||'info',staffId:event.staffId||'',title:event.title||'Événement RH',detail:event.detail||''});
    if(this.hrEvents.length>120)this.hrEvents.splice(0,this.hrEvents.length-120);
  }

  _startLeave(member: __KPStruct681,days: unknown,dateStr: unknown,automatic: unknown=false) {
    if(!member||member.onLeave||member.absenceRemainingDays>0||member.busyTaskId||member.trainingRemainingDays>0)return {ok:false,reason:'Agent indisponible'};
    if(member.role==='conducteur'&&member.assignedTo)return {ok:false,reason:'Le conducteur est encore en service'};
    const available=Math.max(0,Math.floor(Number(member.leaveDaysRemaining)||0));
    if(available<=0)return {ok:false,reason:'Solde de congés épuisé'};
    const requested=Math.max(1,Math.floor(Number(days)||1));
    const n=Math.min(available,requested);
    member.onLeave=true;member.leaveRemainingDays=n;member.leaveDaysRemaining=available-n;member.leavePending=false;member.onDuty=false;member.available=false;
    this._pushHREvent({date:dateStr,type:'leave',staffId:member.id,title:`Congé — ${member.name}`,detail:`${n} jour(s)${automatic?' planifié(s) automatiquement':''}`});
    member.nextLeaveDate='';
    return {ok:true,days:n};
  }

  requestLeave(staffId: unknown,days: unknown,dateStr: unknown='') {
    const m=this.staff.find((x: { id: unknown }) =>x.id===staffId);if(!m)return {ok:false,reason:'Agent introuvable'};
    return this._startLeave(m,days,dateStr||this._lastHRDate||'',false);
  }

  _finishLeave(member: StaffMember,dateStr: unknown) {
    member.onLeave=false;member.leaveRemainingDays=0;member.leavePending=false;member.available=!member.assignedTo&&!member.resting&&!member.busyTaskId;
    this._pushHREvent({date:dateStr,type:'leave_end',staffId:member.id,title:`Retour de congé — ${member.name}`,detail:'Agent de nouveau disponible selon son équipe 3×8.'});
    this._scheduleNextLeave(member,dateStr);
  }

  _startHRIncident(member: StaffMember,type: string,dateStr: unknown,rng: RandomSource=getGlobalRng()) {
    const def=HR_INCIDENT_TYPES[type];if(!member||!def)return false;
    const span=Math.max(0,def.maxDays-def.minDays);const days=def.minDays+Math.floor((rng.random?.()??Math.random())*(span+1));
    member.absenceType=type;member.absenceRemainingDays=days;member.onDuty=false;member.available=false;
    this._pushHREvent({date:dateStr,type:'incident',staffId:member.id,title:`${def.label} — ${member.name}`,detail:`Indisponibilité prévue : ${days} jour(s).`});
    return true;
  }

  _finishHRIncident(member: StaffMember,dateStr: unknown) {
    const label=HR_INCIDENT_TYPES[member.absenceType]?.label||'Absence';
    member.absenceType='';member.absenceRemainingDays=0;member.available=!member.assignedTo&&!member.resting&&!member.busyTaskId;
    this._pushHREvent({date:dateStr,type:'incident_end',staffId:member.id,title:`Retour après ${label.toLowerCase()} — ${member.name}`,detail:'Agent de nouveau disponible selon son roulement.'});
  }

  getMemberSalary(member: unknown) {
    if(!member || typeof member!=='object')return 0;
    const row=member as Record<string, unknown>;
    const base=Number(ROLES[String(row.role||'')]?.salary)||120;
    const own=Number(row.dailySalary);
    return Number.isFinite(own)&&own>0?Math.round(own):base;
  }

  getAverageStaffSatisfaction() {
    if(!this.staff.length)return 75;
    return this.staff.reduce((sum: number,m: { satisfaction: unknown })=>sum+Math.max(0,Math.min(100,Number.isFinite(Number(m.satisfaction??70))?Number(m.satisfaction??70):70)),0)/this.staff.length;
  }

  giveBonus(staffId: unknown, amount: unknown, economy: Economy, dateStr: unknown='') {
    const m=this.staff.find((x: { id: unknown }) =>x.id===staffId);const n=Math.round(Number(amount));
    if(!m)return {ok:false,reason:'Agent introuvable'};
    if(!Number.isFinite(n)||n<50||n>100000)return {ok:false,reason:'Prime invalide (50 à 100 000 €).'};
    if(!economy||Number(economy.balance)<n)return {ok:false,reason:'Fonds insuffisants'};
    economy.addExpense(n,'primes_personnel',`Prime exceptionnelle — ${m.name}`);
    m.totalBonuses=Math.max(0,Number(m.totalBonuses||0))+n;
    const salary=Math.max(1,this.getMemberSalary(m));
    const boost=Math.max(1,Math.min(20,Math.round((n/(salary*10))*10)));
    m.satisfaction=Math.max(0,Math.min(100,Number(m.satisfaction??70)+boost));
    this._pushHREvent({date:dateStr||this._lastHRDate||'',type:'bonus',staffId:m.id,title:`Prime — ${m.name}`,detail:`${n.toLocaleString('fr-FR')} € · satisfaction +${boost}`});
    return {ok:true,amount:n,satisfactionGain:boost,satisfaction:m.satisfaction};
  }

  raiseSalary(staffId: unknown, percent: unknown, dateStr: unknown='') {
    const m=this.staff.find((x: { id: unknown }) =>x.id===staffId);const pct=Number(percent);
    if(!m)return {ok:false,reason:'Agent introuvable'};
    if(!Number.isFinite(pct)||pct<1||pct>50)return {ok:false,reason:'Augmentation invalide (1 à 50 %).'};
    const before=this.getMemberSalary(m),after=Math.max(before+1,Math.round(before*(1+pct/100)));
    m.dailySalary=after;
    const boost=Math.max(1,Math.min(15,Math.round(pct*0.6)));
    m.satisfaction=Math.max(0,Math.min(100,Number(m.satisfaction??70)+boost));
    this._pushHREvent({date:dateStr||this._lastHRDate||'',type:'raise',staffId:m.id,title:`Augmentation — ${m.name}`,detail:`${before} → ${after} €/jour (+${pct.toFixed(1).replace('.0','')} %) · satisfaction +${boost}`});
    return {ok:true,before,after,satisfactionGain:boost,satisfaction:m.satisfaction};
  }

  getTrainingOptions(member: { role: unknown }) {
    if(!member)return [];
    return Object.entries(STAFF_TRAINING_CATALOG)
      .filter(([,d])=>!d.dynamic&&(!Array.isArray(d.roles)||d.roles.includes(String(member.role||''))))
      .map(([id,d])=>({id,...d}));
  }

  _authorizationDateValid(auth: { family: unknown; validUntil?: unknown },dateStr: unknown='') {
    if(!auth?.family)return false;
    if(!auth.validUntil||!dateStr)return true;
    return String(auth.validUntil)>=String(dateStr);
  }

  getMaterialAuthorizations(member: unknown,dateStr: unknown='') {
    if(!member || typeof member!=='object')return [];
    const row=member as Record<string, unknown>;
    const seen=new Set<string>(),rows: StaffAuthorization[]=[];
    for(const raw of Array.isArray(row.materialAuthorizations)?row.materialAuthorizations:[]){
      const family=normalizeMaterialFamily(raw?.family||raw);
      if(!family||seen.has(family))continue;
      seen.add(family);
      const auth: StaffAuthorization=typeof raw==='object'&&raw?{...(raw as Record<string, unknown>),family}:{family,obtainedDate:'',validUntil:''};
      auth.valid=this._authorizationDateValid(auth,dateStr);
      rows.push(auth);
    }
    return rows.sort((a,b)=>a.family.localeCompare(b.family,'fr'));
  }

  hasMaterialAuthorization(member: unknown,family: unknown,dateStr: unknown='') {
    const key=normalizeMaterialFamily(family);if(!member||!key)return false;
    return this.getMaterialAuthorizations(member,dateStr).some((a) =>a.family===key&&a.valid);
  }

  getMaterialFamilyForElement(element: Record<string, unknown>,game: unknown = null) {
    if(!element)return '';
    const g=game as StaffMaterialGame | null;
    const catalogId=String(element.catalogId||element.id||'');
    const stock=catalogId&&g?.rollingStock?.getById?.(catalogId);
    return materialFamilyFromItem(stock||element)||materialFamilyFromItem(element);
  }

  getServiceMaterialFamilies(service: unknown,game: unknown=null) {
    const svc=service as StaffService | null | undefined;
    const rame=svc?.rame||null;if(!rame)return [];
    const out=new Set<string>();
    for(const el of Array.isArray(rame.elementDetails)?rame.elementDetails:[]){
      const category=String(el?.category||'').toLowerCase();
      const powered=category==='locomotive'||category==='automotrice';
      if(!powered)continue;
      const family=this.getMaterialFamilyForElement(el,game);
      if(family)out.add(family);
    }
    return [...out].sort((a,b)=>String(a).localeCompare(String(b),'fr'));
  }

  canConductorDriveService(member: { "role": unknown },service: unknown,dateStr: unknown='',game: unknown=null) {
    if(!member||member.role!=='conducteur')return {ok:false,missing:[],families:[],reason:'Ce salarié n’est pas conducteur.'};
    const families=this.getServiceMaterialFamilies(service,game);
    // Unknown/legacy stock must not deadlock a save: only positively identified
    // families are licence-gated.
    if(!families.length)return {ok:true,missing:[],families,reason:''};
    const missing=families.filter((f: unknown) =>!this.hasMaterialAuthorization(member,f,dateStr));
    return {ok:missing.length===0,missing,families,reason:missing.length?`Habilitation matériel manquante : ${missing.join(' + ')}`:''};
  }

  getOwnedMaterialFamilies(game: unknown = null): string[] {
    const g=game as StaffMaterialGame | null;
    const families=new Set<string>();
    const add=(item: Record<string, unknown>)=>{
      if(!item)return;
      const cat=String(item.category||'').toLowerCase();
      if(cat!=='locomotive'&&cat!=='automotrice')return;
      const family=materialFamilyFromItem(item);
      if(family)families.add(family);
    };
    for(const rame of g?.rameManager?.getAll?.()||[]){
      for(const el of rame?.elementDetails||[]){
        const stockItem=el?.catalogId?g?.rollingStock?.getById?.(String(el.catalogId)):null;
        add(stockItem||el);
      }
    }
    for(const v of g?.rotationV2?.vehicles||[]){
      const stockItem=v?.catalogId?g?.rollingStock?.getById?.(String(v.catalogId)):null;
      add(stockItem||v);
    }
    return [...families].sort((a,b)=>String(a).localeCompare(String(b),'fr'));
  }

  migrateLegacyMaterialAuthorizations(game: unknown=null,dateStr: unknown='') {
    if(!this._needsMaterialAuthMigration)return {migrated:false,families:0,drivers:0,grants:0};
    const families=this.getOwnedMaterialFamilies(game);
    const drivers=this.staff.filter((m) =>['conducteur','conducteur_manoeuvre'].includes(m.role));
    const validityDays=Number(MATERIAL_AUTHORIZATION_RULES.validityDays)||1095;
    const validUntil=dateStr?this._addDays(dateStr,validityDays):'';
    let grants=0;
    for(const m of drivers){
      const rows=this.getMaterialAuthorizations(m,'').map((a) =>({family:a.family,obtainedDate:a.obtainedDate||'',validUntil:a.validUntil||''}));
      const known=new Set(rows.map((a) =>a.family));
      for(const family of families){
        if(known.has(family))continue;
        rows.push({family,obtainedDate:String(dateStr||''),validUntil});known.add(family);grants++;
      }
      m.materialAuthorizations=rows;
    }
    this._needsMaterialAuthMigration=false;
    if(grants>0)this._pushHREvent({
      date:dateStr||'',type:'material_authorization_migration',staffId:'',
      title:'Habilitations matériel — migration de sauvegarde',
      detail:`Compatibilité ancienne sauvegarde : ${grants} habilitation(s) accordée(s) aux conducteurs existants pour ${families.length} famille(s) motrice(s) déjà possédée(s). Les nouveaux conducteurs et nouvelles familles nécessitent une formation.`
    });
    return {migrated:true,families:families.length,drivers:drivers.length,grants};
  }

  getMaterialFamilyCatalogue(game: unknown = null) {
    const g=game as StaffMaterialGame | null;
    const rames=g?.rameManager?.getAll?.()||[];
    const vehicles=g?.rotationV2?.vehicles||[];
    const stock=g?.rollingStock?.getAll?.()||[];
    // The full 36k catalogue may be deferred. We scan the catalogue currently
    // loaded plus all owned/physical stock, and cache the result between renders.
    const key=`${stock.length}|${rames.length}|${vehicles.length}|${stock.at?.(-1)?.id||''}|${rames.at?.(-1)?.id||''}`;
    if(this._materialFamilyCache?.key===key)return this._materialFamilyCache.rows;
    const counts=new Map();
    const add=(item: Record<string, unknown>)=>{
      if(!item)return;
      const cat=String(item.category||'').toLowerCase();
      const powered=cat==='locomotive'||cat==='automotrice';
      if(!powered)return;
      const family=materialFamilyFromItem(item);
      if(!family)return;
      counts.set(family,(counts.get(family)||0)+1);
    };
    for(const item of stock)add(item);
    for(const rame of rames)for(const el of rame.elementDetails||[]){
      const stockItem=el?.catalogId?g?.rollingStock?.getById?.(String(el.catalogId)):null;
      add(stockItem||el);
    }
    for(const v of vehicles)add(v);
    const rows=[...counts.entries()].map(([family,count])=>({family,count})).sort((a,b)=>a.family.localeCompare(b.family,'fr'));
    this._materialFamilyCache={key,rows};
    return rows;
  }

  startMaterialAuthorization(staffId: unknown,family: unknown,economy: Economy,dateStr: unknown='') {
    const m=this.staff.find((x: { id: unknown }) =>x.id===staffId),key=normalizeMaterialFamily(family),def=STAFF_TRAINING_CATALOG.material_authorization;
    if(!m)return {ok:false,reason:'Agent introuvable'};
    if(!['conducteur','conducteur_manoeuvre'].includes(m.role))return {ok:false,reason:'Ce métier ne nécessite pas d’habilitation de conduite matériel'};
    if(!key)return {ok:false,reason:'Famille matériel invalide'};
    if(m.trainingRemainingDays>0)return {ok:false,reason:'Une formation est déjà en cours'};
    if(m.busyTaskId||m.onLeave||m.absenceRemainingDays||m.resting||m.pendingDismissal)return {ok:false,reason:'Agent indisponible'};
    if(m.role==='conducteur'&&m.assignedTo)return {ok:false,reason:'Le conducteur doit terminer son service avant l’habilitation'};
    const current=this.getMaterialAuthorizations(m,dateStr).find((a) =>a.family===key&&a.valid);
    if(current)return {ok:false,reason:`Déjà habilité ${key}${current.validUntil?` jusqu’au ${current.validUntil}`:''}`};
    if(!economy||Number(economy.balance)<def.cost)return {ok:false,reason:'Fonds insuffisants'};
    economy.addExpense(def.cost,'formation_personnel',`Habilitation ${key} — ${m.name}`);
    m.trainingId='material_authorization';
    m.trainingMaterialFamily=key;
    m.trainingLabel=`Habilitation matériel — ${key}`;
    m.trainingRemainingDays=def.days;
    m.onDuty=false;m.available=false;
    this._pushHREvent({date:dateStr||this._lastHRDate||'',type:'material_authorization',staffId:m.id,title:`Habilitation ${key} — ${m.name}`,detail:`Formation famille ${key} · ${def.days} jour(s) · ${def.cost.toLocaleString('fr-FR')} €`});
    return {ok:true,family:key,days:def.days,cost:def.cost};
  }

  getMissingConductorReason(service: unknown,dateStr: unknown='',game: unknown=null) {
    if(this.getByRole('conducteur').length===0)return '';
    const families=this.getServiceMaterialFamilies(service,game);
    if(!families.length)return 'personnel : conducteur indisponible';
    const qualified=this.getByRole('conducteur').filter((c: unknown) =>families.every((f: unknown) =>this.hasMaterialAuthorization(c,f,dateStr)));
    if(!qualified.length)return `personnel : aucun conducteur habilité ${families.join(' + ')}`;
    return `personnel : conducteur habilité indisponible (${families.join(' + ')})`;
  }

  startTraining(staffId: unknown, trainingId: unknown, economy: Economy, dateStr: unknown='') {
    const m=this.staff.find((x) =>x.id===staffId),trainingKey=String(trainingId||''),def=STAFF_TRAINING_CATALOG[trainingKey];
    if(!m)return {ok:false,reason:'Agent introuvable'};
    if(!def||def.dynamic||!this.getTrainingOptions(m).some((x) =>x.id===trainingKey))return {ok:false,reason:'Formation incompatible avec ce métier'};
    if(m.trainingRemainingDays>0)return {ok:false,reason:'Une formation est déjà en cours'};
    if(m.busyTaskId||m.onLeave||m.absenceRemainingDays||m.resting||m.pendingDismissal)return {ok:false,reason:'Agent indisponible'};
    if(m.role==='conducteur'&&m.assignedTo)return {ok:false,reason:'Le conducteur doit terminer son service avant la formation'};
    if(!economy||Number(economy.balance)<def.cost)return {ok:false,reason:'Fonds insuffisants'};
    economy.addExpense(def.cost,'formation_personnel',`Formation ${def.label} — ${m.name}`);
    m.trainingId=trainingKey;m.trainingLabel=def.label;m.trainingRemainingDays=def.days;m.onDuty=false;m.available=false;
    this._pushHREvent({date:dateStr||this._lastHRDate||'',type:'training',staffId:m.id,title:`Départ en formation — ${m.name}`,detail:`${def.label} · ${def.days} jour(s) · ${def.cost.toLocaleString('fr-FR')} €`});
    return {ok:true,days:def.days,cost:def.cost};
  }

  _finishTraining(member: StaffMember,dateStr: unknown='') {
    const def=STAFF_TRAINING_CATALOG[member.trainingId];const label=member.trainingLabel||def?.label||'Formation';
    let authorizationDetail='';
    if(member.trainingId==='material_authorization'){
      const family=normalizeMaterialFamily(member.trainingMaterialFamily);
      if(family){
        const rows=this.getMaterialAuthorizations(member,'').filter((a) =>a.family!==family).map((a) =>({family:a.family,obtainedDate:a.obtainedDate||'',validUntil:a.validUntil||''}));
        const validUntil=dateStr?this._addDays(dateStr,Number(def?.validityDays||MATERIAL_AUTHORIZATION_RULES.validityDays)):'';
        rows.push({family,obtainedDate:String(dateStr||''),validUntil});
        member.materialAuthorizations=rows;
        authorizationDetail=` · ${family}${validUntil?` valide jusqu’au ${validUntil}`:''}`;
      }
    }
    member.skillLevel=Math.max(0,Math.min(100,Number(member.skillLevel??50)+(Number(def?.skillGain)||0)));
    member.satisfaction=Math.max(0,Math.min(100,Number(member.satisfaction??70)+(Number(def?.satisfactionGain)||0)));
    member.trainingId='';member.trainingLabel='';member.trainingRemainingDays=0;member.trainingMaterialFamily='';member.available=!member.assignedTo&&!member.resting&&!member.onLeave&&!member.absenceRemainingDays&&!member.pendingDismissal;
    this._pushHREvent({date:dateStr,type:'training_end',staffId:member.id,title:`Formation terminée — ${member.name}`,detail:`${label}${authorizationDetail} · compétence ${Math.round(member.skillLevel)}/100 · satisfaction ${Math.round(member.satisfaction)}/100`});
  }

  processDailyHR(game: unknown,dateStr: unknown,rng: RandomSource=getGlobalRng()) {
    if(!dateStr||this._lastHRDate===dateStr)return {processed:false,incidents:0,leaves:0};
    const previousDate = Date.parse(String(this._lastHRDate || '') + 'T00:00:00Z');
    const currentDate = Date.parse(String(dateStr) + 'T00:00:00Z');
    if (Number.isFinite(previousDate) && Number.isFinite(currentDate) && currentDate <= previousDate) return {processed:false,incidents:0,leaves:0};
    const elapsedDays = Number.isFinite(previousDate) && Number.isFinite(currentDate) ? Math.max(1, Math.round((currentDate - previousDate) / 86400000)) : 1;
    this._lastHRDate=dateStr;let incidents=0,leaves=0;
    const year=Number(String(dateStr).slice(0,4))||0;
    for(const m of this.staff){
      // Annual leave bank: 25 days. Existing balance is replaced only when the year changes.
      if(Number(m.leaveYear||0)!==year){m.leaveYear=year;m.leaveDaysRemaining=25;m.nextLeaveDate='';m.leavePending=false;}

      if(Number(m.trainingRemainingDays||0)>0){
        m.trainingRemainingDays=Math.max(0,Math.floor(Number(m.trainingRemainingDays)||0)-elapsedDays);m.onDuty=false;m.available=false;
        if(m.trainingRemainingDays<=0)this._finishTraining(m,dateStr);
        continue;
      }
      if(m.onLeave){m.leaveRemainingDays=Math.max(0,Math.floor(Number(m.leaveRemainingDays)||0)-elapsedDays);if(m.leaveRemainingDays<=0)this._finishLeave(m,dateStr);continue;}
      if(Number(m.absenceRemainingDays||0)>0){m.absenceRemainingDays=Math.max(0,Math.floor(Number(m.absenceRemainingDays)||0)-elapsedDays);if(m.absenceRemainingDays<=0)this._finishHRIncident(m,dateStr);continue;}

      if(!m.nextLeaveDate&&Number(m.leaveDaysRemaining||0)>0)this._scheduleNextLeave(m,dateStr);
      if(m.leavePending || (m.nextLeaveDate&&m.nextLeaveDate<=dateStr)){
        const canLeave=!m.busyTaskId && !(m.role==='conducteur'&&m.assignedTo);
        if(canLeave){const block=Math.min(5,Math.max(1,Number(m.leaveDaysRemaining||0)));const r=this._startLeave(m,block,dateStr,true);if(r.ok)leaves++;}
        else m.leavePending=true;
        continue;
      }

      // Individual HR incidents are intentionally rare, but are real and date-driven.
      // Social risk increases work-accident/absence probability rather than creating fake instant strikes.
      if(m.busyTaskId || (m.role==='conducteur'&&m.assignedTo))continue;
      for(const [type,def] of Object.entries(HR_INCIDENT_TYPES)){
        const socialFactor=1+Math.max(0,Number(m.socialRisk||0))/80;
        const satisfactionFactor=1+Math.max(0,60-Number(m.satisfaction??70))/100;
        const skillFactor=Math.max(0.70,1-Math.max(0,Number(m.skillLevel??50)-50)/200);
        if((rng.random?.()??Math.random()) < def.baseChance*socialFactor*satisfactionFactor*skillFactor){if(this._startHRIncident(m,type,dateStr,rng))incidents++;break;}
      }
    }
    return {processed:true,incidents,leaves};
  }

  _tickFixedShiftStates(timeOfDay: unknown=0,dateStr: unknown='',delta: number=0) {
    const weekday=this._weekday(dateStr);
    for(const m of this.staff){
      if(m.role==='conducteur')continue;
      this._ensureWeeklyRestDay(m);
      if(m.assignedTo)this._ensureShiftGroup(m,m.assignedTo);
      const unavailable=m.onLeave||Number(m.absenceRemainingDays||0)>0||m.resting||m.pendingDismissal||Number(m.trainingRemainingDays||0)>0;
      const weeklyDayOff=weekday>=0&&Number(m.weeklyRestDay)===weekday;
      m.weeklyDayOff=weeklyDayOff;
      if(weeklyDayOff&&dateStr&&m.lastWeeklyRestDate!==dateStr&&!m.busyTaskId){m.lastWeeklyRestDate=String(dateStr);m.weeklyWorkMin=0;}
      const scheduled=m.assignedTo ? this._isShiftGroupOnDuty(m,timeOfDay) : false;
      const workAllowed=!unavailable && !weeklyDayOff;
      // A technician already committed to an operation finishes it even if a relief boundary is crossed.
      m.onDuty=!unavailable && (!!m.busyTaskId || (scheduled&&!weeklyDayOff));
      m.overtime=!!m.busyTaskId && (!scheduled||weeklyDayOff) && !unavailable;
      m.available=!m.assignedTo&&!unavailable&&!m.busyTaskId;

      const sessionKey=scheduled&&workAllowed&&m.assignedTo?`${dateStr}|${m.shiftGroup}`:'';
      if(sessionKey&&m.shiftSessionKey!==sessionKey){m.shiftSessionKey=sessionKey;m.shiftWorkedMin=0;}
      if(m.onDuty&&m.assignedTo&&delta>0){m.shiftWorkedMin=Math.min(1440,Number(m.shiftWorkedMin||0)+delta);m.weeklyWorkMin=Math.min(10080,Number(m.weeklyWorkMin||0)+delta);}
      if(m.overtime||Number(m.shiftWorkedMin||0)>480)m.socialRisk=Math.min(100,Number(m.socialRisk||0)+0.03*Math.max(1,delta));
      else if(m.onDuty)m.socialRisk=Math.max(0,Number(m.socialRisk||0)-0.005*Math.max(1,delta));
    }
  }

  _targetsForRole(role: string,game: unknown) {
    const g=game as StaffMaterialGame;
    const def=ROLES[role];if(!def)return [];
    if(def.assignTo==='depot')return (g.depotManager?.getDepots?.()||[]).filter((d) =>d&&d.built!==false).map((d) =>({id:String(d.id),label:String(d.name||d.id)}));
    if(def.assignTo==='zone')return this.zones.map((z) =>({id:String(z.id),label:z.name||z.id}));
    if(def.assignTo==='signalbox')return this.signalBoxes.map((b) =>({id:String(b.id),label:b.name||b.id}));
    if(def.assignTo==='station'){
      const used=new Set<string>();
      for(const svc of g.scheduleCreator?.getActiveServices?.()||[]){for(const st of (svc.getCurrentStops?.()||svc.stops||[])){if(st?.stationId)used.add(String(st.stationId));}}
      const stations=g.world?.stations||[];const byId=new Map(stations.map((s) =>[String(s.id),s] as const));
      return [...used].map((id) =>({id,label:String(byId.get(id)?.name||id)}));
    }
    return [];
  }

  rebalanceConductorShifts(activeServices: unknown=[]) {
    const demand=[0,0,0];
    for(const svc of Array.isArray(activeServices)?activeServices:[]){
      if(!svc||svc.active===false||svc.cancelled)continue;
      const stops=svc.getCurrentStops?.()||svc.stops||[];const dep=Number(stops[0]?.departureTime??0);
      const g=this.getCurrentShiftGroup(((dep%1440)+1440)%1440).id;demand[g]++;
    }
    const drivers=this.getByRole('conducteur');const counts=[0,0,0];
    for(const d of drivers){const g=Number(d.shiftGroup);if(g>=0&&g<=2&&d.assignedTo)counts[g]++;}
    for(const d of drivers){
      if(d.assignedTo||d.busyTaskId||d.resting||d.onLeave||d.absenceRemainingDays||d.pendingDismissal||d.trainingRemainingDays)continue;
      let best=0,bestScore=-Infinity;
      for(let g=0;g<3;g++){const score=(demand[g]+1)/(counts[g]+1);if(score>bestScore){bestScore=score;best=g;}}
      d.shiftGroup=best;counts[best]++;
    }
    return {demand,counts};
  }

  autoAssignAll(game: unknown) {
    if(!game)return 0;let assigned=0;
    for(const m of this.staff){
      if(m.role==='conducteur'||m.assignedTo||m.busyTaskId||m.pendingDismissal||m.trainingRemainingDays)continue;
      const def=ROLES[m.role];if(!def||def.assignTo==='service')continue;
      const targets=this._targetsForRole(m.role,game);if(!targets.length)continue;
      const target=targets.slice().sort((a,b)=>this.getAssignedTo(a.id).filter((x: __S3Struct965) =>x.role===m.role).length-this.getAssignedTo(b.id).filter((x: __S3Struct966) =>x.role===m.role).length||String(a.label).localeCompare(String(b.label),'fr'))[0];
      if(target&&this.assign(m.id,target.id))assigned++;
    }
    return assigned;
  }

  _processPendingDismissals(dateStr: unknown='') {
    let count=0;
    for(let i=this.staff.length-1;i>=0;i--){const m=this.staff[i];if(!m.pendingDismissal)continue;if(m.busyTaskId||m.trainingRemainingDays||(m.role==='conducteur'&&m.assignedTo))continue;this.dismissalHistory.push({date:dateStr,staffId:m.id,name:m.name,role:m.role});this._pushHREvent({date:dateStr,type:'dismissal',staffId:m.id,title:`Licenciement — ${m.name}`,detail:`${ROLES[m.role]?.label||m.role}`});this.staff.splice(i,1);count++;}
    if(count)this._syncLegacy();return count;
  }

  tickWorkforce(game: unknown,activeServices: unknown,timeOfDay: unknown,dateStr: unknown='') {
    const delta=this._workforceDelta(timeOfDay,dateStr);
    this.processDailyHR(game,dateStr);
    this._tickFixedShiftStates(timeOfDay,dateStr,delta);
    const key=`${dateStr}|${Math.floor((Number(timeOfDay)||0)/5)}`;
    if(key!==this._lastAutoAssignKey){this._lastAutoAssignKey=key;this.rebalanceConductorShifts(activeServices);this.autoAssignAll(game);this._tickFixedShiftStates(timeOfDay,dateStr,0);}
    this._processPendingDismissals(dateStr);
  }

  requestFire(staffId: unknown,dateStr: unknown='') {
    const idx=this.staff.findIndex((s: { id: unknown }) =>s.id===staffId);if(idx<0)return {ok:false,pending:false,reason:'Agent introuvable'};
    const m=this.staff[idx];
    if(m.busyTaskId || m.trainingRemainingDays || (m.role==='conducteur'&&m.assignedTo)){
      m.pendingDismissal=true;
      this._pushHREvent({date:dateStr,type:'dismissal_pending',staffId:m.id,title:`Licenciement programmé — ${m.name}`,detail:'Prendra effet dès la fin de la tâche ou du service en cours.'});
      return {ok:true,pending:true};
    }
    this.dismissalHistory.push({date:dateStr,staffId:m.id,name:m.name,role:m.role});
    this._pushHREvent({date:dateStr,type:'dismissal',staffId:m.id,title:`Licenciement — ${m.name}`,detail:`${ROLES[m.role]?.label||m.role}`});
    this.staff.splice(idx,1);this._syncLegacy();return {ok:true,pending:false};
  }

  // ── Fire ──
  fire(staffId: unknown) {
    const r=this.requestFire(staffId,this._lastHRDate||'');
    return !!(r?.ok && !r.pending);
  }

  // ── Assign ──
  assign(staffId: unknown, targetId: unknown, game: unknown = null) {
    const g=game as StaffMaterialGame | null;
    const s = this.staff.find((s: { id: unknown }) => s.id === staffId);
    this._lastAssignmentError='';
    if (!s || s.assignedTo || s.busyTaskId || s.pendingDismissal || s.trainingRemainingDays) return false;
    if(s.role==='conducteur'&&g?.scheduleCreator){
      const svc=(g.scheduleCreator.getActiveServices?.()||g.scheduleCreator.services||[]).find((x) =>String(x?.id||'')===String(targetId||''));
      if(!svc){this._lastAssignmentError='Service introuvable';return false;}
      const check=this.canConductorDriveService(s,svc,g._currentDate||this._lastHRDate||'',g);
      if(!check.ok){this._lastAssignmentError=check.reason||'Habilitation matériel manquante';return false;}
    }
    // Affectation = lieu/équipe permanent. Elle reste possible hors service ou pendant les congés.
    s.assignedTo = String(targetId);
    this._ensureShiftGroup(s,s.assignedTo);
    s.available = false;
    this._syncLegacy();
    return true;
  }

  unassignStaff(staffId: unknown) {
    const s = this.staff.find((x: { id: unknown }) => x.id === staffId);
    if (!s || s.busyTaskId || s.trainingRemainingDays || (s.role==='conducteur'&&s.assignedTo)) return false;
    s.assignedTo = null; s.onDuty=false; s.available = !s.resting&&!s.onLeave&&!s.absenceRemainingDays; this._syncLegacy(); return true;
  }

  unassignByTarget(targetId: unknown) {
    for (const s of this.staff) {
      if (s.assignedTo === targetId) {
        s.assignedTo = null;
        s.available = !s.resting&&!s.onLeave&&!s.absenceRemainingDays;
        if (s.role === 'conducteur') s.totalTrips++;
      }
    }
    this._syncLegacy();
  }

  // ── Queries ──
  getByRole(role: unknown) { return this.staff.filter((s: { role: unknown }) => s.role === role); }
  getAvailableByRole(role: unknown) { return this.staff.filter((s: { role: unknown; assignedTo: unknown; resting: unknown; onLeave: unknown; absenceRemainingDays: unknown; pendingDismissal: unknown; trainingRemainingDays: unknown; available: unknown }) => s.role === role && !s.assignedTo && !s.resting && !s.onLeave && !s.absenceRemainingDays && !s.pendingDismissal && !s.trainingRemainingDays && s.available !== false); }
  getAssignedTo(targetId: unknown) { return this.staff.filter((s: { assignedTo: unknown }) => s.assignedTo === targetId); }

  hasAssignedConductor(serviceId: unknown, strict: unknown = false) {
    if (!strict && this.getByRole('conducteur').length === 0) return true;
    return this.staff.some((s: { role: unknown; assignedTo: unknown }) => s.role === 'conducteur' && s.assignedTo === serviceId);
  }

  getAvailable() { return this.getAvailableByRole('conducteur'); }

  isDepotRole(role: string) { return ROLES[role]?.assignTo === 'depot' && !!ROLES[role]?.depotRole; }

  getDepotStaff(depotId: unknown, role: unknown = '') {
    const id=String(depotId||'');
    return this.staff.filter((s: { assignedTo: unknown; role: unknown }) => s.assignedTo===id && (!role || s.role===role));
  }

  getDepotStaffAvailability(depotId: unknown, role: unknown) {
    const assigned=this.getDepotStaff(depotId, role);
    const busy=assigned.filter((s: { busyTaskId: unknown }) =>!!s.busyTaskId).length;
    const resting=assigned.filter((s: { resting: unknown }) =>!!s.resting).length;
    const leave=assigned.filter((s: { onLeave: unknown }) =>!!s.onLeave).length;
    const absent=assigned.filter((s: { absenceRemainingDays: unknown }) =>Number(s.absenceRemainingDays||0)>0).length;
    const training=assigned.filter((s: { trainingRemainingDays: unknown }) =>Number(s.trainingRemainingDays||0)>0).length;
    const offShift=assigned.filter((s: { busyTaskId: unknown; resting: unknown; onLeave: unknown; absenceRemainingDays: unknown; trainingRemainingDays: unknown; onDuty: unknown }) =>!s.busyTaskId&&!s.resting&&!s.onLeave&&!s.absenceRemainingDays&&!s.trainingRemainingDays&&s.onDuty===false).length;
    const free=assigned.filter((s: { busyTaskId: unknown; resting: unknown; onLeave: unknown; absenceRemainingDays: unknown; trainingRemainingDays: unknown; onDuty: unknown; pendingDismissal: unknown }) =>!s.busyTaskId&&!s.resting&&!s.onLeave&&!s.absenceRemainingDays&&!s.trainingRemainingDays&&s.onDuty!==false&&!s.pendingDismissal).length;
    return {assigned:assigned.length,busy,resting,leave,absent,training,offShift,free};
  }

  checkDepotStaff(depotId: unknown, requirements: unknown = {}) {
    const shortages=[];
    for(const [role,rawNeed] of Object.entries(requirements||{})){
      const need=Math.max(0,Math.floor(Number(rawNeed)||0));if(!need)continue;
      const a=this.getDepotStaffAvailability(depotId,role);
      if(a.free<need)shortages.push({role,need,free:a.free,assigned:a.assigned,label:ROLES[role]?.label||role});
    }
    return {ok:shortages.length===0,shortages};
  }

  reserveDepotStaff(depotId: unknown, requirements: unknown = {}, taskId: unknown, taskLabel: unknown='') {
    const id=String(taskId||''); if(!id)return {ok:false,staffIds:[]};
    const check=this.checkDepotStaff(depotId,requirements);if(!check.ok)return {ok:false,shortages:check.shortages,staffIds:[]};
    const picked=[];
    for(const [role,rawNeed] of Object.entries(requirements||{})){
      let need=Math.max(0,Math.floor(Number(rawNeed)||0));
      for(const m of this.staff){
        if(!need)break;
        if(m.role!==role||m.assignedTo!==String(depotId||'')||m.resting||m.onLeave||m.absenceRemainingDays||m.trainingRemainingDays||m.onDuty===false||m.pendingDismissal||m.busyTaskId)continue;
        m.busyTaskId=id;m.busyTaskLabel=String(taskLabel||'Opération dépôt');picked.push(m.id);need--;
      }
    }
    return {ok:true,staffIds:picked};
  }

  releaseDepotTask(taskId: unknown) {
    const id=String(taskId||'');let released=0;
    for(const m of this.staff){if(m.busyTaskId===id){m.busyTaskId='';m.busyTaskLabel='';released++;}}
    return released;
  }

  reconcileDepotTaskReservations(operations: unknown=[]) {
    const live=new Map((Array.isArray(operations)?operations:[]).filter((o) =>o?.id&&o?.state!=='done').map((o) =>[String(o.id),o]));
    for(const m of this.staff){if(m.busyTaskId&&!live.has(String(m.busyTaskId))){m.busyTaskId='';m.busyTaskLabel='';}}
    for(const op of live.values()){
      const ids=new Set((Array.isArray(op.staffIds)?op.staffIds:[]).map(String));
      for(const m of this.staff){if(ids.has(String(m.id))&&m.assignedTo===String(op.depotId||'')){m.busyTaskId=String(op.id);m.busyTaskLabel=String(op.label||'Opération dépôt');}}
    }
  }

  autoAssignDepotStaff(depots: unknown=[]) {
    const targets=(Array.isArray(depots)?depots:[]).filter((d) =>d&&d.built!==false&&d.type==='depot');if(!targets.length)return 0;
    let assigned=0;
    for(const m of this.staff){
      if(m.assignedTo||m.busyTaskId||m.pendingDismissal||m.trainingRemainingDays||ROLES[m.role]?.assignTo!=='depot')continue;
      const target=targets.slice().sort((a,b)=>this.getDepotStaff(a.id,m.role).length-this.getDepotStaff(b.id,m.role).length||String(a.name||'').localeCompare(String(b.name||''),'fr'))[0];
      if(target&&this.assign(m.id,target.id))assigned++;
    }
    return assigned;
  }

  // ── Auto-assignment of conductors ──
  // RH-03 : 8h entre services ; RH-03/04 : repos 24h/semaine sinon risque social.
  tickConductors(activeServices: unknown, timeOfDay: number, dateStr: unknown = '', game: unknown = null) {
    const services: StaffService[] = Array.isArray(activeServices) ? activeServices as StaffService[] : [];
    const conducteurs = this.getByRole('conducteur');
    if (conducteurs.length === 0) return;
    

    // Date-aware delta. A same-date clock jump backwards is ignored rather than
    // being interpreted as an accidental 24h shift.
    const firstTick = this._lastTickTime == null;
    if (firstTick) { this._lastTickTime = timeOfDay; this._lastTickDate = dateStr; }
    let delta = 0;
    if (!firstTick && dateStr && this._lastTickDate) {
      const days = this._daysBetween(this._lastTickDate, dateStr);
      if (days > 0) delta = days * 1440 + timeOfDay - this._lastTickTime!;
      else if (days === 0 && timeOfDay >= this._lastTickTime!) delta = timeOfDay - this._lastTickTime!;
    } else if (!firstTick) {
      delta = timeOfDay >= this._lastTickTime! ? timeOfDay - this._lastTickTime! : (1440 - this._lastTickTime!) + timeOfDay;
    }
    this._lastTickTime = timeOfDay; this._lastTickDate = dateStr;
    delta = Number.isFinite(Number(delta)) ? Math.max(0, Number(delta)) : 0;

    const SHIFT_DURATION = 480; // 8h
    const DAILY_REST = 960;     // a real 3x8 employee works 8h then has 16h before the same team returns
    const WEEKLY_REST = 1440;   // 24h weekly rest
    const WEEKLY_WORK_LIMIT = 6 * SHIFT_DURATION; // 48h

    for (const c of conducteurs) {
      this._ensureShiftGroup(c,'conducteurs');
      const unavailable = c.onLeave || Number(c.absenceRemainingDays||0)>0 || c.pendingDismissal || Number(c.trainingRemainingDays||0)>0;
      if (unavailable && !c.assignedTo) { c.onDuty=false; c.available=false; continue; }

      if (c.resting) {
        c.restRemainingMin -= delta;
        if (c.restRemainingMin <= 0) {
          c.resting = false;
          c.shiftWorkedMin = 0;
          c.shiftStartMin = -1;
          c.shiftOverdue = false;
          if (c.restType === 'weekly') {
            c.weeklyWorkMin = 0;
            c.lastWeeklyRestDate = String(dateStr||'');
          }
          c.restType = null;
        }
        c.onDuty=!c.resting && this._isShiftGroupOnDuty(c,timeOfDay) && !c.onLeave && !c.absenceRemainingDays && !c.pendingDismissal && !c.trainingRemainingDays;
        c.available=c.onDuty&&!c.assignedTo;
        if(c.resting)continue;
      }

      if (c.assignedTo) {
        const svc = services.find((s) => String(s.id) === String(c.assignedTo));
        if (!svc || svc.cancelled) {
          c.assignedTo = null; c.available = false; c.shiftOverdue = false;
          if(c.shiftWorkedMin>0)this._startRest(c,dateStr,DAILY_REST,WEEKLY_REST,WEEKLY_WORK_LIMIT);
          continue;
        }
        const isWithTrain = ['moving','departing','waiting','stopped_at_station','preparation'].includes(String(svc.state||''));
        if (isWithTrain) {
          if (c.shiftStartMin < 0) c.shiftStartMin = timeOfDay;
          // 3x8 = all time in charge of the train counts, not only wheel-turning minutes.
          c.shiftWorkedMin += delta;
          c.weeklyWorkMin += delta;
        }

        const weeklyOverdue = this._isWeeklyRestOverdue(c, dateStr, WEEKLY_WORK_LIMIT);
        const shiftOverdue = c.shiftWorkedMin >= SHIFT_DURATION;
        const teamWindowEnded = !this._isShiftGroupOnDuty(c,timeOfDay);
        c.onDuty=true; // a driver already on the train remains responsible until a safe relief point

        if (weeklyOverdue || shiftOverdue || teamWindowEnded) c.socialRisk = Math.min(100, Number(c.socialRisk||0) + 0.05 * delta);
        else c.socialRisk = Math.max(0, Number(c.socialRisk||0) - 0.01 * delta);

        if (svc.completed) {
          c.assignedTo = null;c.totalTrips++;c.shiftOverdue=false;
          this._startRest(c,dateStr,DAILY_REST,WEEKLY_REST,WEEKLY_WORK_LIMIT);
          continue;
        }

        if (shiftOverdue || weeklyOverdue || teamWindowEnded) {
          if (svc.state !== 'moving' && svc.state !== 'departing') {
            c.assignedTo = null;c.totalTrips++;c.shiftOverdue=false;
            this._startRest(c,dateStr,DAILY_REST,WEEKLY_REST,WEEKLY_WORK_LIMIT);
          } else c.shiftOverdue = true;
        }
        continue;
      }

      c.onDuty=this._isShiftGroupOnDuty(c,timeOfDay)&&!c.onLeave&&!c.absenceRemainingDays&&!c.pendingDismissal&&!c.resting&&!c.trainingRemainingDays;
      c.available=c.onDuty;
      if (!c.onDuty || c.shiftWorkedMin >= SHIFT_DURATION || c.shiftOverdue) continue;

      const needsConductor = services.filter((svc) => {
        if (svc?.active === false || svc?.completed || svc?.cancelled) return false;
        if (!['waiting','stopped_at_station','preparation'].includes(String(svc?.state||''))) return false;
        if (conducteurs.some((cc: { assignedTo: unknown }) => String(cc.assignedTo||'') === String(svc.id))) return false;
        // HOTFIX54 — auto-affectation only considers trains for which this
        // specific driver holds every required powered-stock family licence.
        return this.canConductorDriveService(c,svc,dateStr,game).ok;
      }).sort((a,b)=>{
        const sa=a.getCurrentStops?.()||a.stops||[],sb=b.getCurrentStops?.()||b.stops||[];
        const ai=Math.max(0,Math.min(sa.length-1,Number(a.currentStopIndex)||0)),bi=Math.max(0,Math.min(sb.length-1,Number(b.currentStopIndex)||0));
        const at=Number(sa[ai]?.departureTime??sa[0]?.departureTime??0),bt=Number(sb[bi]?.departureTime??sb[0]?.departureTime??0);
        return at-bt||String(a.id||'').localeCompare(String(b.id||''));
      });

      if (needsConductor.length > 0) {
        const pick = needsConductor[0];
        c.assignedTo = String(pick.id);
        c.available = false;c.onDuty=true;
        if (c.shiftStartMin < 0) c.shiftStartMin = timeOfDay;
      }
    }
    this._syncLegacy();
  }

  _startRest(c: StaffMember, dateStr: unknown, dailyRest: number, weeklyRest: number, weeklyWorkLimit: number) {
    c.resting = true;
    c.available = false;
    c.restRemainingMin = this._isWeeklyRestOverdue(c, dateStr, weeklyWorkLimit) ? weeklyRest : dailyRest;
    c.restType = c.restRemainingMin === weeklyRest ? 'weekly' : 'daily';
    if (c.restType === 'weekly') {
      c.weeklyWorkMin = 0;
      c.lastWeeklyRestDate = String(dateStr||'');
    }
  }

  _isWeeklyRestOverdue(c: StaffMember, dateStr: unknown, weeklyWorkLimit: number) {
    if (!dateStr) return false;
    if (c.weeklyWorkMin >= weeklyWorkLimit) return true;
    if (c.lastWeeklyRestDate == null) return false;
    const days = this._daysBetween(c.lastWeeklyRestDate, dateStr);
    return days >= 6;
  }

  _daysBetween(a: unknown, b: unknown) {
    const parse = (value: unknown) => {
      const s=String(value||''); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const [y,m,d]=s.split('-').map(Number), ms=Date.UTC(y,m-1,d);
      return new Date(ms).toISOString().slice(0,10)===s ? ms : null;
    };
    const aa=parse(a),bb=parse(b); return aa==null||bb==null?0:Math.floor((bb-aa)/86400000);
  }

  // ── Signal Boxes ──
  addSignalBox(data: Record<string, unknown> = {}) {
    const lat=Number(data.lat), lon=Number(data.lon), radius=Number(data.radiusKm);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    const sb = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name: String(data.name || '').trim() || `Poste ${this.signalBoxes.length + 1}`,
      lat, lon,
      radiusKm: Number.isFinite(radius) ? Math.max(1, Math.min(500, radius)) : 10,
      stationId: data.stationId || null,
      lineId: data.lineId || null,
    };
    this.signalBoxes.push(sb);
    return sb;
  }

  removeSignalBox(id: unknown) {
    // Unassign agents first
    for (const s of this.staff) {
      if (s.role === 'agent_circulation' && s.assignedTo === id) { s.assignedTo = null; s.available = !s.resting; }
    }
    this.signalBoxes = this.signalBoxes.filter((sb: { id: unknown }) => sb.id !== id);
  }

  getSignalBoxById(id: unknown) { return this.signalBoxes.find((sb: { id: unknown }) => sb.id === id); }

  // ── Zones ──
  addZone(name: unknown, lat?: unknown, lon?: unknown, radiusKm?: unknown, lineId?: unknown) {
    const nLat=lat==null?null:Number(lat), nLon=lon==null?null:Number(lon);
    const z = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name: String(name || `Zone ${this.zones.length + 1}`).trim() || `Zone ${this.zones.length + 1}`,
      lat: typeof nLat==='number'&&Number.isFinite(nLat)&&nLat>=-90&&nLat<=90 ? nLat : null,
      lon: typeof nLon==='number'&&Number.isFinite(nLon)&&nLon>=-180&&nLon<=180 ? nLon : null,
      radiusKm: Number.isFinite(Number(radiusKm)) ? Math.max(1, Math.min(1000, Number(radiusKm))) : 30,
      lineId: lineId || null,
    };
    this.zones.push(z);
    return z;
  }

  removeZone(id: unknown) {
    for (const s of this.staff) {
      if ((s.role === 'regulateur' || s.role === 'controleur') && s.assignedTo === id) { s.assignedTo = null; s.available = !s.resting; }
    }
    this.zones = this.zones.filter((z: { id: unknown }) => z.id !== id);
  }

  // ── Contrôleur logic ──
  tickControleurs(economy: Economy, activeServices: unknown, gameTimeMin: unknown) {
    const services: StaffService[] = Array.isArray(activeServices) ? activeServices as StaffService[] : [];
    const controleurs = this.staff.filter((s: { role: unknown; assignedTo: unknown; onDuty: unknown; onLeave: unknown; absenceRemainingDays: unknown; pendingDismissal: unknown; trainingRemainingDays: unknown }) => s.role === 'controleur' && s.assignedTo && s.onDuty!==false && !s.onLeave && !s.absenceRemainingDays && !s.pendingDismissal && !s.trainingRemainingDays);
    const hasControleur = controleurs.length > 0;
    const effectiveFraudRate = economy.getEffectiveFraudRate(hasControleur);

    const paxServices = services.filter((s) =>
      s.state === 'moving' && s.rame && Number(s.rame.totalCapacity||0) > 0
    );
    if (paxServices.length === 0) return;

    if (!hasControleur) return;

    const rng = getGlobalRng();
    for (const ctrl of controleurs) {
      if (rng.random() > 0.033) continue;
      const zone = this.zones.find((z: { id: unknown }) => z.id === ctrl.assignedTo);
      const eligible = paxServices.filter((svc) => {
        if (!zone) return false;
        if (zone.lineId && [svc.lineId, svc._lineId, svc.line?.id].includes(zone.lineId)) return true;
        if (zone.stationId && (svc.getCurrentStops?.() || svc.stops || []).some((st) => st.stationId === zone.stationId)) return true;
        if (zone.lat != null && zone.lon != null && svc.position) return haversineDistance(svc.position.lat, svc.position.lon, zone.lat, zone.lon) <= (zone.radiusKm || 30);
        return !zone.lineId && !zone.stationId && zone.lat == null && zone.lon == null;
      });
      if (!eligible.length) continue;
      const svc = eligible[Math.floor(rng.random() * eligible.length)];
      const paxCount = svc._onboardPax || 0;
      if (paxCount <= 0) continue;
      const frauders = Math.floor(paxCount * effectiveFraudRate);
      if (frauders <= 0) continue;
      const fineAmount = frauders * 50;
      ctrl.totalFines += frauders;
      ctrl.totalFineRevenue += fineAmount;
      economy.totalFraudFines += fineAmount;
      economy.addRevenue(fineAmount, 'amendes', `Contr\u00f4le ${ctrl.name}: ${frauders} PV \u00d7 50\u20ac (${svc.name})`);
    }
  }

  // ── Régulateur coverage check ──
  _isCoverageMemberOperational(member: StaffMember) {
    if (!member?.assignedTo) return false;
    if (member.onLeave || Number(member.absenceRemainingDays || 0) > 0 || member.resting || member.pendingDismissal || Number(member.trainingRemainingDays || 0) > 0) return false;

    // Before the first workforce tick there is no authoritative game clock yet.
    // Treat a freshly assigned member as operational so coverage is effective
    // immediately instead of appearing only after the next RH tick.
    if (this._lastWorkforceTickTime == null) return true;

    this._ensureShiftGroup(member, member.assignedTo);
    const weekday = this._weekday(this._lastWorkforceTickDate || '');
    if (weekday >= 0 && Number(member.weeklyRestDay) === weekday) return false;
    return this._isShiftGroupOnDuty(member, this._lastWorkforceTickTime);
  }

  getZoneRegulatorCoverage(zoneId: unknown) {
    const regs = this.staff.filter((s: { role: unknown; assignedTo: unknown }) => s.role === 'regulateur' && s.assignedTo === zoneId);
    // A direct/legacy assignment may exist before the first RH tick. Initialise
    // the 3x8 group lazily so structural coverage is correct immediately.
    for (const reg of regs) this._ensureShiftGroup(reg, zoneId);
    const eligible = regs.filter((s: { onLeave: unknown; absenceRemainingDays: unknown; resting: unknown; pendingDismissal: unknown; trainingRemainingDays: unknown }) => !s.onLeave && !s.absenceRemainingDays && !s.resting && !s.pendingDismissal && !s.trainingRemainingDays);
    const groups=new Set(eligible.map((s: { shiftGroup: unknown }) =>Number(s.shiftGroup)).filter((x: __KPStruct714) =>x>=0&&x<=2));
    const onDuty=eligible.filter((s) => this._isCoverageMemberOperational(s)).length;
    // Three staffed teams are required for structural 24/7 coverage; one of them is active now.
    return { count: regs.length, needed: 3, teamsCovered:groups.size, onDuty, covered: groups.size>=3 && onDuty>0 };
  }

  // REG-01/02/04 : détermine si un point est couvert par une zone régulateur + AC
  // stationIds/lineIds permettent le découpage par axe (REG-04) sans dépendre du rayon
  getRegulationEffects(lat: unknown, lon: unknown, stationIds: unknown[] = [], lineIds: unknown[] = []) {
    if (lat == null || lon == null) return { regulator: null, signalBox: null };
    const stationSet = new Set(stationIds);
    const lineSet = new Set(lineIds);
    const effects: {regulator:unknown;signalBox:unknown} = { regulator: null, signalBox: null };
    for (const z of this.zones) {
      const cov = this.getZoneRegulatorCoverage(z.id);
      if (!cov.covered) continue;
      let covered = false;
      if (z.lineId && lineSet.has(z.lineId)) covered = true;
      if (!covered && z.stationId && stationSet.has(z.stationId)) covered = true;
      if (!covered && z.lat != null && z.lon != null) {
        const d = haversineDistance(lat, lon, z.lat, z.lon);
        if (d <= (z.radiusKm || 150)) covered = true;
      }
      if (covered) {
        effects.regulator = { zoneId: z.id, name: z.name };
        break;
      }
    }
    for (const sb of this.signalBoxes) {
      const agents = this.staff.filter((s) => s.role === 'agent_circulation' && s.assignedTo === sb.id && this._isCoverageMemberOperational(s));
      if (agents.length === 0) continue;
      let covered = false;
      if (sb.lineId && lineSet.has(sb.lineId)) covered = true;
      if (!covered && sb.stationId && stationSet.has(sb.stationId)) covered = true;
      if (!covered && sb.lat != null && sb.lon != null) {
        const d = haversineDistance(lat, lon, sb.lat, sb.lon);
        if (d <= (sb.radiusKm || 10)) covered = true;
      }
      if (covered) {
        effects.signalBox = { boxId: sb.id, name: sb.name, agents: agents.length };
        break;
      }
    }
    return effects;
  }

  _garageHoldActive(svc: { _garageUntil?: unknown; _garageUntilDate?: unknown }, timeOfDay: unknown, dateStr: unknown) {
    if (!svc || svc._garageUntil == null) return false;
    if (!svc._garageUntilDate || !dateStr) return Number(timeOfDay) < Number(svc._garageUntil);
    if (dateStr < svc._garageUntilDate) return true;
    if (dateStr > svc._garageUntilDate) return false;
    return Number(timeOfDay) < Number(svc._garageUntil);
  }

  _startGarageHold(svc: { _garageStationId?: unknown; _garageUntil?: unknown; _garageUntilDate?: unknown }, stationId: string, waitMin: number, timeOfDay: unknown, dateStr: string) {
    if (!svc || !Number.isFinite(Number(waitMin)) || waitMin <= 0) return;
    // Never extend an already-active hold every regulation tick. That historical
    // behaviour could keep a non-priority train in the siding forever.
    if (this._garageHoldActive(svc, timeOfDay, dateStr) && svc._garageStationId === stationId) return;
    const total = Number(timeOfDay) + Number(waitMin);
    svc._garageUntil = ((total % 1440) + 1440) % 1440;
    svc._garageUntilDate = dateStr || '';
    if (dateStr && total >= 1440) {
      const [y,m,d] = dateStr.split('-').map(Number);
      svc._garageUntilDate = new Date(Date.UTC(y,m-1,d+Math.floor(total/1440))).toISOString().slice(0,10);
    }
    svc._garageStationId = stationId || '';
  }

  // REG-03 — le jeu décide de l'ordre de passage / garage en gare
  tickRegulateurs(activeServices: unknown, timeOfDay: number, dateStr: string, realismSettings: { delayTolerance: unknown }) {
    const services: StaffService[] = Array.isArray(activeServices) ? activeServices as StaffService[] : [];
    const rawTolerance = Number(realismSettings?.delayTolerance);
    const tolerance = Number.isFinite(rawTolerance) ? Math.max(0, rawTolerance) : 30;
    const stationQueues = new Map<string, Array<{ svc: StaffService; dep: number; delay: number; type: string }>>();
    for (const svc of services) {
      if (!svc.active || svc.completed || svc.cancelled) continue;
      if (svc.state !== 'waiting' && svc.state !== 'stopped_at_station') continue;
      const stops = svc.getCurrentStops ? svc.getCurrentStops() : svc.stops;
      const currentStopIndex=Number(svc.currentStopIndex)||0;
      const stopIndex = svc.state === 'waiting' ? currentStopIndex : Math.max(0, currentStopIndex - 1);
      const next = stops?.[stopIndex];
      if (!next) continue;
      const dep = Number(next.departureTime ?? next.arrivalTime ?? 0)||0;
      // Retard calculé à la minute actuelle (pas le svc.delay du tick précédent)
      const delay = Math.max(0, timeDiff(timeOfDay, dep));
      const stationId=String(next.stationId||''); if(!stationId) continue;
      if (!stationQueues.has(stationId)) stationQueues.set(stationId, []);
      stationQueues.get(stationId)!.push({ svc, dep, delay, type: svc.serviceType || 'passager' });
    }
    for (const [stationId, queue] of stationQueues) {
      queue.sort((a, b) => {
        if (a.type !== b.type) {
          // priorité voyageur > fret > travaux
          const order: Record<string,number> = { passager: 0, fret: 1, w: 1, work: 2, hlp: 3, tm: 3, evo: 4, m: 4 };
          return (order[a.type] ?? 5) - (order[b.type] ?? 5);
        }
        return a.dep - b.dep;
      });
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        item.svc._regulationPriority = i;
        const maxWait = (item.type === 'passager') ? 60 : 120;
        if (item.delay > tolerance && i > 0) {
          // Train en retard et non prioritaire -> une seule fenêtre de garage.
          // La fenêtre n'est pas repoussée à chaque minute et peut franchir minuit.
          this._startGarageHold(item.svc, stationId, Math.min(item.delay, maxWait), timeOfDay, dateStr);
          if (this._garageHoldActive(item.svc, timeOfDay, dateStr)) item.svc.train.delayReason = 'regulation : garage temporaire';
        } else if (!this._garageHoldActive(item.svc, timeOfDay, dateStr)) {
          item.svc._garageUntil = null;
          item.svc._garageUntilDate = '';
          item.svc._garageStationId = '';
          if (item.svc.train.delayReason === 'regulation : garage temporaire') item.svc.train.delayReason = '';
        }
      }
    }
  }

  // ── Daily salaries ──
  getDailySalaryExpense() {
    return this.staff.reduce((total: number,m: unknown)=>total+this.getMemberSalary(m),0);
  }

  processDailySalaries(economy: Economy, dateStr: unknown='') {
    if(!economy)return {processed:false,total:0,count:0,reason:'Économie indisponible'};
    // Salary payment is date-idempotent in the real game loop. Reloading or a repeated
    // 00:00 tick must never debit the company twice for the same payroll day.
    if(dateStr&&this._lastPayrollDate===dateStr)return {processed:false,total:0,count:this.staff.length,reason:'Déjà versé'};
    let total=0;
    const byRole: Record<string, {count:number;total:number}>={};
    for(const m of this.staff){
      const amount=this.getMemberSalary(m);if(amount<=0)continue;total+=amount;
      const role=m.role||'conducteur';if(!byRole[role])byRole[role]={count:0,total:0};byRole[role].count++;byRole[role].total+=amount;
    }
    for(const [role,row] of Object.entries(byRole)){
      const def=ROLES[role];if(!def||row.total<=0)continue;
      economy.addExpense(row.total,'salaires',`Salaires: ${row.count} ${def.label}(s) — ${row.total.toLocaleString('fr-FR')} €`);
    }
    if(dateStr)this._lastPayrollDate=dateStr;
    this.payrollHistory.push({date:dateStr||'',amount:total,count:this.staff.length});if(this.payrollHistory.length>90)this.payrollHistory.splice(0,this.payrollHistory.length-90);
    this._pushHREvent({date:dateStr,type:'payroll',title:'Versement des salaires',detail:`${this.staff.length} salarié(s) · ${total.toLocaleString('fr-FR')} € versés.`});
    return {processed:true,total,count:this.staff.length};
  }

  // ── Render ──
  render(container: HTMLElement, game: unknown): void;
  render(container: HTMLElement, game: StaffRenderGame) {
    if (!container) return;
    const eco = game.economy;
    const activeServices: StaffService[] = (game.scheduleCreator?.getActiveServices?.() || []) as StaffService[];
    const stations = game.world?.stations || [];
    const depots = game.depotManager?.getDepots?.() || [];
    const esc=(v: unknown) =>String(v??'').replace(/[&<>"']/g,(c) =>(({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as Record<string,string>)[c]));
    const norm=(v: unknown) =>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const timeOfDay=Number(game.timeOfDay??game._gameTime??0)||0;
    const currentShift=this.getCurrentShiftGroup(timeOfDay);
    const tab=['overview','hire','assignments','shifts','development','authorizations','social','roster'].includes(this._uiTab)?this._uiTab:'overview';

    const totalStaff = this.staff.length;
    const assigned = this.staff.filter((s: { assignedTo: unknown }) => s.assignedTo).length;
    const unassigned = this.staff.filter((s: { assignedTo: unknown; pendingDismissal: unknown }) =>!s.assignedTo&&!s.pendingDismissal).length;
    const onLeave = this.staff.filter((s: { onLeave: unknown }) =>s.onLeave).length;
    const absent = this.staff.filter((s: { absenceRemainingDays: unknown }) =>Number(s.absenceRemainingDays||0)>0).length;
    const busy = this.staff.filter((s: { busyTaskId: unknown }) => s.busyTaskId).length;
    const onDuty = this.staff.filter((s: { onDuty: unknown; onLeave: unknown; absenceRemainingDays: unknown }) =>s.onDuty&&!s.onLeave&&!s.absenceRemainingDays).length;
    const pendingDismissal=this.staff.filter((s: { pendingDismissal: unknown }) =>s.pendingDismissal).length;
    const inTraining=this.staff.filter((s: { trainingRemainingDays: unknown }) =>Number(s.trainingRemainingDays||0)>0).length;
    const avgSatisfaction=this.getAverageStaffSatisfaction();
    const lastPayroll=this.payrollHistory.at(-1)||null;
    const roleKeys = Object.keys(ROLES);
    const departments=[...new Set(roleKeys.map((k) =>ROLES[k].department||'Autres'))].sort((a,b)=>a.localeCompare(b,'fr'));

    const targetName=(m: StaffMember)=>{
      if(!m?.assignedTo)return '—';
      const id=String(m.assignedTo),def=ROLES[m.role];
      if(def?.assignTo==='depot')return depots.find((d: { id: unknown }) =>String(d.id)===id)?.name||id;
      if(def?.assignTo==='station')return stations.find((st: { id: unknown }) =>String(st.id)===id)?.name||id;
      if(def?.assignTo==='zone')return this.zones.find((z: { id: unknown }) =>String(z.id)===id)?.name||id;
      if(def?.assignTo==='signalbox')return this.signalBoxes.find((b: { id: unknown }) =>String(b.id)===id)?.name||id;
      if(def?.assignTo==='service')return activeServices.find((s) =>String(s.id)===id)?.name||id;
      return id;
    };

    const depotSummary=depots.map((d: { id: unknown; name: unknown }) =>{
      const staff=this.getDepotStaff(d.id),busyCount=staff.filter((x: { busyTaskId: unknown }) =>x.busyTaskId).length,free=staff.filter((x: { busyTaskId: unknown; resting: unknown; onLeave: unknown; absenceRemainingDays: unknown; onDuty: unknown }) =>!x.busyTaskId&&!x.resting&&!x.onLeave&&!x.absenceRemainingDays&&x.onDuty!==false).length;
      const leave=staff.filter((x: { onLeave: unknown; absenceRemainingDays: unknown }) =>x.onLeave||x.absenceRemainingDays).length,training=staff.filter((x: { trainingRemainingDays: unknown }) =>x.trainingRemainingDays).length,off=staff.filter((x: { busyTaskId: unknown; onLeave: unknown; absenceRemainingDays: unknown; trainingRemainingDays: unknown; onDuty: unknown }) =>!x.busyTaskId&&!x.onLeave&&!x.absenceRemainingDays&&!x.trainingRemainingDays&&x.onDuty===false).length;
      return `<article class="staff-depot-summary"><div><b>${esc(d.name)}</b><small>${staff.length} agent(s) affecté(s)</small></div><span><strong>${free}</strong> libre(s) · <strong>${busyCount}</strong> en opération · ${off} hors équipe · ${leave} absent/congé · ${training} formation</span><button class="btn-sm staff-open-depot" data-depot-id="${esc(d.id)}">Ouvrir le dépôt</button></article>`;
    }).join('');

    const roleCards=roleKeys.map((k) =>{
      const def=ROLES[k],members=this.getByRole(k),busyRole=members.filter((m: { busyTaskId: unknown }) =>m.busyTaskId).length;
      const shiftCoverage=[0,1,2].map((g) =>members.filter((m: { shiftGroup: unknown }) =>Number(m.shiftGroup)===g).length).join(' / ');
      return `<article class="staff-role-card" data-role-card-search="${esc(norm([def.label,def.department,def.category,def.description].join(' ')))}"><div><b>${esc(def.label)}</b><small>${esc(def.department||'')} · ${esc(def.category||'')}</small></div><p>${esc(def.description||'')}</p><footer><span><strong>${members.length}</strong> employé(s)${busyRole?` · ${busyRole} occupé(s)`:''}</span><span>Équipes A/B/C : ${shiftCoverage}</span><span>${def.salary.toLocaleString('fr-FR')} €/j · embauche ${def.hiringCost.toLocaleString('fr-FR')} €</span><button class="btn-sm staff-pick-role" data-role="${esc(k)}">Choisir</button></footer></article>`;
    }).join('');

    const shiftCards=STAFF_SHIFT_GROUPS.map((g) =>{
      const members=this.staff.filter((m: { shiftGroup: unknown }) =>Number(m.shiftGroup)===g.id),present=members.filter((m: { onDuty: unknown; onLeave: unknown; absenceRemainingDays: unknown }) =>m.onDuty&&!m.onLeave&&!m.absenceRemainingDays).length;
      const leave=members.filter((m: { onLeave: unknown }) =>m.onLeave).length,abs=members.filter((m: { absenceRemainingDays: unknown }) =>m.absenceRemainingDays).length;
      return `<article class="staff-shift-card ${htmlText(g.id===currentShift.id?'is-current':'')}"><header><b>${htmlText(g.label)}</b><span>${g.hours}</span></header><strong>${members.length}</strong><small>${present} en service · ${leave} congé(s) · ${abs} absence(s)</small>${g.id===currentShift.id?'<em>ÉQUIPE ACTIVE</em>':''}</article>`;
    }).join('');

    const leaveRows=this.staff.filter((m: __S3Struct981) =>m.onLeave||m.absenceRemainingDays||m.nextLeaveDate).sort((a: __S3Struct982,b: __S3Struct983)=>String(a.nextLeaveDate||'9999').localeCompare(String(b.nextLeaveDate||'9999'))).slice(0,80).map((m) =>{
      const state=m.onLeave?`Congé · ${m.leaveRemainingDays} j`:m.absenceRemainingDays?`${HR_INCIDENT_TYPES[m.absenceType]?.label||'Absence'} · ${m.absenceRemainingDays} j`:`Prochain congé ${m.nextLeaveDate||'—'}`;
      return `<div class="staff-leave-row"><div><b>${esc(m.name)}</b><small>${esc(ROLES[m.role]?.label||m.role)} · ${esc(targetName(m))}</small></div><span>${esc(state)}</span><span>Solde : ${htmlText(Math.max(0,Number(m.leaveDaysRemaining||0)))} j</span></div>`;
    }).join('')||'<div class="staff-empty">Aucun congé/absence planifié pour le moment.</div>';

    const events=this.hrEvents.slice().reverse().slice(0,30).map((e: { date: unknown; title: unknown; detail: unknown }) =>`<div class="staff-event-row"><span>${esc(e.date||'')}</span><div><b>${esc(e.title||'Événement RH')}</b><small>${esc(e.detail||'')}</small></div></div>`).join('')||'<div class="staff-empty">Aucun incident RH enregistré.</div>';

    const overview=`
      <div class="staff-overview-grid">
        <section class="staff-panel"><div class="staff-section-title"><div><h3>Couverture opérationnelle</h3><p>Les affectations sont automatiques. Les lieux restent fixes ; les équipes A/B/C se relaient toutes les 8 heures.</p></div><span>${esc(currentShift.label)} · ${currentShift.hours}</span></div>
          <div class="staff-shift-grid">${shiftCards}</div>
        </section>
        <section class="staff-panel"><div class="staff-section-title"><div><h3>Alertes RH</h3><p>Congés, absences, sous-effectifs et licenciements programmés.</p></div></div>
          <div class="staff-alert-list">
            ${unassigned?`<div class="staff-alert warn"><b>${unassigned}</b><span>agent(s) sans affectation compatible</span></div>`:''}
            ${onLeave?`<div class="staff-alert info"><b>${onLeave}</b><span>agent(s) en congé</span></div>`:''}
            ${absent?`<div class="staff-alert danger"><b>${absent}</b><span>absence(s) / incident(s) RH</span></div>`:''}
            ${pendingDismissal?`<div class="staff-alert danger"><b>${pendingDismissal}</b><span>licenciement(s) en attente de fin de service/tâche</span></div>`:''}
            ${inTraining?`<div class="staff-alert info"><b>${inTraining}</b><span>agent(s) actuellement en formation</span></div>`:''}
            ${!unassigned&&!onLeave&&!absent&&!pendingDismissal?'<div class="staff-alert ok"><b>OK</b><span>Aucune alerte RH immédiate</span></div>':''}
          </div>
        </section>
      </div>
      <section class="staff-panel staff-payroll-summary"><div class="staff-section-title"><div><h3>Paie & satisfaction</h3><p>Le versement est exécuté à 00:00 une seule fois par date de jeu, y compris après rechargement.</p></div><span>${htmlText(lastPayroll?`Dernière paie ${(lastPayroll.date||'')} · ${Number(lastPayroll.amount||0).toLocaleString('fr-FR')} €`:'Aucune paie enregistrée')}</span></div><div class="staff-payroll-grid"><div><span>Masse salariale / jour</span><b>${this.getDailySalaryExpense().toLocaleString('fr-FR')} €</b></div><div><span>Satisfaction moyenne</span><b>${Math.round(avgSatisfaction)} / 100</b></div><div><span>En formation</span><b>${inTraining}</b></div></div></section>
      <section class="staff-panel"><div class="staff-section-title"><div><h3>Derniers événements RH</h3><p>Ce journal permet de vérifier que paie, congés, formations, absences et licenciements se déclenchent réellement.</p></div></div><div class="staff-event-list">${events}</div></section>`;

    const hirePanel=`
      <section class="staff-panel staff-hire-panel">
        <div class="staff-section-title"><div><h3>Embaucher</h3><p>L'affectation initiale est facultative : sinon le jeu place automatiquement le salarié sur un besoin compatible.</p></div><span>Solde ${eco.formatAmount(eco.balance)}</span></div>
        <div class="staff-hire-grid">
          <label>Métier<select id="staff-hire-role">${roleKeys.map((k) => `<option value="${htmlText(k)}">${esc(ROLES[k].label)} — ${esc(ROLES[k].category||'')}</option>`).join('')}</select></label>
          <label>Affectation initiale<select id="staff-hire-target"><option value="">Automatique</option></select></label>
          <label>Nom (optionnel)<input type="text" id="staff-hire-name" placeholder="Généré automatiquement si vide"></label>
          <label>Nationalité<select id="staff-hire-nat"><option value="">Aléatoire</option><option value="fr">FR</option><option value="de">DE</option><option value="ch">CH</option><option value="es">ES</option><option value="be">BE</option><option value="nl">NL</option><option value="it">IT</option><option value="cz">CZ</option></select></label>
          <label>Quantité<input type="number" id="staff-hire-qty" value="1" min="1" max="50"></label>
          <button id="staff-hire-btn" class="btn-primary">Embaucher</button>
        </div><p id="staff-role-desc" class="staff-role-description"></p>
      </section>
      <section class="staff-panel"><div class="staff-section-title"><div><h3>Catalogue des métiers</h3><p>Tous les postes d'exploitation, circulation et dépôts sont de vrais emplois utilisés par la simulation.</p></div></div><input id="staff-role-search" class="staff-search" placeholder="Rechercher mécanicien, nettoyage, essieux, régulation, conducteur…"><div class="staff-role-catalog">${roleCards}</div></section>`;

    const assignmentsPanel=`
      <section class="staff-panel staff-auto-panel"><div class="staff-section-title"><div><h3>Affectation automatique</h3><p>Le jeu répartit automatiquement le personnel disponible vers les dépôts, gares utilisées, zones, postes et trains. Il ne déplace jamais le matériel roulant.</p></div><span>Actualisation automatique toutes les 5 min de jeu</span></div><div class="staff-auto-actions"><button id="staff-auto-all" class="btn-primary">Réaffecter maintenant</button><button id="staff-auto-depots" class="btn-sm">Auto-affecter aux dépôts</button></div></section>
      ${depots.length?`<section class="staff-panel"><div class="staff-section-title"><div><h3>Équipes des dépôts</h3><p>Les opérations réservent seulement les spécialistes de l'équipe 3×8 actuellement disponible.</p></div></div><div class="staff-depot-summary-grid">${depotSummary}</div></section>`:''}
      <div class="staff-assignment-grid">${this._renderZonesSection()}${this._renderSignalBoxSection()}</div>`;

    const shiftsPanel=`
      <section class="staff-panel"><div class="staff-section-title"><div><h3>3×8</h3><p>Équipe A 00–08, B 08–16, C 16–00. Les conducteurs sont relevés au prochain point sûr si leur tranche se termine en ligne.</p></div><span>${esc(currentShift.label)} active</span></div><div class="staff-shift-grid">${shiftCards}</div></section>
      <section class="staff-panel"><div class="staff-section-title"><div><h3>Congés & absences</h3><p>25 jours/an par salarié. Les blocs de congés sont planifiés automatiquement et reportés si un conducteur est en ligne ou un agent engagé sur une opération.</p></div><span>${onLeave} en congé · ${absent} absent(s)</span></div><div class="staff-leave-list">${leaveRows}</div></section>`;

    const developmentRows=this.staff.map((m) =>{
      const def=ROLES[m.role]||{},training=Number(m.trainingRemainingDays||0)>0,options=this.getTrainingOptions(m);
      const search=norm([m.name,def.label,def.department,m.trainingLabel,'formation',m.satisfaction,m.skillLevel,this.getMemberSalary(m)].join(' '));
      return `<article class="staff-dev-card" data-staff-dev-search="${esc(search)}"><div class="staff-dev-identity"><b>${esc(m.name)}</b><small>${esc(def.label||m.role)} · ${esc(def.department||'')}</small></div><div class="staff-dev-metrics"><span>Salaire <b>${this.getMemberSalary(m)} €/j</b></span><span>Satisfaction <b>${htmlText(Math.round(Number(m.satisfaction??70)))}/100</b></span><span>Compétence <b>${htmlText(Math.round(Number(m.skillLevel??50)))}/100</b></span></div>${training?`<div class="staff-training-active"><b>En formation</b><span>${esc(m.trainingLabel||'Formation')} · ${m.trainingRemainingDays} j restant(s)</span></div>`:`<div class="staff-dev-controls"><label>Prime €<input class="staff-bonus-amount" data-staff-id="${esc(m.id)}" type="number" min="50" step="50" value="500"></label><button class="btn-sm staff-bonus-btn" data-staff-id="${esc(m.id)}">Verser prime</button><label>Augmentation<select class="staff-raise-pct" data-staff-id="${esc(m.id)}"><option value="5">+5 %</option><option value="10">+10 %</option><option value="15">+15 %</option><option value="20">+20 %</option></select></label><button class="btn-sm staff-raise-btn" data-staff-id="${esc(m.id)}">Augmenter</button><label>Formation<select class="staff-training-select" data-staff-id="${esc(m.id)}">${options.map((o) =>`<option value="${esc(o.id)}">${esc(o.label)} — ${o.days}j / ${o.cost.toLocaleString('fr-FR')} €</option>`).join('')}</select></label><button class="btn-sm staff-training-btn" data-staff-id="${esc(m.id)}" ${!options.length?'disabled':''}>Envoyer</button></div>`}</article>`;
    }).join('')||'<div class="staff-empty">Aucun salarié.</div>';
    const developmentPanel=`<section class="staff-panel"><div class="staff-section-title"><div><h3>Rémunération & formation</h3><p>Primes ponctuelles, augmentations individuelles et formation continue. Un agent en formation reste affecté à son établissement mais devient indisponible pendant la durée du cursus.</p></div><span>Satisfaction moyenne ${Math.round(avgSatisfaction)}/100</span></div><input id="staff-development-search" class="staff-search" placeholder="Rechercher un agent, métier ou formation…"><div class="staff-development-grid">${developmentRows}</div></section>`;

    const materialFamilies=tab==='authorizations'?this.getMaterialFamilyCatalogue(game):[];
    const familyOptions=materialFamilies.map((x: { family: unknown; count: unknown }) =>`<option value="${esc(x.family)}">${esc(x.family)} · ${x.count} fiche(s)</option>`).join('');
    const authDrivers=this.staff.filter((m) =>['conducteur','conducteur_manoeuvre'].includes(m.role));
    const currentDate=game._currentDate||this._lastHRDate||'';
    const authRows=authDrivers.map((m) =>{
      const def=ROLES[m.role]||{},auths=this.getMaterialAuthorizations(m,currentDate);
      const badges=auths.length?auths.map((a) =>`<span class="staff-auth-chip ${htmlText(a.valid?'valid':'expired')}"><b>${esc(a.family)}</b><small>${a.valid?(a.validUntil?`valide jusqu’au ${esc(a.validUntil)}`:'valide'):`expirée${a.validUntil?` le ${esc(a.validUntil)}`:''}`}</small></span>`).join(''):'<span class="staff-auth-empty">Aucune habilitation matériel</span>';
      const training=Number(m.trainingRemainingDays||0)>0;
      const search=norm([m.name,def.label,m.trainingLabel,...auths.map((a) =>a.family)].join(' '));
      return `<article class="staff-auth-card" data-staff-auth-search="${esc(search)}">
        <header><div><b>${esc(m.name)}</b><small>${esc(def.label||m.role)}</small></div><span>${auths.filter((a) =>a.valid).length} valide(s) · ${auths.filter((a) =>!a.valid).length} expirée(s)</span></header>
        <div class="staff-auth-chips">${badges}</div>
        ${training?`<div class="staff-training-active"><b>Indisponible — formation en cours</b><span>${esc(m.trainingLabel||'Formation')} · ${m.trainingRemainingDays} j restant(s)</span></div>`:
        `<div class="staff-auth-controls"><label>Famille matériel<input class="staff-material-family-input" data-staff-id="${esc(m.id)}" list="staff-material-family-list" placeholder="Ex. BB27000, BR185, Z50000"></label><button class="btn-primary staff-material-auth-btn" data-staff-id="${esc(m.id)}">Former / habiliter</button></div>`}
      </article>`;
    }).join('')||'<div class="staff-empty">Aucun conducteur embauché.</div>';
    const authorizationPanel=`<section class="staff-panel"><div class="staff-section-title"><div><h3>Habilitations matériel</h3><p>Une habilitation couvre toute une famille : BB27000 couvre toutes les BB 27000 correspondantes, quel que soit le numéro ou la livrée. Les rames à plusieurs engins moteurs exigent toutes les familles actives.</p></div><span>${materialFamilies.length} famille(s) détectée(s)</span></div>
      <div class="staff-auth-info"><b>Formation :</b> ${MATERIAL_AUTHORIZATION_RULES.trainingDays} j · ${MATERIAL_AUTHORIZATION_RULES.trainingCost.toLocaleString('fr-FR')} € · validité gameplay ${(MATERIAL_AUTHORIZATION_RULES.validityDays/365).toFixed(0)} ans. Une habilitation expirée doit être renouvelée.</div>
      <input id="staff-auth-search" class="staff-search" placeholder="Rechercher conducteur ou habilitation : BB27000, BR185, AGC…">
      <datalist id="staff-material-family-list">${familyOptions}</datalist>
      <div class="staff-auth-grid">${authRows}</div>
    </section>`;

    const rosterPanel=`
      <section class="staff-panel"><div class="staff-section-title"><div><h3>Effectifs</h3><p>Recherchez par nom, métier, dépôt, train, équipe, congé ou tâche.</p></div><span id="staff-visible-count">${totalStaff} agent(s)</span></div>
        <div class="staff-filter-bar"><input id="staff-global-search" class="staff-search" placeholder="Rechercher un agent, métier, dépôt, tâche, train, équipe, congé…"><select id="staff-department-filter"><option value="">Tous les services</option>${departments.map((x: unknown) =>`<option value="${esc(norm(x))}">${esc(x)}</option>`).join('')}</select><select id="staff-status-filter"><option value="">Tous les statuts</option><option value="free">Sans affectation</option><option value="assigned">En poste/service</option><option value="offshift">Hors service 3×8</option><option value="busy">En opération dépôt</option><option value="leave">En congé</option><option value="absent">Absent / incident RH</option><option value="resting">Repos conducteur</option><option value="training">En formation</option><option value="dismissal">Licenciement programmé</option></select></div>
        <div id="staff-roster">${roleKeys.map((role) => this._renderRoleSection(role, activeServices, stations, depots, game)).join('')}</div>
      </section>`;

    const optionalBanner=game?.realismSettings?.personnelRequired===true?'':`<div class="staff-optional-banner" style="margin-bottom:12px;padding:12px 14px;border:1px solid #2563eb55;background:#0b2447;border-radius:9px;color:#dbeafe"><b>Personnel facultatif</b> — mode simplifié actif. Aucun train ni travail dépôt ne sera bloqué par un manque d'agents. Activez le personnel contraignant dans Paramètres quand vous voulez gérer conducteurs, 3×8 et habilitations.</div>`;
    container.innerHTML = optionalBanner + `
      <div class="staff-page-head"><div><h2>Personnel</h2><p>Planification RH, affectation automatique, équipes 3×8, congés, habilitations matériel, incidents sociaux et métiers techniques.</p></div><div class="staff-live-shift"><span>Équipe active</span><b>${esc(currentShift.label)}</b><small>${currentShift.hours}</small></div></div>
      <div class="staff-kpis"><div><span>Total</span><b>${totalStaff}</b></div><div><span>En service maintenant</span><b>${onDuty}</b></div><div><span>Affectés</span><b>${assigned}</b></div><div><span>En congé</span><b>${onLeave}</b></div><div><span>Absents</span><b>${absent}</b></div><div><span>En opération dépôt</span><b>${busy}</b></div><div><span>Salaires / jour</span><b>${this.getDailySalaryExpense().toLocaleString('fr-FR')} €</b></div><div><span>Satisfaction moyenne</span><b>${Math.round(avgSatisfaction)}%</b></div><div><span>En formation</span><b>${inTraining}</b></div></div>
      <nav class="staff-tabs">
        ${[['overview','Vue générale'],['hire','Embauche & métiers'],['assignments','Affectations'],['shifts','3×8 & congés'],['development','Rémunération & formation'],['authorizations','Habilitations matériel'],['social','Social & incidents'],['roster','Effectifs']].map(([id,label])=>`<button class="staff-tab ${htmlText(tab===id?'active':'')}" data-staff-tab="${htmlText(id)}">${htmlText(label)}</button>`).join('')}
      </nav>
      <div class="staff-tab-content">
        ${tab==='overview'?overview:''}
        ${tab==='hire'?hirePanel:''}
        ${tab==='assignments'?assignmentsPanel:''}
        ${tab==='shifts'?shiftsPanel:''}
        ${tab==='development'?developmentPanel:''}
        ${tab==='authorizations'?authorizationPanel:''}
        ${tab==='social'?`<section class="staff-panel"><div class="staff-section-title"><div><h3>Incidents RH</h3><p>Journal des absences, congés et licenciements.</p></div></div><div class="staff-event-list">${events}</div></section><div id="staff-social-container"></div>`:''}
        ${tab==='roster'?rosterPanel:''}
      </div>`;

    const socialContainer = container.querySelector ? container.querySelector('#staff-social-container') : null;
    if (socialContainer && game.unions?.render) game.unions.render(socialContainer, game);
    this._bindEvents(container, game, eco);
  }

  _renderRoleSection(role: string, activeServices: StaffService[], stations: unknown, depots: unknown, game: { "_currentDate": unknown }) {
    const def = ROLES[role];
    const members = this.getByRole(role);
    if (members.length === 0) return '';
    const esc=(v: unknown) =>String(v??'').replace(/[&<>"']/g,(c) =>(({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as Record<string,string>)[c]));
    const norm=(v: unknown) =>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

    let targets=[];
    if(def.assignTo==='service')targets=activeServices.map((s) =>({id:s.id,label:s.name}));
    else targets=this._targetsForRole(role,game);
    const targetLabel=(m: { assignedTo: unknown }) =>{if(!m.assignedTo)return '—';const pool=targets.find((x: { id: unknown }) =>String(x.id)===String(m.assignedTo));return pool?.label||m.assignedTo;};
    const isDepot=def.assignTo==='depot'&&def.depotRole;

    const rows=members.map((m) =>{
      const assigned=!!m.assignedTo,busy=!!m.busyTaskId,group=STAFF_SHIFT_GROUPS[Number(m.shiftGroup)]||null;
      let status='Sans affectation',statusKey='free';
      if(m.pendingDismissal){status='Licenciement programmé';statusKey='dismissal';}
      else if(m.onLeave){status=`Congé · ${m.leaveRemainingDays} j`;statusKey='leave';}
      else if(m.absenceRemainingDays){status=`${HR_INCIDENT_TYPES[m.absenceType]?.label||'Absent'} · ${m.absenceRemainingDays} j`;statusKey='absent';}
      else if(m.trainingRemainingDays){status=`Formation · ${m.trainingRemainingDays} j`;statusKey='training';}
      else if(m.resting){status=`Repos · ${Math.ceil((m.restRemainingMin||0)/60)} h`;statusKey='resting';}
      else if(busy){status='En opération';statusKey='busy';}
      else if(assigned&&m.onDuty===false){status='Hors service';statusKey='offshift';}
      else if(assigned){status=isDepot?'Disponible au dépôt':(role==='conducteur'?'En service':'En poste');statusKey='assigned';}
      let activity='—';
      if(m.trainingRemainingDays)activity=m.trainingLabel||'Formation';
      else if(busy)activity=m.busyTaskLabel||'Opération dépôt';
      else if(role==='conducteur')activity=`${m.totalTrips||0} trajet(s) · ${Math.floor((m.shiftWorkedMin||0)/60)}h${String(Math.floor(m.shiftWorkedMin||0)%60).padStart(2,'0')} / 8h`;
      else if(role==='controleur')activity=`${m.totalFines||0} PV · ${(m.totalFineRevenue||0).toLocaleString('fr-FR')} €`;
      else if(isDepot&&assigned)activity=m.onDuty===false?'Relève hors tranche':'Disponible pour une opération du dépôt';
      else if(assigned)activity=m.onDuty===false?'Relève hors tranche 3×8':'Poste couvert';
      const shiftText=group?`${group.label} · ${group.hours}`:'Équipe à attribuer';
      const leaveText=`Congés ${Math.max(0,Number(m.leaveDaysRemaining||0))} j${m.nextLeaveDate?` · prochain ${m.nextLeaveDate}`:''}`;
      const payText=`${this.getMemberSalary(m)} €/j satisfaction ${Math.round(Number(m.satisfaction??70))} compétence ${Math.round(Number(m.skillLevel??50))}`;
      const authText=role==='conducteur'?this.getMaterialAuthorizations(m,game._currentDate||this._lastHRDate||'').map((a) =>a.family).join(' '):'';
      const search=norm([m.name,def.label,def.department,def.category,targetLabel(m),activity,status,shiftText,leaveText,payText,authText].join(' '));
      const memberTargets=role==='conducteur'
        ? targets.filter((t: __KPA177) =>{const svc=activeServices.find((x) =>String(x.id)===String(t.id));return svc&&this.canConductorDriveService(m,svc,game._currentDate||this._lastHRDate||'',game).ok;})
        : targets;
      const memberOptions=memberTargets.map((x: { id: unknown; label: unknown }) =>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('');
      const canImmediateFire=!busy&&!(role==='conducteur'&&assigned);
      const fireLabel=canImmediateFire?'Licencier':'Licencier fin tâche/service';
      return `<div class="staff-person-row" data-staff-search="${esc(search)}" data-staff-department="${esc(norm(def.department||''))}" data-staff-status="${htmlText(statusKey)}">
        <div><b>${esc(m.name)}</b><small>${esc(def.label)} · ${esc(def.category||'')}</small></div>
        <span class="staff-status ${htmlText(statusKey)}">${esc(status)}</span>
        <span class="staff-shift-cell"><b>${esc(shiftText)}</b><small>${esc(leaveText)}</small></span>
        <span>${esc(targetLabel(m))}</span>
        <span>${esc(activity)}</span>
        <span class="staff-actions">
          ${!assigned&&!busy?`<select class="staff-assign-select" data-staff-id="${esc(m.id)}"><option value="">${role==='conducteur'&&!memberTargets.length?'Aucun service habilité…':'Affecter…'}</option>${memberOptions}</select>`:''}
          ${assigned&&!busy&&role!=='conducteur'?`<button class="staff-unassign-btn btn-sm" data-staff-id="${esc(m.id)}">Désaffecter</button>`:''}
          ${!m.onLeave&&!m.absenceRemainingDays&&!m.trainingRemainingDays&&!busy&&!(role==='conducteur'&&assigned)?`<button class="staff-leave-btn btn-sm" data-staff-id="${esc(m.id)}" data-days="5">Congé 5j</button>`:''}
          <button class="staff-fire-btn btn-sm danger" data-staff-id="${esc(m.id)}" ${m.pendingDismissal?'disabled':''}>${htmlText(m.pendingDismissal?'Licenciement prévu':fireLabel)}</button>
        </span>
      </div>`;
    }).join('');
    const busyCount=members.filter((m: { busyTaskId: unknown }) =>m.busyTaskId).length,assignedCount=members.filter((m: { assignedTo: unknown }) =>m.assignedTo).length,onShiftCount=members.filter((m: { onDuty: unknown; onLeave: unknown; absenceRemainingDays: unknown }) =>m.onDuty&&!m.onLeave&&!m.absenceRemainingDays).length;
    return `<section class="staff-role-section" data-role-section="${esc(role)}"><header><div><h4>${esc(def.label)}</h4><small>${esc(def.department||'')} · ${esc(def.category||'')}</small></div><span>${members.length} total · ${assignedCount} affecté(s) · ${onShiftCount} en service${busyCount?` · ${busyCount} occupé(s)`:''}</span></header><div class="staff-roster-head"><span>Agent</span><span>Statut</span><span>3×8 / congés</span><span>Affectation</span><span>Activité</span><span>Actions</span></div>${rows}</section>`;
  }

  _renderZonesSection() {
    const regCoverage = this.zones.map((z: { id: unknown; name: unknown }) => {
      const cov = this.getZoneRegulatorCoverage(z.id);
      const ctrls = this.staff.filter((s: { role: unknown; assignedTo: unknown }) => s.role === 'controleur' && s.assignedTo === z.id);
      const ctrlCount = ctrls.length, ctrlOnDuty=ctrls.filter((s: { onDuty: unknown; onLeave: unknown; absenceRemainingDays: unknown }) =>s.onDuty!==false&&!s.onLeave&&!s.absenceRemainingDays).length;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${htmlText(z.name)}</span>
        <span style="font-size:10px">
          Régulateurs: <b style="color:${htmlText(cov.covered ? 'var(--green)' : '#ef4444')}">${cov.count}/3</b>
          ${cov.teamsCovered>=3 ? '(A/B/C)' : `(${cov.teamsCovered||0}/3 équipes)`} · en poste: <b>${cov.onDuty||0}</b>
          | Contrôleurs: <b>${ctrlCount}</b> · en poste: <b>${ctrlOnDuty}</b>
        </span>
        <button class="zone-del-btn btn-sm" data-zone-id="${htmlText(z.id)}" style="font-size:9px;background:#ef4444">Suppr.</button>
      </div>`;
    }).join('');

    return `
      <div class="dash-section">
        <h3>Zones de régulation</h3>
        <p style="font-size:10px;color:var(--text3);margin:0 0 6px">Chaque zone nécessite 3 régulateurs (3 × 8h = 24/7). Les contrôleurs montent aléatoirement dans les trains de leur zone.</p>
        <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center">
          <input type="text" id="zone-name-input" placeholder="Nom de la zone" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:160px">
          <button id="zone-add-btn" class="btn-primary" style="font-size:10px;padding:4px 10px">+ Zone</button>
        </div>
        ${regCoverage || '<div style="font-size:10px;color:var(--text3)">Aucune zone créée</div>'}
      </div>`;
  }

  _renderSignalBoxSection() {
    const sbList = this.signalBoxes.map((sb: { id: unknown; name: unknown; radiusKm: unknown }) => {
      const agents = this.staff.filter((s: { role: unknown; assignedTo: unknown }) => s.role === 'agent_circulation' && s.assignedTo === sb.id);
      const agentsOnDuty=agents.filter((s: { onDuty: unknown; onLeave: unknown; absenceRemainingDays: unknown }) =>s.onDuty!==false&&!s.onLeave&&!s.absenceRemainingDays).length;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${htmlText(sb.name)}</span>
        <span style="font-size:10px">Rayon: ${sb.radiusKm} km | Agents: <b>${agents.length}</b> · en poste: <b>${agentsOnDuty}</b></span>
        <button class="sb-del-btn btn-sm" data-sb-id="${htmlText(sb.id)}" style="font-size:9px;background:#ef4444">Suppr.</button>
      </div>`;
    }).join('');

    return `
      <div class="dash-section">
        <h3>Postes d'aiguillage</h3>
        <p style="font-size:10px;color:var(--text3);margin:0 0 6px">Placez des postes sur la carte pour gérer les tronçons d'une zone. Chaque poste nécessite au moins 1 agent de circulation.</p>
        <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="sb-name-input" placeholder="Nom du poste" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:130px">
          <input type="number" id="sb-radius-input" value="10" min="1" max="100" style="font-size:11px;padding:4px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:80px" title="Rayon (km)">
          <span style="font-size:9px;color:var(--text3)">km</span>
          <button id="sb-add-btn" class="btn-primary" style="font-size:10px;padding:4px 10px">+ Poste (clic carte)</button>
        </div>
        ${sbList || '<div style="font-size:10px;color:var(--text3)">Aucun poste</div>'}
      </div>`;
  }

  _bindEvents(container: HTMLElement, game: { "_currentDate": unknown; "saveState": (...args: unknown[]) => unknown; "timeOfDay": unknown; "_gameTime": unknown; "depotManager": { "getDepots": (...args: unknown[]) => unknown }; "ui": { "_selectedDepotPageId": unknown; "_depotPageTab": unknown; "switchPage": (...args: unknown[]) => unknown; "renderDepotsList": (...args: unknown[]) => unknown }; "_pendingSignalBox": unknown }, eco: Economy) {
    const roleSelect=container.querySelector('#staff-hire-role');
    const targetSelect=container.querySelector('#staff-hire-target');
    const descEl=container.querySelector('#staff-role-desc');
    const norm=(v: unknown) =>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

    container.querySelectorAll('.staff-tab').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{this._uiTab=btn.dataset.staffTab||'overview';this.render(container,game);}));

    const getTargets=(role: string)=>{
      const def=ROLES[role];if(!def)return [];
      // A newly hired conductor has no material licence yet. Keep initial
      // assignment automatic/empty; services become selectable on his roster
      // once an authorization has been obtained.
      if(def.assignTo==='service')return [];
      return this._targetsForRole(role,game);
    };
    const refreshHireRole=()=>{
      const role=roleSelect?.value||'conducteur',def=ROLES[role];
      if(descEl)descEl.textContent=def?.description||'';
      if(targetSelect){
        const targets=getTargets(role);
        const kind=def?.assignTo==='depot'?'dépôt':def?.assignTo==='station'?'gare':def?.assignTo==='service'?'service':def?.assignTo==='zone'?'zone':def?.assignTo==='signalbox'?"poste d'aiguillage":'affectation';
        targetSelect.innerHTML=`<option value="">Automatique</option>`+targets.map((x: { id: unknown; label: unknown }) =>`<option value="${htmlText(String(x.id).replace(/"/g,'&quot;'))}">${htmlText(String(x.label))}</option>`).join('');
        targetSelect.title=targets.length?`Affecter directement à un ${kind}`:`Aucun ${kind} disponible`;
      }
    };
    roleSelect?.addEventListener('change',refreshHireRole);refreshHireRole();

    container.querySelectorAll('.staff-pick-role').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{
      if(roleSelect){roleSelect.value=btn.dataset.role||'conducteur';refreshHireRole();roleSelect.focus();}
    }));

    const roleSearch=container.querySelector('#staff-role-search');
    roleSearch?.addEventListener('input',()=>{
      const q=norm(roleSearch.value);container.querySelectorAll('.staff-role-card').forEach((card: __S3Struct994) =>{card.style.display=!q||String(card.dataset.roleCardSearch||'').includes(q)?'':'none';});
    });

    const applyRosterFilter=()=>{
      const q=norm(container.querySelector('#staff-global-search')?.value||'');
      const department=container.querySelector('#staff-department-filter')?.value||'';
      const status=container.querySelector('#staff-status-filter')?.value||'';
      let visible=0;
      container.querySelectorAll('.staff-person-row').forEach((row: __S3Struct995) =>{
        const show=(!q||String(row.dataset.staffSearch||'').includes(q))&&(!department||row.dataset.staffDepartment===department)&&(!status||row.dataset.staffStatus===status);
        row.style.display=show?'':'none';if(show)visible++;
      });
      container.querySelectorAll('.staff-role-section').forEach((section) =>{
        const any=[...section.querySelectorAll('.staff-person-row')].some((r) =>r.style.display!=='none');section.style.display=any?'':'none';
      });
      const out=container.querySelector('#staff-visible-count');if(out)out.textContent=`${visible} agent(s) affiché(s)`;
    };
    container.querySelector('#staff-global-search')?.addEventListener('input',applyRosterFilter);
    container.querySelector('#staff-department-filter')?.addEventListener('change',applyRosterFilter);
    container.querySelector('#staff-status-filter')?.addEventListener('change',applyRosterFilter);

    const developmentSearch=container.querySelector('#staff-development-search');
    developmentSearch?.addEventListener('input',()=>{const q=norm(developmentSearch.value);container.querySelectorAll('.staff-dev-card').forEach((card: __S3Struct997) =>{card.style.display=!q||String(card.dataset.staffDevSearch||'').includes(q)?'':'none';});});
    container.querySelectorAll('.staff-bonus-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{const id=btn.dataset.staffId,input=container.querySelector(`.staff-bonus-amount[data-staff-id="${id}"]`),r=this.giveBonus(id,Number(input?.value||0),eco,game._currentDate||this._lastHRDate||'');if(!r.ok)return alert(r.reason||'Prime impossible');this.render(container,game);game.saveState();}));
    container.querySelectorAll('.staff-raise-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{const id=btn.dataset.staffId,sel=container.querySelector(`.staff-raise-pct[data-staff-id="${id}"]`),r=this.raiseSalary(id,Number(sel?.value||0),game._currentDate||this._lastHRDate||'');if(!r.ok)return alert(r.reason||'Augmentation impossible');this.render(container,game);game.saveState();}));
    container.querySelectorAll('.staff-training-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{const id=btn.dataset.staffId,sel=container.querySelector(`.staff-training-select[data-staff-id="${id}"]`),r=this.startTraining(id,sel?.value||'',eco,game._currentDate||this._lastHRDate||'');if(!r.ok)return alert(r.reason||'Formation impossible');this.render(container,game);game.saveState();}));

    const authSearch=container.querySelector('#staff-auth-search');
    authSearch?.addEventListener('input',()=>{const q=norm(authSearch.value);container.querySelectorAll('.staff-auth-card').forEach((card: __S3Struct998) =>{card.style.display=!q||String(card.dataset.staffAuthSearch||'').includes(q)?'':'none';});});
    container.querySelectorAll('.staff-material-auth-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{
      const id=btn.dataset.staffId,input=container.querySelector(`.staff-material-family-input[data-staff-id="${id}"]`);
      const r=this.startMaterialAuthorization(id,input?.value||'',eco,game._currentDate||this._lastHRDate||'');
      if(!r.ok)return alert(r.reason||'Habilitation impossible');
      this.render(container,game);game.saveState();
    }));

    container.querySelector('#staff-hire-btn')?.addEventListener('click', () => {
      const role = roleSelect?.value || 'conducteur';
      const name = container.querySelector('#staff-hire-name')?.value?.trim() || '';
      const nationality = container.querySelector('#staff-hire-nat')?.value || '';
      const qty = parseInt(container.querySelector('#staff-hire-qty')?.value) || 1;
      const assignedTo=targetSelect?.value||'';
      const result = this.hire(eco, name, role, { count: qty, nationality, generateEach: !name, assignedTo });
      if (result && result.length > 0) {
        if(!assignedTo)this.autoAssignAll(game);
        this._tickFixedShiftStates(Number(game.timeOfDay??game._gameTime??0)||0,game._currentDate||'',0);
        this.render(container, game); game.saveState();
      } else alert('Fonds insuffisants.');
    });

    container.querySelectorAll('.staff-assign-select').forEach((sel: __S3Struct999) => {
      sel.addEventListener('change', (e: Event & { target: HTMLSelectElement }) => {
        const staffId=e.target.dataset.staffId,targetId=e.target.value;
        if(targetId&&this.assign(staffId,targetId,game)){this.render(container,game);game.saveState();}
        else if(targetId&&this._lastAssignmentError)alert(this._lastAssignmentError);
      });
    });
    container.querySelectorAll('.staff-fire-btn').forEach((btn: HTMLButtonElement) => btn.addEventListener('click', () => {
      if(!confirm('Licencier ce salarié ? Si une tâche ou un service est en cours, le licenciement prendra effet à la relève.'))return;
      const r=this.requestFire(btn.dataset.staffId,game._currentDate||this._lastHRDate||'');
      if(!r.ok)return alert(r.reason||'Licenciement impossible.');
      if(r.pending)alert('Licenciement programmé : il prendra effet à la fin du service ou de l’opération en cours.');
      this.render(container,game);game.saveState();
    }));
    container.querySelectorAll('.staff-leave-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{
      const r=this.requestLeave(btn.dataset.staffId,Number(btn.dataset.days)||5,game._currentDate||this._lastHRDate||'');
      if(!r.ok)return alert(r.reason||'Congé impossible.');
      this.render(container,game);game.saveState();
    }));
    container.querySelectorAll('.staff-unassign-btn').forEach((btn: HTMLButtonElement) => btn.addEventListener('click', () => {
      if(!this.unassignStaff(btn.dataset.staffId))return alert('Impossible de désaffecter un agent engagé dans une opération ou un service.');
      this.render(container,game);game.saveState();
    }));
    container.querySelector('#staff-auto-all')?.addEventListener('click',()=>{const n=this.autoAssignAll(game);this._tickFixedShiftStates(Number(game.timeOfDay??game._gameTime??0)||0,game._currentDate||'',0);this.render(container,game);game.saveState();if(!n)alert('Toutes les affectations compatibles sont déjà couvertes.');});
    container.querySelector('#staff-auto-depots')?.addEventListener('click',()=>{const n=this.autoAssignDepotStaff(game.depotManager?.getDepots?.()||[]);this._tickFixedShiftStates(Number(game.timeOfDay??game._gameTime??0)||0,game._currentDate||'',0);if(!n)return alert('Aucun agent dépôt non affecté à répartir.');this.render(container,game);game.saveState();});
    container.querySelectorAll('.staff-open-depot').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{
      if(game.ui){game.ui._selectedDepotPageId=btn.dataset.depotId||'';game.ui._depotPageTab='staff';game.ui.switchPage?.('depots');game.ui.renderDepotsList?.();}
    }));

    container.querySelector('#zone-add-btn')?.addEventListener('click', () => {
      const name=container.querySelector('#zone-name-input')?.value.trim();this.addZone(name);this.render(container,game);game.saveState();
    });
    container.querySelectorAll('.zone-del-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{this.removeZone(btn.dataset.zoneId);this.render(container,game);game.saveState();}));
    container.querySelector('#sb-add-btn')?.addEventListener('click', () => {
      const name=container.querySelector('#sb-name-input')?.value.trim()||'';const radius=parseFloat(container.querySelector('#sb-radius-input')?.value)||10;game._pendingSignalBox={name,radiusKm:radius};alert("Cliquez sur la carte pour placer le poste d'aiguillage.");
    });
    container.querySelectorAll('.sb-del-btn').forEach((btn: HTMLButtonElement) =>btn.addEventListener('click',()=>{this.removeSignalBox(btn.dataset.sbId);this.render(container,game);game.saveState();}));
  }

  // Keep legacy conductors array in sync for backward compat
  _syncLegacy() {
    this.conductors = this.staff.filter((s: { role: unknown }) => s.role === 'conducteur').map((s: { id: unknown; name: unknown; assignedTo: unknown; resting: unknown; onLeave: unknown; absenceRemainingDays: unknown; pendingDismissal: unknown; trainingRemainingDays: unknown; onDuty: unknown; hireDate: unknown; totalTrips: unknown }) => ({
      id: s.id,
      name: s.name,
      assignedServiceId: s.assignedTo,
      available: !s.assignedTo && !s.resting && !s.onLeave && !s.absenceRemainingDays && !s.pendingDismissal && !s.trainingRemainingDays && s.onDuty !== false,
      hireDate: s.hireDate,
      totalTrips: s.totalTrips,
    }));
  }

  // Legacy API
  unassign(serviceId: unknown) { this.unassignByTarget(serviceId); }

  toSave() {
    return {
      materialAuthorizationSchemaVersion: 1,
      runtimeClock:{tick:this._lastTickTime,date:this._lastTickDate,workforceTick:this._lastWorkforceTickTime,workforceDate:this._lastWorkforceTickDate,autoAssign:this._lastAutoAssignKey},
      staff: this.staff.map((s: { "id": unknown; "name": unknown; "role": unknown; "nationality": unknown; "assignedTo": unknown; "resting": unknown; "onLeave": unknown; "absenceRemainingDays": unknown; "pendingDismissal": unknown; "trainingRemainingDays": unknown; "onDuty": unknown; "hireDate": unknown; "totalTrips": unknown; "totalFines": unknown; "totalFineRevenue": unknown; "shiftStartMin": unknown; "shiftWorkedMin": unknown; "restRemainingMin": unknown; "restType": unknown; "weeklyWorkMin": unknown; "lastWeeklyRestDate": unknown; "socialRisk": unknown; "busyTaskId": unknown; "busyTaskLabel": unknown; "shiftGroup": unknown; "leaveRemainingDays": unknown; "leaveDaysRemaining": unknown; "leaveYear": unknown; "nextLeaveDate": unknown; "leavePending": unknown; "absenceType": unknown; "weeklyRestDay": unknown; "weeklyDayOff": unknown; "shiftSessionKey": unknown; "satisfaction": unknown; "skillLevel": unknown; "totalBonuses": unknown; "trainingId": unknown; "trainingLabel": unknown; "trainingMaterialFamily": unknown }) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        nationality: s.nationality || '',
        assignedTo: s.assignedTo,
        available: !s.assignedTo && !s.resting && !s.onLeave && !s.absenceRemainingDays && !s.pendingDismissal && !s.trainingRemainingDays && s.onDuty !== false,
        hireDate: s.hireDate,
        totalTrips: s.totalTrips || 0,
        totalFines: s.totalFines || 0,
        totalFineRevenue: s.totalFineRevenue || 0,
        shiftStartMin: s.shiftStartMin ?? -1,
        shiftWorkedMin: s.shiftWorkedMin || 0,
        resting: s.resting || false,
        restRemainingMin: s.restRemainingMin || 0,
        restType: s.restType || null,
        weeklyWorkMin: s.weeklyWorkMin || 0,
        lastWeeklyRestDate: s.lastWeeklyRestDate || null,
        socialRisk: s.socialRisk || 0,
        busyTaskId: s.busyTaskId || '',
        busyTaskLabel: s.busyTaskLabel || '',
        shiftGroup: s.shiftGroup!==null&&s.shiftGroup!==''&&s.shiftGroup!==undefined&&[0,1,2].includes(Number(s.shiftGroup)) ? Number(s.shiftGroup) : null,
        onDuty: !!s.onDuty,
        onLeave: !!s.onLeave,
        leaveRemainingDays: Math.max(0,Math.floor(Number(s.leaveRemainingDays)||0)),
        leaveDaysRemaining: Math.max(0,Math.floor(Number(s.leaveDaysRemaining)||0)),
        leaveYear: Math.max(0,Math.floor(Number(s.leaveYear)||0)),
        nextLeaveDate: s.nextLeaveDate || '',
        leavePending: !!s.leavePending,
        absenceType: s.absenceType || '',
        absenceRemainingDays: Math.max(0,Math.floor(Number(s.absenceRemainingDays)||0)),
        pendingDismissal: !!s.pendingDismissal,
        weeklyRestDay: s.weeklyRestDay!==null&&s.weeklyRestDay!==''&&s.weeklyRestDay!==undefined&&Number.isInteger(Number(s.weeklyRestDay)) ? Math.max(0,Math.min(6,Number(s.weeklyRestDay))) : null,
        weeklyDayOff: !!s.weeklyDayOff,
        shiftSessionKey: s.shiftSessionKey || '',
        dailySalary: this.getMemberSalary(s),
        satisfaction: Math.max(0,Math.min(100,Number(s.satisfaction??70)||70)),
        skillLevel: Math.max(0,Math.min(100,Number(s.skillLevel??50)||50)),
        totalBonuses: Math.max(0,Number(s.totalBonuses||0)),
        trainingId: s.trainingId || '',
        trainingLabel: s.trainingLabel || '',
        trainingRemainingDays: Math.max(0,Math.floor(Number(s.trainingRemainingDays)||0)),
        materialAuthorizations: this.getMaterialAuthorizations(s,'').map((a) =>({family:a.family,obtainedDate:a.obtainedDate||'',validUntil:a.validUntil||''})),
        trainingMaterialFamily: normalizeMaterialFamily(s.trainingMaterialFamily||''),
      })),
      signalBoxes: this.signalBoxes,
      zones: this.zones,
      hrEvents: this.hrEvents.slice(-120),
      dismissalHistory: this.dismissalHistory.slice(-100),
      lastHRDate: this._lastHRDate || '',
      lastPayrollDate: this._lastPayrollDate || '',
      payrollHistory: this.payrollHistory.slice(-90),
      nextStaffId,
      // Legacy fields for backward compat
      conductors: this.conductors,
      baseSalary: this.baseSalary,
      hiringCost: this.hiringCost,
    };
  }

  reconcileAssignments({ services=[], stations=[], depots=[] }: Record<string, unknown> = {}) {
    const serviceIds=new Set((Array.isArray(services)?services:[]).map((x) =>String(x?.id||'')).filter(Boolean));
    const stationIds=new Set((Array.isArray(stations)?stations:[]).map((x) =>String(x?.id||'')).filter(Boolean));
    const depotIds=new Set((Array.isArray(depots)?depots:[]).filter((x) =>x?.built!==false).map((x) =>String(x?.id||'')).filter(Boolean));
    let released=0;
    for(const m of this.staff){
      if(!m?.assignedTo)continue;
      const id=String(m.assignedTo), target=ROLES[m.role]?.assignTo;
      const valid=target==='service'?serviceIds.has(id):target==='station'?stationIds.has(id):target==='depot'?depotIds.has(id):target==='zone'?this.zones.some((z: { id: unknown }) =>z.id===id):target==='signalbox'?this.signalBoxes.some((b: { id: unknown }) =>b.id===id):true;
      if(!valid){m.assignedTo=null;m.busyTaskId='';m.busyTaskLabel='';m.onDuty=false;m.available=!m.resting&&!m.onLeave&&!m.absenceRemainingDays&&!m.pendingDismissal;released++;}
    }
    this._syncLegacy();
    return released;
  }

  loadFromSave(s: __S3Struct1000) {
    if (!s || typeof s !== 'object') return;
    this._needsMaterialAuthMigration = Number(s.materialAuthorizationSchemaVersion||0) < 1;
    const finite=(v: unknown,fb=0,min=-Infinity,max=Infinity)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fb;};
    const source = Array.isArray(s.staff) && s.staff.length ? s.staff : (Array.isArray(s.conductors) ? s.conductors.map((c: { assignedServiceId?: unknown }) =>({...c,role:'conducteur',assignedTo:c.assignedServiceId||null})) : []);
    const seen=new Set();
    this.staff = source.filter((m: __S3Struct1001) =>m&&typeof m==='object'&&m.id&&!seen.has(String(m.id))&&seen.add(String(m.id))).map((m) => {
      const role = ROLES[m.role] ? m.role : 'conducteur';
      const resting = m.resting === true && finite(m.restRemainingMin,0,0,10080) > 0;
      const rawAssigned = m.assignedTo ?? m.assignedServiceId ?? null;
      const assignedTo = rawAssigned==null||rawAssigned==='' ? null : String(rawAssigned);
      return {
        id:String(m.id), name:String(m.name||ROLES[role].label).trim()||ROLES[role].label, role,
        nationality:typeof m.nationality==='string'?m.nationality:'', assignedTo,
        available:!assignedTo&&!resting, hireDate:finite(m.hireDate,Date.now(),0),
        totalTrips:Math.floor(finite(m.totalTrips,0,0)), totalFines:Math.floor(finite(m.totalFines,0,0)), totalFineRevenue:finite(m.totalFineRevenue,0,0),
        shiftStartMin:finite(m.shiftStartMin,-1,-1,1439), shiftWorkedMin:finite(m.shiftWorkedMin,0,0,1440),
        resting, restRemainingMin:resting?finite(m.restRemainingMin,0,0,10080):0,
        restType:resting&&['daily','weekly'].includes(m.restType)?m.restType:null,
        weeklyWorkMin:finite(m.weeklyWorkMin,0,0,10080),
        lastWeeklyRestDate:(()=>{const d=typeof m.lastWeeklyRestDate==='string'?m.lastWeeklyRestDate:'';if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;const [y,mo,da]=d.split('-').map(Number),ms=Date.UTC(y,mo-1,da);return new Date(ms).toISOString().slice(0,10)===d?d:null;})(),
        socialRisk:finite(m.socialRisk,0,0,100),
        busyTaskId:typeof m.busyTaskId==='string'?m.busyTaskId:'',
        busyTaskLabel:typeof m.busyTaskLabel==='string'?m.busyTaskLabel:'',
        shiftGroup:m.shiftGroup!==null&&m.shiftGroup!==''&&m.shiftGroup!==undefined&&[0,1,2].includes(Number(m.shiftGroup))?Number(m.shiftGroup):null,
        onDuty:m.onDuty===true || (!!assignedTo && m.onDuty!==false),
        onLeave:m.onLeave===true && finite(m.leaveRemainingDays,0,0,366)>0,
        leaveRemainingDays:finite(m.leaveRemainingDays,0,0,366),
        leaveDaysRemaining:finite(m.leaveDaysRemaining,25,0,60),
        leaveYear:Math.floor(finite(m.leaveYear,0,0,9999)),
        nextLeaveDate:(()=>{const d=typeof m.nextLeaveDate==='string'?m.nextLeaveDate:'';return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:'';})(),
        leavePending:m.leavePending===true,
        absenceType:HR_INCIDENT_TYPES[m.absenceType]?m.absenceType:'',
        absenceRemainingDays:finite(m.absenceRemainingDays,0,0,60),
        pendingDismissal:m.pendingDismissal===true,
        weeklyRestDay:m.weeklyRestDay!==null&&m.weeklyRestDay!==''&&m.weeklyRestDay!==undefined&&Number.isInteger(Number(m.weeklyRestDay))?Math.max(0,Math.min(6,Number(m.weeklyRestDay))):null,
        weeklyDayOff:m.weeklyDayOff===true,
        shiftSessionKey:typeof m.shiftSessionKey==='string'?m.shiftSessionKey:'',
        dailySalary:Math.max(1,Math.round(finite(m.dailySalary,ROLES[role].salary,1,100000))),
        satisfaction:finite(m.satisfaction,70,0,100),
        skillLevel:finite(m.skillLevel,50,0,100),
        totalBonuses:finite(m.totalBonuses,0,0,1e9),
        trainingId:STAFF_TRAINING_CATALOG[m.trainingId]?String(m.trainingId):'',
        trainingLabel:typeof m.trainingLabel==='string'?m.trainingLabel.slice(0,180):'',
        trainingRemainingDays:Math.floor(finite(m.trainingRemainingDays,0,0,365)),
        materialAuthorizations:(Array.isArray(m.materialAuthorizations)?m.materialAuthorizations:[]).map((a: { family: unknown; obtainedDate: unknown; validUntil: unknown }) =>{
          const family=normalizeMaterialFamily(a?.family||a);if(!family)return null;
          const obtainedDate=typeof a?.obtainedDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.obtainedDate)?a.obtainedDate:'';
          const validUntil=typeof a?.validUntil==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.validUntil)?a.validUntil:'';
          return {family,obtainedDate,validUntil};
        }).filter(Boolean).filter((a: __S3Struct1002,i: unknown,arr: __S3Struct1003)=>arr.findIndex((x: __S3Struct1004) =>x.family===a.family)===i),
        trainingMaterialFamily:normalizeMaterialFamily(m.trainingMaterialFamily||''),
      };
    });
    const boxSeen=new Set();
    this.signalBoxes=(Array.isArray(s.signalBoxes)?s.signalBoxes:[]).filter((x: { id: unknown }) =>x&&x.id&&!boxSeen.has(String(x.id))&&boxSeen.add(String(x.id))).map((x: { lat: unknown; lon: unknown; id: unknown; name: unknown; radiusKm: unknown; stationId: unknown; lineId: unknown }) =>{
      const lat=Number(x.lat),lon=Number(x.lon); if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)return null;
      return {id:String(x.id),name:String(x.name||'Poste').trim()||'Poste',lat,lon,radiusKm:finite(x.radiusKm,10,1,500),stationId:x.stationId==null?null:String(x.stationId),lineId:x.lineId==null?null:String(x.lineId)};
    }).filter(Boolean) as StaffSignalBox[];
    const zoneSeen=new Set();
    this.zones=(Array.isArray(s.zones)?s.zones:[]).filter((x: { id: unknown }) =>x&&x.id&&!zoneSeen.has(String(x.id))&&zoneSeen.add(String(x.id))).map((x: { lat: unknown; lon: unknown; id: unknown; name: unknown; radiusKm: unknown; lineId: unknown }) =>{
      const lat=x.lat==null?null:Number(x.lat),lon=x.lon==null?null:Number(x.lon);
      return {id:String(x.id),name:String(x.name||'Zone').trim()||'Zone',lat:typeof lat==='number'&&Number.isFinite(lat)&&lat>=-90&&lat<=90?lat:null,lon:typeof lon==='number'&&Number.isFinite(lon)&&lon>=-180&&lon<=180?lon:null,radiusKm:finite(x.radiusKm,30,1,1000),lineId:x.lineId==null?null:String(x.lineId)};
    });
    // Invalid non-driving assignments from malformed saves are released immediately.
    const zoneIds=new Set(this.zones.map((z: { id: unknown }) =>z.id)), boxIds=new Set(this.signalBoxes.map((b: { id: unknown }) =>b.id));
    for(const m of this.staff){
      if(['regulateur','controleur'].includes(m.role)&&m.assignedTo&&!zoneIds.has(m.assignedTo))m.assignedTo=null;
      if(m.role==='agent_circulation'&&m.assignedTo&&!boxIds.has(m.assignedTo))m.assignedTo=null;
      if(m.assignedTo||m.role==='conducteur')this._ensureShiftGroup(m,m.assignedTo||(m.role==='conducteur'?'conducteurs':''));
      m.available=!m.assignedTo&&!m.resting&&!m.onLeave&&!m.absenceRemainingDays&&!m.pendingDismissal&&!m.trainingRemainingDays;
    }
    this.hrEvents=(Array.isArray(s.hrEvents)?s.hrEvents:[]).filter((e: unknown) =>e&&typeof e==='object').slice(-120).map((e: { id: unknown; date: unknown; type: unknown; staffId: unknown; title: unknown; detail: unknown }) =>({id:String(e.id||''),date:String(e.date||''),type:String(e.type||'info'),staffId:String(e.staffId||''),title:String(e.title||'Événement RH').slice(0,180),detail:String(e.detail||'').slice(0,500)}));
    this.dismissalHistory=(Array.isArray(s.dismissalHistory)?s.dismissalHistory:[]).filter((e: unknown) =>e&&typeof e==='object').slice(-100).map((e: { date: unknown; staffId: unknown; name: unknown; role: unknown }) =>({date:String(e.date||''),staffId:String(e.staffId||''),name:String(e.name||''),role:String(e.role||'')}));
    this._lastHRDate=typeof s.lastHRDate==='string'?s.lastHRDate:'';
    this._lastPayrollDate=typeof s.lastPayrollDate==='string'?s.lastPayrollDate:'';
    this.payrollHistory=(Array.isArray(s.payrollHistory)?s.payrollHistory:[]).filter((x: unknown) =>x&&typeof x==='object').slice(-90).map((x: { date: unknown; amount: unknown; count: unknown }) =>({date:String(x.date||''),amount:finite(x.amount,0,0,1e12),count:Math.floor(finite(x.count,0,0,100000))}));
    this.baseSalary=finite(s.baseSalary,120,0); this.hiringCost=finite(s.hiringCost,2000,0);
    const savedNext=Math.floor(finite(s.nextStaffId,1,1)); nextStaffId=Math.max(1,savedNext);
    for(const m of this.staff){const n=parseInt(String(m.id).replace(/^staff-/,''),10);if(Number.isFinite(n)&&n>=nextStaffId)nextStaffId=n+1;}
    const clock=s.runtimeClock && typeof s.runtimeClock==='object' ? s.runtimeClock as Record<string,unknown> : {};
    const minute=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<1440?v:null;
    const date=(v:unknown)=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
    this._lastTickTime=minute(clock.tick);this._lastTickDate=date(clock.date);
    this._lastWorkforceTickTime=minute(clock.workforceTick);this._lastWorkforceTickDate=date(clock.workforceDate);
    this._lastAutoAssignKey=typeof clock.autoAssign==='string'?clock.autoAssign.slice(0,60):'';
    this._syncLegacy();
  }
}


// S3_STRUCT_V2_TEMP
type __S3Struct965 = { "role": unknown };
type __S3Struct966 = { "role": unknown };
type __S3Struct975 = { "state": string; "rame": { "totalCapacity": number } };
type __S3Struct981 = { "onLeave": unknown; "absenceRemainingDays": unknown; "nextLeaveDate": string };
type __S3Struct982 = { "nextLeaveDate": string };
type __S3Struct983 = { "nextLeaveDate": string };
type __S3Struct992 = { "id": string };
type __S3Struct994 = { "style": { "display": unknown }; "dataset": { "roleCardSearch": unknown } };
type __S3Struct995 = { "dataset": { "staffSearch": unknown; "staffDepartment": unknown; "staffStatus": string }; "style": { "display": unknown } };
type __S3Struct997 = { "style": { "display": unknown }; "dataset": { "staffDevSearch": unknown } };
type __S3Struct998 = { "style": { "display": unknown }; "dataset": { "staffAuthSearch": unknown } };
type __S3Struct999 = { "addEventListener": (...args: unknown[]) => unknown };
type __S3Struct1000 = { runtimeClock?:unknown; "materialAuthorizationSchemaVersion": unknown; "staff": unknown; "conductors": Array<{ assignedServiceId?: unknown; [key: string]: unknown }>; "signalBoxes": unknown; "zones": unknown; "hrEvents": unknown; "dismissalHistory": unknown; "lastHRDate": string; "lastPayrollDate": string; "payrollHistory": unknown; "baseSalary": unknown; "hiringCost": unknown; "nextStaffId": string };
type __S3Struct1001 = { "id": string };
type __S3Struct1002 = { "family": unknown };
type __S3Struct1003 = { "findIndex": (...args: unknown[]) => unknown };
type __S3Struct1004 = { "family": unknown };
