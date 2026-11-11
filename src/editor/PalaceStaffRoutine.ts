import * as T from 'three';
import {PrincessPalaceRoutine,type PrincessPalaceLayout} from './PrincessPalaceRoutine';
import type {Citizen} from './CityPopulation';
export const isPalaceStaff=(role:string)=>role==='cozinheiro-real'||role==='empregada-real';
export function palaceStaffLayout(palace:T.Group):PrincessPalaceLayout{
 const original=palace.userData.princessPalace as PrincessPalaceLayout;
 const nodes={...original.nodes},edges=[...original.edges];
 const kitchen=palace.userData.royalKitchen,study=palace.userData.royalStudy,sitting=palace.userData.royalSittingRoom;
 const ground=kitchen.y;
 const kitchenDoorZ=palace.userData.royalRoomDoors.find((d:{label:string})=>d.label===kitchen.name).z;
 const sittingDoorZ=palace.userData.royalRoomDoors.find((d:{label:string})=>d.label===sitting.name).z;
 const studyDoorZ=palace.userData.royalRoomDoors.find((d:{label:string})=>d.label===study.name).z;
 nodes.kitchenPassage=[24,ground,kitchenDoorZ];nodes.kitchenDoor=[27,ground,kitchenDoorZ];nodes.kitchenLane=[35,ground,kitchenDoorZ];
 nodes.hallFront=[0,ground,kitchen.z+kitchen.depth/2-2.6];nodes.eastHallFront=[24,ground,kitchen.z+kitchen.depth/2-2.6];
 edges.push(['dining','hallFront'],['hallFront','eastHallFront'],['eastHallFront','kitchenPassage'],['kitchenPassage','kitchenDoor'],['kitchenDoor','kitchenLane']);
 for(let i=0;i<3;i++){
  const z=kitchen.z+(i-1)*12;nodes[`cookLane${i}`]=[35,ground,z];nodes[`cook${i}`]=[36,ground,z];
  edges.push(['kitchenLane',`cookLane${i}`],[`cookLane${i}`,`cook${i}`]);
 }
 nodes.eastFrontGallery=[24.1,sitting.y,sittingDoorZ];nodes.sittingDoor=[27,sitting.y,sittingDoorZ];nodes.sitting=[35,sitting.y,sittingDoorZ];
 edges.push(['gallery','eastFrontGallery'],['eastFrontGallery','sittingDoor'],['sittingDoor','sitting']);
 // Mirror the known traversable stair and gallery nodes into the west wing.
 for(const key of ['branch','stairBottom','stairTop','galleryBack','gallery','door','room']){
  const p=original.nodes[key];nodes[`west-${key}`]=[-p[0],p[1],p[2]];
 }
 nodes.westLanding=[-6,original.nodes.landing[1],original.nodes.landing[2]];
 edges.push(['landing','westLanding'],['westLanding','west-branch'],['west-branch','west-stairBottom'],['west-stairBottom','west-stairTop'],['west-stairTop','west-galleryBack'],['west-galleryBack','west-gallery'],['west-gallery','west-door'],['west-door','west-room']);
 nodes.westFrontGallery=[-24.1,study.y,studyDoorZ];nodes.studyDoor=[-27,study.y,studyDoorZ];nodes.study=[-35,study.y,studyDoorZ];
 edges.push(['west-gallery','westFrontGallery'],['westFrontGallery','studyDoor'],['studyDoor','study']);
 return {...original,nodes,edges};
}
export function palaceStaffActivity(time:number,citizen:Citizen){
  const hour=((time%1)+1)%1*24+1e-9;
  const cook=citizen.role==='cozinheiro-real';
  const tasks=cook?['cook0','cook1','cook2']:['room','sitting','study','west-room','gallery','dining'];
  const target=tasks[(Math.floor(hour/2)+citizen.post)%tasks.length];
  const label=cook?'preparando alimentos na cozinha':target==='room'||target==='west-room'?'limpando o quarto real':target==='study'?'limpando o escritório':target==='sitting'?'limpando a sala de estar':'limpando o palácio';
 return {target,label};
}
export class PalaceStaffRoutine{
 private movement=new PrincessPalaceRoutine();
 update(dt:number,time:number,palace:T.Group,position:T.Vector3,citizen:Citizen,height:(x:number,z:number,feet?:number)=>number,collide:(p:T.Vector3,r:number)=>void){
  const {target,label}=palaceStaffActivity(time,citizen);
  const result=this.movement.update(dt,time,palace,position,height,collide,palaceStaffLayout(palace),{target,label,sleep:false});
  return {walking:result?.walking??false,label:result?.walking?'indo ao próximo serviço':label};
 }
}
