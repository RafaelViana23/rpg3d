import { updateStreetLightingMap } from './CityStreetLightingMap';
import * as T from 'three';
import { cityLightBuilding, cityLightContext } from './CityLightInteriors';

type Flame={root:T.Group;mixer:T.AnimationMixer;light:T.PointLight;base:number;street:boolean;persistent:boolean;fire?:T.Object3D;fireScale?:T.Vector3;emitter?:T.PointLight};
const flames=new Set<Flame>();

// Compatibility with palace placements; every fixture now owns its direct light.
type PalaceLight={pack:string;group?:string;persistent?:boolean;intensity?:number;distance?:number};
export function preparePalaceFirelights(_owner:T.Group,_placements:PalaceLight[]){}
export function palaceFirelightEmitter(_owner:T.Group,_index:number,_group?:string):T.PointLight|undefined{return undefined;}

// Shadow-free direct fixture lights avoid additional shadow-map passes.
const flamePosition=new T.Vector3();
/** Kept for callers; direct fixture lights need no pooled emitters. */
export function prepareCityFirelightPool(_scene:T.Object3D,_count:number,_shadows:number){}
export function addCityFirelight(root:T.Group,torch:boolean,options?:{intensity?:number;distance?:number;persistent?:boolean;emitter?:T.PointLight}){
  const mixer=new T.AnimationMixer(root);
  const clip=root.animations.find(a=>a.name==='burn_loop')??root.animations[0];
  if(clip){const action=mixer.clipAction(clip);action.play();mixer.update(Math.random()*clip.duration);}
  root.updateWorldMatrix(true,true);
  const fire=root.getObjectByName(torch?'fire_12':'fire_2')??root.getObjectByName('root_19');
  const light=new T.PointLight(torch?0xffad55:0xffc477,options?.intensity??(torch?3.2:1.1),options?.distance??(torch?7:4),2);
  if(fire)light.position.copy(root.worldToLocal(fire.getWorldPosition(new T.Vector3())));
  else{const box=new T.Box3().setFromObject(root);light.position.copy(root.worldToLocal(box.getCenter(new T.Vector3()).setY(box.max.y)));}
  // Move the emitter above the flame and out from the mounting wall.
  const scale=root.getWorldScale(new T.Vector3());
  light.position.y+=.10/Math.max(.001,Math.abs(scale.y));
  if(torch)light.position.z+=.18/Math.max(.001,Math.abs(scale.z));
  light.shadow.mapSize.set(256,256);light.shadow.camera.near=.15;light.shadow.camera.far=light.distance||200;
  light.shadow.autoUpdate=false;light.shadow.radius=2;
  light.shadow.bias=-.0008;light.shadow.normalBias=.025;light.visible=false;
  light.name=torch?'Luz da tocha':'Luz da vela';root.add(light);
  root.traverse(child=>{if(child instanceof T.Mesh){child.castShadow=false;child.receiveShadow=true;child.userData.noFireShadow=true;}});
  flames.add({root,mixer,light,fire,fireScale:fire?.scale.clone(),base:light.intensity,street:false,persistent:options?.persistent??false,emitter:options?.emitter});
}
export function addStreetLanternLight(root:T.Group){
  root.updateWorldMatrix(true,true);
  let lamp:T.Mesh|undefined;
  root.traverse(child=>{if(child instanceof T.Mesh){
    child.userData.noFireShadow=true;child.castShadow=false;child.receiveShadow=true;
    if(child.name.includes('Lighting_Effect'))lamp=child;
  }});
  const light=new T.PointLight(0xffbf78,24,13,2);
  const box=new T.Box3().setFromObject(lamp??root);
  light.position.copy(root.worldToLocal(box.getCenter(new T.Vector3())));
  light.visible=false;light.name='Luz da lanterna da rua';root.add(light);
  flames.add({root,mixer:new T.AnimationMixer(root),light,fire:lamp,fireScale:lamp?.scale.clone(),base:24,street:true,persistent:false});
}
export function updateCityFirelights(delta:number,viewer:T.Vector3,_shadowBudget=1,_lightBudget=4,_worldTime=.9){
  const owners=new Map<Flame,T.Group|undefined>(),buildings=new Set<T.Group>();
  for(const flame of flames){const owner=cityLightBuilding(flame.root);owners.set(flame,owner);if(owner)buildings.add(owner);}
  const context=cityLightContext(buildings,viewer);

  for(const flame of flames){
    if(!flame.root.parent||(!(flame.root.parent instanceof T.Scene)&&!flame.root.parent.parent)){flame.mixer.stopAllAction();flame.light.shadow.dispose();flames.delete(flame);continue;}
    const distance=flamePosition.setFromMatrixPosition(flame.root.matrixWorld).distanceToSquared(viewer);
    const owner=owners.get(flame);
    const fixedExterior=flame.street||!!flame.root.userData.fixedExteriorTorch||!!(owner?.userData.palaceComplex&&flame.root.userData.palaceExteriorTorch);
    if(fixedExterior){
      const enabled=!context.inside;
      flame.root.visible=true;delete flame.root.userData.cityDistanceHidden;
      if(flame.fire){flame.fire.visible=enabled;if(enabled)flame.fire.scale.copy(flame.fireScale!);else flame.fire.scale.setScalar(0);}
      flame.light.visible=enabled;flame.light.castShadow=false;
      if(flame.emitter){flame.emitter.visible=false;flame.emitter.intensity=0;}
      if(enabled&&!flame.street&&distance<80*80)flame.mixer.update(delta);
      continue;
    }
    if(flame.emitter){flame.emitter.visible=false;flame.emitter.intensity=0;}
    const enabled=context.enabled(flame.root,owners.get(flame));
    if(flame.fire){
      flame.fire.visible=!!enabled;
      // The imported flames share one skinned mesh with their holders. Hiding
      // a bone alone does not hide its skin, so collapse only the fire rig.
      if(enabled)flame.fire.scale.copy(flame.fireScale!);else flame.fire.scale.setScalar(0);
    }
    if(!enabled){flame.light.visible=false;flame.light.castShadow=false;continue;}
    flame.light.visible=flame.light.intensity>0;flame.light.castShadow=false;
    // Match street lanterns: fixed intensity, without per-frame light animation.
    if(context.inside===owner||distance<80*80)flame.mixer.update(delta);

  }
  // All active fixtures own direct lights. No nearest-light selection or shared limit.
  updateStreetLightingMap(delta,[],0);
}
