import {registerCityInteriorProp} from './CityInteriorStreaming';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_WOOD_MATERIAL } from './CityWood';

const materials=[CITY_WOOD_MATERIAL,CITY_WOOD_MATERIAL,CITY_WOOD_MATERIAL];

/** Finished joinery on both faces, with solid returns at either end. */
export function addCityCounter(building:T.Group,width:number,depth:number,z:number,x=0,rotation=0){
  const root=new T.Group();root.name='Balcão de madeira completo em U';
  root.position.set(x,.08,z);root.rotation.y=rotation;root.userData.cityObject=true;root.userData.sharedCityGeometry=true;
  const batches:T.BufferGeometry[][]=[[],[],[]];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,material:number)=>{
    const geometry=new T.BoxGeometry(w,h,d).toNonIndexed();geometry.translate(x,y,z);batches[material].push(geometry);
  };
  const height=1,top=.12,counterDepth=.65,panelHeight=height-top;
  const segment=(x:number,z:number,length:number,side:boolean)=>{
    const part=(along:number,y:number,across:number,w:number,h:number,d:number,m:number)=>
      side?box(x+across,y,z+along,d,h,w,m):box(x+along,y,z+across,w,h,d,m);
    // Closed bottom and a solid core; neither face exposes unfinished geometry.
    part(0,.08,0,length,.16,counterDepth,1);
    part(0,panelHeight/2,0,length,panelHeight,counterDepth-.12,0);
    for(const face of [-1,1]){
      const panels=Math.max(1,Math.ceil(length/.28)),pitch=length/panels;
      for(let i=0;i<panels;i++)part(-length/2+(i+.5)*pitch,panelHeight/2,face*(counterDepth/2-.025),pitch-.012,panelHeight-.18,.06,0);
      for(const y of [.12,panelHeight-.06])part(0,y,face*counterDepth/2,length,.09,.08,1);
    }
    // Individual boards span the complete top, with a framed outer edge.
    for(let i=0;i<3;i++)part(0,height-top/2,(i-1)*(counterDepth+.12)/3,length,top,(counterDepth+.12)/3-.006,2);
    for(const end of [-1,1])part(end*(length/2-.045),panelHeight/2,0,.09,panelHeight,counterDepth+.06,1);
    const w=side?counterDepth+.12:length,d=side?length:counterDepth+.12;
    const bounds=new T.Box3().setFromPoints([-1,1].flatMap(sx=>[-1,1].map(sz=>new T.Vector3(x+sx*w/2,0,z+sz*d/2).applyAxisAngle(new T.Vector3(0,1,0),rotation).add(root.position))));
    building.userData.localColliders.push([bounds.min.x,.08,bounds.min.z,bounds.max.x,height+.08,bounds.max.z]);
  };
  segment(0,0,width,false);
  // The returns meet the front without overlapping coplanar top faces.
  for(const side of [-1,1])segment(side*(width-counterDepth-.12)/2,-(depth+counterDepth+.12)/2,depth,true);
  batches.forEach((geometries,i)=>{
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!geometry)return;
    const mesh=new T.Mesh(geometry,materials[i]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  });
  const staff=new T.Vector3(0,0,-1.1).applyAxisAngle(new T.Vector3(0,1,0),rotation).add(root.position);
  building.userData.npcCounter={x:staff.x,y:.08,z:staff.z,rotation};
  building.add(root);registerCityInteriorProp(building,root);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
}
