import * as T from 'three';
import {CITY_MERLON_MATERIAL} from './CityStone';

/** Smooth gray matching the visible wall, without the masonry texture. */
export const CITY_BALUSTRADE_MATERIAL=new T.MeshStandardMaterial({color:CITY_MERLON_MATERIAL.color.clone(),roughness:.97,metalness:0});
type RailContext={add:(geometry:T.BufferGeometry,material:T.Material)=>void;colliders:number[][];newels:Set<string>};
export function appendStoneBalustrade(context:RailContext,start:T.Vector3,end:T.Vector3,steps=1){
 const delta=end.clone().sub(start),run=Math.hypot(delta.x,delta.z),rise=delta.y;
 const angle=Math.atan2(delta.x,delta.z),length=Math.hypot(run,rise),slope=Math.atan2(rise,run);
 const footAt=(t:number)=>t<=0?start.y:t>=1?end.y:start.y+rise*Math.ceil(t*steps)/steps;
 const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
  const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);context.add(g,CITY_BALUSTRADE_MATERIAL);
 };
 for(const [offset,height,width] of [[.09,.18,.48],[1.36,.16,.42],[1.47,.06,.54]]){
  const g=new T.BoxGeometry(width,height,length);g.rotateX(-slope);g.rotateY(angle);
  g.translate((start.x+end.x)/2,(start.y+end.y)/2+offset,(start.z+end.z)/2);context.add(g,CITY_BALUSTRADE_MATERIAL);
 }
 const count=Math.max(2,Math.ceil(run/.85));
 for(let i=0;i<=count;i++){
  const t=i/count,p=start.clone().lerp(end,t),foot=footAt(t),cap=p.y+1.16;
  if(i===0||i===count){
   const key=`${p.x},${p.y},${p.z}`;if(context.newels.has(key))continue;context.newels.add(key);
   box(p.x,foot+.09,p.z,.62,.18,.62);
   box(p.x,(foot+.18+cap+.24)/2,p.z,.4,cap+.24-foot-.18,.4);
   box(p.x,cap+.33,p.z,.66,.18,.66);
  }else{
   box(p.x,foot+.23,p.z,.34,.1,.34);box(p.x,cap+.06,p.z,.34,.12,.34);
   const height=cap-foot-.28,g=new T.CylinderGeometry(.105,.14,height,10);
   g.translate(p.x,foot+.28+height/2,p.z);context.add(g,CITY_BALUSTRADE_MATERIAL);
  }
 }
 const segments=Math.max(1,steps);
 for(let i=0;i<segments;i++){
  const a=start.clone().lerp(end,i/segments),b=start.clone().lerp(end,(i+1)/segments);
  context.colliders.push([Math.min(a.x,b.x)-.33,footAt(i/segments),Math.min(a.z,b.z)-.33,Math.max(a.x,b.x)+.33,Math.max(a.y,b.y)+1.58,Math.max(a.z,b.z)+.33]);
 }
 return{start:start.toArray(),end:end.toArray(),steps};
}
