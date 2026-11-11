import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {CITY_STONE_MATERIAL}=await server.ssrLoadModule('/src/editor/CityStone.ts');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 const {Raycaster,Vector3}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace();palace.updateMatrixWorld(true);
 const room=palace.userData.royalSittingRoom;
 const front=room.z+(room.depth+.3)/2;
 const windowHits=new Raycaster(new Vector3(40.5,room.y+3,front+5),new Vector3(0,0,-1),0,6).intersectObject(palace,true);
 assert(windowHits.length,'Front window has a visible pane');
 assert(!windowHits.some(h=>h.object.material===CITY_STONE_MATERIAL),'Front window cuts through the masonry');
 for(const [x,z]of [[40,room.z],[42,palace.userData.princessBedroom.z]]){
  const hits=new Raycaster(new Vector3(x,room.y+5,z),new Vector3(0,1,0),0,3).intersectObject(palace,true);
  assert(hits.some(h=>h.object.material===CITY_WOOD_MATERIAL),'Both royal rooms have solid timber ceilings');
 }
 const aliceLights=palace.userData.palaceLightPlacements.filter(l=>l.group==='alice-chandelier');
 const sittingLights=palace.userData.palaceLightPlacements.filter(l=>l.group==='royal-sitting-chandelier');
 assert.equal(sittingLights.length,aliceLights.length);
 for(const l of sittingLights){assert.equal(l.intensity,aliceLights[0].intensity);assert.equal(l.distance,aliceLights[0].distance);assert(l.emitterOffset);}
 const storage=palace.getObjectByName('Sala de estar da família real').userData.wallStorage;
 assert.equal(storage.filter(p=>p.kind==='bookcase').length,3);
 assert.equal(storage.filter(p=>p.kind==='wardrobe').length,2);
 const door=palace.userData.royalRoomDoors.find(d=>d.label==='Sala de estar real');
 for(const piece of storage){
  const b=piece.bounds;
  assert(b[5]<door.z-door.width/2-1||b[2]>door.z+door.width/2+1,'Storage leaves door opening and approach clear');
  for(const other of storage)if(other!==piece)assert(b[5]<=other.bounds[2]||b[2]>=other.bounds[5],'Storage pieces do not intersect');
 }
 const props=palace.userData.palacePropPlacements.filter(p=>p.room==='royalSittingRoom');
 assert(props.some(p=>p.pack==='tavern-hearth'));assert(props.some(p=>p.pack==='tavern-chimney'));
 assert.equal(props.filter(p=>p.pack==='potted-plant').length,1);
 console.log('Janela real na fachada, tetos de madeira nos dois cômodos, iluminação compartilhada e modelos da sala validados.');
}finally{await server.close();}
