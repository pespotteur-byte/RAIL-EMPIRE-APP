import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.RE_COMPARE_ROOT?pathToFileURL(resolve(process.env.RE_COMPARE_ROOT)+'/'):new URL('../../',import.meta.url);
const {ScheduleV2Editor}=await import(new URL('js/schedule-v2-editor.js',base));
const {SchedulePath,TrackBinding,RouteConstraint,ScheduledLocation}=await import(new URL('js/schedule-v2-model.js',base));
function fixture(reverse=false){
 // A -> right-hand U -> C -> Q -> B. Q is AFTER C along the railway,
 // despite being closest to the straight A-C chord.
 let pts=[{lat:48,lon:2},{lat:48,lon:2.02},{lat:48.02,lon:2.02},{lat:48.02,lon:2},{lat:48.005,lon:2.001},{lat:48,lon:2.01}].map((p,i)=>({...p,wayId:'w'+i,segmentIndex:0}));
 if(reverse)pts=pts.reverse().map((p,i)=>({...p,wayId:'r'+i}));
 const loc=(id,p)=>new ScheduledLocation({id,stationId:id,track:new TrackBinding({...p,displayName:id})});
 const a=loc('A',pts[0]),b=loc('B',pts.at(-1)),d=loc('D',{lat:48.1,lon:2.1});
 const at=reverse?2:3,insert=loc('NEW',pts[at]);
 const beforeIndex=reverse?1:2,afterIndex=reverse?4:4;
 const constraints=[new RouteConstraint({...pts[beforeIndex],id:'before',order:0,legIndex:0}),new RouteConstraint({...pts[afterIndex],id:'after',order:1,legIndex:0}),new RouteConstraint({id:'next-leg',order:2,legIndex:1,lat:48.05,lon:2.05})];
 const path=new SchedulePath({constraints,legs:[{fromLocationId:'A',toLocationId:'B',routePoints:pts}]});
 return {e:Object.create(ScheduleV2Editor.prototype),path,locations:[a,b,d],insert};
}
test('RC5-SC27: an inserted stop on a U-shaped railway retains before/after VIA order',()=>{
 const {e,path,locations,insert}=fixture();e._remapConstraintsForInsertedStop(path,locations,1,insert);
 assert.equal(path.constraints.find(q=>q.id==='before').legIndex,0);
 assert.equal(path.constraints.find(q=>q.id==='after').legIndex,1);
 assert.equal(path.constraints.find(q=>q.id==='next-leg').legIndex,2);
 assert.deepEqual(path.constraints.map(q=>q.id),['before','after','next-leg']);
});
test('RC5-SC27: the same geometry in the opposite direction keeps railway ordering',()=>{
 const {e,path,locations,insert}=fixture(true);e._remapConstraintsForInsertedStop(path,locations,1,insert);
 assert.equal(path.constraints.find(q=>q.id==='before').legIndex,0);assert.equal(path.constraints.find(q=>q.id==='after').legIndex,1);
});
test('RC5-SC27: geometry and anchor metadata are neither mutated nor discarded',()=>{
 const {e,path,locations,insert}=fixture();const geometry=JSON.stringify(path.legs);
 const before=path.constraints.map(q=>{const {legIndex,order,...rest}=q.toJSON();return rest;});
 e._remapConstraintsForInsertedStop(path,locations,1,insert);
 assert.equal(JSON.stringify(path.legs),geometry);
 assert.deepEqual(path.constraints.map(q=>{const {legIndex,order,...rest}=q.toJSON();return rest;}),before);
});
test('RC5-SC27: missing old geometry uses one partition, never reverses the VIA sequence',()=>{
 const {e,path,locations,insert}=fixture();path.legs=[];
 // The independent RC4 heuristic assigns first -> after, second -> before.
 path.constraints=[new RouteConstraint({id:'q1',lat:48.02,lon:2.02,order:0}),new RouteConstraint({id:'q2',lat:48.005,lon:2.001,order:1})];
 e._remapConstraintsForInsertedStop(path,locations,1,insert);
 assert.deepEqual(path.constraints.map(q=>q.id),['q1','q2']);
 assert.ok(path.constraints.every((q,i,all)=>i===0||q.legIndex>=all[i-1].legIndex));
});
test('RC5-SC27: appending a stop keeps existing VIA and pending terminal guides on their leg',()=>{
 const {e,path,locations,insert}=fixture();const before=JSON.stringify(path.constraints);e._remapConstraintsForInsertedStop(path,locations,3,insert);assert.equal(JSON.stringify(path.constraints),before);
});
test('RC5-SC27: prepending an origin shifts existing and pending VIA by one leg',()=>{
 const {e,path,locations,insert}=fixture();const before=path.constraints.map(q=>({id:q.id,leg:q.legIndex}));
 e._remapConstraintsForInsertedStop(path,locations,0,insert);
 assert.deepEqual(path.constraints.map(q=>({id:q.id,leg:q.legIndex})),before.map(q=>({...q,leg:q.leg+1})));
});
test('RC5-SC27: the actual station-anchor insertion flow commits the correct leg ownership',async()=>{
 const {e,path,locations,insert}=fixture();const version={locations,normalize(){this.locations.forEach((l,i)=>l.order=i);}};
 e.pendingStation={action:'ADD',station:{id:'NEW',name:'Inserted'},kind:'STATION',insertIndex:1};
 e._activeVersion=()=>version;e._activePath=()=>path;e._exactTrackBinding=async()=>insert.track;e._askTrackDisplayName=()=> 'V1';
 for(const name of ['_snapshot','_markRecordChanged','_setHint','renderPanel','draw','_autosaveSoon'])e[name]=()=>{};
 let recomputed=0;e._recomputeActivePath=async()=>{recomputed++;assert.deepEqual(path.constraints.map(q=>q.legIndex),[0,1,2]);return true;};
 await e._finishPendingStationAnchor(48.02,2);assert.equal(recomputed,1);assert.equal(version.locations[1].stationId,'NEW');assert.equal(e.pendingStation,null);
});
test('RC5-coordinates: SC centering respects a snap on longitude/latitude zero',()=>{
 const e=Object.create(ScheduleV2Editor.prototype);let dirty=0;e.tileMap={markDirty(){dirty++;}};
 e.version={locations:[{track:{snapLat:0,lat:48,snapLon:0,lon:2}}]};e.returnVersion=null;
 e._centerOnContent();assert.equal(e.tileMap.centerLat,0);assert.equal(e.tileMap.centerLon,0);assert.equal(dirty,1);
});
test('RC5-coordinates: SC markers use the exact zero snap rather than original coordinates',()=>{
 const e=Object.create(ScheduleV2Editor.prototype);const seen=[];e.tileMap={latLonToPixel(lat,lon){seen.push([lat,lon]);return {x:0,y:0};}};
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
 e._drawLocations(ctx,{locations:[{kind:'STATION',track:{snapLat:0,lat:48,snapLon:0,lon:2}}]},'blue');
 assert.deepEqual(seen,[[0,0]]);
});

