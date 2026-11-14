import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');const {loadCityPropTemplate,addCityProps}=await server.ssrLoadModule('/src/editor/CityProps.ts');const {updateCityPropLoading}=await server.ssrLoadModule('/src/editor/CityPropLoading.ts');
 const template=await loadCityPropTemplate('fountain');assert.equal(template,await loadCityPropTemplate('fountain'));const bounds=new T.Box3().setFromObject(template),size=bounds.getSize(new T.Vector3());assert(size.distanceTo(new T.Vector3(16,11,16))<1e-5);assert(Math.abs(bounds.min.y)<1e-6);assert.equal(template.children.length,1);assert.equal(template.children[0].geometry.index.count/3,455);
 const scene=new T.Scene(),root=new T.Group();root.name='Cidade:fountain';root.position.set(23,14,-19);root.rotation.y=.37;root.scale.set(1.2,1.1,.9);scene.add(root);root.updateMatrix();const before=root.matrix.toArray();
 addCityProps(root,0);await new Promise(resolve=>setImmediate(resolve));updateCityPropLoading(root.position);await new Promise(resolve=>setImmediate(resolve));
 assert(root.getObjectByName('Fonte central monumental'));assert.deepEqual(root.matrix.toArray(),before);assert.deepEqual(root.userData.localColliders[0],[-7.6,0,-7.6,7.6,1.9,7.6]);assert.equal(root.userData.localColliders.length,6);assert(root.userData.localColliders.some(b=>b[1]>=8&&b[4]>=11));assert.notEqual(root.userData.localColliders[0],template.userData.localColliders[0]);
 const manifest=JSON.parse(await readFile('artifacts/fountain-models/manifest.json','utf8')),classic=await readFile('artifacts/fountain-models/fountain-classic.ts');assert.equal(createHash('sha256').update(classic).digest('hex'),manifest.classic.sha256);
 console.log('Monumental fountain installed: 16×11×16, 455 triangles, one mesh, saved transform/base footprint unchanged, raised collisions and classic backup preserved.');
}finally{await server.close();}
