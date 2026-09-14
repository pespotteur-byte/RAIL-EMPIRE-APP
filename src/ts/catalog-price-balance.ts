// Rail Empire — Game Purchase Price Balance V2 (Batch186 Full Catalog)
// These are gameplay/economy prices, not asserted historical procurement prices.

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const sane = (v: unknown, lo: number, hi: number, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
};
const round10k = (v: number): number => Math.max(10000, Math.round(v / 10000) * 10000);

export interface CatalogPriceItem { [key: string]: unknown; name?:string; seriesName?:string; realIdentitySeries?:string; mlgSeriesName?:string; maxSpeed?:number; power?:number; length?:number; passengerCapacity?:number; freightCapacity?:number; imageData?:string; category?:string; traction?:string; }
export interface BalancedPriceResult { price:number; cls:string; }
function priceOne(item: CatalogPriceItem): BalancedPriceResult {
  const text = `${item.name || ''} ${item.seriesName || ''} ${item.realIdentitySeries || ''} ${item.mlgSeriesName || ''}`.toLowerCase();
  // High-speed detection deliberately ignores descriptive livery text in seriesName when
  // no validated identity is attached (e.g. a RIO painted 'façon TGV Atlantique').
  const identityText = `${item.realIdentitySeries || ''} ${item.mlgSeriesName || ''}`.toLowerCase();
  const typeText = `${item.name || ''} ${identityText}`.toLowerCase();
  const speed = sane(item.maxSpeed, 0, 400, 0);
  const power = sane(item.power, 0, 20000, 0);
  const length = sane(item.length, 2, 400, 20);
  const seats = sane(item.passengerCapacity, 0, 2500, 0);
  const freight = sane(item.freightCapacity, 0, 200, 0);

  const highSpeed = /\b(tgv|ice\s?\d*|eurostar|thalys|ave\b|velaro|agv\b|frecciarossa|etr\s?500|etr\s?1000|pendolino|railjet\s?x)\b/.test(typeText) || speed >= 250;
  const fullSet = highSpeed && (length >= 75 || /\/composed\//.test(item.imageData || '') || /\b(rame|trainset|complete set|composition)\b/.test(text) && length >= 55);
  const hsComponent = highSpeed && !fullSet && length <= 40;
  const hsPowerHead = hsComponent && /\b(motrice|power car|power head|triebkopf|motor car|m\s?car)\b/.test(text);

  // Explicit user rule: a complete high-speed train never exceeds 6 M€.
  if (fullSet) {
    const p = 4_300_000 + Math.max(0, speed - 250) * 4_000 + Math.max(0, length - 100) * 5_000;
    return { price: round10k(clamp(p, 4_300_000, 6_000_000)), cls: 'GRANDE_VITESSE_RAME_COMPLETE' };
  }
  // MLG often stores TGV/ICE vehicles car-by-car. Component prices are deliberately
  // chosen so a normal 8–12 vehicle high-speed formation remains around/below 6 M€.
  if (hsComponent) {
    const base = hsPowerHead ? 700_000 : 420_000;
    const p = base + (hsPowerHead ? power * 12 : seats * 350) + Math.max(0, speed - 250) * 350;
    return { price: round10k(clamp(p, hsPowerHead ? 600_000 : 320_000, hsPowerHead ? 850_000 : 520_000)), cls: hsPowerHead ? 'GRANDE_VITESSE_MOTRICE' : 'GRANDE_VITESSE_REMORQUE' };
  }
  if (highSpeed) {
    const p = 1_800_000 + power * 80 + speed * 2_500 + length * 5_000;
    return { price: round10k(clamp(p, 1_800_000, 4_500_000)), cls: 'GRANDE_VITESSE_ELEMENT' };
  }

  if (item.category === 'locomotive') {
    const steam = item.traction === 'vapeur' || /vapeur|steam/.test(text);
    const shunter = /locotracteur|shunter|rangier|köf|y\s?\d/.test(text) || power > 0 && power < 700;
    let p;
    if (steam) p = 480_000 + power * 120 + speed * 900;
    else if (shunter) p = 300_000 + power * 350 + speed * 800;
    else p = 650_000 + power * 420 + speed * 1_800;
    return { price: round10k(clamp(p, 280_000, 4_200_000)), cls: steam ? 'LOCOMOTIVE_VAPEUR' : (shunter ? 'LOCOTRACTEUR' : 'LOCOMOTIVE') };
  }

  if (item.category === 'automotrice') {
    // Most MLG EMUs are represented car-by-car, so length strongly controls price.
    let p = 500_000 + power * 190 + speed * 1_400 + seats * 700 + length * 4_000;
    if (length >= 60) p += 500_000;
    return { price: round10k(clamp(p, 450_000, 4_200_000)), cls: 'AUTOMOTRICE' };
  }

  if (item.category === 'voiture') {
    const premium = /restaurant|dining|pullman|lit|sleep|bar|salon/.test(text) ? 80_000 : 0;
    const p = 110_000 + seats * 1_900 + speed * 550 + length * 3_200 + premium;
    return { price: round10k(clamp(p, 100_000, 650_000)), cls: 'VOITURE' };
  }

  if (item.category === 'wagon') {
    const special = /grue|crane|transformer|torpedo|nuclé|nuclear|special|surbaissé|schnabel/.test(text) ? 130_000 : 0;
    const p = 45_000 + freight * 1_900 + speed * 250 + length * 1_400 + special;
    return { price: round10k(clamp(p, 45_000, 380_000)), cls: special ? 'WAGON_SPECIAL' : 'WAGON' };
  }

  return { price: 250_000, cls: 'AUTRE' };
}

export function applyBalancedPurchasePrices<T extends CatalogPriceItem>(catalog: readonly T[]): Array<T & {purchasePrice:number; purchasePriceBasis:string; purchasePriceClass:string; purchasePriceNote:string}> {
  return catalog.map(item => {
    const { price, cls } = priceOne(item);
    return {
      ...item,
      purchasePrice: Math.min(price, 6_000_000),
      purchasePriceBasis: 'GAME_BALANCE_V2_2026',
      purchasePriceClass: cls,
      purchasePriceNote: 'Tarif d’équilibrage Rail Empire; ne représente pas un prix historique réel.'
    };
  });
}

export function validateBalancedPurchasePrices(catalog: readonly CatalogPriceItem[]): { total:number; bad:number; max:number; min:number } {
  const priced = applyBalancedPurchasePrices(catalog);
  const bad = priced.filter(x => !Number.isFinite(x.purchasePrice) || x.purchasePrice <= 0 || x.purchasePrice > 6_000_000);
  return { total: priced.length, bad: bad.length, max: Math.max(...priced.map(x => x.purchasePrice)), min: Math.min(...priced.map(x => x.purchasePrice)) };
}
