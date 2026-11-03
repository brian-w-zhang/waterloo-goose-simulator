"""Compute the Waterloo Goose Simulator ground-truth set (ground_truth.json) from real data.

Inputs: the files in ../ (City of Waterloo footprints, water, creeks, trails; OSM samples;
lidar height CSV) plus a fresh OSM API map extract of the core bbox and the City Roads layer,
both fetched by this script if missing (into ./raw/, gitignored).
Run: python compute_ground_truth.py   (needs shapely, pyproj, numpy)
"""
import json, csv, os, math, urllib.request, datetime
import xml.etree.ElementTree as ET
from shapely.geometry import shape, LineString, box
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)
from shapely.ops import unary_union, transform
from pyproj import Transformer, Geod

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.dirname(HERE)
RAW = os.path.join(HERE, 'raw')
UA = {'User-Agent': 'waterloo-goose-simulator-ground-truth/0.1 (research)'}
OSM_URL = 'https://api.openstreetmap.org/api/0.6/map?bbox=-80.558,43.465,-80.537,43.478'
ROADS_URL = ('https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/12/query?where=1%3D1'
             '&geometry=-80.5580,43.4650,-80.5370,43.4780&geometryType=esriGeometryEnvelope&inSR=4326'
             '&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID,STREET_NAME,STREET_CLASS,NUMBER_LANES,ROAD_WIDTH'
             '&outSR=4326&f=geojson')
CORE_BBOX_LL = (-80.5580, 43.4650, -80.5370, 43.4780)

fwd = Transformer.from_crs(4326, 26917, always_xy=True).transform
inv = Transformer.from_crs(26917, 4326, always_xy=True).transform
geod = Geod(ellps='GRS80')

def fetch(url, name):
    os.makedirs(RAW, exist_ok=True)
    p = os.path.join(RAW, name)
    if not os.path.exists(p):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p

def load(p):
    return json.load(open(os.path.join(DS, p)))

def r1(x, n=1):
    return round(float(x), n)

# ---------- buildings ----------
city = load('city-of-waterloo/cow_building_footprints_campus.geojson')['features']
by_oid = {f['properties']['OBJECTID']: f for f in city}
heights = {int(r['objectid']): r for r in csv.DictReader(open(os.path.join(DS, 'ontario-lidar/uw_building_heights.csv')))}

# id, City BLDG_ABBREV, City OBJECTIDs to union (whole building), OBJECTID used for height, split
BUILDINGS = [
    ('DC', 'DC', [21642, 33305], 21642, 'dev'),
    ('MC', 'MC', [33399], 33399, 'dev'),
    ('M3', 'M3', [33392], 33392, 'holdout'),
    ('QNC', 'QNC', [29450], 29450, 'dev'),
    ('SLC', 'SLC', [19801, 3111], None, 'dev'),
    ('PAC', 'PAC', [30168, 33730], 30168, 'dev'),
    ('LIB', 'LIB', [34807], 34807, 'dev'),
    ('HH', 'HH', [29452, 34223], 29452, 'holdout'),
    ('ML', 'ML', [33395], 33395, 'dev'),
    ('E5', 'E5', [34882], 34882, 'dev'),
    ('E6', 'E6', [33795], 33795, 'holdout'),
    ('E7', 'PSE - E7', [31064], 31064, 'dev'),
    ('EIT', 'EIT', [20608], 20608, 'holdout'),
    ('STC', 'STC', [34894], 34894, 'dev'),
    ('EV3', 'EV3', [34889], 34889, 'holdout'),
    ('V1', 'V1', [33524], 33524, 'dev'),
    ('REV', 'REV', [33300], 33300, 'holdout'),
    ('PHY', 'PHY', [3110], 3110, 'dev'),
    ('CPH', 'CPH', [33298], 33298, 'holdout'),
    ('B1', 'B1', [30566], 30566, 'dev'),
    ('EV2', 'EV2', [30172], 30172, 'holdout'),
]

def oriented_dims(g):
    rect = g.minimum_rotated_rectangle
    c = list(rect.exterior.coords)[:4]
    e = [(c[i], c[(i + 1) % 4]) for i in range(4)]
    lens = [math.dist(a, b) for a, b in e]
    i = max(range(4), key=lambda k: lens[k])
    a, b = e[i]
    lo1, la1 = inv(*a); lo2, la2 = inv(*b)
    az = geod.inv(lo1, la1, lo2, la2)[0] % 180.0
    return max(lens), min(lens), az

