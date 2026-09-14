import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('../../scripts/typescript-api.cjs')();
import { Renderer } from '../renderer.js';
import { ScheduleV2Runtime } from '../schedule-v2-runtime.js';
import { ScheduleVersion, ScheduledLocation, TrackBinding, PerformanceProfile, ScheduleState } from '../schedule-v2-model.js';
import { RotationV2Manager, ActiveFormationSpec, FormationRole } from '../rotation-v2-model.js';

function fakeCtx(){
  return { clearRect(){},drawImage(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},save(){},restore(){},fillText(){},setLineDash(){},translate(){},rotate(){},setTransform(){},measureText(){return {width:10};} };
}

test('static Livemap overlay is reused until invalidated instead of redrawing 17k stations every frame',()=>{
  const oldDocument=globalThis.document;
  globalThis.document={createElement(){return {width:0,height:0,getContext(){return fakeCtx();}};}};
  try{
    const r=Object.create(Renderer.prototype);
    Object.assign(r,{logicalWidth:1000,logicalHeight:700,tileMap:{centerLat:49,centerLon:2,zoomLevel:5},_staticCanvas:null,_staticCtx:null,_staticValid:false,_staticKey:'',_voieLayerKey:'',_needsRender:true});
    const count={tracks:0,stations:0,depots:0};
    r.drawTracks=()=>count.tracks++;
    r.drawDepots=()=>count.depots++;
    r.drawSignalBoxes=()=>{};r.drawRegulationZones=()=>{};r.drawVoieTroncons=()=>{};r.drawVoiePoints=()=>{};r.drawReferenceStations=()=>{};
    r.drawStations=()=>count.stations++;
    const world={stations:new Array(17817),tracks:[],referenceStations:[]};
    const depots={getAll(){return [];}};
    const ctx=fakeCtx();
    const flags={showZones:true,showVoiePoints:false,showStations:true,showNames:false};
    r._drawStaticOverlay(ctx,world,depots,null,null,null,flags);
    r._drawStaticOverlay(ctx,world,depots,null,null,null,flags);
    assert.equal(count.tracks,1);
    assert.equal(count.depots,1);
    assert.equal(count.stations,1);
    r.invalidateStatic();
    r._drawStaticOverlay(ctx,world,depots,null,null,null,flags);
    assert.equal(count.stations,2);
  } finally { globalThis.document=oldDocument; }
});

test('V2 physical timing is cached and shares immutable ORM geometry',()=>{
  const scheduleV2={getVersion(){return null;},calendars:[]};
  const rotationV2=new RotationV2Manager(scheduleV2);
  const loco=rotationV2.addVehicle({number:'P1',name:'Perf loco',traction:'diesel',maxSpeed:160,massKg:80000,powerW:4000000,lengthM:20,location:{kind:'STATION',id:'A'}});
  const game={rotationV2,scheduleV2,realismSettings:{physics:1}};
  const rt=new ScheduleV2Runtime(game);
  const ver=new ScheduleVersion({id:'vperf',version:1,state:ScheduleState.VALID,performanceProfile:new PerformanceProfile({maxSpeed:160,massKg:200000,powerW:3000000,lengthM:100}).toJSON()});
  ver.locations=[
    new ScheduledLocation({id:'A1',order:0,stationId:'A',name:'A',track:new TrackBinding({wayId:'1'}),departureSec:3600,dwellSec:0}),
    new ScheduledLocation({id:'B1',order:1,stationId:'B',name:'B',track:new TrackBinding({wayId:'2'}),dwellSec:0}),
  ];
  const pts=[];for(let i=0;i<1500;i++)pts.push({lat:48+i*0.00002,lon:2+i*0.00002,maxSpeed:160,electrified:false});
  ver.outboundPath.legs=[{id:'leg',fromLocationId:'A1',toLocationId:'B1',constraintIds:[],routePoints:pts,segments:[],distanceKm:10}];
  ver.outboundPath.routePoints=pts;ver.outboundPath.validatedAt='2026-08-17T00:00:00Z';ver.outboundPath.ormRevision='r1';
  const occ={id:'occ-perf',formation:new ActiveFormationSpec({members:[{vehicleId:loco.id,role:FormationRole.LEAD,order:0}]})};
  let profileCalls=0;
  const actualProfile=rt._actualProfile.bind(rt);
  rt._actualProfile=(...args)=>{profileCalls++;return actualProfile(...args);};
  const a=rt._timedVersion(occ,ver);
  const b=rt._timedVersion(occ,ver);
  assert.equal(profileCalls,1,'cache hit must happen before any repeated ORM segment/profile scan');
  assert.equal(a,b,'unchanged schedule/formation must reuse timed object');
  assert.notEqual(a.outboundPath.legs,ver.outboundPath.legs,'mutable per-leg timing caches must be isolated');
  assert.equal(a.outboundPath.legs[0].routePoints,ver.outboundPath.legs[0].routePoints,'immutable route geometry must still be shared, not deep-cloned');
  const sourceTime = ver.outboundPath.legs[0].physicalTravelSec;
  a.outboundPath.legs[0].physicalTravelSec = -123;
  assert.equal(ver.outboundPath.legs[0].physicalTravelSec,sourceTime,'editing a runtime cache must not contaminate the source schedule');
  loco.powerW=4500000;
  const c=rt._timedVersion(occ,ver);
  assert.notEqual(c,a,'physics cache must invalidate when formation performance changes');
});

