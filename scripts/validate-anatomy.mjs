import fs from 'node:fs';
import { createServer } from 'vite';
import * as THREE from 'three';

const spec=JSON.parse(fs.readFileSync(new URL('../docs/anatomy/skeleton.json',import.meta.url),'utf8'));
const errors=[],warnings=[],results=[];
const assert=(condition,message)=>(condition?undefined:errors.push(message));
const finiteMatrix=matrix=>matrix.elements.every(Number.isFinite);
const identityError=matrix=>matrix.elements.reduce((max,value,index)=>Math.max(max,Math.abs(value-([0,5,10,15].includes(index)?1:0))),0);

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {HandRig}=await server.ssrLoadModule('/src/hand/HandRig.ts');
  const {HandMesh}=await server.ssrLoadModule('/src/hand/HandMesh.ts');
  const {HandAnimator}=await server.ssrLoadModule('/src/hand/HandAnimator.ts');
  const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
  const poses=['Open','Relaxed','Fist','SwordGrip','ShieldGrip','Point'];

  for(const side of ['left','right']){
    const rig=new HandRig(side),mesh=HandMesh.create(rig,'#d8a17b'),animator=new HandAnimator(rig);
    assert(rig.bones.length===spec.handTemplate.boneCount,`${side}: expected ${spec.handTemplate.boneCount} bones, got ${rig.bones.length}`);
    const suffix=side==='left'?'L':'R',resolve=value=>value.replace('{suffix}',suffix).replace('{side}',side);
    const expected=spec.handTemplate.bones.map(b=>resolve(b.name));
    assert(expected.every((name,index)=>rig.bones[index]?.name===name),`${side}: bone order/name differs from skeleton.json`);
    for(let index=0;index<rig.bones.length;index++)assert(rig.bones[index].parent?.name===resolve(spec.handTemplate.bones[index].parent),`${side}/${rig.bones[index].name}: parent differs from skeleton.json`);
    assert(rig.bones.every(b=>{let node=b;while(node&&node!==mesh)node=node.parent;return node===mesh;}),`${side}: disconnected bone detected`);
    assert(rig.skeleton.boneInverses.length===rig.bones.length,`${side}: inverse bind count mismatch`);
    assert(rig.skeleton.boneInverses.every(finiteMatrix),`${side}: non-finite inverse bind matrix`);
    assert(finiteMatrix(mesh.bindMatrix)&&finiteMatrix(mesh.bindMatrixInverse),`${side}: non-finite mesh bind matrix`);
    assert(identityError(mesh.bindMatrix.clone().multiply(mesh.bindMatrixInverse))<spec.validation.matrixTolerance,`${side}: bindMatrix inverse mismatch`);

    const positions=mesh.geometry.getAttribute('position'),indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
    let maxInfluences=0,maxWeightError=0,badIndices=0;
    for(let i=0;i<positions.count;i++){
      let sum=0,influences=0;
      for(let k=0;k<4;k++){const weight=weights.getComponent(i,k),index=indices.getComponent(i,k);sum+=weight;if(weight>0)influences++;if(index<0||index>=rig.bones.length)badIndices++;}
      maxInfluences=Math.max(maxInfluences,influences);maxWeightError=Math.max(maxWeightError,Math.abs(1-sum));
    }
    assert(badIndices===0,`${side}: ${badIndices} invalid skin indices`);
    assert(maxInfluences<=spec.validation.maxInfluences,`${side}: ${maxInfluences} influences exceed limit`);
    assert(maxWeightError<=spec.validation.weightTolerance,`${side}: weight normalization error ${maxWeightError}`);

    const parent=new THREE.Group();parent.position.set(side==='left'?-.6:.6,1.2,.15);parent.rotation.set(.25,side==='left'?.4:-.4,.15);parent.scale.setScalar(1.1);parent.add(rig.root);
    for(const pose of poses){
      animator.setPose(pose);for(let frame=0;frame<120;frame++)animator.update(1/60);parent.updateMatrixWorld(true);
      const wristWorld=new THREE.Vector3();rig.wrist.getWorldPosition(wristWorld);let maxDistance=0,farVertices=0;
      for(let i=0;i<positions.count;i++){
        const vertex=new THREE.Vector3().fromBufferAttribute(positions,i);mesh.applyBoneTransform(i,vertex);mesh.localToWorld(vertex);
        const distance=vertex.distanceTo(wristWorld);maxDistance=Math.max(maxDistance,distance);if(distance>spec.validation.maxHandVertexDistanceFromWrist)farVertices++;
      }
      assert(farVertices===0,`${side}/${pose}: ${farVertices} vertices outside hand region`);
      results.push({side,pose,maxDistance:+maxDistance.toFixed(6),farVertices});
    }
  }

  const character=new ProceduralCharacter(DEFAULT_CONFIG);character.group.updateMatrixWorld(true);const bodyBones=new Map();let unnamed=0;
  character.group.traverse(object=>{if(object instanceof THREE.Bone){if(!object.name)unnamed++;else if(spec.bodyBindPose.some(entry=>entry.name===object.name))bodyBones.set(object.name,object);}});
  assert(unnamed===0,`${unnamed} unnamed bones detected`);
  const nearly=(a,b)=>Math.abs(a-b)<=spec.validation.matrixTolerance;
  for(const entry of spec.bodyBindPose){
    const bone=bodyBones.get(entry.name);assert(Boolean(bone),`missing body bone ${entry.name}`);if(!bone)continue;
    const actualParent=bone.parent?.name||bone.parent?.type;assert(actualParent===entry.parent,`${entry.name}: expected parent ${entry.parent}, got ${actualParent}`);
    assert(entry.position.every((value,index)=>nearly(value,bone.position.getComponent(index))),`${entry.name}: local position differs from skeleton.json`);
    assert(entry.quaternion.every((value,index)=>nearly(value,bone.quaternion.toArray()[index])),`${entry.name}: local quaternion differs from skeleton.json`);
  }
  assert(bodyBones.size===spec.validation.bodyBoneCount,`expected ${spec.validation.bodyBoneCount} body bones, got ${bodyBones.size}`);
  let bodyVertices=0,bodyTriangles=0,bodySkins=0;
  character.group.traverse(object=>{
    if(!(object instanceof THREE.SkinnedMesh)||!object.name.startsWith('bodySkin.'))return;
    bodySkins++;const position=object.geometry.getAttribute('position'),skinIndex=object.geometry.getAttribute('skinIndex'),skinWeight=object.geometry.getAttribute('skinWeight');
    bodyVertices+=position.count;bodyTriangles+=(object.geometry.index?.count??position.count)/3;
    assert(Boolean(skinIndex)&&Boolean(skinWeight),`${object.name}: missing skin attributes`);
    assert(object.skeleton.bones.length===object.skeleton.boneInverses.length,`${object.name}: inverse bind count mismatch`);
    assert(object.skeleton.boneInverses.every(finiteMatrix),`${object.name}: invalid inverse bind matrix`);
    for(let vertex=0;vertex<position.count;vertex++){
      let sum=0,influences=0;
      for(let slot=0;slot<4;slot++){const weight=skinWeight.getComponent(vertex,slot),index=skinIndex.getComponent(vertex,slot);sum+=weight;if(weight>0)influences++;assert(index>=0&&index<object.skeleton.bones.length,`${object.name}: invalid bone index ${index}`);}
      assert(influences<=spec.validation.maxInfluences,`${object.name}: too many influences at vertex ${vertex}`);assert(Math.abs(1-sum)<=spec.validation.weightTolerance,`${object.name}: weights not normalized at vertex ${vertex}`);
    }
  });
  assert(bodySkins===7,`expected 7 anatomical body skins, got ${bodySkins}`);results.push({bodySkins,bodyVertices,bodyTriangles,bodyBones:bodyBones.size});

  console.log(JSON.stringify({ok:errors.length===0,errors,warnings,results},null,2));
  if(errors.length)process.exitCode=1;
}finally{await server.close();}

