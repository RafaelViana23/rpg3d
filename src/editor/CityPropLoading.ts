import type { Group, Vector3 } from 'three';
type Pending={owner:Group;resolve:()=>void};
const pending:Pending[]=[];
/** Model downloads may finish together; admit a small nearby batch per frame. */
export function waitForCityPropSlot(owner:Group){
  return new Promise<void>(resolve=>pending.push({owner,resolve}));
}
export function updateCityPropLoading(viewer:Vector3){
  if(!pending.length)return;
  pending.sort((a,b)=>a.owner.position.distanceToSquared(viewer)-b.owner.position.distanceToSquared(viewer));
  for(const job of pending.splice(0,8))job.resolve();
}
