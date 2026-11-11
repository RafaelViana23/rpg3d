import * as THREE from 'three';
import { FingerName, HandRig } from './HandRig';

type Influence={bone:number;weight:number};
type Ring={center:THREE.Vector3;rx:number;rz:number;influences:Influence[]};

/** Procedural, continuous low-poly hand mesh. No sphere primitives are used. */
export class HandMesh {
  static create(rig:HandRig,color:string){
    rig.root.updateMatrixWorld(true);
    const positions:number[]=[],indices:number[]=[],skinIndices:number[]=[],skinWeights:number[]=[];
    const sides=8,indexOf=(bone:THREE.Bone)=>rig.bones.indexOf(bone);
    const normalized=(values:Influence[])=>{const compact=values.filter(v=>v.weight>0).slice(0,4),sum=compact.reduce((n,v)=>n+v.weight,0)||1;return compact.map(v=>({...v,weight:v.weight/sum}));};
    const addVertex=(point:THREE.Vector3,influences:Influence[])=>{
      positions.push(point.x,point.y,point.z);const weights=normalized(influences);
      for(let slot=0;slot<4;slot++){skinIndices.push(weights[slot]?.bone??0);skinWeights.push(weights[slot]?.weight??0);}
      return positions.length/3-1;
    };
    const frame=(rings:Ring[],i:number)=>{
      const tangent=(i===0?rings[1].center.clone().sub(rings[0].center):i===rings.length-1?rings[i].center.clone().sub(rings[i-1].center):rings[i+1].center.clone().sub(rings[i-1].center)).normalize();
      const reference=Math.abs(tangent.z)<.88?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);
      const axisX=new THREE.Vector3().crossVectors(reference,tangent).normalize(),axisZ=new THREE.Vector3().crossVectors(tangent,axisX).normalize();
      return{axisX,axisZ};
    };
    const addLoft=(rings:Ring[])=>{
      const ringStarts:number[]=[];
      rings.forEach((ring,ringIndex)=>{ringStarts.push(positions.length/3);const {axisX,axisZ}=frame(rings,ringIndex);for(let side=0;side<sides;side++){const angle=side/sides*Math.PI*2,point=ring.center.clone().addScaledVector(axisX,Math.cos(angle)*ring.rx).addScaledVector(axisZ,Math.sin(angle)*ring.rz);addVertex(point,ring.influences);}});
      for(let ring=0;ring<rings.length-1;ring++)for(let side=0;side<sides;side++){const a=ringStarts[ring]+side,b=ringStarts[ring]+(side+1)%sides,c=ringStarts[ring+1]+side,d=ringStarts[ring+1]+(side+1)%sides;indices.push(a,c,b,b,c,d);}
      const startCap=addVertex(rings[0].center,rings[0].influences),endCap=addVertex(rings.at(-1)!.center,rings.at(-1)!.influences);
      for(let side=0;side<sides;side++){indices.push(startCap,ringStarts[0]+(side+1)%sides,ringStarts[0]+side);const last=ringStarts.at(-1)!;indices.push(endCap,last+side,last+(side+1)%sides);}
    };

    const wrist=indexOf(rig.wrist),hand=indexOf(rig.hand),palm=indexOf(rig.palm);
    // Anatomical low-poly palm: a slim wrist, moderate thenar volume and a
    // gently widening knuckle shelf. Keep the dorsum flatter than the palm so
    // the silhouette reads as a hand instead of a padded mitten.
    addLoft([
      {center:new THREE.Vector3(0,.010,.001),rx:.058,rz:.045,influences:[{bone:wrist,weight:.78},{bone:hand,weight:.22}]},
      {center:new THREE.Vector3(0,-.040,.003),rx:.066,rz:.044,influences:[{bone:hand,weight:.68},{bone:wrist,weight:.32}]},
      {center:new THREE.Vector3(0,-.090,.006),rx:.080,rz:.047,influences:[{bone:hand,weight:.56},{bone:palm,weight:.44}]},
      {center:new THREE.Vector3(0,-.137,.008),rx:.083,rz:.048,influences:[{bone:palm,weight:.68},{bone:hand,weight:.32}]},
      {center:new THREE.Vector3(0,-.171,.010),rx:.075,rz:.042,influences:[{bone:palm,weight:.62},{bone:hand,weight:.38}]}
    ]);

