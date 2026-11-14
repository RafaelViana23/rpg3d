import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const T=await server.ssrLoadModule('three');
 const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino',hairStyle:'longo',helmetHair:false});
 const hair=actor.group.getObjectByName('character.hair.hoodCovered');
 assert(hair.isSkinnedMesh);assert.deepEqual(hair.skeleton.bones.map(b=>b.name),['Head','Neck','Chest']);
 const positions=hair.geometry.attributes.position,weights=hair.geometry.attributes.skinWeight;
 for(let i=0;i<weights.count;i++){assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);}
 actor.group.updateMatrixWorld(true);hair.skeleton.update();
 const before=Array.from({length:positions.count},(_,i)=>hair.getVertexPosition(i,new T.Vector3()).clone());
 for(let i=0;i<positions.count;i++)assert(before[i].distanceTo(new T.Vector3().fromBufferAttribute(positions,i))<1e-5,'Bind pose preserves hair silhouette');
 actor.group.getObjectByName('Head').rotation.y=.35;actor.group.updateMatrixWorld(true);hair.skeleton.update();
 let moved=0;for(let i=0;i<positions.count;i++){const vertex=hair.getVertexPosition(i,new T.Vector3());assert(Number.isFinite(vertex.length()));if(vertex.distanceTo(before[i])>.001)moved++;}
 assert(moved>0,'Hair deforms between head and torso');
 actor.setHoodHairHidden(true);assert.equal(hair.visible,false);actor.setHoodHairHidden(false);assert.equal(hair.visible,true);
 console.log('Cabelo longo: pesos normalizados, pose inicial preservada, deformação articulada e capuz validados.');
}finally{await server.close();}
