import * as T from 'three';

/** Bounds in the object's own axes, kept aligned with its current world transform. */
export class OrientedSelectionBox extends T.LineSegments {
 constructor(readonly target:T.Object3D,color:T.ColorRepresentation=0xe9bc69){
  const cube=new T.BoxGeometry(1,1,1),edges=new T.EdgesGeometry(cube);cube.dispose();
  super(edges,new T.LineBasicMaterial({color,toneMapped:false}));
  this.matrixAutoUpdate=false;this.update();
 }
 update(){
  this.target.updateWorldMatrix(true,true);
  const inverse=this.target.matrixWorld.clone().invert(),bounds=new T.Box3();
  this.target.traverse(child=>{
   if(!(child instanceof T.Mesh))return;
   if(!child.geometry.boundingBox)child.geometry.computeBoundingBox();
   if(child.geometry.boundingBox)bounds.union(child.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)));
  });
  this.visible=!bounds.isEmpty();if(!this.visible)return;
  const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  this.matrix.copy(this.target.matrixWorld).multiply(new T.Matrix4().compose(center,new T.Quaternion(),size));
  this.matrixWorldNeedsUpdate=true;
 }
}
