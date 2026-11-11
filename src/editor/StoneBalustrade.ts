import * as T from 'three';
import {CITY_MERLON_MATERIAL} from './CityStone';

/** Smooth gray matching the visible wall, without the masonry texture. */
export const CITY_BALUSTRADE_MATERIAL=new T.MeshStandardMaterial({color:CITY_MERLON_MATERIAL.color.clone(),roughness:.97,metalness:0});
type RailEnd={position:T.Vector3;foot:number;cap:number;directions:T.Vector3[]};
type RailContext={add:(geometry:T.BufferGeometry,material:T.Material)=>void;colliders:number[][];newels:Set<string>;ends?:Map<string,RailEnd>};
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
   const key=p.toArray().map(value=>value.toFixed(6)).join(',');
   const direction=(i===0?end:start).clone().sub(p);direction.y=0;direction.normalize();
   context.ends??=new Map();
   const existing=context.ends.get(key);
   if(existing)existing.directions.push(direction);
   else context.ends.set(key,{position:p.clone(),foot,cap,directions:[direction]});
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

/** Emit shared junctions once: large at corners/ends, a slim column at straight joins. */
export function finishStoneBalustrades(context:RailContext){
 const posts:{position:number[];large:boolean}[]=[];
 for(const [key,end] of context.ends??[]){
  if(context.newels.has(key))continue;context.newels.add(key);
  const {position:p,foot,cap,directions}=end;
  const corner=directions.length===1||directions.some(direction=>Math.abs(direction.dot(directions[0]))<.98);
  posts.push({position:p.toArray(),large:corner});
  const box=(y:number,w:number,h:number)=>{
   const g=new T.BoxGeometry(w,h,w);g.translate(p.x,y,p.z);context.add(g,CITY_BALUSTRADE_MATERIAL);
  };
  if(corner){
   box(foot+.09,.62,.18);box((foot+.18+cap+.24)/2,.4,cap+.24-foot-.18);box(cap+.33,.66,.18);
  }else{
   box(foot+.23,.34,.1);box(cap+.06,.34,.12);
   const height=cap-foot-.28,g=new T.CylinderGeometry(.105,.14,height,10);
   g.translate(p.x,foot+.28+height/2,p.z);context.add(g,CITY_BALUSTRADE_MATERIAL);
  }
 }
 context.ends?.clear();
 return posts;
}
