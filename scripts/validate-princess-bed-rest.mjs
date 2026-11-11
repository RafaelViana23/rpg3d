import assert from 'node:assert/strict';
import {createServer} from 'vite';
const s=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {PrincessBedRest}=await s.ssrLoadModule('/src/editor/PrincessBedRest.ts');
 const {CitySleeping,cityBedSide}=await s.ssrLoadModule('/src/editor/CitySleeping.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await s.ssrLoadModule('/src/character.ts');
 const {createRoyalPalace}=await s.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {Scene,Matrix4,Vector3,Box3}=await s.ssrLoadModule('three');
 const scene=new Scene(),palace=createRoyalPalace();palace.position.set(12,18,-7);palace.rotation.y=.43;scene.add(palace);palace.updateMatrixWorld(true);
 const matrix=new Matrix4().fromArray(palace.userData.princessBed.matrix),center=new Vector3().setFromMatrixPosition(matrix);
 const player=new ProceduralCharacter(DEFAULT_CONFIG),alice=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});scene.add(player.group,alice.group);
 player.group.position.copy(palace.localToWorld(center.clone().add(new Vector3(3,0,0))));player.group.rotation.y=.6;
 const original=player.group.position.clone(),quaternion=player.group.quaternion.clone(),scale=player.group.scale.clone();
 const rest=new PrincessBedRest();assert(rest.nearest(player.group.position,[palace]));assert(!rest.nearest(player.group.position.clone().add(new Vector3(0,-10,0)),[palace]));
 assert(rest.toggle(player.group,[palace]));assert(rest.active);
 alice.setAnimation('idle');alice.update(0);new CitySleeping().place(alice.group,palace,cityBedSide(palace.userData.princessBed,1));
 rest.update(player.group);scene.updateMatrixWorld(true);
 const bounds=body=>{const b=new Box3();body.traverseVisible(o=>{if(o.isMesh)b.union(new Box3().setFromObject(o,true));});return b;};
 assert(!bounds(player.group).expandByScalar(-.01).intersectsBox(bounds(alice.group)),'Player and Alice occupy separate mattress halves');
 const up=new Vector3(0,1,0).applyQuaternion(player.group.quaternion);assert(Math.abs(up.y)<.01,'Player is lying down');
 assert(rest.toggle(player.group,[palace]));assert(!rest.active);assert(player.group.position.distanceTo(original)<1e-8);assert(player.group.quaternion.angleTo(quaternion)<1e-6);assert(player.group.scale.distanceTo(scale)<1e-8);
 for(const heading of [-2.8,-2.2,2.2,2.8]){
  player.group.rotation.set(0,heading,0);
  assert(rest.toggle(player.group,[palace]));assert(rest.toggle(player.group,[palace]));
  assert(Math.abs(player.group.rotation.x)<1e-8&&Math.abs(player.group.rotation.z)<1e-8,'Standing restores upright Euler axes');
  player.group.rotation.y=.4;
  const facing=new Vector3(0,0,1).applyQuaternion(player.group.quaternion);
  assert(facing.dot(new Vector3(Math.sin(.4),0,Math.cos(.4)))>.999999,'Walking after bed rest faces the movement direction');
 }
 console.log('E deita no lado livre da cama de Alice, sem sobreposição; levantar restaura posição, rotação e escala.');
}finally{await s.close();}
