// Livemap train SIV announcement — triggered only by an explicit train click.
// Historical QA contract: failed local WAV/M4A must never silence the whole SIV.
// HOTFIX75: deterministic SIV chain. Recorded phrases never depend on TTS,
// and dynamic names fall back to a language-directed browser utterance when
// neural/system voice discovery is unavailable (notably local file:// builds).
// v1.1.98+: fixed RER-B phrases are real recorded audio and MUST NOT depend on
// SpeechSynthesis being ready. Dynamic station names prefer neural or explicit
// same-language voices, with a BCP-47 language hint as the final forced fallback.
// HOTFIX68 — local neural French voice for dynamic station names.
// The browser downloads the lightweight Siwis model on first preparation and
// caches it in its origin storage when available. The recorded RER-B fixed
// phrases remain local game assets; Piper is used only for dynamic text.
export const PIPER_FRENCH_VOICE_ID = 'fr_FR-siwis-low';
export const PIPER_WEB_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@realtimex/piper-tts-web@1.1.1/+esm';
// HOTFIX75 — maintained fork with newer ONNX runtime/CDN handling. Keep one
// independent ESM endpoint and the former Mintplex build only as a last resort.
export const PIPER_WEB_MODULE_FALLBACK_URL = 'https://esm.sh/@realtimex/piper-tts-web@1.1.1?bundle';
export const PIPER_WEB_MODULE_LEGACY_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm';
export const PIPER_STATION_VOICES = Object.freeze({
    'fr-FR': Object.freeze({ voiceId: 'fr_FR-siwis-low', label: 'Siwis', source: 'Piper' }),
    'de-DE': Object.freeze({ voiceId: 'de_DE-eva_k-x_low', label: 'Eva K', source: 'Piper' }),
    'it-IT': Object.freeze({ voiceId: 'it_IT-riccardo-x_low', label: 'Riccardo', source: 'Piper' }),
    'es-ES': Object.freeze({ voiceId: 'es_ES-carlfm-x_low', label: 'Carl FM', source: 'Piper' }),
    'ca-ES': Object.freeze({ voiceId: 'ca_ES-upc_ona-x_low', label: 'UPC Ona', source: 'Piper' }),
    'eu-ES': Object.freeze({ voiceId: 'eu_ES-maider-medium', label: 'Maider', source: 'Piper' }),
    'en-GB': Object.freeze({ voiceId: 'en_GB-alba-medium', label: 'Alba', source: 'Piper' }),
    'cy-GB': Object.freeze({ voiceId: 'cy_GB-bu_tts-medium', label: 'BU TTS', source: 'Piper' }),
    'ru-RU': Object.freeze({ voiceId: 'ru_RU-irina-medium', label: 'Irina', source: 'Piper' }),
    'uk-UA': Object.freeze({ voiceId: 'uk_UA-ukrainian_tts-medium', label: 'Ukrainian TTS', source: 'Piper' }),
    'ro-RO': Object.freeze({ voiceId: 'ro_RO-mihai-medium', label: 'Mihai', source: 'Piper' }),
    'hu-HU': Object.freeze({ voiceId: 'hu_HU-berta-medium', label: 'Berta', source: 'Piper' }),
    'nl-NL': Object.freeze({ voiceId: 'nl_NL-mls_5809-low', label: 'MLS 5809', source: 'Piper' }),
    'nl-BE': Object.freeze({ voiceId: 'nl_BE-nathalie-x_low', label: 'Nathalie', source: 'Piper' }),
    'cs-CZ': Object.freeze({ voiceId: 'cs_CZ-kasandra-medium', label: 'Kasandra', source: 'Piper' }),
    'no-NO': Object.freeze({ voiceId: 'no_NO-talesyntese-medium', label: 'Talesyntese', source: 'Piper' }),
    'fi-FI': Object.freeze({ voiceId: 'fi_FI-harri-low', label: 'Harri', source: 'Piper' }),
    'da-DK': Object.freeze({ voiceId: 'da_DK-talesyntese-medium', label: 'Talesyntese', source: 'Piper' }),
    'pl-PL': Object.freeze({ voiceId: 'pl_PL-mls_6892-low', label: 'MLS 6892', source: 'Piper' }),
    'et-EE': Object.freeze({ voiceId: 'et_EE-news-medium', label: 'News', source: 'Piper' }),
    'lv-LV': Object.freeze({ voiceId: 'lv_LV-aivars-medium', label: 'Aivars', source: 'Piper' }),
    'sv-SE': Object.freeze({ voiceId: 'sv_SE-alma-medium', label: 'Alma', source: 'Piper' }),
    'lb-LU': Object.freeze({ voiceId: 'lb_LU-marylux-medium', label: 'Marylux', source: 'Piper' }),
    'sk-SK': Object.freeze({ voiceId: 'sk_SK-lili-medium', label: 'Lili', source: 'Piper' }),
    'pt-PT': Object.freeze({ voiceId: 'pt_PT-tugão-medium', label: 'Tugão', source: 'Piper' }),
    'sl-SI': Object.freeze({ voiceId: 'sl_SI-artur-medium', label: 'Artur', source: 'Piper' }),
    'sq-AL': Object.freeze({ voiceId: 'sq_AL-edon-medium', label: 'Edon', source: 'Piper' }),
    'sr-RS': Object.freeze({ voiceId: 'sr_RS-serbski_institut-medium', label: 'Serbski Institut', source: 'Piper' }),
    'bg-BG': Object.freeze({ voiceId: 'bg_BG-dimitar-medium', label: 'Dimitar', source: 'Piper' }),
    'el-GR': Object.freeze({ voiceId: 'el_GR-rapunzelina-medium', label: 'Rapunzelina', source: 'Piper' }),
    'is-IS': Object.freeze({ voiceId: 'is_IS-ugla-medium', label: 'Ugla', source: 'Piper' }),
    'tr-TR': Object.freeze({ voiceId: 'tr_TR-dfki-medium', label: 'DFKI', source: 'Piper' }),
    'ka-GE': Object.freeze({ voiceId: 'ka_GE-natia-medium', label: 'Natia', source: 'Piper' }),
    'hy-AM': Object.freeze({ voiceId: 'hy_AM-gor-medium', label: 'Gor', source: 'Piper' }),
    'az-AZ': Object.freeze({ voiceId: null, label: 'System Azerbaijani', source: 'system' }),
    // Exact Piper voices are not available in the current official voice pack.
    // System TTS is allowed only when it matches these exact language families.
    'lt-LT': Object.freeze({ voiceId: null, label: 'System Lithuanian', source: 'system' }),
    'hr-HR': Object.freeze({ voiceId: null, label: 'System Croatian', source: 'system' }),
    'bs-BA': Object.freeze({ voiceId: null, label: 'System Bosnian', source: 'system' }),
    'mk-MK': Object.freeze({ voiceId: null, label: 'System Macedonian', source: 'system' }),
    'be-BY': Object.freeze({ voiceId: null, label: 'System Belarusian', source: 'system' }),
    'sr-ME': Object.freeze({ voiceId: null, label: 'System Montenegrin/Serbian', source: 'system' }),
});
const COUNTRY_DEFAULT_LOCALES = Object.freeze({
    AL: 'sq-AL', AM: 'hy-AM', AT: 'de-DE', AZ: 'az-AZ', BA: 'bs-BA', BG: 'bg-BG', BY: 'be-BY', CZ: 'cs-CZ', DE: 'de-DE', DK: 'da-DK',
    EE: 'et-EE', ES: 'es-ES', FI: 'fi-FI', FR: 'fr-FR', GB: 'en-GB', HR: 'hr-HR', HU: 'hu-HU', IT: 'it-IT',
    LT: 'lt-LT', LU: 'lb-LU', LV: 'lv-LV', ME: 'sr-ME', MK: 'mk-MK', NL: 'nl-NL', NO: 'no-NO', NZ: 'en-GB',
    PL: 'pl-PL', PT: 'pt-PT', RO: 'ro-RO', RS: 'sr-RS', RU: 'ru-RU', SE: 'sv-SE', SI: 'sl-SI', SK: 'sk-SK', UA: 'uk-UA',
    GR: 'el-GR', IS: 'is-IS', IE: 'en-GB', TR: 'tr-TR', GE: 'ka-GE', AD: 'ca-ES', MC: 'fr-FR', LI: 'de-DE', SM: 'it-IT', VA: 'it-IT',
    MD: 'ro-RO', CY: 'el-GR', MT: 'en-GB', XK: 'sq-AL',
});
// Imported/reference stations are not guaranteed to use ISO alpha-2. Some RE
// datasets contain French or English country names, while stations created by
// ORM use ISO codes. Normalize both so a saved "Allemagne" is not accidentally
// pronounced by the French voice.
const COUNTRY_NAME_ALIASES = Object.freeze({
    ALBANIE: 'AL', ALBANIA: 'AL',
    ARMENIE: 'AM', ARMENIA: 'AM',
    AUTRICHE: 'AT', AUSTRIA: 'AT', OSTERREICH: 'AT',
    AZERBAIDJAN: 'AZ', AZERBAIJAN: 'AZ',
    BELGIQUE: 'BE', BELGIUM: 'BE', BELGIE: 'BE', BELGIEN: 'BE',
    BIELORUSSIE: 'BY', BELARUS: 'BY',
    'BOSNIE-HERZEGOVINE': 'BA', 'BOSNIA-HERZEGOVINA': 'BA', 'BOSNIA AND HERZEGOVINA': 'BA',
    BULGARIE: 'BG', BULGARIA: 'BG',
    CHYPRE: 'CY', CYPRUS: 'CY',
    CROATIE: 'HR', CROATIA: 'HR',
    TCHEQUIE: 'CZ', CZECHIA: 'CZ', 'CZECH REPUBLIC': 'CZ',
    DANEMARK: 'DK', DENMARK: 'DK',
    ALLEMAGNE: 'DE', GERMANY: 'DE', DEUTSCHLAND: 'DE',
    ESPAGNE: 'ES', SPAIN: 'ES', ESPANA: 'ES',
    ESTONIE: 'EE', ESTONIA: 'EE',
    FINLANDE: 'FI', FINLAND: 'FI',
    FRANCE: 'FR',
    GEORGIE: 'GE', GEORGIA: 'GE',
    GRECE: 'GR', GREECE: 'GR', HELLAS: 'GR',
    HONGRIE: 'HU', HUNGARY: 'HU',
    IRLANDE: 'IE', IRELAND: 'IE',
    ISLANDE: 'IS', ICELAND: 'IS',
    ITALIE: 'IT', ITALY: 'IT', ITALIA: 'IT',
    KOSOVO: 'XK',
    LETTONIE: 'LV', LATVIA: 'LV',
    LIECHTENSTEIN: 'LI',
    LITUANIE: 'LT', LITHUANIA: 'LT',
    LUXEMBOURG: 'LU',
    'MACEDOINE DU NORD': 'MK', 'NORTH MACEDONIA': 'MK',
    MALTE: 'MT', MALTA: 'MT',
    MOLDAVIE: 'MD', MOLDOVA: 'MD',
    MONACO: 'MC',
    MONTENEGRO: 'ME',
    NORVEGE: 'NO', NORWAY: 'NO',
    'PAYS-BAS': 'NL', NETHERLANDS: 'NL', NEDERLAND: 'NL',
    POLOGNE: 'PL', POLAND: 'PL', POLSKA: 'PL',
    PORTUGAL: 'PT',
    ROUMANIE: 'RO', ROMANIA: 'RO',
    'ROYAUME-UNI': 'GB', 'UNITED KINGDOM': 'GB', 'GREAT BRITAIN': 'GB',
    RUSSIE: 'RU', RUSSIA: 'RU', 'RUSSIAN FEDERATION': 'RU',
    'SAINT-MARIN': 'SM', 'SAN MARINO': 'SM',
    SERBIE: 'RS', SERBIA: 'RS',
    SLOVAQUIE: 'SK', SLOVAKIA: 'SK',
    SLOVENIE: 'SI', SLOVENIA: 'SI',
    SUEDE: 'SE', SWEDEN: 'SE',
    SUISSE: 'CH', SWITZERLAND: 'CH', SCHWEIZ: 'CH', SVIZZERA: 'CH',
    TURQUIE: 'TR', TURKEY: 'TR', TURKIYE: 'TR',
    UKRAINE: 'UA',
    VATICAN: 'VA',
    ANDORRE: 'AD', ANDORRA: 'AD',
    'NOUVELLE-ZELANDE': 'NZ', 'NEW ZEALAND': 'NZ',
});
function normalizeCountryCode(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    const upper = raw.toUpperCase();
    if (/^[A-Z]{2}$/.test(upper))
        return upper;
    const key = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
    return COUNTRY_NAME_ALIASES[key] || upper;
}
function normLang(value) { return String(value || '').trim().replace(/_/g, '-'); }
function langFamily(value) { return normLang(value).toLowerCase().split('-')[0] || ''; }
export function resolveStationSpeechLocale(country, lat = null, lon = null, name = '') {
    const c = normalizeCountryCode(country);
    const y = lat == null || lat === '' ? NaN : Number(lat);
    const x = lon == null || lon === '' ? NaN : Number(lon);
    // Switzerland: coarse language geography tuned around the rail network.
    // French: Romandie + lower Valais. Italian: Ticino/southern area. German elsewhere.
    if (c === 'CH') {
        if (Number.isFinite(y) && Number.isFinite(x) && y < 46.68 && x > 8.15)
            return 'it-IT';
        if (Number.isFinite(y) && Number.isFinite(x) && ((x < 7.25) || (y < 46.45 && x < 7.78)))
            return 'fr-FR';
        return 'de-DE';
    }
    // Belgium: coarse linguistic regions; Brussels remains Dutch/French-capable via system fallback.
    if (c === 'BE') {
        if (Number.isFinite(x) && x > 5.85)
            return 'de-DE';
        if (Number.isFinite(y) && y < 50.75)
            return 'fr-FR';
        return 'nl-BE';
    }
    // Spain: improve pronunciation in the two strongest non-Castilian rail regions.
    if (c === 'ES' && Number.isFinite(y) && Number.isFinite(x)) {
        if (y > 42.45 && x > -3.35 && x < -1.45)
            return 'eu-ES';
        if (x > -0.15 && y > 40.45)
            return 'ca-ES';
    }
    // Wales: local Welsh pronunciation where the coordinate is clearly in Wales.
    if (c === 'GB' && Number.isFinite(y) && Number.isFinite(x) && y > 51.25 && y < 53.55 && x < -2.5 && x > -5.5)
        return 'cy-GB';
    return COUNTRY_DEFAULT_LOCALES[c] || 'fr-FR';
}
export function stationVoiceProfile(country, lat = null, lon = null, name = '') {
    const locale = resolveStationSpeechLocale(country, lat, lon, name);
    const cfg = PIPER_STATION_VOICES[locale] || Object.freeze({ voiceId: null, label: `System ${locale}`, source: 'system' });
    return { locale, country: normalizeCountryCode(country), voiceId: cfg.voiceId || null, label: cfg.label, source: cfg.source };
}
function withTimeout(promise, timeoutMs, code = 'TIMEOUT') {
    const ms = Math.max(0, Number(timeoutMs) || 0);
    if (!ms)
        return promise;
    let timer = null;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                const err = new Error(code);
                err.code = String(code);
                reject(err);
            }, ms);
        }),
    ]).finally(() => { if (timer)
        clearTimeout(timer); });
}
export class PiperFrenchNeuralVoice {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.voiceId = options.voiceId || PIPER_FRENCH_VOICE_ID;
        this.moduleUrl = options.moduleUrl || PIPER_WEB_MODULE_URL;
        this.moduleLoader = options.moduleLoader || null;
        this.prepareTimeoutMs = Number.isFinite(options.prepareTimeoutMs) ? Math.max(1000, options.prepareTimeoutMs) : 120000;
        this.initialPredictTimeoutMs = Number.isFinite(options.initialPredictTimeoutMs) ? Math.max(1000, options.initialPredictTimeoutMs) : 90000;
        this.predictTimeoutMs = Number.isFinite(options.predictTimeoutMs) ? Math.max(1000, options.predictTimeoutMs) : 20000;
        this.preparing = false;
        this.lastError = '';
        this.progress = 0;
        this._modulePromise = null;
        this._readyVoices = new Set();
        this._preparePromises = new Map();
        this._sessionPromises = new Map();
        this._sessions = new Map();
        this._sessionCreateChain = Promise.resolve();
        this._opfsProbePromise = null;
    }
    get ready() { return this._readyVoices.has(this.voiceId); }
    set ready(v) { if (v)
        this._readyVoices.add(this.voiceId);
    else
        this._readyVoices.delete(this.voiceId); }
    isVoiceReady(voiceId = this.voiceId) { return this._readyVoices.has(String(voiceId || this.voiceId)); }
    async _probeOpfsCache() {
        // OPFS is a CACHE only. It must never be a prerequisite for speech.
        // The RealTimeX/Mintplex runtime already catches OPFS read/write failures
        // and can fetch the model directly. HOTFIX75 therefore probes cache support
        // only to avoid a pointless double-download during explicit prefetch.
        if (this.moduleLoader)
            return true;
        const nav = globalThis.navigator;
        if (!nav?.storage?.getDirectory)
            return false;
        if (!this._opfsProbePromise) {
            this._opfsProbePromise = withTimeout(Promise.resolve().then(() => nav.storage.getDirectory()), 1500, 'PIPER_OPFS_PROBE_TIMEOUT').then(() => true).catch(() => false);
        }
        return await this._opfsProbePromise;
    }
    async _loadModule() {
        if (!this.enabled)
            throw new Error('PIPER_DISABLED');
        if (!this._modulePromise) {
            this._modulePromise = (async () => {
                if (this.moduleLoader)
                    return await this.moduleLoader(this.moduleUrl);
                const dynamicImport = new Function('url', 'return import(url)');
                const urls = [this.moduleUrl, PIPER_WEB_MODULE_FALLBACK_URL, PIPER_WEB_MODULE_LEGACY_URL].filter((u, i, a) => u && a.indexOf(u) === i);
                let last = null;
                for (const url of urls) {
                    try {
                        return await dynamicImport(url);
                    }
                    catch (err) {
                        last = err;
                    }
                }
                throw last || new Error('PIPER_MODULE_IMPORT_FAILED');
            })().then((mod) => {
                if (!mod || typeof mod.predict !== 'function')
                    throw new Error('PIPER_MODULE_INVALID');
                return mod;
            }).catch((err) => {
                this._modulePromise = null;
                throw err;
            });
        }
        return await this._modulePromise;
    }
    _onProgress(event) {
        const loaded = Number(event?.loaded);
        const total = Number(event?.total);
        if (Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
            this.progress = Math.max(0, Math.min(1, loaded / total));
        }
    }
    async _getVoiceSession(mod, voiceId) {
        const requested = String(voiceId || this.voiceId);
        const TtsSession = mod?.TtsSession;
        if (!requested || !TtsSession || typeof TtsSession.create !== 'function')
            return null;
        if (this._sessions.has(requested))
            return this._sessions.get(requested);
        if (this._sessionPromises.has(requested))
            return await this._sessionPromises.get(requested);
        // RealTimeX/Mintplex exposes TtsSession as a global singleton. Calling the
        // package-level predict() for DE after FR merely mutates voiceId on the same
        // already-loaded ONNX session. That is unsafe for RE's multilingual SIV.
        // Create one isolated, fully initialized session per Piper voice and keep it
        // ourselves. Session creation is serialized while the package singleton is
        // temporarily detached; the completed instance remains independently usable.
        const create = async () => {
            const previous = TtsSession._instance || null;
            try {
                TtsSession._instance = null;
                const session = await TtsSession.create({
                    voiceId: requested,
                    allowLocalModels: true,
                    fallbackStrategy: 'cdn',
                    progress: (ev) => this._onProgress(ev),
                    logger: () => { },
                });
                if (!session || typeof session.predict !== 'function')
                    throw new Error('PIPER_SESSION_INVALID');
                this._sessions.set(requested, session);
                return session;
            }
            finally {
                try {
                    TtsSession._instance = previous;
                }
                catch (_) { /* package compatibility */ }
            }
        };
        const job = this._sessionCreateChain.then(create, create);
        this._sessionCreateChain = job.then(() => undefined, () => undefined);
        this._sessionPromises.set(requested, job);
        try {
            return await job;
        }
        finally {
            this._sessionPromises.delete(requested);
        }
    }
    async synthesize(text, voiceId = this.voiceId) {
        const clean = normalizeSpace(text);
        const requested = String(voiceId || this.voiceId);
        if (!clean || !this.enabled || !requested)
            return null;
        const mod = await this._loadModule();
        const wasReady = this.isVoiceReady(requested);
        let predictPromise;
        const session = await this._getVoiceSession(mod, requested);
        if (session)
            predictPromise = Promise.resolve(session.predict(clean));
        else if (typeof mod.predict === 'function')
            predictPromise = Promise.resolve(mod.predict({ text: clean, voiceId: requested }, (ev) => this._onProgress(ev)));
        else
            throw new Error('PIPER_PREDICT_UNAVAILABLE');
        const wav = await withTimeout(predictPromise, wasReady ? this.predictTimeoutMs : this.initialPredictTimeoutMs, 'PIPER_PREDICT_TIMEOUT');
        if (!wav || typeof wav !== 'object')
            throw new Error('PIPER_EMPTY_AUDIO');
        this._readyVoices.add(requested);
        this.progress = 1;
        this.lastError = '';
        return wav;
    }
    prepareVoice(voiceId = this.voiceId, warmText = 'gare') {
        const requested = String(voiceId || this.voiceId);
        if (!this.enabled || !requested)
            return Promise.resolve(false);
        if (this.isVoiceReady(requested))
            return Promise.resolve(true);
        if (this._preparePromises.has(requested))
            return this._preparePromises.get(requested);
        if (requested === this.voiceId)
            this.preparing = true;
        this.lastError = '';
        const prepareJob = (async () => {
            // The Piper project recommends an explicit download before first predict.
            // It gives file:///old Chromium one deterministic model-fetch phase instead
            // of hiding download + ONNX initialisation inside the first passenger click.
            const mod = await this._loadModule();
            // Explicit download is useful only when OPFS can actually cache it. On a
            // file:// origin where OPFS is denied, download() would fetch ~28–60 MB and
            // then synthesize() would fetch the exact model again. Skip that duplicate
            // transfer and let the inference session perform the single required fetch.
            const canCache = await this._probeOpfsCache();
            if (canCache && typeof mod.download === 'function') {
                try {
                    await mod.download(requested, (ev) => this._onProgress(ev));
                }
                catch (_) { /* session/predict still has its own fetch recovery path */ }
            }
            await this.synthesize(warmText, requested);
            return true;
        })();
        const promise = withTimeout(prepareJob, this.prepareTimeoutMs, 'PIPER_PREPARE_TIMEOUT')
            .then(() => true)
            .catch((err) => {
            this._readyVoices.delete(requested);
            this.lastError = String(err?.code || err?.message || 'PIPER_PREPARE_FAILED');
            return false;
        })
            .finally(() => {
            if (requested === this.voiceId)
                this.preparing = false;
            this._preparePromises.delete(requested);
        });
        this._preparePromises.set(requested, promise);
        return promise;
    }
    prepare() { return this.prepareVoice(this.voiceId, 'gare'); }
}
const FEMALE_FR_NAME_HINTS = [
    'hortense', 'denise', 'audrey', 'julie', 'marie', 'amelie', 'amélie',
    'celine', 'céline', 'virginie', 'google français', 'google francais'
];
// WAV PCM is intentionally first: it is the most dependable choice on the
// user's old Windows/Chromium target. The original AAC/M4A remains as fallback.
const RECORDED_PHRASES = Object.freeze({
    attention: Object.freeze(['audio/siv/rerb_attention.wav', 'audio/siv/rerb_attention.m4a']),
    destinationPrefix: Object.freeze(['audio/siv/rerb_destination_prefix.wav', 'audio/siv/rerb_destination_prefix.m4a']),
    stopsPrefix: Object.freeze(['audio/siv/rerb_stops_prefix.wav', 'audio/siv/rerb_stops_prefix.m4a']),
});
function normalizeSpace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}
export function normalizeStationForSpeech(name, locale = 'fr-FR') {
    let s = normalizeSpace(name);
    if (!s)
        return '';
    const family = langFamily(locale);
    // These railway abbreviations are language-bearing by themselves. Expand
    // them even when an old/custom station has no country metadata, while the
    // selected voice still comes from the resolved station locale.
    s = s.replace(/\bHbf\b/gi, 'Hauptbahnhof');
    s = s.replace(/\bBhf\b/gi, 'Bahnhof');
    s = s.replace(/\bH\.bf\b/gi, 'Hauptbahnhof');
    if (family === 'fr')
        s = s.replace(/\bGare\s+TGV\b/gi, 'Gare T G V');
    return s;
}
function nearestCountryForPoint(world, lat, lon) {
    const y = Number(lat), x = Number(lon);
    if (!Number.isFinite(y) || !Number.isFinite(x) || !world?.getStationsNear)
        return '';
    const near = world.getStationsNear(y, x, 6) || [];
    let best = null, bestD = Infinity;
    for (const st of near) {
        if (!st?.country || st.country === 'OTHER')
            continue;
        const dy = (Number(st.lat) - y) * 111.32;
        const dx = (Number(st.lon) - x) * Math.max(20, 111.32 * Math.cos(y * Math.PI / 180));
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
            bestD = d;
            best = st;
        }
    }
    return best?.country || '';
}
function stationSpeechMetaForStop(stop, world) {
    if (!stop)
        return { name: '', speech: '', country: '', locale: 'fr-FR', voiceId: PIPER_FRENCH_VOICE_ID };
    let st = null;
    if (stop.stationId && world?.getStationById)
        st = world.getStationById(stop.stationId) || null;
    const name = normalizeSpace(st?.name || stop.locationName || stop.name || '');
    const lat = Number(st?.lat ?? stop.lat ?? stop.latitude);
    const lon = Number(st?.lon ?? stop.lon ?? stop.longitude);
    let country = normalizeCountryCode(st?.country || stop.country || '');
    if (!country || country === 'OTHER' || country === 'UNMAPPED')
        country = normalizeCountryCode(nearestCountryForPoint(world, lat, lon) || '');
    const profile = stationVoiceProfile(country, lat, lon, name);
    return {
        name,
        speech: normalizeStationForSpeech(name, profile.locale),
        country,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        locale: profile.locale,
        voiceId: profile.voiceId,
        voiceLabel: profile.label,
        voiceSource: profile.source,
    };
}
function stationNameForStop(stop, world) { return stationSpeechMetaForStop(stop, world).name; }
function isPassengerStop(stop) {
    if (!stop)
        return false;
    // V2 uses arret for booked stops. Legacy/custom saves may omit type.
    return stop.type == null || stop.type === 'arret' || stop.type === 'stop';
}
function dedupeConsecutive(names) {
    const out = [];
    for (const name of names) {
        if (!name)
            continue;
        if (out[out.length - 1]?.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))
            continue;
        out.push(name);
    }
    return out;
}
function futureStopStartIndex(svc, stops) {
    const idx = Math.max(0, Number.isFinite(Number(svc?.currentStopIndex)) ? Number(svc.currentStopIndex) : 0);
    // Before departure the train is already standing at stop 0; do not announce
    // its origin as a future served station.
    if ((svc?.state === 'waiting' || svc?.state === 'predeparture') && idx === 0 && stops.length > 1)
        return 1;
    // arriveAtStation increments currentStopIndex after registering the stop, so
    // for moving and stopped services idx already points to the next location.
    return Math.min(idx, stops.length);
}
export function joinFrenchList(items) {
    const clean = (items || []).map(normalizeSpace).filter(Boolean);
    if (clean.length <= 1)
        return clean[0] || '';
    if (clean.length === 2)
        return `${clean[0]} et ${clean[1]}`;
    return `${clean.slice(0, -1).join(', ')} et ${clean[clean.length - 1]}`;
}
export function buildLivemapAnnouncement(svc, world) {
    if (!svc)
        return null;
    const stops = typeof svc.getCurrentStops === 'function'
        ? (svc.getCurrentStops() || [])
        : ((svc.isReturnLeg ? svc.returnStops : svc.stops) || []);
    if (!Array.isArray(stops) || stops.length === 0)
        return null;
    const booked = stops
        .map((stop, index) => ({ stop, index, ...stationSpeechMetaForStop(stop, world) }))
        .filter((x) => x.name && isPassengerStop(x.stop));
    if (booked.length === 0)
        return null;
    const destinationMeta = booked[booked.length - 1];
    const destination = destinationMeta.name;
    const startIndex = futureStopStartIndex(svc, stops);
    let futureMeta = booked.filter((x) => x.index >= startIndex);
    const deduped = [];
    for (const x of futureMeta) {
        if (deduped.at(-1)?.name?.toLocaleLowerCase('fr') === x.name.toLocaleLowerCase('fr'))
            continue;
        deduped.push(x);
    }
    futureMeta = deduped;
    // At the terminus there is no future stop left. Keeping the terminus produces
    // a complete sentence when the user clicks the train while it is at quai.
    if (futureMeta.length === 0 && destination)
        futureMeta = [destinationMeta];
    const destinationSpeech = destinationMeta.speech;
    const futureSpeech = futureMeta.map((x) => x.speech).filter(Boolean);
    const servedText = joinFrenchList(futureSpeech);
    return {
        destination,
        destinationSpeech,
        destinationSpeechMeta: destinationMeta,
        futureStops: futureMeta.map((x) => x.name),
        futureStopsSpeech: futureSpeech,
        futureStopsSpeechMeta: futureMeta,
        text: `Attention. Ce train a pour destination ${destinationSpeech}. Il s'arrêtera en gare de ${servedText}.`,
    };
}
function isFrenchVoice(voice) {
    const lang = String(voice?.lang || '').trim().toLowerCase().replace(/_/g, '-');
    return lang === 'fr' || lang.startsWith('fr-');
}
function scoreVoice(voice) {
    if (!isFrenchVoice(voice))
        return -Infinity;
    const lang = String(voice?.lang || '').toLowerCase().replace(/_/g, '-');
    const name = String(voice?.name || '').toLowerCase();
    let score = 0;
    if (lang === 'fr-fr')
        score += 120;
    else if (lang.startsWith('fr-'))
        score += 100;
    else if (lang === 'fr')
        score += 90;
    if (FEMALE_FR_NAME_HINTS.some((h) => name.includes(h)))
        score += 35;
    // Prefer a local French voice for Rail Empire's file:// / offline workflow.
    if (voice?.localService)
        score += 12;
    if (voice?.default)
        score += 1;
    return score;
}
function scoreLocaleVoice(voice, locale) {
    const want = normLang(locale).toLowerCase();
    const wantFamily = langFamily(want);
    const got = normLang(voice?.lang).toLowerCase();
    if (!wantFamily || langFamily(got) !== wantFamily)
        return -Infinity;
    let score = 0;
    if (got === want)
        score += 140;
    else if (got.startsWith(`${wantFamily}-`))
        score += 110;
    else if (got === wantFamily)
        score += 100;
    if (wantFamily === 'fr' && FEMALE_FR_NAME_HINTS.some((h) => String(voice?.name || '').toLowerCase().includes(h)))
        score += 35;
    if (voice?.localService)
        score += 10;
    if (voice?.default)
        score += 1;
    return score;
}
export class LivemapTrainAnnouncer {
    constructor(game, options = {}) {
        this.game = game;
        this.enabled = options.enabled !== false;
        this.useRecordedPhrases = options.useRecordedPhrases !== false;
        this.rate = Number.isFinite(options.rate) ? options.rate : 0.90;
        this.pitch = Number.isFinite(options.pitch) ? options.pitch : 1.0;
        this.volume = Number.isFinite(options.volume) ? options.volume : 0.96;
        // HOTFIX68: neural Siwis is the preferred dynamic French voice. It is
        // injectable in tests and falls back to HOTFIX67's explicit fr-FR system
        // voice if the network/model/runtime is unavailable. Never English.
        this.useNeuralFrenchVoice = (options.useNeuralFrenchVoice !== false && (options.neuralTts || typeof globalThis.document !== 'undefined'));
        this.useNeuralStationVoices = options.useNeuralStationVoices !== false && this.useNeuralFrenchVoice;
        this.neuralReadyTimeoutMs = Number.isFinite(options.neuralReadyTimeoutMs)
            ? Math.max(0, options.neuralReadyTimeoutMs)
            : 5000;
        // HOTFIX69 — the first Piper use may still be downloading/initialising the
        // Siwis model. Five seconds was enough only once cached and caused the SIV to
        // stop after the recorded "Attention" on a cold start. While preparation is
        // genuinely in progress, wait for that SAME promise instead of aborting the
        // sentence. Subsequent/cached announcements keep the short fast-path timeout.
        this.neuralFirstUseWaitMs = Number.isFinite(options.neuralFirstUseWaitMs)
            ? Math.max(0, options.neuralFirstUseWaitMs)
            : 90000;
        this.stationNeuralReadyTimeoutMs = Number.isFinite(options.stationNeuralReadyTimeoutMs)
            ? Math.max(0, options.stationNeuralReadyTimeoutMs)
            : 10000;
        this.neuralTts = options.neuralTts || new PiperFrenchNeuralVoice({
            enabled: this.useNeuralFrenchVoice,
            voiceId: options.neuralVoiceId || PIPER_FRENCH_VOICE_ID,
            moduleUrl: options.neuralModuleUrl || PIPER_WEB_MODULE_URL,
            moduleLoader: options.neuralModuleLoader || null,
            prepareTimeoutMs: options.neuralPrepareTimeoutMs,
            initialPredictTimeoutMs: options.neuralInitialPredictTimeoutMs,
            predictTimeoutMs: options.neuralPredictTimeoutMs,
        });
        this.voiceReadyTimeoutMs = Number.isFinite(options.voiceReadyTimeoutMs)
            ? Math.max(0, options.voiceReadyTimeoutMs)
            : 1800;
        this.voicePollMs = Number.isFinite(options.voicePollMs)
            ? Math.max(10, options.voicePollMs)
            : 60;
        // HOTFIX81 — keep language-hint fallback as an opt-out compatibility feature
        // for tests/embedded callers, but the real gameplay UI explicitly disables it.
        // Some Chromium builds resolve lang='fr-FR' to their English/default voice.
        // The LiveMap therefore accepts only Piper or an explicit same-language voice.
        this.allowLanguageFallback = options.allowLanguageFallback !== false;
        this.speechWatchdogMs = Number.isFinite(options.speechWatchdogMs)
            ? Math.max(1500, options.speechWatchdogMs)
            : 15000;
        // HOTFIX74 — force-generated Piper WAVs through an audio channel unlocked by
        // the SAME user click that starts the announcement. This avoids Chromium's
        // autoplay gate when synthesis completes seconds after the click.
        this.mediaWatchdogMs = Number.isFinite(options.mediaWatchdogMs)
            ? Math.max(2000, options.mediaWatchdogMs)
            : 45000;
        this.voice = null;
        this._voices = [];
        this.lastError = '';
        this._runToken = 0;
        this._currentAudio = null;
        this._currentAudioFinish = null;
        this._mediaElement = null;
        this._audioContext = null;
        this._audioUnlocked = false;
        this._currentBufferSource = null;
        this._currentBufferFinish = null;
        this._currentObjectUrl = null;
        this._lastServiceId = null;
        this._audioDiag = { stage: 'init', lastError: '', piper: 'unknown' };
        this._loadVoices = this._loadVoices.bind(this);
        const synth = globalThis.speechSynthesis;
        if (synth?.addEventListener)
            synth.addEventListener('voiceschanged', this._loadVoices);
        this._loadVoices();
        this._publishAudioDiagnostics('init');
    }
    _publishAudioDiagnostics(stage, extra = {}) {
        const protocol = String(globalThis.location?.protocol || 'unknown');
        const nav = globalThis.navigator;
        const data = {
            stage: String(stage || ''),
            protocol,
            secureContext: typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : null,
            opfs: !!(nav?.storage && typeof nav.storage.getDirectory === 'function'),
            voices: (this._voices || []).map((v) => ({ name: String(v?.name || ''), lang: String(v?.lang || ''), local: !!v?.localService })),
            frenchVoice: this.voice ? { name: String(this.voice?.name || ''), lang: String(this.voice?.lang || '') } : null,
            piperReady: !!this.neuralTts?.ready,
            piperPreparing: !!this.neuralTts?.preparing,
            piperError: String(this.neuralTts?.lastError || ''),
            lastError: String(this.lastError || ''),
            ...extra,
        };
        this._audioDiag = data;
        try {
            globalThis.__RAIL_EMPIRE_AUDIO_DIAG__ = data;
        }
        catch (_) { /* no-op */ }
        return data;
    }
    getAudioDiagnostics() { return this._publishAudioDiagnostics('snapshot'); }
    prepareNeuralVoice() {
        if (!this.useNeuralFrenchVoice || !this.neuralTts?.prepare)
            return Promise.resolve(false);
        return Promise.resolve(this.neuralTts.prepare()).then((ok) => {
            if (!ok && this.neuralTts?.lastError)
                this.lastError = `PIPER:${this.neuralTts.lastError}`;
            this._publishAudioDiagnostics(ok ? 'piper-ready' : 'piper-unavailable');
            return !!ok;
        }).catch((err) => {
            this.lastError = `PIPER:${String(err?.message || err || 'PREPARE_FAILED')}`;
            this._publishAudioDiagnostics('piper-error');
            return false;
        });
    }
    _loadVoices() {
        const synth = globalThis.speechSynthesis;
        const voices = synth?.getVoices?.() || [];
        this._voices = Array.isArray(voices) ? voices : [];
        if (!this._voices.length) {
            this.voice = null;
            this.lastError = 'VOICES_NOT_READY';
            return null;
        }
        const french = this._voices.filter(isFrenchVoice);
        this.voice = french.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
        this.lastError = this.voice ? '' : 'NO_FRENCH_VOICE';
        return this.voice;
    }
    _systemVoiceForLocale(locale) {
        this._loadVoices();
        const family = langFamily(locale);
        if (!family)
            return null;
        const candidates = (this._voices || []).filter((v) => langFamily(v?.lang) === family);
        candidates.sort((a, b) => scoreLocaleVoice(b, locale) - scoreLocaleVoice(a, locale));
        return candidates[0] || null;
    }
    async _waitForLocaleVoice(locale, token, timeoutMs = this.voiceReadyTimeoutMs) {
        if (token !== this._runToken)
            return null;
        let existing = this._systemVoiceForLocale(locale);
        if (existing)
            return existing;
        const synth = globalThis.speechSynthesis;
        if (!synth?.getVoices)
            return null;
        const deadline = Date.now() + Math.max(0, timeoutMs);
        while (token === this._runToken && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, this.voicePollMs));
            existing = this._systemVoiceForLocale(locale);
            if (existing)
                return existing;
        }
        return null;
    }
    async _waitForFrenchVoice(token, timeoutMs = this.voiceReadyTimeoutMs) {
        const v = await this._waitForLocaleVoice('fr-FR', token, timeoutMs);
        if (v && isFrenchVoice(v)) {
            this.voice = v;
            return v;
        }
        if (token === this._runToken)
            this.lastError = 'NO_FRENCH_VOICE';
        return null;
    }
    _getMediaElement() {
        const AudioCtor = globalThis.Audio;
        if (typeof AudioCtor !== 'function')
            return null;
        if (!this._mediaElement) {
            try {
                this._mediaElement = new AudioCtor();
                this._mediaElement.preload = 'auto';
                this._mediaElement.volume = Math.min(1, Math.max(0, this.volume));
            }
            catch (_) {
                this._mediaElement = null;
            }
        }
        return this._mediaElement;
    }
    // Must be called synchronously from the train click. A resumed AudioContext is
    // allowed to play later-generated buffers even after transient user activation
    // has expired; the persistent <audio> element is also reused for every chunk.
    _unlockAudioFromGesture() {
        this._getMediaElement();
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (typeof Ctx !== 'function')
            return false;
        try {
            if (!this._audioContext || this._audioContext.state === 'closed')
                this._audioContext = new Ctx();
            const ctx = this._audioContext;
            const resumed = ctx.resume?.();
            if (resumed?.catch)
                resumed.catch(() => { });
            // A one-sample silent source makes the unlock explicit on older Chromium.
            if (ctx.createBuffer && ctx.createBufferSource && ctx.destination) {
                const buffer = ctx.createBuffer(1, 1, Number(ctx.sampleRate) || 22050);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start?.(0);
            }
            this._audioUnlocked = true;
            return true;
        }
        catch (err) {
            this.lastError = `AUDIO_UNLOCK:${String(err?.message || err || 'FAILED')}`;
            return false;
        }
    }
    _blobArrayBuffer(blob) {
        if (blob?.arrayBuffer)
            return blob.arrayBuffer();
        const FileReaderCtor = globalThis.FileReader;
        if (typeof FileReaderCtor !== 'function')
            return Promise.reject(new Error('BLOB_ARRAYBUFFER_UNAVAILABLE'));
        return new Promise((resolve, reject) => {
            try {
                const r = new FileReaderCtor();
                r.onload = () => resolve(r.result);
                r.onerror = () => reject(r.error || new Error('BLOB_READ_FAILED'));
                r.readAsArrayBuffer(blob);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    _decodeAudioBuffer(ctx, arrayBuffer) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const ok = (value) => { if (!settled) {
                settled = true;
                resolve(value);
            } };
            const bad = (err) => { if (!settled) {
                settled = true;
                reject(err || new Error('AUDIO_DECODE_FAILED'));
            } };
            try {
                const out = ctx.decodeAudioData(arrayBuffer, ok, bad);
                if (out?.then)
                    out.then(ok, bad);
            }
            catch (err) {
                bad(err);
            }
        });
    }
    async _playNeuralViaContextAsync(blob, token) {
        const ctx = this._audioContext;
        if (token !== this._runToken || !this._audioUnlocked || !ctx?.decodeAudioData || !ctx?.createBufferSource)
            return false;
        try {
            if (ctx.state === 'suspended')
                await Promise.resolve(ctx.resume?.()).catch(() => false);
            if (token !== this._runToken || ctx.state === 'closed')
                return false;
            const bytes = await this._blobArrayBuffer(blob);
            if (token !== this._runToken)
                return false;
            const audioBuffer = await this._decodeAudioBuffer(ctx, bytes);
            if (token !== this._runToken || !audioBuffer)
                return false;
            return await new Promise((resolve) => {
                let source = null, gain = null, done = false, watchdog = null;
                const finish = (ok) => {
                    if (done)
                        return;
                    done = true;
                    if (watchdog)
                        clearTimeout(watchdog);
                    if (this._currentBufferSource === source)
                        this._currentBufferSource = null;
                    if (this._currentBufferFinish === finish)
                        this._currentBufferFinish = null;
                    resolve(ok && token === this._runToken);
                };
                try {
                    source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    if (ctx.createGain) {
                        gain = ctx.createGain();
                        gain.gain.value = Math.min(1, Math.max(0, this.volume));
                        source.connect(gain);
                        gain.connect(ctx.destination);
                    }
                    else
                        source.connect(ctx.destination);
                    source.onended = () => finish(true);
                    this._currentBufferSource = source;
                    this._currentBufferFinish = finish;
                    const durationMs = Math.max(0, Number(audioBuffer.duration) || 0) * 1000;
                    watchdog = setTimeout(() => { try {
                        source?.stop();
                    }
                    catch (_) { } finish(false); }, Math.max(this.mediaWatchdogMs, durationMs + 5000));
                    source.start(0);
                }
                catch (_) {
                    finish(false);
                }
            });
        }
        catch (_) {
            return false;
        }
    }
    _playMediaSrcAsync(src, token) {
        return new Promise((resolve) => {
            if (token !== this._runToken)
                return resolve(false);
            const a = this._getMediaElement();
            if (!a)
                return resolve(false);
            if (this._currentAudioFinish) {
                try {
                    this._currentAudioFinish(false);
                }
                catch (_) { }
            }
            this._currentAudio = a;
            a.preload = 'auto';
            a.volume = Math.min(1, Math.max(0, this.volume));
            let done = false, watchdog = null;
            const finish = (ok) => {
                if (done)
                    return;
                done = true;
                if (watchdog)
                    clearTimeout(watchdog);
                if (this._currentAudio === a)
                    this._currentAudio = null;
                if (this._currentAudioFinish === finish)
                    this._currentAudioFinish = null;
                a.onended = null;
                a.onerror = null;
                resolve(ok && token === this._runToken);
            };
            this._currentAudioFinish = finish;
            a.onended = () => finish(true);
            a.onerror = () => finish(false);
            watchdog = setTimeout(() => finish(false), this.mediaWatchdogMs);
            try {
                a.src = src;
                a.load?.();
                const p = a.play();
                if (p?.catch)
                    p.catch(() => finish(false));
            }
            catch (_) {
                finish(false);
            }
        });
    }
    cancel() {
        this._runToken++;
        if (this._currentAudioFinish) {
            try {
                this._currentAudioFinish(false);
            }
            catch (_) { }
        }
        if (this._currentBufferFinish) {
            try {
                this._currentBufferFinish(false);
            }
            catch (_) { }
        }
        if (this._currentBufferSource) {
            try {
                this._currentBufferSource.stop?.();
            }
            catch (_) { }
            this._currentBufferSource = null;
        }
        if (this._currentAudio) {
            try {
                this._currentAudio.pause();
                this._currentAudio.currentTime = 0;
            }
            catch (_) { /* no-op */ }
            this._currentAudio = null;
        }
        if (this._currentObjectUrl) {
            try {
                globalThis.URL?.revokeObjectURL?.(this._currentObjectUrl);
            }
            catch (_) { /* no-op */ }
            this._currentObjectUrl = null;
        }
        try {
            globalThis.speechSynthesis?.cancel?.();
        }
        catch (_) { /* no-op */ }
    }
    _makeUtterance(text) {
        const Utterance = globalThis.SpeechSynthesisUtterance;
        if (typeof Utterance !== 'function')
            return null;
        const frenchVoice = this.voice && isFrenchVoice(this.voice) ? this.voice : null;
        if (!frenchVoice && !this.allowLanguageFallback)
            return null;
        const u = new Utterance(text);
        // HOTFIX67: normal gameplay reaches this point only with an explicit French
        // voice object. Keeping lang='fr-FR' is an extra guard, not a request to use
        // the browser default voice.
        u.lang = frenchVoice?.lang || 'fr-FR';
        if (frenchVoice)
            u.voice = frenchVoice;
        u.rate = this.rate;
        u.pitch = this.pitch;
        u.volume = this.volume;
        return u;
    }
    async _speakAsync(text, token) {
        if (token !== this._runToken)
            return false;
        if (!this.voice || !isFrenchVoice(this.voice)) {
            await this._waitForFrenchVoice(token);
            if (token !== this._runToken)
                return false;
            // Never silently select the browser's English/default voice in gameplay.
            if (!this.voice && !this.allowLanguageFallback) {
                this.lastError = 'NO_FRENCH_VOICE_BLOCKED';
                return false;
            }
            if (!this.voice && this.allowLanguageFallback)
                this.lastError = 'FR_LANG_FALLBACK';
        }
        return await new Promise((resolve) => {
            if (token !== this._runToken)
                return resolve(false);
            const synth = globalThis.speechSynthesis;
            const u = this._makeUtterance(text);
            if (!synth?.speak || !u)
                return resolve(false);
            let done = false;
            let watchdog = null;
            const finish = (ok) => {
                if (done)
                    return;
                done = true;
                if (watchdog)
                    clearTimeout(watchdog);
                resolve(ok);
            };
            u.onend = () => finish(true);
            u.onerror = () => finish(false);
            watchdog = setTimeout(() => {
                try {
                    synth.cancel?.();
                }
                catch (_) { /* no-op */ }
                finish(false);
            }, this.speechWatchdogMs);
            try {
                // Chromium occasionally leaves speechSynthesis paused after tab/file://
                // lifecycle changes. resume() is harmless when already running.
                synth.resume?.();
                synth.speak(u);
            }
            catch (_) {
                finish(false);
            }
        });
    }
    _makeLocaleUtterance(text, locale, voice) {
        const Utterance = globalThis.SpeechSynthesisUtterance;
        if (typeof Utterance !== 'function' || !voice)
            return null;
        const wantFamily = langFamily(locale);
        if (!wantFamily || langFamily(voice?.lang) !== wantFamily)
            return null;
        const u = new Utterance(text);
        u.lang = voice.lang || normLang(locale);
        u.voice = voice;
        u.rate = this.rate;
        u.pitch = this.pitch;
        u.volume = this.volume;
        return u;
    }
    _makeLocaleHintUtterance(text, locale) {
        const Utterance = globalThis.SpeechSynthesisUtterance;
        if (typeof Utterance !== 'function')
            return null;
        const u = new Utterance(text);
        u.lang = normLang(locale) || 'fr-FR';
        u.rate = this.rate;
        u.pitch = this.pitch;
        u.volume = this.volume;
        return u;
    }
    async _speakLocaleHintAsync(text, locale, token) {
        if (token !== this._runToken || !this.allowLanguageFallback)
            return false;
        const synth = globalThis.speechSynthesis;
        const u = this._makeLocaleHintUtterance(text, locale);
        if (!synth?.speak || !u)
            return false;
        this.lastError = `LANG_HINT_FALLBACK:${normLang(locale) || 'fr-FR'}`;
        this._publishAudioDiagnostics('language-fallback', { fallbackLocale: u.lang });
        return await new Promise((resolve) => {
            let done = false, watchdog = null;
            const finish = (ok) => { if (done)
                return; done = true; if (watchdog)
                clearTimeout(watchdog); resolve(ok && token === this._runToken); };
            u.onend = () => finish(true);
            u.onerror = () => finish(false);
            watchdog = setTimeout(() => { try {
                synth.cancel?.();
            }
            catch (_) { } finish(false); }, this.speechWatchdogMs);
            try {
                synth.resume?.();
                synth.speak(u);
            }
            catch (_) {
                finish(false);
            }
        });
    }
    async _speakLocaleSystemAsync(text, locale, token, readyTimeoutMs = this.voiceReadyTimeoutMs) {
        if (token !== this._runToken)
            return false;
        const voice = await this._waitForLocaleVoice(locale, token, readyTimeoutMs);
        if (token !== this._runToken || !voice)
            return false;
        return await new Promise((resolve) => {
            const synth = globalThis.speechSynthesis;
            const u = this._makeLocaleUtterance(text, locale, voice);
            if (!synth?.speak || !u)
                return resolve(false);
            let done = false, watchdog = null;
            const finish = (ok) => { if (done)
                return; done = true; if (watchdog)
                clearTimeout(watchdog); resolve(ok); };
            u.onend = () => finish(true);
            u.onerror = () => finish(false);
            watchdog = setTimeout(() => { try {
                synth.cancel?.();
            }
            catch (_) { } finish(false); }, this.speechWatchdogMs);
            try {
                synth.resume?.();
                synth.speak(u);
            }
            catch (_) {
                finish(false);
            }
        });
    }
    _neuralVoiceReady(voiceId) {
        if (!voiceId || !this.neuralTts)
            return false;
        if (typeof this.neuralTts.isVoiceReady === 'function')
            return !!this.neuralTts.isVoiceReady(voiceId);
        return voiceId === PIPER_FRENCH_VOICE_ID && !!this.neuralTts.ready;
    }
    _prepareNeuralVoiceId(voiceId, warmText = 'gare') {
        if (!this.useNeuralStationVoices || !voiceId || !this.neuralTts)
            return Promise.resolve(false);
        if (this._neuralVoiceReady(voiceId))
            return Promise.resolve(true);
        if (typeof this.neuralTts.prepareVoice === 'function')
            return Promise.resolve(this.neuralTts.prepareVoice(voiceId, warmText));
        if (voiceId === PIPER_FRENCH_VOICE_ID && typeof this.neuralTts.prepare === 'function')
            return Promise.resolve(this.neuralTts.prepare());
        return Promise.resolve(false);
    }
    async _speakNeuralVoiceIdAsync(text, voiceId, token) {
        if (token !== this._runToken || !this.useNeuralStationVoices || !voiceId || !this.neuralTts?.synthesize)
            return false;
        try {
            const blob = await this.neuralTts.synthesize(text, voiceId);
            if (token !== this._runToken || !blob)
                return false;
            const ok = await this._playNeuralBlobAsync(blob, token);
            if (!ok && token === this._runToken)
                this.lastError = `PIPER_AUDIO_PLAYBACK_FAILED:${voiceId}`;
            return ok;
        }
        catch (err) {
            if (token === this._runToken)
                this.lastError = `PIPER:${voiceId}:${String(err?.code || err?.message || 'PREDICT_FAILED')}`;
            return false;
        }
    }
    _prewarmStationVoices(announcement) {
        if (!this.useNeuralStationVoices)
            return;
        const metas = [announcement?.destinationSpeechMeta, ...(announcement?.futureStopsSpeechMeta || [])].filter(Boolean);
        const ids = [];
        for (const m of metas) {
            const id = String(m?.voiceId || '');
            if (!id || id === PIPER_FRENCH_VOICE_ID || ids.includes(id))
                continue;
            ids.push(id);
            if (ids.length >= 2)
                break; // old/low-memory Chromium: never warm a fleet of ONNX models at once.
        }
        let chain = Promise.resolve();
        for (const id of ids)
            chain = chain.then(() => this._prepareNeuralVoiceId(id, 'gare')).catch(() => false);
        void chain;
    }
    async _speakStationMetaAsync(meta, token, frenchMode = 'auto') {
        const speech = normalizeSpace(meta?.speech || meta?.name || '');
        const locale = normLang(meta?.locale || 'fr-FR') || 'fr-FR';
        if (!speech || token !== this._runToken)
            return false;
        if (langFamily(locale) === 'fr')
            return await this._speakDynamicAsync(speech, token, frenchMode);
        const voiceId = meta?.voiceId || null;
        // Cached neural voice first. If it is still downloading, use an explicit
        // same-language system voice immediately when available.
        if (voiceId && this._neuralVoiceReady(voiceId)) {
            if (await this._speakNeuralVoiceIdAsync(speech, voiceId, token))
                return true;
        }
        const systemVoice = this._systemVoiceForLocale(locale);
        if (systemVoice)
            return await this._speakLocaleSystemAsync(speech, locale, token, 0);
        // No local system voice: wait for the online Piper pack, but never substitute
        // another language. Unsupported languages simply remain silent.
        if (voiceId) {
            let ok = false;
            try {
                ok = (await withTimeout(this._prepareNeuralVoiceId(voiceId, speech), this.stationNeuralReadyTimeoutMs, 'PIPER_STATION_NOT_READY'));
            }
            catch (_) {
                ok = false;
            }
            if (ok && token === this._runToken)
                return await this._speakNeuralVoiceIdAsync(speech, voiceId, token);
        }
        // Last-resort forced path: preserve the station's own BCP-47 locale and let
        // SpeechSynthesis resolve it. This is the only browser-native option on a
        // file:// install where Piper/OPFS is unavailable and no explicit voice is
        // exposed by getVoices(). Failure skips only this station group.
        if (await this._speakLocaleHintAsync(speech, locale, token))
            return true;
        this.lastError = `NO_MATCHING_STATION_VOICE:${locale}`;
        this._publishAudioDiagnostics('station-voice-missing', { missingLocale: locale });
        return false;
    }
    async _speakStationSequenceAsync(metas, token, frenchMode = 'auto') {
        const rows = (metas || []).filter((x) => normalizeSpace(x?.speech || x?.name));
        if (!rows.length)
            return true;
        // Group consecutive stations spoken by the same locale so domestic routes
        // remain fluid, while cross-border routes switch voice exactly at the border.
        const groups = [];
        for (const row of rows) {
            const loc = normLang(row.locale || 'fr-FR');
            const g = groups.at(-1);
            if (g && g.locale === loc)
                g.rows.push(row);
            else
                groups.push({ locale: loc, rows: [row] });
        }
        for (let gi = 0; gi < groups.length; gi++) {
            if (token !== this._runToken)
                return false;
            const g = groups[gi];
            const names = g.rows.map((x) => normalizeSpace(x.speech || x.name));
            const joined = langFamily(g.locale) === 'fr' ? joinFrenchList(names) : names.join(', ');
            const text = joined + (gi === groups.length - 1 ? '.' : ',');
            const meta = { ...g.rows[0], speech: text, locale: g.locale };
            // Missing one locale must not kill the rest of a cross-border announcement.
            // We skip only the unpronounceable group; using the wrong language is worse.
            await this._speakStationMetaAsync(meta, token, frenchMode);
        }
        return true;
    }
    async _playNeuralBlobAsync(blob, token) {
        if (token !== this._runToken || !blob)
            return false;
        // Preferred HOTFIX74 path: AudioContext was unlocked synchronously by the
        // train click, so delayed Piper output is not subject to a fresh autoplay
        // decision. Keep HTMLAudio as compatibility fallback for unusual WAVs.
        if (await this._playNeuralViaContextAsync(blob, token))
            return true;
        if (token !== this._runToken)
            return false;
        const URLApi = globalThis.URL;
        if (!URLApi?.createObjectURL)
            return false;
        let url = null;
        try {
            url = URLApi.createObjectURL(blob);
        }
        catch (_) {
            return false;
        }
        this._currentObjectUrl = url;
        try {
            return await this._playMediaSrcAsync(url, token);
        }
        finally {
            if (this._currentObjectUrl === url)
                this._currentObjectUrl = null;
            try {
                URLApi.revokeObjectURL(url);
            }
            catch (_) { /* no-op */ }
        }
    }
    async _speakNeuralAsync(text, token) {
        if (token !== this._runToken || !this.useNeuralFrenchVoice || !this.neuralTts?.synthesize)
            return false;
        try {
            const blob = await this.neuralTts.synthesize(text);
            if (token !== this._runToken || !blob)
                return false;
            const ok = await this._playNeuralBlobAsync(blob, token);
            if (!ok && token === this._runToken)
                this.lastError = 'PIPER_AUDIO_PLAYBACK_FAILED';
            return ok;
        }
        catch (err) {
            if (this.neuralTts && 'ready' in this.neuralTts) {
                try {
                    this.neuralTts.ready = false;
                }
                catch (_) { /* no-op */ }
            }
            if (token === this._runToken)
                this.lastError = `PIPER:${String(err?.code || err?.message || 'PREDICT_FAILED')}`;
            return false;
        }
    }
    async _speakDynamicAsync(text, token, mode = 'auto') {
        if (token !== this._runToken)
            return false;
        const wantsNeural = mode === 'neural' || (mode === 'auto' && this.useNeuralFrenchVoice && this.neuralTts?.ready);
        if (wantsNeural && this.neuralTts?.ready) {
            if (await this._speakNeuralAsync(text, token))
                return true;
        }
        else if (mode === 'auto' && this.useNeuralFrenchVoice) {
            // Preparation is deliberately non-blocking here. LiveMap starts it as
            // soon as the page is opened; if it is not ready yet, the current click
            // uses the explicit French system voice rather than freezing the UI.
            void this.prepareNeuralVoice();
        }
        return await this._speakAsync(text, token);
    }
    _playOneRecordedAsync(src, token) {
        return this._playMediaSrcAsync(src, token);
    }
    async _playRecordedAsync(sources, token) {
        const list = Array.isArray(sources) ? sources : [sources];
        for (const src of list) {
            if (token !== this._runToken)
                return false;
            if (await this._playOneRecordedAsync(src, token))
                return true;
        }
        return false;
    }
    async _runHybrid(announcement, token) {
        const phrase = async (sources, fallbackText = '') => {
            if (token !== this._runToken)
                return false;
            const played = await this._playRecordedAsync(sources, token);
            if (played)
                return token === this._runToken;
            this.lastError = 'RECORDED_AUDIO_UNAVAILABLE';
            // Fixed phrases are allowed to use the forced fr-FR language hint. A media
            // file failure must never abort the remaining SIV sentence.
            return fallbackText ? await this._speakDynamicAsync(fallbackText, token, 'system') : false;
        };
        // Start both candidates in parallel with the local fixed phrases. Piper is
        // an enhancement, never a gate: after the destination prefix we grant it at
        // most 1.5 s of cold-start grace, instead of HOTFIX69's 90 s sentence stall.
        const neuralPromise = this.useNeuralFrenchVoice ? this.prepareNeuralVoice() : Promise.resolve(false);
        const voicePromise = this._waitForFrenchVoice(token).catch(() => null);
        if (!await phrase(RECORDED_PHRASES.attention, 'Attention.'))
            return;
        if (token !== this._runToken)
            return;
        // HOTFIX75 root fix: this recorded phrase comes BEFORE any neural/system
        // readiness decision. The old code returned here when Piper + fr-FR SAPI were
        // unavailable, which is exactly why users heard only "Attention".
        await phrase(RECORDED_PHRASES.destinationPrefix, 'Ce train a pour destination');
        if (token !== this._runToken)
            return;
        let dynamicMode = this.neuralTts?.ready ? 'neural' : '';
        if (!dynamicMode && this.useNeuralFrenchVoice) {
            try {
                const graceMs = Math.min(1500, Math.max(0, this.neuralFirstUseWaitMs));
                const ok = await withTimeout(Promise.resolve(neuralPromise), graceMs, 'PIPER_SHORT_GRACE_EXPIRED');
                if (ok || this.neuralTts?.ready)
                    dynamicMode = 'neural';
            }
            catch (_) { /* fall through immediately to browser TTS */ }
        }
        if (!dynamicMode) {
            try {
                const v = await withTimeout(Promise.resolve(voicePromise), Math.min(600, this.voiceReadyTimeoutMs), 'FR_VOICE_GRACE_EXPIRED');
                if (v)
                    dynamicMode = 'system';
            }
            catch (_) { /* language hint below */ }
        }
        if (!dynamicMode)
            dynamicMode = 'system'; // _speakAsync => fr-FR language hint when no explicit voice.
        await this._speakStationMetaAsync({ ...announcement.destinationSpeechMeta, speech: `${announcement.destinationSpeech}.` }, token, dynamicMode);
        if (token !== this._runToken)
            return;
        await phrase(RECORDED_PHRASES.stopsPrefix, "Il s'arrêtera en gare de");
        if (token !== this._runToken)
            return;
        await this._speakStationSequenceAsync(announcement.futureStopsSpeechMeta, token, dynamicMode);
        this._publishAudioDiagnostics('announcement-complete');
    }
    async _runTtsOnly(announcement, token) {
        if (this.useNeuralFrenchVoice)
            void this.prepareNeuralVoice();
        const dynamicMode = this.neuralTts?.ready ? 'neural' : 'system';
        if (token !== this._runToken)
            return;
        if (!await this._speakDynamicAsync('Attention.', token, dynamicMode))
            return;
        const destinationMeta = announcement.destinationSpeechMeta || {};
        if (!await this._speakDynamicAsync('Ce train a pour destination', token, dynamicMode))
            return;
        await this._speakStationMetaAsync({ ...destinationMeta, speech: `${announcement.destinationSpeech}.` }, token, dynamicMode);
        if (token !== this._runToken)
            return;
        if (!await this._speakDynamicAsync("Il s'arrêtera en gare de", token, dynamicMode))
            return;
        await this._speakStationSequenceAsync(announcement.futureStopsSpeechMeta || [], token, dynamicMode);
        this._publishAudioDiagnostics('announcement-complete-tts');
    }
    announce(svc) {
        if (!this.enabled || !svc)
            return false;
        const announcement = buildLivemapAnnouncement(svc, this.game?.world);
        if (!announcement?.text)
            return false;
        // A new train click always replaces the previous announcement.
        this.cancel();
        // HOTFIX74: this function is called directly by the canvas click handler;
        // consume that transient activation NOW so Piper can still play after its
        // asynchronous model inference/download has finished.
        this._unlockAudioFromGesture();
        try {
            globalThis.speechSynthesis?.resume?.();
        }
        catch (_) { /* no-op */ }
        this._loadVoices();
        this._lastServiceId = svc.id || null;
        this._publishAudioDiagnostics('announce-start', { serviceId: this._lastServiceId });
        const token = this._runToken;
        this._prewarmStationVoices(announcement);
        // Recorded mode is allowed to start even when SpeechSynthesis has not yet
        // exposed its voice list: "Attention" is real audio and must never be muted
        // by a missing/delayed SAPI voice.
        if (this.useRecordedPhrases && typeof globalThis.Audio === 'function') {
            void this._runHybrid(announcement, token);
            return true;
        }
        const synth = globalThis.speechSynthesis;
        const Utterance = globalThis.SpeechSynthesisUtterance;
        if (!synth?.speak || typeof Utterance !== 'function') {
            this.lastError = 'AUDIO_AND_TTS_UNAVAILABLE';
            return false;
        }
        void this._runTtsOnly(announcement, token);
        return true;
    }
}
