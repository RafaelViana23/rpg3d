import * as T from 'three';

/** Reserve the actual model bounds, including rotation, before attaching a prop. */
export function fitStorageWithoutOverlap(owner:T.Group,prop:T.Group,buildings?:T.Group[],placementArea?:T.Box2){
  owner.updateWorldMatrix(true,false);
  const neighbors=buildings??(owner.parent?.children.filter(o=>o.userData.building) as T.Group[]|undefined)??[owner];
  const obstacles:T.Box3[]=[];
  const ownerInverse=owner.matrixWorld.clone().invert();
  for(const building of neighbors){
    building.updateWorldMatrix(true,false);
    for(const b of building.userData.localColliders??[])obstacles.push(new T.Box3(new T.Vector3(...b.slice(0,3) as [number,number,number]),new T.Vector3(...b.slice(3) as [number,number,number])).applyMatrix4(ownerInverse.clone().multiply(building.matrixWorld)));
  }
  const origin=prop.position.clone();
  const offsets=[[0,0]];
  // Elevated props must remain over their supporting object; don't move them sideways.
  if(origin.y<.3)for(const radius of [.5,1,1.5,2])for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]])offsets.push([x*radius,z*radius]);
  if(placementArea)for(let radius=.25;radius<=4;radius+=.25)for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]])offsets.push([x*radius,z*radius]);
  for(const [x,z] of offsets){
    prop.position.copy(origin).add(new T.Vector3(x,0,z));prop.updateMatrixWorld(true);
    const localBounds=new T.Box3().setFromObject(prop);
    if(placementArea&&(!placementArea.containsPoint(new T.Vector2(localBounds.min.x,localBounds.min.z))||!placementArea.containsPoint(new T.Vector2(localBounds.max.x,localBounds.max.z))))continue;
    const bounds=localBounds;
    // Allow faces to touch when stacking, but never overlap volumes.
    const inset=bounds.clone().expandByScalar(-.015);
    if(obstacles.some(other=>inset.intersectsBox(other)))continue;
    const info=owner.userData.building;
    if(info&&Math.abs(prop.position.x)<info.doorWidth/2+1.2&&prop.position.z>info.depth/2&&prop.position.z<info.depth/2+3)continue;
    return true;
  }
  prop.position.copy(origin);return false;
}
