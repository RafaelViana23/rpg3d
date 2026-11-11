import * as T from 'three';
import {CITY_WOOD_MATERIAL} from './CityWood';
const ROYAL_CEILING_CENTER_X=40.3;
type Add=(geometry:T.BufferGeometry,material:T.Material)=>void;
export type RoyalRoomLight={pack:'candle'|'wall-torch'|'tavern-fire';x:number;y:number;z:number;height:number;rotation:number;group?:string;intensity?:number;distance?:number;persistent?:boolean;emitterOffset?:[number,number,number]};
const gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.35});
const wine=new T.MeshLambertMaterial({color:'#722b48'}),linen=new T.MeshLambertMaterial({color:'#e5d8bf'}),green=new T.MeshLambertMaterial({color:'#42613c'});
const books=['#6b3446','#475f45','#4a5874','#a38851'].map(color=>new T.MeshLambertMaterial({color}));
function helpers(floor:number,add:Add){
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,floor+y,z);add(g,m);};
 const cylinder=(x:number,y:number,z:number,top:number,bottom:number,h:number,m:T.Material)=>{const g=new T.CylinderGeometry(top,bottom,h,12);g.translate(x,floor+y,z);add(g,m);};
 return {box,cylinder};
}
export function appendRoyalBookcase(floor:number,shelfX:number,shelfZ:number,add:Add,solid:(x:number,z:number,w:number,h:number,d:number)=>void){
 const {box}=helpers(floor,add);
 for(const x of [shelfX-1.3,shelfX+1.3])box(x,2.4,shelfZ,.16,4.8,1.1,CITY_WOOD_MATERIAL);
 box(shelfX,2.4,shelfZ-.5,2.6,4.8,.12,CITY_WOOD_MATERIAL);
 for(let row=0;row<5;row++){
  const y=.14+row*1.08;box(shelfX,y,shelfZ,2.6,.12,1.1,CITY_WOOD_MATERIAL);
  if(row<4)for(let j=0;j<9;j++){
   const x=shelfX-1.08+j*.26,h=.58+(j%3)*.10;
   box(x,y+.08+h/2,shelfZ+.10,.19,h,.65,books[(j+row)%books.length]);
   box(x,y+.19,shelfZ+.44,.18,.035,.02,gold);
  }
 }
 solid(shelfX,shelfZ,2.8,4.8,1.1);
}
export function appendRoyalPainting(floor:number,painting:{x:number;y:number;z:number;angle:number;theme:number},add:Add){
  const matrix=new T.Matrix4().makeTranslation(painting.x,floor+painting.y,painting.z).multiply(new T.Matrix4().makeRotationY(painting.angle));
  const artBox=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);g.applyMatrix4(matrix);add(g,m);};
  artBox(0,0,0,5.1,3.3,.12,CITY_WOOD_MATERIAL);
  artBox(0,0,.075,4.8,3, .015,painting.theme===2?wine:books[2]);
  for(const x of [-2.48,2.48])artBox(x,0,.12,.14,3.3,.16,gold);
  for(const y of [-1.58,1.58])artBox(0,y,.12,5.1,.14,.16,gold);
  const shape=(points:number[][],depth:number,m:T.Material)=>{
   const outline=new T.Shape();outline.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))outline.lineTo(p[0],p[1]);outline.closePath();
   const g=new T.ShapeGeometry(outline);g.translate(0,0,depth);g.applyMatrix4(matrix);add(g,m);
  };
  const sun=new T.CircleGeometry(.30,20);sun.translate(1.4,.9,.10);sun.applyMatrix4(matrix);add(sun,linen);
  shape([[-2.37,-1.46],[-2.37,-.1],[-1.5,.6],[-.4,-.2],[.4,.35],[1.3,-.1],[2.37,.45],[2.37,-1.46]],.105,books[0]);
  shape([[-2.37,-1.46],[-2.37,-.6],[-1.5,-.35],[-.5,-.6],[.7,-.3],[2.37,-.6],[2.37,-1.46]],.12,green);
  if(painting.theme!==2){
   artBox(0,-.24,.14,1.35,.9,.025,linen);
   for(const x of [-.7,.7]){artBox(x,-.05,.15,.34,1.35,.025,linen);shape([[x-.24,.62],[x,.96],[x+.24,.62]],.18,wine);}
   artBox(0,-.45,.18,.24,.46,.025,wine);
   for(const x of [-.38,0,.38])artBox(x,.3,.16,.18,.18,.025,linen);
  }else{
   shape([[-.22,-1.35],[-1.1,-1.35],[-.4,-.65],[.25,-.4],[.1,-.1],[.45,-.1],[.6,-.42],[.05,-.72]],.14,books[2]);
   for(const x of [-1.6,-.9,1.1,1.8]){artBox(x,-.55,.15,.06,.6,.025,CITY_WOOD_MATERIAL);shape([[x-.25,-.35],[x,.35],[x+.25,-.35]],.18,green);}
  }
}
export function appendRoyalChandelier(floor:number,back:number,front:number,group:string,add:Add){
 const cx=ROYAL_CEILING_CENTER_X,cz=(back+front)/2;
 const {cylinder}=helpers(floor,add);const lights:(RoyalRoomLight&{pack:'candle'})[]=[];
 for(const y of [6.15,6.55]){const ring=new T.TorusGeometry(1.65,.055,6,32);ring.rotateX(Math.PI/2);ring.translate(cx,floor+y,cz);add(ring,gold);}
 cylinder(cx,7,cz,.035,.035,.9,gold);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,x=cx+Math.sin(a)*1.65,z=cz+Math.cos(a)*1.65;
  cylinder(x,6.4,z,.035,.035,.5,gold);cylinder(x,6.67,z,.18,.18,.05,gold);
  lights.push({pack:'candle',x,y:floor+6.70,z,height:.42,rotation:0,group,intensity:150,distance:42,emitterOffset:[cx-x,-.8,cz-z]});
  const beam=new T.CylinderGeometry(.025,.025,Math.hypot(1.65,.8),5);beam.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(x-cx,-.8,z-cz).normalize()));beam.translate((x+cx)/2,floor+6.95,(z+cz)/2);add(beam,gold);
 }
 return lights;
}
export function appendRoyalWoodCeiling(floor:number,back:number,front:number,add:Add){
 const {box}=helpers(floor,add),center=(back+front)/2;
 box(ROYAL_CEILING_CENTER_X,7.25,center,24,.16,front-back,CITY_WOOD_MATERIAL);
 for(let x=28.5;x<52;x+=4)box(x,7.05,center,.28,.35,front-back,CITY_WOOD_MATERIAL);
 for(let z=back+.6;z<front;z+=4)box(ROYAL_CEILING_CENTER_X,6.98,z,24,.25,.28,CITY_WOOD_MATERIAL);
}

/** Matching royal cabinet with timber doors and separate gold fittings. */
export function appendRoyalWardrobe(floor:number,x:number,z:number,add:Add,solid:(x:number,z:number,w:number,h:number,d:number)=>void){
 const {box}=helpers(floor,add);
 box(x,2,z,3,4,2,CITY_WOOD_MATERIAL);solid(x,z,3,4,2);
 for(const dx of [-1.4,0,1.4])box(x+dx,2,z+1.03,.07,3.85,.06,gold);
 for(const y of [.15,3.85])box(x,y,z+1.03,2.9,.07,.06,gold);
 for(const dx of [-.75,.75]){
  box(x+dx+(dx<0?.48:-.48),1.8,z+1.1,.08,.3,.08,gold);
  const shape=new T.Shape();shape.moveTo(-.5,-.2);shape.lineTo(.5,-.2);shape.lineTo(.6,.35);shape.lineTo(.24,.12);shape.lineTo(0,.55);shape.lineTo(-.24,.12);shape.lineTo(-.6,.35);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false});g.scale(.65,.65,.65);g.translate(x+dx,floor+2.6,z+1.08);add(g,gold);
 }
}
