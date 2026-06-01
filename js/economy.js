export class Economy {
  constructor() {
    this.balance = 50000000000;
    this.revenue = 0;
    this.expenses = 0;
    this.penalties = 0;
    this.history = [];
    this.ticketPricePerKm = 0.12;
    this.freightPricePerTKm = 0.08;
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
      const allStops = service.stops || service.getCurrentStops?.() || [];
      const stopRatio = allStops.length > 1 ? service.currentStopIndex / (allStops.length - 1) : 1;
      // Randomized descent rates: base rate from stop position ± random variance
      const rndPax = 0.8 + Math.random() * 0.4; // 0.8 – 1.2 multiplier
      const rndFrt = 0.7 + Math.random() * 0.6; // 0.7 – 1.3 multiplier
      const paxDescendRate = isTerminus ? 1.0 : Math.min(0.85, (0.15 + stopRatio * 0.45) * rndPax);
      const freightUnloadRate = isTerminus ? 1.0 : Math.min(0.65, (0.10 + stopRatio * 0.35) * rndFrt);

      const paxDescend = Math.round(service._onboardPax * paxDescendRate);
      const freightUnload = Math.round(service._onboardFreight * freightUnloadRate);

      // Revenue = descended passengers * distance they traveled * ticket price
      let paxRevenue = Math.round(paxDescend * distFromPrev * this.ticketPricePerKm);
      let frtRevenue = Math.round(freightUnload * distFromPrev * this.freightPricePerTKm);

      // Delay penalty: reduce revenue by 25% (not double-dip)
      if (service.train && service.train.delay >= 30) {
        const totalRev = paxRevenue + frtRevenue;
        const reducedTotal = Math.round(totalRev * 0.75);
        const penalty = totalRev - reducedTotal;
        if (penalty > 0) this.addPenalty(penalty, `Retard >30min ${service.name} @ ${stationName}`);
        // Distribute reduced revenue proportionally
        if (totalRev > 0) {
          paxRevenue = Math.round(reducedTotal * (paxRevenue / totalRev));
          frtRevenue = reducedTotal - paxRevenue;
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
        if (frtRevenue > 0) {
          this.addRevenue(frtRevenue, 'fret', `${stationName}: ${freightUnload}t déch. (${Math.round(distFromPrev)} km) — ${service.name}`);
          if (service.lineId) this.addLineRevenue(service.lineId, frtRevenue);
        }
      }

      service._onboardPax -= paxDescend;
      service._onboardFreight -= freightUnload;
    }

    // --- MONTÉE / CHARGEMENT (new passengers/freight board) ---
    if (!isTerminus) {
      const availPaxSlots = maxPax - service._onboardPax;
      const availFreightSlots = maxFreight - service._onboardFreight;
      // Randomized boarding: 30-80% of available slots
      const paxBoardRate = 0.30 + Math.random() * 0.50;
      const frtBoardRate = 0.20 + Math.random() * 0.50;
      const paxBoard = Math.round(availPaxSlots * paxBoardRate);
      const freightLoad = Math.round(availFreightSlots * frtBoardRate);
      service._onboardPax += paxBoard;
      service._onboardFreight += freightLoad;
    }
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