buildings = []
for bid, ab, oids, hoid, split in BUILDINGS:
    polys = []
    for o in oids:
        g = transform(fwd, shape(by_oid[o]['geometry']))
        polys.append(g if g.is_valid else g.buffer(0))
        assert (by_oid[o]['properties'].get('BLDG_ABBREV') or '').strip() == ab, (bid, o)
    g = unary_union(polys)
    L, W, az = oriented_dims(g)
    minx, miny, maxx, maxy = g.bounds
    lon, lat = inv(g.centroid.x, g.centroid.y)
    p = by_oid[oids[0]]['properties']
    h = heights.get(hoid) if hoid else None
    hp = None
    if h and h['h_p90']:
        hp = {'p90_m': float(h['h_p90']), 'median_m': float(h['h_med']), 'ground_m': float(h['ground']),
              'source_objectid': hoid, 'lidar_px': int(h['lidar_px'])}
    buildings.append({
        'id': bid, 'city_abbrev': ab, 'name': (p.get('BLDG_NAME') or '').strip(), 'city_objectids': oids,
        'split': split,
        'centroid': {'lon': round(lon, 6), 'lat': round(lat, 6), 'utm_e': r1(g.centroid.x), 'utm_n': r1(g.centroid.y)},
        'footprint_area_m2': round(g.area), 'perimeter_m': round(g.length),
        'obb_long_m': r1(L), 'obb_short_m': r1(W), 'aspect': round(L / W, 2),
        'long_axis_bearing_true_deg': r1(az), 'bearing_reliable': (L / W) >= 1.3,
        'aabb_ew_m': r1(maxx - minx), 'aabb_ns_m': r1(maxy - miny),
        'height_lidar': hp, 'fire_storeys': p.get('FIRE_STOREYS'),
        'osm_iou_main_part': float(h['iou_osm']) if h else None,
    })

# ---------- OSM extract ----------
osm_path = fetch(OSM_URL, 'osm_map_core.xml')
root = ET.parse(osm_path).getroot()
nodes, ways = {}, {}
for e in root:
    if e.tag == 'node':
        nodes[e.get('id')] = (float(e.get('lon')), float(e.get('lat')), {t.get('k'): t.get('v') for t in e.findall('tag')})
    elif e.tag == 'way':
        ways[e.get('id')] = ([n.get('ref') for n in e.findall('nd')], {t.get('k'): t.get('v') for t in e.findall('tag')})
osm_newest = max(e.get('timestamp') for e in root if e.tag in ('node', 'way'))

def wline(w):
    return LineString([fwd(nodes[n][0], nodes[n][1]) for n in w[0] if n in nodes])

def node_pt(nid):
    lo, la, _ = nodes[nid]
    return lo, la

# ---------- landmarks (points) ----------
lm = {b['id']: (b['centroid']['lon'], b['centroid']['lat'], 'City footprint centroid (union of listed OBJECTIDs)') for b in buildings}
lm['ION_UW'] = (*node_pt('4211159080'), 'OSM node 4211159080 railway=station "University of Waterloo"')
transit = load('osm/osm_water_parking_transit.geojson')['features']
for f in transit:
    if f['properties'].get('osm_id') == 4211146895:
        lo, la = f['geometry']['coordinates']
        lm['ION_LAURIER'] = (lo, la, 'OSM node 4211146895 railway=station "Laurier - Waterloo Park" (osm_water_parking_transit.geojson)')
water = load('city-of-waterloo/cow_waterbodies.geojson')['features']
wb = {}
for f in water:
    n = (f['properties'].get('NAME') or '').strip()
    if n in ('Columbia Lake', 'Laurel Lake'):
        g = transform(fwd, shape(f['geometry']))
        wb[n] = (g, f['properties'])
        lo, la = inv(g.centroid.x, g.centroid.y)
        lm[n.replace(' ', '_').upper()] = (lo, la, f'City Water Bodies (Public_Base 21) polygon centroid, OBJECTID {f["properties"]["OBJECTID"]}')

