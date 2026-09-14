import {pathToFileURL} from 'node:url';import path from 'node:path';
const root=path.resolve(process.argv[2]||'.'),{CantonManager}=await import(pathToFileURL(path.join(root,'js/simulation.js'))),{Economy}=await import(pathToFileURL(path.join(root,'js/economy.js')));
const route=Array.from({length:121},(_,i)=>({lat:48+i*.001,lon:2,wayId:'rail',maxSpeed:60,maxSpeedSource:'OSM'}));
const m=new CantonManager(),a=m.createRouteCantons(route),services=['a','b'].map(id=>({id,active:true,state:'moving',position:route[0]}));globalThis.window={game:{scheduleCreator:{services}}};const before=m.cantons.size;m.cleanup();const after=m.cantons.size;const occupyA=m.occupy(a[1].cantonId,'a'),occupyB=m.occupy(a[1].cantonId,'b');
const e=new Economy();for(let i=0;i<1500;i++)e.addRevenue(1,'fret','R'+i);for(let i=0;i<65;i++)e.processDailyCharges([],[],new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10));
console.log(JSON.stringify({root,blocksBefore:before,blocksAfterCleanup:after,firstTrainAccepted:occupyA,conflictingTrainAccepted:occupyB,transactions:e.history.length,dailyBalances:e.dailySnapshots.length},null,2));
