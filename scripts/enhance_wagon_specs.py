#!/usr/bin/env python3
"""Enhance wagon specs by searching French railway sources on the web.

For each distinct wagon model name in the catalog, query general and
site-specific search engines (DB Cargo, Ermewa, VTG, Wascosa, TatraWagonka,
rail21, NACCO, ELL, Beacon, MRCE, AAE, constructors, Train Empire, etc.)
without using Wikipedia/Wikidata.

The parser extracts:
  - tare (mass) in tonnes
  - loaded maximum speed (km/h)
  - maximum payload (freightCapacity) in tonnes
  - volume (m³) as fallback for hoppers/tankers

Length is NOT updated: it is computed in-game from image width (1 px = 10 cm).
"""
import asyncio
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

try:
    from devin_tools import call_tool
except Exception:
    call_tool = None


def _find_repo():
    env = os.environ.get('REPO')
    if env and Path(env).exists():
        return Path(env)
    for p in [Path('/home/ubuntu/repos/RAIL-EMPIRE-APP'), Path('/root/repos/RAIL-EMPIRE-APP'), Path.cwd()]:
        if (p / 'js' / 'catalog-data.js').exists():
            return p
    return Path.cwd()


REPO = _find_repo()
CATALOG_PATH = REPO / 'js/catalog-data.js'
CACHE_PATH = REPO / 'scripts' / '.wagon_specs_cache.json'

sys.path.insert(0, str(REPO / 'scripts'))
import rebuild_mlg_catalog as rb

WHITELIST = [
    'gueterwagenkatalog.dbcargo.com',
    'ermewa.com',
    'vtg.com',
    'vtg-rail.com',
    'wascosa.com',
    'tatravagonka',
    'tatra-wagon',
    'rail21',
    'railcargo',
    'nacco',
    'ell.eu',
    'europeanlocomotive',
    'beaconrail',
    'mrce',
    'aae',
    'aaesolutions.de',
    'siemens.com',
    'alstom.com',
    'bombardier.com',
    'railwaygazette',
    'railjournal',
    'railway-technology',
    'euro-wagon',
    'railtrans',
    'wagony.cz',
    'rail-color',
    'train-empire',
    'railwaypassenger',
    'wfwagon',
    'railcargogroup',
    'trenitalia',
    'sncf.com',
    'db.com',
    'dbsystel',
    'trains-europe.fr',
    'lestrainsjouef.free.fr',
    'docrail.fr',
    'patrimoine-ferroviaire.fr',
    'gibitrains.fr',
    'trainworld.be',
    'railcolor',
    'railwaygazette.com',
    'railway-technology.com',
    'railjournal.com',
    'tatravagonka.cz',
    'tatra-waggonka',
]

BLACKLIST = [
    'wikipedia.org', 'wikidata.org',
    'truckscout24', 'top-factories', 'made-in-china', 'ebay', 'amazon',
    'aliexpress', 'youtube', 'facebook', 'twitter', 'instagram', 'pinterest',
    'linkedin', 'reddit', 'tiktok', 'google.', 'bing.', 'yahoo.',
]

