from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]
def edit(name,old,new,count=1):
 p=r/name;s=p.read_text();n=s.count(old)
 if n!=count:raise RuntimeError(f'{name}: expected {count} occurrences, got {n}: {old[:120]}')
 p.write_text(s.replace(old,new))
(r/'src/ts/map-lighting.ts').write_text('''/** Presentation-only lighting. Never changes the simulation clock or weather.
 * NASA VIIRS/Black Marble is coarse regional radiance, not street-level night photography.
 * At close zoom we preserve the detailed basemap instead of magnifying its light halos.
 */
export type GPSLightingMode = 'auto' | 'day' | 'night';
export const GPS_LIGHTING_STORAGE_KEY = 'rail-empire.gps-lighting.v1';
export const NIGHT_LIGHTS_NATIVE_ZOOM = 8;
export const NIGHT_LIGHTS_END_ZOOM = 10;
export const NIGHT_LIGHTS_MAX_OPACITY = 0.30;
export const SATELLITE_NIGHT_TINT = 'rgba(2,8,20,0.48)';
export const OSM_DARK_FILTER = 'invert(90%) hue-rotate(180deg) brightness(82%) contrast(92%) saturate(72%)';

export function normalizeGPSLighting(value: unknown): GPSLightingMode {
    return value === 'day' || value === 'night' ? value : 'auto';
}
export function clockNightAmount(minutes: number): number {
    if (!Number.isFinite(minutes)) return 0;
    const hour = ((minutes % 1440) + 1440) % 1440 / 60;
    if (hour < 5.5 || hour >= 21) return 1;
    if (hour < 7) return (7 - hour) / 1.5;
    if (hour >= 19.5) return (hour - 19.5) / 1.5;
    return 0;
}
export function resolveGPSLighting(mode: unknown, minutes: number, originalOSM: boolean): {
    mode: GPSLightingMode; amount: number; night: boolean; mapNight: boolean;
} {
    const selected = normalizeGPSLighting(mode);
    const amount = selected === 'night' ? 1 : selected === 'day' ? 0 : clockNightAmount(minutes);
    const night = amount > 0.45;
    // RC21 contract: Auto preserves an explicitly selected ORIGINAL OSM basemap.
    // A manual Night selection is explicit consent to a local dark style on that same source.
    return { mode: selected, amount, night, mapNight: night && (!originalOSM || selected === 'night') };
}
export function nightLightsOpacity(zoom: number, enabled: boolean, satellite: boolean): number {
    if (!enabled || !satellite || !Number.isFinite(zoom) || zoom >= NIGHT_LIGHTS_END_ZOOM) return 0;
    const t = Math.max(0, Math.min(1, (zoom - NIGHT_LIGHTS_NATIVE_ZOOM) / (NIGHT_LIGHTS_END_ZOOM - NIGHT_LIGHTS_NATIVE_ZOOM)));
    // Smooth fade, zero at z10: no regional pixels stretched at GPS/street zoom.
    return NIGHT_LIGHTS_MAX_OPACITY * (1 - t * t * (3 - 2 * t));
}
export function nightAppearanceLabel(enabled: boolean, satellite: boolean, zoom: number): string {
    if (!enabled) return 'Jour · fond sélectionné';
    if (!satellite) return 'Nuit · style sombre local du fond sélectionné';
    return nightLightsOpacity(zoom, enabled, satellite) > 0
        ? 'Nuit régionale · lumières NASA atténuées'
        : 'Nuit détaillée · satellite de jour assombri, sans halos NASA';
}
''')
# map: independent base choice and lighting, source-resolution-aware regional overlay.
edit('src/ts/map.ts',"import type { BaseMapSource, TileAccessState } from './tile-access-policy.js';", "import type { BaseMapSource, TileAccessState } from './tile-access-policy.js';\nimport { nightLightsOpacity, nightAppearanceLabel, NIGHT_LIGHTS_NATIVE_ZOOM, SATELLITE_NIGHT_TINT, OSM_DARK_FILTER } from './map-lighting.js';")
edit('src/ts/map.ts','this._nightSatelliteMaxZoom = 8;', 'this._nightSatelliteMaxZoom = NIGHT_LIGHTS_NATIVE_ZOOM;')
edit('src/ts/map.ts', '''        // HOTFIX71 — GPS night mode is a real satellite composite: detailed Esri
        // World Imagery remains the geometric/base texture while NASA GIBS VIIRS
        // Black Marble (actual nighttime Earth imagery) is overlaid above it. This
        // keeps local railway detail at close GPS zoom while adding real nocturnal
        // city-light patterns instead of substituting a dark road map.''', '''        // RC23 — night is a style of the selected base, never an implicit provider switch.
        // Regional NASA lights fade out completely before local GPS zoom; detailed
        // night is honestly a day-imagery tint, not claimed nighttime photography.''')
