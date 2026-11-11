import * as THREE from 'three';
import { HandAnimator, HandPoseName } from './HandAnimator';
import { FingerName, HandRig } from './HandRig';

export type GripKind='espada'|'escudo'|'pocao'|'magico'|'nenhum';
type SocketProfile={pose:HandPoseName;position:THREE.Vector3;rotation:THREE.Euler};

export type SwordSocketTuning={position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number}};
export const SWORD_SOCKET_STORAGE_KEY='aincrad-sword-socket-v1';
export const DEFAULT_SWORD_SOCKET_TUNING:SwordSocketTuning={position:{x:0,y:-.070,z:.068},rotation:{x:0,y:-.28,z:-.10}};

export function loadSwordSocketTuning():SwordSocketTuning{
  const fallback=structuredClone(DEFAULT_SWORD_SOCKET_TUNING);
  if(typeof localStorage==='undefined')return fallback;
  try{
    const saved=JSON.parse(localStorage.getItem(SWORD_SOCKET_STORAGE_KEY)||'null') as Partial<SwordSocketTuning>|null;
    if(!saved)return fallback;
    for(const group of ['position','rotation'] as const)for(const axis of ['x','y','z'] as const){const value=saved[group]?.[axis];if(typeof value==='number'&&Number.isFinite(value))fallback[group][axis]=value;}
  }catch{/* Invalid drafts fall back to the calibrated defaults. */}
  return fallback;
}

export function applySwordSocketTuning(socket:THREE.Object3D,sideSign:number,tuning=loadSwordSocketTuning()){
  socket.position.set(tuning.position.x,tuning.position.y,tuning.position.z);
  socket.rotation.set(tuning.rotation.x,tuning.rotation.y,tuning.rotation.z*sideSign);
}

const PROFILES:Record<GripKind,SocketProfile>={
  espada:{pose:'SwordGrip',position:new THREE.Vector3(0,-.070,.068),rotation:new THREE.Euler(0,0,0)},
  magico:{pose:'SwordGrip',position:new THREE.Vector3(0,-.070,.068),rotation:new THREE.Euler(0,0,0)},
  escudo:{pose:'ShieldGrip',position:new THREE.Vector3(0,-.052,.064),rotation:new THREE.Euler(0,0,0)},
  pocao:{pose:'ShieldGrip',position:new THREE.Vector3(0,-.058,.066),rotation:new THREE.Euler(0,0,0)},
  nenhum:{pose:'Relaxed',position:new THREE.Vector3(0,-.055,.068),rotation:new THREE.Euler(0,0,0)}
};

export class GripSolver {
  ikEnabled=false;
  constructor(readonly rig:HandRig,readonly animator:HandAnimator){}
  setGrip(kind:GripKind){
    const profile=PROFILES[kind];this.rig.socket.position.copy(profile.position);this.rig.socket.quaternion.setFromEuler(profile.rotation);
    if(kind==='espada'||kind==='magico')applySwordSocketTuning(this.rig.socket,this.rig.sideSign);
    this.animator.setPose(profile.pose);
  }
  attach(object:THREE.Object3D){this.rig.socket.add(object);return object;}
  detach(object:THREE.Object3D){this.rig.socket.remove(object);}

  /** Optional lightweight CCD pass. Targets are expressed in hand-rig local space. */
  solveFingerTips(targets:Partial<Record<FingerName,THREE.Vector3>>,iterations=3){
    if(!this.ikEnabled)return;
    this.rig.root.updateMatrixWorld(true);
    const rootInverse=this.rig.root.matrixWorld.clone().invert();
    for(let iteration=0;iteration<iterations;iteration++)for(const [finger,target] of Object.entries(targets) as [FingerName,THREE.Vector3][]){
      const chain=this.rig.finger(finger),tip=chain.at(-1)!;
      for(let i=chain.length-2;i>=0;i--){
        const joint=chain[i],jointWorld=new THREE.Vector3(),tipWorld=new THREE.Vector3();joint.getWorldPosition(jointWorld);tip.getWorldPosition(tipWorld);
        const targetWorld=target.clone().applyMatrix4(this.rig.root.matrixWorld);
        const from=tipWorld.sub(jointWorld).normalize(),to=targetWorld.sub(jointWorld).normalize();
        if(from.lengthSq()<1e-6||to.lengthSq()<1e-6)continue;
        const worldDelta=new THREE.Quaternion().setFromUnitVectors(from,to);
        const parentWorld=new THREE.Quaternion();joint.parent!.getWorldQuaternion(parentWorld);
        const localDelta=parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
        joint.quaternion.premultiply(localDelta).normalize();
        const euler=this.rig.clampEuler(joint.name,new THREE.Euler().setFromQuaternion(joint.quaternion,'XYZ'));joint.quaternion.setFromEuler(euler);
        this.rig.root.updateMatrixWorld(true);
      }
    }
    void rootInverse;
  }
}