PAIRS = [('DC', 'MC'), ('SLC', 'PAC'), ('MC', 'QNC'), ('E5', 'E7'), ('E5', 'E6'), ('MC', 'LIB'), ('LIB', 'HH'),
         ('HH', 'ML'), ('SLC', 'DC'), ('SLC', 'LIB'), ('V1', 'REV'), ('V1', 'SLC'), ('REV', 'SLC'), ('DC', 'ION_UW'),
         ('SLC', 'ION_UW'), ('ION_UW', 'ION_LAURIER'), ('PAC', 'REV'), ('EIT', 'PHY'), ('STC', 'B1'), ('EV3', 'EV2'),
         ('DC', 'V1'), ('QNC', 'STC'), ('E7', 'QNC'), ('CPH', 'E5'), ('V1', 'COLUMBIA_LAKE'), ('M3', 'DC'), ('LAUREL_LAKE', 'V1')]
HOLD_PAIRS = {('M3', 'DC'), ('E5', 'E6'), ('HH', 'ML'), ('EV3', 'EV2'), ('CPH', 'E5'), ('PAC', 'REV'), ('LAUREL_LAKE', 'V1')}
pairs = []
ratios = []
for a, b in PAIRS:
    (lo1, la1, _), (lo2, la2, _) = lm[a], lm[b]
    az, _, dg = geod.inv(lo1, la1, lo2, la2)
    e1, n1 = fwd(lo1, la1); e2, n2 = fwd(lo2, la2)
    du = math.hypot(e2 - e1, n2 - n1)
    ratios.append(du / dg)
    pairs.append({'a': a, 'b': b, 'utm_grid_m': r1(du), 'geodesic_m': r1(dg), 'azimuth_true_deg': r1(az % 360),
                  'split': 'holdout' if (a, b) in HOLD_PAIRS else 'dev'})

# ---------- lengths ----------
rr = [w for w in ways.values() if w[1].get('name') == 'Ring Road' and w[1].get('highway')]
roads = json.load(open(fetch(ROADS_URL, 'cow_roads_core.geojson')))['features']
rr_city = [f for f in roads if f['properties']['STREET_NAME'] == 'RING RD']
rr_city_len = sum(transform(fwd, shape(f['geometry'])).length for f in rr_city)
core = transform(fwd, box(*CORE_BBOX_LL))
creeks = [transform(fwd, shape(f['geometry'])) for f in load('city-of-waterloo/cow_creeks.geojson')['features']
          if f['properties'].get('CREEK_LABEL') == 'Laurel Creek']
creek_len = sum(g.intersection(core).length for g in creeks)
trails = [transform(fwd, shape(f['geometry'])) for f in load('city-of-waterloo/cow_trails.geojson')['features']
          if 'Laurel Trail' in (f['properties'].get('TRAIL_NAME') or '')]
trail_city_len = sum(g.intersection(core).length for g in trails)
lt_osm = [w for w in ways.values() if (w[1].get('name') or '').startswith('Laurel Trail')]
lt_osm_len = sum(wline(w).intersection(core).length for w in lt_osm)
corr = [w for w in ways.values() if w[1].get('highway') == 'corridor']
corr_core = sum(wline(w).intersection(core).length for w in corr)

def named_len(nm):
    ws = [w for w in ways.values() if w[1].get('name') == nm]
    return r1(sum(wline(w).length for w in ws)), len(ws)

lengths = [
    {'id': 'ring_road_osm', 'value_m': r1(sum(wline(w).length for w in rr)), 'n_ways': len(rr),
     'source': 'OSM ways name=Ring Road (all 12, incl. short one-way splits), OSM API map extract', 'authoritative': False},
    {'id': 'ring_road_city', 'value_m': r1(rr_city_len), 'n_segments': len(rr_city),
     'source': 'City Roads (Public_Base/MapServer/12) STREET_NAME=RING RD, centreline, core bbox', 'authoritative': True},
    {'id': 'laurel_creek_core_bbox', 'value_m': r1(creek_len), 'source': 'City Perennial Creeks (Public_Base 17) CREEK_LABEL=Laurel Creek clipped to core bbox', 'authoritative': True},
    {'id': 'laurel_trail_core_bbox_city', 'value_m': r1(trail_city_len), 'source': 'City Trails (Public_Operations 31) names containing Laurel Trail, clipped to core bbox', 'authoritative': True},
    {'id': 'laurel_trail_core_bbox_osm', 'value_m': r1(lt_osm_len), 'source': 'OSM ways named Laurel Trail*, clipped to core bbox', 'authoritative': False},
    {'id': 'osm_corridor_total_core_bbox', 'value_m': r1(corr_core), 'n_ways': len(corr), 'source': 'OSM highway=corridor, clipped to core bbox', 'authoritative': False},
]
for nm, wid in [('E5 Bridge', 'e5_bridge'), ('MC to QNC Walkway', 'mc_qnc_walkway'), ('Two Row Path', 'two_row_path'),
                ('Path 2 East', 'path_2_east'), ('Alumni Lane', 'alumni_lane'), ('South Walk', 'south_walk')]:
    v, n = named_len(nm)
    lengths.append({'id': wid, 'value_m': v, 'n_ways': n, 'source': f'OSM ways name="{nm}"', 'authoritative': False})

