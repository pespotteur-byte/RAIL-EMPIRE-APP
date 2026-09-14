import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const world={stations:[{id:'bonn',name:'Bonn Hbf',lat:50.7,lon:7.1},{id:'roisdorf',name:'Roisdorf',lat:50.76,lon:7},{id:'koln',name:'Köln Hbf',lat:50.94,lon:6.95}],tracks:[],getStationById(id){return this.stations.find(s=>s.id===id);}};
const results={};
for(const [version,dir]of [['RC19','/mnt/data/RC19_BASELINE'],['RC20',root]]){
 const {IncidentManager,PREDEFINED_INCIDENT_TYPES}=await import(pathToFileURL(path.join(dir,'js/incidents.js')).href);
 const type=PREDEFINED_INCIDENT_TYPES.find(x=>x.id==='passenger-illness');
 const one=stationId=>{const station=world.getStationById(stationId);const service={id:'direct',state:'stopped_at_station',speed:0,currentStopIndex:2,stops:[{stationId:'bonn',type:'arret'},{stationId:'koln',type:'arret'}],position:{lat:station.lat,lon:station.lon},rame:{totalCapacity:120},train:{id:'train',stoppedAt:station}};const incident=new IncidentManager()._spawnTrainIncident(type,[service],600,world);return {created:!!incident,station:incident?.stationA||null};};
 results[version]={unbookedRoisdorf:one('roisdorf'),bookedCologne:one('koln')};
}
assert.equal(results.RC19.unbookedRoisdorf.created,true);assert.equal(results.RC20.unbookedRoisdorf.created,false);assert.equal(results.RC20.bookedCologne.created,true);assert.equal(results.RC20.bookedCologne.station,'koln');
const output={pass:true,method:'Same direct timetable and train stopped at a non-booked station versus booked arrival; original RC19 modules extracted unchanged; actual IncidentManager in both versions.',results};
fs.writeFileSync(path.join(root,'QA/RE_REPAIR_RC20/INCIDENT_BEFORE_AFTER.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
