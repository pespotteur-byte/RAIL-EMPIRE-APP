#!/usr/bin/env python3
"""Apply freight wagon technical specs from DB Cargo Gueterwagenkatalog."""
import asyncio
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import enhance_wagon_specs as ews

BASE = 'https://gueterwagenkatalog.dbcargo.com'


PAGE_CACHE_PATH = Path(__file__).parent / '.dbcargo_page_cache.json'


def load_page_cache():
    if PAGE_CACHE_PATH.exists():
        try:
            return json.loads(PAGE_CACHE_PATH.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def save_page_cache(cache):
    PAGE_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')


def fetch(url, retries=3):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1 + attempt)
                continue
            print(f'fetch failed {url}: {e}')
            return ''


def get_category_links():
    html = fetch(f'{BASE}/catalogue/by-wagon-category')
    links = []
    for m in re.finditer(r'<a[^>]*href="(/catalogue/by-wagon-category/[^"]*)"[^>]*>', html):
        href = m.group(1)
        if href and href not in links:
            links.append(href)
    return links


def get_wagon_cards(category_url):
    html = fetch(f'{BASE}{category_url}')
    cards = []
    for m in re.finditer(r'<a[^>]*href="(/catalogue/by-wagon-category/[^"]*)"[^>]*title="([^"]*)"', html, re.S):
        href = m.group(1)
        title = m.group(2).strip().replace('\n', ' ')
        # ignore the category page itself
        if href == category_url or href == category_url.rstrip('/'):
            continue
        if href.startswith('/catalogue/by-wagon-category/'):
            if title and title not in [c[0] for c in cards]:
                cards.append((title, href))
    return cards


