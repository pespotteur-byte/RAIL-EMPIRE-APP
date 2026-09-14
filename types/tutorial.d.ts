type TutorialStep = {
    title: string;
    text: string;
    target: string | null;
    page: string | null;
    image?: string;
    caption?: string;
};
type TutorialGame = {
    ui?: {
        switchPage: (page: string) => unknown;
    };
};
export declare const PAGE_HELP_LABELS: Readonly<{
    map: "Carte";
    qg: "Quartier général";
    'rolling-stock': "Matériel roulant";
    rames: "Rames";
    liveries: "Livrées";
    schedules: "Horaires / Schedule Creator";
    rotations: "Roulements";
    lines: "Lignes / Réseau";
    depots: "Dépôts & ITE";
    incidents: "Incidents & Travaux";
    infogare: "Infogare";
    dashboard: "Dashboard";
    'graph-marche': "Graphique de marche";
    staff: "Personnel";
    weather: "Météo";
    'cargo-types': "Marchandises";
    'industrial-clients': "Industriels";
    marketing: "Marketing & expérience client";
}>;
export declare class Tutorial {
    steps: readonly TutorialStep[];
    globalSteps: readonly TutorialStep[];
    pageGuides: Readonly<Record<string, readonly TutorialStep[]>>;
    guidePage: string | null;
    currentStep: number;
    active: boolean;
    _overlay: HTMLElement | null;
    _game: TutorialGame | null;
    constructor();
    start(game: TutorialGame): void;
    startPage(page: unknown, game: TutorialGame): void;
    stop(): void;
    next(): void;
    prev(): void;
    _createOverlay(): void;
    _removeOverlay(): void;
    _renderStep(): void;
}
export {};
