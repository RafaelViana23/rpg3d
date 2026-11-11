import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/editor/ChurchDoors';export {createRoyalPalace} from './src/editor/RoyalPalace';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,createRoyalPalace,registerChurchDoor,churchDoorPrompt,toggleChurchDoor,updateChurchDoors}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const scene=new T.Scene(),palace=createRoyalPalace(),door=new T.Group(),leaf=new T.Group();leaf.name='leaf';door.add(leaf);door.animations=[new T.AnimationClip('open',1.1,[new T.NumberKeyframeTrack('leaf.rotation[y]',[0,1.1],[0,Math.PI/2])])];scene.add(palace);palace.add(door);
const opening=palace.userData.royalGate;registerChurchDoor(palace,door,opening);const position=new T.Vector3(0,opening.y+.2,opening.z+1),count=palace.userData.localColliders.length;
assert.equal(churchDoorPrompt(position),'Abrir portão do palácio');
assert.equal(churchDoorPrompt(new T.Vector3(0,0,77)),null,'No interaction from stair foot');
for(let i=0;i<3;i++){
 assert(toggleChurchDoor(position));updateChurchDoors(1.2);assert.equal(churchDoorPrompt(position),'Fechar portão do palácio');assert.equal(palace.userData.localColliders.length,count-1);assert(Math.abs(leaf.rotation.y-Math.PI/2)<.01);
 assert(toggleChurchDoor(position));updateChurchDoors(1.2);assert.equal(palace.userData.localColliders.length,count);assert(Math.abs(leaf.rotation.y)<.01);
}
assert(Math.abs(opening.width/opening.height-2.39/3.14)<1e-6,'Church oval proportions preserved');
console.log('Raised oval palace door: proximity prompt, repeated open/close animation and blocking collider validated.');

for(const roomOpening of palace.userData.royalRoomDoors){
 const roomDoor=new T.Group(),roomLeaf=new T.Group();roomLeaf.name='roomLeaf';roomDoor.add(roomLeaf);
 roomDoor.animations=[new T.AnimationClip('open',1.1,[new T.NumberKeyframeTrack('roomLeaf.rotation[y]',[0,1.1],[0,Math.PI/2])])];
 palace.add(roomDoor);registerChurchDoor(palace,roomDoor,roomOpening);
 const nearby=new T.Vector3(roomOpening.x-1,roomOpening.y+.2,roomOpening.z);
 assert.equal(churchDoorPrompt(nearby),'Abrir '+roomOpening.label);
 const blocker=palace.userData.localColliders.at(-1);
 assert(Math.abs(blocker[3]-blocker[0]-.7)<1e-6,'Side door collider is thin on X');
 assert(Math.abs(blocker[5]-blocker[2]-roomOpening.width)<1e-6,'Side door collider spans the Z opening');
 assert(toggleChurchDoor(nearby));updateChurchDoors(1.2);
 assert(!palace.userData.localColliders.includes(blocker),'Open side door permits bedroom access');
 assert(toggleChurchDoor(nearby));updateChurchDoors(1.2);
 assert(palace.userData.localColliders.includes(blocker),'Closed side door blocks bedroom access');
}
console.log('Both lateral bedroom doors have correctly oriented colliders and repeated opening/closing.');
