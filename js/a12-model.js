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
import { ScheduleCreator } from './schedule-creator.js?v=1784730000';
import { FreightManager } from './freight.js';
import { DepotManager } from './depot.js';
import { StaffManager } from './staff.js?v=1784730000';
import { IncidentManager } from './incidents.js';
import { Economy } from './economy.js';
import { Weather } from './weather.js';
import { SillonManager } from './sillon.js?v=1784730000';

// Entités fondamentales du modèle A12 (Annexe 12)
export const A12_ENTITIES = [
  'Node',          // Point géographique (gare, ITE, point de voie)
  'Edge',          // Tronçon entre deux Nodes
  'Canton',        // Section de bloc pour le cantonnement
  'Signal',        // Signal / aspect
  'Gare',          // Station
  'Ligne',         // Ligne commerciale
  'ITE',           // Installation terminale embranchée
  'Depot',         // Dépôt / technicentre
  'Engin',         // Matériel roulant (catalogue)
  'Rame',          // Rame constituée
  'Trajet',        // Parcours élémentaire ORM
  'Service',       // Service programmé / actif
  'Contrat',       // Contrat fret
  'Agent',         // Personnel
  'Incident',      // Événement ponctuel
];

export class A12Model {
  constructor(game) {
    this.game = game;
  }

  // Retourne l'état actuel du modèle sous forme d'arbre synthétique
  getState() {
    const g = this.game;
    return {
      nodes: g.world?.stations?.length + (g.voiePointManager?.voiePoints?.length || 0),
      edges: g.world?.tracks?.length + (g.voiePointManager?.troncons?.length || 0),
      gares: g.world?.stations?.length || 0,
      lignes: g.lineManager?.getAll().length || 0,
      ites: g.voiePointManager?.getAll().length || 0,
      depots: g.depotManager?.depots?.length || 0,
      engins: g.rollingStock?.items?.length || 0,
      rames: g.rameManager?.getAll().length || 0,
      services: g.scheduleCreator?.services?.length || 0,
      contrats: g.freightManager?.contracts?.length || 0,
      agents: g.staffManager?.staff?.length || 0,
      incidents: g.incidentManager?.activeIncidents?.length || 0,
    };
  }

  // Vérifie que chaque entité de base est présente et fonctionnelle
  validate() {
    const errors = [];
    const g = this.game;
    if (!g.world) errors.push('World manquant');
    if (!g.voiePointManager) errors.push('VoiePointManager manquant');
    if (!g.lineManager) errors.push('LineManager manquant');
    if (!g.rameManager) errors.push('RameManager manquant');
    if (!g.rollingStock) errors.push('StockManager manquant');
    if (!g.scheduleCreator) errors.push('ScheduleCreator manquant');
    if (!g.freightManager) errors.push('FreightManager manquant');
    if (!g.depotManager) errors.push('DepotManager manquant');
    if (!g.staffManager) errors.push('StaffManager manquant');
    if (!g.incidentManager) errors.push('IncidentManager manquant');
    if (!g.economy) errors.push('Economy manquant');
    if (!g.weather) errors.push('WeatherManager manquant');
    return { ok: errors.length === 0, errors };
  }

  // Alias d'accès aux managers par entité A12
  getManager(entity) {
    const g = this.game;
    switch (entity) {
      case 'Gare': return g.world;
      case 'Node': case 'ITE': return g.voiePointManager;
      case 'Edge': return g.voiePointManager;
      case 'Ligne': return g.lineManager;
      case 'Depot': return g.depotManager;
      case 'Engin': return g.stockManager;
      case 'Rame': return g.rameManager;
      case 'Service': return g.scheduleCreator;
      case 'Contrat': return g.freightManager;
      case 'Agent': return g.staffManager;
      case 'Incident': return g.incidentManager;
      default: return null;
    }
  }
}
