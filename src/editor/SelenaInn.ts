import {appendRoyalWoodCeiling} from './RoyalRoomDetails';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
import {CITY_STONE_MATERIAL} from './CityStone';
import {cityStairGeometry} from './CityStairs';
import {medievalSurface} from './MedievalSurface';

export type InnRoom={name:string;x:number;z:number;y:number;width:number;depth:number;beds:number;vip?:boolean;bath?:boolean;owner?:'Selena'};
/** Building-local architecture only: saved map transforms are never modified. */
export function createSelenaInn(){
 const root=new T.Group();root.name='Cidade:inn';
 const w=44,d=24,floorHeight=5,h=15,door=2.8,dh=3.3;
 const plaster=new T.MeshLambertMaterial({color:0xeadbc0});
 const roof=new T.MeshLambertMaterial({color:0x975b40,map:medievalSurface('roof')});
 const iron=new T.MeshLambertMaterial({color:0x30343a});
 const red=new T.MeshLambertMaterial({color:0x742d3f});
 const gold=new T.MeshLambertMaterial({color:0xc5a35a});
 const batches=new Map<T.Material,T.BufferGeometry[]>(),collisions:number[][]=[],walk:number[][]=[],floors:number[][]=[];
 function geo(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,rz=0){
  if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
  g.rotateZ(rz);g.translate(x,y,z);
  if(m===roof){
   // Match the house roofs: one texture repeat per four building-local units.
   const positions=g.getAttribute('position'),normals=g.getAttribute('normal'),uv=g.getAttribute('uv');
   for(let i=0;i<positions.count;i++){
    const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
    uv.setXY(i,(nx>ny&&nx>nz?positions.getZ(i):positions.getX(i))/4,(ny>nx&&ny>nz?positions.getZ(i):positions.getY(i))/4);
   }
  }
  const list=batches.get(m)??[];list.push(g);batches.set(m,list);
 }
 function box(x:number,y:number,z:number,bw:number,bh:number,bd:number,m:T.Material=CITY_WOOD_MATERIAL,solid=false){
  geo(new T.BoxGeometry(bw,bh,bd),m,x,y,z);
  if(solid)collisions.push([x-bw/2,y-bh/2,z-bd/2,x+bw/2,y+bh/2,z+bd/2]);
 }
 function wood(x:number,y:number,z:number,bw:number,bh:number,bd:number,solid=false){box(x,y,z,bw,bh,bd,CITY_WOOD_MATERIAL,solid);}
 function floor(x0:number,z0:number,x1:number,z1:number,y:number){
  floors.push([x0,z0,x1,z1,y]);walk.push([x0,z0,x1,z1,y]);
  wood((x0+x1)/2,y-.17,(z0+z1)/2,x1-x0,.18,z1-z0);
 }
 // Exterior walls have actual window apertures and a clear central entrance.
 const roomBounds=(y:number)=>y===5?[-21.775,-10,-.2,9.6,16.3]:[-21.775,-10,-2,5,11,16.3];
 const windows:{x:number;y:number;z:number;rotation:number}[]=[];
 for(let storey=0;storey<3;storey++){
  const y=storey*floorHeight+2.65;
  const rearPartitions=storey===0?[3,16.3]:roomBounds(storey*floorHeight).slice(1,-1);
  for(const x of [-17,-10,-3.5,3.5,10,17])for(const side of [-1,1]){
   // Include the curtain width and partition thickness, so neither frame nor cloth straddles a room boundary.
   if(side===-1&&rearPartitions.some(bound=>Math.abs(x-bound)<2.15/2+.18/2))continue;
   windows.push({x,y,z:side*d/2,rotation:side===1?0:Math.PI});
  }
  // Side-wall middle windows intersected the room/corridor partition.
  for(const x of [-w/2,w/2])for(const z of [-7,7])windows.push({x,y,z,rotation:x<0?-Math.PI/2:Math.PI/2});
 }
 for(const sideWall of [false,true])for(const side of [-1,1]){
  const length=sideWall?d:w,face=side*(sideWall?w:d)/2;
  const holes=windows.filter(p=>sideWall?p.x===face&&Math.abs(p.rotation)===Math.PI/2:p.z===face&&Math.abs(p.rotation)!==Math.PI/2).map(p=>({lo:(sideWall?p.z:p.x)-.9,hi:(sideWall?p.z:p.x)+.9,bottom:p.y-1,top:p.y+1}));
  if(!sideWall&&side===1)holes.push({lo:-door/2,hi:door/2,bottom:0,top:dh});
  const xs=[-length/2,length/2,...holes.flatMap(a=>[a.lo,a.hi])].sort((a,b)=>a-b),ys=[0,h,...holes.flatMap(a=>[a.bottom,a.top])].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
   const u=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2,bw=xs[i]-xs[i-1],bh=ys[j]-ys[j-1];
   if(bw<.001||bh<.001||holes.some(a=>u>a.lo&&u<a.hi&&y>a.bottom&&y<a.top))continue;
   box(sideWall?face:u,y,sideWall?u:face,sideWall?.45:bw,bh,sideWall?bw:.45,plaster,true);
  }
 }
 // Stone plinth and timber frame follow the three floors, without covering apertures.
 for(const side of [-1,1]){
  for(const y of [.25,5,10,14.8]){
   if(y>dh)wood(0,y,side*(d/2+.25),w+.4,.28,.2);
   else if(side===-1)box(0,y,-d/2-.25,w+.4,.5,.2,CITY_STONE_MATERIAL);
   else for(const s of [-1,1])box(s*(w+door)/4,y,d/2+.25,(w-door)/2,.5,.2,CITY_STONE_MATERIAL);
   wood(side*(w/2+.25),y,0,.2,.28,d+.4);
  }
  for(const x of [-21.7,-13.5,-6.8,0,6.8,13.5,21.7]){
   if(side===1&&x===0){wood(-1.6,dh/2,d/2+.3,.25,dh,.25);wood(1.6,dh/2,d/2+.3,.25,dh,.25);continue;}
   wood(x,h/2,side*(d/2+.26),.25,h,.25);
  }
 }
 // Gabled roof runs along the widened frontage; solid ceiling blocks sunlight.
 wood(0,h-.10,0,w,.2,d);
 const rise=6,slope=Math.atan2(rise,d/2),roofLength=Math.hypot(d/2,rise)+.85;
 for(const s of [-1,1]){
  const g=new T.BoxGeometry(w+1.8,.28,roofLength);g.rotateX(s*slope);geo(g,roof,0,h+rise/2,s*d/4);
 }
 for(const x of [-w/2,w/2]){
  const shape=new T.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(0,rise);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false});g.rotateY(Math.PI/2);geo(g,plaster,x,h,0);
 }
 wood(0,h+rise,0,w+2,.3,.3);
 box(-17,20,-5,2.4,6,2.3,CITY_STONE_MATERIAL);box(-17,23,-5,2.8,.35,2.7,CITY_STONE_MATERIAL);
 // Three front dormers, burgundy banners and an entrance canopy echo the reference.
 for(const x of [-13,0,13]){
  box(x,h+4,5,3.8,3.2,3,plaster);box(x,h+4,6.53,2.2,2,.08,iron);
  for(const s of [-1,1])wood(x+s*1.8,h+4,6.6,.2,3.2,.2);
  wood(x,h+4,6.62,.12,2,.12);
  for(const s of [-1,1])geo(new T.BoxGeometry(2.7,.2,3.7),roof,x+s*.95,h+5.8,5,-s*.48);
 }
 for(const x of [-7,7]){box(x,7.4,d/2+.43,1.3,3.3,.08,red);box(x,7.4,d/2+.49,.65,.12,.03,gold);}
 for(const x of [-3.3,3.3])wood(x,1.85,d/2+2.7,.3,3.7,.3);
 geo(new T.BoxGeometry(7.4,.2,3.8),roof,0,3.8,d/2+1.6,.0);
 floor(-w/2+.225,-d/2+.225,w/2-.225,d/2-.225,.08);
 // Side-by-side return flights: first ascends rearward, second returns forward.
 const edge=16.5,outer=21.75,start=8,end=-7,steps=24;
 const flights=[{left:19.25,right:outer,from:0,to:5,start,end},{left:edge,right:19,from:5,to:10,start:end,end:start}];
 function guard(x0:number,z0:number,x1:number,z1:number,y:number){
  const length=Math.hypot(x1-x0,z1-z0),n=Math.ceil(length/1.1);
  for(let i=0;i<=n;i++)wood(x0+(x1-x0)*i/n,y+.56,z0+(z1-z0)*i/n,.14,1.1,.14);
  for(const dy of [.5,1.05])wood((x0+x1)/2,y+dy,(z0+z1)/2,Math.abs(x1-x0)+.14,.12,Math.abs(z1-z0)+.14);
  collisions.push([Math.min(x0,x1)-.07,y,Math.min(z0,z1)-.07,Math.max(x0,x1)+.07,y+1.12,Math.max(z0,z1)+.07]);
 }
 for(const y of [5,10]){
  floor(-21.775,-11.775,edge,11.775,y);floor(edge,-11.775,21.775,end,y);floor(edge,start,21.775,11.775,y);
  floor(19, end, y===10?21.775:19.25,start,y);
  guard(edge-.1,end,edge-.1,start,y);
  if(y===5){guard(19.125,end,19.125,start,y);guard(19.125,start+.1,21.75,start+.1,y);}
  else {guard(19.1,end,19.1,start,y);guard(edge-.1,end-.1,19.1,end-.1,y);}
 }
 for(const f of flights){
  const backwards=f.start<f.end;
  const geometry=cityStairGeometry(start,end,f.right-f.left,f.from,f.to-.08,steps,f.from-.08);
  if(backwards)geometry.rotateY(Math.PI);
  // Mirror about the run midpoint, preserving exactly the same landing coordinates.
  geo(geometry,CITY_WOOD_MATERIAL,(f.left+f.right)/2,0,backwards?start+end:0);
  for(let i=0;i<steps;i++){
   const z=f.start+(f.end-f.start)*(i+.5)/steps,half=Math.abs(f.end-f.start)/steps/2;
   walk.push([f.left,z-half,f.right,z+half,f.from+(i+1)*(f.to-.08-f.from)/steps]);
  }
  for(const x of [f.left+.1,f.right-.1]){
   const a=new T.Vector3(x,f.from+1.15,f.start),b=new T.Vector3(x,f.to+1.05,f.end);
   const g=new T.BoxGeometry(.14,a.distanceTo(b),.14);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());geo(g,CITY_WOOD_MATERIAL);
   for(let i=0;i<=steps;i+=3){const t=i/steps,z=f.start+(f.end-f.start)*t,bottom=f.from+(f.to-.08-f.from)*Math.min(1,(i+1)/steps),top=a.y+(b.y-a.y)*t;if(top>bottom)wood(x,(bottom+top)/2,z,.14,top-bottom,.14);}
   collisions.push([x-.07,f.from,end,x+.07,f.to+1.15,start]);
  }
 }
 const ceiling=(left:number,right:number,back:number,front:number,top:number)=>
  appendRoyalWoodCeiling(0,back,front,(g,m)=>geo(g,m),{left,right,top});
 for(const top of [4.72,9.72]){
  ceiling(-21.775,edge,-11.775,11.775,top);ceiling(edge,21.775,-11.775,end,top);ceiling(edge,21.775,start,11.775,top);
 }
 ceiling(19,21.775,end,start,9.72);
 ceiling(-21.775,21.775,-11.775,11.775,14.72);
 const rooms:InnRoom[]=[];
 function partition(x:number,z:number,bw:number,bd:number,y:number,entry=false){
  const height=4.8;
  if(entry){for(const side of [-1,1]){const segment=(bw-1.8)/2;box(x+side*(bw+1.8)/4,y+height/2,z,segment,height,.18,plaster,true);}wood(x,y+4.1,z,1.8,1.4,.2,true);}
  else box(x,y+height/2,z,bw,height,bd,plaster,true);
 }
 // Guest rooms face the rear; a broad hall gives every door a clear route to the stairs.
 for(const y of [5,10]){
  const bounds=roomBounds(y);
  for(let i=0;i<bounds.length-1;i++){
   const left=bounds[i],right=bounds[i+1],bath=i===bounds.length-2;
   if(i>0)partition(left,-5.9,.18,11.7,y);
   // The former washroom becomes the open return of the L-shaped hall.
   if(bath)continue;
   rooms.push({name:y===10&&i===0?'Suíte nobre':i>=2?'Quarto individual':'Quarto duplo',x:(left+right)/2,z:-5.9,y,width:right-left,depth:11.5,beds:i>=2?1:y===10&&i===0?1:2,vip:y===10&&i===0,...(y===5&&i===2?{owner:'Selena' as const}:{})});
   partition((left+right)/2,0,right-left,.18,y,true);
  }
 }
 // Reception kitchen / storage retain open doorways, and the entrance aisle stays clear.
 partition(3,-7.3,.18,9,0);partition(9.5,-3.0,13,.18,0,true);partition(16.3,-7.3,.18,9,0);
 wood(0,3.7,d/2+.31,3.5,.35,.25);
 for(const [material,geometries] of batches){const g=mergeGeometries(geometries);geometries.forEach(v=>v.dispose());if(g){const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;root.add(m);}}
 root.userData={cityObject:true,sharedCityGeometry:true,building:{width:w,depth:d,height:h,doorWidth:door,doorHeight:dh,enterable:true,storeys:3,frontWindows:6,frontAxis:'+Z'},localColliders:collisions,walkSurfaces:walk,woodFloorSurfaces:floors,windows,weatherPitch:{axis:'z',halfWidth:d/2,eaves:h,rise},innRooms:rooms,innFlights:flights,innOffice:{x:9.5,z:-3,y:0,width:1.8,height:3.4},upperFloor:5,innArchitecture:true,aliceStyleCeilings:true};
 return root;
}