test('RC5-coordinates: missing and invalid locations do not move centering to Null Island',()=>{
 const e=Object.create(ScheduleV2Editor.prototype);e.tileMap={centerLat:51,centerLon:4,markDirty(){}};
 e.version={locations:[{track:{snapLat:null,snapLon:null}},{track:{lat:'',lon:Infinity}},{track:{snapLat:NaN,snapLon:false,lat:48,lon:2}}]};e.returnVersion=null;
 e._centerOnContent();assert.equal(e.tileMap.centerLat,48);assert.equal(e.tileMap.centerLon,2);
 e.version.locations=[{track:{lat:null,lon:null}}];e._centerOnContent();assert.equal(e.tileMap.centerLat,48);assert.equal(e.tileMap.centerLon,2);
});
test('RC5-coordinates: VIA drawing and hit testing use valid raw fallback, preserving zero',()=>{
 const e=Object.create(ScheduleV2Editor.prototype),seen=[];e.tileMap={latLonToPixel(lat,lon){seen.push([lat,lon]);return {x:lon,y:lat};}};
 const valid={id:'raw',lat:48,lon:0,snapLat:null,snapLon:null},invalid={id:'none',lat:null,lon:null};
 const path={constraints:[valid,invalid]};e._activePath=()=>path;
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});e._drawConstraints(ctx,path,'blue');
 assert.deepEqual(seen,[[48,0]]);assert.equal(e._nearestConstraint(48,0,1),valid);
});
