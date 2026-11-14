import {registerCityInteriorProp} from './CityInteriorStreaming';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const pending=new WeakMap<T.Group,ReturnType<typeof setTimeout>>();
const ready=new Set<T.Group>();
let scheduled=false;
function drainBatch(){
  scheduled=false;
  const building=ready.values().next().value as T.Group|undefined;
  if(building){ready.delete(building);if(building.parent)batchCityProps(building);}
  if(ready.size)scheduleDrain();
}
function scheduleDrain(){
  if(scheduled)return;scheduled=true;
  // Spread geometry merges over frames instead of blocking on the whole city.
  if(typeof requestIdleCallback==='function')requestIdleCallback(drainBatch,{timeout:250});
  else setTimeout(drainBatch,16);
}
export function scheduleCityPropBatch(building:T.Group){
  const previous=pending.get(building);if(previous)clearTimeout(previous);
  pending.set(building,setTimeout(()=>{pending.delete(building);ready.add(building);scheduleDrain();},200));
}
export function batchCityProps(building:T.Group){
  const roots=building.children.filter(o=>o.userData.batchableCityProp);
  // An exterior barrel must never share a visibility root with indoor furniture.
  for(const interior of [false,true]){
    const partition=roots.filter(root=>!!root.userData.cityInteriorProp===interior);
    if(partition.length>=2)batchRoots(building,partition,interior);
  }
}
function batchRoots(building:T.Group,roots:T.Object3D[],interior:boolean){
  building.updateWorldMatrix(true,true);
  const inverse=building.matrixWorld.clone().invert();
  const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[];castShadow:boolean;receiveShadow:boolean}>();
  for(const root of roots)root.traverse(child=>{
    if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||Array.isArray(child.material))return;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(child.matrixWorld));
    const key=`${child.material.id}:${child.castShadow}:${child.receiveShadow}:${Object.keys(geometry.attributes).sort().map(k=>`${k}:${geometry.attributes[k].itemSize}:${geometry.attributes[k].normalized}`).join(',')}`;
    const batch=batches.get(key)??{material:child.material,geometries:[] as T.BufferGeometry[],castShadow:child.castShadow,receiveShadow:child.receiveShadow};batch.geometries.push(geometry);batches.set(key,batch);
  });
  const merged=new T.Group();merged.name='Objetos estáticos agrupados';merged.userData.batchableCityProp=true;
  merged.userData.batchedCitySources=roots;
  // A replacement batch inherits distance culling during asynchronous loading.
  const hidden=roots.every(root=>root.userData.cityDistanceHidden);
  if(hidden){merged.visible=false;merged.userData.cityDistanceHidden=true;}
  for(const batch of batches.values()){
    const geometry=mergeGeometries(batch.geometries);
    batch.geometries.forEach(g=>g.dispose());
    if(!geometry){merged.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});return;}
    const mesh=new T.Mesh(geometry,batch.material);mesh.castShadow=batch.castShadow;mesh.receiveShadow=batch.receiveShadow;mesh.userData.mergedCityGeometry=true;merged.add(mesh);
  }
  for(const root of roots){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh&&o.userData.mergedCityGeometry)o.geometry.dispose();});}
  building.add(merged);
  if(interior)registerCityInteriorProp(building,merged,new T.Vector3().fromArray(roots[0].userData.cityInteriorPosition));
}

/** Restore source props while Build needs individual transforms and picking. */
export function restoreCityPropBatches(root:T.Object3D){
  const batches:T.Object3D[]=[];
  root.traverse(object=>{if(object.userData.batchedCitySources)batches.push(object);});
  for(const batch of batches){
    const sources=batch.userData.batchedCitySources as T.Object3D[];
    for(const source of sources){source.userData.buildEditable=true;source.visible=true;if(source.parent!==batch.parent)batch.parent?.add(source);}
    batch.visible=false;
  }
}

export function reapplyCityPropBatches(root:T.Object3D){
  root.traverse(object=>{if(!object.userData.batchedCitySources)return;object.visible=true;for(const source of object.userData.batchedCitySources as T.Object3D[]){source.visible=false;}});
}
