import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {build} from 'esbuild';
const r=await build({stdin:{contents:"export {createRoyalAvenue,royalAvenueBlocksPoint} from './src/editor/RoyalAvenue';export {applySecondaryAvenuesLayout} from './src/editor/SecondaryAvenues';export {createMedievalBuilding} from './src/editor/MedievalBuildings';export {createPerimeterBuilding} from './src/editor/CityPerimeter';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,createRoyalAvenue,royalAvenueBlocksPoint,applySecondaryAvenuesLayout,createMedievalBuilding,createPerimeterBuilding}=await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
const {city}=JSON.parse(await readFile('src/editor/default-city.json','utf8')),layout=JSON.parse(await readFile('src/editor/secondary-avenues-layout.json','utf8')),road=city['city-royal-avenue-v1'];
const matrix=s=>new T.Matrix4().compose(new T.Vector3(...s.position),new T.Quaternion().setFromEuler(new T.Euler(...s.rotation)),new T.Vector3(...s.scale)),inverse=matrix(road).invert();
const model=createRoyalAvenue(road);model.updateMatrixWorld(true);assert.equal(model.children.length,2,'All three avenues retain two draws');assert.equal(road.secondaryAvenues.width,13);
for(const gateId of layout.gateIds){
 const gate=new T.Vector3(...city[gateId].position).applyMatrix4(inverse);assert(Math.abs(gate.z)<1e-5,'Extra gate aligns with secondary approach');
 for(let t=0;t<=1;t+=.025){const x=gate.x*t,ray=new T.Raycaster(new T.Vector3(x,3,0),new T.Vector3(0,-1,0));assert(ray.intersectObject(model.children[0]).length,'Continuous paved connection from fountain to gate');assert(royalAvenueBlocksPoint(model,new T.Vector3(x,0,0),0),'Wells stay out of secondary avenue');}
}
for(const x of [-100,100])assert.equal(new T.Raycaster(new T.Vector3(x,3,8),new T.Vector3(0,-1,0)).intersectObject(model.children[0]).length,0,'Secondary avenues stay narrower than main avenue');
for(const [id,s]of Object.entries(city)){
 if(['palace','gate','tower','wall','road','path','fountain'].includes(s.kind))continue;
 const object=createPerimeterBuilding(s.kind)??createMedievalBuilding(s.kind);if(!object)continue;
 const box=new T.Box3().setFromObject(object);if(box.isEmpty())continue;
 const transform=inverse.clone().multiply(matrix(s));
 const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new T.Vector3(x<0?box.min.x:box.max.x,0,z<0?box.min.z:box.max.z).applyMatrix4(transform));
 const lane=[new T.Vector3(road.secondaryAvenues.left,0,-6.5),new T.Vector3(road.secondaryAvenues.right,0,-6.5),new T.Vector3(road.secondaryAvenues.right,0,6.5),new T.Vector3(road.secondaryAvenues.left,0,6.5)];
 let overlap=true;for(const polygon of [points,lane])for(let i=0;i<4;i++){const a=polygon[i],b=polygon[(i+1)%4],x=b.z-a.z,z=a.x-b.x,p=points.map(v=>v.x*x+v.z*z),q=lane.map(v=>v.x*x+v.z*z);if(Math.max(...p)<=Math.min(...q)||Math.max(...q)<=Math.min(...p))overlap=false;}
 assert(!overlap,`${id} blocks a secondary avenue`);
}
const old=JSON.parse(await readFile('backups/cidade-palacio-fortificado-2026-11-10.json','utf8')).city;
const builder={objects:new Map(Object.keys(old).map(id=>[id,new T.Group()])),add(s){const o=new T.Group();this.objects.set(s.id,o);return o;}};
assert(applySecondaryAvenuesLayout(old,builder));assert.equal(old[road.id].secondaryAvenues.revision,1);assert(!applySecondaryAvenuesLayout(old,builder),'Later Build edits are preserved');
console.log('Both extra gates connected to fountain, narrower continuous paving, clear lots, shared draw budget and persistent migration validated.');
