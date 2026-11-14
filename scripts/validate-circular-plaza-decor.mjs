import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {circularMarketStalls,circularPlazaLanterns}=await server.ssrLoadModule('/src/editor/CentralPlazaLayout.ts');
 const {createCityPlazaGardens}=await server.ssrLoadModule('/src/editor/CityPlazaGardens.ts');
 const stalls=circularMarketStalls(),gardens=createCityPlazaGardens(),posts=circularPlazaLanterns(33,60.9);
 assert.equal(stalls.length,12);assert.equal(gardens.root.userData.gardenCount,8);assert.equal(gardens.colliders.length,32);assert.equal(gardens.root.children.length,1);assert.equal(posts.length,16);
 for(const [i,s]of stalls.entries()){
  assert(Math.abs(Math.hypot(s.x,s.z)-22)<1e-9);
  assert(Math.abs(Math.sin(s.angle)*s.x+Math.cos(s.angle)*s.z+22)<1e-8,'Stall front faces the fountain');
  for(const other of stalls.slice(i+1))assert(Math.hypot(s.x-other.x,s.z-other.z)>s.radius+other.radius+1,'Walking gaps between real stall footprints');
  for(const [x,y,z,X,Y,Z]of gardens.colliders){const dx=Math.max(x-s.x,0,s.x-X),dz=Math.max(z-s.z,0,s.z-Z);assert(Math.hypot(dx,dz)>s.radius,'No stall overlaps a flowerbed');}
 }
 for(const [i,p]of posts.entries()){
  const radius=i<8?33.45:60.45;assert(Math.abs(Math.hypot(p.x,p.z)-radius)<1e-8);
  assert(Math.abs(p.x)>12.3&&Math.abs(p.z)>9,'Avenue approaches stay clear');
  assert((p.fx*p.x+p.fz*p.z)*(i<8?1:-1)>0,'Both rows face the circular street');
 }
 for(const c of gardens.colliders){assert(c[1]>=.139&&c[4]<.57);for(const x of [c[0],c[3]])for(const z of [c[2],c[5]])assert(Math.hypot(x,z)<33,'Garden fits on the fountain island');}
 const T=await server.ssrLoadModule('three');
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const {streetLanternSites,addCityStreetLanterns,streetLanternBaseBounds}=await server.ssrLoadModule('/src/editor/CityStreetLanterns.ts');
 const saved=JSON.parse(await readFile('src/editor/default-city.json','utf8')).city['city-royal-avenue-v1'];
 const road=createRoyalAvenue({...saved,centralPlazaRadius:60,fountainPlazaRadius:33});road.position.fromArray(saved.position);road.rotation.set(...saved.rotation);road.scale.fromArray(saved.scale);
 const scene=new T.Scene();scene.add(road);road.updateWorldMatrix(true,true);const sites=streetLanternSites([road]);addCityStreetLanterns([road]);await new Promise(resolve=>setImmediate(resolve));
 const fixtures=road.children.filter(o=>o.name==='Lanterna marrom da rua');assert.equal(fixtures.length,sites.length);
 for(const [i,post]of fixtures.entries()){
  const center=streetLanternBaseBounds(post,scene).getCenter(new T.Vector3()),lamp=post.getObjectByName('LampLight_Lighting_Effect_0');
  const arm=lamp.getWorldPosition(new T.Vector3()).sub(center).setY(0).normalize(),facing=sites[i].facing.clone().transformDirection(road.matrixWorld);assert(arm.dot(facing)>.9999,'Actual circular posts follow the saved avenue rotation');
 }
 console.log('Circular plaza: 12 inward-facing stalls with walking gaps, 8 flowerbeds in one draw, 16 posts facing the ring road; approaches and stall/garden clearances passed.');
}finally{await server.close();}
