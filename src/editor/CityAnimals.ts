import { cityAnimalKinds } from './CityVariation';
import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const loader=new GLTFLoader();
const assets=new Map<string,Promise<GLTF>>();
type Resident={root:T.Group;mixer:T.AnimationMixer;idle?:T.AnimationAction;walk?:T.AnimationAction;phase:number;target:T.Vector3|null;pause:number;stuck:number;rat:boolean;moving:boolean};
const residents=new Set<Resident>();
let nearbyResidents:Resident[]=[];
let visibilityElapsed=1,simulationElapsed=0;
const animalPosition=new T.Vector3();
const coats=[0x202025,0xf4eee0,0xcaa57b];
function asset(kind:string){
  let promise=assets.get(kind);
  if(!promise){promise=loader.loadAsync(`/models/animals/${kind}/model.glb`);assets.set(kind,promise);}
  return promise;
}
export function addCityAnimals(building:T.Group,index:number){
  const info=building.userData.building;if(!info)return;
  const kinds=cityAnimalKinds(index);
  for(const rat of [false,true]){
    if(rat?!kinds.rat:!kinds.cat)continue;
    const root=new T.Group(),kind=rat?'rat':'cat';
    root.name=rat?'Rato da cidade':`Gato ${['preto','branco','bege'][index%3]}`;
    root.position.set((rat?-1:1)*(info.width/2+1.1),.08,0);
    root.userData.cityAnimal=true;root.userData.buildEditable=false;
    root.userData.animalModel=`/models/animals/${kind}/model.glb`;
    building.add(root);
    void asset(kind).then(gltf=>{
      if(!building.parent)return;
      const model=clone(gltf.scene);
      // Keep normalization outside the animated GLB hierarchy and measure the
      // actual skinned vertices rather than cached export bounds.
      const normalized=new T.Group();normalized.add(model);
      model.updateMatrixWorld(true);
      model.traverse(child=>{if(child instanceof T.SkinnedMesh)child.skeleton.update();});
      const bounds=new T.Box3().setFromObject(model,true),center=bounds.getCenter(new T.Vector3());
      model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
      const height=rat?.125:.5;
      normalized.scale.setScalar(height/Math.max(bounds.getSize(new T.Vector3()).y,.001));
      root.add(normalized);
      // City buildings may have saved editor scale; animals retain real sizes.
      building.updateWorldMatrix(true,false);
      const buildingScale=building.getWorldScale(new T.Vector3());
      root.scale.set(1/Math.max(.001,Math.abs(buildingScale.x)),1/Math.max(.001,Math.abs(buildingScale.y)),1/Math.max(.001,Math.abs(buildingScale.z)));
      model.traverse(child=>{
        if(!(child instanceof T.Mesh))return;
        child.castShadow=child.receiveShadow=true;
        if(!rat){
          const tint=(source:T.Material)=>{
            const m=source.clone();
            if(m instanceof T.MeshStandardMaterial||m instanceof T.MeshLambertMaterial||m instanceof T.MeshPhongMaterial){
              // Keep the GLB's pink ears/nose; recolor only its two fur materials.
              if(/grey|white/i.test(source.name)){m.color.setHex(coats[index%3]);m.map=null;}
            }
            return m;
          };
          child.material=Array.isArray(child.material)?child.material.map(tint):tint(child.material);
        }
      });
      const mixer=new T.AnimationMixer(model);
      const idleClip=gltf.animations.find(c=>/idle/i.test(c.name)),walkClip=gltf.animations.find(c=>/walk|run/i.test(c.name));
      const idle=idleClip?mixer.clipAction(idleClip):undefined,walk=walkClip?mixer.clipAction(walkClip):undefined;
      idle?.play();
      residents.add({root,mixer,idle,walk,phase:index*.73+(rat?2:0),target:null,pause:Math.random()*3,stuck:0,rat,moving:false});
    }).catch(error=>console.error(`Não foi possível carregar ${kind} da cidade`,error));
  }
}
export function updateCityAnimals(delta:number,groundAt:(x:number,z:number)=>number,resolve:(position:T.Vector3,radius:number)=>void,viewer:T.Vector3){
  visibilityElapsed+=delta;simulationElapsed+=delta;
  if(visibilityElapsed>=.25){
    visibilityElapsed=0;
    const candidates:{animal:Resident;distance:number}[]=[];
    for(const animal of residents){
      if(!animal.root.parent?.parent){animal.mixer.stopAllAction();residents.delete(animal);continue;}
      const distance=animal.root.getWorldPosition(animalPosition).distanceToSquared(viewer);
      animal.root.visible=distance<65*65;
      if(distance<45*45)candidates.push({animal,distance});
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    nearbyResidents=candidates.slice(0,24).map(c=>c.animal);
  }
  for(const animal of nearbyResidents)animal.mixer.update(delta);
  if(simulationElapsed<.05)return;
  delta=Math.min(simulationElapsed,.1);simulationElapsed=0;
  const active=[...residents].filter(a=>a.root.parent?.parent);
  for(const animal of nearbyResidents){
    if(!animal.root.parent?.parent)continue;
    const parent=animal.root.parent,position=animal.root.getWorldPosition(new T.Vector3());
    animal.pause=Math.max(0,animal.pause-delta);
    if(!animal.target&&animal.pause===0){
      // Pick a different facade anywhere in town, with a random street offset.
      const destination=active[Math.floor(Math.random()*active.length)].root.parent!;
      const info=destination.userData.building;
      animal.target=destination.localToWorld(new T.Vector3((Math.random()-.5)*(info.width+3),.08,info.depth/2+2+Math.random()*3));
      animal.stuck=0;
    }
    let moving=false;
    if(animal.target){
      const direction=animal.target.clone().sub(position).setY(0),distance=direction.length();
      if(distance<.6){animal.target=null;animal.pause=1+Math.random()*5;}
      else{
        direction.normalize();const next=position.clone().addScaledVector(direction,Math.min(distance,(animal.rat?.8:.65)*delta));
        resolve(next,animal.rat?.1:.3);
        const advanced=Math.hypot(next.x-position.x,next.z-position.z);
        if(advanced<delta*.12)animal.stuck+=delta;else animal.stuck=Math.max(0,animal.stuck-delta*.25);
        next.y=groundAt(next.x,next.z);
        animal.root.position.copy(parent.worldToLocal(next));
        const worldRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.atan2(direction.x,direction.z));
        animal.root.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldRotation));
        moving=advanced>delta*.05;
        if(animal.stuck>1.2){animal.target=null;animal.pause=Math.random();}
      }
    }
    if(moving!==animal.moving){
      const next=moving?animal.walk:animal.idle,old=moving?animal.idle:animal.walk;
      if(next){old?.fadeOut(.2);next.reset().fadeIn(.2).play();}
      animal.moving=moving;
    }
  }
}
export function resolveCityAnimalCollisions(position:T.Vector3,radius:number){
  for(const animal of nearbyResidents){
    if(!animal.root.parent?.parent)continue;
    const p=animal.root.getWorldPosition(animalPosition);
    if(Math.abs(position.y-p.y)>1)continue;
    const dx=position.x-p.x,dz=position.z-p.z,d=Math.hypot(dx,dz),minimum=radius+(animal.rat?.1:.3);
    if(d<minimum){position.x+= (d?dx/d:1)*(minimum-d);position.z+=(d?dz/d:0)*(minimum-d);}
  }
}
