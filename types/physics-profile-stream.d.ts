/** Windowed execution of the SAME numerical mesh: geometry and constraints are
 * never decimated. Only a bounded pool of numerical cells is resident at once.
 * Source/output metadata necessarily still scales with the supplied route.
 */
import type { PhysicsSegment, SimulationParams, SimulationResult, TrainPhysicsParams } from './train-physics.js';
export interface ProfileStreamConfig {
    cellCount: number;
    capacity: number;
    dsStep: number;
    preBrakeMarginM: number;
    brakeBuildSec: number;
    brake: (p: TrainPhysicsParams, w: SimulationParams['weather'], grade: number) => number;
    accel: (p: TrainPhysicsParams, v: number, grade: number) => number;
    power: (s: PhysicsSegment, p: SimulationParams) => number;
}
export declare function simulateProfileStream(segments: PhysicsSegment[], params: SimulationParams, cfg: ProfileStreamConfig): SimulationResult;
