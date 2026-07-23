import { getGlobalRng } from './rng.js?v=1784772848';

let nextContractId = 1;

export class FreightContract {
  constructor(data) {
    this.id = data.id || `fret-${nextContractId++}`;
    this.cargoType = data.cargoType || 'containers-20';
    // FRT-01 : MLMC (diffus) = plusieurs types de wagons acceptés
    this.diffuse = data.diffuse || false;
    this.cargoTypes = data.cargoTypes || (data.cargoType ? [data.cargoType] : []);
    this.cargoName = data.cargoName || 'Conteneurs';
    this.quantity = data.quantity || 50;
    this.unit = data.unit || 't';
    this.from = data.from || '';
    this.fromId = data.fromId || '';
    this.to = data.to || '';
    this.toId = data.toId || '';
    this.payment = data.payment || 5000;
    this.unitPrice = data.unitPrice || (data.quantity ? data.payment / data.quantity : 0);
    this.active = data.active !== false;
    this.progress = data.progress || 0;
    this.industrialClientId = data.industrialClientId || null;
  }
}

export class FreightManager {
  constructor() {
    this.contracts = [];
    this.lastGenTime = 0;
  }

  maybeGenerate(stations, absTime, cargoTypes, industrialClients) {
    if (absTime < this.lastGenTime) this.lastGenTime = 0;
    if (absTime - this.lastGenTime < 120) return;
    this.lastGenTime = absTime;

    if (!stations || stations.length < 2) return;
    if (this.contracts.filter(c => c.active && !c.industrialClientId).length >= 12) return;
    const rng = getGlobalRng();
    if (rng.random() > 0.3) return;

    // Use CargoTypeManager if available, otherwise fallback
    const allTypes = cargoTypes?.getAllTypes?.() || [];
    if (allTypes.length === 0) return;

    const cargo = allTypes[Math.floor(rng.random() * allTypes.length)];
    const quantity = 20 + Math.floor(rng.random() * 500);
    const from = stations[Math.floor(rng.random() * stations.length)];
    const others = stations.filter(s => s.id !== from.id);
    if (others.length === 0) return;
    const to = others[Math.floor(rng.random() * others.length)];

    const payment = quantity * cargo.pricePerUnit;
    // FRT-01 : 20 % des contrats générés sont diffus (MLMC) — plusieurs types de wagons
    const isDiffuse = rng.random() < 0.2;
    this.contracts.push(new FreightContract({
      cargoType: cargo.type,
      cargoName: isDiffuse ? `${cargo.name} (MLMC)` : cargo.name,
      diffuse: isDiffuse,
      cargoTypes: isDiffuse ? allTypes.filter(ct => ct.category === cargo.category).map(ct => ct.type) : [cargo.type],
      quantity,
      unit: cargo.unit,
      from: from.name,
      fromId: from.id,
      to: to.name,
      toId: to.id,
      payment,
    }));

    // Non-ITE freight (incl. custom cargo categories like "Cargo") feeds the
    // Marchandises page stats and the Industrie page totals, just like ITE
    // contracts already do at generation time.
    try { cargoTypes?.recordContract?.(cargo.type, quantity, payment); } catch (e) { /* graceful */ }
    if (industrialClients?.stats) {
      industrialClients.stats.contractsGenerated++;
      industrialClients.stats.totalTonnage += quantity;
      industrialClients.stats.totalRevenue += payment;
    }
  }

  toSave() {
    return this.contracts.map(c => ({
      id: c.id,
      cargoType: c.cargoType,
      diffuse: c.diffuse || false,
      cargoTypes: c.cargoTypes || (c.cargoType ? [c.cargoType] : []),
      cargoName: c.cargoName,
      quantity: c.quantity,
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
    }));
  }

