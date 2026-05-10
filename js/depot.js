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
    this.maintenanceQueue = []; // { serviceId, depotId, remainingMin, totalMin, serviceName }
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

  // Add a rescue loco to a depot
  addRescueLoco(depotId, stockId, stockName) {
    const depot = this.depots.find(d => d.id === depotId);
    if (depot) {
      depot.rescueLocos.push({ stockId, stockName, deployed: false });
    }
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

      const maxSpeed = 100; // km/h for rescue loco
      const accel = 2.0; // km/h/s

      if (rescue.state === 'en_route') {
        // Follow route if available, else go straight
        rescue.speed = Math.min(maxSpeed, rescue.speed + accel * dt);
        const stepKm = rescue.speed * dt / 3600;

        if (rescue.route && rescue.route.length >= 2) {
          let remaining = stepKm;
          while (remaining > 0 && rescue.routeIndex < rescue.route.length - 1) {
            const from = rescue.route[rescue.routeIndex];
            const to = rescue.route[rescue.routeIndex + 1];
            const dLat = (to.lat - from.lat) * 111;
            const dLon = (to.lon - from.lon) * 111 * Math.cos(from.lat * Math.PI / 180);
            const segDist = Math.sqrt(dLat * dLat + dLon * dLon);
            if (segDist <= 0) { rescue.routeIndex++; continue; }
            if (remaining >= segDist) {
              rescue.position.lat = to.lat;
              rescue.position.lon = to.lon;
              remaining -= segDist;
              rescue.routeIndex++;
            } else {
              const ratio = remaining / segDist;
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
            const from = rescue.returnRoute[rescue.routeIndex];
            const to = rescue.returnRoute[rescue.routeIndex + 1];
            const dLat2 = (to.lat - from.lat) * 111;
            const dLon2 = (to.lon - from.lon) * 111 * Math.cos(from.lat * Math.PI / 180);
            const segDist = Math.sqrt(dLat2 * dLat2 + dLon2 * dLon2);
            if (segDist <= 0) { rescue.routeIndex++; continue; }
            if (remaining >= segDist) {
              rescue.position.lat = to.lat;
              rescue.position.lon = to.lon;
              remaining -= segDist;
              rescue.routeIndex++;
            } else {
              const ratio = remaining / segDist;
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
      this.maintenanceQueue = this.maintenanceQueue.filter(q => q.serviceId !== m.serviceId);
    }
    return { repairedIds: finished.map(r => r.serviceId), maintainedIds: finishedM.map(m => m.serviceId) };
  }

  // Send a service for preventive maintenance
  sendToMaintenance(serviceId, serviceName, depotId) {
    if (this.maintenanceQueue.some(m => m.serviceId === serviceId)) return false;
    if (this.repairQueue.some(r => r.serviceId === serviceId)) return false;
    this.maintenanceQueue.push({
      serviceId,
      depotId,
      remainingMin: 20, // 20 min for preventive maintenance
      totalMin: 20,
      serviceName: serviceName || serviceId,
    });
    return true;
  }

  isInRepairOrMaintenance(serviceId) {
    return this.repairQueue.some(r => r.serviceId === serviceId)
        || this.maintenanceQueue.some(m => m.serviceId === serviceId);
  }

  getRepairInfo(serviceId) {
    return this.repairQueue.find(r => r.serviceId === serviceId)
        || this.maintenanceQueue.find(m => m.serviceId === serviceId)
        || null;
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
    if (!Array.isArray(data) && data.repairQueue) this.repairQueue = data.repairQueue;
    if (!Array.isArray(data) && data.maintenanceQueue) this.maintenanceQueue = data.maintenanceQueue;
  }
}
