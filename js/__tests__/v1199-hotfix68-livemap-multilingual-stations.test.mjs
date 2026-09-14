import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIPER_STATION_VOICES,
  resolveStationSpeechLocale,
  stationVoiceProfile,
  normalizeStationForSpeech,
  buildLivemapAnnouncement,
  LivemapTrainAnnouncer,
} from '../livemap-train-announcer.js';

test('HOTFIX68 resolves core European station languages by country',()=>{
  const cases={
    FR:'fr-FR', DE:'de-DE', AT:'de-DE', IT:'it-IT', ES:'es-ES', PT:'pt-PT',
    NL:'nl-NL', LU:'lb-LU', PL:'pl-PL', CZ:'cs-CZ', SK:'sk-SK', HU:'hu-HU',
    RO:'ro-RO', BG:'bg-BG', GR:'el-GR', SI:'sl-SI', RS:'sr-RS', AL:'sq-AL',
    DK:'da-DK', SE:'sv-SE', NO:'no-NO', FI:'fi-FI', EE:'et-EE', LV:'lv-LV',
    RU:'ru-RU', UA:'uk-UA', TR:'tr-TR', GE:'ka-GE', GB:'en-GB', IE:'en-GB',
    AD:'ca-ES', MC:'fr-FR', LI:'de-DE', SM:'it-IT', VA:'it-IT', MD:'ro-RO',
  };
  for(const [country,locale] of Object.entries(cases)) assert.equal(resolveStationSpeechLocale(country),locale,country);
});


test('HOTFIX68 accepts RE imported country labels as well as ISO codes',()=>{
  const cases={
    'Allemagne':'de-DE', 'Germany':'de-DE', 'Suisse':'de-DE', 'Italie':'it-IT',
    'Espagne':'es-ES', 'Pays-Bas':'nl-NL', 'Pologne':'pl-PL', 'Tchéquie':'cs-CZ',
    'Royaume-Uni':'en-GB', 'Russie':'ru-RU', 'Géorgie':'ka-GE', 'Arménie':'hy-AM',
    'Azerbaïdjan':'az-AZ', 'Biélorussie':'be-BY', 'Macédoine du Nord':'mk-MK',
  };
  for(const [country,locale] of Object.entries(cases)) assert.equal(resolveStationSpeechLocale(country),locale,country);
});

test('HOTFIX68 uses regional languages for Switzerland, Belgium, Catalonia, Basque Country and Wales',()=>{
  assert.equal(resolveStationSpeechLocale('CH',46.21,6.14),'fr-FR'); // Genève
  assert.equal(resolveStationSpeechLocale('CH',47.38,8.54),'de-DE'); // Zürich
  assert.equal(resolveStationSpeechLocale('CH',46.95,7.45),'de-DE'); // Bern
  assert.equal(resolveStationSpeechLocale('CH',46.23,7.36),'fr-FR'); // Sion
  assert.equal(resolveStationSpeechLocale('CH',46.00,8.95),'it-IT'); // Lugano
  assert.equal(resolveStationSpeechLocale('BE',50.63,6.03),'de-DE'); // Eupen / German-speaking east
  assert.equal(resolveStationSpeechLocale('BE',50.45,4.86),'fr-FR');
  assert.equal(resolveStationSpeechLocale('BE',51.03,3.73),'nl-BE');
  assert.equal(resolveStationSpeechLocale('ES',41.39,2.17),'ca-ES');
  assert.equal(resolveStationSpeechLocale('ES',43.26,-2.93),'eu-ES');
  assert.equal(resolveStationSpeechLocale('GB',51.48,-3.18),'cy-GB');
});

test('HOTFIX68 voice registry keeps French on female Siwis and exposes native-language packs',()=>{
  assert.equal(PIPER_STATION_VOICES['fr-FR'].voiceId,'fr_FR-siwis-low');
  assert.equal(PIPER_STATION_VOICES['de-DE'].voiceId,'de_DE-eva_k-x_low');
  assert.equal(PIPER_STATION_VOICES['it-IT'].voiceId,'it_IT-riccardo-x_low');
  assert.equal(PIPER_STATION_VOICES['ru-RU'].voiceId,'ru_RU-irina-medium');
  assert.equal(PIPER_STATION_VOICES['tr-TR'].voiceId,'tr_TR-dfki-medium');
  assert.equal(PIPER_STATION_VOICES['ka-GE'].voiceId,'ka_GE-natia-medium');
  assert.equal(PIPER_STATION_VOICES['hy-AM'].voiceId,'hy_AM-gor-medium');
  assert.equal(PIPER_STATION_VOICES['az-AZ'].voiceId,null);
  assert.equal(stationVoiceProfile('DE').locale,'de-DE');
});

