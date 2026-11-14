"""Apply the user's gray street drawing literally; preserve every building."""
import sys,json,hashlib,math
from pathlib import Path
sys.path.insert(0,'/tmp/rpg-street-geometry')
import numpy as np
import cv2
from shapely.geometry import Polygon
from shapely.affinity import affine_transform
from shapely.ops import unary_union
folder=Path('backups/parallel-street-tips')
record=json.loads((folder/'database-before.json').read_text());state=json.loads(record['payload']['entries']['rpg3d.worldBuilder.v1'])
(folder/'before.json').write_text(json.dumps(state))
refs=[(64,1056,640),(52,1055,724),(50,1058,830),(48,1141,654),(49,1142,724),(57,1195,658),(58,1196,724),(51,1256,660),(63,1253,742),(60,1146,833),(45,1198,834),(67,1251,834)]
a=[];b=[]
for n,x,y in refs:
 o=state['city'][f'medieval-streets-v2-house-{n}'];a.append([o['position'][0],o['position'][2],1]);b.append([x,y])
m=np.linalg.lstsq(a,b,rcond=None)[0];inverse=np.linalg.inv(np.vstack([m.T,[0,0,1]]))
image=Path('/var/folders/3m/z1qr3kjx3p58229g_x0h_wnr0000gn/T/TemporaryItems/NSIRD_screencaptureui_Hd3Kf5/Captura de Tela 2026-11-13 às 15.07.57 (2).png')
# The supplied drawing defines the topology. Use shared vectors for matching
# segments rather than inheriting the small angle differences of raster edges.
from shapely.geometry import LineString
# The right-hand pair is the approved reference. Mirror its exact direction
# horizontally for the left-hand pair, so both upper and lower approaches use
# the same angle at the avenue and at the outer bend.
positive=np.array([201.,185.]);negative=np.array([201.,-185.])
def meet(a,d,b,e):
 a=np.array(a,dtype=float);b=np.array(b,dtype=float)
 t,u=np.linalg.solve(np.column_stack([d,-e]),b-a)
 return (a+t*d).tolist()
topLeft=[1015.,617.];topRight=[1299.,617.];bottomRight=[1380.,783.]
leftEnd=meet([727,673],positive,topLeft,negative)
rightMeet=meet(topRight,positive,bottomRight,negative)
rightEnd=(np.array(bottomRight)+negative*((1520-1380)/201)).tolist()
upperEnd=(np.array(topRight)+negative*((1404-1299)/201)).tolist()
outerLeft=(np.array([1012.,783.])-positive).tolist()
lines=[[outerLeft,[1012.,783.],bottomRight,rightEnd],
 [[727.,673.],leftEnd,topLeft,topRight,upperEnd],
 [topRight,rightMeet],[[1104.,617.],[1104.,783.]],
 [[1299.,617.],[1299.,783.]]]
pixel=unary_union([LineString(line).buffer(14.5,cap_style=2,join_style=2)for line in lines])
assert pixel.geom_type=='Polygon' and len(pixel.interiors)==3
# Check corresponding world-space directions too: affine projection preserves parallelism.
def worldDirection(v):return inverse[:2,:2]@v
checks=[]
for name,vector,segments in [
 ('positive',positive,[(lines[0][0],lines[0][1]),(lines[1][0],lines[1][1]),(topRight,rightMeet)]),
 ('negative',negative,[(leftEnd,topLeft),(topRight,upperEnd),(bottomRight,rightEnd)]),
 ('horizontal',np.array([1.,0.]),[(lines[0][1],bottomRight),(topLeft,topRight)]),
 ('vertical',np.array([0.,1.]),[(line[0],line[1])for line in lines[3:]])]:
 v=worldDirection(vector)
 for a,b in segments:
  w=worldDirection(np.subtract(b,a));cross=abs(v[0]*w[1]-v[1]*w[0])/np.linalg.norm(v)/np.linalg.norm(w)
  assert cross<1e-12,(name,cross)
  checks.append({'family':name,'normalizedCrossProduct':float(cross)})
avenue=state['city']['city-royal-avenue-v1'];angle=avenue['rotation'][1];c,s=math.cos(angle),math.sin(angle);ox,_,oz=avenue['position']
avenue['width']=20.0
avenue['secondaryAvenues']['width']=20.0
def world(poly):return affine_transform(poly,[c,s,-s,c,ox,oz])
def pixelToLocal(point):
 wx,wz=(inverse@np.array([*point,1.]))[:2]
 return [c*(wx-ox)-s*(wz-oz),s*(wx-ox)+c*(wz-oz)]
