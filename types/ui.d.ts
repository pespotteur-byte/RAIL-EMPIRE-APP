import { type HeadquartersData } from './qg-page.js';
import { type LiveryTarget } from './livery-model.js';
type __KPM525 = {
    "_v2DirectRameId"?: unknown;
    "rame"?: unknown;
};
type __KPM561 = number;
type __KPM565 = string;
type __KPM568 = number;
type __KPM570 = {
    "stationId": unknown;
    "name": unknown;
};
type __KPM571 = {
    "serviceType": unknown;
    "category": unknown;
    "train": Record<string, unknown>;
};
type __KPM593 = number;
import type { ActiveService, ActiveServiceLike } from './schedule-creator.js';
import type { Rame } from './rame.js';
import type { Line } from './line.js';
import type { VoiePoint } from './voie-points.js';
import type { RollingStockItem } from './rolling-stock.js';
import type { Station } from './world.js';
import type { TileMap } from './map.js';
type LivemapStop = {
    stationId?: unknown;
    type?: unknown;
    departureTime?: number | null;
    arrivalTime?: number | null;
    platform?: unknown;
    locationName?: unknown;
    lat?: number | null;
    lon?: number | null;
};
type LivemapDisplayStop = {
    s: LivemapStop;
    origIdx: number;
};
type RameClickArg = boolean | {
    ctrlKey?: boolean;
} | null | undefined;
type ScheduleStopData = {
    stationId?: unknown;
    voiePointId?: unknown;
    type?: unknown;
    stopCode?: unknown;
    arrivalTime?: number;
    departureTime?: number;
    platform?: unknown;
};
type ScheduleStopEdit = {
    stationId?: unknown;
    voiePointId?: unknown;
    type?: unknown;
    stopCode?: unknown;
    arrTimeMin?: number;
    depTimeMin?: number;
    platform?: unknown;
};
type DbQuaiVehicle = {
    role: string;
    traction: string;
    category: string;
    lengthM: number;
    number?: unknown;
    name?: unknown;
};
type DbQuaiData = {
    error?: unknown;
    stops?: unknown[];
    traffic?: unknown;
    formation?: DbQuaiVehicle[];
    serviceName?: unknown;
    scheduledTime?: unknown;
    updatedTime?: unknown;
    delay?: unknown;
    destination?: unknown;
    svcId?: unknown;
};
type LivemapStationRef = {
    id?: unknown;
};
type LivemapWorkItem = {
    startStation?: {
        name?: unknown;
    };
    endStation?: {
        name?: unknown;
    };
    stationA?: number;
    stationB?: number;
    sourceWork?: {
        recurrence?: string;
        startDate?: unknown;
        endDate?: unknown;
        daysOfWeek?: unknown[];
        startTime?: unknown;
        endTime?: unknown;
        name?: unknown;
    };
    sourceZone?: {
        distanceKm?: unknown;
    };
    affectsTraffic?: boolean;
    impact?: string;
    speedLimit?: unknown;
    direction?: string;
    workName?: unknown;
};
type LivemapRame = {
    id?: unknown;
    elementDetails?: Array<{
        catalogId?: unknown;
        id?: unknown;
        instanceName?: unknown;
        name?: unknown;
        imageData?: unknown;
        flipped?: unknown;
    }>;
};
type PlatformStopLabel = {
    name: unknown;
    isLast: boolean;
};
type ManualRoutePoint = {
    lat: number;
    lon: number;
    maxSpeed?: unknown;
    control?: unknown;
    [key: string]: unknown;
};
type ScheduleUiStop = {
    stationId?: unknown;
    voiePointId?: unknown;
    platform?: unknown;
    type?: unknown;
    [key: string]: unknown;
};
type InfogareFieldSpec = {
    x: number;
    y?: number;
    w: number;
    h?: number;
    color?: string;
    fontSize?: number;
    weight?: number;
    align?: string;
    textTransform?: string;
    bg?: string;
    alpha?: number;
    bitmapFont?: string;
    letterSpacing?: number;
    style?: string;
    type?: string;
    text?: string;
    yOff?: number;
    [key: string]: unknown;
};
type InfogareFieldExtra = {
    color?: string;
    fontSize?: number;
    weight?: number;
    align?: string;
    textTransform?: string;
    bg?: string;
    alpha?: number;
    bitmapFont?: string;
    letterSpacing?: number;
    style?: string;
};
type UiActiveService = ActiveService & __S3Struct469 & __KPM525;
export declare class UI {
    private _qgPage;
    private _reBoard;
    private _threeDLightingFilter;
    constructor(game: unknown);
    _displayRameForService(svc: __KPM525): any;
    _livemapImageSignature(rame: LivemapRame | null | undefined): string;
    _hydratePersistentTrainImages(container: HTMLElement, services: Array<__S3Struct469 & __KPM525>, preserved?: Map<string, {
        signature: string;
        node: Element;
    }>): void;
    setupAll(): void;
    refreshAll(): void;
    setupPageHelpButtons(): void;
    _ensurePageHelpButton(page: string): HTMLElement | null;
    setupNav(): void;
    _setupPageGroups(): void;
    switchPage(page: string): void;
    setupMapEvents(): void;
    _livemapEsc(value: unknown): string;
    _livemapClock(value: number, showDay?: unknown): string;
    _livemapStationIncidents(station: LivemapStationRef): any;
    _livemapStationIncidentHtml(station: LivemapStationRef): any;
    _livemapWorkLocation(item: LivemapWorkItem): string;
    _livemapWorkTooltipHtml(item: LivemapWorkItem): string;
    handleMapHover(x: number, y: number): void;
    _findServiceAtScreen(x: number, y: number): any;
    selectService(svc: __S3Struct474): void;
    _livemapPayloadText(svc: ActiveServiceLike): string;
    _syncLivemapPanel(): void;
    selectServiceById(id: string): void;
    deselectService(): void;
    applyCameraFollow(): void;
    _set3DMapPan(dx?: unknown, dy?: unknown): void;
    prepare3DMapAnchorForRender(force?: boolean): boolean;
    _sync3DCameraHeading(svc: unknown, force?: boolean): void;
    setup3DFollowView(): void;
    _set3DLightingFilter(value: unknown): void;
    toggle3DFollow(): void;
    _ensure3DServicePosition(svc: ActiveService): {
        lat: number;
        lon: number;
    } | null;
    enable3DFollow(): boolean;
    disable3DFollow(): void;
    _sync3DToggleInputs(): void;
    _threeDViewCenterForService(svc: ActiveServiceLike, heading?: unknown): {
        lat: number;
        lon: number;
        aheadKm: number;
    } | null;
    adjust3DZoom(direction: number): void;
    recenter3DFollow(): void;
    _bindTerrainStatus(): void;
    toggle3DRelief(): void;
    toggle3DLabels(): void;
    _sync3DPanelButton(): void;
    _sync3DAtmosphere(force?: boolean): void;
    _lvpRouteDistanceKm(route: unknown): any;
    _lvpRouteForLeg(svc: ActiveServiceLike | ActiveService, legIndex: number): (Record<string, unknown> & {
        lat: number;
        lon: number;
        electrified?: boolean;
        wayId?: string | number;
        way_id?: string | number;
        maxSpeed?: number;
        speed?: number;
        maxSpeedSource?: string;
        direction?: unknown;
        incline?: unknown;
        fallback?: unknown;
        tracks?: number;
        usage?: unknown;
    })[] | null;
    _lvpCurrentLegFraction(svc: ActiveServiceLike, route: unknown): number;
    /** Remaining railway distance, including any intermediate passage/technical
     * legs. No straight-line substitute: unknown geometry must not say "approach".
     */
    _livemapDistanceToStopKm(svc: UiActiveService, targetIndex: number): number | null;
    _livemapArrowProgress(svc: ActiveServiceLike, stops?: LivemapStop[] | null, displayStops?: LivemapDisplayStop[] | null): {
        fromDisplayIndex: number;
        toDisplayIndex: number;
        fraction: number;
    } | null;
    _syncLivemapProgressArrow(svc: ActiveServiceLike): void;
    _buildLivemapPanelContent(svc: ActiveServiceLike): {
        d: number;
        rows: string;
        bandeau: string;
        situation: string;
        nextHtml: string;
        curIdx: number;
    };
    _updateBandeauMarquee(): void;
    _livemapDelayReasonLines(svc: ActiveServiceLike, delayMin: unknown): string[];
    _livemapDelayReasonsHtml(svc: ActiveServiceLike, delayMin: unknown): string;
    _renderLivemapPanel(): void;
    setupTabs(): void;
    setupModals(): void;
    toggleStationCreation(): void;
    toggleIndustryCreation(): void;
    openStationCreationModal(lat: number, lon: number): void;
    saveStation(): Promise<void>;
    _showPickHint(text: string): void;
    _hidePickHint(): void;
    handlePickConnection(station: __S3Struct496): boolean;
    openEditStationModal(station: Station): void;
    deleteStation(stationId: unknown): void;
    setupRollingStockPage(): void;
    _populateStockSubcatFilter(): void;
    _populateMaterialAdvancedFilters(prefix: string, force?: unknown): void;
    _filterMaterialAdvanced(items: RollingStockItem[], prefix: unknown): RollingStockItem[];
    openStockModal(): void;
    _setStockField(id: string, val: unknown): void;
    _setStockTraction(values: string[]): void;
    _getStockTraction(): any[];
    _getStockTractionString(): string;
    _setStockWagonSubcat(val: unknown): void;
    _getStockWagonSubcat(): string;
    _computeStockTonnage(): number;
    _calculateStockPrice(): number;
    _updateStockComputedFields(): void;
    _wireStockCategoryToggle(): void;
    editStock(id: unknown): void;
    _populateCargoTypesCheckboxes(): void;
    loadStockImage(file: File): void;
    saveStock(): void;
    renderStockList(): void;
    stockPageGo(p: unknown): void;
    deleteStock(id: unknown): void;
    setupRamePage(): void;
    _populateRameSubcatFilter(): void;
    resetLiveryEditor(): void;
    renderLiveriesPage(): void;
    selectRameLivery(index: number, id: string): void;
    _rameLiverySelect(element: LiveryTarget, index: number): string;
    openRameModal(): void;
    openRameEditor(id: unknown): void;
    duplicateRame(id: unknown): void;
    _newRameElementId(): string;
    renderRamePicker(): void;
    _updateRameRandomControls(): void;
    toggleRameWagonMultiMode(): void;
    onRamePickerItemClick(stockId: unknown, ev: RameClickArg): void;
    _shuffleRameRandomPool(items: RollingStockItem[]): RollingStockItem[];
    _makeRameElementFromStock(item: {
        seriesName: unknown;
        name: unknown;
        id: unknown;
    }, flipped?: unknown): {
        stockId: unknown;
        instanceName: any;
        instanceNumber: any;
        flipped: boolean;
        elementId: string;
        seriesName: unknown;
        name: unknown;
        id: unknown;
    };
    _setRameRandomPolicyControls(enabled: boolean, maximum: number | null): void;
    randomFillRameWithSelectedWagons(): void;
    ramePickerPageGo(p: unknown): void;
    addToRame(stockId: unknown, evOrFlipped: RameClickArg): void;
    moveRameElement(index: unknown, delta: unknown): void;
    onRameElementClick(index: unknown, ev: {
        ctrlKey: unknown;
    }): void;
    flipRameElement(index: number): void;
    removeFromRame(index: unknown): void;
    renderRameAssembly(): void;
    saveRame(): void;
    renderRamesList(): void;
    ramesPageGo(p: unknown): void;
    _rameLocationLabel(r: Rame): string;
    deleteRame(id: unknown): void;
    setupSchedulePage(): void;
    _ensureScheduleV2Editor(): any;
    _ensureWorksV2Editor(): any;
    _ensureInfrastructureV2Editor(): any;
    _ensureDepotITEPointEditor(): any;
    _ensureRotationV2Editor(): any;
    _stopDataToEditObj(s: ScheduleStopData): {
        stationId: unknown;
        voiePointId: {} | null;
        stationName: any;
        type: unknown;
        stopCode: {};
        arrTimeMin: number | undefined;
        depTimeMin: number | undefined;
        arrTimeStr: string;
        depTimeStr: string;
        platform: {};
    };
    _stopEditToData(s: ScheduleStopEdit): {
        stationId: unknown;
        voiePointId: {} | null;
        type: unknown;
        stopCode: {};
        departureTime: number | undefined;
        arrivalTime: number | undefined;
        platform: {};
    };
    openScheduleModal(editService: unknown[]): void;
    _renderContractPicker(selectedId?: unknown): void;
    _calcAutoAR(): void;
    setupSchedMap(): void;
    _toggleManualMode(): void;
    _clearManualTrace(): void;
    _updateManualUI(): void;
    _toggleReturnEditMode(): Promise<void>;
    _generateDefaultReturnStops(): unknown[];
    _generateDefaultReturnRoutes(): null[];
    _recalcReturnTimes(): Promise<void>;
    _stopNameFor(stationId: unknown, voiePointId: unknown): any;
    _toggleTraceEdit(): void;
    _deleteSelectedTracePoint(): void;
    _removeTraceControl(leg: number, control: ManualRoutePoint): void;
    _addManualPoint(lat: number, lon: number): void;
    _finishManualLeg(endStop: ScheduleUiStop, maxSpeed?: unknown): void;
    _startManualRetrace(leg: number, routeIndex: number): void;
    _finishManualRetrace(): Promise<void>;
    _buildManualRoute(start: ManualRoutePoint, controls: ManualRoutePoint[], end: ManualRoutePoint, maxSpeed?: unknown): (ManualRoutePoint | {
        lat: number;
        lon: number;
        maxSpeed: {};
    } | {
        control: boolean;
        lat: number;
        lon: number;
        maxSpeed?: unknown;
    })[];
    openSillonPicker(sillons: Array<{
        name: string;
        fromStationName: string;
        toStationName: string;
        distance: number;
        maxSpeed: number;
        electrified?: boolean;
    }>, fromName: unknown, toName: unknown): Promise<unknown>;
    _resolveSillonPicker(index: unknown): void;
    _pickSillonForLeg(prevStop: {
        stationId: unknown;
        stationName: unknown;
    }, newStop: {
        stationId: unknown;
        stationName: unknown;
    }, legIdx: number): Promise<(ManualRoutePoint | {
        lat: number;
        lon: number;
        maxSpeed: {};
    } | {
        control: boolean;
        lat: number;
        lon: number;
        maxSpeed?: unknown;
    })[] | null>;
    addSchedStop(station: {
        closed: unknown;
        id: unknown;
        name: unknown;
    }): Promise<void>;
    addSchedVoiePointStop(voiePoint: {
        voie: unknown;
        stationId: unknown;
        id: unknown;
    }): Promise<void>;
    _addMapWaypoint(lat: number, lon: number): Promise<void>;
    _pointSegDistKm(lat: number, lon: number, a: __S3Struct534, b: __S3Struct535): {
        dist: number;
        t: number;
    };
    minToTimeStr(m: unknown): string;
    timeStrToMin(s: unknown): number;
    incrementTime(timeStr: unknown, minutes: unknown): string;
    renderSchedStops(): void;
    _renderRouteSummary(): void;
    updateSchedStop(index: number, field: unknown, value: string): Promise<void>;
    updateReturnPlatform(stationId: string, value: unknown): void;
    _approxRailDistance(lat1: number, lon1: number, lat2: number, lon2: number): any;
    _getStopCoords(stop: ScheduleUiStop): {
        lat: any;
        lon: any;
    } | null;
    _snapToTrack(lat: number, lon: number): {
        lat: any;
        lon: any;
    } | null;
    _densifyRoute(route: ManualRoutePoint[], spacingKm?: number): (ManualRoutePoint | {
        lat: number;
        lon: number;
        maxSpeed: {};
    } | {
        control: boolean;
        lat: number;
        lon: number;
        maxSpeed?: unknown;
    })[];
    _resampleRoute(route: unknown, spacingKm?: unknown): (ManualRoutePoint | {
        lat: number;
        lon: number;
        maxSpeed: {};
    } | {
        control: boolean;
        lat: number;
        lon: number;
        maxSpeed?: unknown;
    })[];
    _findNearestTracePoint(x: number, y: number, tileMap: {
        worldToScreen: (lat: unknown, lon: unknown, width: number, height: number) => {
            x: number;
            y: number;
        };
    }, canvas: HTMLCanvasElement): {
        leg: number;
        index: number;
        pt: unknown;
    } | null;
    _findNearestControlPoint(x: number, y: number, tileMap: TileMap, canvas: HTMLElement): {
        leg: number;
        control: any;
        index: number;
    } | null;
    _findNearestSegmentPoint(x: number, y: number, tileMap: TileMap, canvas: HTMLElement): {
        lat: number;
        lon: number;
        leg: number;
        index: number;
    } | null;
    _extractRouteControls<T extends {
        control?: unknown;
        lat: number;
        lon: number;
    }>(route: T[]): T[];
    _controlBoundsForIndex(route: ManualRoutePoint[], index: number): {
        prev: number;
        next: number;
    };
    _insertControlAt(leg: number, index: number, lat: number, lon: number): {
        lat: number;
        lon: number;
        maxSpeed: any;
        control: boolean;
    } | null;
    _insertTracePoint(leg: number, index: number, lat: number, lon: number): void;
    _removeTracePoint(leg: number, index: number): void;
    _moveTracePoint(leg: number, control: ManualRoutePoint, lat: number, lon: number): void;
    _findNearestManualControlPoint(x: number, y: number, tileMap: TileMap, canvas: HTMLElement): {
        index: number;
        pt: any;
    } | null;
    _moveManualControlPoint(index: number, lat: number, lon: number): void;
    _recalcAfterTraceEdit(leg: number): Promise<void>;
    _adjustManualRoutesForInsert(stopIndex: number): void;
    _adjustManualRoutesForRemove(stopIndex: number): void;
    _resolveRouteForLeg(stopA: ScheduleUiStop, stopB: ScheduleUiStop): Promise<any>;
    _recalcPreviewRoutes(): Promise<void>;
    _getSegmentTravelTime(prevStop: ScheduleUiStop, curStop: ScheduleUiStop, rameSpeed: number, rame?: Rame | null, legIndex?: number | null): Promise<any>;
    recalcStopsFrom(fromIndex: number): Promise<void>;
    removeSchedStop(index: unknown): void;
    startInsertStop(index: unknown): void;
    _insertStopFromMap(afterIndex: __KPM561, item: __S3Struct548): Promise<void>;
    _buildSaveRoutes(stops: ScheduleUiStop[], manualRoutes: Array<ManualRoutePoint[] | null>): Promise<any[]>;
    saveSchedule(): Promise<void>;
    editSchedule(id: unknown): void;
    renderSchedulesList(): any;
    changeSchedPage(delta: unknown): void;
    toggleSchedDetail(id: unknown): void;
    toggleSchedule(id: unknown): void;
    duplicateSchedulePrompt(id: unknown): void;
    deleteSchedule(id: unknown): void;
    setupLinePage(): void;
    saveStationFromLines(): Promise<void>;
    openLineModal(editLine?: Line | null): void;
    _populateLineStationSelect(filter?: __KPM565): void;
    _setupLineStationSearch(): void;
    setupLineMap(): void;
    addLineStop(station: {
        id: unknown;
        name: unknown;
    }): void;
    removeLineStop(index: unknown): void;
    _rebuildLineManualRoute(): void;
    _toggleLineManual(): void;
    _clearLineManual(): void;
    _finishLineManual(): void;
    _updateLineManualUI(): void;
    renderLineStops(): void;
    saveLine(): Promise<void>;
    renderLinesList(): void;
    editStationFromLines(stationId: unknown): void;
    editLine(id: unknown): void;
    deleteLine(id: unknown): void;
    openSillonCreator(): void;
    saveSillon(): Promise<void>;
    renderSillonsList(): void;
    deleteSillon(id: unknown): void;
    _updateSillonName(): void;
    _resetSillonManual(): void;
    _syncSillonManualEndpoints(): void;
    _rebuildSillonManualRoute(): void;
    _toggleSillonManualMode(): void;
    _finishSillonManual(): void;
    _clearSillonManualTrace(): void;
    _updateSillonManualUI(): void;
    setupSillonMap(): void;
    setupITEPage(): void;
    openITECreation(): void;
    _closeITECreator(): void;
    openItemModal(lat: unknown, lon: unknown): void;
    setupITEMap(): void;
    _updateITETrackUI(): void;
    _finishITETrack(): void;
    _renderITEPendingTracks(): void;
    _removeITEPendingTrack(index: unknown): void;
    saveITE(): void;
    setupDepotPage(): void;
    openDepotModal(): void;
    _toggleITEEditor(): void;
    _renderITETrackList(): void;
    removeITETrack(index: unknown): void;
    addITETrack(): void;
    saveDepot(): void;
    renderDepotsList(): void;
    selectDepotDetail(id: unknown): void;
    setDepotDetailTab(tab: unknown): void;
    _wireDepotSearchInputs(root: HTMLElement): void;
    filterDepotRows(input: HTMLElement, selector: string, dataKey: string): void;
    addDepotTracks(depotId: unknown, count: unknown): void;
    buyDepotEquipment(depotId: unknown, equipmentId: unknown): void;
    _syncRameRotationDepotLinks(rame: Rame): void;
    assignDepotHome(depotId: unknown, rameId: unknown): void;
    assignDepotElement(depotId: unknown, rameId: unknown, elementId: unknown): void;
    clearDepotHome(rameId: unknown): void;
    _syncRotationVehicleSourceHome(vehicle: {
        sourceRameId: unknown;
        sourceRameElementId: unknown;
        homeDepotId: unknown;
    }): void;
    assignRotationVehicleDepot(depotId: unknown, vehicleId: unknown): void;
    clearRotationVehicleDepot(vehicleId: unknown): void;
    assignRotationCouponDepot(depotId: unknown, couponId: unknown): void;
    clearRotationCouponDepot(couponId: unknown): void;
    enterDepot(depotId: unknown, rameId: unknown): void;
    leaveDepot(depotId: unknown, rameId: unknown): void;
    resumeRescueRouting(id: string): void;
    addRescueElement(depotId: string, rameId: unknown, elementId: unknown): void;
    buyDepotResource(depotId: unknown, key: unknown): void;
    buyDepotPart(depotId: unknown, partId: unknown): void;
    startDepotOp(depotId: unknown, rameId: unknown, opId: unknown): void;
    addRescueLoco(depotId: unknown): void;
    removeRescueLoco(depotId: unknown, stockId: unknown): void;
    buySparePart(depotId: unknown, type: string, qty: __KPM568): void;
    buyBulkSparePart(): void;
    deleteDepot(id: unknown): void;
    _renderDepotQueueSection(depot: {
        id: unknown;
    }): string;
    _renderMaintenanceButton(depot: {
        id: unknown;
    }): string;
    sendRameToMaintenance(depotId: unknown): void;
    bulkSendToMaintenance(depotId: unknown): void;
    setupIncidentPage(): void;
    openWorksModal(): void;
    saveWorks(): Promise<void>;
    renderIncidentsPage(): void;
    deleteIncident(id: unknown): void;
    deleteWorks(id: unknown): void;
    _resetWorksManual(): void;
    _syncWorksManualEndpoints(): void;
    _rebuildWorksManualRoute(): void;
    _toggleWorksManualMode(): void;
    _finishWorksManual(): void;
    _clearWorksManualTrace(): void;
    _updateWorksManualUI(): void;
    setupWorksMap(): void;
    setupEconomyPage(): void;
    _loadLogo(file: File): void;
    _applyLogo(dataUrl: unknown): void;
    _generateBulletin(): void;
    _openFicheHoraireModal(): void;
    _generateFicheHoraire(stationId: unknown): void;
    renderEconomyPage(): void;
    update(activeServices: unknown): void;
    exportMovementDiagnostics(): void;
    updateV2RuntimeSidebar(): void;
    updateTrainsList(services: UiActiveService[]): void;
    garageService(svcId: unknown): void;
    resumeFromGarage(svcId: unknown): void;
    updateFreightTab(): void;
    updateAlertBanner(): void;
    setupVoiePointButtons(): void;
    toggleVoiePointCreation(): void;
    toggleTronconCreation(): void;
    _populateVpStationDropdown(selectedStationId: unknown, lat: number, lon: number): void;
    openVoiePointModal(lat: number, lon: number): void;
    openEditVoiePointModal(vp: VoiePoint): void;
    _getPointName(pointId: unknown): any;
    _saveVoiePoint(): void;
    _deleteVoiePoint(): void;
    _deleteTroncon(trcId: unknown): void;
    _handleTronconClick(x: number, y: number): Promise<void>;
    toggleManualTronconCreation(): void;
    _handleManualTronconClick(x: number, y: number): void;
    _finalizeManualTroncon(endPoint: __S3Struct622): void;
    toggleTracerLigne(): void;
    _handleTracerLigneClick(x: number, y: number): Promise<void>;
    setupMapSearch(): void;
    _searchPlace(q: string): Promise<void>;
    setupLivemapPanelDrag(): void;
    setupMobileNav(): void;
    renderQGPage(): void;
    _headquartersData(): HeadquartersData;
    _normalizeInfogareSearch(value?: unknown): string;
    _rebuildInfogareStationIndex(): void;
    _findInfogareStations(query: unknown, limit?: number): any;
    _escapeInfogareText(value?: unknown): string;
    _renderInfogareStationSuggestions(query: unknown): any;
    _selectInfogareStation(stationId: unknown, showBoard?: unknown): boolean;
    _commitInfogareStationSearch(showBoard?: unknown): boolean;
    _rebuildInfogareServiceIndex(): void;
    _findInfogareServices(query: unknown, limit?: number): any;
    _renderInfogareServiceSuggestions(query: unknown): any;
    _getInfogareServiceEntry(key?: unknown): any;
    _selectInfogareService(key: unknown, showBoard?: unknown): boolean;
    _commitInfogareServiceSearch(showBoard?: unknown): boolean;
    renderInfogarePage(): void;
    _infogareDateDiffDays(fromDate: unknown, toDate: unknown): number;
    _infogareAddDays(dateStr: unknown, days: unknown): unknown;
    _infogareStationName(location: __KPM570): any;
    _isInfogarePassengerCategory(category?: unknown): boolean;
    _isInfogarePassengerService(service: __KPM571): boolean;
    _collectInfogareV2Trains(stationId: unknown, currentDate: unknown, nowMin: number, horizonMin?: number): InfogareRow[];
    _collectInfogareLegacyTrains(stationId: unknown, currentDate: unknown, nowMin: number, horizonMin?: number): InfogareRow[];
    _getInfogareTrains(stationId: unknown, mode: unknown, horizonMin?: number): InfogareRow[];
    _fmtTime(min: number): string;
    _fmtWait(min: unknown): string;
    _fmtDelay(min: unknown): string;
    _infogarePerPage(displayType: string): number;
    _updateInfogareMeta(station: {
        name: unknown;
    }, trains?: Array<{
        state?: string;
        isCancelled?: boolean;
        delay?: number;
    }>, displayType?: unknown): void;
    _showInfogareBoard(_refreshOnly?: unknown): void;
    _stopInfogareClock(): void;
    _animateInfogareBoard(board: HTMLElement, displayType: string): void;
    _updateInfogareClocks(board: HTMLElement): void;
    _rerRatpWaitText(waitMin: unknown): string;
    _rerRatpTopDirections(trains: InfogareRow[]): any[];
    _rerRatpIncidentText(stationId: unknown, trains: InfogareRow[]): any;
    _renderRerRatp(station: {
        id: unknown;
        name: unknown;
    }, trains: InfogareRow[], nowStr: unknown, _page?: unknown): string;
    _renderRerSncf(station: unknown, trains: InfogareRow[], nowStr: unknown, page?: number): string;
    _renderSncfDep(station: {
        name: unknown;
    }, trains: InfogareRow[], nowStr: unknown): string;
    _renderSncfArr(station: {
        name: unknown;
    }, trains: InfogareRow[], nowStr: unknown): string;
    _renderOldSncf(station: unknown, trains: InfogareRow[], nowStr: string): string;
    _animateSolari(): void;
    _renderFlashCirculation(station: unknown, nowStr: string): string;
    _renderCATI3_3(station: Record<string, unknown> & {
        id?: string;
        name?: string;
    }, trains: InfogareRow[], nowStr: unknown): string;
    _renderAFLDepart(station: Record<string, unknown> & {
        id?: string;
        name?: string;
    }, trains: InfogareRow[], nowStr: unknown, page?: number): string;
    _renderAFLArrivee(station: Record<string, unknown> & {
        id?: string;
        name?: string;
    }, trains: InfogareRow[], nowStr: unknown, page?: number): string;
    _showPlatformDisplay(svcId: unknown, stationId: unknown): void;
    _showPlannedInfogareDetail(row: __S3Struct651, station: __S3Struct652): void;
    _renderPlatformGL(svc: ActiveService, station: Station, destStation: Station, servedAfter: PlatformStopLabel[], depTime: unknown, delayStr: unknown, nowStr: unknown, numCars: number): string;
    _renderPlatformBanlieue(svc: __S3Struct657, station: unknown, destStation: __S3Struct658, servedAfter: PlatformStopLabel[], depTime: number | null | undefined, delayStr: unknown, nowStr: unknown, numCars: number): string;
    _renderCATIComplet(station: Record<string, unknown> & {
        id?: string;
        name?: string;
    }, trains: InfogareRow[], nowStr: unknown): string;
    _renderCATIAr(station: Record<string, unknown> & {
        id?: string;
        name?: string;
    }, trains: InfogareRow[], nowStr: unknown): string;
    _renderEcranQuai(station: unknown, trains: InfogareRow[], nowStr: unknown, page?: number): string;
    _renderPalette(station: unknown, trains: InfogareRow[], nowStr: unknown, page?: number): string;
    _dbQuaiClock(min: unknown): string;
    _dbQuaiIncidentText(stationId: unknown, stationIds?: unknown[], serviceId?: unknown): any;
    _dbQuaiFormation(scheduleId: unknown, versionId: unknown, occurrenceId?: unknown, liveServiceId?: unknown): any;
    _getDbQuaiData(stationId: unknown, serviceKey: unknown): {
        error: string;
        serviceName?: undefined;
        scheduledTime?: undefined;
        updatedTime?: undefined;
        delay?: undefined;
        destination?: undefined;
        stops?: undefined;
        traffic?: undefined;
        formation?: undefined;
        svcId?: undefined;
    } | {
        serviceName: string;
        scheduledTime: string;
        updatedTime: string;
        delay: number;
        destination: any;
        stops: any;
        traffic: any;
        formation: any;
        svcId: any;
        error?: undefined;
    };
    _renderDbQuai(data: DbQuaiData, station: unknown): string;
    _renderDbAbfahrt(station: unknown, trains: InfogareRow[], nowStr: unknown, page?: number): string;
    renderDashboard(): void;
    renderGraphMarche(): void;
    renderStaffPage(): void;
    renderWeatherPage(): void;
    renderSeasonalPage(): void;
    openConnectionsDialog(): void;
    renderConnectionsPage(): void;
    renderStationUpgradesPage(): void;
    renderJunctionsPage(): void;
    renderCargoTypesPage(): void;
    openCargoTypeModal(): void;
    saveCargoType(): void;
    renderITEModulesPage(): void;
    renderIndustrialClientsPage(): void;
    renderMarketingPage(): void;
    _igPhotoMask(color: unknown, alpha?: unknown): string;
    _igPhotoFrame(file: unknown, width: number, height: unknown, scale?: __KPM593, extraClass?: unknown): string;
    _renderImageMode(displayType: string, station: Station, trains: InfogareRow[], nowStr: string, page?: number): string;
    _infogareAflCommercialType(t?: Record<string, unknown>): string;
    _infogareAflTrainNumber(t?: Record<string, unknown>): string;
    _getInfogareBitmapImage(key: string): any;
    _paintInfogareBitmapFields(board: HTMLElement): void;
    _paintInfogareBitmapField(canvas: HTMLCanvasElement): void;
    _igField(spec: InfogareFieldSpec, content: unknown, extra?: InfogareFieldExtra, yOff?: number): string;
}
type __S3Struct469 = {
    "id": string;
};
type __S3Struct474 = {
    "position": {
        "lat": number;
        "lon": number;
    };
};
type __S3Struct496 = {
    "id": string;
    "name": string;
};
type __S3Struct534 = {
    "lon": number;
    "lat": number;
};
type __S3Struct535 = {
    "lon": number;
    "lat": number;
};
type __S3Struct548 = {
    "voie": unknown;
    "stationId": string;
    "id": number;
    "lat": {
        "toFixed": (...args: unknown[]) => unknown;
    };
    "lon": {
        "toFixed": (...args: unknown[]) => unknown;
    };
    "vpId": string;
    "name": string;
    "closed": unknown;
};
type InfogareRow = Record<string, unknown> & {
    svcId: string;
    scheduleId?: string;
    versionId?: string;
    occurrenceId?: string;
    name: string;
    trainNumber: string;
    seriesName: string;
    category: string;
    depTime: number | null;
    arrTime: number | null;
    waitMin: number | null;
    depWaitMin: number | null;
    arrWaitMin: number | null;
    isDeparture: boolean;
    isArrival: boolean;
    destination: string;
    origin: string;
    servedStations: string[];
    servedStationIds: unknown[];
    fromStations: string[];
    nextStops: Array<{
        name: string;
        time: number | null;
    }>;
    delay: number;
    delayReason: string;
    isCancelled: boolean;
    isFull: boolean;
    isFreightFull: boolean;
    line: unknown;
    lineCode: string;
    lineName: string;
    lineColor: string;
    voie: string;
    state: string;
    speed: number;
    rame: unknown;
    plannedV2: boolean;
};
type __S3Struct622 = {
    "id": string;
};
type __S3Struct651 = {
    "scheduleId": string;
    "versionId": string;
    "occurrenceId": string;
    "svcId": string;
    "nextStops": Array<{
        name: unknown;
        time: unknown;
    }>;
    "delay": number;
    "depTime": unknown;
    "arrTime": unknown;
    "name": string;
    "trainNumber": unknown;
    "voie": unknown;
    "destination": unknown;
    "isCancelled": boolean;
    "state": string;
};
type __S3Struct652 = {
    name: unknown;
    time: unknown;
};
type __S3Struct657 = {
    "train": {
        "color": string;
        "seriesName": unknown[];
        "platform": unknown;
    };
    "state": string;
    "name": string;
};
type __S3Struct658 = {
    "name": string;
};
export {};
