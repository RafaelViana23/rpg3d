"""Trace the user's screenshot against the exported live map, without moving existing objects."""
import sys,json,math,hashlib
from pathlib import Path
sys.path.insert(0,'/tmp/rpg-street-geometry')
import numpy as np
from shapely.geometry import LineString,Polygon
from shapely.ops import unary_union
folder=Path('artifacts/street-repair');raw=Path('/Users/ayrtonborges/Downloads/rpg-map-2026-11-13 (2).json').read_bytes();state=json.loads(raw)
# Corresponding house roof centres in the supplied 1920x1080 image.
refs=[(64,850,590),(52,850,694),(50,848,812),(48,951,611),(49,951,697),(57,1010,611),(58,1010,697),(51,1078,611),(63,1078,697),(60,945,812),(45,1006,812),(67,1076,812)]
a=[];b=[]
for number,x,y in refs:
 o=state['city'][f'medieval-streets-v2-house-{number}'];a.append([o['position'][0],o['position'][2],1]);b.append([x,y+0])
m=np.linalg.lstsq(np.array(a),np.array(b),rcond=None)[0];matrix=np.vstack([m.T,[0,0,1]]);inverse=np.linalg.inv(matrix)
def world(p):return (inverse@np.array([*p,1]))[:2].tolist()
# Parallel street families in the reference image.
traces=[[[587,756],[895,509.6]],[[589,547],[789,747],[1204,747],[1392,596.6]],[[895,509.6],[895,557]],[[895,557],[1090,557],[1220,453]],[[1090,557],[1235,702]],[[1119,586],[1119,747]]]
avenue=state['city']['city-royal-avenue-v1'];angle=avenue['rotation'][1]
rotation=np.array([[math.cos(angle),math.sin(angle)],[-math.sin(angle),math.cos(angle)]])
origin=np.array([avenue['position'][0],avenue['position'][2]])
reference=[[(rotation.T@(np.array(world(p))-origin)).tolist()for p in points]for points in traces]
# Two parallel offset routes, each with 120-degree open bends.
# Their transverse links meet at 90 degrees.
slope=1/math.sqrt(3)
leftX=reference[1][1][0]; centreX=reference[3][0][0]
firstZ=reference[0][-1][1]
outerBendZ=reference[1][1][1]
innerBendZ=firstZ-18
outerCornerX=reference[1][2][0];innerCornerX=reference[3][1][0]
def route(x,z,cx):
 cz=z+(cx-x)*slope
 return [[x,0],[x,z],[cx,cz],[0,cz+cx*slope]]
outerRoute=route(leftX,outerBendZ,outerCornerX)
innerRoute=route(centreX,innerBendZ,innerCornerX)
# The inner route begins at the first cross street, rather than the avenue.
innerRoute[0]=[centreX,firstZ]
def transverse(segmentA,segmentB,x):
 a,b=map(np.array,segmentA);c,d=map(np.array,segmentB)
 t=(x-a[0])/(b[0]-a[0]);p=a+t*(b-a)
 tangent=(b-a)/np.linalg.norm(b-a);normal=np.array([-tangent[1],tangent[0]])
 u,v=np.linalg.solve(np.column_stack([normal,-(d-c)]),c-p)
 q=p+u*normal
 assert abs(np.dot(q-p,b-a))<1e-8
 assert abs(((b-a)[0]*(d-c)[1]-(b-a)[1]*(d-c)[0]))<1e-8
 return [p.tolist(),q.tolist()]
local=[[[reference[0][0][0],firstZ],[centreX,firstZ]],outerRoute,innerRoute,
 transverse(innerRoute[1:3],outerRoute[1:3],(centreX+innerCornerX)/2),
 transverse(innerRoute[2:4],outerRoute[2:4],innerCornerX/2)]
