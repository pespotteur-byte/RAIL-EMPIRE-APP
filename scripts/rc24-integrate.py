from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
def edit(path,fn):
 p=root/path;s=p.read_text();p.write_text(fn(s))
def rep(s,a,b):
 assert a in s,a[:120]
 return s.replace(a,b,1)

def rame(s):
 s="import { maximumVehicleCount } from './rame-random.js';\n"+s
 s=rep(s,'    constructor(input: unknown = {}) {','    randomizeOnDeparture = false;\n    randomMaxVehicles: number | null = null;\n    randomLastDepartureKey = \'\';\n\n    constructor(input: unknown = {}) {')
 s=rep(s,'        this.serialNumber = text(data.serialNumber);', '''        this.serialNumber = text(data.serialNumber);
        this.randomizeOnDeparture = data.randomizeOnDeparture === true;
        try { this.randomMaxVehicles = maximumVehicleCount(data.randomMaxVehicles); } catch { this.randomMaxVehicles = null; }
        this.randomLastDepartureKey = text(data.randomLastDepartureKey);''')
 s=rep(s,'        if (data.name !== undefined)', '''        if (data.randomizeOnDeparture !== undefined) rame.randomizeOnDeparture = data.randomizeOnDeparture === true;
        if (data.randomMaxVehicles !== undefined) rame.randomMaxVehicles = maximumVehicleCount(data.randomMaxVehicles);
        if (data.name !== undefined)''')
 s=rep(s,'            serialNumber: r.serialNumber,','''            serialNumber: r.serialNumber,
            randomizeOnDeparture: r.randomizeOnDeparture,
            randomMaxVehicles: r.randomMaxVehicles,
            randomLastDepartureKey: r.randomLastDepartureKey,''')
 return s
edit('src/ts/rame.ts',rame)

