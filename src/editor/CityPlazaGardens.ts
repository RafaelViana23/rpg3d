import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PLAZA_GARDEN_RADIUS,PLAZA_GARDEN_HALF_ANGLE,plazaGardenAngles} from './CentralPlazaLayout';
const material=new T.MeshLambertMaterial({vertexColors:true});
/** Eight curved flowerbeds share one draw; gaps keep the radial approaches open. */
export function createCityPlazaGardens(){
 const parts:T.BufferGeometry[]=[],colliders:number[][]=[];
 const add=(source:T.BufferGeometry,color:string)=>{
  const g=source.index?source.toNonIndexed():source;if(g!==source)source.dispose();
  const c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
  g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);
 };
 const sector=(angle:number,inner:number,outer:number,half:number,height:number)=>{
  const points:T.Vector2[]=[];
  for(let i=0;i<=12;i++){const a=angle-half+half*2*i/12;points.push(new T.Vector2(Math.sin(a)*outer,-Math.cos(a)*outer));}
  for(let i=12;i>=0;i--){const a=angle-half+half*2*i/12;points.push(new T.Vector2(Math.sin(a)*inner,-Math.cos(a)*inner));}
  const g=new T.ExtrudeGeometry(new T.Shape(points),{depth:height,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);g.translate(0,.14,0);return g;
 };
 for(const [index,angle]of plazaGardenAngles().entries()){
  const rim=sector(angle,28.6,31.4,PLAZA_GARDEN_HALF_ANGLE,.42);add(rim,'#8c8b7e');
  // Short collision sectors follow the curve instead of blocking its open corners.
  for(let section=0;section<4;section++){
   const piece=sector(angle-PLAZA_GARDEN_HALF_ANGLE+(section+.5)*PLAZA_GARDEN_HALF_ANGLE/2,28.6,31.4,PLAZA_GARDEN_HALF_ANGLE/4,.42);piece.computeBoundingBox();const b=piece.boundingBox!;colliders.push([...b.min.toArray(),...b.max.toArray()]);piece.dispose();
  }
  add(sector(angle,28.8,31.2,PLAZA_GARDEN_HALF_ANGLE-.006,.44),'#526332');
  for(let i=0;i<18;i++){
   const a=angle-PLAZA_GARDEN_HALF_ANGLE+.025+(i%9)*.028,r=PLAZA_GARDEN_RADIUS+(i<9?-.65:.65),x=Math.sin(a)*r,z=Math.cos(a)*r;
   const foliage=new T.IcosahedronGeometry(.27,0);foliage.scale(1,.8,1);foliage.translate(x,.76,z);add(foliage,i%2?'#507d36':'#3b672e');
   const flower=new T.SphereGeometry(.12,5,3);flower.translate(x,.99,z);add(flower,['#e9c94b','#e5a4bf','#cda9e4','#f6e5b5'][(index+i)%4]);
  }
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.castShadow=true;
 const root=new T.Group();root.name='Jardins circulares da praça da fonte';root.userData.gardenCount=8;root.userData.cityObject=true;root.userData.sharedCityGeometry=true;root.add(mesh);
 return {root,colliders};
}
