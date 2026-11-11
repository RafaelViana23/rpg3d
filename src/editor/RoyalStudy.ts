import {appendRoyalSeat} from './RoyalSeat';
import {DEFAULT_CONFIG,ProceduralCharacter} from '../character';
import {GUARD_ARMOR,armorColor} from '../inventory/armorMaterials';
import {ITEM_BY_ID} from '../inventory/catalog';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL as wood} from './CityWood';
import {appendRoyalPainting,appendRoyalBookcase,appendRoyalChandelier,appendRoyalWoodCeiling} from './RoyalRoomDetails';

/** West front suite: private study, with the gallery approach kept open. */
export function createRoyalStudy(floor:number,back:number,front:number){
 const root=new T.Group();root.name='Escritório particular do Rei Rito';
 const batches=new Map<T.Material,T.BufferGeometry[]>(),colliders:number[][]=[];
 const wine=new T.MeshLambertMaterial({color:'#722b35'}),paper=new T.MeshLambertMaterial({color:'#e5d8bf'});
 const gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.75,roughness:.3});
 const iron=new T.MeshStandardMaterial({color:'#353237',metalness:.8,roughness:.45});
 const green=new T.MeshLambertMaterial({color:'#64734a'}),blue=new T.MeshLambertMaterial({color:'#526c79'});
 const center=(back+front)/2,deskZ=center-1.5;
 let deskScale=false;
 const deskMatrix=new T.Matrix4().makeTranslation(40,floor,deskZ).multiply(new T.Matrix4().makeScale(.62,.62,.62)).multiply(new T.Matrix4().makeTranslation(-40,-floor,-deskZ));
 const add=(g:T.BufferGeometry,m:T.Material)=>{if(deskScale)g.applyMatrix4(deskMatrix);const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();const list=batches.get(m)??[];list.push(geo);batches.set(m,list);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,floor+y,z);add(g,m);};
 const solid=(x:number,z:number,w:number,h:number,d:number)=>{const b=new T.Box3(new T.Vector3(x-w/2,floor,z-d/2),new T.Vector3(x+w/2,floor+h,z+d/2));if(deskScale)b.applyMatrix4(deskMatrix);colliders.push([...b.min.toArray(),...b.max.toArray()]);};
 const sphere=(x:number,y:number,z:number,r:number,m:T.Material,sx=1,sy=1,sz=1)=>{const g=new T.SphereGeometry(r,16,12);g.scale(sx,sy,sz);g.translate(x,floor+y,z);add(g,m);};
 const rod=(a:T.Vector3,b:T.Vector3,r:number,m:T.Material)=>{const g=new T.CylinderGeometry(r,r,a.distanceTo(b),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate((a.x+b.x)/2,floor+(a.y+b.y)/2,(a.z+b.z)/2);add(g,m);};
 const crown=(x:number,y:number,z:number,s:number)=>{const shape=new T.Shape();shape.moveTo(-.6,-.3);shape.lineTo(.6,-.3);shape.lineTo(.7,.4);shape.lineTo(.25,.1);shape.lineTo(0,.65);shape.lineTo(-.25,.1);shape.lineTo(-.7,.4);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false});g.scale(s,s,s);g.translate(x,floor+y,z);add(g,gold);};
 box(40,.025,center,12,.04,10,wine);
 for(const side of [-1,1]){box(40+side*5.7,.055,center,.12,.02,9.4,gold);box(40,.055,center+side*4.7,11.4,.02,.12,gold);}
 deskScale=true;
 // Solid timber desk, gold fittings and a separate embroidered cloth.
 box(40,1.65,deskZ,7.4,.25,2.8,wood);box(40,.8,deskZ+1.1,7,.1, .12,gold);
 for(const x of [37.2,42.8]){box(x,.75,deskZ,1.1,1.5,2.4,wood);box(x,1,deskZ+1.22,.85,.6,.06,gold);}
 box(40,.9,deskZ+1.1,4.6,1.3,.16,wood);solid(40,deskZ,7.4,1.8,2.8);
 box(40,1.1,deskZ+1.21,1.5,1.3,.06,wine);crown(40,1.15,deskZ+1.26,.7);
 deskScale=false;
 // Same upholstered armchair and scale as the sitting room.
 const chairZ=deskZ-1.9;
 appendRoyalSeat(floor,40,chairZ,2.6,0,add,colliders);
 // Large framed kingdom map, with coastline, mountain ranges and roads.
 const mapZ=back+.38;
 box(40,4.4,mapZ,8,4.5,.18,wood);box(40,4.4,mapZ+.11,7.6,4.1,.025,paper);
 for(const dx of [-4,4])box(40+dx,4.4,mapZ+.15,.15,4.6,.15,gold);
 for(const dy of [-2.25,2.25])box(40,4.4+dy,mapZ+.15,8.15,.15,.15,gold);
 const land=new T.Shape();[[-3,-1.4],[-2.5,.1],[-1.8,.3],[-1,1.6],[.2,1.3],[1,1.7],[2.8,.6],[2.3,-.5],[1,-1.2],[-.2,-.8],[-1.7,-1.5]].forEach(([x,y],i)=>i?land.lineTo(x,y):land.moveTo(x,y));land.closePath();const coast=new T.ShapeGeometry(land);coast.translate(40,floor+4.4,mapZ+.14);add(coast,green);
 for(let i=0;i<9;i++){const g=new T.ConeGeometry(.18,.35,3);g.rotateX(Math.PI/2);g.translate(38.5+i*.35,floor+4.4+Math.sin(i)*.5,mapZ+.19);add(g,wood);}
 for(let i=0;i<12;i++)box(38+i*.34,4.1+Math.sin(i*.5)*.25,mapZ+.2,.19,.035,.02,gold);
 for(const x of [29.2,32,48.2,51])appendRoyalBookcase(floor,x,back+.51,add,solid);
 for(const x of [34.8,45.2]){box(x,4.4,back+.4,1.6,3.8,.06,wine);box(x,6.4,back+.4,2,.12,.15,gold);crown(x,4.3,back+.45,.8);}
 deskScale=true;
 // Navigation globe on a turned stand, with brass meridian and equator.
 const gx=42.2,gz=deskZ;
 box(gx,1.85,gz,.8,.1,.8,wood);rod(new T.Vector3(gx,1.9,gz),new T.Vector3(gx,2.25,gz),.08,gold);sphere(gx,2.8,gz,.55,blue);
 for(let i=0;i<5;i++)sphere(gx+Math.sin(i*2)*.45,2.8+Math.cos(i)*.2,gz+Math.cos(i*2)*.35,.19,green,1,.6,1);
 for(const flat of [true,false]){const g=new T.TorusGeometry(.64,.025,6,32);if(flat)g.rotateX(Math.PI/2);g.translate(gx,floor+2.8,gz);add(g,gold);}
 // Scrolls, correspondence, ink and a feather quill rest on the desktop.
 box(39.6,1.79,deskZ+.1,1.4,.025,.85,paper);
 for(let i=0;i<4;i++)box(39.6,1.807,deskZ-.15+i*.13,1,.006,.018,iron);
 for(const x of [37.4,37.8])rod(new T.Vector3(x,1.88,deskZ-.4),new T.Vector3(x,1.88,deskZ+.4),.1,paper);
 box(38.6,1.91,deskZ+.3,.26,.24,.26,iron);
 rod(new T.Vector3(38.6,2,deskZ+.3),new T.Vector3(38.25,2.8,deskZ+.25),.018,gold);sphere(38.28,2.65,deskZ+.25,.22,paper,.3,1,.16);
 deskScale=false;
 // Inventory armour assembled on a timber mannequin, facing inward from the outer wall.
 const ax=51.75,az=center+1;
 box(ax,.1,az,1,.2,1,wood);solid(ax,az,1.05,2.2,1.1);
 const mannequin=new ProceduralCharacter({...DEFAULT_CONFIG,skin:'#7b603f',hair:'#7b603f'});
 mannequin.setChibi(true);mannequin.equipRightHand('nenhum');mannequin.equipLeftHand('nenhum');
 for(const item of ['shirt','pants','boots','belt','sword','shield','skirt','gloves','armorHelmet','closedHelmet'] as const)mannequin.setClothing(item,false);
 for(const item of ['armor','armorPants','armorBoots','armorGloves','steelHelmet'] as const)mannequin.setClothing(item,true);
 for(const [slot,id]of Object.entries(GUARD_ARMOR))mannequin.setArmorPartColor(slot==='head'?'helmet':slot as 'torso'|'legs'|'boots'|'gloves',armorColor(ITEM_BY_ID.get(id)!.visual));
 mannequin.setArmorShouldersVisible(true);
 // Keep the inventory's metal shells and helmet slit; remove the actor's body,
 // hair and clothing from the display, including slots in mixed-material meshes.
 const hiddenBody=new T.MeshBasicMaterial({visible:false});
 mannequin.group.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  const keep=(material:T.Material)=>material instanceof T.MeshStandardMaterial&&(material.metalness>=.3||object.name==='equipment.armor.steelHelmet.eyeSlit');
  if(Array.isArray(object.material))object.material=object.material.map(m=>keep(m)?m:hiddenBody);
  else if(!keep(object.material))object.visible=false;
 });

 mannequin.group.name='Armadura do inventário no manequim';mannequin.group.userData.equippedItems={...GUARD_ARMOR};
 mannequin.group.position.set(ax,floor+.2,az);mannequin.group.rotation.y=-Math.PI/2;root.add(mannequin.group);
 // Chest backs onto the window wall; its latch faces the room (180 degrees).
 const chestZ=front-.6;
 box(49,.6,chestZ,2.8,1.2,1.5,wood);box(49,1.27,chestZ,2.8,.18,1.5,wood);solid(49,chestZ,2.8,1.4,1.5);
 for(const dx of [-1,1])box(49+dx,.72,chestZ-.77,.15,1.4,.06,gold);
 box(49,.95,chestZ-.81,.22,.3,.08,gold);
 // Framed royal landscapes share the sitting room's materials and scale.
 for(const painting of [
  {x:52.2,y:4.5,z:center-6,angle:-Math.PI/2,theme:0},
  {x:28,y:4.5,z:back+5,angle:Math.PI/2,theme:1},
  {x:46.8,y:4.5,z:front+.02,angle:Math.PI,theme:2},
 ])appendRoyalPainting(floor,painting,add);
 // Window-wall sitting corner, opposite the document chest.
 const sofaX=32.8,sofaZ=front-.625;
 appendRoyalSeat(floor,sofaX,sofaZ,7.2,Math.PI,add,colliders);
 const coffeeZ=sofaZ-2.3;
 box(sofaX,.72,coffeeZ,3.6,.16,1.8,wood);solid(sofaX,coffeeZ,3.6,.8,1.8);
 for(const dx of [-1.5,1.5])for(const dz of [-.6,.6])box(sofaX+dx,.32,coffeeZ+dz,.15,.64,.15,wood);
 appendRoyalPainting(floor,{x:sofaX,y:4.4,z:front+.02,angle:Math.PI,theme:0},add);
 // Curtains flank the actual front facade opening.
 for(const x of [37.6,43.4]){box(x,3.85,front-.3,.8,5,.12,wine);box(x,2.7,front-.4,.85,.17,.14,gold);}
 box(40.5,6.45,front-.3,7,.12,.12,wood);
 appendRoyalWoodCeiling(floor,back,front,add);
 const lights=appendRoyalChandelier(floor,back,front,'royal-study-chandelier',(g)=>add(g,iron));
 // The shared chandelier helper supplies metal only; use wrought iron throughout.
 // Mirror the furnished suite into the west wing, including collision and light data.
 for(const [m,parts]of batches){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!g)continue;const mesh=new T.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;root.add(mesh);}
 root.userData.seats=[{x:-40,y:floor+1.2*.62,z:chairZ,rotation:0},...[-1.2,0,1.2].map(dx=>({x:-(sofaX+dx),y:floor+1.2*.62,z:sofaZ,rotation:Math.PI}))];
 root.scale.x=-1;root.userData.royalStudy=true;
 for(const b of colliders){const min=b[0];b[0]=-b[3];b[3]=-min;}
 for(const l of lights){l.x=-l.x;if(l.emitterOffset)l.emitterOffset[0]*=-1;}
 return {root,colliders,lights,room:{name:'Escritório do Rei Rito',ownerName:'Rei Rito',x:-40.5,y:floor,z:center,width:24.6,depth:front-back-.3}};
}