test('HOTFIX68 German station abbreviations are expanded only for speech text, not display name',()=>{
  const stations=new Map([
    ['F',{id:'F',name:'Strasbourg',country:'FR',lat:48.584,lon:7.735}],
    ['K',{id:'K',name:'Karlsruhe Hbf',country:'DE',lat:48.993,lon:8.401}],
    ['M',{id:'M',name:'Mannheim Hbf',country:'DE',lat:49.479,lon:8.469}],
  ]);
  const world={getStationById:id=>stations.get(id)||null};
  const svc={state:'moving',currentStopIndex:1,getCurrentStops:()=>[
    {stationId:'F',type:'arret'},{stationId:'K',type:'arret'},{stationId:'M',type:'arret'},
  ]};
  const a=buildLivemapAnnouncement(svc,world);
  assert.equal(a.destination,'Mannheim Hbf');
  assert.equal(a.destinationSpeech,'Mannheim Hauptbahnhof');
  assert.equal(a.destinationSpeechMeta.locale,'de-DE');
  assert.deepEqual(a.futureStops,['Karlsruhe Hbf','Mannheim Hbf']);
  assert.deepEqual(a.futureStopsSpeech,['Karlsruhe Hauptbahnhof','Mannheim Hauptbahnhof']);
});

function installAudio(played){
  const oldAudio=globalThis.Audio, oldUrl=globalThis.URL;
  globalThis.URL={createObjectURL:()=>`blob:test-${played.length}`,revokeObjectURL:()=>{}};
  globalThis.Audio=class{constructor(src){this.src=src;this.onended=null;this.onerror=null;} play(){played.push(this.src);queueMicrotask(()=>this.onended?.());return Promise.resolve();} pause(){}};
  return ()=>{globalThis.Audio=oldAudio;globalThis.URL=oldUrl;};
}

test('HOTFIX68 cross-border announcement switches station names to German Piper without using an English/French station voice',async()=>{
  const stations=new Map([
    ['P',{id:'P',name:'Paris Est',country:'FR',lat:48.877,lon:2.359}],
    ['S',{id:'S',name:'Saarbrücken Hbf',country:'DE',lat:49.241,lon:6.991}],
    ['F',{id:'F',name:'Frankfurt (Main) Hbf',country:'DE',lat:50.107,lon:8.663}],
  ]);
  const world={getStationById:id=>stations.get(id)||null};
  const svc={id:'X-BORDER',state:'moving',currentStopIndex:1,getCurrentStops:()=>[
    {stationId:'P',type:'arret'},{stationId:'S',type:'arret'},{stationId:'F',type:'arret'},
  ]};
  const neuralCalls=[];
  const neural={
    ready:true, preparing:false, lastError:'',
    isVoiceReady:id=>id==='fr_FR-siwis-low' || id==='de_DE-eva_k-x_low',
    prepare:async()=>true, prepareVoice:async()=>true,
    synthesize:async(text,voiceId='fr_FR-siwis-low')=>{neuralCalls.push({text,voiceId});return new Blob(['RIFF']);},
  };
  const oldSynth=globalThis.speechSynthesis, oldU=globalThis.SpeechSynthesisUtterance;
  globalThis.speechSynthesis={getVoices:()=>[],addEventListener:()=>{},cancel:()=>{},resume:()=>{},speak:()=>{throw new Error('system TTS must not be used');}};
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  const played=[]; const restoreAudio=installAudio(played);
  try{
    const a=new LivemapTrainAnnouncer({world},{neuralTts:neural,useRecordedPhrases:false,voiceReadyTimeoutMs:1,voicePollMs:1});
    assert.equal(a.announce(svc),true);
    await new Promise(r=>setTimeout(r,60));
    assert.ok(neuralCalls.some(x=>x.voiceId==='fr_FR-siwis-low' && /Attention|destination|arrêtera/.test(x.text)));
    const german=neuralCalls.filter(x=>x.voiceId==='de_DE-eva_k-x_low');
    assert.ok(german.some(x=>/Frankfurt \(Main\) Hauptbahnhof/.test(x.text)),JSON.stringify(neuralCalls));
    assert.ok(german.some(x=>/Saarbrücken Hauptbahnhof/.test(x.text)),JSON.stringify(neuralCalls));
  }finally{restoreAudio();globalThis.speechSynthesis=oldSynth;globalThis.SpeechSynthesisUtterance=oldU;}
});

test('HOTFIX75 unsupported neural pack uses a locale hint without assigning a wrong-language voice',async()=>{
  const oldSynth=globalThis.speechSynthesis, oldU=globalThis.SpeechSynthesisUtterance;
  const spoken=[];
  globalThis.speechSynthesis={
    getVoices:()=>[{name:'French',lang:'fr-FR'},{name:'English',lang:'en-US'}],addEventListener:()=>{},cancel:()=>{},resume:()=>{},
    speak:u=>{spoken.push(u);queueMicrotask(()=>u.onend?.());},
  };
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;this.onend=null;this.onerror=null;}};
  const neural={ready:true,isVoiceReady:()=>false,prepare:async()=>true,prepareVoice:async()=>false,synthesize:async()=>{throw new Error('no model');}};
  try{
    const a=new LivemapTrainAnnouncer({world:{}},{neuralTts:neural,voiceReadyTimeoutMs:1,voicePollMs:1});
    a._runToken=7;
    const ok=await a._speakStationMetaAsync({speech:'Vilnius',locale:'lt-LT',voiceId:null},7,'neural');
    assert.equal(ok,true);
    assert.equal(spoken.length,1);
    assert.equal(spoken[0].lang,'lt-LT');
    assert.equal(spoken[0].voice,undefined);
    assert.match(a.lastError,/LANG_HINT_FALLBACK:lt-LT/);
  }finally{globalThis.speechSynthesis=oldSynth;globalThis.SpeechSynthesisUtterance=oldU;}
});
