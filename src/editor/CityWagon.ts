import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
import {IRON_ARMOR_COLOR,IRON_METALNESS,IRON_ROUGHNESS} from '../inventory/armorMaterials';
const ironMaterial=new T.MeshStandardMaterial({color:IRON_ARMOR_COLOR,metalness:IRON_METALNESS,roughness:IRON_ROUGHNESS});
export function createCityWagon(){
 const wood:T.BufferGeometry[]=[],iron:T.BufferGeometry[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,angle=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateZ(angle);g.translate(x,y,z);wood.push(g);};
 for(let i=0;i<7;i++)box(0,.85,(i-3)*.19,2.8,.12,.185);
 for(const z of [-.5,.5])box(0,.69,z,3.0,.15,.12);
 // Tall slatted sides with an open rear loading end and closed front panel.
 for(const side of [-1,1]){
  for(let i=0;i<10;i++){
   const g=new T.BoxGeometry(.22,1.12,.065);g.rotateX(side*.13);g.translate(-1.3+i*.29,1.43,side*.78);wood.push(g);
  }
  box(0,1.18,side*.81,2.98,.09,.08);
  box(0,1.97,side*.86,3.02,.09,.08);
  for(const x of [-1.32,1.32])box(x,1.4,side*.84,.10,1.18,.09,x<0?-.22:.22);
 }
 for(let row=0;row<5;row++)box(1.44,1.02+row*.20,0,.08,.195,1.68);
 for(const z of [-.5,.5])box(1.62,.73,z,.65,.065,.065);
 for(const x of [-.98,.98]){
  const axle=new T.CylinderGeometry(.065,.065,2.05,8);axle.rotateX(Math.PI/2);axle.translate(x,.49,0);iron.push(axle);
  for(const z of [-.98,.98]){
   const wheel=new T.CylinderGeometry(.45,.45,.14,10);wheel.rotateX(Math.PI/2);wheel.translate(x,.49,z);wood.push(wheel);
   const hub=new T.CylinderGeometry(.10,.10,.18,8);hub.rotateX(Math.PI/2);hub.translate(x,.49,z);wood.push(hub);
  }
 }
 const root=new T.Group();for(const [parts,material]of [[wood,CITY_WOOD_MATERIAL],[iron,ironMaterial]] as const){const geometry=mergeGeometries([...parts])!;parts.forEach(g=>g.dispose());root.add(new T.Mesh(geometry,material));}
 // Match the original GLB orientation without changing saved placement rotations.
 for(const c of root.children)(c as T.Mesh).geometry.rotateY(Math.PI/2);
 const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const c of root.children){c.position.set(-center.x,-bounds.min.y,-center.z);c.castShadow=c.receiveShadow=true;}return root;
}
