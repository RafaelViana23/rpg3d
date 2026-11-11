import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
import type {RoyalRoomLight} from './RoyalRoomDetails';

/** Monumental two-tier chandelier, suspended from the centre of the main hall roof. */
export function createRoyalHallChandelier(z:number){
 const root=new T.Group();root.name='Lustre central monumental do palácio';
 const gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.35});
 const batches=new Map<T.Material,T.BufferGeometry[]>(),lights:RoyalRoomLight[]=[];
 const add=(g:T.BufferGeometry,m:T.Material)=>{const geometry=g.index?g.toNonIndexed():g;if(geometry!==g)g.dispose();const parts=batches.get(m)??[];parts.push(geometry);batches.set(m,parts);};
 const beam=(a:T.Vector3,b:T.Vector3,r:number,m:T.Material)=>{
  const g=new T.CylinderGeometry(r,r,a.distanceTo(b),8);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));
  g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);
 };
 for(const [radius,y,count]of [[6,23.2,16],[3.7,25.4,8]]){
  const band=new T.TorusGeometry(radius,.2,8,64);band.rotateX(Math.PI/2);band.translate(0,y,z);add(band,CITY_WOOD_MATERIAL);
  for(const offset of [-.13,.13]){const trim=new T.TorusGeometry(radius,.045,6,64);trim.rotateX(Math.PI/2);trim.translate(0,y+offset,z);add(trim,gold);}
  for(let i=0;i<count;i++){
   const a=i*Math.PI*2/count,x=Math.sin(a)*radius,zz=z+Math.cos(a)*radius;
   const cup=new T.CylinderGeometry(.29,.18,.16,12);cup.translate(x,y+.23,zz);add(cup,gold);
   lights.push({pack:'candle',x,y:y+.31,z:zz,height:.9,rotation:a,group:'palace-main-chandelier',intensity:450,distance:65,emitterOffset:[-x,22.3-(y+.31),z-zz]});
   if(i%(count/4)===0)beam(new T.Vector3(x,y,z+Math.cos(a)*radius),new T.Vector3(0,28.1,z),.055,gold);
  }
 }
 beam(new T.Vector3(0,27.9,z),new T.Vector3(0,29.95,z),.10,gold);
 for(const [material,parts]of batches){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;root.add(mesh);}
 root.userData.royalHallChandelier={x:0,z,radius:6,bottom:23,ceiling:30,candles:24};
 return {root,lights};
}
