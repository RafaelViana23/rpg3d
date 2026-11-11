import * as T from 'three';
export type RideableHorse={look?:{bone:T.Object3D;base:T.Quaternion;pitch:number;yaw:number;applied:boolean};root:T.Object3D;bounds:T.Box3;anchor:T.Object3D;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>;current:T.AnimationAction|null;motion:string;time:number;idleBones:{bone:T.Object3D;base:T.Quaternion;phase:number;amount:number}[]};
export const rideableHorses=new Map<T.Object3D,RideableHorse>();
const horseBounds=new T.Box3();
const scratch=new T.Vector3(),rotation=new T.Quaternion(),euler=new T.Euler();
export function registerRideableHorse(root:T.Object3D,clips:T.AnimationClip[]=root.animations){
  const existing=rideableHorses.get(root);if(existing)return existing;
  root.traverse(o=>{if(o.name==='Object_21')o.visible=false;if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});
  root.updateWorldMatrix(true,true);
  // SkinnedMesh refreshes bindMatrixInverse in updateMatrixWorld, not
  // updateWorldMatrix. Synchronize it and the bones before measuring the skin.
  root.updateMatrixWorld(true);
  root.traverse(object=>{if(object instanceof T.SkinnedMesh)object.skeleton.update();});
  let anchor=root.getObjectByName('MountAnchor');
  if(!anchor){
    anchor=new T.Object3D();anchor.name='MountAnchor';
    const saddle=root.getObjectByName('Object_16');
    const bounds=new T.Box3().setFromObject(saddle??root,true),top=bounds.getCenter(new T.Vector3());top.y=saddle?bounds.max.y+.03:bounds.min.y+(bounds.max.y-bounds.min.y)*.65;
    anchor.position.copy(root.worldToLocal(top));root.add(anchor);
  }
  const mixer=new T.AnimationMixer(root),actions=new Map<string,T.AnimationAction>();
  for(const [key,name] of [['idle','ArmatureAction'],['walk','Walk'],['walk-left','Walk_Left'],['walk-right','Walk_Right'],['run','Run'],['run-left','Run_Left'],['run-right','Run_Right']]){
    const clip=clips.find(c=>c.name===`Armature|${name}`)??clips.find(c=>c.name===name);
    if(clip)actions.set(key,mixer.clipAction(clip).setLoop(T.LoopRepeat,Infinity));
  }
  if(!actions.has('idle')&&clips[0])actions.set('idle',mixer.clipAction(clips[0]));
  const current=actions.get('idle')??null;current?.play();
  const idleBones:RideableHorse['idleBones']=[];
  for(const [name,phase,amount] of [['Neck001_023',0,.035],['Head_024',.55,.055],['EarL_025',1.2,.09],['EarR_026',2.5,-.09]] as const){const bone=root.getObjectByName(name);if(bone)idleBones.push({bone,base:bone.quaternion.clone(),phase,amount});}
  // Keep a local footprint of visible geometry, excluding the loose rein.
  const bounds=new T.Box3(),inverse=root.matrixWorld.clone().invert();
  root.traverseVisible(object=>{
    if(!(object instanceof T.Mesh))return;
    const box=new T.Box3().setFromObject(object,true);
    bounds.union(box.applyMatrix4(inverse));
  });
  const state={root,bounds,anchor,mixer,actions,current,motion:'idle',time:Math.random()*5,idleBones};rideableHorses.set(root,state);root.userData.rideableHorse=true;return state;
}
export function horseInteractionDistanceTo(state:RideableHorse,position:T.Vector3){
  state.root.updateWorldMatrix(true,false);
  horseBounds.copy(state.bounds).applyMatrix4(state.root.matrixWorld);
  if(horseBounds.isEmpty())return Infinity;
  if(position.y<horseBounds.min.y-1||position.y>horseBounds.max.y+1)return Infinity;
  const x=T.MathUtils.clamp(position.x,horseBounds.min.x,horseBounds.max.x);
  const z=T.MathUtils.clamp(position.z,horseBounds.min.z,horseBounds.max.z);
  return Math.hypot(position.x-x,position.z-z);
}
export function nearestRideableHorse(position:T.Vector3,eligible:(horse:RideableHorse)=>boolean=()=>true){
  let best:RideableHorse|undefined,distance=Infinity;
  for(const state of rideableHorses.values()){
    if(!state.root.parent||!state.root.visible||!eligible(state))continue;
    const d=horseInteractionDistanceTo(state,position);
    if(d<distance){distance=d;best=state;}
  }
  return {state:best,distance};
}
/** Resolve against the visible footprint, including the offset from the export origin. */
export function resolveHorseCollision(state:RideableHorse,position:T.Vector3,radius:number){
  state.root.updateWorldMatrix(true,false);
  horseBounds.copy(state.bounds).applyMatrix4(state.root.matrixWorld);
  if(horseBounds.isEmpty()||position.y+1.5<horseBounds.min.y||position.y>horseBounds.max.y)return;
  const loX=horseBounds.min.x-radius,hiX=horseBounds.max.x+radius;
  const loZ=horseBounds.min.z-radius,hiZ=horseBounds.max.z+radius;
  if(position.x<=loX||position.x>=hiX||position.z<=loZ||position.z>=hiZ)return;
  const distances=[position.x-loX,hiX-position.x,position.z-loZ,hiZ-position.z];
  const side=distances.indexOf(Math.min(...distances));
  if(side===0)position.x=loX;else if(side===1)position.x=hiX;else if(side===2)position.z=loZ;else position.z=hiZ;
}
const lookYawAxis=new T.Vector3(),lookAxis=new T.Vector3(),lookRotation=new T.Quaternion(),lookParentRotation=new T.Quaternion();
function clearHorseLook(state:RideableHorse){
  if(state.look?.applied){state.look.bone.quaternion.copy(state.look.base);state.look.applied=false;}
}
/** Add a limited camera pitch over the original head animation. */
export function updateHorseLook(state:RideableHorse,pitch:number,delta:number,yaw=0){
  if(!state.look){
    const bone=state.root.getObjectByName('Head_024');if(!bone)return;
    state.look={bone,base:bone.quaternion.clone(),pitch:0,yaw:0,applied:false};
  }
  clearHorseLook(state);
  const look=state.look;
  look.pitch=T.MathUtils.lerp(look.pitch,T.MathUtils.clamp(pitch,-.4,.4),1-Math.exp(-8*delta));
  state.root.getWorldQuaternion(lookRotation);
  lookAxis.set(1,0,0).applyQuaternion(lookRotation);
  if(look.bone.parent){look.bone.parent.getWorldQuaternion(lookParentRotation);lookAxis.applyQuaternion(lookParentRotation.invert());}
  look.yaw=T.MathUtils.lerp(look.yaw,T.MathUtils.clamp(yaw,-.4,.4),1-Math.exp(-8*delta));
  lookYawAxis.set(0,1,0);
  if(look.bone.parent){look.bone.parent.getWorldQuaternion(lookParentRotation);lookYawAxis.applyQuaternion(lookParentRotation.invert());}
  look.base.copy(look.bone.quaternion);
  look.bone.quaternion.premultiply(lookRotation.setFromAxisAngle(lookAxis.normalize(),-look.pitch));
  look.bone.quaternion.premultiply(lookRotation.setFromAxisAngle(lookYawAxis.normalize(),look.yaw));
  look.applied=true;
}
export function resetHorseLook(state:RideableHorse){clearHorseLook(state);if(state.look){state.look.pitch=0;state.look.yaw=0;}}
export function updateRideableHorses(delta:number,viewer:T.Vector3){
  for(const [root,state] of rideableHorses){
    let top:T.Object3D=root;while(top.parent)top=top.parent;
    if(!(top instanceof T.Scene)){state.mixer.stopAllAction();rideableHorses.delete(root);continue;}
    root.getWorldPosition(scratch);if(scratch.distanceToSquared(viewer)>90*90)continue;
    clearHorseLook(state);
    state.mixer.update(delta);state.time+=delta;
    if(state.motion==='idle')for(const {bone,base,phase,amount} of state.idleBones){const breathe=Math.sin(state.time*1.75+phase)*amount;bone.quaternion.copy(base).multiply(rotation.setFromEuler(euler.set(breathe*.35,breathe,breathe*.2)));}
  }
}
