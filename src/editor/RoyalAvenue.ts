import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import layout from './royal-avenue-layout.json';
import type { LowPolyCityBuilder } from './LowPolyCityBuilder';
import type { SavedCityObject } from './WorldEditorSupport';
import { cityPavingMaterial, alignCityPavingUV } from '../world/CityPaving';

/** One-time arrangement approved from the main gate toward the far wall. */
export function applyRoyalAvenueLayout(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
  if(saved[layout.palaceId]?.royalAvenueRevision===1)return false;
  if(!saved[layout.palaceId]||!saved[layout.gateId])return false;
  for(const [id,value]of Object.entries(layout.moves)){
    const entry=structuredClone(value) as SavedCityObject;
    if(!saved[id]&&id!=='city-royal-avenue-v1')continue;
    saved[id]=entry;
    const object=builder.objects.get(id);
    if(object){object.position.fromArray(entry.position);object.rotation.set(entry.rotation[0],entry.rotation[1],entry.rotation[2]);object.scale.fromArray(entry.scale);}
    else builder.add(entry);
  }
  return true;
}

/** Raised paving and border strips share two draws for the whole boulevard. */
export function createRoyalAvenue(saved:SavedCityObject){
  const root=new T.Group();root.name='Cidade:road';
  root.userData.cityObject=true;root.userData.localColliders=[];root.userData.royalAvenue=true;
  const start=saved.points![0][2],end=saved.points![1][2],width=saved.width??20;
  root.userData.royalAvenueAreas=[[-width/2-.9,start,width/2+.9,end]];
  const secondary=saved.secondaryAvenues;
  if(secondary)root.userData.royalAvenueAreas.push([secondary.left,-secondary.width/2-.9,secondary.right,secondary.width/2+.9]);
  const paving:T.BufferGeometry[]=[],borders:T.BufferGeometry[]=[];
  const box=(target:T.BufferGeometry[],x:number,z:number,w:number,d:number)=>{
    const geometry=new T.BoxGeometry(w,.06,d).toNonIndexed();geometry.translate(x,.11,z);target.push(geometry);
  };
  const radius=26,join=Math.sqrt(radius*radius-width*width/4);
  root.userData.royalAvenueCircle={x:0,z:0,radius:radius+.9};
  const leftTop=Math.acos(-width/2/radius),leftBottom=Math.PI*2-leftTop;
  const rightTop=Math.acos(width/2/radius);
  const arc=(r:number,a:number,b:number,count=48)=>Array.from({length:count+1},(_,i)=>{const angle=a+(b-a)*i/count;return new T.Vector2(Math.cos(angle)*r,-Math.sin(angle)*r);});
  let contour:T.Vector2[],circleArcs:[number,number][];
  if(secondary){
    const half=secondary.width/2,sideAngle=Math.asin(half/radius);
    circleArcs=[[leftBottom,Math.PI+sideAngle],[Math.PI-sideAngle,leftTop],[rightTop,sideAngle],[-sideAngle,-rightTop]];
    contour=[new T.Vector2(-width/2,-start),...arc(radius,...circleArcs[0]),
      new T.Vector2(secondary.left,half),new T.Vector2(secondary.left,-half),...arc(radius,...circleArcs[1]),
      new T.Vector2(-width/2,-end),new T.Vector2(width/2,-end),...arc(radius,...circleArcs[2]),
      new T.Vector2(secondary.right,-half),new T.Vector2(secondary.right,half),...arc(radius,...circleArcs[3]),new T.Vector2(width/2,-start)];
    const joinSide=Math.sqrt(radius*radius-half*half);
    for(const sign of [-1,1])for(const [a,b]of [[secondary.left,-joinSide],[joinSide,secondary.right]])box(borders,(a+b)/2,sign*(half+.45),b-a,.9);
  }else{
    circleArcs=[[leftBottom,leftTop],[rightTop,-rightTop]];
    contour=[new T.Vector2(-width/2,-start),...arc(radius,leftBottom,leftTop),
      new T.Vector2(-width/2,-end),new T.Vector2(width/2,-end),...arc(radius,rightTop,-rightTop),new T.Vector2(width/2,-start)];
  }
  const surface=new T.ShapeGeometry(new T.Shape(contour));surface.rotateX(-Math.PI/2);surface.translate(0,.14,0);paving.push(surface.toNonIndexed());surface.dispose();
  for(const side of [-1,1]){
    for(const [a,b]of [[start,-join],[join,end]])box(borders,side*(width/2+.45),(a+b)/2,.9,b-a);
  }
  for(const [a,b]of circleArcs){
    const strip=new T.ShapeGeometry(new T.Shape([...arc(radius,a,b),...arc(radius+.9,b,a)]));
    strip.rotateX(-Math.PI/2);strip.translate(0,.14,0);borders.push(strip.toNonIndexed());strip.dispose();
  }
  for(const r of [10,12]){
    const ring=new T.RingGeometry(r,r+.45,64);ring.rotateX(-Math.PI/2);ring.translate(0,.145,0);borders.push(ring.toNonIndexed());ring.dispose();
  }
  const stone=cityPavingMaterial().clone();stone.color.set('#d0d5dc');
  const trim=new T.MeshLambertMaterial({color:'#73766f'});
  for(const [parts,material]of [[paving,stone],[borders,trim]] as const){
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
    alignCityPavingUV(geometry);
    const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.userData.cityObject=true;root.add(mesh);
  }
  return root;
}

/** Keep courtyard objects clear of both the boulevard and palace forecourt. */
export function royalAvenueBlocksPoint(avenue:T.Object3D,point:T.Vector3,clearance=0){
  avenue.updateWorldMatrix(true,false);
  const local=avenue.worldToLocal(point.clone()),scale=avenue.getWorldScale(new T.Vector3());
  const pad=clearance/Math.max(.001,Math.min(Math.abs(scale.x),Math.abs(scale.z)));
  const circle=avenue.userData.royalAvenueCircle as {x:number;z:number;radius:number}|undefined;
  if(circle&&Math.hypot(local.x-circle.x,local.z-circle.z)<=circle.radius+pad)return true;
  return (avenue.userData.royalAvenueAreas as number[][]|undefined)?.some(([x0,z0,x1,z1])=>local.x>=x0-pad&&local.x<=x1+pad&&local.z>=z0-pad&&local.z<=z1+pad)??false;
}

export function updateRoyalAvenueUV(root:T.Object3D,floor?:T.Object3D){
  root.updateWorldMatrix(true,true);
  const toAvenue=root.matrixWorld.clone().invert();
  root.traverse(object=>{if(object instanceof T.Mesh)alignCityPavingUV(object.geometry,toAvenue.clone().multiply(object.matrixWorld));});
  if(floor){
    floor.updateWorldMatrix(true,true);
    floor.traverse(object=>{if(object instanceof T.Mesh)alignCityPavingUV(object.geometry,toAvenue.clone().multiply(object.matrixWorld));});
  }
}
