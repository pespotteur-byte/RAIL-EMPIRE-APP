let nextDepotId = 1;
let nextRescueId = 1;

export class Depot {
  constructor(data) {
    this.id = data.id || `depot-${nextDepotId++}`;
    this.type = data.type || 'depot'; // depot, ite-fret, ite-industrie, ite-logistique
    this.name = data.name || 'Depot';
    this.stationId = data.stationId || '';
    this.tracks = data.tracks || 4;
    this.cost = data.cost || 50000;
    this.built = data.built || false;
    this.ramesStored = data.ramesStored || [];
    // ITE track footprints: array of { name, length, cargoType }
    this.iteTracks = Array.isArray(data.iteTracks) ? data.iteTracks : [];
    this.iteCargoTypes = data.iteCargoTypes || [];
    // Rescue locomotives: array of { stockId, stockName, deployed }
    this.rescueLocos = (data.rescueLocos || []).map(r => ({
      stockId: r.stockId,
      stockName: r.stockName || '',
      deployed: r.deployed || false,
    }));
  }

  getTypeLabel() {
    const labels = {
      'depot': 'Depot maintenance',
      'ite-fret': 'ITE Fret',
      'ite-industrie': 'ITE Industrie',
      'ite-logistique': 'ITE Logistique',
    };
    return labels[this.type] || this.type;
  }

  getMaintenanceCost() {
    return this.tracks * 200;
  }

  // Can dispatch rescue locomotive (has available non-deployed locos)
  canRescue() {
    return this.type === 'depot' && this.built && this.rescueLocos.some(r => !r.deployed);
  }

  // Get first available rescue loco
  getAvailableRescueLoco() {
    return this.rescueLocos.find(r => !r.deployed);
  }

  // Mark a rescue loco as deployed
  deployRescue(stockId) {
    const loco = this.rescueLocos.find(r => r.stockId === stockId && !r.deployed);
    if (loco) {
      loco.deployed = true;
      return loco;
    }
    return null;
  }

  // Return a rescue loco to depot
  returnRescue(stockId) {
    const loco = this.rescueLocos.find(r => r.stockId === stockId && r.deployed);
    if (loco) loco.deployed = false;
  }
}

export class DepotManager {
  constructor() {
    this.depots = [];
    this.activeRescues = []; // { id, depotId, stockId, stockName, targetServiceId, state, position }
    this.repairQueue = []; // { serviceId, depotId, remainingMin, totalMin, serviceName }
    this.maintenanceQueue = []; // { rameId, depotId, remainingMin, totalMin, rameName }
  }

  add(data, economy) {
    const depot = new Depot(data);
    if (economy && economy.balance >= depot.cost) {
      economy.addExpense(depot.cost, 'construction', `Construction ${depot.name}`);
      depot.built = true;
    } else {
      depot.built = false;
    }
    this.depots.push(depot);
    return depot;
  }

  remove(id) {
    this.depots = this.depots.filter(d => d.id !== id);
  }

  getAll() {
    return this.depots;
  }

  getDepots() {
    return this.depots.filter(d => d.type === 'depot');
  }

  getITEs() {
    return this.depots.filter(d => d.type.startsWith('ite'));
  }

  getByStation(stationId) {
    return this.depots.filter(d => d.stationId === stationId);
  }

  addITETrack(depotId, track) {
    const depot = this.depots.find(d => d.id === depotId);
    if (depot && depot.type.startsWith('ite')) {
      depot.iteTracks.push({ name: track.name, length: track.length, cargoType: track.cargoType });
      return true;
    }
    return false;
  }

  removeITETrack(depotId, index) {
    const depot = this.depots.find(d => d.id === depotId);
    if (depot && depot.type.startsWith('ite')) {
      depot.iteTracks.splice(index, 1);
    }
  }

  getTotalITELength(depotId) {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.iteTracks.reduce((s, t) => s + (Number(t.length) || 0), 0) : 0;
  }

  // Section VI — ITE : récupère le dépôt ITE lié à une gare (s'il existe)
  getITEByStation(stationId) {
    return this.depots.find(d => d.type.startsWith('ite') && d.stationId === stationId) || null;
  }

  // Section VI — longueur utile totale d'un ITE, et nombre de tranches nécessaires
  getITEInfo(stationId, trainLengthM) {
    const ite = this.getITEByStation(stationId);
    if (!ite) return { isITE: false, totalLength: Infinity, trancheCount: 1 };
    const totalLength = ite.iteTracks.reduce((s, t) => s + (Number(t.length) || 0), 0);
    if (totalLength <= 0) return { isITE: true, totalLength: 0, trancheCount: 1 };
    const trancheCount = Math.ceil((trainLengthM || 0) / totalLength);
    return { isITE: true, totalLength, canFit: (trainLengthM || 0) <= totalLength, trancheCount };
  }

