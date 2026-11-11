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
  if(roots.length<2)return;
  building.updateWorldMatrix(true,true);
  const inverse=building.matrixWorld.clone().invert();
  const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[]}>();
  for(const root of roots)root.traverse(child=>{
    if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||Array.isArray(child.material))return;
    const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(child.matrixWorld));
    const key=`${child.material.id}:${Object.keys(geometry.attributes).sort().map(k=>`${k}:${geometry.attributes[k].itemSize}:${geometry.attributes[k].normalized}`).join(',')}`;
    const batch=batches.get(key)??{material:child.material,geometries:[] as T.BufferGeometry[]};batch.geometries.push(geometry);batches.set(key,batch);
  });
  const merged=new T.Group();merged.name='Objetos estáticos agrupados';merged.userData.batchableCityProp=true;
  // A replacement batch inherits distance culling during asynchronous loading.
  const hidden=roots.every(root=>root.userData.cityDistanceHidden);
  if(hidden){merged.visible=false;merged.userData.cityDistanceHidden=true;}
  for(const batch of batches.values()){
    const geometry=mergeGeometries(batch.geometries);
    batch.geometries.forEach(g=>g.dispose());
    if(!geometry){merged.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});return;}
    const mesh=new T.Mesh(geometry,batch.material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.mergedCityGeometry=true;merged.add(mesh);
  }
  for(const root of roots){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh&&o.userData.mergedCityGeometry)o.geometry.dispose();});}
  building.add(merged);
}
