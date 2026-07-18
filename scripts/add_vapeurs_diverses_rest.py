from pathlib import Path
from PIL import Image
import json, re, urllib.request

repo = Path('/home/ubuntu/repos/RAIL-EMPIRE-APP')
img_dir = repo / 'img/catalog/SNCF/LV'
img_dir.mkdir(parents=True, exist_ok=True)

def dl(rel, side=''):
    url = f"http://www.mlgtraffic.net/images/SNCF/LV/{rel}{side}.gif"
    local = img_dir / f"{rel}{side}.gif"
    if not local.exists() or local.stat().st_size == 0:
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'DevinBot/1.0'})
            data = urllib.request.urlopen(req, timeout=20).read()
            local.write_bytes(data)
        except Exception as e:
            print('DL fail', url, e)
            return None
    return local

def len_m(rel, side=''):
    f = dl(rel, f'_{side}')
    if not f:
        return 0.0
    try:
        im = Image.open(f)
        return round(im.width / 10, 1)
    except Exception as e:
        print('IMG fail', f, e)
        return 0.0

# base -> (name, seriesName, mass, power, maxSpeed, numberStart, source)
MLG_BASE = 'http://www.mlgtraffic.net/images/SNCF/LV/'
SPECS = [
    # Ex Etat
    ('SNCF_3_231D_Anim', '3-231 D', 'Type le moins transformé.', 163.0, 1943, 130, '3', 'Wikipedia FR 231 État 501 à 783 (franco.wiki)'),
    ('SNCF_3_231G_Anim', '3-231 G', 'Distribution Dabeg à cames rotatives.', 163.0, 1943, 130, '3', 'Wikipedia FR 231 État 501 à 783 (franco.wiki)'),
    ('SNCF_3_231H_Anim', '3-231 H', '', 163.0, 1943, 130, '3', 'Wikipedia FR 231 État 501 à 783 (franco.wiki)'),
    ('SNCF_3_141C_V_Anim', '3-141 C', 'Sans ACFI. Livrée verte.', 147.0, 1250, 100, '3', 'fr-academic.com 141 État 141-001 à 250'),
    ('SNCF_3_141C_N_Anim', '3-141 C', 'Sans ACFI. Livrée noire.', 147.0, 1250, 100, '3', 'fr-academic.com 141 État 141-001 à 250'),
    ('SNCF_3_141C_ACFI_NFJ_Anim', '3-141 C', 'Avec ACFI. Livrée noire avec filets jaune.', 147.0, 1250, 100, '3', 'fr-academic.com 141 État 141-001 à 250'),
    ('SNCF_3_141TC_Anim', '2-141 TC', 'Ex Etat, livrée noire.', 96.2, 986, 90, '2', 'antiqbrocdelatour.com / Patrimoine Ferroviaire 141 TC'),
    # Ex PO-Midi
    ('SNCF_4_230G_Anim', '4-230 G', 'Livrée noire.', 107.7, 1030, 100, '4', 'Wikipedia FR 230 PO 4201 à 4370'),
    ('SNCF_2_230G_Anim', '2-230 G', 'Locomotives transférées au nord dans les années \'50.', 107.7, 1030, 100, '2', 'Wikipedia FR 230 PO 4201 à 4370'),
    ('SNCF_3_230K_Cab_Anim', '3-230 K', 'Version modifiée avec cabine additionnelle sur le tender pour les marches tender en avant.', 107.7, 1030, 100, '3', 'Wikipedia FR 230 PO 4201 à 4370, variantes mutées à l\'État'),
    ('SNCF_4_141TA1_Anim', '4-141 TA', 'Version avec TIA et plaques.', 92.7, 900, 70, '4', 'Wikipedia FR 141 T PO 5301 à 5490'),
    ('SNCF_4_141TA2_Anim', '4-141 TA', 'Version à numéros peints.', 92.7, 900, 70, '4', 'Wikipedia FR 141 T PO 5301 à 5490'),
    ('SNCF_4_141TA3_Anim', '4-141 TA', 'Version à numéros peints et filets rouges.', 92.7, 900, 70, '4', 'Wikipedia FR 141 T PO 5301 à 5490'),
    ('SNCF_4_141TA4_Anim', '4-141 TA', 'Version avec plaques et filets rouges sur les caisses à eau.', 92.7, 900, 70, '4', 'Wikipedia FR 141 T PO 5301 à 5490'),
    ('SNCF_4_141TA_N1_Anim', '4-141 TA', 'Version noire, plaques.', 92.7, 900, 70, '4', 'Wikipedia FR 141 T PO 5301 à 5490'),
    ('SNCF_4_141TA_N2_Anim', '4-141 TA', 'Version noire, numéros peints. ACFI.', 92.7, 900, 70, '4', 'Wikipedia FR 141 T PO 5301 à 5490'),
    # Ex PLM
    ('SNCF_5_231G1_Anim', '5-231 G', 'Livrée verte. Tender d\'origine.', 176.0, 1693, 130, '5', 'Wikipedia FR 231 PLM 2 à 86 / 231 K'),
    ('SNCF_1_231G1_Anim', '1-231 G', 'Pacific PLM émigrées sur la région Est. Livrée noire caractéristique de la région.', 176.0, 1693, 130, '1', 'Wikipedia FR 231 PLM 2 à 86 / 231 K'),
    ('SNCF_1_231K1_Anim', '1-231 K', 'Pacific PLM émigrées sur la région Est. Transformations plus poussées, tender Nord.', 176.0, 1693, 130, '1', 'Wikipedia FR 231 PLM 2 à 86 / 231 K'),
    ('SNCF_2_231K1_Anim', '2-231 K', 'Pacific PLM émigrées sur la région Nord. Livrée verte. Tender Nord.', 176.0, 1693, 130, '2', 'Wikipedia FR 231 PLM 2 à 86 / 231 K'),
    ('SNCF_5_140J1_Anim', '5-140 J', '', 130.0, 950, 85, '5', 'Wikipedia FR 140 A PLM 1 à 170; loco-info PLM 140 A'),
    ('SNCF_5_140J2_Anim', '5-140 J', 'Marquages et plaques différents, protection anti-caténaire.', 130.0, 950, 85, '5', 'Wikipedia FR 140 A PLM 1 à 170; loco-info PLM 140 A'),
    ('SNCF_5_141F_V1_Anim', '5-141 F', 'Etat après dernière modernisation. Livrée verte. Tender 25A à trois essieux.', 157.6, 2061, 105, '5', 'franco.wiki 141 PLM 1 à 680'),
    ('SNCF_5_141F_V1_Anim', '5-141 F', 'Etat après dernière modernisation. Livrée verte. Tender 30A à bogies.', 164.6, 2061, 105, '5', 'franco.wiki 141 PLM 1 à 680'),
    ('SNCF_4_141F_NT25A_Anim', '4-141 F', 'Transférée au sud-ouest. Livrée noire. Tender 25A.', 157.6, 2061, 105, '4', 'franco.wiki 141 PLM 1 à 680'),
    ('SNCF_4_141F_NT30A_Anim', '4-141 F', 'Transférée au sud-ouest. Livrée noire. Tender 30A.', 164.6, 2061, 105, '4', 'franco.wiki 141 PLM 1 à 680'),
    ('SNCF_5_030TB_Anim', '5-030 TB', 'Tender 13A.', 47.6, 544, 50, '5', 'Wikipedia FR 030 T PLM 7401 à 7615; USATC S100 power'),
    ('SNCF_5_242TC1_Anim', '5-242 TC', 'Livrée verte.', 119.3, 1100, 85, '5', 'Wikipedia FR 242 CT PLM 1 à 50'),
    ('SNCF_5_242TC2_Anim', '5-242 TC', 'Avec écrans pare-fumée.', 119.3, 1100, 85, '5', 'Wikipedia FR 242 CT PLM 1 à 50'),
    # Armistice
    ('SNCF_040D_N1_Anim', '040 D', 'Livrée noire avec plaques.', 116.0, 927, 55, '0', 'Wikipedia EN Prussian G 8.1 / Alsace-Lorraine G 8.1'),
    ('SNCF_040D_N2_Anim', '040 D', 'Livrée noire sans plaques. Sablières non symétriques.', 116.0, 927, 55, '0', 'Wikipedia EN Prussian G 8.1 / Alsace-Lorraine G 8.1'),
    ('SNCF_040D_V_Anim', '040 D', 'Livrée verte.', 116.0, 927, 55, '0', 'Wikipedia EN Prussian G 8.1 / Alsace-Lorraine G 8.1'),
    # US
    ('SNCF_141R_CN1_Anim', '141 R', 'Première série, chauffe au charbon, tender soudé, roues à rayons, noire.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_CV1_Anim', '141 R', 'Première série, chauffe au charbon, tender soudé, roues à rayons, verte à filets.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_CV2_Anim', '141 R', 'Première série, chauffe au charbon, un essieu avec roues boxpox, verte à filets.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_CV3_Anim', '141 R', 'Deuxième série, chauffe au charbon, roues boxpox, verte.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_FN1_Anim', '141 R', 'Deuxième série, chauffe au fuel, petit tender, roues boxpox, noire.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_FN2_Anim', '141 R', 'Deuxième série, chauffe au fuel, petit tender à caisse soudée, 1 roue boxpox, noire.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_FV1_Anim', '141 R', 'Deuxième série, chauffe au fuel, petit tender, roues boxpox, verte.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_141R_FV2_Anim', '141 R', 'Deuxième série, chauffe au fuel, petit tender, un essieu avec roues boxpox, verte avec bord de tablier jaune.', 191.0, 2150, 100, '1', 'fr-academic.com 141 R; patrimoine-ferroviaire.fr'),
    ('SNCF_030TU_N_Anim', '030 TU', 'Livrée noire.', 45.0, 544, 50, '0', 'Hornby-Jouef / USATC S100 specs'),
    ('SNCF_030TU1_Anim', '030 TU', 'Livrée verte.', 45.0, 544, 50, '0', 'Hornby-Jouef / USATC S100 specs'),
    ('SNCF_030TU2_Anim', '030 TU', 'Plaques. Soute agrandie.', 45.0, 544, 50, '0', 'Hornby-Jouef / USATC S100 specs'),
]

new_entries = []
for base, name, desc, mass, power, speed, nstart, src in SPECS:
    for side in ['R','L']:
        length = len_m(base, side)
        id_core = base.replace('SNCF_','').replace('_Anim','')
        # avoid duplicate ids for duplicate image (5-141 F V1 variants)
        # use side and a hash of desc to differentiate
        if base == 'SNCF_5_141F_V1_Anim':
            suffix = 'T25A' if '25A' in desc else 'T30A'
            entry_id = f"cat-{id_core}_{suffix}_{side}"
        else:
            entry_id = f"cat-{id_core}_{side}"
        entry = {
            'id': entry_id,
            'name': name,
            'category': 'locomotive',
            'traction': 'vapeur',
            'maxSpeed': speed,
            'mass': mass,
            'power': power,
            'passengerCapacity': 0,
            'freightCapacity': 0,
            'length': length,
            'imageData': f"img/catalog/SNCF/LV/{base}_{side}.gif",
            'seriesName': desc,
            'numberStart': nstart,
            'purchasePrice': int(power * 1000),
            'cargoTypes': [],
            '_source': f"MLG Traffic (CC BY-NC-SA 3.0); specs {src}",
            'tonnage': mass,
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