waterbodies = []
for n, (g, p) in wb.items():
    waterbodies.append({'id': n.replace(' ', '_').lower(), 'area_m2_computed': round(g.area), 'perimeter_m_computed': round(g.length),
                        'city_HECTARES_field': p.get('HECTARES'), 'city_SHAPE_AREA_field': round(p.get('SHAPE.AREA') or 0),
                        'source': f'City Water Bodies (Public_Base 21) OBJECTID {p["OBJECTID"]}'})

# ---------- widths from tags ----------
wtags = {}
for w in ways.values():
    if 'width' in w[1] and 'highway' in w[1]:
        k = (w[1]['highway'], w[1].get('name') or '')
        wtags.setdefault(k, set()).add(w[1]['width'])
width_tags = [{'highway': k[0], 'name': k[1], 'width_tag_values': sorted(v)} for k, v in sorted(wtags.items())]
lanes = {}
for f in roads:
    p = f['properties']
    lanes.setdefault(p['STREET_NAME'], set()).add(p['NUMBER_LANES'])

out = {
    'version': 1,
    'generated': datetime.datetime.now().astimezone().isoformat(timespec='minutes'),
    'crs_world': 'EPSG:26917 (NAD83 / UTM 17N) grid metres; game local origin 536000 E, 4813000 N (config/campus.json)',
    'notes': ['utm_grid_m is the metric the game must match (the game world is UTM grid metres); geodesic_m (GRS80) is for reference.',
              f'Measured UTM/geodesic ratio over the pairs: {min(ratios):.6f} to {max(ratios):.6f} (about -0.04 percent, the UTM scale factor here).',
              'split=dev may be used to tune the pipeline; split=holdout must never be used to tune constants (doc 08 section 4.4).',
              f'OSM extract newest element timestamp {osm_newest} (UTC).'],
    'sources': {
        'city_footprints': 'https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/3 (sample: ../city-of-waterloo/cow_building_footprints_campus.geojson)',
        'lidar_heights': '../ontario-lidar/uw_building_heights.csv (OMAFRA Lidar 2016-18, 2018 vintage, nDSM p90 inside footprint eroded about 1 m)',
        'osm': OSM_URL, 'city_roads': 'https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/12',
        'city_water': 'https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/21',
        'city_creeks': 'https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/17',
        'city_trails': 'https://gis.waterloo.ca/maps/rest/services/Public/Public_Operations/MapServer/31'},
    'buildings': buildings,
    'landmarks': {k: {'lon': round(v[0], 6), 'lat': round(v[1], 6), 'source': v[2]} for k, v in lm.items()},
    'distances': pairs,
    'lengths': lengths,
    'waterbodies': waterbodies,
    'osm_width_tags_core_bbox': width_tags,
    'city_lanes': {k: sorted(x for x in v if x is not None) for k, v in sorted(lanes.items()) if k in
                   ('RING RD', 'UNIVERSITY AVE W', 'COLUMBIA ST W', 'WESTMOUNT RD N', 'PHILLIP ST', 'SEAGRAM DR', 'HAGEY BLVD')},
}
# ---------- widths measured by eye on the City 2026 spring 10 cm orthophoto (QA use only; licence unverified) ----------
out['widths_ortho_visual'] = [
    {'id': 'ring_road_site_a', 'osm_way': 24636861, 'utm': [536970, 4812760], 'curb_to_curb_m': 11.0, 'tol_m': 1.0, 'note': 'plus about 2 m sidewalk on the outer side'},
    {'id': 'ring_road_site_b', 'osm_way': 467027539, 'utm': [536569, 4813333], 'curb_to_curb_m': 11.0, 'tol_m': 1.0, 'note': 'plus about 2.5 m sidewalk on the outer side'},
    {'id': 'laurel_trail', 'osm_way': 175807340, 'utm': [536887, 4813918], 'paved_m': 3.0, 'tol_m': 0.5, 'note': 'OSM width tag says 2.5 m'},
    {'id': 'alumni_lane_footway', 'osm_way': 182419169, 'utm': [536802, 4813462], 'paved_m': 2.8, 'tol_m': 0.5, 'note': 'doc 01 default for footway is 2.0 m'},
]
out['widths_method'] = ('Perpendicular 1 m tick ruler drawn at the OSM way midpoint on a 0.1 m/px export of '
                        'Public_Imagery_Current layer 9; edges read by eye (Grok Bot, Nov 3, 2026). Not authoritative.')

