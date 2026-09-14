/** RC24 — composition policy. Only identity-preserving permutations run at departure. */
import { SeededRng } from './rng.js';
export function maximumVehicleCount(value) {
    if (value === '' || value == null)
        return null;
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 1)
        throw new Error('Le maximum d’engins doit être un entier positif (locomotives comprises).');
    return count;
}
function pick(random, count) {
    const n = random.random();
    if (!Number.isFinite(n) || n < 0 || n >= 1)
        throw new Error('Source aléatoire invalide.');
    return Math.floor(n * count);
}
export function isMovableWagon(item) {
    return String(item.category || '').toLowerCase() === 'wagon' && !item.isDrivingTrailer && !(Number(item.power) > 0);
}
export function shuffleWagons(items, random) {
    const out = [...items], slots = [];
    for (let i = 0; i < out.length; i++)
        if (isMovableWagon(out[i]))
            slots.push(i);
    for (let i = slots.length - 1; i > 0; i--) {
        const a = slots[i], b = slots[pick(random, i + 1)];
        [out[a], out[b]] = [out[b], out[a]];
    }
    return out;
}
/** A local keyed PRNG avoids changing simulation/weather draws when a consist is randomized. */
export function departureRng(key) {
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++)
        hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return new SeededRng(hash >>> 0);
}
export function randomizeRameDeparture(rame, departureKey) {
    if (!rame.randomizeOnDeparture || !departureKey || rame.randomLastDepartureKey === departureKey)
        return false;
    const previous = rame.elementDetails;
    const shuffled = shuffleWagons(previous, departureRng(`${String(rame.id || '')}|${departureKey}`));
    // The catalogue id array must follow the exact same permutation (including repeated models).
    const catalogue = new Map(previous.map((e, i) => [e, rame.elements[i] || String(e.catalogId || '')]));
    rame.elementDetails = shuffled;
    rame.elements = shuffled.map(e => catalogue.get(e) || '');
    rame.randomLastDepartureKey = departureKey;
    return shuffled.some((e, i) => e !== previous[i]);
}
/** Initial creation may instantiate selected models; departure randomization never calls this. */
export function planRandomWagons(fixed, models, maximum, random) {
    maximum = maximumVehicleCount(maximum);
    if (!fixed.some(e => e.category === 'locomotive'))
        throw new Error('Placez d’abord une locomotive.');
    if (fixed.some(e => !Number.isFinite(Number(e.length)) || Number(e.length) <= 0))
        throw new Error('Longueur d’engin invalide.');
    const usable = models.filter(e => e.category === 'wagon' && Number.isFinite(Number(e.length)) && Number(e.length) >= 0.1);
    if (!usable.length)
        throw new Error('Sélectionnez un modèle de wagon de longueur valide.');
    let totalLength = fixed.reduce((sum, e) => sum + Number(e.length), 0);
    if (totalLength >= 750)
        throw new Error('Les engins fixes occupent déjà les 750 m.');
    if (maximum !== null && maximum <= fixed.length)
        throw new Error('Le maximum doit laisser au moins une place pour un wagon, locomotives comprises.');
    const selected = [], pool = [...usable];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = pick(random, i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const hasSlot = () => maximum === null || fixed.length + selected.length < maximum;
    let modelsUsed = 0;
    for (const item of pool)
        if (hasSlot() && totalLength + Number(item.length) <= 750 + 1e-9) {
            selected.push(item);
            totalLength += Number(item.length);
            modelsUsed++;
        }
    while (hasSlot()) {
        const fits = usable.filter(e => totalLength + Number(e.length) <= 750 + 1e-9);
        if (!fits.length)
            break;
        const item = fits[pick(random, fits.length)];
        selected.push(item);
        totalLength += Number(item.length);
    }
    if (!selected.length)
        throw new Error('Aucun wagon sélectionné ne tient dans la longueur disponible.');
    return { selected, totalLength, modelsUsed };
}