test('main loop skips hidden/idle Livemap and moveTick has a zero-moving-service fast path',()=>{
  const src=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const loop=src.slice(src.indexOf('  gameLoop() {'),src.indexOf('// Global error handler'));
  assert.match(loop,/activePage === 'map'/);
  assert.match(loop,/this\.renderer\.needsRender/);
  assert.match(loop,/idleHeartbeat/);
  const move=src.slice(src.indexOf('  moveTick(dt, timeOfDay) {'),src.indexOf('  _forceV2RuntimeSyncNow()',src.indexOf('  moveTick(dt, timeOfDay) {')));
  assert.match(move,/if \(movingCount === 0\)/);
  assert.match(move,/return;/);
});

test('Batch186 startup work is idle-yielded and reuses one catalogue id index across chunks',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const loader=fs.readFileSync(new URL('../catalog-batch186-full-loader.js',import.meta.url),'utf8');
  const start=main.indexOf('  _seedBatch186CatalogChunk(chunk)');
  const end=main.indexOf('  _setCatalogLoadStatus(',start);
  const chunk=main.slice(start,end);
  assert.match(chunk,/_batch186ExistingIds/);
  assert.doesNotMatch(chunk,/const existing = new Set\(this\.rollingStock\.getAll\(\)\.map/);
  assert.doesNotMatch(main,/requestIdleCallback\(startFullCatalog/);
  assert.match(main,/FullCatalog is now strictly lazy/);
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  assert.match(ui,/page === 'rolling-stock' \|\| page === 'rames' \|\| page === 'rotations' \|\| page === 'depots'/);
  assert.match(ui,/_loadBatch186FullCatalogInBackground/);
  assert.match(loader,/requestIdleCallback/);
  assert.doesNotMatch(loader,/setTimeout\(resolve, 0\)/);
});

test('all-stations-at-minimum-zoom contract remains present while static caching is enabled',()=>{
  const src=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
  assert.match(src,/let candidates = world\.stations/);
  assert.match(src,/if \(zoom < 7\)/);
  assert.match(src,/ctx\.fillRect\(p\.x - dot \/ 2/);
  assert.match(src,/_drawStaticOverlay/);
});


test('package identity and browser cache-busters are explicit',()=>{
  const index=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.match(index,/Rail Empire v1\.1\.99/);
  assert.match(index,/manifest\.js\?v=1152/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});

test('legacy passage-stop discovery uses World spatial lookup instead of stations x route Cartesian scan',()=>{
  const src=fs.readFileSync(new URL('../schedule-creator.js',import.meta.url),'utf8');
  const start=src.indexOf('  _computePassageStops()');
  const end=src.indexOf('  getPassageStops()',start);
  const block=src.slice(start,end);
  assert.match(block,/getStationsNear/);
  assert.match(block,/bestByStation/);
});




test('all-zoom station projection caches Mercator trig across Livemap pans',()=>{
  const r=Object.create(Renderer.prototype);
  r.tileMap={_frameScale:1000,_frameCx:500,_frameCy:500,_frameHalfW:400,_frameHalfH:300};
  const st={lat:48.8566,lon:2.3522};
  const oldSin=Math.sin;
  let sins=0;
  Math.sin=(...args)=>{sins++;return oldSin(...args);};
  try{
    const a=r._stationToScreen(st);
    r.tileMap._frameCx+=10; // pan only: same station geography
    const b=r._stationToScreen(st);
    assert.equal(sins,1,'Mercator trig must run once per station geography, not once per pan frame');
    assert.equal(Math.round((a.x-b.x)*1000)/1000,10);
    st.lat+=0.001;
    r._stationToScreen(st);
    assert.equal(sins,2,'editing station geography must invalidate its projection cache');
  } finally { Math.sin=oldSin; }
});

test('catalog seed is idempotent and admin override completion cannot duplicate the base catalogue',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const seedStart=main.indexOf('  seedCatalog() {');
  const seedEnd=main.indexOf('  _applyAdminCatalogOverridesIncremental()',seedStart);
  const seed=main.slice(seedStart,seedEnd);
  assert.match(seed,/existing\.add\(entry\.id\)/,'new catalogue ids must immediately enter the dedupe index');
  const adminStart=main.indexOf('adminSync.loadOverrides().then');
  const adminEnd=main.indexOf('// Settings modal',adminStart);
  const admin=main.slice(adminStart,adminEnd);
  assert.match(admin,/_applyAdminCatalogOverridesIncremental\(\)/);
  assert.doesNotMatch(admin,/this\.seedCatalog\(\)/,'admin load must not full-reseed thousands of stock objects');
});

test('Livemap startup defers catalogue-only and V2-authoring UI work until those pages are opened',()=>{
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const rollingStart=ui.indexOf('  setupRollingStockPage() {');
  const rollingEnd=ui.indexOf('  _populateStockSubcatFilter() {',rollingStart);
  const rollingSetup=ui.slice(rollingStart,rollingEnd);
  assert.doesNotMatch(rollingSetup,/\n    this\._populateStockSubcatFilter\(\);/,'16k stock scan must not run directly during setupAll');
  const schedStart=ui.indexOf('  setupSchedulePage() {');
  const schedEnd=ui.indexOf('  _stopDataToEditObj',schedStart);
  const sched=ui.slice(schedStart,schedEnd);
  assert.match(sched,/_ensureScheduleV2Editor/);
  assert.match(sched,/_ensureRotationV2Editor/);
  const setupOnly=sched.slice(0,sched.indexOf('  _ensureScheduleV2Editor()'));
  assert.doesNotMatch(setupOnly,/new ScheduleV2Editor/);
  assert.doesNotMatch(setupOnly,/new RotationV2Editor/);
});



test('base rolling-stock catalogue is not materialized on Livemap startup',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const sg0=main.indexOf('  startGame(savedState) {');
  const sg1=main.indexOf('  _setWorldStationsStatus(',sg0);
  const startGame=main.slice(sg0,sg1);
  assert.match(startGame,/this\._seedCatalogCargoTypes\(\)/);
  assert.doesNotMatch(startGame,/\n    this\.seedCatalog\(\);/,'Livemap startup must not allocate the 16k base stock catalogue');
  const lazy0=main.indexOf('  _loadBatch186FullCatalogInBackground() {');
  const lazy1=main.indexOf('  _setupSettings()',lazy0);
  const lazy=main.slice(lazy0,lazy1);
  assert.match(lazy,/this\._ensureBaseCatalogSeeded\(\)/,'full catalogue loader must first restore the base catalogue on demand');
});

test('save load does not rebuild every validated V2 route through ORM at startup',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const source=ts.createSourceFile('main.js',main,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let hydration;
  const visit=node=>{if(ts.isMethodDeclaration(node)&&node.name?.getText(source)==='_loadStateUnchecked')hydration=node;ts.forEachChild(node,visit);};
  visit(source);assert.ok(hydration?.body,'the actual hydration method must exist');
  const block=hydration.body.getText(source);
  assert.doesNotMatch(block,/scheduleV2Revalidator\.run\(/);
  assert.match(block,/scheduleV2Runtime\?\.sync/);
});

test('startup does not replay historical ORM areas and saved bboxes do not masquerade as resident graph',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const sg0=main.indexOf('  startGame(savedState) {');
  const sg1=main.indexOf('  _setWorldStationsStatus(',sg0);
  assert.doesNotMatch(main.slice(sg0,sg1),/orm\.reloadAreas/);
  const orm=fs.readFileSync(new URL('../orm.js',import.meta.url),'utf8');
  const a=orm.indexOf('  loadFromSave(saved) {');
  const b=orm.indexOf('  // Explicit/manual compatibility helper',a);
  const block=orm.slice(a,b);
  assert.match(block,/_savedLoadedBboxes/);
  assert.match(block,/this\._loadedBboxes = \[\]/);
});

test('dynamic platform occupancy overlay iterates sparse occupied state, not visible Europe stations',()=>{
  const r=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
  const a=r.indexOf('  drawStationPlatformOccupancy(');
  const b=r.indexOf('  _drawCloudOverlay(',a);
  const block=r.slice(a,b);
  assert.match(block,/platformManager\.stationPlatforms/);
  assert.doesNotMatch(block,/getStationsInBounds/);
  assert.doesNotMatch(block,/platformManager\.getStatus/);
});

test('platform occupancy state is lazy instead of preallocating Maps for all 17,817 stations',()=>{
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.doesNotMatch(main,/for \(const st of this\.world\.stations\) this\.platformManager\.initStation/);
  const line=fs.readFileSync(new URL('../line.js',import.meta.url),'utf8');
  assert.match(line,/assignPlatform\([\s\S]*?if \(!this\.stationPlatforms\.has\(stationId\)\)[\s\S]*?this\.initStation/);
});

test('header text is throttled and static industry layer is not redrawn on every dynamic frame',()=>{
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  const u0=ui.indexOf('  update(activeServices) {');
  const u1=ui.indexOf('  updateV2RuntimeSidebar()',u0);
  const update=ui.slice(u0,u1);
  assert.match(update,/headerNow - this\._lastHeaderAt >= 1000/);
  assert.match(update,/node\.textContent !== value/);
  const r=fs.readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
  const st0=r.indexOf('  _drawStaticOverlay(');
  const st1=r.indexOf('  drawStationPlatformOccupancy',st0);
  const staticBlock=r.slice(st0,st1);
  assert.match(staticBlock,/if\s*\(\s*flags\.showIndustries\s*\)\s*this\.drawIndustries\(c\)/);
  const render0=r.indexOf('  render(');
  const render1=r.indexOf('  _drawStaticOverlay(',render0+1);
  const renderBlock=r.slice(render0,render1);
  assert.doesNotMatch(renderBlock,/drawIndustries\(ctx\)/);
});

test('V2 rotation plans are built once per simulation minute and shared by sync/diagnostics',()=>{
  const game={rotationV2:{},scheduleV2:{}};
  const rt=new ScheduleV2Runtime(game);
  const rotation={id:'rot-cache'};
  let builds=0;
  rt.planRotationForDate=()=>{builds++;return [{id:`plan-${builds}`}];};
  rt._beginPlanCacheEpoch('2026-08-17',3600);
  const a=rt._plansForRotationDate(rotation,'2026-08-17');
  const b=rt._plansForRotationDate(rotation,'2026-08-17');
  assert.equal(builds,1);
  assert.equal(a,b,'sync and diagnostics in the same minute must share the same plan objects');
  rt._beginPlanCacheEpoch('2026-08-17',3659);
  rt._plansForRotationDate(rotation,'2026-08-17');
  assert.equal(builds,1,'seconds inside the same minute must not rebuild rotation plans');
  rt._beginPlanCacheEpoch('2026-08-17',3660);
  rt._plansForRotationDate(rotation,'2026-08-17');
  assert.equal(builds,2,'minute rollover may refresh planning once');
  rt._planCache.clear();
  rt._plansForRotationDate(rotation,'2026-08-17');
  assert.equal(builds,3,'explicit invalidation must refresh immediately');
});

test('idle Livemap does not poll approach DOM or preallocate platforms for streamed OSM stations',()=>{
  const ui=fs.readFileSync(new URL('../ui.js',import.meta.url),'utf8');
  assert.match(ui,/activePage !== 'map' \|\| !this\._hasApproachBlink/);
  assert.match(ui,/this\._hasApproachBlink = false;[\s\S]*Aucun train en service/);
  const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const a=main.indexOf('  _streamNativeOSMViewport(force = false)');
  const b=main.indexOf('  // Seed the built-in rolling-stock catalog',a);
  assert.doesNotMatch(main.slice(a,b),/platformManager\.initStation/);
});

test('Paris clock reuses one Intl formatter instead of reparsing a locale string every cache refresh',()=>{
  const engine=fs.readFileSync(new URL('../engine.js',import.meta.url),'utf8');
  assert.match(engine,/this\._parisFormatter = new Intl\.DateTimeFormat/);
  const a=engine.indexOf('  _getRealParisTime(now = new Date())');
  const b=engine.indexOf('  _realMinute()',a);
  const block=engine.slice(a,b);
  assert.match(block,/_parisFormatter\.formatToParts/);
  assert.match(block,/Compatibility fallback/);
});

test('FILE:// startup bundle excludes the 40+ MB deferred rolling-stock catalogue',()=>{
  const core=fs.readFileSync(new URL('../rail-empire.file.bundle.js',import.meta.url));
  const catalog=fs.readFileSync(new URL('../rail-empire.catalog.bundle.js',import.meta.url));
  const coreText=core.toString('utf8');
  const catalogText=catalog.toString('utf8');
  assert.ok(core.length < 6_000_000,`core bundle unexpectedly heavy: ${core.length}`);
  assert.ok(core.length < catalog.length * 0.13,`core/catalog ratio unexpectedly high: ${core.length}/${catalog.length}`);
  assert.ok(catalog.length > 40_000_000,'deferred catalogue bundle should contain the heavy data');
  assert.doesNotMatch(coreText,/__modules\["js\/catalog-data\.js"\]/);
  assert.doesNotMatch(coreText,/__modules\["js\/catalog-batch186-chunks\/catalog-batch186-001\.js"\]/);
  assert.match(catalogText,/__modules\["js\/catalog-data\.js"\]/);
  assert.match(catalogText,/__modules\["js\/catalog-batch186-chunks\/catalog-batch186-001\.js"\]/);
  assert.match(coreText,/__railEmpireEnsureCatalogBundle/);
  assert.match(coreText,/rail-empire\.catalog\.bundle\.js\?v=1199(?:dep|ts|repair)\d+/);
});
