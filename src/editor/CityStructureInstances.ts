import * as T from 'three';

type Source={mesh:T.Mesh;owner:T.Group};
type Batch={mesh:T.InstancedMesh;sources:Source[]};

/** Draw repeated rigid shells together, leaving every editable object intact.
 * Originals are hidden only during the world draw and restored even on errors.
 * Doors, props, transparent windows, lights and animated hierarchies are excluded.
 */
export class CityStructureInstances {
  readonly root=new T.Group();
  private batches:Batch[]=[];
  private signature='';
  private nextRefresh=0;
  private enabled=false;
  private readonly inverse=new T.Matrix4();
  private readonly matrix=new T.Matrix4();
  readonly stats={originalDraws:0,instanceDraws:0,savedDraws:0};

  constructor(private readonly scene:T.Scene){
    this.root.name='Instâncias das estruturas da cidade';
    this.root.visible=false;this.root.userData.buildEditable=false;
    this.root.userData.cityStructureInstances=true;
    scene.add(this.root);
  }

  private refresh(buildings:Iterable<T.Group>,now:number){
    if(now<this.nextRefresh)return;
    this.nextRefresh=now+500;
    const groups=new Map<string,Source[]>(),signature:string[]=[];
    this.root.updateWorldMatrix(true,false);
    this.inverse.copy(this.root.matrixWorld).invert();
    for(const owner of buildings){
      let visible=true;
      for(let node:T.Object3D|null=owner;node;node=node.parent)if(!node.visible)visible=false;
      if(!owner.parent||!visible)continue;
      owner.updateWorldMatrix(true,false);
      const center=new T.Vector3().setFromMatrixPosition(owner.matrixWorld);
      // Keep spatial culling local rather than submitting an entire city's shells.
      const cell=`${Math.floor(center.x/64)}:${Math.floor(center.z/64)}`;
      for(const child of owner.children){
        if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||child instanceof T.InstancedMesh||child.children.length||!child.visible||Array.isArray(child.material)||child.material.transparent||!child.material.visible||child.morphTargetInfluences)continue;
        if(child.customDepthMaterial||child.customDistanceMaterial)continue;
        if(Object.hasOwn(child,'onBeforeRender')||Object.hasOwn(child,'onAfterRender')||Object.hasOwn(child,'onBeforeShadow')||Object.hasOwn(child,'onAfterShadow'))continue;
        child.updateWorldMatrix(false,false);
        if(child.matrixWorld.determinant()<=0)continue;
        // Instanced shader normals support nonuniform scale, but not shear.
        const e=child.matrixWorld.elements;
        const x2=e[0]**2+e[1]**2+e[2]**2,y2=e[4]**2+e[5]**2+e[6]**2,z2=e[8]**2+e[9]**2+e[10]**2;
        if(Math.abs(e[0]*e[4]+e[1]*e[5]+e[2]*e[6])>1e-8*Math.sqrt(x2*y2)||
           Math.abs(e[0]*e[8]+e[1]*e[9]+e[2]*e[10])>1e-8*Math.sqrt(x2*z2)||
           Math.abs(e[4]*e[8]+e[5]*e[9]+e[6]*e[10])>1e-8*Math.sqrt(y2*z2))continue;
        const key=`${cell}:${child.geometry.uuid}:${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${child.layers.mask}:${child.renderOrder}`;
        const sources=groups.get(key)??[];sources.push({mesh:child,owner});groups.set(key,sources);
        signature.push(`${key}:${child.id}:${child.matrixWorld.elements.join(',')}`);
      }
    }
    const next=signature.join(';');
    if(next===this.signature)return;
    this.signature=next;
    this.clearBatches();
    for(const sources of groups.values()){
      if(sources.length<2)continue;
      const first=sources[0].mesh;
      const mesh=new T.InstancedMesh(first.geometry,first.material,sources.length);
      mesh.name='Estruturas repetidas';mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
      mesh.layers.mask=first.layers.mask;mesh.renderOrder=first.renderOrder;
      mesh.userData.cityStructureInstances=true;mesh.userData.buildEditable=false;
      for(const [index,source] of sources.entries())mesh.setMatrixAt(index,this.matrix.multiplyMatrices(this.inverse,source.mesh.matrixWorld));
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
      this.root.add(mesh);this.batches.push({mesh,sources});
      this.stats.originalDraws+=sources.length;this.stats.instanceDraws++;
    }
    this.stats.savedDraws=this.stats.originalDraws-this.stats.instanceDraws;
  }

  render(renderer:Pick<T.WebGLRenderer,'render'>,camera:T.Camera,buildings:Iterable<T.Group>,enabled:boolean,now:number){
    if(!enabled){this.enabled=false;renderer.render(this.scene,camera);return;}
    if(!this.enabled){this.nextRefresh=0;this.enabled=true;}
    // Shadow changes are included in the signature, as are saved transforms.
    this.refresh(buildings,now);
    const hidden:T.Mesh[]=[];
    try{
      this.root.visible=true;
      for(const batch of this.batches){
        // A hidden or removed source must never leave a ghost instance behind.
        batch.mesh.visible=batch.sources.every(({mesh,owner})=>{
          if(mesh.parent!==owner||!owner.parent||!mesh.visible)return false;
          for(let node:T.Object3D|null=owner;node;node=node.parent)if(!node.visible)return false;
          return true;
        });
        if(!batch.mesh.visible){this.nextRefresh=0;continue;}
        for(const {mesh} of batch.sources){mesh.visible=false;hidden.push(mesh);}
      }
      renderer.render(this.scene,camera);
    }finally{
      for(const mesh of hidden)mesh.visible=true;
      this.root.visible=false;
    }
  }

  private clearBatches(){
    // Geometries and materials belong to the originals; only free instance buffers.
    for(const batch of this.batches){batch.mesh.removeFromParent();batch.mesh.dispose();}
    this.batches=[];this.stats.originalDraws=0;this.stats.instanceDraws=0;this.stats.savedDraws=0;
  }
  dispose(){this.clearBatches();this.root.removeFromParent();}
}
