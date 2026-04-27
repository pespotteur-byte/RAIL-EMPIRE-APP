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

  processServiceRevenue(service) {
    if (!service || !service.rame) return;
    const dist = service.totalDistance || 0;
    if (dist <= 0) return;

    const passengers = service.rame.totalCapacity || 0;
    const freightCap = service.rame.totalFreightCapacity || 0;
    const occupancy = 0.6 + Math.random() * 0.3;

    let passengerRevenue = Math.round(passengers * occupancy * dist * this.ticketPricePerKm);
    let freightRevenue = Math.round(freightCap * occupancy * dist * this.freightPricePerTKm);

    if (service.train && service.train.delay >= 30) {
      const penalty = Math.round((passengerRevenue + freightRevenue) * 0.25);
      this.addPenalty(penalty, `Amende retard >30min ${service.name}`);
      passengerRevenue = Math.round(passengerRevenue * 0.75);
      freightRevenue = Math.round(freightRevenue * 0.75);
    }

    if (passengerRevenue > 0) {
      this.addRevenue(passengerRevenue, 'voyageurs', `Voyageurs ${service.name} (${Math.round(passengers * occupancy)} pax, ${Math.round(dist)} km)`);
    }
    if (freightRevenue > 0) {
      this.addRevenue(freightRevenue, 'fret', `Fret ${service.name} (${Math.round(dist)} km)`);
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
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + ' M€';
    if (Math.abs(n) >= 1000) return Math.round(n / 1000) + ' k€';
    return Math.round(n) + ' €';
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
  }
}
