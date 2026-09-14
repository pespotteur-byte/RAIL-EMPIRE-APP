# Rail Empire v1.1.99 — HOTFIX75 Audio root-cause audit

## Symptom confirmed
The user hears the local recorded `Attention` phrase, then silence.

## What was checked
- The three local WAV phrases are valid and non-empty.
- `index.html` loads the FILE bundle that contains the announcer.
- `UI.selectService()` reaches a single `LivemapTrainAnnouncer.announce()` path.
- No competing global speech subsystem repeatedly cancels the LiveMap SIV.
- HOTFIX74's autoplay/WebAudio unlock is useful, but it occurs downstream of the real stop condition.

## Root cause 1 — deterministic early return after `Attention`
HOTFIX74 tried to choose the dynamic voice engine immediately after the recorded
`Attention`. If Piper was unavailable/not ready and Chromium exposed no explicit
French voice, the hard language lock ended `_runHybrid()` before the recorded
`rerb_destination_prefix.wav` was even played.

That branch exactly explains the field symptom: local `Attention` succeeds, then
nothing else is attempted.

## Root cause 2 — OPFS was incorrectly treated as mandatory
Piper's browser library uses OPFS as a model cache, but its model fetch path can
continue when OPFS read/write fails. Rail Empire must therefore not disable Piper
merely because `navigator.storage.getDirectory()` is unavailable on a `file://`
launch.

HOTFIX75 treats OPFS as optional cache only. When unavailable, explicit prefetch is
skipped so the model is not downloaded twice; inference still gets one normal
network/model attempt.

## Root cause 3 — multilingual Piper singleton collision
The RealTimeX/Mintplex `TtsSession` constructor reuses a static singleton and mutates
its `voiceId`. That is unsafe for Rail Empire, because a French ONNX session must not
be silently reused after switching to a German/Italian/etc. station voice.

HOTFIX75 creates and retains one independently initialized Piper session per voice ID,
serializing creation while temporarily detaching the package singleton.

## HOTFIX75 behavior
1. Fixed phrases progress independently of TTS readiness:
   - Attention
   - destination prefix
   - dynamic destination
   - stops prefix
   - dynamic served stations
2. Piper remains preferred but never gates the sentence.
3. Fallback order for dynamic names:
   - prepared Piper voice for the station locale;
   - explicit system voice from the same language family;
   - BCP-47 language-hinted SpeechSynthesis utterance with no wrong-language voice
     explicitly assigned.
4. HOTFIX74's WebAudio unlock and persistent HTMLAudio recovery path are retained.
5. Runtime diagnostics are exposed through `globalThis.__RAIL_EMPIRE_AUDIO_DIAG__`.
6. No circulation, signaling, reservation, incident, terminus or GPS logic changed.

## QA
- Targeted root-cause/audio/bundle set: 36/36 passing.
- Full npm suite: 102,833 / 102,834 passing.
- Sole failure remains the pre-existing `REG-01/02/04` regulation test.
