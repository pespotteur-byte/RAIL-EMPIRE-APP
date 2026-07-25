import { getGlobalRng } from './rng.js?v=1784931688';

export class Economy {
  constructor() {
    this.balance = 50000000000;
    this.revenue = 0;
    this.expenses = 0;
    this.penalties = 0;
    this.history = [];
    this.ticketPricePerKm = 0.12; // legacy base, kept for backward compat
    this.freightPricePerTKm = 0.08;
    // Section X — prix au km différencié par classification (vitesse max)
    this.passengerPriceByClass = {
      slow: 0.08,      // ≤ 120 km/h
      regional: 0.12,  // 120–160 km/h
      intercity: 0.18, // 160–200 km/h
      fast: 0.30,      // 200–250 km/h
      tgv: 0.50,       // > 250 km/h
    };
    this.dailyProcessed = {};
    this.totalPassengers = 0;
    this.totalFreightTonnes = 0;
    // Per-category revenue/expense tracking
    this.revenueByCategory = {};  // { voyageurs: X, fret: Y, amendes: Z }
    this.expenseByCategory = {};  // { exploitation: X, personnel: Y, maintenance: Z, achat: W }
    // Per-line profitability
    this.lineRevenue = {};  // { lineId: totalRevenue }
    this.lineExpense = {};
    // Daily snapshots for financial charts (last 30 days)
    this.dailySnapshots = [];  // [{ date, revenue, expenses, balance, byCategory: { ... } }]
    this._currentDayKey = null;
    this._currentDayRevenue = 0;
    this._currentDayExpenses = 0;
    this._currentDayByCategory = {};
    // Ticket stats
    this.totalTicketsSold = 0;
    this.totalTicketRevenue = 0;
    this.totalFraudFines = 0;
    this.fraudRate = 0.05; // 5% base fraud rate
  }

  addRevenue(amount, category, description) {
    if (amount <= 0) return;
    this.balance += amount;
    this.revenue += amount;
    this.revenueByCategory[category] = (this.revenueByCategory[category] || 0) + amount;
    this._currentDayRevenue += amount;
    const key = `rev_${category}`;
    this._currentDayByCategory[key] = (this._currentDayByCategory[key] || 0) + amount;
    this.history.push({ type: 'revenue', amount, category, description, time: Date.now() });
    if (this.history.length > 500) this.history.shift();
  }

  addExpense(amount, category, description) {
    if (amount <= 0) return;
    this.balance -= amount;
    this.expenses += amount;
    this.expenseByCategory[category] = (this.expenseByCategory[category] || 0) + amount;
    this._currentDayExpenses += amount;
    const key = `exp_${category}`;
    this._currentDayByCategory[key] = (this._currentDayByCategory[key] || 0) + amount;
    this.history.push({ type: 'expense', amount, category, description, time: Date.now() });
    if (this.history.length > 500) this.history.shift();
  }

  addPenalty(amount, description) {
    if (amount <= 0) return;
    this.balance -= amount;
    this.penalties += amount;
    this.expenses += amount;
    this.expenseByCategory['penalty'] = (this.expenseByCategory['penalty'] || 0) + amount;
    this._currentDayExpenses += amount;
    this._currentDayByCategory['exp_penalty'] = (this._currentDayByCategory['exp_penalty'] || 0) + amount;
    this.history.push({ type: 'expense', amount, category: 'penalty', description, time: Date.now() });
    if (this.history.length > 500) this.history.shift();
  }

  // Section X — prix au km différencié selon la classification (vitesse max)
  getPassengerPricePerKm(maxSpeed = 100) {
    const tiers = this.passengerPriceByClass || {};
    if (maxSpeed <= 120) return tiers.slow ?? 0.08;
    if (maxSpeed <= 160) return tiers.regional ?? 0.12;
    if (maxSpeed <= 200) return tiers.intercity ?? 0.18;
    if (maxSpeed <= 250) return tiers.fast ?? 0.30;
    return tiers.tgv ?? 0.50;
  }

  // Legacy — kept for backward compat but now empty (revenue is per-stop)
  processServiceRevenue(service) {}

