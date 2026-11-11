import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {applyRoyalAvenueLayout,createRoyalAvenue,royalAvenueBlocksPoint,updateRoyalAvenueUV} from './src/editor/RoyalAvenue';export {createMedievalBuilding} from './src/editor/MedievalBuildings';export {createPerimeterBuilding} from './src/editor/CityPerimeter';export {courtyardWellSites} from './src/editor/CityCourtyards';export {cityPavingMaterial} from './src/world/CityPaving';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,applyRoyalAvenueLayout,createRoyalAvenue,royalAvenueBlocksPoint,updateRoyalAvenueUV,courtyardWellSites,cityPavingMaterial,createMedievalBuilding,createPerimeterBuilding}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const {city}=JSON.parse(await readFile('src/editor/default-city.json','utf8')),layout=JSON.parse(await readFile('src/editor/royal-avenue-layout.json','utf8'));
const road=city['city-royal-avenue-v1'],matrix=s=>new T.Matrix4().compose(new T.Vector3(...s.position),new T.Quaternion().setFromEuler(new T.Euler(...s.rotation)),new T.Vector3(...s.scale));
const inverse=matrix(road).invert();
const local=p=>new T.Vector3(...p).applyMatrix4(inverse);
const palace=city[layout.palaceId],gate=city[layout.gateId],palacePoint=local(palace.position),gatePoint=local(gate.position);
assert(Math.abs(palacePoint.x)<1e-6&&Math.abs(gatePoint.x)<1e-6,'Palace and entrance align with avenue center');
const facing=new T.Vector3(0,0,1).transformDirection(matrix(palace)),towardGate=new T.Vector3(...gate.position).sub(new T.Vector3(...palace.position)).setY(0).normalize();assert(facing.dot(towardGate)>.999,'Palace door faces main gate');
const footprints=new Map();
for(const [id,s]of Object.entries(city)){
 const model=createPerimeterBuilding(s.kind)??createMedievalBuilding(s.kind);if(!model)continue;
 const box=new T.Box3().setFromObject(model);if(box.isEmpty())continue;
 const transform=inverse.clone().multiply(matrix(s));
 const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new T.Vector3(x<0?box.min.x:box.max.x,0,z<0?box.min.z:box.max.z).applyMatrix4(transform));footprints.set(id,points);
}
function intersects(a,b){for(const polygon of [a,b])for(let i=0;i<4;i++){const p=polygon[i],q=polygon[(i+1)%4],x=q.z-p.z,z=p.x-q.x,aa=a.map(p=>p.x*x+p.z*z),bb=b.map(p=>p.x*x+p.z*z);if(Math.max(...aa)<=Math.min(...bb)+1e-5||Math.max(...bb)<=Math.min(...aa)+1e-5)return false;}return true;}
const start=road.points[0][2],end=road.points[1][2];
const rectangle=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>({x,z}));
const corridor=rectangle(-10,start,10,end);
for(const [id,points]of footprints){if(id===layout.palaceId||['tower','wall','gate'].includes(city[id].kind))continue;assert(!intersects(points,corridor),`${id} blocks main avenue`);}
for(const id of Object.keys(layout.moves)){if(!footprints.has(id))continue;for(const [other,points]of footprints){if(id===other)continue;assert(!intersects(footprints.get(id),points),`${id} overlaps ${other}`);}}
const model=createRoyalAvenue(road);assert.equal(model.children.length,2,'Boulevard and plaza use only two draws');assert.equal(model.userData.localColliders.length,0,'Paving does not block travel');
const baseline=JSON.parse(await readFile('backups/cidade-posicao-aprovada-2026-11-10.json','utf8')).city;
const builder={objects:new Map(Object.entries(baseline).map(([id])=>[id,new T.Group()])),add(s){const o=new T.Group();this.objects.set(s.id,o);return o;}};
assert(applyRoyalAvenueLayout(baseline,builder));assert.deepEqual(baseline[layout.palaceId].position,palace.position);baseline[layout.palaceId].position[0]+=2;assert(!applyRoyalAvenueLayout(baseline,builder),'Later Build edits survive reload');
console.log('Aligned gate/palace, clear avenue and plaza, no overlaps for relocated lots, two draws and one-time saved-world migration validated.');