def normalize(text):
    """Lowercase, replace separators with space, keep alphanumerics."""
    text = text.lower()
    # split glued letters/digits: Shimmns718 -> shimmns 718; 50m3 -> 50 m3
    text = re.sub(r'([a-z])(\d)', r'\1 \2', text)
    text = re.sub(r'(\d)([a-z])', r'\1 \2', text)
    text = re.sub(r'[^\w0-9]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def tokens(text):
    return [t for t in normalize(text).split() if t]


def _significant_tokens(toks):
    """Tokens that participate in matching.

    Keep alphabetic tokens of length >=2, but ignore 2-letter subcodes
    when a longer alphabetic word is also present (e.g. Shimmns-tu, Eaos-x).
    Single-letter codes are always ignored.
    """
    alpha = [t for t in toks if t.isalpha()]
    has_long = any(len(t) > 2 for t in alpha)
    letters = [t for t in alpha if not (has_long and len(t) <= 2)]
    nums = [t for t in toks if t.isdigit()]
    return letters + nums


def title_matches(title, variant):
    """Strict match: DB letters present and at least one DB number matches."""
    db = _significant_tokens(tokens(title))
    var = tokens(variant)
    var_letters = [t for t in var if t.isalpha()]
    var_nums = [t.lstrip('0') or '0' for t in var if t.isdigit()]
    db_nums = [t.lstrip('0') or '0' for t in db if t.isdigit()]
    db_letters = [t for t in db if t.isalpha()]

    if not all(t in var_letters for t in db_letters):
        return False

    if db_nums:
        if var_nums:
            if not any(dn in var_nums for dn in db_nums):
                return False
        elif not db_letters:
            return False
    return True


def base_matches(title, variant):
    """Loose match on letters only (used as fallback when exact numbers fail)."""
    db = _significant_tokens(tokens(title))
    var = tokens(variant)
    var_letters = [t for t in var if t.isalpha()]
    db_letters = [t for t in db if t.isalpha()]
    if not db_letters:
        return False
    return all(t in var_letters for t in db_letters)


def score_match(title, variant):
    """Higher is better; exact matches win."""
    if normalize(title) == normalize(variant):
        return 10000
    db = _significant_tokens(tokens(title))
    var = tokens(variant)
    var_letters = [t for t in var if t.isalpha()]
    var_nums = [t.lstrip('0') or '0' for t in var if t.isdigit()]
    score = 0
    for tok in db:
        if tok.isalpha():
            if tok in var_letters:
                score += 20
        elif tok.isdigit():
            if tok in var_nums:
                score += 50
    # bonus when the number of numeric tokens is the same (more precise)
    db_nums = [t for t in db if t.isdigit()]
    if db_nums and var_nums and len(db_nums) == len(var_nums):
        score += 30
    return score


def variants_for(name, series_name):
    """Yield candidate search strings from a catalog entry."""
    base = name.strip()
    # expand comma/slash/and
    parts = re.split(r'[,/;]|\band\b', base)
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        parts = [base]
    for p in parts:
        p = re.sub(r'[()"“”]', '', p)
        p = re.sub(r'\s+', ' ', p).strip()
        if p:
            yield p
    # fallback: use series tail only when the name itself has no usable identifier
    has_letters = bool(re.search(r'[A-Za-z]{2,}', base))
    has_numbers = bool(re.search(r'\d', base))
    if series_name and not (has_letters and has_numbers):
        tail = ' '.join(series_name.strip().split()[-4:])
        tail = re.sub(r'[()"“”]', '', tail)
        tail = re.sub(r'\s+', ' ', tail).strip()
        if tail:
            yield tail


def match_dbcargo(dbcargo_db, name, series_name):
    """Find best DB Cargo title and URL for a catalog name."""
    best = None
    best_score = -1
    for title, url in dbcargo_db:
        for variant in variants_for(name, series_name):
            strict = title_matches(title, variant)
            loose = base_matches(title, variant)
            if not strict and not loose:
                continue
            score = score_match(title, variant)
            if not strict:
                # fallback matches are worth much less than exact ones
                score = int(score / 10)
            if score > best_score:
                best_score = score
                best = (title, url)
    return best


def parse_and_apply(page_text, entry, dbcargo_title):
    specs = ews.parse_page(page_text)
    sub = entry.get('wagonSubCategory', '')
    cargos = ews.detect_cargos(page_text + '\n' + dbcargo_title.lower(), sub)
    ews.apply_wagon_specs(entry, specs, cargos)
    return specs


def main():
    page_cache = load_page_cache()

    cargo, catalog, prefix, suffix = ews.parse_catalog()
    print(f'Loaded {len(catalog)} catalog entries')

    wagon_entries = [e for e in catalog if e.get('category') == 'wagon']
    print(f'Wagon entries: {len(wagon_entries)}')

    cat_links = get_category_links()
    print(f'Found {len(cat_links)} DB Cargo categories')

    dbcargo_db = []
    for cat in cat_links:
        cards = get_wagon_cards(cat)
        print(f'  {cat}: {len(cards)} wagons')
        for title, href in cards:
            dbcargo_db.append((title, f'{BASE}{href}'))
        time.sleep(0.2)

    print(f'Total DB Cargo wagons: {len(dbcargo_db)}')

    # Build name -> list of entries for batching
    name_to_entries = {}
    for e in wagon_entries:
        n = e.get('name', '').strip()
        if n:
            name_to_entries.setdefault(n, []).append(e)

    matches = 0
    misses = 0
    for n, entries in name_to_entries.items():
        rep = entries[0]
        series = rep.get('seriesName', '')
        m = match_dbcargo(dbcargo_db, n, series)
        if not m:
            misses += 1
            continue
        title, url = m
        if url in page_cache:
            page = page_cache[url]
        else:
            page = fetch(url)
            if not page:
                continue
            page_cache[url] = page
        specs = ews.parse_page(page)
        sub = rep.get('wagonSubCategory', '')
        cargos = ews.detect_cargos(page + '\n' + title.lower(), sub)
        for e in entries:
            ews.apply_wagon_specs(e, specs, cargos)
        matches += 1
        if matches % 10 == 0:
            print(f'  matched {matches} so far ({misses} misses)')
        time.sleep(0.15)

    print(f'Matched {matches} names, missed {misses}')

    ews.write_catalog(cargo, catalog, prefix, suffix)
    save_page_cache(page_cache)
    print('Catalog written')


if __name__ == '__main__':
    main()
