import { ServiceStop } from './service-stop.js?v=1784931691';
import {
  timeDiff, timeGte, isInServiceWindow, wrapTime, _seeded01, serviceCounters
} from './service-utils.js?v=1784931691';
import { cantonManager } from './canton-manager.js?v=1784931691';
import { haversineDistance, analyzeRoute } from './simulation.js?v=1784931691';
import { visaSpeedCapKmh, RESTART_SPEED_KMH } from './signaling.js?v=1784931691';
import { getGlobalRng } from './rng.js?v=1784931691';
import { accelerationMs2, brakingDecelMs2, _units } from './train-physics.js?v=1784931691';
import {
  DEFAULT_TERMINUS_WAIT_MIN, toOdd, returnNumberFor, incrementTrailingNumber,
  interpolatePassageTimes, shouldSkipStop,
} from './schedule-logic.js?v=1784931691';
import { TrainController } from './train-controller.js?v=1784931691';
import { SchedulePlanner } from './schedule-planner.js?v=1784931691';
import { CantonController } from './canton-controller.js?v=1784931691';

export class ActiveService {
  constructor(data, rame, world, weather) {
      this.id = data.id || `svc-${serviceCounters.nextServiceId++}`;
      this.name = data.name || 'Service';
      this.rameId = data.rameId;
      this.rame = rame;
      this.stops = (data.stops || []).map(s =>
        new ServiceStop(s.stationId, s.type, s.departureTime ?? s.time, s.arrivalTime ?? s.time, s.voiePointId, s.platform, s.stopCode)
      );
      this.routes = data.routes || [];
      this.world = world;
      this.weather = weather;
      this.roundTrip = data.roundTrip || false;
      this.multiDepartures = data.multiDepartures || 1;
      this.terminusWait = data.terminusWait || DEFAULT_TERMINUS_WAIT_MIN; // SC-06

      // SC-03 — auto numbering: aller = impair, retour = pair (aller+1).
      this.number = toOdd(data.number != null ? data.number : serviceCounters.nextServiceNumber);
      if (data.number != null) {
        serviceCounters.nextServiceNumber = Math.max(serviceCounters.nextServiceNumber, this.number + 2);
      } else {
        serviceCounters.nextServiceNumber = this.number + 2;
      }
      this.returnNumber = data.returnNumber != null
        ? data.returnNumber : returnNumberFor(this.number);

      // SC-04 — optional independent return geometry/stops (falls back to the
      // reversed forward leg when absent, keeping old saves working).
      this._returnRoutes = data.returnRoutes || null;
      this._returnStopsData = data.returnStops || null;
      this.totalDistance = data.totalDistance || 0;
      this.plannedDistance = data.plannedDistance || 0;
      this.active = data.active !== false;
      // Section VI — types de convois : passager (par defaut), W, HLP, TM, EVO, work
      this.serviceType = data.serviceType || (data.isWorkTrain ? 'work' : 'passager');
      this.isWorkTrain = this.serviceType === 'work'; // S15: Work trains unaffected by works
      // Section X — contrat fret éventuellement assigné à ce service
      this.assignedContractId = data.assignedContractId || '';
      this.returnName = data.returnName || '';
      this.returnPlatforms = data.returnPlatforms || {}; // { stationId: platformName }
      this.runDays = data.runDays || [0,1,2,3,4,5,6]; // days of week (0=Sun..6=Sat), default all
      this.runDates = data.runDates || []; // specific dates (YYYY-MM-DD), empty = every day
      this._tripCount = 0;
      this._adjustedStops = null;

      this.currentStopIndex = 0;
      this.state = 'waiting';
      this.position = null;
      this.speed = 0;
      this.targetSpeed = 0;
      this.delay = 0;
      this.completed = false;
      this.direction = 1;
      this.currentRouteIndex = -1;
      this.routeProgress = 0;
      this.lastTickTime = -1;
      this.revenueCollected = false;
      this.isReturnLeg = false;
      this.returnStops = [];
      this._platformAssignment = null; // { stationId, platform } when stopped

      // Simulation state for strict segment-based route following
      this._state = {
        index: 0,
        progress: 0,
        legKey: null,
        cachedRoute: null,
        worksLimitCache: null,
      };
      this._routeAnalysis = null;
      this._cantonAssignments = null;

      // TRV-06 — automatic alternate route search when a leg is closed
      this._pendingAltRoute = null; // { key, completed, route, failed }
      this._altRouteFailedKeys = new Set();

      // Mass-based physics: compute accel/decel from rame power (kW) and loaded mass.
      let accel = 3.0; // default km/h/s
      let decel = 4.0;
      if (rame) {
        const totalMass = rame.getTotalMassWithPayload ? rame.getTotalMassWithPayload(0.7) : (rame.totalMass || rame.totalTonnage || 400);
        const massKg = totalMass * 1000;
        const totalPower = rame.totalPower || 0;
        const powerW = totalPower * 1000;
        const lengthM = rame.totalLength || 200;
        const brakeServiceMs2 = rame.brakeServiceMs2 || 1.1; // typical service brake
        if (powerW > 0 && massKg > 0) {
          const params = {
            massKg, powerW, lengthM, weather: 'clear',
            adhesionMassKg: massKg, brakeServiceMs2,
          };
          // Reference starting acceleration at ~7 km/h (2 m/s).
          const aMs2 = accelerationMs2(params, 2.0, 0);
          accel = Math.max(0.3, Math.min(8.0, aMs2 * _units.MS_TO_KMH));
        }
        const params = { massKg, powerW, lengthM, weather: 'clear', adhesionMassKg: massKg, brakeServiceMs2 };
        const bMs2 = brakingDecelMs2(params, 'clear');
        decel = Math.max(2.5, Math.min(12.0, bMs2 * _units.MS_TO_KMH));
      }
      // DET-05 : curseur de réalisme physique
      const physicsMult = (typeof window !== 'undefined' && window.game?.realismSettings?.physics) ?? 1;
      accel = Math.max(0.1, accel * physicsMult);
      decel = Math.max(0.1, decel * physicsMult);

      // S12: Get locomotive series name/number from rame
      let seriesName = '', trainNumber = '';
      if (rame && rame.elements) {
        const loco = rame.elements.find(e => e.item?.seriesName);
        if (loco?.item) {
          seriesName = loco.item.seriesName;
          trainNumber = String(loco.item.numberStart || '');
        }
      }

      // LVM-01 — livemap category (annexe 2a) : Voyageur / Fret / Travaux / Machines.
      this.category = this.isWorkTrain
        ? 'travaux'
        : (this.serviceType === 'fret'
          ? 'fret'
          : (['hlp','tm','m-','evo'].includes(this.serviceType)
            ? 'machine'
            : (rame && rame.totalFreightCapacity > rame.totalCapacity ? 'fret' : 'voyageur')));

      this.train = {
        id: this.id,
        name: this.name,
        color: this.getColor(),
        category: this.category,
        maxSpeed: rame ? rame.maxSpeed : 160,
        speed: 0,
        delay: 0,
        state: 'waiting',
        totalKm: 0,
        stoppedAt: null,
        incident: null,
        breakdown: null,
        blockedBy: false,
        signalAlert: null, // 'caution' | 'closed' | null
        delayReason: '',   // OCC-04 : motif du retard (régulation, signal, incident...)
        accel,
        decel,
        seriesName,
        number: this.number != null ? String(this.number) : trainNumber,
        platform: null,
        // S14: Wear tracking — initialize from rame (persists across services)
        totalKmRun: rame ? (rame.totalKmRun || 0) : 0,
        kmSinceLastMaint: rame ? (rame.kmSinceLastMaint || 0) : 0,
        wearLevel: rame ? (rame.wearLevel || 0) : 0,
      };

      // Garage/shunting state
      this._garage = null; // { vpId, route, savedRoute, savedStopIndex, savedState, blockerTrainId }

      // Section VI — ITE state
      this._iteHardBlock = false;
      this._iteDwellExtra = 0;
      this._iteCargoMismatch = false;

      // Position will be set by scheduleTick when in pre-departure window
      // (don't set here to avoid ghost trains on the map)

      // SC-02 — pre-compute passage times at every real station encountered on
      // each leg, even if it is not a scheduled stop or waypoint.
      this._passageStops = this._computePassageStops();

      // LVM — randomized response margins per service (Annexe 3A : 25-50 m carré, 50-150 m ralentissement)
      // Deterministic from service id so save/load and tests stay stable.
      this._carreMarginM = 25 + _seeded01(this.id + ':carre') * 25;
      this._negativeBufferKm = 0.05 + _seeded01(this.id + ':neg') * 0.10;
    }

  async garageToVoiePoint(vpId) { return; }

  resumeFromGarage() { return; }

  getColor() {
      const colors = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
      const hash = this.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      return colors[hash % colors.length];
    }

  update(timeOfDay, dateStr, economy, allServices) {
      this._economy = economy;
      this.scheduleTick(timeOfDay, dateStr, economy);
    }
}

Object.assign(ActiveService.prototype, TrainController, SchedulePlanner, CantonController);
