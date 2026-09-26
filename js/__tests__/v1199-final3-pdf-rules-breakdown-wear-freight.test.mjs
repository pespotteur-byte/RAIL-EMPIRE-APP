import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceMaterialMileage, WEAR_FULL_KM } from '../material-mileage.js';
import { incidentWearLevel, pickByWear, BREAKDOWN_INCIDENT_TYPES } from '../incidents.js';

const sc = readFileSync(new URL('../../src/ts/schedule-creator.ts', import.meta.url), 'utf8');
const eco = readFileSync(new URL('../../src/ts/economy.ts', import.meta.url), 'utf8');

test('PDF: usure 100 % après 50 000 km', () => {
  const m = { totalKmRun: 0, kmSinceLastMaint: 0, wearLevel: 0 };
  advanceMaterialMileage(m, {}, 25000);
  assert.ok(Math.abs(m.wearLevel - 50) < 1e-9);
  advanceMaterialMileage(m, {}, 40000);
  assert.equal(m.wearLevel, 100);
  assert.equal(WEAR_FULL_KM, 50000);
});

test('PDF: aucune panne matériel à 0 % d\'usure, tirage pondéré par l\'usure', () => {
  assert.ok(BREAKDOWN_INCIDENT_TYPES.has('train-breakdown'));
  assert.ok(BREAKDOWN_INCIDENT_TYPES.has('weather-rolling-stock-failure'));
  assert.equal(incidentWearLevel({ train: { wearLevel: 0 } }), 0);
  assert.equal(incidentWearLevel({ train: {}, rame: { wearLevel: 12 } }), 12);
  const a = { svc: { train: { wearLevel: 10 } } }, b = { svc: { train: { wearLevel: 90 } } };
  assert.equal(pickByWear([a, b], 0.05), a);
  assert.equal(pickByWear([a, b], 0.5), b);
  assert.equal(pickByWear([a, b], 0.999999), b);
  // Panne aléatoire kilométrique : garde-fou wearLevel > 0 dans le code.
  assert.match(sc, /if \(!this\.train\.breakdown && wearLevel > 0\)/);
});

test('PDF: panne jamais infinie — réparation sur place sans secours (45 min) ou plafond 4 h', () => {
  assert.match(sc, /_tickBreakdownWatchdog\(timeOfDay: number\): boolean/);
  assert.match(sc, /const limit = this\._rescueDispatched \? 240 : 45;/);
  assert.match(sc, /Panne réparée sur place/);
  // Les deux chemins (train arrêté et train en mouvement) arment le garde-fou.
  assert.ok((sc.match(/_tickBreakdownWatchdog\(/g) || []).length >= 3);
  // Freinage d'urgence progressif : cible 0 km/h via la physique, pas de téléportation.
  assert.match(sc, /if \(strikeBlocked \|\| severeBreakdown\) \{\s*effectiveMaxSpeed = 0;/);
});

test('PDF: fret jamais vide — chargement 100 % à l\'origine', () => {
  assert.match(eco, /const frtBoardRate = isFirst && freightAccess \? 1 : 0\.20 \+ rng\.random\(\) \* 0\.50;/);
});

test('PDF: incidents configurables 0–10 par type et cadence globale', async () => {
  const { IncidentManager, INCIDENT_LEVEL_DEFAULT } = await import('../incidents.js');
  const im = new IncidentManager();
  assert.equal(im.getTypeLevel('signal-failure'), INCIDENT_LEVEL_DEFAULT);
  assert.equal(im.typeLevelFactor('signal-failure'), 1);
  im.setTypeLevel('signal-failure', 10);
  assert.equal(im.typeLevelFactor('signal-failure'), 2);
  im.setTypeLevel('signal-failure', 0);
  assert.equal(im.isTypeEnabled('signal-failure'), false, 'niveau 0 = jamais');
  im.setTypeLevel('signal-failure', 99);
  assert.equal(im.getTypeLevel('signal-failure'), 10, 'borné à 10');
  assert.equal(im.getGlobalLevel(), 5);
  im.setGlobalLevel(0);
  assert.equal(im.targetIncidentsPerHour, 0);
  im.setGlobalLevel(10);
  assert.equal(im.targetIncidentsPerHour, 100);
  const saved = im.getCadenceSave();
  const im2 = new IncidentManager();
  im2.loadCadenceSave(saved);
  assert.equal(im2.getTypeLevel('signal-failure'), 10);
  assert.equal(im2.getGlobalLevel(), 10);
  im2.loadCadenceSave(null);
  assert.equal(im2.getTypeLevel('signal-failure'), INCIDENT_LEVEL_DEFAULT, 'sauvegarde legacy = défauts');
});

test('PDF: motif de retard persistant tant que le retard n\'est pas résorbé', async () => {
  const { ActiveService, RESIDUAL_DELAY_SUFFIX } = await import('../schedule-creator.js');
  const svc = Object.create(ActiveService.prototype);
  svc.train = { delay: 12, delayReason: '', incident: { name: 'Panne de signalisation' } };
  svc._updateDelayReason();
  assert.equal(svc.train.delayReason, 'Panne de signalisation');
  svc.train.incident = null;
  svc._updateDelayReason();
  assert.equal(svc.train.delayReason, 'Panne de signalisation' + RESIDUAL_DELAY_SUFFIX, 'cause terminée, retard encore présent');
  svc.train.delay = 0;
  svc._updateDelayReason();
  assert.equal(svc.train.delayReason, '', 'retour à l heure = plus de motif');
  svc.train.delay = 3;
  svc._updateDelayReason();
  assert.equal(svc.train.delayReason, '', 'aucune cause connue après retour à l heure');
});
