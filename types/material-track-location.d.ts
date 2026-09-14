/** Physical material continuity. Display labels are never an override of an acquired track. */
import { type NativeStationTrack, type StationTrackIdentity } from './station-track-identity.js';
export interface MaterialTrackLocation {
    trackIdentity?: StationTrackIdentity | null;
    voiePointId?: string | null;
    platform?: string | number;
}
/** Detached copies only; saved locations must not share mutable editor bindings. */
export declare function materialTrackLocation(value: unknown): MaterialTrackLocation;
/** Unknown legacy starting locations may be placed once. Known tracks may not be erased by a later label. */
export declare function materialTrackMismatch(current: unknown, expected: unknown, stationId: string, nativeTracks?: readonly NativeStationTrack[]): boolean;
