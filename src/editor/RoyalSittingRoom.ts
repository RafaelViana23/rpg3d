import {appendRoyalSeat} from './RoyalSeat';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
import {appendRoyalBookcase,appendRoyalWardrobe,appendRoyalPainting,appendRoyalChandelier,appendRoyalWoodCeiling,type RoyalRoomLight} from './RoyalRoomDetails';

/** The east front room shares the existing masonry shell and sun-blocking roof. */
export function createRoyalSittingRoom(floor:number,back:number,front:number){
 const root=new T.Group();root.name='Sala de estar da família real';
 const batches=new Map<T.Material,T.BufferGeometry[]>(),colliders:number[][]=[];
 const lights:RoyalRoomLight[]=[];
 const props:{pack:string;label:string;x:number;y:number;z:number;height:number;rotation:number;room?:string;horizontalScale?:number}[]=[];
 const wine=new T.MeshLambertMaterial({color:'#722b35'}),gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.4});
 const books=['#465c45','#7c3841','#455779','#c6a35d'].map(color=>new T.MeshLambertMaterial({color}));
 const add=(g:T.BufferGeometry,m:T.Material)=>{const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();const list=batches.get(m)??[];list.push(geo);batches.set(m,list);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,floor+y,z);add(g,m);};
 const solid=(x:number,z:number,w:number,h:number,d:number)=>colliders.push([x-w/2,floor,z-d/2,x+w/2,floor+h,z+d/2]);
 const crown=(x:number,y:number,z:number,size:number,flat=false)=>{
  const s=new T.Shape();s.moveTo(-.6,-.25);s.lineTo(.6,-.25);s.lineTo(.7,.4);s.lineTo(.28,.12);s.lineTo(0,.6);s.lineTo(-.28,.12);s.lineTo(-.7,.4);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:false});g.scale(size,size,size);if(flat)g.rotateX(-Math.PI/2);g.translate(x,floor+y,z);add(g,gold);
 };
 const center=(back+front)/2;
 // Raised borders and embroidered crown keep the carpet readable on stone paving.
 box(40,.025,center,10,.04,9,wine);
 for(const side of [-1,1]){box(40+side*4.65,.052,center,.12,.015,8.3,gold);box(40,.052,center+side*4.15,9.3,.015,.12,gold);}
 crown(40,.075,center+3.3,1.3,true);
 const seat=(x:number,z:number,width:number,angle:number)=>appendRoyalSeat(floor,x,z,width,angle,add,colliders);
 seat(40,center-2.8,7.2,0);seat(36.5,center,2.6,Math.PI/2);seat(43.5,center,2.6,-Math.PI/2);
 box(40,.72,center,3.6,.16,1.8,CITY_WOOD_MATERIAL);solid(40,center,3.6,.8,1.8);
 for(const dx of [-1.5,1.5])for(const dz of [-.6,.6])box(40+dx,.32,center+dz,.15,.64,.15,CITY_WOOD_MATERIAL);
 for(let i=0;i<3;i++)box(39.1,.85+i*.07,center,.66,.06,.48,books[i]);
 // Identical bookcase sections to Alice's room, at the same human scale.
 for(const x of [32.5,35.3])appendRoyalBookcase(floor,x,back+.51,add,solid);
 // Storage follows the west wall, leaving the doorway and its swing clear.
 const wallStorage:{kind:'bookcase'|'wardrobe';z:number;bounds:number[]}[]=[];
 const wallPiece=(kind:'bookcase'|'wardrobe',z:number)=>{
  const matrix=new T.Matrix4().makeRotationY(Math.PI/2);matrix.setPosition(kind==='bookcase'?28.36:29.3,floor,z);
  const transformedAdd=(g:T.BufferGeometry,m:T.Material)=>{g.applyMatrix4(matrix);add(g,m);};
  const transformedSolid=(x:number,zz:number,w:number,h:number,d:number)=>{
   const b=new T.Box3(new T.Vector3(x-w/2,0,zz-d/2),new T.Vector3(x+w/2,h,zz+d/2)).applyMatrix4(matrix);
   const bounds=[...b.min.toArray(),...b.max.toArray()];colliders.push(bounds);wallStorage.push({kind,z,bounds});
  };
  (kind==='bookcase'?appendRoyalBookcase:appendRoyalWardrobe)(0,0,0,transformedAdd,transformedSolid);
 };
 for(const z of [back+6,back+9,back+12])wallPiece('bookcase',z);
 for(const z of [front-6.2,front-3])wallPiece('wardrobe',z);
 root.userData.wallStorage=wallStorage;
 // The imported hearth's neck is offset 0.15 from its normalized depth center.
 const hearthHeight=4.6,hearthScale=hearthHeight/2.4,fx=51.25,fz=front-1.8;
 const chimneyHeight=2.55,neckWidth=.62*hearthScale;
 props.push({pack:'tavern-hearth',label:'Lareira da sala real',x:fx,y:floor,z:fz,height:hearthHeight,rotation:-Math.PI/2,room:'royalSittingRoom'});
 props.push({pack:'tavern-chimney',label:'Chaminé da sala real',x:fx+.15*hearthScale,y:floor+hearthHeight,z:fz,height:chimneyHeight,horizontalScale:neckWidth/(.66*chimneyHeight/2.08),rotation:-Math.PI/2,room:'royalSittingRoom'});
 lights.push({pack:'tavern-fire',x:fx-.6,y:floor+.2,z:fz,height:1.05,rotation:-Math.PI/2,group:'royal-sitting-fire',intensity:12,distance:12});
 seat(fx-4,fz,2.6,Math.PI/2);
 for(const [x,z] of [[30.5,back+3.2]])props.push({pack:'potted-plant',label:'Vaso de planta da sala real',x,y:floor,z,height:2.1,rotation:0,room:'royalSittingRoom'});
 for(const painting of [
  {x:40.5,y:4.55,z:back+.26,angle:0,theme:0},
  {x:45.8,y:4.55,z:back+.26,angle:0,theme:2},
  {x:33.4,y:4.55,z:front-.26,angle:Math.PI,theme:1},
 ])appendRoyalPainting(floor,painting,add);
 // Banners, curtains and a timber coffered ceiling retain distinct cloth and metal.
 for(const x of [29.5,51]){box(x,4.7,back+.35,2.1,3.5,.08,wine);crown(x,4.6,back+.41,.9);box(x,6.5,back+.35,2.6,.1,.12,gold);}
 for(const zz of [center-4,center+4]){box(52.1,4,zz,.12,5,1.1,wine);box(51.99,2.9,zz,.16,.22,1.15,gold);}
 // Front facade window, opposite the partition, opens onto the exterior.
 for(const x of [37.6,43.4]){
  box(x,3.85,front-.3,.8,5,.12,wine);box(x,2.7,front-.4,.85,.17,.14,gold);
 }
 box(40.5,6.45,front-.3,7,.12,.12,CITY_WOOD_MATERIAL);
 appendRoyalWoodCeiling(floor,back,front,add);
 lights.push(...appendRoyalChandelier(floor,back,front,'royal-sitting-chandelier',add));
 lights.push({pack:'candle',x:40.9,y:floor+.8,z:center,height:.32,rotation:0});
 for(const [m,parts]of batches){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!g)continue;const mesh=new T.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;root.add(mesh);}
 root.userData.royalSittingRoom=true;
 return {root,colliders,lights,props,room:{name:'Sala de estar real',x:40.5,y:floor,z:center,width:24.6,depth:front-back-.3}};
}
