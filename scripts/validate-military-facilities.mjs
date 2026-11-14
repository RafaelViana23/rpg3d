import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {applyMilitaryFacilitiesLayout} from './src/editor/MilitaryFacilitiesLayout';export {cityDistrictPlan,districtAt} from './src/ui/CityDistricts';export {createRoyalAvenue} from './src/editor/RoyalAvenue';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {applyMilitaryFacilitiesLayout,cityDistrictPlan,districtAt,createRoyalAvenue,T}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const source=JSON.parse(await readFile(process.argv[2]??'src/editor/default-map.json','utf8'));
const state=source.payload?JSON.parse(source.payload.entries['rpg3d.worldBuilder.v1']):source;
if(!process.argv[2]){const layout=JSON.parse(await readFile('src/editor/military-facilities-layout.json','utf8'));for(const [id,pose] of Object.entries(layout.source))Object.assign(state.city[id],pose);}
const before=structuredClone(state);
const storage=new Map();globalThis.localStorage={setItem:(k,v)=>storage.set(k,v)};
let reconciled=0;const builder={reconcile(){reconciled++;}};
assert(await applyMilitaryFacilitiesLayout(state,builder));assert.equal(reconciled,1);
assert.deepEqual(JSON.parse(storage.get('rpg3d.militaryFacilities.before.v1')),before,'Full current save preserved before relocation');
const changed=Object.keys(state.city).filter(id=>JSON.stringify(state.city[id])!==JSON.stringify(before.city[id]));assert.equal(changed.length,6,'Only the five requested facilities and one added guardhouse change');
for(const section of ['terrain','removedAssets','mapWidth','mapDepth'])assert.deepEqual(state[section],before[section]);
for(const [id,value] of Object.entries(before.assets))if(id!=='cavalo-da-cavalari-a')assert.deepEqual(state.assets[id],value);
const root=new T.Group(),objects=[];
for(const s of Object.values(state.city)){const o=s.id==='city-royal-avenue-v1'?createRoyalAvenue(s):new T.Group();o.name=`Cidade:${s.kind}`;if(s.kind==='palace')o.userData.building={width:132,depth:116};o.position.fromArray(s.position);o.rotation.set(...s.rotation);o.scale.fromArray(s.scale);root.add(o);objects.push(o);}
const towers=objects.filter(o=>o.name==='Cidade:tower'),center=towers.reduce((p,o)=>p.add(o.position),new T.Vector3()).divideScalar(8);
const polygon=towers.map(o=>new T.Vector2(o.position.x,o.position.z)).sort((a,b)=>Math.atan2(a.y-center.z,a.x-center.x)-Math.atan2(b.y-center.z,b.x-center.x));
const plan=cityDistrictPlan(objects,polygon);
for(const kind of ['training-yard','military-store','stable']){const o=objects.find(o=>o.name===`Cidade:${kind}`);assert.equal(districtAt(plan,o.position.x,o.position.z)?.id,'military',kind+' is physically in the military district');}
const gates=objects.filter(o=>o.name==='Cidade:gate'),guards=objects.filter(o=>o.name==='Cidade:guardhouse');assert.equal(guards.length,3);
const assigned=new Set();for(const gate of gates){const nearest=guards.toSorted((a,b)=>a.position.distanceToSquared(gate.position)-b.position.distanceToSquared(gate.position))[0];assert(nearest.position.distanceTo(gate.position)<45,'Guardhouse immediately beside a gate');assert(!assigned.has(nearest),'Each gate has its own guardhouse');assigned.add(nearest);}
const matrix=s=>new T.Matrix4().compose(new T.Vector3(...s.position),new T.Quaternion().setFromEuler(new T.Euler(...s.rotation)),new T.Vector3(...s.scale));
const stable='medieval-perimeter-v1-stable-sul',horse='cavalo-da-cavalari-a';
const oldLocal=matrix(before.city[stable]).invert().multiply(matrix(before.assets[horse]));
const newLocal=matrix(state.city[stable]).invert().multiply(matrix(state.assets[horse]));
oldLocal.elements.forEach((v,i)=>assert(Math.abs(v-newLocal.elements[i])<1e-8,'Stable horse keeps its exact local transform'));
const edited=structuredClone(state);edited.city[stable].position[0]+=2;assert(!await applyMilitaryFacilitiesLayout(edited,builder));assert.equal(edited.city[stable].position[0],state.city[stable].position[0]+2,'Later user edits are never reapplied');
const wrong=structuredClone(before);wrong.city[stable].position[0]+=1;const snapshot=JSON.stringify(wrong);assert(!await applyMilitaryFacilitiesLayout(wrong,builder));assert.equal(JSON.stringify(wrong),snapshot,'Unrecognized layouts are untouched');
console.log('Military facilities physically relocated; three gates have separate adjacent guardhouses; stable horse follows; full backup, only authorized transforms, and one-time/source checks validated.');