  /**
   * Péage infrastructure (redevance d'utilisation des voies).
   * Dépend de la distance, du pays, de la vitesse max de la ligne, du nombre
   * de voies, de l'électrification, et de la masse du convoi.
   */
  _calcInfrastructureToll(distanceKm, route, rame, country = 'FR') {
    if (!route || route.length < 2) return Math.round(distanceKm * 2.0);
    // Extract line metadata from the route
    const speeds = route.filter(p => p && p.maxSpeed > 0).map(p => p.maxSpeed);
    const maxLineSpeed = speeds.length ? Math.max(...speeds) : (rame.maxSpeed || 160);
    const avgLineSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : maxLineSpeed;
    const tracks = route.filter(p => p && p.tracks > 0).map(p => p.tracks);
    const avgTracks = tracks.length ? (tracks.reduce((a, b) => a + b, 0) / tracks.length) : 1;
    const electrified = route.filter(p => p && p.electrified).length / route.length;
    const isHighSpeed = maxLineSpeed >= 250;
    const isLgv = maxLineSpeed >= 200;

    // Country base rate (EUR / train-km)
    const countryRates = {
      FR: 3.0, DE: 2.6, IT: 2.4, ES: 2.2, BE: 2.5, NL: 2.5, CH: 3.2, AT: 2.3,
      GB: 2.8, PL: 1.6, CZ: 1.5, HU: 1.4, RO: 1.2, SE: 2.0, NO: 2.1, DK: 2.4,
      PT: 1.9, FI: 1.8, IE: 2.0, LU: 2.3, SI: 1.7, SK: 1.5, HR: 1.6, GR: 1.4,
      BG: 1.2, LT: 1.3, LV: 1.3, EE: 1.3, RS: 1.4, BA: 1.3, MK: 1.2, AL: 1.1,
    };
    const baseRate = countryRates[country] || 2.0;

    // Multipliers
    const speedMult = isHighSpeed ? 2.5 : (isLgv ? 1.8 : (avgLineSpeed >= 160 ? 1.3 : (avgLineSpeed >= 120 ? 1.0 : 0.8)));
    const trackMult = avgTracks >= 3 ? 1.2 : (avgTracks >= 2 ? 1.0 : 0.85);
    const electrifiedMult = electrified > 0.5 ? 1.15 : 1.0;
    const usageMult = route.some(p => p && p.usage === 'main') ? 1.0 : 0.85;

    // Weight factor (heavier trains cause more wear)
    const tonnage = rame.totalTonnage || 100;
    const weightFactor = 0.9 + tonnage / 2000;

    const toll = distanceKm * baseRate * speedMult * trackMult * electrifiedMult * usageMult * weightFactor;
    return Math.round(toll);
  }

