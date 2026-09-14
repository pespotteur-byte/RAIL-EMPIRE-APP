/** Physical route-cache identities shared by the editor and network revalidation.
 * Display labels and timing-only changes never alter a physical path identity.
 */
import type { ScheduleVersion, SchedulePath } from './schedule-v2-model.js';
type Anchor = {
    wayId?: unknown;
    segmentIndex?: unknown;
    lat?: unknown;
    lon?: unknown;
    snapLat?: unknown;
    snapLon?: unknown;
    osmSnapshot?: Record<string, unknown> | null;
};
export declare function physicalAnchorKey(track: Anchor | null | undefined): string;
export declare function legRouteInputKey(ver: ScheduleVersion, path: SchedulePath, index: number): string;
export declare function physicsRouteKey(inputKey: string, topologyEpoch: unknown, pointCount: number, distanceKm: number): string;
export {};
