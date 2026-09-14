export class RouteElectrificationIndex {
    constructor() {
        this.cachedRoute = null;
        this.cachedLength = 0;
        this.ranges = [];
    }
    reset() { this.cachedRoute = null; this.cachedLength = 0; this.ranges = []; }
    next(route, index) {
        if (this.cachedRoute !== route || this.cachedLength !== route.length) {
            this.ranges = [];
            let start = -1;
            for (let i = 0; i < route.length - 1; i++) {
                const blocked = route[i]?.electrified === false || route[i + 1]?.electrified === false;
                if (blocked && start < 0)
                    start = i;
                if (!blocked && start >= 0) {
                    this.ranges.push({ start, end: i - 1 });
                    start = -1;
                }
            }
            if (start >= 0)
                this.ranges.push({ start, end: route.length - 2 });
            this.cachedRoute = route;
            this.cachedLength = route.length;
        }
        let lo = 0, hi = this.ranges.length;
        while (lo < hi) {
            const m = (lo + hi) >>> 1;
            if (this.ranges[m].end < index)
                lo = m + 1;
            else
                hi = m;
        }
        const range = this.ranges[lo];
        return range ? Math.max(index, range.start) : null;
    }
}
