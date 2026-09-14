/** One infrastructure-speed policy for timetable physics, runtime and cantons.
 * Unknown mainline data uses 160 km/h (then the train cap); unknown service tracks
 * use 30. Local inheritance is bounded to 1 km on the SAME contiguous OSM way.
 * No inferred point ever becomes evidence for another inference.
 */
export interface RailSpeedPoint {
    lat?: unknown; lon?: unknown; wayId?: unknown; maxSpeed?: unknown; maxSpeedSource?: unknown;
    maxSpeedForward?: unknown; maxSpeedBackward?: unknown; travelDirection?: unknown;
    service?: unknown; usage?: unknown; tags?: Record<string, unknown>;
}
const positive = (value: unknown): number | null => { const n=Number(value); return Number.isFinite(n)&&n>0?n:null; };
export function railPointDistanceKm(a: RailSpeedPoint, b: RailSpeedPoint): number {
    const aLat=Number(a.lat), bLat=Number(b.lat), aLon=Number(a.lon), bLon=Number(b.lon);
    if (![aLat,bLat,aLon,bLon].every(Number.isFinite)) return Infinity;
    const dLat=(bLat-aLat)*Math.PI/180,dLon=(bLon-aLon)*Math.PI/180;
    const x=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
    return 12742*Math.atan2(Math.sqrt(Math.max(0,x)),Math.sqrt(Math.max(0,1-x)));
}
export function documentedRailSpeed(p: RailSpeedPoint): number | null {
    const v=positive(p.maxSpeed);
    if (v!=null && String(p.maxSpeedSource||'')!=='FALLBACK_30') return v;
    const dir=String(p.travelDirection||'').toLowerCase();
    const forward=positive(p.maxSpeedForward),backward=positive(p.maxSpeedBackward);
    return dir==='backward' ? (backward??forward) : dir==='forward' ? (forward??backward) : null;
}
export function resolveRailSpeedLimits(route: RailSpeedPoint[], trainCap=160): number[] {
    if (!Array.isArray(route)) return [];
    const cap=positive(trainCap)??160, n=route.length;
    const known=route.map(documentedRailSpeed), prev=new Int32Array(n).fill(-1), next=new Int32Array(n).fill(-1);
    const distance=new Float64Array(n);
    const same=(i:number,j:number)=>String(route[i]?.wayId??'')===String(route[j]?.wayId??'');
    let k=-1;
    for(let i=0;i<n;i++){
        if(i>0){distance[i]=distance[i-1]+railPointDistanceKm(route[i-1],route[i]);if(!same(i,i-1))k=-1;}
        if(known[i]!=null)k=i;prev[i]=k;
    }
    k=-1;
    for(let i=n-1;i>=0;i--){if(i<n-1&&!same(i,i+1))k=-1;if(known[i]!=null)k=i;next[i]=k;}
    return route.map((p,i)=>{
        if(known[i]!=null)return Math.min(cap,known[i]!);
        const service=String(p.service??p.tags?.service??'').toLowerCase();
        const usage=String(p.usage??p.tags?.usage??'').toLowerCase();
        if(['yard','siding','spur','crossover'].includes(service)||['industrial','military'].includes(usage))return Math.min(cap,30);
        const candidates:number[]=[];
        for(const j of [prev[i],next[i]])if(j>=0&&Math.abs(distance[j]-distance[i])<=1&&known[j]!=null)candidates.push(known[j]!);
        return Math.min(cap,candidates.length?Math.min(...candidates):160);
    });
}
