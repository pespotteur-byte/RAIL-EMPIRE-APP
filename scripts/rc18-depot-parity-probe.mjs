import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=process.env.RE_BASE||path.resolve(import.meta.dirname,'..');const mod=n=>import(pathToFileURL(path.join(root,'js',n+'.js')));
const {DepotManager}=await mod('depot'),{Rame}=await mod('rame');const rows=[];
for(const opId of ['refuel','brake_overhaul']){
 const dm=new DepotManager(),eco={balance:1e8,expenses:[],addExpense(n,c,d){this.balance-=n;this.expenses.push({n,c,d});}};
 const d=dm.add({type:'depot',name:'RC18',stationId:'A',tracks:4,cost:0,placementOnly:true,location:{lat:48,lon:2},infrastructure:['technicentre']},null);
 const r=new Rame({id:'R18',name:'BB75000',elementDetails:[{elementId:'L18',category:'locomotive',traction:'diesel',length:20,maxSpeed:120,mass:90,power:2000}],currentLocation:{}});dm.enterRame(d.id,r,[]);r.consumables.fuelL=0;
 d.resourceStocks.diesel_l=1e5;d.resourceStocks.brake_cleaner_l=100;d.partInventory.brake_pad_set=40;d.partInventory.brake_disc=20;d._syncLegacySpareParts();
 const snapshot=()=>JSON.parse(JSON.stringify({stock:d.resourceStocks,parts:d.partInventory,usage:d.resourceUsage,utility:d.utilityTotals,balance:eco.balance,expenses:eco.expenses}));
 const before=snapshot();let attempted=false;const result=dm.startDepotOperation(d.id,r,opId,eco,{checkDepotStaff:()=>({ok:true,shortages:[]}),reserveDepotStaff:()=>{attempted=true;return{ok:false};}}),after=snapshot();
 rows.push({opId,attempted,result,before,after,pass:attempted&&result.ok===false&&JSON.stringify(before)===JSON.stringify(after)});
}
console.log(JSON.stringify({root,rows},null,2));
