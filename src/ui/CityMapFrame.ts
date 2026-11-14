import type {Group,Vector2} from 'three';
import {cityMapFootprint} from './CityMapFootprint';
/** Frame the edited city, including rotated/scaled footprints and the perimeter. */
export function cityMapFrame(objects:Iterable<Group>,polygon:Vector2[]|undefined,width:number,height:number){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const include=(x:number,z:number)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);};
  for(const p of polygon??[])include(p.x,p.y);
  for(const object of objects){
    if(!object.parent)continue;
    for(const p of cityMapFootprint(object).corners)include(p.x,p.z);
  }
  if(!Number.isFinite(minX))return {centerX:0,centerZ:0,visibleSize:512};
  return {centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,visibleSize:Math.max((maxX-minX)*Math.min(width,height)/width,(maxZ-minZ)*Math.min(width,height)/height,64)/.88};
}
