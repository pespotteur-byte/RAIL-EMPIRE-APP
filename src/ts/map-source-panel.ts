import { isOSMStandard } from './tile-access-policy.js';
import type { TileMap } from './map.js';

/** DOM-only diagnostics. It neither fetches map data nor changes the simulation. */
export class MapSourcePanel {
    private lastRefresh = -Infinity;
    private lastStateKey = '';
    constructor(private map: TileMap, private root: HTMLElement | null) {
        if (!root) return;
        const url = (root.querySelector('[name="tile-url"]') as HTMLInputElement | null);
        const credit = (root.querySelector('[name="tile-credit"]') as HTMLInputElement | null);
        const zoom = (root.querySelector('[name="tile-zoom"]') as HTMLInputElement | null);
        const consent = (root.querySelector('[name="tile-consent"]') as HTMLInputElement | null);
        const result = (root.querySelector('[data-tile-result]') as HTMLElement | null);
        const fill = () => {
            const source = map.getBaseMapSource();
            if (url) url.value = source.url;
            if (credit) credit.value = source.attribution;
            if (zoom) zoom.value = String(source.maxZoom);
        };
        fill();
        root.querySelector('[data-rail-pause]')?.addEventListener('click', () => { map.pauseRailMap(); this.update(true); });
        root.querySelector('[data-rail-retry]')?.addEventListener('click', () => { map.resumeRailMap(); this.update(true); });
        root.querySelector('[data-tile-pause]')?.addEventListener('click', () => { map.pauseBaseMap(); this.update(true); });
        root.querySelector('[data-tile-retry]')?.addEventListener('click', () => {
            const ok = map.resumeBaseMap();
            if (result) result.textContent = ok ? 'Nouvel essai autorisé pour les seules tuiles visibles.' : 'Le délai du service ou le mode de lancement interdit encore cet essai.';
            this.update(true);
        });
        root.querySelector('[data-tile-standard]')?.addEventListener('click', () => {
            map.selectOSMStandard();
            fill(); if (consent) consent.checked = false;
            if (result) result.textContent = 'Fond OpenStreetMap original sélectionné. Une suspension existante reste respectée.';
            this.update(true);
        });
        root.querySelector('form')?.addEventListener('submit', event => {
            event.preventDefault();
            try {
                if (!consent?.checked) throw new Error('Confirmer que cet usage est autorisé par le fournisseur.');
                map.setBaseMapSource({ url: url?.value || '', attribution: credit?.value || '', maxZoom: Number(zoom?.value) });
                if (result) result.textContent = 'Source enregistrée sur ce navigateur. Aucun basculement automatique vers un autre fournisseur.';
                consent.checked = false;
            } catch (error: unknown) {
                if (result) result.textContent = error instanceof Error ? error.message : 'Configuration invalide.';
            }
            this.update(true);
        });
        this.update(true);
    }
    update(force = false): void {
        const now = typeof performance === 'undefined' ? Date.now() : performance.now();
        const root = this.root;
        if (!root) return;
        const state = this.map.getBaseMapAccess(), source = this.map.getBaseMapSource();
        const rail = this.map.getRailMapAccess();
        // Throttle unchanged countdowns, not transitions: a newly received refusal
        // must replace a loading notice on the very next render.
        const key = [source.url, state.kind, state.status, state.until, state.blockedReason, rail.kind, rail.status, rail.until,
            this.map.basicMode, this.map.satelliteEnabled, this.map.nightMapEnabled,
            this.map.railEnabled, this.map.hasVisibleBaseTiles()].join('|');
        if (!force && key === this.lastStateKey && now - this.lastRefresh < 250) return;
        this.lastStateKey = key;
        this.lastRefresh = now;
        const name = isOSMStandard(source.url) ? 'OSM' : new URL(source.url).hostname;
        const minutes = Math.max(0, Math.ceil((state.until - Date.now()) / 60_000));
        const wait = minutes ? ` Prochain essai au plus tôt dans ${minutes} min.` : '';
        let message = '';
        switch (state.kind) {
            case 'local-file':
                message = 'Fond OSM suspendu dans ce contexte de document. Ouvrir directement index.html dans le navigateur (file://), ou utiliser une page HTTP/HTTPS. Aucun lanceur n’est nécessaire.'; break;
            case 'forbidden':
                message = `Accès refusé par le fournisseur (${state.blockedReason ? `x-blocked ; réponse HTTP ${state.status}` : `HTTP ${state.status}`}). Requêtes arrêtées, sans relance automatique. Vérifier identification, attribution et règles d’utilisation avant de réessayer.${wait}`; break;
            case 'rate-limit':
                message = `Service saturé (HTTP 429). Pause des requêtes ; le délai du fournisseur est respecté.${wait}`; break;
            case 'unavailable':
                message = state.status ? `Fond indisponible (HTTP ${state.status}).${wait}` : `Fond inaccessible : réseau, CORS ou décodage ; le statut HTTP n’est pas lisible.${wait}`; break;
            case 'paused':
                message = `Fond suspendu manuellement. Les tuiles déjà chargées restent utilisables.${wait}`; break;
            case 'ready': message = this.map.hasVisibleBaseTiles() ? 'Fond affiché ; seules les tuiles de la vue sont demandées, avec le cache HTTP du navigateur.' : 'Chargement du fond pour la vue affichée ; aucune image cartographique reçue dans cette vue pour le moment.'; break;
        }
        if (this.map.satelliteEnabled) message += ' Le fond satellite est actuellement sélectionné.';
        if (this.map.nightMapEnabled) message += ' ' + this.map.getMapAppearanceLabel() + '.';
        const text = (root.querySelector('[data-tile-status]') as HTMLElement | null);
        if (text && text.textContent !== message) text.textContent = message;
        const summary = (root.querySelector('[data-tile-summary]') as HTMLElement | null);
        const imagery = this.map.satelliteEnabled;
        const summaryText = imagery ? `Fond satellite${this.map.nightMapEnabled ? ' nocturne' : ''}` : `Fond ${name}${this.map.nightMapEnabled ? ' · nuit' : this.map.basicMode ? ' original' : ' sombre'} · ${state.kind === 'ready' ? (this.map.hasVisibleBaseTiles() ? 'affiché' : 'chargement') : state.kind === 'local-file' ? 'contexte non pris en charge' : 'suspendu'}`;
        const notice = root.ownerDocument?.getElementById('map-base-notice');
        if (notice) {
            const show = !imagery && (state.kind !== 'ready' || !this.map.hasVisibleBaseTiles());
            notice.hidden = !show;
            const body = notice.querySelector('[data-base-notice-text]');
            if (show && body && body.textContent !== message) body.textContent = message;
        }
        if (summary && summary.textContent !== summaryText) summary.textContent = summaryText;
        const railText = root.querySelector('[data-rail-status]') as HTMLElement | null;
        const railWait = Math.max(0, Math.ceil((rail.until - Date.now()) / 60_000));
        const railMessage = rail.kind === 'ready' ? `Couche ORM : ${this.map.railEnabled ? 'disponible' : 'non affichée'}.`
            : `Couche ORM : ${rail.kind === 'forbidden' ? 'accès refusé' : rail.kind === 'paused' ? 'suspendue manuellement' : 'temporairement suspendue'}${rail.status ? ` (HTTP ${rail.status})` : ''}. ${rail.manual ? 'Aucune relance automatique.' : 'Nouvel essai temporisé.'}${railWait ? ` Attendre au moins ${railWait} min.` : ''}`;
        if (railText && railText.textContent !== railMessage) railText.textContent = railMessage;
        const railRetry = root.querySelector('[data-rail-retry]') as HTMLButtonElement | null;
        if (railRetry) railRetry.disabled = rail.kind === 'ready' || rail.until > Date.now();
        const railPause = root.querySelector('[data-rail-pause]') as HTMLButtonElement | null;
        if (railPause) railPause.disabled = rail.kind !== 'ready';
        if (summary && rail.kind !== 'ready') summary.textContent = summaryText + ' · ORM suspendu';
        root.classList.toggle('map-source-warning', state.kind !== 'ready' || rail.kind !== 'ready');
        const retry = (root.querySelector('[data-tile-retry]') as HTMLButtonElement | null);
        if (retry) {
            retry.disabled = state.kind === 'local-file' || state.kind === 'ready' || state.until > Date.now();
            retry.title = state.kind === 'forbidden' ? 'Réessayer seulement après avoir corrigé la cause du refus ; ceci ne lève pas un blocage côté fournisseur.' : 'Respecte le délai du fournisseur.';
        }
        const pause = (root.querySelector('[data-tile-pause]') as HTMLButtonElement | null);
        if (pause) pause.disabled = state.kind !== 'ready';
    }
}
