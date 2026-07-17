#!/usr/bin/env python3
"""
Rebuild RAIL-EMPIRE catalog from MLG Traffic XML/images.
Parses MLG collection XML, downloads missing GIFs/PNGs, fetches specs from
Trains d'Europe when possible, and rewrites js/catalog-data.js.
"""
import json
import os
import re
import sys
import time
import html as html_module
import xml.etree.ElementTree as ET
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import urllib.request
import urllib.error

REPO = Path('/home/ubuntu/repos/RAIL-EMPIRE-APP')
IMG_DIR = REPO / 'img/catalog'
CATALOG_JS = REPO / 'js/catalog-data.js'
CACHE_FILE = REPO / 'scripts/.mlg_cache.json'
MLG_BASE = 'http://www.mlgtraffic.net'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; RailEmpireCatalog/1.0)'}

# All collection XML URLs discovered from http://www.mlgtraffic.net/index.html
ALL_MLG_URLS = [u.strip() for u in (REPO / 'scripts/all_mlg_urls.txt').read_text().splitlines() if u.strip()]

DRIVING_TRAILER_NOMS = {'bx', 'abx', 'bdx', 'bd', 'vp'}
DRIVING_TRAILER_SUFFIXES = {'_vp', '_bdx', '_bx', '_abx'}

CARGO_META = {
    'coal':    {'category': 'minerai',      'name': 'Charbon',       'unit': 't', 'pricePerUnit': 30, 'hazard': False},
    'ore':     {'category': 'minerai',      'name': 'Minerai',       'unit': 't', 'pricePerUnit': 35, 'hazard': False},
    'gravel':  {'category': 'granulats',    'name': 'Gravier',       'unit': 't', 'pricePerUnit': 18, 'hazard': False},
    'sand':    {'category': 'granulats',    'name': 'Sable',         'unit': 't', 'pricePerUnit': 15, 'hazard': False},
    'ballast': {'category': 'granulats',    'name': 'Ballast',       'unit': 't', 'pricePerUnit': 12, 'hazard': False},
    'grain':   {'category': 'cereales',     'name': 'Céréales',      'unit': 't', 'pricePerUnit': 22, 'hazard': False},
    'flour':   {'category': 'cereales',     'name': 'Farine',        'unit': 't', 'pricePerUnit': 28, 'hazard': False},
    'oil':     {'category': 'liquides',     'name': 'Pétrole brut',  'unit': 't', 'pricePerUnit': 45, 'hazard': True},
    'chemicals': {'category': 'liquides', 'name': 'Produits chimiques', 'unit': 't', 'pricePerUnit': 55, 'hazard': True},
    'milk':    {'category': 'liquides',     'name': 'Lait',          'unit': 't', 'pricePerUnit': 25, 'hazard': False},
    'wine':    {'category': 'liquides',     'name': 'Vin',           'unit': 't', 'pricePerUnit': 40, 'hazard': False},
    'sulphur': {'category': 'liquides',     'name': 'Soufre liquide', 'unit': 't', 'pricePerUnit': 60, 'hazard': True},
    'refrigerated': {'category': 'frais', 'name': 'Marchandises réfrigérées', 'unit': 't', 'pricePerUnit': 50, 'hazard': False},
    'meat':    {'category': 'frais',        'name': 'Viande',        'unit': 't', 'pricePerUnit': 48, 'hazard': False},
    'general': {'category': 'marchandises', 'name': 'Marchandises générales', 'unit': 't', 'pricePerUnit': 20, 'hazard': False},
    'containers': {'category': 'conteneurs', 'name': 'Conteneurs', 'unit': 't', 'pricePerUnit': 32, 'hazard': False},
    'vehicles': {'category': 'automobiles', 'name': 'Véhicules', 'unit': 't', 'pricePerUnit': 38, 'hazard': False},
    'steel':   {'category': 'acier',        'name': 'Acier',         'unit': 't', 'pricePerUnit': 42, 'hazard': False},
    'steel-coils': {'category': 'acier',  'name': 'Bobines d\'acier', 'unit': 't', 'pricePerUnit': 44, 'hazard': False},
    'steel-sheet': {'category': 'acier',  'name': 'Tôles d\'acier', 'unit': 't', 'pricePerUnit': 43, 'hazard': False},
    'steel-beams': {'category': 'acier',  'name': 'Poutrelles',    'unit': 't', 'pricePerUnit': 41, 'hazard': False},
    'waste':   {'category': 'dechet',       'name': 'Déchets',       'unit': 't', 'pricePerUnit': 10, 'hazard': False},
    'wood':    {'category': 'bois',         'name': 'Bois',          'unit': 't', 'pricePerUnit': 24, 'hazard': False},
    'paper':   {'category': 'papier',       'name': 'Papier',        'unit': 't', 'pricePerUnit': 26, 'hazard': False},
    'livestock': {'category': 'animaux',    'name': 'Bétail',        'unit': 't', 'pricePerUnit': 34, 'hazard': False},
    'post':    {'category': 'postal',       'name': 'Courrier',      'unit': 't', 'pricePerUnit': 50, 'hazard': False},
}

