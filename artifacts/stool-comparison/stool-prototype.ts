import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from '../../src/editor/CityWood';
/** Isolated three-legged stool prototype; not installed in the city. */
export function createComparisonStool(){
 const parts:T.BufferGeometry[]=[];
 const seat=new T.CylinderGeometry(.18,.18,.04,8);seat.translate(0,.37,0);parts.push(seat);
 for(let i=0;i<3;i++){
  const angle=Math.PI*2/3+i*Math.PI*2/3;
  const bottom=new T.Vector3(Math.cos(angle)*.13,.018,Math.sin(angle)*.13),top=new T.Vector3(Math.cos(angle)*.095,.355,Math.sin(angle)*.095);
  const leg=new T.BoxGeometry(.045,bottom.distanceTo(top),.045);
  leg.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),top.clone().sub(bottom).normalize()));leg.translate(...bottom.add(top).multiplyScalar(.5).toArray());parts.push(leg);
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();
 const bounds=geometry.boundingBox!,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(.358161449/size.x,.39/size.y,.354146063/size.z);
 const mesh=new T.Mesh(geometry,CITY_WOOD_MATERIAL);mesh.castShadow=mesh.receiveShadow=true;const root=new T.Group();root.add(mesh);return root;
}