  // Section X — résolution des contrats fret lors d'un arrêt en gare ITE/destination
  // Renvoie { fulfilled: [...], remainingTonnes }
  fulfillAtStation(service, stationId, freightUnload, isDelayed = false, isEarly = false) {
    const g = typeof window !== 'undefined' ? window.game : null;
    if (!g || !service?.rame || !stationId || freightUnload <= 0) return { fulfilled: [], remainingTonnes: freightUnload };

    // Représente le type de fret du convoi (premier cargo trouvé dans les wagons)
    let rameCargoType = service.rame.elementDetails?.find(e =>
      Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0
    )?.cargoTypes?.[0];
    if (!rameCargoType) rameCargoType = 'containers-20';

    let remaining = freightUnload;
    const fulfilled = [];

    const matchCargo = (contract, type) => {
      if (contract.diffuse && Array.isArray(contract.cargoTypes)) {
        return contract.cargoTypes.includes(type) || contract.cargoTypes.some(ct => type?.startsWith(ct?.split('-')[0]));
      }
      return contract.cargoType === type || contract.cargoType?.startsWith(type?.split('-')[0]);
    };

    const tryFulfill = (c, matchType = rameCargoType) => {
      if (!c || !c.active || c.toId !== stationId) return false;
      if (!matchCargo(c, matchType)) return false;
      if (remaining <= 0) return false;
      const qty = Math.min(remaining, c.quantity);
      c.quantity -= qty;
      remaining -= qty;
      if (c.quantity <= 0) {
        c.active = false;
        c.progress = 1;
      } else {
        c.progress = (c.payment - (c.quantity * (c.unitPrice || (c.payment / (c.quantity + qty || 1))))) / c.payment;
      }
      let payment = Math.round(qty * (c.payment / (c.quantity + qty || 1)));
      if (isDelayed && payment > 0) payment = Math.round(payment * 0.75); // pénalité retard 25%
      fulfilled.push({ id: c.id, quantity: qty, payment });

      if (c.quantity <= 0 && c.industrialClientId) {
        const client = g.industrialClients?.clients?.find(cl => cl.id === c.industrialClientId);
        if (client) {
          const delta = isDelayed ? -5 : (isEarly ? +8 : +5);
          client.satisfaction = Math.min(100, Math.max(0, (client.satisfaction || 80) + delta));
          // FRT-02 : qualité de service influe sur la part de marché
          const shareDelta = isDelayed ? -1 : (isEarly ? +1.5 : +0.5);
          client.marketShare = Math.min(100, Math.max(0, (client.marketShare || 5) + shareDelta));
        }
      }
      return true;
    };

    // Priorité au contrat explicitement assigné à ce service
    if (service.assignedContractId) {
      const assigned = this.contracts.find(c => c.id === service.assignedContractId);
      if (assigned) {
        if (assigned.diffuse) {
          // FRT-01 : MLMC = chaque wagon avec son type de fret
          for (const e of service.rame.elementDetails || []) {
            if (remaining <= 0) break;
            const wagonCargo = Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0 ? e.cargoTypes[0] : rameCargoType;
            for (const c of this.contracts) {
              if (c.id !== assigned.id || c.toId !== stationId) continue;
              if (tryFulfill(c, wagonCargo)) break;
            }
          }
        } else {
          tryFulfill(assigned);
        }
      }
    }

    // Puis écoulement automatique sur les autres contrats compatibles
    for (const c of this.contracts) {
      if (remaining <= 0) break;
      if (service.assignedContractId && c.id === service.assignedContractId) continue;
      if (c.diffuse) {
        for (const e of service.rame.elementDetails || []) {
          if (remaining <= 0) break;
          const wagonCargo = Array.isArray(e.cargoTypes) && e.cargoTypes.length > 0 ? e.cargoTypes[0] : rameCargoType;
          tryFulfill(c, wagonCargo);
        }
      } else {
        tryFulfill(c);
      }
    }
    return { fulfilled, remainingTonnes: remaining };
  }

  getAllActive() {
    return this.contracts.filter(c => c.active);
  }

  addContract(data) {
    const c = new FreightContract(data);
    this.contracts.push(c);
    return c;
  }

  removeContract(id) {
    this.contracts = this.contracts.filter(c => c.id !== id);
  }

  loadFromSave(arr) {
    this.contracts = arr.map(d => {
      const c = new FreightContract(d);
      const num = parseInt(d.id?.replace('fret-', '').replace('fret-ind-', '') || '0');
      if (num >= nextContractId) nextContractId = num + 1;
      return c;
    });
  }
}
