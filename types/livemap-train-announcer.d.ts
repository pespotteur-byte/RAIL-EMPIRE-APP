export declare const PIPER_FRENCH_VOICE_ID = "fr_FR-siwis-low";
export declare const PIPER_WEB_MODULE_URL = "https://cdn.jsdelivr.net/npm/@realtimex/piper-tts-web@1.1.1/+esm";
export declare const PIPER_WEB_MODULE_FALLBACK_URL = "https://esm.sh/@realtimex/piper-tts-web@1.1.1?bundle";
export declare const PIPER_WEB_MODULE_LEGACY_URL = "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm";
type PiperProgress = {
    loaded?: unknown;
    total?: unknown;
};
type PiperVoiceSession = {
    predict(text: string): unknown;
};
type PiperSessionFactory = {
    _instance?: PiperVoiceSession | null;
    create(options: {
        voiceId: string;
        allowLocalModels: boolean;
        fallbackStrategy: string;
        progress: (ev: PiperProgress) => void;
        logger: () => void;
    }): Promise<PiperVoiceSession>;
};
type PiperModule = {
    predict?: (...args: unknown[]) => unknown;
    download?: (voiceId: string, progress: (ev: PiperProgress) => void) => Promise<unknown> | unknown;
    TtsSession?: PiperSessionFactory;
};
type PiperVoiceOptions = {
    enabled?: boolean;
    voiceId?: string;
    moduleUrl?: string;
    moduleLoader?: ((url: string) => Promise<PiperModule> | PiperModule) | null;
    prepareTimeoutMs?: number;
    initialPredictTimeoutMs?: number;
    predictTimeoutMs?: number;
};
type StationRecord = {
    id?: string;
    name?: unknown;
    country?: unknown;
    lat?: unknown;
    lon?: unknown;
};
type SpeechWorld = {
    getStationsNear?: (lat: number, lon: number, radius: number) => StationRecord[] | null | undefined;
    getStationById?: (id: string) => StationRecord | null | undefined;
};
type SpeechStop = {
    stationId?: string;
    locationName?: unknown;
    name?: unknown;
    country?: unknown;
    lat?: unknown;
    latitude?: unknown;
    lon?: unknown;
    longitude?: unknown;
    type?: unknown;
};
type SpeechService = {
    id?: string;
    currentStopIndex?: unknown;
    state?: string;
    isReturnLeg?: boolean;
    stops?: SpeechStop[];
    returnStops?: SpeechStop[];
    getCurrentStops?: () => SpeechStop[] | null | undefined;
};
type StationSpeechMeta = {
    name: string;
    speech: string;
    country: string;
    lat?: number | null;
    lon?: number | null;
    locale: string;
    voiceId: string | null;
    voiceLabel?: string;
    voiceSource?: string;
};
type LivemapAnnouncement = {
    destination: string;
    destinationSpeech: string;
    destinationSpeechMeta: StationSpeechMeta;
    futureStops: string[];
    futureStopsSpeech: string[];
    futureStopsSpeechMeta: StationSpeechMeta[];
    text: string;
};
type LivemapAnnouncerOptions = {
    enabled?: boolean;
    useRecordedPhrases?: boolean;
    rate?: number;
    pitch?: number;
    volume?: number;
    useNeuralFrenchVoice?: boolean;
    useNeuralStationVoices?: boolean;
    neuralReadyTimeoutMs?: number;
    neuralFirstUseWaitMs?: number;
    stationNeuralReadyTimeoutMs?: number;
    neuralTts?: PiperFrenchNeuralVoice;
    neuralVoiceId?: string;
    neuralModuleUrl?: string;
    neuralModuleLoader?: PiperVoiceOptions['moduleLoader'];
    neuralPrepareTimeoutMs?: number;
    neuralInitialPredictTimeoutMs?: number;
    neuralPredictTimeoutMs?: number;
    voiceReadyTimeoutMs?: number;
    voicePollMs?: number;
    allowLanguageFallback?: boolean;
    speechWatchdogMs?: number;
    mediaWatchdogMs?: number;
};
export declare const PIPER_STATION_VOICES: Readonly<{
    'fr-FR': Readonly<{
        voiceId: "fr_FR-siwis-low";
        label: "Siwis";
        source: "Piper";
    }>;
    'de-DE': Readonly<{
        voiceId: "de_DE-eva_k-x_low";
        label: "Eva K";
        source: "Piper";
    }>;
    'it-IT': Readonly<{
        voiceId: "it_IT-riccardo-x_low";
        label: "Riccardo";
        source: "Piper";
    }>;
    'es-ES': Readonly<{
        voiceId: "es_ES-carlfm-x_low";
        label: "Carl FM";
        source: "Piper";
    }>;
    'ca-ES': Readonly<{
        voiceId: "ca_ES-upc_ona-x_low";
        label: "UPC Ona";
        source: "Piper";
    }>;
    'eu-ES': Readonly<{
        voiceId: "eu_ES-maider-medium";
        label: "Maider";
        source: "Piper";
    }>;
    'en-GB': Readonly<{
        voiceId: "en_GB-alba-medium";
        label: "Alba";
        source: "Piper";
    }>;
    'cy-GB': Readonly<{
        voiceId: "cy_GB-bu_tts-medium";
        label: "BU TTS";
        source: "Piper";
    }>;
    'ru-RU': Readonly<{
        voiceId: "ru_RU-irina-medium";
        label: "Irina";
        source: "Piper";
    }>;
    'uk-UA': Readonly<{
        voiceId: "uk_UA-ukrainian_tts-medium";
        label: "Ukrainian TTS";
        source: "Piper";
    }>;
    'ro-RO': Readonly<{
        voiceId: "ro_RO-mihai-medium";
        label: "Mihai";
        source: "Piper";
    }>;
    'hu-HU': Readonly<{
        voiceId: "hu_HU-berta-medium";
        label: "Berta";
        source: "Piper";
    }>;
    'nl-NL': Readonly<{
        voiceId: "nl_NL-mls_5809-low";
        label: "MLS 5809";
        source: "Piper";
    }>;
    'nl-BE': Readonly<{
        voiceId: "nl_BE-nathalie-x_low";
        label: "Nathalie";
        source: "Piper";
    }>;
    'cs-CZ': Readonly<{
        voiceId: "cs_CZ-kasandra-medium";
        label: "Kasandra";
        source: "Piper";
    }>;
    'no-NO': Readonly<{
        voiceId: "no_NO-talesyntese-medium";
        label: "Talesyntese";
        source: "Piper";
    }>;
    'fi-FI': Readonly<{
        voiceId: "fi_FI-harri-low";
        label: "Harri";
        source: "Piper";
    }>;
    'da-DK': Readonly<{
        voiceId: "da_DK-talesyntese-medium";
        label: "Talesyntese";
        source: "Piper";
    }>;
    'pl-PL': Readonly<{
        voiceId: "pl_PL-mls_6892-low";
        label: "MLS 6892";
        source: "Piper";
    }>;
    'et-EE': Readonly<{
        voiceId: "et_EE-news-medium";
        label: "News";
        source: "Piper";
    }>;
    'lv-LV': Readonly<{
        voiceId: "lv_LV-aivars-medium";
        label: "Aivars";
        source: "Piper";
    }>;
    'sv-SE': Readonly<{
        voiceId: "sv_SE-alma-medium";
        label: "Alma";
        source: "Piper";
    }>;
    'lb-LU': Readonly<{
        voiceId: "lb_LU-marylux-medium";
        label: "Marylux";
        source: "Piper";
    }>;
    'sk-SK': Readonly<{
        voiceId: "sk_SK-lili-medium";
        label: "Lili";
        source: "Piper";
    }>;
    'pt-PT': Readonly<{
        voiceId: "pt_PT-tugão-medium";
        label: "Tugão";
        source: "Piper";
    }>;
    'sl-SI': Readonly<{
        voiceId: "sl_SI-artur-medium";
        label: "Artur";
        source: "Piper";
    }>;
    'sq-AL': Readonly<{
        voiceId: "sq_AL-edon-medium";
        label: "Edon";
        source: "Piper";
    }>;
    'sr-RS': Readonly<{
        voiceId: "sr_RS-serbski_institut-medium";
        label: "Serbski Institut";
        source: "Piper";
    }>;
    'bg-BG': Readonly<{
        voiceId: "bg_BG-dimitar-medium";
        label: "Dimitar";
        source: "Piper";
    }>;
    'el-GR': Readonly<{
        voiceId: "el_GR-rapunzelina-medium";
        label: "Rapunzelina";
        source: "Piper";
    }>;
    'is-IS': Readonly<{
        voiceId: "is_IS-ugla-medium";
        label: "Ugla";
        source: "Piper";
    }>;
    'tr-TR': Readonly<{
        voiceId: "tr_TR-dfki-medium";
        label: "DFKI";
        source: "Piper";
    }>;
    'ka-GE': Readonly<{
        voiceId: "ka_GE-natia-medium";
        label: "Natia";
        source: "Piper";
    }>;
    'hy-AM': Readonly<{
        voiceId: "hy_AM-gor-medium";
        label: "Gor";
        source: "Piper";
    }>;
    'az-AZ': Readonly<{
        voiceId: null;
        label: "System Azerbaijani";
        source: "system";
    }>;
    'lt-LT': Readonly<{
        voiceId: null;
        label: "System Lithuanian";
        source: "system";
    }>;
    'hr-HR': Readonly<{
        voiceId: null;
        label: "System Croatian";
        source: "system";
    }>;
    'bs-BA': Readonly<{
        voiceId: null;
        label: "System Bosnian";
        source: "system";
    }>;
    'mk-MK': Readonly<{
        voiceId: null;
        label: "System Macedonian";
        source: "system";
    }>;
    'be-BY': Readonly<{
        voiceId: null;
        label: "System Belarusian";
        source: "system";
    }>;
    'sr-ME': Readonly<{
        voiceId: null;
        label: "System Montenegrin/Serbian";
        source: "system";
    }>;
}>;
export declare function resolveStationSpeechLocale(country: unknown, lat?: unknown, lon?: unknown, name?: unknown): string;
export declare function stationVoiceProfile(country: unknown, lat?: unknown, lon?: unknown, name?: unknown): {
    locale: string;
    country: string;
    voiceId: string | null;
    label: string;
    source: string;
};
export declare class PiperFrenchNeuralVoice {
    enabled: boolean;
    voiceId: string;
    moduleUrl: string;
    moduleLoader: PiperVoiceOptions['moduleLoader'];
    prepareTimeoutMs: number;
    initialPredictTimeoutMs: number;
    predictTimeoutMs: number;
    preparing: boolean;
    lastError: string;
    progress: number;
    _modulePromise: Promise<PiperModule> | null;
    _readyVoices: Set<string>;
    _preparePromises: Map<string, Promise<boolean>>;
    _sessionPromises: Map<string, Promise<PiperVoiceSession>>;
    _sessions: Map<string, PiperVoiceSession>;
    _sessionCreateChain: Promise<void>;
    _opfsProbePromise: Promise<boolean> | null;
    constructor(options?: PiperVoiceOptions);
    get ready(): unknown;
    set ready(v: unknown);
    isVoiceReady(voiceId?: unknown): boolean;
    _probeOpfsCache(): Promise<boolean>;
    _loadModule(): Promise<PiperModule>;
    _onProgress(event: PiperProgress): void;
    _getVoiceSession(mod: PiperModule, voiceId: unknown): Promise<PiperVoiceSession | null | undefined>;
    synthesize(text: unknown, voiceId?: unknown): Promise<object | null>;
    prepareVoice(voiceId?: unknown, warmText?: unknown): Promise<boolean> | undefined;
    prepare(): Promise<boolean> | undefined;
}
export declare function normalizeStationForSpeech(name: unknown, locale?: unknown): string;
export declare function joinFrenchList(items: unknown[] | null | undefined): string;
export declare function buildLivemapAnnouncement(svc: SpeechService | null | undefined, world: SpeechWorld | null | undefined): LivemapAnnouncement | null;
export declare class LivemapTrainAnnouncer {
    game: {
        world?: SpeechWorld;
    };
    enabled: boolean;
    useRecordedPhrases: boolean;
    rate: number;
    pitch: number;
    volume: number;
    useNeuralFrenchVoice: boolean;
    useNeuralStationVoices: boolean;
    neuralReadyTimeoutMs: number;
    neuralFirstUseWaitMs: number;
    stationNeuralReadyTimeoutMs: number;
    neuralTts: PiperFrenchNeuralVoice;
    voiceReadyTimeoutMs: number;
    voicePollMs: number;
    allowLanguageFallback: boolean;
    speechWatchdogMs: number;
    mediaWatchdogMs: number;
    voice: SpeechSynthesisVoice | null;
    _voices: SpeechSynthesisVoice[];
    lastError: string;
    _runToken: number;
    _currentAudio: HTMLAudioElement | null;
    _currentAudioFinish: ((ok: boolean) => void) | null;
    _mediaElement: HTMLAudioElement | null;
    _audioContext: AudioContext | null;
    _audioUnlocked: boolean;
    _currentBufferSource: AudioBufferSourceNode | null;
    _currentBufferFinish: ((ok: boolean) => void) | null;
    _currentObjectUrl: string | null;
    _lastServiceId: string | null;
    _audioDiag: Record<string, unknown>;
    constructor(game: unknown, options?: LivemapAnnouncerOptions);
    _publishAudioDiagnostics(stage: unknown, extra?: Record<string, unknown>): {
        stage: string;
        protocol: string;
        secureContext: boolean | null;
        opfs: boolean;
        voices: {
            name: string;
            lang: string;
            local: boolean;
        }[];
        frenchVoice: {
            name: string;
            lang: string;
        } | null;
        piperReady: boolean;
        piperPreparing: boolean;
        piperError: string;
        lastError: string;
    };
    getAudioDiagnostics(): {
        stage: string;
        protocol: string;
        secureContext: boolean | null;
        opfs: boolean;
        voices: {
            name: string;
            lang: string;
            local: boolean;
        }[];
        frenchVoice: {
            name: string;
            lang: string;
        } | null;
        piperReady: boolean;
        piperPreparing: boolean;
        piperError: string;
        lastError: string;
    };
    prepareNeuralVoice(): Promise<boolean>;
    _loadVoices(): SpeechSynthesisVoice | null;
    _systemVoiceForLocale(locale: unknown): SpeechSynthesisVoice | null;
    _waitForLocaleVoice(locale: unknown, token: unknown, timeoutMs?: number): Promise<SpeechSynthesisVoice | null>;
    _waitForFrenchVoice(token: number, timeoutMs?: number): Promise<SpeechSynthesisVoice | null>;
    _getMediaElement(): HTMLAudioElement | null;
    _unlockAudioFromGesture(): boolean;
    _blobArrayBuffer(blob: Blob): Promise<ArrayBuffer>;
    _decodeAudioBuffer(ctx: BaseAudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer>;
    _playNeuralViaContextAsync(blob: Blob, token: number): Promise<unknown>;
    _playMediaSrcAsync(src: unknown, token: unknown): Promise<unknown>;
    cancel(): void;
    _makeUtterance(text: string): SpeechSynthesisUtterance | null;
    _speakAsync(text: string, token: number): Promise<unknown>;
    _makeLocaleUtterance(text: string, locale: unknown, voice: SpeechSynthesisVoice | null | undefined): SpeechSynthesisUtterance | null;
    _makeLocaleHintUtterance(text: string, locale: unknown): SpeechSynthesisUtterance | null;
    _speakLocaleHintAsync(text: string, locale: unknown, token: number): Promise<unknown>;
    _speakLocaleSystemAsync(text: string, locale: unknown, token: number, readyTimeoutMs?: number): Promise<unknown>;
    _neuralVoiceReady(voiceId: unknown): boolean;
    _prepareNeuralVoiceId(voiceId: unknown, warmText?: unknown): Promise<boolean | undefined>;
    _speakNeuralVoiceIdAsync(text: string, voiceId: string, token: number): Promise<unknown>;
    _prewarmStationVoices(announcement: LivemapAnnouncement): void;
    _speakStationMetaAsync(meta: StationSpeechMeta, token: number, frenchMode?: 'auto' | 'neural' | 'system'): Promise<unknown>;
    _speakStationSequenceAsync(metas: StationSpeechMeta[], token: number, frenchMode?: 'auto' | 'neural' | 'system'): Promise<boolean>;
    _playNeuralBlobAsync(blob: Blob, token: number): Promise<unknown>;
    _speakNeuralAsync(text: string, token: number): Promise<unknown>;
    _speakDynamicAsync(text: string, token: number, mode?: 'auto' | 'neural' | 'system'): Promise<unknown>;
    _playOneRecordedAsync(src: string, token: number): Promise<unknown>;
    _playRecordedAsync(sources: string | readonly string[], token: number): Promise<boolean>;
    _runHybrid(announcement: LivemapAnnouncement, token: number): Promise<void>;
    _runTtsOnly(announcement: LivemapAnnouncement, token: number): Promise<void>;
    announce(svc: SpeechService): boolean;
}
export {};