WAGON_DEFAULTS = {
    'tremie':      {'mass': 22, 'freightCapacity': 80, 'length': 13.5, 'maxSpeed': 100},
    'citerne':     {'mass': 24, 'freightCapacity': 80, 'length': 15.0, 'maxSpeed': 100},
    'plat':        {'mass': 20, 'freightCapacity': 60, 'length': 16.0, 'maxSpeed': 100},
    'couvert':     {'mass': 22, 'freightCapacity': 50, 'length': 13.5, 'maxSpeed': 100},
    'frigo':       {'mass': 26, 'freightCapacity': 50, 'length': 16.0, 'maxSpeed': 120},
    'combi':       {'mass': 22, 'freightCapacity': 70, 'length': 20.0, 'maxSpeed': 100},
    'vehicles':    {'mass': 22, 'freightCapacity': 40, 'length': 20.0, 'maxSpeed': 100},
    'general':     {'mass': 20, 'freightCapacity': 50, 'length': 13.5, 'maxSpeed': 100},
    'waste':       {'mass': 22, 'freightCapacity': 60, 'length': 13.5, 'maxSpeed': 100},
    'service':     {'mass': 18, 'freightCapacity': 0,  'length': 10.0, 'maxSpeed': 80},
    'flat':        {'mass': 20, 'freightCapacity': 60, 'length': 16.0, 'maxSpeed': 100},
    'default':     {'mass': 22, 'freightCapacity': 50, 'length': 14.0, 'maxSpeed': 100},
}

COACH_DEFAULTS = {
    'default': {'mass': 42, 'passengerCapacity': 60, 'length': 20.0, 'maxSpeed': 140},
    'first':   {'mass': 42, 'passengerCapacity': 30, 'length': 20.0, 'maxSpeed': 140},
    'second':  {'mass': 42, 'passengerCapacity': 70, 'length': 20.0, 'maxSpeed': 140},
    'mixed':   {'mass': 42, 'passengerCapacity': 55, 'length': 20.0, 'maxSpeed': 140},
    'couchette': {'mass': 42, 'passengerCapacity': 40, 'length': 20.0, 'maxSpeed': 140},
    'resto':   {'mass': 45, 'passengerCapacity': 0, 'length': 22.0, 'maxSpeed': 140},
    'fourgon': {'mass': 30, 'passengerCapacity': 0, 'length': 15.0, 'maxSpeed': 120},
}

XML_WAGON_MAP = {
    'Citernes': {'sub': 'citerne', 'cargo': ['oil','chemicals','milk','wine','sulphur']},
    'Plats': {'sub': 'plat', 'cargo': ['steel','steel-coils','steel-sheet','steel-beams','containers','wood']},
    'CerealB': {'sub': 'tremie', 'cargo': ['grain','flour']},
    'CerealE': {'sub': 'tremie', 'cargo': ['grain','flour']},
    'Tremies': {'sub': 'tremie', 'cargo': ['coal','ore','gravel','sand','ballast']},
    'Frigo': {'sub': 'frigo', 'cargo': ['refrigerated','meat']},
    'Combis': {'sub': 'combi', 'cargo': ['containers','general']},
    'GEFCO': {'sub': 'vehicles', 'cargo': ['vehicles']},
    'STVA': {'sub': 'vehicles', 'cargo': ['vehicles']},
    'SGW': {'sub': 'plat', 'cargo': ['steel','steel-coils','steel-sheet']},
    'Railtrans': {'sub': 'flat', 'cargo': ['containers','steel','vehicles']},
    'Div': {'sub': 'general', 'cargo': ['general','paper','wood']},
    'EVS': {'sub': 'waste', 'cargo': ['waste']},
    'WEFT': {'sub': 'tremie', 'cargo': ['coal','ore','gravel','sand','ballast','grain']},
    'WFMVAC': {'sub': 'service', 'cargo': []},
    'WG': {'sub': 'couvert', 'cargo': ['general','paper']},
    'WHI': {'sub': 'frigo', 'cargo': ['refrigerated','meat','livestock']},
    'WKLRS': {'sub': 'flat', 'cargo': ['steel','steel-coils','steel-sheet','containers','wood']},
}


def load_cache():
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print('cache load error', e)
    return {}


def save_cache(cache):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


def load_catalog():
    text = CATALOG_JS.read_text(encoding='utf-8')
    ct_start = text.find('export const CATALOG_CARGO_TYPES')
    ct_br = text.find('[', ct_start)
    ct_end = text.find('];', ct_br) + 1
    cargo = json.loads(text[ct_br:ct_end])
    cat_start = text.find('export const CATALOG = [')
    cat_br = text.find('[', cat_start)
    cat_end = text.rfind('];') + 1
    catalog = json.loads(text[cat_br:cat_end])
    prefix = text[:ct_start]
    suffix = text[cat_end:]
    return cargo, catalog, prefix, suffix


