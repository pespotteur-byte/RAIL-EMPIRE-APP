export class Economy {
  constructor() {
    this.balance = 500000;
    this.revenue = 0;
    this.expenses = 0;
    this.penalties = 0;
    this.history = [];
    this.ticketPricePerKm = 0.12;
    this.freightPricePerTKm = 0.08;
    this.dailyProcessed = {};
    this.totalPassengers = 0;
    this.totalFreightTonnes = 0;
  }

  addRevenue(amount, category, description) {
    if (amount <= 0) return;
    this.balance += amount;
    this.revenue += amount;
    this.history.push({ type: 'revenue', amount, category, description, time: Date.now() });
    if (this.history.length > 200) this.history.shift();
  }

  addExpense(amount, category, description) {
    if (amount <= 0) return;
    this.balance -= amount;
    this.expenses += amount;
    this.history.push({ type: 'expense', amount, category, description, time: Date.now() });
    if (this.history.length > 200) this.history.shift();
  }

  addPenalty(amount, description) {
    if (amount <= 0) return;
    this.balance -= amount;
    this.penalties += amount;
    this.expenses += amount;
    this.history.push({ type: 'expense', amount, category: 'penalty', description, time: Date.now() });
    if (this.history.length > 200) this.history.shift();
  }

  // Legacy — kept for backward compat but now empty (revenue is per-stop)
  processServiceRevenue(service) {}

  /**
   * Process revenue at each station stop.
   * - Passengers: some descend (revenue for their trip), new ones board
   * - Freight: some unloaded (revenue), new freight loaded
   */
  processStopRevenue(service, stationName, distFromPrev, isFirst, isTerminus) {
    if (!service || !service.rame) return;
    if (distFromPrev <= 0 && !isFirst) return;

    const maxPax = service.rame.totalCapacity || 0;
    const maxFreight = service.rame.totalFreightCapacity || 0;

    // Initialize onboard counts on first stop
    if (service._onboardPax == null) service._onboardPax = 0;
    if (service._onboardFreight == null) service._onboardFreight = 0;

    // --- DESCENTE / DÉCHARGEMENT (revenue from those who rode this segment) ---
    if (!isFirst && distFromPrev > 0) {
      // Deterministic descent rates based on stop position in route
      const allStops = service.stops || service.getCurrentStops?.() || [];
      const stopRatio = allStops.length > 1 ? service.currentStopIndex / (allStops.length - 1) : 1;
      const paxDescendRate = isTerminus ? 1.0 : Math.min(0.7, 0.2 + stopRatio * 0.4);
      const freightUnloadRate = isTerminus ? 1.0 : Math.min(0.5, 0.15 + stopRatio * 0.3);

      const paxDescend = Math.round(service._onboardPax * paxDescendRate);
      const freightUnload = Math.round(service._onboardFreight * freightUnloadRate);

      // Revenue = descended passengers * distance they traveled * ticket price
      let paxRevenue = Math.round(paxDescend * distFromPrev * this.ticketPricePerKm);
      let frtRevenue = Math.round(freightUnload * distFromPrev * this.freightPricePerTKm);

      // Delay penalty
      if (service.train && service.train.delay >= 30) {
        const penalty = Math.round((paxRevenue + frtRevenue) * 0.25);
        if (penalty > 0) this.addPenalty(penalty, `Retard >30min ${service.name} @ ${stationName}`);
        paxRevenue = Math.round(paxRevenue * 0.75);
        frtRevenue = Math.round(frtRevenue * 0.75);
      }

      if (paxDescend > 0) {
        this.totalPassengers += paxDescend;
        if (paxRevenue > 0) this.addRevenue(paxRevenue, 'voyageurs', `${stationName}: ${paxDescend} desc. (${Math.round(distFromPrev)} km) — ${service.name}`);
      }
      if (freightUnload > 0) {
        this.totalFreightTonnes += freightUnload;
        if (frtRevenue > 0) this.addRevenue(frtRevenue, 'fret', `${stationName}: ${freightUnload}t déch. (${Math.round(distFromPrev)} km) — ${service.name}`);
      }

      service._onboardPax -= paxDescend;
      service._onboardFreight -= freightUnload;
    }

    // --- MONTÉE / CHARGEMENT (new passengers/freight board) ---
    if (!isTerminus) {
      const availPaxSlots = maxPax - service._onboardPax;
      const availFreightSlots = maxFreight - service._onboardFreight;
      const boardRate = 0.6; // 60% fill of available slots (deterministic)
      const paxBoard = Math.round(availPaxSlots * boardRate);
      const freightLoad = Math.round(availFreightSlots * boardRate);
      service._onboardPax += paxBoard;
      service._onboardFreight += freightLoad;
    }
  }

  processDailyCharges(services, depots, dateKey) {
    if (this.dailyProcessed[dateKey]) return;
    this.dailyProcessed[dateKey] = true;

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
    if (keys.length > 30) {
      delete this.dailyProcessed[keys[0]];
    }
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
      history: this.history.slice(-100),
      dailyProcessed: this.dailyProcessed,
      totalPassengers: this.totalPassengers,
      totalFreightTonnes: this.totalFreightTonnes,
      _companyLogo: this._companyLogo || null,
      _lastBulletinDate: this._lastBulletinDate || null,
    };
  }

  loadFromSave(s) {
    if (!s) return;
    this.balance = s.balance ?? 500000;
    this.revenue = s.revenue || 0;
    this.expenses = s.expenses || 0;
    this.penalties = s.penalties || 0;
    this.ticketPricePerKm = s.ticketPricePerKm || 0.12;
    this.freightPricePerTKm = s.freightPricePerTKm || 0.08;
    this.history = s.history || [];
    this.dailyProcessed = s.dailyProcessed || {};
    this.totalPassengers = s.totalPassengers || 0;
    this.totalFreightTonnes = s.totalFreightTonnes || 0;
    this._companyLogo = s._companyLogo || null;
    this._lastBulletinDate = s._lastBulletinDate || null;
  }
}
