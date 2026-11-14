import fs from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {createMedievalBuilding} from './src/editor/MedievalBuildings';export {createPerimeterBuilding} from './src/editor/CityPerimeter';export {createRoyalAvenue} from './src/editor/RoyalAvenue';export {avenueBuildingFootprint,footprintBlocksAvenue,clearAvenueHouses} from './src/editor/AvenueClearance';export {MedievalCityFloor} from './src/world/MedievalCityFloor';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,createMedievalBuilding,createPerimeterBuilding,createRoyalAvenue,avenueBuildingFootprint,footprintBlocksAvenue,clearAvenueHouses,MedievalCityFloor}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const snapshot=JSON.parse(await fs.readFile('backups/central-plaza-expansion/before.json','utf8'));
const map=JSON.parse(snapshot.payload.entries['rpg3d.worldBuilder.v1']);
const scene=new T.Scene(),objects=new Map();
const apply=(o,s)=>{o.position.fromArray(s.position);o.rotation.set(...s.rotation);o.scale.fromArray(s.scale);scene.add(o);o.updateMatrixWorld(true);return o;};
const roadEntry=map.city['city-royal-avenue-v1'];roadEntry.centralPlazaRadius=60;roadEntry.fountainPlazaRadius=33;
const road=apply(createRoyalAvenue(roadEntry),roadEntry);objects.set(roadEntry.id,road);
for(const [id,s]of Object.entries(map.city)){
 if(id===roadEntry.id)continue;
 const model=createPerimeterBuilding(s.kind)??createMedievalBuilding(s.kind);
 if(model)objects.set(id,apply(model,s));
}
const towers=Object.values(map.city).filter(s=>s.kind==='tower').map(s=>apply(new T.Group(),s));
const floor=new MedievalCityFloor(scene);floor.update(towers);
const before=structuredClone(map.city);
const blocked=[...objects].filter(([id,o])=>map.city[id].kind==='house'&&footprintBlocksAvenue(road,avenueBuildingFootprint(o,road,.6)));
console.log('Houses requiring room:',blocked.length);
// Redistribute the nearby residential blocks instead of sending blocked houses
// to distant empty lots. All calculations use the existing roof footprints.
const entries=[...objects].filter(([id])=>id!==roadEntry.id).map(([id,o])=>({id,o,poly:avenueBuildingFootprint(o,road,.8),actual:avenueBuildingFootprint(o,road),offset:new T.Vector3(),home:road.worldToLocal(o.getWorldPosition(new T.Vector3()))})).filter(e=>e.poly.length);
for(const e of entries)e.mobile=map.city[e.id].kind==='house'&&Math.hypot(e.home.x,e.home.z)<145;
const polygon=e=>e.poly.map(p=>({x:p.x+e.offset.x,z:p.z+e.offset.z}));
function separation(a,b){
 let best=null;
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],length=Math.hypot(q.x-p.x,q.z-p.z),nx=-(q.z-p.z)/length,nz=(q.x-p.x)/length;
  const aa=a.map(p=>p.x*nx+p.z*nz),bb=b.map(p=>p.x*nx+p.z*nz),lo=Math.min(...bb)-Math.max(...aa),hi=Math.max(...bb)-Math.min(...aa);
  if(lo>=0||hi<=0)return null;
  const amount=Math.abs(lo)<Math.abs(hi)?lo:hi;
  if(!best||Math.abs(amount)<best.depth)best={x:nx*amount,z:nz*amount,depth:Math.abs(amount)};
 }
 return best;
}
const baseline=new Map();
for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
 const overlap=separation(polygon(entries[i]),polygon(entries[j]));if(overlap)baseline.set(`${i}:${j}`,overlap.depth);
}
const initialOffsets={'medieval-streets-v2-house-114':[-20,15],'medieval-streets-v2-house-123':[-45,20],'medieval-streets-v2-house-124':[-45,20],'medieval-streets-v2-house-44':[10,-35],'medieval-streets-v2-house-130':[-15,20]};
for(const e of entries)if(initialOffsets[e.id])e.offset.set(initialOffsets[e.id][0],0,initialOffsets[e.id][1]);
const radius=road.userData.royalAvenueCircle.radius+1;
function constrain(e){
 let poly=polygon(e),nearest=null;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(-(a.x*dx+a.z*dz)/(dx*dx+dz*dz),0,1),p={x:a.x+t*dx,z:a.z+t*dz},d=Math.hypot(p.x,p.z);
  if(!nearest||d<nearest.d)nearest={...p,d};
 }
 if(nearest.d<radius){e.offset.x+=nearest.x/nearest.d*(radius-nearest.d+.01);e.offset.z+=nearest.z/nearest.d*(radius-nearest.d+.01);}
 poly=polygon(e);
 // Each house stays in its original block, on the same side of both avenues.
 const xmin=Math.min(...poly.map(p=>p.x)),xmax=Math.max(...poly.map(p=>p.x)),zmin=Math.min(...poly.map(p=>p.z)),zmax=Math.max(...poly.map(p=>p.z));
 if(e.home.x<0&&xmax> -11.9)e.offset.x-=xmax+11.9;
 if(e.home.x>0&&xmin<11.9)e.offset.x+=11.9-xmin;
 if(e.home.z<0&&zmax> -8.4)e.offset.z-=zmax+8.4;
 if(e.home.z>0&&zmin<8.4)e.offset.z+=8.4-zmin;
}
for(let iteration=0;iteration<1500;iteration++){
 let worst=0;
 for(const e of entries)if(e.mobile)constrain(e);
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const a=entries[i],b=entries[j];if(!a.mobile&&!b.mobile)continue;
  const overlap=separation(polygon(a),polygon(b));if(!overlap)continue;
  const allowed=baseline.get(`${i}:${j}`)??0,depth=overlap.depth-allowed;if(depth<=.001)continue;
  const factor=(depth+.002)/overlap.depth;worst=Math.max(worst,depth);
  const wa=a.mobile?(b.mobile?.5:1):0,wb=b.mobile?(a.mobile?.5:1):0;
  a.offset.x+=overlap.x*factor*wa;a.offset.z+=overlap.z*factor*wa;b.offset.x-=overlap.x*factor*wb;b.offset.z-=overlap.z*factor*wb;
 }
 if(iteration%400===0)console.log('Redistribution',iteration,worst);
 if(worst<.002&&iteration>20)break;
}
for(const e of entries)if(e.mobile&&e.offset.length()>.01){
 const local=e.home.clone().add(e.offset),dest=road.localToWorld(local);dest.y=map.city[e.id].position[1];e.o.position.copy(dest);e.o.updateMatrixWorld(true,true);map.city[e.id].position=dest.toArray();
}
const conflicts=[];
for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
 const a=entries[i],b=entries[j];if(!a.mobile&&!b.mobile)continue;const overlap=separation(polygon(a),polygon(b));if(overlap&&overlap.depth>(baseline.get(`${i}:${j}`)??0)+.01)conflicts.push({a:a.id,b:b.id,depth:overlap.depth});
}
for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
 const a=entries[i],b=entries[j];if(!a.mobile&&!b.mobile)continue;
 const orig=separation(a.actual,b.actual)?.depth??0;
 const ap=a.actual.map(p=>({x:p.x+a.offset.x,z:p.z+a.offset.z})),bp=b.actual.map(p=>({x:p.x+b.offset.x,z:p.z+b.offset.z}));
 const now=separation(ap,bp)?.depth??0;if(now>orig+.01)throw Error(`New physical overlap: ${a.id} / ${b.id}`);
}
console.log('Physical overlaps: none added');
const moves=Object.entries(map.city).filter(([id,s])=>JSON.stringify(s.position)!==JSON.stringify(before[id].position)).map(([id,s])=>({id,from:before[id].position,to:s.position,distance:new T.Vector3(...s.position).distanceTo(new T.Vector3(...before[id].position))}));
const unresolved=[...objects].filter(([id,o])=>map.city[id].kind==='house'&&footprintBlocksAvenue(road,avenueBuildingFootprint(o,road,.6))).map(([id])=>id);
console.log(JSON.stringify({moves,unresolved},null,2));
if(unresolved.length)throw Error('Unresolved houses');
for(const e of entries)if(e.mobile)for(const p of e.actual){const w=road.localToWorld(new T.Vector3(p.x+e.offset.x,0,p.z+e.offset.z));if(floor.heightAt(w.x,w.z)===null)throw Error(`House outside foundation: ${e.id}`);}
await fs.writeFile('backups/central-plaza-expansion/proposed-map.json',JSON.stringify(map));
await fs.writeFile('backups/central-plaza-expansion/plan.json',JSON.stringify({revision:snapshot.revision,radius:60,moves},null,2));