def write_catalog(cargo, catalog, prefix, suffix):
    tmp = CATALOG_JS.with_suffix('.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(prefix)
        f.write('export const CATALOG_CARGO_TYPES = ')
        f.write(json.dumps(cargo, indent=2, ensure_ascii=False))
        f.write(';\n\n')
        f.write('export const CATALOG = ')
        f.write(json.dumps(catalog, indent=2, ensure_ascii=False))
        f.write(';')
        f.write(suffix)
    tmp.replace(CATALOG_JS)


def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        return None
    except Exception as e:
        return None


def download_mlg_image(rel_path, side=''):
    """rel_path is path without 'images/' prefix and without side suffix.
    side is '', '_R', '_L', etc."""
    local = IMG_DIR / f"{rel_path}{side}.gif"
    if local.exists() and local.stat().st_size > 0:
        return local
    local.parent.mkdir(parents=True, exist_ok=True)
    url = f"{MLG_BASE}/images/{rel_path}{side}.gif"
    data = http_get(url)
    if data:
        with open(local, 'wb') as f:
            f.write(data)
        if local.stat().st_size > 0:
            return local
    return None


def parse_xml(url):
    data = http_get(url, timeout=30)
    if not data:
        print(f'  [XML] failed to fetch {url}')
        return None
    text = data.decode('latin-1', errors='ignore')
    text = text.strip()
    if text.startswith('<'):
        text = text[text.find('<?xml'):]
    try:
        return ET.fromstring(text)
    except ET.ParseError as e:
        # Some files start with whitespace; try stripping before <?xml
        text = re.sub(r'^[\s\t]+', '', text)
        try:
            return ET.fromstring(text)
        except ET.ParseError as e2:
            print(f'  [XML] parse error {url}: {e2}')
            return None


def text_of(el):
    if el is None:
        return ''
    return (el.text or '').strip()


def get_model(niv1, niv2, nom):
    """Extract a model name suitable for Trains d'Europe lookup."""
    def clean(s):
        if not s:
            return ''
        s = s.split('(')[0].split('[')[0]
        s = re.sub(r'\s+', ' ', s).strip()
        return s
    candidates = [clean(text_of(niv2.find('Titre2'))), clean(text_of(niv1.find('Titre1'))), clean(nom)]
    for c in candidates:
        if not c:
            continue
        # TGV specific
        m = re.search(r'(TGV\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)', c, re.I)
        if m:
            return re.sub(r'\s+', ' ', m.group(1)).strip()
        # Letter/number code like BB 8100, Z 5300, Z 3600, XGC etc
        m = re.search(r'([A-Za-z0-9]{1,4}\s+[0-9]{1,5}(?:\s*[A-Z])?)', c)
        if m:
            return re.sub(r'\s+', ' ', m.group(1)).strip()
        # Standalone short code without digits (ETG, RTG, XGC, ZGC, BGC)
        m = re.search(r'\b(ETG|RTG|XGC|ZGC|BGC|TGV|PSE|Duplex|POS|Ouigo)\b', c, re.I)
        if m:
            return m.group(1).upper()
    return ''


def guess_traction(category, niv1, niv2, ligne, image_rel):
    icos = [i.text.strip() for i in ligne.findall('Ico') if i.text]
    for ico in icos:
        if ico.lower() in ('panto', 'cable', '3rd', '3r'):
            return 'electrique'
        if ico.lower() == 'diesel':
            return 'diesel'
        if ico.lower() in ('steam', 'vapeur'):
            return 'vapeur'
    # Directory / name heuristics
    low = image_rel.lower()
    if '/ld/' in low or '/ad/' in low:
        return 'diesel'
    if '/le/' in low or '/ae/' in low or '/tgv/' in low:
        return 'electrique'
    if '/am/' in low or '/métrique/' in low:
        # metric: check name starts
        nom = text_of(ligne.find('Nom'))
        if nom:
            first = nom.split()[0]
            if first.lower().startswith('z'):
                return 'electrique'
            if first.lower().startswith('x'):
                return 'diesel'
    return 'none'


def get_category_and_wagon_sub(xml_name, image_rel, nompage2):
    low = image_rel.lower()
    base = Path(image_rel).name.lower()
    # Direct directory hints first
    if '/le/' in low or 'locomotive' in xml_name.lower() or xml_name.startswith('SNCF_E_LE'):
        return 'locomotive', ''
    if '/ld/' in low or xml_name.startswith('SNCF_E_LD'):
        return 'locomotive', ''
    if '/ae/' in low or '/a_el/' in low or xml_name.startswith('SNCF_E_AE'):
        return 'automotrice', ''
    if '/ad/' in low or '/xr' in xml_name.lower() or xml_name.startswith('SNCF_E_AD'):
        return 'automotrice', ''
    if '/am/' in low or '/métrique/' in low or xml_name.startswith('SNCF_E_AM') or xml_name.startswith('France_E_Metric'):
        return 'automotrice', ''
    if '/tgv/' in low or xml_name.startswith('SNCF_E_TGV'):
        return 'automotrice', ''
    if '/turbo/' in low or xml_name.startswith('SNCF_E_Turbo'):
        return 'automotrice', ''
    if '/vbr/' in low or '/vlar/' in low or '/vlcorail/' in low or '/vldevuic/' in low or '/vlmet/' in low or '/vlits/' in low or '/vfourg/' in low or '/v_' in xml_name.lower() or '/v ' in xml_name.lower():
        return 'voiture', ''
    if '/vm/' in low or xml_name.startswith('SNCF_E_VM'):
        return 'voiture', ''
    if '/w/' in low or 'wagon' in xml_name.lower() or '_w_' in xml_name.lower() or xml_name.endswith('_W.xml'):
        sub = guess_wagon_sub(xml_name, base)
        return 'wagon', sub
    if '/serv/' in low or '/draisine' in low or xml_name.startswith('SNCF_E_S_'):
        return 'wagon', 'service'
    if '/f_wp/' in low or '/f_p/' in low:
        # private / work wagons vs locos
        if any(x in low for x in ['_bb', '_cc', '_loco', '_27000', '_37000', '_63000', '_66000', '_67000']):
            return 'locomotive', ''
        if any(x in low for x in ['_z', '_x', '_automot']):
            return 'automotrice', ''
        sub = guess_wagon_sub(xml_name, base)
        return 'wagon', sub
    if '/f_poste/' in low or xml_name.startswith('France_E_Poste'):
        return 'wagon', 'post'
    return 'locomotive', ''


def guess_wagon_sub(xml_name, image_basename):
    tail = Path(xml_name).stem.split('_')[-1]
    m = XML_WAGON_MAP.get(tail)
    if m:
        return m['sub']
    # Try from basename
    low = image_basename.lower()
    if 'cit' in low or 'citerne' in low or 'soufre' in low or 'gaz' in low:
        return 'citerne'
    if 'plat' in low or 'stuttgart' in low or 'klms' in low or 'sgw' in low:
        return 'plat'
    if 'tremie' in low or 'cereal' in low or 'céréal' in low:
        return 'tremie'
    if 'frigo' in low or 'frigor' in low or 'refrig' in low:
        return 'frigo'
    if 'couvert' in low or 'g' in low or 'gm' in low:
        return 'couvert'
    if 'combi' in low:
        return 'combi'
    if 'gefc' in low or 'stva' in low or 'auto' in low:
        return 'vehicles'
    if 'contene' in low:
        return 'combi'
    if 'fourgon' in low or 'caboose' in low or 'service' in low:
        return 'service'
    if 'waste' in low or 'evs' in low or 'dechet' in low:
        return 'waste'
    return 'default'


def get_wagon_cargos(sub):
    for tail, m in XML_WAGON_MAP.items():
        if m['sub'] == sub:
            return list(m['cargo'])
    if sub == 'tremie':
        return ['coal', 'ore', 'gravel', 'sand', 'ballast', 'grain']
    if sub == 'citerne':
        return ['oil', 'chemicals', 'milk', 'wine']
    if sub == 'plat':
        return ['steel', 'steel-coils', 'steel-sheet', 'containers', 'wood']
    if sub == 'couvert':
        return ['general', 'paper', 'wood']
    if sub == 'frigo':
        return ['refrigerated', 'meat']
    if sub == 'combi':
        return ['containers', 'general']
    if sub == 'vehicles':
        return ['vehicles']
    if sub == 'waste':
        return ['waste']
    return ['general']


def apply_defaults(entry):
    cat = entry.get('category')
    sub = entry.get('wagonSubCategory', '')
    if cat == 'wagon':
        d = WAGON_DEFAULTS.get(sub, WAGON_DEFAULTS['default'])
        for k in ['mass', 'freightCapacity', 'length', 'maxSpeed']:
            if entry.get(k) in (0, None):
                entry[k] = d[k]
        if not entry.get('cargoTypes'):
            entry['cargoTypes'] = get_wagon_cargos(sub)
    elif cat == 'voiture':
        d = COACH_DEFAULTS['default']
        for k in ['mass', 'passengerCapacity', 'length', 'maxSpeed']:
            if entry.get(k) in (0, None):
                entry[k] = d[k]
    elif cat == 'locomotive':
        for k in ['mass', 'maxSpeed', 'power']:
            if entry.get(k) in (0, None):
                entry[k] = 80 if k == 'mass' else (160 if k == 'maxSpeed' else 2000)
    elif cat == 'automotrice':
        for k in ['mass', 'maxSpeed', 'power', 'passengerCapacity']:
            if entry.get(k) in (0, None):
                entry[k] = {'mass': 120, 'maxSpeed': 120, 'power': 2000, 'passengerCapacity': 200}[k]
    # tonnage
    if cat == 'wagon':
        entry['tonnage'] = (entry.get('mass') or 0) + (entry.get('freightCapacity') or 0)
    else:
        entry['tonnage'] = entry.get('mass') or 0


def parse_trains_europe(html_text):
    if not html_text:
        return None
    html_text = html_module.unescape(html_text)
    if 'La série en chiffres' not in html_text and 'La s' not in html_text:
        # redirect / not found page
        if 'Page non trouv' in html_text or 'page de redirection' in html_text:
            return None
    specs = {}
    keys = ['Puissance', 'Poids', 'Longueur', 'Vitesse maximale',
            'Places de première classe', 'Places de seconde classe',
            'Configuration', 'Alimentation']
    for key in keys:
        regex = rf'<div[^>]*>(?:<div[^>]*>)?\s*{re.escape(key)}\s*:\s*</div>.*?<!-- #BeginEditable "[^"]*" -->(.*?)<!-- #EndEditable -->'
        m = re.search(regex, html_text, re.S | re.I)
        if m:
            val = re.sub(r'<[^>]+>', ' ', m.group(1))
            val = re.sub(r'\s+', ' ', val).strip()
            if val:
                specs[key] = val
    return specs if specs else None


def select_multi_value(text, car_count, unit_patterns=None):
    """For specs like 'si rame à 2 caisses : 94 t. ...', return value for car_count."""
    if not text:
        return None
    text = re.sub(r'\s+', ' ', text).strip()
    # Patterns: 'si rame à 2 caisses : 94 t.' or '2 caisses : 94 t.' or 'rame à 2 caisses : 94 t.'
    pattern = r'(?:si\s+)?(?:rame\s+à\s+)?(\d+)\s*(?:caisses?|bodies?)\s*[:：]\s*([^;\n]*?)(?=\s*(?:si\s+rame|(?:\d+)\s*(?:caisses?|bodies?)\s*[:：]|$))'
    matches = re.findall(pattern, text, re.I)
    if matches:
        for count, val in matches:
            if int(count) == car_count:
                return val.strip()
    return None


def to_float(s, mult=1):
    if not s:
        return None
    s = s.replace(',', '.')
    m = re.search(r'[-+]?(?:\d+\.?\d*|\.\d+)', s)
    if not m:
        return None
    v = float(m.group(0))
    if 'kw' in s.lower() and v < 100 and mult == 1:
        # rare: value might be in MW? if followed by MW
        if 'mw' in s.lower():
            mult = 1000
    return v * mult


def parse_speed(s):
    if not s:
        return None
    s = s.replace(',', '.')
    # take first number, ignore parenthetical higher/lower variants
    m = re.search(r'(\d+)', s)
    if m:
        return int(m.group(1))
    return None


def parse_places(s, car_count):
    if not s:
        return None
    val = select_multi_value(s, car_count)
    if val:
        m = re.search(r'(\d+)', val.replace(',', ''))
        return int(m.group(1)) if m else None
    m = re.search(r'(\d+)', s.replace(',', ''))
    return int(m.group(1)) if m else None


def convert_specs(specs, car_count=None):
    out = {}
    if not specs:
        return out
    # Power
    p = specs.get('Puissance')
    if p:
        if 'mw' in p.lower() or 'mégawatt' in p.lower():
            out['power'] = to_float(p, 1000)
        else:
            out['power'] = to_float(p)
    # Mass
    m = specs.get('Poids')
    if m:
        sel = select_multi_value(m, car_count) if car_count else None
        out['mass'] = to_float(sel or m)
    # Length
    l = specs.get('Longueur')
    if l:
        sel = select_multi_value(l, car_count) if car_count else None
        out['length'] = to_float(sel or l)
    # Max speed
    v = specs.get('Vitesse maximale')
    if v:
        out['maxSpeed'] = parse_speed(v)
    # Passenger capacity
    first = specs.get('Places de première classe')
    second = specs.get('Places de seconde classe')
    if first or second:
        f = parse_places(first, car_count) or 0
        s = parse_places(second, car_count) or 0
        out['passengerCapacity'] = f + s
    return out


def trains_europe_urls(model, category, niv1_title):
    urls = []
    model = model.strip()
    if not model:
        return urls
    # TGV
    if 'TGV' in model.upper() or (niv1_title and 'TGV' in niv1_title.upper()):
        slug = model.lower().replace(' ', '').replace('é', 'e').replace('è', 'e')
        if 'pse' in slug or 'sud' in slug:
            urls.append(f'{MLG_BASE.replace("mlgtraffic.net","trains-europe.fr")}/sncf/tgv/sudest_bic.htm')
        if 'atlantique' in slug:
            urls.append(f'{MLG_BASE.replace("mlgtraffic.net","trains-europe.fr")}/sncf/tgv/atlantique.htm')
        if 'reseau' in slug or 'réseau' in slug:
            urls.append(f'{MLG_BASE.replace("mlgtraffic.net","trains-europe.fr")}/sncf/tgv/reseau.htm')
        if 'duplex' in slug:
            urls.append(f'{MLG_BASE.replace("mlgtraffic.net","trains-europe.fr")}/sncf/tgv/duplex.htm')
        if 'pos' in slug:
            urls.append(f'{MLG_BASE.replace("mlgtraffic.net","trains-europe.fr")}/sncf/tgv/pos.htm')
        if 'ouigo' in slug:
            urls.append(f'{MLG_BASE.replace("mlgtraffic.net","trains-europe.fr")}/sncf/tgv/ouigo.htm')
        return urls
    # Extract numeric part
    m = re.search(r'(\d+)', model)
    num = m.group(1) if m else ''
    slug_base = re.sub(r'[^A-Za-z0-9]', '', model).lower()
    slug_no_space = re.sub(r'\s+', '', model).lower()
    if category == 'locomotive':
        if num:
            urls.append(f'http://www.trains-europe.fr/sncf/locomotives/{num}.htm')
        urls.append(f'http://www.trains-europe.fr/sncf/locomotives/{slug_no_space}.htm')
    else:
        # EMU
        if num:
            urls.append(f'http://www.trains-europe.fr/sncf/automoteurs/{slug_no_space}.htm')
            urls.append(f'http://www.trains-europe.fr/sncf/automoteurs/{num}.htm')
            if slug_base != num:
                urls.append(f'http://www.trains-europe.fr/sncf/automoteurs/z{num}.htm')
        else:
            urls.append(f'http://www.trains-europe.fr/sncf/automoteurs/{slug_no_space}.htm')
    return urls


def fetch_specs(model, category, car_count, xml_name, niv1_title, cache):
    key = f"{model}|{category}|{car_count}"
    if key in cache:
        return cache[key]
    # Trains d'Europe currently only covers SNCF/French rolling stock
    if not xml_name.startswith(('SNCF_', 'France_', 'RATP_')):
        cache[key] = {}
        return {}
    urls = trains_europe_urls(model, category, niv1_title)
    for url in urls:
        data = http_get(url, timeout=15)
        if not data:
            continue
        html = data.decode('latin-1', errors='ignore')
        specs = parse_trains_europe(html)
        if specs:
            res = convert_specs(specs, car_count)
            if res:
                cache[key] = res
                return res
    cache[key] = {}
    return {}


def image_rel_to_local(image_value, xml_name):
    """image_value like 'images/SNCF/LE/BB8100_VO'. Return local relative path without extension."""
    rel = image_value[len('images/'):] if image_value.startswith('images/') else image_value
    top = rel.split('/')[0]
    is_french = xml_name.startswith(('SNCF_', 'France_', 'RATP_')) or xml_name.lower() in ('constructeurs_e.xml', 'coll_rosco_e.htm')
    if is_french:
        known_tops = {d.name for d in IMG_DIR.iterdir() if d.is_dir()}
        if top not in known_tops:
            # Most often missing country prefix for SNCF wagons (images/W/ -> SNCF/W)
            rel = 'SNCF/' + rel
    return rel


def determine_sides(typeligne, image_rel):
    """Return list of side suffixes to download/use for a Ligne."""
    if typeligne == '2':
        return ['_R', '_L']
    # Typeligne 1 or absent: single image; but some basenames already end with _L/_R
    base = Path(image_rel).name
    if base.endswith('_R') or base.endswith('_L'):
        return ['']
    return ['']


def image_exists(rel, side):
    return (IMG_DIR / f"{rel}{side}.gif").exists()


def make_id(base, side, composite=False):
    base = Path(base).name
    if composite:
        return f'cat-{base}_comp'
    if side == '':
        return f'cat-{base}'
    return f'cat-{base}{side}'


def is_driving_trailer(category, nom, notes, image_rel):
    if category != 'voiture':
        return False
    tokens = set(re.split(r'[^A-Za-z0-9]+', (nom or '').lower()))
    if DRIVING_TRAILER_NOMS & tokens:
        return True
    low_notes = (notes or '').lower()
    if any(k in low_notes for k in ('steering', 'pilote', 'conduite', 'driving')):
        return True
    base = Path(image_rel).name.lower()
    if any(base.endswith(s) for s in DRIVING_TRAILER_SUFFIXES):
        return True
    return False


def estimate_coach_capacity(nom, notes):
    low = (nom + ' ' + (notes or '')).lower()
    if 'resto' in low or 'restaurant' in low or 'bar' in low:
        return 0
    if 'fourgon' in low or 'baggage' in low or 'bagages' in low:
        return 0
    if '1st' in low or 'first' in low or 'première' in low or '_a ' in low or ' a ' in low or low.endswith(' a'):
        return 30
    if 'ab' in low or 'mixte' in low or '1st/2nd' in low:
        return 55
    return 70


def build_series_name(xml_name, niv0, niv1, niv2):
    nompage1 = text_of(niv0.find('Nompage1'))
    nompage2 = text_of(niv0.find('Nompage2'))
    t1 = text_of(niv1.find('Titre1'))
    t2 = text_of(niv2.find('Titre2'))
    parts = [p for p in [nompage1, t1, t2] if p]
    if not parts and nompage2:
        parts = [nompage2]
    return ' '.join(parts).strip()


def build_entry(xml_name, niv0, niv1, niv2, ligne, image_rel, side, existing_by_image, cache, is_composite=False, comp_name=''):
    nom = text_of(ligne.find('Nom'))
    notes = text_of(ligne.find('Notes'))
    typeligne = ligne.get('Typeligne') or '1'
    rel_base = image_rel_to_local(image_rel, xml_name)
    local_rel = rel_base
    # For Typeligne 2, append _R/_L to the local relative path
    if typeligne == '2' and side:
        local_rel = local_rel + side
    # else if single left/right basename, side is '' and local_rel already ends with _L/_R

    if local_rel.lower().endswith('.png'):
        image_path = f'img/catalog/{local_rel}'
    else:
        image_path = f'img/catalog/{local_rel}.gif'

    category, sub = get_category_and_wagon_sub(xml_name, image_rel, text_of(niv0.find('Nompage2')))
    traction = guess_traction(category, niv1, niv2, ligne, image_rel)
    if category in ('voiture', 'wagon'):
        traction = 'none'
    series_name = build_series_name(xml_name, niv0, niv1, niv2)

    # Use only the model name shown to the left of the image on the site.
    name = nom or series_name or Path(rel_base).name

    base_id = comp_name if is_composite else Path(rel_base).name
    entry_id = make_id(base_id, side if not is_composite else '', is_composite)

    entry = {
        'id': entry_id,
        'name': name,
        'category': category,
        'traction': traction,
        'maxSpeed': 0,
        'mass': 0,
        'power': 0,
        'passengerCapacity': 0,
        'freightCapacity': 0,
        'length': 0,
        'imageData': image_path,
        'seriesName': series_name,
        'numberStart': '',
        'purchasePrice': 0,
        'cargoTypes': [],
        '_source': 'MLG Traffic (CC BY-NC-SA 3.0)',
        'tonnage': 0,
    }

    # Preserve existing values if any
    old = existing_by_image.get(image_path)
    if old:
        for k in entry:
            if old.get(k) not in (None, ''):
                # keep some old values as fallback until we overwrite with better data
                if k in ('maxSpeed', 'mass', 'power', 'length', 'passengerCapacity', 'freightCapacity', 'purchasePrice'):
                    entry[k] = old[k]
                elif k in ('cargoTypes', 'wagonSubCategory', 'seriesName', 'name'):
                    entry[k] = old[k]
        if 'isDrivingTrailer' in old:
            entry['isDrivingTrailer'] = old['isDrivingTrailer']

    if sub:
        entry['wagonSubCategory'] = sub
    if category == 'wagon':
        entry['cargoTypes'] = get_wagon_cargos(sub)
    if category == 'voiture':
        entry['passengerCapacity'] = estimate_coach_capacity(nom, notes)

    # Driving trailer flag
    if is_driving_trailer(category, nom, notes, image_rel):
        entry['isDrivingTrailer'] = True

    # Specs from web for locomotives and EMUs (and TGV)
    if category in ('locomotive', 'automotrice'):
        model = get_model(niv1, niv2, nom)
        car_count = None
        if category == 'automotrice' and is_composite:
            car_count = len(ligne.findall('Image'))
        specs = fetch_specs(model, category, car_count, xml_name, text_of(niv1.find('Titre1')), cache)
        if specs:
            for k, v in specs.items():
                if v not in (None, 0, ''):
                    entry[k] = v
        # For locomotive no passenger
        if category == 'locomotive':
            entry['passengerCapacity'] = 0
            entry['freightCapacity'] = 0

    apply_defaults(entry)
    return entry


def build_composite(image_rels, typeligne, comp_name, xml_name, niv0, niv1, niv2, ligne, existing_by_image, cache):
    """Create a single PNG from multiple GIFs."""
    local_parts = []
    for rel in image_rels:
        lr = image_rel_to_local(rel, xml_name)
        # For Typeligne 1 composites use .gif directly; for Typeligne 2 use _R
        side = '' if typeligne != '2' else '_R'
        base = lr + side
        local_file = download_mlg_image(lr, side)
        if not local_file:
            # try without side if _R missing
            if typeligne == '2':
                local_file = download_mlg_image(lr, '')
                if local_file:
                    base = lr
            if not local_file:
                print(f'    [compo] missing image {rel}; abort composite')
                return None
        local_parts.append((local_file, base))

    out_dir = IMG_DIR / Path(local_parts[0][1]).parent / 'composed'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_name = re.sub(r'[^A-Za-z0-9_]', '_', comp_name).strip('_')[:60]
    if not out_name:
        out_name = Path(local_parts[0][1]).name
    out_path = out_dir / f'{out_name}.png'

    try:
        images = [Image.open(p).convert('RGBA') for p, _ in local_parts]
        total_w = sum(img.width for img in images)
        max_h = max(img.height for img in images)
        canvas = Image.new('RGBA', (total_w, max_h), (0, 0, 0, 0))
        x = 0
        for img in images:
            canvas.paste(img, (x, max_h - img.height), img)
            x += img.width
        canvas.save(out_path)
    except Exception as e:
        print(f'    [compo] error composing {comp_name}: {e}')
        return None

    comp_rel = str(out_path.relative_to(IMG_DIR)).replace('\\', '/')
    # Build an entry for this composite
    nom = text_of(ligne.find('Nom'))
    notes = text_of(ligne.find('Notes'))
    name = f"{nom} (composition)"
    if notes:
        name = f"{nom} — {notes} (composition)"
    entry = build_entry(xml_name, niv0, niv1, niv2, ligne, f'images/{comp_rel}', '', existing_by_image, cache, is_composite=True, comp_name=str(out_path.relative_to(IMG_DIR).with_suffix('').as_posix()))
    return entry


def process_xml(url, existing_by_image, cargo_types, cache, executor=None):
    print(f'[XML] {url}', flush=True)
    root = parse_xml(url)
    if root is None:
        return []
    xml_name = Path(url).name
    niv0 = root

    # First pass: gather all lignes and needed image downloads
    to_process = []  # list of dicts
    download_tasks = set()
    for niv1 in niv0.findall('Niv1'):
        for niv2 in niv1.findall('Niv2'):
            for ligne in niv2.findall('Ligne'):
                imgs = [i.text.strip() for i in ligne.findall('Image') if i.text and i.text.strip()]
                if not imgs:
                    continue
                typeligne = ligne.get('Typeligne') or '1'
                if len(imgs) > 1:
                    to_process.append({'type': 'composite', 'ligne': ligne, 'niv1': niv1, 'niv2': niv2, 'imgs': imgs, 'typeligne': typeligne})
                    continue
                image_rel = imgs[0]
                rel_base = image_rel_to_local(image_rel, xml_name)
                sides = determine_sides(typeligne, rel_base)
                for side in sides:
                    local = IMG_DIR / f"{rel_base}{side}.gif"
                    if not local.exists():
                        download_tasks.add((rel_base, side))
                to_process.append({'type': 'single', 'ligne': ligne, 'niv1': niv1, 'niv2': niv2, 'image_rel': image_rel, 'rel_base': rel_base, 'sides': sides})

    # Batch download missing images
    if download_tasks:
        tasks = list(download_tasks)
        print(f'  [down] {len(tasks)} missing images', flush=True)
        if executor:
            list(executor.map(lambda args: download_mlg_image(*args), tasks))
        else:
            for args in tasks:
                download_mlg_image(*args)

    # Second pass: build entries
    entries = []
    for info in to_process:
        if info['type'] == 'composite':
            comp_name = text_of(info['ligne'].find('Nom')) or text_of(info['niv2'].find('Titre2')) or text_of(info['niv1'].find('Titre1'))
            e = build_composite(info['imgs'], info['typeligne'], comp_name, xml_name, niv0, info['niv1'], info['niv2'], info['ligne'], existing_by_image, cache)
            if e:
                entries.append(e)
            continue
        for side in info['sides']:
            rel_base = info['rel_base']
            image_rel = info['image_rel']
            local = IMG_DIR / f"{rel_base}{side}.gif"
            if not local.exists():
                if side == '_L':
                    continue
                if side == '_R':
                    # try without side
                    local = IMG_DIR / f"{rel_base}.gif"
                    if local.exists():
                        side = ''
                    else:
                        continue
                else:
                    continue
            e = build_entry(xml_name, niv0, info['niv1'], info['niv2'], info['ligne'], image_rel, side, existing_by_image, cache)
            entries.append(e)
    return entries


def ensure_cargo_types(cargo_types, keys):
    existing_types = {ct['type'] for ct in cargo_types}
    for k in keys:
        meta = CARGO_META.get(k)
        if not meta:
            continue
        if k in existing_types:
            continue
        cargo_types.append({
            'category': meta['category'],
            'type': k,
            'name': meta['name'],
            'unit': meta['unit'],
            'pricePerUnit': meta['pricePerUnit'],
            'hazard': meta['hazard'],
        })


MLG_IMAGE_PREFIX = 'img/catalog/'

def is_mlg_entry(e):
    return str(e.get('imageData') or '').startswith(MLG_IMAGE_PREFIX)


def main():
    print('Loading catalog...', flush=True)
    cargo, catalog, prefix, suffix = load_catalog()
    # Strip all old MLG entries to rebuild the catalog from scratch
    before = len(catalog)
    catalog = [e for e in catalog if not is_mlg_entry(e)]
    removed = before - len(catalog)
    print(f'  {len(catalog)} existing entries (removed {removed} old MLG entries)', flush=True)
    existing_by_image = {e.get('imageData'): e for e in catalog if e.get('imageData')}
    cache = load_cache()
    new_entries = []
    seen_ids = {e['id'] for e in catalog}
    max_workers = int(os.environ.get('CATALOG_WORKERS', '40'))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for url in ALL_MLG_URLS:
            entries = process_xml(url, existing_by_image, cargo, cache, executor=executor)
            for e in entries:
                if e['id'] in seen_ids:
                    # update existing by id
                    for i, old in enumerate(catalog):
                        if old['id'] == e['id']:
                            catalog[i] = e
                            break
                else:
                    catalog.append(e)
                    seen_ids.add(e['id'])
            new_entries.extend(entries)
            print(f'  -> processed {len(entries)} entries', flush=True)
    # Ensure all cargo types referenced in catalog exist
    used_cargos = set()
    for e in catalog:
        used_cargos.update(e.get('cargoTypes') or [])
    ensure_cargo_types(cargo, used_cargos)
    print(f'Writing catalog with {len(catalog)} entries and {len(cargo)} cargo types...', flush=True)
    write_catalog(cargo, catalog, prefix, suffix)
    save_cache(cache)
    print('Done', flush=True)


if __name__ == '__main__':
    main()
