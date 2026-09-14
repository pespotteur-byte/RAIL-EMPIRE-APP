/** Directional, route-relative virtual signals. This is the game's block model,
 * not an assertion that these are the surveyed positions of real OSM signals. */
export interface SignalAssignment { cantonId:string;startIndex:number;endIndex:number;startKm:number;endKm:number;trackSig:string;resourceIds:string[]; }
export interface SignalRouteService {
    id:string|number;active?:boolean;completed?:boolean;cancelled?:boolean;
    _cantonAssignments?:SignalAssignment[]|null;
    _state?:{cachedRoute?:Array<{lat:number;lon:number}>|null;index?:number;progress?:number}|null;
}
export interface SignalBounds {minLat:number;maxLat:number;minLon:number;maxLon:number;}
export interface SignalReader {getEntrySignalAspect(assignments:SignalAssignment[],index:number,trainId:unknown):0|30|null;}
export function displayBlockSignals(services:readonly SignalRouteService[],manager:SignalReader,bounds:SignalBounds) {
    const candidates=new Map<string,{lat:number;lon:number;heading:number;assignments:SignalAssignment[];entryIndex:number;observer:unknown;distance:number}>();
    for(const service of services){
        if(service.active===false||service.completed||service.cancelled)continue;
        const route=service._state?.cachedRoute,assignments=service._cantonAssignments;
        if(!route||!assignments)continue;
        const front=(service._state?.index||0)+(service._state?.progress||0);
        // The signal at the END of block i protects block i+1, never block i.
        // No invented red signal at the final buffer stop / end of the route.
        for(let i=0;i<assignments.length-1;i++){
            const current=assignments[i],next=assignments[i+1];if(!current||!next)continue;
            const at=current.endIndex,p=route[at],before=route[Math.max(0,at-1)],after=route[Math.min(route.length-1,at+1)];
            if(!p||!before||!after||p.lat<bounds.minLat||p.lat>bounds.maxLat||p.lon<bounds.minLon||p.lon>bounds.maxLon)continue;
            const heading=Math.atan2(after.lat-before.lat,(after.lon-before.lon)*Math.cos(p.lat*Math.PI/180));
            const direction=Math.round(heading*4/Math.PI); // opposite directions remain separate
            const key=`${p.lat.toFixed(7)},${p.lon.toFixed(7)}|${next.cantonId}|${direction}`;
            const distance=front<at?at-front:Infinity,old=candidates.get(key);
            if(old && old.distance<=distance)continue;
            candidates.set(key,{lat:p.lat,lon:p.lon,heading,assignments,entryIndex:i+1,observer:front<at?service.id:null,distance});
        }
    }
    return [...candidates.values()].map(entry=>({lat:entry.lat,lon:entry.lon,heading:entry.heading,
        aspect:manager.getEntrySignalAspect(entry.assignments,entry.entryIndex,entry.observer)}));
}