# ---------- path network baseline (OSM, core bbox) ----------
from collections import defaultdict
WALK = {'footway', 'path', 'pedestrian', 'steps', 'cycleway', 'service', 'living_street', 'unclassified', 'tertiary',
        'secondary', 'residential', 'corridor', 'primary', 'track'}
adj = defaultdict(set); wl = []
for nds, t in ways.values():
    if t.get('highway') in WALK and t.get('access') not in ('private', 'no'):
        for a, b in zip(nds, nds[1:]):
            adj[a].add(b); adj[b].add(a)
        wl.append(nds)
comp = {}; sizes = []
for n0 in adj:
    if n0 in comp:
        continue
    st = [n0]; comp[n0] = len(sizes); k = 0
    while st:
        x = st.pop(); k += 1
        for y in adj[x]:
            if y not in comp:
                comp[y] = len(sizes); st.append(y)
    sizes.append(k)
big = max(range(len(sizes)), key=lambda i: sizes[i])
from shapely.strtree import STRtree
from shapely.geometry import Point
blines = [wline((nds, {})) for nds in wl if comp.get(nds[0]) == big and len(nds) > 1]
tree = STRtree(blines)
ents = [k for k, v in nodes.items() if 'entrance' in v[2] and CORE_BBOX_LL[0] <= v[0] <= CORE_BBOX_LL[2] and CORE_BBOX_LL[1] <= v[1] <= CORE_BBOX_LL[3]]
dists = []
for k in ents:
    pt = Point(fwd(nodes[k][0], nodes[k][1])); dists.append(blines[tree.nearest(pt)].distance(pt))
out['network_baseline'] = {
    'walk_graph_nodes': len(adj), 'components': len(sizes), 'largest_component_nodes': sizes[big],
    'entrances_core_bbox': len(ents),
    'entrances_on_largest_component_exact': sum(1 for d in dists if d < 0.01),
    'entrances_within_10m': sum(1 for d in dists if d <= 10), 'entrances_within_15m': sum(1 for d in dists if d <= 15),
    'source': 'OSM API map extract, highway in walkable set, access not private/no'}
uw = [f for f in city if f['properties'].get('OWNER') == 'UNIVERSITY OF WATERLOO']
out['coverage'] = {'uw_owned_footprints': len(uw), 'uw_owned_area_m2': round(sum(f['properties']['SHAPE.AREA'] for f in uw)),
                   'all_footprints_core_bbox': len(city), 'all_area_m2': round(sum(f['properties']['SHAPE.AREA'] for f in city))}