CARGO_KEYWORDS = {
    'grain': ['grain', 'cereal', 'céréale', 'maize', 'maïs', 'barley', 'orge', 'rye', 'seigle', 'soybean', 'soja', 'wheat', 'blé', 'oats', 'avoine', 'millet'],
    'flour': ['flour', 'farine'],
    'sugar': ['sugar', 'sucre'],
    'salt': ['salt', 'sel'],
    'coal': ['raw coal', 'briquettes', 'coke', 'charbon', 'houille'],
    'ore': ['iron ore', 'copper ore', 'bauxite', 'minerai', 'non-metallic minerals'],
    'gravel': ['gravel', 'aggregate', 'granulat', 'ballast', 'sand', 'sable'],
    'sand': ['sand', 'sable'],
    'ballast': ['ballast'],
    'limestone': ['limestone', 'calcaire'],
    'cement': ['cement', 'ciment'],
    'clinker': ['clinker'],
    'coke': ['coke'],
    'bauxite': ['bauxite'],
    'fertilizer': ['fertiliser', 'fertilizer', 'engrais'],
    'potash': ['potash', 'potasse', 'kali'],
    'phosphate': ['phosphate'],
    'kaolin': ['kaolin'],
    'alumina': ['alumina', 'aluminium hydroxide'],
    'steel': ['steel', 'acier', 'sheet metal', 'semi-finished steel', 'slab', 'rod iron', 'sinter', 'pig-iron', 'fonte', 'aggloméré'],
    'steel-coils': ['coil', 'bobine', 'slit strip', 'sheet metal coils'],
    'steel-sheet': ['sheet metal', 'tôle', 'steel sheet', 'steel sheets'],
    'steel-beams': ['beam', 'poutrelle', 'profile', 'structural steel'],
    'scrap': ['scrap', 'ferraille'],
    'containers': ['container', 'conteneur', 'swap body', 'semi-trailer', 'pocket wagon'],
    'vehicles': ['vehicle', 'automotive', 'car transport', 'car carrier', 'stva', 'gefc', 'transport de voitures'],
    'wood': ['wood', 'timber', 'log', 'bois', 'sawn wood'],
    'paper': ['paper', 'pulp'],
    'oil': ['oil', 'petrol', 'fuel oil', 'diesel oil', 'pétrole'],
    'chemicals': ['chemical', 'produit chimique', 'hazardous goods', 'matières dangereuses'],
    'acid': ['acid', 'acide'],
    'ammonia': ['ammonia', 'ammoniac'],
    'lng': ['lng', 'liquefied natural gas', 'gaz naturel liquéfié'],
    'lpg': ['lpg', 'gpl', 'propane', 'butane'],
    'milk': ['milk', 'lait'],
    'wine': ['wine', 'vin'],
    'sulphur': ['sulphur', 'soufre'],
    'refrigerated': ['refrigerated', 'frigorifique', 'réfrigéré'],
    'meat': ['meat', 'viande'],
    'waste': ['waste', 'dechet', 'déchet', 'slag', 'scories'],
    'livestock': ['livestock', 'bétail', 'animaux'],
    'post': ['post', 'courrier', 'postal'],
    'general': ['general cargo', 'marchandises générales', 'marchandise diverse'],
}


def parse_num(s):
    if not s:
        return None
    s = re.sub(r'\s+', '', s.strip())
    if not s:
        return None
    # Decide whether a comma is a decimal separator or thousands separator.
    if ',' in s:
        # e.g. "12,792" -> thousands ; "24,5" -> decimal
        if re.fullmatch(r'\d{1,3},\d{3}', s):
            s = s.replace(',', '')
        else:
            s = s.replace(',', '.')
    try:
        return float(s)
    except Exception:
        return None


def parse_catalog():
    text = CATALOG_PATH.read_text(encoding='utf-8')
    ct_start = text.find('export const CATALOG_CARGO_TYPES')
    ct_br = text.find('[', ct_start)
    ct_end = text.find('];', ct_br) + 1
    cargo = json.loads(text[ct_br:ct_end])
    cat_start = text.find('export const CATALOG = [')
    cat_br = text.find('[', cat_start)
    bal = 0
    in_str = False
    esc = False
    i = cat_br
    while i < len(text):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '[':
                bal += 1
            elif c == ']':
                bal -= 1
                if bal == 0:
                    break
        i += 1
    catalog = json.loads(text[cat_br:i + 1])
    suffix = text[i + 1:]
    prefix = text[:ct_start]
    return cargo, catalog, prefix, suffix


