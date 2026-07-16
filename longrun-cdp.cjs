const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 29229 });
  const { Runtime, Page } = client;
  await Page.enable();
  await Page.navigate({ url: 'http://localhost:8000/' });
  await new Promise(r => setTimeout(r, 3000));
  await Page.reload({ ignoreCache: true });
  await new Promise(r => setTimeout(r, 3000));

  const result = await Runtime.evaluate({
    expression: `(() => {
      const g = window.game;
      g.account.companyName = 'LongRun';
      g.startGame(null);
      const w = g.world;
      w.addStation({ name: 'A', lat: 48.86, lon: 2.35, platforms: 4 });
      w.addStation({ name: 'B', lat: 48.84, lon: 2.40, platforms: 4 });
      w.addStation({ name: 'C', lat: 48.82, lon: 2.45, platforms: 4 });
      const [A, B, C] = w.stations;
      const routeAB = [{lat:A.lat,lon:A.lon,maxSpeed:160},{lat:(A.lat+B.lat)/2,lon:(A.lon+B.lon)/2,maxSpeed:160},{lat:B.lat,lon:B.lon,maxSpeed:160}];
      const routeBC = [{lat:B.lat,lon:B.lon,maxSpeed:160},{lat:(B.lat+C.lat)/2,lon:(B.lon+C.lon)/2,maxSpeed:160},{lat:C.lat,lon:C.lon,maxSpeed:160}];
      const sc = g.scheduleCreator;
      const rm = g.rameManager;
      const count=3;
      for (let i=0;i<count;i++){
        const rame = rm.add({name:'R'+i, elementDetails:[{category:'locomotive',maxSpeed:160,power:4000,mass:80,traction:'electrique',length:20,tonnage:80}]});
        const dep=5+i*30, arrB=dep+10, depB=arrB+3, arrC=depB+10;
        const stops=[{stationId:A.id,type:'arret',departureTime:dep,arrivalTime:dep},{stationId:B.id,type:'arret',departureTime:depB,arrivalTime:arrB},{stationId:C.id,type:'arret',departureTime:arrC,arrivalTime:arrC}];
        sc.addService({name:'S'+i,rameId:rame.id,serviceType:'passager',roundTrip:true,stops,routes:[routeAB,routeBC]},rame,w);
      }
      const dateStr='2024-07-15';
      const logs=[];
      for(let m=0;m<10;m++){
        const hr=Math.floor(m/60), mn=m%60;
        const pt={hours:hr,minutes:mn,date:new Date(dateStr+'T'+String(hr).padStart(2,'0')+':'+String(mn).padStart(2,'0')+':00Z')};
        g.tick(m,dateStr,pt);
        for(let s=0;s<6;s++) g.moveTick(10,m+(s+1)*10/60);
      }
      const active = sc.getActiveServices();
      const moving = active.find(s=>s.state==='moving');
      const snapshot = active.map(s=>({name:s.name,state:s.state,delay:s.delay,pos:s.position?{lat:s.position.lat.toFixed(3),lon:s.position.lon.toFixed(3)}:null}));
      for(let m=10;m<200;m++){
        const hr=Math.floor(m/60), mn=m%60;
        const pt={hours:hr,minutes:mn,date:new Date(dateStr+'T'+String(hr).padStart(2,'0')+':'+String(mn).padStart(2,'0')+':00Z')};
        if (m===10) {
          const inc={active:true,effect:'stop',name:'Test arret voie',speedLimit:0,stationA:A.id,stationB:B.id,route:routeAB,_bbox:[48.83,48.87,2.34,2.41]};
          const s0=sc.getActiveServices().find(s=>s.name==='S0');
          window.__dbg={before:s0?{state:s0.state,cur:s0.currentStopIndex,match:g.incidentManager._incidentMatchesServiceLeg(s0,inc)}:null};
          g.incidentManager.activeIncidents.push(inc);
        }
        if (m===80) {
          g.incidentManager.activeIncidents = g.incidentManager.activeIncidents.filter(i=>i.name!=='Test arret voie');
        }
        g.tick(m,dateStr,pt);
        for(let s=0;s<6;s++) g.moveTick(10,m+(s+1)*10/60);
        if ([10,30,60,80,120,199].includes(m)) {
          const states = sc.getActiveServices().map(s=>({name:s.name,state:s.state,speed:Math.round(s.speed||0),delay:s.delay,pos:s.position?{lat:s.position.lat.toFixed(3),lon:s.position.lon.toFixed(3)}:null,inc:!!s.train.incident}));
          if (m===10 || m===30) {
            const s0=sc.getActiveServices().find(s=>s.name==='S0');
            const inc=g.incidentManager.activeIncidents.find(i=>i.name==='Test arret voie');
            window.__dbg['m'+m]={state:s0.state,cur:s0.currentStopIndex,isRet:s0.isReturnLeg,inc:!!s0.train.incident,match:inc&&g.incidentManager._incidentMatchesServiceLeg(s0,inc),stops:s0.getCurrentStops().map(s=>({id:s.stationId,type:s.type}))};
          }
          logs.push({m, states});
        }
      }
      const final={completed:0,cancelled:0,moving:0,waiting:0};
      for(const s of sc.getActiveServices()){ if(s.completed){final.completed++;} else if(s.cancelled){final.cancelled++;} else if(s.state==='moving'||s.state==='departing'){final.moving++;} else {final.waiting++;} }
      return JSON.stringify({final, logs, snapshot, dbg: window.__dbg});
    })()`,
    returnByValue: true,
    awaitPromise: true,
    timeout: 300000
  });

  if (result.exceptionDetails) console.error('Exception:', result.exceptionDetails.exception?.description);
  else console.log('result', result.result?.value);
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
