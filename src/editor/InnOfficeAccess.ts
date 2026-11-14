import * as T from 'three';

/** NPC-only exclusion: the innkeeper can work here; passers-by cannot enter. */
export function innOfficeAccess(buildings:Iterable<T.Group>){
 const offices=[...buildings].filter(b=>b.userData.innArchitecture&&b.userData.innOffice).map(building=>{
  building.updateWorldMatrix(true,false);
  return {building,inverse:building.matrixWorld.clone().invert(),scale:building.getWorldScale(new T.Vector3())};
 });
 const local=new T.Vector3();
 return (position:T.Vector3,radius:number)=>{
  for(const {building,inverse,scale} of offices){
   local.copy(position).applyMatrix4(inverse);
   if(local.y<-.5||local.y>4.8)continue;
   const rx=radius/Math.abs(scale.x),rz=radius/Math.abs(scale.z);
   const left=3-rx,right=16.3+rx,back=-11.8-rz,front=-3+rz;
   if(local.x<=left||local.x>=right||local.z<=back||local.z>=front)continue;
   const distances=[local.x-left,right-local.x,local.z-back,front-local.z];
   switch(distances.indexOf(Math.min(...distances))){case 0:local.x=left-.01;break;case 1:local.x=right+.01;break;case 2:local.z=back-.01;break;default:local.z=front+.01;}
   position.copy(local.applyMatrix4(building.matrixWorld));return true;
  }
  return false;
 };
}