checks=[]
for name,line in [('outer',outerRoute),('inner',innerRoute)]:
 for i in [1,2]:
  a=np.array(line[i-1])-line[i];b=np.array(line[i+1])-line[i]
  degrees=math.degrees(math.acos(np.dot(a,b)/np.linalg.norm(a)/np.linalg.norm(b)))
  assert abs(degrees-120)<1e-8
  checks.append([name+' open bend',degrees])
for i in range(3):
 a=np.subtract(outerRoute[i+1],outerRoute[i]);b=np.subtract(innerRoute[i+1],innerRoute[i])
 assert abs((a[0]*b[1]-a[1]*b[0]))<1e-8
checks.extend([['transverse crossings',90],['same-side parallel deviation',0]])
print('Verified angles:',checks)
lines=[LineString([(rotation@np.array(p)+origin).tolist()for p in points])for points in local]
obstacles=[]
for o in state['city'].values():
 if o['kind'] not in ['house','tavern','inn','shop','weapons','potions','guild','warehouse']:continue
 w,d=(32,28)if o['kind']=='tavern'else (12,16)if o['kind']=='house'else (16,16)
 angle=o['rotation'][1];c,s=math.cos(angle),math.sin(angle);x,_,z=o['position'];sx,_,sz=o['scale']
 poly=Polygon([(x+c*dx*sx+s*dz*sz,z-s*dx*sx+c*dz*sz)for dx,dz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]])
 obstacles.append((o['id'],poly))
# User approved full-width roads through the marked corridors; houses stay unchanged.
# The user will rearrange buildings afterwards. Only the crossed-out branch is omitted.
paving=unary_union([line.buffer(6.5,join_style=2,cap_style=2)for line in lines])
outer=unary_union([line.buffer(7.4,join_style=2,cap_style=2)for line in lines])
def toWorldPolygon(points):return Polygon([(rotation@np.array(p)+origin).tolist()for p in points])
mainHalf=avenue['width']/2;side=avenue['secondaryAvenues'];sideHalf=side['width']/2
existing=unary_union([toWorldPolygon([[-mainHalf,-204.2259197546797],[mainHalf,-204.2259197546797],[mainHalf,81],[-mainHalf,81]]),toWorldPolygon([[side['left'],-sideHalf],[side['right'],-sideHalf],[side['right'],sideHalf],[side['left'],sideHalf]]),toWorldPolygon([[math.cos(i*math.pi/96)*avenue.get('centralPlazaRadius',60),math.sin(i*math.pi/96)*avenue.get('centralPlazaRadius',60)]for i in range(192)])])
def polygons(geometry):
 return [{'outline':[list(p)for p in g.exterior.coords],'holes':[[list(p)for p in ring.coords]for ring in g.interiors]}for g in ([geometry]if geometry.geom_type=='Polygon'else geometry.geoms)if g.geom_type=='Polygon']
road={'id':'city-marked-tavern-streets-v1','kind':'road','layer':'Cidade Principal','position':[0,18,0],'rotation':[0,0,0],'scale':[1,1,1],'width':13,'points':[[x,0,z]for x,z in lines[0].coords],'pavedStreet':{'revision':1,'paving':polygons(paving.difference(existing)),'border':polygons(outer.difference(paving).difference(existing)),'sourceHash':hashlib.sha256(raw).hexdigest()}}
state['city'][road['id']]=road
avenue['streetBorderOpenings']=[[[float(x),float(z)]for x,z in list(LineString([a,b]).buffer(6.5,cap_style=2).exterior.coords)[:-1]]for line in local for a,b in zip(line,line[1:])]
(folder/'repaired-streets.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
(folder/'trace-reference.json').write_text(json.dumps({'image':'Captura de Tela 2026-11-13 às 13.54.39 (2).png','traces':traces,'imageProjection':matrix.tolist(),'excluded':'Crossed-out branch at bottom left','sourceHash':hashlib.sha256(raw).hexdigest(),'avenueLocalCenterlines':local},indent=2))
print('paving area',paving.area,'polygons',len(road['pavedStreet']['paving']))