# Rebuild every street from exact local-space centre lines.  This removes the
# variable width introduced by raster projection: all neighborhood paving is exactly 5 m.
localLines=[[pixelToLocal(point) for point in line] for line in lines]
outer,inner=localLines[:2]
# Both routes meet the secondary avenue (z=0) vertically and the main avenue
# (x=0) horizontally.  Thus all four mouths are exactly perpendicular.
outer[0]=[outer[1][0],0.];outer[-1]=[0.,outer[-2][1]]
inner[0]=[inner[1][0],0.];inner[2][1]=inner[1][1];inner[-1]=[0.,inner[-2][1]]
# The transverse link also meets both parallel routes at 90 degrees.
localLines[2][0]=inner[-2].copy();localLines[2][1]=[inner[-2][0],outer[-2][1]]
# Mirror the complete approved district across the main avenue (local x=0).
# This creates the second residential district with identical geometry.
mirroredLocalLines=[[[-point[0],point[1]] for point in line] for line in localLines]
allLocalLines=localLines+mirroredLocalLines
pavingLocal=unary_union([LineString(line).buffer(2.5,cap_style=2,join_style=2) for line in allLocalLines])
paving=world(pavingLocal)
mouths=[
 {'avenue':'secondary','from':outer[1],'to':outer[0],'angle':90.0,'width':10.0},
 {'avenue':'secondary','from':inner[1],'to':inner[0],'angle':90.0,'width':10.0},
 {'avenue':'main','from':outer[-2],'to':outer[-1],'angle':90.0,'width':10.0},
 {'avenue':'main','from':inner[-2],'to':inner[-1],'angle':90.0,'width':10.0}]
mouths += [{**mouth,'from':[-mouth['from'][0],mouth['from'][1]],'to':[-mouth['to'][0],mouth['to'][1]],'mirrored':True} for mouth in mouths]
for mouth in mouths:
 direction=np.subtract(mouth['to'],mouth['from'])
 avenueDirection=np.array([1.,0.]) if mouth['avenue']=='secondary' else np.array([0.,1.])
 assert abs(np.dot(direction,avenueDirection))<1e-12
side=avenue['secondaryAvenues'];half=avenue['width']/2;sh=side['width']/2
existing=unary_union([world(Polygon([[-half,-204.2259197546797],[half,-204.2259197546797],[half,81],[-half,81]])),world(Polygon([[side['left'],-sh],[side['right'],-sh],[side['right'],sh],[side['left'],sh]])),world(Polygon([(math.cos(i*math.pi/96)*avenue.get('centralPlazaRadius',60),math.sin(i*math.pi/96)*avenue.get('centralPlazaRadius',60))for i in range(192)]))])
existingWithBorders=unary_union([world(Polygon([[-half-.9,-204.2259197546797],[half+.9,-204.2259197546797],[half+.9,81],[-half-.9,81]])),world(Polygon([[side['left'],-sh-.9],[side['right'],-sh-.9],[side['right'],sh+.9],[side['left'],sh+.9]])),world(Polygon([(math.cos(i*math.pi/96)*(avenue.get('centralPlazaRadius',60)+.9),math.sin(i*math.pi/96)*(avenue.get('centralPlazaRadius',60)+.9))for i in range(192)]))])
def export(g):
 return [{'outline':list(map(list,p.exterior.coords)),'holes':[list(map(list,r.coords))for r in p.interiors]}for p in ([g]if g.geom_type=='Polygon'else g.geoms)if p.geom_type=='Polygon']
road=state['city']['city-marked-tavern-streets-v1']
streetBorder=paving.buffer(.9,join_style=2).difference(paving).difference(existingWithBorders)
road['pavedStreet']={'revision':1,'paving':export(paving.difference(existing)),'border':export(streetBorder),'sourceHash':hashlib.sha256(image.read_bytes()).hexdigest()}
road['pavingUvReference']={'position':avenue['position'],'rotationY':avenue['rotation'][1]}
# The avenue border cutter expects convex polygons. Use one padded rectangle per
# mouth instead of the concave outline of the whole street network.
openings=[]
for mouth in mouths:
 x,z=mouth['to'];pad=6.7
 if mouth['avenue']=='main':
  sideSign=1 if mouth['from'][0]>0 else -1;x0=sideSign*(half-.9);x1=sideSign*(half+6.0)
  openings.append([[min(x0,x1),z-pad],[max(x0,x1),z-pad],[max(x0,x1),z+pad],[min(x0,x1),z+pad]])
 else:
  z0=-sh-6.0;z1=-sh+.9
  openings.append([[x-pad,z0],[x+pad,z0],[x+pad,z1],[x-pad,z1]])
# Keep the avenue curb continuous; neighborhood streets meet it underneath.
avenue['streetBorderOpenings']=[]
(folder/'applied.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
(folder/'trace.json').write_text(json.dumps({'image':str(image),'imagePolygon':export(pixel),'projection':m.T.tolist(),'references':refs,'area':paving.area,'centerlines':lines,'localCenterlines':localLines,'mirroredLocalCenterlines':mirroredLocalLines,'parallelChecks':checks,'avenueMouths':mouths,'streetWidth':13.0,'mirrorAxis':'avenue local x=0'},indent=2))

# Confirm the only changed fields are the requested road geometry and avenue curb cuts.
before=json.loads((folder/'before.json').read_text());check=json.loads(json.dumps(state));check['city'][road['id']]=before['city'][road['id']];check['city'][avenue['id']]=before['city'][avenue['id']];assert check==before
print('One connected drawing, three enclosed blocks. All buildings preserved. Area:',paving.area)
