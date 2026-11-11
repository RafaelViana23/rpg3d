import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {applyAvenueFrontages} from './src/editor/AvenueFrontages';export {createMedievalBuilding} from './src/editor/MedievalBuildings';export {createPerimeterBuilding} from './src/editor/CityPerimeter';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,applyAvenueFrontages,createMedievalBuilding,createPerimeterBuilding}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const {city}=JSON.parse(await readFile('src/editor/default-city.json','utf8')),road=city['city-royal-avenue-v1'];
const matrix=s=>new T.Matrix4().compose(new T.Vector3(...s.position),new T.Quaternion().setFromEuler(new T.Euler(...s.rotation)),new T.Vector3(...s.scale)),inverse=matrix(road).invert();
const footprints=new Map(),models=new Map();
for(const [id,s]of Object.entries(city)){
 const model=createPerimeterBuilding(s.kind)??createMedievalBuilding(s.kind);if(!model)continue;models.set(id,model);
 const box=new T.Box3().setFromObject(model);if(box.isEmpty())continue;const m=inverse.clone().multiply(matrix(s));
 footprints.set(id,[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new T.Vector3(x<0?box.min.x:box.max.x,0,z<0?box.min.z:box.max.z).applyMatrix4(m)));
}
function inside(point,polygon){const signs=polygon.map((a,i)=>{const b=polygon[(i+1)%4];return (b.x-a.x)*(point.z-a.z)-(b.z-a.z)*(point.x-a.x);});return signs.every(s=>s>1e-5)||signs.every(s=>s< -1e-5);}
const frontages=Object.entries(city).filter(([,s])=>s.avenueFrontage);assert.equal(frontages.length,39);
for(const [id,s]of frontages){
 const m=inverse.clone().multiply(matrix(s)),center=new T.Vector3().setFromMatrixPosition(m),forward=new T.Vector3(0,0,1).transformDirection(m);
 const door=new T.Vector3(0,0,models.get(id).userData.building.depth/2+.3).applyMatrix4(m),curb=door.clone();
 if(s.avenueFrontage==='main'){assert(Math.abs(forward.z)<1e-6&&forward.x*center.x<0,'Main avenue facade is parallel with door facing road');curb.x=Math.sign(center.x)*10.9;}
 else{assert(Math.abs(forward.x)<1e-6&&forward.z*center.z<0,'Secondary facade is parallel with door facing road');curb.z=Math.sign(center.z)*7.4;}
 for(let t=0;t<=1;t+=.1){const point=door.clone().lerp(curb,t);for(const [other,poly]of footprints)if(id!==other)assert(!inside(point,poly),`${other} blocks ${id} door access`);}
}
const old=JSON.parse(await readFile('backups/cidade-tres-avenidas-2026-11-10.json','utf8')).city;
const builder={objects:new Map(Object.keys(old).map(id=>[id,new T.Group()])),add(s){const o=new T.Group();this.objects.set(s.id,o);return o;}};
assert(applyAvenueFrontages(old,builder));assert.equal(Object.values(old).filter(s=>s.avenueFrontage).length,39);assert(!applyAvenueFrontages(old,builder),'Future Build edits are preserved');
console.log('39 parallel avenue facades, doors facing streets, unobstructed entry paths and persistent migration validated.');