def ui(s):
 s="""import { HeadquartersPage, type HeadquartersData } from './qg-page.js';
import { RailEmpireBoard } from './infogare-re.js';
import { transportTotals, type FleetRow, type BoardRow } from './operations-view-model.js';
import { maximumVehicleCount, planRandomWagons } from './rame-random.js';
"""+s
 s=rep(s,'export class UI {', '''export class UI {
  private _qgPage: HeadquartersPage | null = null;
  private _reBoard: RailEmpireBoard | null = null;''')
 s=rep(s,"    else if (this.activePage === 'infogare') this.renderInfogarePage();", "    else if (this.activePage === 'qg') this.renderQGPage();\n    else if (this.activePage === 'infogare') this.renderInfogarePage();")
 s=rep(s,"    this.activePage = page;", "    this.activePage = page;\n    this._qgPage?.setActive(page === 'qg');\n    this._reBoard?.setActive(page === 'infogare');")
 s=rep(s,"    if (page === 'infogare') this.renderInfogarePage();", "    if (page === 'qg') this.renderQGPage();\n    if (page === 'infogare') this.renderInfogarePage();")
 # Rame fields are DOM state; no new loose class properties.
 s=rep(s,"    this.currentRameElements = [];\n    this.editingRameId = null;", "    this.currentRameElements = [];\n    this._setRameRandomPolicyControls(false, null);\n    this.editingRameId = null;")
 s=rep(s,"    this.editingRameId=id;", "    this.editingRameId=id;\n    this._setRameRandomPolicyControls(rame.randomizeOnDeparture, rame.randomMaxVehicles);")
 s=rep(s,"    this._duplicatingRameSourceId=rame.id;", "    this._duplicatingRameSourceId=rame.id;\n    this._setRameRandomPolicyControls(rame.randomizeOnDeparture, rame.randomMaxVehicles);")
 start=s.index('  randomFillRameWithSelectedWagons() {');end=s.index('  ramePickerPageGo(',start)
 s=s[:start]+'''  _setRameRandomPolicyControls(enabled: boolean, maximum: number | null) {
    const check = document.getElementById('rame-random-departure') as HTMLInputElement | null;
    const input = document.getElementById('rame-random-max') as HTMLInputElement | null;
    if (check) check.checked = !!enabled;
    if (input) input.value = maximum == null ? '' : String(maximum);
  }

  randomFillRameWithSelectedWagons() {
    const selected = [...(this._rameRandomWagonSelection || new Set())]
      .map((id: unknown) => this.game.rollingStock.getById(id)).filter((item): item is RollingStockItem => !!item && item.category === 'wagon');
    const fixed = this.currentRameElements.filter((e: { category: unknown }) => e.category !== 'wagon');
    try {
      const maximum = maximumVehicleCount((document.getElementById('rame-random-max') as HTMLInputElement | null)?.value);
      const plan = planRandomWagons(fixed, selected, maximum, Math);
      const wagons = plan.selected.map(item => this._makeRameElementFromStock(item));
      this.currentRameElements = [...fixed, ...wagons];
      this._setRameRandomPolicyControls(true, maximum);
      this.renderRameAssembly(); this._updateRameRandomControls();
      const status = document.getElementById('rame-random-status');
      if (status) status.textContent = `${fixed.length + wagons.length}${maximum ? '/' + maximum : ''} engins, dont ${wagons.length} wagons · ${plan.totalLength.toFixed(1)} / 750 m. Les wagons seront remélangés à chaque nouvelle course, locomotives fixes.`;
    } catch(error) { alert(error instanceof Error ? error.message : String(error)); }
  }

'''+s[end:]
 s=rep(s,"    const isEdit=!!this.editingRameId;", """    let randomMaxVehicles: number | null;
    try { randomMaxVehicles = maximumVehicleCount((document.getElementById('rame-random-max') as HTMLInputElement | null)?.value); }
    catch(error) { return alert(error instanceof Error ? error.message : String(error)); }
    const randomizeOnDeparture = !!(document.getElementById('rame-random-departure') as HTMLInputElement | null)?.checked;
    if (randomizeOnDeparture && randomMaxVehicles !== null && this.currentRameElements.length > randomMaxVehicles) return alert('La rame dépasse le maximum d’engins. Relancez Random ou augmentez le maximum.');
    const isEdit=!!this.editingRameId;""")
 s=rep(s,'      name,serialNumber,depotId,','      name,serialNumber,depotId,randomizeOnDeparture,randomMaxVehicles,')
 # New QG in a small controller; no map image requests, mutation or simulation step.
 insert=s.index('  // INFOGARE')
 s=s[:insert]+'''  renderQGPage() {
    const host = document.getElementById('page-qg'); if (!host) return;
    if (!this._qgPage) this._qgPage = new HeadquartersPage(host, () => this._headquartersData());
    else this._qgPage.setActive(true);
  }

  _headquartersData(): HeadquartersData {
    const totals = transportTotals(this.game.economy, this.game.cargoTypes?.stats);
    const rows: FleetRow[] = [];
    const seen = new Set<string>();
    for (const svc of [...(this.game.scheduleCreator?.getActiveServices() || []), ...(this.game.depotManager?.getPhysicalRescueServices?.() || [])]) {
      if (!svc || !svc.position || svc.completed || svc.cancelled || seen.has(String(svc.id))) continue;
      seen.add(String(svc.id));
      const rame = this._displayRameForService(svc);
      const stops = svc.getCurrentStops?.() || svc.stops || [];
      const first = stops[0], last = stops[stops.length - 1];
      const stationName = (stop: { stationId?: unknown; locationName?: unknown } | undefined) => stop ? String(this.game.world.getStationById(stop.stationId)?.name || stop.locationName || stop.stationId || '') : '';
      rows.push({ id: String(svc.id), name: String(svc.isReturnLeg && svc.returnName ? svc.returnName : svc.name || 'Train'), number: String(svc.isReturnLeg ? svc.returnNumber || svc.number || '' : svc.number || svc.train?.number || ''), category: String(svc.serviceType || ''),
        state: String(svc.state || svc.train?.state || ''), speed: Number(svc.speed || 0), delay: Number(svc.delay || 0),
        origin: stationName(first), destination: stationName(last), departure: first?.departureTime == null ? null : Number(first.departureTime), arrival: last?.arrivalTime == null ? null : Number(last.arrivalTime),
        rameName: String(rame?.name || ''), elements: rame?.elementDetails || [] });
    }
    const pt = this.game.engine.getParisTime();
    return { ...totals, company: String(this.game.account?.companyName || 'Rail Empire'), clock: `${String(pt.hours).padStart(2,'0')}:${String(pt.minutes).padStart(2,'0')}:${String(pt.seconds || 0).padStart(2,'0')}`, rows };
  }

'''+s[insert:]
 # Replace active page setup; preserve only the proven station search, not photo controls.
 start=s.index('  renderInfogarePage() {');end=s.index('  _infogareDateDiffDays(',start)
 s=s[:start]+'''  renderInfogarePage() {
    const input = document.getElementById('infogare-station') as HTMLInputElement | null;
    const box = document.getElementById('infogare-station-suggestions'); if (!input) return;
    this._rebuildInfogareStationIndex();
    const previous = this._infogareSelectedStationId && this.game.world.getStationById(this._infogareSelectedStationId);
    if (previous && !previous.closed) { input.value = previous.name; input.dataset.stationId = previous.id; }
    else { input.value = ''; delete input.dataset.stationId; this._infogareSelectedStationId = ''; this._reBoard?.setActive(false); }
    input.oninput = () => {
      const selected = input.dataset.stationId ? this.game.world.getStationById(input.dataset.stationId) : null;
      if (!selected || this._normalizeInfogareSearch(selected.name) !== this._normalizeInfogareSearch(input.value)) { delete input.dataset.stationId; this._infogareSelectedStationId = ''; }
      this._renderInfogareStationSuggestions(input.value);
    };
    input.onfocus = () => { if (input.value.trim()) this._renderInfogareStationSuggestions(input.value); };
    input.onblur = () => setTimeout(() => box?.classList.add('hidden'), 120);
    const commit = () => {
      if (!this._commitInfogareStationSearch(true)) { input.setCustomValidity('Sélectionnez une gare valide.'); input.reportValidity(); input.setCustomValidity(''); }
    };
    input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') box?.classList.add('hidden'); };
    const btn = document.getElementById('btn-infogare-show'); if (btn) btn.onclick = commit;
    if (previous && !previous.closed) this._showInfogareBoard();
  }

'''+s[end:]
 start=s.index('  _showInfogareBoard(');end=s.index('  _stopInfogareClock()',start)
 s=s[:start]+'''  _showInfogareBoard(_refreshOnly: unknown = false) {
    const input = document.getElementById('infogare-station');
    const stationId = String(input?.dataset?.stationId || this._infogareSelectedStationId || '');
    const host = document.getElementById('infogare-board'); if (!stationId || !host) return;
    if (this._infogareInterval) { clearInterval(this._infogareInterval); this._infogareInterval = null; }
    this._stopInfogareClock();
    host.onwheel = null; // native vertical scrolling, no cyclic paging
    if (!this._reBoard) this._reBoard = new RailEmpireBoard(host, (horizon, arrivals) => {
      const id = String(document.getElementById('infogare-station')?.dataset?.stationId || this._infogareSelectedStationId || '');
      const pt = this.game.engine.getParisTime();
      const records = this._getInfogareTrains(id, arrivals ? 'sncf-arr' : 'sncf-dep', horizon);
      const rows: BoardRow[] = records.map((r: InfogareRow) => ({
        key: `${r.svcId}|${r.occurrenceId || ''}|${r.depTime ?? ''}|${r.arrTime ?? ''}|${arrivals ? 'A' : 'D'}`,
        serviceId: String(r.svcId), name: String(r.name || ''), number: String(r.trainNumber || ''), category: String(r.category || ''),
        origin: String(r.origin || ''), destination: String(r.destination || ''), via: arrivals ? r.fromStations.slice(1) : r.servedStations.slice(0, -1),
        platform: String(r.voie || ''), plannedMinute: Number(arrivals ? r.arrTime : r.depTime), waitMinute: Number(r.waitMin || 0), delay: Number(r.delay || 0),
        cancelled: !!r.isCancelled, state: String(r.state || ''), reason: String(r.delayReason || ''), dayOffset: Math.floor(Number(arrivals ? r.arrTime : r.depTime) / 1440),
      }));
      return { station: String(this.game.world.getStationById(id)?.name || 'Gare indisponible'), clock: `${String(pt.hours).padStart(2,'0')}:${String(pt.minutes).padStart(2,'0')}`, date: String(this.game.engine.currentDate || this.game.engine.getParisDate?.() || ''), rows };
    });
    this._reBoard.show(stationId);
  }

'''+s[end:]
 # Lookahead extension: planner remains the authoritative source of eligible V2 dates.
 s=rep(s,'  _collectInfogareV2Trains(stationId: unknown, currentDate: unknown, nowMin: number) {','  _collectInfogareV2Trains(stationId: unknown, currentDate: unknown, nowMin: number, horizonMin: number = 1440) {')
 s=rep(s,'    const baseDates: unknown[] = [this._infogareAddDays(currentDate, -1), currentDate, this._infogareAddDays(currentDate, 1)];', '''    const baseDates: unknown[] = [];
    for (let day = -1; day <= Math.ceil((nowMin + horizonMin) / 1440); day++) baseDates.push(this._infogareAddDays(currentDate, day));''')
 a=s.index('  _collectInfogareV2Trains(');b=s.index('  _collectInfogareLegacyTrains(',a)
 part=s[a:b].replace('v <= 1440','v <= horizonMin')
 # Pass-through stations are not advertised as served stops.
 part=part.replace('if (!loc || loc.stationId !== stationId) continue;', "if (!loc || loc.stationId !== stationId || loc.kind === 'PASS' || loc.type === 'passage' || loc.stopCode === 'NONE' && i > 0 && i < locs.length - 1) continue;")
 s=s[:a]+part+s[b:]
 s=rep(s,'  _getInfogareTrains(stationId: unknown, mode: unknown) {','  _getInfogareTrains(stationId: unknown, mode: unknown, horizonMin: number = 1440) {')
 s=rep(s,'...this._collectInfogareV2Trains(stationId, currentDate, now),','...this._collectInfogareV2Trains(stationId, currentDate, now, horizonMin),')
 s=rep(s,'...this._collectInfogareLegacyTrains(stationId, currentDate, now),','...this._collectInfogareLegacyTrains(stationId, currentDate, now, horizonMin),')
 a=s.index('  _getInfogareTrains(');b=s.index('  _fmtTime(',a)
 s=s[:a]+s[a:b].replace('<= 1440','<= horizonMin')+s[b:]
 # TEMP legacy extension implemented separately below.
 s=rep(s,'  _collectInfogareLegacyTrains(stationId: unknown, currentDate: unknown, nowMin: number) {','  _collectInfogareLegacyTrains(stationId: unknown, currentDate: unknown, nowMin: number, _horizonMin: number = 1440) {')
 return s
