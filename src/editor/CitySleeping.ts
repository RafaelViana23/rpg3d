import * as T from 'three';

export type CityBedAnchor={matrix:number[];length:number;width:number;mattressY:number};
/** Reserve one half of a double mattress without moving the bed itself. */
export function cityBedSide(bed:CityBedAnchor,side:-1|1):CityBedAnchor{
 const matrix=new T.Matrix4().fromArray(bed.matrix).multiply(new T.Matrix4().makeTranslation(0,0,side*bed.width*.23));
 return {...bed,matrix:matrix.toArray(),width:bed.width*.46};
}

/** The supplied bed's long axis is X; its pillow/headboard is at negative X. */
export function cityBedAnchor(bed:T.Group,sourceSize:T.Vector3):CityBedAnchor{
  bed.updateMatrix();
  return {matrix:bed.matrix.toArray(),length:sourceSize.x,width:sourceSize.z,mattressY:bed.userData.bedMattressY??sourceSize.y*(.512/1.19)};
}

/** Fit the complete body on its back on the real mattress, including edited home transforms. */
export class CitySleeping{
  private bodies=new WeakMap<T.Group,{bounds:T.Box3;scale:T.Vector3;back:number}>();
  restore(body:T.Group){const saved=this.bodies.get(body);if(saved){body.scale.copy(saved.scale);this.bodies.delete(body);}}
  place(body:T.Group,home:T.Group,bed:CityBedAnchor){
    let saved=this.bodies.get(body);
    if(!saved){
      const scale=body.scale.clone();body.position.set(0,0,0);body.quaternion.identity();body.updateMatrixWorld(true);
      // Residents are scene children. Measure their actual deformed meshes once per night.
      const bounds=new T.Box3(),visible=body.visible;body.visible=true;
      body.traverseVisible(object=>{if(object instanceof T.Mesh)bounds.union(new T.Box3().setFromObject(object,true));});
      body.visible=visible;
      if(bounds.isEmpty())bounds.set(new T.Vector3(-.5,0,-.3),new T.Vector3(.5,2.7,.3));
      // Hair, crowns, skirts and weapons must not suspend the torso above the bed.
      // Use the actual back surface (or the outer breastplate) for mattress contact.
      let back=Infinity;
      const vertex=new T.Vector3();
      body.traverseVisible(object=>{
        if(!(object instanceof T.Mesh)||!['bodySkin.torso','equipment.armor.breastplate'].includes(object.name))return;
        const positions=object.geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          object.getVertexPosition(i,vertex);vertex.applyMatrix4(object.matrixWorld);
          back=Math.min(back,vertex.z);
        }
      });
      saved={bounds,scale,back:Number.isFinite(back)?back:bounds.min.z};this.bodies.set(body,saved);
    }
    home.updateWorldMatrix(true,false);
    const matrix=new T.Matrix4().multiplyMatrices(home.matrixWorld,new T.Matrix4().fromArray(bed.matrix));
    const longitudinal=new T.Vector3().setFromMatrixColumn(matrix,0),vertical=new T.Vector3().setFromMatrixColumn(matrix,1),across=new T.Vector3().setFromMatrixColumn(matrix,2);
    const length=bed.length*longitudinal.length()*.84,width=bed.width*across.length()*.82;
    const head=longitudinal.normalize().negate(),up=vertical.normalize(),right=new T.Vector3().crossVectors(head,up).normalize();
    const size=saved.bounds.getSize(new T.Vector3()),center=saved.bounds.getCenter(new T.Vector3());
    const fit=Math.min(1,length/Math.max(size.y,.001),width/Math.max(size.x,.001));
    const position=new T.Vector3(0,bed.mattressY,0).applyMatrix4(matrix)
      .addScaledVector(right,-center.x*fit).addScaledVector(head,-center.y*fit)
      .addScaledVector(up,-saved.back*fit-.002);
    body.scale.copy(saved.scale).multiplyScalar(fit);
    body.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,head,up));
    body.position.copy(position);body.updateMatrixWorld(true);
  }
}
