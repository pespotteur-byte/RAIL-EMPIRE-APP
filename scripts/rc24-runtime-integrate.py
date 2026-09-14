from pathlib import Path
p=Path('src/ts/schedule-creator.ts');s=p.read_text();s="import { randomizeRameDeparture } from './rame-random.js';\n"+s
s=s.replace('  declare _v2DirectRameId?: string;', '  declare _v2RandomDepartureKey?: string;\n  declare _v2DirectRameId?: string;')
needle='  _recordConnectionDeparture(stop: ServiceStop, timeOfDay: number, dateStr: string) {'
assert needle in s
s=s.replace(needle,'''  /** Only a committed origin/return departure shuffles a marked consist. No station-stop redraws. */
  _prepareRandomDeparture(dateStr: string) {
    const origin = this.getCurrentStops()[0];
    const key = `${this.id}|${this._v2BaseDate || this._legacyOperatingDay || dateStr}|${this._tripCount || 0}|${this.isReturnLeg ? 'R' : 'A'}|${origin?.departureTime ?? ''}`;
    if (this._v2OccurrenceId) {
      globalThis.window?.game?.scheduleV2Runtime?.prepareRandomDeparture(this, key);
    } else if (this.rame) {
      randomizeRameDeparture(this.rame, key);
    }
  }

'''+needle)
for stops in ['currentStops','curStops']:
 a=f'          this._recordConnectionDeparture({stops}[0], timeOfDay, dateStr);'
 assert a in s;s=s.replace(a, '          this._prepareRandomDeparture(dateStr);\n'+a,1)
p.write_text(s)
p=Path('src/ts/schedule-v2-runtime.ts');s=p.read_text();s="import { randomizeRameDeparture } from './rame-random.js';\n"+s
s=s.replace('type RuntimeSnapshot = Record<string, unknown> & { passageTailSpeedHolds?', 'type RuntimeSnapshot = Record<string, unknown> & { randomDepartureKey?: string; passageTailSpeedHolds?')
needle='    _refreshRuntimeFormation(svc: ActiveServiceLike) {'; assert needle in s
s=s.replace(needle,'''    /** RC24: direct assignments reorder their source; advanced formations reorder only current members. */
    prepareRandomDeparture(svc: ActiveServiceLike, key: string): void {
        if (!key || svc._v2RandomDepartureKey === key || !svc.rame) return;
        const rames = this.game.rameManager;
        const direct = svc._v2DirectRameId ? rames?.getRame(svc._v2DirectRameId) : null;
        if (direct) {
            if (!direct.randomizeOnDeparture) return;
            randomizeRameDeparture(direct, key);
            // The aggregate direct-runtime proxy has identical mass/power/length/capacity.
            // Never rebuild rotations or purchase material on a departure.
            svc._v2RandomDepartureKey = key;
            return;
        }
        let source = svc._v2AssignedRameId ? rames?.getRame(svc._v2AssignedRameId) : null;
        if (!source) {
            const sourceIds = new Set((svc._v2FormationMembers || []).map(m => this.game.rotationV2.getVehicle(m.vehicleId)?.sourceRameId).filter(Boolean));
            if (sourceIds.size === 1) source = rames?.getRame(String([...sourceIds][0]));
        }
        if (!source?.randomizeOnDeparture) return;
        const members = new Map((svc._v2FormationMembers || []).map(m => [m.vehicleId, m]));
        // All details must have a real physical identity before modifying anything.
        if (svc.rame.elementDetails.some(e => !members.has(String(e.physicalVehicleId || '')))) return;
        svc.rame.randomizeOnDeparture = true;
        randomizeRameDeparture(svc.rame, key);
        const ordered = svc._v2FormationReversed ? [...svc.rame.elementDetails].reverse() : svc.rame.elementDetails;
        svc._v2FormationMembers = ordered.map(e => ({ ...members.get(String(e.physicalVehicleId))! }));
        svc._v2VehicleIds = svc._v2FormationMembers.map(m => m.vehicleId);
        svc._v2RandomDepartureKey = key;
    }

'''+needle)
s=s.replace('        svc.rame.elementDetails = details as typeof svc.rame.elementDetails;', '        svc.rame.elementDetails = details as typeof svc.rame.elementDetails;\n        svc.rame.elements = details.map(d => String(d.catalogId || d.id || \'\'));')
s=s.replace('                vehicleIds: [...(s._v2VehicleIds || [])],', "                randomDepartureKey: s._v2RandomDepartureKey || '',\n                vehicleIds: [...(s._v2VehicleIds || [])],")
s=s.replace('        svc._v2VehicleIds = [...(snap.vehicleIds', "        svc._v2RandomDepartureKey = typeof snap.randomDepartureKey === 'string' ? snap.randomDepartureKey : '';\n        svc._v2VehicleIds = [...(snap.vehicleIds")
p.write_text(s)
