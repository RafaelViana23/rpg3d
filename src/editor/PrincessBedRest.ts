import * as T from 'three';
import {CitySleeping,cityBedSide,type CityBedAnchor} from './CitySleeping';
/** Reversible rest on the free half of Alice's actual double mattress. */
export class PrincessBedRest{
 private sleeping=new CitySleeping();
 private resting:{home:T.Group;bed:CityBedAnchor;position:T.Vector3;rotation:T.Euler}|null=null;
 refreshFit(body:T.Group){this.sleeping.restore(body);this.update(body);}
 get home(){return this.resting?.home??null;}
 get active(){return this.resting!==null;}
 nearest(position:T.Vector3,homes:Iterable<T.Group>){
  let nearest:{home:T.Group;bed:CityBedAnchor;distance:number}|undefined;
  for(const home of homes){
   const bed=home.userData.princessBed as CityBedAnchor|undefined;if(!bed)continue;
   home.updateWorldMatrix(true,false);
   const matrix=new T.Matrix4().multiplyMatrices(home.matrixWorld,new T.Matrix4().fromArray(bed.matrix));
   const local=position.clone().applyMatrix4(matrix.clone().invert());
   const distance=Math.hypot(Math.max(0,Math.abs(local.x)-bed.length/2),Math.max(0,Math.abs(local.z)-bed.width/2));
   if(Math.abs(local.y)<2.5&&distance<2&&(!nearest||distance<nearest.distance))nearest={home,bed,distance};
  }
  return nearest;
 }
 toggle(body:T.Group,homes:Iterable<T.Group>){
  if(this.resting){const saved=this.resting;this.sleeping.restore(body);body.position.copy(saved.position);body.rotation.copy(saved.rotation);this.resting=null;return true;}
  const target=this.nearest(body.position,homes);if(!target)return false;
  this.resting={...target,bed:cityBedSide(target.bed,-1),position:body.position.clone(),rotation:body.rotation.clone()};
  this.update(body);return true;
 }
 update(body:T.Group){if(this.resting)this.sleeping.place(body,this.resting.home,this.resting.bed);}
}
