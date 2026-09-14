/**
 * A12 — Modèle de données formel du remaster Rail Empire.
 * Centralise les entités principales et expose un point d'accès unique
 * pour la validation / introspection de l'état du jeu.
 */
import { World } from './world.js';
import { VoiePointManager } from './voie-points.js';
import { LineManager, PlatformManager } from './line.js';
import { RameManager } from './rame.js';
import { RollingStockManager } from './rolling-stock.js';
import { ScheduleCreator } from './schedule-creator.js?v=1784250033';
import { FreightManager } from './freight.js';
import { DepotManager } from './depot.js';
import { StaffManager } from './staff.js?v=1784250033';
import { IncidentManager } from './incidents.js';
import { Economy } from './economy.js';
import { Weather } from './weather.js';
import { SillonManager } from './sillon.js';
export declare const A12_ENTITIES: readonly ["Node", "Edge", "Canton", "Signal", "Gare", "Ligne", "ITE", "Depot", "Engin", "Rame", "Trajet", "Service", "Contrat", "Agent", "Incident"];
export type A12Entity = typeof A12_ENTITIES[number];
interface A12Game {
    world?: World;
    voiePointManager?: VoiePointManager;
    lineManager?: LineManager;
    platformManager?: PlatformManager;
    rameManager?: RameManager;
    rollingStock?: RollingStockManager;
    stockManager?: RollingStockManager;
    scheduleCreator?: ScheduleCreator;
    freightManager?: FreightManager;
    depotManager?: DepotManager;
    staffManager?: StaffManager;
    incidentManager?: IncidentManager;
    economy?: Economy;
    weather?: Weather;
    sillonManager?: SillonManager;
}
export declare class A12Model {
    game: A12Game;
    constructor(game: unknown);
    getState(): {
        nodes: number;
        edges: number;
        gares: number;
        lignes: number;
        ites: number;
        depots: number;
        engins: number;
        rames: number;
        services: any;
        contrats: number;
        agents: any;
        incidents: number;
    };
    validate(): {
        ok: boolean;
        errors: string[];
    };
    getManager(entity: A12Entity | string): unknown;
}
export {};
