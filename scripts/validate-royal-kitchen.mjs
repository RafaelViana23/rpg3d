import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {createRoyalKitchen}=await server.ssrLoadModule('/src/editor/RoyalKitchen.ts');
 const {CITY_STONE_MATERIAL}=await server.ssrLoadModule('/src/editor/CityStone.ts');
 const {Raycaster,Vector3}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace(0);palace.updateMatrixWorld(true);const room=palace.userData.royalKitchen;
 assert(room.x>0&&room.y===6.08);assert(palace.getObjectByName(room.name));
 assert(palace.userData.royalRoomDoors.some(d=>d.label===room.name));
 const back=room.z-room.depth/2,front=room.z+room.depth/2;
 const windowZ=-46.4+(2+28.8)*69.2/39.6;
 const decor=createRoyalKitchen(room.y,back,front,windowZ);
 for(let i=0;i<decor.colliders.length;i++){
  const a=decor.colliders[i];assert(a[0]>=27.8&&a[3]<=52.4&&a[2]>=back&&a[5]<=front,'Furniture remains inside the room');
  for(const b of decor.colliders.slice(i+1))assert(a[3]<=b[0]||b[3]<=a[0]||a[5]<=b[2]||b[5]<=a[2],'Floor furniture does not intersect');
 }
 const hits=new Raycaster(new Vector3(50,9.5,windowZ),new Vector3(1,0,0),0,5).intersectObject(palace,true);
 assert(hits.length);assert(!hits.some(h=>h.object.material===CITY_STONE_MATERIAL),'Sink window opens through masonry');
 for(const localZ of [-15,2]){
  const z=-46.4+(localZ+28.8)*69.2/39.6;
  const pane=new Raycaster(new Vector3(50,9.8,z+.4),new Vector3(1,0,0),0,5).intersectObject(palace,true);
  assert(pane.length&&!pane.some(h=>h.object.material===CITY_STONE_MATERIAL),'Both kitchen windows have real openings');
  for(const [y,zz]of [[9.8,z],[9.5,z+.4]]){
   const bars=new Raycaster(new Vector3(50,y,zz),new Vector3(1,0,0),0,3).intersectObject(palace,true);
   assert(bars.some(h=>h.object.material.color.getHexString()==='c5a45a'),'Both mullion and transom are present');
  }
 }

 assert.equal(decor.lights.filter(l=>l.pack==='candle').length,18);
 assert.equal(decor.lights.filter(l=>l.pack==='tavern-fire').length,1);
 assert.equal(decor.lights.filter(l=>l.persistent&&l.intensity>0).length,3,'Every chandelier has a persistent combined emitter');


 assert(decor.props.every(p=>p.room==='royalKitchen'));

 assert(!decor.lights.some(l=>l.pack==='wall-torch'));
 console.log('Kitchen validated: east ground floor, full-depth furniture, non-overlapping bounds, daylight sink window, hearth and three candle chandeliers.');
}finally{await server.close();}
