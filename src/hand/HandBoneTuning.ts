import * as THREE from 'three';
import type {HandPoseName} from './HandAnimator';

export type BoneVector={x:number;y:number;z:number};
export type BoneTransform={position?:BoneVector;rotation?:BoneVector};
export type HandBoneTuning=Record<string,BoneTransform>;
export const HAND_BONE_TUNING_STORAGE_KEY='aincrad-hand-bone-tuning-v1';
export const boneTuningKey=(pose:HandPoseName,bone:string)=>`${pose}:${bone}`;

// Project-authored fallback used by static builds, SSR validation and the
// first frame before the shared calibration endpoint responds.
export const DEFAULT_HAND_BONE_TUNING:HandBoneTuning={
  'SwordGrip:Thumb_CMC':{
    rotation:{x:.5061454831,y:-1.42,z:.4764748858}
  },
  'SwordGrip:Thumb_MCP':{
    rotation:{x:-.3403392041,y:0,z:0}
  },
  'SwordGrip:Thumb_IP':{
    rotation:{x:-.2600540585,y:0,z:0}
  }
};

export function loadHandBoneTuning():HandBoneTuning{
  if(typeof localStorage==='undefined')return{...DEFAULT_HAND_BONE_TUNING};
  try{
    const value=JSON.parse(localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY)||'{}') as HandBoneTuning;
    return value&&typeof value==='object'?{...DEFAULT_HAND_BONE_TUNING,...value}:{...DEFAULT_HAND_BONE_TUNING};
  }catch{return{...DEFAULT_HAND_BONE_TUNING};}
}

export function applyBoneTransform(bone:THREE.Bone,transform:BoneTransform,sideSign:number){
  if(transform.position)bone.position.set(transform.position.x*sideSign,transform.position.y,transform.position.z);
  if(transform.rotation){const rotation=transform.rotation;bone.quaternion.setFromEuler(new THREE.Euler(rotation.x,rotation.y*sideSign,rotation.z*sideSign,'XYZ')).normalize();}
}
