import * as T from 'three';
import {PrincessPalaceRoutine,type PrincessPalaceLayout} from './PrincessPalaceRoutine';
import {palaceStaffLayout} from './PalaceStaffRoutine';
import {cityBedSide} from './CitySleeping';

export function royalCoupleActivity(time:number){
 const hour=((time%1)+1)%1*24+1e-9;
 return hour<6?{target:'royalBed',label:'dormindo',sleep:true}:{target:'royalThrone',label:'sentado no trono',sleep:false};
}
export function royalCoupleLayout(palace:T.Group,role:'rei'|'rainha'):PrincessPalaceLayout{
 const original=palaceStaffLayout(palace),nodes={...original.nodes},edges=[...original.edges];
 const index=role==='rei'?0:1;
 nodes.royalThrone=[...palace.userData.npcRoyalPositions[index]] as [number,number,number];
 nodes.royalThrone[2]+=.95; // Standing point in front of the chair, clear of its solid seat.
 nodes.royalDaisFront=[nodes.royalThrone[0],nodes.daisFront[1],nodes.daisFront[2]];
 nodes.royalBed=[-38,nodes.bed[1],nodes.bed[2]];
 edges.push(['royalThrone','royalDaisFront'],['royalDaisFront','westLanding'],['west-room','royalBed']);
 const bedMatrix=new T.Matrix4().fromArray(original.bed.matrix);
 bedMatrix.elements[12]=-bedMatrix.elements[12];
 const bed=cityBedSide({...original.bed,matrix:bedMatrix.toArray()},index===0?-1:1);
 return {...original,room:palace.userData.kingBedroom,nodes,edges,bed};
}
export class RoyalCoupleRoutine{
 private movement=new PrincessPalaceRoutine();
 update(dt:number,time:number,palace:T.Group,position:T.Vector3,role:'rei'|'rainha',height:(x:number,z:number,feet?:number)=>number,collide:(p:T.Vector3,r:number)=>void){
  const activity=royalCoupleActivity(time);
  const result=this.movement.update(dt,time,palace,position,height,collide,royalCoupleLayout(palace,role),activity)!;
  return {...result,seated:!activity.sleep&&!result.walking&&result.label===activity.label};
 }
}
