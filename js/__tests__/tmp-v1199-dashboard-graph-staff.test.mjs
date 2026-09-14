import test from 'node:test';
import assert from 'node:assert/strict';
import { Bank } from '../bank.js';
import { Dashboard } from '../dashboard.js';
import { GraphMarche } from '../graph-marche.js';
import { StaffManager } from '../staff.js';

test('Bank old save cannot restore infinite loan duration', () => {
  const bank = new Bank();
  bank.loadFromSave({ loans:[{id:12,type:'small',principal:500000,totalDue:515000,remaining:100000,daysLeft:10,totalDays:'Infinity',dailyPayment:10000,rate:.03}], startingBalance:2000000 });
  assert.equal(bank.loans.length, 1);
  assert.ok(Number.isFinite(bank.loans[0].totalDays));
  assert.equal(bank.loans[0].totalDays, 10);
  assert.equal(bank.loans[0].id, '12');
});

test('Graph old save keeps numeric station ids and clamps stop cursor', () => {
  const g = new GraphMarche();
  g.loadFromSave({
    stationAId: 10, stationBId: 20, mode:'live', colorIdx:3,
    records:[{serviceId:99,name:'T',time:123,date:'2026-08-25',lat:48,lon:2,stopIndex:99,totalStops:3,stops:[10,20,30],color:'#123456',state:'moving'}]
  });
  assert.equal(g.stationAId, '10');
  assert.equal(g.stationBId, '20');
  assert.deepEqual(g.records[0].stops, ['10','20','30']);
  assert.equal(g.records[0].stopIndex, 3);
  assert.equal(g.records[0].totalStops, 3);
});

test('Staff random-name generation falls back safely for unknown nationality', () => {
  const sm = new StaffManager();
  assert.doesNotThrow(() => sm.generateRandomName('xx-invalid'));
  assert.match(sm.generateRandomName('xx-invalid'), /\S+\s+\S+/);
});

test('Staff load rejects impossible calendar dates for weekly rest', () => {
  const sm = new StaffManager();
  sm.loadFromSave({staff:[{id:'staff-1',name:'A',role:'conducteur',lastWeeklyRestDate:'2026-02-31'}]});
  assert.equal(sm.staff[0].lastWeeklyRestDate, null);
});

test('Dashboard normalizes string/non-finite metrics instead of concatenating totals', () => {
  const d = new Dashboard();
  const game = {
    engine:{ getParisTime:()=>({hours:12,minutes:5}) },
    scheduleCreator:{ getActiveServices:()=>[
      {state:'moving',train:{delay:'3'}},
      {state:'moving',train:{delay:'bad'}},
    ]},
    economy:{revenue:'1234.5',totalPassengers:'42'},
    rameManager:{getAll:()=>[{totalKmRun:'100'},{totalKmRun:'200'},{totalKmRun:'bad'}]},
  };
  d.record(game);
  assert.equal(d.revenueHistory.at(-1).value, 1234.5);
  assert.equal(d.passengerHistory.at(-1).value, 42);
  assert.equal(d.kmHistory.at(-1).value, 300);
  assert.equal(d.punctualityHistory.at(-1).value, 50);
});
