import {appendStoneBalustrade} from './StoneBalustrade';
import {createRoyalLibrary} from './RoyalLibrary';
import {appendRoyalSeat} from './RoyalSeat';
import {createRoyalKitchen} from './RoyalKitchen';
import {createRoyalHallChandelier} from './RoyalHallChandelier';
import {createRoyalStudy} from './RoyalStudy';
import {createRoyalSittingRoom} from './RoyalSittingRoom';
import { createAliceBedroomDecor } from './AliceBedroomDecor';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cityStairGeometry} from './CityStairs';
import {cityPavingMaterial,alignCityPavingUV} from '../world/CityPaving';
import {CITY_WOOD_MATERIAL} from './CityWood';
import {CITY_MERLON_MATERIAL,CITY_STONE_MATERIAL,CITY_PLAIN_STONE_MATERIAL} from './CityStone';

/** Walkable T staircase, throne landing, open hall gallery and two royal bedrooms. */
export function createRoyalPalaceInterior(z:(value:number)=>number,front:number){
 const lightPlacements:{pack:'candle'|'wall-torch'|'tavern-fire';x:number;y:number;z:number;height:number;rotation:number;group?:string;intensity?:number;distance?:number;persistent?:boolean;emitterOffset?:[number,number,number]}[]=[];
 const propPlacements:ReturnType<typeof createAliceBedroomDecor>['props']=[];
 const rugBorder=new T.MeshLambertMaterial({color:'#c3a46a'}),rugField=new T.MeshLambertMaterial({color:'#425f43'});
 const root=new T.Group();root.name='Interior real: escadaria e galeria';
 const surfaces:number[][]=[],colliders:number[][]=[],flight:number[][]=[],batches=new Map<T.Material,T.BufferGeometry[]>();
 const ground=6.08,throne=10.08,upper=16.08,branchWidth=4.8,back=z(-27.2),branchZ=back+branchWidth/2,doorZ=z(-8);
 const hallPaving=cityPavingMaterial().clone();hallPaving.color.set('#c6c9c7');
 const red=new T.MeshLambertMaterial({color:'#722b35'}),linen=new T.MeshLambertMaterial({color:'#ded7bc'}),gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.4});
 const add=(g:T.BufferGeometry,m:T.Material,solid=false)=>{
  const geometry=g.index?g.toNonIndexed():g;if(geometry!==g)g.dispose();
  if(solid){geometry.computeBoundingBox();const b=geometry.boundingBox!;colliders.push([...b.min.toArray(),...b.max.toArray()]);}
  const parts=batches.get(m)??[];parts.push(geometry);batches.set(m,parts);
 };
 const box=(x:number,y:number,zz:number,w:number,h:number,d:number,m:T.Material,solid=false)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,zz);add(g,m,solid);};
 const lowerDoorZ=z(0),lowerDoorHalf=(z(1.2)-z(-1.2))/2;
 const deck=(x0:number,x1:number,z0:number,z1:number,y:number,filled=false)=>{
  const bottom=filled?ground:y-.3;
  const fill=(a:number,b:number,low:number,high:number)=>{
   if(b-a<.001||high-low<.001)return;
   box((x0+x1)/2,(low+high)/2,(a+b)/2,x1-x0,high-low,b-a,CITY_STONE_MATERIAL);
   if(filled)colliders.push([x0,low,a,x1,high-.35,b]);
  };
  if(filled&&z0<lowerDoorZ-lowerDoorHalf&&z1>lowerDoorZ+lowerDoorHalf){
   fill(z0,lowerDoorZ-lowerDoorHalf,bottom,y-.03);
   fill(lowerDoorZ+lowerDoorHalf,z1,bottom,y-.03);
   fill(lowerDoorZ-lowerDoorHalf,lowerDoorZ+lowerDoorHalf,ground+4.42,y-.03);
  }else fill(z0,z1,bottom,y-.03);
  const finish=new T.PlaneGeometry(x1-x0,z1-z0);finish.rotateX(-Math.PI/2);finish.translate((x0+x1)/2,y,(z0+z1)/2);alignCityPavingUV(finish);add(finish,hallPaving);
  surfaces.push([x0,z0,x1,z1,y]);flight.push([x0,bottom,z0,x1,y,z1]);
 };
 const balustrades:ReturnType<typeof appendStoneBalustrade>[]=[];
 const railContext={add,colliders,newels:new Set<string>()};
 const rail=(x0:number,z0:number,x1:number,z1:number,y:number)=>{
  balustrades.push(appendStoneBalustrade(railContext,new T.Vector3(x0,y,z0),new T.Vector3(x1,y,z1)));
 };
 const stair=(start:T.Vector3,end:T.Vector3,width:number)=>{
  const length=Math.hypot(end.x-start.x,end.z-start.z),count=Math.ceil((end.y-start.y)/.25);
  const angle=Math.atan2(end.x-start.x,end.z-start.z);
  const matrix=new T.Matrix4().makeRotationY(angle);matrix.setPosition(start.x,0,start.z);
  const g=cityStairGeometry(0,length,width,start.y,end.y,count,start.y-.25);
  // Side caps use wall masonry; treads and risers keep their plain gray finish.
  const normals=g.getAttribute('normal');
  for(const side of [false,true]){
   const indices:number[]=[];
   for(let i=0;i<normals.count;i+=3)if((Math.abs(normals.getX(i))>.9)===side)indices.push(i,i+1,i+2);
   const part=new T.BufferGeometry();
   for(const name of Object.keys(g.attributes)){
    const attribute=g.getAttribute(name),values:number[]=[];
    for(const i of indices)for(let j=0;j<attribute.itemSize;j++)values.push(attribute.array[i*attribute.itemSize+j]);
    part.setAttribute(name,new T.Float32BufferAttribute(values,attribute.itemSize));
   }
   part.applyMatrix4(matrix);add(part,side?CITY_STONE_MATERIAL:CITY_PLAIN_STONE_MATERIAL);
  }
  g.dispose();
  for(let i=0;i<count;i++){
   const a=i*length/count,b=(i+1)*length/count,y=start.y+(end.y-start.y)*(i+1)/count;
   const points=[[-width/2,a],[width/2,a],[width/2,b],[-width/2,b]].map(([x,zz])=>new T.Vector3(x,0,zz).applyMatrix4(matrix));
   const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
   const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs),y];
   surfaces.push(bounds);flight.push([bounds[0],start.y-.25,bounds[1],bounds[2],y,bounds[3]]);
  }
  // Classical stone railings share the exterior style and rest on the outer treads.
  for(const side of [-1,1]){
   const offset=new T.Vector3(side*(width/2-.35),0,0).applyAxisAngle(new T.Vector3(0,1,0),angle);
   balustrades.push(appendStoneBalustrade(railContext,start.clone().add(offset),end.clone().add(offset),count));
  }
  return {start:start.toArray(),end:end.toArray(),width,count};
 };
 const flights=[stair(new T.Vector3(0,ground,z(-10.5)),new T.Vector3(0,throne,z(-18)),10)];
 // A filled raised storey spans the complete hall, sealed against all rear walls.
 const platformFront=z(-18),halfHall=26.2;
 box(0,(ground+throne-.03)/2,(back+platformFront)/2,halfHall*2,throne-ground-.03,platformFront-back,CITY_STONE_MATERIAL);
 const throneFloor=new T.PlaneGeometry(halfHall*2,platformFront-back);throneFloor.rotateX(-Math.PI/2);throneFloor.translate(0,throne,(back+platformFront)/2);alignCityPavingUV(throneFloor);add(throneFloor,hallPaving);
 surfaces.push([-halfHall,back,halfHall,platformFront,throne]);
 flight.push([-halfHall,ground,back,halfHall,throne,platformFront]);
 // The narrow step allowance keeps the last riser climbable while sealing the base.
 colliders.push([-halfHall,ground,back,halfHall,throne-.35,platformFront]);
 rail(-halfHall,platformFront,-5.3,platformFront,throne);
 rail(5.3,platformFront,halfHall,platformFront,throne);
 for(const side of [-1,1])flights.push(stair(new T.Vector3(side*7,throne,branchZ),new T.Vector3(side*22,upper,branchZ),branchWidth));
 // Open arcades support the lateral galleries.
 const sideFront=z(9.2);
 deck(-26.2,-22,back,sideFront,upper);deck(22,26.2,back,sideFront,upper);
 for(const side of [-1,1]){
  rail(side*22,branchZ+branchWidth/2+.35,side*22,sideFront,upper);
  const lo=side<0?-52.4:27.8,hi=side<0?-27.8:52.4;
  deck(lo,hi,z(-27),front-1.3,upper);
  // Doorway paving stops exactly at the bedroom floor, without coplanar overlap.
  for(const zz of [-18,2])deck(Math.min(side*26.2,side*27.8),Math.max(side*26.2,side*27.8),z(zz)-2.1,z(zz)+2.1,upper);
  // Separate front and rear bedrooms with a full-height partition.
  box(side*40.1,(upper+23.6)/2,z(-8),24.6,23.6-upper,.3,CITY_STONE_MATERIAL,true);
  // Each wing has a furnished bedroom above its ground floor.
  for(const bedroomZ of [-19,1]){
  if(side===1&&bedroomZ===1){
   const decor=createRoyalSittingRoom(upper,z(-8)+.2,z(9.2)-.15);
   root.add(decor.root);colliders.push(...decor.colliders);lightPlacements.push(...decor.lights);propPlacements.push(...decor.props);
   root.userData.royalSittingRoom=decor.room;
   continue;
  }
  if(side===-1&&bedroomZ===1){
   const decor=createRoyalStudy(upper,z(-8)+.2,z(9.2)-.15);
   root.add(decor.root);colliders.push(...decor.colliders);lightPlacements.push(...decor.lights);
   root.userData.royalStudy=decor.room;root.userData.royalStudySeats=decor.root.userData.seats;
   continue;
  }
  const alice=side===1&&bedroomZ===-19,royalRear=bedroomZ===-19;
  const x=side*42,bedZ=royalRear?z(-27)+3.5:z(bedroomZ),cabinetZ=royalRear?z(-27)+.95:bedZ-1.4;
  box(x,upper+.35,bedZ,4.6,.7,6,CITY_WOOD_MATERIAL,true);
  box(x,upper+.85,bedZ,4.3,.3,5.7,linen);
  box(x,upper+1.08,bedZ+.5,4.35,.16,4.5,royalRear?new T.MeshLambertMaterial({color:alice?'#c66698':'#a52e3b'}):red);
  box(x,upper+1.7,bedZ-2.85,4.8,3.4,.3,CITY_WOOD_MATERIAL,true);
  for(const sign of [-1,1])box(x+sign*1.05,upper+1.1,bedZ-1.8,1.7,.3,1,linen);
  box(x-side*4,upper+.65,cabinetZ,1.6,1.3,1.5,CITY_WOOD_MATERIAL,true);
  if(!royalRear)box(side*49,upper+2,bedZ+5,3,4,2,CITY_WOOD_MATERIAL,true);
  // A writing table and candle in every bedroom, clear of the bed and walking route.
  const tableX=royalRear?side*49:side*47,tableZ=royalRear?z(-27)+.95:bedZ+1.5;
  box(tableX,upper+1.2,tableZ,2.4,.2,1.4,CITY_WOOD_MATERIAL,true);
  for(const dx of [-.95,.95])for(const dz of [-.5,.5])box(tableX+dx,upper+.55,tableZ+dz,.14,1.1,.14,CITY_WOOD_MATERIAL,true);
  lightPlacements.push({pack:'candle',x:tableX,y:upper+1.3,z:tableZ,height:.32,rotation:0});
  if(!royalRear){
    box(side*35,upper+.018,bedZ+4,6,.018,4,rugBorder);
    box(side*35,upper+.032,bedZ+4,5.7,.012,3.7,rugField);
  }else{
    const decor=createAliceBedroomDecor(upper,bedZ,z(-27),z(-8),[z(-23),z(-15)],(z(-15)-z(-23))*1.3/8,alice?{}:{accentColor:'#a52e3b',ownerName:'Rei'});
    if(!alice){
     // Mirror the complete furnished suite into the west wing, including physical bounds and emitters.
     decor.root.scale.x=-1;decor.root.userData.kingBedroomDecor=true;
     for(const b of decor.colliders){const min=b[0];b[0]=-b[3];b[3]=-min;}
     for(const l of decor.lights){l.x=-l.x;l.rotation=-l.rotation;if(l.group)l.group=l.group.replace('alice','king');if(l.emitterOffset)l.emitterOffset[0]*=-1;}
     for(const p of decor.props){p.x=-p.x;p.rotation=-p.rotation;p.room='kingBedroom';p.label=p.label.replace('Alice','Rei');}
     root.userData.kingBedroom={name:'Quarto do Rei',ownerName:'Rei',x:-40.5,y:upper,z:(z(-27)+z(-8))/2,width:24.6,depth:z(-8)-z(-27)-.3};
    }
    root.add(decor.root);colliders.push(...decor.colliders);lightPlacements.push(...decor.lights);propPlacements.push(...decor.props);
  }

  }
 }
 for(const side of [-1,1]){
  for(const zz of [-6,4])lightPlacements.push({pack:'wall-torch',x:side*25.85,y:ground+2.7,z:z(zz),height:1.1,rotation:-side*Math.PI/2,intensity:180,distance:42});
  lightPlacements.push({pack:'wall-torch',x:side*10,y:throne+2.7,z:back+.28,height:1.1,rotation:0,intensity:180,distance:42});
  for(const zz of [-23,-3,6])lightPlacements.push({pack:'wall-torch',x:side*26.05,y:upper+2.6,z:z(zz),height:1,rotation:-side*Math.PI/2,intensity:150,distance:36});
 }
 const library=createRoyalLibrary(ground,z(-27),z(9.2)-.15,z(0),z(-15));
 root.add(library.root);colliders.push(...library.colliders);lightPlacements.push(...library.lights);propPlacements.push(...library.props);root.userData.royalLibrary=library.room;
 const kitchen=createRoyalKitchen(ground,z(-27),front-1.3,z(2));
 root.add(kitchen.root);colliders.push(...kitchen.colliders);lightPlacements.push(...kitchen.lights);propPlacements.push(...kitchen.props);root.userData.royalKitchen=kitchen.room;
 const chandelier=createRoyalHallChandelier((z(-28.8)+front)/2);
 root.add(chandelier.root);lightPlacements.push(...chandelier.lights);
 // Match the royal rooms' timber panels and crossed beams throughout the hall
 // and beneath the upper wing floors. Solid panels retain real sun shadows.
 const timberCeiling=(left:number,right:number,rear:number,front:number,top:number)=>{
  const cx=(left+right)/2,cz=(rear+front)/2;
  box(cx,top-.08,cz,right-left,.16,front-rear,CITY_WOOD_MATERIAL);
  for(let x=left+.5;x<right;x+=4)box(x,top-.28,cz,.28,.35,front-rear,CITY_WOOD_MATERIAL);
  for(let zz=rear+.6;zz<front;zz+=4)box(cx,top-.35,zz,right-left,.25,.28,CITY_WOOD_MATERIAL);
 };
 timberCeiling(-27.8,27.8,z(-27.2),front,29.9);
 for(const side of [-1,1])timberCeiling(side<0?-52.4:27.8,side<0?-27.8:52.4,z(-27),front-1.3,upper-.32);
 // Slender columns and round arches create open bays above and below.
 const arcades:{x:number;z:number;bottom:number;top:number}[]=[];
 const count=Math.ceil((sideFront-back)/7.5);
 const pillarZ=Array.from({length:count+1},(_,i)=>back+(sideFront-back)*i/count).filter(zz=>![lowerDoorZ,z(-18),z(2)].some(door=>Math.abs(zz-door)<1.25));
 const closureEnd=(pillarZ.find(zz=>zz>platformFront)??platformFront)+.4;
 for(const side of [-1,1])box(side*24.075,(ground+upper-.3)/2,(back+closureEnd)/2,4.25,upper-.3-ground,closureEnd-back,CITY_STONE_MATERIAL,true);
 for(const side of [-1,1]){
  const x=side*22.35;
  for(const zz of pillarZ)for(const [bottom,top]of [[ground,upper-.3],[upper,30]]){
   if(bottom===ground&&zz<=closureEnd)continue;
   box(x,(bottom+top)/2,zz,.8,top-bottom,.8,CITY_MERLON_MATERIAL,true);
   box(x,bottom+.14,zz,1.1,.28,1.1,red,true);
   box(x,top-.15,zz,1.05,.3,1.05,CITY_MERLON_MATERIAL,true);
   arcades.push({x,z:zz,bottom,top});
  }
  for(let i=1;i<pillarZ.length;i++)for(const [bottom,top]of [[ground,upper-.3],[upper,30]]){
   if(bottom===ground&&pillarZ[i-1]<=platformFront)continue;
   const a=pillarZ[i-1]+.4,b=pillarZ[i]-.4,mid=(a+b)/2,radius=(b-a)/2,crown=top-(bottom===upper?2.2:1.2),spring=crown-radius;
   const shape=new T.Shape();shape.moveTo(a,spring);
   shape.absarc(mid,spring,radius,Math.PI,0,true);
   shape.lineTo(b,top);shape.lineTo(a,top);shape.closePath();
   const arch=new T.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:false,curveSegments:32});arch.rotateY(-Math.PI/2);arch.translate(x+.4,0,0);add(arch,CITY_STONE_MATERIAL);
  }
 }
 // Paired banquet tables flank the wide, unobstructed central runner.
 for(const side of [-1,1]){
  const tableX=side*10,tableZ=z(0),tableTop=ground+1.65;
  const banquetParts=new Map([...batches].map(([material,parts])=>[material,parts.length])),banquetColliderStart=colliders.length;
  box(tableX,tableTop,tableZ,4.4,.3,16,CITY_WOOD_MATERIAL,true);
  for(const dx of [-1.65,1.65])for(const dz of [-6.8,0,6.8])box(tableX+dx,ground+.75,tableZ+dz,.35,1.5,.35,CITY_WOOD_MATERIAL,true);
  // Apply the royal furniture's human scale to each complete dining set.
  const banquetMatrix=new T.Matrix4().makeTranslation(tableX,ground,tableZ)
   .multiply(new T.Matrix4().makeScale(.62,.62,.62))
   .multiply(new T.Matrix4().makeTranslation(-tableX,-ground,-tableZ));
  for(const [material,parts]of batches)for(const geometry of parts.slice(banquetParts.get(material)??0))geometry.applyMatrix4(banquetMatrix);
  for(const bounds of colliders.slice(banquetColliderStart)){
   const b=new T.Box3(new T.Vector3(bounds[0],bounds[1],bounds[2]),new T.Vector3(bounds[3],bounds[4],bounds[5])).applyMatrix4(banquetMatrix);
   bounds.splice(0,6,...b.min.toArray(),...b.max.toArray());
  }
  // Full-size sitting-room chairs, added after scaling only the table.
  // Five per side leave room for the wider upholstered seats.
  for(let i=0;i<5;i++)for(const edge of [-1,1])appendRoyalSeat(ground,tableX+edge*2.35,tableZ-3.9+i*1.95,2.6,-edge*Math.PI/2,add,colliders);
  appendRoyalSeat(ground,tableX,tableZ-5.95,2.6,0,add,colliders);
  appendRoyalSeat(ground,tableX,tableZ+5.95,2.6,Math.PI,add,colliders);


 }
 // A single ceremonial dais: three progressively smaller filled tiers.
 const daisRise=.6,zz=z(-24),tiers:{width:number;depth:number;top:number}[]=[];
 for(let i=0;i<3;i++){
  const width=8-i,depth=5-i*.6,bottom=throne+i*.2,top=bottom+.2;
  box(0,bottom+.1,zz,width,.2,depth,CITY_PLAIN_STONE_MATERIAL);
  surfaces.push([-width/2,zz-depth/2,width/2,zz+depth/2,top]);
  flight.push([-width/2,bottom,zz-depth/2,width/2,top,zz+depth/2]);
  // Red inset and golden nosing make each shrinking platform readable.
  box(0,top+.008,zz,width-.25,.016,depth-.25,red);
  for(const edge of [-1,1]){
   box(edge*(width/2-.06),top+.019,zz,.12,.022,depth,gold);
   box(0,top+.019,zz+edge*(depth/2-.06),width-.24,.022,.12,gold);
  }
  tiers.push({width,depth,top});
 }
 const daises=[{x:0,z:zz,top:throne+daisRise,steps:3,tiers}];
 const royalSeats:number[][]=[];
 for(const x of [-.8,.8]){
  const base=throne+daisRise,seatY=base+1.4*.34;
  const chairParts=new Map([...batches].map(([m,parts])=>[m,parts.length])),chairColliderStart=colliders.length;
  for(const dx of [-1.1,1.1])for(const dz of [-.75,.75])box(x+dx,base+.55,zz+dz,.2,1.1,.2,gold,true);
  box(x,base+1.1,zz,2.4,.22,1.8,gold,true);
  box(x,base+1.3,zz,2.12,.2,1.6,red);
  const backShape=new T.Shape();backShape.moveTo(-1.3,1.1);backShape.lineTo(1.3,1.1);backShape.lineTo(1.3,4.3);backShape.lineTo(.65,4.8);backShape.lineTo(0,5);backShape.lineTo(-.65,4.8);backShape.lineTo(-1.3,4.3);backShape.closePath();
  const frame=new T.ExtrudeGeometry(backShape,{depth:.28,bevelEnabled:false});frame.translate(x,base,zz-.95);add(frame,gold,true);
  const cushion=new T.Shape();cushion.moveTo(-1.06,1.4);cushion.lineTo(1.06,1.4);cushion.lineTo(1.06,4.16);cushion.lineTo(.52,4.57);cushion.lineTo(0,4.73);cushion.lineTo(-.52,4.57);cushion.lineTo(-1.06,4.16);cushion.closePath();
  const upholstery=new T.ExtrudeGeometry(cushion,{depth:.12,bevelEnabled:false});upholstery.translate(x,base,zz-.66);add(upholstery,red);
  for(const edge of [-1,1]){
   box(x+edge*1.1,base+1.6,zz+.75,.18,1,.18,gold,true);
   box(x+edge*1.1,base+2.05,zz,.2,.18,1.9,gold,true);
   const gem=new T.IcosahedronGeometry(.14,1);gem.translate(x+edge*1.1,base+2.25,zz+.75);add(gem,red);
  }
  for(const edge of [-1,0,1]){
   const y=base+(edge===0?5.25:4.7),tip=new T.ConeGeometry(.25,.65,4);tip.translate(x+edge*.98,y,zz-.8);add(tip,gold);
   const gem=new T.IcosahedronGeometry(.14,1);gem.translate(x+edge*.98,y+.43,zz-.8);add(gem,red);
  }
  // Human chair proportions: narrow seat, low cushion and a tall ceremonial back.
  const fit=new T.Matrix4().makeScale(.5,.34,.5);fit.setPosition(x*.5,base*.66,zz*.5);
  for(const [material,parts]of batches)for(const part of parts.slice(chairParts.get(material)??0))part.applyMatrix4(fit);
  for(const bounds of colliders.slice(chairColliderStart)){
   bounds[0]=x+(bounds[0]-x)*.5;bounds[3]=x+(bounds[3]-x)*.5;
   bounds[1]=base+(bounds[1]-base)*.34;bounds[4]=base+(bounds[4]-base)*.34;
   bounds[2]=zz+(bounds[2]-zz)*.5;bounds[5]=zz+(bounds[5]-zz)*.5;
  }
  royalSeats.push([x,seatY,zz+.025]);
 }
 // Continuous red runner follows the ground floor, every tread and the throne floor.
 const main=flights[0],runnerWidth=6;
 const carpetStrip=(a:number,b:number,y:number)=>{
  box(0,y+.012,(a+b)/2,runnerWidth,.024,Math.abs(b-a),red);
  for(const side of [-1,1])box(side*(runnerWidth/2-.09),y+.032,(a+b)/2,.18,.016,Math.abs(b-a),gold);
 };
 carpetStrip(main.start[2],front+.2,ground);
 const run=(main.start[2]-main.end[2])/main.count;
 for(let i=0;i<main.count;i++){
  const frontZ=main.start[2]-i*run,backZ=frontZ-run;
  const low=ground+(throne-ground)*i/main.count,high=ground+(throne-ground)*(i+1)/main.count;
  carpetStrip(backZ,frontZ,high);
  box(0,(low+high)/2,frontZ+.012,runnerWidth,high-low,.024,red);
  for(const side of [-1,1]){
   // Close the stair nosing between the horizontal and vertical edging.
   box(side*(runnerWidth/2-.09),(low+high+.024)/2,frontZ+.031,.18,high-low+.024,.014,gold);
   box(side*(runnerWidth/2-.09),high+.032,frontZ+.012,.18,.016,.024,gold);
  }
 }
 const throneCarpet={left:-7,right:7,back:z(-27.18),front:z(-21)};
 carpetStrip(throneCarpet.front,platformFront,throne);
 box(0,throne+.012,(throneCarpet.back+throneCarpet.front)/2,14,.024,throneCarpet.front-throneCarpet.back,red);
 for(const side of [-1,1])box(side*6.91,throne+.032,(throneCarpet.back+throneCarpet.front)/2,.18,.016,throneCarpet.front-throneCarpet.back,gold);
 box(0,throne+.032,throneCarpet.back+.09,13.64,.016,.18,gold);
 for(const side of [-1,1]){
  // Edge strips meet flush; the inset square closes each concave corner.
  box(side*4.91,throne+.032,throneCarpet.front-.09,3.82,.016,.18,gold);
  box(side*2.91,throne+.032,throneCarpet.front-.09,.18,.016,.18,gold);
 }
 const carpet={borderColor:'#c5a45a',width:runnerWidth,entryZ:front+.2,throneZ:throneCarpet.back,stairTreads:main.count,throneRectangle:throneCarpet};
 for(const [material,parts]of batches){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!g)continue;const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;if(material===hallPaving)mesh.userData.cityPaving=true;root.add(mesh);}
 root.userData.cityObject=true;
 root.userData.stoneBalustrades=balustrades;
 return {root,lightPlacements,propPlacements,surfaces,colliders,flight,flights,throne,upper,branchZ,doorZ,carpet,daises,arcades,royalSeats,closedGalleryRear:{back,front:closureEnd,bottom:ground,top:upper-.3},gallerySides:[[-26.2,back,-22,sideFront],[22,back,26.2,sideFront]],banquetHalls:[-1,1].map(side=>({x:side*10,y:ground,z:z(0),seats:12})),filledHall:{left:-halfHall,right:halfHall,back,front:platformFront,bottom:ground,top:throne},bedrooms:[-1,1].flatMap(side=>[[-27,-8],[-8,9.2]].map(([a,b])=>({x:side*40.5,y:upper,z:(z(a)+z(b))/2,width:24.6,depth:z(b)-z(a)-.3}))),royalPositions:[[-.8,throne+daisRise,z(-24)],[.8,throne+daisRise,z(-24)]]};
}
