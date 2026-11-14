import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
/** Lightweight house window; centered in X/Z and grounded in Y like imported prop templates. */
export function createCityWindow(){
 const parts:T.BufferGeometry[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d).toNonIndexed();g.translate(x,y,z);parts.push(g);};
 for(const x of [-.363,.363])box(x,.419,-.0375,.062,.838,.075);
 for(const y of [.031,.807])box(0,y,-.0375,.664,.062,.075);
 const bar=new T.CylinderGeometry(.022,.022,.714,6).toNonIndexed();bar.translate(0,.419,-.03);parts.push(bar);
 box(0,.419,-.025,.084,.1,.05);
 const geometry=mergeGeometries(parts)!;geometry.translate(0,0,.0375);parts.forEach(g=>g.dispose());const root=new T.Group();const mesh=new T.Mesh(geometry,CITY_WOOD_MATERIAL);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