start=(r/'src/ts/map.ts').read_text().index('        // HOTFIX71: at night')
end=(r/'src/ts/map.ts').read_text().index('        if (this.railEnabled)',start)
s=(r/'src/ts/map.ts').read_text()
s=s[:start]+'''        const baseUrls = this.satelliteEnabled ? this.satelliteTileUrls : this.baseTileUrls;
        const lightsOpacity = this.getNightLightsOpacity();
        const layers = [baseUrls];
        if (lightsOpacity > 0) layers.push(this.nightSatelliteTileUrls);
        if (this.satelliteEnabled && this.labelTileUrls.length) layers.push(this.labelTileUrls);
'''+s[end:]
(r/'src/ts/map.ts').write_text(s)
edit('src/ts/map.ts','const isSatLayer = urls === baseUrls && (this.satelliteEnabled || this.nightMapEnabled);','const isSatLayer = urls === baseUrls && this.satelliteEnabled;')
edit('src/ts/map.ts','const isNightSatelliteLayer = this.nightMapEnabled && urls === this.nightSatelliteTileUrls;','const isNightSatelliteLayer = lightsOpacity > 0 && urls === this.nightSatelliteTileUrls;')
edit('src/ts/map.ts','const isNightBaseLayer = this.nightMapEnabled && urls === baseUrls;','const isNightBaseLayer = this.nightMapEnabled && this.satelliteEnabled && urls === baseUrls;')
edit('src/ts/map.ts','const isDarkBaseLayer = !this.nightMapEnabled && !this.satelliteEnabled && !this.basicMode && urls === baseUrls;','const isDarkBaseLayer = !this.satelliteEnabled && (this.nightMapEnabled || !this.basicMode) && urls === baseUrls;')
edit('src/ts/map.ts',"? 'invert(90%) hue-rotate(180deg) brightness(82%) contrast(92%) saturate(72%)'",'? OSM_DARK_FILTER')
edit('src/ts/map.ts','tctx.globalAlpha = 0.88;','tctx.globalAlpha = lightsOpacity;')
edit('src/ts/map.ts',"tctx.fillStyle = 'rgba(2,8,20,0.68)';",'tctx.fillStyle = SATELLITE_NIGHT_TINT;')
edit('src/ts/map.ts', '''                // One flat fill is vastly cheaper than filtering every satellite tile and
                // still leaves the actual VIIRS layer responsible for the visible lights.''', '''                // One flat tint, no blur, screen blend or extra full-size surface.
                // Close views retain native detail; regional VIIRS never hides it.''')
# map attribution is source-aware, not 'NASA' on OSM or on z20 imagery.
edit('src/ts/map.ts','    getBaseMapAccess(): TileAccessState', '''    getNightLightsOpacity(): number {
        return nightLightsOpacity(this.zoomLevel, this.nightMapEnabled, this.satelliteEnabled);
    }
    getMapAppearanceLabel(): string {
        return nightAppearanceLabel(this.nightMapEnabled, this.satelliteEnabled, this.zoomLevel);
    }
    getMapCreditText(): string {
        const source = this._baseSource;
        const base = this.satelliteEnabled ? '© OpenStreetMap contributors · Esri World Imagery'
            : /openstreetmap/i.test(source.attribution) ? source.attribution : source.attribution + ' · © OpenStreetMap contributors';
        return base + (this.getNightLightsOpacity() > 0 ? ' · NASA GIBS / VIIRS Black Marble' : '')
            + (this.railEnabled ? ' · OpenRailwayMap' : '');
    }
    getBaseMapAccess(): TileAccessState''')
