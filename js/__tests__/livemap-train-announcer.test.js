import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLivemapAnnouncement,
  joinFrenchList,
  normalizeStationForSpeech,
  LivemapTrainAnnouncer,
} from '../livemap-train-announcer.js';

const stations = new Map([
  ['A', { id: 'A', name: 'Paris Nord' }],
  ['B', { id: 'B', name: 'Aulnay-sous-Bois' }],
  ['C', { id: 'C', name: 'Mitry — Claye' }],
  ['D', { id: 'D', name: 'Köln Hbf' }],
]);
const world = { getStationById: id => stations.get(id) || null };
const stops = [
  { stationId: 'A', type: 'arret' },
  { stationId: 'B', type: 'arret' },
  { stationId: 'X', locationName: 'VIA technique', type: 'waypoint' },
  { stationId: 'C', type: 'arret' },
  { stationId: 'D', type: 'arret' },
];

test('builds RER-B-style announcement with arbitrary future RE stations', () => {
  const svc = { state: 'moving', currentStopIndex: 1, getCurrentStops: () => stops };
  const a = buildLivemapAnnouncement(svc, world);
  assert.equal(a.destination, 'Köln Hbf');
  assert.deepEqual(a.futureStops, ['Aulnay-sous-Bois', 'Mitry — Claye', 'Köln Hbf']);
  assert.match(a.text, /^Attention\. Ce train a pour destination Köln Hauptbahnhof\./);
  assert.match(a.text, /Il s'arrêtera en gare de Aulnay-sous-Bois, Mitry — Claye et Köln Hauptbahnhof\.$/);
  assert.doesNotMatch(a.text, /VIA technique/);
});

test('predeparture excludes origin from served station list', () => {
  const svc = { state: 'waiting', currentStopIndex: 0, getCurrentStops: () => stops };
  const a = buildLivemapAnnouncement(svc, world);
  assert.deepEqual(a.futureStops, ['Aulnay-sous-Bois', 'Mitry — Claye', 'Köln Hbf']);
});

test('stopped service announces next stops because arrival already increments currentStopIndex', () => {
  const svc = { state: 'stopped_at_station', currentStopIndex: 2, getCurrentStops: () => stops };
  const a = buildLivemapAnnouncement(svc, world);
  assert.deepEqual(a.futureStops, ['Mitry — Claye', 'Köln Hbf']);
});

test('terminus click still produces a complete sentence', () => {
  const svc = { state: 'stopped_at_station', currentStopIndex: stops.length, getCurrentStops: () => stops };
  const a = buildLivemapAnnouncement(svc, world);
  assert.deepEqual(a.futureStops, ['Köln Hbf']);
  assert.match(a.text, /Il s'arrêtera en gare de Köln Hauptbahnhof\.$/);
});

test('French list grammar', () => {
  assert.equal(joinFrenchList(['A']), 'A');
  assert.equal(joinFrenchList(['A', 'B']), 'A et B');
  assert.equal(joinFrenchList(['A', 'B', 'C']), 'A, B et C');
});

test('station pronunciation normalizes common German railway abbreviations', () => {
  assert.equal(normalizeStationForSpeech('Frankfurt (Main) Hbf'), 'Frankfurt (Main) Hauptbahnhof');
  assert.equal(normalizeStationForSpeech('Basel SBB'), 'Basel SBB');
});

test('announcer cancels previous speech and queues short chunks on click', async () => {
  const spoken = [];
  let cancelCount = 0;
  class FakeUtterance {
    constructor(text) { this.text = text; }
  }
  const oldSynth = globalThis.speechSynthesis;
  const oldU = globalThis.SpeechSynthesisUtterance;
  globalThis.speechSynthesis = {
    getVoices: () => [{ name: 'Microsoft Hortense', lang: 'fr-FR', localService: true }],
    addEventListener: () => {},
    cancel: () => { cancelCount++; },
    speak: u => { spoken.push(u); queueMicrotask(() => u.onend?.()); },
  };
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  try {
    const announcer = new LivemapTrainAnnouncer({ world });
    const svc = { id: 'T1', state: 'moving', currentStopIndex: 1, getCurrentStops: () => stops };
    assert.equal(announcer.announce(svc), true);
    await new Promise(r => setTimeout(r, 15));
    assert.equal(cancelCount, 1);
    assert.ok(spoken.length >= 5);
    assert.equal(spoken[0].text, 'Attention.');
    assert.equal(spoken[1].text, 'Ce train a pour destination');
    assert.ok(spoken.some(u => /Köln Hauptbahnhof/.test(u.text)));
    assert.ok(spoken.some(u => /arrêtera en gare de/.test(u.text)));
    assert.equal(spoken[0].lang, 'fr-FR');
  } finally {
    globalThis.speechSynthesis = oldSynth;
    globalThis.SpeechSynthesisUtterance = oldU;
  }
});

test('browser hybrid uses recorded RER-B fixed phrases and TTS only for dynamic station names', async () => {
  const spoken = [];
  const played = [];
  class FakeUtterance {
    constructor(text) { this.text = text; this.onend = null; this.onerror = null; }
  }
  class FakeAudio {
    constructor(src) { this.src = src; this.onended = null; this.onerror = null; this.volume = 1; }
    play() { played.push(this.src); queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    pause() {}
  }
  const oldSynth = globalThis.speechSynthesis;
  const oldU = globalThis.SpeechSynthesisUtterance;
  const oldAudio = globalThis.Audio;
  globalThis.speechSynthesis = {
    getVoices: () => [{ name: 'Microsoft Hortense', lang: 'fr-FR', localService: true }],
    addEventListener: () => {},
    cancel: () => {},
    speak: u => { spoken.push(u.text); queueMicrotask(() => u.onend?.()); },
  };
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  globalThis.Audio = FakeAudio;
  try {
    const announcer = new LivemapTrainAnnouncer({ world });
    const svc = { id: 'T2', state: 'moving', currentStopIndex: 1, getCurrentStops: () => stops };
    assert.equal(announcer.announce(svc), true);
    await new Promise(r => setTimeout(r, 15));
    assert.deepEqual(played, [
      'audio/siv/rerb_attention.wav',
      'audio/siv/rerb_destination_prefix.wav',
      'audio/siv/rerb_stops_prefix.wav',
    ]);
    assert.match(spoken[0], /^Köln Hauptbahnhof\.$/);
    assert.match(spoken.at(-1), /Aulnay-sous-Bois, Mitry — Claye et Köln Hauptbahnhof\.$/);
    assert.equal(spoken.some(t => /^Attention/.test(t)), false, 'fixed Attention must come from recorded audio');
  } finally {
    globalThis.speechSynthesis = oldSynth;
    globalThis.SpeechSynthesisUtterance = oldU;
    globalThis.Audio = oldAudio;
  }
});

test('English-only exposed voice no longer aborts the SIV; fallback is language-directed fr-FR', async () => {
  const spoken=[];
  const played=[];
  class FakeUtterance { constructor(text){ this.text=text; this.onend=null; this.onerror=null; } }
  class FakeAudio {
    constructor(src){ this.src=src; this.onended=null; this.onerror=null; this.volume=1; }
    play(){ played.push(this.src); queueMicrotask(()=>this.onended?.()); return Promise.resolve(); }
    pause(){}
  }
  const oldSynth=globalThis.speechSynthesis;
  const oldU=globalThis.SpeechSynthesisUtterance;
  const oldAudio=globalThis.Audio;
  globalThis.speechSynthesis={
    getVoices:()=>[{name:'Google US English',lang:'en-US',localService:false,default:true}],
    addEventListener:()=>{},cancel:()=>{},resume:()=>{},speak:u=>{spoken.push(u); queueMicrotask(()=>u.onend?.());},
  };
  globalThis.SpeechSynthesisUtterance=FakeUtterance;
  globalThis.Audio=FakeAudio;
  try{
    const announcer=new LivemapTrainAnnouncer({world},{voiceReadyTimeoutMs:20,voicePollMs:5});
    const svc={id:'T-EN',state:'moving',currentStopIndex:1,getCurrentStops:()=>stops};
    assert.equal(announcer.announce(svc),true);
    await new Promise(r=>setTimeout(r,80));
    assert.deepEqual(played, [
      'audio/siv/rerb_attention.wav',
      'audio/siv/rerb_destination_prefix.wav',
      'audio/siv/rerb_stops_prefix.wav',
    ]);
    assert.ok(spoken.length >= 2, 'dynamic names must be attempted instead of aborting after Attention');
    assert.ok(spoken.every(u => u.lang === 'fr-FR' || u.lang === 'de-DE'), 'fallback must request the language of the spoken station');
    assert.ok(spoken.every(u => !u.voice), 'the explicit English voice must never be assigned');
  }finally{
    globalThis.speechSynthesis=oldSynth;
    globalThis.SpeechSynthesisUtterance=oldU;
    globalThis.Audio=oldAudio;
  }
});

test('English voice appearing first is ignored until a delayed French voice is available', async () => {
  const spoken=[];
  const played=[];
  let polls=0;
  class FakeUtterance { constructor(text){ this.text=text; this.onend=null; this.onerror=null; } }
  class FakeAudio {
    constructor(src){ this.src=src; this.onended=null; this.onerror=null; this.volume=1; }
    play(){ played.push(this.src); queueMicrotask(()=>this.onended?.()); return Promise.resolve(); }
    pause(){}
  }
  const oldSynth=globalThis.speechSynthesis;
  const oldU=globalThis.SpeechSynthesisUtterance;
  const oldAudio=globalThis.Audio;
  globalThis.speechSynthesis={
    getVoices:()=>{
      polls++;
      if (polls < 4) return [{name:'Google US English',lang:'en-US',localService:false,default:true}];
      return [
        {name:'Google US English',lang:'en-US',localService:false,default:true},
        {name:'Microsoft Hortense',lang:'fr-FR',localService:true,default:false},
      ];
    },
    addEventListener:()=>{},cancel:()=>{},resume:()=>{},
    speak:u=>{spoken.push(u); queueMicrotask(()=>u.onend?.());},
  };
  globalThis.SpeechSynthesisUtterance=FakeUtterance;
  globalThis.Audio=FakeAudio;
  try{
    const announcer=new LivemapTrainAnnouncer({world},{voiceReadyTimeoutMs:100,voicePollMs:5});
    const svc={id:'T-EN-THEN-FR',state:'moving',currentStopIndex:1,getCurrentStops:()=>stops};
    assert.equal(announcer.announce(svc),true);
    await new Promise(r=>setTimeout(r,70));
    assert.ok(played.includes('audio/siv/rerb_attention.wav'));
    assert.ok(played.includes('audio/siv/rerb_destination_prefix.wav'));
    assert.ok(spoken.length >= 2);
    assert.ok(spoken.every(u=>u.voice?.lang === 'fr-FR'), 'every dynamic chunk must use the explicit French voice');
    assert.ok(spoken.every(u=>u.lang === 'fr-FR'));
  }finally{
    globalThis.speechSynthesis=oldSynth;
    globalThis.SpeechSynthesisUtterance=oldU;
    globalThis.Audio=oldAudio;
  }
});

test('failed recorded audio falls back to French TTS instead of muting the announcement', async () => {
  const spoken=[];
  class FakeUtterance { constructor(text){ this.text=text; this.onend=null; this.onerror=null; } }
  class FailingAudio {
    constructor(src){ this.src=src; this.onended=null; this.onerror=null; this.volume=1; }
    play(){ queueMicrotask(()=>this.onerror?.()); return Promise.reject(new Error('decoder/file failure')); }
    pause(){}
  }
  const oldSynth=globalThis.speechSynthesis;
  const oldU=globalThis.SpeechSynthesisUtterance;
  const oldAudio=globalThis.Audio;
  globalThis.speechSynthesis={
    getVoices:()=>[{name:'Microsoft Hortense',lang:'fr-FR',localService:true}],
    addEventListener:()=>{},cancel:()=>{},resume:()=>{},
    speak:u=>{ spoken.push(u.text); queueMicrotask(()=>u.onend?.()); },
  };
  globalThis.SpeechSynthesisUtterance=FakeUtterance;
  globalThis.Audio=FailingAudio;
  try{
    const announcer=new LivemapTrainAnnouncer({world},{voiceReadyTimeoutMs:20,voicePollMs:5});
    const svc={id:'T-AUDIOFAIL',state:'moving',currentStopIndex:1,getCurrentStops:()=>stops};
    assert.equal(announcer.announce(svc),true);
    await new Promise(r=>setTimeout(r,40));
    assert.ok(spoken.includes('Attention.'), 'Attention must fall back to TTS');
    assert.ok(spoken.some(x=>/Ce train a pour destination/.test(x)), 'destination prefix must fall back to TTS');
    assert.ok(spoken.some(x=>/Köln Hauptbahnhof/.test(x)), 'dynamic destination must still be spoken');
    assert.ok(spoken.some(x=>/arrêtera en gare de/.test(x)), 'stops prefix must fall back to TTS');
  }finally{
    globalThis.speechSynthesis=oldSynth;
    globalThis.SpeechSynthesisUtterance=oldU;
    globalThis.Audio=oldAudio;
  }
});

test('delayed Chromium voice list is awaited while recorded Attention is already playing', async () => {
  const spoken=[];
  const played=[];
  let voicePolls=0;
  class FakeUtterance { constructor(text){ this.text=text; this.onend=null; this.onerror=null; } }
  class FakeAudio {
    constructor(src){ this.src=src; this.onended=null; this.onerror=null; this.volume=1; }
    play(){ played.push(this.src); queueMicrotask(()=>this.onended?.()); return Promise.resolve(); }
    pause(){}
  }
  const oldSynth=globalThis.speechSynthesis;
  const oldU=globalThis.SpeechSynthesisUtterance;
  const oldAudio=globalThis.Audio;
  globalThis.speechSynthesis={
    getVoices:()=>{
      voicePolls++;
      return voicePolls >= 4 ? [{name:'Microsoft Hortense',lang:'fr-FR',localService:true}] : [];
    },
    addEventListener:()=>{},cancel:()=>{},
    speak:u=>{ spoken.push(u.text); queueMicrotask(()=>u.onend?.()); },
  };
  globalThis.SpeechSynthesisUtterance=FakeUtterance;
  globalThis.Audio=FakeAudio;
  try{
    const announcer=new LivemapTrainAnnouncer({world},{voiceReadyTimeoutMs:100,voicePollMs:5});
    const svc={id:'T-LATE',state:'moving',currentStopIndex:1,getCurrentStops:()=>stops};
    assert.equal(announcer.announce(svc),true);
    await new Promise(r=>setTimeout(r,60));
    assert.equal(played[0],'audio/siv/rerb_attention.wav');
    assert.ok(played.includes('audio/siv/rerb_destination_prefix.wav'));
    assert.ok(played.includes('audio/siv/rerb_stops_prefix.wav'));
    assert.match(spoken[0],/^Köln Hauptbahnhof\.$/);
    assert.equal(announcer.voice.lang,'fr-FR');
  }finally{
    globalThis.speechSynthesis=oldSynth;
    globalThis.SpeechSynthesisUtterance=oldU;
    globalThis.Audio=oldAudio;
  }
});
