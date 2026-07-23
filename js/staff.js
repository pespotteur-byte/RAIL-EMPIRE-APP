/**
 * Staff Management — Multi-role personnel for Rail Empire.
 */
import { icon } from './icons.js';
import { haversineDistance, timeDiff } from './simulation.js?v=1784772843';
import { getGlobalRng } from './rng.js?v=1784772843';
import { alertToast } from './html-utils.js?v=1784772843';

let nextStaffId = 1;

// RH-01 — noms aléatoires par nationalité
const NATIONALITY_NAMES = {
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

const ROLES = {
  conducteur:           { label: 'Conducteur',              salary: 120, hiringCost: 2000, assignTo: 'service', description: 'Pilote les trains. Service en 3×8 (8h) avec repos de 8h et 24h hebdomadaire obligatoires.' },
  conducteur_manoeuvre:  { label: 'Conducteur de manœuvre',  salary: 100, hiringCost: 1500, assignTo: 'depot', description: 'Effectue les manoeuvres et les remontées en dépôt/ITE.' },
  agent_gare:           { label: 'Agent en gare',           salary: 90,  hiringCost: 1000, assignTo: 'station', description: 'Gère l\'accueil, la sécurité quai et l\'information voyageurs en gare.' },
  agent_maintenance:    { label: 'Agent de maintenance',    salary: 110, hiringCost: 1800, assignTo: 'depot', description: 'Répare et entretient le matériel roulant au dépôt le plus proche.' },
  controleur:           { label: 'Contrôleur',              salary: 100, hiringCost: 1500, assignTo: 'zone', description: 'Contrôle les billets dans les trains de sa zone et verbalise les fraudeurs.' },
  regulateur:           { label: 'Régulateur',              salary: 150, hiringCost: 3000, assignTo: 'zone', description: 'Organise la circulation sur une zone. Il faut 3 régulateurs par zone pour une couverture 24/7.' },
  agent_circulation:    { label: 'Agent de circulation',    salary: 130, hiringCost: 2500, assignTo: 'signalbox', description: 'Gère les postes d\'aiguillage et le cantonnement sur un tronçon.' },
};

export { ROLES as STAFF_ROLES };

export class StaffManager {
  constructor() {
    this.staff = [];          // all personnel
    this.signalBoxes = [];    // { id, name, lat, lon, radiusKm, stationId? }
    this.zones = [];          // { id, name } for regulateurs/controleurs
    // Legacy compat
    this.conductors = [];
    this.baseSalary = 120;
    this.hiringCost = 2000;
  }

  // ── Hire ──
  // RH-01 : embauche multiple + noms aléatoires par nationalité quand non fourni.
  hire(economy, name, role, opts = {}) {
    role = role || 'conducteur';
    const def = ROLES[role];
    if (!def) return null;
    const count = Math.max(1, Math.min(100, parseInt(opts.count) || 1));
    const totalCost = def.hiringCost * count;
    if (!economy || economy.balance < totalCost) return null;

    const hired = [];
    for (let i = 0; i < count; i++) {
      const generatedName = !name || opts.generateEach ? this.generateRandomName(opts.nationality) : null;
      const memberName = name && !opts.generateEach ? name : (generatedName || `${def.label} ${this.getByRole(role).length + 1}`);
      const member = {
        id: `staff-${nextStaffId++}`,
        name: memberName,
        role,
        nationality: generatedName ? (opts.nationality || this._lastGeneratedNationality) : '',
        assignedTo: null,
        available: true,
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
      };

      economy.addExpense(def.hiringCost, 'personnel', `Embauche: ${member.name} (${def.label})`);
      this.staff.push(member);
      hired.push(member);
    }
    this._syncLegacy();
    return hired;
  }

  generateRandomName(preferredNationality) {
    const rng = getGlobalRng();
    const nats = preferredNationality ? [preferredNationality] : Object.keys(NATIONALITY_NAMES);
    const nat = nats[Math.floor(rng.random() * nats.length)];
    this._lastGeneratedNationality = nat;
    const pool = NATIONALITY_NAMES[nat];
    const first = pool.first[Math.floor(rng.random() * pool.first.length)];
    const last = pool.last[Math.floor(rng.random() * pool.last.length)];
    return `${first} ${last}`;
  }

  // ── Fire ──
  fire(staffId) {
    const idx = this.staff.findIndex(s => s.id === staffId);
    if (idx === -1) return false;
    const s = this.staff[idx];
    if (s.assignedTo) return false;
    this.staff.splice(idx, 1);
    this._syncLegacy();
    return true;
  }

  // ── Assign ──
  assign(staffId, targetId) {
    const s = this.staff.find(s => s.id === staffId);
    if (!s || !s.available) return false;
    s.assignedTo = targetId;
    s.available = false;
    this._syncLegacy();
    return true;
  }

  unassignByTarget(targetId) {
    for (const s of this.staff) {
      if (s.assignedTo === targetId) {
        s.assignedTo = null;
        s.available = true;
        if (s.role === 'conducteur') s.totalTrips++;
      }
    }
    this._syncLegacy();
  }

  // ── Queries ──
  getByRole(role) { return this.staff.filter(s => s.role === role); }
  getAvailableByRole(role) { return this.staff.filter(s => s.role === role && !s.assignedTo); }
  getAssignedTo(targetId) { return this.staff.filter(s => s.assignedTo === targetId); }

  hasAssignedConductor(serviceId) {
    if (this.getByRole('conducteur').length === 0) return true;
    return this.staff.some(s => s.role === 'conducteur' && s.assignedTo === serviceId);
  }

  getAvailable() { return this.getAvailableByRole('conducteur'); }

  // ── Auto-assignment of conductors ──
  // RH-03 : 8h entre services ; RH-03/04 : repos 24h/semaine sinon risque social.
  tickConductors(activeServices, timeOfDay, dateStr = '') {
    const conducteurs = this.getByRole('conducteur');
    if (conducteurs.length === 0) return;

    // Avoid processing the same minute twice and handle fast-forward jumps
    if (this._lastTickTime == null) this._lastTickTime = timeOfDay;
    let delta = 0;
    if (timeOfDay >= this._lastTickTime) delta = timeOfDay - this._lastTickTime;
    else delta = (1440 - this._lastTickTime) + timeOfDay; // day wrap
    this._lastTickTime = timeOfDay;
    this._lastTickDate = dateStr;
    if (delta <= 0) return;

    const SHIFT_DURATION = 480; // 8h
    const DAILY_REST = 480;     // 8h
    const WEEKLY_REST = 1440;   // 24h
    const WEEKLY_WORK_LIMIT = 6 * SHIFT_DURATION; // 48h over a week

    for (const c of conducteurs) {
      // Handle resting conductors
      if (c.resting) {
        c.restRemainingMin -= delta;
        if (c.restRemainingMin <= 0) {
          c.resting = false;
          c.shiftWorkedMin = 0;
          c.shiftStartMin = -1;
          c.shiftOverdue = false;
          if (c.restType === 'weekly') {
            c.weeklyWorkMin = 0;
            c.lastWeeklyRestDate = dateStr;
          }
          c.restType = null;
        }
        continue;
      }

      // If assigned, track shift time while driving or waiting with a service
      if (c.assignedTo) {
        const svc = activeServices.find(s => s.id === c.assignedTo);
        const isWithTrain = svc && (svc.state === 'moving' || svc.state === 'waiting' || svc.state === 'stopped_at_station');
        if (isWithTrain) {
          if (c.shiftStartMin < 0) c.shiftStartMin = timeOfDay;
          // Count driving time toward the 8h shift; waiting time does not extend the shift indefinitely
          if (svc.state === 'moving') {
            c.shiftWorkedMin += delta;
            c.weeklyWorkMin += delta;
          }
        }

        const weeklyOverdue = this._isWeeklyRestOverdue(c, dateStr, WEEKLY_WORK_LIMIT);
        const shiftOverdue = c.shiftWorkedMin >= SHIFT_DURATION;

        // RH-03/04 — accumulate social risk if 3-8 rules are violated
        if (weeklyOverdue || shiftOverdue) {
          c.socialRisk = Math.min(100, c.socialRisk + 0.05 * delta);
        } else {
          c.socialRisk = Math.max(0, c.socialRisk - 0.01 * delta);
        }

        // Service completed => release conductor and start mandatory rest
        if (svc && svc.completed) {
          c.assignedTo = null;
          c.available = true;
          c.totalTrips++;
          c.shiftOverdue = false;
          this._startRest(c, dateStr, DAILY_REST, WEEKLY_REST, WEEKLY_WORK_LIMIT);
          continue;
        }

        // If the train is stopped/waiting and the conductor has reached 8h or is overdue for weekly rest,
        // release the conductor so a relief can take over, then start rest.
        if (shiftOverdue || weeklyOverdue) {
          if (!svc || svc.state !== 'moving') {
            c.assignedTo = null;
            c.available = true;
            c.totalTrips++;
            c.shiftOverdue = false;
            this._startRest(c, dateStr, DAILY_REST, WEEKLY_REST, WEEKLY_WORK_LIMIT);
          } else {
            // Still driving: flag overdue but continue until the train stops
            c.shiftOverdue = true;
          }
        }
        continue;
      }

      // Available conductor: try to take another service within the same shift
      if (c.shiftWorkedMin < SHIFT_DURATION && !c.resting && !c.shiftOverdue) {
        const needsConductor = activeServices.filter(svc => {
          if (!svc.active || svc.completed) return false;
          if (svc.state !== 'waiting' && svc.state !== 'stopped_at_station') return false;
          return !conducteurs.some(cc => cc.assignedTo === svc.id);
        });

        if (needsConductor.length > 0) {
          const rng = getGlobalRng();
          const pick = needsConductor[Math.floor(rng.random() * needsConductor.length)];
          c.assignedTo = pick.id;
          c.available = false;
          if (c.shiftStartMin < 0) c.shiftStartMin = timeOfDay;
        }
      }
    }
    this._syncLegacy();
  }

  _startRest(c, dateStr, dailyRest, weeklyRest, weeklyWorkLimit) {
    c.resting = true;
    c.restRemainingMin = this._isWeeklyRestOverdue(c, dateStr, weeklyWorkLimit) ? weeklyRest : dailyRest;
    c.restType = c.restRemainingMin === weeklyRest ? 'weekly' : 'daily';
    if (c.restType === 'weekly') {
      c.weeklyWorkMin = 0;
      c.lastWeeklyRestDate = dateStr;
    }
  }

  _isWeeklyRestOverdue(c, dateStr, weeklyWorkLimit) {
    if (!dateStr) return false;
    if (c.lastWeeklyRestDate == null || c.weeklyWorkMin >= weeklyWorkLimit) return true;
    const days = this._daysBetween(c.lastWeeklyRestDate, dateStr);
    return days >= 6;
  }

  _daysBetween(a, b) {
    const parse = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    try { return Math.floor((parse(b) - parse(a)) / 86400000); } catch { return 0; }
  }

  // ── Signal Boxes ──
  addSignalBox(data) {
    const sb = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name: data.name || `Poste ${this.signalBoxes.length + 1}`,
      lat: data.lat,
      lon: data.lon,
      radiusKm: data.radiusKm || 10,
      stationId: data.stationId || null,
      lineId: data.lineId || null,
    };
    this.signalBoxes.push(sb);
    return sb;
  }

  removeSignalBox(id) {
    // Unassign agents first
    for (const s of this.staff) {
      if (s.role === 'agent_circulation' && s.assignedTo === id) s.assignedTo = null;
    }
    this.signalBoxes = this.signalBoxes.filter(sb => sb.id !== id);
  }

  getSignalBoxById(id) { return this.signalBoxes.find(sb => sb.id === id); }

  // ── Zones ──
  addZone(name, lat, lon, radiusKm, lineId) {
    const z = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name: name || `Zone ${this.zones.length + 1}`,
      lat: lat || null,
      lon: lon || null,
      radiusKm: radiusKm || 30,
      lineId: lineId || null,
    };
    this.zones.push(z);
    return z;
  }

  removeZone(id) {
    for (const s of this.staff) {
      if ((s.role === 'regulateur' || s.role === 'controleur') && s.assignedTo === id) s.assignedTo = null;
    }
    this.zones = this.zones.filter(z => z.id !== id);
  }

  // ── Contrôleur logic ──
  tickControleurs(economy, activeServices, gameTimeMin) {
    const controleurs = this.staff.filter(s => s.role === 'controleur' && s.assignedTo);
    const hasControleur = controleurs.length > 0;
    const effectiveFraudRate = economy.getEffectiveFraudRate(hasControleur);

    const paxServices = activeServices.filter(s =>
      s.state === 'moving' && s.rame && s.rame.totalCapacity > 0
    );
    if (paxServices.length === 0) return;

    if (!hasControleur) return;

    const rng = getGlobalRng();
    for (const ctrl of controleurs) {
      if (rng.random() > 0.033) continue;
      const svc = paxServices[Math.floor(rng.random() * paxServices.length)];
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
  getZoneRegulatorCoverage(zoneId) {
    const regs = this.staff.filter(s => s.role === 'regulateur' && s.assignedTo === zoneId);
    // Need 3 regulators for 24/7 coverage (3 × 8h shifts)
    return { count: regs.length, needed: 3, covered: regs.length >= 3 };
  }

  // REG-01/02/04 : détermine si un point est couvert par une zone régulateur + AC
  // stationIds/lineIds permettent le découpage par axe (REG-04) sans dépendre du rayon
  getRegulationEffects(lat, lon, stationIds = [], lineIds = []) {
    if (lat == null || lon == null) return { regulator: null, signalBox: null };
    const stationSet = new Set(stationIds);
    const lineSet = new Set(lineIds);
    const effects = { regulator: null, signalBox: null };
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
      const agents = this.staff.filter(s => s.role === 'agent_circulation' && s.assignedTo === sb.id);
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

  // REG-03 — le jeu décide de l'ordre de passage / garage en gare
  tickRegulateurs(activeServices, timeOfDay, dateStr, realismSettings) {
    const tolerance = realismSettings?.delayTolerance || 30;
    const stationQueues = new Map();
    for (const svc of activeServices) {
      if (!svc.active || svc.completed || svc.cancelled) continue;
      if (svc.state !== 'waiting' && svc.state !== 'stopped_at_station') continue;
      const stops = svc.getCurrentStops ? svc.getCurrentStops() : svc.stops;
      const stopIndex = svc.state === 'waiting' ? svc.currentStopIndex : Math.max(0, svc.currentStopIndex - 1);
      const next = stops?.[stopIndex];
      if (!next) continue;
      const dep = next.departureTime ?? next.arrivalTime ?? 0;
      // Retard calculé à la minute actuelle (pas le svc.delay du tick précédent)
      const delay = Math.max(0, timeDiff(timeOfDay, dep));
      if (!stationQueues.has(next.stationId)) stationQueues.set(next.stationId, []);
      stationQueues.get(next.stationId).push({ svc, dep, delay, type: svc.serviceType || 'passager' });
    }
    for (const [stationId, queue] of stationQueues) {
      queue.sort((a, b) => {
        if (a.type !== b.type) {
          // priorité voyageur > fret > travaux
          const order = { passager: 0, fret: 1, w: 1, work: 2, hlp: 3, tm: 3, evo: 4, m: 4 };
          return (order[a.type] ?? 5) - (order[b.type] ?? 5);
        }
        return a.dep - b.dep;
      });
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        item.svc._regulationPriority = i;
        const maxWait = (item.type === 'passager') ? 60 : 120;
        if (item.delay > tolerance && i > 0) {
          // train en retard et non prioritaire -> garage temporaire
          item.svc._garageUntil = timeOfDay + Math.min(item.delay, maxWait);
          item.svc.train.delayReason = 'regulation : garage temporaire';
        } else {
          item.svc._garageUntil = null;
          if (item.svc.train.delayReason === 'regulation : garage temporaire') item.svc.train.delayReason = '';
        }
      }
    }
  }

  // ── Daily salaries ──
  getDailySalaryExpense() {
    let total = 0;
    for (const s of this.staff) {
      const def = ROLES[s.role];
      total += def ? def.salary : 120;
    }
    return total;
  }

  processDailySalaries(economy) {
    const byRole = {};
    for (const s of this.staff) {
      const role = s.role || 'conducteur';
      if (!byRole[role]) byRole[role] = 0;
      byRole[role]++;
    }
    for (const [role, count] of Object.entries(byRole)) {
      const def = ROLES[role];
      if (!def) continue;
      const amount = count * def.salary;
      if (amount > 0) {
        economy.addExpense(amount, 'salaires', `Salaires: ${count} ${def.label}(s) × ${def.salary}€`);
      }
    }
  }

  // ── Render ──
  render(container, game) {
    if (!container) return;
    const eco = game.economy;
    const activeServices = game.scheduleCreator?.getActiveServices() || [];
    const stations = game.world?.stations || [];
    const depots = game.depotManager?.depots || game.depotManager?.getAll?.() || [];

    // KPIs
    const totalStaff = this.staff.length;
    const assigned = this.staff.filter(s => s.assignedTo).length;
    const resting = this.staff.filter(s => s.resting).length;
    const available = totalStaff - assigned - resting;

    // Role tabs
    const roleKeys = Object.keys(ROLES);
    const roleCounts = {};
    for (const k of roleKeys) roleCounts[k] = this.getByRole(k).length;

    container.innerHTML = `
      <div class="dash-section">
        <h3>Gestion du Personnel</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Total</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${totalStaff}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Disponibles</div>
            <div class="dash-kpi-value" style="color:var(--green)">${available}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">En poste</div>
            <div class="dash-kpi-value" style="color:#f97316">${assigned}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Au repos</div>
            <div class="dash-kpi-value" style="color:#ef4444">${resting}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Salaires / jour</div>
            <div class="dash-kpi-value" style="color:#facc15">${this.getDailySalaryExpense().toLocaleString('fr-FR')} &euro;</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Embaucher</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="staff-hire-role" style="font-size:11px;padding:6px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            ${roleKeys.map(k => `<option value="${k}">${ROLES[k].label} (${ROLES[k].hiringCost.toLocaleString('fr-FR')}€)</option>`).join('')}
          </select>
          <input type="text" id="staff-hire-name" placeholder="Nom (optionnel)" style="font-size:11px;padding:6px 10px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:160px">
          <select id="staff-hire-nat" title="Nationalité" style="font-size:11px;padding:6px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
            <option value="">Nationalité aléatoire</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
            <option value="ch">CH</option>
            <option value="es">ES</option>
            <option value="be">BE</option>
            <option value="nl">NL</option>
            <option value="it">IT</option>
            <option value="cz">CZ</option>
          </select>
          <input type="number" id="staff-hire-qty" value="1" min="1" max="50" style="font-size:11px;padding:6px 8px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px;width:60px" title="Quantité">
          <button id="staff-hire-btn" class="btn-primary" style="font-size:11px;padding:6px 12px">Embaucher</button>
          <span style="font-size:10px;color:var(--text3)">Solde: ${eco.formatAmount(eco.balance)}</span>
        </div>
        <p id="staff-role-desc" style="font-size:10px;color:var(--text3);margin:8px 0 0;min-height:14px">${ROLES[roleKeys[0]].description || ''}</p>
      </div>

      <div id="staff-social-container"></div>

      ${this._renderZonesSection(game)}
      ${this._renderSignalBoxSection(game)}

      ${roleKeys.map(role => this._renderRoleSection(role, activeServices, stations, depots, game)).join('')}
    `;

    // Inject syndicats section into the Personnel page (fusion page syndicat)
    const socialContainer = container.querySelector ? container.querySelector('#staff-social-container') : null;
    if (socialContainer && game.unions?.render) {
      game.unions.render(socialContainer, game);
    }

    this._bindEvents(container, game, eco);
  }

  _renderRoleSection(role, activeServices, stations, depots, game) {
    const def = ROLES[role];
    const members = this.getByRole(role);
    if (members.length === 0 && role !== 'conducteur') return '';

    let assignOptions = '';
    let noTargetMsg = '';
    if (def.assignTo === 'service') {
      assignOptions = activeServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } else if (def.assignTo === 'station') {
      assignOptions = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } else if (def.assignTo === 'depot') {
      assignOptions = depots.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } else if (def.assignTo === 'zone') {
      assignOptions = this.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
      if (this.zones.length === 0) noTargetMsg = 'Créez un poste de régulation sur la carte (type "Poste de régulation") pour pouvoir affecter.';
    } else if (def.assignTo === 'signalbox') {
      assignOptions = this.signalBoxes.map(sb => `<option value="${sb.id}">${sb.name}</option>`).join('');
      if (this.signalBoxes.length === 0) noTargetMsg = "Créez un poste d'aiguillage sur la carte (type \"Poste d'aiguillage\") pour pouvoir affecter.";
    }

    const extraCol = role === 'controleur' ? '<span>PV</span><span>Recettes</span>' : (role === 'conducteur' ? '<span>Trajets</span><span>Service</span>' : '');
    const colCount = role === 'controleur' ? 6 : (role === 'conducteur' ? 6 : 4);

    const roleNote = (role === 'conducteur')
      ? '<p style="font-size:10px;color:var(--text3);margin:0 0 6px">Affectation automatique aux services. Service de 8h puis repos de 8h ; 24h consécutifs obligatoires une fois par semaine.</p>'
      : '';

    return `
      <div class="dash-section">
        <h3>${def.label}s (${members.length})</h3>
        ${roleNote}
        ${noTargetMsg ? `<p style="font-size:10px;color:#f59e0b;margin:0 0 6px;padding:4px 8px;background:rgba(245,158,11,0.1);border-radius:4px">⚠ ${noTargetMsg}</p>` : ''}
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:repeat(${colCount},1fr)">
            <span>Nom</span><span>Statut</span><span>Affecté à</span>${extraCol}<span>Actions</span>
          </div>
          ${members.map(m => {
            const isAssigned = !!m.assignedTo;
            let assignedLabel = '-';
            if (isAssigned) {
              if (def.assignTo === 'service') {
                const svc = activeServices.find(s => s.id === m.assignedTo);
                assignedLabel = svc ? svc.name : m.assignedTo;
              } else if (def.assignTo === 'station') {
                const st = stations.find(s => s.id === m.assignedTo);
                assignedLabel = st ? st.name : m.assignedTo;
              } else if (def.assignTo === 'depot') {
                const dp = depots.find(d => d.id === m.assignedTo);
                assignedLabel = dp ? dp.name : m.assignedTo;
              } else if (def.assignTo === 'zone') {
                const z = this.zones.find(z => z.id === m.assignedTo);
                assignedLabel = z ? z.name : m.assignedTo;
              } else if (def.assignTo === 'signalbox') {
                const sb = this.signalBoxes.find(sb => sb.id === m.assignedTo);
                assignedLabel = sb ? sb.name : m.assignedTo;
              }
            }
            let statusStr;
            if (role === 'conducteur') {
              if (m.resting) statusStr = `${icon('dot_red', 10)} Repos`;
              else if (isAssigned) statusStr = `${icon('dot_green', 10)} En service`;
              else statusStr = `${icon('dot_yellow', 10)} Disponible`;
            } else {
              statusStr = isAssigned ? `${icon('dot_green', 10)} En poste` : `${icon('dot_yellow', 10)} Disponible`;
            }
            const restLabel = (m.resting && m.restType === 'weekly') ? '24h' : (m.resting ? '8h' : '8h00');
            const shiftInfo = (role === 'conducteur')
              ? `<span>${Math.floor((m.shiftWorkedMin || 0) / 60)}h${String((m.shiftWorkedMin || 0) % 60).padStart(2,'0')}/${restLabel}</span>`
              : '';
            const riskInfo = (role === 'conducteur' && (m.socialRisk || 0) > 0)
              ? ` <span style="color:${(m.socialRisk||0) > 60 ? '#ef4444' : '#f59e0b'};font-size:10px">Risque ${Math.round(m.socialRisk||0)}%</span>`
              : '';
            const extraVals = role === 'controleur'
              ? `<span>${m.totalFines || 0}</span><span>${(m.totalFineRevenue || 0).toLocaleString('fr-FR')}€</span>`
              : (role === 'conducteur' ? `<span>${m.totalTrips || 0}</span>${shiftInfo}${riskInfo}` : '');

            return `<div class="dash-train-row" style="grid-template-columns:repeat(${colCount},1fr)">
              <span style="font-weight:600">${m.name}</span>
              <span>${statusStr}</span>
              <span>${assignedLabel}</span>
              ${extraVals}
              <span>
                ${!isAssigned ? `
                  <select class="staff-assign-select" data-staff-id="${m.id}" style="font-size:9px;padding:2px 4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:3px;max-width:100px">
                    <option value="">Affecter...</option>
                    ${assignOptions}
                  </select>
                  <button class="staff-fire-btn btn-sm" data-staff-id="${m.id}" style="font-size:9px;background:#ef4444;margin-left:4px">Licencier</button>
                ` : `
                  <button class="staff-unassign-btn btn-sm" data-staff-id="${m.id}" style="font-size:9px;background:#6366f1">Désaffecter</button>
                `}
              </span>
            </div>`;
          }).join('') || '<div style="padding:8px;color:var(--text3)">Aucun personnel</div>'}
        </div>
      </div>`;
  }

  _renderZonesSection() {
    const regCoverage = this.zones.map(z => {
      const cov = this.getZoneRegulatorCoverage(z.id);
      const ctrlCount = this.staff.filter(s => s.role === 'controleur' && s.assignedTo === z.id).length;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${z.name}</span>
        <span style="font-size:10px">
          Régulateurs: <b style="color:${cov.covered ? 'var(--green)' : '#ef4444'}">${cov.count}/3</b>
          ${cov.covered ? '(24/7)' : `(${cov.count * 8}h/24)`}
          | Contrôleurs: <b>${ctrlCount}</b>
        </span>
        <button class="zone-del-btn btn-sm" data-zone-id="${z.id}" style="font-size:9px;background:#ef4444">Suppr.</button>
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
    const sbList = this.signalBoxes.map(sb => {
      const agents = this.staff.filter(s => s.role === 'agent_circulation' && s.assignedTo === sb.id);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${sb.name}</span>
        <span style="font-size:10px">Rayon: ${sb.radiusKm} km | Agents: <b>${agents.length}</b></span>
        <button class="sb-del-btn btn-sm" data-sb-id="${sb.id}" style="font-size:9px;background:#ef4444">Suppr.</button>
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

  _bindEvents(container, game, eco) {
    // Role description update
    document.getElementById('staff-hire-role')?.addEventListener('change', (e) => {
      const descEl = document.getElementById('staff-role-desc');
      if (descEl) descEl.textContent = ROLES[e.target.value]?.description || '';
    });

    // Hire
    document.getElementById('staff-hire-btn')?.addEventListener('click', () => {
      const role = document.getElementById('staff-hire-role')?.value || 'conducteur';
      const name = document.getElementById('staff-hire-name')?.value?.trim() || '';
      const nationality = document.getElementById('staff-hire-nat')?.value || '';
      const qty = parseInt(document.getElementById('staff-hire-qty')?.value) || 1;
      const result = this.hire(eco, name, role, { count: qty, nationality, generateEach: !name });
      if (result && result.length > 0) {
        this.render(container, game);
        game.saveState();
      } else {
        alertToast('Fonds insuffisants.');
      }
    });

    // Assign
    container.querySelectorAll('.staff-assign-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const staffId = e.target.dataset.staffId;
        const targetId = e.target.value;
        if (targetId) {
          this.assign(staffId, targetId);
          this.render(container, game);
          game.saveState();
        }
      });
    });

    // Fire
    container.querySelectorAll('.staff-fire-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Licencier ?')) {
          this.fire(btn.dataset.staffId);
          this.render(container, game);
          game.saveState();
        }
      });
    });

    // Unassign
    container.querySelectorAll('.staff-unassign-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = this.staff.find(s => s.id === btn.dataset.staffId);
        if (s) { s.assignedTo = null; this._syncLegacy(); }
        this.render(container, game);
        game.saveState();
      });
    });

    // Add zone
    document.getElementById('zone-add-btn')?.addEventListener('click', () => {
      const name = document.getElementById('zone-name-input')?.value.trim();
      this.addZone(name);
      this.render(container, game);
      game.saveState();
    });

    // Delete zone
    container.querySelectorAll('.zone-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeZone(btn.dataset.zoneId);
        this.render(container, game);
        game.saveState();
      });
    });

    // Add signal box (enter placement mode)
    document.getElementById('sb-add-btn')?.addEventListener('click', () => {
      const name = document.getElementById('sb-name-input')?.value.trim() || '';
      const radius = parseFloat(document.getElementById('sb-radius-input')?.value) || 10;
      game._pendingSignalBox = { name, radiusKm: radius };
      alertToast('Cliquez sur la carte pour placer le poste d\'aiguillage.');
    });

    // Delete signal box
    container.querySelectorAll('.sb-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeSignalBox(btn.dataset.sbId);
        this.render(container, game);
        game.saveState();
      });
    });
  }

  // Keep legacy conductors array in sync for backward compat
  _syncLegacy() {
    this.conductors = this.staff.filter(s => s.role === 'conducteur').map(s => ({
      id: s.id,
      name: s.name,
      assignedServiceId: s.assignedTo,
      available: !s.assignedTo,
      hireDate: s.hireDate,
      totalTrips: s.totalTrips,
    }));
  }

  // Legacy API
  unassign(serviceId) { this.unassignByTarget(serviceId); }

  toSave() {
    return {
      staff: this.staff.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        assignedTo: s.assignedTo,
        available: !s.assignedTo,
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
      })),
      signalBoxes: this.signalBoxes,
      zones: this.zones,
      nextStaffId,
      // Legacy fields for backward compat
      conductors: this.conductors,
      baseSalary: this.baseSalary,
      hiringCost: this.hiringCost,
    };
  }

  loadFromSave(s) {
    if (!s) return;

    if (s.staff && s.staff.length > 0) {
      // New format
      this.staff = s.staff.map(m => ({
        id: m.id,
        name: m.name,
        role: m.role || 'conducteur',
        assignedTo: m.assignedTo || m.assignedServiceId || null,
        available: !m.assignedTo,
        hireDate: m.hireDate || Date.now(),
        totalTrips: m.totalTrips || 0,
        totalFines: m.totalFines || 0,
        totalFineRevenue: m.totalFineRevenue || 0,
        shiftStartMin: m.shiftStartMin ?? -1,
        shiftWorkedMin: m.shiftWorkedMin || 0,
        resting: m.resting || false,
        restRemainingMin: m.restRemainingMin || 0,
        restType: m.restType || null,
        weeklyWorkMin: m.weeklyWorkMin || 0,
        lastWeeklyRestDate: m.lastWeeklyRestDate || null,
        socialRisk: m.socialRisk || 0,
      }));
    } else if (s.conductors && s.conductors.length > 0) {
      // Migrate from old format
      this.staff = s.conductors.map(c => ({
        id: c.id,
        name: c.name,
        role: 'conducteur',
        assignedTo: c.assignedServiceId || null,
        available: !c.assignedServiceId,
        hireDate: c.hireDate || Date.now(),
        totalTrips: c.totalTrips || 0,
        totalFines: 0,
        totalFineRevenue: 0,
        shiftStartMin: -1,
        shiftWorkedMin: 0,
        resting: false,
        restRemainingMin: 0,
        restType: null,
        weeklyWorkMin: 0,
        lastWeeklyRestDate: null,
        socialRisk: 0,
      }));
    } else {
      this.staff = [];
    }

    this.signalBoxes = s.signalBoxes || [];
    this.zones = s.zones || [];
    this.baseSalary = s.baseSalary || 120;
    this.hiringCost = s.hiringCost || 2000;
    if (s.nextStaffId) nextStaffId = s.nextStaffId;
    this._syncLegacy();
  }
}
