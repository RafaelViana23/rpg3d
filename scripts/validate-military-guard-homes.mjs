import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {createCityPopulation} from './src/editor/CityPopulation';export {cityDistrictPlan,districtAt} from './src/ui/CityDistricts';export {createRoyalAvenue} from './src/editor/RoyalAvenue';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {createCityPopulation,cityDistrictPlan,districtAt,createRoyalAvenue,T}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const source=JSON.parse(await readFile(process.argv[2]??'src/editor/default-city.json','utf8'));
const city=source.payload?JSON.parse(source.payload.entries['rpg3d.worldBuilder.v1']).city:source.city;
const root=new T.Group(),buildings=new Map();
for(const s of Object.values(city)){
 const o=s.id==='city-royal-avenue-v1'?createRoyalAvenue(s):new T.Group();o.name=`Cidade:${s.kind}`;
 if(s.kind==='palace')o.userData.building={width:132,depth:116};
 o.position.fromArray(s.position);o.rotation.set(...s.rotation);o.scale.fromArray(s.scale);root.add(o);buildings.set(s.id,o);
}
const population=createCityPopulation(buildings),guards=population.filter(c=>c.role.startsWith('guarda-'));
const polygon=[...buildings.values()].filter(o=>o.name==='Cidade:tower').map(o=>o.getWorldPosition(new T.Vector3()));
const center=polygon.reduce((a,b)=>a.add(b),new T.Vector3()).divideScalar(polygon.length);
const perimeter=polygon.sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x)).map(p=>new T.Vector2(p.x,p.z));
const plan=cityDistrictPlan(buildings.values(),perimeter,40);
const military=[...buildings].filter(([,o])=>o.name==='Cidade:house'&&districtAt(plan,o.position.x,o.position.z)?.id==='military');
assert.equal(guards.length,32);assert.equal(military.length,32,'Original military housing allocation contains 32 houses');
assert.equal(new Set(guards.map(c=>c.homeId)).size,32,'Each guard has a distinct home');
const ids=new Set(military.map(([id])=>id));
for(const guard of guards){
 assert(ids.has(guard.homeId),`${guard.name} lives inside the military district`);
 assert.deepEqual(buildings.get(guard.homeId).userData.ownerIds,[guard.id],'Guard exclusively owns their assigned home');
 assert.equal([...buildings.values()].filter(o=>o.name==='Cidade:house'&&o.userData.ownerIds?.includes(guard.id)).length,1,'One house per guard');
}
assert.equal(population.filter(c=>ids.has(c.homeId)&&!c.role.startsWith('guarda-')).length,0,'Civilians are reassigned outside reserved homes');
assert.equal(population.length,146);
assert.deepEqual(createCityPopulation(buildings),population,'Assignments survive scene recreation');
root.rotation.y=.63;root.position.set(71,0,-28);root.updateMatrixWorld(true);
assert.deepEqual(createCityPopulation(buildings),population,'Moving the whole city preserves guard home assignments');
console.log('32 guards occupy the 32 military houses, one exclusive home each; civilians reassigned, 146 identities and duties retained, reload/city-transform stability validated.');
