import * as THREE from 'three';
import { FingerName, HandRig } from './HandRig';
import {applyBoneTransform,boneTuningKey,loadHandBoneTuning} from './HandBoneTuning';

export type HandPoseName='Open'|'Relaxed'|'Fist'|'SwordGrip'|'ShieldGrip'|'Point';
export type HandControls={curl:number;spread:number;opposition:number;relaxation:number};
type PoseDefinition=HandControls&{fingerCurl?:Partial<Record<FingerName,number>>};

export const HAND_POSES:Record<HandPoseName,PoseDefinition>={
  Open:{curl:.02,spread:.48,opposition:.24,relaxation:0,fingerCurl:{index:.015,middle:.02,ring:.03,little:.045,thumb:.12}},
  Relaxed:{curl:.10,spread:.12,opposition:.34,relaxation:.32,fingerCurl:{index:.05,middle:.07,ring:.10,little:.14,thumb:.17}},
  Fist:{curl:1,spread:0,opposition:.82,relaxation:0},
  // The handle occupies the centre of the palm, so this must remain visibly
  // more open than Fist. The progressive curl keeps every fingertip aimed
  // inward while leaving a cylindrical clearance around the grip.
  SwordGrip:{curl:.72,spread:0,opposition:.84,relaxation:0,fingerCurl:{index:.69,middle:.71,ring:.73,little:.75,thumb:.72}},
  ShieldGrip:{curl:.84,spread:0,opposition:.74,relaxation:0,fingerCurl:{index:.78,middle:.86,ring:.92,little:.96,thumb:.68}},
  Point:{curl:1,spread:.12,opposition:.58,relaxation:0,fingerCurl:{index:0,middle:1,ring:1,little:1,thumb:.45}}
};

export class HandAnimator {
  private controls:HandControls={...HAND_POSES.Relaxed};
  private fingerCurl:Partial<Record<FingerName,number>>={...HAND_POSES.Relaxed.fingerCurl};
  private targets=new Map<string,THREE.Quaternion>();
  private speed=13;
  private savedBoneTuning=loadHandBoneTuning();
  pose:HandPoseName='Relaxed';

  constructor(readonly rig:HandRig){this.rebuildTargets();}
  setBoneTuning(tuning:ReturnType<typeof loadHandBoneTuning>){this.savedBoneTuning=tuning;}
  setPose(name:HandPoseName,speed=13){const pose=HAND_POSES[name];this.pose=name;this.speed=speed;this.controls={curl:pose.curl,spread:pose.spread,opposition:pose.opposition,relaxation:pose.relaxation};this.fingerCurl={...pose.fingerCurl};this.rebuildTargets();}
  setControls(values:Partial<HandControls>){Object.assign(this.controls,values);this.rebuildTargets();}
  setFingerCurl(finger:FingerName,value:number){this.fingerCurl[finger]=THREE.MathUtils.clamp(value,0,1);this.rebuildTargets();}
  update(dt:number){
    const alpha=1-Math.exp(-this.speed*Math.min(dt,.05));for(const [name,target] of this.targets)this.rig.require(name).quaternion.slerp(target,alpha);
    for(const bone of this.rig.bones){
      bone.position.copy(this.rig.restPosition.get(bone.name)!);
      const saved=this.savedBoneTuning[boneTuningKey(this.pose,bone.name)];
      if(saved)applyBoneTransform(bone,saved,this.rig.sideSign);
    }
  }

  private target(name:string,x=0,y=0,z=0){
    const euler=this.rig.clampEuler(name,new THREE.Euler(x,y,z,'XYZ'));
    this.targets.set(name,new THREE.Quaternion().setFromEuler(euler));
  }
  private rebuildTargets(){
    this.targets.clear();
    const side=this.rig.sideSign,{curl,spread,opposition,relaxation}=this.controls;
    const fingerSpread:Record<Exclude<FingerName,'thumb'>,number>={index:.17,middle:.045,ring:-.055,little:-.18};
    for(const name of ['index','middle','ring','little'] as const){
      const label=name==='little'?'Pinky':name[0].toUpperCase()+name.slice(1);
      const c=THREE.MathUtils.clamp(this.fingerCurl[name]??curl,0,1),relaxed=(name==='index'?.12:name==='middle'?.18:name==='ring'?.25:.34)*relaxation;
      const f=THREE.MathUtils.clamp(c+relaxed,0,1);
      const swordC=this.pose==='SwordGrip';
      // A natural grip closes first at the knuckles. The proximal and distal
      // phalanges then remain nearly parallel around the cylindrical handle,
      // instead of collapsing inward like claws.
      this.target(`${label}_Metacarpal`,-f*(swordC?.035:.10),0,side*fingerSpread[name]*spread);
      this.target(`${label}_MCP`,-f*(swordC?1.25:1.42),0,side*fingerSpread[name]*spread*.62);
      this.target(`${label}_PIP`,-f*(swordC?1.35:1.62));
      this.target(`${label}_DIP`,-f*(swordC?.76:1.22));
      this.target(`${label}_Tip`,-f*(swordC?.035:.08));
    }
    const tc=THREE.MathUtils.clamp(this.fingerCurl.thumb??curl,0,1);
    const swordWrap=this.pose==='SwordGrip',shieldWrap=this.pose==='ShieldGrip',fistWrap=this.pose==='Fist';
    if(swordWrap){
      // Deliberately no procedural thumb targets. SwordGrip thumb placement
      // comes exclusively from the rig authored and saved in Hand Lab.
    }else if(fistWrap){
      this.target('Thumb_CMC',-.234,-side*1.423,side*.476);
      this.target('Thumb_MCP',-.42,0,0);
      this.target('Thumb_IP',-.32,0,0);
      this.target('Thumb_Tip',0,0,0);
    }else{
      this.target('Thumb_CMC',shieldWrap?-.34:-tc*.56,shieldWrap?-side*.92:-side*opposition*1.35,shieldWrap?side*.30:side*opposition*.62);
      this.target('Thumb_MCP',-tc*.32,0,0);
      this.target('Thumb_IP',-tc*.24,0,0);
      this.target('Thumb_Tip',0,0,0);
    }
    this.target('Palm',-relaxation*.035,0,0);this.target(this.rig.side==='left'?'Hand_L':'Hand_R',-relaxation*.04,0,0);
  }
}