  /**
   * Process revenue at each station stop.
   * - Passengers: some descend (revenue for their trip), new ones board
   * - Freight: some unloaded (revenue), new freight loaded
   */
  processStopRevenue(service, stationName, distFromPrev, isFirst, isTerminus, stationId, legRoute) {
    if (!service || !service.rame) return;
    if (distFromPrev <= 0 && !isFirst) return;

    // Per-segment operating cost: péage réaliste + distance + vitesse max + usure
    if (!isFirst && distFromPrev > 0) {
      const tonnage = service.rame.totalTonnage || 100;
      const maxSpeed = service.rame.maxSpeed || 100;
      // base énergie/usure (€/t·km)
      const energyCost = Math.round(distFromPrev * tonnage * 0.5);
      // péage infrastructure (track access charge)
      const station = typeof window !== 'undefined' && window.game?.world?.getStationById ? window.game.world.getStationById(stationId) : null;
      const country = station?.country || 'FR';
      const tollCost = this._calcInfrastructureToll(distFromPrev, legRoute || [], service.rame, country);
      const speedCost = Math.round(distFromPrev * Math.max(0, maxSpeed - 100) / 50);
      const opCost = energyCost + tollCost + speedCost;
      if (opCost > 0) {
        this.addExpense(opCost, 'exploitation', `Trajet ${Math.round(distFromPrev)} km — ${service.name} (${maxSpeed} km/h) — péage ${tollCost.toLocaleString()} EUR`);
        if (service.lineId) this.addLineExpense(service.lineId, opCost);
      }
    }

    const maxPax = service.rame.totalCapacity || 0;
    let maxFreight = service.rame.totalFreightCapacity || 0;

    // Section VI — ITE non compatible avec le fret du train : pas de chargement/déchargement
    if (service._iteCargoMismatch) maxFreight = 0;

    // Section VI — W, HLP, TM, EVO, trains de travaux : pas de revenus voyageur/fret
    const isNonRevenue = ['w','hlp','tm','evo','work'].includes(service.serviceType) || service.isWorkTrain;

    // Initialize onboard counts on first stop
    if (service._onboardPax == null) service._onboardPax = 0;
    if (service._onboardFreight == null) service._onboardFreight = 0;
    if (service._contractFreight == null) service._contractFreight = 0;

    if (isNonRevenue) return;

    const delayTolerance = (typeof window !== 'undefined' && window.game?.realismSettings?.delayTolerance) ?? 30;

    const g = typeof window !== 'undefined' ? window.game : null;
    const assignedContract = service.assignedContractId && g?.freightManager?.contracts
      ? g.freightManager.contracts.find(c => c.id === service.assignedContractId && c.active)
      : null;

    // --- DESCENTE / DÉCHARGEMENT (revenue from those who rode this segment) ---
    const rng = getGlobalRng();
    if (!isFirst && distFromPrev > 0) {
      const allStops = service.stops || service.getCurrentStops?.() || [];
      const stopRatio = allStops.length > 1 ? service.currentStopIndex / (allStops.length - 1) : 1;
      // Randomized descent rates: base rate from stop position ± random variance
      const rndPax = 0.8 + rng.random() * 0.4; // 0.8 – 1.2 multiplier
      const rndFrt = 0.7 + rng.random() * 0.6; // 0.7 – 1.3 multiplier
      const paxDescendRate = isTerminus ? 1.0 : Math.min(0.85, (0.15 + stopRatio * 0.45) * rndPax);
      const freightUnloadRate = isTerminus ? 1.0 : Math.min(0.65, (0.10 + stopRatio * 0.35) * rndFrt);

      const paxDescend = Math.round(service._onboardPax * paxDescendRate);

      // Contrat assigné : déchargement à la gare destination
      let contractUnload = 0;
      let contractRevenue = 0;
      if (assignedContract && stationId === assignedContract.toId && service._contractFreight > 0 && !service._iteCargoMismatch) {
        contractUnload = service._contractFreight;
        service._contractFreight = 0;
        service._contractDelivered = (service._contractDelivered || 0) + contractUnload;
        if (g?.freightManager?.fulfillAtStation) {
          const delay = service.train?.delay ?? 0;
          const isDelayed = delay >= delayTolerance;
          const isEarly = delay <= -10;
          const res = g.freightManager.fulfillAtStation(service, stationId, contractUnload, isDelayed, isEarly);
          contractRevenue = (res.fulfilled || []).reduce((s, f) => s + (f.payment || 0), 0);
        }
        if (contractRevenue > 0) {
          this.addRevenue(contractRevenue, 'fret', `${stationName}: contrat ${assignedContract.cargoName} ${contractUnload}${assignedContract.unit} — ${service.name}`);
          if (service.lineId) this.addLineRevenue(service.lineId, contractRevenue);
        }
      }

      const freightUnload = service._iteCargoMismatch ? 0 : Math.round(service._onboardFreight * freightUnloadRate);

      // Revenue = descended passengers * distance they traveled * ticket price
      // Section X — prix au km différencié selon la classification (vitesse max)
      const maxSpeed = service.rame.maxSpeed || 100;
      const pricePerKm = this.getPassengerPricePerKm(maxSpeed);

      let paxRevenue = Math.round(paxDescend * distFromPrev * pricePerKm);

      // Delay penalty: reduce passenger revenue by 25% (contract already penalized in fulfillAtStation)
      if (service.train && service.train.delay >= delayTolerance) {
        const penalty = Math.round(paxRevenue * 0.25);
        if (penalty > 0) {
          this.addPenalty(penalty, `Retard >${delayTolerance}min ${service.name} @ ${stationName}`);
          paxRevenue -= penalty;
        }
      }

      if (paxDescend > 0) {
        this.totalPassengers += paxDescend;
        this.totalTicketsSold += paxDescend;
        this.totalTicketRevenue += paxRevenue;
        if (paxRevenue > 0) {
          this.addRevenue(paxRevenue, 'voyageurs', `${stationName}: ${paxDescend} desc. (${Math.round(distFromPrev)} km) — ${service.name}`);
          if (service.lineId) this.addLineRevenue(service.lineId, paxRevenue);
        }
      }
      if (freightUnload > 0) {
        this.totalFreightTonnes += freightUnload;
        let genericRevenue = Math.round(freightUnload * distFromPrev * this.freightPricePerTKm);
        const isDelayed = (service.train?.delay ?? 0) >= delayTolerance;
        if (isDelayed && genericRevenue > 0) genericRevenue = Math.round(genericRevenue * 0.75); // pénalité retard 25%
        if (genericRevenue > 0) {
          this.addRevenue(genericRevenue, 'fret', `${stationName}: fret générique ${freightUnload}t (${Math.round(distFromPrev)} km) — ${service.name}`);
          if (service.lineId) this.addLineRevenue(service.lineId, genericRevenue);
        }
        // Fret hors contrat : le tonnage générique déchargé alimente aussi les stats Marchandises + Industrie.
        try {
          if (g?.cargoTypes?.recordContract) {
            const cType = this._rameCargoType(service.rame);
            g.cargoTypes.recordContract(cType, freightUnload, genericRevenue, isTerminus);
            if (g.industrialClients?.stats) {
              g.industrialClients.stats.totalTonnage += freightUnload;
              g.industrialClients.stats.totalRevenue += genericRevenue;
            }
          }
        } catch (e) { /* graceful */ }
      }

      service._onboardPax -= paxDescend;
      service._onboardFreight -= freightUnload;
    }

    // --- MONTÉE / CHARGEMENT (new passengers/freight board) ---
    if (!isTerminus) {
      // Contrat assigné : chargement au départ
      if (isFirst && assignedContract && stationId === assignedContract.fromId && service._contractFreight === 0) {
        const contractLoad = Math.min(assignedContract.quantity, maxFreight);
        if (contractLoad > 0) {
          service._contractFreight = contractLoad;
          assignedContract.progress = 0.5;
        }
      }

      const availPaxSlots = maxPax - service._onboardPax;
      const availFreightSlots = Math.max(0, maxFreight - service._onboardFreight - service._contractFreight);
      // Randomized boarding: 30-80% of available slots
      const paxBoardRate = 0.30 + rng.random() * 0.50;
      const frtBoardRate = 0.20 + rng.random() * 0.50;
      const paxBoard = Math.round(availPaxSlots * paxBoardRate);
      const freightLoad = Math.round(availFreightSlots * frtBoardRate);
      service._onboardPax += paxBoard;
      service._onboardFreight += freightLoad;
    }
  }

