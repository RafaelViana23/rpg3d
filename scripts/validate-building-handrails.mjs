import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createMedievalBuilding}=await server.ssrLoadModule('/src/editor/MedievalBuildings.ts');
 const T=await server.ssrLoadModule('three');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 for(const kind of ['house','guild','weapons','potions','shop']){
  const building=createMedievalBuilding(kind),stair=building.userData.stairPlacement;
  assert(stair,kind+': staircase exists');
  const info=building.userData.building;
  assert(Math.abs(stair.x+stair.width/2-(info.width/2-.225))<1e-8,'Stair meets side wall');
  const original=building.userData.stairOriginalFlight;
  assert.equal(original.x,info.width/2-1.7,'Original flight lateral position preserved');
  assert.equal(original.width,2.4,'Original flight width preserved');
  assert.equal(original.end,-info.depth/2+2,'Original flight end preserved');
  assert(Math.abs(original.extension-.53)<1e-8,'Only the wall-side gap is filled');
  const landing=building.userData.stairLanding;
  assert(Math.abs(stair.z-stair.depth/2-landing.front)<1e-8,'Stair ends at landing');
  assert(landing.front-landing.back>=1.775-1e-8,'Landing leaves room to turn before rear wall');
  assert(building.userData.walkSurfaces.some(s=>s[0]<=landing.left+1e-8&&s[2]>=landing.right-1e-8&&s[1]<=landing.back+1e-8&&s[3]>=landing.front-1e-8&&s[4]===stair.height),'Landing has continuous floor support');
  if(kind==='house')assert(building.userData.woodFloorSurfaces.some(s=>s[4]===.08),'House uses store wood flooring');
  const rails=building.userData.stairHandrails;assert.equal(rails.length,2);
  for(const [x,start,end,bottom,top,height,thickness] of rails){
   assert(Math.abs(x-stair.x)+thickness/2<=stair.width/2,kind+': posts inside tread width');
   assert(Math.abs(x-stair.x)-thickness/2>.9,kind+': clear central passage');
   assert(start>end&&bottom===0&&top===stair.height&&height===1.05);
   assert(building.userData.localColliders.some(c=>Math.abs(c[0]-(x-.07))<1e-8&&c[2]===end&&c[5]===start),kind+': side barrier');
  }
  // A rail spanning the flight at either end would close the stair access.
  const start=stair.z+stair.depth/2,end=stair.z-stair.depth/2;
  for(const z of [end+.2]){
   assert(!building.userData.localColliders.some(c=>c[0]<stair.x-.5&&c[3]>stair.x+.5&&c[2]<=z&&c[5]>=z&&c[1]>=stair.height&&c[1]<stair.height+1.1),kind+': no transverse barrier across stair access');
  }
  // The rear wall itself remains solid, but its applied timber must not project
  // beyond the inner wall face into the final tread or the landing.
  const wallFace=-info.depth/2+.225;
  assert(!building.userData.localColliders.some(c=>c[0]<stair.x+.5&&c[3]>stair.x-.5&&c[2]<wallFace+.2&&c[5]>wallFace+.01&&c[1]<stair.height+1.2&&c[4]>stair.height),kind+': rear trim clear of final tread');
  building.updateMatrixWorld(true);
  for(let i=0;i<20;i++){
   const z=original.start-(i+.5)*(original.start-original.end)/20,top=(i+1)*stair.height/20;
   const ray=new T.Raycaster(new T.Vector3(info.width/2-.226,top+.04,z),new T.Vector3(0,-1,0),0,.08);
   assert(ray.intersectObject(building,true).some(hit=>Math.abs(hit.point.y-top)<1e-5),kind+': actual tread geometry seals wall-side gap at step '+i);
  }
  const parapet=building.userData.stairParapet;
  assert(parapet.left+.07<=landing.left,'Inner parapet sits entirely on upper floor');
  assert(parapet.right-.07>=landing.right,'Outer parapet sits beyond the stair opening');
  assert(parapet.base>=stair.height,'Parapet posts do not penetrate ceiling below');
  const extension=building.userData.lastTreadExtension;
  assert(extension.top<stair.height-.08,'Solid extension stays below floor finish');
  assert(rails.every(r=>r[2]===building.userData.stairRailJoin.z),'Handrails end at parapet junction');
  assert(building.userData.localColliders.some(c=>c[0]<stair.x&&c[3]>stair.x&&c[2]<=start+.09&&c[5]>=start+.09&&c[1]===stair.height),'Upper drop has return guard');
  assert(extension.back<=-info.depth/2,'Final tread extends into rear wall');
  for(const t of [.05,.5,.95]){
   const z=extension.back+(extension.front-extension.back)*t;
   const ray=new T.Raycaster(new T.Vector3(original.x,extension.top+.04,z),new T.Vector3(0,-1,0),0,.08);
   assert(ray.intersectObject(building,true).some(hit=>Math.abs(hit.point.y-extension.top)<1e-5),kind+': solid last tread fills rear gap');
  }
  let wood=false;building.traverse(o=>{if(o.material===CITY_WOOD_MATERIAL)wood=true;});assert(wood);
 }
 for(const kind of ['tavern','warehouse','church'])assert(!createMedievalBuilding(kind).userData.stairHandrails,kind+': no added staircase');
 console.log('Casas, pousada, guilda e lojas: dois corrimãos de madeira padrão, degraus e acessos livres; prédios térreos preservados.');
}finally{await server.close();}
