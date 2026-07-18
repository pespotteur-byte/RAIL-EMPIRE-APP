from pathlib import Path
from PIL import Image
import xml.etree.ElementTree as ET
import json, re, urllib.request, urllib.error

repo = Path('/home/ubuntu/repos/RAIL-EMPIRE-APP')
img_dir = repo / 'img/catalog/SNCF/LE'
img_dir.mkdir(parents=True, exist_ok=True)

def dl(rel, side):
    url = f"http://www.mlgtraffic.net/{rel}{side}.gif"
    local = img_dir / f"{Path(rel).name}{side}.gif"
    if not local.exists() or local.stat().st_size == 0:
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'DevinBot/1.0'})
            data = urllib.request.urlopen(req, timeout=20).read()
            local.write_bytes(data)
        except Exception as e:
            print('DL fail', url, e)
            return None
    return local

def len_m(rel, side):
    f = dl(rel, side)
    if not f:
        return 0.0
    try:
        im = Image.open(f)
        return round(im.width / 10, 1)
    except Exception as e:
        print('IMG fail', f, e)
        return 0.0

xml_path = '/tmp/le_bbn.xml'
root = ET.parse(xml_path).getroot()

CLASS_SPECS = {
    'BB 7200': {'power': 4400, 'mass': 84.0, 'base_speed': 160, 'length': 17.5, 'source': 'trains-europe.fr 7200.htm'},
    'BB 15000': {'power': 4400, 'mass': 88.0, 'base_speed': 180, 'length': 17.5, 'source': 'trains-europe.fr 15000.htm'},
    'BB 22200': {'power': 4040, 'mass': 88.0, 'base_speed': 160, 'length': 17.5, 'source': 'trains-europe.fr 22200.htm'},
}

def base_class(nom):
    m = re.match(r'(BB \d+)', nom)
    return m.group(1) if m else None

def speed_for(niv2, nom, notes, img):
    bc = base_class(nom)
    notes_l = (notes or '').lower()
    img_l = img.lower()
    if bc == 'BB 15000':
        return 180
    if bc in ('BB 7200','BB 22200'):
        # freight/infra variants are 100
        if 'fret' in notes_l or 'infra' in notes_l or '_f' in img_l or '_infra' in img_l or '_ouigotc' in img_l:
            return 100
        # small cab variants are 100 except explicitly converted to GV
        if 'petites cabines' in niv2.lower():
            if 'gv' in notes_l or 'en voyage' in notes_l or 'corail' in notes_l:
                return 160
            return 100
        # large cab default 160
        return 160
    return CLASS_SPECS.get(bc, {}).get('base_speed', 100)

new_entries = []
for niv1 in root.findall('Niv1'):
    for niv2 in niv1.findall('Niv2'):
        t2 = niv2.find('Titre2')
        niv2_name = t2.text if t2 is not None else ''
        for ligne in niv2.findall('Ligne'):
            nom = (ligne.find('Nom').text or '').strip()
            img = (ligne.find('Image').text or '').strip()
            notes = (ligne.find('Notes').text or '').strip() if ligne.find('Notes') is not None else ''
            if not nom or not img:
                continue
            bc = base_class(nom)
            spec = CLASS_SPECS.get(bc, CLASS_SPECS.get('BB 7200'))
            spd = speed_for(niv2_name, nom, notes, img)
            for side in ['R','L']:
                length = len_m(img, side)
                img_base = Path(img).name
                # id from image base to avoid duplicates
                entry_id = f"cat-{img_base}_{side}"
                entry = {
                    'id': entry_id,
                    'name': nom,
                    'category': 'locomotive',
                    'traction': 'electrique',
                    'maxSpeed': spd,
                    'mass': spec['mass'],
                    'power': spec['power'],
                    'passengerCapacity': 0,
                    'freightCapacity': 0,
                    'length': length,
                    'imageData': f"img/catalog/SNCF/LE/{img_base}_{side}.gif",
                    'seriesName': notes,
                    'numberStart': nom[0] if nom else '',
                    'purchasePrice': int(spec['power'] * 1000),
                    'cargoTypes': [],
                    '_source': f"MLG Traffic (CC BY-NC-SA 3.0); specs {spec['source']}",
                    'tonnage': spec['mass'],
                }
                new_entries.append(entry)

cat_path = repo / 'js/catalog-data.js'
text = cat_path.read_text(encoding='utf-8')
end_match = list(re.finditer(r'\]\s*;+\s*$', text))
end_pos = end_match[-1].start()
prefix = text[:end_pos]
suffix = text[end_pos:]
if prefix.rstrip().endswith('}'):
    prefix = prefix.rstrip() + ','
new_json = json.dumps(new_entries, indent=2, ensure_ascii=False)
new_inner = new_json[1:-1]
new_text = prefix + '\n' + new_inner + suffix
cat_path.write_text(new_text, encoding='utf-8')
print(f'Appended {len(new_entries)} entries.')