edit('src/ts/ui.ts',ui)

def html(s):
 s=rep(s,'<button class="nav-btn" data-page="rolling-stock">', '<button class="nav-btn" data-page="qg">QG</button>\n          <button class="nav-btn" data-page="rolling-stock">')
 start=s.index('      <div id="page-infogare"');end=s.index('      <!-- DASHBOARD PAGE -->',start)
 s=s[:start]+'''      <div id="page-qg" class="page"></div>
      <div id="page-infogare" class="page">
        <div class="page-content re-infogare-content">
          <div class="page-header"><div><span class="re-eyebrow">RAIL EMPIRE · VOYAGEURS</span><h2>Infogare RE</h2></div></div>
          <div class="form-row infogare-control-panel re-infogare-picker">
            <div class="form-group" style="flex:1;position:relative">
              <label for="infogare-station">Gare</label>
              <div class="infogare-station-picker">
                <input type="text" id="infogare-station" placeholder="Tapez le nom d’une gare…" autocomplete="off" spellcheck="false">
                <div id="infogare-station-suggestions" class="infogare-station-suggestions hidden"></div>
              </div>
            </div>
            <button id="btn-infogare-show" class="btn-primary" type="button">Afficher</button>
          </div>
          <div id="infogare-board"><p class="re-empty">Sélectionnez une gare pour afficher le panneau Rail Empire.</p></div>
        </div>
      </div>

'''+s[end:]
 s=rep(s,'          <div class="rame-random-help">', '''          <div class="rame-random-options">
            <label for="rame-random-max">Nombre maximal d’engins (locomotives comprises)<input id="rame-random-max" type="number" min="1" step="1" placeholder="Sans limite de nombre"></label>
            <label class="rame-random-toggle"><input id="rame-random-departure" type="checkbox">Remélanger les wagons à chaque nouvelle course</label>
          </div>
          <div class="rame-random-help">''')
 s=s.replace('Random 750 m conserve la/les locomotive(s) déjà posée(s), remplace uniquement les wagons et utilise les modèles cochés dans un ordre aléatoire sans dépasser 750 m.', 'À la création, Random remplace les wagons avec les modèles sélectionnés, sans dépasser 750 m ni le maximum d’engins. Il active le remélange aux départs : mêmes wagons, mêmes identifiants et livrées ; locomotives fixes. Aucun achat ni ajout au départ, aucun remélange aux arrêts intermédiaires.')
 return s
edit('index.html',html)

p=root/'package.json';d=json.loads(p.read_text());d['railEmpireBuild']='S3_GAMEPLAY_REPAIR_RC24_QG_RANDOM_INFOGARE_1199repair24';d['scripts']['typecheck:rc24-core']='tsc -p tsconfig.rc24-core.json';d['scripts']['build:repair']=d['scripts']['build:repair'].replace(' && npm run audit:typescript',' && npm run typecheck:rc24-core && npm run audit:typescript');p.write_text(json.dumps(d,indent=2)+'\n')
