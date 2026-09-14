#!/usr/bin/env python3
"""Build Rail Empire SC V3 local RailGraph shards from railway vector data.

Supported inputs without extra dependencies:
  * .osm / .xml OpenStreetMap XML
  * .osm.pbf OpenStreetMap PBF (native minimal protobuf reader)
  * .geojson / .json LineString or MultiLineString features

Multiple regional inputs may be merged in one build. The builder keeps exact
source geometry/node identities, keeps every track-like OpenRailwayMap class (including lifecycle and urban rail)
for explicit Schedule Creator routing, and produces JS shards loadable from file://.
"""
from __future__ import annotations
import argparse, csv, json, math, os, struct, sys, xml.etree.ElementTree as ET, zlib
from collections import Counter, defaultdict
from pathlib import Path

ACTIVE_RAILWAY = {'rail','narrow_gauge','preserved','light_rail','subway','tram','miniature','funicular','abandoned','razed','disused','proposed','construction'}
EXCLUDED_RAILWAY = {'monorail'}
INACTIVE_VALUES = set()

ORM_ALLOWED_STATES = {'present','preserved','construction','proposed','disused','abandoned','razed'}
ORM_ALLOWED_FEATURES = {'rail','narrow_gauge','preserved','light_rail','subway','tram','miniature','funicular'}
ORM_ARRAY_FIELDS = {'gauges','reporting_marks','operator'}
ORM_BOOL_FIELDS = {'highspeed','tunnel','bridge'}
ORM_NUM_FIELDS = {'rank','maxspeed','frequency','voltage','future_frequency','future_voltage','train_protection_rank','train_protection_construction_rank'}
ORM_IGNORED_EXPORT_FIELDS = {'id','way','way_length'}
ORM_REQUIRED_FIELDS = {'osm_id','feature','state','maxspeed','preferred_direction','electrification_state','gauges'}
ORM_KNOWN_STATES = {'present','preserved','construction','proposed','disused','abandoned','razed'}
ORM_KNOWN_ELECTRIFICATION_STATES = {'present','construction','proposed','deelectrified','abandoned','no'}


def _blank(v):
    return v is None or (isinstance(v,str) and not v.strip())


def _pg_array(v):
    if v is None: return []
    if isinstance(v,(list,tuple)): return [str(x) for x in v if not _blank(x)]
    s=str(v).strip()
    if not s: return []
    if s.startswith('{') and s.endswith('}'):
        # PostgreSQL CSV exports array values as {a,b,"c,d"}. csv can parse
        # the comma/quote grammar once the outer braces are removed.
        try: return [x for x in next(csv.reader([s[1:-1]],escapechar='\\')) if x!='']
        except Exception: pass
    return [x.strip() for x in s.replace(';',',').split(',') if x.strip()]


def _orm_scalar(field,v):
    if _blank(v): return None
    if field in ORM_ARRAY_FIELDS: return _pg_array(v)
    if field in ORM_BOOL_FIELDS:
        if isinstance(v,bool): return v
        return str(v).strip().lower() in {'1','t','true','yes','y'}
    if field in ORM_NUM_FIELDS:
        try:
            x=float(v)
            return int(x) if field in {'rank','voltage','future_voltage','train_protection_rank','train_protection_construction_rank'} and x.is_integer() else x
        except: return None
    return str(v)


def _normalise_orm_row(row):
    out={}
    for k,v in dict(row or {}).items():
        key=str(k).strip()
        if not key or key in ORM_IGNORED_EXPORT_FIELDS: continue
        out[key]=_orm_scalar(key,v)
    oid=out.get('osm_id')
    if oid is None: return None
    try: out['osm_id']=str(int(float(oid)))
    except: out['osm_id']=str(oid).strip()
    return out


