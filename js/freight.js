import { getGlobalRng } from './rng.js';
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
let nextContractId = 1;
export class FreightContract {
    constructor(data) {
        this.removeWhenSettled = data.removeWhenSettled === true;
        this.loadedByService = Object.create(null);
        if (isRecord(data.loadedByService)) {
            for (const [key, qty] of Object.entries(data.loadedByService)) {
                if (Number.isFinite(Number(qty)) && Number(qty) > 0)
                    this.loadedByService[key] = Number(qty);
            }
        }
        const rawId = data?.id == null ? '' : String(data.id).trim();
        this.id = rawId || `fret-${nextContractId++}`;
        this.cargoType = typeof data?.cargoType === 'string' && data.cargoType.trim() ? data.cargoType.trim() : '';
        // FRT-01 : MLMC (diffus) = plusieurs types de wagons acceptés
        this.diffuse = data.diffuse === true;
        this.cargoTypes = [...new Set((Array.isArray(data.cargoTypes) ? data.cargoTypes : (data.cargoType ? [data.cargoType] : [])).filter((x) => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()))];
        if (!this.cargoTypes.length)
            this.cargoTypes = [this.cargoType];
        this.cargoName = typeof data.cargoName === 'string' && data.cargoName.trim() ? data.cargoName.trim() : (this.cargoType || 'Fret');
        const qty = Number(data.quantity);
        this.quantity = Number.isFinite(qty) && qty >= 0 ? qty : 0;
        const initQty = Number(data.initialQuantity);
        this.initialQuantity = Number.isFinite(initQty) && initQty > 0 ? Math.max(initQty, this.quantity) : Math.max(this.quantity, 1);
        this.unit = typeof data.unit === 'string' && data.unit.trim() ? data.unit.trim() : 't';
        this.from = data.from == null ? '' : String(data.from);
        this.fromId = data.fromId == null ? '' : String(data.fromId);
        this.to = data.to == null ? '' : String(data.to);
        this.toId = data.toId == null ? '' : String(data.toId);
        const payment = Number(data.payment);
        this.payment = Number.isFinite(payment) && payment >= 0 ? payment : 0;
        const unitPrice = Number(data.unitPrice);
        this.unitPrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : (this.initialQuantity > 0 ? this.payment / this.initialQuantity : 0);
        this.active = data.active !== false && this.quantity > 0;
        // Old saves may contain distance-based or "half loaded" progress.
        // Quantities, not that obsolete display value, are authoritative.
        this.industrialClientId = data.industrialClientId == null || data.industrialClientId === '' ? null : String(data.industrialClientId);
    }
    get deliveredQuantity() {
        return Math.max(0, this.initialQuantity - Math.max(0, this.quantity));
    }
    get inTransitQuantity() {
        return Math.min(Math.max(0, this.quantity), Object.values(this.loadedByService)
            .reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0));
    }
    get progress() {
        return this.initialQuantity > 0 ? Math.max(0, Math.min(1, this.deliveredQuantity / this.initialQuantity)) : 0;
    }
}
export class FreightManager {
    constructor() {
        this.contracts = [];
        this.lastGenTime = 0;
    }
    maybeGenerate(stations, absTime, cargoTypes, industrialClients) {
        absTime = Number(absTime);
        if (!Number.isFinite(absTime) || absTime < 0)
            return;
        if (absTime < this.lastGenTime)
            this.lastGenTime = 0;
        if (absTime - this.lastGenTime < 120)
            return;
        this.lastGenTime = absTime;
        const usableStations = (Array.isArray(stations) ? stations : []).filter((st) => st && st.id && st.closed !== true && Number.isFinite(Number(st.lat)) && Number.isFinite(Number(st.lon)));
        if (usableStations.length < 2)
            return;
        if (this.contracts.filter((c) => c.active && !c.industrialClientId).length >= 12)
            return;
        const rng = getGlobalRng();
        if (rng.random() > 0.3)
            return;
        // Use CargoTypeManager if available, otherwise fallback
        const allTypes = cargoTypes?.getAllTypes?.() || [];
        if (allTypes.length === 0)
            return;
        const cargo = allTypes[Math.floor(rng.random() * allTypes.length)];
        const quantity = 20 + Math.floor(rng.random() * 500);
        const from = usableStations[Math.floor(rng.random() * usableStations.length)];
        const others = usableStations.filter((s) => s.id !== from.id);
        if (others.length === 0)
            return;
        const to = others[Math.floor(rng.random() * others.length)];
        const payment = quantity * cargo.pricePerUnit;
        // FRT-01 : 20 % des contrats générés sont diffus (MLMC) — plusieurs types de wagons
        const isDiffuse = rng.random() < 0.2;
        this.contracts.push(new FreightContract({
            cargoType: cargo.type,
            cargoName: isDiffuse ? `${cargo.name} (MLMC)` : cargo.name,
            diffuse: isDiffuse,
            cargoTypes: isDiffuse ? allTypes.filter((ct) => ct.category === cargo.category).map((ct) => ct.type) : [cargo.type],
            quantity,
            unit: 't',
            from: from.name,
            fromId: from.id,
            to: to.name,
            toId: to.id,
            payment,
        }));
        // Generic offers do not belong to the Industriels statistics. Industry
        // counters are updated only by contracts actually generated for a client.
    }
    /** A contract is an ordered commercial journey, not only a compatible wagon.
     * Intermediate loading is allowed, but passing/technical points do not count.
     * Routing itself remains the Schedule Creator's responsibility.
     */
    validateAssignment(contract, service) {
        const result = { ok: false, code: '', message: '', originIndex: -1, destinationIndex: -1, capacity: 0 };
        const fail = (code, message) => ({ ...result, code, message });
        if (!contract || !contract.active || !(contract.quantity > 0))
            return fail('CONTRACT_INACTIVE', 'Ce contrat n’est plus actif.');
        if (service?.isWorkTrain || ['w', 'hlp', 'tm', 'evo', 'work'].includes(String(service?.serviceType || '').toLowerCase()))
            return fail('NON_COMMERCIAL_SERVICE', 'Ce type de service ne peut pas transporter un contrat commercial.');
        result.capacity = this.getRameCargoCapacity(service?.rame, contract);
        if (!(result.capacity > 0))
            return fail('CARGO_INCOMPATIBLE', 'Aucun wagon de la rame ne peut charger cette marchandise.');
        const stops = service?.getCurrentStops?.() || service?.stops || [];
        const commercial = (stop) => !!stop && !stop.technicalLocationId && (!stop.type || stop.type === 'arret');
        result.originIndex = stops.findIndex(stop => commercial(stop) && String(stop.stationId ?? '') === contract.fromId);
        if (!contract.fromId || result.originIndex < 0)
            return fail('ORIGIN_NOT_SERVED', `Le service doit s’arrêter à l’origine du contrat : ${contract.from || contract.fromId}.`);
        result.destinationIndex = stops.findIndex((stop, i) => i > result.originIndex && commercial(stop) && String(stop.stationId ?? '') === contract.toId);
        if (!contract.toId || result.destinationIndex < 0)
            return fail('DESTINATION_NOT_SERVED_AFTER_ORIGIN', `Le service doit s’arrêter à ${contract.to || contract.toId} après le chargement à ${contract.from || contract.fromId}.`);
        return { ...result, ok: true, code: 'OK', message: '' };
    }
    reserveForService(contract, service, capacity) {
        const id = service.id == null ? '' : String(service.id);
        if (!id || !contract?.active || !Number.isFinite(capacity) || capacity <= 0)
            return 0;
        const carried = this.carriedContract(service);
        if (Number(service._contractFreight) > 0 && carried?.id !== contract.id)
            return 0;
        const existing = Math.max(0, Number(contract.loadedByService[id]) || 0);
        const reserved = Object.values(contract.loadedByService).reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0);
        const amount = Math.min(capacity, Math.max(0, contract.quantity - reserved + existing));
        if (amount > 0) {
            contract.loadedByService[id] = amount;
            service._contractCargoId = contract.id;
        }
        return amount;
    }
    releaseForService(serviceId) {
        const id = String(serviceId ?? '');
        for (const contract of this.contracts)
            delete contract.loadedByService[id];
        this._pruneSettledRemovals();
    }
    /** The cargo's owner is independent of a newly edited service assignment. */
    carriedContract(service) {
        const explicit = String(service._contractCargoId || service.contractCargoId || '');
        if (explicit)
            return this.contracts.find(c => c.id === explicit) || null;
        const id = String(service.id ?? '');
        const held = this.contracts.filter(c => Number(c.loadedByService[id]) > 0);
        const assigned = String(service.assignedContractId || '');
        const contract = held.find(c => c.id === assigned) || (held.length === 1 ? held[0] : null)
            || this.contracts.find(c => c.id === assigned) || null;
        if (contract && Number(service._contractFreight ?? service.contractFreight) > 0) {
            if ('_contractFreight' in service)
                service._contractCargoId = contract.id;
            else
                service.contractCargoId = contract.id;
        }
        return contract;
    }
    /** Return/unload an unfulfilled consignment. This is NOT a delivery: no
     * quantity/progress, revenue, industrial satisfaction or generic cargo change.
     * Used at the next usable commercial stop of an interrupted contract, or
     * when its service is removed/finally completed. Idempotent after reload.
     */
    finishServiceCargo(service) {
        const value = Number(service._contractFreight ?? service.contractFreight);
        const quantity = Number.isFinite(value) ? Math.max(0, value) : 0;
        if ('contractFreight' in service)
            service.contractFreight = 0;
        if ('contractCargoId' in service)
            service.contractCargoId = '';
        service._contractFreight = 0;
        service._contractCargoId = '';
        this.releaseForService(service.id);
        return quantity;
    }
    _pruneSettledRemovals() {
        this.contracts = this.contracts.filter(c => !c.removeWhenSettled || c.inTransitQuantity > 0);
    }
    /** Reconcile saved/live reservations only once all carrier snapshots exist.
     * Pending V2 snapshots count as carriers before compilation. Live instances
     * take precedence. This prevents both orphan stock and early release on F5.
     */
    reconcileReservations(services, pending = []) {
        const carriers = new Map();
        for (const source of [pending, services])
            for (const carrier of source) {
                const id = String(carrier?.id ?? '');
                if (id)
                    carriers.set(id, carrier);
            }
        const desired = new Map();
        for (const [id, carrier] of carriers) {
            if (carrier.completed || carrier.cancelled || ['completed', 'cancelled'].includes(String(carrier.state))) {
                this.finishServiceCargo(carrier);
                continue;
            }
            const quantity = Number(carrier._contractFreight ?? carrier.contractFreight);
            if (!Number.isFinite(quantity) || quantity <= 0)
                continue;
            const contract = this.carriedContract(carrier);
            if (!contract)
                continue; // An old orphan is returned at its next stop.
            let entries = desired.get(contract.id);
            if (!entries) {
                entries = new Map();
                desired.set(contract.id, entries);
            }
            entries.set(id, quantity);
        }
        for (const c of this.contracts) {
            const ledger = Object.create(null);
            let available = Math.max(0, c.quantity);
            for (const [id, quantity] of desired.get(c.id) || []) {
                const held = Math.min(available, quantity);
                if (held > 0)
                    ledger[id] = held;
                available -= held;
            }
            c.loadedByService = ledger;
        }
        this._pruneSettledRemovals();
    }
    toSave() {
        return this.contracts.map((c) => ({
            id: c.id,
            cargoType: c.cargoType,
            diffuse: c.diffuse || false,
            cargoTypes: c.cargoTypes || (c.cargoType ? [c.cargoType] : []),
            cargoName: c.cargoName,
            quantity: c.quantity,
            initialQuantity: c.initialQuantity,
            unit: c.unit,
            from: c.from,
            fromId: c.fromId,
            to: c.to,
            toId: c.toId,
            payment: c.payment,
            unitPrice: c.unitPrice,
            active: c.active,
            progress: c.progress,
            industrialClientId: c.industrialClientId || null,
            loadedByService: { ...c.loadedByService },
            removeWhenSettled: c.removeWhenSettled,
        }));
    }
    _contractMatchesCargo(contract, type) {
        if (!contract || !type)
            return false;
        if (contract.diffuse && Array.isArray(contract.cargoTypes)) {
            return contract.cargoTypes.includes(type) || contract.cargoTypes.some((ct) => type?.startsWith(String(ct || '').split('-')[0]));
        }
        return contract.cargoType === type || contract.cargoType?.startsWith(String(type).split('-')[0]);
    }
    getRameCargoTypes(rame) {
        const out = new Set();
        for (const e of rame?.elementDetails || []) {
            if (String(e?.category || '').toLowerCase() !== 'wagon')
                continue;
            if (!(Number(e?.freightCapacity) > 0))
                continue;
            for (const t of Array.isArray(e?.cargoTypes) ? e.cargoTypes : [])
                if (t)
                    out.add(t);
        }
        return [...out];
    }
    // Payload usable for ONE cargo/contract, not the total capacity of unrelated wagons.
    // This prevents e.g. one coal hopper + twenty tank wagons from advertising the
    // capacity of all 21 wagons for a coal contract.
    getRameCargoCapacity(rame, cargoOrContract) {
        const contract = cargoOrContract && typeof cargoOrContract === 'object' ? cargoOrContract : null;
        const type = contract ? null : String(cargoOrContract || '');
        let total = 0;
        for (const e of rame?.elementDetails || []) {
            if (String(e?.category || '').toLowerCase() !== 'wagon')
                continue;
            const cap = Number(e?.freightCapacity);
            if (!(Number.isFinite(cap) && cap > 0))
                continue;
            const types = Array.isArray(e?.cargoTypes) ? e.cargoTypes.filter(Boolean) : [];
            if (!types.length)
                continue;
            const compatible = contract
                ? types.some((t) => this._contractMatchesCargo(contract, String(t)))
                : types.some((t) => t === type || t.startsWith(String(type).split('-')[0]) || String(type || '').startsWith(t.split('-')[0]));
            if (compatible)
                total += cap;
        }
        return total;
    }
    isContractCompatibleWithRame(contract, rame) {
        return this.getRameCargoCapacity(rame, contract) > 0;
    }
    cancelContractsForIndustrialClient(clientId) {
        clientId = String(clientId ?? '');
        let n = 0;
        for (const c of this.contracts)
            if (c?.industrialClientId === clientId && c.active) {
                c.active = false;
                n++;
            }
        return n;
    }
    pruneIndustrialClientContracts(validClientIds = []) {
        const valid = new Set(Array.isArray(validClientIds) ? validClientIds.filter((x) => x != null && x !== '').map(String) : []);
        let n = 0;
        for (const c of this.contracts) {
            if (c?.industrialClientId && !valid.has(c.industrialClientId) && c.active) {
                c.active = false;
                n++;
            }
        }
        return n;
    }
    // Section X — résolution des contrats fret lors d'un arrêt en gare ITE/destination
    // Renvoie { fulfilled: [...], remainingTonnes }
    fulfillAtStation(service, stationId, freightUnload, isDelayed = false, isEarly = false) {
        const g = typeof window !== 'undefined' ? window.game : null;
        stationId = stationId == null ? '' : String(stationId);
        const unload = Number(freightUnload);
        if (!g || !service?.rame || !stationId || !Number.isFinite(unload) || unload <= 0)
            return { fulfilled: [], remainingTonnes: Number.isFinite(unload) && unload > 0 ? unload : 0 };
        // Représente le type de fret du convoi (premier cargo trouvé dans les wagons)
        let rameCargoType = service.rame.elementDetails?.find((e) => Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0)?.cargoTypes?.[0];
        // Never invent a cargo type for an empty/unknown consist. The historical
        // containers-20 fallback allowed an empty freight train to satisfy contracts.
        if (!rameCargoType)
            return { fulfilled: [], remainingTonnes: freightUnload };
        let remaining = unload;
        const fulfilled = [];
        const tryFulfill = (c, matchType = String(rameCargoType)) => {
            if (!c || !c.active || c.toId !== stationId)
                return false;
            if (!this._contractMatchesCargo(c, matchType))
                return false;
            if (remaining <= 0)
                return false;
            const serviceId = String(service.id ?? '');
            const own = Math.max(0, Number(c.loadedByService[serviceId]) || 0);
            const reserved = Object.values(c.loadedByService).reduce((sum, qty) => sum + Math.max(0, Number(qty) || 0), 0);
            const qty = Math.min(remaining, Math.max(0, c.quantity - reserved + own));
            if (qty <= 0)
                return false;
            if (own > 0) {
                const left = Math.max(0, own - qty);
                if (left > 0)
                    c.loadedByService[serviceId] = left;
                else
                    delete c.loadedByService[serviceId];
            }
            c.quantity -= qty;
            remaining -= qty;
            if (c.quantity <= 0) {
                c.active = false;
            }
            else {
                const initial = Math.max(Number(c.initialQuantity) || (c.quantity + qty), c.quantity + qty, 1);
                c.initialQuantity = initial;
            }
            // Unit price is immutable across partial unloads. Recomputing it from the
            // shrinking remaining quantity overpaid contracts delivered in several trips.
            let payment = Math.round(qty * Math.max(0, Number(c.unitPrice) || 0));
            if (isDelayed && payment > 0)
                payment = Math.round(payment * 0.75); // pénalité retard 25%
            fulfilled.push({ id: c.id, quantity: qty, payment });
            try {
                g.cargoTypes?.recordContract?.(c.cargoType || matchType, qty, payment, c.quantity <= 0);
            }
            catch (e) { /* stats must never break an arrival */ }
            if (c.industrialClientId) {
                const client = g.industrialClients?.clients?.find((cl) => cl.id === c.industrialClientId);
                if (client) {
                    client.totalTonnage = Math.max(0, Number(client.totalTonnage) || 0) + qty;
                    client.totalRevenue = Math.max(0, Number(client.totalRevenue) || 0) + payment;
                    if (g.industrialClients?.stats) {
                        g.industrialClients.stats.totalTonnage = Math.max(0, Number(g.industrialClients.stats.totalTonnage) || 0) + qty;
                        g.industrialClients.stats.totalRevenue = Math.max(0, Number(g.industrialClients.stats.totalRevenue) || 0) + payment;
                    }
                }
            }
            if (c.quantity <= 0 && c.industrialClientId) {
                const client = g.industrialClients?.clients?.find((cl) => cl.id === c.industrialClientId);
                if (client) {
                    const delta = isDelayed ? -5 : (isEarly ? +8 : +5);
                    const currentSat = Number.isFinite(Number(client.satisfaction)) ? Number(client.satisfaction) : 80;
                    client.satisfaction = Math.min(100, Math.max(0, currentSat + delta));
                    // FRT-02 : qualité de service influe sur la part de marché
                    const shareDelta = isDelayed ? -1 : (isEarly ? +1.5 : +0.5);
                    const currentShare = Number.isFinite(Number(client.marketShare)) ? Number(client.marketShare) : 5;
                    client.marketShare = Math.min(100, Math.max(0, currentShare + shareDelta));
                }
            }
            return true;
        };
        // Priorité au contrat explicitement assigné à ce service
        const cargoId = String(service._contractCargoId || service.assignedContractId || '');
        if (cargoId) {
            const assignedId = cargoId;
            const assigned = this.contracts.find((c) => c.id === assignedId);
            if (assigned) {
                if (assigned.diffuse) {
                    // FRT-01 : MLMC = chaque wagon avec son type de fret
                    for (const e of service.rame.elementDetails || []) {
                        if (remaining <= 0)
                            break;
                        const wagonCargo = Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0 ? e.cargoTypes[0] : rameCargoType;
                        for (const c of this.contracts) {
                            if (c.id !== assigned.id || c.toId !== stationId)
                                continue;
                            if (tryFulfill(c, wagonCargo))
                                break;
                        }
                    }
                }
                else {
                    if (this.isContractCompatibleWithRame(assigned, service.rame))
                        tryFulfill(assigned, assigned.cargoType);
                }
            }
            // Assigned/carried freight cannot silently fulfil another customer,
            // even if the original contract was removed or no longer accepts it.
            return { fulfilled, remainingTonnes: remaining };
        }
        // Puis écoulement automatique sur les autres contrats compatibles
        for (const c of this.contracts) {
            if (remaining <= 0)
                break;
            if (service.assignedContractId != null && c.id === String(service.assignedContractId))
                continue;
            if (c.diffuse) {
                for (const e of service.rame.elementDetails || []) {
                    if (remaining <= 0)
                        break;
                    const wagonCargo = Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0 ? e.cargoTypes[0] : rameCargoType;
                    tryFulfill(c, wagonCargo);
                }
            }
            else {
                tryFulfill(c);
            }
        }
        return { fulfilled, remainingTonnes: remaining };
    }
    getAllActive() {
        return this.contracts.filter((c) => c.active);
    }
    addContract(data) {
        if (!isRecord(data))
            return null;
        const hasCargo = typeof data.cargoType === 'string' && data.cargoType.trim();
        const hasDiffuse = data.diffuse === true && Array.isArray(data.cargoTypes) && data.cargoTypes.some((x) => typeof x === 'string' && x.trim());
        if (!hasCargo && !hasDiffuse)
            return null;
        const c = new FreightContract(data);
        if (this.contracts.some((x) => x.id === c.id))
            return null;
        this.contracts.push(c);
        return c;
    }
    removeContract(id) {
        id = String(id ?? '');
        const contract = this.contracts.find(c => c.id === id);
        if (!contract)
            return;
        contract.active = false;
        contract.removeWhenSettled = true;
        // Keep a tombstone while its cargo is physically on a service.
        this._pruneSettledRemovals();
    }
    loadFromSave(arr) {
        const seen = new Set();
        this.contracts = [];
        for (const raw of Array.isArray(arr) ? arr : []) {
            if (!isRecord(raw))
                continue;
            const d = raw;
            if (d.cargoType != null && typeof d.cargoType !== 'string')
                continue;
            const hasCargo = typeof d.cargoType === 'string' && d.cargoType.trim();
            const hasDiffuse = d.diffuse === true && Array.isArray(d.cargoTypes) && d.cargoTypes.some((x) => typeof x === 'string' && x.trim());
            if (!hasCargo && !hasDiffuse)
                continue;
            const normalized = { ...d, id: d.id == null ? '' : String(d.id), fromId: d.fromId == null ? '' : String(d.fromId), toId: d.toId == null ? '' : String(d.toId), industrialClientId: d.industrialClientId == null ? null : String(d.industrialClientId) };
            const c = new FreightContract(normalized);
            if (!c.id || typeof c.id !== 'string' || seen.has(c.id))
                continue;
            seen.add(c.id);
            const num = parseInt(String(c.id).replace('fret-ind-', '').replace('fret-', ''), 10);
            if (Number.isFinite(num) && num >= nextContractId)
                nextContractId = num + 1;
            this.contracts.push(c);
        }
    }
}
