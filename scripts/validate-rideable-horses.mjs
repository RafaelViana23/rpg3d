import assert from 'node:assert/strict';import {open,readFile} from 'node:fs/promises';import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/player/RideableHorses';export * as T from 'three';export {clone} from 'three/addons/utils/SkeletonUtils.js';export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,clone,GLTFLoader,updateHorseLook,resetHorseLook,horseInteractionDistanceTo,resolveHorseCollision,rideableHorses,registerRideableHorse,nearestRideableHorse,updateRideableHorses}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
// Check the actual asset metadata without decoding its large embedded textures.
const file=await open('public/models/animals/horse/model.glb','r'),header=Buffer.alloc(20);await file.read(header,0,20,0);
const json=Buffer.alloc(header.readUInt32LE(12));await file.read(json,0,json.length,20);await file.close();const gltfJson=JSON.parse(json.toString());
for(const name of ['Object_16','Object_21','Head_024'])assert(gltfJson.nodes.some(n=>n.name===name),`Original horse node ${name}`);
// A small rig exercises independent action playback and mounting transforms.
const model=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.8,1.5,2.2),new T.MeshBasicMaterial());body.name='Body';body.position.y=1;model.add(body);
const saddle=new T.Mesh(new T.BoxGeometry(.6,.2,.8),new T.MeshBasicMaterial());saddle.name='Object_16';saddle.position.y=1.8;model.add(saddle);
const rein=new T.Mesh(new T.BoxGeometry(.02,.02,2),new T.MeshBasicMaterial());rein.name='Object_21';model.add(rein);
for(const name of ['Neck001_023','Head_024','EarL_025','EarR_026']){const bone=new T.Bone();bone.name=name;model.add(bone);}
const asset={scene:model,animations:gltfJson.animations.map(a=>new T.AnimationClip(a.name,1,[new T.NumberKeyframeTrack('Body.position[y]',[0,.5,1],[1,1.02,1])]))};
const scene=new T.Scene(),stable=new T.Group();stable.position.set(-48,4,203.7);stable.rotation.y=.4;scene.add(stable);
const horses=[];
for(const x of [-4,0,4]){
  const root=new T.Group(),model=clone(asset.scene);root.add(model);model.updateMatrixWorld(true);model.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.update();});
  const box=new T.Box3().setFromObject(model,true),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());model.position.sub(new T.Vector3(center.x,box.min.y,center.z));root.scale.setScalar(2.68/size.y);root.position.set(x,.08,-.6);root.animations=asset.animations;stable.add(root);
  const state=registerRideableHorse(root,asset.animations);horses.push(state);
  assert.equal(root.getObjectByName('Object_21').visible,false,'Hide the actual loose rein mesh');
  assert.equal(state.actions.size,7,'Idle, walking, running and all four turns');assert(root.getObjectByName('Object_16'),'Keep the original saddle');
  assert.equal(registerRideableHorse(root),state,'One mixer per horse');
}
assert.equal(rideableHorses.size,3);assert.notEqual(horses[0].mixer,horses[1].mixer);assert.notEqual(horses[0].root.getObjectByName('Head_024'),horses[1].root.getObjectByName('Head_024'));
for(const state of horses){const position=state.root.getWorldPosition(new T.Vector3());assert.equal(nearestRideableHorse(position).state,state,'Each horse can be selected independently');}
// Approaching the rear must use the body footprint rather than saddle distance.
const rear=horses[1].root.localToWorld(new T.Vector3(0,.1,2.4));
assert(nearestRideableHorse(rear).distance<=2.35,'Show E when approaching the horse from behind');
const above=rear.clone();above.y+=20;
assert.equal(nearestRideableHorse(above).state,undefined,'Do not mount through a floor from above');
const viewer=stable.getWorldPosition(new T.Vector3());updateRideableHorses(.2,viewer);assert(horses.every(h=>h.current.time>0),'All horses animate while waiting');
const active=horses[1];active.current.stop();active.current=active.actions.get('run');active.current.play();active.motion='run';updateRideableHorses(.25,viewer);assert(active.current.time>.2);assert(horses[0].current.isRunning(),'Other horses keep their idle animation');
const saddlePosition=active.anchor.getWorldPosition(new T.Vector3());scene.attach(active.root);assert(active.anchor.getWorldPosition(new T.Vector3()).distanceTo(saddlePosition)<1e-6,'Mounting preserves the world saddle position');
active.root.position.x+=4;assert(active.anchor.getWorldPosition(new T.Vector3()).distanceTo(saddlePosition)>3.9,'Saddle follows the ridden horse');
stable.remove(horses[2].root);updateRideableHorses(.1,viewer);assert(!rideableHorses.has(horses[2].root),'Removed horses leave the registry');
console.log('Original horse asset metadata and runtime: no loose reins, three independently mountable horses, original saddle, seven motions, idle animation and preserved mounting transforms validated.');

