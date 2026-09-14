import { htmlText } from './html-text.js';
const serviceKey = (id) => String(id ?? '').replace(/^(v2:.+):\d{4}-\d{2}-\d{2}$/, '$1');
const DAY_MIN = 1440;
const MAX_TRANSFER_AGE_MIN = 180;
const MAX_EVENTS = 4096;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/**
 * Connections — Passenger transfer/correspondence system.
 * Tracks transfers between services at shared stations.
 */
export class Connections {
    constructor() {
        this.arrivals = [];
        this.settled = [];
        this.transfers = []; // active transfer configs
        this.waitPolicy = 'moderate'; // 'strict' (no wait), 'moderate' (wait 5min), 'flexible' (wait 15min)
        this.stats = {
            totalTransfers: 0,
            successfulTransfers: 0,
            missedTransfers: 0,
        };
        this._pendingTransfers = []; // runtime: passengers waiting for connecting train
    }
    /**
     * Define a connection between two services at a station.
     */
    addTransfer(fromServiceId, toServiceId, stationId) {
        fromServiceId = serviceKey(fromServiceId);
        toServiceId = serviceKey(toServiceId);
        stationId = String(stationId ?? '');
        if (!fromServiceId || !toServiceId || fromServiceId === toServiceId || !stationId)
            return null;
        const existing = this.transfers.find(t => serviceKey(t.fromServiceId) === fromServiceId && serviceKey(t.toServiceId) === toServiceId && t.stationId === stationId);
        if (existing)
            return existing;
        const transfer = {
            id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            fromServiceId,
            toServiceId,
            stationId,
            minTransferTime: 3, // minutes minimum
            waitTime: this._getWaitTime(),
        };
        this.transfers.push(transfer);
        return transfer;
    }
    removeTransfer(id) {
        this.transfers = this.transfers.filter((t) => t.id !== id);
    }
    _getWaitTime() {
        return { strict: 0, moderate: 5, flexible: 15 }[String(this.waitPolicy)] ?? 5;
    }
    /**
     * Check if a connecting service should wait for an arriving service.
     * Called from schedule tick when a service is at a station.
     */
    _clock(currentTime, dateStr) {
        const time = Number(currentTime);
        const midnight = dateStr ? Date.parse(`${dateStr}T00:00:00Z`) / 60000 : 0;
        return Number.isFinite(midnight) && Number.isFinite(time) ? midnight + time : NaN;
    }
    _booked(service, value, now) {
        const t = Number(value);
        if (!Number.isFinite(t))
            return NaN;
        if (service._v2BaseDate && service._v2OccurrenceId)
            return this._clock(t, service._v2BaseDate);
        const day = Math.floor(now / DAY_MIN) * DAY_MIN;
        let booked = day + ((t % DAY_MIN) + DAY_MIN) % DAY_MIN;
        if (booked - now > DAY_MIN / 2)
            booked -= DAY_MIN;
        if (now - booked > DAY_MIN / 2)
            booked += DAY_MIN;
        return booked;
    }
    _stopForDeparture(service) {
        const stops = service.getCurrentStops?.() || service.stops || [];
        const i = ['waiting', 'preparation'].includes(String(service.state)) ? 0 : Math.max(0, Number(service.currentStopIndex || 0) - 1);
        return stops[i];
    }
    _prune(now) {
        if (!Number.isFinite(now))
            return;
        // At most three civil days: enough for a midnight interchange, bounded in RAM/save.
        this.arrivals = this.arrivals.filter(e => e.at >= now - 3 * DAY_MIN && e.at <= now).slice(-MAX_EVENTS);
        this.settled = this.settled.filter(e => e.at >= now - 3 * DAY_MIN && e.at <= now).slice(-MAX_EVENTS);
    }
    _evaluate(transfer, receiver, stop, now, services) {
        const bookedDep = receiver && stop ? this._booked(receiver, stop.departureTime ?? stop.arrivalTime, now) : now;
        const minTransfer = Math.max(0, Number(transfer.minTransferTime) || 0);
        const maxHold = Math.min(this._getWaitTime(), Math.max(0, Number(transfer.waitTime) || 0));
        const deadline = bookedDep + maxHold;
        let arrival = null;
        let predicted = null;
        const events = this.arrivals.filter(e => serviceKey(e.serviceId) === serviceKey(transfer.fromServiceId) &&
            e.stationId === transfer.stationId && e.at <= now && e.at >= bookedDep - MAX_TRANSFER_AGE_MIN);
        if (events.length)
            arrival = Math.max(...events.map(e => e.at));
        for (const feeder of services) {
            if (!feeder || serviceKey(feeder.id) !== serviceKey(transfer.fromServiceId) || feeder.cancelled || feeder.active === false)
                continue;
            const stops = feeder.getCurrentStops?.() || feeder.stops || [];
            const stationary = feeder.state === 'stopped_at_station';
            const idx = stationary ? Math.max(0, Number(feeder.currentStopIndex || 0) - 1) : Math.max(0, Number(feeder.currentStopIndex || 0));
            const next = stops[idx];
            if (!next || next.stationId !== transfer.stationId || next.technicalLocationId || next.type !== 'arret')
                continue;
            const planned = this._booked(feeder, next.arrivalTime ?? next.departureTime, now);
            if (!Number.isFinite(planned) || Math.abs(planned - bookedDep) > MAX_TRANSFER_AGE_MIN)
                continue;
            const delay = Math.max(0, Number(feeder.train?.delay ?? feeder.delay) || 0);
            if (stationary && arrival == null) {
                // Old saves have no arrival journal. A physically stopped feeder
                // with an actual stopped-since clock is legitimate arrival evidence.
                const stopped = feeder.train?._stoppedSinceGameTime;
                const actual = stopped == null ? planned + delay : this._booked(feeder, stopped, now);
                if (Number.isFinite(actual) && actual <= now)
                    arrival = actual;
            }
            else if (!feeder.completed && ['moving', 'departing', 'waiting', 'preparation'].includes(String(feeder.state))) {
                const eta = Math.max(now, planned + delay);
                predicted = predicted == null ? eta : Math.min(predicted, eta);
            }
        }
        const ready = arrival != null ? arrival + minTransfer : predicted != null ? predicted + minTransfer : null;
        const success = arrival != null && now + 1e-8 >= arrival + minTransfer;
        return { bookedDep, success, waiting: !success && ready != null && ready <= deadline + 1e-8 && now < deadline - 1e-8 && now < ready - 1e-8 };
    }
    /** A bounded hold relative to BOOKED departure, never a sliding five minutes. */
    shouldWait(serviceId, stationId, currentTime, services, dateStr) {
        if (!Array.isArray(services) || !serviceId || !stationId)
            return false;
        const live = services;
        const receiver = live.find(s => String(s?.id) === String(serviceId));
        const now = this._clock(currentTime, dateStr || receiver?._currentDate);
        if (!Number.isFinite(now))
            return false;
        const stop = receiver ? this._stopForDeparture(receiver) : undefined;
        return this.transfers.some(t => serviceKey(t.toServiceId) === serviceKey(serviceId) && t.stationId === stationId &&
            this._evaluate(t, receiver, stop, now, live).waiting);
    }
    onArrival(service, stop, currentTime, dateStr) {
        if (!service || !stop || stop.type !== 'arret' || stop.technicalLocationId || !stop.stationId)
            return;
        if (!this.transfers.some(t => serviceKey(t.fromServiceId) === serviceKey(service.id) && t.stationId === stop.stationId))
            return;
        const now = this._clock(currentTime, dateStr || service._currentDate);
        if (!Number.isFinite(now))
            return;
        this._prune(now);
        const key = `${service.id}|${stop.locationOccurrenceId || service.currentStopIndex || 0}|${service._tripCount || 0}|${service.isReturnLeg ? 1 : 0}|${this._booked(service, stop.arrivalTime ?? stop.departureTime, now)}`;
        if (!this.arrivals.some(e => e.key === key))
            this.arrivals.push({ key, serviceId: service.id, stationId: stop.stationId, at: now });
    }
    onDeparture(service, stop, currentTime, dateStr, services) {
        if (!service || !stop || stop.type !== 'arret' || stop.technicalLocationId || !stop.stationId || !Array.isArray(services))
            return;
        const now = this._clock(currentTime, dateStr || service._currentDate);
        if (!Number.isFinite(now))
            return;
        this._prune(now);
        for (const t of this.transfers) {
            if (serviceKey(t.toServiceId) !== serviceKey(service.id) || t.stationId !== stop.stationId)
                continue;
            const result = this._evaluate(t, service, stop, now, services);
            const key = `${escapeHtml(t.id)}|${service.id}|${stop.locationOccurrenceId || stop.stationId}|${result.bookedDep}|${service._tripCount || 0}|${service.isReturnLeg ? 1 : 0}`;
            if (this.settled.some(e => e.key === key))
                continue;
            this.recordTransfer(t.fromServiceId, t.toServiceId, t.stationId, result.success);
            this.settled.push({ key, at: now });
        }
    }
    /**
     * Record a transfer event.
     */
    recordTransfer(fromServiceId, toServiceId, stationId, success) {
        this.stats.totalTransfers++;
        if (success) {
            this.stats.successfulTransfers++;
        }
        else {
            this.stats.missedTransfers++;
        }
    }
    /**
     * Auto-detect possible connections based on shared stations and compatible times.
     */
    autoDetect(services, world) {
        const stationServices = Object.create(null);
        for (const svc of services) {
            const stops = svc.getCurrentStops?.() || svc.stops || [];
            stops.forEach((stop, i) => {
                var _a;
                if (!stop.stationId || stop.type !== 'arret' || stop.technicalLocationId)
                    return;
                (stationServices[_a = stop.stationId] || (stationServices[_a] = [])).push({
                    serviceId: svc.id, serviceName: svc.name,
                    arrival: Number(stop.arrivalTime ?? stop.departureTime), departure: Number(stop.departureTime ?? stop.arrivalTime),
                    canArrive: i > 0, canDepart: i < stops.length - 1,
                });
            });
        }
        const suggestions = [];
        const seen = new Set();
        for (const [stationId, svcs] of Object.entries(stationServices))
            for (const arriving of svcs)
                for (const departing of svcs) {
                    if (!arriving.canArrive || !departing.canDepart || serviceKey(arriving.serviceId) === serviceKey(departing.serviceId))
                        continue;
                    const diff = ((departing.departure - arriving.arrival) % DAY_MIN + DAY_MIN) % DAY_MIN;
                    const key = `${serviceKey(arriving.serviceId)}|${serviceKey(departing.serviceId)}|${stationId}`;
                    const exists = this.transfers.some(t => serviceKey(t.fromServiceId) === serviceKey(arriving.serviceId) &&
                        serviceKey(t.toServiceId) === serviceKey(departing.serviceId) && t.stationId === stationId);
                    if (Number.isFinite(diff) && diff >= 3 && diff <= 30 && !exists && !seen.has(key)) {
                        seen.add(key);
                        suggestions.push({ fromServiceId: arriving.serviceId, fromName: arriving.serviceName,
                            toServiceId: departing.serviceId, toName: departing.serviceName, stationId, transferTime: diff });
                    }
                }
        return suggestions;
    }
    render(container, game) {
        if (!container)
            return;
        const services = (game.scheduleCreator?.services || []).filter((s) => s.active !== false && !s.cancelled &&
            (s.serviceType === 'passager' || ['PASSENGER', 'passager', 'voyageur'].includes(String(s.category || ''))));
        const usedStations = new Set();
        for (const s of services)
            for (const stop of s.getCurrentStops?.() || s.stops || []) {
                if (stop.type === 'arret' && !stop.technicalLocationId && stop.stationId)
                    usedStations.add(String(stop.stationId));
            }
        // Only served stations: no 30,000-option selector just to configure two trains.
        const stations = (game.world?.stations || []).filter((s) => usedStations.has(String(s.id)));
        const successRate = this.stats.totalTransfers > 0
            ? Math.round(this.stats.successfulTransfers / this.stats.totalTransfers * 100)
            : 100;
        container.innerHTML = `
      <div class="dash-section">
        <h3>Correspondances Voyageurs</h3>
        <div class="dash-kpi-grid">
          <div class="dash-kpi">
            <div class="dash-kpi-label">Correspondances actives</div>
            <div class="dash-kpi-value" style="color:#38bdf8">${this.transfers.length}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Taux de réussite</div>
            <div class="dash-kpi-value" style="color:${htmlText(successRate >= 80 ? 'var(--green)' : '#ef4444')}">${successRate}%</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Correspondances réussies</div>
            <div class="dash-kpi-value" style="color:var(--green)">${this.stats.successfulTransfers}</div>
          </div>
          <div class="dash-kpi">
            <div class="dash-kpi-label">Correspondances ratées</div>
            <div class="dash-kpi-value" style="color:#ef4444">${this.stats.missedTransfers}</div>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <h3>Politique d'attente</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="conn-policy btn-primary" data-policy="strict" style="font-size:11px;padding:8px 14px;background:${htmlText(this.waitPolicy === 'strict' ? '#ef4444' : '#374151')}">
            Stricte (0 min)
          </button>
          <button class="conn-policy btn-primary" data-policy="moderate" style="font-size:11px;padding:8px 14px;background:${htmlText(this.waitPolicy === 'moderate' ? '#3b82f6' : '#374151')}">
            Modérée (5 min)
          </button>
          <button class="conn-policy btn-primary" data-policy="flexible" style="font-size:11px;padding:8px 14px;background:${htmlText(this.waitPolicy === 'flexible' ? 'var(--green)' : '#374151')}">
            Flexible (15 min)
          </button>
        </div>
      </div>

      <div class="dash-section">
        <h3>Correspondances configurées</h3>
        <div class="dash-train-table">
          <div class="dash-train-header" style="grid-template-columns:1.2fr 1.2fr 1fr 0.6fr">
            <span>De</span><span>Vers</span><span>Gare</span><span>Action</span>
          </div>
          ${this.transfers.length === 0 ? '<div style="padding:8px;color:var(--text3)">Aucune correspondance configurée</div>' :
            this.transfers.map((t) => {
                const fromSvc = services.find((s) => serviceKey(s.id) === serviceKey(t.fromServiceId));
                const toSvc = services.find((s) => serviceKey(s.id) === serviceKey(t.toServiceId));
                const station = stations.find((s) => s.id === t.stationId);
                return `<div class="dash-train-row" style="grid-template-columns:1.2fr 1.2fr 1fr 0.6fr">
                <span>${escapeHtml(fromSvc?.name || t.fromServiceId)}</span>
                <span>${escapeHtml(toSvc?.name || t.toServiceId)}</span>
                <span>${escapeHtml(station?.name || t.stationId)}</span>
                <span><button class="conn-remove btn-sm" data-id="${escapeHtml(t.id)}" style="background:#ef4444">×</button></span>
              </div>`;
            }).join('')}
        </div>
      </div>

      <div class="dash-section">
        <h3>Ajouter une correspondance</h3>
        ${services.length < 2 ? '<p style="color:var(--text3);font-size:11px">Créez au moins 2 services pour configurer des correspondances.</p>' : `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label style="font-size:10px;color:var(--text3)">Service arrivant</label>
            <select id="conn-from" style="width:150px;font-size:11px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              ${services.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3)">Service partant</label>
            <select id="conn-to" style="width:150px;font-size:11px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              ${services.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3)">Gare</label>
            <select id="conn-station" style="width:150px;font-size:11px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
              ${stations.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <button id="conn-add-btn" class="btn-primary" style="font-size:11px;padding:6px 12px">+ Ajouter</button>
        </div>`}
      </div>
    `;
        // Event handlers
        container.querySelectorAll('.conn-policy').forEach((node) => {
            const btn = node;
            btn.addEventListener('click', () => {
                const policy = btn.dataset.policy;
                if (policy !== 'strict' && policy !== 'moderate' && policy !== 'flexible')
                    return;
                this.waitPolicy = policy;
                this.transfers.forEach((t) => t.waitTime = this._getWaitTime());
                game.saveState?.();
                this.render(container, game);
            });
        });
        container.querySelectorAll('.conn-remove').forEach((node) => {
            const btn = node;
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (!id)
                    return;
                this.removeTransfer(id);
                game.saveState?.();
                this.render(container, game);
            });
        });
        const addBtn = container.querySelector('#conn-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const from = container.querySelector('#conn-from')?.value;
                const to = container.querySelector('#conn-to')?.value;
                const station = container.querySelector('#conn-station')?.value;
                if (from && to && station && from !== to) {
                    this.addTransfer(from, to, station);
                    game.saveState?.();
                    this.render(container, game);
                }
            });
        }
    }
    toSave() {
        return {
            transfers: this.transfers,
            waitPolicy: this.waitPolicy,
            stats: this.stats,
            arrivals: this.arrivals.slice(-MAX_EVENTS),
            settled: this.settled.slice(-MAX_EVENTS),
        };
    }
    loadFromSave(s) {
        if (!isRecord(s))
            return;
        const rawPolicy = s.waitPolicy;
        this.waitPolicy = rawPolicy === 'strict' || rawPolicy === 'flexible' || rawPolicy === 'moderate' ? rawPolicy : 'moderate';
        const seen = new Set();
        const rawTransfers = (Array.isArray(s.transfers) ? s.transfers : []).filter(isRecord);
        this.transfers = rawTransfers.map((t) => {
            const fromServiceId = serviceKey(t.fromServiceId), toServiceId = serviceKey(t.toServiceId), stationId = String(t.stationId ?? '');
            const id = String(t.id ?? '');
            const key = `${fromServiceId}|${toServiceId}|${stationId}`;
            if (!id || !fromServiceId || !toServiceId || fromServiceId === toServiceId || !stationId || seen.has(key))
                return null;
            seen.add(key);
            const min = Number(t.minTransferTime), wait = Number(t.waitTime);
            return { id, fromServiceId, toServiceId, stationId, minTransferTime: Number.isFinite(min) ? Math.max(0, Math.min(120, min)) : 3, waitTime: Number.isFinite(wait) ? Math.max(0, Math.min(120, wait)) : this._getWaitTime() };
        }).filter((t) => t !== null);
        const raw = isRecord(s.stats) ? s.stats : {};
        const n = (v) => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0;
        const successfulTransfers = n(raw.successfulTransfers), missedTransfers = n(raw.missedTransfers);
        this.stats = { totalTransfers: Math.max(n(raw.totalTransfers), successfulTransfers + missedTransfers), successfulTransfers, missedTransfers };
        this._pendingTransfers = [];
        this.arrivals = (Array.isArray(s.arrivals) ? s.arrivals : []).filter(isRecord)
            .filter(e => typeof e.key === 'string' && typeof e.serviceId === 'string' && typeof e.stationId === 'string' && Number.isFinite(e.at))
            .slice(-MAX_EVENTS).map(e => ({ key: String(e.key), serviceId: String(e.serviceId), stationId: String(e.stationId), at: Number(e.at) }));
        this.settled = (Array.isArray(s.settled) ? s.settled : []).filter(isRecord)
            .filter(e => typeof e.key === 'string' && Number.isFinite(e.at))
            .slice(-MAX_EVENTS).map(e => ({ key: String(e.key), at: Number(e.at) }));
    }
}
