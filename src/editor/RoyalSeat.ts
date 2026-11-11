import * as T from 'three';
import {CITY_WOOD_MATERIAL} from './CityWood';
export function appendRoyalSeat(floor:number,x:number,z:number,width:number,angle:number,add:(g:T.BufferGeometry,m:T.Material)=>void,colliders:number[][]){
 const wine=new T.MeshLambertMaterial({color:'#722b35'}),gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.4});

  const matrix=new T.Matrix4().makeRotationY(angle).multiply(new T.Matrix4().makeScale(.62,.62,.62));matrix.setPosition(x,floor,z);
  const part=(px:number,y:number,pz:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(px,y,pz);g.applyMatrix4(matrix);add(g,m);};
  for(const dx of [-width/2+.3,width/2-.3])for(const dz of [-.85,.85])part(dx,.35,dz,.22,.7,.22,CITY_WOOD_MATERIAL);
  part(0,.78,0,width,.28,2.4,CITY_WOOD_MATERIAL);part(0,1.04,0,width-.3,.32,2.1,wine);
  part(0,1.9,-1.05,width,2,.28,CITY_WOOD_MATERIAL);part(0,1.95,-.86,width-.28,1.6,.18,wine);
  part(0,2.95,-1.05,width,.12,.32,gold);
  for(const dx of [-width/2,width/2]){part(dx,1.4,0,.26,1.15,2.5,wine);part(dx,2.02,0,.3,.12,2.5,gold);}
  const b=new T.Box3(new T.Vector3(-width/2-.16,0,-1.25),new T.Vector3(width/2+.16,3.02,1.25)).applyMatrix4(matrix);colliders.push([...b.min.toArray(),...b.max.toArray()]);

}