def write_catalog(cargo, catalog, prefix, suffix):
    tmp = CATALOG_PATH.with_suffix('.js.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(prefix)
        f.write('export const CATALOG_CARGO_TYPES = ')
        f.write(json.dumps(cargo, indent=2, ensure_ascii=False))
        f.write(';\n\n')
        f.write('export const CATALOG = ')
        f.write(json.dumps(catalog, indent=2, ensure_ascii=False))
        f.write(';')
        f.write(suffix)
    os.replace(tmp, CATALOG_PATH)


def parse_page(text):
    import html
    specs = {}
    text = html.unescape(text)
    plain = re.sub(r'<[^>]+>', ' ', text)
    plain = re.sub(r'\s+', ' ', plain)
    text_n = plain
    low = text_n.lower()

    # --- tare / mass ---
    tare = None
    m = re.search(
        r'(?:Average\s+)?tare\s+weight\s*\(?(kg|t|to|tons|tonnes)\)?\s*[^\d>≤]*(?:>\s*)?([\d\s,]+(?:[.,]\d+)?)(?:\s*(?:t|to|tons|tonnes|kg)?\s*≤\s*([\d\s,]+(?:[.,]\d+)?))?',
        text_n, re.I | re.S)
    if m:
        unit = m.group(1).lower()
        v1 = parse_num(m.group(2))
        v2 = parse_num(m.group(3))
        val = ((v1 + v2) / 2) if (v1 and v2) else (v1 or v2)
        if val:
            tare = val / 1000 if 'kg' in unit else val
    if not tare:
        m = re.search(
            r'(?:tare|masse\s+à\s+vide|poids\s+à\s+vide|poids\s+en\s+ordre\s+de\s+marche\s+vide)\s*[:\]]?\s*(?:environ|env\.|ca\.|about|c\.|~)?\s*([\d\s,]+(?:[.,]\d+)?)(?:\s*-\s*([\d\s,]+(?:[.,]\d+)?))?\s*(?:t|tonnes?|to)\b',
            text_n, re.I | re.S)
        if m:
            v1 = parse_num(m.group(1))
            v2 = parse_num(m.group(2))
            val = ((v1 + v2) / 2) if (v1 and v2) else (v1 or v2)
            if val:
                tare = val
    if tare:
        specs['mass'] = round(tare, 2)

    # --- max speed (loaded when explicitly stated) ---
    speed = None
    # explicit loaded speed
    m = re.search(r'(?:vitesse|speed).*?(?:charg[ée]e?|en\s+charge|loaded)\s*[:\)]?\s*([\d\s,]+(?:[.,]\d+)?)\s*km/h', text_n, re.I | re.S)
    if not m:
        m = re.search(r'(?:charg[ée]e?|en\s+charge|loaded)\s*[:\)]?\s*(?:vitesse|speed)\s*[:\)]?\s*([\d\s,]+(?:[.,]\d+)?)\s*km/h', text_n, re.I | re.S)
    if not m:
        # "120 km/h à vide / 100 km/h en charge" -> loaded number before label
        m = re.search(r'([\d\s,]+(?:[.,]\d+)?)\s*km/h\s*(?:charg[ée]e?|en\s+charge|loaded)', text_n, re.I | re.S)
    if m:
        speed = parse_num(m.group(1))
    if not speed:
        m = re.search(r'(?:vitesse\s+(?:max|maximale|maxi|limite)|maximum\s+speed|vmax|vitesse\s+de\s+ligne|vitesse\s+d\'exploitation)\s*(?:\(?km/h\)?|[:：])?\s*([\d\s,]+(?:[.,]\d+)?)', text_n, re.I | re.S)
        if m:
            speed = parse_num(m.group(1))
    if not speed:
        vals = [parse_num(n) for n in re.findall(r'([\d\s,]+(?:[.,]\d+)?)\s*km/h', text_n, re.I) if parse_num(n)]
        vals = [v for v in vals if 5 < v < 250]
        if vals:
            # Conservative: prefer the lower plausible speed (likely loaded restriction)
            speed = min(vals)
    if speed and 5 < speed < 250:
        specs['maxSpeed'] = int(speed)

    # --- payload (max value in tonnes) ---
    payload_candidates = []
    pat_labels = r'(?:charge\s+utile|charge\s+max|charge\s+maximale|charge\s+C|charge\s+de\s+service|payload|capacité\s+utile|capacité\s+de\s+charge|load\s+limit|loading\s+limit)'
    for m in re.finditer(pat_labels + r'\s*[:\(]?\s*([\d\s,]+(?:[.,]\d+)?)\s*(?:t|tonnes?|to)\b', text_n, re.I | re.S):
        v = parse_num(m.group(1))
        if v and 1 < v < 200:
            payload_candidates.append(v)

    # load limits / charges admissibles tables
    section = ''
    for marker in ['Load limits', 'Charges admissibles', 'Charge limite', 'Kapazität', 'load limits']:
        idx = low.find(marker.lower())
        if idx != -1:
            section = text_n[idx:idx + 5000]
            break
    if section:
        for m in re.finditer(r'([\d\s,]+(?:[.,]\d+)?)\s*(?:t|to|tons|tonnes?)\b', section, re.I):
            v = parse_num(m.group(1))
            if v and 5 < v < 200:
                # exclude speed columns
                if specs.get('maxSpeed') and abs(v - specs['maxSpeed']) <= 5:
                    continue
                payload_candidates.append(v)

    # axle load fallback
    m = re.search(r'(?:charge\s+par\s+essieu|axle\s+load|load\s+per\s+axle)\s*[:\(]?\s*([\d\s,]+(?:[.,]\d+)?)\s*(?:t|tonnes?|to|t/essieu)\b', text_n, re.I | re.S)
    if m:
        axle = parse_num(m.group(1))
        mass = specs.get('mass')
        if axle and mass and axle > 0:
            payload_candidates.append(max(0, 4 * axle - mass))

    if payload_candidates:
        specs['payload'] = max(payload_candidates)

    # --- volume (m³) fallback for payload ---
    m = re.search(r'(?:capacité|capacite|volume|loading\s+volume|loading\s+space|useful\s+volume)\s*(?:utile)?\s*[:\)]?\s*([\d\s,]+(?:[.,]\d+)?)\s*(?:m3|m³|m²|m2)?', text_n, re.I | re.S)
    if m:
        v = parse_num(m.group(1))
        if v:
            specs['volume'] = v

    return specs


def detect_cargos(text, sub):
    text_l = text.lower()
    cargos = set()
    for ctype, words in CARGO_KEYWORDS.items():
        if any(w in text_l for w in words):
            cargos.add(ctype)
    # restrict to CARGO_META keys
    cargos = {c for c in cargos if c in rb.CARGO_META}

    # subcategory sanity filter
    if sub == 'citerne':
        allowed = {'oil', 'chemicals', 'milk', 'wine', 'sulphur', 'acid', 'ammonia', 'lng', 'lpg'}
    elif sub == 'vehicles':
        allowed = {'vehicles'}
    elif sub == 'frigo':
        allowed = {'refrigerated', 'meat'}
    elif sub == 'waste':
        allowed = {'waste'}
    elif sub == 'tremie':
        allowed = {'grain', 'flour', 'sugar', 'salt', 'coal', 'ore', 'gravel', 'sand', 'ballast', 'limestone', 'cement', 'clinker', 'coke', 'bauxite', 'fertilizer', 'potash', 'phosphate', 'kaolin', 'alumina', 'sinter', 'pig-iron', 'scrap', 'aggregates', 'general'}
    elif sub == 'plat':
        allowed = {'steel', 'steel-coils', 'steel-sheet', 'steel-beams', 'scrap', 'containers', 'vehicles', 'wood', 'general', 'sinter', 'pig-iron'}
    elif sub == 'couvert':
        allowed = {'general', 'paper', 'wood', 'sugar', 'salt', 'fertilizer', 'cement', 'flour', 'grain', 'refrigerated', 'meat', 'containers'}
    elif sub == 'combi':
        allowed = {'containers', 'general', 'steel', 'wood'}
    else:
        allowed = set(rb.CARGO_META.keys())

    cargos = {c for c in cargos if c in allowed}
    if not cargos:
        cargos = set(rb.get_wagon_cargos(sub))
    return sorted(cargos)


def merge_specs(specs_list):
    """Merge specs parsed from several source pages."""
    merged = {}
    masses = [s.get('mass') for s in specs_list if s.get('mass')]
    if masses:
        merged['mass'] = round(sum(masses) / len(masses), 2)
    speeds = [s.get('maxSpeed') for s in specs_list if s.get('maxSpeed')]
    if speeds:
        valid = [s for s in speeds if 5 < s < 250]
        if valid:
            # Loaded speed is the most restrictive plausible value
            merged['maxSpeed'] = int(min(valid))
    payloads = [s.get('payload') for s in specs_list if s.get('payload')]
    if payloads:
        merged['payload'] = round(max(payloads), 1)
    volumes = [s.get('volume') for s in specs_list if s.get('volume')]
    if volumes:
        merged['volume'] = max(volumes)
    return merged


def apply_wagon_specs(entry, specs, cargos):
    sub = entry.get('wagonSubCategory', '')
    if specs.get('mass'):
        entry['mass'] = round(specs['mass'], 2)
    if specs.get('maxSpeed'):
        entry['maxSpeed'] = int(specs['maxSpeed'])
    # Length is intentionally not updated: the game computes it from image width.
    if 'payload' in specs:
        entry['freightCapacity'] = round(specs['payload'], 1)
    elif 'payload_from_axle' in specs and specs['payload_from_axle'] > 0:
        entry['freightCapacity'] = round(specs['payload_from_axle'], 1)
    elif 'volume' in specs:
        if sub == 'tremie' and entry.get('freightCapacity') in (0, None):
            entry['freightCapacity'] = round(specs['volume'] * 0.85, 1)
        elif sub == 'citerne' and entry.get('freightCapacity') in (0, None):
            entry['freightCapacity'] = round(min(specs['volume'] * 0.9, 80), 1)
    if cargos:
        entry['cargoTypes'] = cargos
    entry['tonnage'] = round((entry.get('mass') or 0) + (entry.get('freightCapacity') or 0), 1)


def _clean_variants(name, series_name):
    base = name.strip()
    expanded = re.sub(r'\(([^)]+)\)', r'\1', base)
    variants = [expanded]
    for sep in [',', '/', ' and ', ' & ']:
        new = []
        for v in variants:
            new.extend([x.strip() for x in v.split(sep) if x.strip()])
        variants = new
    cleaned = []
    for v in variants:
        v = re.sub(r'\s+', ' ', v).strip()
        v = v.replace('“', '').replace('”', '').replace('(', '').replace(')', '')
        if v:
            cleaned.append(v)
    # if name is only a number or very short, use series tail
    if not base or (len(base.split()) <= 1 and not re.search(r'[A-Za-z]{2,}', base)):
        tail = series_name.split()[-3:] if series_name else []
        if tail:
            cleaned.append(' '.join(tail[-2:]))
    return cleaned[:3]


def _series_context(series_name):
    if not series_name:
        return ''
    # Keep operator/country/type words, drop volume units for query context
    words = [w for w in series_name.split() if len(w) > 1 and w.lower() not in ('m3', 'm2', 'm', 't', 'de', 'et', 'des', 'les', 'du', 'la', 'le', 'un', 'une')]
    return ' '.join(words[-6:])


def select_urls(search_text, name):
    urls = re.findall(r'URL:\s*(https?://\S+)', search_text)
    selected = []
    for url in urls:
        low = url.lower()
        if any(b in low for b in BLACKLIST):
            continue
        if any(w in low for w in WHITELIST) or 'train' in low or 'wagon' in low or 'rail' in low:
            if url not in selected:
                selected.append(url)
    if not selected:
        for url in urls:
            low = url.lower()
            if any(b in low for b in BLACKLIST):
                continue
            if url not in selected:
                selected.append(url)
    return selected[:5]


_sem = None


async def _safe_call(tool, args, retries=3):
    if call_tool is None:
        raise RuntimeError('call_tool not available')
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(5)
    for attempt in range(retries):
        async with _sem:
            try:
                return await call_tool(tool, args)
            except Exception as e:
                msg = str(e).lower()
                if 'not available' in msg or 'concurrent' in msg or 'too many' in msg:
                    if attempt < retries - 1:
                        await asyncio.sleep(2 ** attempt)
                        continue
                raise
    return ''


async def search_one(name, series_name):
    variants = _clean_variants(name, series_name)
    ctx = _series_context(series_name)
    all_urls = []
    search_text = ''
    queries_done = 0
    for v in variants:
        queries = [f'{v} wagon']
        if ctx:
            queries.append(f'{v} {ctx}')
        # DB Cargo specific
        queries.append(f'site:gueterwagenkatalog.dbcargo.com {v}')
        for q in queries:
            if queries_done >= 5:
                break
            try:
                res = await _safe_call('web_search', {'query': q, 'num_results': 5})
            except Exception as e:
                print(f'  search error for {name}: {type(e).__name__}: {e}')
                res = f'[search error: {e}]'
            search_text += '\n' + res
            urls = select_urls(res, name)
            for u in urls:
                if u not in all_urls:
                    all_urls.append(u)
            queries_done += 1
        if len(all_urls) >= 3:
            break
    return all_urls[:5], search_text


async def process_name(name, count, e, catalog, cache, log):
    series = e.get('seriesName', '')
    try:
        urls, search_text = await search_one(name, series)
    except Exception as exc:
        log.append(f'{name}: search error {exc}')
        cache[name] = {'skip': True}
        return
    cache[name] = {'url': urls, 'search': search_text}
    if not urls:
        log.append(f'{name}: no URLs')
        cache[name]['skip'] = True
        return
    try:
        page_text = await _safe_call('web_get_contents', {'urls': urls})
    except Exception as exc:
        log.append(f'{name}: fetch error {exc}')
        cache[name]['skip'] = True
        return
    cache[name]['page'] = page_text[:6000]
    parts = re.split(r'(?m)^## Page \d+:', page_text)
    specs_list = [parse_page(part) for part in parts if part.strip()]
    if not specs_list and page_text.strip():
        specs_list = [parse_page(page_text)]
    merged = merge_specs(specs_list)
    sub = e.get('wagonSubCategory', '')
    cargos = detect_cargos(page_text + '\n' + search_text, sub)
    cache[name]['specs'] = merged
    cache[name]['cargos'] = cargos
    for entry in catalog:
        if entry.get('name') == name and entry.get('category') == 'wagon':
            apply_wagon_specs(entry, merged, cargos)
    log.append(f'{name}: mass={merged.get("mass")} speed={merged.get("maxSpeed")} payload={merged.get("payload")} cargos={cargos} urls={len(urls)}')


async def process_batch(batch, catalog, cache, log):
    await asyncio.gather(*[process_name(name, count, e, catalog, cache, log) for name, count, e in batch])


def build_name_list(catalog, max_names):
    wagons = [e for e in catalog if e.get('category') == 'wagon']
    rep_map = {}
    for e in wagons:
        n = e.get('name', '').strip()
        if n and n not in rep_map:
            rep_map[n] = e
    names = Counter(e.get('name', '').strip() for e in wagons)
    out = []
    seen = set()
    for name, count in names.most_common():
        if not name or name in seen:
            continue
        seen.add(name)
        out.append((name, count, rep_map[name]))
        if len(out) >= max_names:
            break
    return out


def load_cache():
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def save_cache(cache):
    CACHE_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding='utf-8')


