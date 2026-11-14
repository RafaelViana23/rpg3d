import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_COLOR} from './CityWood';
const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
/** Red folded curtains without ties; cloth and wooden rod share a single mesh. */
export function createCityCurtain(){
 const parts:T.BufferGeometry[]=[];
 const add=(geometry:T.BufferGeometry,color:string)=>{
  const rgb=new T.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b;}
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(geometry);
 };
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);};
 for(const side of [-1,1]){
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  // Three height bands pinch each panel at its tie and flare it towards the hem.
  for(let row=0;row<3;row++)for(let col=0;col<=6;col++){
   const t=col/6,y=[.04,.39,1][row],inner=[.035,.075,.075][row],outer=[.55,.51,.53][row];
   positions.push(side*(inner+(outer-inner)*t),y,.045+(col%2===0?.025:-.025));uvs.push(t,row/2);
  }
  for(let row=0;row<2;row++)for(let col=0;col<6;col++){
   const a=row*7+col,b=a+1,c=a+7,d=c+1;
   if(side===1)indices.push(a,b,d,a,d,c);else indices.push(a,d,b,a,c,d);
  }
  const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(positions,3));cloth.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));cloth.setIndex(indices);cloth.computeVertexNormals();add(cloth,'#780c1a');
  box(side*.565,1.015,.035,.055,.05,.055,CITY_WOOD_COLOR);
 }
 const rod=new T.CylinderGeometry(.012,.012,1.14,6);rod.rotateZ(Math.PI/2);rod.translate(0,1.015,.035);add(rod,CITY_WOOD_COLOR);
 const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());merged.computeBoundingBox();const bounds=merged.boundingBox!,center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());merged.translate(-center.x,-bounds.min.y,-center.z);merged.scale(1.186573982/size.x,1.04/size.y,.11/size.z);
 const root=new T.Group(),mesh=new T.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}

/** Append the same curtain geometry to the palace room batches. Y is the bottom edge. */
export function appendCityCurtain(x:number,y:number,z:number,width:number,height:number,depth:number,rotation:number,add:(geometry:T.BufferGeometry,material:T.Material)=>void){
 const curtain=createCityCurtain(),mesh=curtain.children[0] as T.Mesh;
 const geometry=mesh.geometry;geometry.scale(width/1.186573982,height/1.04,depth/.11);geometry.rotateY(rotation);geometry.translate(x,y,z);add(geometry,mesh.material as T.Material);
}
