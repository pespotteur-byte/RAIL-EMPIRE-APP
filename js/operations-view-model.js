const positive = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
/** Cargo statistics already include both generic freight and fulfilled contracts. Never add them twice. */
export function transportTotals(economy, cargo) {
    return { passengers: Math.floor(positive(economy.totalPassengers)), freightTonnes: Math.max(positive(economy.totalFreightTonnes), positive(cargo?.totalTonnage)) };
}
export function clockText(minute) {
    if (minute == null || !Number.isFinite(minute))
        return '—';
    const m = ((Math.round(minute) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
export function trainStatus(state, delay, speed) {
    const names = { moving: 'En circulation', departing: 'Départ', waiting: 'En attente', stopped_at_station: 'À l’arrêt', planned: 'Prévu', preparation: 'Préparation', blocked_route: 'Itinéraire bloqué', cancelled: 'Supprimé', completed: 'Terminé' };
    const label = names[state] || state || 'En attente';
    return `${label}${speed > 0 ? ` · ${Math.round(speed)} km/h` : ''}${delay >= 1 ? ` · +${Math.round(delay)} min` : ''}`;
}
export function safeSprite(value) {
    if (typeof value !== 'string')
        return '';
    if (/^data:image\/(?:png|gif|webp|jpeg|bmp);base64,[a-z0-9+/=\s]+$/i.test(value))
        return value;
    if (/^(?:blob:|https?:\/\/)/i.test(value))
        return value;
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value) || /[<>\r\n]/.test(value))
        return '';
    return value;
}
export function setText(root, selector, text) { const el = root.querySelector(selector); if (el && el.textContent !== text)
    el.textContent = text; }
