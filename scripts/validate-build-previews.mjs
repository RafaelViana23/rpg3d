import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {cloneBuildPreviewModel,freezeBuildPreviewPose}=await server.ssrLoadModule('/src/editor/BuildPreviewModel.ts');
 const palace=createRoyalPalace(),city=new T.Group();city.add(palace);
 const bone=new T.Bone(),helper=new T.SkeletonHelper(bone);palace.add(bone,helper);
 for(const source of [palace,city]){
  const copy=cloneBuildPreviewModel(source);copy.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(copy);
  assert(!bounds.isEmpty()&&bounds.getSize(new T.Vector3()).toArray().every(Number.isFinite));
  copy.traverse(child=>assert(!child.type.endsWith('Helper'),'No uncloneable editor helpers in palace/city previews'));
  const originals=new Map();source.traverse(child=>{if(child.isMesh)originals.set(child.name+':'+child.geometry.uuid,child);});
  copy.traverse(child=>{if(child.isMesh){const original=originals.get(child.name+':'+child.geometry.uuid);assert(original);assert.equal(child.geometry,original.geometry);const a=Array.isArray(child.material)?child.material:[child.material],b=Array.isArray(original.material)?original.material:[original.material];assert.equal(a.length,b.length);a.forEach((m,i)=>assert.equal(m,b[i]));}});
 }
 assert(helper.parent===palace,'Preview cloning does not remove helpers from the live source');
 globalThis.ProgressEvent??=class {constructor(type,init){Object.assign(this,init);}};
 const raw=await readFile('public/models/animals/chicken/model.glb'),length=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+length)),offset=20+length;
 json.buffers[0].uri='data:application/octet-stream;base64,'+raw.subarray(offset+8,offset+8+raw.readUInt32LE(offset)).toString('base64');
 json.images=[];json.textures=[];json.materials=json.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}));
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');gltf.scene.animations=gltf.animations;
 let visible=0;const colors=new Set();gltf.scene.traverse(m=>{if(m.isMesh&&m.visible){visible++;colors.add(m.material.name);}});assert.equal(visible,7,'All seven colored parts of the actual chicken are retained');assert(colors.has('white')&&colors.has('pale_red')&&colors.has('gold')&&colors.has('black'));
 const chicken=cloneBuildPreviewModel(gltf.scene),mixer=new T.AnimationMixer(chicken);mixer.clipAction(gltf.animations.find(c=>/idle/.test(c.name))).play();mixer.setTime(.1);chicken.updateMatrixWorld(true);
 chicken.traverse(m=>{if(m.isSkinnedMesh){assert(m.skeleton.bones.every(Boolean));assert(m.skeleton.bones.every(b=>b!==gltf.scene.getObjectByName(b.name)));m.skeleton.update();m.computeBoundingBox();assert(m.boundingBox.getSize(new T.Vector3()).toArray().every(Number.isFinite));}});
 freezeBuildPreviewPose(chicken);let remainingSkins=0;chicken.traverse(m=>{if(m.isSkinnedMesh)remainingSkins++;});assert.equal(remainingSkins,0,'Static preview cannot apply skin scaling twice');
 const before=new T.Box3().setFromObject(chicken).getSize(new T.Vector3());
 const holder=new T.Group();holder.add(chicken);holder.scale.setScalar(.025);holder.updateMatrixWorld(true);
 const after=new T.Box3().setFromObject(holder).getSize(new T.Vector3());
 assert(after.distanceTo(before.clone().multiplyScalar(.025))<1e-6,'Chicken proportions remain identical after thumbnail normalization');
 console.log('Palácio/cidade sem helpers; sete partes originais da galinha, materiais e pose preservados.');
}finally{await server.close();}
