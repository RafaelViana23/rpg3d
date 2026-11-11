import * as T from 'three';
import { CITY_WOOD_MATERIAL } from './CityWood';
const linen=new T.MeshLambertMaterial({color:'#ded7bc'});
const green=new T.MeshLambertMaterial({color:'#527246'});
/** Same frame, mattress, headboard and blanket proportions as the palace beds. Long axis X. */
export function createRoyalStyleBed(){
 const root=new T.Group();root.name='Cama real com manta verde';root.userData.bedMattressY=1.16;
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);};
 box(6,.7,4.6,0,.35,0,CITY_WOOD_MATERIAL);
 box(5.7,.3,4.3,0,.85,0,linen);
 box(4.5,.16,4.35,.5,1.08,0,green);
 box(.3,3.4,4.8,-2.85,1.7,0,CITY_WOOD_MATERIAL);
 for(const z of [-1.05,1.05])box(1,.3,1.7,-1.8,1.1,z,linen);
 return root;
}
