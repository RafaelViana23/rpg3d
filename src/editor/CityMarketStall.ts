import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_COLOR,CITY_WOOD_MATERIAL} from './CityWood';
import {IRON_ARMOR_COLOR,IRON_METALNESS,IRON_ROUGHNESS} from '../inventory/armorMaterials';
export type MarketVariant='Stand_Vegetables'|'Stand_Tools'|'Stand_Meat';
const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,flatShading:true});
const ironMaterial=new T.MeshStandardMaterial({color:IRON_ARMOR_COLOR,metalness:IRON_METALNESS,roughness:IRON_ROUGHNESS,flatShading:true});
/** Approved procedural market stalls, facing +Z and resting on Y=0. */
export function createCityMarketStall(variant:MarketVariant){
 const parts:T.BufferGeometry[]=[],iron:T.BufferGeometry[]=[],wood:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:string,metal=false)=>{
  if(g.index){const source=g;g=g.toNonIndexed();source.dispose();}
  const c=new T.Color(metal?'#ffffff':color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));(metal?iron:color===CITY_WOOD_COLOR?wood:parts).push(g);
 };
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,color=CITY_WOOD_COLOR,metal=false)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color,metal);};
 const sphere=(x:number,y:number,z:number,r:number,color:string,sx=1,sy=1,sz=1)=>{const g=new T.IcosahedronGeometry(r,0);g.scale(sx,sy,sz);g.translate(x,y,z);add(g,color);};
 for(const x of [-1.7,1.7])for(const z of [-.8,.8]){const height=z<0?2.65:2.22;box(x,height/2,z,.095,height,.095);}
 box(0,.98,.4,3.5,.14,.8);
 for(const x of [-1.4,1.4])for(const z of [.12,.7])box(x,.48,z,.09,.96,.09);
 for(const z of [-.8,.8])box(0,z<0?2.6:2.17,z,3.6,.08,.08);
 const cloth=variant==='Stand_Vegetables'?'#285caa':variant==='Stand_Tools'?'#b64c32':'#8e369c';
 for(let i=0;i<8;i++){
  const x0=-1.9+i*.475,x1=x0+.475,g=new T.BufferGeometry();
  const p=[x0,2.22,1.05,x1,2.22,1.05,x0,2.65,-1.05,x1,2.65,-1.05,x0,.85,-1.05,x1,.85,-1.05,x0,2.02,1.05,x1,2.02,1.05];
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,1,3,0,3,2,2,3,5,2,5,4,6,7,1,6,1,0]);g.computeVertexNormals();add(g,i%2?'#e4dfd2':cloth);
 }
 if(variant!=='Stand_Vegetables')box(0,1.065,.4,3.35,.025,.8,variant==='Stand_Meat'?'#9b6764':'#d2bd91');
 if(variant==='Stand_Vegetables'){
  for(let column=0;column<4;column++){
   const x=-1.32+column*.88,start=parts.length,woodStart=wood.length;
   box(x,1.1,.55,.78,.06,.86);
   for(const z of [.10,1])box(x,1.21,z,.84,.18,.035);
   for(const side of [-1,1])box(x+side*.41,1.21,.55,.035,.18,.9);
   if(column===2){
    for(let i=0;i<12;i++){
     const px=x+(i%4-1.5)*.14,pz=.3+Math.floor(i/4)*.22;
     const stem=new T.CylinderGeometry(.009,.009,.22,3);stem.rotateX(Math.PI/2);stem.translate(px,1.2,pz);add(stem,'#b99c55');sphere(px,1.25,pz+.07,.055,'#d0ad56',.65,.65,1.8);
    }
   }else for(let row=0;row<3;row++)for(let i=0;i<3;i++){
    const px=x+(i-1)*.22,pz=.3+row*.25;
    if(column===0){const carrot=new T.ConeGeometry(.055,.22,4);carrot.rotateX(Math.PI/2);carrot.translate(px,1.22,pz);add(carrot,'#c88a35');box(px,1.22,pz-.13,.03,.025,.07,'#6a8c40');}
    else sphere(px,1.23,pz,.105,column===1?'#bcab68':'#b94b3b',1,column===1?.8:1,column===1?1.2:1);
   }
   for(const geometry of [...parts.slice(start),...wood.slice(woodStart)]){geometry.translate(-x,-1.1,-.55);geometry.rotateX(Math.PI*.30);geometry.translate(x,.65,.95);}
  }
  for(const x of [-1.55,1.55])box(x,.155,1.27,.08,.31,.08);
 }else if(variant==='Stand_Tools'){
  for(let i=0;i<5;i++){
   const x=-1.3+i*.65;box(x,1.08,.48,.055,.055,.55);
   if(i%2)box(x,1.12,.67,.30,.11,.1,IRON_ARMOR_COLOR,true);
   else {const blade=new T.ConeGeometry(.13,.3,3);blade.rotateX(Math.PI/2);blade.translate(x,1.1,.68);add(blade,IRON_ARMOR_COLOR,true);}
  }
  for(const x of [-1,0,1]){box(x,1.65,-.73,.045,.85,.045);box(x,1.97,-.73,.33,.11,.08,IRON_ARMOR_COLOR,true);}
  for(const x of [-1.1,1.1]){
   const barrel=new T.LatheGeometry([new T.Vector2(.20,0),new T.Vector2(.24,.3),new T.Vector2(.22,.62),new T.Vector2(.19,.62),new T.Vector2(.19,.53)],6);barrel.translate(x,0,1.03);add(barrel,CITY_WOOD_COLOR);
   for(const y of [.12,.5]){const ring=new T.CylinderGeometry(.235,.235,.035,6,1,true);ring.translate(x,y,1.03);add(ring,IRON_ARMOR_COLOR,true);}
   for(let i=0;i<4;i++){box(x+(i-1.5)*.075,.76,1.03+(i%2)*.07,.035,.55,.035);box(x+(i-1.5)*.075,1.04,1.03+(i%2)*.07,.16,.07,.04,IRON_ARMOR_COLOR,true);}
  }
 }else{
  for(let i=0;i<5;i++)sphere(-1.25+i*.62,1.19,.55,.18,i%2?'#9a4f45':'#c18b77',1.25,.65,.8);
  for(const x of [-1.15,0,1.15]){
   box(x,1.92,-.73,.025,.27,.025,IRON_ARMOR_COLOR,true);sphere(x,1.61,-.73,.14,'#985042',.7,1.7,.75);sphere(x,1.79,-.73,.065,'#dac9a6',.5,1.4,.6);
  }
 }
 const root=new T.Group();
 for(const [geometries,mat,name]of [[wood,CITY_WOOD_MATERIAL,'Madeira'],[parts,material,'Tecido e produtos'],[iron,ironMaterial,'Ferramentas e ganchos de ferro']] as const){if(!geometries.length)continue;const geometry=mergeGeometries([...geometries])!;geometries.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 root.name=variant;const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const child of root.children)child.position.set(-center.x,-bounds.min.y,-center.z);return root;
}
