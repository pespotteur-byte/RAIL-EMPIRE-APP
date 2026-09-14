/** Linear referencing of clicked OSM anchors on an existing, ordered railway leg.
 * Temporary editing index: no persistent copy of continental geometry, and no
 * change to routing/physics. A waypoint's order is distance ALONG the railway,
 * never its proximity to the end stations.
 */
export interface RailAnchor {
    lat?: unknown; lon?: unknown; snapLat?: unknown; snapLon?: unknown;
    wayId?: unknown; segmentIndex?: unknown;
}
export interface RouteProjection {
    alongKm: number; offsetKm: number; segment: number; fraction: number; ambiguous: boolean;
}
function coordinate(value: unknown, limit: number): number | null {
    if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}
/** Zero is a coordinate. A missing/invalid snap falls back to the original axis. */
export function railAnchorPosition(anchor: RailAnchor | null | undefined): {lat: number; lon: number} | null {
    if (!anchor) return null;
    const lat = coordinate(anchor.snapLat, 90) ?? coordinate(anchor.lat, 90);
    const lon = coordinate(anchor.snapLon, 180) ?? coordinate(anchor.lon, 180);
    return lat == null || lon == null ? null : {lat, lon};
}
function distanceKm(a: {lat: number; lon: number}, b: {lat: number; lon: number}): number {
    const rad = Math.PI / 180;
    const x = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
    return 12742 * Math.atan2(Math.sqrt(Math.max(0,x)), Math.sqrt(Math.max(0,1-x)));
}
export class RailRouteMeasure {
    readonly cumulativeKm: Float64Array;
    private readonly byWay = new Map<string, number[]>();
    private valid = true;
    constructor(private readonly route: readonly RailAnchor[]) {
        this.cumulativeKm = new Float64Array(route.length);
        for (let i=0;i<route.length-1;i++) {
            const a=railAnchorPosition(route[i]),b=railAnchorPosition(route[i+1]);
            if (!a || !b) { this.valid=false; break; }
            this.cumulativeKm[i+1]=this.cumulativeKm[i]+distanceKm(a,b);
            const way=String(route[i].wayId??'');
            if (way) {
                const list=this.byWay.get(way);
                if (list) list.push(i); else this.byWay.set(way,[i]);
            }
        }
    }
    project(anchor: RailAnchor, minimumAlongKm=0): RouteProjection | null {
        const q=railAnchorPosition(anchor);
        if (!this.valid || !q || this.route.length<2) return null;
        const cos=Math.cos(q.lat*Math.PI/180),scale=111.195;
        const way=String(anchor.wayId??'');
        const candidates=way ? this.byWay.get(way) : undefined;
        const rawSegment=anchor.segmentIndex;
        const segment=rawSegment==null ? null : Number(rawSegment);
        const hasExactSegment=!!candidates && segment!=null && Number.isInteger(segment) && candidates.some(i=>this.route[i].segmentIndex===segment);
        let best: RouteProjection|null=null;
        const visit=(i:number)=>{
            if (hasExactSegment && this.route[i].segmentIndex!==segment) return;
            const a=railAnchorPosition(this.route[i])!,b=railAnchorPosition(this.route[i+1])!;
            const ax=(a.lon-q.lon)*cos,ay=a.lat-q.lat,bx=(b.lon-q.lon)*cos,by=b.lat-q.lat;
            const dx=bx-ax,dy=by-ay,length2=dx*dx+dy*dy;
            const fraction=length2>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/length2)):0;
            const alongKm=this.cumulativeKm[i]+fraction*(this.cumulativeKm[i+1]-this.cumulativeKm[i]);
            if (alongKm+1e-6<minimumAlongKm) return;
            const offsetKm=Math.hypot(ax+fraction*dx,ay+fraction*dy)*scale;
            if (!best || offsetKm<best.offsetKm-1e-7) best={alongKm,offsetKm,segment:i,fraction,ambiguous:false};
            else if (Math.abs(offsetKm-best.offsetKm)<=1e-7 && Math.abs(alongKm-best.alongKm)>0.001) best.ambiguous=true;
        };
        if(candidates?.length) for(const i of candidates)visit(i);
        else for(let i=0;i<this.route.length-1;i++)visit(i);
        return best;
    }
}
/** Return one partition, preserving the original VIA sequence on loops. null
 * means absent/ambiguous old geometry: the editor must use its explicit fallback.
 */
export function constraintSplitOnRailway(route: readonly RailAnchor[], constraints: readonly RailAnchor[], inserted: RailAnchor): number | null {
    const measure=new RailRouteMeasure(route),at=measure.project(inserted);
    if(!at || at.ambiguous || at.offsetKm>0.05)return null;
    let minimum=0,cut=0,after=false;
    for(const q of constraints){
        const p=measure.project(q,minimum);
        if(!p || p.ambiguous || p.offsetKm>0.05)return null;
        minimum=p.alongKm;
        if(p.alongKm<=at.alongKm+1e-6 && !after)cut++;
        else after=true;
    }
    return cut;
}
