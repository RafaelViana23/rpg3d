import { createServer } from 'vite';
import * as THREE from 'three';

const states=['idle','walk','run','jump','fall','attack','dodge','death'];
const handPoses=['Open','Relaxed','Fist','SwordGrip','ShieldGrip','Point'];
const errors=[],warnings=[],results=[];
const assert=(condition,message)=>(condition?undefined:errors.push(message));
const finiteObject=object=>object.matrix.elements.every(Number.isFinite)&&object.matrixWorld.elements.every(Number.isFinite)&&object.position.toArray().every(Number.isFinite)&&object.quaternion.toArray().every(Number.isFinite);
const close=(a,b,tolerance=1e-8)=>Math.abs(a-b)<=tolerance;
const pointSegmentDistance=(point,a,b)=>{const ab=b.clone().sub(a),t=THREE.MathUtils.clamp(point.clone().sub(a).dot(ab)/ab.lengthSq(),0,1);return point.distanceTo(a.clone().addScaledVector(ab,t));};

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
  for(const state of states){
    const character=new ProceduralCharacter(DEFAULT_CONFIG);
    const parts=character.group.getObjectByName('parts');
    const bindScale=parts.scale.clone();
    const localPositions=new Map();
    character.group.traverse(object=>{if(object instanceof THREE.Bone)localPositions.set(object,object.position.clone());});
    character.setAnimation(state);
    let minimumFootY=Infinity,maximumFootY=-Infinity,maximumSupportFootY=-Infinity,minimumBladeHeadClearance=Infinity;
    for(let frame=0;frame<240;frame++){
      character.update(1/60);character.group.updateMatrixWorld(true);
      character.group.traverse(object=>assert(finiteObject(object),`${state}: non-finite transform on ${object.name||object.type}`));
      character.group.traverse(object=>{if(object instanceof THREE.Bone)assert(Math.abs(1-object.quaternion.length())<1e-5,`${state}: non-normalized quaternion on ${object.name}`);});
      const frameFeet=[];
      for(const side of ['L','R']){
        const foot=character.group.getObjectByName(`Foot_${side}`),world=new THREE.Vector3();foot.getWorldPosition(world);
        frameFeet.push(world.y);minimumFootY=Math.min(minimumFootY,world.y);maximumFootY=Math.max(maximumFootY,world.y);
      }
      maximumSupportFootY=Math.max(maximumSupportFootY,Math.min(...frameFeet));
      if(state==='attack'){
        const sword=character.group.getObjectByName('equipment.sword'),head=character.group.getObjectByName('Head');
        const direction=sword.userData.bladeDirection,start=new THREE.Vector3(direction*.18,0,0).applyMatrix4(sword.matrixWorld),end=new THREE.Vector3(direction*1.04,0,0).applyMatrix4(sword.matrixWorld),headWorld=new THREE.Vector3();head.getWorldPosition(headWorld);
        minimumBladeHeadClearance=Math.min(minimumBladeHeadClearance,pointSegmentDistance(headWorld,start,end));
      }
    }
    assert(parts.scale.toArray().every((value,index)=>close(value,bindScale.getComponent(index))),`${state}: character scale changed`);
    for(const [bone,position] of localPositions)assert(bone.position.distanceToSquared(position)<1e-16,`${state}: local joint position changed on ${bone.name}`);
    if(['idle','walk','run','attack','dodge'].includes(state))assert(minimumFootY>=-.015,`${state}: foot joint crossed ground (${minimumFootY.toFixed(4)})`);
    if(['idle','walk','attack','dodge'].includes(state))assert(maximumSupportFootY<=.18,`${state}: both feet lost ground contact (${maximumSupportFootY.toFixed(4)})`);
    if(state==='run')assert(maximumSupportFootY<=.22,`run: airborne phase is too high (${maximumSupportFootY.toFixed(4)})`);
    if(state==='attack')assert(minimumBladeHeadClearance>=.28,`attack: blade crossed head safety volume (${minimumBladeHeadClearance.toFixed(4)})`);
    results.push({state,minFootY:+minimumFootY.toFixed(5),maxFootY:+maximumFootY.toFixed(5),maxSupportFootY:+maximumSupportFootY.toFixed(5),bladeHeadClearance:Number.isFinite(minimumBladeHeadClearance)?+minimumBladeHeadClearance.toFixed(5):undefined,scale:parts.scale.toArray()});
  }

  for(const side of ['left','right']){
    const character=new ProceduralCharacter(DEFAULT_CONFIG);
    character.equipLeftHand(side==='left'?'espada':'nenhum');
    character.equipRightHand(side==='right'?'espada':'nenhum');
    for(let frame=0;frame<120;frame++)character.update(1/60);
    character.setAnimation('attack');
    let minimumX=Infinity,maximumX=-Infinity;
    for(let frame=0;frame<44;frame++){
      character.update(1/60);character.group.updateMatrixWorld(true);
      const wrist=character.group.getObjectByName(`Hand_${side==='left'?'L':'R'}`),world=new THREE.Vector3();wrist.getWorldPosition(world);character.group.worldToLocal(world);
      minimumX=Math.min(minimumX,world.x);maximumX=Math.max(maximumX,world.x);
    }
    if(side==='left')assert(maximumX>=.04,`attack/left: hand did not cross the center line (${maximumX.toFixed(4)})`);
    else assert(minimumX<=-.04,`attack/right: hand did not cross the center line (${minimumX.toFixed(4)})`);
    results.push({attackSide:side,minimumHandX:+minimumX.toFixed(5),maximumHandX:+maximumX.toFixed(5)});
  }

  {
    const character=new ProceduralCharacter(DEFAULT_CONFIG);
    character.equipLeftHand('espada');character.equipRightHand('espada');
    for(let frame=0;frame<120;frame++)character.update(1/60);
    for(const expectedSide of ['right','left']){
      character.setAnimation('attack');
      const range={left:{min:Infinity,max:-Infinity},right:{min:Infinity,max:-Infinity}};
      for(let frame=0;frame<44;frame++){
        character.update(1/60);character.group.updateMatrixWorld(true);
        for(const side of ['left','right']){
          const wrist=character.group.getObjectByName(`Hand_${side==='left'?'L':'R'}`),world=new THREE.Vector3();wrist.getWorldPosition(world);character.group.worldToLocal(world);
          range[side].min=Math.min(range[side].min,world.x);range[side].max=Math.max(range[side].max,world.x);
        }
      }
      assert(expectedSide==='right'?range.right.min<=-.04:range.left.max>=.04,`dual attack/${expectedSide}: active hand did not cross the center line`);
      assert(expectedSide==='right'?range.left.max<0:range.right.min>0,`dual attack/${expectedSide}: support hand crossed the center line`);
      results.push({dualAttackSide:expectedSide,left:[+range.left.min.toFixed(5),+range.left.max.toFixed(5)],right:[+range.right.min.toFixed(5),+range.right.max.toFixed(5)]});
      character.setAnimation('idle');for(let frame=0;frame<60;frame++)character.update(1/60);
    }
  }

  {
    const character=new ProceduralCharacter(DEFAULT_CONFIG),weapon=new THREE.Group();
    weapon.name='test.weapon';character.equipProceduralHand(weapon,'right','weapon');character.group.updateMatrixWorld(true);
    const back=character.group.getObjectByName('equipment.waistScabbards'),scabbard=character.group.getObjectByName('equipment.scabbard.right'),backSword=character.group.getObjectByName('equipment.backSword.right'),heldSword=character.group.getObjectByName('equipment.procedural-weapon');
    assert(Boolean(back?.visible&&scabbard&&backSword&&!backSword.visible&&heldSword?.parent?.visible),'sword/scabbard: drawn presentation is invalid');
    character.setSwordSheathed(true);character.group.updateMatrixWorld(true);
    assert(Boolean(backSword?.visible&&!heldSword?.parent?.visible),'sword/scabbard: O did not move the sword to the back');
    character.setSwordSheathed(false);character.group.updateMatrixWorld(true);
    assert(Boolean(!backSword?.visible&&heldSword?.parent?.visible),'sword/scabbard: P did not return the sword to the hand');
    results.push({scabbard:true,drawn:heldSword?.parent?.visible??false,sheathedBackVisible:backSword?.visible??false});
  }

  const hands=new ProceduralCharacter(DEFAULT_CONFIG);
  for(const pose of handPoses){
    hands.setHandTestPose(pose);
    for(let frame=0;frame<120;frame++)hands.update(1/60);
    hands.group.updateMatrixWorld(true);
    for(const side of ['L','R']){
      const wrist=hands.group.getObjectByName(`Hand_${side}`),world=new THREE.Vector3();wrist.getWorldPosition(world);
      let maxBoneDistance=0;
      wrist.traverse(object=>{if(object instanceof THREE.Bone){const position=new THREE.Vector3();object.getWorldPosition(position);maxBoneDistance=Math.max(maxBoneDistance,position.distanceTo(world));}});
      assert(maxBoneDistance<.48,`${pose}/${side}: hand bone escaped wrist region (${maxBoneDistance.toFixed(4)})`);
      if(pose==='SwordGrip'){
        const socket=hands.group.getObjectByName(`equipmentSocket.${side==='L'?'left':'right'}`),thumbTip=wrist.getObjectByName('Thumb_Tip'),thumbMCP=wrist.getObjectByName('Thumb_MCP'),tipAtGrip=new THREE.Vector3(),mcpAtGrip=new THREE.Vector3();thumbTip.getWorldPosition(tipAtGrip);thumbMCP.getWorldPosition(mcpAtGrip);socket.worldToLocal(tipAtGrip);socket.worldToLocal(mcpAtGrip);
        assert(Math.hypot(mcpAtGrip.y,mcpAtGrip.z)<.035,`${pose}/${side}: thumb base does not contact handle`);
        assert(Math.hypot(tipAtGrip.y,tipAtGrip.z)<.10,`${pose}/${side}: thumb does not wrap handle`);
        assert(Math.abs(tipAtGrip.x)<.14,`${pose}/${side}: thumb missed handle length (${tipAtGrip.x.toFixed(4)})`);
        const sideSign=side==='R'?1:-1;
        assert(sideSign*tipAtGrip.x<.01,`${pose}/${side}: thumb did not cross to the opposite side of the handle (${tipAtGrip.x.toFixed(4)})`);
        assert(tipAtGrip.y<-.02,`${pose}/${side}: thumb did not curve downward around handle (${tipAtGrip.y.toFixed(4)})`);
      }
      results.push({pose,side,maxBoneDistance:+maxBoneDistance.toFixed(5)});
    }
  }

  console.log(JSON.stringify({ok:errors.length===0,errors,warnings,results},null,2));
  if(errors.length)process.exitCode=1;
}finally{await server.close();}
