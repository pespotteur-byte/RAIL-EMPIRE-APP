const CDP = require('chrome-remote-interface');

async function run() {
  const client = await CDP({ port: 29229 });
  const { Runtime, Page } = client;
  await Page.enable();
  await Page.navigate({ url: 'http://localhost:8000/' });
  await new Promise(r => setTimeout(r, 3000));
  await Page.reload({ ignoreCache: true });
  await new Promise(r => setTimeout(r, 3000));

  const expr = `(() => {
    function tick(g, m){
      const dateStr='2024-07-15';
      const hr=Math.floor(m/60), mn=m%60;
      const pt={hours:hr,minutes:mn,date:new Date(dateStr+'T'+String(hr).padStart(2,'0')+':'+String(mn).padStart(2,'0')+':00Z')};
      g.tick(m,dateStr,pt);
      for(let s=0;s<6;s++) g.moveTick(10,m+(s+1)*10/60);
    }
    const g=window.game;
    g.account.companyName = 'OCC06';
    g.startGame(null);
    const w=g.world;
    w.addStation({name:'A',lat:48.86,lon:2.35,platforms:2});
    w.addStation({name:'B',lat:48.84,lon:2.40,platforms:2});
    w.addStation({name:'C',lat:48.82,lon:2.45,platforms:2});
    const A=w.stations[0], B=w.stations[1], C=w.stations[2];
    const routeAB=[{lat:A.lat,lon:A.lon,maxSpeed:160},{lat:(A.lat+B.lat)/2,lon:(A.lon+B.lon)/2,maxSpeed:160},{lat:B.lat,lon:B.lon,maxSpeed:160}];
    const routeBC=[{lat:B.lat,lon:B.lon,maxSpeed:160},{lat:(B.lat+C.lat)/2,lon:(B.lon+C.lon)/2,maxSpeed:160},{lat:C.lat,lon:C.lon,maxSpeed:160}];
    const rm=g.rameManager;
    const rame=rm.add({name:'R1',elementDetails:[{category:'locomotive',maxSpeed:160,power:4000,mass:80,traction:'electrique',length:20,tonnage:80}]});
    const sc=g.scheduleCreator;
    sc.addService({name:'S1',rameId:rame.id,serviceType:'passager',roundTrip:false,stops:[{stationId:A.id,type:'arret',departureTime:5,arrivalTime:5},{stationId:B.id,type:'arret',departureTime:20,arrivalTime:15},{stationId:C.id,type:'arret',departureTime:35,arrivalTime:35}],routes:[routeAB,routeBC]},rame,w);
    const routeBCinc=[{lat:B.lat,lon:B.lon},{lat:(B.lat+C.lat)/2,lon:(B.lon+C.lon)/2},{lat:C.lat,lon:C.lon}];
    const logs=[];
    for(let m=0;m<300;m++){
      if(m===15) g.incidentManager.activeIncidents.push({active:true,effect:'stop',name:'Bloc BC',speedLimit:0,stationB:B.id,stationA:C.id,route:routeBCinc,_bbox:[48.82,48.85,2.40,2.46]});
      if(m===240) g.incidentManager.activeIncidents = g.incidentManager.activeIncidents.filter(i=>i.name!=='Bloc BC');
      tick(g,m);
      const svc=sc.services[0];
      logs.push({m,state:svc.state,pos:svc.position?{lat:svc.position.lat.toFixed(3),lon:svc.position.lon.toFixed(3)}:null,delay:svc.delay||0,inc:!!svc.train.incident});
    }
    const svc=sc.services[0];
    return JSON.stringify({final:svc.state,completed:svc.completed,cancelled:svc.cancelled,logs});
  })()`;

  const result = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true, timeout: 120000 });
  if (result.exceptionDetails) console.error('Exception:', result.exceptionDetails.exception?.description);
  else console.log('result', result.result?.value);
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