def read_orm_railway_line(path):
    """Read an export of OpenRailwayMap-vector's railway_line table.

    Accepted formats: CSV (recommended) or JSON list / {rows:[...]}. ORM
    segmentizes long geometries for tile queries, so one osm_id can appear in
    several rows. We collapse those rows only when their non-geometry
    attributes are identical.
    """
    p=Path(path)
    if p.suffix.lower()=='.json':
        obj=json.loads(p.read_text(encoding='utf-8'))
        rows=obj.get('rows',[]) if isinstance(obj,dict) else obj
    else:
        with p.open('r',encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
    rows=list(rows or [])
    if not rows:
        raise SystemExit('Export ORM railway_line vide: impossible de construire un RailGraph fiable.')
    schema={str(k).strip() for k in dict(rows[0] or {})}
    missing=sorted(ORM_REQUIRED_FIELDS-schema)
    if missing:
        raise SystemExit('Export ORM railway_line incompatible: colonne(s) requise(s) absente(s): '+', '.join(missing))
    by_id={}
    duplicates=0
    for raw in rows:
        row=_normalise_orm_row(raw)
        if not row: continue
        state=str(row.get('state') or '').lower()
        if state and state not in ORM_KNOWN_STATES:
            raise SystemExit(f'Export ORM incompatible: state inconnu {state!r} pour osm_id {row["osm_id"]}.')
        estate=str(row.get('electrification_state') or '').lower()
        if estate and estate not in ORM_KNOWN_ELECTRIFICATION_STATES:
            raise SystemExit(f'Export ORM incompatible: electrification_state inconnu {estate!r} pour osm_id {row["osm_id"]}.')
        oid=row['osm_id']; prev=by_id.get(oid)
        if prev is None:
            by_id[oid]=row; continue
        duplicates+=1
        keys=set(prev)|set(row)
        diff={k:(prev.get(k),row.get(k)) for k in keys if k!='osm_id' and prev.get(k)!=row.get(k)}
        if diff:
            sample=', '.join(f'{k}={a!r}/{b!r}' for k,(a,b) in list(diff.items())[:5])
            raise SystemExit(f'Export ORM incohérent pour osm_id {oid}: attributs différents entre segments ({sample}).')
    if duplicates:
        print(f'[RailGraph] ORM railway_line: {duplicates} segment(s) dupliqué(s) regroupé(s) par osm_id.',file=sys.stderr)
    return by_id


def _all_railway_way(tags):
    return bool(str(tags.get('railway','')).strip())


def _orm_scope_routable(row):
    return str(row.get('state') or '').lower() in ORM_ALLOWED_STATES and str(row.get('feature') or '').lower() in ORM_ALLOWED_FEATURES


def apply_orm_railway_line(ways, attrs):
    """Join exact PBF topology with OpenRailwayMap's prepared semantics.

    Presence in railway_line is the authority that a way is a railway line.
    Rail Empire's gameplay scope then keeps present/preserved heavy railway
    (rail + narrow_gauge) and excludes tram/light_rail/subway/etc.
    """
    out=[]; unmatched=excluded=0
    for w in ways:
        row=attrs.get(str(w.get('id')))
        if row is None:
            unmatched+=1; continue
        if not _orm_scope_routable(row):
            excluded+=1; continue
        tags=w.get('tags') or {}
        w=dict(w)
        w['railway']=str(row.get('feature') or w.get('railway') or 'rail')
        ms=row.get('maxspeed')
        w['maxSpeed']=float(ms) if isinstance(ms,(int,float)) else 30
        w['maxSpeedSource']='ORM' if isinstance(ms,(int,float)) else 'FALLBACK_30'
        # Directional raw OSM limits remain exact metadata; ORM's dominant
        # maxspeed/preferred_direction are the primary line semantics.
        w['maxSpeedForward']=parse_speed(tags.get('maxspeed:forward'))
        w['maxSpeedBackward']=parse_speed(tags.get('maxspeed:backward'))
        estate=str(row.get('electrification_state') or '')
        w['electrified']=True if estate=='present' else (False if estate=='no' else None)
        w['electrifiedState']=estate
        if row.get('voltage') is not None: w['voltage']=[float(row['voltage'])]
        if row.get('frequency') is not None: w['frequency']=[float(row['frequency'])]
        gauges=[]
        for g in row.get('gauges') or []:
            try: gauges.append(float(g))
            except: pass
        if gauges: w['gauge']=gauges
        w['loadingGauge']=str(row.get('loading_gauge') or '')
        w['usage']=str(row.get('usage') or '')
        w['service']=str(row.get('service') or '')
        w['trafficMode']=str(row.get('traffic_mode') or '')
        w['preferredDirection']=str(row.get('preferred_direction') or '')
        w['name']=str(row.get('name') or w.get('name') or '')
        w['ref']=str(row.get('ref') or w.get('ref') or '')
        w['trackRef']=str(row.get('track_ref') or w.get('trackRef') or '')
        w['orm']={
            'state':row.get('state'),'feature':row.get('feature'),'rank':row.get('rank'),'highspeed':row.get('highspeed'),
            'speedLabel':row.get('speed_label'),'electrificationState':row.get('electrification_state'),
            'futureVoltage':row.get('future_voltage'),'futureFrequency':row.get('future_frequency'),
            'trackClass':row.get('track_class'),'reportingMarks':row.get('reporting_marks') or [],
            'trainProtection':row.get('train_protection'),'trainProtectionRank':row.get('train_protection_rank'),
            'trainProtectionConstruction':row.get('train_protection_construction'),
            'operator':row.get('operator') or [],'trafficMode':row.get('traffic_mode'),'radio':row.get('radio'),
            'tunnel':row.get('tunnel'),'bridge':row.get('bridge'),'layer':row.get('layer'),
        }
        tp=dict(w.get('trainProtection') or {})
        if row.get('train_protection'): tp['orm']=row.get('train_protection')
        if row.get('train_protection_construction'): tp['construction']=row.get('train_protection_construction')
        w['trainProtection']=tp
        out.append(w)
    print(f'[RailGraph] joint ORM: {len(out)} retenu(s), {excluded} hors scope gameplay, {unmatched} sans railway_line.',file=sys.stderr)
    return out


def hav(a,b):
    R=6371.0
    lat1,lon1=a; lat2,lon2=b
    p1,p2=math.radians(lat1),math.radians(lat2)
    dlat=math.radians(lat2-lat1); dlon=math.radians(lon2-lon1)
    x=math.sin(dlat/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dlon/2)**2
    return R*2*math.atan2(math.sqrt(x),math.sqrt(max(0.0,1-x)))


def parse_num_list(v):
    out=[]
    for x in str(v or '').replace(',',';').split(';'):
        try: out.append(float(x.strip()))
        except: pass
    return out


def parse_speed(v):
    s=str(v or '').strip().lower()
    if not s: return None
    # Keep numeric railway limits; symbolic values remain unknown/fallback.
    if 'mph' in s:
        try: return round(float(s.split()[0])*1.609344,3)
        except: return None
    try: return float(s.split(';')[0])
    except: return None


def is_routable(tags):
    rw=str(tags.get('railway','')).strip().lower()
    if rw in EXCLUDED_RAILWAY or rw in INACTIVE_VALUES: return False
    if rw not in ACTIVE_RAILWAY: return False
    return True


def normalise_way(wid, coords, node_ids, tags):
    if len(coords)<2: return None
    ms=parse_speed(tags.get('maxspeed'))
    return {
      'id': str(wid), 'railway': tags.get('railway','rail'),
      'maxSpeed': ms if ms is not None else 30,
      'maxSpeedSource': 'OSM' if ms is not None else 'FALLBACK_30',
      'maxSpeedForward': parse_speed(tags.get('maxspeed:forward')),
      'maxSpeedBackward': parse_speed(tags.get('maxspeed:backward')),
      'electrified': False if tags.get('electrified')=='no' else (True if tags.get('electrified') else None),
      'electrifiedMode': tags.get('electrified',''),
      'voltage': parse_num_list(tags.get('voltage')),
      'frequency': parse_num_list(tags.get('frequency')),
      'gauge': parse_num_list(tags.get('gauge')),
      'loadingGauge': tags.get('loading_gauge',tags.get('structure_gauge','')),
      'axleLoad': _float_or_none(tags.get('axle_load')),
      'metreLoad': _float_or_none(tags.get('metre_load')),
      'tracks': _int_or(tags.get('tracks'),1),
      'usage': tags.get('usage',''), 'service': tags.get('service',''),
      'trafficMode': tags.get('railway:traffic_mode',''),
      'preferredDirection': tags.get('railway:preferred_direction',''),
      'bidirectional': tags.get('railway:bidirectional',''),
      'oneway': tags.get('oneway',''),
      'trainProtection': {
        'etcs':tags.get('railway:etcs',''),'pzb':tags.get('railway:pzb',''),'lzb':tags.get('railway:lzb',''),
        'tvm':tags.get('railway:tvm',''),'scmt':tags.get('railway:scmt','')},
      'name': tags.get('name',''), 'ref': tags.get('ref',''),
      'trackRef': tags.get('railway:track_ref',tags.get('track_ref','')),
      'geometry': [{'lat':float(lat),'lon':float(lon)} for lat,lon in coords],
      'nodeIds': [str(x) for x in node_ids], 'tags': tags,
    }


def _float_or_none(v):
    try: return float(v)
    except: return None

def _int_or(v,d):
    try: return int(float(v))
    except: return d


def read_osm_xml(path, filter_fn=is_routable):
    nodes={}; raw=[]
    # Streaming-ish two-pass parser: nodes are needed for way geometry.
    for ev,el in ET.iterparse(path,events=('end',)):
        if el.tag.endswith('node'):
            try: nodes[str(el.attrib['id'])]=(float(el.attrib['lat']),float(el.attrib['lon']))
            except: pass
        elif el.tag.endswith('way'):
            tags={c.attrib.get('k',''):c.attrib.get('v','') for c in el if c.tag.endswith('tag')}
            if filter_fn(tags):
                ids=[str(c.attrib.get('ref','')) for c in el if c.tag.endswith('nd')]
                raw.append((str(el.attrib.get('id','')),ids,tags))
        if el.tag.endswith('node') or el.tag.endswith('way'):
            el.clear()
    ways=[]
    for wid,ids,tags in raw:
        if all(n in nodes for n in ids):
            w=normalise_way(wid,[nodes[n] for n in ids],ids,tags)
            if w: ways.append(w)
    return ways


def _pb_varint(buf, pos):
    value=0; shift=0
    while True:
        if pos>=len(buf): raise ValueError('protobuf varint tronqué')
        b=buf[pos]; pos+=1
        value |= (b & 0x7f) << shift
        if b<0x80: return value,pos
        shift += 7
        if shift>70: raise ValueError('protobuf varint trop long')


def _pb_zigzag(v):
    return (v >> 1) ^ -(v & 1)


def _pb_fields(buf):
    pos=0; n=len(buf)
    while pos<n:
        key,pos=_pb_varint(buf,pos); field=key>>3; wire=key&7
        if wire==0:
            value,pos=_pb_varint(buf,pos); yield field,wire,value
        elif wire==1:
            if pos+8>n: raise ValueError('protobuf fixed64 tronqué')
            yield field,wire,buf[pos:pos+8]; pos+=8
        elif wire==2:
            ln,pos=_pb_varint(buf,pos); end=pos+ln
            if end>n: raise ValueError('protobuf bytes tronqué')
            yield field,wire,buf[pos:end]; pos=end
        elif wire==5:
            if pos+4>n: raise ValueError('protobuf fixed32 tronqué')
            yield field,wire,buf[pos:pos+4]; pos+=4
        else:
            raise ValueError(f'protobuf wire type non pris en charge: {wire}')


def _pb_packed_varints(buf, signed=False):
    out=[]; pos=0
    while pos<len(buf):
        v,pos=_pb_varint(buf,pos); out.append(_pb_zigzag(v) if signed else v)
    return out


def _pbf_blob_payload(blob):
    raw=None; raw_size=None; zdata=None
    for field,wire,value in _pb_fields(blob):
        if field==1 and wire==2: raw=value
        elif field==2 and wire==0: raw_size=value
        elif field==3 and wire==2: zdata=value
        elif field in {4,5,6,7} and wire==2:
            raise ValueError('Compression PBF non prise en charge dans ce build (seuls raw/zlib sont supportés).')
    if raw is not None: return raw
    if zdata is not None:
        data=zlib.decompress(zdata)
        if raw_size is not None and len(data)!=raw_size:
            raise ValueError(f'Taille PBF décompressée invalide: {len(data)} != {raw_size}')
        return data
    raise ValueError('Blob PBF sans payload raw/zlib')


def _iter_pbf_blocks(path):
    with open(path,'rb') as f:
        while True:
            head=f.read(4)
            if not head: break
            if len(head)!=4: raise ValueError('Entête de bloc PBF tronquée')
            hlen=struct.unpack('>I',head)[0]
            if hlen<=0 or hlen>64*1024: raise ValueError(f'Taille BlobHeader PBF invalide: {hlen}')
            hb=f.read(hlen)
            if len(hb)!=hlen: raise ValueError('BlobHeader PBF tronqué')
            typ=''; datasize=None
            for field,wire,value in _pb_fields(hb):
                if field==1 and wire==2: typ=value.decode('utf-8','replace')
                elif field==3 and wire==0: datasize=value
            if datasize is None or datasize<0 or datasize>64*1024*1024:
                raise ValueError(f'Taille Blob PBF invalide: {datasize}')
            blob=f.read(datasize)
            if len(blob)!=datasize: raise ValueError('Blob PBF tronqué')
            yield typ,_pbf_blob_payload(blob)


def _parse_stringtable(buf):
    out=[]
    for field,wire,value in _pb_fields(buf):
        if field==1 and wire==2: out.append(value.decode('utf-8','replace'))
    return out


def _pbf_way_from_message(buf, strings):
    wid=None; keys=[]; vals=[]; refs=[]
    for field,wire,value in _pb_fields(buf):
        if field==1 and wire==0: wid=value
        elif field==2:
            keys.extend(_pb_packed_varints(value) if wire==2 else [value])
        elif field==3:
            vals.extend(_pb_packed_varints(value) if wire==2 else [value])
        elif field==8:
            refs.extend(_pb_packed_varints(value,signed=True) if wire==2 else [_pb_zigzag(value)])
    if wid is None: return None
    tags={}
    for k,v in zip(keys,vals):
        if 0<=k<len(strings) and 0<=v<len(strings): tags[strings[k]]=strings[v]
    absrefs=[]; cur=0
    for d in refs: cur+=d; absrefs.append(str(cur))
    return str(wid),absrefs,tags


def _pbf_dense_nodes(buf, granularity, lat_offset, lon_offset, needed, out):
    ids=[]; lats=[]; lons=[]
    for field,wire,value in _pb_fields(buf):
        if field==1: ids.extend(_pb_packed_varints(value,signed=True) if wire==2 else [_pb_zigzag(value)])
        elif field==8: lats.extend(_pb_packed_varints(value,signed=True) if wire==2 else [_pb_zigzag(value)])
        elif field==9: lons.extend(_pb_packed_varints(value,signed=True) if wire==2 else [_pb_zigzag(value)])
    cid=clat=clon=0
    for did,dlat,dlon in zip(ids,lats,lons):
        cid+=did; clat+=dlat; clon+=dlon; sid=str(cid)
        if sid in needed:
            out[sid]=(round((lat_offset+granularity*clat)*1e-9,9),round((lon_offset+granularity*clon)*1e-9,9))


def _pbf_node(buf, granularity, lat_offset, lon_offset, needed, out):
    nid=lat=lon=None
    for field,wire,value in _pb_fields(buf):
        if field==1 and wire==0: nid=_pb_zigzag(value)
        elif field==8 and wire==0: lat=_pb_zigzag(value)
        elif field==9 and wire==0: lon=_pb_zigzag(value)
    if nid is None or lat is None or lon is None: return
    sid=str(nid)
    if sid in needed:
        out[sid]=(round((lat_offset+granularity*lat)*1e-9,9),round((lon_offset+granularity*lon)*1e-9,9))


def _pbf_primitive_block(payload, on_way=None, needed_nodes=None, node_out=None):
    strings=[]; groups=[]; granularity=100; lat_offset=0; lon_offset=0
    for field,wire,value in _pb_fields(payload):
        if field==1 and wire==2: strings=_parse_stringtable(value)
        elif field==2 and wire==2: groups.append(value)
        elif field==17 and wire==0: granularity=value
        elif field==19 and wire==0: lat_offset=value if value < (1<<63) else value-(1<<64)
        elif field==20 and wire==0: lon_offset=value if value < (1<<63) else value-(1<<64)
    for group in groups:
        for field,wire,value in _pb_fields(group):
            if on_way is not None and field==3 and wire==2:
                w=_pbf_way_from_message(value,strings)
                if w is not None: on_way(*w)
            elif needed_nodes is not None and node_out is not None and field==2 and wire==2:
                _pbf_dense_nodes(value,granularity,lat_offset,lon_offset,needed_nodes,node_out)
            elif needed_nodes is not None and node_out is not None and field==1 and wire==2:
                _pbf_node(value,granularity,lat_offset,lon_offset,needed_nodes,node_out)


def read_pbf(path, filter_fn=is_routable):
    # Two passes keep memory bounded: first collect only routable rail ways and
    # their node refs, then read coordinates only for those referenced nodes.
    raw=[]; needed=set()
    def on_way(wid,ids,tags):
        if not filter_fn(tags) or len(ids)<2: return
        raw.append((wid,ids,tags)); needed.update(ids)
    for typ,payload in _iter_pbf_blocks(path):
        if typ=='OSMData': _pbf_primitive_block(payload,on_way=on_way)
    nodes={}
    if needed:
        for typ,payload in _iter_pbf_blocks(path):
            if typ=='OSMData': _pbf_primitive_block(payload,needed_nodes=needed,node_out=nodes)
    ways=[]; missing=0
    for wid,ids,tags in raw:
        if all(n in nodes for n in ids):
            w=normalise_way(wid,[nodes[n] for n in ids],ids,tags)
            if w: ways.append(w)
        else: missing+=1
    if missing:
        print(f'[RailGraph] {missing} way(s) ferroviaire(s) ignoré(s): nœuds absents de l’extrait PBF.',file=sys.stderr)
    return ways


def read_overpass_json_obj(obj, filter_fn=is_routable):
    elements=obj.get('elements') or []
    nodes={}
    for el in elements:
        if el.get('type')=='node' and el.get('id') is not None:
            try: nodes[str(el['id'])]=(float(el['lat']),float(el['lon']))
            except: pass
    ways=[]
    for el in elements:
        if el.get('type')!='way' or el.get('id') is None: continue
        tags={str(k):str(v) for k,v in (el.get('tags') or {}).items()}
        if not filter_fn(tags): continue
        ids=[str(x) for x in (el.get('nodes') or [])]
        geom=el.get('geometry') or []
        coords=[]
        if len(geom)==len(ids) and len(ids)>=2:
            try: coords=[(float(p['lat']),float(p['lon'])) for p in geom]
            except: coords=[]
        elif ids and all(n in nodes for n in ids): coords=[nodes[n] for n in ids]
        if len(coords)<2: continue
        w=normalise_way(str(el['id']),coords,ids,tags)
        if w: ways.append(w)
    return ways


def read_geojson_obj(obj, filter_fn=is_routable):
    feats=obj.get('features',[]) if obj.get('type')=='FeatureCollection' else [obj]
    ways=[]; synthetic_node=-1
    # Coordinate-based synthetic ids deliberately join coincident GeoJSON line
    # endpoints. GeoJSON is a compatibility/import format only; OSM PBF/JSON is
    # preferred because it retains authoritative source node ids.
    coord_ids={}
    def node_id(lat,lon):
        nonlocal synthetic_node
        key=(round(float(lat),9),round(float(lon),9))
        if key not in coord_ids: coord_ids[key]=f'geo:{synthetic_node}';synthetic_node-=1
        return coord_ids[key]
    for idx,f in enumerate(feats):
        g=f.get('geometry') or {}; props=dict(f.get('properties') or {})
        tags=dict(props.get('tags') or props)
        if 'railway' not in tags: tags['railway']='rail'
        if not filter_fn(tags): continue
        parts=[]
        if g.get('type')=='LineString': parts=[g.get('coordinates') or []]
        elif g.get('type')=='MultiLineString': parts=g.get('coordinates') or []
        for j,part in enumerate(parts):
            coords=[(float(y),float(x)) for x,y,*_ in part]
            ids=[node_id(lat,lon) for lat,lon in coords]
            wid=props.get('osm_id',props.get('id',f'{idx}:{j}'))
            w=normalise_way(str(wid),coords,ids,tags)
            if w: ways.append(w)
    return ways


def read_json_vector(path, filter_fn=is_routable):
    obj=json.loads(Path(path).read_text(encoding='utf-8'))
    if isinstance(obj,dict) and isinstance(obj.get('elements'),list): return read_overpass_json_obj(obj,filter_fn=filter_fn)
    return read_geojson_obj(obj,filter_fn=filter_fn)


def read_geojson(path, filter_fn=is_routable):
    return read_json_vector(path,filter_fn=filter_fn)


def read_input(path, filter_fn=is_routable):
    p=Path(path); suf=''.join(p.suffixes).lower()
    if suf.endswith('.osm.pbf') or p.suffix.lower()=='.pbf': return read_pbf(p,filter_fn=filter_fn)
    if p.suffix.lower() in {'.osm','.xml'}: return read_osm_xml(p,filter_fn=filter_fn)
    if p.suffix.lower() in {'.geojson','.json'}: return read_json_vector(p,filter_fn=filter_fn)
    raise SystemExit(f'Format non pris en charge pour {p}: utilisez .osm/.xml, .osm.pbf ou .geojson.')


def merge_ways(groups):
    merged={}; duplicate_same=0
    for ways in groups:
        for w in ways:
            wid=str(w['id']); prev=merged.get(wid)
            if prev is None:
                merged[wid]=w; continue
            if prev.get('nodeIds')==w.get('nodeIds'):
                duplicate_same+=1; continue
            a=prev.get('nodeIds') or []; b=w.get('nodeIds') or []
            # Regional extracts can duplicate a border way with one copy being
            # a strict sub-chain of the other. Keep the complete exact chain.
            def contains(big,small):
                if len(small)>len(big): return False
                for i in range(len(big)-len(small)+1):
                    if big[i:i+len(small)]==small: return True
                return False
            if contains(a,b): continue
            if contains(b,a): merged[wid]=w; continue
            raise SystemExit(f'Conflit wayId {wid} entre extraits: géométries incompatibles; arrêt plutôt que corruption silencieuse.')
    if duplicate_same:
        print(f'[RailGraph] {duplicate_same} way(s) dupliqué(s) identiques dédupliqués entre extraits.',file=sys.stderr)
    return list(merged.values())


def bbox_of_way(w):
    lats=[p['lat'] for p in w['geometry']]; lons=[p['lon'] for p in w['geometry']]
    return min(lats),min(lons),max(lats),max(lons)


def cells_for_bbox(bb,cell):
    s,w,n,e=bb
    eps=1e-10
    r0=math.floor(s/cell); r1=math.floor(((n-eps) if n>s else n)/cell)
    c0=math.floor(w/cell); c1=math.floor(((e-eps) if e>w else e)/cell)
    r1=max(r0,r1); c1=max(c0,c1)
    return [(r,c) for r in range(r0,r1+1) for c in range(c0,c1+1)]


def estimate_way_runtime_bytes(w):
    """Conservative decoded-JS residency estimate used by the 96 MiB governor.

    This is intentionally an upper-ish estimate, not a serialization size. The
    runtime rehydrates geometry points and node ids as JS arrays/objects, so a
    binary byte count alone is not a safe OOM guard on old 32-bit browsers.
    """
    n=1024
    geom=w.get('geometry') or []; ids=w.get('nodeIds') or []
    n+=len(geom)*128
    n+=sum(64+len(str(x))*2 for x in ids)
    for k in ('railway','maxSpeedSource','electrifiedMode','electrifiedState','loadingGauge','usage','service','trafficMode','preferredDirection','bidirectional','oneway','name','ref','trackRef','layer'):
        v=w.get(k)
        if v is not None: n+=48+len(str(v))*2
    for k,base in (('trainProtection',128),('orm',256)):
        v=w.get(k)
        if v:
            try:n+=base+len(json.dumps(v,separators=(',',':'),ensure_ascii=False))*2
            except Exception:n+=base
    return max(1024,((int(n)+63)//64)*64)


def estimate_shard_runtime_bytes(ways):
    # Boundary-spanning duplicate ways are deliberately counted in each shard.
    # That makes manifest preflight conservative; runtime ref-counting removes
    # the duplication from actual residentWayBytes.
    return sum(estimate_way_runtime_bytes(w) for w in ways)


def build_pack(ways,outdir,cell=0.20,coarse_step_km=8.0,source='OpenRailwayMap-compatible OpenStreetMap railway vector data',binary_v2=False,binary_codec='gzip'):
    outdir=Path(outdir); outdir.mkdir(parents=True,exist_ok=True)
    if not ways: raise SystemExit('Aucune voie ferroviaire routable trouvée.')
    if binary_v2:
        from railgraph_binary_v2 import encode_shard, encode_coarse, make_file_wrapper
    binary_raw_total=0; binary_wrapper_total=0
    # Shards: duplicate boundary-spanning ways into every touched cell. Runtime de-dupes by way id.
    cell_ways=defaultdict(list)
    for w in ways:
        for c in cells_for_bbox(bbox_of_way(w),cell): cell_ways[c].append(w)
    ordered=sorted(cell_ways)
    cell_to_idx={c:i for i,c in enumerate(ordered)}
    shards=[]; grid_cells={}
    for i,(r,c) in enumerate(ordered):
        sways=cell_ways[(r,c)]
        sid=f'{r}_{c}'
        if binary_v2:
            fn=f'shard_{i:05d}.rg2.js'; binary=encode_shard(sid,sways); wrapper=make_file_wrapper(sid,binary,codec=binary_codec)
            (outdir/fn).write_text(wrapper,encoding='ascii'); binary_raw_total+=len(binary);binary_wrapper_total+=(outdir/fn).stat().st_size
        else:
            fn=f'shard_{i:05d}.js';payload={'schema':'rail-empire-railgraph-shard-v1','id':sid,'ways':sways};shard_json=json.dumps(payload,separators=(',',':'),ensure_ascii=False)
            (outdir/fn).write_text(
                'globalThis.__RAILNET_TRACK_SHARDS__=globalThis.__RAILNET_TRACK_SHARDS__||Object.create(null);\n'
                f'globalThis.__RAILNET_TRACK_SHARDS__[{json.dumps(sid)}]={shard_json};\n',encoding='utf-8')
        neigh=[]
        for dr in (-1,0,1):
          for dc in (-1,0,1):
            if dr==dc==0: continue
            j=cell_to_idx.get((r+dr,c+dc))
            if j is not None: neigh.append(j)
        south=r*cell; west=c*cell
        sm={'id':sid,'file':fn,'south':south,'west':west,'north':south+cell,'east':west+cell,'neighbors':sorted(neigh),'ways':len(sways)}
        if binary_v2: sm.update({'format':'railgraph-binary-v2','codec':binary_codec,'binaryBytes':len(binary),'runtimeEstimateBytes':estimate_shard_runtime_bytes(sways)})
        shards.append(sm);grid_cells[f'{r}:{c}']=[i]

    # Coarse graph: exact shared OSM junctions + way endpoints + periodic points.
    count=Counter(n for w in ways for n in w['nodeIds'])
    kept=set()
    for w in ways:
        ids=w['nodeIds']; geom=w['geometry']
        if not ids: continue
        kept.add(ids[0]); kept.add(ids[-1])
        acc=0.0
        for k in range(1,len(ids)):
            a=(geom[k-1]['lat'],geom[k-1]['lon']); b=(geom[k]['lat'],geom[k]['lon']); acc+=hav(a,b)
            if count[ids[k]]>1 or acc>=coarse_step_km:
                kept.add(ids[k]); acc=0.0
    node_coord={}
    for w in ways:
        for nid,p in zip(w['nodeIds'],w['geometry']):
            if nid in kept: node_coord[nid]=(p['lat'],p['lon'])
    node_ids=sorted(node_coord)
    ni={n:i for i,n in enumerate(node_ids)}
    coarse_nodes=[[n,round(node_coord[n][0]*1e6),round(node_coord[n][1]*1e6)] for n in node_ids]
    edge_seen=set(); edges=[]
    for w in ways:
        ids=w['nodeIds']; geom=w['geometry']; last=None; acc=0.0; segcells=set()
        for k,nid in enumerate(ids):
            if k:
                acc+=hav((geom[k-1]['lat'],geom[k-1]['lon']),(geom[k]['lat'],geom[k]['lon']))
                # all cells touched by this detailed segment envelope
                bb=(min(geom[k-1]['lat'],geom[k]['lat']),min(geom[k-1]['lon'],geom[k]['lon']),max(geom[k-1]['lat'],geom[k]['lat']),max(geom[k-1]['lon'],geom[k]['lon']))
                segcells.update(cell_to_idx[c] for c in cells_for_bbox(bb,cell) if c in cell_to_idx)
            if nid not in kept: continue
            if last is not None and last!=nid and acc>0:
                a,b=ni[last],ni[nid]; key=(min(a,b),max(a,b),str(w['id']))
                if key not in edge_seen:
                    edge_seen.add(key); edges.append([a,b,round(acc*1000),sorted(segcells),0])
            last=nid; acc=0.0; segcells=set()
    coarse={'cellDeg':max(cell,0.20),'nodes':coarse_nodes,'edges':edges}
    stats={'ways':len(ways),'shards':len(shards),'coarseNodes':len(coarse_nodes),'coarseEdges':len(edges),'runtimeEstimateBytesSum':sum(int(x.get('runtimeEstimateBytes',0) or 0) for x in shards)}
    manifest={
      'schema':'rail-empire-railgraph-v2' if binary_v2 else 'rail-empire-railgraph-v1','version':2 if binary_v2 else 1,'prepared':True,
      'source':source,
      'attribution':'© OpenStreetMap contributors; OpenRailwayMap',
      'routing':'exact-source-geometry-no-synthetic-stitches','shardCellDeg':cell,
      'shards':shards,'grid':{'cellDeg':cell} if binary_v2 else {'cellDeg':cell,'cells':grid_cells},
      'stats':stats
    }
    if binary_v2:
        cb=encode_coarse(coarse);cfn='coarse.rgc2.js';cw=make_file_wrapper('__coarse__',cb,codec=binary_codec);(outdir/cfn).write_text(cw,encoding='ascii')
        manifest.update({'format':'railgraph-binary-v2','binaryCodec':binary_codec,'coarseFile':cfn,'coarseFormat':'railgraph-coarse-binary-v2','coarseBinaryBytes':len(cb)})
        stats.update({'binaryV2RawBytes':binary_raw_total+len(cb),'binaryV2WrapperBytes':binary_wrapper_total+(outdir/cfn).stat().st_size})
    else: manifest['coarse']=coarse
    (outdir/'manifest.js').write_text('globalThis.__RAILNET_TRACK_PACK__='+json.dumps(manifest,separators=(',',':'),ensure_ascii=False)+';\n',encoding='utf-8')
    (outdir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return manifest


def _read_shard_payload(pack_dir,meta):
    path=Path(pack_dir)/str(meta.get('file',''))
    text=path.read_text(encoding='utf-8').strip()
    marker=']='; pos=text.find(marker)
    if pos<0: raise SystemExit(f'Shard RailGraph illisible: {path}')
    raw=text[pos+len(marker):].strip()
    if raw.endswith(';'): raw=raw[:-1]
    if str(meta.get('format') or '').lower()=='railgraph-binary-v2' or path.name.endswith('.rg2.js'):
        import base64,gzip
        from railgraph_binary_v2 import decode_shard
        entry=json.loads(raw);data=base64.b64decode(entry.get('data') or '')
        codec=str(entry.get('codec') or 'raw').lower()
        if codec=='gzip': data=gzip.decompress(data)
        elif codec!='raw': raise SystemExit(f'Codec RailGraph V2 inconnu: {codec}')
        return decode_shard(data)
    obj=json.loads(raw)
    if not isinstance(obj,dict) or not isinstance(obj.get('ways'),list):
        raise SystemExit(f'Shard RailGraph invalide: {path}')
    return obj


def _read_coarse_payload(pack_dir,manifest):
    if manifest.get('coarse') is not None: return manifest.get('coarse') or {}
    fn=manifest.get('coarseFile')
    if not fn: return {}
    path=Path(pack_dir)/str(fn);text=path.read_text(encoding='utf-8').strip();pos=text.find(']=')
    if pos<0: raise SystemExit(f'Coarse RailGraph illisible: {path}')
    raw=text[pos+2:].strip()
    if raw.endswith(';'): raw=raw[:-1]
    import base64,gzip
    from railgraph_binary_v2 import decode_coarse
    entry=json.loads(raw);data=base64.b64decode(entry.get('data') or '');codec=str(entry.get('codec') or 'raw').lower()
    if codec=='gzip': data=gzip.decompress(data)
    elif codec!='raw': raise SystemExit(f'Codec coarse RailGraph V2 inconnu: {codec}')
    return decode_coarse(data)


def _merge_way_records(records,context=''):
    if not records: return None
    cur=records[0]
    for nxt in records[1:]:
        if cur.get('nodeIds')==nxt.get('nodeIds'): continue
        a=cur.get('nodeIds') or []; b=nxt.get('nodeIds') or []
        def contains(big,small):
            if len(small)>len(big): return False
            return any(big[i:i+len(small)]==small for i in range(len(big)-len(small)+1))
        if contains(a,b): continue
        if contains(b,a): cur=nxt; continue
        raise SystemExit(f'Conflit wayId {cur.get("id")} pendant fusion de packs {context}: géométries incompatibles.')
    return cur


def merge_pack_dirs(pack_dirs,outdir,binary_v2=False,binary_codec='gzip'):
    pack_dirs=[Path(x) for x in pack_dirs]; outdir=Path(outdir); outdir.mkdir(parents=True,exist_ok=True)
    if binary_v2:
        from railgraph_binary_v2 import encode_shard, encode_coarse, make_file_wrapper
    binary_raw_total=0;binary_wrapper_total=0
    manifests=[]; cell=None
    for d in pack_dirs:
        mp=d/'manifest.json'
        if not mp.exists(): raise SystemExit(f'Manifest RailGraph absent: {mp}')
        m=json.loads(mp.read_text(encoding='utf-8'))
        if not m.get('prepared'): raise SystemExit(f'Pack RailGraph non préparé: {d}')
        c=float(m.get('shardCellDeg') or m.get('grid',{}).get('cellDeg') or 0)
        if c<=0: raise SystemExit(f'Cellule RailGraph invalide: {d}')
        if cell is None: cell=c
        elif abs(cell-c)>1e-12: raise SystemExit('Fusion RailGraph refusée: shardCellDeg différents entre packs.')
        manifests.append(m)
    coarses=[_read_coarse_payload(d,m) for d,m in zip(pack_dirs,manifests)]

    # First pass is metadata-only: map each geographic cell to the regional shard
    # files that contribute to it. Actual way payloads are merged one cell at a
    # time, so an Europe build never needs every detailed way resident at once.
    cell_sources=defaultdict(list); cell_meta={}
    for d,m in zip(pack_dirs,manifests):
        for old_idx,meta in enumerate(m.get('shards') or []):
            sid=str(meta.get('id',old_idx));cell_sources[sid].append((d,meta))
            cell_meta.setdefault(sid,meta)
    def sid_key(sid):
        try:
            a,b=sid.split('_',1);return (int(a),int(b))
        except: return (10**9,sid)
    ordered=sorted(cell_sources,key=sid_key); new_idx={sid:i for i,sid in enumerate(ordered)}
    shards=[]; grid_cells={}; global_way_ids=set()
    for i,sid in enumerate(ordered):
        by_way=defaultdict(list)
        for d,meta in cell_sources[sid]:
            payload=_read_shard_payload(d,meta)
            for w in payload.get('ways') or []:
                if w and w.get('id') is not None: by_way[str(w['id'])].append(w)
        sways=[]
        for wid in sorted(by_way,key=lambda x:(len(x),x)):
            w=_merge_way_records(by_way[wid],context=f'cellule {sid}')
            if w is not None: sways.append(w);global_way_ids.add(str(w['id']))
        if binary_v2:
            fn=f'shard_{i:05d}.rg2.js';binary=encode_shard(sid,sways);wrapper=make_file_wrapper(sid,binary,codec=binary_codec);(outdir/fn).write_text(wrapper,encoding='ascii');binary_raw_total+=len(binary);binary_wrapper_total+=(outdir/fn).stat().st_size
        else:
            fn=f'shard_{i:05d}.js';payload={'schema':'rail-empire-railgraph-shard-v1','id':sid,'ways':sways}
            (outdir/fn).write_text(
                'globalThis.__RAILNET_TRACK_SHARDS__=globalThis.__RAILNET_TRACK_SHARDS__||Object.create(null);\n'
                f'globalThis.__RAILNET_TRACK_SHARDS__[{json.dumps(sid)}]={json.dumps(payload,separators=(",",":"),ensure_ascii=False)};\n',encoding='utf-8')
        meta=cell_meta[sid]
        try: r,c=(int(x) for x in sid.split('_',1))
        except:
            r=math.floor(float(meta.get('south',0))/cell);c=math.floor(float(meta.get('west',0))/cell)
        neigh=[]
        for dr in (-1,0,1):
            for dc in (-1,0,1):
                if dr==dc==0: continue
                j=new_idx.get(f'{r+dr}_{c+dc}')
                if j is not None: neigh.append(j)
        south=r*cell;west=c*cell
        sm={'id':sid,'file':fn,'south':south,'west':west,'north':south+cell,'east':west+cell,'neighbors':sorted(neigh),'ways':len(sways)}
        if binary_v2: sm.update({'format':'railgraph-binary-v2','codec':binary_codec,'binaryBytes':len(binary),'runtimeEstimateBytes':estimate_shard_runtime_bytes(sways)})
        shards.append(sm);grid_cells[f'{r}:{c}']=[i]

    # Merge only the compact coarse graphs. Shared exact OSM node ids are the
    # authority across regional borders, so adjoining packs reconnect naturally.
    coord_by_key={}; node_order=[]
    for coarse in coarses:
        for row in (coarse or {}).get('nodes') or []:
            key=str(row[0]);lat=int(row[1]);lon=int(row[2])
            prev=coord_by_key.get(key)
            if prev is None: coord_by_key[key]=(lat,lon);node_order.append(key)
            elif prev!=(lat,lon) and (abs(prev[0]-lat)>2 or abs(prev[1]-lon)>2):
                raise SystemExit(f'Conflit coordonnée coarse node {key} entre packs.')
    node_order.sort(key=lambda x:(len(x),x)); ni={k:i for i,k in enumerate(node_order)}
    coarse_nodes=[[k,coord_by_key[k][0],coord_by_key[k][1]] for k in node_order]
    edge_map={}
    for m,coarse in zip(manifests,coarses):
        old_nodes=(coarse or {}).get('nodes') or []; old_shards=m.get('shards') or []
        for e in (coarse or {}).get('edges') or []:
            try: ka=str(old_nodes[int(e[0])][0]);kb=str(old_nodes[int(e[1])][0])
            except: continue
            a,b=ni[ka],ni[kb];dist=int(e[2]);direction=int(e[4] if len(e)>4 else 0)
            mapped=[]
            for old in (e[3] if isinstance(e[3],list) else [e[3]]):
                try: sid=str(old_shards[int(old)].get('id',int(old)));mapped.append(new_idx[sid])
                except: pass
            if direction==0: ek=(min(a,b),max(a,b),0)
            else: ek=(a,b,direction)
            prev=edge_map.get(ek)
            if prev is None: edge_map[ek]=[a,b,dist,sorted(set(mapped)),direction]
            else:
                prev[2]=min(prev[2],dist);prev[3]=sorted(set(prev[3]).union(mapped))
    edges=list(edge_map.values())
    coarse={'cellDeg':max(cell,0.20),'nodes':coarse_nodes,'edges':edges}
    stats={'ways':len(global_way_ids),'shards':len(shards),'coarseNodes':len(coarse_nodes),'coarseEdges':len(edges),'mergedPacks':len(pack_dirs),'runtimeEstimateBytesSum':sum(int(x.get('runtimeEstimateBytes',0) or 0) for x in shards)}
    manifest={
      'schema':'rail-empire-railgraph-v2' if binary_v2 else 'rail-empire-railgraph-v1','version':2 if binary_v2 else 1,'prepared':True,
      'source':'Merged OpenRailwayMap-compatible OpenStreetMap regional RailGraph packs',
      'attribution':'© OpenStreetMap contributors; OpenRailwayMap',
      'routing':'exact-source-geometry-no-synthetic-stitches','shardCellDeg':cell,
      'shards':shards,'grid':{'cellDeg':cell} if binary_v2 else {'cellDeg':cell,'cells':grid_cells},'stats':stats
    }
    if binary_v2:
        cb=encode_coarse(coarse);cfn='coarse.rgc2.js';cw=make_file_wrapper('__coarse__',cb,codec=binary_codec);(outdir/cfn).write_text(cw,encoding='ascii')
        manifest.update({'format':'railgraph-binary-v2','binaryCodec':binary_codec,'coarseFile':cfn,'coarseFormat':'railgraph-coarse-binary-v2','coarseBinaryBytes':len(cb)})
        stats.update({'binaryV2RawBytes':binary_raw_total+len(cb),'binaryV2WrapperBytes':binary_wrapper_total+(outdir/cfn).stat().st_size})
    else: manifest['coarse']=coarse
    (outdir/'manifest.js').write_text('globalThis.__RAILNET_TRACK_PACK__='+json.dumps(manifest,separators=(',',':'),ensure_ascii=False)+';\n',encoding='utf-8')
    (outdir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return manifest


def main():
    ap=argparse.ArgumentParser(description='Build/merge local SCV3 RailGraph shards.')
    ap.add_argument('paths',nargs='+',help='input(s) followed by output directory')
    ap.add_argument('--cell-deg',type=float,default=0.20)
    ap.add_argument('--coarse-step-km',type=float,default=8.0)
    ap.add_argument('--merge-packs',action='store_true',help='treat inputs as prepared RailGraph pack directories and merge them')
    ap.add_argument('--orm-attributes',help='CSV/JSON export of OpenRailwayMap-vector railway_line; joins by osm_id and makes ORM semantics authoritative')
    ap.add_argument('--binary-v2',action='store_true',help='write compact RailGraph Binary V2 shards/coarse graph directly')
    ap.add_argument('--binary-codec',choices=['gzip','raw'],default='gzip',help='file:// wrapper codec for Binary V2')
    args=ap.parse_args()
    if len(args.paths)<2: ap.error('indiquez au moins une source puis le dossier de sortie')
    inputs=args.paths[:-1]; output=args.paths[-1]
    if args.merge_packs:
        m=merge_pack_dirs(inputs,output,binary_v2=args.binary_v2,binary_codec=args.binary_codec);print(json.dumps(m['stats'],ensure_ascii=False));return
    orm_attrs=read_orm_railway_line(args.orm_attributes) if args.orm_attributes else None
    groups=[]
    for src in inputs:
        print(f'[RailGraph] lecture {src}',file=sys.stderr)
        group=read_input(src,filter_fn=_all_railway_way if orm_attrs is not None else is_routable)
        if orm_attrs is not None:
            group=apply_orm_railway_line(group,orm_attrs)
        print(f'[RailGraph] {len(group)} way(s) routable(s) retenu(s)',file=sys.stderr)
        groups.append(group)
    ways=merge_ways(groups)
    print(f'[RailGraph] total fusionné: {len(ways)} way(s)',file=sys.stderr)
    source='OpenRailwayMap-vector filtered PBF + railway_line semantics (joined by osm_id)' if orm_attrs is not None else 'OpenRailwayMap-compatible OpenStreetMap railway vector data'
    m=build_pack(ways,output,args.cell_deg,args.coarse_step_km,source=source,binary_v2=args.binary_v2,binary_codec=args.binary_codec)
    print(json.dumps(m['stats'],ensure_ascii=False))

if __name__=='__main__': main()
