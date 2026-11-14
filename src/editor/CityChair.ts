import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
/** Lightweight city chair, preserving the imported model dimensions and grounded pivot. */
export function createCityChair(){
 const parts:T.BufferGeometry[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);parts.push(g);};
 // Rear posts continue to the top of the backrest, without overlapping legs.
 for(const x of [-.19,.19]){
  box(x,.49,-.19,.05,.98,.05);
  box(x,.2175,.19,.05,.435,.05);
  box(x,.22,0,.03,.045,.36);
 }
 box(0,.455,0,.47,.04,.465);
 for(const y of [.67,.88])box(0,y,-.19,.33,.075,.045);
 box(0,.2,.19,.33,.045,.03);
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,CITY_WOOD_MATERIAL);mesh.castShadow=mesh.receiveShadow=true;const root=new T.Group();root.add(mesh);return root;
}
