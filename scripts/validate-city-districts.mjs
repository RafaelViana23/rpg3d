import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/ui/CityDistricts';export * from './src/ui/CityMinimap';export {createMedievalBuilding} from './src/editor/MedievalBuildings';export {createRoyalAvenue} from './src/editor/RoyalAvenue';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,cityDistrictPlan,districtAt,drawCityMinimap,createMedievalBuilding,createRoyalAvenue}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const parent=new T.Group();
function object(kind,x,z){const o=new T.Group();o.name=`Cidade:${kind}`;o.position.set(x,0,z);o.userData.building={width:12,depth:16};parent.add(o);return o;}
const palace=object('palace',65,0),church=object('church',-55,55),inn=object('inn',0,-60),house=object('house',-70,-70);
const objects=new Map([['palace',palace],['church',church],['inn',inn],['house',house]]);
const polygon=[[-100,-100],[100,-100],[100,100],[-100,100]].map(p=>new T.Vector2(...p));
let plan=cityDistrictPlan(objects.values(),polygon);
assert.equal(districtAt(plan,65,0).id,'royal');assert.equal(districtAt(plan,-55,55).id,'residential');
assert.equal(districtAt(plan,0,-60).id,'residential','Inn belongs to the residential neighborhood');
assert.equal(plan.inventory.get('residential').get('Pousada da Selena'),1,'Residential legend preserves the inn');
assert(!plan.cells.some(c=>c.site.district==='travelers'),'No separate travelers district');
assert.equal(districtAt(plan,400,400),undefined,'No district outside the perimeter');
assert(!plan.inventory.has('military'),'Absent establishments are not invented');
assert.equal(plan.inventory.get('residential').get('Igreja'),1,'Church appears in the residential legend');
assert(!plan.cells.some(c=>c.site.district==='religious'),'No separate religious district');
const before=plan;church.position.set(60,0,60);plan=cityDistrictPlan(objects.values(),polygon);assert.notEqual(plan,before);assert.equal(districtAt(plan,60,60).id,'residential','Build moves update zoning');
church.removeFromParent();plan=cityDistrictPlan(objects.values(),polygon);assert(!plan.inventory.get('residential').has('Igreja'),'Deleted church disappears from the residential legend');
let fills=0;const labels=[];
const ctx=new Proxy({canvas:{width:720,height:520},measureText:s=>({width:s.length*6}),fillText:s=>labels.push(s),fill:()=>fills++},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
drawCityMinimap(ctx,objects.values(),polygon,(x,z)=>[360+x,260+z],1,false);
assert(labels.includes('Palácio')&&labels.includes('Pousada da Selena'),'One-use object iterators still render real landmarks');assert(fills>=7,'Zoning and building footprints are both painted');
// Validate the existing saved church using its actual generated geometry, not a marker.
const source=JSON.parse(await readFile(process.argv[2]??'src/editor/default-city.json','utf8'));
const city=source.payload?JSON.parse(source.payload.entries['rpg3d.worldBuilder.v1']).city:source.city;
const savedChurch=Object.values(city).find(s=>s.kind==='church'),savedRoad=city['city-royal-avenue-v1'];
const apply=(o,s)=>{o.position.fromArray(s.position);o.rotation.set(...s.rotation);o.scale.fromArray(s.scale);o.updateMatrixWorld(true);return o;};
const churchModel=apply(createMedievalBuilding('church'),savedChurch),road=apply(createRoyalAvenue(savedRoad),savedRoad);
const bounds=new T.Box3().setFromObject(churchModel);const inv=road.matrixWorld.clone().invert();
// Conservative world AABB projected to avenue coordinates contains the entire church.
const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new T.Vector3(x<0?bounds.min.x:bounds.max.x,18,z<0?bounds.min.z:bounds.max.z).applyMatrix4(inv));
function intersects(a,b){for(const p of [a,b])for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],x=q.z-p[i].z,z=p[i].x-q.x,aa=a.map(v=>v.x*x+v.z*z),bb=b.map(v=>v.x*x+v.z*z);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;}
for(const [x0,z0,x1,z1] of road.userData.royalAvenueAreas){const rect=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>({x,z}));assert(!intersects(corners,rect),'Current church does not block either avenue');}
const radius=road.userData.royalAvenueCircle.radius;
assert(Math.min(...corners.map(p=>p.x))>radius||Math.max(...corners.map(p=>p.x))< -radius||Math.min(...corners.map(p=>p.z))>radius||Math.max(...corners.map(p=>p.z))< -radius,'Church clears the central plaza');
console.log('Districts follow live transforms/removal, no invented buildings, perimeter clipping and iterator rendering validated.');
console.log('Actual saved church geometry clears both avenues and plaza; no save coordinates need changing.');

// Fixed sectors follow the avenue axes; the palace alone defines the royal area.
const sectorRoot=new T.Group(),sectorRoad=createRoyalAvenue(savedRoad);apply(sectorRoad,savedRoad);sectorRoot.add(sectorRoad);
const sectorPalace=new T.Group();sectorPalace.name='Cidade:palace';sectorPalace.userData.building={width:132,depth:116};apply(sectorPalace,Object.values(city).find(s=>s.kind==='palace'));sectorRoot.add(sectorPalace);
const sectorObjects=[sectorRoad,sectorPalace];
const perimeter=[[-210,-85],[-85,-210],[85,-210],[210,-85],[210,85],[85,210],[-85,210],[-210,85]].map(([x,z])=>{const p=new T.Vector3(x,0,z).applyMatrix4(sectorRoad.matrixWorld);return new T.Vector2(p.x,p.z);});
const sectors=cityDistrictPlan(sectorObjects,perimeter);
for(const [x,z,expected] of [[120,100,'noble'],[-120,100,'military'],[0,0,'commercial']]){const p=new T.Vector3(x,0,z).applyMatrix4(sectorRoad.matrixWorld);assert.equal(districtAt(sectors,p.x,p.z)?.id,expected);}
const royal=sectors.cells.filter(c=>c.site.district==='royal');assert.equal(royal.length,1);
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.z-b.x*a.z;},0))/2;
assert(Math.abs(area(royal[0].polygon)-132*116)<1e-5,'Royal district matches the exact palace rectangle');
for(const c of sectors.cells.filter(c=>c.site.district!=='royal')){const p=c.polygon.reduce((a,b)=>({x:a.x+b.x/c.polygon.length,z:a.z+b.z/c.polygon.length}),{x:0,z:0});const local=sectorPalace.worldToLocal(new T.Vector3(p.x,sectorPalace.position.y,p.z));assert(Math.abs(local.x)>=66-1e-5||Math.abs(local.z)>=58-1e-5,'Other zones exclude the palace');}
sectorPalace.rotation.y+=.2;const rotated=cityDistrictPlan(sectorObjects,perimeter);assert.notEqual(rotated,sectors,'Palace rotation invalidates zoning cache');
console.log('Upper-right noble sector, lower-right military sector, shared plaza and exact exclusive palace footprint validated.');

for(const [x,z,expected] of [[32,0,'commercial'],[-32,0,'commercial'],[0,32,'commercial'],[0,-32,'commercial'],[-100,10,'military'],[100,10,'noble'],[80,-34,'commercial']]){const p=new T.Vector3(x,0,z).applyMatrix4(sectorRoad.matrixWorld);assert.equal(districtAt(sectors,p.x,p.z)?.id,expected,'Commercial disk extends beyond the paved plaza and ends at its own radius');}
console.log('Central commercial disk validated beyond the paving, with neighboring sectors preserved.');
