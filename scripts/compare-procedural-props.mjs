import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createServer} from 'vite';
const cases=[
 {label:'Janela',pack:'village-window',module:'CityWindow',factory:'createCityWindow'},
 {label:'Porta arqueada',pack:'church-door',module:'CityChurchDoor',factory:'createCityChurchDoor'},
 {label:'Cadeira',pack:'chair',module:'CityChair',factory:'createCityChair'},
 {label:'Cortina',pack:'curtain',module:'CityCurtain',factory:'createCityCurtain'},
 {label:'Mesa do quarto',pack:'tavern-table',module:'RoyalTimberTable',factory:'createRoyalTimberTable'},
 {label:'Cama (já procedural antes)',pack:'bed',module:'RoyalStyleBed',factory:'createRoyalStyleBed'},
];
function oldStats(bytes){
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 let meshes=0,triangles=0;const geometries=new Set(),materials=new Set(),textureIds=new Set(),skinIds=new Set();
 const visit=index=>{const node=gltf.nodes[index];if(node.skin!==undefined)skinIds.add(node.skin);
  if(node.mesh!==undefined){const mesh=gltf.meshes[node.mesh];for(const [i,p] of mesh.primitives.entries()){
   const count=gltf.accessors[p.indices??p.attributes.POSITION].count,mode=p.mode??4;
   if(mode!==4)throw Error('Non-triangle primitive');triangles+=count/3;meshes++;geometries.add(`${node.mesh}:${i}`);
   if(p.material!==undefined)materials.add(p.material);
  }}for(const child of node.children??[])visit(child);
 };
 for(const index of gltf.scenes[gltf.scene??0].nodes)visit(index);
 const collectTextures=value=>{if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(k.endsWith('Texture')&&v?.index!==undefined)textureIds.add(v.index);else collectTextures(v);}};
 for(const id of materials)collectTextures(gltf.materials[id]);
 const viewIds=new Set();
 for(const key of geometries){const [mesh,i]=key.split(':').map(Number),p=gltf.meshes[mesh].primitives[i];for(const index of [...Object.values(p.attributes),...(p.indices!==undefined?[p.indices]:[])]){const a=gltf.accessors[index];if(a.bufferView!==undefined)viewIds.add(a.bufferView);}}
 return {fileBytes:bytes.length,meshes,triangles,geometryBufferViewBytes:[...viewIds].reduce((n,id)=>n+gltf.bufferViews[id].byteLength,0),materials:materials.size,textures:textureIds.size,joints:[...skinIds].reduce((n,id)=>n+gltf.skins[id].joints.length,0)};
}
function newStats(root){
 let meshes=0,triangles=0,joints=0;const geometries=new Set(),materials=new Set(),textures=new Set();
 root.traverse(node=>{if(node.isBone)joints++;if(!node.isMesh)return;meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 const arrays=new Set();for(const g of geometries){for(const a of Object.values(g.attributes))arrays.add(a.array);if(g.index)arrays.add(g.index.array);}
 return {meshes,triangles,geometryTypedArrayBytes:[...arrays].reduce((n,a)=>n+a.byteLength,0),materials:materials.size,textures:textures.size,joints};
}
function release(root){const geometries=new Set();root.traverse(node=>{if(node.isMesh){geometries.add(node.geometry);if(node.isSkinnedMesh)node.skeleton.dispose();}});for(const g of geometries)g.dispose();}
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const results=[];
 for(const entry of cases){
  const factory=(await server.ssrLoadModule(`/src/editor/${entry.module}.ts`))[entry.factory];
  const old=oldStats(await readFile(`public/models/city/props/${entry.pack}.glb`));
  const root=factory(),current=newStats(root);release(root);
  const times=[];for(let i=0;i<100;i++){const start=performance.now(),model=factory();const ms=performance.now()-start;if(i>=20)times.push(ms);release(model);}
  times.sort((a,b)=>a-b);
  results.push({...entry,old,current,triangleReductionPercent:(1-current.triangles/old.triangles)*100,factoryMedianMs:times[Math.floor(times.length*.5)],factoryP95Ms:times[Math.floor(times.length*.95)]});
 }
 const report={method:'Static geometry from active GLB scene versus current procedural factories. CPU timings use Node SSR and exclude network, shader compilation and GPU rendering. Mesh counts are before batching and culling; geometry-byte methods differ and are listed separately.',results};
 await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/procedural-comparison.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
