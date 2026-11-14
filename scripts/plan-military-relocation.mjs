import fs from 'node:fs/promises';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {createMedievalBuilding} from './src/editor/MedievalBuildings';export {createPerimeterBuilding} from './src/editor/CityPerimeter';export {createRoyalAvenue} from './src/editor/RoyalAvenue';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,createMedievalBuilding,createPerimeterBuilding,createRoyalAvenue}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const input=JSON.parse(await fs.readFile(process.argv[2]??'/tmp/rpg-relocate-current.json','utf8'));
const world=input.payload?JSON.parse(input.payload.entries['rpg3d.worldBuilder.v1']):input;
const city=world.city,road=city['city-royal-avenue-v1'];
const matrix=s=>new T.Matrix4().compose(new T.Vector3(...s.position),new T.Quaternion().setFromEuler(new T.Euler(...s.rotation)),new T.Vector3(...s.scale));
const roadMatrix=matrix(road),inverse=roadMatrix.clone().invert();
const moving=Object.values(city).filter(s=>['training-yard','military-store','stable','guardhouse'].includes(s.kind));
const shapes=new Map();
for(const s of Object.values(city)){
 if(['road','path','market','fountain'].includes(s.kind))continue;
 const model=createPerimeterBuilding(s.kind)??createMedievalBuilding(s.kind);
 let box=model?new T.Box3().setFromObject(model):null;
 if(!box||box.isEmpty()){
  const dim=s.kind==='wall'?[12,2.65]:s.kind==='gate'?[14.5,3.25]:s.kind==='tower'?[8,8]:null;if(!dim)continue;
  box=new T.Box3(new T.Vector3(-dim[0]/2,0,-dim[1]/2),new T.Vector3(dim[0]/2,10,dim[1]/2));
 }
 shapes.set(s.id,box);
}
const corners=(s,pad=0)=>{const box=shapes.get(s.id);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new T.Vector3(x<0?box.min.x-pad:box.max.x+pad,0,z<0?box.min.z-pad:box.max.z+pad).applyMatrix4(matrix(s)));};
function intersects(a,b){for(const p of [a,b])for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],x=q.z-p[i].z,z=p[i].x-q.x,aa=a.map(v=>v.x*x+v.z*z),bb=b.map(v=>v.x*x+v.z*z);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;}
const ignored=new Set(moving.map(s=>s.id));
const obstacles=Object.values(city).filter(s=>shapes.has(s.id)&&!ignored.has(s.id)).map(s=>({id:s.id,poly:corners(s,.7)}));
const towers=Object.values(city).filter(s=>s.kind==='tower').map(s=>new T.Vector3(...s.position));
const center=towers.reduce((a,b)=>a.add(b),new T.Vector3()).divideScalar(towers.length);
const perimeter=towers.sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x));
const inside=p=>perimeter.every((a,i)=>{const b=perimeter[(i+1)%perimeter.length];return (b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x)>5*Math.hypot(b.x-a.x,b.z-a.z);});
const rectangle=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]].map(([x,z])=>new T.Vector3(x,0,z).applyMatrix4(roadMatrix));
const roads=[rectangle(-10.9,road.points[0][2],10.9,road.points[1][2]),rectangle(road.secondaryAvenues.left,-7.4,road.secondaryAvenues.right,7.4)];
const fits=s=>{const poly=corners(s,.5);return poly.every(inside)&&!obstacles.some(o=>intersects(poly,o.poly))&&!roads.some(o=>intersects(poly,o));};
const result=[];
function place(s,candidates){for(const c of candidates){const next={...structuredClone(s),position:c.position,rotation:c.rotation??s.rotation};if(!fits(next))continue;result.push(next);obstacles.push({id:next.id,poly:corners(next,.7)});return next;}throw new Error('No clear lot for '+s.id);}
const guards=moving.filter(s=>s.kind==='guardhouse');
const gates=Object.values(city).filter(s=>s.kind==='gate');
for(let i=0;i<gates.length;i++){
 const gate=gates[i],gm=matrix(gate),gl=center.clone().applyMatrix4(gm.clone().invert()),sign=gl.z>=0?1:-1;
 const tangent=new T.Vector3(1,0,0).transformDirection(gm),inward=new T.Vector3(0,0,sign).transformDirection(gm);
 const source=guards[i]??{...structuredClone(guards[0]),id:`military-guardhouse-${gate.id}`};if(!shapes.has(source.id))shapes.set(source.id,shapes.get(guards[0].id));
 const candidates=[];
 for(let lateral=29;lateral<=45;lateral+=.5)for(let depth=8;depth<=23;depth+=.5)for(const side of [-1,1]){
  const p=new T.Vector3(...gate.position).addScaledVector(tangent,side*lateral).addScaledVector(inward,depth);p.y=18;
  candidates.push({position:p.toArray(),rotation:[0,Math.atan2(-side*tangent.x,-side*tangent.z),0],score:(lateral-29)**2+(depth-10)**2});
 }
 candidates.sort((a,b)=>a.score-b.score);place(source,candidates);
}
for(const kind of ['training-yard','stable','military-store']){
 const s=moving.find(s=>s.kind===kind),candidates=[];
 const preferred=kind==='training-yard'?[-155,95]:kind==='stable'?[-115,170]:[-170,60];
 for(let x=-198;x<=-20;x+=1)for(let z=20;z<=198;z+=1){
  if(Math.hypot(x,z)<102)continue;
  for(const yaw of [0,Math.PI/2]){
   const p=new T.Vector3(x,0,z).applyMatrix4(roadMatrix);p.y=18;
   const next={...s,position:p.toArray(),rotation:[0,road.rotation[1]+yaw,0]};
   if(!corners(next).every(p=>{const l=p.clone().applyMatrix4(inverse);return l.x< -9&&l.z>9&&Math.hypot(l.x,l.z)>91;}))continue;
   candidates.push({position:next.position,rotation:next.rotation,score:(x-preferred[0])**2+(z-preferred[1])**2});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);place(s,candidates);
}
await fs.writeFile('backups/military-relocation/placement-plan.json',JSON.stringify({moves:result},null,2));
console.log(JSON.stringify(result.map(s=>({id:s.id,kind:s.kind,position:s.position,rotation:s.rotation})),null,2));