s=(r/'src/ts/map.ts').read_text();start=s.index('        const source = this._baseSource;',s.index('    private _updateMapCredit'));end=s.index('        if (this._mapCredit.textContent !== text)',start)
s=s[:start]+"        const text = this.getMapCreditText() + ' · Licence OSM';\n"+s[end:];(r/'src/ts/map.ts').write_text(s)
# Renderer toggle and source credit. No simulation/physics changes.
edit('src/ts/renderer.ts',"|'basic'|'satellite'|'weather'", "|'basic'|'satellite'|'night'|'weather'")
edit('src/ts/renderer.ts',"        satellite: document.getElementById('toggle-satellite') as HTMLInputElement,", "        satellite: document.getElementById('toggle-satellite') as HTMLInputElement,\n        night: document.getElementById('toggle-night') as HTMLInputElement,")
edit('src/ts/renderer.ts',"      if (this._toggleEls.orm) {", """      if (this._toggleEls.night) {
        this._toggleEls.night.checked = this.tileMap.nightMapEnabled;
        this._toggleEls.night.addEventListener('change', () => {
          this.tileMap.setNightMapEnabled(this._toggleEls.night!.checked);
          this.requestRender();
        });
      }
      if (this._toggleEls.orm) {""")
edit('src/ts/renderer.ts',"this._toggleEls.satellite.checked = this.tileMap.satelliteEnabled || this.tileMap.nightMapEnabled;", "this._toggleEls.satellite.checked = this.tileMap.satelliteEnabled;\n    if (this._toggleEls.night) this._toggleEls.night.checked = this.tileMap.nightMapEnabled;")
s=(r/'src/ts/renderer.ts').read_text();start=s.index('      const configuredCredit =');end=s.index('      if (this._livemapAttributionEl.textContent',start)
s=s[:start]+"      const credit = this.tileMap.getMapCreditText();\n"+s[end:];(r/'src/ts/renderer.ts').write_text(s)
# source panel: night does not mean satellite any more.
edit('src/ts/map-source-panel.ts','this.map.satelliteEnabled || this.map.nightMapEnabled', 'this.map.satelliteEnabled',count=2)
edit('src/ts/map-source-panel.ts',"this.map.basicMode ? ' original' : ' sombre'", "this.map.nightMapEnabled ? ' · nuit' : this.map.basicMode ? ' original' : ' sombre'")
edit('src/ts/map-source-panel.ts',"if (this.map.satelliteEnabled) message += ' Le fond satellite est actuellement sélectionné.';", "if (this.map.satelliteEnabled) message += ' Le fond satellite est actuellement sélectionné.';\n        if (this.map.nightMapEnabled) message += ' ' + this.map.getMapAppearanceLabel() + '.';")
# UI
edit('src/ts/ui.ts',"import { RELEASE } from './build-info.js';", "import { RELEASE } from './build-info.js';\nimport { normalizeGPSLighting, resolveGPSLighting, GPS_LIGHTING_STORAGE_KEY, type GPSLightingMode } from './map-lighting.js';")
edit('src/ts/ui.ts','export class UI {\n',"export class UI {\n  private _threeDLightingFilter: GPSLightingMode = 'auto';\n")
edit('src/ts/ui.ts',"    this._threeDWeatherFilter = 'auto';", "    this._threeDWeatherFilter = 'auto';\n    try { this._threeDLightingFilter = normalizeGPSLighting(localStorage.getItem(GPS_LIGHTING_STORAGE_KEY)); }\n    catch { /* Visual preference remains session-local when storage is unavailable. */ }")
old='''      if (target?.id !== 're3d-weather-filter') return;
      const allowed = new Set(['auto','clear','rain','snow','storm','fog','heat']);
      this._threeDWeatherFilter = allowed.has(String(target.value)) ? String(target.value) : 'auto';'''
new='''      if (!target) return;
      if (target.id === 're3d-lighting-filter') {
        this._set3DLightingFilter(target.value);
      } else if (target.id === 'toggle-night' && this._threeDFollowActive) {
        this._set3DLightingFilter((target as unknown as HTMLInputElement).checked ? 'night' : 'day');
      } else if (target.id === 'toggle-basic' && this._threeDFollowActive && (target as unknown as HTMLInputElement).checked) {
        // Explicit 'OSM original' must not be instantly undone by a previous night override.
        this._set3DLightingFilter('day');
      } else if (target.id === 're3d-weather-filter') {
        const allowed = new Set(['auto','clear','rain','snow','storm','fog','heat']);
        this._threeDWeatherFilter = allowed.has(String(target.value)) ? String(target.value) : 'auto';
      } else return;'''
