import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {LowPolyCityBuilder,createCityAsset}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {createCityWallGateDoor,setCityWallGateInward}=await server.ssrLoadModule('/src/editor/CityProps.ts');
 const {registerChurchDoor,toggleChurchDoor,updateChurchDoors,churchDoorPrompt}=await server.ssrLoadModule('/src/editor/ChurchDoors.ts');
 const {loadCityPropTemplate}=await server.ssrLoadModule('/src/editor/CityProps.ts');
 const gltf={scene:await loadCityPropTemplate('church-door')};
 const door=createCityWallGateDoor(gltf.scene),bounds=new T.Box3().setFromObject(door,true),size=bounds.getSize(new T.Vector3());
 assert(Math.abs(size.x-6.1)<1e-6&&Math.abs(size.y-7.6)<1e-6,'Real palace door model fits the wall gateway');
 assert(Math.abs(bounds.min.y)<1e-6&&Math.abs(bounds.getCenter(new T.Vector3()).x)<1e-6,'Door is grounded and horizontally centered');
 const scene=new T.Scene(),builder=new LowPolyCityBuilder(scene,()=>0),gate=createCityAsset('gate');builder.root.add(gate);builder.objects.set('gate',gate);gate.add(door);
 const wallColliders=gate.userData.localColliders.length;
 registerChurchDoor(gate,door,{y:0,z:0,width:6.2,height:7.7,label:'portão da muralha'});
 assert.equal(gate.userData.localColliders.length,wallColliders+1,'Closed leaf adds a collider without removing gate masonry');
 assert(toggleChurchDoor(new T.Vector3(0,1,1)));updateChurchDoors(1.2);
 door.updateMatrixWorld(true);
 assert(new T.Box3().setFromObject(door,true).min.z>0,'Real animated leaves swing toward the city interior (+Z)');
 setCityWallGateInward(door,-1);door.updateMatrixWorld(true);
 assert(new T.Box3().setFromObject(door,true).max.z<0,'Oppositely oriented gateways swing inward on their -Z side');
 setCityWallGateInward(door,1);
 assert.equal(gate.userData.localColliders.length,wallColliders,'Opened door frees the passage');
 assert(toggleChurchDoor(new T.Vector3(0,1,1)));updateChurchDoors(1.2);
 assert.equal(gate.userData.localColliders.length,wallColliders+1,'Reclosed door blocks the passage again');
 gate.userData.wallGateApproach={x:0,z:0,dx:0,dz:1,length:19};
 const outside=new T.Vector3(0,1,1),inside=new T.Vector3(0,1,-1);
 assert(toggleChurchDoor(outside));updateChurchDoors(1.2,outside);
 updateChurchDoors(.1,new T.Vector3(0,1,-2));
 assert(churchDoorPrompt(outside).startsWith('Fechar'),'Entering the arch does not close the gate on the player');
 updateChurchDoors(1.2,new T.Vector3(0,1,-5));
 assert(churchDoorPrompt(outside).startsWith('Abrir'),'Gate closes after the entering player clears the open leaf');
 assert.equal(gate.userData.localColliders.length,wallColliders+1);
 assert(toggleChurchDoor(inside));updateChurchDoors(1.2,inside);
 updateChurchDoors(.1,new T.Vector3(0,1,8));
 assert(churchDoorPrompt(inside).startsWith('Fechar'),'Exiting gate stays open while the player descends');
 updateChurchDoors(.1,new T.Vector3(0,1,18.9));
 assert(churchDoorPrompt(inside).startsWith('Fechar'),'Gate remains open until the final stair');
 updateChurchDoors(1.2,new T.Vector3(0,1,19.5));
 assert(churchDoorPrompt(inside).startsWith('Abrir'),'Gate closes at the foot of the stairs');
 assert.equal(gate.userData.localColliders.length,wallColliders+1);
 assert(toggleChurchDoor(outside));updateChurchDoors(1.2,new T.Vector3(0,1,30));
 assert(churchDoorPrompt(outside).startsWith('Fechar'),'Walking away without crossing does not count as entering');
 assert(toggleChurchDoor(outside));updateChurchDoors(1.2,outside);
 const palace=new T.Group();palace.userData.building={width:132,depth:116};builder.root.add(palace);builder.objects.set('palace',palace);
 const palaceDoor=createCityWallGateDoor(gltf.scene);palaceDoor.name='Portão oval do palácio';palace.add(palaceDoor);
 for(const viewer of [new T.Vector3(),new T.Vector3(10000,0,10000)]){
  for(const d of [door,palaceDoor]){d.visible=false;d.userData.cityDistanceHidden=true;}
  builder.updatePropVisibility(viewer);
  assert([door,palaceDoor].every(d=>d.visible&&!d.userData.cityDistanceHidden),'Both palace and city wall doors remain visible at every distance');
 }
 console.log('Modelo real ajustado ao arco, abertura/fechamento, colisores e visibilidade permanente dos portões validados.');
}finally{await server.close();}