    const labels:Record<Exclude<FingerName,'thumb'>,string>={index:'Index',middle:'Middle',ring:'Ring',little:'Pinky'};
    const radii:Record<Exclude<FingerName,'thumb'>,number[]>={
      index:[.030,.029,.026,.022,.017,.011],middle:[.031,.030,.027,.023,.018,.0115],ring:[.030,.029,.026,.022,.017,.011],little:[.026,.025,.022,.0185,.0145,.009]
    };
    for(const finger of ['index','middle','ring','little'] as const){
      const chain=rig.finger(finger),base=radii[finger],rings:Ring[]=[];
      chain.forEach((bone,i)=>{const previous=chain[Math.max(0,i-1)],next=chain[Math.min(chain.length-1,i+1)];rings.push({center:rig.bindPositionLocal(bone),rx:base[i],rz:base[i]*.88,influences:i===0?[{bone:indexOf(bone),weight:.58},{bone:hand,weight:.26},{bone:palm,weight:.16}]:[{bone:indexOf(bone),weight:.62},{bone:indexOf(previous),weight:.25},{bone:indexOf(next),weight:.13}]});});
      const tip=rings.at(-1)!,before=rings.at(-2)!,direction=tip.center.clone().sub(before.center).normalize();rings.push({center:tip.center.clone().addScaledVector(direction,.011),rx:base.at(-1)!,rz:base.at(-1)!*.92,influences:[{bone:indexOf(chain.at(-1)!),weight:.82},{bone:indexOf(chain.at(-2)!),weight:.18}]});
      addLoft(rings);
      void labels;
    }

    // The CMC needs a substantial root: it is the thenar mass that visually
    // grows out of the palm. Distal phalanges stay tapered and lean.
    const thumbChain=rig.finger('thumb'),thumbRadii=[.033,.028,.022,.017,.009];
    const thumbRings:Ring[]=thumbChain.map((bone,i)=>({center:rig.bindPositionLocal(bone),rx:thumbRadii[i],rz:thumbRadii[i]*.92,influences:i===0?[{bone:indexOf(bone),weight:.55},{bone:hand,weight:.30},{bone:palm,weight:.15}]:[{bone:indexOf(bone),weight:.66},{bone:indexOf(thumbChain[i-1]),weight:.34}]}));
    const thumbDirection=thumbRings.at(-1)!.center.clone().sub(thumbRings.at(-2)!.center).normalize();thumbRings.push({center:thumbRings.at(-1)!.center.clone().addScaledVector(thumbDirection,.006),rx:.007,rz:.0065,influences:[{bone:indexOf(thumbChain.at(-1)!),weight:.82},{bone:indexOf(thumbChain.at(-2)!),weight:.18}]});addLoft(thumbRings);

    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    // DoubleSide is intentional: this procedural loft can expose the interior
    // of a sharply flexed knuckle. Culling it made the dorsum look transparent.
    const material=new THREE.MeshStandardMaterial({color,roughness:.64,metalness:0,flatShading:true,side:THREE.DoubleSide});
    const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=`handMesh.${rig.side}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;rig.root.add(mesh);
    rig.root.remove(rig.wrist);mesh.add(rig.wrist);rig.root.updateWorldMatrix(true,true);rig.skeleton.calculateInverses();mesh.bind(rig.skeleton,mesh.matrixWorld);mesh.normalizeSkinWeights();
    const vertices=geometry.getAttribute('position');let maxBindError=0;for(let i=0;i<vertices.count;i+=Math.max(1,Math.floor(vertices.count/96))){const original=new THREE.Vector3().fromBufferAttribute(vertices,i),deformed=mesh.applyBoneTransform(i,original.clone());maxBindError=Math.max(maxBindError,original.distanceTo(deformed));}
    if(maxBindError>1e-3)throw new Error(`Invalid hand bind pose (${maxBindError.toFixed(5)})`);
    return mesh;
  }
}
