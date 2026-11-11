import * as THREE from 'three';

export type BodyInfluence={bone:number;weight:number};
export type BodyRing={center:[number,number,number];rx:number;rz:number;weights:BodyInfluence[];material?:number};

/** Continuous ring topology for deformable anatomical regions. */
export function createBodySkin(parent:THREE.Object3D,name:string,bones:THREE.Bone[],rings:BodyRing[],materials:THREE.Material[],segments=16){
  parent.updateWorldMatrix(true,true);
  const positions:number[]=[],skinIndices:number[]=[],skinWeights:number[]=[],indices:number[]=[];
  const normalize=(input:BodyInfluence[])=>{const values=input.filter(value=>value.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,4),sum=values.reduce((total,value)=>total+value.weight,0)||1;return values.map(value=>({...value,weight:value.weight/sum}));};
  for(const ring of rings){
    const weights=normalize(ring.weights);
    for(let side=0;side<segments;side++){
      const angle=side/segments*Math.PI*2;
      positions.push(ring.center[0]+Math.cos(angle)*ring.rx,ring.center[1],ring.center[2]+Math.sin(angle)*ring.rz);
      for(let slot=0;slot<4;slot++){skinIndices.push(weights[slot]?.bone??0);skinWeights.push(weights[slot]?.weight??0);}
    }
  }
  const geometry=new THREE.BufferGeometry();let offset=0;
  for(let ring=0;ring<rings.length-1;ring++){
    const start=indices.length;
    for(let side=0;side<segments;side++){const a=ring*segments+side,b=ring*segments+(side+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
    geometry.addGroup(start,indices.length-start,rings[ring].material??0);offset=indices.length;
  }
  const cap=(ringIndex:number,reverse:boolean)=>{
    const ring=rings[ringIndex],weights=normalize(ring.weights),center=positions.length/3;positions.push(...ring.center);
    for(let slot=0;slot<4;slot++){skinIndices.push(weights[slot]?.bone??0);skinWeights.push(weights[slot]?.weight??0);}
    const start=indices.length,base=ringIndex*segments;
    for(let side=0;side<segments;side++){const next=(side+1)%segments;indices.push(center,base+(reverse?next:side),base+(reverse?side:next));}
    geometry.addGroup(start,indices.length-start,ring.material??0);offset=indices.length;
  };
  cap(0,true);cap(rings.length-1,false);void offset;
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.SkinnedMesh(geometry,materials);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;parent.add(mesh);
  parent.updateWorldMatrix(true,true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();mesh.bind(skeleton,mesh.matrixWorld);mesh.normalizeSkinWeights();
  return mesh;
}