# ---------- 20 reference viewpoints (Wikimedia Commons photos) ----------
# commons_refs.json: Commons API (categorymembers + imageinfo extmetadata) results for the 20 chosen files, Nov 3, 2026
cats = json.load(open(os.path.join(HERE, 'commons_refs.json')))
ref = {x['title']: x for L in cats.values() for x in L}
# id, name, target landmark, Commons file, pose: ('photo', None) uses the file's Commons coordinates,
# ('est', (distance_m, azimuth_from_target_deg)) places the camera relative to the target and must be calibrated once.
VP = [
    ('V01', 'Davis Centre north atrium', 'DC', 'File:Davis Centre (University of Waterloo) - Waterloo, ON.jpg', ('photo', None)),
    ('V02', 'Davis Centre from the ION tracks', 'DC', 'File:UWaterloo Davis Centre.jpg', ('est', (115, 25))),
    ('V03', 'MC long facade from the MC and DC green', 'MC', 'File:MC DC Courtyard in Summer.jpg', ('est', (90, 70))),
    ('V04', 'MC tower with the pink tie', 'MC', 'File:UW-MathFaculty-PinkTie.jpg', ('photo', None)),
    ('V05', 'M3 facade', 'M3', 'File:University of Waterloo Math 3.jpg', ('est', (60, 250))),
    ('V06', 'QNC from Ring Road', 'QNC', 'File:Quantum Nano Center UW 2013.jpg', ('est', (170, 230))),
    ('V07', 'Dana Porter Library from the south', 'LIB', 'File:Dana Porter Library - Waterloo, ON.jpg', ('photo', None)),
    ('V08', 'Dana Porter Library silhouette from the northeast', 'LIB', 'File:Dana Porter Library.jpg', ('photo', None)),
    ('V09', 'Arts quad toward Dana Porter', 'LIB', 'File:Waterloo ontario campus 3.jpg', ('photo', None)),
    ('V10', 'Hagey Hall brick massing', 'HH', 'File:Hagey Hall of the Humanities (University of Waterloo) - Waterloo, ON.jpg', ('photo', None)),
    ('V11', 'SLC curved glass courtyard', 'SLC', 'File:University of Waterloo Student Life Center.jpg', ('est', (55, 45))),
    ('V12', 'SLC courtyard panorama', 'SLC', 'File:Student Life Centre Courtyard at the University of Waterloo in August 2007.jpg', ('est', (80, 60))),
    ('V13', 'E5 long facade from Ring Road', 'E5', 'File:E5 Building University of Waterloo (19673237343).jpg', ('est', (80, 242))),
    ('V14', 'E5 glass corner at sunset', 'E5', 'File:E5 at sunset.JPG', ('est', (60, 300))),
    ('V15', 'Physics building from the path', 'PHY', 'File:Physics Building University of Waterloo Fall 2012.jpg', ('est', (90, 200))),
    ('V16', 'Environment 3 from Ring Road', 'EV3', 'File:Environment 3 University of Waterloo.jpg', ('est', (90, 250))),
    ('V17', 'Ron Eydt Village entrance', 'REV', 'File:Entrance to Ron Eydt Village (4773822393).jpg', ('est', (25, 90))),
    ('V18', 'Columbia Lake shoreline', 'COLUMBIA_LAKE', 'File:Columbia Lake - Waterloo, Ontario 2019-10-11 (01).jpg', ('est', (250, 100))),
    ('V19', 'University of Waterloo station bus platforms', 'ION_UW', 'File:University of Waterloo station bus platforms.jpg', ('photo', None)),
    ('V20', 'University of Waterloo ION platform', 'ION_UW', 'File:University of Waterloo Station Nov 2017.jpg', ('est', (30, 300))),
]
vps = []
for vid, name, tgt, title, (mode, prm) in VP:
    r = ref[title]; tlo, tla = lm[tgt][0], lm[tgt][1]
    if mode == 'photo':
        clo, cla = r['lon'], r['lat']
    else:
        clo, cla, _ = geod.fwd(tlo, tla, prm[1], prm[0])
    hdg, _, dist = geod.inv(clo, cla, tlo, tla)
    vps.append({'id': vid, 'name': name, 'target': tgt,
                'camera': {'lon': round(clo, 6), 'lat': round(cla, 6), 'eye_height_m': 1.7, 'heading_true_deg': r1(hdg % 360),
                           'pitch_deg': 5.0, 'hfov_deg': 60.0, 'distance_to_target_m': round(dist)},
                'pose_status': 'position_from_commons_heading_to_target' if mode == 'photo' else 'estimated',
                'reference': {'title': title, 'url': r['url'], 'licence': r['lic'], 'author': r['artist'], 'date': r['date'][:10]}})
json.dump({'version': 1, 'note': ('Street-level reference views. Commons coordinates may be the subject, not the camera; '
           'estimated poses are calibrated once in M0 (doc 08 section 2.5) and then frozen. Photos are reference only: '
           'never ship them or commit them to a public repo without attribution and share-alike.'),
           'game_camera_preset': {'pitch_deg': 50, 'vfov_deg': 25, 'distance_m': 60},
           'viewpoints': vps}, open(os.path.join(HERE, 'viewpoints.json'), 'w'), indent=1, ensure_ascii=False)

path = os.path.join(HERE, 'ground_truth.json')
json.dump(out, open(path, 'w'), indent=1, ensure_ascii=False)
print('wrote', path, os.path.getsize(path), 'bytes')
