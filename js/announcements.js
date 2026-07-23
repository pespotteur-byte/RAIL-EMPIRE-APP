// DB-style train announcements using browser Text-to-Speech.

let _voices = [];
let _voicesReady = false;

function _loadVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  _voices = speechSynthesis.getVoices() || [];
  _voicesReady = true;
}

if (typeof speechSynthesis !== 'undefined') {
  _loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = _loadVoices;
  }
}

function _pickDbMaleVoice() {
  if (!_voicesReady) _loadVoices();
  const german = _voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('de'));
  if (!german.length) return null;
  const male = german.find(v => /male|männlich|hans|stefan|maxim|yannick|konrad|killian/i.test(v.name + ' ' + v.voiceURI));
  return male || german[0];
}

function _nextStopName(svc, world) {
  const stops = typeof svc.getCurrentStops === 'function'
    ? svc.getCurrentStops()
    : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
  if (!stops || !stops.length) return '';
  let idx = Math.max(0, svc.currentStopIndex || 0);
  // If the train is currently stopped at idx, the next stop is idx+1.
  if (svc.state === 'stopped_at_station' && idx < stops.length - 1) idx += 1;
  for (let i = idx; i < stops.length; i++) {
    const s = stops[i];
    if (s && s.stationId) {
      const st = world?.getStationById?.(s.stationId);
      if (st?.name) return st.name;
    }
  }
  return '';
}

function _destinationName(svc, world) {
  const stops = typeof svc.getCurrentStops === 'function'
    ? svc.getCurrentStops()
    : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
  if (!stops || !stops.length) return '';
  for (let i = stops.length - 1; i >= 0; i--) {
    const s = stops[i];
    if (s && s.stationId) {
      const st = world?.getStationById?.(s.stationId);
      if (st?.name) return st.name;
    }
  }
  return '';
}

export function announceTrain(svc, world) {
  if (typeof speechSynthesis === 'undefined' || !svc || !svc.train) return;
  const name = svc.train.name || svc.name || 'Zug';
  const nextStop = _nextStopName(svc, world);
  const destination = _destinationName(svc, world);

  let text = '';
  if (svc.cancelled) {
    text = `Zug ${name} fällt heute aus.`;
  } else if (svc.state === 'waiting') {
    const here = svc.train.stoppedAt?.name || nextStop || 'am Bahnsteig';
    text = `Zug ${name} nach ${destination || 'Endbahnhof'} wartet in ${here}.`;
  } else {
    const dest = destination || nextStop || 'Endbahnhof';
    text = `Zug ${name} nach ${dest}.`;
    if (nextStop && nextStop !== dest) {
      text += ` Nächster Halt: ${nextStop}.`;
    }
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  const voice = _pickDbMaleVoice();
  if (voice) u.voice = voice;
  u.pitch = 0.9;
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export function stopAnnouncements() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