async def main(max_names=2000, batch_size=20):
    if call_tool is None:
        raise RuntimeError('This script must be run inside a Devin scripted_tools environment')
    cargo, catalog, prefix, suffix = parse_catalog()
    cache = load_cache()
    name_list = build_name_list(catalog, max_names)
    to_process = [t for t in name_list if t[0] not in cache or 'page' not in cache[t[0]]]
    log = []
    total_batches = (len(to_process) + batch_size - 1) // batch_size
    print(f'Processing {len(to_process)} wagon names in {total_batches} batches')
    for i in range(0, len(to_process), batch_size):
        batch = to_process[i:i + batch_size]
        print(f'Batch {i // batch_size + 1}/{total_batches} ({len(batch)} names)')
        await process_batch(batch, catalog, cache, log)
        save_cache(cache)
        write_catalog(cargo, catalog, prefix, suffix)
        if log:
            print(log[-1])
    write_catalog(cargo, catalog, prefix, suffix)
    updated = sum(1 for n, c, e in name_list if n in cache and 'page' in cache[n])
    print(f'Processed {len(to_process)} names, updated {updated}/{len(name_list)}')
    for line in log[-20:]:
        print(line)


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--max-names', type=int, default=2000)
    ap.add_argument('--batch-size', type=int, default=20)
    args = ap.parse_args()
    asyncio.run(main(args.max_names, args.batch_size))
