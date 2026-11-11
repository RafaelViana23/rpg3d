import { createPrincessPalaceLayout } from './PrincessPalaceRoutine';
import {createRoyalPalaceInterior} from './RoyalPalaceInterior';
import {cityStairGeometry} from './CityStairs';
import palaceLayout from './royal-palace-layout.json';
import type { SavedCityObject } from './WorldEditorSupport';
import type { LowPolyCityBuilder } from './LowPolyCityBuilder';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_MERLON_MATERIAL,CITY_PLAIN_STONE_MATERIAL,CITY_STONE_MATERIAL,CITY_STONE_LIGHT_MATERIAL} from './CityStone';
import {cityPavingMaterial,alignCityPavingUV} from '../world/CityPaving';

export const ROYAL_PRECINCT={halfWidth:66,back:-46.4,front:57,plazaHeight:6,palaceHeight:6,wallTop:18,portalWidth:20,portalHeight:12*3.14/2.39};
/** Terraced royal plaza with a broad halfway landing before the palace. */
// City wall walk: 14 + 6.225 * 3.75 = 37.34375; palace origin is at 18.
export const ROYAL_PALACE_ELEVATION=13.26375;
export function createRoyalPalace(elevation=ROYAL_PALACE_ELEVATION){
 const root=new T.Group();root.name='Cidade:palace';
 const plazaFloor=elevation>0?(6.08+elevation)/2:6.08,plazaLift=plazaFloor-6.08;
 const stone=CITY_STONE_MATERIAL,trim=CITY_STONE_LIGHT_MATERIAL;
 const slate=CITY_MERLON_MATERIAL,gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.4}),red=new T.MeshLambertMaterial({color:'#722b35'}),glass=new T.MeshLambertMaterial({color:'#334750'});
 const paving=cityPavingMaterial().clone();paving.color.set('#c6c9c7');
 const halfDeck=ROYAL_PRECINCT.halfWidth,wallX=halfDeck-1.25,frontWallZ=55.75;
 const towerSites:{x:number;z:number;height:number}[]=[];
 const batches=new Map<T.Material,T.BufferGeometry[]>(),colliders:number[][]=[],flight:number[][]=[],surfaces:number[][]=[],roofs:number[][]=[];
 const add=(geometry:T.BufferGeometry,material:T.Material,solid=false)=>{
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
  if(solid){g.computeBoundingBox();const b=g.boundingBox!;colliders.push([...b.min.toArray(),...b.max.toArray()]);}
  const list=batches.get(material)??[];list.push(g);batches.set(material,list);
 };
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material=stone,solid=true)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m,solid);};
 const floor=(x:number,z:number,w:number,d:number,y:number)=>{
  const base=y-.24;
  // Portal bases and arch undersides sit at 6: keep the finished paving above them.
  if(y===6)y=6.08;else if(y===12)y=12.06;
  const top=y-.01;box(x,(base+top)/2,z,w,top-base,d,stone,false);const g=new T.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);g.translate(x,y,z);add(g,paving);surfaces.push([x-w/2,z-d/2,x+w/2,z+d/2,y]);};
 const crenels=(x:number,z:number,length:number,y:number,alongX=true)=>{
  const count=Math.max(2,Math.floor(length/2.5));
  box(x,y-.55,z,alongX?length:.8,1.1,alongX?.8:length,slate);
  for(let i=0;i<count;i++){const offset=-length/2+(i+.5)*length/count;box(x+(alongX?offset:0),y+.35,z+(alongX?0:offset),alongX?1.2:1,1.1,alongX?1:1.2,CITY_MERLON_MATERIAL);}
 };
 const tower=(x:number,z:number,base:number,height:number,radius:number)=>{
  towerSites.push({x,z,height:base+height});
  // The enclosure is lifted with the plaza, but tower masonry must still reach city ground.
  const bottom=-plazaLift,bodyTop=base+height;
  const g=new T.CylinderGeometry(radius,radius+.4,bodyTop-bottom,16);g.translate(x,(bottom+bodyTop)/2,z);add(g,stone,true);
  const top=base+height;const lip=new T.CylinderGeometry(radius+.7,radius+.3,.7,16);lip.translate(x,top-.1,z);add(lip,slate);
  for(let i=0;i<16;i++){const a=i*Math.PI/8;box(x+Math.sin(a)*radius,top+.85,z+Math.cos(a)*radius,1.25,1.5,1.25,CITY_MERLON_MATERIAL);}
  const cap=new T.CylinderGeometry(radius-.2,radius-.2,.25,16);cap.translate(x,top+.12,z);add(cap,slate);
 };
 const stairs=(front:number,back:number,width:number,from:number,to:number)=>{
  const count=Math.max(24,Math.ceil((to-from)/.25)),run=(front-back)/count;
  // Cut the final stone tread off at the landing; the paved floor owns this bay.
  const rise=(to-from)/count;
  add(cityStairGeometry(front,back+run,width,from,to-rise,count-1),CITY_PLAIN_STONE_MATERIAL);
  floor(0,back+run/2,width,run,to);
  for(let i=0;i<count;i++){
   const y=from+rise*(i+1),z=front-(i+.5)*run;
   surfaces.push([-width/2,z-run/2,width/2,z+run/2,y]);flight.push([-width/2,from-.3,z-run/2,width/2,y,z+run/2]);
  }
 };
 // The upper footprint follows the palace, leaving the plaza open on both sides.
 const upperFront=10.8,upperBack=ROYAL_PRECINCT.back,centralHalf=27.8,wingOuter=54,wingFront=10.8;
 box(0,2.88,(ROYAL_PRECINCT.back+57)/2,halfDeck*2,5.76,57-ROYAL_PRECINCT.back,stone,false);
 floor(0,(wingFront+57)/2,halfDeck*2,57-wingFront,6);
 colliders.push([-halfDeck,0,ROYAL_PRECINCT.back,halfDeck,6,57]);
 floor(0,(upperBack+upperFront)/2,halfDeck*2,upperFront-upperBack,6);
 if(elevation===0)stairs(77,57,ROYAL_PRECINCT.portalWidth,0,6);
 // Buttressed royal enclosure and crenellated entrance gate.
 for(const sign of [-1,1]){
  const frontLength=halfDeck-28,frontCenter=(halfDeck+28)/2;
  box(sign*frontCenter,9,frontWallZ,frontLength,18,2.5);crenels(sign*frontCenter,frontWallZ,frontLength,18);
  box(sign*wallX,9,9.5,2.5,18,95);crenels(sign*wallX,9.5,95,18,false);
  tower(sign*24,frontWallZ,0,32,5.8);
  tower(sign*wallX,frontWallZ,0,32,5.5);
 }
 // Rear enclosure is provided by the city wall.
 const gate=new T.Shape();gate.moveTo(-19,0);gate.lineTo(19,0);gate.lineTo(19,21);gate.lineTo(-19,21);gate.closePath();
 const arch=new T.Path();arch.moveTo(-10,0);arch.lineTo(-10,6);arch.absarc(0,6,10,Math.PI,0,true);arch.lineTo(10,0);arch.closePath();gate.holes.push(arch);
 const gateGeometry=new T.ExtrudeGeometry(gate,{depth:3,bevelEnabled:false,curveSegments:16});gateGeometry.translate(0,6,54);add(gateGeometry,stone);
 colliders.push([-19,0,54,-10,27,57],[10,0,54,19,27,57],[-10,22,54,10,27,57]);
 for(const sign of [-1,1])box(sign*14.5,3,55.5,9,6,3);
 crenels(0,55.5,38,27);
 for(const x of [-15,15]){box(x,20,57.1,3,8,.15,red,false);box(x,24.4,57.3,3.6,.3,.4,gold,false);}
 // Plaza stands halfway between the city floor and the palace main floor.
 if(elevation>0){
  for(const parts of batches.values())for(const part of parts)part.translate(0,plazaLift,0);
  for(const bounds of [...colliders,...flight]){bounds[1]+=plazaLift;bounds[4]+=plazaLift;}
  for(const surface of surfaces)surface[4]+=plazaLift;
  for(const site of towerSites)site.height+=plazaLift;
  const raisedFloor=plazaFloor,foundationTop=raisedFloor-.24;
  box(0,foundationTop/2,(ROYAL_PRECINCT.back+57)/2,halfDeck*2,foundationTop,57-ROYAL_PRECINCT.back,stone,false);
  colliders.push([-halfDeck,0,ROYAL_PRECINCT.back,halfDeck,raisedFloor-.35,57]);
  stairs(77,58,ROYAL_PRECINCT.portalWidth,0,raisedFloor);
  floor(0,57.5,ROYAL_PRECINCT.portalWidth,1,raisedFloor);
 }
 // Keep: central hall and wings; only the front fortification has round towers.
 // Stretch only the royal building; the plaza, gateway and round towers stay fixed.
 const keepBack=-46.4,keepFront=22.8,keepScale=(keepFront-keepBack)/(10.8-(-28.8));
 const accessMidpoint=(47+keepFront)/2,accessLandingDepth=8;
 const accessLandingFront=accessMidpoint+accessLandingDepth/2,accessLandingBack=accessMidpoint-accessLandingDepth/2;
 const intermediatePlazaFloor=(plazaFloor+6.08+elevation)/2;
 const keepZ=(z:number)=>keepBack+(z+28.8)*keepScale;
 const roomDoorWidth=2.2,roomDoorHalf=roomDoorWidth/(2*keepScale);
 const keepTransform=new T.Matrix4().makeScale(1,1,keepScale);
 keepTransform.setPosition(0,0,keepZ(0));
 const keepBatchStart=new Map([...batches].map(([material,parts])=>[material,parts.length]));
 const keepColliderStart=colliders.length,keepSurfaceStart=surfaces.length;

 const hallTop=30;
 for(const sign of [-1,1]){
  const wallBand=(bottom:number,top:number,doors:number[])=>{
   let cursor=-28;
   for(const centre of doors){
    const left=centre-roomDoorHalf,right=centre+roomDoorHalf;
    if(left>cursor)box(sign*27,(bottom+top)/2,(cursor+left)/2,1.6,top-bottom,left-cursor);
    cursor=right;
   }
   if(cursor<10)box(sign*27,(bottom+top)/2,(cursor+10)/2,1.6,top-bottom,10-cursor);
  };
  // Recess the supporting wall below the upper paving at bedroom doorways.
  wallBand(6,10.5,[0]);wallBand(10.5,16.05,[]);
  wallBand(16.08,20.5,[-18,2]);wallBand(20.5,30,[]);
 }
 // Real arched rear opening: sunlight passes through the masonry, without a window light.
 const rearWall=new T.Shape();rearWall.moveTo(-27,6);rearWall.lineTo(27,6);rearWall.lineTo(27,30);rearWall.lineTo(-27,30);rearWall.closePath();
 const rearOpening=new T.Path();rearOpening.moveTo(-6.65,10.08);rearOpening.lineTo(-6.65,20);rearOpening.absarc(0,20,6.65,Math.PI,0,true);rearOpening.lineTo(6.65,10.08);rearOpening.closePath();rearWall.holes.push(rearOpening);
 const rearGeometry=new T.ExtrudeGeometry(rearWall,{depth:1.6,bevelEnabled:false,curveSegments:48});rearGeometry.translate(0,0,-28.8);add(rearGeometry,stone);
 colliders.push([-27,6,-28.8,-6.65,30,-27.2],[6.65,6,-28.8,27,30,-27.2],[-6.65,6,-28.8,6.65,10.08,-27.2]);
 for(let i=0;i<28;i++){const a=-6.65+i*(13.3/28),b=a+13.3/28,y=20+Math.sqrt(Math.max(0,44.2225-Math.max(a*a,b*b)));colliders.push([a,y,-28.8,b,30,-27.2]);}
 const windowGlass=new T.MeshStandardMaterial({color:'#ffe4a3',transparent:true,opacity:.16,roughness:.25,depthWrite:false,side:T.DoubleSide});
 const paneShape=new T.Shape();paneShape.moveTo(-6.65,10.08);paneShape.lineTo(6.65,10.08);paneShape.lineTo(6.65,20);paneShape.absarc(0,20,6.65,0,Math.PI,false);paneShape.closePath();
 const pane=new T.ShapeGeometry(paneShape,48);pane.translate(0,0,-27.18);add(pane,windowGlass);
 for(const x of [-6.825,6.825])box(x,15.04,-27.1,.35,9.92,.3,gold);
 box(0,10.23,-27.1,14,.3,.3,gold);
 const crown=new T.TorusGeometry(6.825,.175,8,64,Math.PI);crown.translate(0,20,-27.1);add(crown,gold);
 for(const x of [-3.5,0,3.5]){const top=20+Math.sqrt(44.2225-x*x);box(x,(10.08+top)/2,-27.08,.12,top-10.08,.18,gold);}
 for(const y of [14,17,20,23]){const width=y<=20?13.3:2*Math.sqrt(44.2225-(y-20)*(y-20));box(0,y,-27.08,width,.12,.18,gold);}
 const rose=new T.TorusGeometry(4.6,.12,6,48);rose.translate(0,20,-27.03);add(rose,gold);
 // Oval opening belongs to the palace facade, not the plaza gate.
 const palaceFront=new T.Shape();palaceFront.moveTo(-27,0);palaceFront.lineTo(27,0);palaceFront.lineTo(27,24);palaceFront.lineTo(-27,24);palaceFront.closePath();
 const doorHeight=ROYAL_PRECINCT.portalHeight,spring=doorHeight*.66,rise=doorHeight*.34;
 const opening=new T.Path();opening.moveTo(-6,0);opening.lineTo(-6,spring);opening.absellipse(0,spring,6,rise,Math.PI,0,true,0);opening.lineTo(6,0);opening.closePath();palaceFront.holes.push(opening);
 const facade=new T.ExtrudeGeometry(palaceFront,{depth:1.6,bevelEnabled:false,curveSegments:32});facade.translate(0,6,9.2);add(facade,stone);
 colliders.push([-27,6,9.2,-6,30,10.8],[6,6,9.2,27,30,10.8]);
 for(let i=0;i<24;i++){const x0=-6+i*.5,x1=x0+.5,y=6+spring+rise*Math.sqrt(Math.max(0,1-Math.max(x0*x0,x1*x1)/36));colliders.push([x0,y,9.2,x1,30,10.8]);}
 for(const sign of [-1,1]){
  // Hollow rooms, continuous floors and roofs; no solid decorative blocks.
  {
    // The princess's windows face east, through the exterior wall, not into the gallery.
    let cursor=-28.8;
    for(const center of (sign===1?[-23,-15,2]:[-23,-15])){
      const a=center-1.3,b=center+1.3,bottom=17.35,top=22.3;
      box(sign*53.2,15,(cursor+a)/2,1.6,18,a-cursor);
      if(center===-15||(sign===1&&center===2)){
       box(sign*53.2,6.8,center,1.6,1.6,b-a);
       box(sign*53.2,(11.4+bottom)/2,center,1.6,bottom-11.4,b-a);
       box(sign*53.2,9.5,center,.025,3.8,b-a,windowGlass,true);
       for(const edge of [a,b])box(sign*52.34,9.5,edge,.16,3.95,.14,gold,false);
       for(const y of [7.6,11.4])box(sign*52.34,y,center,.2,.14,b-a+.2,gold,false);
       box(sign*52.34,9.5,center,.16,3.8,.10,gold,false);
       box(sign*52.34,9.5,center,.16,.10,b-a,gold,false);
      }else{
      box(sign*53.2,(6+bottom)/2,center,1.6,bottom-6,b-a);
      }
      box(sign*53.2,(top+24)/2,center,1.6,24-top,b-a);
      box(sign*53.2,(bottom+top)/2,center,.025,top-bottom,b-a,windowGlass,true);
      for(const edge of [a,b])box(sign*52.34,(bottom+top)/2,edge,.16,top-bottom+.25,.14,gold,false);
      for(const y of [bottom,top])box(sign*52.34,y,center,.25,.15,b-a+.3,gold,false);
      box(sign*53.2,(bottom+top)/2,center,.10,top-bottom,.08,gold,false);
      box(sign*53.2,19.7,center,.10,.09,b-a,gold,false);
      cursor=b;
    }
    box(sign*53.2,15,(cursor+10.8)/2,1.6,18,10.8-cursor);
  }
  box(sign*40.5,15,-28,27,18,1.6);
  {
   // Real front-facing sitting-room window; preserve the lower-storey masonry.
   const cx=sign*40.5,w=4.4,bottom=17.35,top=22.3;
   for(const [a,b] of [[sign<0?-54:27,cx-w/2],[cx+w/2,sign<0?-27:54]])box((a+b)/2,15,10,b-a,18,1.6);
   box(cx,(6+bottom)/2,10,w,bottom-6,1.6);
   box(cx,(top+24)/2,10,w,24-top,1.6);
   box(cx,(bottom+top)/2,10,w,top-bottom,.025,windowGlass,true);
   for(const x of [cx-w/2,cx+w/2])box(x,(bottom+top)/2,9.16,.14,top-bottom+.2,.16,gold,false);
   for(const y of [bottom,top])box(cx,y,9.16,w+.3,.14,.16,gold,false);
   box(cx,(bottom+top)/2,10,.10,top-bottom,.10,gold,false);
   box(cx,19.7,10,w,.10,.10,gold,false);
  }
  box(sign*40.5,24,-9,27,.8,39.6,slate);
  crenels(sign*40.5,10.3,27,25);crenels(sign*40.5,-28.3,27,25);crenels(sign*53.5,-9,39.6,25,false);
  roofs.push([Math.min(sign*27,sign*54),24,-28.8,Math.max(sign*27,sign*54),24,10.8]);
 }
 // Actual roof closes the hall against sunlight; broad cornices tie the wings together.
 box(0,hallTop+.5,-9,55.6,1,39.6,slate);roofs.push([-27.8,30,-28.8,27.8,30,10.8]);
 for(const z of [-28.3,10.3])crenels(0,z,55.6,31);
 for(const x of [-27.3,27.3])crenels(x,-9,37.6,31,false);
 // Start the upper tower on the roof top, not on its interior ceiling face.
 // Its textured bottom must never coincide with the smooth ceiling at y=30.
 box(0,37.5,-12,24,13,20);box(0,44,-12,27,1,23,slate);
 for(const z of [-23,-1])crenels(0,z,27,45);for(const x of [-13,13])crenels(x,-12,23,45,false);
 for(const sign of [-1,1])for(const x of [10,20])for(const y of [13,23]){
  box(sign*x,y,10.9,3.1,6,.35,trim,false);box(sign*x,y,11.12,2.1,4.8,.16,glass,false);
 }
 for(const sign of [-1,1])for(const z of [-20,-8,4]){
  box(sign*54.1,16,z,.3,5.6,2.8,trim,false);box(sign*54.3,16,z,.12,4.5,1.8,glass,false);
 }
 for(const x of [-15,15]){box(x,23,11.1,3,9,.15,red,false);box(x,27.8,11.2,3.6,.3,.4,gold,false);}
 // Apply the same extension to visible surfaces and all physical/support bounds.
 for(const [material,parts]of batches)for(const part of parts.slice(keepBatchStart.get(material)??0))part.applyMatrix4(keepTransform).translate(0,elevation,0);
 for(const bounds of colliders.slice(keepColliderStart)){bounds[2]=keepZ(bounds[2]);bounds[5]=keepZ(bounds[5]);bounds[1]+=elevation;bounds[4]+=elevation;}
 for(const surface of surfaces.slice(keepSurfaceStart)){surface[1]=keepZ(surface[1]);surface[3]=keepZ(surface[3]);}
 for(const roof of roofs){roof[2]=keepZ(roof[2]);roof[5]=keepZ(roof[5]);roof[1]+=elevation;roof[4]+=elevation;}
 const terraceBalustrades:{axis:'x'|'z';fixed:number;from:number;to:number;bottom:number;height:number;columns:number}[]=[];
 const interior=createRoyalPalaceInterior(keepZ,keepFront);
 if(elevation>0){
  const raisedFloor=6.08+elevation,top=raisedFloor-.24;
  box(0,(plazaFloor+top)/2,(keepBack+keepFront)/2,108,top-plazaFloor,keepFront-keepBack,stone,false);
  colliders.push([-54,plazaFloor,keepBack,54,raisedFloor,keepFront]);
  floor(0,(keepBack+keepFront)/2,108,keepFront-keepBack,raisedFloor);
  // A full-width stone terrace interrupts the long exterior stair at half height.
  // Its foundation stops below the paving and never blocks either stair flight.
  const terraceTop=intermediatePlazaFloor-.24,terraceDepth=accessLandingFront-keepFront;
  box(0,(plazaFloor+terraceTop)/2,(keepFront+accessLandingFront)/2,108,terraceTop-plazaFloor,terraceDepth,stone,false);
  colliders.push([-54,plazaFloor,keepFront,54,intermediatePlazaFloor-.35,accessLandingFront]);
  floor(0,(keepFront+accessLandingFront)/2,108,terraceDepth,intermediatePlazaFloor);
  stairs(47,accessLandingFront,12,plazaFloor,intermediatePlazaFloor);
  stairs(accessLandingBack,keepFront,12,intermediatePlazaFloor,raisedFloor);
  const concrete=stone;
  const railNewels=new Set<string>();
  const balustrade=(axis:'x'|'z',fixed:number,from:number,to:number)=>{
   const length=to-from,centre=(from+to)/2,y=intermediatePlazaFloor,height=1.5;
   const piece=(along:number,bottom:number,w:number,h:number,d:number)=>box(axis==='x'?along:fixed,y+bottom+h/2,axis==='x'?fixed:along,axis==='x'?w:d,h,axis==='x'?d:w,concrete,false);
   // Continuous plinth and capped handrail, with tapered Doric miniature columns.
   piece(centre,0,length,.18,.48);piece(centre,1.28,length,.16,.42);piece(centre,1.44,length+.12,.06,.54);
   const count=Math.max(2,Math.ceil(length/.85));
   for(let i=1;i<count;i++){
    const along=from+length*i/count;
    piece(along,.18,.34,.1,.34);piece(along,1.16,.34,.12,.34);
    const shaft=new T.CylinderGeometry(.105,.14,.88,10);
    shaft.translate(axis==='x'?along:fixed,y+.72,axis==='x'?fixed:along);add(shaft,concrete);
   }
   for(const along of [from,to]){
    const key=`${axis==='x'?along:fixed},${axis==='x'?fixed:along}`;
    if(railNewels.has(key))continue;railNewels.add(key);
    piece(along,0,.62,.18,.62);piece(along,.18,.4,1.22,.4);piece(along,1.4,.66,.18,.66);
   }
   colliders.push(axis==='x'?[from-.33,y,fixed-.33,to+.33,y+height+.08,fixed+.33]:[fixed-.33,y,from-.33,fixed+.33,y+height+.08,to+.33]);
   terraceBalustrades.push({axis,fixed,from,to,bottom:y,height,columns:count-1});
  };
  // Leave the full twelve-metre stair opening plus clearance for its end posts.
  const railFront=accessLandingFront-.36,railSide=54-.36,stairClearance=6.7;
  balustrade('x',railFront,-railSide,-stairClearance);
  balustrade('x',railFront,stairClearance,railSide);
  for(const side of [-1,1])balustrade('z',side*railSide,keepFront+.36,railFront);

 }
 interior.root.position.y=elevation;
 for(const bounds of [...interior.colliders,...interior.flight]){bounds[1]+=elevation;bounds[4]+=elevation;}
 for(const surface of interior.surfaces)surface[4]+=elevation;
 for(const path of interior.flights){path.start[1]+=elevation;path.end[1]+=elevation;}
 for(const position of [...interior.royalPositions,...interior.royalSeats])position[1]+=elevation;
 for(const column of interior.arcades){column.bottom+=elevation;column.top+=elevation;}
 for(const room of interior.bedrooms)room.y+=elevation;
 for(const hall of interior.banquetHalls)hall.y+=elevation;
 for(const dais of interior.daises){dais.top+=elevation;for(const tier of dais.tiers)tier.top+=elevation;}
 interior.filledHall.bottom+=elevation;interior.filledHall.top+=elevation;
 interior.throne+=elevation;interior.upper+=elevation;
 root.add(interior.root);colliders.push(...interior.colliders);flight.push(...interior.flight);surfaces.push(...interior.surfaces);
 for(const [material,parts]of batches){
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)throw Error('Royal masonry merge failed');
  if(material===paving)alignCityPavingUV(geometry);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;
  if(material===windowGlass){mesh.castShadow=false;mesh.userData.noFireShadow=true;}
  mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;if(material===paving)mesh.userData.cityPaving=true;root.add(mesh);
 }
 root.userData.cityObject=true;root.userData.palaceComplex=true;root.userData.building={width:132,depth:116,height:52+elevation,doorWidth:20,doorHeight:ROYAL_PRECINCT.portalHeight,enterable:true,storeys:2};
 root.userData.royalGate={y:6+elevation,z:keepZ(10.92),width:12,height:ROYAL_PRECINCT.portalHeight,label:'portão do palácio'};
 root.userData.localColliders=colliders;root.userData.localFlightColliders=flight;root.userData.walkSurfaces=surfaces;root.userData.walkStepHeight=.3;
 root.userData.weatherRoofs=roofs;root.userData.npcRoyalPositions=interior.royalPositions;root.userData.npcRoyalSeats=interior.royalSeats;root.userData.npcRoyalDaughterPosition=[2.3,interior.royalPositions[1][1],interior.royalPositions[1][2]+.5];root.userData.royalArcades=interior.arcades;root.userData.closedGalleryRear=interior.closedGalleryRear;
 root.userData.npcGuardPosts=[[-13,plazaFloor,53],[13,plazaFloor,53],[-18,plazaFloor,46],[18,plazaFloor,46],[-12,elevation>0?intermediatePlazaFloor:plazaFloor,keepFront+3.2],[12,elevation>0?intermediatePlazaFloor:plazaFloor,keepFront+3.2]];
 root.userData.wingConnections=[{side:-1,x:-27,z:keepZ(-18),width:roomDoorWidth,height:4.42,floor:interior.upper},{side:1,x:27,z:keepZ(-18),width:roomDoorWidth,height:4.42,floor:interior.upper}];
 root.userData.royalSittingRoom={...interior.root.userData.royalSittingRoom,y:interior.upper};
 root.userData.royalLibrary={...interior.root.userData.royalLibrary,y:6.08+elevation};
 root.userData.royalKitchen={...interior.root.userData.royalKitchen,y:6.08+elevation};
 root.userData.royalStudy={...interior.root.userData.royalStudy,y:interior.upper};
 root.userData.npcSeats=(interior.root.userData.royalStudySeats??[]).map((s:{x:number;y:number;z:number;rotation:number})=>({...s,y:s.y+elevation}));
 root.userData.kingBedroom={...interior.root.userData.kingBedroom,y:interior.upper};
 interior.bedrooms[0]=Object.assign(interior.bedrooms[0],{name:'Quarto do Rei',ownerName:'Rei'});
 root.userData.upperBedroom=interior.bedrooms[2];
 root.userData.royalBedrooms=interior.bedrooms;
 root.userData.princessPalace=createPrincessPalaceLayout(keepZ,interior.upper,interior.throne,interior.flights,root.userData.npcRoyalDaughterPosition,plazaFloor);
 root.userData.palacePropPlacements=interior.propPlacements.map(p=>({...p,y:p.y+elevation}));
 root.userData.palaceLightPlacements=interior.lightPlacements.map(p=>({...p,y:p.y+elevation}));
 root.userData.princessBedroom=root.userData.princessPalace.room;
 root.userData.princessExteriorWindows=[-23,-15].map(z=>({x:53.2,z:keepZ(z),bottom:17.35+elevation,top:22.3+elevation,width:2.6*keepScale,facing:'east'}));
 root.userData.princessBed=root.userData.princessPalace.bed;
 interior.bedrooms[2]=Object.assign(interior.bedrooms[2],{name:'Quarto de Alice',ownerName:'Alice'});
 root.userData.royalInterior={flights:interior.flights,throneLevel:interior.throne,galleryLevel:interior.upper,gallerySides:interior.gallerySides,filledHall:interior.filledHall};
 root.userData.royalRoomDoors=[-1,1].flatMap(side=>[
  ...[-18,2].map((zz,index)=>({axis:'x',wallDepth:1.6,openAngle:-side*Math.PI/2,x:side*27,y:interior.upper,z:keepZ(zz),width:roomDoorWidth,height:4.42,label:side===1&&index===0?'Quarto de Alice':side===-1&&index===0?'Quarto do Rei':side===1?'Sala de estar real':'Escritório do Rei Rito'})),
  {axis:'x',wallDepth:1.6,openAngle:-side*Math.PI/2,x:side*27,y:6.08+elevation,z:keepZ(0),width:roomDoorWidth,height:4.42,label:side<0?'Biblioteca Real':'Cozinha principal do castelo'},
 ]);
 root.userData.royalBanquetHalls=interior.banquetHalls;root.userData.royalCarpet=interior.carpet;root.userData.throneDaises=interior.daises;
 root.userData.royalWindow={x:0,z:keepZ(-27.18),width:14,bottom:10.08+elevation,top:26.65+elevation};
 root.userData.frontWallLine={z:57,base:0,top:18};
 root.userData.enclosureWalls=[{axis:'x',position:-wallX,from:-38,to:57,bottom:0,top:18},{axis:'x',position:wallX,from:-38,to:57,bottom:0,top:18},{axis:'z',position:frontWallZ,from:-halfDeck,to:-28,bottom:0,top:18},{axis:'z',position:frontWallZ,from:28,to:halfDeck,bottom:0,top:18}];
 root.userData.cornerTowers=[[-wallX,frontWallZ],[wallX,frontWallZ]];
 root.userData.exteriorStairBorders=false;
 root.userData.rearEnclosure='city-wall';root.userData.stairBorder={front:77,back:57,width:20};
 root.userData.deckEdges={left:-halfDeck,right:halfDeck,front:57,back:ROYAL_PRECINCT.back};
 root.userData.stairFlights=[{front:77,back:57,width:ROYAL_PRECINCT.portalWidth,bottom:0,top:elevation>0?plazaFloor:6}];
 root.userData.towerSites=towerSites;
 root.userData.palaceFloorElevation=6.08+elevation;
 root.userData.plazaFloorElevation=plazaFloor;
 root.userData.palaceAccessStairs=elevation>0?{front:47,back:keepFront,width:12,bottom:plazaFloor,top:6.08+elevation}:null;
 root.userData.terraceBalustrades=terraceBalustrades;
 root.userData.intermediatePlaza=elevation>0?{left:-54,right:54,front:accessLandingFront,back:keepFront,height:intermediatePlazaFloor,landingFront:accessLandingFront,landingBack:accessLandingBack,landingDepth:accessLandingDepth}:null;
 root.userData.palaceAccessFlights=elevation>0?[{front:47,back:accessLandingFront,width:12,bottom:plazaFloor,top:intermediatePlazaFloor},{front:accessLandingBack,back:keepFront,width:12,bottom:intermediatePlazaFloor,top:6.08+elevation}]:[];
 root.userData.palaceExtension={back:keepBack,front:keepFront,depth:keepFront-keepBack};
 root.userData.upperTerrace={centralHalf,wingOuter,front:keepFront,back:keepBack,wingFront:keepFront,wallFront:keepFront};
 root.userData.lateralPlaza={left:[-halfDeck,-wingOuter],right:[wingOuter,halfDeck],from:upperBack,to:keepFront,height:plazaFloor};
 return root;
}

