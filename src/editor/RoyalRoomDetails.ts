import chestGeometry from './royal-chest-geometry.json';
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
export function appendRoyalWoodCeiling(floor:number,back:number,front:number,add:Add,options:{left?:number;right?:number;top?:number}={}){
 const {box}=helpers(floor,add),center=(back+front)/2;
 const left=options.left??28.5,right=options.right??52.5,top=options.top??7.25,cx=(left+right)/2;
 box(cx,top,center,right-left,.16,front-back,CITY_WOOD_MATERIAL);
 for(let x=options.left===undefined?28.5:left+.5;x<(options.right??52);x+=4)box(x,top-.2,center,.28,.35,front-back,CITY_WOOD_MATERIAL);
 for(let z=back+.6;z<front;z+=4)box(cx,top-.27,z,right-left,.25,.28,CITY_WOOD_MATERIAL);
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

/** Imported chest, fitted to the established royal/inn chest footprint. */
const chestTexture=typeof document!=='undefined'?new T.TextureLoader().load('/models/props/low-poly-chest/texture.png'):null;
if(chestTexture){chestTexture.flipY=false;chestTexture.colorSpace=T.SRGBColorSpace;chestTexture.magFilter=T.NearestFilter;}
const chestDetails=new T.MeshStandardMaterial({map:chestTexture,color:0xffffff,roughness:.65,side:T.DoubleSide});
const importedChest=chestGeometry.map(data=>new T.BufferGeometryLoader().parse(data as unknown as Parameters<T.BufferGeometryLoader['parse']>[0]));
export function appendRoyalChest(floor:number,x:number,z:number,add:Add,solid:(x:number,z:number,w:number,h:number,d:number)=>void){
 for(const source of importedChest){
  const position=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv');
  for(const materialIndex of [0,1]){
   const vertices:number[]=[],normals:number[]=[],uvs:number[]=[];
   for(const group of source.groups)if(group.materialIndex===materialIndex){
    for(let i=group.start;i<group.start+group.count;i++){
     vertices.push(position.getX(i)*.7+x,position.getY(i)*.7+floor,position.getZ(i)*.7+z);
     normals.push(normal.getX(i),normal.getY(i),normal.getZ(i));uvs.push(uv.getX(i),uv.getY(i));
    }
   }
   if(!vertices.length)continue;
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
   add(g,materialIndex===0?CITY_WOOD_MATERIAL:chestDetails);
  }
 }
 solid(x,z,2.3*.7,1.5*.7,1.4*.7);
}

/** Keep the imported lid separate so every placed chest can open independently. */
export function addInteractiveRoyalChest(parent:T.Group,floor:number,x:number,z:number,solid:(x:number,z:number,w:number,h:number,d:number)=>void,rotation=0){
 const chest=new T.Group();chest.name='Baú interativo';chest.position.set(x,floor,z);chest.rotation.y=rotation;
 chest.userData.cityObject=true;chest.userData.royalChest=true;chest.userData.open=false;
 const lid=new T.Group();lid.name='RoyalChestLid';lid.position.set(0,.7,.49);chest.add(lid);
 importedChest.forEach((source,index)=>{
  const g=source.clone();g.scale(.7,.7,.7);
  if(index===0)g.translate(0,-lid.position.y,-lid.position.z);
  const mesh=new T.Mesh(g,[CITY_WOOD_MATERIAL,chestDetails]);mesh.castShadow=mesh.receiveShadow=true;
  (index===0?lid:chest).add(mesh);
 });
 parent.add(chest);solid(x,z,1.61,1.05,.98);return chest;
}
let interactiveChests:T.Object3D[]=[],chestScan=0,chestTick=0;
export function nearestRoyalChest(scene:T.Scene,player:T.Vector3){
 const now=performance.now(),dt=Math.min(.05,(now-chestTick)/1000);chestTick=now;
 if(now-chestScan>500||!chestScan){interactiveChests=[];scene.traverse(o=>{if(o.userData.royalChest)interactiveChests.push(o);});chestScan=now;}
 let nearest:T.Object3D|undefined,best=2.5**2;
 const p=new T.Vector3();
 for(const chest of interactiveChests){
  if(!chest.parent)continue;
  const lid=chest.getObjectByName('RoyalChestLid');
  if(lid)lid.rotation.x=T.MathUtils.damp(lid.rotation.x,chest.userData.open?1.35:0,10,dt);
  chest.getWorldPosition(p);const distance=p.distanceToSquared(player);
  if(Math.abs(p.y-player.y)<2&&distance<best){best=distance;nearest=chest;}
 }
 return nearest;
}
