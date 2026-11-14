import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let restore;
try{
 const T=await server.ssrLoadModule('three');
 const {GLTFLoader}=await server.ssrLoadModule('three/addons/loaders/GLTFLoader.js');
 const previous=GLTFLoader.prototype.loadAsync,requests=[];
 GLTFLoader.prototype.loadAsync=function(url){requests.push(url);return new Promise(()=>{});};
 restore=()=>GLTFLoader.prototype.loadAsync=previous;
 const {addCityProps,loadCityPropTemplate}=await server.ssrLoadModule('/src/editor/CityProps.ts');
 const {createMedievalBuilding}=await server.ssrLoadModule('/src/editor/MedievalBuildings.ts');
 const {CITY_WINDOW_WIDTH:w,CITY_WINDOW_HEIGHT:h,CITY_WINDOW_DEPTH:d,CITY_WINDOW_OFFSET:offset}=await server.ssrLoadModule('/src/editor/CityWindowLayout.ts');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 let sharedGeometry,count=0;
 for(const kind of ['house','inn']){
  const building=createMedievalBuilding(kind),saved=[building.position.toArray(),building.rotation.toArray(),building.scale.toArray()];
  assert(!building.parent);addCityProps(building,123);
  // No awaited microtask, queue tick or scene parenting before this assertion.
  const windows=building.children.filter(prop=>prop.userData.assetSource==='procedural:city-window');
  assert.equal(windows.length,building.userData.windows.length,`${kind}: every window exists synchronously with the shell`);
  assert(windows.length>0);
  for(const [i,window] of windows.entries()){
   const placement=building.userData.windows[i];
   assert(window.visible&&!window.userData.cityInteriorProp,'Exterior window never waits for an open door');
   assert.equal(window.rotation.y,placement.rotation);
   assert(window.position.distanceTo(new T.Vector3(placement.x+Math.sin(placement.rotation)*offset,placement.y-h/2,placement.z+Math.cos(placement.rotation)*offset))<1e-12);
   window.updateMatrixWorld(true);
   const size=new T.Box3().setFromObject(window).getSize(new T.Vector3());
   const expected=Math.abs(Math.sin(placement.rotation))>.5?[d,h,w]:[w,h,d];
   size.toArray().forEach((value,index)=>assert(Math.abs(value-expected[index])<1e-6,'Fitted dimensions unchanged'));
   window.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.material,CITY_WOOD_MATERIAL);if(sharedGeometry)assert.equal(mesh.geometry,sharedGeometry);sharedGeometry=mesh.geometry;}});
   count++;
  }
  assert.deepEqual([building.position.toArray(),building.rotation.toArray(),building.scale.toArray()],saved);
 }
 const template=await loadCityPropTemplate('village-window');assert.equal(template.children[0].geometry,sharedGeometry,'Async template callers share the same geometry');
 assert(!requests.some(url=>url.includes('village-window')),'No window GLB request');
 console.log(`${count} procedural windows present immediately on house/inn, before scene parenting or loading ticks; shared geometry/material, exact fitting and no GLB download verified.`);
}finally{restore?.();await server.close();}
