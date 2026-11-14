import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {MedievalCityFloor}=await server.ssrLoadModule('/src/world/MedievalCityFloor.ts');
 const scene=new T.Scene(),floor=new MedievalCityFloor(scene);
 const towers=Array.from({length:8},(_,i)=>{const tower=new T.Group();tower.position.set(Math.cos(i*Math.PI/4)*100,14,Math.sin(i*Math.PI/4)*100);return tower;});
 const original=towers.map(t=>t.position.toArray());floor.update(towers);floor.root.updateMatrixWorld(true);
 assert.equal(floor.root.userData.floorHeight,18);assert.equal(floor.heightAt(0,0),18);
 const slab=floor.root.getObjectByName('Chão elevado da cidade'),geometry=slab.geometry,normals=geometry.getAttribute('normal'),positions=geometry.getAttribute('position');
 for(const group of geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3){
  if(group.materialIndex===0){assert(normals.getY(i)>.5,'Only the upper surface has paving');assert.equal(positions.getY(i),18);}
  if(normals.getY(i)<-.5){assert.equal(group.materialIndex,1,'The lower cap is plain foundation, not a second paved floor');assert.equal(positions.getY(i),14);}
 }
 for(const [x,z]of [[0,0],[20,20],[-20,-20]]){
  const above=new T.Raycaster(new T.Vector3(x,25,z),new T.Vector3(0,-1,0)).intersectObject(slab)[0];assert.equal(above.point.y,18);assert.equal(above.face.materialIndex,0);
  const below=new T.Raycaster(new T.Vector3(x,10,z),new T.Vector3(0,1,0)).intersectObject(slab)[0];assert.equal(below.point.y,14);assert.equal(below.face.materialIndex,1,'Foundation remains closed without exposing the terrain');
 }
 assert.equal(floor.terrainHeightAt(0,0),14,'Terrain under the city stays beneath its existing foundation');
 const polygon=floor.root.userData.floorPolygon;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],mid=a.clone().add(b).multiplyScalar(.5),outward=mid.clone().normalize();
  for(const distance of [.1,2,8,17,19]){
   const p=mid.clone().addScaledVector(outward,distance);
   assert.equal(floor.terrainHeightAt(p.x,p.y),null,'Exterior terrain is never forced down, even immediately beside a gate');
  }
 }
 const {OpenWorld}=await server.ssrLoadModule('/src/world/OpenWorld.ts');
 const world=Object.create(OpenWorld.prototype);world.cityFloorHeightAt=(x,z)=>floor.terrainHeightAt(x,z);
 world.proceduralHeightAt=()=>18;world.sampleHeightEdit=()=>2;
 assert.equal(world.getHeightAt(110,0),20,'Outside the city, procedural terrain plus saved terrain edits are preserved');
 assert.equal(world.getHeightAt(0,0),13.94,'The existing buried terrain inside the foundation is unchanged');
 assert.deepEqual(towers.map(t=>t.position.toArray()),original,'Wall and tower transforms remain unchanged');
 console.log('Pavimentação apenas no topo; fundação fechada, alturas e coordenadas preservadas.');
}finally{await server.close();}
