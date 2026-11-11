import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export {seedCityPerimeter,createPerimeterBuilding,PERIMETER_CATALOG} from './src/editor/CityPerimeter';export {medievalStreetPlan,seedWallWarehouses,separateWarehouseHouses} from './src/editor/MedievalCityLayout';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {seedCityPerimeter,createPerimeterBuilding,PERIMETER_CATALOG,medievalStreetPlan,seedWallWarehouses,separateWarehouseHouses,T}=await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
const objects=new Map(),saved={};const R=172.5/(2*Math.sin(Math.PI/8)),v=Array.from({length:8},(_,i)=>({x:Math.cos(Math.PI/8+i*Math.PI/4)*R,z:7.5+Math.sin(Math.PI/8+i*Math.PI/4)*R}));
v.forEach((p,i)=>{const o=new T.Group();o.position.set(p.x,0,p.z);o.name='Cidade:tower';o.scale.setScalar(5);objects.set(`capital-octagon-tower-${i}`,o)});
v.forEach((a,i)=>{const b=v[(i+1)%8],dx=b.x-a.x,dz=b.z-a.z;for(let j=0;j<3;j++){if(j===1&&[0,4,6].includes(i))continue;const t=(41.25+j*45)/172.5,o=new T.Group();o.position.set(a.x+dx*t,0,a.z+dz*t);o.rotation.y=-Math.atan2(dz,dx);objects.set(`capital-octagon-wall-${i}-${j}`,o)}});
for(const side of [0,4,6]){
  const a=v[side],b=v[(side+1)%8],dx=b.x-a.x,dz=b.z-a.z,id=`capital-octagon-gate-${side}`;
  saved[id]={id,kind:'gate',layer:'Cidade Principal',position:[(a.x+b.x)/2,0,(a.z+b.z)/2],rotation:[0,-Math.atan2(dz,dx),0],scale:[45/14,3.75,3.75]};
}
medievalStreetPlan().forEach((l,i)=>{const o=new T.Group();o.position.set(l.x,0,l.z+7.5);o.rotation.y=l.angle;o.scale.set(l.sx,l.sy,l.sz);o.name=`Cidade:${l.kind}`;o.userData.cityId=`street-${i}`;o.userData.building={width:l.w/l.sx,depth:l.d/l.sz};objects.set(`street-${i}`,o);saved[`street-${i}`]={id:`street-${i}`,kind:l.kind,position:o.position.toArray(),rotation:[0,l.angle,0],scale:[l.sx,l.sy,l.sz],layer:'Cidade Principal'}});
const builder={objects,add(e){const o=createPerimeterBuilding(e.kind)??new T.Group();if(e.kind==='warehouse')o.userData.building={width:16,depth:16};o.position.fromArray(e.position);o.rotation.y=e.rotation[1];o.scale.fromArray(e.scale);o.userData.cityId=e.id;objects.set(e.id,o);return o}};
seedWallWarehouses(saved,builder,{heightAt:()=>4});
assert(seedCityPerimeter(saved,builder,{heightAt:()=>4}));
const entries=Object.values(saved).filter(e=>e.id.startsWith('medieval-perimeter'));
console.log(entries.map(e=>`${e.kind}: ${e.position[0].toFixed(1)},${e.position[2].toFixed(1)}`).join('\n'));
assert.equal(entries.length,11,'All perimeter sites must fit');assert.equal(seedCityPerimeter(saved,builder,{heightAt:()=>4}),false,'Must retain saved layout');
for(const {kind} of PERIMETER_CATALOG){const o=createPerimeterBuilding(kind);assert(o.children.length);assert(o.userData.localColliders.length);for(const c of o.userData.localColliders)assert(c.every(Number.isFinite));}
assert(!entries.some(e=>e.kind==='wall-access'),'No exterior stair flights');
const legacy={id:'medieval-perimeter-v1-wall-access-old',kind:'wall-access',layer:'Cidade Principal',position:[0,4,0],rotation:[0,0,0],scale:[1,1,1]};saved[legacy.id]=legacy;builder.add(legacy);
assert(seedCityPerimeter(saved,builder,{heightAt:()=>4}));assert(!saved[legacy.id]);
for(const e of entries.filter(e=>['guardhouse','tollhouse'].includes(e.kind))){const tangent=e.id.endsWith('sul')?Math.abs(e.position[0]):Math.abs(e.position[2]-7.5);assert(tangent>=23,'Gate approach remains open');assert.equal(e.perimeterLayoutRevision,2);}
console.log('11 sites, clear gate approaches, removal of exterior stairs, persistent transforms and finite colliders validated.');

const housePositions=[26,27].map(i=>objects.get(`street-${i}`).position.clone());
assert(separateWarehouseHouses(saved,builder,{heightAt:()=>4}),'Move the two warehouse houses');
for(let i=0;i<2;i++){const id=`street-${[26,27][i]}`;assert(objects.get(id).position.x>housePositions[i].x+4);assert.equal(saved[id].warehouseClearanceRevision,1);}
assert.equal(separateWarehouseHouses(saved,builder,{heightAt:()=>4}),false,'Keep player edits after the migration');
assert(!Object.keys(saved).some(id=>id==='medieval-perimeter-v1-wagon-shelter-sul'));
console.log('Tower-side shelter removed and both warehouse houses moved laterally with persistent clearance.');

for(const gate of Object.values(saved).filter(e=>e.kind==='gate'))for(const entry of Object.values(saved).filter(e=>['military-store','repair-workshop','smithy'].includes(e.kind))){
  const dx=entry.position[0]-gate.position[0],dz=entry.position[2]-gate.position[2],a=gate.rotation[1];
  const tangent=dx*Math.cos(a)-dz*Math.sin(a),normal=dx*Math.sin(a)+dz*Math.cos(a);
  if(Math.abs(normal)<30){assert(Math.abs(tangent)>=33,'Bases stay beside the real gateway');assert.equal(entry.perimeterLayoutRevision,3);}
}
console.log('Diagonal gate approaches remain unobstructed, with the bases alongside the wall.');
