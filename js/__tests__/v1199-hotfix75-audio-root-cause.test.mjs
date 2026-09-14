import test from 'node:test';
import assert from 'node:assert/strict';
import { LivemapTrainAnnouncer, PiperFrenchNeuralVoice } from '../livemap-train-announcer.js';

const stations=new Map([
  ['A',{id:'A',name:'Paris Nord',country:'FR'}],
  ['B',{id:'B',name:'Antony',country:'FR'}],
  ['C',{id:'C',name:'Massy — Palaiseau',country:'FR'}],
]);
const world={getStationById:id=>stations.get(id)||null};
const svc={id:'HF75-SIV',state:'moving',currentStopIndex:1,getCurrentStops:()=>[
  {stationId:'A',type:'arret'},{stationId:'B',type:'arret'},{stationId:'C',type:'arret'},
]};

function installAudioAndEnglishOnlySpeech(){
  const old={Audio:globalThis.Audio,speechSynthesis:globalThis.speechSynthesis,Utterance:globalThis.SpeechSynthesisUtterance};
  const played=[],spoken=[];
  globalThis.Audio=class{
    constructor(){this.src='';this.onended=null;this.onerror=null;this.volume=1;this.preload='';}
    load(){}
    play(){played.push(this.src);queueMicrotask(()=>this.onended?.());return Promise.resolve();}
    pause(){}
  };
  globalThis.speechSynthesis={
    getVoices:()=>[{name:'English only',lang:'en-US',default:true}],
    addEventListener:()=>{},cancel:()=>{},resume:()=>{},
    speak:u=>{spoken.push(u);queueMicrotask(()=>u.onend?.());},
  };
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;this.onend=null;this.onerror=null;this.voice=undefined;}};
  return {played,spoken,restore(){globalThis.Audio=old.Audio;globalThis.speechSynthesis=old.speechSynthesis;globalThis.SpeechSynthesisUtterance=old.Utterance;}};
}

test('HOTFIX75 root cause: Piper failure + no exposed French voice cannot stop after Attention', async()=>{
  const env=installAudioAndEnglishOnlySpeech();
  const neural={
    ready:false,preparing:false,lastError:'PIPER_OPFS_UNAVAILABLE:file::SecurityError',
    prepare:async()=>false,
    prepareVoice:async()=>false,
    isVoiceReady:()=>false,
    synthesize:async()=>{throw new Error('must not be required');},
  };
  try{
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural,voiceReadyTimeoutMs:1,voicePollMs:1});
    assert.equal(a.announce(svc),true);
    await new Promise(r=>setTimeout(r,80));
    assert.deepEqual(env.played.slice(0,3),[
      'audio/siv/rerb_attention.wav',
      'audio/siv/rerb_destination_prefix.wav',
      'audio/siv/rerb_stops_prefix.wav',
    ]);
    assert.ok(env.spoken.some(u=>/Massy/.test(u.text)), 'destination must still be attempted');
    assert.ok(env.spoken.every(u=>u.lang==='fr-FR'), 'French names must request fr-FR');
    assert.ok(env.spoken.every(u=>!u.voice), 'English exposed voice must never be explicitly assigned');
    assert.equal(globalThis.__RAIL_EMPIRE_AUDIO_DIAG__?.stage,'announcement-complete');
  }finally{env.restore();}
});

test('HOTFIX75 OPFS denial is cache-only: Piper still synthesizes and avoids duplicate pre-download', async()=>{
  const oldNav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const oldLoc=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>{const e=new Error('denied');e.name='SecurityError';throw e;}}}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'file:'}});
  let downloads=0,predicts=0;
  const fakeMod={
    download:async()=>{downloads++;},
    predict:async({text,voiceId})=>{predicts++;return {text,voiceId,kind:'wav'};},
  };
  try{
    const p=new PiperFrenchNeuralVoice({prepareTimeoutMs:2000});
    p._loadModule=async()=>fakeMod;
    const ok=await p.prepare();
    assert.equal(ok,true);
    assert.equal(downloads,0,'OPFS denial must skip explicit prefetch that would be downloaded twice');
    assert.equal(predicts,1);
    assert.equal(p.ready,true);
  }finally{
    if(oldNav)Object.defineProperty(globalThis,'navigator',oldNav);else delete globalThis.navigator;
    if(oldLoc)Object.defineProperty(globalThis,'location',oldLoc);else delete globalThis.location;
  }
});

test('HOTFIX75 isolates Piper TtsSession per language instead of reusing the package singleton model', async()=>{
  class FakeSession{
    static _instance=null;
    constructor({voiceId}){
      if(FakeSession._instance){ FakeSession._instance.voiceId=voiceId; return FakeSession._instance; }
      this.voiceId=voiceId; this.ready=true; FakeSession._instance=this;
    }
    static async create(opts){ return new FakeSession(opts); }
    async predict(text){ return {voiceId:this.voiceId,text}; }
  }
  const p=new PiperFrenchNeuralVoice({moduleLoader:async()=>({TtsSession:FakeSession,predict:async()=>{throw new Error('package singleton predict must not be used');}})});
  const fr=await p.synthesize('Paris','fr_FR-siwis-low');
  const de=await p.synthesize('Frankfurt','de_DE-eva_k-x_low');
  const fr2=await p.synthesize('Lyon','fr_FR-siwis-low');
  assert.equal(fr.voiceId,'fr_FR-siwis-low');
  assert.equal(de.voiceId,'de_DE-eva_k-x_low');
  assert.equal(fr2.voiceId,'fr_FR-siwis-low');
  assert.notEqual(p._sessions.get('fr_FR-siwis-low'),p._sessions.get('de_DE-eva_k-x_low'));
});

test('HOTFIX75 audio diagnostics expose protocol, OPFS and Piper state without touching simulation',()=>{
  const env=installAudioAndEnglishOnlySpeech();
  try{
    const neural={ready:false,preparing:false,lastError:'TEST',prepare:async()=>false};
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural});
    const d=a.getAudioDiagnostics();
    assert.ok('protocol' in d);
    assert.ok('opfs' in d);
    assert.equal(d.piperReady,false);
    assert.equal(d.piperError,'TEST');
  }finally{env.restore();}
});


test('HOTFIX75 shipped bundle contains the root-cause fix and cache dep70', async()=>{
  const fs=await import('node:fs');
  const path=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const here=path.dirname(fileURLToPath(import.meta.url));
  const root=path.resolve(here,'../..');
  const bundle=fs.readFileSync(path.join(root,'js/rail-empire.file.bundle.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(bundle,/OPFS is a CACHE only/);
  assert.match(bundle,/LANG_HINT_FALLBACK/);
  assert.match(bundle,/__RAIL_EMPIRE_AUDIO_DIAG__/);
  assert.match(bundle,/@realtimex\/piper-tts-web@1\.1\.1/);
  assert.match(bundle,/PIPER_SESSION_INVALID/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
