import * as THREE from 'three';
import type {ProceduralCharacter} from '../character';

/** Fit once, preserving the crown's authored size; the head bone then carries it. */
export function attachRoyalCrown(actor:ProceduralCharacter,crown:THREE.Group){
 const head=actor.group.getObjectByName('Head');if(!head)return;
 actor.group.add(crown);crown.position.set(0,0,0);crown.rotation.set(0,0,0);crown.scale.set(1,1,1);
 actor.group.updateMatrixWorld(true);
 const inverse=actor.group.matrixWorld.clone().invert(),headBounds=new THREE.Box3(),crownBounds=new THREE.Box3();
 const measure=(root:THREE.Object3D,bounds:THREE.Box3)=>root.traverseVisible(child=>{
  if(!(child instanceof THREE.Mesh))return;
  child.geometry.computeBoundingBox();
  if(child.geometry.boundingBox)bounds.union(child.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));
 });
 measure(head,headBounds);measure(crown,crownBounds);
 if(headBounds.isEmpty()||crownBounds.isEmpty())return;
 const center=headBounds.getCenter(new THREE.Vector3()),crownCenter=crownBounds.getCenter(new THREE.Vector3());
 const inset=crown.userData.assetSource?crownBounds.getSize(new THREE.Vector3()).y*.38:.025;
 crown.position.set(center.x-crownCenter.x,headBounds.max.y-crownBounds.min.y-inset,center.z-crownCenter.z);
 actor.group.updateMatrixWorld(true);
 head.attach(crown);
}
