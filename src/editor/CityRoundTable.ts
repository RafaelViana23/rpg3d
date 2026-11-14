import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
export function createCityRoundTable(){
 const parts:T.BufferGeometry[]=[];
 const polygon=Array.from({length:12},(_,i)=>new T.Vector2(Math.cos(i*Math.PI/6),Math.sin(i*Math.PI/6)));
 const clip=(points:T.Vector2[],edge:number,greater:boolean)=>{
  const out:T.Vector2[]=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],insideA=greater?a.x>=edge:a.x<=edge,insideB=greater?b.x>=edge:b.x<=edge;
   if(insideA)out.push(a.clone());if(insideA!==insideB){const t=(edge-a.x)/(b.x-a.x);out.push(new T.Vector2(edge,a.y+(b.y-a.y)*t));}}
  return out;
 };
 for(let i=0;i<7;i++){
  const left=-1+i*2/7+.004,right=-1+(i+1)*2/7-.004,points=clip(clip(polygon,left,true),right,false);
  if(points.length<3)continue;const shape=new T.Shape(points),top=new T.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:false,steps:1,curveSegments:1});top.rotateX(Math.PI/2);top.translate(0,1.10,0);parts.push(top);
 }
 const stem=new T.CylinderGeometry(.10,.14,.95,6);stem.translate(0,.525,0);parts.push(stem);
 // Flat circular base, a smaller version of the tabletop.
 const base=new T.CylinderGeometry(.45,.45,.06,12);base.translate(0,.03,0);parts.push(base);
 const geometry=mergeGeometries(parts.map(g=>g.index?g.toNonIndexed():g))!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox!.min.y,0);const root=new T.Group(),mesh=new T.Mesh(geometry,CITY_WOOD_MATERIAL);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
