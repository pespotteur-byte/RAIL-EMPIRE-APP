import { RELEASE } from './build-info.js';
/** On-demand, bounded, read-only movement snapshot. No route arrays, catalogue,
 * account details, raw exceptions or storage contents are retained/exported.
 * A snapshot explains observed state; it is not a historical replay or a proof
 * that a slow train is defective.
 */
type RecordValue = Record<string, unknown>;
const object=(v:unknown):RecordValue=>v!==null && typeof v==='object' && !Array.isArray(v)?v as RecordValue:{};
const text=(v:unknown,max=180):string=>typeof v==='string'?v.slice(0,max):typeof v==='number'&&Number.isFinite(v)?String(v):'';
const number=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const size=(v:unknown):number=>Array.isArray(v)?v.length:0;
function point(value:unknown) {
 const p=object(value),lat=number(p.lat),lon=number(p.lon);
 return lat!==null&&lon!==null&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
}
function sample(service:RecordValue) {
 const train=object(service.train),rame=object(service.rame),state=object(service._state),authority=object(train.movementAuthority);
 const route=Array.isArray(state.cachedRoute)?state.cachedRoute:[],index=Math.max(0,Math.floor(number(state.index)??0));
 const segment=object(route[Math.min(index,Math.max(0,route.length-1))]),macro=object(service._macroElapsed),incident=object(train.incident),breakdown=object(train.breakdown);
 const stops=Array.isArray(service.isReturnLeg?service.returnStops:service.stops)?(service.isReturnLeg?service.returnStops:service.stops) as unknown[]:[];
 const stop=object(stops[Math.max(0,Math.floor(number(service.currentStopIndex)??0))]);
 return {
  id:text(service.id),name:text(service.name),state:text(service.state),active:service.active!==false,position:point(service.position),
  speedKmh:number(service.speed),displaySpeedKmh:number(train.speed),totalDistanceKm:number(service.totalDistance),delayReason:text(train.delayReason,300),
  lod:text(service._lod),pendingMacroSec:{medium:number(macro.medium),low:number(macro.low)},
  brakeEffort:number(service._brakeEffort),tractiveEffort:number(service._tractiveEffort),lastDecelMs2:number(service._lastPhysicsDecelMs2),
  authority:{status:text(authority.status),code:text(authority.code),source:text(authority.source),reason:text(authority.reason),speedLimitKmh:number(authority.speedLimitKmh)},
  route:{key:text(service._routeKey),legKey:text(state.legKey),expectedLegKey:`${text(service.currentStopIndex)}-${service.isReturnLeg?1:0}`,pointCount:route.length,index:number(state.index),progress:number(state.progress),wayId:text(segment.wayId),maxSpeed:number(segment.maxSpeed),maxSpeedSource:text(segment.maxSpeedSource),electrified:typeof segment.electrified==='boolean'?segment.electrified:null,incline:text(segment.incline)},
  nextStop:{stationId:text(stop.stationId),type:text(stop.type),arrivalTime:number(stop.arrivalTime),departureTime:number(stop.departureTime)},
  material:{id:text(rame.id),traction:text(rame.traction),massT:number(rame.totalMass),lengthM:number(rame.totalLength),powerKw:number(rame.totalPower),maxSpeedKmh:number(rame.maxSpeed),inMaintenance:!!(rame.inMaintenance||train.inMaintenance)},
  obstruction:{signal:text(train.signalAlert),incidentId:text(incident.id),incidentEffect:text(incident.effect),breakdown:text(breakdown.type),rescueDispatched:service._rescueDispatched===true,departureTailHeld:!!service._departureResourceHold,nearbyCount:size(service._nearbyServices)},
 };
}
export function buildMovementDiagnostics(input:unknown,now=Date.now(),requestedLimit=512) {
 const game=object(input),creator=object(game.scheduleCreator),services=Array.isArray(creator.services)?creator.services:[];
 const limit=Number.isFinite(requestedLimit)?Math.max(1,Math.min(2048,Math.floor(requestedLimit))):512;
 const buckets:Array<ReturnType<typeof sample>[]>=[[],[],[]];
 const counts={total:services.length,active:0,moving:0,slowMoving:0,stoppedByAuthority:0,invalidEntries:0};
 for(const value of services){
  const s=object(value);if(!Object.keys(s).length){counts.invalidEntries++;continue;}
  if(s.active===false||s.completed||s.cancelled||s.state==='completed'||s.state==='cancelled')continue;
  counts.active++;
  const t=object(s.train),a=object(t.movementAuthority),speed=number(s.speed);
  const moving=s.state==='moving'||s.state==='departing',slow=moving&&speed!==null&&speed<=15,blocked=a.status==='STOP';
  if(moving)counts.moving++;if(slow)counts.slowMoving++;if(blocked)counts.stoppedByAuthority++;
  const bucket=buckets[blocked?0:slow?1:2]!;
  if(bucket.length<limit)bucket.push(sample(s));
 }
 const selected:Array<ReturnType<typeof sample>>=[];
 for(const bucket of buckets)for(const row of bucket){if(selected.length>=limit)break;selected.push(row);}
 const depot=object(game.depotManager),rescues=Array.isArray(depot.activeRescues)?depot.activeRescues:[];
 return {schemaVersion:1,build:RELEASE,exportedAtMs:Number.isFinite(now)?now:null,
  note:'Instantané, pas replay. Les trains arrêtés puis lents sont prioritaires en cas de troncature. Aucune transmission réseau.',
  context:{date:text(game._currentDate),timeOfDay:number(game.timeOfDay),page:text(object(game.ui).activePage),running:game.running===true,hasSpatialIndex:game._serviceGrid instanceof Map},
  counts,sampled:selected.length,truncated:Math.max(0,counts.active-selected.length),services:selected,
  rescues:rescues.slice(0,100).map(v=>{const r=object(v);return{id:text(r.id),state:text(r.state),targetServiceId:text(r.targetServiceId),position:point(r.position),speedKmh:number(r.speed),routeIndex:number(r.routeIndex),retrySec:number(r._routeRetrySec),accessDenied:r._routeAccessDenied===true,message:text(r.routeStatusMessage,240)};}),
  rescuesTruncated:Math.max(0,rescues.length-100)};
}