/** Enlarge the existing palace once while retaining later Build edits. */
export function applyRoyalPalaceLayout(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
 if(saved[palaceLayout.palaceId]?.palaceComplexRevision===1)return false;
 if(!saved[palaceLayout.palaceId])return false;
 for(const [id,value]of Object.entries(palaceLayout.moves)){
  const entry=structuredClone(value) as SavedCityObject;
  if(!saved[id])continue;
  saved[id]=entry;
  const object=builder.objects.get(id);
  if(id==='city-royal-avenue-v1'){
   object?.removeFromParent();builder.objects.delete(id);builder.add(entry);
  }else if(object){object.position.fromArray(entry.position);object.rotation.set(entry.rotation[0],entry.rotation[1],entry.rotation[2]);object.scale.fromArray(entry.scale);}
  else builder.add(entry);
 }
 return true;
}

/** Finish the straight boulevard exactly at the foot of the centered stairs. */
export function alignRoyalAvenueEntrance(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
 const road=saved['city-royal-avenue-v1'],palace=saved[palaceLayout.palaceId];
 if(!road||!palace||road.palaceEntranceRevision===1)return false;
 const matrix=(s:SavedCityObject)=>new T.Matrix4().compose(new T.Vector3(s.position[0],s.position[1],s.position[2]),new T.Quaternion().setFromEuler(new T.Euler(s.rotation[0],s.rotation[1],s.rotation[2])),new T.Vector3(s.scale[0],s.scale[1],s.scale[2]));
 const foot=new T.Vector3(0,0,77).applyMatrix4(matrix(palace)).applyMatrix4(matrix(road).invert());
 road.points![1]=[0,.09,foot.z];road.palaceEntranceRevision=1;
 builder.objects.get(road.id)?.removeFromParent();builder.objects.delete(road.id);builder.add(road);
 return true;
}
