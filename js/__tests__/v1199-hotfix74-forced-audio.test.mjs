import test from 'node:test';
import assert from 'node:assert/strict';
import { LivemapTrainAnnouncer, PiperFrenchNeuralVoice } from '../livemap-train-announcer.js';

const stations=new Map([
  ['A',{id:'A',name:'Paris Nord',country:'FR'}],
  ['B',{id:'B',name:'Aulnay-sous-Bois',country:'FR'}],
  ['C',{id:'C',name:'Mitry — Claye',country:'FR'}],
]);
const world={getStationById:id=>stations.get(id)||null};
const stops=[
  {stationId:'A',type:'arret'},
  {stationId:'B',type:'arret'},
  {stationId:'C',type:'arret'},
];
const svc={id:'HF74-AUDIO',state:'moving',currentStopIndex:1,getCurrentStops:()=>stops};

function installEnglishOnlySpeech(){
  const oldSynth=globalThis.speechSynthesis, oldU=globalThis.SpeechSynthesisUtterance;
  globalThis.speechSynthesis={
    getVoices:()=>[{name:'Google US English',lang:'en-US',default:true}],
    addEventListener:()=>{},cancel:()=>{},resume:()=>{},speak:()=>{},
  };
  globalThis.SpeechSynthesisUtterance=class { constructor(text){this.text=text;} };
  return ()=>{ globalThis.speechSynthesis=oldSynth; globalThis.SpeechSynthesisUtterance=oldU; };
}

test('HOTFIX74 reuses the click-authorized media element for delayed Piper WAVs', async()=>{
  const restoreSpeech=installEnglishOnlySpeech();
  const oldAudio=globalThis.Audio, oldAC=globalThis.AudioContext, oldWAC=globalThis.webkitAudioContext;
  const instances=[], played=[];
  class AutoplayGateAudio {
    constructor(){ this.src=''; this.onended=null; this.onerror=null; this.volume=1; this.preload=''; this.unlocked=false; instances.push(this); }
    load(){}
    play(){
      played.push(this.src);
      // The first real recorded phrase is inside the user gesture and unlocks THIS
      // element. A fresh element trying a delayed blob would be rejected.
      if (/rerb_attention\.wav$/.test(this.src)) this.unlocked=true;
      if (String(this.src).startsWith('blob:') && !this.unlocked) return Promise.reject(Object.assign(new Error('autoplay'),{name:'NotAllowedError'}));
      queueMicrotask(()=>this.onended?.());
      return Promise.resolve();
    }
    pause(){}
  }
  globalThis.Audio=AutoplayGateAudio;
  globalThis.AudioContext=undefined;
  globalThis.webkitAudioContext=undefined;
  const neural={
    ready:true,preparing:false,lastError:'',prepare:async()=>true,
    synthesize:async text=>new Blob([`RIFF-${text}`],{type:'audio/wav'}),
  };
  try{
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural,useNeuralFrenchVoice:true,voiceReadyTimeoutMs:1,voicePollMs:1});
    assert.equal(a.announce(svc),true);
    await new Promise(r=>setTimeout(r,50));
    assert.equal(instances.length,1,'one persistent HTMLAudio element must serve the whole SIV sentence');
    assert.ok(played.includes('audio/siv/rerb_attention.wav'));
    assert.ok(played.includes('audio/siv/rerb_destination_prefix.wav'));
    assert.ok(played.includes('audio/siv/rerb_stops_prefix.wav'));
    assert.ok(played.filter(x=>String(x).startsWith('blob:')).length>=2,'delayed Piper WAVs must actually play');
  }finally{
    restoreSpeech(); globalThis.Audio=oldAudio; globalThis.AudioContext=oldAC; globalThis.webkitAudioContext=oldWAC;
  }
});

test('HOTFIX74 unlocks WebAudio synchronously and uses it for delayed neural chunks', async()=>{
  const restoreSpeech=installEnglishOnlySpeech();
  const oldAudio=globalThis.Audio, oldAC=globalThis.AudioContext, oldWAC=globalThis.webkitAudioContext;
  const mediaPlayed=[]; let resumeCalls=0, bufferStarts=0, decoded=0;
  class FakeAudio {
    constructor(){this.src='';this.onended=null;this.onerror=null;this.volume=1;}
    load(){}
    play(){mediaPlayed.push(this.src);queueMicrotask(()=>this.onended?.());return Promise.resolve();}
    pause(){}
  }
  class FakeContext {
    constructor(){this.state='running';this.sampleRate=22050;this.destination={};}
    resume(){resumeCalls++;this.state='running';return Promise.resolve();}
    createBuffer(){return {duration:0};}
    createBufferSource(){
      const s={buffer:null,onended:null,connect(){},stop(){},start(){bufferStarts++;queueMicrotask(()=>s.onended?.());}};
      return s;
    }
    createGain(){return {gain:{value:1},connect(){}};}
    decodeAudioData(_bytes,ok){decoded++;const b={duration:0.05};queueMicrotask(()=>ok(b));return undefined;}
  }
  globalThis.Audio=FakeAudio;
  globalThis.AudioContext=FakeContext;
  globalThis.webkitAudioContext=undefined;
  const neural={ready:true,preparing:false,lastError:'',prepare:async()=>true,synthesize:async()=>new Blob(['RIFFok'],{type:'audio/wav'})};
  try{
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural,useNeuralFrenchVoice:true,voiceReadyTimeoutMs:1,voicePollMs:1});
    assert.equal(a.announce(svc),true);
    assert.ok(resumeCalls>=1,'AudioContext.resume must happen synchronously inside announce/click');
    await new Promise(r=>setTimeout(r,50));
    assert.ok(decoded>=2,'Piper WAVs must be decoded by the already-unlocked context');
    assert.ok(bufferStarts>=3,'one silent unlock + neural buffer sources must start');
    assert.equal(mediaPlayed.some(x=>String(x).startsWith('blob:')),false,'neural chunks should not need a fresh HTMLAudio autoplay decision');
  }finally{
    restoreSpeech(); globalThis.Audio=oldAudio; globalThis.AudioContext=oldAC; globalThis.webkitAudioContext=oldWAC;
  }
});

test('HOTFIX74 explicitly downloads a Piper model before the warm prediction when API supports it', async()=>{
  const calls=[];
  const p=new PiperFrenchNeuralVoice({
    moduleLoader:async()=>({
      download:async id=>{calls.push(['download',id]);},
      predict:async args=>{calls.push(['predict',args.voiceId,args.text]);return new Blob(['wav']);},
    }),
    prepareTimeoutMs:2000,initialPredictTimeoutMs:2000,predictTimeoutMs:2000,
  });
  assert.equal(await p.prepare(),true);
  assert.deepEqual(calls[0],['download','fr_FR-siwis-low']);
  assert.deepEqual(calls[1],['predict','fr_FR-siwis-low','gare']);
});

test('HOTFIX74 shipped bundle contains forced-audio path and index cache is bumped', async()=>{
  const fs=await import('node:fs');
  const path=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const here=path.dirname(fileURLToPath(import.meta.url));
  const root=path.resolve(here,'../..');
  const bundle=fs.readFileSync(path.join(root,'js/rail-empire.file.bundle.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(bundle,/_unlockAudioFromGesture\(\)/);
  assert.match(bundle,/_playNeuralViaContextAsync/);
  assert.match(bundle,/PIPER_WEB_MODULE_FALLBACK_URL/);
  assert.match(index,/rail-empire\.file\.bundle\.js\?v=1199repair24&fullaudit=1/);
});
