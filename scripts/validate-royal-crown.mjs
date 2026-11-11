import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {attachRoyalCrown}=await server.ssrLoadModule('/src/editor/RoyalCrown.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const T=await server.ssrLoadModule('three');
 const bytes=await readFile('public/models/city/props/royal-crown.glb');
 const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 for(const body of ['masculino','feminino']){
  const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body});actor.setChibi(true);
  const crown=new T.Group(),visual=model.scene.clone(true),size=new T.Box3().setFromObject(visual).getSize(new T.Vector3());
  visual.scale.setScalar(.7/Math.max(size.x,size.z));crown.add(visual);crown.userData.assetSource='royal-crown';
  actor.group.add(crown);actor.group.updateMatrixWorld(true);
  const originalSize=new T.Box3().setFromObject(crown).getSize(new T.Vector3());
  attachRoyalCrown(actor,crown);actor.group.updateMatrixWorld(true);
  const fittedSize=new T.Box3().setFromObject(crown).getSize(new T.Vector3());
  assert(originalSize.distanceTo(fittedSize)<.001,'Attaching preserves crown size');
  const head=actor.group.getObjectByName('Head'),localPosition=crown.position.clone(),localScale=crown.scale.clone();
  for(const state of ['idle','walk','run','sit']){
   actor.setAnimation(state);
   for(let i=0;i<90;i++){
    actor.group.position.set(i*.03,18,4);actor.update(1/60);actor.group.updateMatrixWorld(true);
    assert.equal(crown.parent,head);assert(crown.position.equals(localPosition)&&crown.scale.equals(localScale));
    const crownWorld=crown.getWorldPosition(new T.Vector3()),headWorld=head.getWorldPosition(new T.Vector3());
    assert(crownWorld.distanceTo(headWorld)<1,'Crown stays on head, away from feet');
    assert(crownWorld.y>actor.group.position.y+1,'Crown remains above torso');
   }
  }
 }
 console.log('Rei e rainha: coroa acompanha a cabeça parada, andando, correndo e sentada, preservando tamanho.');
}finally{await server.close();}
