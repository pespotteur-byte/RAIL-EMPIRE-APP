import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGameMode, depotDepartureBlock, isExpert, normalizeGameMode, DEPOT_BLOCK_WEAR_PCT } from '../game-mode.js';
import { summarizeFinance, buildQgReportHtml, QG_REPORT_PERIODS } from '../qg-report.js';
import { IndustrialClients, sitesWithinRadius, ITE_INDUSTRY_RADIUS_KM } from '../industrial-clients.js';
import { StaffManager } from '../staff.js';

test('Lot1: mode facile par défaut, expert force roulements/personnel/dépôts/IA', () => {
  assert.equal(normalizeGameMode(undefined), 'facile');
  const s = { rotationsRequired: false, personnelRequired: false, depotsRequired: false, aiCompetitors: false };
  applyGameMode(s, 'facile');
  assert.equal(isExpert(s), false);
  assert.equal(s.rotationsRequired, false);
  applyGameMode(s, 'expert');
  assert.equal(isExpert(s), true);
  assert.deepEqual([s.rotationsRequired, s.personnelRequired, s.depotsRequired, s.aiCompetitors], [true, true, true, true]);
});

test('Lot1: dépôt obligatoire bloque le départ à ≥90 % d\'usure seulement si activé', () => {
  const worn = { wearLevel: DEPOT_BLOCK_WEAR_PCT, inMaintenance: false };
  assert.equal(depotDepartureBlock({ depotsRequired: false }, worn), '');
  assert.match(depotDepartureBlock({ depotsRequired: true }, worn), /entretien dépôt obligatoire/);
  assert.equal(depotDepartureBlock({ depotsRequired: true }, { wearLevel: 40 }), '');
  assert.match(depotDepartureBlock({ depotsRequired: true }, { wearLevel: 0, inMaintenance: true }), /maintenance/);
});

test('Lot1: rapport QG — finances filtrées sur la période et rapport complet', () => {
  const day = 86_400_000, now = 100 * day;
  const history = [
    { type: 'revenue', amount: 1000, category: 'billets', time: now - 2 * day },
    { type: 'expense', amount: 300, category: 'salaires', time: now - 3 * day },
    { type: 'expense', amount: 50, category: 'pénalité retard', time: now - 4 * day },
    { type: 'revenue', amount: 9999, category: 'billets', time: now - 40 * day },
  ];
  const f7 = summarizeFinance(history, now, 7);
  assert.equal(f7.revenue, 1000);
  assert.equal(f7.expenses, 350);
  assert.equal(f7.penalties, 50);
  assert.equal(f7.net, 650);
  assert.equal(summarizeFinance(history, now, 365).revenue, 10999);
  assert.deepEqual(QG_REPORT_PERIODS.map((p) => p.days), [7, 30, 90, 180, 365]);

  const html = buildQgReportHtml({
    company: 'Test & Cie', generatedAt: '2026-01-01 12:00', days: 30, nowMs: now, balance: 5000, history,
    passengers: 12, freightTonnes: 34,
    rames: [{ name: 'Rame A', serial: 'S1', elements: ['BB 27000', 'Wagon'], totalKm: 1234, wearLevel: 12, inMaintenance: false, defects: 0, location: 'Dépôt' }],
    trains: [{ name: 'TER 1', number: '1', origin: 'A', destination: 'B', state: 'en ligne', delay: 3, rameName: 'Rame A' }],
    staff: [{ role: 'Conducteur', count: 4, onDuty: 2 }], mode: 'expert',
  });
  for (const needle of ['Test &amp; Cie', 'Rame A', 'BB 27000', 'TER 1', 'Conducteur', 'window.print', 'expert']) {
    assert.ok(html.includes(needle), `rapport sans « ${needle} »`);
  }
  assert.ok(!html.includes('<img'), 'rapport sans image');
});

test('Lot1: ITE relie les industriels dans un rayon de 15 km', () => {
  assert.equal(ITE_INDUSTRY_RADIUS_KM, 15);
  const sites = [{ lat: 48.0, lon: 2.0, n: 'proche' }, { lat: 48.5, lon: 2.0, n: 'loin' }];
  const near = sitesWithinRadius(sites, 48.05, 2.0);
  assert.deepEqual(near.map((s) => s.n), ['proche']);
  assert.ok(near[0].distanceKm > 5 && near[0].distanceKm < 6);

  const ic = new IndustrialClients();
  const [site] = ic.getAllRealLocations();
  const depot = { id: 'ite-1', built: true, type: 'ite', stationId: 'st-1', location: { lat: site.lat + 0.01, lon: site.lon } };
  const added = ic.syncClientsFromNearbySites([depot]);
  assert.ok(added >= 1);
  const auto = ic.clients.filter((c) => c.siteKey);
  assert.ok(auto.some((c) => c.siteKey === site._key && c.depotId === 'ite-1' && c.stationId === 'st-1'));
  assert.equal(ic.syncClientsFromNearbySites([depot]), 0, 'idempotent');
  ic.syncClientsFromNearbySites([]);
  assert.equal(ic.clients.filter((c) => c.siteKey).length, 0, 'ITE disparu → clients automatiques retirés');
});

test('Lot1: régulateurs/aiguilleurs affectés à une gare, nom local modifiable sans toucher la gare', () => {
  const sm = new StaffManager();
  const station = { id: 'st-koblenz', name: 'Koblenz Hbf', lat: 50.35, lon: 7.59 };
  const z = sm.addZoneAtStation(station);
  const sb = sm.addSignalBoxAtStation(station, '', 10);
  assert.equal(z.stationId, 'st-koblenz');
  assert.equal(z.name, 'Koblenz Hbf');
  assert.equal(z.lat, 50.35);
  assert.equal(sb.stationId, 'st-koblenz');
  assert.ok(sm.getStaffedStationIds().has('st-koblenz'));
  assert.equal(sm.renamePlace(z.id, 'Poste régulation Rhin'), true);
  assert.equal(z.name, 'Poste régulation Rhin');
  assert.equal(station.name, 'Koblenz Hbf');
  assert.equal(sm.renamePlace(z.id, '   '), false);
  assert.equal(sm.addZoneAtStation(null), null);
});
