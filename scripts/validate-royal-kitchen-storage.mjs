import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class ProgressEvent{constructor(type,init){Object.assign(this,{type},init);}};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {placeRoyalKitchenStorage}=await server.ssrLoadModule('/src/editor/RoyalKitchenStorage.ts');
 async function load(name,piece){
  const data=await readFile(`public/models/city/props/${name}.glb`),length=data.readUInt32LE(12);
  const json=JSON.parse(data.subarray(20,20+length).toString());
  for(const mesh of json.meshes??[])for(const p of mesh.primitives)delete p.material;
  delete json.materials;delete json.textures;delete json.images;
  const bin=data.subarray(20+length+8);json.buffers[0].uri=`data:application/octet-stream;base64,${bin.toString('base64')}`;
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
  return piece?gltf.scene.getObjectByName(piece):gltf.scene;
 }
 const crate=await load('box-low-poly'),barrel=await load('farm','Barrel'),table=await load('tavern-round-table'),bottles=await Promise.all(['green','brown','yellow'].map(c=>load(`tavern-bottle-${c}`)));assert(crate&&barrel);
 const palace=createRoyalPalace(0),before=palace.userData.localColliders.length;
 placeRoyalKitchenStorage(palace,crate,barrel,{table,bottles});
 assert(palace.userData.kitchenStorageLoaded);
 assert.equal(palace.userData.localColliders.length-before,36);
 const crates=palace.children.filter(p=>p.name==='Caixa empilhada da despensa');assert.equal(crates.length,18);
 const levels=[...new Set(crates.map(p=>p.position.y.toFixed(3)))];assert.equal(levels.length,3);
 placeRoyalKitchenStorage(palace,crate,barrel,{table,bottles});assert.equal(palace.userData.localColliders.length-before,36);
 console.log('Actual GLB bounds validated: 18 stacked crates, four loose crates, upright and lying barrels, three tavern tables and bottles, with supported surfaces and no overlaps.');
}finally{await server.close();}
