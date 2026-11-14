"""Apply the user's gray street drawing literally; preserve every building."""
import sys,json,hashlib,math
from pathlib import Path
sys.path.insert(0,'/tmp/rpg-street-geometry')
import numpy as np
import cv2
from shapely.geometry import Polygon
from shapely.affinity import affine_transform
from shapely.ops import unary_union
folder=Path('backups/drawn-streets')
record=json.loads((folder/'database-before.json').read_text());state=json.loads(record['payload']['entries']['rpg3d.worldBuilder.v1'])
(folder/'before.json').write_text(json.dumps(state))
refs=[(64,1056,640),(52,1055,724),(50,1058,830),(48,1141,654),(49,1142,724),(57,1195,658),(58,1196,724),(51,1256,660),(63,1253,742),(60,1146,833),(45,1198,834),(67,1251,834)]
a=[];b=[]
for n,x,y in refs:
 o=state['city'][f'medieval-streets-v2-house-{n}'];a.append([o['position'][0],o['position'][2],1]);b.append([x,y])
m=np.linalg.lstsq(a,b,rcond=None)[0];inverse=np.linalg.inv(np.vstack([m.T,[0,0,1]]))
image=Path('/var/folders/3m/z1qr3kjx3p58229g_x0h_wnr0000gn/T/TemporaryItems/NSIRD_screencaptureui_Hd3Kf5/Captura de Tela 2026-11-13 às 15.07.57 (2).png')
im=cv2.imread(str(image));mask=cv2.inRange(im,np.array([209,201,190]),np.array([213,205,194]));mask[:500]=0;mask[810:]=0;mask[:,:710]=0;mask[:,1545:]=0
contours,hierarchy=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
polys=[]
for i,c in enumerate(contours):
 if hierarchy[0][i][3]!=-1 or cv2.contourArea(c)<500:continue
 outline=cv2.approxPolyDP(c,1.25,True).reshape(-1,2).tolist();holes=[]
 child=hierarchy[0][i][2]
 while child!=-1:
  
  if cv2.contourArea(contours[child])>100:holes.append(cv2.approxPolyDP(contours[child],1.25,True).reshape(-1,2).tolist())
  child=hierarchy[0][child][0]
 polys.append(Polygon(outline,holes))
assert len(polys)==1
pixel=polys[0];assert len(pixel.interiors)==3,len(pixel.interiors)
paving=affine_transform(pixel,[inverse[0,0],inverse[0,1],inverse[1,0],inverse[1,1],inverse[0,2],inverse[1,2]])
avenue=state['city']['city-royal-avenue-v1'];angle=avenue['rotation'][1];c,s=math.cos(angle),math.sin(angle);ox,_,oz=avenue['position']
def world(poly):return affine_transform(poly,[c,s,-s,c,ox,oz])
side=avenue['secondaryAvenues'];half=avenue['width']/2;sh=side['width']/2
existing=unary_union([world(Polygon([[-half,-204.2259197546797],[half,-204.2259197546797],[half,81],[-half,81]])),world(Polygon([[side['left'],-sh],[side['right'],-sh],[side['right'],sh],[side['left'],sh]])),world(Polygon([(math.cos(i*math.pi/96)*avenue.get('centralPlazaRadius',60),math.sin(i*math.pi/96)*avenue.get('centralPlazaRadius',60))for i in range(192)]))])
def export(g):
 return [{'outline':list(map(list,p.exterior.coords)),'holes':[list(map(list,r.coords))for r in p.interiors]}for p in ([g]if g.geom_type=='Polygon'else g.geoms)if p.geom_type=='Polygon']
road=state['city']['city-marked-tavern-streets-v1'];road['pavedStreet']={'revision':1,'paving':export(paving.difference(existing)),'border':export(paving.buffer(.9,join_style=2).difference(paving).difference(existing)),'sourceHash':hashlib.sha256(image.read_bytes()).hexdigest()}
local=affine_transform(paving,[c,-s,s,c,-c*ox+s*oz,-s*ox-c*oz]);avenue['streetBorderOpenings']=[list(map(list,local.exterior.coords))]
(folder/'applied.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
(folder/'trace.json').write_text(json.dumps({'image':str(image),'imagePolygon':export(pixel),'projection':m.T.tolist(),'references':refs,'area':paving.area},indent=2))
cv2.imwrite(str(folder/'traced-mask.png'),mask)
# Confirm the only changed fields are the requested road geometry and avenue curb cuts.
before=json.loads((folder/'before.json').read_text());check=json.loads(json.dumps(state));check['city'][road['id']]=before['city'][road['id']];check['city'][avenue['id']]=before['city'][avenue['id']];assert check==before
print('One connected drawing, three enclosed blocks. All buildings preserved. Area:',paving.area)
