import { updateStreetLightingMap } from './CityStreetLightingMap';
import * as T from 'three';

type Flame={root:T.Group;mixer:T.AnimationMixer;light:T.PointLight;base:number;phase:number;shadowElapsed:number;street:boolean;persistent:boolean;emitter?:T.PointLight};
const flames=new Set<Flame>();

const palaceEmitters=new WeakMap<T.Group,Map<string,T.PointLight>>();
type PalaceLight={pack:string;group?:string;persistent?:boolean;intensity?:number;distance?:number};
/** Reserve every persistent palace light in one batch, before asynchronous models arrive.
 * The renderer sees one stable light count instead of recompiling every material for each loaded torch.
 */
export function preparePalaceFirelights(owner:T.Group,placements:PalaceLight[]){
 if(palaceEmitters.has(owner))return;
 const slots=new Map<string,T.PointLight>();
 placements.forEach((p,index)=>{
  if(!(p.persistent??(p.pack==='wall-torch'))||p.intensity===0)return;
  const key=p.group??String(index);if(slots.has(key))return;
  const light=new T.PointLight(0xffad55,0,p.distance??42,2);light.name='Luz permanente do palácio';
  light.castShadow=false;light.visible=true;owner.add(light);slots.set(key,light);
 });
 palaceEmitters.set(owner,slots);
}
export function palaceFirelightEmitter(owner:T.Group,index:number,group?:string){return palaceEmitters.get(owner)?.get(group??String(index));}

// Keep the renderer's light/shadow counts stable as props finish loading.
const emitters:T.PointLight[]=[];
const emitterPosition=new T.Vector3();
const flamePosition=new T.Vector3();
function prepareEmitters(scene:T.Object3D,count:number,shadows:number){
  while(emitters.length<count){
    const light=new T.PointLight(0xffffff,0,1,2);
    light.shadow.mapSize.set(256,256);light.shadow.camera.near=.15;
    light.shadow.autoUpdate=false;light.shadow.radius=2;
    light.shadow.bias=-.0008;light.shadow.normalBias=.025;
    light.name='Emissor compartilhado da cidade';emitters.push(light);
  }
  emitters.forEach((light,i)=>{
    if(light.parent!==scene)scene.add(light);
    light.visible=i<count;light.castShadow=i<shadows;light.intensity=0;
  });
}
export function addCityFirelight(root:T.Group,torch:boolean,options?:{intensity?:number;distance?:number;persistent?:boolean;emitter?:T.PointLight}){
  const mixer=new T.AnimationMixer(root);
  const clip=root.animations.find(a=>a.name==='burn_loop')??root.animations[0];
  if(clip){const action=mixer.clipAction(clip);action.play();mixer.update(Math.random()*clip.duration);}
  root.updateWorldMatrix(true,true);
  const fire=root.getObjectByName(torch?'fire_12':'fire_2');
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
  flames.add({root,mixer,light,base:light.intensity,phase:Math.random()*Math.PI*2,shadowElapsed:1,street:false,persistent:options?.persistent??false,emitter:options?.emitter});
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
  flames.add({root,mixer:new T.AnimationMixer(root),light,base:24,phase:0,shadowElapsed:0,street:true,persistent:false});
}
export function updateCityFirelights(delta:number,viewer:T.Vector3,shadowBudget=1,lightBudget=4,worldTime=.9){
  const nearby:{flame:Flame;distance:number}[]=[];
  for(const flame of flames){
    if(!flame.root.parent?.parent){flame.mixer.stopAllAction();flame.light.shadow.dispose();flames.delete(flame);continue;}
    const distance=flamePosition.setFromMatrixPosition(flame.root.matrixWorld).distanceToSquared(viewer);
    flame.phase+=delta;flame.shadowElapsed+=delta;
    if(flame.base===0){flame.mixer.update(delta);continue;}
    if(flame.persistent){
      // Palace torches illuminate simultaneously, independently of viewer distance and the nearby pool.
      flame.mixer.update(delta);
      const emitter=flame.emitter??flame.light;
      flame.light.visible=emitter===flame.light;
      if(flame.emitter){flame.light.getWorldPosition(emitterPosition);emitter.position.copy(emitter.parent?emitter.parent.worldToLocal(emitterPosition):emitterPosition);}
      emitter.visible=true;emitter.castShadow=false;emitter.color.copy(flame.light.color);emitter.distance=flame.light.distance;
      emitter.intensity=flame.base*(1+.07*Math.sin(flame.phase*9)+.035*Math.sin(flame.phase*17));
      continue;
    }
    flame.light.visible=false;flame.light.castShadow=false;
    if(flame.root.userData.alwaysLit){
      // Flames keep burning; only the nearest emitters spend the shared light budget.
      if(distance<35*35)flame.mixer.update(delta);
      const reach=Math.max(25,flame.light.distance+10);
      if(flame.light.distance===0||distance<reach*reach)nearby.push({flame,distance});
      continue;
    }
    const night=1-T.MathUtils.smoothstep(Math.sin((worldTime-.25)*Math.PI*2),-.15,.15);
    if(flame.street&&night<=.01)continue;
    if(flame.light.distance===0||distance<(flame.street?90*90:50*50)){if(distance<25*25)flame.mixer.update(delta);nearby.push({flame,distance});}
  }
  const night=1-T.MathUtils.smoothstep(Math.sin((worldTime-.25)*Math.PI*2),-.15,.15);
  updateStreetLightingMap(delta,[...flames].filter(f=>f.street),night);
  nearby.sort((a,b)=>a.distance*(a.flame.root.userData.firePriority ? .1 : 1)-b.distance*(b.flame.root.userData.firePriority ? .1 : 1));
  // Every candle keeps its visible flame and animation. A chandelier's combined
  // room light occupies one shared emitter instead of spending the budget six times.
  const groups=new Set<string>();
  const sources=nearby.filter(({flame})=>{
    const group=flame.root.userData.fireGroup as string|undefined;
    if(!group)return true;if(groups.has(group))return false;groups.add(group);return true;
  });
  const first=flames.values().next().value as Flame|undefined;
  if(!first)return;
  let scene:T.Object3D=first.root;while(scene.parent)scene=scene.parent;
  prepareEmitters(scene,lightBudget,shadowBudget);
  for(let i=0;i<Math.min(lightBudget,sources.length);i++){
    const {flame}=sources[i],light=emitters[i];
    flame.light.getWorldPosition(emitterPosition);light.position.copy(emitterPosition);
    light.color.copy(flame.light.color);light.distance=flame.light.distance;
    const shadowFar=light.distance||200;
    if(light.shadow.camera.far!==shadowFar){light.shadow.camera.far=shadowFar;light.shadow.camera.updateProjectionMatrix();}
    const previousSource=light.userData.source;
    if(light.castShadow&&(previousSource!==flame||flame.shadowElapsed>=.2)){
      light.shadow.needsUpdate=true;flame.shadowElapsed=0;
    }
    light.userData.source=flame;
    light.intensity=flame.street?flame.base*night:flame.base*(1+.07*Math.sin(flame.phase*9)+.035*Math.sin(flame.phase*17));
  }
}