// Exercise the real skinned asset after normalization and world placement.
// Textures do not affect the rig; avoid browser image APIs in this Node test.
const bytes=await readFile('public/models/animals/horse/model.glb');
const loader=new GLTFLoader();loader.register(()=>({name:'TEST_TEXTURES',loadTexture:async()=>new T.Texture()}));
const real=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const skin=clone(real.scene),realHorse=new T.Group();realHorse.add(skin);skin.updateMatrixWorld(true);
skin.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.update();if(o.name==='Object_21')o.visible=false;});
const originalBounds=new T.Box3().setFromObject(skin,true),dimensions=originalBounds.getSize(new T.Vector3()),midpoint=originalBounds.getCenter(new T.Vector3());
skin.position.sub(new T.Vector3(midpoint.x,originalBounds.min.y,midpoint.z));realHorse.scale.setScalar(2.68/dimensions.y);realHorse.position.set(-4,.08,-.6);stable.add(realHorse);
const actual=registerRideableHorse(realHorse,real.animations),feet=realHorse.getWorldPosition(new T.Vector3());
assert(horseInteractionDistanceTo(actual,feet)<.1,'Real skin interaction follows horse, not stale skeleton coordinates');
const actualBounds=actual.bounds.clone().applyMatrix4(realHorse.matrixWorld);
assert(Math.abs(actualBounds.min.y-feet.y)<.01,'Real collision sits on the ground');
assert(Math.abs(actualBounds.getSize(new T.Vector3()).y-2.68)<.01,'Real collision matches normalized model height');
const saddleHeight=actual.anchor.getWorldPosition(new T.Vector3()).y-feet.y;
assert(saddleHeight>1&&saddleHeight<2.68,'Real saddle stays on the visible horse');
const inside=actualBounds.getCenter(new T.Vector3());inside.y=feet.y;
const beforeCollision=inside.clone();resolveHorseCollision(actual,inside,.32);
assert(inside.distanceTo(beforeCollision)>.3,'Real horse blocks walking');
console.log('Real GLB: synchronized skin bounds, ground height, saddle, interaction and collision validated after world placement.');

const head=realHorse.getObjectByName('Head_024'),rest=head.quaternion.clone();
for(let i=0;i<240;i++)updateHorseLook(actual,1,1/60);
assert(Math.abs(rest.angleTo(head.quaternion)-.4)<.001,'Camera pitch is limited to a natural head angle');
for(let i=0;i<240;i++)updateHorseLook(actual,-1,1/60);
assert(Math.abs(rest.angleTo(head.quaternion)-.4)<.001,'Repeated frames do not accumulate head rotation');
resetHorseLook(actual);assert(rest.toArray().every((v,i)=>Math.abs(v-head.quaternion.toArray()[i])<1e-6),'Dismount restores the original head animation');
console.log('Camera head look: bounded pitch, no accumulated rotation and reset validated on actual horse rig.');

for(const yaw of [-.3,.3]){
  for(let i=0;i<240;i++)updateHorseLook(actual,0,1/60,yaw);
  assert(Math.abs(actual.look.yaw-yaw)<.001,'Head follows camera left and right');
  assert(Math.abs(rest.angleTo(head.quaternion)-.3)<.001,'Lateral look reaches the head bone');
}
resetHorseLook(actual);
console.log('Lateral camera head look validated in both directions.');
