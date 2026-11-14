import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from '../../src/editor/CityWood';
/** Comparison only: solid cube, raised square timber frames and one diagonal per face. */
export function createComparisonBox(){
 const parts:T.BufferGeometry[]=[];
 const core=new T.BoxGeometry(1,1,1);core.translate(0,.5,0);parts.push(core);
 for(const rotation of [[0,0,0],[0,Math.PI,0],[0,Math.PI/2,0],[0,-Math.PI/2,0],[-Math.PI/2,0,0],[Math.PI/2,0,0]]){
  const matrix=new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation as [number,number,number]));
  const board=(x:number,y:number,w:number,h:number,angle=0)=>{
   const geometry=new T.BoxGeometry(w,h,.055);geometry.rotateZ(angle);geometry.translate(x,y,.5275);geometry.applyMatrix4(matrix);geometry.translate(0,.5,0);parts.push(geometry);
  };
  // Entire frames sit OUTSIDE the cube; inner panels are the original cube faces.
  for(const x of [-.45,.45])board(x,0,.1,1);
  for(const y of [-.45,.45])board(0,y,.8,.1);
  // Ends meet the inside corners of the square frame, without crossing it.
  board(0,0,.8*Math.SQRT2-.085,.085,Math.PI/4);
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const root=new T.Group();
 const mesh=new T.Mesh(geometry,CITY_WOOD_MATERIAL);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
