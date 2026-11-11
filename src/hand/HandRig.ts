import * as THREE from 'three';

export type HandSide = 'left' | 'right';
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'little';
export type JointLimit = { x: [number, number]; y: [number, number]; z: [number, number] };

const DEG=Math.PI/180;
// Finger chains extend along -Y and the equipment sits on the palm's +Z side.
// Anatomical flexion is therefore a negative local-X rotation.
const FLEX_LIMIT:JointLimit={x:[-105*DEG,8*DEG],y:[-12*DEG,12*DEG],z:[-8*DEG,8*DEG]};

export class HandRig {
  readonly root=new THREE.Group();
  readonly bones:THREE.Bone[]=[];
  readonly byName=new Map<string,THREE.Bone>();
  readonly limits=new Map<string,JointLimit>();
  readonly rest=new Map<string,THREE.Quaternion>();
  readonly restPosition=new Map<string,THREE.Vector3>();
  readonly socket=new THREE.Group();
  readonly skeleton:THREE.Skeleton;
  readonly sideSign:number;

  constructor(readonly side:HandSide){
    this.sideSign=side==='right'?1:-1;
    this.root.name=`handRig.${side}`;
    const suffix=side==='left'?'L':'R';
    const wrist=this.bone(`Wrist_${suffix}`,this.root,[0,0,0],{x:[-55*DEG,55*DEG],y:[-90*DEG,90*DEG],z:[-35*DEG,35*DEG]});
    const hand=this.bone(`Hand_${suffix}`,wrist,[0,-.042,0],{x:[-12*DEG,18*DEG],y:[-8*DEG,8*DEG],z:[-10*DEG,10*DEG]});
    this.bone('Palm',hand,[0,-.052,.004],{x:[-8*DEG,12*DEG],y:[-6*DEG,6*DEG],z:[-8*DEG,8*DEG]});

    const thumbCMC=this.bone('Thumb_CMC',hand,[this.sideSign*.013,-.057,.016],{x:[-55*DEG,55*DEG],y:[-85*DEG,85*DEG],z:[-50*DEG,50*DEG]});
    const thumbMCP=this.bone('Thumb_MCP',thumbCMC,[this.sideSign*.045,-.026,.018],{x:[-70*DEG,55*DEG],y:[-20*DEG,20*DEG],z:[-18*DEG,18*DEG]});
    const thumbIP=this.bone('Thumb_IP',thumbMCP,[this.sideSign*.038,-.025,.010],{x:[-85*DEG,70*DEG],y:[-8*DEG,8*DEG],z:[-8*DEG,8*DEG]});
    this.bone('Thumb_Tip',thumbIP,[this.sideSign*.031,-.018,.006],{x:[-15*DEG,15*DEG],y:[0,0],z:[0,0]});

    const specs:[Exclude<FingerName,'thumb'>,number,number,number][]=[
      ['index',.052,.050,.050],['middle',.018,.057,.057],['ring',-.018,.054,.054],['little',-.050,.044,.046]
    ];
    for(const [name,x,metacarpalLength,proximalLength] of specs){
      const mx=this.sideSign*x;
      const label=name==='little'?'Pinky':name[0].toUpperCase()+name.slice(1);
      const meta=this.bone(`${label}_Metacarpal`,hand,[mx,-.064,.004],{x:[-8*DEG,16*DEG],y:[-8*DEG,8*DEG],z:[-15*DEG,15*DEG]});
      const mcp=this.bone(`${label}_MCP`,meta,[0,-metacarpalLength,.012],{x:[-95*DEG,15*DEG],y:[-20*DEG,20*DEG],z:[-22*DEG,22*DEG]});
      const pip=this.bone(`${label}_PIP`,mcp,[0,-proximalLength,0],FLEX_LIMIT);
      const dip=this.bone(`${label}_DIP`,pip,[0,-proximalLength*.68,0],{x:[-85*DEG,0],y:[-7*DEG,7*DEG],z:[-7*DEG,7*DEG]});
      this.bone(`${label}_Tip`,dip,[0,-proximalLength*.48,0],{x:[-10*DEG,0],y:[0,0],z:[0,0]});
    }
    // 3 palm bones + 4 thumb bones + 4 × 5 finger bones = exactly 27.
    if(this.bones.length!==27)throw new Error(`Hand rig invariant failed: ${this.bones.length} bones`);
    hand.add(this.socket);this.socket.name=`equipmentSocket.${side}`;this.socket.position.set(0,-.055,.068);
    this.root.updateMatrixWorld(true);this.skeleton=new THREE.Skeleton(this.bones);this.skeleton.calculateInverses();
    this.captureRestPose();
  }

  get wrist(){return this.require(this.side==='left'?'Wrist_L':'Wrist_R');}
  get hand(){return this.require(this.side==='left'?'Hand_L':'Hand_R');}
  get palm(){return this.require('Palm');}
  get palmCenter(){return this.hand;}
  require(name:string){const bone=this.byName.get(name);if(!bone)throw new Error(`Unknown hand bone: ${name}`);return bone;}
  finger(name:FingerName){
    return name==='thumb'
      ? ['Thumb_CMC','Thumb_MCP','Thumb_IP','Thumb_Tip'].map(n=>this.require(n))
      : (()=>{const label=name==='little'?'Pinky':name[0].toUpperCase()+name.slice(1);return [`${label}_Metacarpal`,`${label}_MCP`,`${label}_PIP`,`${label}_DIP`,`${label}_Tip`].map(n=>this.require(n));})();
  }
  captureRestPose(){for(const bone of this.bones){this.rest.set(bone.name,bone.quaternion.clone());this.restPosition.set(bone.name,bone.position.clone());}}
  /** Bind-space matrix relative to handRig.root. Never reads scene/world coordinates. */
  bindMatrixLocal(bone:THREE.Bone){
    const chain:THREE.Bone[]=[];let current:THREE.Object3D|null=bone;
    while(current instanceof THREE.Bone){chain.push(current);current=current.parent;}
    const matrix=new THREE.Matrix4();
    for(let i=chain.length-1;i>=0;i--){chain[i].updateMatrix();matrix.multiply(chain[i].matrix);}
    return matrix;
  }
  bindPositionLocal(bone:THREE.Bone){return new THREE.Vector3().setFromMatrixPosition(this.bindMatrixLocal(bone));}
  clampEuler(name:string,euler:THREE.Euler){
    const limit=this.limits.get(name);if(!limit)return euler;
    euler.x=THREE.MathUtils.clamp(euler.x,...limit.x);euler.y=THREE.MathUtils.clamp(euler.y,...limit.y);euler.z=THREE.MathUtils.clamp(euler.z,...limit.z);return euler;
  }
  dispose(){this.skeleton.dispose();}

  private bone(name:string,parent:THREE.Object3D,position:[number,number,number],limit:JointLimit){
    const bone=new THREE.Bone();bone.name=name;bone.position.set(...position);parent.add(bone);this.bones.push(bone);this.byName.set(name,bone);this.limits.set(name,limit);return bone;
  }
}