  // Type de chargement représentatif d'une rame (1er cargo des wagons fret).
  // Sert à attribuer les stats du fret hors contrat à une catégorie de
  // marchandise. Repli sur conteneurs si aucun wagon ne précise son chargement.
  _rameCargoType(rame) {
    const els = rame?.elementDetails || [];
    for (const e of els) {
      if (Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0) return e.cargoTypes[0];
    }
    return 'containers-20';
  }

  processDailyCharges(services, depots, dateKey) {
    if (this.dailyProcessed[dateKey]) return;
    this.dailyProcessed[dateKey] = true;

    // Save previous day snapshot before processing new day
    if (this._currentDayKey && this._currentDayKey !== dateKey) {
      this.dailySnapshots.push({
        date: this._currentDayKey,
        revenue: this._currentDayRevenue,
        expenses: this._currentDayExpenses,
        balance: this.balance,
        profit: this._currentDayRevenue - this._currentDayExpenses,
        byCategory: { ...this._currentDayByCategory },
      });
      if (this.dailySnapshots.length > 30) this.dailySnapshots.shift();
      this._currentDayRevenue = 0;
      this._currentDayExpenses = 0;
      this._currentDayByCategory = {};
    }
    this._currentDayKey = dateKey;

    for (const svc of services) {
      const cost = 500 + (svc.rame ? svc.rame.totalTonnage * 0.5 : 0);
      this.addExpense(Math.round(cost), 'exploitation', `Exploitation ${svc.name}`);
    }

    if (depots) {
      for (const d of depots) {
        const cost = d.getMaintenanceCost ? d.getMaintenanceCost() : d.tracks * 200;
        this.addExpense(cost, 'maintenance', `Maintenance ${d.name}`);
      }
    }

    const keys = Object.keys(this.dailyProcessed);
    while (keys.length > 7) {
      delete this.dailyProcessed[keys.shift()];
    }
  }

  // Get effective fraud rate (reduced by contrôleur presence)
  getEffectiveFraudRate(hasControleur) {
    return hasControleur ? this.fraudRate * 0.3 : this.fraudRate; // 70% reduction with contrôleur
  }

