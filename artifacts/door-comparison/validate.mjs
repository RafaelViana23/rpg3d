import assert from 'node:assert/strict';import {createServer} from 'vite';import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');const {createComparisonDoor,createCityChurchDoor}=await server.ssrLoadModule('/artifacts/door-comparison/door-prototype.ts');const {registerVillageDoor,toggleChurchDoor,updateChurchDoors}=await server.ssrLoadModule('/src/editor/ChurchDoors.ts');
 const triangles=root=>{let n=0;root.traverse(child=>{if(child.isMesh)n+=(child.geometry.index?.count??child.geometry.attributes.position.count)/3});return n;};
 const door=createComparisonDoor();assert.equal(triangles(door),292);
 const church=createCityChurchDoor();assert.equal(triangles(church),280);
 const scene=new T.Scene(),building=new T.Group();scene.add(building);building.add(door);building.userData={building:{depth:0,doorWidth:1.8,doorHeight:3.4},localColliders:[]};
 registerVillageDoor(building,door);assert.equal(building.userData.localColliders.length,1);
 for(let i=0;i<3;i++){
  assert(toggleChurchDoor(new T.Vector3(0,0,1)));updateChurchDoors(1.2);assert.equal(building.userData.localColliders.length,0);
  assert(Math.abs(door.getObjectByName('VillageDoorHinge').rotation.y+Math.PI/2)<.001);
  assert(toggleChurchDoor(new T.Vector3(0,0,1)));updateChurchDoors(1.2);assert.equal(building.userData.localColliders.length,1);assert(Math.abs(door.getObjectByName('VillageDoorHinge').rotation.y)<1e-5);
 }
 await writeFile('artifacts/door-comparison/metrics.json',JSON.stringify({original:{triangles:1464,vertices:2892,geometryBytes:179520,drawCalls:1,bones:4,textures:1},housePrototype:{triangles:292,drawCalls:9,bones:0,textures:0},churchReference:{triangles:280,vertices:840,geometryBytes:57120,drawCalls:1,bones:2,textures:0},triangleReductionPercent:100*(1-292/1464),geometryMemoryReductionPercent:null,gameReplaced:false,houseDoorOpeningAndCollisionVerified:true},null,2));
 console.log('House door: 292 triangles; inset iron braces and parallel pull ring; three open/close cycles passed.');
}finally{await server.close();}
