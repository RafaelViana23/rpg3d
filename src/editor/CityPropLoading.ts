import {Vector3,type Group} from 'three';
import {cityInteriorDemand} from './CityInteriorStreaming';
import {cityPointIsIndoors,cityLightContext} from './CityLightInteriors';
type Pending={owner:Group;resolve:()=>void;lightPosition?:Vector3;interiorPhase?:'prepare'|'activate'};
const pending:Pending[]=[];
let nextSortAt=0;
const lastSortPosition=new Vector3(Infinity,Infinity,Infinity);
/** Model downloads may finish together; admit a small nearby batch per frame. */
export function waitForCityPropSlot(owner:Group){
  return new Promise<void>(resolve=>pending.push({owner,resolve}));
}
/** Do not fetch or instantiate interior fixtures until their room is activated. */
export function waitForCityLightSlot(owner:Group,position:Vector3){
  return new Promise<void>(resolve=>pending.push({owner,resolve,lightPosition:position.clone()}));
}
/** Gate downloads by approach, and instantiation by an opened/occupied room. */
export function waitForCityInteriorSlot(owner:Group,position:Vector3,prepare=false){
  if(!cityPointIsIndoors(owner,position))return waitForCityPropSlot(owner);
  return new Promise<void>(resolve=>pending.push({owner,resolve,interiorPhase:prepare?'prepare':'activate'}));
}
export function loadCityInteriorProp(owner:Group,position:Vector3,load:()=>Promise<Group>){
  return waitForCityInteriorSlot(owner,position,true).then(load).then(async template=>{
    await waitForCityInteriorSlot(owner,position);return template;
  });
}
export function updateCityPropLoading(viewer:Vector3,regional=false){
  if(!pending.length)return;
  const buildings=new Set(pending.filter(job=>job.lightPosition).map(job=>job.owner));
  const context=cityLightContext(buildings,viewer);
  // Admission still runs every frame. Priority only needs refreshing when the
  // viewer moves or occasionally as newly downloaded jobs join the queue.
  const now=performance.now();
  if(now>=nextSortAt||lastSortPosition.distanceToSquared(viewer)>4){
    pending.sort((a,b)=>a.owner.position.distanceToSquared(viewer)-b.owner.position.distanceToSquared(viewer));
    lastSortPosition.copy(viewer);nextSortAt=now+250;
  }
  let budget=2;
  for(let i=0;i<pending.length&&budget>0;){
    const job=pending[i];
    if(!job.owner.parent){pending.splice(i,1);continue;}
    if(regional){
      const info=job.owner.userData.building;
      const extent=info?Math.hypot(info.width*job.owner.scale.x,info.depth*job.owner.scale.z)/2:0;
      if(Math.hypot(job.owner.position.x-viewer.x,job.owner.position.z-viewer.z)>120+extent){i++;continue;}
    }
    if(job.interiorPhase&&!cityInteriorDemand(job.owner)[job.interiorPhase==='prepare'?'prepare':'active']){i++;continue;}
    if(job.lightPosition&&!context.enabledAt(job.owner,job.lightPosition)){i++;continue;}
    pending.splice(i,1);budget--;job.resolve();
  }
}
