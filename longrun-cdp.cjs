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
      const count=5;
      for (let i=0;i<count;i++){
        const rame = rm.add({name:'R'+i, elementDetails:[{category:'locomotive',maxSpeed:160,power:4000,mass:80,traction:'electrique',length:20,tonnage:80}]});
        const dep=5+i*20, arrB=dep+10, depB=arrB+3, arrC=depB+10;
        const stops=[{stationId:A.id,type:'arret',departureTime:dep,arrivalTime:dep},{stationId:B.id,type:'arret',departureTime:depB,arrivalTime:arrB},{stationId:C.id,type:'arret',departureTime:arrC,arrivalTime:arrC}];
        sc.addService({name:'S'+i,rameId:rame.id,serviceType:'passager',roundTrip:true,stops,routes:[routeAB,routeBC]},rame,w);
      }
      if (g.incidentManager) g.incidentManager.enabledTypes = new Set(['signal-failure','door-problem','train-breakdown','abandoned-luggage']);
      const dateStr='2024-07-15';
      const logs=[];
      for(let m=0;m<600;m++){
        const hr=Math.floor(m/60), mn=m%60;
        const pt={hours:hr,minutes:mn,date:new Date(dateStr+'T'+String(hr).padStart(2,'0')+':'+String(mn).padStart(2,'0')+':00Z')};
        g.tick(m,dateStr,pt);
        for(let s=0;s<6;s++) g.moveTick(10,m+(s+1)*10/60);
        if (m>=50 && m%100===0) {
          const active=sc.getActiveServices();
          const counts={completed:0,cancelled:0,moving:0,waiting:0};
          for(const s of active){ if(s.completed){counts.completed++;} else if(s.cancelled){counts.cancelled++;} else if(s.state==='moving'||s.state==='departing'){counts.moving++;} else {counts.waiting++;} }
          logs.push({m, counts, incidents: g.incidentManager?.activeIncidents?.length || 0, stuck: active.filter(s=>s.state==='waiting' && !s.completed && !s.cancelled && s.delay>90).map(s=>({name:s.name,delay:s.delay}))});
        }
      }
      const active=sc.getActiveServices();
      const final={completed:0,cancelled:0,moving:0,waiting:0};
      for(const s of active){ if(s.completed){final.completed++;} else if(s.cancelled){final.cancelled++;} else if(s.state==='moving'||s.state==='departing'){final.moving++;} else {final.waiting++;} }
      return JSON.stringify({final, logs});
    })()`,
    returnByValue: true,
    awaitPromise: true,
    timeout: 300000
  });

  if (result.exceptionDetails) console.error('Exception:', result.exceptionDetails.exception?.description);
  else console.log('result', result.result?.value);
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
