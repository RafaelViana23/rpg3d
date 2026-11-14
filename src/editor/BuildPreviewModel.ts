import * as T from 'three';

/** Clone the actual render hierarchy without editor helpers or live lights.
 * SkeletonHelper.clone() cannot be called without its original root argument.
 * Retarget bones explicitly after filtering instead of cloning those helpers.
 */
export function cloneBuildPreviewModel(source:T.Object3D){
 const lookup=new Map<T.Object3D,T.Object3D>(),skins:[T.SkinnedMesh,T.SkinnedMesh][]=[];
 const copy=(node:T.Object3D):T.Object3D|undefined=>{
  if((node as T.Light).isLight||(node as T.Camera).isCamera||node.type.endsWith('Helper'))return;
  const cloned=node.clone(false);lookup.set(node,cloned);
  if((node as T.SkinnedMesh).isSkinnedMesh)skins.push([node as T.SkinnedMesh,cloned as T.SkinnedMesh]);
  if(node.userData.cityDistanceHidden||node.userData.cityInteriorHidden)cloned.visible=true;
  for(const child of node.children){const next=copy(child);if(next)cloned.add(next);}
  return cloned;
 };
 const model=copy(source)??new T.Group();model.visible=true;
 for(const [original,cloned]of skins){
  const skeleton=original.skeleton.clone();
  skeleton.bones=original.skeleton.bones.map(bone=>{
   const clonedBone=lookup.get(bone);if(!clonedBone)throw new Error(`Osso fora do asset: ${bone.name}`);
   return clonedBone as T.Bone;
  });
  cloned.bind(skeleton,original.bindMatrix.clone());
 }
 return model;
}

/** Freeze the imported mesh's current posed vertices for a static thumbnail.
 * Later framing/scaling must not be applied a second time through skin matrices.
 * Geometry is copied from the actual asset, with its original topology/materials.
 */
export function freezeBuildPreviewPose(model:T.Object3D){
 model.updateMatrixWorld(true);
 const skins:T.SkinnedMesh[]=[];model.traverse(node=>{if((node as T.SkinnedMesh).isSkinnedMesh)skins.push(node as T.SkinnedMesh);});
 const vertex=new T.Vector3();
 for(const mesh of skins){
  mesh.skeleton.update();
  const geometry=mesh.geometry.clone(),positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){mesh.getVertexPosition(i,vertex);positions.setXYZ(i,vertex.x,vertex.y,vertex.z);}
  geometry.morphAttributes={};geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const still=new T.Mesh(geometry,mesh.material);still.name=mesh.name;still.visible=mesh.visible;
  still.position.copy(mesh.position);still.quaternion.copy(mesh.quaternion);still.scale.copy(mesh.scale);
  still.renderOrder=mesh.renderOrder;still.layers.mask=mesh.layers.mask;still.userData.buildPreviewBakedGeometry=true;
  for(const child of [...mesh.children])still.add(child);
  mesh.parent?.add(still);mesh.removeFromParent();mesh.skeleton.dispose();
 }
 model.updateMatrixWorld(true);
 return model;
}
