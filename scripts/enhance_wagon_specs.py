#!/usr/bin/env python3
"""Enhance wagon specs in js/catalog-data.js by searching the web.

Takes the most frequent specific wagon names from the MLG catalog,
queries general and DB-Cargo/VTG/Wascosa/etc sources, parses tare,
length, max speed, payload and cargo keywords, then patches the catalog.
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
    call_tool = None  # not available outside scripted_tools environment

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
    'vtg.com',
    'wascosa.com',
    'ermewa.com',
    'tatravagonka',
    'tatra-wagon',
    'rail21',
    'railcargo',
    'nacco',
    'ell.eu',
    'beaconrail',
    'mrce',
    'aae',
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
]

BLACKLIST = [
    'wikipedia.org', 'wikidata.org',
    'truckscout24', 'top-factories', 'made-in-china', 'ebay', 'amazon',
    'aliexpress', 'youtube', 'facebook', 'twitter', 'instagram', 'pinterest',
    'linkedin', 'reddit', 'tiktok',
]

CARGO_KEYWORDS = {
    'grain': ['grain', 'cereal', 'maize', 'barley', 'rye', 'soybean', 'wheat', 'oats', 'millet'],
    'flour': ['flour', 'farine'],
    'sugar': ['sugar', 'sucre'],
    'salt': ['salt', 'sel'],
    'coal': ['raw coal', 'briquettes', 'coke', 'charbon'],
    'ore': ['iron ore', 'copper ore', 'bauxite', 'minerai', 'non-metallic minerals'],
    'gravel': ['gravel', 'aggregate', 'granulat', 'ballast', 'sand'],
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
    'steel': ['steel', 'acier', 'sheet metal', 'semi-finished steel', 'slab', 'rod iron', 'sinter', 'pig-iron', 'fonte'],
    'steel-coils': ['coil', 'bobine', 'slit strip', 'sheet metal coils'],
    'steel-sheet': ['sheet metal', 'tôle', 'steel sheet', 'steel sheets'],
    'steel-beams': ['beam', 'poutrelle', 'profile', 'structural steel'],
    'scrap': ['scrap', 'ferraille'],
    'containers': ['container', 'conteneur', 'swap body', 'semi-trailer', 'pocket wagon'],
    'vehicles': ['vehicle', 'automotive', 'car transport', 'car carrier', 'stva', 'gefc'],
    'wood': ['wood', 'timber', 'log', 'bois', 'sawn wood'],
    'paper': ['paper', 'pulp'],
    'oil': ['oil', 'petrol', 'fuel oil', 'diesel oil'],
    'chemicals': ['chemical', 'produit chimique', 'hazardous goods'],
    'acid': ['acid', 'acide'],
    'ammonia': ['ammonia', 'ammoniac'],
    'lng': ['lng', 'liquefied natural gas'],
    'lpg': ['lpg', 'gpl', 'propane', 'butane'],
    'milk': ['milk'],
    'wine': ['wine', 'vin'],
    'sulphur': ['sulphur', 'soufre'],
    'refrigerated': ['refrigerated', 'frigorifique'],
    'meat': ['meat', 'viande'],
    'waste': ['waste', 'dechet', 'slag'],
}


def parse_num(s):
    if not s:
        return None
    s = re.sub(r'(?<=\d)[,](?=\d)', '', s.strip())
    s = re.sub(r'(?<=\d)\s+(?=\d)', '', s)
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
    # find matching end by bracket balance
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


def select_url(search_text, name):
    urls = re.findall(r'URL:\s*(https?://\S+)', search_text)
    # Prefer DB Cargo / whitelisted, avoid blacklisted
    for url in urls:
        low = url.lower()
        if 'gueterwagenkatalog.dbcargo.com' in low:
            return url
    for url in urls:
        low = url.lower()
        if any(w in low for w in WHITELIST) and not any(b in low for b in BLACKLIST):
            return url
    for url in urls:
        low = url.lower()
        if not any(b in low for b in BLACKLIST):
            return url
    return None


def parse_page(text):
    import html
    specs = {}
    text = html.unescape(text)
    # strip HTML tags and collapse whitespace so tables become plain text
    plain = re.sub(r'<[^>]+>', ' ', text)
    plain = re.sub(r'\s+', ' ', plain)
    text_n = re.sub(r'(?<=\d)[,](?=\d)', '', plain)

    # tare weight (kg or t)
    m = re.search(
        r'(?:Average\s+)?tare\s+weight\s*\(?(kg|t|tons|tonnes)\)?\s*[^\d>≤]*(?:>\s*)?([\d\s]+(?:\.[\d\s]+)?)(?:\s*(?:t|to|tons|tonnes|kg)?\s*≤\s*([\d\s]+(?:\.[\d\s]+)?))?',
        text_n, re.I | re.S)
    if m:
        unit = (m.group(1) or '').lower()
        v1 = parse_num(m.group(2))
        v2 = parse_num(m.group(3))
        val = ((v1 + v2) / 2) if (v1 and v2) else (v1 or v2)
        if val:
            specs['mass'] = val / 1000 if 'kg' in unit else val

    # max speed
    m = re.search(r'Maximum\s+speed\s*\(?km/h\)?\s*[^\d]*([\d\s]+(?:\.[\d\s]+)?)', text_n, re.I | re.S)
    if m:
        v = parse_num(m.group(1))
        if v:
            specs['maxSpeed'] = int(v)

    # length over buffers
    m = re.search(r'(?:Total\s+)?(?:Length\s+over\s+buffers)\s*\(?(mm|m)\)?\s*[^\d]*([\d\s]+(?:\.[\d\s]+)?)', text_n, re.I | re.S)
    if m:
        unit = (m.group(1) or '').lower()
        val = parse_num(m.group(2))
        if val:
            specs['length'] = val / 1000 if 'mm' in unit else val
    else:
        # loading length as fallback
        m = re.search(r'Loading\s+length\s*\(?(mm|m)\)?\s*[^\d]*([\d\s]+(?:\.[\d\s]+)?)', text_n, re.I | re.S)
        if m:
            unit = (m.group(1) or '').lower()
            val = parse_num(m.group(2))
            if val:
                specs['length'] = (val / 1000 + 1.5) if 'mm' in unit else (val + 0.5)
        else:
            # inside length for covered hoppers
            m = re.search(r'Inside\s+length(?:\s+of\s+hopper)?\s*\(?(mm|m)\)?\s*[^\d]*([\d\s]+(?:\.[\d\s]+)?)', text_n, re.I | re.S)
            if m:
                unit = (m.group(1) or '').lower()
                val = parse_num(m.group(2))
                if val:
                    specs['length'] = (val / 1000 + 4.0) if 'mm' in unit else (val + 4.0)

    # volume
    m = re.search(r'Loading\s+(?:space|volume)\s*(?:\(m3\)|\(m³\)|m3|m³)?\s*(?:[:：]\s*)?\s*([\d\s]+(?:\.[\d\s]+)?)', text_n, re.I | re.S)
    if m:
        v = parse_num(m.group(1))
        if v:
            specs['volume'] = v

    # payload from load limits table (case-sensitive so it matches the heading,
    # not occurrences like 'high load limits' in the body text)
    lm = re.search(r'Load\s+limits(.*?)(?:Additional\s+information|All\s+data\s+provided|$)', text_n, re.S)
    if lm:
        section = lm.group(1)
        nums = []
        for n in re.findall(r'([\d\s]+(?:\.[\d\s]+)?)\s*(?:t|to|tons|tonnes)?', section):
            v = parse_num(n)
            if v and 10 < v < 200:
                nums.append(v)
        speed = specs.get('maxSpeed')
        if speed and speed > 0:
            nums = [n for n in nums if abs(n - speed) > 5]
        if nums:
            specs['payload'] = max(nums)

    # axle load -> payload = (axles * axle_load) - tare, assume 4 axles if not stated
    m = re.search(r'(?:axle\s+load|load\s+per\s+axle)\s*\(?(t|tons|tonnes)\)?\s*[^\d]*([\d\s]+(?:\.[\d\s]+)?)', text_n, re.I | re.S)
    if m:
        val = parse_num(m.group(2))
        mass = specs.get('mass')
        if val and mass:
            specs['payload_from_axle'] = 4 * val - mass

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
        cargos = {c for c in cargos if c in allowed}
    elif sub == 'vehicles':
        cargos = {'vehicles'}
    elif sub == 'frigo':
        cargos = {c for c in cargos if c in {'refrigerated', 'meat'}}
    elif sub == 'waste':
        cargos = {'waste'}
    if not cargos:
        cargos = set(rb.get_wagon_cargos(sub))
    return sorted(cargos)


SEM = asyncio.Semaphore(5)


async def _safe_call(tool, args, retries=3):
    if call_tool is None:
        raise RuntimeError('call_tool not available')
    for attempt in range(retries):
        async with SEM:
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


def _clean_variants(name, series_name):
    """Return a list of plausible model names to search."""
    base = name.strip()
    # expand parenthetical variants like Eaos(-x) -> Eaos and Eaos-x
    expanded = re.sub(r'\(([^)]+)\)', r'\1', base)
    variants = [expanded]
    # split on comma / slash / and
    for sep in [',', '/', ' and ', ' & ']:
        new = []
        for v in variants:
            new.extend([x.strip() for x in v.split(sep) if x.strip()])
        variants = new
    # clean each: collapse spaces, remove extra punctuation
    cleaned = []
    for v in variants:
        v = re.sub(r'\s+', ' ', v).strip()
        v = v.replace('“', '').replace('”', '').replace('(', '').replace(')', '')
        if v:
            cleaned.append(v)
    # if name is only a number or very short, use the series tail
    if not base or (len(base.split()) <= 1 and not re.search(r'[A-Za-z]{2,}', base)):
        tail = series_name.split()[-3:] if series_name else []
        for t in tail:
            if t not in cleaned and re.search(r'\d|[A-Za-z]{2,}', t):
                cleaned.append(' '.join(tail[-2:]))
                break
    return cleaned[:3]


async def search_one(name, series_name):
    variants = _clean_variants(name, series_name)
    if not variants:
        return None, ''
    search_text = ''
    chosen_url = None
    # Try each variant with a DB Cargo search then a general search
    for v in variants:
        # DB Cargo specific
        q1 = f'site:gueterwagenkatalog.dbcargo.com {v}'
        try:
            res = await _safe_call('web_search', {'query': q1, 'num_results': 5})
            search_text += '\n' + res
            if not chosen_url:
                chosen_url = select_url(res, name)
        except Exception as e:
            search_text += f'\n[search error: {e}]'
        # general railway search
        if not chosen_url:
            ctx = ' '.join(series_name.split()[-4:]) if series_name else ''
            q2 = f'{v} {ctx} railway wagon'.strip()
            try:
                res = await _safe_call('web_search', {'query': q2, 'num_results': 5})
                search_text += '\n' + res
                chosen_url = select_url(res, name)
            except Exception as e:
                search_text += f'\n[search error: {e}]'
        if chosen_url:
            break
    return chosen_url, search_text


async def fetch_one(url):
    try:
        return await _safe_call('web_get_contents', {'urls': [url]})
    except Exception as e:
        return f'[fetch error: {e}]'


def build_name_list(catalog, max_names):
    wagons = [e for e in catalog if e.get('category') == 'wagon']
    names = Counter(e.get('name', '').strip() for e in wagons)
    # keep first representative entry per name for series context
    rep_map = {}
    for e in wagons:
        n = e.get('name', '').strip()
        if n and n not in rep_map:
            rep_map[n] = e
    out = []
    seen = set()
    for name, count in names.most_common():
        if not name or name in seen:
            continue
        low = name.lower()
        series = rep_map[name].get('seriesName', '').strip()
        series_tail = ' '.join(series.split()[-3:]).lower() if series else ''
        # specificity check: letters or numeric-with-unit, or series gives a model context
        has_spec = bool(re.search(r'[a-z]{2,}|\dm3|\d+m|\d+\s*(?:m3|mm|kg|t)\b', low))
        series_ok = bool(re.search(r'[a-z]{2,}\s+\d+|\d+\s+[a-z]{2,}', series_tail))
        if not has_spec and not series_ok:
            continue
        if re.fullmatch(r'\d+', name):
            continue
        seen.add(name)
        out.append((name, count, rep_map[name]))
        if len(out) >= max_names:
            break
    return out


def apply_wagon_specs(entry, specs, cargos):
    sub = entry.get('wagonSubCategory', '')
    if specs.get('mass'):
        entry['mass'] = round(specs['mass'], 2)
    if specs.get('maxSpeed'):
        entry['maxSpeed'] = int(specs['maxSpeed'])
    if specs.get('length'):
        entry['length'] = round(specs['length'], 2)
    if 'payload' in specs:
        entry['freightCapacity'] = round(specs['payload'], 1)
    elif 'payload_from_axle' in specs and specs['payload_from_axle'] > 0:
        entry['freightCapacity'] = round(specs['payload_from_axle'], 1)
    elif 'volume' in specs:
        # only use volume-derived capacity as a weak fallback
        if sub == 'tremie' and entry.get('freightCapacity') in (0, None):
            entry['freightCapacity'] = round(specs['volume'] * 0.85, 1)
        elif sub == 'citerne' and entry.get('freightCapacity') in (0, None):
            entry['freightCapacity'] = round(min(specs['volume'] * 0.9, 80), 1)
    if cargos:
        entry['cargoTypes'] = cargos
    entry['tonnage'] = (entry.get('mass') or 0) + (entry.get('freightCapacity') or 0)


async def process_batch(batch, catalog, cache, log):
    rep = {b[0]: b[2] for b in batch}

    # Search sequentially to avoid "web_search not available" errors
    search_results = []
    for name, count, e in batch:
        series = e.get('seriesName', '')
        try:
            res = await search_one(name, series)
            search_results.append(res)
        except Exception as exc:
            search_results.append(exc)
        await asyncio.sleep(0.2)

    fetch_map = {}
    for (name, count, e), res in zip(batch, search_results):
        if isinstance(res, Exception):
            log.append(f'{name}: search exception {res}')
            cache[name] = {'skip': True}
            continue
        if res is None:
            log.append(f'{name}: search returned None')
            cache[name] = {'skip': True}
            continue
        url, search_text = res
        cache[name] = {'url': url, 'search': search_text}
        if url:
            fetch_map[name] = fetch_one(url)
        else:
            log.append(f'{name}: no suitable URL')
            cache[name]['skip'] = True

    # Fetch pages sequentially as well
    fetch_results = []
    for name in fetch_map.keys():
        try:
            page_text = await fetch_map[name]
            fetch_results.append((name, page_text))
        except Exception as exc:
            fetch_results.append((name, exc))
        await asyncio.sleep(0.2)

    for name, page_text in fetch_results:
        if isinstance(page_text, Exception):
            log.append(f'{name}: fetch exception {page_text}')
            cache[name]['skip'] = True
            continue
        cache[name]['page'] = page_text[:3000]
        specs = parse_page(page_text)
        cache[name]['specs'] = specs
        e = rep[name]
        sub = e.get('wagonSubCategory', '')
        cargos = detect_cargos(page_text + '\n' + cache[name].get('search', ''), sub)
        cache[name]['cargos'] = cargos
        for entry in catalog:
            if entry.get('name') == name and entry.get('category') == 'wagon':
                apply_wagon_specs(entry, specs, cargos)
        log.append(f'{name}: mass={specs.get("mass")} speed={specs.get("maxSpeed")} len={specs.get("length")} payload={specs.get("payload")} cargos={cargos}')


def load_cache():
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def save_cache(cache):
    CACHE_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding='utf-8')


async def main(max_names=100, batch_size=20):
    if call_tool is None:
        raise RuntimeError('This script must be run inside a Devin scripted_tools environment')
    cargo, catalog, prefix, suffix = parse_catalog()
    cache = load_cache()
    name_list = build_name_list(catalog, max_names)
    # process only names not already successfully enhanced
    to_process = [t for t in name_list if t[0] not in cache or 'page' not in cache[t[0]]]
    log = []
    log.append(f'Processing {len(to_process)} wagon names (batch size {batch_size})')
    for i in range(0, len(to_process), batch_size):
        batch = to_process[i:i + batch_size]
        log.append(f'Batch {i//batch_size + 1}: {len(batch)} names')
        await process_batch(batch, catalog, cache, log)
        save_cache(cache)
        write_catalog(cargo, catalog, prefix, suffix)
    write_catalog(cargo, catalog, prefix, suffix)
    updated = sum(1 for n, c, e in name_list if n in cache and 'page' in cache[n])
    print(f'Processed {len(to_process)} names, updated {updated}')
    for line in log[-30:]:
        print(line)


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--max-names', type=int, default=100)
    ap.add_argument('--batch-size', type=int, default=20)
    args = ap.parse_args()
    asyncio.run(main(args.max_names, args.batch_size))
