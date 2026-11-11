import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL as wood} from './CityWood';
import {appendRoyalBookcase,appendRoyalPainting,appendRoyalChandelier,type RoyalRoomLight} from './RoyalRoomDetails';
import {appendRoyalSeat} from './RoyalSeat';

/** The complete remaining ground-floor wing, using the royal rooms' unscaled bookcases. */
export function createRoyalLibrary(floor:number,back:number,front:number,doorZ:number,windowZ:number){
 const root=new T.Group();root.name='Biblioteca Real';
 const batches=new Map<T.Material,T.BufferGeometry[]>(),colliders:number[][]=[],lights:RoyalRoomLight[]=[];
 const props:{pack:string;label:string;x:number;y:number;z:number;height:number;rotation:number;room:string;horizontalScale?:number}[]=[];
 const shelves:{wall:string;x:number;z:number;bounds:number[]}[]=[];
 const wine=new T.MeshLambertMaterial({color:'#722b35'}),paper=new T.MeshLambertMaterial({color:'#e5d8bf'});
 const gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.65,roughness:.35}),ink=new T.MeshLambertMaterial({color:'#29262d'});
 const covers=['#465c45','#455779','#823c48','#b08d46'].map(color=>new T.MeshLambertMaterial({color}));
 const center=(back+front)/2,cx=40.3;
 const add=(g:T.BufferGeometry,m:T.Material)=>{const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();const list=batches.get(m)??[];list.push(geo);batches.set(m,list);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,floor+y,z);add(g,m);};
 const solid=(x:number,z:number,w:number,h:number,d:number)=>colliders.push([x-w/2,floor,z-d/2,x+w/2,floor+h,z+d/2]);
 const shelf=(wall:string,x:number,z:number,angle:number)=>{
  const matrix=new T.Matrix4().makeRotationY(angle);matrix.setPosition(x,floor,z);
  appendRoyalBookcase(0,0,0,(g,m)=>{g.applyMatrix4(matrix);add(g,m);},(sx,sz,w,h,d)=>{
   const b=new T.Box3(new T.Vector3(sx-w/2,0,sz-d/2),new T.Vector3(sx+w/2,h,sz+d/2)).applyMatrix4(matrix);
   const bounds=[...b.min.toArray(),...b.max.toArray()];colliders.push(bounds);shelves.push({wall,x:-x,z,bounds});
  });
 };
 // Cover all four walls, reserving the doorway, real window and corner fireplace.
 for(let z=back+3;z<front-2;z+=2.95){
  if(Math.abs(z-doorZ)>4)shelf('interior',28.85,z,Math.PI/2);
  if(Math.abs(z-windowZ)>3.9&&z<front-4.8)shelf('exterior',51.75,z,-Math.PI/2);
 }
 for(let x=30.6;x<=50.9;x+=2.9){
  shelf('fundo',x,back+.65,0);
  if(x<48)shelf('frente',x,front-.65,Math.PI);
 }
 // Parallel, upright banks of bookcases form walkable aisles like domino rows.
 // Two back-to-back faces serve each aisle; both long side passages stay open.
 const shelfRows=[back+8,back+14,back+20,center+10,center+22]
  .filter(z=>z<front-5.5&&Math.abs(z-doorZ)>3.5&&Math.abs(z-center)>7);
 for(const z of shelfRows)for(const x of [34.2,37.1,40,42.9,45.8]){
  shelf('corredor',x,z+.6,0);
  shelf('corredor',x,z-.6,Math.PI);
 }
 root.userData.shelfRows=shelfRows;
 root.userData.shelfAisleWidth=6-2.3;
 // Same 6.4 x 2.6 timber table and human-scale seats used elsewhere in the palace.
 box(cx,1.05,center,6.4,.16,2.6,wood);solid(cx,center,6.4,1.13,2.6);
 for(const dx of [-2.9,2.9])for(const dz of [-1.05,1.05])box(cx+dx,.48,center+dz,.18,.96,.18,wood);
 for(const dx of [-2,2]){
  appendRoyalSeat(floor,cx+dx,center-2.55,2.6,0,add,colliders);
  appendRoyalSeat(floor,cx+dx,center+2.55,2.6,Math.PI,add,colliders);
 }
 appendRoyalSeat(floor,cx-4.5,center,2.6,Math.PI/2,add,colliders);
 appendRoyalSeat(floor,cx+4.5,center,2.6,-Math.PI/2,add,colliders);
 box(cx,.024,center,12,.032,9,wine);
 for(const side of [-1,1]){box(cx+side*5.7,.05,center,.12,.012,8.4,gold);box(cx,.05,center+side*4.2,11.4,.012,.12,gold);}
 const crown=new T.Shape();crown.moveTo(-.6,-.25);crown.lineTo(.6,-.25);crown.lineTo(.7,.4);crown.lineTo(.25,.1);crown.lineTo(0,.6);crown.lineTo(-.25,.1);crown.lineTo(-.7,.4);crown.closePath();
 const emblem=new T.ShapeGeometry(crown);emblem.scale(1.3,1.3,1.3);emblem.rotateX(-Math.PI/2);emblem.translate(cx,floor+.065,center+3.6);add(emblem,gold);
 // Supported books, an open volume, scrolls and an inkwell on the central reading table.
 for(const [j,x]of [cx-2.3,cx+2.3].entries())for(let i=0;i<3;i++){
  box(x,1.17+i*.1,center,.9,.08,.65,covers[(i+j)%covers.length]);box(x,1.17+i*.1,center+.02,.82,.045,.65,paper);
 }
 for(const side of [-1,1]){
  const g=new T.BoxGeometry(.65,.04,.8);g.rotateZ(-side*.18);g.translate(cx+side*.32,floor+1.22,center);add(g,paper);
 }
 box(cx+.95,1.25,center+.5,.18,.24,.18,ink);
 const quill=new T.ConeGeometry(.055,.55,5);quill.rotateZ(-.3);quill.translate(cx+1.02,floor+1.62,center+.5);add(quill,paper);
 for(const x of [cx-1.1,cx+1.1]){const g=new T.CylinderGeometry(.085,.085,.75,12);g.rotateX(Math.PI/2);g.translate(x,floor+1.22,center-.55);add(g,paper);}
 // Timber ceiling is just below the existing upper floor, with a centered candle chandelier.
 box(cx,9.5,center,24,.16,front-back,wood);
 for(let x=28.5;x<52;x+=4)box(x,9.3,center,.28,.35,front-back,wood);
 for(let z=back+.6;z<front;z+=4)box(cx,9.23,z,24,.25,.28,wood);
 lights.push(...appendRoyalChandelier(floor,back,front,'royal-library-chandelier',add));
 box(cx,8.4,center,.07,2.05,.07,gold);
 for(const z of [back+8,back+20,back+32,front-9])for(const side of [-1,1])lights.push({pack:'wall-torch',x:side<0?28.1:52.15,y:floor+6.3,z,height:1,rotation:side<0?Math.PI/2:-Math.PI/2,intensity:150,distance:32,persistent:true});
 const paintings=[
  {x:34.5,y:6.65,z:back+.24,angle:0,theme:0},
  {x:45.5,y:6.65,z:back+.24,angle:0,theme:1},
  {x:34.5,y:6.65,z:front-.24,angle:Math.PI,theme:2},
  {x:43.5,y:6.65,z:front-.24,angle:Math.PI,theme:0},
 ];
 for(const painting of paintings)appendRoyalPainting(floor,painting,add);
 root.userData.paintingPlacements=paintings.map(p=>({...p,x:-p.x,angle:-p.angle}));
 // Two plants flank the reading area, outside the seats and the shelf aisles.
 for(const x of [cx-4.6,cx+4.6])
  props.push({pack:'potted-plant',label:'Vaso de planta da biblioteca real',x,y:floor,z:center+3.5,height:2.1,rotation:0,room:'royalLibrary'});
 const hearthHeight=4.6,hearthScale=hearthHeight/2.4,fx=51.25,fz=front-1.8,chimneyHeight=4.8;
 props.push({pack:'tavern-hearth',label:'Lareira da biblioteca real',x:fx,y:floor,z:fz,height:hearthHeight,rotation:-Math.PI/2,room:'royalLibrary'});
 props.push({pack:'tavern-chimney',label:'Chaminé da biblioteca real',x:fx+.15*hearthScale,y:floor+hearthHeight,z:fz,height:chimneyHeight,horizontalScale:(.62*hearthScale)/(.66*chimneyHeight/2.08),rotation:-Math.PI/2,room:'royalLibrary'});
 lights.push({pack:'tavern-fire',x:fx-.6,y:floor+.2,z:fz,height:1.05,rotation:-Math.PI/2,group:'royal-library-fire',intensity:40,distance:18});
 for(const [m,parts]of batches){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new T.Mesh(geometry,m);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;root.add(mesh);}
 // Mirror into the west hall; keep geometry, colliders, lights and imported models together.
 root.scale.x=-1;root.userData.royalLibrary=true;root.userData.shelves=shelves;
 for(const b of colliders){const min=b[0];b[0]=-b[3];b[3]=-min;}
 for(const p of props){p.x=-p.x;p.rotation=-p.rotation;}
 for(const l of lights){l.x=-l.x;l.rotation=-l.rotation;if(l.emitterOffset)l.emitterOffset[0]*=-1;}
 root.userData.readingTable={x:-cx,z:center,width:6.4,depth:2.6,height:1.13,seats:6};
 return {root,colliders,lights,props,room:{name:'Biblioteca Real',x:-40.1,y:floor,z:center,width:24.6,depth:front-back}};
}
