import {
  ScheduleState, TrainCategory, StopCode, LocationKind,
  isPassengerCategory, isOptionalStopCode, ValidationIssue, ValidationReport,
} from './schedule-v2-model.js';
import type { PerformanceProfile, RouteSegmentSnapshot, ScheduleVersion, ScheduledLocation } from './schedule-v2-model.js';

interface CoordinateLike { lat: number; lon: number; }
interface RoutePointLike extends CoordinateLike { wayId?: string | null; fallback?: boolean; }
interface ConstraintLike { id: string; legIndex: number; order: number; lat?: number | null; lon?: number | null; snapLat?: number | null; snapLon?: number | null; wayId?: string | null; }
interface LegLike { id: string; fromLocationId: string; toLocationId: string; constraintIds?: string[]; routePoints: RoutePointLike[]; segments?: RouteSegmentSnapshot[]; distanceKm?: number; }
interface SchedulePathLike { error?: unknown; resolvedRevision?: number; topologyRevision?: number; routePoints?: RoutePointLike[]; legs?: LegLike[]; constraints?: ConstraintLike[]; segments?: RouteSegmentSnapshot[]; distanceKm?: number; }
interface PointCompareOptions { checkWayId?: boolean; }
interface BearingOptions { arrival?: boolean; }
interface ValidationOptions { ormAvailable?: boolean; }

function issue(level: string, code: string, message: string, data: unknown = null): ValidationIssue { return new ValidationIssue(level, code, message, data); }

function isDieselProfile(profile: PerformanceProfile | null | undefined): boolean {
  const t = String(profile?.traction || '').toLowerCase();
  return t.includes('diesel') || t.includes('therm') || t.includes('gazole');
}

function electricSystemMatches(profile: PerformanceProfile | null | undefined, seg: RouteSegmentSnapshot): boolean | null {
  if (isDieselProfile(profile)) return true;
  const systems = profile?.electricSystems || [];
  if (!systems.length) return null;
  if (seg.electrified === false) return false;
  if (seg.electrified == null || !seg.voltage?.length) return null;
  const freqs = seg.frequency?.length ? seg.frequency : [0];
  for (const sys of systems) {
    for (const v of seg.voltage) for (const f of freqs) {
      const voltageOk = !sys.voltage || Math.abs(Number(sys.voltage)-Number(v)) <= Math.max(50, Number(v)*0.03);
      const freqOk = !sys.frequency || !f || Math.abs(Number(sys.frequency)-Number(f)) <= 1;
      if (voltageOk && freqOk) return true;
    }
  }
  return false;
}

function gaugeMatches(profile: PerformanceProfile | null | undefined, seg: RouteSegmentSnapshot): boolean | null {
  const wanted=(profile?.gauges||[]).map(Number).filter((x:number)=>Number.isFinite(x));
  const actual=(seg?.gauge||[]).map(Number).filter((x:number)=>Number.isFinite(x));
  if (!wanted.length || !actual.length) return null;
  return wanted.some((a:number) => actual.some((b:number) => Math.abs(a-b) <= 1));
}

