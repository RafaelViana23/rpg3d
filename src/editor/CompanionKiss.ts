import * as T from 'three';
import type {ProceduralCharacter} from '../character';
/** A short, clothed greeting: approach, face one another, gently tilt heads, release. */
export class CompanionKiss{
 private scene:{player:ProceduralCharacter;companion:ProceduralCharacter;position:T.Vector3;heading:T.Vector3;elapsed:number;contact:number;heads:{bone:T.Object3D;rotation:T.Euler}[]}|null=null;
 get active(){return this.scene!==null;}
 start(player:ProceduralCharacter,companion:ProceduralCharacter,position:T.Vector3){
  if(this.active||player.group.position.distanceTo(companion.group.position)>3)return false;
  const heading=companion.group.position.clone().sub(player.group.position);heading.y=0;if(heading.lengthSq()<.001)heading.set(0,0,1);heading.normalize();
  player.setRestUndressed(false);companion.setRestUndressed(false);
  this.scene={player,companion,position,heading,elapsed:0,contact:0,heads:[player,companion].map(actor=>{const bone=actor.group.getObjectByName('Head')!;return {bone,rotation:bone.rotation.clone()};})};
  return true;
 }
 cancel(){if(this.scene)for(const {bone,rotation} of this.scene.heads)bone.rotation.copy(rotation);this.scene=null;}
 update(dt:number,height:(x:number,z:number,y?:number)=>number,collide:(p:T.Vector3,r:number)=>void){
  const s=this.scene;if(!s)return;
  s.elapsed+=dt;if(s.elapsed>6){this.cancel();return;}
  const target=s.player.group.position.clone().addScaledVector(s.heading,.52),before=s.position.clone();
  const delta=target.clone().sub(s.position);delta.y=0;
  if(delta.length()>.025){
   const step=Math.min(delta.length(),dt*1.35);s.position.addScaledVector(delta.normalize(),step);
   s.position.y=height(s.position.x,s.position.z,s.position.y);collide(s.position,.28);
   s.companion.group.position.copy(s.position);s.companion.setAnimation('walk');
  }else{s.contact+=dt;s.companion.setAnimation('idle');}
  s.player.setAnimation('idle');
  s.player.group.rotation.set(0,Math.atan2(s.heading.x,s.heading.z),0);
  s.companion.group.rotation.set(0,Math.atan2(-s.heading.x,-s.heading.z),0);
  s.companion.update(dt);
  const lean=Math.sin(Math.min(1,s.contact/1.6)*Math.PI);
  s.heads[0].bone.rotation.set(0,0,.16*lean);s.heads[1].bone.rotation.set(0,0,-.16*lean);
  s.player.group.updateMatrixWorld(true);s.companion.group.updateMatrixWorld(true);
  if(s.contact>=1.6||s.elapsed>2&&before.distanceTo(s.position)<.00001&&s.contact===0)this.cancel();
 }
}
