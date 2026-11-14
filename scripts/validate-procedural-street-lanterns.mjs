import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const {loadCityPropTemplate}=await server.ssrLoadModule('/src/editor/CityProps.ts');
 const {streetLanternBaseBounds,streetLanternSites,addCityStreetLanterns}=await server.ssrLoadModule('/src/editor/CityStreetLanterns.ts');
 const {updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const source=await loadCityPropTemplate('street-lantern');assert.equal(source,await loadCityPropTemplate('street-lantern'));
 let triangles=0;source.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.equal(triangles,180);
 const base=streetLanternBaseBounds(source);assert(Math.abs(base.min.y)<1e-8);assert(base.getSize(new T.Vector3()).x<.9);assert(base.getSize(new T.Vector3()).z<.9);
 const saved=JSON.parse(await readFile('src/editor/default-city.json','utf8')).city['city-royal-avenue-v1'],before=JSON.stringify(saved);
 const road=createRoyalAvenue(saved);road.position.fromArray(saved.position);road.rotation.set(...saved.rotation);road.scale.fromArray(saved.scale);
 const scene=new T.Scene();scene.add(road);road.updateMatrix();const transform=road.matrix.toArray();const sites=streetLanternSites([road]);
 const collidersBefore=road.userData.localColliders.length;addCityStreetLanterns([road]);await new Promise(resolve=>setImmediate(resolve));
 const posts=road.children.filter(child=>child.name==='Lanterna marrom da rua');assert.equal(posts.length,sites.length);assert.equal(road.userData.localColliders.length,collidersBefore+sites.length);
 for(let i=0;i<posts.length;i++){
  const post=posts[i];post.updateWorldMatrix(true,true);
  const foot=streetLanternBaseBounds(post,scene),center=foot.getCenter(new T.Vector3());assert(Math.hypot(center.x-sites[i].point.x,center.z-sites[i].point.z)<1e-6);assert(Math.abs(foot.min.y-sites[i].point.y)<1e-6);
  const lamp=post.getObjectByName('LampLight_Lighting_Effect_0'),arm=lamp.getWorldPosition(new T.Vector3()).sub(center).setY(0).normalize();const towardRoad=sites[i].facing.clone().transformDirection(road.matrixWorld);assert(arm.dot(towardRoad)>.9999,'The actual lantern arm faces the rotated avenue, not a world axis');
  let meshes=0,lights=0;post.traverse(o=>{if(o.isMesh)meshes++;if(o.isPointLight){lights++;assert(!o.castShadow);}});assert.equal(meshes,2);assert.equal(lights,1);
 }
 scene.updateMatrixWorld(true);updateCityFirelights(.1,new T.Vector3(1000,0,1000),0,0,.5);for(const post of posts)assert(post.getObjectByName('Luz da lanterna da rua').visible);
 assert.equal(JSON.stringify(saved),before);assert.deepEqual(road.matrix.toArray(),transform);addCityStreetLanterns([road]);await new Promise(resolve=>setImmediate(resolve));assert.equal(road.children.filter(c=>c.name==='Lanterna marrom da rua').length,posts.length);
 console.log(`${posts.length} procedural posts: 180 triangles, 2 meshes, 1 shadow-free light; foot collision, facing, placement and saved transforms preserved.`);
}finally{await server.close();}
