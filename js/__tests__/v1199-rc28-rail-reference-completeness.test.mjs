import test from 'node:test';
import assert from 'node:assert/strict';
import { __railReferenceTest, SERVED_RAIL_COUNTRIES } from '../rail-reference-sync.js';
import { World } from '../world.js';

const { stationFromElement, freightSiteFromElement, mergeSiteRecords, parseFranceIte3000, stationQuery, freightQuery } = __railReferenceTest;

test('RC28: heavy-rail stations are accepted while urban-only subway/tram stations are rejected', () => {
  assert.equal(stationFromElement({type:'node',id:1,lat:48.1,lon:2.1,tags:{railway:'station',station:'subway',subway:'yes',name:'Metro'}},'FR'), null);
  const heavy=stationFromElement({type:'node',id:2,lat:48.2,lon:2.2,tags:{public_transport:'station',train:'yes',station:'subway',name:'Multimodal'}},'FR');
  assert.equal(heavy?.type,'voyageur');
  assert.equal(heavy?.name,'Multimodal');
});

test('RC28: yards are freight sites and industrial/spur railways are ITE', () => {
  const yard=freightSiteFromElement({type:'node',id:10,lat:49,lon:3,tags:{railway:'yard',name:'Triage Test'}},'FR');
  assert.equal(yard?.type,'marchandise');
  assert.equal(yard?.siteKind,'yard');
  const spur=freightSiteFromElement({type:'way',id:11,center:{lat:49.01,lon:3.01},tags:{railway:'rail',service:'spur',operator:'Usine Test'}},'FR');
  assert.equal(spur?.type,'ite');
  const industrial=freightSiteFromElement({type:'way',id:12,center:{lat:49.02,lon:3.02},tags:{railway:'rail',usage:'industrial',operator:'Usine Test'}},'FR');
  assert.equal(industrial?.type,'ite');
  assert.equal(industrial?.siteKind,'industrial_rail');
});

test('RC28: multiple nearby spur ways of one ITE collapse into one gameplay site', () => {
  const points=[
    freightSiteFromElement({type:'way',id:21,center:{lat:50,lon:4},tags:{railway:'rail',service:'spur',operator:'Terminal Alpha','railway:freight':'steel'}},'BE'),
    freightSiteFromElement({type:'way',id:22,center:{lat:50.001,lon:4.001},tags:{railway:'rail',usage:'industrial',operator:'Terminal Alpha','railway:freight':'coal'}},'BE'),
  ].filter(Boolean);
  const merged=mergeSiteRecords(points);
  assert.equal(merged.length,1);
  assert.equal(merged[0].type,'ite');
  assert.deepEqual(new Set(merged[0].cargoTags),new Set(['steel','coal']));
});

test('RC28: Cerema ITE3000 GeoJSON becomes official ITE operating points', () => {
  const rows=parseFranceIte3000({features:[{id:123,geometry:{type:'Point',coordinates:[2.35,48.85]},properties:{Entreprise:'Entreprise Test',Commune:'Paris','Produit_transporté':'Céréales'}}]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'fr-ite3000-123');
  assert.equal(rows[0].type,'ite');
  assert.equal(rows[0].official,true);
  assert.match(rows[0].name,/Entreprise Test/);
  assert.ok(rows[0].facilities.includes('ite'));
});

test('RC28: country queries cover served countries and request station/yard/spur/industrial rail', () => {
  assert.ok(SERVED_RAIL_COUNTRIES.includes('FR'));
  assert.ok(SERVED_RAIL_COUNTRIES.includes('DE'));
  assert.ok(SERVED_RAIL_COUNTRIES.includes('PL'));
  assert.match(stationQuery('PL'),/ISO3166-1/);
  assert.match(stationQuery('PL'),/station\|halt/);
  assert.match(freightQuery('DE'),/yard/);
  assert.match(freightQuery('DE'),/service"~"\^\(spur\|yard\)\$/);
  assert.match(freightQuery('DE'),/usage"="industrial/);
});

test('RC28: a freight operating point beside a passenger station remains a separate station', async () => {
  const world=new World();
  await world.setBuiltInGameplayStationsAsync([{id:'pax-1',name:'Alpha',lat:48,lon:2,country:'FR',type:'voyageur'}]);
  const result=await world.mergeNativeOSMGameplayStationsAsync([{id:'yard-1',name:'Alpha',lat:48.0003,lon:2.0003,country:'FR',type:'marchandise',siteKind:'yard',facilities:['fret'],source:'OSM'}]);
  assert.equal(result.added,1);
  assert.equal(world.stations.length,2);
  assert.equal(world.getStationById('yard-1')?.type,'marchandise');
  assert.equal(world.getStationById('yard-1')?.siteKind,'yard');
});
