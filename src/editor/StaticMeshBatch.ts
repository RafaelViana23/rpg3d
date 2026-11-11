import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Merge only direct, rigid siblings. The owning object remains editable. */
export function batchStaticSiblings(root:T.Group){
  const batches=new Map<string,T.Mesh[]>();
  for(const child of root.children){
    if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||child instanceof T.InstancedMesh||Array.isArray(child.material)||child.children.length||!child.visible||child.morphTargetInfluences)continue;
    const attributes=Object.keys(child.geometry.attributes).map(name=>{const a=child.geometry.getAttribute(name);return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;}).sort().join(',');
    const key=`${child.material.id}:${child.castShadow}:${child.receiveShadow}:${child.layers.mask}:${child.renderOrder}:${!!child.userData.noFireShadow}:${attributes}`;
    const batch=batches.get(key)??[];batch.push(child);batches.set(key,batch);
  }
  for(const siblings of batches.values()){
    if(siblings.length<2)continue;
    const parts=siblings.map(child=>{
      child.updateMatrix();
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      return geometry.applyMatrix4(child.matrix);
    });
    const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
    if(!geometry)continue;
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const first=siblings[0],mesh=new T.Mesh(geometry,first.material);
    mesh.name='Detalhes estáticos agrupados';mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
    mesh.layers.mask=first.layers.mask;mesh.renderOrder=first.renderOrder;mesh.userData.cityObject=true;
    mesh.userData.mergedCityGeometry=true;
    if(first.userData.noFireShadow)mesh.userData.noFireShadow=true;
    for(const child of siblings)root.remove(child);
    root.add(mesh);
  }
}
