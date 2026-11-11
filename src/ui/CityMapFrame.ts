import { Vector3, type Group, type Vector2 } from 'three';
/** Frame the edited city, including rotated/scaled footprints and the perimeter. */
export function cityMapFrame(objects:Iterable<Group>,polygon:Vector2[]|undefined,width:number,height:number){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const include=(x:number,z:number)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);};
  for(const p of polygon??[])include(p.x,p.y);
  const p=new Vector3();
  for(const object of objects){
    if(!object.parent)continue;
    object.updateWorldMatrix(true,false);
    const b=object.userData.building,kind=object.name.slice(7);
    const w=b?.width??object.userData.perimeterFootprint?.[0]??(kind==='wall'?12:kind==='tower'?8:0);
    const d=b?.depth??object.userData.perimeterFootprint?.[1]??(kind==='wall'?2.65:kind==='tower'?8:0);
    if(!w&&!d)continue;
    for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){p.set(x,0,z).applyMatrix4(object.matrixWorld);include(p.x,p.z);}
  }
  if(!Number.isFinite(minX))return {centerX:0,centerZ:0,visibleSize:512};
  return {centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,visibleSize:Math.max((maxX-minX)*Math.min(width,height)/width,(maxZ-minZ)*Math.min(width,height)/height,64)/.88};
}
