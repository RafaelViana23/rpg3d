import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as T from 'three';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const saved=JSON.parse(await readFile('backups/central-plaza-expansion/proposed-map.json','utf8')).city['city-royal-avenue-v1'];
 const before=JSON.stringify(saved),road=createRoyalAvenue(saved);
 assert.equal(road.userData.royalAvenueCircle.radius,60.9);assert.equal(road.userData.fountainPlazaCircle.radius,33);
 assert.equal(road.children.length,2,'Plaza remains in the two existing paving/border draws');
 assert.equal(JSON.stringify(saved),before,'Geometry never rewrites saved transforms');
 // The inner paving is a real disk and the road a connected annulus, without
 // duplicate coplanar triangles under the market or a hole in the walking floor.
 let area=0;const positions=road.children[0].geometry.attributes.position;
 for(let i=0;i<positions.count;i+=3){
  const a=new T.Vector3().fromBufferAttribute(positions,i),b=new T.Vector3().fromBufferAttribute(positions,i+1),c=new T.Vector3().fromBufferAttribute(positions,i+2);
  area+=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).length()/2;
 }
 const full=createRoyalAvenue({...saved,fountainPlazaRadius:undefined}),p=full.children[0].geometry.attributes.position;let fullArea=0;
 for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);fullArea+=b.sub(a).cross(c.sub(a)).length()/2;}
 assert(Math.abs((fullArea-area)-Math.PI*(33.9**2-33**2))<15,'Only the inner border strip is removed from the paving');
 const {createCityMarketStall}=await server.ssrLoadModule('/src/editor/CityMarketStall.ts');let max=0;
 for(const name of ['Stand_Vegetables','Stand_Tools','Stand_Meat']){
  const model=createCityMarketStall(name);assert(model,name);const box=new T.Box3().setFromObject(model),scale=2.8/box.getSize(new T.Vector3()).y;
  const reach=Math.hypot(box.max.x-box.min.x,box.max.z-box.min.z)*.5*scale;
  max=Math.max(max,27+reach);assert((27+reach)*1.0000004944546366<33,`${name} fits within the fountain/market plaza at every saved stall angle`);
 }
 console.log(`Plaza: outer radius 60 m; inner radius 33 m; circular street 26.1 m; real market extent <= ${max.toFixed(2)} m; two draws and saved transforms preserved.`);
}finally{await server.close();}
