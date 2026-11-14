import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {IRON_ARMOR_COLOR,IRON_METALNESS,IRON_ROUGHNESS} from '../inventory/armorMaterials';

/** Large suspended iron chandelier; twelve holders receive the shared candle asset. */
export function createCityTavernChandelier(suspension:number){
  const root=new T.Group();root.name='Candelabro grande da taverna';
  root.userData.cityObject=true;root.userData.sharedCityGeometry=true;root.userData.alwaysLit=true;
  const iron:T.BufferGeometry[]=[];
  const place=(parts:T.BufferGeometry[],g:T.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z);parts.push(g);};
  const ring=new T.TorusGeometry(2.2,.085,5,32);ring.rotateX(Math.PI/2);iron.push(ring);
  place(iron,new T.CylinderGeometry(.06,.06,suspension,6),0,suspension/2,0);
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,x=Math.cos(angle)*2.2,z=Math.sin(angle)*2.2;
    place(iron,new T.CylinderGeometry(.2,.15,.08,8),x,.08,z);
    if(i%3===0){const arm=new T.BoxGeometry(2.2,.09,.09);arm.translate(1.1,0,0);arm.rotateY(-angle);iron.push(arm);}
  }
  const geometry=mergeGeometries(iron)!;iron.forEach(g=>g.dispose());
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:IRON_ARMOR_COLOR,metalness:IRON_METALNESS,roughness:IRON_ROUGHNESS}));
  mesh.receiveShadow=true;root.add(mesh);
  return root;
}
