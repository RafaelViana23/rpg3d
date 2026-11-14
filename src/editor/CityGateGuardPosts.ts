import {Vector3,type Group} from 'three';

/** Two sentries behind the pillars, clear of the opening and inward-swinging leaves. */
export function cityGateGuardPost(gate:Group,post:number,buildings:Iterable<Group>){
  const objects=[...buildings],towers=objects.filter(o=>o.name==='Cidade:tower'&&o.parent);
  const homes=objects.filter(o=>o.name==='Cidade:house'&&o.parent);
  const anchors=towers.length?towers:homes;
  const center=new Vector3();for(const o of anchors)center.add(o.getWorldPosition(new Vector3()));
  if(anchors.length)center.divideScalar(anchors.length);
  gate.updateWorldMatrix(true,false);
  const local=gate.worldToLocal(center.clone()),inside=local.z>=0?1:-1;
  const position=new Vector3(post%2?4.2:-4.2,0,inside*5).applyMatrix4(gate.matrixWorld);
  const heights=homes.map(o=>o.getWorldPosition(new Vector3()).y).sort((a,b)=>a-b);
  position.y=(heights.length?heights[Math.floor(heights.length/2)]:gate.getWorldPosition(new Vector3()).y)+.08;
  const outward=new Vector3(0,0,-inside).transformDirection(gate.matrixWorld);
  return {position,angle:Math.atan2(outward.x,outward.z)};
}
