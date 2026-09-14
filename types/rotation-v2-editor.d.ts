import { Rotation, ScheduleOccurrence, RotationAction, PhysicalVehicle, Coupon } from './rotation-v2-model.js';
import { ScheduleVersion, ScheduledLocation } from './schedule-v2-model.js';
import type { Rame } from './rame.js';
import type { RailEmpire } from './main.js';
import type { UI } from './ui.js';
type EditorLocation = ScheduledLocation & {
    operationCode?: unknown;
    stationCode?: unknown;
    code?: unknown;
};
type MaterialIntervalSlot = {
    occ?: ScheduleOccurrence;
    rotationId?: string;
    occurrenceId: string;
    startSec: number;
    endSec: number;
    startLocationId?: string;
    endLocationId?: string;
    vehicleId?: string;
};
type TimelineSegment = MaterialIntervalSlot & {
    kind: 'coupon' | 'vehicle';
    entityId: string;
    vehicleIds: string[];
    couponId?: string;
    role?: string;
    reason?: string;
};
type TimelineEntity = {
    id: string;
    kind: 'coupon' | 'vehicle';
    coupon?: Coupon;
    vehicle?: PhysicalVehicle;
    vehicleIds: string[];
    segments: TimelineSegment[];
};
type FleetMetrics = {
    rots: Rotation[];
    states: Array<{
        r: Rotation;
        state: RotationUiState;
    }>;
    allConflicts: RotationConflictLike[];
    advanced: boolean;
    simpleAssignments: number;
    totalServices: number;
    activeLines: number;
    ok: number;
    warn: number;
    bad: number;
    inactive: number;
    outsideSchedules: number;
    validSchedules: number;
    live: number;
    usedMaterials: number;
};
type RotationUiState = {
    key: string;
    label: string;
    issues: RotationIssueLike[];
    runtime: RotationIssueLike[];
    conflicts: RotationConflictLike[];
    enabled?: boolean;
    [key: string]: unknown;
};
type RotationIssueLike = {
    level?: unknown;
    code?: unknown;
    message?: unknown;
    occurrenceId?: unknown;
    status?: unknown;
    [key: string]: unknown;
};
type RotationConflictLike = {
    vehicleId?: string;
    rameId?: string;
    code?: unknown;
    message?: unknown;
    first?: {
        occurrenceId?: string;
        rotationId?: string;
        start?: number;
        end?: number;
    };
    second?: {
        occurrenceId?: string;
        rotationId?: string;
        start?: number;
        end?: number;
    };
    [key: string]: unknown;
};
type RotationInputEvent = Event & {
    target: HTMLInputElement;
};
type RotationChangeEvent = Event & {
    target: HTMLInputElement | HTMLSelectElement;
};
type RotationClickEvent = MouseEvent & {
    target: HTMLElement;
};
type RotationDragEvent = DragEvent & {
    target: HTMLElement;
};
export declare class RotationV2Editor {
    game: RailEmpire;
    ui: UI;
    selectedRotationId: string;
    selectedOccurrenceId: string;
    selectedMaterialId: string;
    activeView: string;
    libraryTab: string;
    searchQuery: string;
    rotationSearchQuery: string;
    rotationStatusFilter: string;
    selectedDate: string;
    materialSort: string;
    sheetZoomIndex: number;
    sheetLibraryCollapsed: boolean;
    sheetInspectorCollapsed: boolean;
    _history: unknown[];
    _future: unknown[];
    _dragPayload: {
        kind?: string;
        id: string;
        offsetSec: number;
    } | null;
    _lastFleetMetrics?: FleetMetrics;
    constructor(game: RailEmpire, ui: UI);
    _syncRuntimeNow(): any;
    _injectStyle(): void;
    setup(): void;
    _snapshot(): any;
    _pushHistory(): void;
    _undo(): void;
    _redo(): void;
    _commit(fn: () => unknown): unknown;
    _distanceKm(occ: ScheduleOccurrence): any;
    _rotationDistance(rot: Rotation): number;
    _abbr(name: unknown): string;
    _selectedDateValue(): any;
    _rotationRunsOnDate(rot: Rotation, date?: string): boolean;
    _versionRunsOnDate(ver: ScheduleVersion, date?: string): boolean;
    _stationCode(loc: EditorLocation | null | undefined): any;
    _intervalDistanceKm(rawSlot: unknown): number;
    _leadingInfo(occ: ScheduleOccurrence): {
        type: string;
        vehicle: any;
        label: any;
    };
    _editStationCode(occId: unknown, locId: unknown): void;
    _occMeta(o: ScheduleOccurrence): {
        rec: any;
        ver: any;
        from: any;
        to: any;
    };
    _physicalLocationId(l: EditorLocation | null | undefined): string;
    _locationForPhysicalId(ver: ScheduleVersion, id: string, fallback?: ScheduledLocation | null): ScheduledLocation | null;
    _intervalRaw(rot: Rotation): MaterialIntervalSlot[];
    _timelineSegments(rot: Rotation): {
        raw: MaterialIntervalSlot[];
        segments: TimelineSegment[];
        entities: TimelineEntity[];
    };
    _globalCouponIntervals(couponId: string, date?: string): {
        rotation: any;
        occ: any;
        rotationId?: string;
        occurrenceId: string;
        startSec: number;
        endSec: number;
        startLocationId?: string;
        endLocationId?: string;
        vehicleId?: string;
        kind: "coupon" | "vehicle";
        entityId: string;
        vehicleIds: string[];
        couponId?: string;
        role?: string;
        reason?: string;
    }[];
    _nextScheduleSuggestions(rot: Rotation): {
        anchor: null;
        rows: never[];
    } | {
        anchor: ScheduleOccurrence;
        rows: {
            rec: any;
            ver: any;
            offsetSec: number;
            departureSec: number;
            waitSec: number;
            origin: any;
            destination: any;
        }[];
    };
    _rotationUiState(rot: Rotation, allConflicts?: unknown): RotationUiState;
    _rotationNextService(rot: Rotation): {
        occ: ScheduleOccurrence;
        start: number;
        meta: {
            rec: any;
            ver: any;
            from: any;
            to: any;
        };
    } | null;
    _fleetMetrics(): FleetMetrics;
    _renderControlDashboard(metrics: FleetMetrics | null, rot: Rotation | null): string;
    _renderLineOverview(rot: Rotation, state: RotationUiState): string;
    _rv63FilteredRotations(metrics: FleetMetrics | null): Rotation[];
    _rv63StatusHtml(st: RotationUiState, withLabel?: unknown): string;
    _renderRv63Fleet(metrics: FleetMetrics | null): string;
    _renderRv63ServiceDetails(rot: Rotation, o: ScheduleOccurrence): string;
    _renderRv63Services(rot: Rotation): string;
    _renderRv63Material(rot: Rotation): string;
    _renderRv63Operations(rot: Rotation): string;
    _renderRv63Validation(rot: Rotation, state: RotationUiState): string;
    _renderRv63Line(rot: Rotation, state: RotationUiState): string;
    render(): void;
    _renderLibrary(rot: Rotation | null): string;
    _lineFormationText(rot: Rotation): string;
    _renderLineFormation(rot: Rotation): string;
    _renderAllLines(metrics?: FleetMetrics | null): string;
    _renderFleetInspector(metrics?: FleetMetrics | null): string;
    _dropMaterialOnLine(kind: unknown, id: unknown): void;
    _removeLineMaterial(kind: unknown, id: unknown): void;
    _assignLineDialog(): void;
    _renderMain(rot: Rotation): string;
    _timeBounds(rot: Rotation, intervals?: MaterialIntervalSlot[] | null): number[];
    _renderTimeline(rot: Rotation, realSheet?: boolean): string;
    _sheetFormationLabel(occ: ScheduleOccurrence): string;
    _sheetActionTime(rot: Rotation, a: RotationAction): number | null;
    _sheetBounds(rot: Rotation): number[];
    _renderDutySheet(rot: Rotation): string;
    _globalMaterialIntervals(vehicleId: string, date?: string): any[];
    _globalRameIntervals(rameId: string, date?: string): {
        kind: string;
        rameId: string;
        vehicleIds: any[];
        occurrenceId: any;
        startSec: number;
        endSec: number;
        startLocationId: any;
        endLocationId: any;
        role: string;
        rotation: any;
        occ: any;
    }[];
    _renderMaterialView(rot: Rotation): string;
    _renderTable(rot: Rotation): string;
    _renderInspector(rot: Rotation | null, issues: RotationIssueLike[], conflicts: RotationConflictLike[]): string;
    _renderOverviewInspector(rot: Rotation, issues: RotationIssueLike[], conflicts: RotationConflictLike[], compact?: boolean): string;
    _renderSummary(rot: Rotation, issues: RotationIssueLike[], conflicts: RotationConflictLike[]): string;
    _dragStart(e: RotationDragEvent): void;
    _dragOver(e: RotationDragEvent): void;
    _dragLeave(e: RotationDragEvent): void;
    _readDragPayload(e: RotationDragEvent): any;
    _drop(e: RotationDragEvent): void;
    _dropMaterialOnOccurrence(occId: unknown, kind: unknown, id: unknown): void;
    _input(e: RotationInputEvent): void;
    _change(e: RotationChangeEvent): void;
    _click(e: RotationClickEvent): void;
    _newRotation(): void;
    _renameRotation(): void;
    _duplicateRotation(): void;
    _toggleRotation(): void;
    _deleteRotation(): void;
    _addScheduleById(id: unknown, offsetSec?: unknown): void;
    _moveOccurrence(id: unknown, delta: unknown): void;
    _reverseOccurrence(id: unknown): void;
    _removeAction(id: unknown): void;
    _modal(title: unknown, body: unknown, buttons?: unknown): HTMLElement;
    _catalogForRameElement(rame: Rame, index: number): any;
    _rameElementPowered(rame: Rame, index: number): boolean;
    _defaultCouponName(rame: Rame): string;
    _rameElementCard(rame: Rame, index: number, selected?: Set<number>, interactive?: boolean): string;
    _rameStrip(rame: Rame, selected?: Set<number>, interactive?: boolean): string;
    _rameMaterialDialog(preselectRameId?: unknown): void;
    _assignRameDialog(): void;
    _newVehicleDialog(): void;
    _newCouponDialog(): void;
    _addScheduleDialog(): void;
    _assignDialog(occId: unknown): void;
    _actionDialog(occId: unknown, actionId?: unknown, preselectLocationId?: unknown): void;
    _removeOccurrence(id: unknown): void;
}
export default RotationV2Editor;
