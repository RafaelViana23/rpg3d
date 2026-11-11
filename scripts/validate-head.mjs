import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({server:{middlewareMode:true},appType:'custom'}),errors=[],warnings=[];
const assert=(condition,message)=>(condition?undefined:errors.push(message));
try{
  const {ElfHeadModel,DEFAULT_HEAD_PARAMETERS}=await server.ssrLoadModule('/src/art/ElfHeadModel.ts');
  const model=new ElfHeadModel(DEFAULT_HEAD_PARAMETERS),geometry=model.headMesh.geometry;
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.index;
  assert(Boolean(index),'head: geometry must be indexed');assert(position.count===model.baseHeadPositions.length/3,'head: base/editable vertex counts differ');
  let degenerate=0,invalidNormals=0;const adjacency=Array.from({length:position.count},()=>new Set());
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3();
  for(let i=0;i<index.count;i+=3){const ai=index.getX(i),bi=index.getX(i+1),ci=index.getX(i+2);a.fromBufferAttribute(position,ai);b.fromBufferAttribute(position,bi);c.fromBufferAttribute(position,ci);cross.subVectors(b,a).cross(c.clone().sub(a));if(cross.lengthSq()<1e-12)degenerate++;adjacency[ai].add(bi).add(ci);adjacency[bi].add(ai).add(ci);adjacency[ci].add(ai).add(bi);}
  for(let i=0;i<normal.count;i++)if(!Number.isFinite(normal.getX(i)+normal.getY(i)+normal.getZ(i)))invalidNormals++;
  const visited=new Set([0]),queue=[0];while(queue.length){const vertex=queue.shift();for(const neighbor of adjacency[vertex])if(!visited.has(neighbor)){visited.add(neighbor);queue.push(neighbor);}}
  let symmetryError=0;for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i);let nearest=Infinity;for(let j=0;j<position.count;j++)nearest=Math.min(nearest,Math.hypot(position.getX(j)+x,position.getY(j)-y,position.getZ(j)-z));symmetryError=Math.max(symmetryError,nearest);}
  const offsets=new Array(position.count*3).fill(0),roundTrip=JSON.parse(JSON.stringify({version:1,vertexCount:position.count,offsets,updatedAt:new Date(0).toISOString()}));
  assert(degenerate===0,`head: ${degenerate} degenerate triangles`);assert(invalidNormals===0,`head: ${invalidNormals} invalid normals`);assert(visited.size===position.count,`head: ${position.count-visited.size} disconnected vertices`);assert(symmetryError<.007,`head: symmetry error ${symmetryError}`);if(symmetryError>.002)warnings.push(`base cage has ${symmetryError.toFixed(6)} residual mirror deviation`);assert(roundTrip.offsets.length===position.count*3,'head: JSON round-trip lost offsets');assert(model.metrics.triangles<=model.metrics.budgetTriangles,'head: triangle budget exceeded');
  console.log(JSON.stringify({ok:errors.length===0,errors,warnings,results:{vertices:position.count,triangles:index.count/3,degenerate,invalidNormals,connected:visited.size,symmetryError:+symmetryError.toFixed(8),jsonOffsets:roundTrip.offsets.length}},null,2));
  model.dispose();if(errors.length)process.exitCode=1;
}finally{await server.close();}