  // Revenue breakdown for dashboard
  getRevenueBreakdown() {
    return { ...this.revenueByCategory };
  }

  getExpenseBreakdown() {
    return { ...this.expenseByCategory };
  }

  // Per-line revenue tracking
  addLineRevenue(lineId, amount) {
    if (!lineId || amount <= 0) return;
    this.lineRevenue[lineId] = (this.lineRevenue[lineId] || 0) + amount;
  }

  addLineExpense(lineId, amount) {
    if (!lineId || amount <= 0) return;
    this.lineExpense[lineId] = (this.lineExpense[lineId] || 0) + amount;
  }

  getLineProfitability(lineId) {
    const rev = this.lineRevenue[lineId] || 0;
    const exp = this.lineExpense[lineId] || 0;
    return { revenue: rev, expense: exp, profit: rev - exp, margin: rev > 0 ? Math.round(((rev - exp) / rev) * 100) : 0 };
  }

  formatAmount(n) {
    return Math.round(n).toLocaleString('fr-FR') + ' €';
  }

  toSave() {
    return {
      balance: this.balance,
      revenue: this.revenue,
      expenses: this.expenses,
      penalties: this.penalties,
      ticketPricePerKm: this.ticketPricePerKm,
      freightPricePerTKm: this.freightPricePerTKm,
      passengerPriceByClass: { ...this.passengerPriceByClass },
      history: this.history.slice(-500),
      dailyProcessed: this.dailyProcessed,
      totalPassengers: this.totalPassengers,
      totalFreightTonnes: this.totalFreightTonnes,
      _companyLogo: this._companyLogo || null,
      _lastBulletinDate: this._lastBulletinDate || null,
      revenueByCategory: this.revenueByCategory,
      expenseByCategory: this.expenseByCategory,
      lineRevenue: this.lineRevenue,
      lineExpense: this.lineExpense,
      dailySnapshots: this.dailySnapshots.slice(-30),
      totalTicketsSold: this.totalTicketsSold,
      totalTicketRevenue: this.totalTicketRevenue,
      totalFraudFines: this.totalFraudFines,
      fraudRate: this.fraudRate,
      _currentDayKey: this._currentDayKey,
      _currentDayRevenue: this._currentDayRevenue,
      _currentDayExpenses: this._currentDayExpenses,
      _currentDayByCategory: this._currentDayByCategory,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.balance = s.balance ?? 50000000000;
    this.revenue = s.revenue || 0;
    this.expenses = s.expenses || 0;
    this.penalties = s.penalties || 0;
    this.ticketPricePerKm = s.ticketPricePerKm || 0.12;
    this.freightPricePerTKm = s.freightPricePerTKm || 0.08;
    // Backward compat : si passengerPriceByClass n'existe pas, on dérive de l'ancien ticketPricePerKm
    if (s.passengerPriceByClass) {
      this.passengerPriceByClass = { ...this.passengerPriceByClass, ...s.passengerPriceByClass };
    } else if (s.ticketPricePerKm) {
      const base = s.ticketPricePerKm;
      this.passengerPriceByClass = {
        slow: base * 0.8,
        regional: base * 1.0,
        intercity: base * 1.3,
        fast: base * 1.8,
        tgv: base * 2.5,
      };
    }
    this.history = s.history || [];
    this.dailyProcessed = s.dailyProcessed || {};
    this.totalPassengers = s.totalPassengers || 0;
    this.totalFreightTonnes = s.totalFreightTonnes || 0;
    this._companyLogo = s._companyLogo || null;
    this._lastBulletinDate = s._lastBulletinDate || null;
    this.revenueByCategory = s.revenueByCategory || {};
    this.expenseByCategory = s.expenseByCategory || {};
    this.lineRevenue = s.lineRevenue || {};
    this.lineExpense = s.lineExpense || {};
    this.dailySnapshots = s.dailySnapshots || [];
    this.totalTicketsSold = s.totalTicketsSold || 0;
    this.totalTicketRevenue = s.totalTicketRevenue || 0;
    this.totalFraudFines = s.totalFraudFines || 0;
    this.fraudRate = s.fraudRate || 0.05;
    this._currentDayKey = s._currentDayKey || null;
    this._currentDayRevenue = s._currentDayRevenue || 0;
    this._currentDayExpenses = s._currentDayExpenses || 0;
    this._currentDayByCategory = s._currentDayByCategory || {};
  }
}
