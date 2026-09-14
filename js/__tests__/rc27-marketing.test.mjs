import test from 'node:test';
import assert from 'node:assert/strict';
import { MarketingManager } from '../marketing.js';

function fakeGame(){
  const eco={
    totalPassengers:10000,totalTicketRevenue:1250000,passengerSatisfaction:82,revenue:2000000,expenses:1200000,
    revenues:[],costs:[],
    addRevenue(amount,category,description){this.revenues.push({amount,category,description});this.revenue+=amount;return true;},
    addExpense(amount,category,description){this.costs.push({amount,category,description});this.expenses+=amount;return true;}
  };
  const services=[
    {name:'RE 1001',serviceType:'passager',state:'moving',train:{delay:1},rame:{totalCapacity:500},_onboardPax:320},
    {name:'RE 1002',serviceType:'passager',state:'moving',train:{delay:12},rame:{totalCapacity:400},_onboardPax:200},
    {name:'RE 1003',serviceType:'passager',state:'cancelled',cancelled:true,train:{delay:0},rame:{totalCapacity:300},_onboardPax:0},
    {name:'FRET 1',serviceType:'fret',state:'moving',train:{delay:0},rame:{totalCapacity:0},_onboardPax:0},
  ];
  return {
    economy:eco,
    scheduleCreator:{services,getActiveServices(){return services.filter(s=>s.state==='moving');}},
    rameManager:{getAll(){return [
      {totalCapacity:500,cleanliness:{interior:92,exterior:88}},
      {totalCapacity:400,cleanliness:{interior:86,exterior:80}},
      {totalCapacity:0,cleanliness:{interior:20,exterior:20}},
    ];}},
    saveState(){},
    _currentDate:'2026-09-14'
  };
}

test('RC27 marketing ships a broad built-in commercial catalogue',()=>{
  const m=new MarketingManager();
  assert.ok(m.offers.length>=24);
  assert.ok(m.catering.length>=34);
  assert.ok(m.features.length>=18);
  assert.ok(m.adSlots.length>=12);
  const tabs=['overview','onboard','offers','campaigns','ads','satisfaction','feedback','press'];
  for(const tab of tabs){
    m._tab=tab;
    const html=m._renderPage();
    assert.match(html,/Offres clients/);
    assert.match(html,/Restauration/);
    assert.match(html,/Publicité/);
    assert.doesNotMatch(html,/&nbsp;/,`missing SVG icon on ${tab}`);
  }
});

test('RC27 marketing KPIs are grounded in live game data',()=>{
  const m=new MarketingManager();
  const g=fakeGame();
  m.syncFromGame(g);
  assert.equal(m._liveSnapshot.totalPassengers,10000);
  assert.equal(Math.round(m._liveSnapshot.punctuality),50);
  assert.equal(m._liveSnapshot.cancelled,1);
  assert.ok(m.stats.satisfaction>0&&m.stats.satisfaction<=100);
  assert.ok(m.getPassengerDemandMultiplier()>=0.72&&m.getPassengerDemandMultiplier()<=1.55);
  assert.ok(m.getPassengerFareMultiplier()>=0.72&&m.getPassengerFareMultiplier()<=1.28);
});

test('RC27 daily settlement uses passenger deltas and books real ancillary economics',()=>{
  const m=new MarketingManager();
  const g=fakeGame();
  m.dailyUpdate(g,'2026-09-14'); // establishes passenger baseline
  g.economy.totalPassengers+=1000;
  m.adSlots[0].active=true;m.adSlots[0].advertiser='Test';m.adSlots[0].daysRemaining=30;
  m.campaigns.push({id:'c1',name:'Test',channel:'Digital',target:'Tous',objective:'Conversion',budgetPerDay:5000,durationDays:10,daysRemaining:10,awarenessGain:4,demandGain:5,satisfactionGain:1,active:true,createdAt:'2026-09-14'});
  m.dailyUpdate(g,'2026-09-15');
  assert.equal(m.stats.dailyPassengers,1000);
  assert.ok(m.stats.onboardRevenueToday>0);
  assert.ok(m.stats.adRevenueToday>0);
  assert.ok(g.economy.revenues.some(x=>x.category==='restauration'));
  assert.ok(g.economy.revenues.some(x=>x.category==='publicite'));
  assert.ok(g.economy.costs.some(x=>x.category==='marketing'));
  assert.ok(m.feedbacks.length>=2);
  assert.ok(m.feedbacks[0].message.length>25);
});

test('RC27 marketing state round-trips through save/load',()=>{
  const m=new MarketingManager();
  m.offers[0].active=!m.offers[0].active;
  m.adSlots[0].advertiser='Annonceur';m.adSlots[0].active=true;
  const saved=m.toSave();
  const n=new MarketingManager();n.loadFromSave(saved);
  assert.equal(n.offers.find(x=>x.name===m.offers[0].name)?.active,m.offers[0].active);
  assert.equal(n.adSlots.find(x=>x.name===m.adSlots[0].name)?.advertiser,'Annonceur');
  assert.ok(n.offers.length>=24);
});
