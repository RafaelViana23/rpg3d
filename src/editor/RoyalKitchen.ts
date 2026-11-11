import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL as wood} from './CityWood';
import {CITY_STONE_MATERIAL as stone} from './CityStone';
import {appendRoyalChandelier,type RoyalRoomLight} from './RoyalRoomDetails';

/** Ground-floor east wing, with a continuous clear route from the west doorway. */
export function createRoyalKitchen(floor:number,back:number,front:number,windowZ:number){
 const root=new T.Group();root.name='Cozinha principal do castelo';
 const props:{pack:string;piece?:string;label:string;x:number;y:number;z:number;height:number;rotation:number;room:string}[]=[];
 const batches=new Map<T.Material,T.BufferGeometry[]>(),colliders:number[][]=[],lights:RoyalRoomLight[]=[];
 const copper=new T.MeshStandardMaterial({color:'#b97446',metalness:.75,roughness:.38}),iron=new T.MeshStandardMaterial({color:'#343338',metalness:.75,roughness:.5});
 const linen=new T.MeshLambertMaterial({color:'#e9dec4'}),wine=new T.MeshLambertMaterial({color:'#722b35'}),gold=new T.MeshStandardMaterial({color:'#c5a45a',metalness:.6,roughness:.4});
 const green=new T.MeshLambertMaterial({color:'#507244'}),red=new T.MeshLambertMaterial({color:'#ae4434'}),bread=new T.MeshLambertMaterial({color:'#c89a54'}),water=new T.MeshStandardMaterial({color:'#658e99',roughness:.2});
 const add=(g:T.BufferGeometry,m:T.Material)=>{const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();const list=batches.get(m)??[];list.push(geo);batches.set(m,list);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,floor+y,z);add(g,m);};
 const solid=(x:number,z:number,w:number,h:number,d:number)=>colliders.push([x-w/2,floor,z-d/2,x+w/2,floor+h,z+d/2]);
 const sphere=(x:number,y:number,z:number,r:number,m:T.Material,sx=1,sy=1,sz=1)=>{const g=new T.SphereGeometry(r,10,8);g.scale(sx,sy,sz);g.translate(x,floor+y,z);add(g,m);};
 const ring=(x:number,y:number,z:number,r:number,m:T.Material,flat=true)=>{const g=new T.TorusGeometry(r,.035,5,16);if(flat)g.rotateX(Math.PI/2);g.translate(x,floor+y,z);add(g,m);};
 const cylinder=(x:number,y:number,z:number,r:number,h:number,m:T.Material)=>{const g=new T.CylinderGeometry(r,r,h,12);g.translate(x,floor+y,z);add(g,m);};
 const table=(x:number,z:number,w:number,d:number)=>{box(x,1.05,z,w,.16,d,wood);for(const dx of [-w/2+.18,w/2-.18])for(const dz of [-d/2+.18,d/2-.18])box(x+dx,.48,z+dz,.18,.96,.18,wood);solid(x,z,w,1.13,d);};
 const loaf=(x:number,y:number,z:number)=>{sphere(x,y,z,.22,bread,1.7,.6,.8);for(let i=0;i<3;i++)box(x-.18+i*.18,y+.12,z,.025,.015,.22,linen);};
 const basket=(x:number,y:number,z:number,kind:number)=>{cylinder(x,y+.16,z,.48,.32,wood);ring(x,y+.33,z,.49,wood);for(let i=0;i<7;i++){const a=i*2.4,r=i===0?0:.3;sphere(x+Math.sin(a)*r,y+.4,z+Math.cos(a)*r,.14,kind?green:red);}if(kind===2)loaf(x,y+.5,z);};
 // Full-depth work zones keep a broad circulation lane along the inner wall.
 const zones=Array.from({length:5},(_,i)=>back+7+(front-back-14)*i/4);
 for(const [i,z]of zones.entries()){
  table(40,z,6.4,2.6);basket(38.3,1.13,z,i%3);loaf(40,1.27,z);box(41.5,1.15,z,1.1,.05,.7,wood);
  table(50.9,z,2.5,4.4);
  box(50.9,.5,z,2.3,.9,4.1,wood);
  for(const dz of [-1,1]){box(49.72,.52,z+dz,.06,.78,1.9,wood);box(49.67,.6,z+dz,.07,.18,.09,iron);}

  for(let row=0;row<2&&i!==1&&i!==3;row++){
   box(51.85,2.7+row*1.05,z,.9,.13,4.4,wood);
   for(let j=0;j<5;j++)cylinder(51.85,2.8+row*1.05,z-1.6+j*.72,.25,.05,linen);
  }
  if(i!==3)basket(50.9,1.13,z,i%3);
 }
 // Rear cooking wall: open stone hearth, separate bread oven and flue.
 const hz=back+1.65;
 for(const x of [35.4,39.4])box(x,1.8,hz,.75,3.6,2.4,stone);
 box(37.4,3.6,hz,4.75,.7,2.4,stone);box(37.4,.18,hz,4.75,.36,2.6,stone);box(37.4,6.5,hz,3.3,5.8,2.1,stone);solid(37.4,hz,4.75,9.4,2.6);
 lights.push({pack:'tavern-fire',x:37.4,y:floor+.38,z:hz+.3,height:1.1,rotation:0,group:'royal-kitchen-hearth',intensity:65,distance:24});
 box(45.4,1,hz,4,2,2.7,stone);sphere(45.4,2,hz,1.9,stone,1,.65,.7);box(45.4,1.65,hz+1.36,1.4,.9,.03,iron);solid(45.4,hz,4,3.3,2.7);
 for(let i=0;i<3;i++)loaf(44.7+i*.7,1.13,back+4);
 table(45.4,back+4,3.4,1.3);
 // Hanging copper pans and pots on a high rack above the preparation line.
 for(const z of zones){
  box(40,3.5,z,6.5,.09,.09,iron);
  for(let i=0;i<4;i++){
   const x=37.8+i*1.45;ring(x,3.33,z,.12,iron,false);box(x,3,z,.08,.5,.08,copper);
   const g=new T.CylinderGeometry(.3,.3,.11,12);g.rotateX(Math.PI/2);g.translate(x,floor+2.58,z);add(g,copper);
  }
 }
 // Storage models are arranged together after loading their real bounds.
 // Stone sink directly below a real east-wall window.
 const sx=50.8;
 box(sx,.55,windowZ,2.6,1.1,2.6,stone);
 for(const dx of [-1.15,1.15])box(sx+dx,1.18,windowZ,.3,.3,2.6,stone);
 for(const dz of [-1.15,1.15])box(sx,1.18,windowZ+dz,2,.3,.3,stone);
 box(sx,1.11,windowZ,1.95,.02,1.95,water);solid(sx,windowZ,2.6,1.35,2.6);
 // Herbs and garlic hang above the pantry rather than in the walking space.
 for(const z of [back+10,back+17,back+25,back+33]){
  box(28.5,3.6,z,.6,.08,2,wood);
  for(let i=0;i<4;i++){const zz=z-.65+i*.43;box(28.6,3.28,zz,.025,.6,.025,linen);for(let n=0;n<3;n++)sphere(28.6,3-n*.14,zz,.12,i%2?linen:green,1,1.4,1);}
 }
 for(const x of [30.5,49.7]){box(x,4.7,front-.35,1.8,3.2,.07,wine);box(x,6.4,front-.35,2.1,.1,.12,gold);const s=new T.Shape();s.moveTo(-.5,-.2);s.lineTo(.5,-.2);s.lineTo(.6,.45);s.lineTo(.2,.15);s.lineTo(0,.6);s.lineTo(-.2,.15);s.lineTo(-.6,.45);s.closePath();const g=new T.ShapeGeometry(s);g.translate(x,floor+4.7,front-.3);add(g,gold);}
 for(let i=0;i<3;i++){const cz=back+(front-back)*(i+.5)/3;const candles=appendRoyalChandelier(floor,cz-1,cz+1,`royal-kitchen-chandelier-${i}`,(g)=>add(g,iron));candles.forEach((l,index)=>{l.persistent=true;l.intensity=index===0?150:0;});lights.push(...candles);}
 for(const [m,parts]of batches){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!g)continue;const mesh=new T.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;mesh.userData.palaceComplexMesh=true;root.add(mesh);}
 return {root,colliders,lights,props,room:{name:'Cozinha principal do castelo',x:40.1,y:floor,z:(back+front)/2,width:24.6,depth:front-back}};
}
