/** Index explicit gaps in the route's fixed infrastructure snapshot.
 * Unknown electrification keeps its existing permissive meaning. Operational
 * outages/works are still checked live by their own movement-authority paths.
 * A new route snapshot gets a new index; reset() handles explicit in-place edits.
 */
export interface ElectrificationPoint { electrified?: unknown }
export class RouteElectrificationIndex {
    private cachedRoute: readonly ElectrificationPoint[] | null = null;
    private cachedLength = 0;
    private ranges: Array<{start:number;end:number}> = [];
    reset(): void { this.cachedRoute=null;this.cachedLength=0;this.ranges=[]; }
    next(route: readonly ElectrificationPoint[], index: number): number | null {
        if(this.cachedRoute!==route || this.cachedLength!==route.length){
            this.ranges=[];
            let start=-1;
            for(let i=0;i<route.length-1;i++){
                const blocked=route[i]?.electrified===false || route[i+1]?.electrified===false;
                if(blocked && start<0)start=i;
                if(!blocked && start>=0){this.ranges.push({start,end:i-1});start=-1;}
            }
            if(start>=0)this.ranges.push({start,end:route.length-2});
            this.cachedRoute=route;this.cachedLength=route.length;
        }
        let lo=0,hi=this.ranges.length;
        while(lo<hi){const m=(lo+hi)>>>1;if(this.ranges[m].end<index)lo=m+1;else hi=m;}
        const range=this.ranges[lo];
        return range?Math.max(index,range.start):null;
    }
}
