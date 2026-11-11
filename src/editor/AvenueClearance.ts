import * as T from 'three';
import type {LowPolyCityBuilder} from './LowPolyCityBuilder';
import type {SavedCityObject} from './WorldEditorSupport';
import type {MedievalCityFloor} from '../world/MedievalCityFloor';
type Point={x:number;z:number};
function intersects(a:Point[],b:Point[]){
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],x=q.z-p.z,z=p.x-q.x;
  const pa=a.map(v=>v.x*x+v.z*z),pb=b.map(v=>v.x*x+v.z*z);
  if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;
 }
 return true;
}
function circleIntersects(poly:Point[],cx:number,cz:number,r:number){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];
  if((a.z>cz)!==(b.z>cz)&&cx<(b.x-a.x)*(cz-a.z)/(b.z-a.z)+a.x)inside=!inside;
  const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?T.MathUtils.clamp(((cx-a.x)*dx+(cz-a.z)*dz)/len,0,1):0;
  if(Math.hypot(cx-a.x-dx*t,cz-a.z-dz*t)<r)return true;
 }
 return inside;
}
export function footprintBlocksAvenue(avenue:T.Object3D,polygon:Point[],clearance=1){
 const areas=avenue.userData.royalAvenueAreas as number[][]??[];
 if(areas.some(([x0,z0,x1,z1])=>intersects(polygon,[{x:x0-clearance,z:z0-clearance},{x:x1+clearance,z:z0-clearance},{x:x1+clearance,z:z1+clearance},{x:x0-clearance,z:z1+clearance}])))return true;
 const c=avenue.userData.royalAvenueCircle;
 return !!c&&circleIntersects(polygon,c.x,c.z,c.radius+clearance);
}
/** Test the complete roof/house footprint, never just its centre, against every avenue branch. */
export function avenueBuildingFootprint(object:T.Object3D,avenue:T.Object3D,padding=0){
 object.updateWorldMatrix(true,true);avenue.updateWorldMatrix(true,false);
 const inverse=object.matrixWorld.clone().invert(),bounds=new T.Box3();
 object.traverse(child=>{const mesh=child as T.Mesh;if(!mesh.isMesh)return;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();if(mesh.geometry.boundingBox)bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));});
 if(bounds.isEmpty())return [];
 const transform=avenue.matrixWorld.clone().invert().multiply(object.matrixWorld);
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new T.Vector3(x<0?bounds.min.x-padding:bounds.max.x+padding,0,z<0?bounds.min.z-padding:bounds.max.z+padding).applyMatrix4(transform));
}
/** Repair old saved houses after every previous street migration, preserving IDs and owners. */
export function clearAvenueHouses(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder,floor:MedievalCityFloor){
 const entry=saved['city-royal-avenue-v1'],avenue=builder.objects.get('city-royal-avenue-v1');
 if(!entry||!avenue||entry.avenueClearanceRevision===1)return false;
 const structures=[...builder.objects.entries()].filter(([id,o])=>saved[id]?.kind==='house'||!!o.userData.building);
 const footprints=new Map(structures.map(([id,o])=>[id,avenueBuildingFootprint(o,avenue,.6)]));
 const blocked=structures.filter(([id])=>saved[id]?.kind==='house'&&footprintBlocksAvenue(avenue,footprints.get(id)!));
 let changed=false,unresolved=false;
 for(const [id,house]of blocked){
  const polygon=footprints.get(id)!;if(!polygon.length)continue;
  const offsets:{x:number;z:number;distance:number}[]=[];
  for(let x=-120;x<=120;x+=3)for(let z=-120;z<=120;z+=3)if(x||z)offsets.push({x,z,distance:x*x+z*z});
  offsets.sort((a,b)=>a.distance-b.distance);
  const candidate=offsets.find(({x,z})=>{
   const poly=polygon.map(p=>({x:p.x+x,z:p.z+z}));
   if(footprintBlocksAvenue(avenue,poly))return false;
   if([...footprints].some(([other,p])=>other!==id&&p.length&&intersects(poly,p)))return false;
   return poly.every(p=>{const world=avenue.localToWorld(new T.Vector3(p.x,0,p.z));return floor.heightAt(world.x,world.z)!==null;});
  });
  if(!candidate){unresolved=true;console.warn(`Sem lote livre fora da avenida para ${id}`);continue;}
  const world=house.getWorldPosition(new T.Vector3()),local=avenue.worldToLocal(world.clone());local.x+=candidate.x;local.z+=candidate.z;
  const destination=avenue.localToWorld(local);destination.y=world.y;
  house.position.copy(house.parent?house.parent.worldToLocal(destination):destination);house.updateWorldMatrix(true,true);
  saved[id].position=house.position.toArray();footprints.set(id,polygon.map(p=>new T.Vector3(p.x+candidate.x,0,p.z+candidate.z)));changed=true;
 }
 if(!unresolved){entry.avenueClearanceRevision=1;changed=true;}
 return changed;
}