const courtyardBuildings=[];
for(const entry of Object.values(city)){
 const object=entry.id==='city-royal-avenue-v1'?createRoyalAvenue(entry):createPerimeterBuilding(entry.kind)??createMedievalBuilding(entry.kind);
 if(!object)continue;object.position.fromArray(entry.position);object.rotation.set(...entry.rotation);object.scale.fromArray(entry.scale);courtyardBuildings.push(object);
}
const boulevard=courtyardBuildings.find(o=>o.userData.royalAvenue);
const wells=courtyardWellSites(courtyardBuildings);assert(wells.length>0,'Courtyards retain wells');
for(const well of wells)assert(!royalAvenueBlocksPoint(boulevard,well.point,4),'Entire well footprint stays outside avenue and plaza');
assert.equal(cityPavingMaterial().color.getHexString(),'d4cbb6');assert.equal(model.children[0].material.color.getHexString(),'d0d5dc');
console.log('Courtyard wells avoid boulevard and plaza; avenue/city paving colors swapped.');

model.position.fromArray(road.position);model.rotation.set(...road.rotation);model.scale.fromArray(road.scale);
for(const yaw of [0,.63]){
 model.rotation.y+=yaw;updateRoyalAvenueUV(model);
 for(const mesh of model.children){
  const positions=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
  for(let i=0;i<positions.count;i++){
   const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(model.matrixWorld.clone().invert());
   assert(Math.abs(uv.getX(i)-point.x/12)<1e-5&&Math.abs(uv.getY(i)-point.z/12)<1e-5,'Paving remains aligned to avenue axes after Build rotation');
  }
 }
}
console.log('Paving grid aligned across city and avenue, including subsequent Build rotations.');

const floorReference=new T.Group(),floorMesh=new T.Mesh(new T.BoxGeometry(20,.1,20),cityPavingMaterial());floorMesh.position.set(31,18,54);floorReference.add(floorMesh);
updateRoyalAvenueUV(model,floorReference);
const fp=floorMesh.geometry.getAttribute('position'),fu=floorMesh.geometry.getAttribute('uv');
for(let i=0;i<fp.count;i++){
 const point=new T.Vector3().fromBufferAttribute(fp,i).applyMatrix4(floorMesh.matrixWorld).applyMatrix4(model.matrixWorld.clone().invert());
 assert(Math.abs(fu.getX(i)-point.x/12)<1e-5&&Math.abs(fu.getY(i)-point.z/12)<1e-5,'City ground uses the avenue as its texture reference');
}
console.log('City floor texture follows avenue direction and origin.');
const fountainLink=createRoyalAvenue(road);fountainLink.updateMatrixWorld(true);
for(const [x,z]of [[-24,0],[24,0],[0,-30],[0,30],[-10,-24],[10,24]]){
 const ray=new T.Raycaster(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));
 assert(ray.intersectObject(fountainLink.children[0]).length>0,'Fountain circle connects seamlessly to both sides of avenue');
}
assert(royalAvenueBlocksPoint(fountainLink,new T.Vector3(24,0,0),0),'Wells stay outside linked fountain circle');
console.log('Fountain roundabout is connected to the avenue and protected from wells.');

const outsideFormerRectangle=new T.Raycaster(new T.Vector3(24,3,end-8),new T.Vector3(0,-1,0));assert.equal(outsideFormerRectangle.intersectObject(fountainLink.children[0]).length,0,'No rectangular widening at royal entrance');
console.log('Straight entrance retained without rectangular forecourt.');
