import * as T from 'three';
import { buildingDoorIsOpenNear, cityDoorBuildings } from './ChurchDoors';
const point=new T.Vector3();
/** Use room roofs for the palace so its open courtyards remain outdoors. */
export function cityPointIsIndoors(building:T.Group,local:T.Vector3){
 const info=building.userData.building;
 if(!info?.enterable||local.y<-.5||local.y>info.height)return false;
 if(building.userData.palaceComplex)return (building.userData.weatherRoofs as number[][]??[]).some(b=>
   local.x>b[0]+.25&&local.x<b[3]-.25&&local.z>b[2]+.25&&local.z<b[5]-.25&&local.y<b[4]);
 return Math.abs(local.x)<info.width/2-.25&&Math.abs(local.z)<info.depth/2-.25;
}
export function cityLightBuilding(root:T.Object3D){
 for(let p=root.parent;p;p=p.parent)if(p.userData.building)return p as T.Group;
 return undefined;
}
export function cityLightContext(buildings:Set<T.Group>,viewer:T.Vector3){
 for(const building of cityDoorBuildings())buildings.add(building);
 const inverses=new Map<T.Group,T.Matrix4>();let inside:T.Group|undefined;
 for(const building of buildings){
  building.updateWorldMatrix(true,false);
  const inverse=building.matrixWorld.clone().invert();inverses.set(building,inverse);
  if(cityPointIsIndoors(building,point.copy(viewer).applyMatrix4(inverse)))inside=building;
 }
 const enabledAt=(building:T.Group|undefined,local:T.Vector3)=>{
  const interior=building&&cityPointIsIndoors(building,local);
  if(inside)return !!interior&&building===inside;
  return !interior||buildingDoorIsOpenNear(building!,viewer);
 };
 return {inside,enabledAt,enabled(root:T.Group,building?:T.Group){
  const local=point.setFromMatrixPosition(root.matrixWorld);
  if(building)local.applyMatrix4(inverses.get(building)!);
  return enabledAt(building,local);
 }};
}

/** Name labels never cross a building's interior/exterior boundary, even at an open door. */
export function cityNameVisibility(buildings:Iterable<T.Group>,viewer:T.Vector3){
 const interiors:Array<{building:T.Group;inverse:T.Matrix4}>=[];
 for(const building of buildings){
  if(!building.userData.building?.enterable)continue;
  building.updateWorldMatrix(true,false);
  interiors.push({building,inverse:building.matrixWorld.clone().invert()});
 }
 const local=new T.Vector3();
 const interiorAt=(position:T.Vector3)=>interiors.find(({building,inverse})=>cityPointIsIndoors(building,local.copy(position).applyMatrix4(inverse)))?.building;
 const viewerInterior=interiorAt(viewer);
 return (position:T.Vector3)=>interiorAt(position)===viewerInterior;
}
