// French train station announcements using the server-side TTS (fr_FR tom)
// with a browser speechSynthesis fallback in French.

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

function _getStops(svc) {
  if (typeof svc.getCurrentStops === "function") return svc.getCurrentStops();
  return (svc.isReturnLeg ? svc.returnStops : svc.stops) || [];
}

function _stationName(world, stationId) {
  if (!stationId) return "";
  const st = world?.getStationById?.(stationId);
  return st?.name || "";
}

function _originName(svc, world) {
  const stops = _getStops(svc);
  if (!stops.length) return "";
  return _stationName(world, stops[0].stationId);
}

function _destinationName(svc, world) {
  const stops = _getStops(svc);
  if (!stops.length) return "";
  for (let i = stops.length - 1; i >= 0; i--) {
    const name = _stationName(world, stops[i].stationId);
    if (name) return name;
  }
  return "";
}

function _nextStopName(svc, world) {
  const stops = _getStops(svc);
  if (!stops.length) return "";
  let idx = Math.max(0, svc.currentStopIndex || 0);
  if (svc.state === "stopped_at_station" && idx < stops.length - 1) idx += 1;
  for (let i = idx; i < stops.length; i++) {
    const name = _stationName(world, stops[i].stationId);
    if (name) return name;
  }
  return "";
}

function _formatDelay(delayMin) {
  const min = Math.round(Number.isFinite(delayMin) ? delayMin : 0);
  if (min >= 2) return `avec ${min} minutes de retard`;
  if (min === 1) return `avec ${min} minute de retard`;
  if (min <= -2) return `avec ${Math.abs(min)} minutes d'avance`;
  if (min === -1) return `avec ${Math.abs(min)} minute d'avance`;
  return "à l'heure";
}

function _pickFrenchVoice() {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices() || [];
  const french = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("fr"));
  if (!french.length) return null;
  const male = french.find(v => /male|homme|thomas|tom|louis|paul|maxim|hugo|gilles/i.test(`${v.name} ${v.voiceURI}`));
  return male || french[0];
}

function _browserSpeak(text) {
  if (typeof speechSynthesis === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  const voice = _pickFrenchVoice();
  if (voice) u.voice = voice;
  u.pitch = 1.0;
  u.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function _buildAnnouncement(svc, world) {
  if (!svc || !svc.train) return "";
  const name = svc.train.name || svc.name || "train";
  const origin = _originName(svc, world);
  const destination = _destinationName(svc, world);
  const nextStop = _nextStopName(svc, world);
  const delayPhrase = _formatDelay(svc.delay);

  if (svc.cancelled) {
    return `Le train ${name} en provenance de ${origin || 'inconnue'} et à destination de ${destination || 'inconnue'} est supprimé.`;
  }

  const parts = [`Le train ${name}`];
  if (origin) parts.push(`en provenance de ${origin}`);
  if (destination) parts.push(`à destination de ${destination}`);
  if (nextStop && nextStop !== destination) parts.push(`prochain arrêt ${nextStop}`);
  parts.push(`arrivée prévue ${delayPhrase}`);
  return parts.join(", ") + ".";
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