edit('src/ts/ui.ts',old,new)
edit('src/ts/ui.ts','''      // The 3D mode is read-only, so wheel can safely be dedicated to GPS zoom.
      e.preventDefault();''','''      // Controls can scroll independently; changing a select must not zoom the map.
      if ((e.target as Element | null)?.closest?.('.re3d-controls, .map-toggles, .map-source-panel, .livemap-panel')) return;
      e.preventDefault();''')
edit('src/ts/ui.ts','  toggle3DFollow() {', '''  _set3DLightingFilter(value: unknown) {
    this._threeDLightingFilter = normalizeGPSLighting(value);
    try { localStorage.setItem(GPS_LIGHTING_STORAGE_KEY, this._threeDLightingFilter); } catch { /* Optional preference. */ }
    const select = document.getElementById('re3d-lighting-filter') as HTMLSelectElement | null;
    if (select) select.value = this._threeDLightingFilter;
    this._threeDAtmosphereKey = '';
  }

  toggle3DFollow() {''')
edit('src/ts/ui.ts',"const keepOriginalBase = !!tm.basicMode && !tm.satelliteEnabled && !tm.nightMapEnabled;", "const keepOriginalBase = !!tm.basicMode && !tm.satelliteEnabled;")
edit('src/ts/ui.ts',"    if (weatherFilter) weatherFilter.value = this._threeDWeatherFilter || 'auto';", "    if (weatherFilter) weatherFilter.value = this._threeDWeatherFilter || 'auto';\n    const lightingFilter = document.getElementById('re3d-lighting-filter') as HTMLSelectElement | null;\n    if (lightingFilter) lightingFilter.value = this._threeDLightingFilter;")
edit('src/ts/ui.ts',"    const wea = document.getElementById('toggle-weather');", "    const nit = document.getElementById('toggle-night') as HTMLInputElement | null; if (nit) nit.checked = !!tm.nightMapEnabled;\n    const wea = document.getElementById('toggle-weather');")
s=(r/'src/ts/ui.ts').read_text();start=s.index('    const time = ((Number(this.game.timeOfDay',s.index('  _sync3DAtmosphere('));end=s.index('    if (!force && key ===',start)
s=s[:start]+'''    const tm = this.game.renderer?.tileMap;
    const originalOSM = !!tm?.basicMode && !tm?.satelliteEnabled;
    const lighting = resolveGPSLighting(this._threeDLightingFilter, Number(this.game.timeOfDay), originalOSM);
    const night = lighting.amount;
    const nightActive = lighting.night;
    const key = [originalOSM ? 'osm' : 'imagery', type, visualFilter, lighting.mode, tm?.nightMapEnabled,
      Math.floor(Number(tm?.zoomLevel || 0) * 10), nightActive ? 'nightmap' : 'daymap', Math.round(night * 10),
      Math.round(Number(weather?.cloudCover || 0) / 10), Math.round(Number(weather?.precipitation || 0) * 10), Math.round(Number(weather?.temperature || 0))].join('|');
'''+s[end:]
s=s.replace('''    // HOTFIX72 — at night the GPS changes CARTOGRAPHY, not just brightness:
    // detailed Esri satellite stays underneath a real NASA VIIRS night-light layer.
    const nightChanged = this.game.renderer?.tileMap?.setNightMapEnabled?.(nightActive && !originalOSM) === true;''','''    // RC23: manual day/night affects presentation only, never time/weather/physics.
    const nightChanged = tm?.setNightMapEnabled?.(lighting.mapNight) === true;''')
s=s.replace('''    // Night darkness now comes from the actual night map. Keep only a light
    // atmospheric tint here so rain/fog/storm remain legible without double-dimming.''','''    // The map carries its own night style; this small weather tint needs no
    // Canvas filter, blur shader or extra raster allocation.''')
