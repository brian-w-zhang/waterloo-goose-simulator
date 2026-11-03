import glob, json, numpy as np, rasterio, csv, collections
from rasterio.merge import merge
from rasterio.features import geometry_mask, rasterize
from shapely.geometry import shape, Polygon, mapping
from shapely.ops import transform
from pyproj import Transformer
import xml.etree.ElementTree as ET
def mosaic(pattern):
    srcs=[rasterio.open(f) for f in sorted(glob.glob(pattern))]
    arr,tf=merge(srcs, bounds=(535590,4812320,537930,4814120), nodata=np.nan)
    return arr[0],tf,srcs[0].crs
dsm,tf,crs=mosaic('lidar/dsm/*.img'); dtm,_,_=mosaic('lidar/dtm/*.img')
dsm[dsm<-1000]=np.nan; dtm[dtm<-1000]=np.nan
nd=dsm-dtm
print('grid',dsm.shape,'res',tf.a, 'dtm min/max',np.nanmin(dtm),np.nanmax(dtm),'nan dsm',np.isnan(dsm).mean())
np.save('ndsm.npy',nd); np.save('dtm.npy',dtm)
json.dump({'transform':list(tf)[:6]},open('grid.json','w'))
tr=Transformer.from_crs(4326,26917,always_xy=True).transform
def stats(geom):
    m=geometry_mask([mapping(geom)],out_shape=nd.shape,transform=tf,invert=True)
    v=nd[m]; v=v[~np.isnan(v)]; g=dtm[m]; g=g[~np.isnan(g)]
    if v.size<8: return None
    return dict(px=int(v.size), h_med=float(np.median(v)), h_p90=float(np.percentile(v,90)), h_p98=float(np.percentile(v,98)), base=float(np.median(g)) if g.size else None)
# City footprints
cf=json.load(open('cow_buildings.geojson'))['features']
city=[]
for f in cf:
    g=transform(tr,shape(f['geometry']))
    if not g.is_valid: g=g.buffer(0)
    city.append((f['properties'],g))
# OSM buildings (not parts) from API extract
r=ET.parse('osm_map.xml').getroot()
nodes={e.get('id'):(float(e.get('lon')),float(e.get('lat'))) for e in r if e.tag=='node'}
osm=[]
for e in r:
    if e.tag!='way': continue
    t={x.get('k'):x.get('v') for x in e.findall('tag')}
    if 'building' not in t and 'building:part' not in t: continue
    pts=[nodes[n.get('ref')] for n in e.findall('nd') if n.get('ref') in nodes]
    if len(pts)<4 or pts[0]!=pts[-1]: continue
    g=transform(tr,Polygon(pts))
    if not g.is_valid: g=g.buffer(0)
    osm.append((e.get('id'),t,g))
osm_b=[o for o in osm if 'building' in o[1]]
osm_p=[o for o in osm if 'building:part' in o[1]]
print('osm buildings',len(osm_b),'parts',len(osm_p),'city',len(city))
from shapely.strtree import STRtree
tree=STRtree([o[2] for o in osm_b])
rows=[]; ious=[]
for p,g in city:
    s=stats(g)
    best=None;biou=0
    for i in tree.query(g):
        og=osm_b[i][2]; inter=g.intersection(og).area
        if inter<=0: continue
        iou=inter/g.union(og).area
        if iou>biou: biou=iou; best=osm_b[i]
    lv=best[1].get('building:levels') if best else None
    rows.append(dict(objectid=p['OBJECTID'],abbrev=(p.get('BLDG_ABBREV') or '').strip(),name=(p.get('BLDG_NAME') or '').strip(),owner=p.get('OWNER'),fire_storeys=p.get('FIRE_STOREYS'),area_m2=round(g.area,1),
        lidar_px=s and s['px'],h_med=s and round(s['h_med'],2),h_p90=s and round(s['h_p90'],2),h_p98=s and round(s['h_p98'],2),ground=s and s['base'] and round(s['base'],2),
        osm_way=best[0] if best else None,osm_name=best[1].get('name') if best else None,osm_levels=lv,iou_osm=round(biou,3)))
    if best: ious.append(biou)
ious=np.array(ious)
print('city footprints matched to an OSM building',len(ious),'of',len(city))
print('IoU median %.3f mean %.3f p10 %.3f share>0.7 %.2f share>0.9 %.2f'%(np.median(ious),ious.mean(),np.percentile(ious,10),(ious>0.7).mean(),(ious>0.9).mean()))
uwrows=[r for r in rows if r['owner'] and 'WATERLOO' in r['owner'].upper()]
u=np.array([r['iou_osm'] for r in uwrows if r['osm_way']])
print('UW-owned footprints',len(uwrows),'matched',len(u),'IoU median %.3f p10 %.3f'%(np.median(u),np.percentile(u,10)))
# height model comparisons: levels*3.5 vs lidar p90 (approx roof)
def comp(key,fn,subset):
    e=[]
    for r in subset:
        if r[key] in (None,'') or r['h_p90'] is None: continue
        try: lv=float(str(r[key]).split(';')[0])
        except: continue
        e.append(fn(lv)-r['h_p90'])
    e=np.array(e); 
    return len(e), float(np.sqrt((e**2).mean())), float(np.abs(e).mean()), float(np.median(e))
for k in ['osm_levels','fire_storeys']:
    for H in (3.0,3.5,4.0):
        print(k,'x',H,'n=%d RMSE=%.2f MAE=%.2f median bias=%.2f'%comp(k,lambda l:l*H,rows))
# best fit storey height
pairs=[(float(str(r['osm_levels']).split(';')[0]),r['h_p90']) for r in rows if r['osm_levels'] and r['h_p90'] and r['iou_osm']>0.7]
pairs=[p for p in pairs if p[1]>2]
a=np.array(pairs); k=(a[:,0]*a[:,1]).sum()/(a[:,0]**2).sum(); e=a[:,0]*k-a[:,1]
print('fit storey height (osm levels, iou>0.7) k=%.2f n=%d RMSE=%.2f'%(k,len(a),np.sqrt((e**2).mean())))
with open('uw_building_heights.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
named=sorted([r for r in rows if r['abbrev'] in ('DC','MC','M3','QNC','E7','E5','E6','SLC','DP','LIB','HH','PAC','STC','EV3','E3','DWE','MKV East','VS1')], key=lambda r:r['abbrev'])
for r in named: print(r['abbrev'],r['name'][:30],'fire',r['fire_storeys'],'osm',r['osm_levels'],'h_med',r['h_med'],'p90',r['h_p90'],'p98',r['h_p98'],'iou',r['iou_osm'],'ground',r['ground'])
