import { passengerCleanlinessPenalty, passengerSatisfactionScore } from './consumable-effects.js';
import { getGlobalRng } from './rng.js';
export class Economy {
    _transactionTime() {
        const ms = typeof window !== 'undefined' ? window.game?.engine?.getSimulationEpochMs?.() : null;
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : Date.now();
    }
    get passengerSatisfaction() {
        return this.passengerSatisfactionSamples > 0 ? this.passengerSatisfactionPoints / this.passengerSatisfactionSamples : null;
    }
    constructor() {
        this._companyLogo = null;
        this._lastBulletinDate = null;
        // RC19: cumulative counters are not a substitute for a complete journal.
        // Legacy versions already discarded entries; never claim to reconstruct them.
        this.historyInheritedTruncation = false;
        this.passengerSatisfactionSamples = 0;
        this.passengerSatisfactionPoints = 0;
        this.balance = 50000000000;
        this.revenue = 0;
        this.expenses = 0;
        this.penalties = 0;
        this.history = [];
        this.ticketPricePerKm = 0.12; // legacy base, kept for backward compat
        this.freightPricePerTKm = 0.08;
        // Section X — prix au km différencié par classification (vitesse max)
        this.passengerPriceByClass = {
            slow: 0.08, // ≤ 120 km/h
            regional: 0.12, // 120–160 km/h
            intercity: 0.18, // 160–200 km/h
            fast: 0.30, // 200–250 km/h
            tgv: 0.50, // > 250 km/h
        };
        this.dailyProcessed = {};
        this.totalPassengers = 0;
        this.totalFreightTonnes = 0;
        // Per-category revenue/expense tracking
        this.revenueByCategory = {}; // { voyageurs: X, fret: Y, amendes: Z }
        this.expenseByCategory = {}; // { exploitation: X, personnel: Y, maintenance: Z, achat: W }
        // Per-line profitability
        this.lineRevenue = {}; // { lineId: totalRevenue }
        this.lineExpense = {};
        // Daily snapshots retained for the complete financial recap
        this.dailySnapshots = []; // [{ date, revenue, expenses, balance, byCategory: { ... } }]
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
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0)
            return false;
        this.balance += amount;
        this.revenue += amount;
        this.revenueByCategory[category] = (this.revenueByCategory[category] || 0) + amount;
        this._currentDayRevenue += amount;
        const key = `rev_${category}`;
        this._currentDayByCategory[key] = (this._currentDayByCategory[key] || 0) + amount;
        this.history.push({ type: 'revenue', amount, category, description, time: this._transactionTime() });
        return true;
    }
    addExpense(amount, category, description) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0)
            return false;
        this.balance -= amount;
        this.expenses += amount;
        this.expenseByCategory[category] = (this.expenseByCategory[category] || 0) + amount;
        this._currentDayExpenses += amount;
        const key = `exp_${category}`;
        this._currentDayByCategory[key] = (this._currentDayByCategory[key] || 0) + amount;
        this.history.push({ type: 'expense', amount, category, description, time: this._transactionTime() });
        return true;
    }
    addPenalty(amount, description) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0)
            return false;
        this.balance -= amount;
        this.penalties += amount;
        this.expenses += amount;
        this.expenseByCategory['penalty'] = (this.expenseByCategory['penalty'] || 0) + amount;
        this._currentDayExpenses += amount;
        this._currentDayByCategory['exp_penalty'] = (this._currentDayByCategory['exp_penalty'] || 0) + amount;
        this.history.push({ type: 'expense', amount, category: 'penalty', description, time: this._transactionTime() });
        return true;
    }
    // Section X — prix au km différencié selon la classification (vitesse max)
    getPassengerPricePerKm(maxSpeed = 100) {
        const tiers = this.passengerPriceByClass || {};
        if (maxSpeed <= 120)
            return tiers.slow ?? 0.08;
        if (maxSpeed <= 160)
            return tiers.regional ?? 0.12;
        if (maxSpeed <= 200)
            return tiers.intercity ?? 0.18;
        if (maxSpeed <= 250)
            return tiers.fast ?? 0.30;
        return tiers.tgv ?? 0.50;
    }
    // Legacy — kept for backward compat but now empty (revenue is per-stop)
    processServiceRevenue(service) { }
    /**
     * Péage infrastructure (redevance d'utilisation des voies).
     * Dépend de la distance, du pays, de la vitesse max de la ligne, du nombre
     * de voies, de l'électrification, et de la masse du convoi.
     */
    _calcInfrastructureToll(distanceKm, route, rame, country = 'FR') {
        if (!route || route.length < 2)
            return Math.round(distanceKm * 2.0);
        // One allocation-free pass. Math.max(...speeds) crashed on long SC
        // geometries and prevented the entire stop's economy from executing.
        let speedSum = 0, speedCount = 0, maxLineSpeed = 0, trackSum = 0, trackCount = 0, electrifiedCount = 0, mainUsage = false;
        for (const p of route) {
            if (!p)
                continue;
            const speed = Number(p.maxSpeed), tracks = Number(p.tracks);
            if (Number.isFinite(speed) && speed > 0) {
                speedSum += speed;
                speedCount++;
                maxLineSpeed = Math.max(maxLineSpeed, speed);
            }
            if (Number.isFinite(tracks) && tracks > 0) {
                trackSum += tracks;
                trackCount++;
            }
            if (p.electrified)
                electrifiedCount++;
            if (p.usage === 'main')
                mainUsage = true;
        }
        if (!speedCount)
            maxLineSpeed = rame.maxSpeed || 160;
        const avgLineSpeed = speedCount ? Math.round(speedSum / speedCount) : maxLineSpeed;
        const avgTracks = trackCount ? trackSum / trackCount : 1;
        const electrified = electrifiedCount / route.length;
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
        const usageMult = mainUsage ? 1.0 : 0.85;
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
        if (!service || !service.rame)
            return;
        if (!Number.isFinite(distFromPrev) || distFromPrev < 0)
            return;
        // Per-segment operating cost: péage réaliste + distance + vitesse max + usure
        if (!isFirst && distFromPrev > 0) {
            const carriedFreight = Math.max(0, Number(service._onboardFreight) || 0) + Math.max(0, Number(service._contractFreight) || 0);
            const tonnage = Math.max(1, (Number(service.rame.totalMass) || Number(service.rame.totalTonnage) || 100) + carriedFreight);
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
                if (service.lineId)
                    this.addLineExpense(service.lineId, opCost);
            }
        }
        const maxPax = service.rame.totalCapacity || 0;
        const serviceClass = String(service.serviceType || service.category || service.train?.category || '').trim().toLowerCase();
        // W = matériel voyageurs vide, HLP = haut-le-pied, TM = train de machines.
        // These movements are physically empty: no passenger, generic freight or
        // freight-contract load may survive a reload/conversion or board at a stop.
        const isEmptyMovement = ['w', 'hlp', 'tm', 'm-', 'evo'].includes(serviceClass);
        // Section VI — W, HLP, TM, EVO, trains de travaux : pas de revenus voyageur/fret
        const isNonRevenue = isEmptyMovement || serviceClass === 'work' || service.isWorkTrain;
        // Initialize onboard counts on first stop
        if (service._onboardPax == null)
            service._onboardPax = 0;
        if (service._onboardFreight == null)
            service._onboardFreight = 0;
        if (service._contractFreight == null)
            service._contractFreight = 0;
        const g = typeof window !== 'undefined' ? window.game : null;
        if (isEmptyMovement) {
            // Repair any legacy/runtime contamination before returning. Release an
            // accidental freight reservation as well so contract stock stays sane.
            g?.freightManager?.finishServiceCargo?.(service);
            service._onboardPax = 0;
            service._onboardPassengerKm = 0;
            service._onboardFreight = 0;
            service._contractFreight = 0;
            service._contractCargoId = '';
        }
        const revenueStops = service.getCurrentStops?.() || service.stops || [];
        const revenueStop = revenueStops[isFirst ? 0 : service.currentStopIndex];
        if (isNonRevenue || revenueStop?.technicalLocationId) {
            // Preserve distance already travelled by through passengers across technical stops.
            if (!isEmptyMovement && !isFirst && distFromPrev > 0)
                service._onboardPassengerKm = Math.max(0, Number(service._onboardPassengerKm) || 0) + service._onboardPax * distFromPrev;
            return;
        }
        const delayTolerance = (typeof window !== 'undefined' ? (window.game?.realismSettings?.delayTolerance ?? 30) : 30);
        const freightAccess = g?.stationUpgrades?.canHandleFreight?.(stationId) !== false;
        let carriedContract = g?.freightManager?.carriedContract(service) || null;
        if (service._contractFreight > 0 && (!carriedContract?.active || !(carriedContract.quantity > 0)) && !service._iteCargoMismatch && freightAccess) {
            const returned = g?.freightManager?.finishServiceCargo(service) || 0;
            if (returned > 0) {
                this.history.push({ type: 'cargo_return', amount: 0, category: 'fret', description: `${stationName}: ${returned} t restituées, contrat interrompu — ${service.name}`, time: this._transactionTime() });
            }
            carriedContract = null;
        }
        if (distFromPrev === 0 && !isFirst)
            return;
        const assignedContract = service.assignedContractId && g?.freightManager?.contracts
            ? g.freightManager.contracts.find((c) => c.id === service.assignedContractId && c.active)
            : null;
        // HOTFIX57 — capacity is cargo-specific. Unrelated wagons do not contribute.
        if (!assignedContract && !service._genericCargoType) {
            service._genericCargoType = g?.freightManager?.getRameCargoTypes?.(service.rame)?.[0] || '';
        }
        const capacityContract = carriedContract || assignedContract;
        let maxFreight = capacityContract
            ? (g?.freightManager?.getRameCargoCapacity?.(service.rame, capacityContract) || 0)
            : (g?.freightManager?.getRameCargoCapacity?.(service.rame, service._genericCargoType) || 0);
        // Section VI — ITE non compatible avec le fret du train : pas de chargement/déchargement
        if (service._iteCargoMismatch || !freightAccess)
            maxFreight = 0;
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
            if (carriedContract?.active && stationId === carriedContract.toId && service._contractFreight > 0 && !service._iteCargoMismatch && freightAccess) {
                contractUnload = service._contractFreight;
                let acceptedUnload = 0;
                if (g?.freightManager?.fulfillAtStation) {
                    const delay = service.train?.delay ?? 0;
                    const isDelayed = delay >= delayTolerance;
                    const isEarly = delay <= -10;
                    const res = g.freightManager.fulfillAtStation(service, stationId, contractUnload, isDelayed, isEarly);
                    acceptedUnload = Math.max(0, contractUnload - Math.max(0, Number(res.remainingTonnes) || 0));
                    contractRevenue = (res.fulfilled || []).reduce((sum, f) => sum + (Number(f.payment) || 0), 0);
                }
                // Never delete cargo merely because we reached the destination. Only the
                // amount that a compatible contract actually accepted leaves the train.
                service._contractFreight = Math.max(0, contractUnload - acceptedUnload);
                if (service._contractFreight === 0)
                    service._contractCargoId = '';
                service._contractDelivered = (service._contractDelivered || 0) + acceptedUnload;
                if (contractRevenue > 0) {
                    this.addRevenue(contractRevenue, 'fret', `${stationName}: contrat ${carriedContract.cargoName} ${acceptedUnload}${carriedContract.unit} — ${service.name}`);
                    if (service.lineId)
                        this.addLineRevenue(service.lineId, contractRevenue);
                }
            }
            const freightUnload = service._iteCargoMismatch || !freightAccess ? 0 : Math.round(service._onboardFreight * freightUnloadRate);
            // Revenue = descended passengers * distance they traveled * ticket price
            // Section X — prix au km différencié selon la classification (vitesse max)
            const maxSpeed = service.rame.maxSpeed || 100;
            const basePricePerKm = this.getPassengerPricePerKm(maxSpeed);
            // RC27 marketing: the commercial policy is intentionally a modest global
            // multiplier. Individual offer targeting is abstracted because passengers
            // are not individually segmented in the simulation.
            const marketingFareMultiplier = Number(g?.marketingManager?.getPassengerFareMultiplier?.()) || 1;
            const pricePerKm = basePricePerKm * Math.max(0.72, Math.min(1.28, marketingFareMultiplier));
            const passengerKm = Math.max(0, Number(service._onboardPassengerKm) || 0) + service._onboardPax * distFromPrev;
            const billedPassengerKm = service._onboardPax > 0 ? passengerKm * paxDescend / service._onboardPax : 0;
            service._onboardPassengerKm = Math.max(0, passengerKm - billedPassengerKm);
            const paxRevenue = Math.round(billedPassengerKm * pricePerKm);
            // Delay penalty: reduce passenger revenue by 25% (contract already penalized in fulfillAtStation)
            if (service.train && service.train.delay >= delayTolerance) {
                const penalty = Math.round(paxRevenue * 0.25);
                if (penalty > 0) {
                    this.addPenalty(penalty, `Retard >${delayTolerance}min ${service.name} @ ${stationName}`);
                    // Book gross revenue and the penalty exactly once (net = 75%).
                }
            }
            if (paxDescend > 0) {
                const satisfaction = passengerSatisfactionScore(service.rame, service.train?.delay, g?.stationUpgrades?.getSatisfactionBonus?.(stationId));
                this.passengerSatisfactionSamples += paxDescend;
                this.passengerSatisfactionPoints += satisfaction * paxDescend;
                this.totalPassengers += paxDescend;
                this.totalTicketsSold += paxDescend;
                this.totalTicketRevenue += paxRevenue;
                if (paxRevenue > 0) {
                    this.addRevenue(paxRevenue, 'voyageurs', `${stationName}: ${paxDescend} desc. (${Math.round(distFromPrev)} km) — ${service.name}`);
                    if (service.lineId)
                        this.addLineRevenue(service.lineId, paxRevenue);
                }
            }
            if (freightUnload > 0) {
                this.totalFreightTonnes += freightUnload;
                const cType = service._genericCargoType || this._rameCargoType(service.rame);
                const cargoTariff = Number(g?.cargoTypes?.getTransportTariffPerTonne?.(cType));
                let genericRevenue = Math.round(freightUnload * (Number.isFinite(cargoTariff) ? Math.max(0, cargoTariff) : 0));
                const isDelayed = (service.train?.delay ?? 0) >= delayTolerance;
                if (isDelayed && genericRevenue > 0)
                    genericRevenue = Math.round(genericRevenue * 0.75); // pénalité retard 25%
                if (genericRevenue > 0) {
                    this.addRevenue(genericRevenue, 'fret', `${stationName}: fret ${cType || 'non typé'} ${freightUnload}t · tarif ${cargoTariff || 0} €/t — ${service.name}`);
                    if (service.lineId)
                        this.addLineRevenue(service.lineId, genericRevenue);
                }
                // Fret hors contrat : statistiques Marchandises uniquement.
                try {
                    if (g?.cargoTypes?.recordContract) {
                        g.cargoTypes.recordContract(cType, freightUnload, genericRevenue, isTerminus);
                        // Generic freight belongs to cargo statistics, not industrial clients.
                    }
                }
                catch (e) { /* graceful */ }
            }
            service._onboardPax -= paxDescend;
            service._onboardFreight -= freightUnload;
        }
        // --- MONTÉE / CHARGEMENT (new passengers/freight board) ---
        if (!isTerminus) {
            // Validate the whole ordered journey again for imported/edited services.
            // An origin can be an intermediate commercial stop, not just stop zero.
            if (freightAccess && assignedContract && stationId === assignedContract.fromId && service._contractFreight === 0 &&
                g?.freightManager?.validateAssignment?.(assignedContract, service).ok) {
                const available = Math.max(0, maxFreight - service._onboardFreight);
                const contractLoad = Number(g.freightManager.reserveForService(assignedContract, service, available)) || 0;
                if (contractLoad > 0) {
                    service._contractFreight = contractLoad;
                }
            }
            const availPaxSlots = maxPax - service._onboardPax;
            const availFreightSlots = Math.max(0, maxFreight - service._onboardFreight - service._contractFreight);
            // Randomized boarding: 30-80% of available slots
            const paxBoardRate = 0.30 + rng.random() * 0.50;
            const frtBoardRate = 0.20 + rng.random() * 0.50;
            const upgradeBonus = Math.max(0, Number(g?.stationUpgrades?.getFrequentationBonus?.(stationId)) || 0);
            const marketingDemandMultiplier = Math.max(0.72, Math.min(1.55, Number(g?.marketingManager?.getPassengerDemandMultiplier?.()) || 1));
            const paxBoard = Math.min(availPaxSlots, Math.round(availPaxSlots * paxBoardRate * (1 + upgradeBonus) * (1 - passengerCleanlinessPenalty(service.rame) / 100) * marketingDemandMultiplier));
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
            if (Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0)
                return e.cargoTypes[0];
        }
        return null;
    }
    processDailyCharges(services, depots, dateKey) {
        if (this.dailyProcessed[dateKey])
            return;
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
            const k = keys.shift();
            if (k !== undefined)
                delete this.dailyProcessed[k];
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
        if (!lineId || amount <= 0)
            return;
        this.lineRevenue[lineId] = (this.lineRevenue[lineId] || 0) + amount;
    }
    addLineExpense(lineId, amount) {
        if (!lineId || amount <= 0)
            return;
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
            history: this.history.map(entry => ({ ...entry })),
            historyVersion: 1,
            historyInheritedTruncation: this.historyInheritedTruncation,
            dailyProcessed: this.dailyProcessed,
            totalPassengers: this.totalPassengers,
            passengerSatisfactionSamples: this.passengerSatisfactionSamples,
            passengerSatisfactionPoints: this.passengerSatisfactionPoints,
            totalFreightTonnes: this.totalFreightTonnes,
            _companyLogo: this._companyLogo || null,
            _lastBulletinDate: this._lastBulletinDate || null,
            revenueByCategory: this.revenueByCategory,
            expenseByCategory: this.expenseByCategory,
            lineRevenue: this.lineRevenue,
            lineExpense: this.lineExpense,
            dailySnapshots: this.dailySnapshots.map(day => ({ ...day })),
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
        if (!s || typeof s !== 'object')
            return;
        const data = s;
        const num = (v, fallback = 0, min = -Infinity, max = Infinity) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
        };
        this.balance = num(data.balance, 50000000000);
        this.revenue = num(data.revenue, 0, 0);
        this.expenses = num(data.expenses, 0, 0);
        this.penalties = num(data.penalties, 0, 0);
        this.ticketPricePerKm = num(data.ticketPricePerKm, 0.12, 0);
        this.freightPricePerTKm = num(data.freightPricePerTKm, 0.08, 0);
        // Backward compat : si passengerPriceByClass n'existe pas, on dérive de l'ancien ticketPricePerKm
        if (data.passengerPriceByClass && typeof data.passengerPriceByClass === 'object' && !Array.isArray(data.passengerPriceByClass)) {
            const savedPrices = data.passengerPriceByClass;
            for (const key of ['slow', 'regional', 'intercity', 'fast', 'tgv']) {
                if (Object.prototype.hasOwnProperty.call(savedPrices, key))
                    this.passengerPriceByClass[key] = num(savedPrices[key], this.passengerPriceByClass[key], 0);
            }
        }
        else if (Object.prototype.hasOwnProperty.call(s, 'ticketPricePerKm')) {
            const base = num(data.ticketPricePerKm, 0.12, 0);
            this.passengerPriceByClass = {
                slow: base * 0.8,
                regional: base * 1.0,
                intercity: base * 1.3,
                fast: base * 1.8,
                tgv: base * 2.5,
            };
        }
        this.history = (Array.isArray(data.history) ? data.history : []).filter((h) => !!h && typeof h === 'object' && !Array.isArray(h) && Number.isFinite(Number(h.amount))).map((h) => ({ ...h, amount: Number(h.amount) }));
        this.historyInheritedTruncation = data.historyVersion !== 1 || data.historyInheritedTruncation === true;
        this.dailyProcessed = (data.dailyProcessed && typeof data.dailyProcessed === 'object' && !Array.isArray(data.dailyProcessed)) ? { ...data.dailyProcessed } : {};
        this.totalPassengers = num(data.totalPassengers, 0, 0);
        this.passengerSatisfactionSamples = num(data.passengerSatisfactionSamples, 0, 0, Number.MAX_SAFE_INTEGER / 100);
        this.passengerSatisfactionPoints = num(data.passengerSatisfactionPoints, 0, 0, this.passengerSatisfactionSamples * 100);
        this.totalFreightTonnes = num(data.totalFreightTonnes, 0, 0);
        this._companyLogo = typeof data._companyLogo === 'string' ? data._companyLogo : null;
        this._lastBulletinDate = typeof data._lastBulletinDate === 'string' ? data._lastBulletinDate : null;
        const numMap = (raw) => Object.fromEntries(Object.entries(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}).map(([k, v]) => [k, num(v, 0)]));
        this.revenueByCategory = numMap(data.revenueByCategory);
        this.expenseByCategory = numMap(data.expenseByCategory);
        this.lineRevenue = numMap(data.lineRevenue);
        this.lineExpense = numMap(data.lineExpense);
        this.dailySnapshots = (Array.isArray(data.dailySnapshots) ? data.dailySnapshots : []).filter((x) => !!x && typeof x === 'object' && !Array.isArray(x)).map((x) => ({
            ...x,
            date: typeof x.date === 'string' ? x.date : '',
            revenue: num(x.revenue, 0), expenses: num(x.expenses, 0), balance: num(x.balance, 0), profit: num(x.profit, 0),
            byCategory: numMap(x.byCategory),
        }));
        this.totalTicketsSold = num(data.totalTicketsSold, 0, 0);
        this.totalTicketRevenue = num(data.totalTicketRevenue, 0, 0);
        this.totalFraudFines = num(data.totalFraudFines, 0, 0);
        this.fraudRate = num(data.fraudRate, 0.05, 0, 1);
        this._currentDayKey = typeof data._currentDayKey === 'string' ? data._currentDayKey : null;
        this._currentDayRevenue = num(data._currentDayRevenue, 0);
        this._currentDayExpenses = num(data._currentDayExpenses, 0);
        this._currentDayByCategory = numMap(data._currentDayByCategory);
    }
}
