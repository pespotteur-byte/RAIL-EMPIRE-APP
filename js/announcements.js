// DB-style train announcements using a local/nice German TTS voice.

let _currentAudio = null;

function _stopCurrent() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

async function _speakTts(text, speed = 1.0) {
  _stopCurrent();
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("speed", String(speed));
    const res = await fetch("/api/tts", {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _currentAudio = audio;
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return true;
  } catch (e) {
    console.warn("TTS serveur indisponible, fallback navigateur", e);
    return false;
  }
}

function _nextStopName(svc, world) {
  const stops = typeof svc.getCurrentStops === "function"
    ? svc.getCurrentStops()
    : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
  if (!stops || !stops.length) return "";
  let idx = Math.max(0, svc.currentStopIndex || 0);
  if (svc.state === "stopped_at_station" && idx < stops.length - 1) idx += 1;
  for (let i = idx; i < stops.length; i++) {
    const s = stops[i];
    if (s && s.stationId) {
      const st = world?.getStationById?.(s.stationId);
      if (st?.name) return st.name;
    }
  }
  return "";
}

function _destinationName(svc, world) {
  const stops = typeof svc.getCurrentStops === "function"
    ? svc.getCurrentStops()
    : (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
  if (!stops || !stops.length) return "";
  for (let i = stops.length - 1; i >= 0; i--) {
    const s = stops[i];
    if (s && s.stationId) {
      const st = world?.getStationById?.(s.stationId);
      if (st?.name) return st.name;
    }
  }
  return "";
}

function _pickDbMaleVoice() {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices() || [];
  const german = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("de"));
  if (!german.length) return null;
  const male = german.find(v => /male|männlich|thorsten|hans|stefan|maxim|yannick|konrad|killian/i.test(`${v.name} ${v.voiceURI}`));
  return male || german[0];
}

function _browserSpeak(text) {
  if (typeof speechSynthesis === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  const voice = _pickDbMaleVoice();
  if (voice) u.voice = voice;
  u.pitch = 0.9;
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function _buildAnnouncement(svc, world) {
  if (!svc || !svc.train) return "";
  const name = svc.train.name || svc.name || "Zug";
  const nextStop = _nextStopName(svc, world);
  const destination = _destinationName(svc, world);
  if (svc.cancelled) return `Zug ${name} fällt heute aus.`;
  if (svc.state === "waiting") {
    const here = svc.train.stoppedAt?.name || nextStop || "am Bahnsteig";
    const dest = destination || nextStop || "Endbahnhof";
    return `Zug ${name} nach ${dest} wartet in ${here}.`;
  }
  const dest = destination || nextStop || "Endbahnhof";
  let text = `Zug ${name} nach ${dest}.`;
  if (nextStop && nextStop !== dest) {
    text += ` Nächster Halt: ${nextStop}.`;
  }
  return text;
}

export async function announceTrain(svc, world) {
  const text = _buildAnnouncement(svc, world);
  if (!text) return;
  const ok = await _speakTts(text, 1.0);
  if (!ok) _browserSpeak(text);
}

export async function playAnnouncement(text, speed = 1.0) {
  const ok = await _speakTts(text, speed);
  if (!ok) _browserSpeak(text);
}

export function stopAnnouncements() {
  _stopCurrent();
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