s=s.replace("    if (badge) badge.textContent = `SUIVI 3D GPS · ${nightActive ? 'NUIT' : 'JOUR'}${type !== 'clear' ? ' · ' + (labels[type] || type).toUpperCase() : ''}`;", """    if (badge) badge.textContent = `SUIVI 3D GPS · ${nightActive ? 'NUIT' : 'JOUR'}${lighting.mode === 'auto' ? ' AUTO' : ' FORCÉ'}${type !== 'clear' ? ' · ' + (labels[type] || type).toUpperCase() : ''}`;
    const note = document.getElementById('re3d-lighting-note');
    const description = lighting.mode === 'auto' && originalOSM
      ? 'Auto : couleurs OSM originales conservées. Nuit force le style sombre.'
      : tm?.getMapAppearanceLabel?.() || '';
    if (note && note.textContent !== description) note.textContent = description;
    this._sync3DToggleInputs();""")
(r/'src/ts/ui.ts').write_text(s)
# HTML clear labels, original remains original unless Night is explicitly requested.
edit('index.html','''            <label class="re3d-weather-filter wide">Météo visuelle''','''            <label class="re3d-weather-filter wide">Éclairage visuel
              <select id="re3d-lighting-filter" aria-label="Filtre jour ou nuit GPS" aria-describedby="re3d-lighting-note">
                <option value="auto">Auto · heure du jeu</option>
                <option value="day">☀ Jour</option>
                <option value="night">☾ Nuit</option>
              </select>
            </label>
            <small id="re3d-lighting-note" class="re3d-lighting-note">Filtres visuels : l’heure et la simulation ne changent pas.</small>
            <label class="re3d-weather-filter wide">Météo visuelle''')
edit('index.html','''            <label><input type="checkbox" id="toggle-satellite"> Satellite</label>''','''            <label><input type="checkbox" id="toggle-satellite"> Satellite</label>
            <label title="Filtre nocturne du fond sélectionné. Lumières NASA atténuées en vue régionale ; détail local sans halos. Ne change pas l’heure du jeu."><input type="checkbox" id="toggle-night"> ☾ Nuit</label>''')
# One compact right column on desktop, panels side-by-side on narrow displays.
# Fixed top based on controlled row layout, with independent scroll for short windows.
with (r/'style.css').open('a') as f:f.write('''
/* RC23 — lighting controls and display filters remain independently reachable. */
.re3d-lighting-note {grid-column:1/-1;color:#aebed0;font:500 9px/1.3 system-ui,sans-serif;overflow-wrap:anywhere;}
#main-area.re3d-active .re3d-controls {width:132px;max-height:calc(100% - 125px);overflow-y:auto;overscroll-behavior:contain;}
#main-area.re3d-active .map-toggles {top:88px;right:164px;width:112px;max-height:calc(100% - 135px);overscroll-behavior:contain;}
#toggle-night {accent-color:#8b9fd9;}
@media(max-width:900px) {
  #main-area.re3d-active .re3d-controls {top:auto;bottom:44px;right:10px;width:122px;max-height:calc(100% - 130px);}
  #main-area.re3d-active .map-toggles {top:auto;bottom:44px;right:156px;width:102px;max-height:210px;}
}
''')
# New build and caches, keep old proof/log files untouched.
p=json.loads((r/'package.json').read_text());p['railEmpireBuild']='S3_GAMEPLAY_REPAIR_RC23_GPS_DAY_NIGHT_1199repair23';p['scripts']['typecheck:rc23-core']='tsc -p tsconfig.rc23-core.json';p['scripts']['build:repair']=p['scripts']['build:repair'].replace(' && npm run audit:typescript',' && npm run typecheck:rc23-core && npm run audit:typescript');(r/'package.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n')
c=json.loads((r/'tsconfig.rc20-core.json').read_text());c['files']=['src/ts/map-lighting.ts'];(r/'tsconfig.rc23-core.json').write_text(json.dumps(c,indent=2)+'\n')
changed=[]
for folder in ['src/ts','js/__tests__']:
 for p in (r/folder).rglob('*'):
  if not p.is_file() or p.suffix not in ['.ts','.js','.mjs']:continue
  s=p.read_text()
  if '1199repair22' in s:p.write_text(s.replace('1199repair22','1199repair23'));changed.append(str(p.relative_to(r)))
for name in ['index.html','admin.html','scripts/build-file-bundle-v1199.cjs']:
 p=r/name;s=p.read_text();p.write_text(s.replace('1199repair22','1199repair23'))
out=r/'QA/RE_REPAIR_RC23';out.mkdir(parents=True,exist_ok=True);(out/'CACHE_FIXTURE_VERSION_UPDATE.json').write_text(json.dumps(changed,indent=2))
print('RC23 sources and UI implemented')
