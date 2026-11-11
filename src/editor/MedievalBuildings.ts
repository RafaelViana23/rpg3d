import {cityStairGeometry} from './CityStairs';
import { createRoyalPalace } from './RoyalPalace';
import { PERIMETER_CATALOG } from './CityPerimeter';
import { CITY_WOOD_COLOR, CITY_WOOD_MATERIAL } from './CityWood';
import { CITY_WINDOW_OPENING, CITY_WINDOW_WIDTH, CITY_WINDOW_HEIGHT } from './CityWindowLayout';
import * as T from 'three';
import { medievalSurface } from './MedievalSurface';
import { referenceBuildingDetails } from './MedievalReferenceDetails';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MEDIEVAL_CATALOG = [
  ...PERIMETER_CATALOG,
  {kind:'warehouse',label:'Armazém'}, {kind:'house',label:'Casa residencial'}, {kind:'inn',label:'Pousada'},
  {kind:'tavern',label:'Taverna'}, {kind:'church',label:'Igreja'},
  {kind:'guild',label:'Sede da guilda'}, {kind:'weapons',label:'Loja de armas'},
  {kind:'potions',label:'Loja de poções'}, {kind:'market',label:'Mercado central'},
  {kind:'fountain',label:'Fonte central'}, {kind:'palace',label:'Palácio do rei'},
] as const;
const colors = { plaster:0xeadbc0, villageWall:0xffffff, wood:CITY_WOOD_COLOR, roof:0x975b40, stone:0xb8b5a4, iron:0x39434b, gold:0xd3ac55, water:0x59bbd2, red:0x973e49, green:0x568d65, glass:0x394b50, canvas:0xf0dfb4, blue:0x2c688b, clay:0xc98b58 };
type Mat = keyof typeof colors;
const materials = Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new T.MeshLambertMaterial({color})])) as unknown as Record<Mat,T.Material>;
materials.wood.dispose();
materials.wood=CITY_WOOD_MATERIAL;
for(const key of ['stone','roof','plaster'] as const)(materials[key] as T.MeshLambertMaterial).map=medievalSurface(key);
if(typeof document!=='undefined'){
  const wallTexture=new T.TextureLoader().load('/textures/village-wall.png?v=plain-plaster');
  wallTexture.colorSpace=T.SRGBColorSpace;wallTexture.wrapS=wallTexture.wrapT=T.RepeatWrapping;
  wallTexture.magFilter=T.NearestFilter;wallTexture.minFilter=T.LinearMipmapLinearFilter;
  (materials.villageWall as T.MeshLambertMaterial).map=wallTexture;
}
(materials.villageWall as T.MeshLambertMaterial).flatShading=true;
(materials.canvas as T.MeshLambertMaterial).side=T.DoubleSide;
(materials.blue as T.MeshLambertMaterial).side=T.DoubleSide;
const cache = new Map<string,T.Group>();
export function createMedievalBuilding(kind:string):T.Group|null {
  if(kind==='palace')return createRoyalPalace();
  if(!MEDIEVAL_CATALOG.some(e=>e.kind===kind)&&kind!=='shop')return null;
  const cached=cache.get(kind); if(cached)return cached.clone(true);
  const root=new T.Group();root.name=`Cidade:${kind}`;
  const batches=new Map<Mat,T.BufferGeometry[]>();
  const collisions:number[][]=[];
  const walkSurfaces:number[][]=[];
  const woodFloorSurfaces:number[][]=[];
  const windows:{x:number;y:number;z:number;rotation:number}[]=[];
  function geo(g:T.BufferGeometry,m:Mat,x:number,y:number,z:number,rx=0,ry=0,rz=0){
    if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
    g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));
    if(kind==='church'&&m==='plaster')m='stone';
    else if(kind!=='palace'&&m==='plaster')m='villageWall';
    if(['stone','roof','wood','plaster','villageWall'].includes(m)){
      const p=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');
      const repeat=m==='roof'?4:m==='stone'?6:m==='wood'?3:4;
      for(let i=0;i<p.count;i++){
        const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
        uv.setXY(i,(nx>ny&&nx>nz?p.getZ(i):p.getX(i))/repeat,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))/(m==='villageWall'?4.8:repeat));
      }
    }
    const list=batches.get(m)||[];list.push(g);batches.set(m,list);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:Mat,solid=true){
    let parts=[{x,y,z,w,h,d}];
    // Stop facade timbers at the frame instead of letting them cross the opening.
    if(m==='wood')for(const window of windows){
      const side=window.rotation!==0,u=side?window.z:window.x,face=side?window.x:window.z;
      const left=u-CITY_WINDOW_WIDTH/2-.015,right=u+CITY_WINDOW_WIDTH/2+.015;
      const bottom=window.y-CITY_WINDOW_HEIGHT/2-.015,top=window.y+CITY_WINDOW_HEIGHT/2+.015;
      parts=parts.flatMap(p=>{
        const center=side?p.z:p.x,length=side?p.d:p.w,normal=side?p.x:p.z,depth=side?p.w:p.d;
        const a=center-length/2,b=center+length/2,c=p.y-p.h/2,e=p.y+p.h/2;
        if(Math.abs(normal-face)>depth/2+.5||b<=left||a>=right||e<=bottom||c>=top)return [p];
        const result:typeof parts=[];
        const piece=(lo:number,hi:number,low:number,high:number)=>{
          if(hi-lo<.001||high-low<.001)return;
          result.push({...p,x:side?p.x:(lo+hi)/2,z:side?(lo+hi)/2:p.z,y:(low+high)/2,w:side?p.w:hi-lo,d:side?hi-lo:p.d,h:high-low});
        };
        piece(a,Math.max(a,left),c,e);piece(Math.min(b,right),b,c,e);
        piece(Math.max(a,left),Math.min(b,right),c,Math.max(c,bottom));
        piece(Math.max(a,left),Math.min(b,right),Math.min(e,top),e);
        return result;
      });
    }
    for(const p of parts){geo(new T.BoxGeometry(p.w,p.h,p.d),m,p.x,p.y,p.z);if(solid)collisions.push([p.x-p.w/2,p.y-p.h/2,p.z-p.d/2,p.x+p.w/2,p.y+p.h/2,p.z+p.d/2]);}
  }
  function cyl(x:number,y:number,z:number,r:number,h:number,m:Mat,rt=r){geo(new T.CylinderGeometry(rt,r,h,12),m,x,y,z);if(h>.5)collisions.push([x-r,y-h/2,z-r,x+r,y+h/2,z+r]);}
  function table(x:number,z:number){box(x,1.15,z,3,.2,2,'wood',true);for(const a of [-1,1])for(const b of [-.65,.65])box(x+a,.55,z+b,.18,1.1,.18,'wood');}
  if(kind==='fountain'){
    // The supplied fountain GLB is attached by CityProps.
  }else if(kind==='market'){
    // Market GLBs are attached after the saved transform is restored.
  }else{
    const grand=kind==='palace',church=kind==='church',guild=kind==='guild',inn=kind==='inn';
    const enterable=['house','inn','tavern','church','guild','weapons','potions','shop','warehouse','palace'].includes(kind);
    const twoStoreys=!church&&kind!=='tavern'&&kind!=='warehouse';
    const w=grand?30:guild?22:church?18:inn?32:kind==='tavern'?32:kind==='house'?12:16;
    const d=grand?25:church?28:guild?24:inn?12:kind==='tavern'?28:16;
    const h=grand?12:church?15:inn?9:8;
    const door=church?h*.5*(2.39/3.14):kind==='warehouse'?5.2:1.7,dh=church?h*.5:kind==='warehouse'?3.8:h*.27+.95;
    root.userData.building={width:w,depth:d,height:h,doorWidth:door,doorHeight:dh,enterable,storeys:twoStoreys?2:1,frontWindows:church?0:4,frontAxis:"+Z"};
    if(enterable){
      const woodFloor=['tavern','inn','shop','weapons','potions'].includes(kind);
      if(!woodFloor)box(0,-.04,0,w,.24,d,'stone',false);
      if(woodFloor)woodFloorSurfaces.push([-w/2,-d/2,w/2,d/2,.08]);
      walkSurfaces.push([-w/2,-d/2,w/2,d/2,.08]);
    }
    // Subdivide walls around square apertures; collisions follow the same pieces.
    const opening=CITY_WINDOW_OPENING;
    if(!church){
      for(const side of [-1,1]){
        for(const y of (twoStoreys?[h*.25,h*.75]:[h*.25]))windows.push({x:side*w*.3-.18,y,z:d/2,rotation:0});
        // The right wall borders the staircase: keep it solid, without windows or curtains.
        if(!(enterable&&twoStoreys&&side===1))for(const z of [-d*.25,d*.25])windows.push({x:side*w/2,y:h*.25,z:z+side*.18,rotation:side*Math.PI/2});
      }
    }
    const wall=(center:number,length:number,sideWall:boolean,face:number,holes:{u:number;y:number}[])=>{
      const xs=[center-length/2,center+length/2,...holes.flatMap(p=>[p.u-opening/2,p.u+opening/2])].sort((a,b)=>a-b);
      const ys=[0,h,...holes.flatMap(p=>[p.y-opening/2,p.y+opening/2])].sort((a,b)=>a-b);
      for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
        const u=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2,ww=xs[i]-xs[i-1],hh=ys[j]-ys[j-1];
        if(ww<.001||hh<.001||holes.some(p=>Math.abs(u-p.u)<opening/2&&Math.abs(y-p.y)<opening/2))continue;
        if(sideWall)box(face,y,u,.45,hh,ww,'plaster');else box(u,y,face,ww,hh,.45,'plaster');
      }
    };
    for(const side of [-1,1])wall(0,d-.45,true,side*w/2,windows.filter(p=>p.rotation===side*Math.PI/2).map(p=>({u:p.z,y:p.y})));
    box(0,h/2,-d/2,w+.45,h,.45,'plaster',true);
    for(const sign of [-1,1])wall(sign*(w+.45+door)/4,(w+.45-door)/2,false,d/2,windows.filter(p=>p.rotation===0&&Math.sign(p.x)===sign).map(p=>({u:p.x,y:p.y})));
    if(church){
      const radius=door/2,rise=dh*.34,spring=dh-rise;
      const header=new T.Shape();header.moveTo(-radius,spring);header.lineTo(-radius,h);header.lineTo(radius,h);header.lineTo(radius,spring);
      header.absellipse(0,spring,radius,rise,0,Math.PI,false,0);header.closePath();
      geo(new T.ExtrudeGeometry(header,{depth:.45,bevelEnabled:false,curveSegments:32}),'stone',0,0,d/2-.225);
      for(let i=0;i<24;i++){
        const x0=-radius+i*door/24,x1=x0+door/24;
        const y=spring+rise*Math.sqrt(Math.max(0,1-Math.max(x0*x0,x1*x1)/(radius*radius)));
        collisions.push([x0,y,d/2-.225,x1,h,d/2+.225]);
      }
    }else box(0,(h+dh)/2,d/2,door,h-dh,.45,'plaster',true);
    if(!church){
      // Corner posts cover both wall edges; rails meet their sides without coplanar overlap.
      const post=.36;
      for(const sx of [-1,1])for(const sz of [-1,1])box(sx*(w/2+.1),h/2,sz*(d/2+.1),post,h,post,'wood');
      for(const x of [-door/2,door/2])box(x,h/2,d/2+.28,.3,h,.3,'wood');
      for(const inside of [false,true]){
        const offset=inside?-.28:.28;
        const width=inside?w-.56:w-.16,depth=inside?d-.56:d-.16;
        for(const y of (kind==='tavern'?[.125,h-.12]:[.125,h*.52,h-.12])){
          if(y>dh)box(0,y,d/2+offset,width,.25,.16,'wood');
          else for(const sign of [-1,1])box(sign*(width+door)/4,y,d/2+offset,(width-door)/2,.25,.16,'wood');
          box(0,y,-d/2-offset,width,.25,.16,'wood');
          for(const sign of [-1,1])box(sign*(w/2+offset),y,0,.16,.25,depth,'wood');
        }
        // Uprights divide each side into panels, with window clearance handled by box().
        for(const sign of [-1,1])box(sign*(w/2+offset),h/2,0,.16,h,.22,'wood');
        if(inside)for(const x of [-w/2+.6,-door/2-.2,door/2+.2,w/2-.6])box(x,h/2,d/2-.28,.22,h,.16,'wood');
        if(inside)for(const x of [-w/2+.6,0,w/2-.6])box(x,h/2,-d/2+.28,.22,h,.16,'wood');
      }
    }
    // A continuous ceiling closes roof seams and blocks direct sunlight above rooms.
    if(enterable)box(0,h-.1,0,w+.45,.2,d+.45,'wood',false);
    if(kind==='warehouse'){
      for(const z of [-d*.4,-d*.2,0,d*.2,d*.4])box(0,h-.38,z,w-.5,.36,.32,'wood');
      for(const x of [-w*.25,w*.25])box(x,h-.7,0,.28,.3,d-.5,'wood');
    }
    const rw=inn?d:w,rd=inn?w:d,rise=rw*.4,slope=Math.atan2(rise,rw/2),length=Math.hypot(rw/2,rise)+.8;
    for(const sign of [-1,1]){
      const g=new T.BoxGeometry(length,.3,rd+1.5);g.rotateZ(-sign*slope);g.translate(sign*rw/4,h+rise/2,0);if(inn)g.rotateY(Math.PI/2);geo(g,'roof',0,0,0);
    }
    for(const z of [-rd/2,rd/2]){const shape=new T.Shape();shape.moveTo(-rw/2,0);shape.lineTo(rw/2,0);shape.lineTo(0,rise);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false});g.translate(0,h,z);if(inn)g.rotateY(Math.PI/2);geo(g,'plaster',0,0,0);}
    if(!church&&kind!=='tavern'){box(w*.32,h+2,-d*.3,1.3,5,1.3,'stone');box(w*.32,h+4.6,-d*.3,1.7,.35,1.7,'stone');}
    referenceBuildingDetails({geo,box,cyl},w,d,h,door,church,inn,dh,kind!=='warehouse');
    // Preserve the facade frame; omit the two deep jambs projecting outward.

    for(const sign of [-1,1])box(sign*(door/2+.6),2.15,d/2+.5,.23,.4,.23,'gold');
    if(enterable&&!church)box(0,dh+.45,d/2+.4,door+.6,.5,.15,'wood');
    if(enterable&&twoStoreys){
      const level=h/2,stairX=w/2-1.7,start=d/2-2,end=-d/2+2,run=start-end,steps=20;
      const addFloor=(x:number,z:number,fw:number,fd:number)=>{const surface=[x-fw/2,z-fd/2,x+fw/2,z+fd/2,level];walkSurfaces.push(surface);woodFloorSurfaces.push(surface);};
      const edge=stairX-1.2;
      addFloor((-w/2+.3+edge)/2,0,w-3.2,d-.6);
      addFloor(stairX,(-d/2+end)/2,2.4,end+d/2);
      // Close the floor around the stair opening all the way to the facade.
      const outer=stairX+1.2,insideWall=w/2-.225;
      addFloor((outer+insideWall)/2,0,insideWall-outer,d-.6);
      addFloor((edge+outer)/2,(start+d/2-.3)/2,outer-edge,d/2-.3-start);
      // Geometry and support use identical treads, ascending toward the rear landing.
      geo(cityStairGeometry(start,end,2.4,0,level,steps,0),'wood',stairX,0,0);
      for(let i=0;i<steps;i++){
        const top=(i+1)*level/steps,z=start-(i+.5)*run/steps;
        walkSurfaces.push([edge,z-run/steps/2,stairX+1.2,z+run/steps/2,top]);
      }
      // Guard the upper-floor opening on three sides; the rear landing stays open.
      const railing=(x0:number,z0:number,x1:number,z1:number)=>{
        const length=Math.hypot(x1-x0,z1-z0),alongX=Math.abs(x1-x0)>.001;
        const post=.14,height=1.1,segments=Math.ceil(length/1.15);
        for(let i=0;i<=segments;i++){
          const t=i/segments;
          box(x0+(x1-x0)*t,level+height/2,z0+(z1-z0)*t,post,height,post,'wood',false);
        }
        for(const offset of [.5,1.05])box((x0+x1)/2,level+offset,(z0+z1)/2,alongX?length+post:post,.12,alongX?post:length+post,'wood',false);
        // One continuous collider per side keeps the player inside the railing.
        collisions.push([Math.min(x0,x1)-post/2,level,Math.min(z0,z1)-post/2,Math.max(x0,x1)+post/2,level+height,Math.max(z0,z1)+post/2]);
      };
      const railLeft=edge-.09,railRight=outer+.09,railFront=start+.09;
      // Omit the final bay beside the upper landing, including its collider.
      const landingBay=2.6;
      railing(railLeft,end+landingBay,railLeft,railFront);
      railing(railRight,end,railRight,railFront);
      // Side posts already support the return, so do not duplicate its end posts.
      box((railLeft+railRight)/2,level+1.05,railFront,railRight-railLeft,.12,.14,'wood',false);
      box((railLeft+railRight)/2,level+.5,railFront,railRight-railLeft,.12,.14,'wood',false);
      const returnSegments=Math.ceil((railRight-railLeft)/1.15);
      for(let i=1;i<returnSegments;i++)box(railLeft+(railRight-railLeft)*i/returnSegments,level+.55,railFront,.14,1.1,.14,'wood',false);
      collisions.push([railLeft-.07,level,railFront-.07,railRight+.07,level+1.1,railFront+.07]);
      // The whole upper storey is one bedroom, open to the stair landing.
      // Keep furniture on the continuous floor, clear of the stair opening.
      const roomLeft=-w/2+.3,roomRight=edge;
      root.userData.upperBedroom={x:(roomLeft+roomRight)/2,z:0,width:roomRight-roomLeft,depth:d-.6,y:level};
      root.userData.stairPlacement={x:stairX,z:(start+end)/2,width:2.4,height:level,depth:run};
      root.userData.upperFloor=level;
    }
    if(kind==='potions'||kind==='weapons'||kind==='shop'||guild){
      // The supplied tavern bar counter is attached by CityProps.
      // Inventory item models are attached to the shelves by CityShopDisplays.
      if(guild){box(0,6,-d/2+.4,w*.7,4,.2,'wood');for(let i=0;i<9;i++)box(-w*.29+i*w*.07,6+(i%2)*.4,-d/2+.55,1.1,2,.05,'plaster');for(const x of [-w*.3,w*.3])table(x,2);}
    }
    if(church){
      const carpetFront=d/2-.4,carpetAltar=-d*.34+.45;
      box(0,.095,(carpetFront+carpetAltar)/2,3.2,.025,carpetFront-carpetAltar,'red',false);
      box(0,6,-d/2+.4,.4,4,.3,'gold');box(0,6.5,-d/2+.4,2.3,.35,.3,'gold');
      const tx=-w/2-2,tz=d*.28;
      box(tx,h*.45,tz,4,h*.9,5,'stone',true);
      for(const dx of [-1.65,1.65])for(const dz of [-2.15,2.15])box(tx+dx,h*1.08,tz+dz,.7,h*.36,.7,'stone');
      box(tx,h*1.26,tz,4.6,.45,5.6,'stone');
      geo(new T.ConeGeometry(3.5,8,4),'roof',tx,h*1.26+4,tz,0,Math.PI/4);
      for(const dx of [-1.8,1.8])for(const dz of [-2.2,2.2])geo(new T.ConeGeometry(.5,1.5,4),'stone',tx+dx,h*1.3,tz+dz,0,Math.PI/4);}
    if(grand){for(const sign of [-1,1]){cyl(sign*(w/2+3),h*.6,-d*.3,3,h*1.2,'stone');geo(new T.ConeGeometry(4,7,8),'roof',sign*(w/2+3),h*1.2+3.5,-d*.3);collisions.push([sign*(w/2+3)-3,0,-d*.3-3,sign*(w/2+3)+3,h*1.2,-d*.3+3]);}}


  }
  for(const [m,geometries] of batches){const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!geometry)throw new Error(`Failed to merge medieval material ${m}`);if(geometry){geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,materials[m]);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.cityObject=true;root.add(mesh);}}
  root.userData.cityObject=true;root.userData.localColliders=collisions;root.userData.walkSurfaces=walkSurfaces;root.userData.woodFloorSurfaces=woodFloorSurfaces;root.userData.windows=windows;root.userData.sharedCityGeometry=true;
  cache.set(kind,root);return root.clone(true);
}
