import { WindowedList } from './windowed-list.js';
import { clockText, setText } from './operations-view-model.js';
export class RailEmpireBoard {
    constructor(root, data) {
        this.root = root;
        this.data = data;
        this.horizon = 1440;
        this.active = false;
        this.timer = null;
        this.morePending = false;
        this.request = 0;
        this.stationKey = '';
        this.arrivals = false;
        root.innerHTML = `<div class="re-board-head"><div><span class="re-board-brand">RAIL <b>EMPIRE</b></span><h3 class="re-board-station"></h3></div><div class="re-board-clock"><strong></strong><span></span></div></div>
          <div class="re-board-tools"><div class="re-board-tabs" role="group" aria-label="Sens du panneau"><button type="button" id="re-board-departures" class="active">Départs</button><button type="button" id="re-board-arrivals">Arrivées</button></div><label>Filtrer les trains<input id="re-board-search" type="search" placeholder="Numéro, destination, desserte…"></label><button id="re-board-now" type="button">Revenir à maintenant</button></div>
          <div class="re-board-columns" aria-hidden="true"><span>Heure</span><span class="re-board-direction">Destination · desserte</span><span>État</span><span>Voie</span></div>
          <div id="re-board-empty" class="re-empty" hidden>Aucun train voyageur prévu dans la période affichée.</div>
          <div id="re-board-list" aria-label="Infogare Rail Empire, défilement continu"></div>
          <div class="re-board-foot"><span id="re-board-count" role="status"></span><button id="re-board-more" type="button">Ajouter les 24 h suivantes</button></div>`;
        this.search = root.querySelector('#re-board-search');
        this.list = new WindowedList(root.querySelector('#re-board-list'), 112, r => r.key, (r, old) => this.row(r, old), () => this.more());
        this.search.addEventListener('input', () => this.refresh(true));
        root.querySelector('#re-board-departures').addEventListener('click', () => this.mode(false));
        root.querySelector('#re-board-arrivals').addEventListener('click', () => this.mode(true));
        root.querySelector('#re-board-more').addEventListener('click', () => this.more());
        root.querySelector('#re-board-now').addEventListener('click', () => { this.horizon = 1440; this.refresh(true); });
    }
    show(stationId) {
        const reset = stationId !== this.stationKey;
        this.stationKey = stationId;
        if (reset) {
            this.horizon = 1440;
            this.search.value = '';
        }
        this.setActive(true);
        this.refresh(reset);
    }
    mode(arrivals) {
        this.arrivals = arrivals;
        this.root.querySelector('#re-board-departures').classList.toggle('active', !arrivals);
        this.root.querySelector('#re-board-arrivals').classList.toggle('active', arrivals);
        this.refresh(true);
    }
    more() {
        if (!this.active || this.morePending)
            return;
        this.morePending = true;
        const button = this.root.querySelector('#re-board-more');
        button.disabled = true;
        // One additional day per gesture; never an automatic unbounded background loop.
        this.request = window.setTimeout(() => {
            this.request = 0;
            if (this.active) {
                this.horizon += 1440;
                this.refresh();
            }
            this.morePending = false;
            button.disabled = false;
        }, 0);
    }
    row(row, old) {
        const node = old || document.createElement('article');
        if (!old) {
            node.className = 're-board-row';
            node.innerHTML = `<div class="re-board-time"><strong></strong><small></small></div><div class="re-board-destination"><strong></strong><span class="re-board-train-name"></span><small class="re-board-via"></small></div><div class="re-board-status"><strong></strong><small></small></div><div class="re-board-platform"></div>`;
        }
        node.dataset.serviceId = row.serviceId;
        node.classList.toggle('is-cancelled', row.cancelled);
        node.classList.toggle('is-delayed', !row.cancelled && row.delay >= 1);
        setText(node, '.re-board-time strong', clockText(row.plannedMinute));
        setText(node, '.re-board-time small', row.dayOffset > 0 ? `J+${row.dayOffset}` : row.dayOffset < 0 ? `J${row.dayOffset}` : 'Aujourd’hui');
        setText(node, '.re-board-destination strong', this.arrivals ? row.origin : row.destination);
        setText(node, '.re-board-train-name', `${row.name}${row.number && !row.name.includes(row.number) ? ' · ' + row.number : ''}`);
        const via = row.via.length ? 'Via ' + row.via.join(' · ') : 'Direct';
        setText(node, '.re-board-via', via);
        node.querySelector('.re-board-via').title = via;
        const status = row.cancelled ? 'Supprimé' : row.delay >= 1 ? `Retard +${Math.round(row.delay)} min` : row.state === 'stopped_at_station' ? 'À quai' : row.waitMinute <= 1 ? 'À l’approche' : 'À l’heure';
        setText(node, '.re-board-status strong', status);
        const detail = row.cancelled ? row.reason : row.delay >= 1 ? `Estimé ${clockText(row.plannedMinute + row.delay)}` : row.state === 'planned' ? 'Horaire prévisionnel' : row.reason;
        setText(node, '.re-board-status small', detail || '');
        node.querySelector('.re-board-status').title = row.reason;
        setText(node, '.re-board-platform', row.platform || '—');
        return node;
    }
    refresh(reset = false) {
        if (!this.stationKey)
            return;
        const d = this.data(this.horizon, this.arrivals);
        setText(this.root, '.re-board-station', d.station);
        setText(this.root, '.re-board-clock strong', d.clock);
        setText(this.root, '.re-board-clock span', d.date);
        setText(this.root, '.re-board-direction', this.arrivals ? 'Provenance · desserte' : 'Destination · desserte');
        const needle = this.search.value.trim().toLocaleLowerCase('fr');
        const rows = needle ? d.rows.filter(r => `${r.name} ${r.number} ${r.origin} ${r.destination} ${r.via.join(' ')}`.toLocaleLowerCase('fr').includes(needle)) : d.rows;
        this.root.querySelector('#re-board-empty').hidden = rows.length > 0;
        setText(this.root, '#re-board-count', `${rows.length} train${rows.length > 1 ? 's' : ''} · ${Math.round(this.horizon / 60)} h de prévisions · défilement continu`);
        this.list.setRows(rows, reset);
    }
    setActive(active) {
        this.active = active;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (!active && this.request) {
            clearTimeout(this.request);
            this.request = 0;
            this.morePending = false;
            this.root.querySelector('#re-board-more').disabled = false;
        }
        if (active)
            this.timer = setInterval(() => this.refresh(), 5000);
    }
    dispose() { this.setActive(false); this.list.dispose(); }
}
