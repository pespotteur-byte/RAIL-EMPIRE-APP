import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LivemapTrainAnnouncer,
  PiperFrenchNeuralVoice,
  PIPER_FRENCH_VOICE_ID,
} from '../livemap-train-announcer.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const stations=new Map([
  ['A',{id:'A',name:'Paris Nord'}],
  ['B',{id:'B',name:'Aulnay-sous-Bois'}],
  ['C',{id:'C',name:'Mitry — Claye'}],
]);
const world={getStationById:id=>stations.get(id)||null};
const stops=[
  {stationId:'A',type:'arret'},
  {stationId:'B',type:'arret'},
  {stationId:'C',type:'arret'},
];
const svc={id:'PIPER-1',state:'moving',currentStopIndex:1,getCurrentStops:()=>stops};

function installFakeAudio(played){
  const old=globalThis.Audio;
  class FakeAudio {
    constructor(src){ this.src=src; this.onended=null; this.onerror=null; this.volume=1; this.preload=''; }
    play(){ played.push(this.src); queueMicrotask(()=>this.onended?.()); return Promise.resolve(); }
    pause(){}
  }
  globalThis.Audio=FakeAudio;
  return ()=>{ globalThis.Audio=old; };
}

test('HOTFIX68 uses Siwis neural audio for every dynamic station chunk, never browser English', async()=>{
  const played=[];
  const synthTexts=[];
  const neuralTexts=[];
  const restoreAudio=installFakeAudio(played);
  const oldSynth=globalThis.speechSynthesis;
  const oldU=globalThis.SpeechSynthesisUtterance;
  globalThis.speechSynthesis={
    getVoices:()=>[{name:'Google US English',lang:'en-US',default:true}],
    addEventListener:()=>{}, cancel:()=>{}, resume:()=>{},
    speak:u=>{ synthTexts.push(u.text); queueMicrotask(()=>u.onend?.()); },
  };
  globalThis.SpeechSynthesisUtterance=class { constructor(text){this.text=text;} };
  const neural={
    ready:true, preparing:false, lastError:'',
    prepare:async()=>true,
    synthesize:async text=>{ neuralTexts.push(text); return new Blob(['RIFFfake'],{type:'audio/wav'}); },
  };
  try{
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural,useNeuralFrenchVoice:true,voiceReadyTimeoutMs:5,voicePollMs:1});
    assert.equal(a.announce(svc),true);
    await new Promise(r=>setTimeout(r,30));
    assert.equal(synthTexts.length,0,'browser English voice must never be spoken');
    assert.deepEqual(neuralTexts,[
      'Mitry — Claye.',
      'Aulnay-sous-Bois et Mitry — Claye.',
    ]);
    assert.ok(played.includes('audio/siv/rerb_attention.wav'));
    assert.ok(played.includes('audio/siv/rerb_destination_prefix.wav'));
    assert.ok(played.includes('audio/siv/rerb_stops_prefix.wav'));
    assert.ok(played.some(x=>String(x).startsWith('blob:')),'Piper WAV blobs must be played');
  }finally{
    restoreAudio(); globalThis.speechSynthesis=oldSynth; globalThis.SpeechSynthesisUtterance=oldU;
  }
});

test('HOTFIX68 falls back to explicit fr-FR SAPI if Piper generation fails', async()=>{
  const played=[];
  const spoken=[];
  const restoreAudio=installFakeAudio(played);
  const oldSynth=globalThis.speechSynthesis;
  const oldU=globalThis.SpeechSynthesisUtterance;
  const fr={name:'Microsoft Hortense',lang:'fr-FR',localService:true};
  globalThis.speechSynthesis={
    getVoices:()=>[fr], addEventListener:()=>{}, cancel:()=>{}, resume:()=>{},
    speak:u=>{ spoken.push(u); queueMicrotask(()=>u.onend?.()); },
  };
  globalThis.SpeechSynthesisUtterance=class { constructor(text){this.text=text;this.onend=null;this.onerror=null;} };
  const neural={ready:true,preparing:false,lastError:'BROKEN',prepare:async()=>false,synthesize:async()=>{throw new Error('offline');}};
  try{
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural,useNeuralFrenchVoice:true,voiceReadyTimeoutMs:10,voicePollMs:1});
    assert.equal(a.announce(svc),true);
    await new Promise(r=>setTimeout(r,30));
    assert.ok(spoken.length>=2);
    assert.ok(spoken.every(u=>u.voice===fr));
    assert.ok(spoken.every(u=>u.lang==='fr-FR'));
  }finally{
    restoreAudio(); globalThis.speechSynthesis=oldSynth; globalThis.SpeechSynthesisUtterance=oldU;
  }
});

test('Piper wrapper requests the lightweight fr_FR-siwis-low model and warms it', async()=>{
  const calls=[];
  const piper=new PiperFrenchNeuralVoice({
    moduleLoader:async()=>({predict:async(args)=>{calls.push(args);return new Blob(['wav']);}}),
    prepareTimeoutMs:1000,predictTimeoutMs:1000,
  });
  assert.equal(PIPER_FRENCH_VOICE_ID,'fr_FR-siwis-low');
  assert.equal(await piper.prepare(),true);
  assert.equal(piper.ready,true);
  await piper.synthesize('Paris Nord');
  assert.deepEqual(calls.map(c=>c.voiceId),['fr_FR-siwis-low','fr_FR-siwis-low']);
  assert.deepEqual(calls.map(c=>c.text),['gare','Paris Nord']);
});

test('HOTFIX68 prewarms neural voice on initial LiveMap and whenever LiveMap is opened',()=>{
  const ui=read('js/ui.js');
  assert.match(ui,/prepareNeuralVoice/);
  assert.match(ui,/activePage === 'map'/);
  assert.match(ui,/if \(page === 'map'\) \{/);
});

test('HOTFIX68 ships attribution and explicit first-use model-cache documentation',()=>{
  const attribution=read('audio/siv/PIPER_SIWIS_ATTRIBUTION.txt');
  assert.match(attribution,/fr_FR-siwis-low/);
  assert.match(attribution,/CC BY 4\.0|CC-BY 4\.0/);
  assert.match(attribution,/first use|première utilisation/i);
});
