import test from 'node:test';
import assert from 'node:assert/strict';
import { ActiveService, ScheduleCreator } from '../schedule-creator.js';
import { LivemapTrainAnnouncer } from '../livemap-train-announcer.js';

test('HOTFIX69: an origin stop incident is excluded from station-wide departure priority', () => {
  const manager = {
    _rameUsage: new Map(),
    _stationPriority: new Map(),
  };
  const blocked = {
    id: 'INCIDENT-ORIGIN',
    _v2OccurrenceId: null,
    rameId: null,
    serviceType: 'passager',
    state: 'waiting',
    currentStopIndex: 0,
    train: { incident: { effect: 'stop', name: 'Panne au départ' } },
    _getCurrentFirstStop: () => ({ stationId: 'PARIS', departureTime: 600 }),
  };
  ScheduleCreator.prototype._addToTickIndexes.call(manager, blocked, 600);
  assert.equal(manager._stationPriority.get('PARIS')?.map?.has('INCIDENT-ORIGIN') ?? false, false);

  const healthy = {
    ...blocked,
    id: 'FOLLOWING-TRAIN',
    train: { incident: null },
    _getCurrentFirstStop: () => ({ stationId: 'PARIS', departureTime: 602 }),
  };
  ScheduleCreator.prototype._addToTickIndexes.call(manager, healthy, 602);
  assert.equal(manager._stationPriority.get('PARIS')?.map?.has('FOLLOWING-TRAIN'), true);
});

test('HOTFIX69: a stopped follower stays at signal until the leader rear clears departure', () => {
  const fakeFollower = {
    position: { lat: 48, lon: 2 },
    speed: 0,
    train: { decel: 2 },
    _state: { cachedRoute: [{lat:48,lon:2},{lat:48.01,lon:2}], index: 0 },
    getCurrentRoute() { return this._state.cachedRoute; },
    _safetyHorizonKm() { return 2; },
    _findPhysicalLeader() {
      return {
        rearGapKm: 0.08,
        leaderSpeedKmh: 25,
        tailClearingDeparture: true,
      };
    },
  };
  assert.equal(ActiveService.prototype._proximityBlockCheck.call(fakeFollower, [{}]), 0);

  fakeFollower._findPhysicalLeader = () => ({
    rearGapKm: 0.08,
    leaderSpeedKmh: 25,
    tailClearingDeparture: false,
  });
  const released = ActiveService.prototype._proximityBlockCheck.call(fakeFollower, [{}]);
  assert.notEqual(released, 0, 'once the rear has cleared, normal continuous regulation may release the follower');
});

test('HOTFIX69: cold Piper startup continues after Attention instead of aborting at the 5 s fast timeout', async () => {
  const played = [];
  const neuralTexts = [];
  const oldAudio = globalThis.Audio;
  const oldSynth = globalThis.speechSynthesis;
  const oldU = globalThis.SpeechSynthesisUtterance;

  class FakeAudio {
    constructor(src) { this.src = src; this.onended = null; this.onerror = null; this.volume = 1; }
    play() { played.push(this.src); queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    pause() {}
  }
  globalThis.Audio = FakeAudio;
  globalThis.speechSynthesis = {
    getVoices: () => [{ name: 'Google US English', lang: 'en-US', default: true }],
    addEventListener: () => {}, cancel: () => {}, resume: () => {}, speak: () => {},
  };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

  const stations = new Map([
    ['A', { id:'A', name:'Paris Nord' }],
    ['B', { id:'B', name:'Aulnay-sous-Bois' }],
    ['C', { id:'C', name:'Mitry — Claye' }],
  ]);
  const world = { getStationById: id => stations.get(id) || null };
  const stops = [
    { stationId:'A', type:'arret' },
    { stationId:'B', type:'arret' },
    { stationId:'C', type:'arret' },
  ];
  const svc = { id:'COLD-PIPER', state:'moving', currentStopIndex:1, getCurrentStops:() => stops };
  const neural = {
    ready: false,
    preparing: false,
    lastError: '',
    async prepare() {
      this.preparing = true;
      await new Promise(r => setTimeout(r, 35));
      this.ready = true;
      this.preparing = false;
      return true;
    },
    async synthesize(text) {
      neuralTexts.push(text);
      return new Blob(['RIFFfake'], { type:'audio/wav' });
    },
  };

  try {
    const announcer = new LivemapTrainAnnouncer({ world }, {
      neuralTts: neural,
      useNeuralFrenchVoice: true,
      neuralReadyTimeoutMs: 5,
      neuralFirstUseWaitMs: 150,
      voiceReadyTimeoutMs: 5,
      voicePollMs: 1,
    });
    assert.equal(announcer.announce(svc), true);
    await new Promise(r => setTimeout(r, 90));
    assert.ok(played.includes('audio/siv/rerb_attention.wav'));
    assert.ok(played.includes('audio/siv/rerb_destination_prefix.wav'), 'announcement must continue after Attention');
    assert.ok(played.includes('audio/siv/rerb_stops_prefix.wav'));
    assert.deepEqual(neuralTexts, ['Mitry — Claye.', 'Aulnay-sous-Bois et Mitry — Claye.']);
  } finally {
    globalThis.Audio = oldAudio;
    globalThis.speechSynthesis = oldSynth;
    globalThis.SpeechSynthesisUtterance = oldU;
  }
});
