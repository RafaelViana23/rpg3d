import {appendRoyalBookcase,appendRoyalWardrobe,appendRoyalPainting,appendRoyalChandelier,appendRoyalWoodCeiling} from './RoyalRoomDetails';
import { princessDisplayOutfit } from './PrincessDisplayOutfit';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_WOOD_MATERIAL } from './CityWood';

type LightPlacement={pack:'candle'|'wall-torch';x:number;y:number;z:number;height:number;rotation:number;group?:string;intensity?:number;distance?:number;emitterOffset?:[number,number,number]};
/** Decoration stays within the existing east bedroom; architecture and sleeping anchors are unchanged. */
export function createAliceBedroomDecor(floor:number,bedZ:number,back:number,front:number,windowCenters:number[],halfWindow:number,options:{accentColor?:string;ownerName?:string}={}){
 const root=new T.Group();root.name=`Quarto real de ${options.ownerName??'Alice'}: decoração`;
 const batches=new Map<T.Material,T.BufferGeometry[]>(),colliders:number[][]=[],lights:LightPlacement[]=[];
 const props:{pack:string;piece?:string;label:string;x:number;y:number;z:number;height:number;rotation:number;water?:boolean;room?:string;horizontalScale?:number}[]=[];
 const gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.35});
 const pink=new T.MeshLambertMaterial({color:options.accentColor??'#c66698'}),wine=new T.MeshLambertMaterial({color:'#722b48'}),linen=new T.MeshLambertMaterial({color:'#e5d8bf'});
 const glass=new T.MeshStandardMaterial({color:'#a8bfcd',metalness:.85,roughness:.13});
 const green=new T.MeshLambertMaterial({color:'#42613c'}),terra=new T.MeshLambertMaterial({color:'#b28a64'});
 const snapshot=()=>({parts:new Map([...batches].map(([m,list])=>[m,list.length])),colliders:colliders.length});
 const transformSince=(start:ReturnType<typeof snapshot>,matrix:T.Matrix4)=>{
  for(const [m,list]of batches)for(const g of list.slice(start.parts.get(m)??0))g.applyMatrix4(matrix);
  for(let i=start.colliders;i<colliders.length;i++){
   const b=new T.Box3(new T.Vector3(...colliders[i].slice(0,3)),new T.Vector3(...colliders[i].slice(3,6))).applyMatrix4(matrix);
   colliders[i]=[...b.min.toArray(),...b.max.toArray()];
  }
 };
 const relocate=(x:number,z:number,toX:number,toZ:number,angle:number)=>new T.Matrix4().makeTranslation(toX,0,toZ).multiply(new T.Matrix4().makeRotationY(angle)).multiply(new T.Matrix4().makeTranslation(-x,0,-z));
 const add=(g:T.BufferGeometry,m:T.Material)=>{const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();const list=batches.get(m)??[];list.push(geo);batches.set(m,list);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,floor+y,z);add(g,m);};
 const solid=(x:number,z:number,w:number,h:number,d:number)=>colliders.push([x-w/2,floor,z-d/2,x+w/2,floor+h,z+d/2]);
 const cylinder=(x:number,y:number,z:number,top:number,bottom:number,h:number,m:T.Material)=>{const g=new T.CylinderGeometry(top,bottom,h,12);g.translate(x,floor+y,z);add(g,m);};
 const crown=(x:number,y:number,z:number,size:number,onFloor=false)=>{
  const shape=new T.Shape();shape.moveTo(-.5,-.2);shape.lineTo(.5,-.2);shape.lineTo(.6,.35);shape.lineTo(.24,.12);shape.lineTo(0,.55);shape.lineTo(-.24,.12);shape.lineTo(-.6,.35);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false});g.scale(size,size,size);
  if(onFloor)g.rotateX(-Math.PI/2);g.translate(x,floor+y,z);add(g,gold);
 };
 // Upholstered headboard, carved crest and a four-post wine canopy.
 box(42,2.3,bedZ-2.65,3.9,1.7,.1,wine);crown(42,2.15,bedZ-2.57,1.1);
 for(const x of [39.45,44.55])for(const z of [bedZ-3.1,bedZ+3.1]){
  box(x,2.7,z,.17,5.4,.17,CITY_WOOD_MATERIAL);cylinder(x,5.5,z,.13,.18,.22,gold);
  solid(x,z,.2,5.6,.2);
 }
 for(const x of [39.45,44.55])box(x,5.25,bedZ,.22,.22,6.4,CITY_WOOD_MATERIAL);
 for(const z of [bedZ-3.1,bedZ+3.1])box(42,5.25,z,5.3,.22,.22,CITY_WOOD_MATERIAL);
 box(42,5.32,bedZ,5.1,.065,6.2,wine);
 for(const side of [-1,1])for(const end of [-1,1]){
  const x=42+side*2.45,z=bedZ+end*2.65;
  for(let i=0;i<5;i++)box(x+Math.sin(i*1.8)*.05,3,z+(i-2)*.13,.10,4.4,.16,wine);
  box(x,1.9,z,.17,.18,.7,gold);
 }
 const cabinetZ=back+.95;
 // Matching extra bedside cabinet, flowers and candle on a supported top.
 box(46,.65,cabinetZ,1.6,1.3,1.5,CITY_WOOD_MATERIAL);solid(46,cabinetZ,1.6,1.3,1.5);
 for(const x of [38,46]){
  for(const y of [.42,.87]){box(x,y,cabinetZ+.77,1.4,.035,.025,gold);box(x,y,cabinetZ+.80,.12,.09,.06,gold);}
  lights.push({pack:'candle',x:x-.42,y:floor+1.3,z:cabinetZ+.1,height:.32,rotation:0});
 }
 const flowers=(x:number,y:number,z:number)=>{
  cylinder(x,y+.18,z,.2,.13,.36,terra);
  for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5,px=x+Math.cos(a)*.14,pz=z+Math.sin(a)*.14;
   cylinder(px,y+.52,pz,.018,.018,.5,green);
   const g=new T.IcosahedronGeometry(.12,0);g.translate(px,floor+y+.79,pz);add(g,pink);
  }
 };
 flowers(38.28,1.3,cabinetZ);flowers(46.28,1.3,cabinetZ);
 const vanityStart=snapshot();
 // Existing writing table becomes the dressing table, with a framed silver mirror.
 box(47,2.55,bedZ+.88,1.65,1.95,.08,glass);
 for(const x of [46.13,47.87])box(x,2.55,bedZ+.92,.12,2.15,.13,gold);
 for(const y of [1.52,3.58])box(47,y,bedZ+.92,1.86,.12,.13,gold);
 crown(47,3.68,bedZ+.94,.55);flowers(47.8,1.3,bedZ+1.6);
 cylinder(47,.58,bedZ+3,.48,.48,.18,CITY_WOOD_MATERIAL);cylinder(47,.72,bedZ+3,.46,.46,.12,pink);
 for(const x of [46.7,47.3])for(const z of [bedZ+2.7,bedZ+3.3])box(x,.27,z,.1,.54,.1,CITY_WOOD_MATERIAL);
 solid(47,bedZ+3,1,.8,1);
 transformSince(vanityStart,relocate(47,bedZ+1.5,49,back+.95,0));
 const wardrobePositions:number[][]=[];
 for(let section=0;section<4;section++){
 const wardrobeStart=snapshot();
 appendRoyalWardrobe(floor,49,bedZ+5,add,solid);
 const wardrobeZ=front-1.7-section*3;wardrobePositions.push([29.3,floor,wardrobeZ]);
 transformSince(wardrobeStart,relocate(49,bedZ+5,29.3,wardrobeZ,Math.PI/2));
 }
 // Bookcase and personal chest sit along the opposite wall, away from the door.
 const shelfX=30.2,shelfZ=bedZ+8;
 for(let section=0;section<5;section++){
 const shelfStart=snapshot();
 appendRoyalBookcase(floor,shelfX,shelfZ,add,solid);
 const matrix=new T.Matrix4().makeTranslation(28.36,0,back+1.43+section*2.55)
  .multiply(new T.Matrix4().makeRotationY(Math.PI/2))
  .multiply(new T.Matrix4().makeScale(.91,1,1))
  .multiply(new T.Matrix4().makeTranslation(-shelfX,0,-shelfZ));
 transformSince(shelfStart,matrix);
 }
 const chestStart=snapshot();
 box(33.4,.65,bedZ+8,2.2,1.3,1.25,CITY_WOOD_MATERIAL);box(33.4,1.34,bedZ+8,2.3,.15,1.35,CITY_WOOD_MATERIAL);
 for(const x of [32.65,34.15])box(x,.75,bedZ+8.65,.12,1.1,.08,gold);
 box(33.4,1.04,bedZ+8.7,.3,.35,.08,gold);solid(33.4,bedZ+8,2.3,1.5,1.4);
 transformSince(chestStart,relocate(33.4,bedZ+8,33.4,back+.85,0));
 // Thin heraldic rug, with no collision or extra floor plane at the door.
 box(42,.022,bedZ+7.5,10.6,.018,6.8,wine);box(42,.035,bedZ+7.5,10.2,.008,6.4,gold);box(42,.043,bedZ+7.5,10,.008,6.2,pink);
 crown(42,.054,bedZ+7.5,2.4,true);
 // Two wall banners frame the head of the room.
 for(const x of [36,47]){
  box(x,4.1,back+.26,1.6,2.8,.08,wine);
  for(const xx of [x-.82,x+.82])box(xx,4.1,back+.31,.05,2.9,.05,gold);
  box(x,5.55,back+.25,1.9,.1,.13,CITY_WOOD_MATERIAL);crown(x,4.1,back+.32,.8);
 }
 // Wine curtains frame the two real exterior windows; no light is added at the glass.
 for(const center of windowCenters){
  box(52.15,6.45,center,.12,.12,halfWindow*2+1.1,CITY_WOOD_MATERIAL);
  for(const side of [-1,1]){
   for(let i=0;i<4;i++)box(52.12+Math.sin(i*2)*.04,3.85,center+side*(halfWindow+.3)+(i-1.5)*.13,.10,5,.16,wine);
   box(52.08,2.7,center+side*(halfWindow+.3),.14,.17,.65,gold);
  }
 }
 // Framed low-poly paintings, mounted in the exact empty wall bays.
 const paintingPlacements=[
  {x:52.22,y:4.55,z:(windowCenters[0]+windowCenters[1])/2,angle:-Math.PI/2,theme:0},
  {x:36,y:4.55,z:front-.26,angle:Math.PI,theme:1},
  {x:44.5,y:4.55,z:front-.26,angle:Math.PI,theme:2},
 ];
 for(const painting of paintingPlacements){
  appendRoyalPainting(floor,painting,add);
 }
 // Four display dresses face inward along the bathing/dressing area.
 const mannequinPositions:number[][]=[];
 const mannequinColors=[options.accentColor??'#c66698','#345caa','#34815c','#8554a1'];
 const mannequinFabrics=mannequinColors.map(color=>new T.MeshLambertMaterial({color}));
 for(let index=0;index<4;index++){
  const start=snapshot(),dx=49,dz=back+18+index*3.5;
  mannequinPositions.push([dx,floor,dz]);
  cylinder(dx,.12,dz,.65,.65,.24,CITY_WOOD_MATERIAL);cylinder(dx,.88,dz,.055,.055,1.5,CITY_WOOD_MATERIAL);
  const dress=princessDisplayOutfit();dress.translate(dx,floor,dz);add(dress,mannequinFabrics[index]);
  cylinder(dx,2.32,dz,.12,.12,.18,linen);solid(dx,dz,1.8,2.65,1.8);
  transformSince(start,relocate(dx,dz,dx,dz,-Math.PI/2));
 }
 // Oval wooden bath with a real inner bowl, metal hoops and a recessed water surface.
 const bathX=40.5,bathZ=back+24;
 const bathShape=new T.Shape();bathShape.absellipse(0,0,2.55,1.65,0,Math.PI*2,false,0);
 const hollow=new T.Path();hollow.absellipse(0,0,2.30,1.40,0,Math.PI*2,true,0);bathShape.holes.push(hollow);
 const walls=new T.ExtrudeGeometry(bathShape,{depth:1.05,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,curveSegments:32});
 walls.rotateX(-Math.PI/2);walls.translate(bathX,floor+.10,bathZ);add(walls,CITY_WOOD_MATERIAL);
 const bottom=new T.CylinderGeometry(2.5,2.5,.18,48);bottom.scale(1,1,.65);bottom.translate(bathX,floor+.12,bathZ);add(bottom,CITY_WOOD_MATERIAL);
 const iron=new T.MeshStandardMaterial({color:'#52565a',metalness:.65,roughness:.55});
 for(const y of [.28,.90]){const hoop=new T.TorusGeometry(2.56,.04,6,48);hoop.rotateX(Math.PI/2);hoop.scale(1,1,1.65/2.55);hoop.translate(bathX,floor+y,bathZ);add(hoop,iron);}
 const waterMaterial=new T.MeshStandardMaterial({color:'#72a7b4',transparent:true,opacity:.78,roughness:.22,metalness:.08,side:T.DoubleSide,depthWrite:false});
 const water=new T.CircleGeometry(1,48);water.rotateX(-Math.PI/2);water.scale(2.27,1,1.37);water.translate(bathX,floor+.79,bathZ);add(water,waterMaterial);
 solid(bathX,bathZ,5.2,1.15,3.4);
 props.push({pack:'farm',piece:'Bucket',label:'Balde com água da banheira',x:44.4,y:floor,z:bathZ+1.1,height:.9,rotation:Math.PI/4,water:true});
 // Use the supplied plant model instead of the earlier procedural pot and leaves.
 props.push({pack:'potted-plant',label:'Vaso de planta do quarto de Alice',x:51.3,y:floor,z:back+1.15,height:2.1,rotation:0});
 // Suspended candle chandelier; all candle emitters still use the city's shared budget.
 lights.push(...appendRoyalChandelier(floor,back+.2,front-.2,'alice-chandelier',add));
 appendRoyalWoodCeiling(floor,back+.2,front-.2,add);
 for(const [material,parts]of batches){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new T.Mesh(geometry,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;mesh.userData.cityObject=true;root.add(mesh);}
 root.userData.cityObject=true;root.userData.aliceBedroomDecor=!options.ownerName||options.ownerName==='Alice';
 root.userData.paintingPlacements=paintingPlacements;root.userData.wardrobePositions=wardrobePositions;root.userData.bookcaseCount=5;root.userData.mannequinPositions=mannequinPositions;root.userData.mannequinColors=mannequinColors;root.userData.bathBounds=[bathX-2.6,floor,bathZ-1.7,bathX+2.6,floor+1.15,bathZ+1.7];root.userData.chestPosition=[33.4,floor,back+.85];
 root.userData.elements=['cama com brasão','dossel vinho','guarda-roupa dourado','penteadeira com espelho','estante de livros','baú','lustre com velas','tapete com brasão','vestido no manequim','flores e planta'];
 return {root,colliders,lights,props};
}
