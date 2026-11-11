import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {createRoyalStudy}=await server.ssrLoadModule('/src/editor/RoyalStudy.ts');
 const {CITY_STONE_MATERIAL}=await server.ssrLoadModule('/src/editor/CityStone.ts');
 const {Raycaster,Vector3}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace();palace.updateMatrixWorld(true);
 const room=palace.userData.royalStudy;
 assert.equal(room.ownerName,'Rei Rito');assert(room.x<0);
 assert(palace.getObjectByName('Escritório particular do Rei Rito'));
 const door=palace.userData.royalRoomDoors.find(d=>d.label===room.name);assert(door);
 const study=createRoyalStudy(0,0,24);
 for(const b of study.colliders){
  assert(b[0]>=-52.4&&b[3]<=-27.8,'Furniture stays within the study');
  assert(b[2]>=-.05&&b[5]<=24.15,'Furniture stays within the partition face and room depth');
 }
 for(let i=0;i<study.colliders.length;i++)for(const b of study.colliders.slice(i+1)){
  const a=study.colliders[i];
  assert(a[3]<=b[0]||b[3]<=a[0]||a[5]<=b[2]||b[5]<=a[2],'Main furniture does not intersect');
 }
 const lights=palace.userData.palaceLightPlacements.filter(l=>l.group==='royal-study-chandelier');
 assert.equal(lights.length,6);assert(lights.every(l=>l.x<0&&l.emitterOffset&&l.intensity===150));
 const front=room.z+(room.depth+.3)/2;
 const hits=new Raycaster(new Vector3(-40.5,room.y+3,front+5),new Vector3(0,0,-1),0,6).intersectObject(palace,true);
 assert(hits.length);assert(!hits.some(h=>h.object.material===CITY_STONE_MATERIAL),'Window admits daylight');
 const roof=new Raycaster(new Vector3(-40,room.y+5,room.z),new Vector3(0,1,0),0,4).intersectObject(palace,true);
 assert(roof.some(h=>h.object.castShadow),'Ceiling blocks sunlight with geometry');
 console.log('Royal study: west suite, clear furniture bounds, door, shared candle emitters, daylight aperture and solid ceiling validated.');
}finally{await server.close();}