  // Add a rescue loco to a depot — max 2 per depot (Annexe 9)
  addRescueLoco(depotId, stockId, stockName) {
    const depot = this.depots.find(d => d.id === depotId);
    if (depot) {
      if (depot.rescueLocos.length >= 2) return false;
      depot.rescueLocos.push({ stockId, stockName, deployed: false });
      return true;
    }
    return false;
  }

  // Remove a rescue loco from a depot
  removeRescueLoco(depotId, stockId) {
    const depot = this.depots.find(d => d.id === depotId);
    if (depot) {
      depot.rescueLocos = depot.rescueLocos.filter(r => r.stockId !== stockId);
    }
  }

  // Find nearest depot that can rescue
  findNearestRescueDepot(world, lat, lon) {
    let best = null, bestDist = Infinity;
    for (const depot of this.depots) {
      if (!depot.canRescue()) continue;
      const station = world.getStationById(depot.stationId);
      if (!station) continue;
      const dLat = (station.lat - lat) * 111;
      const dLon = (station.lon - lon) * 111 * Math.cos(lat * Math.PI / 180);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist < bestDist) { bestDist = dist; best = depot; }
    }
    return best;
  }

  // Dispatch rescue for a broken-down train
  dispatchRescue(world, brokenService) {
    if (!brokenService?.position) return null;
    const depot = this.findNearestRescueDepot(world, brokenService.position.lat, brokenService.position.lon);
    if (!depot) return null;

    const loco = depot.getAvailableRescueLoco();
    if (!loco) return null;

    depot.deployRescue(loco.stockId);

    const station = world.getStationById(depot.stationId);
    const rescue = {
      id: `rescue-${nextRescueId++}`,
      depotId: depot.id,
      stockId: loco.stockId,
      stockName: loco.stockName,
      targetServiceId: brokenService.id,
      state: 'en_route', // en_route -> recovering -> returning
      position: station ? { lat: station.lat, lon: station.lon } : null,
      targetPosition: { lat: brokenService.position.lat, lon: brokenService.position.lon },
      depotPosition: station ? { lat: station.lat, lon: station.lon } : null,
      speed: 0,
      progress: 0,
      route: null,
      routeIndex: 0,
    };
    // Try to find a route via ORM instead of going straight line
    if (station && window.game?.orm) {
      window.game.orm.findRoute(station.lat, station.lon, brokenService.position.lat, brokenService.position.lon)
        .then(route => { if (route && route.length >= 2) rescue.route = route; })
        .catch(() => {});
    }
    this.activeRescues.push(rescue);
    return rescue;
  }

  // Update active rescues (called each move tick)
  updateRescues(dt) {
    for (const rescue of this.activeRescues) {
      if (!rescue.position || !rescue.targetPosition) continue;

      // Section VI/DDS — max 30 km/h à l'approche du train en panne, 10 km/h très proche
      let maxSpeed = 100; // km/h for rescue loco
      const cosLat = Math.cos(rescue.position.lat * Math.PI / 180);
      const dLat = (rescue.targetPosition.lat - rescue.position.lat) * 111;
      const dLon = (rescue.targetPosition.lon - rescue.position.lon) * 111 * cosLat;
      const distToTarget = Math.sqrt(dLat * dLat + dLon * dLon);
      if (distToTarget < 0.5) maxSpeed = 10;
      else if (distToTarget < 2.0) maxSpeed = 30;

      const accel = 2.0; // km/h/s

      if (rescue.state === 'en_route') {
        // Follow route if available, else go straight
        rescue.speed = Math.min(maxSpeed, rescue.speed + accel * dt);
        const stepKm = rescue.speed * dt / 3600;

        if (rescue.route && rescue.route.length >= 2) {
          let remaining = stepKm;
          while (remaining > 0 && rescue.routeIndex < rescue.route.length - 1) {
            const to = rescue.route[rescue.routeIndex + 1];
            const dLat = (to.lat - rescue.position.lat) * 111;
            const dLon = (to.lon - rescue.position.lon) * 111 * Math.cos(rescue.position.lat * Math.PI / 180);
            const distToNext = Math.sqrt(dLat * dLat + dLon * dLon);
            if (distToNext <= 0.001) { rescue.routeIndex++; continue; }
            if (remaining >= distToNext) {
              rescue.position.lat = to.lat;
              rescue.position.lon = to.lon;
              remaining -= distToNext;
              rescue.routeIndex++;
            } else {
              const ratio = remaining / distToNext;
              rescue.position.lat += (to.lat - rescue.position.lat) * ratio;
              rescue.position.lon += (to.lon - rescue.position.lon) * ratio;
              remaining = 0;
            }
          }
          if (rescue.routeIndex >= rescue.route.length - 1) {
            rescue.state = 'recovering';
            rescue.speed = 0;
            rescue._recoverTimer = 5;
          }
        } else {
          const dLat = (rescue.targetPosition.lat - rescue.position.lat) * 111;
          const dLon = (rescue.targetPosition.lon - rescue.position.lon) * 111 * Math.cos(rescue.position.lat * Math.PI / 180);
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          if (dist < 0.5) {
            rescue.state = 'recovering';
            rescue.speed = 0;
            rescue._recoverTimer = 5;
            continue;
          }
          if (dist > 0) {
            const ratio = Math.min(1, stepKm / dist);
            rescue.position.lat += (rescue.targetPosition.lat - rescue.position.lat) * ratio;
            rescue.position.lon += (rescue.targetPosition.lon - rescue.position.lon) * ratio;
          }
        }
      } else if (rescue.state === 'recovering') {
        // dt is in seconds; _recoverTimer is in minutes
        rescue._recoverTimer = (rescue._recoverTimer || 0) - dt / 60;
        if (rescue._recoverTimer <= 0) {
          rescue.state = 'returning';
          rescue.targetPosition = rescue.depotPosition;
          rescue.speed = 0;
          // Build return route (reverse of outbound route)
          if (rescue.route) {
            rescue.returnRoute = [...rescue.route].reverse();
            rescue.routeIndex = 0;
          }
        }
      } else if (rescue.state === 'returning') {
        if (!rescue.depotPosition) { rescue.state = 'done'; continue; }

        rescue.speed = Math.min(60, rescue.speed + accel * dt); // slower on return (towing)
        const stepKm = rescue.speed * dt / 3600;

        if (rescue.returnRoute && rescue.returnRoute.length >= 2) {
          let remaining = stepKm;
          while (remaining > 0 && rescue.routeIndex < rescue.returnRoute.length - 1) {
            const to = rescue.returnRoute[rescue.routeIndex + 1];
            const dLat2 = (to.lat - rescue.position.lat) * 111;
            const dLon2 = (to.lon - rescue.position.lon) * 111 * Math.cos(rescue.position.lat * Math.PI / 180);
            const distToNext = Math.sqrt(dLat2 * dLat2 + dLon2 * dLon2);
            if (distToNext <= 0.001) { rescue.routeIndex++; continue; }
            if (remaining >= distToNext) {
              rescue.position.lat = to.lat;
              rescue.position.lon = to.lon;
              remaining -= distToNext;
              rescue.routeIndex++;
            } else {
              const ratio = remaining / distToNext;
              rescue.position.lat += (to.lat - rescue.position.lat) * ratio;
              rescue.position.lon += (to.lon - rescue.position.lon) * ratio;
              remaining = 0;
            }
          }
          if (rescue.routeIndex >= rescue.returnRoute.length - 1) {
            rescue.state = 'done';
            const depot = this.depots.find(d => d.id === rescue.depotId);
            if (depot) depot.returnRescue(rescue.stockId);
            if (rescue.targetServiceId) {
              this.repairQueue.push({
                serviceId: rescue.targetServiceId,
                depotId: rescue.depotId,
                remainingMin: 30,
                totalMin: 30,
                serviceName: rescue.targetServiceId,
              });
            }
          }
        } else {
          const dLat = (rescue.depotPosition.lat - rescue.position.lat) * 111;
          const dLon = (rescue.depotPosition.lon - rescue.position.lon) * 111 * Math.cos(rescue.position.lat * Math.PI / 180);
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          if (dist < 0.5) {
            rescue.state = 'done';
            const depot = this.depots.find(d => d.id === rescue.depotId);
            if (depot) depot.returnRescue(rescue.stockId);
            if (rescue.targetServiceId) {
              this.repairQueue.push({
                serviceId: rescue.targetServiceId,
                depotId: rescue.depotId,
                remainingMin: 30,
                totalMin: 30,
                serviceName: rescue.targetServiceId,
              });
            }
            continue;
          }
          if (dist > 0) {
            const ratio = Math.min(1, stepKm / dist);
            rescue.position.lat += (rescue.depotPosition.lat - rescue.position.lat) * ratio;
            rescue.position.lon += (rescue.depotPosition.lon - rescue.position.lon) * ratio;
          }
        }
      }
    }

    // Remove completed rescues
    this.activeRescues = this.activeRescues.filter(r => r.state !== 'done');
  }

  // Update repair & maintenance timers (called each minute tick)
  updateRepairs(dt) {
    const step = dt || 1; // 1 minute per tick
    const finished = [];
    for (const r of this.repairQueue) {
      r.remainingMin -= step;
      if (r.remainingMin <= 0) finished.push(r);
    }
    for (const r of finished) {
      this.repairQueue = this.repairQueue.filter(q => q.serviceId !== r.serviceId);
    }
    const finishedM = [];
    for (const m of this.maintenanceQueue) {
      m.remainingMin -= step;
      if (m.remainingMin <= 0) finishedM.push(m);
    }
    for (const m of finishedM) {
      this.maintenanceQueue = this.maintenanceQueue.filter(q => q.rameId !== m.rameId);
    }
    return { repairedIds: finished.map(r => r.serviceId), maintainedIds: finishedM.map(m => m.rameId) };
  }

  // Send a RAME for preventive maintenance
  sendRameToMaintenance(rameId, rameName, depotId) {
    if (this.maintenanceQueue.some(m => m.rameId === rameId)) return false;
    this.maintenanceQueue.push({
      rameId,
      depotId,
      remainingMin: 20, // 20 min for preventive maintenance
      totalMin: 20,
      rameName: rameName || rameId,
    });
    return true;
  }

  isRameInMaintenance(rameId) {
    return this.maintenanceQueue.some(m => m.rameId === rameId);
  }

  getRameMaintenanceInfo(rameId) {
    return this.maintenanceQueue.find(m => m.rameId === rameId) || null;
  }

  isInRepairOrMaintenance(serviceId) {
    return this.repairQueue.some(r => r.serviceId === serviceId);
  }

  getRepairInfo(serviceId) {
    return this.repairQueue.find(r => r.serviceId === serviceId) || null;
  }

  // Get active rescues as pseudo-services for rendering on map
  getRescueServices() {
    return this.activeRescues.filter(r => r.position).map(r => ({
      id: r.id,
      name: r.stockName || 'Secours',
      position: r.position,
      state: 'moving',
      isRescue: true,
      rescueState: r.state,
      train: {
        speed: Math.round(r.speed),
        color: '#ef4444', // red for rescue
        stoppedAt: null,
        incident: null,
        delay: 0,
        seriesName: '',
        number: '',
        platform: null,
      },
    }));
  }

  toSave() {
    return {
      depots: this.depots.map(d => ({
        id: d.id,
        type: d.type,
        name: d.name,
        stationId: d.stationId,
        tracks: d.tracks,
        cost: d.cost,
        built: d.built,
        ramesStored: d.ramesStored,
        iteTracks: d.iteTracks,
        iteCargoTypes: d.iteCargoTypes,
        rescueLocos: d.rescueLocos,
      })),
      activeRescues: this.activeRescues,
      repairQueue: this.repairQueue,
      maintenanceQueue: this.maintenanceQueue,
    };
  }

  loadFromSave(data) {
    this.depots = [];
    this.activeRescues = [];

    // Support both old format (array) and new format (object with depots + activeRescues)
    const arr = Array.isArray(data) ? data : (data.depots || []);
    for (const d of arr) {
      this.depots.push(new Depot(d));
      const num = parseInt(d.id?.split('-')[1] || '0');
      if (num >= nextDepotId) nextDepotId = num + 1;
    }

    if (!Array.isArray(data) && data.activeRescues) {
      this.activeRescues = data.activeRescues;
      for (const r of this.activeRescues) {
        const num = parseInt(r.id?.split('-')[1] || '0');
        if (num >= nextRescueId) nextRescueId = num + 1;
      }
    }
    if (!Array.isArray(data) && data.maintenanceQueue) {
      // Migrate old format (serviceId) to new format (rameId)
      this.maintenanceQueue = data.maintenanceQueue
        .filter(m => (m.remainingMin || 0) > 0) // skip finished entries
        .map(m => ({
          rameId: m.rameId || m.serviceId || '',
          depotId: m.depotId,
          remainingMin: Math.max(0, m.remainingMin || 0),
          totalMin: m.totalMin || 20,
          rameName: m.rameName || m.serviceName || '',
        }));
    } else {
      this.maintenanceQueue = [];
    }
    if (!Array.isArray(data) && data.repairQueue) {
      this.repairQueue = data.repairQueue
        .filter(r => (r.remainingMin || 0) > 0)
        .map(r => ({
          serviceId: r.serviceId || '',
          depotId: r.depotId,
          remainingMin: Math.max(0, r.remainingMin || 0),
          totalMin: r.totalMin || 30,
          serviceName: r.serviceName || '',
        }));
    } else {
      this.repairQueue = [];
    }
  }
}
