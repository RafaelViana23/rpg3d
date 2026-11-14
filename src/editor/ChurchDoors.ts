import * as T from 'three';
type DoorOpening={axis?:'x'|'z';x?:number;y:number;z:number;width:number;height:number;label?:string;openAngle?:number;wallDepth?:number};
type Door={opening:DoorOpening;building:T.Group;root:T.Group;mixer:T.AnimationMixer;action:T.AnimationAction;progress:number;open:boolean;collider:number[];autoClose?:{startSide:number;crossed:boolean}};
const doors=new Set<Door>();
const lightDoorPoint=new T.Vector3();
export function cityDoorBuildings(){
  return new Set([...doors].filter(door=>door.building.parent).map(door=>door.building));
}
/** Preparation uses entrances even before the player opens a leaf. */
export function buildingDoorIsNear(building:T.Group,viewer:T.Vector3,distance=18){
  let registered=false;
  for(const door of doors){
    if(door.building!==building)continue;
    registered=true;const b=door.opening;
    lightDoorPoint.set(b.x??0,b.y+1,b.z).applyMatrix4(building.matrixWorld);
    if(lightDoorPoint.distanceToSquared(viewer)<distance*distance)return true;
  }
  if(registered)return false;
  const info=building.userData.building;if(!info?.enterable)return false;
  const entrance=building.userData.royalGate;
  lightDoorPoint.set(0,(entrance?.y??0)+1,entrance?.z??info.depth/2).applyMatrix4(building.matrixWorld);
  return lightDoorPoint.distanceToSquared(viewer)<distance*distance;
}
/** Open doors activate their interior only while the player is near the entrance. */
export function buildingDoorIsOpenNear(building:T.Group,viewer:T.Vector3){
  for(const door of doors){
    if(door.building!==building||(!door.open&&door.progress<=0))continue;
    const b=door.opening;
    lightDoorPoint.set(b.x??0,b.y+1,b.z).applyMatrix4(building.matrixWorld);
    if(lightDoorPoint.distanceToSquared(viewer)<12*12)return true;
  }
  return false;
}
export function registerVillageDoor(building:T.Group,root:T.Group,placement?:DoorOpening){
  // Apply fitting scale inside the hinge, so the leaf keeps its dimensions while rotating.
  // A nonuniform scale outside the hinge deforms/squeezes the open door into the wall.
  const fit=new T.Matrix4().makeScale(root.scale.x,root.scale.y,root.scale.z);
  for(const child of root.children)child.applyMatrix4(fit);
  root.scale.set(1,1,1);root.updateMatrix();
  const bounds=new T.Box3();
  // Template coordinates before the placed root's scale/rotation.
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert();
  root.traverse(child=>{const mesh=child as T.Mesh;if(mesh.isMesh){mesh.geometry.computeBoundingBox();if(mesh.geometry.boundingBox)bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));}});
  const hinge=new T.Group();hinge.name='VillageDoorHinge';hinge.position.set(bounds.min.x,0,(bounds.min.z+bounds.max.z)/2);
  for(const child of [...root.children]){root.remove(child);child.position.sub(hinge.position);hinge.add(child);}
  root.add(hinge);
  const closed=new T.Quaternion();
  // Select the swing from the opening's outward-facing side so the leaf
  // always rotates into the building, never onto the street or courtyard.
  const inwardAngle=placement?.openAngle??(
    placement?.axis==='x'
      ? ((placement.x??0)>0?Math.PI/2:-Math.PI/2)
      : ((placement?.z??building.userData.building?.depth/2)>0?-Math.PI/2:Math.PI/2)
  );
  const open=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),inwardAngle);
  root.animations=[new T.AnimationClip('open',1.1,[new T.QuaternionKeyframeTrack('VillageDoorHinge.quaternion',[0,1.1],[...closed.toArray(),...open.toArray()])])];
  registerChurchDoor(building,root,placement);
}
export function registerChurchDoor(building:T.Group,root:T.Group,placement?:DoorOpening){
  const clip=root.animations.find(c=>c.name==='open');if(!clip)return;
  const mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);
  action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;mixer.update(0);
  const b=building.userData.building;
  const opening:DoorOpening=placement??{y:0,z:b.depth/2,width:b.doorWidth,height:b.doorHeight};
  const x=opening.x??0;
  const collider=opening.axis==='x'
    ?[x-.3,opening.y,opening.z-opening.width/2,x+.4,opening.y+opening.height,opening.z+opening.width/2]
    :[x-opening.width/2,opening.y,opening.z-.3,x+opening.width/2,opening.y+opening.height,opening.z+.4];
  building.userData.localColliders.push(collider);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
  doors.add({opening,building,root,mixer,action,progress:0,open:false,collider});
}
export function nearestChurchDoor(position:T.Vector3,maxDistance=1.3){
  let nearest:Door|null=null,distance=maxDistance;
  for(const door of doors){
    if(!door.building.parent)continue;
    // The capital gate is a 3.75× placed asset. Its closed-door collider is
    // correspondingly thick, so the player is stopped before the old 1.3 m
    // interaction radius can reach the opening. Keep normal house doors
    // precise, but measure wall gates from the outside of their real collider.
    const reach=door.building.userData.wallGateApproach?Math.max(maxDistance,3.4):maxDistance;
    const b=door.opening,local=door.building.worldToLocal(position.clone()),x=b.x??0;
    const p=door.building.localToWorld(b.axis==='x'
      ?new T.Vector3(x,T.MathUtils.clamp(local.y,b.y,b.y+b.height),T.MathUtils.clamp(local.z,b.z-b.width/2,b.z+b.width/2))
      :new T.Vector3(T.MathUtils.clamp(local.x,x-b.width/2,x+b.width/2),T.MathUtils.clamp(local.y,b.y,b.y+b.height),b.z));
    const d=p.distanceTo(position);
    if(d<reach&&d<distance){nearest=door;distance=d;}
    // A wall gate can be the only valid nearby door even when the player is
    // outside the standard house-door radius.
    else if(d<reach&&!nearest){nearest=door;distance=d;}
  }
  return nearest;
}
/** Residents open the nearby leaf without toggling it shut on the next frame. */
export function openDoorForResident(position:T.Vector3){
 const door=nearestChurchDoor(position,1.6);if(door)door.open=true;
}
export function toggleChurchDoor(position:T.Vector3){
  const door=nearestChurchDoor(position);if(!door)return false;
  door.open=!door.open;
  const approach=door.building.userData.wallGateApproach as {x:number;z:number;dx:number;dz:number;length:number}|undefined;
  door.autoClose=door.open&&approach?{startSide:(position.x-approach.x)*approach.dx+(position.z-approach.z)*approach.dz>=0?1:-1,crossed:false}:undefined;
  return true;
}
export function churchDoorPrompt(position:T.Vector3){
  const door=nearestChurchDoor(position);if(!door)return null;
  const verb=door.open?'Fechar':'Abrir',owner=door.building.userData.ownerName;
  if(door.opening.label)return `${verb} ${door.opening.label}`;
  if(door.building.name==='Cidade:house'&&owner)return `${verb} casa de ${owner}`;
  const places:Record<string,string>={'Cidade:church':'igreja','Cidade:weapons':'loja de armas','Cidade:potions':'loja de poções','Cidade:tavern':'taverna','Cidade:inn':'pousada','Cidade:guild':'guilda','Cidade:palace':'palácio'};
  const place=places[door.building.name];return `${verb} ${place??'porta'}${owner&&place?` de ${owner}`:''}`;
}
export function updateChurchDoors(delta:number,viewer?:T.Vector3){
  for(const door of doors){
    if(!door.building.parent){door.mixer.stopAllAction();doors.delete(door);continue;}
    const approach=door.building.userData.wallGateApproach as {x:number;z:number;dx:number;dz:number;length:number}|undefined;
    if(viewer&&door.open&&door.autoClose&&approach){
      const along=(viewer.x-approach.x)*approach.dx+(viewer.z-approach.z)*approach.dz;
      const traversal=door.autoClose;
      if(along*traversal.startSide<-.35)traversal.crossed=true;
      const scale=door.building.getWorldScale(lightDoorPoint);
      const insideClearance=door.opening.width*Math.abs(scale.x)/2+1;
      if(traversal.crossed&&(traversal.startSide>0?along<-insideClearance:along>=approach.length+.5)){
        door.open=false;door.autoClose=undefined;
      }
    }
    const previous=door.progress;
    door.progress=T.MathUtils.clamp(door.progress+(door.open?1:-1)*delta/1.1,0,1);
    if(previous===door.progress)continue;
    // LoopOnce disables/finishes at the open endpoint. Re-enable the action
    // before sampling the reverse pose, including repeated open/close cycles.
    door.action.reset().play();door.action.paused=true;
    door.action.time=door.progress*door.action.getClip().duration;door.mixer.update(0);
    const colliders=door.building.userData.localColliders as number[][],index=colliders.indexOf(door.collider);
    const passable=door.open?door.progress>.85:door.progress>.1;
    if(passable&&index>=0){colliders.splice(index,1);door.building.userData.colliderRevision++;}
    else if(!passable&&index<0){colliders.push(door.collider);door.building.userData.colliderRevision++;}
  }
}
