import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {CityStructureInstances}=await server.ssrLoadModule('/src/editor/CityStructureInstances.ts');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),instances=new CityStructureInstances(scene),buildings=[];
 const geometry=new T.BoxGeometry(2,3,4),material=new T.MeshStandardMaterial({color:'#7b603f'});
 let disposedGeometry=0,disposedMaterial=0;geometry.addEventListener('dispose',()=>disposedGeometry++);material.addEventListener('dispose',()=>disposedMaterial++);
 for(let i=0;i<4;i++){
  const owner=new T.Group();owner.position.set(i*6,5,10);owner.rotation.set(.1,i*.2,.03);owner.scale.set(1+i*.1,1.5,.8);scene.add(owner);buildings.push(owner);
  const mesh=new T.Mesh(geometry,material);mesh.position.y=2;mesh.castShadow=mesh.receiveShadow=true;owner.add(mesh);
  const door=new T.Group();door.name='Animated door';door.add(new T.Mesh(geometry,material));owner.add(door);
  const glass=new T.Mesh(geometry,new T.MeshStandardMaterial({transparent:true,opacity:.2}));owner.add(glass);
 }
 const saved=buildings.map(owner=>[owner.position.toArray(),owner.rotation.toArray(),owner.scale.toArray()]);
 const snapshot=()=>assert.deepEqual(buildings.map(owner=>[owner.position.toArray(),owner.rotation.toArray(),owner.scale.toArray()]),saved);
 const renderer={render(){
  assert(instances.root.visible);assert.equal(instances.root.children.length,1);
  const batch=instances.root.children[0];assert.equal(batch.count,4);assert(batch.castShadow&&batch.receiveShadow);assert.equal(batch.material,material);
  for(let i=0;i<4;i++){
   const original=buildings[i].children[0];assert.equal(original.visible,false);assert.equal(buildings[i].children[1].visible,true);assert.equal(buildings[i].children[2].visible,true);
   const matrix=new T.Matrix4();batch.getMatrixAt(i,matrix);
   const vertex=new T.Vector3(1,1,1),expected=vertex.clone().applyMatrix4(original.matrixWorld);
   assert(vertex.applyMatrix4(matrix).applyMatrix4(instances.root.matrixWorld).distanceTo(expected)<1e-5);
  }
 }};
 instances.render(renderer,camera,buildings,true,0);assert.equal(instances.stats.savedDraws,3);
 for(const owner of buildings)assert(owner.children[0].visible);assert(!instances.root.visible);snapshot();
 instances.render({render(){assert(!instances.root.visible);for(const owner of buildings)assert(owner.children[0].visible);}},camera,buildings,false,10);
 assert.throws(()=>instances.render({render(){throw Error('renderer error');}},camera,buildings,true,20));
 for(const owner of buildings)assert(owner.children[0].visible);assert(!instances.root.visible);
 // Mirroring and shear must use the original draw path to preserve normals.
 const shell=buildings[3].children[0];shell.rotation.y=.7;
 instances.render({render(){assert(shell.visible);assert.equal(instances.root.children[0].count,3);}},camera,buildings,true,600);
 shell.rotation.y=0;shell.scale.x=-1;
 instances.render({render(){assert(shell.visible);assert.equal(instances.root.children[0].count,3);}},camera,buildings,true,1200);
 shell.scale.x=1;
 // Updates preserve separate shadow states and never render deleted/hidden sources.
 buildings[0].children[0].castShadow=false;
 instances.render({render(){assert.equal(instances.root.children.length,1);assert.equal(instances.root.children[0].count,3);assert(buildings[0].children[0].visible);}},camera,buildings,true,1800);
 buildings[1].visible=false;
 instances.render({render(){assert(instances.root.children.every(mesh=>!mesh.visible));}},camera,buildings,true,1801);
 instances.dispose();assert.equal(disposedGeometry,0);assert.equal(disposedMaterial,0);snapshot();
 // Count real shell meshes and real shared materials from the repository map.
 const {createCityAsset}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const savedMap=JSON.parse(await readFile('src/editor/default-city.json','utf8'));
 const city=savedMap.city??savedMap.objects??savedMap;
 const mapScene=new T.Scene(),shells=[];
 for(const value of Object.values(city)){
  if(value.kind!=='house')continue;
  const owner=createCityAsset(value.kind);owner.position.fromArray(value.position);owner.rotation.fromArray(value.rotation);owner.scale.fromArray(value.scale);mapScene.add(owner);shells.push(owner);
 }
 assert(shells.length>20);
 const draw=new CityStructureInstances(mapScene);
 draw.render({render(){}},camera,shells,true,0);
 assert(draw.stats.savedDraws>0);
 console.log(JSON.stringify({houses:shells.length,...draw.stats,verified:['world transforms','materials','shadows','Build originals','doors and glass excluded','error recovery','visibility','shared resource ownership']}));
 draw.dispose();
}finally{await server.close();}
