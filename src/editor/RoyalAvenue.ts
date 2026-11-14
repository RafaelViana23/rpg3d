import {cutStreetBorderOpenings} from './StreetBorderOpenings';
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
export function createRoyalAvenue(saved:SavedCityObject, renderAvenueMesh=true){
  const root=new T.Group();root.name='Cidade:road';
  root.userData.cityObject=true;root.userData.localColliders=[];root.userData.royalAvenue=true;
  root.userData.streetMouthPoints=saved.streetBorderOpenings?.map(opening=>{const p=opening.reduce((acc,point)=>acc.add(new T.Vector3(point[0],0,point[1])),new T.Vector3());return p.multiplyScalar(1/opening.length);})??[];
  const start=saved.points![0][2],end=saved.points![1][2],width=saved.width??20;
  root.userData.royalAvenueAreas=[[-width/2-.9,start,width/2+.9,end]];
  root.userData.avenueGateEnds=[{x:0,z:start,width,axis:'z',sign:-1}];
  const secondary=saved.secondaryAvenues;
  if(secondary)root.userData.avenueGateEnds.push(
    {x:secondary.left,z:0,width:secondary.width,axis:'x',sign:-1},
    {x:secondary.right,z:0,width:secondary.width,axis:'x',sign:1});
  if(secondary)root.userData.royalAvenueAreas.push([secondary.left,-secondary.width/2-.9,secondary.right,secondary.width/2+.9]);
  // The visible paving is 14.5 cm above the buried city foundation. Register
  // the actual L-shaped carriageway as a walk surface so player/NPC height
  // queries land on the tiles instead of the lower foundation cap.
  root.userData.walkSurfaces=[];
  const paving:T.BufferGeometry[]=[],borders:T.BufferGeometry[]=[];
  const box=(target:T.BufferGeometry[],x:number,z:number,w:number,d:number)=>{
    const geometry=new T.BoxGeometry(w,.06,d).toNonIndexed();geometry.translate(x,target===borders?.27:.11,z);target.push(geometry);
  };
  const radius=saved.centralPlazaRadius??26,join=Math.sqrt(radius*radius-width*width/4);
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
  const shape=new T.Shape(contour),islandRadius=saved.fountainPlazaRadius;
  if(islandRadius){
    // The central island owns the fountain and market; traffic uses the annulus.
    shape.holes.push(new T.Path().absarc(0,0,islandRadius+.9,0,Math.PI*2,true));
    const island=new T.CircleGeometry(islandRadius,96);island.rotateX(-Math.PI/2);island.translate(0,.2,0);paving.push(island.toNonIndexed());island.dispose();
    const rim=new T.RingGeometry(islandRadius,islandRadius+.9,96);rim.rotateX(-Math.PI/2);rim.translate(0,.3,0);borders.push(rim.toNonIndexed());rim.dispose();
    root.userData.fountainPlazaCircle={x:0,z:0,radius:islandRadius};
  }
  const surface=new T.ShapeGeometry(shape,48);surface.rotateX(-Math.PI/2);surface.translate(0,.2,0);paving.push(surface.toNonIndexed());surface.dispose();
  for(const side of [-1,1]){
    for(const [a,b]of [[start,-join],[join,end]])box(borders,side*(width/2+.45),(a+b)/2,.9,b-a);
  }
  for(const [a,b]of circleArcs){
    const strip=new T.ShapeGeometry(new T.Shape([...arc(radius,a,b),...arc(radius+.9,b,a)]));
    strip.rotateX(-Math.PI/2);strip.translate(0,.3,0);borders.push(strip.toNonIndexed());strip.dispose();
  }
  for(const r of [10,12]){
    const ring=new T.RingGeometry(r,r+.45,64);ring.rotateX(-Math.PI/2);ring.translate(0,.3,0);borders.push(ring.toNonIndexed());ring.dispose();
  }
  const mouthSideCurbs:T.BufferGeometry[]=[];
  // Continue only the two long side curbs at each street mouth. This makes
  // the avenue/street join read as an L and leaves the short end unclosed.
  for(const opening of saved.streetBorderOpenings??[]){
    const edges=opening.map((point,index)=>{
      const next=opening[(index+1)%opening.length];
      return {a:point,b:next,length:Math.hypot(next[0]-point[0],next[1]-point[1])};
    }).sort((a,b)=>b.length-a.length).slice(0,2);
    for(const edge of edges){
      if(edge.length<.01)continue;
      const geometry=new T.BoxGeometry(.9,.06,edge.length).toNonIndexed();
      geometry.translate((edge.a[0]+edge.b[0])/2,.27,(edge.a[1]+edge.b[1])/2);
      geometry.rotateY(Math.atan2(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]));
      mouthSideCurbs.push(geometry);
    }
  }
  const stone=cityPavingMaterial().clone();stone.color.set('#d0d5dc');
  const trim=new T.MeshLambertMaterial({color:'#73766f'});
  // The old avenue overlay is intentionally removed from the rendered map.
  // Keep the saved footprint/walk surfaces above for compatibility, but do not
  // recreate the large rectangular/L-shaped meshes that were being shown as
  // black slabs at night.
  for(const [parts,material]of (renderAvenueMesh ? [[borders,trim]] as const : [])){
    let geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
    if(material===trim&&saved.streetBorderOpenings?.length){const cut=cutStreetBorderOpenings(geometry,saved.streetBorderOpenings);geometry.dispose();geometry=cut;}
    alignCityPavingUV(geometry);
    const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.userData.cityObject=true;root.add(mesh);
  }
  // These side pieces must be added after the opening cut, otherwise the cut
  // removes the L-shaped continuation together with the old cap.
  for(const geometry of mouthSideCurbs){
    const mesh=new T.Mesh(geometry,trim);mesh.receiveShadow=true;mesh.userData.cityObject=true;root.add(mesh);
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

/** Continue the actual avenue material to each saved gateway, without editing saves. */
export function updateRoyalAvenueGatePaving(root:T.Object3D,gates:T.Object3D[]){
  for(const child of [...root.children])if(child.userData.avenueGatePaving){
    root.remove(child);(child as T.Mesh).geometry.dispose();
  }
  root.updateWorldMatrix(true,true);
  const source=root.children.find(child=>child instanceof T.Mesh) as T.Mesh|undefined;
  if(!source)return;
  const ends=root.userData.avenueGateEnds as {x:number;z:number;width:number;axis:'x'|'z';sign:number}[];
  for(const end of ends??[]){
    const targets=gates.map(g=>root.worldToLocal(g.getWorldPosition(new T.Vector3())));
    const target=targets.sort((a,b)=>Math.hypot(a.x-end.x,a.z-end.z)-Math.hypot(b.x-end.x,b.z-end.z))[0];
    if(!target||Math.hypot(target.x-end.x,target.z-end.z)>30)continue;
    const gap=(target[end.axis]-end[end.axis])*end.sign;
    if(gap<=0)continue;
    const length=gap+.04;
    const geometry=new T.PlaneGeometry(end.axis==='z'?end.width:length,end.axis==='z'?length:end.width);
    geometry.rotateX(-Math.PI/2);
    const x=end.axis==='x'?end.x+end.sign*(gap/2):end.x;
    const z=end.axis==='z'?end.z+end.sign*(gap/2):end.z;
    geometry.translate(x,.2,z);alignCityPavingUV(geometry);
    const patch=new T.Mesh(geometry,source.material);patch.receiveShadow=true;
    patch.name='Continuação da avenida até a escada';patch.userData.avenueGatePaving=true;root.add(patch);
  }
}
