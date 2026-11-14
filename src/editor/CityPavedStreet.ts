import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {SavedCityObject} from './WorldEditorSupport';
export type StreetPolygon={outline:number[][];holes:number[][][]};
export type PavedStreet={revision:1;paving:StreetPolygon[];border:StreetPolygon[];sourceHash:string};
/** Joined intersections have continuous paving and borders only around the outside. */
export function createCityPavedStreet(saved:SavedCityObject){
 const root=new T.Group();root.name='Cidade:road';root.userData.cityObject=true;root.userData.localColliders=[];
 // With the paving removed, walking falls back to the real city/terrain floor.
 root.userData.walkSurfaces=[];
 const trim=new T.MeshLambertMaterial({color:'#73766f'});
 for(const [polygons,material,height]of [[saved.pavedStreet!.border,trim,.4]] as const){
  const parts=polygons.map(polygon=>{
   const shape=new T.Shape(polygon.outline.map(([x,z])=>new T.Vector2(x,-z)));
   for(const hole of polygon.holes)shape.holes.push(new T.Path(hole.map(([x,z])=>new T.Vector2(x,-z))));
   const geometry=new T.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);geometry.translate(0,height,0);return geometry.toNonIndexed();
  });
  const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());if(!geometry)continue;
  const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;root.add(mesh);
 }
 return root;
}
