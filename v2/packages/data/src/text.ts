/** Abréviations courantes des noms de gares, ramenées à une forme unique. */
const ABBREVIATIONS: Record<string, string> = {
  st: 'saint',
  ste: 'sainte',
  sts: 'saints',
  hauptbahnhof: 'hbf',
  bf: 'bahnhof',
  bhf: 'bahnhof',
  centraal: 'central',
  centrale: 'central',
  gare: '',
  station: '',
  stazione: '',
  estacion: '',
  estacao: '',
};

/** Normalisation de texte pour la recherche : sans accents, minuscules, abréviations unifiées, un seul espace. */
export function normalizeText(value: string): string {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!base) return '';
  const out: string[] = [];
  for (const word of base.split(' ')) {
    const replaced = ABBREVIATIONS[word];
    if (replaced === undefined) out.push(word);
    else if (replaced) out.push(replaced);
  }
  return out.length ? out.join(' ') : base;
}