function haversineKm(a: CoordinateLike | null | undefined, b: CoordinateLike | null | undefined): number {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return Infinity;
  const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLon=(b.lon-a.lon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function numericClose(a: unknown,b: unknown,tolerance=0.002): boolean {
  return Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=tolerance;
}

function pointEquivalent(a: RoutePointLike | null | undefined,b: RoutePointLike | null | undefined,toleranceKm=0.003,{checkWayId=false}:PointCompareOptions={}): boolean {
  if(haversineKm(a,b)>toleranceKm)return false;
  if(!checkWayId)return true;
  const aw=String(a?.wayId||'').trim(),bw=String(b?.wayId||'').trim();
  return !aw||!bw||aw===bw;
}

function polylineDistanceKm(points:RoutePointLike[]): number {
  let d=0;for(let i=1;i<(points||[]).length;i++){const x=haversineKm(points[i-1],points[i]);if(!Number.isFinite(x))return Infinity;d+=x;}return d;
}

function routeBearingDeg(a: CoordinateLike | null | undefined,b: CoordinateLike | null | undefined): number | null {
  if(!a||!b)return null;
  const lat1=Number(a.lat)*Math.PI/180,lat2=Number(b.lat)*Math.PI/180,dLon=(Number(b.lon)-Number(a.lon))*Math.PI/180;
  if(![lat1,lat2,dLon].every(Number.isFinite))return null;
  const y=Math.sin(dLon)*Math.cos(lat2),x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function routeTurnAngleDeg(a:number,b:number): number | null {if(!Number.isFinite(a)||!Number.isFinite(b))return null;let d=Math.abs(a-b)%360;return d>180?360-d:d;}
function endpointBearing(points:RoutePointLike[],{arrival=false}:BearingOptions={}): number | null {
  if(!Array.isArray(points)||points.length<2)return null;
  if(arrival){const end=points[points.length-1];for(let i=points.length-2;i>=0;i--)if(haversineKm(points[i],end)>0.0005)return routeBearingDeg(points[i],end);}
  else{const start=points[0];for(let i=1;i<points.length;i++)if(haversineKm(start,points[i])>0.0005)return routeBearingDeg(start,points[i]);}
  return null;
}

function normalizeLoadingGauge(value:unknown): string {return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^TSI/,'').replace(/^UIC/,'');}
function loadingGaugeCompatible(required:unknown,available:unknown): boolean | null {
  const req=normalizeLoadingGauge(required),have=normalizeLoadingGauge(available);
  if(!req||!have)return null;if(req===have)return true;
  const rank: Record<string, number>={GA:1,GB:2,GC:3};
  return rank[req]!=null&&rank[have]!=null ? rank[have]>=rank[req] : false;
}

function anchorOf(loc: ScheduledLocation): CoordinateLike | null {
  const lat=loc?.track?.snapLat ?? loc?.track?.lat;
  const lon=loc?.track?.snapLon ?? loc?.track?.lon;
  return Number.isFinite(lat)&&Number.isFinite(lon)?({lat,lon} as CoordinateLike):null;
}

function routePointMatchesAnchor(point:RoutePointLike | null | undefined, anchor:CoordinateLike | null | undefined, wayId = '', toleranceKm = 0.025): boolean {
  if (!point || !anchor || haversineKm(point,anchor) > toleranceKm) return false;
  const wanted=String(wayId||'').trim();
  return !wanted || String(point?.wayId||'').trim()===wanted;
}

function routeContainsAnchor(routePoints:RoutePointLike[], anchor:CoordinateLike | null | undefined, wayId = '', toleranceKm = 0.025): boolean {
  return (routePoints||[]).some((p)=>routePointMatchesAnchor(p,anchor,wayId,toleranceKm));
}

function validatePathStructure(version:ScheduleVersion, issues:ValidationIssue[]): void {
  const locs:ScheduledLocation[]=version.locations||[];
  const path=version.outboundPath as SchedulePathLike | null | undefined;
  if (!path) {
    issues.push(issue('ERROR','OUTBOUND_ROUTE_MISSING','Le tracé aller ORM est absent.'));
    return;
  }
  if (path.error) {
    issues.push(issue('ERROR','ROUTE_RECOMPUTE_FAILED',`Le dernier recalcul ORM a échoué : ${path.error}`, { error:path.error }));
  }
  if (Number(path.resolvedRevision||0) !== Number(path.topologyRevision||0)) {
    issues.push(issue('ERROR','ROUTE_TOPOLOGY_STALE','Le tracé ORM affiché correspond à une ancienne topologie (gare/voie/VIA modifié). Recalcul obligatoire avant validation.', { topologyRevision:path.topologyRevision||0,resolvedRevision:path.resolvedRevision||0 }));
  }
  if (!path.routePoints?.length || path.routePoints.length < 2) {
    issues.push(issue('ERROR','OUTBOUND_ROUTE_MISSING','Le tracé aller ORM est incomplet.'));
  }
  if (path.routePoints?.some((p) => p.fallback)) {
    issues.push(issue('ERROR','SYNTHETIC_ROUTE','Tracé synthétique interdit : choisissez un vrai chemin ferroviaire ORM.'));
  }

  const expectedLegs=Math.max(0,locs.length-1);
  if ((path.legs?.length||0)!==expectedLegs) {
    issues.push(issue('ERROR','LEG_COUNT_MISMATCH',`Le trajet doit contenir exactement ${expectedLegs} liaison(s) ORM pour ${locs.length} arrêt(s).`, { expected:expectedLegs, actual:path.legs?.length||0 }));
  }

  const validConstraintIds=new Set<string>((path.constraints||[]).map((c)=>String(c.id)));
  const seenConstraintIds=new Set<string>();
  for (const c of path.constraints||[]) {
    if (!Number.isInteger(Number(c.legIndex)) || c.legIndex<0 || c.legIndex>=expectedLegs) {
      issues.push(issue('ERROR','VIA_ORPHAN',`WAYPOINT ${c.id} rattaché à une liaison inexistante.`, { constraintId:c.id, legIndex:c.legIndex }));
    }
    if (!Number.isFinite(c.snapLat ?? c.lat) || !Number.isFinite(c.snapLon ?? c.lon)) {
      issues.push(issue('ERROR','VIA_POSITION_MISSING',`WAYPOINT ${c.id} sans position ferroviaire valide.`, { constraintId:c.id }));
    }
    if (Number(path.topologyRevision||0)>0 && !String(c.wayId||'').trim()) issues.push(issue('ERROR','VIA_WAY_ID_MISSING',`WAYPOINT ${c.id} non verrouillé sur une voie ORM exacte.`, {constraintId:c.id}));
  }

  let previousEnd:RoutePointLike|null=null,previousLeg:LegLike|null=null;
  for (let i=0;i<expectedLegs;i++) {
    const a=locs[i], b=locs[i+1];
    const matches=(path.legs||[]).filter((l)=>l.fromLocationId===a.id && l.toLocationId===b.id);
    if (matches.length!==1) {
      issues.push(issue('ERROR','LEG_IDENTITY_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : liaison ORM ${matches.length?'dupliquée':'absente'}.`, { fromLocationId:a.id,toLocationId:b.id,count:matches.length }));
      continue;
    }
    const leg=matches[0];
    if (!Array.isArray(leg.routePoints) || leg.routePoints.length<2) {
      issues.push(issue('ERROR','LEG_ROUTE_MISSING',`${a.name||a.id} → ${b.name||b.id} : géométrie ORM absente.`, { legId:leg.id }));
      continue;
    }
    if (leg.routePoints.some((p)=>p.fallback) || (leg.segments||[]).some((s)=>s.fallback)) {
      issues.push(issue('ERROR','SYNTHETIC_LEG',`${a.name||a.id} → ${b.name||b.id} : liaison synthétique interdite.`, { legId:leg.id }));
    }
    // Strict geometry snapshots are guaranteed for modern exact-topology paths.
    // topologyRevision=0 remains a legacy-save compatibility mode; such saves are
    // allowed to load/runtime, but any edit bumps the revision and must satisfy
    // the full v1.1.86 integrity contract before becoming VALID again.
    if(Number(path.topologyRevision||0)>0){
      const expectedSegmentCount=Math.max(0,leg.routePoints.length-1);
      if(!Array.isArray(leg.segments)||leg.segments.length!==expectedSegmentCount){
        issues.push(issue('ERROR','LEG_SEGMENT_COUNT_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : ${expectedSegmentCount} segment(s) attendu(s), ${leg.segments?.length||0} trouvé(s).`,{legId:leg.id,expected:expectedSegmentCount,actual:leg.segments?.length||0}));
      }else{
        let segmentDistance=0;
        for(let j=0;j<leg.segments.length;j++){
          const seg=leg.segments[j],pa=leg.routePoints[j],pb=leg.routePoints[j+1],geom=haversineKm(pa,pb);
          if(!pointEquivalent(seg?.from,pa,0.003)||!pointEquivalent(seg?.to,pb,0.003))issues.push(issue('ERROR','LEG_SEGMENT_ENDPOINT_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : segment ${j+1} désynchronisé de la géométrie affichée.`,{legId:leg.id,segmentIndex:j}));
          if(!numericClose(seg?.distanceKm,geom,0.003))issues.push(issue('ERROR','SEGMENT_DISTANCE_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : distance du segment ${j+1} incohérente.`,{legId:leg.id,segmentIndex:j,storedKm:seg?.distanceKm,geometryKm:geom}));
          if(Number.isFinite(Number(seg?.distanceKm)))segmentDistance+=Number(seg.distanceKm);
        }
        const geometryDistance=polylineDistanceKm(leg.routePoints);
        if(!numericClose(leg.distanceKm,geometryDistance,0.005)||!numericClose(leg.distanceKm,segmentDistance,0.005))issues.push(issue('ERROR','LEG_DISTANCE_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : kilométrage de liaison désynchronisé de sa géométrie.`,{legId:leg.id,storedKm:leg.distanceKm,geometryKm:geometryDistance,segmentKm:segmentDistance}));
      }
    }

    const expectedIds=(path.constraints||[]).filter((c)=>Number(c.legIndex)===i).sort((x,y)=>x.order-y.order).map((c)=>String(c.id));
    const actualIds=(leg.constraintIds||[]).map(String);
    if (expectedIds.length!==actualIds.length || expectedIds.some((id:string,j:number)=>actualIds[j]!==id)) {
      issues.push(issue('ERROR','LEG_CONSTRAINT_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : les WAYPOINTS résolus ne correspondent pas aux WAYPOINTS demandés.`, { legId:leg.id, expectedIds, actualIds }));
    }
    for (const id of actualIds) {
      if (!validConstraintIds.has(id) || seenConstraintIds.has(id)) {
        issues.push(issue('ERROR','VIA_DUPLICATE_OR_UNKNOWN',`WAYPOINT ${id} dupliqué ou inconnu dans les liaisons.`, { constraintId:id, legId:leg.id }));
      }
      seenConstraintIds.add(id);
    }

    const start=leg.routePoints[0], end=leg.routePoints[leg.routePoints.length-1];
    const startAnchor=anchorOf(a), endAnchor=anchorOf(b);
    if (haversineKm(start,startAnchor)>0.025 || haversineKm(end,endAnchor)>0.025) {
      issues.push(issue('ERROR','LEG_ENDPOINT_MISMATCH',`${a.name||a.id} → ${b.name||b.id} : le tracé ne rejoint pas les ancres sélectionnées.`, { legId:leg.id }));
    }
    if (Number(path.topologyRevision||0)>0) {
      const aw=String(a.track?.wayId||'').trim(), bw=String(b.track?.wayId||'').trim();
      if (aw && !routePointMatchesAnchor(start,startAnchor,aw,0.025)) issues.push(issue('ERROR','LEG_START_WAY_MISMATCH',`${a.name||a.id} : le tracé ne démarre pas sur la voie ORM sélectionnée.`,{legId:leg.id,expectedWayId:aw,actualWayId:start?.wayId||''}));
      if (bw && !routePointMatchesAnchor(end,endAnchor,bw,0.025)) issues.push(issue('ERROR','LEG_END_WAY_MISMATCH',`${b.name||b.id} : le tracé ne termine pas sur la voie ORM sélectionnée.`,{legId:leg.id,expectedWayId:bw,actualWayId:end?.wayId||''}));
      for(const c of (path.constraints||[]).filter((x)=>Number(x.legIndex)===i)){
        const ca={lat:Number(c.snapLat??c.lat),lon:Number(c.snapLon??c.lon)},cw=String(c.wayId||'').trim();
        if(!routeContainsAnchor(leg.routePoints,ca,cw,0.025)) issues.push(issue('ERROR','VIA_GEOMETRY_MISMATCH',`WAYPOINT ${c.id} : le tracé résolu ne passe pas par la voie/position imposée.`,{legId:leg.id,constraintId:c.id,expectedWayId:cw}));
      }
    }
    if (previousEnd && haversineKm(previousEnd,start)>0.002) {
      issues.push(issue('ERROR','LEG_DISCONTINUITY',`Discontinuité physique entre les liaisons ${i} et ${i+1}.`, { gapM:haversineKm(previousEnd,start)*1000 }));
    }
    if(previousLeg){
      const incoming=endpointBearing(previousLeg.routePoints,{arrival:true}),outgoing=endpointBearing(leg.routePoints);
      const angle=routeTurnAngleDeg(incoming as number,outgoing as number),junction=locs[i];
      if(angle!=null&&Number.isFinite(angle)&&angle>=150&&!junction?.turnBack)issues.push(issue('ERROR','UNPLANNED_TURNBACK',`${junction?.name||'Arrêt'} : le tracé repart en sens inverse sans TAQ.`,{locationId:junction?.id,turnAngleDeg:angle}));
    }
    previousEnd=end;previousLeg=leg;
  }

  // One canonical geometry must back the map, kilometre counter and timing on
  // every modern exact-topology path. Legacy revision-0 snapshots are upgraded
  // to this contract on their next topology edit/revalidation.
  if(Number(path.topologyRevision||0)>0){
  const orderedLegs:LegLike[]=[];
  for(let i=0;i<expectedLegs;i++){
    const a=locs[i],b=locs[i+1],leg=(path.legs||[]).find((l)=>l.fromLocationId===a?.id&&l.toLocationId===b?.id);
    if(leg)orderedLegs.push(leg);
  }
  if(orderedLegs.length===expectedLegs){
    const canonicalPoints:RoutePointLike[]=[],canonicalSegments:RouteSegmentSnapshot[]=[];let canonicalDistance=0;
    for(const leg of orderedLegs){
      for(let j=0;j<(leg.routePoints||[]).length;j++){if(canonicalPoints.length&&j===0)continue;canonicalPoints.push(leg.routePoints[j]);}
      for (const segment of leg.segments || []) canonicalSegments.push(segment);canonicalDistance+=Number(leg.distanceKm||0);
    }
    if((path.routePoints||[]).length!==canonicalPoints.length)issues.push(issue('ERROR','PATH_POINT_COUNT_MISMATCH','Le tracé global ne contient pas le même nombre de points que ses liaisons.',{expected:canonicalPoints.length,actual:path.routePoints?.length||0}));
    else for(let i=0;i<canonicalPoints.length;i++)if(!pointEquivalent(path.routePoints![i],canonicalPoints[i],0.003,{checkWayId:true})){issues.push(issue('ERROR','PATH_POINT_MISMATCH',`Le point ${i+1} du tracé global diffère de la liaison canonique.`,{pointIndex:i}));break;}
    if((path.segments||[]).length!==canonicalSegments.length)issues.push(issue('ERROR','PATH_SEGMENT_COUNT_MISMATCH','Le tracé global ne contient pas le même nombre de segments que ses liaisons.',{expected:canonicalSegments.length,actual:path.segments?.length||0}));
    else for(let i=0;i<canonicalSegments.length;i++){const ps=path.segments![i],cs=canonicalSegments[i];if(String(ps?.wayId||'')!==String(cs?.wayId||'')||!pointEquivalent(ps?.from,cs?.from,0.003)||!pointEquivalent(ps?.to,cs?.to,0.003)){issues.push(issue('ERROR','PATH_SEGMENT_MISMATCH',`Le segment ${i+1} du tracé global diffère de la liaison canonique.`,{segmentIndex:i}));break;}}
    const geometryDistance=polylineDistanceKm(path.routePoints||[]);
    const segmentDistance=(path.segments||[]).reduce((n:number,x)=>n+(Number(x?.distanceKm)||0),0);
    if(!numericClose(path.distanceKm,canonicalDistance,0.005)||!numericClose(path.distanceKm,geometryDistance,0.005)||!numericClose(path.distanceKm,segmentDistance,0.005)){
      issues.push(issue('ERROR','PATH_DISTANCE_MISMATCH','Le kilométrage global est désynchronisé de la géométrie réellement affichée.',{storedKm:path.distanceKm,legKm:canonicalDistance,geometryKm:geometryDistance,segmentKm:segmentDistance}));
    }
  }

  }

  for (const id of validConstraintIds) if (!seenConstraintIds.has(id)) {
    issues.push(issue('ERROR','VIA_NOT_ROUTED',`WAYPOINT ${id} absent du trajet résolu.`, { constraintId:id }));
  }
}

export function validateScheduleVersion(version:ScheduleVersion | null | undefined, { ormAvailable = true }:ValidationOptions = {}): ValidationReport {
  const issues: ValidationIssue[] = [];
  if (!version) return new ValidationReport({ issues: [issue('ERROR','NO_VERSION','Horaire introuvable.')] });

  if (!version.locations || version.locations.length < 2) {
    issues.push(issue('ERROR','NOT_ENOUGH_LOCATIONS','Il faut au moins un départ et une destination.'));
  }

  const profile = version.performanceProfile;
  if (!Number.isFinite(Number(profile?.powerW)) || Number(profile?.powerW) <= 0) {
    issues.push(issue('ERROR','NO_TRACTION_POWER','La composition de référence ne possède aucune puissance de traction.'));
  }
  for (const loc of version.locations || []) {
    if ([loc.arrivalSec, loc.departureSec, loc.computedArrivalSec, loc.computedDepartureSec].some(x => x != null && !Number.isFinite(Number(x)))) {
      issues.push(issue('ERROR','NON_FINITE_TIMING',`${loc.name || 'Arrêt'} : temps de marche non calculable.`, {locationId:loc.id}));
    }
  }
  const ids=new Set<string>();
  for (let i=0;i<(version.locations||[]).length;i++) {
    const loc=version.locations[i];
    if (!loc.id || ids.has(loc.id)) issues.push(issue('ERROR','LOCATION_ID_DUPLICATE',`${loc.name||'Arrêt'} : identifiant d’occurrence manquant ou dupliqué.`,{locationId:loc.id}));
    ids.add(loc.id);
    if (loc.kind === LocationKind.STATION && !loc.stationId) {
      issues.push(issue('ERROR','STATION_MISSING',`${loc.name || 'Gare'} : identifiant gare manquant.`, { locationId: loc.id }));
    }
    if (loc.kind === LocationKind.TECHNICAL && !loc.technicalLocationId) {
      issues.push(issue('ERROR','TECH_LOCATION_MISSING',`${loc.name || 'Point technique'} : identifiant technique manquant.`, { locationId: loc.id }));
    }
    const anchorLat = loc.track?.snapLat ?? loc.track?.lat;
    const anchorLon = loc.track?.snapLon ?? loc.track?.lon;
    if (!Number.isFinite(anchorLat) || !Number.isFinite(anchorLon)) {
      issues.push(issue('ERROR','TRACK_MISSING',`${loc.name || 'Arrêt'} : position de voie manquante.`, { locationId: loc.id }));
    }
    if (!loc.track?.displayName?.trim()) {
      issues.push(issue('ERROR','TRACK_DISPLAY_NAME_MISSING',`${loc.name || 'Arrêt'} : nom de voie Livemap obligatoire.`, { locationId: loc.id }));
    }
    if (Number(version.outboundPath?.topologyRevision||0)>0 && !String(loc.track?.wayId||'').trim()) {
      issues.push(issue('ERROR','TRACK_WAY_ID_MISSING',`${loc.name || 'Arrêt'} : la voie exacte ORM n’est pas verrouillée. Re-cliquez la voie.`, { locationId:loc.id }));
    }
    if (isPassengerCategory(version.category) && loc.stopCode !== StopCode.NONE) {
      issues.push(issue('ERROR','PASSENGER_STOP_CODE',`${loc.name}: C/S/[C]/[S] sont interdits sur un train voyageurs.`, { locationId: loc.id }));
    }
    if (loc.turnBack && isOptionalStopCode(loc.stopCode)) {
      issues.push(issue('ERROR','OPTIONAL_TAQ',`${loc.name}: un TAQ ne peut pas être facultatif.`, { locationId: loc.id }));
    }
    if (loc.turnBack && loc.dwellSec < 300) {
      issues.push(issue('ERROR','TAQ_MIN_DWELL',`${loc.name}: TAQ = 5 minutes minimum.`, { locationId: loc.id, requiredSec: 300 }));
    }
    if (loc.arrivalSec != null && loc.departureSec != null && loc.departureSec < loc.arrivalSec) {
      issues.push(issue('ERROR','NEGATIVE_DWELL',`${loc.name}: départ antérieur à l'arrivée.`, { locationId: loc.id }));
    }
    if (i>0) {
      const prev=version.locations[i-1];
      const prevDep=prev.departureSec ?? prev.arrivalSec;
      const arr=loc.arrivalSec ?? loc.departureSec;
      if (prevDep!=null && arr!=null && arr<prevDep) {
        issues.push(issue('ERROR','NON_MONOTONIC_TIMING',`${loc.name}: arrivée antérieure au départ de ${prev.name||'l’arrêt précédent'}.`, { previousLocationId:prev.id, locationId:loc.id }));
      }
    }
    if (loc.arrivalOverride && loc.computedArrivalSec!=null && loc.arrivalSec!=null && Number(loc.arrivalSec) < Number(loc.computedArrivalSec)) {
      const forced=Boolean(version.allowShorterThanPhysicalTiming);
      const deltaSec=Math.max(0,Number(loc.computedArrivalSec)-Number(loc.arrivalSec));
      issues.push(issue(forced?'WARNING':'ERROR','MANUAL_ARRIVAL_PHYSICALLY_IMPOSSIBLE',forced
        ? `${loc.name}: temps joueur inférieur de ${Math.ceil(deltaSec/60)} min au minimum calculé par RE — validation forcée par le joueur.`
        : `${loc.name}: l’arrivée saisie est antérieure au minimum physique calculé. Vous pouvez revenir au temps RE ou utiliser « Forcer et valider quand même ».`,
        { locationId:loc.id,manualSec:loc.arrivalSec,minimumSec:loc.computedArrivalSec,deltaSec,forced }));
    }
    if (loc.departureOverride && loc.computedDepartureSec!=null && loc.departureSec!=null && Number(loc.departureSec) < Number(loc.computedDepartureSec)) {
      issues.push(issue('ERROR','MANUAL_DEPARTURE_DWELL_IMPOSSIBLE',`${loc.name}: le départ saisi ne laisse pas le temps d’arrêt/opération physique prévu.`, { locationId:loc.id,manualSec:loc.departureSec,minimumSec:loc.computedDepartureSec }));
    }
  }

  validatePathStructure(version, issues);

  const path = version.outboundPath as SchedulePathLike | null | undefined;
  const unknownSeen=new Set<string>();
  const againstPreferredWayIds = new Set<string>();
  for (const seg of path?.segments || []) {
    if (seg.fallback) issues.push(issue('ERROR','SYNTHETIC_SEGMENT','Segment synthétique interdit.', { wayId: seg.wayId }));
    const wayKey=String(seg.wayId||'unknown');
    if (seg.maxSpeedSource === 'FALLBACK_30' && !unknownSeen.has(`vmax:${wayKey}`)) {
      unknownSeen.add(`vmax:${wayKey}`);
      issues.push(issue('UNKNOWN','VMAX_UNKNOWN','Vmax ORM inconnue : aucune limitation 30 km/h fictive n’est imposée au calcul horaire.', { wayId: seg.wayId }));
    }
    if (seg.electrified == null && !unknownSeen.has(`elec:${wayKey}`)) {
      unknownSeen.add(`elec:${wayKey}`);
      issues.push(issue('UNKNOWN','ELECTRIFICATION_UNKNOWN','Électrification ORM inconnue : circulation autorisée.', { wayId: seg.wayId }));
    }
    if (seg.preferredDirection && seg._againstPreferredDirection) againstPreferredWayIds.add(wayKey);
    const electricOk = electricSystemMatches(version.performanceProfile, seg);
    if (electricOk === false) {
      issues.push(issue('ERROR','ELECTRIC_INCOMPATIBLE','Composition-type incompatible avec l’électrification de cette section.', { wayId: seg.wayId, voltage: seg.voltage, frequency: seg.frequency }));
    }
    const gaugeOk=gaugeMatches(version.performanceProfile,seg);
    if (gaugeOk===false) {
      issues.push(issue('ERROR','GAUGE_INCOMPATIBLE','Composition-type incompatible avec l’écartement de cette section.', { wayId:seg.wayId, trackGauge:seg.gauge, vehicleGauge:version.performanceProfile?.gauges||[] }));
    }
    const loadingOk=loadingGaugeCompatible(version.performanceProfile?.loadingGauge,seg.loadingGauge);
    if(loadingOk===false)issues.push(issue('ERROR','LOADING_GAUGE_INCOMPATIBLE','Composition-type incompatible avec le gabarit de cette section.',{wayId:seg.wayId,trackLoadingGauge:seg.loadingGauge,vehicleLoadingGauge:version.performanceProfile?.loadingGauge||''}));
    const axle=Number(version.performanceProfile?.axleLoad),trackAxle=Number(seg.axleLoad);
    if(Number.isFinite(axle)&&axle>0&&Number.isFinite(trackAxle)&&trackAxle>0&&axle>trackAxle+0.05)issues.push(issue('ERROR','AXLE_LOAD_INCOMPATIBLE','Composition-type trop lourde par essieu pour cette section.',{wayId:seg.wayId,vehicleAxleLoad:axle,trackAxleLoad:trackAxle}));
    const metre=Number(version.performanceProfile?.metreLoad),trackMetre=Number(seg.metreLoad);
    if(Number.isFinite(metre)&&metre>0&&Number.isFinite(trackMetre)&&trackMetre>0&&metre>trackMetre+0.02)issues.push(issue('ERROR','METRE_LOAD_INCOMPATIBLE','Composition-type trop lourde par mètre pour cette section.',{wayId:seg.wayId,vehicleMetreLoad:metre,trackMetreLoad:trackMetre}));
  }

  if (againstPreferredWayIds.size) {
    const wayIds=[...againstPreferredWayIds].filter(Boolean);
    issues.push(issue('WARNING','AGAINST_PREFERRED_DIRECTION',
      wayIds.length > 1 ? `Voie parcourue à contre-sens de la direction préférentielle ORM (${wayIds.length} sections).` : 'Voie parcourue à contre-sens de la direction préférentielle ORM.',
      { wayId: wayIds[0] || '', wayIds, sectionCount: wayIds.length }));
  }

  if (!ormAvailable) issues.push(issue('INFO','ORM_REVALIDATION_DEFERRED','ORM indisponible : revalidation reportée, cache local conservé.'));
  return new ValidationReport({ issues, deferred: !ormAvailable });
}

export function applyValidationState(version:ScheduleVersion, report:ValidationReport): string {
  version.validationReport = report;
  if (version.state === ScheduleState.DRAFT) {
    if (report.canValidate) version.state = ScheduleState.VALID;
    return version.state;
  }
  version.state = report.canValidate ? ScheduleState.VALID : ScheduleState.NEEDS_REPAIR;
  return version.state;
}
