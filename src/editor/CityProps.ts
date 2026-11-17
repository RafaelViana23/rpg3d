import {createCityBeerBarrel} from './CityBeerBarrel';
import {createCityTavernBooth} from './CityTavernBooth';
import {createCityTavernChandelier} from './CityTavernChandelier';
import {configureCityChandelierLight} from './CityChandelierLight';
import {createCityRoundTable} from './CityRoundTable';
import {createCityWagon} from './CityWagon';
import {createCityWheelbarrow} from './CityWheelbarrow';
import {createCityMarketStall,type MarketVariant} from './CityMarketStall';
import {createCityFountain} from './CityFountain';
import {circularMarketStalls,marketStallWorkstation} from './CentralPlazaLayout';
import {createCityPlazaGardens} from './CityPlazaGardens';
import {createCityBucket} from './CityBucket';
import {createCityBarrel} from './CityBarrel';
import {createCityPottedPlant} from './CityPottedPlant';
import {createCityWoodFloor} from './CityWoodFloor';
import {createCityStreetLantern} from './CityStreetLantern';
import {createCityCurtain} from './CityCurtain';
import {createCityChair} from './CityChair';
import {createCityChurchDoor,createCityVillageDoor} from './CityChurchDoor';
import {registerCityInteriorProp} from './CityInteriorStreaming';
import {createCityWindow} from './CityWindow';
import {appendRoyalTimberTable,createRoyalTimberTable} from './RoyalTimberTable';
import {addInteractiveRoyalChest} from './RoyalRoomDetails';
import {applyUniformFruit} from './UniformFruit';
import {placeRoyalKitchenStorage} from './RoyalKitchenStorage';
import { cityPointIsIndoors } from './CityLightInteriors';
import { createRoyalStyleBed } from './RoyalStyleBed';
import { cityBedAnchor } from './CitySleeping';
import { addCityShopDisplays } from './CityShopDisplays';
import { waitForCityPropSlot, waitForCityLightSlot, waitForCityInteriorSlot, loadCityInteriorProp } from './CityPropLoading';
import { TAVERN_BOTTLES } from './TavernBottles';
import { fitStorageWithoutOverlap } from './CityStoragePlacement';
import { applyCityWood, CITY_WOOD_MATERIAL } from './CityWood';
import { addCityCounter } from './CityCounter';
import { CITY_WINDOW_WIDTH, CITY_WINDOW_HEIGHT, CITY_WINDOW_DEPTH, CITY_WINDOW_OFFSET } from './CityWindowLayout';
import { cityRandom, facadeProfile } from './CityVariation';
import { scheduleCityPropBatch } from './CityPropBatching';
import { registerChurchDoor, registerVillageDoor } from './ChurchDoors';
import * as T from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {preparePalaceFirelights,palaceFirelightEmitter, addCityFirelight } from './CityFirelight';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

const loader=new GLTFLoader();
const packs=new Map<string,Promise<GLTF>>();
const pieces=new Map<string,Promise<T.Group>>();
let windowTemplate:T.Group|undefined;
const cityWindowTemplate=()=>windowTemplate??=createCityWindow();
const bedroomRugMaterials={
  border:new T.MeshLambertMaterial({color:'#c3a46a'}),
  field:new T.MeshLambertMaterial({color:'#743947'}),
  pattern:new T.MeshLambertMaterial({color:'#d4bd8d'}),
};
const tavernFacadeMaterials={
  roof:new T.MeshLambertMaterial({color:'#9b4538'}),
  canvas:new T.MeshLambertMaterial({color:'#ead8b5',side:T.DoubleSide}),
  red:new T.MeshLambertMaterial({color:'#b64a3f',side:T.DoubleSide}),
  banner:new T.MeshLambertMaterial({color:'#6550a1',side:T.DoubleSide}),
};
function addTavernFacade(building:T.Group,info:{width:number;depth:number;height:number}){
  const root=new T.Group();root.name='Fachada da taverna da referência';root.userData.cityObject=true;root.userData.sharedCityGeometry=true;
  const mesh=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,rx=0,ry=0)=>{const value=new T.Mesh(g,m);value.position.set(x,y,z);value.rotation.set(rx,ry,0);value.castShadow=value.receiveShadow=true;root.add(value);return value;};
  const beam=(x:number,y:number,z:number,w:number,h:number,d:number)=>mesh(new T.BoxGeometry(w,h,d),CITY_WOOD_MATERIAL,x,y,z);
  const awning=(cx:number)=>{
    const width=7.2,depth=1.75,front=info.depth/2+.95;
    mesh(new T.BoxGeometry(width,.16,depth),tavernFacadeMaterials.roof,cx,3.35,front,-.12,0);
    const stripe=width/6;
    for(let i=0;i<6;i++)mesh(new T.BoxGeometry(stripe-.025,.025,depth+.03),i%2?tavernFacadeMaterials.canvas:tavernFacadeMaterials.red,cx-width/2+stripe*(i+.5),3.45,front,-.12,0);
    for(const x of [-width/2+.2,width/2-.2]){beam(cx+x,1.7,front,.22,3.3,.22);beam(cx+x,3.25,front,.36,.18,.36);}
  };
  awning(-10);awning(10);
  const porchZ=info.depth/2+1.05;
  beam(0,2.25,porchZ,5.6,.28,.35);beam(-2.55,2.35,porchZ,.3,3.7,.3);beam(2.55,2.35,porchZ,.3,3.7,.3);
  mesh(new T.BoxGeometry(6.2,.22,2.2),tavernFacadeMaterials.roof,0,4.05,porchZ,-.32,0);
  beam(0,4.05,porchZ-.45,5.8,.22,.22);
  mesh(new T.BoxGeometry(.18,1.35,.18),CITY_WOOD_MATERIAL,-1.55,3.45,porchZ-.42,-.55,0);
  mesh(new T.BoxGeometry(.18,1.35,.18),CITY_WOOD_MATERIAL,1.55,3.45,porchZ-.42,.55,0);
  for(const x of [-6.5,6.5]){
    mesh(new T.BoxGeometry(1.15,2.3,.06),tavernFacadeMaterials.banner,x,4.55,info.depth/2+.39);
    beam(x,5.75,info.depth/2+.38,.9,.12,.12);
  }
  building.add(root);
}

export function loadCityPropTemplate(pack:string,name=""){
  const key=`${pack}:${name}`;
  if(pack==='bed'){let bed=pieces.get(key);if(!bed){bed=Promise.resolve(createRoyalStyleBed());pieces.set(key,bed);}return bed;}
  if(pack==='village-window'){let window=pieces.get(key);if(!window){window=Promise.resolve(cityWindowTemplate());pieces.set(key,window);}return window;}
  if(pack==='church-door'){let door=pieces.get(key);if(!door){door=Promise.resolve(createCityChurchDoor());pieces.set(key,door);}return door;}
  if(pack==='village-door'){let door=pieces.get(key);if(!door){door=Promise.resolve(createCityVillageDoor());pieces.set(key,door);}return door;}
  if(pack==='chair'){let chair=pieces.get(key);if(!chair){chair=Promise.resolve(createCityChair());pieces.set(key,chair);}return chair;}
  if(pack==='royal-timber-table'){let table=pieces.get(key);if(!table){table=Promise.resolve(createRoyalTimberTable());pieces.set(key,table);}return table;}
  if(pack==='curtain'){let curtain=pieces.get(key);if(!curtain){curtain=Promise.resolve(createCityCurtain());pieces.set(key,curtain);}return curtain;}
  if(pack==='street-lantern'){let lantern=pieces.get(key);if(!lantern){lantern=Promise.resolve(createCityStreetLantern());pieces.set(key,lantern);}return lantern;}
  if(pack==='wood-floor'){let floor=pieces.get(key);if(!floor){floor=createCityWoodFloor();pieces.set(key,floor);}return floor;}
  if(pack==='potted-plant'){let plant=pieces.get(key);if(!plant){plant=Promise.resolve(createCityPottedPlant());pieces.set(key,plant);}return plant;}
  if(pack==='farm'&&name==='Barrel'){let barrel=pieces.get(key);if(!barrel){barrel=Promise.resolve(createCityBarrel());pieces.set(key,barrel);}return barrel;}
  if(pack==='farm'&&name==='Bucket'){let bucket=pieces.get(key);if(!bucket){bucket=Promise.resolve(createCityBucket());pieces.set(key,bucket);}return bucket;}
  if(pack==='medieval-market'&&['Stand_Vegetables','Stand_Tools','Stand_Meat'].includes(name)){let stall=pieces.get(key);if(!stall){stall=Promise.resolve(createCityMarketStall(name as MarketVariant));pieces.set(key,stall);}return stall;}
  if(pack==='wagon'){let wagon=pieces.get(key);if(!wagon){wagon=Promise.resolve(createCityWagon());pieces.set(key,wagon);}return wagon;}
  if(pack==='wheelbarrow'){let cart=pieces.get(key);if(!cart){cart=Promise.resolve(createCityWheelbarrow());pieces.set(key,cart);}return cart;}
  if(pack==='fountain'){let fountain=pieces.get(key);if(!fountain){fountain=Promise.resolve(createCityFountain());pieces.set(key,fountain);}return fountain;}
  if(pack==='tavern-interior'&&name==='table1'){let table=pieces.get(key);if(!table){table=Promise.resolve(createCityRoundTable());pieces.set(key,table);}return table;}
  if(pack==='tavern-booth'){let seat=pieces.get(key);if(!seat){seat=Promise.resolve(createCityTavernBooth(name==='corner-front'?3.8:2.6,name.startsWith('corner-')?1.1:.85));pieces.set(key,seat);}return seat;}
  if(pack==='tavern-interior'&&name==='barrelCrane'){let barrel=pieces.get(key);if(!barrel){barrel=Promise.resolve(createCityBeerBarrel());pieces.set(key,barrel);}return barrel;}
  let pending=pieces.get(key);
  if(!pending){
    let loaded=packs.get(pack);
    if(!loaded){loaded=loader.loadAsync(pack==='fish'?'/models/animals/trout/model.glb':`/models/city/props/${pack}.glb`);packs.set(pack,loaded);}
    pending=loaded.then(gltf=>{
      applyCityWood(gltf.scene,pack);
      if(pack==='apple'||pack==='grapes')applyUniformFruit(gltf.scene,pack);
      gltf.scene.updateMatrixWorld(true);
      const source=name?gltf.scene.getObjectByName(T.PropertyBinding.sanitizeNodeName(name)):gltf.scene;
      if(!source)throw new Error(`Peça ausente: ${key}`);
      if(gltf.animations.length){
        // Preserve the skin, bones and animation targets of the supplied flames.
        const template=new T.Group(),model=cloneSkeleton(source);template.add(model);
        model.updateMatrixWorld(true);
        model.traverse(child=>{if(child instanceof T.SkinnedMesh)child.skeleton.update();});
        const box=new T.Box3().setFromObject(model,true),center=box.getCenter(new T.Vector3());
        model.position.sub(new T.Vector3(center.x,box.min.y,center.z));
        template.animations=gltf.animations;
        return template;
      }
      // Bake the complete export transform, including the pack's axis conversion.
      const template=new T.Group();
      source.traverse(child=>{
        if(!(child instanceof T.Mesh))return;
        const geometry=child.geometry.clone().applyMatrix4(child.matrixWorld);
        const mesh=new T.Mesh(geometry,child.material);mesh.name=child.name;
        // Small imported decorations do not cast into the city shadow map. They
        // still receive shadows, while architectural shells and animated doors
        // keep their existing shadow behavior in their dedicated paths.
        mesh.castShadow=false;mesh.receiveShadow=true;template.add(mesh);
      });
      const box=new T.Box3().setFromObject(template),center=box.getCenter(new T.Vector3());
      for(const child of template.children)child.position.set(-center.x,-box.min.y,-center.z);
      return template;
    });pieces.set(key,pending);
  }
  return pending;
}
/** The royal entrance uses the church's animated oval door at monumental scale. */
export function addRoyalPalaceDoor(building:T.Group){
  preparePalaceFirelights(building,building.userData.palaceLightPlacements??[]);
  if(building.userData.royalKitchen){
    const room=building.userData.royalKitchen,position=new T.Vector3(room.x,room.y,room.z);
    void waitForCityInteriorSlot(building,position,true).then(()=>Promise.all([loadCityPropTemplate('box-low-poly'),loadCityPropTemplate('farm','Barrel'),loadCityPropTemplate('royal-timber-table'),...TAVERN_BOTTLES.map(pack=>loadCityPropTemplate(pack))])).then(async ([crate,barrel,table,...bottles])=>{
      await waitForCityInteriorSlot(building,position);if(building.parent)placeRoyalKitchenStorage(building,crate,barrel,{table,bottles});
    }).catch(error=>console.error('Não foi possível organizar a despensa real',error));
  }

  for(const placement of building.userData.palacePropPlacements??[])void loadCityInteriorProp(building,new T.Vector3(placement.x,placement.y,placement.z),()=>loadCityPropTemplate(placement.pack,placement.piece??'')).then(async template=>{
    if(!building.parent)return;
    const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
    prop.scale.setScalar(placement.height/Math.max(.001,size.y));prop.position.set(placement.x,placement.y,placement.z);prop.rotation.y=placement.rotation;
    if(placement.horizontalScale){prop.scale.x*=placement.horizontalScale;prop.scale.z*=placement.horizontalScale;}
    prop.name=placement.label;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
    prop.userData.assetSource=`/models/city/props/${placement.pack}.glb`;
    const room=placement.room?building.userData[placement.room]:building.userData.princessBedroom;
    const area=new T.Box2(new T.Vector2(room.x-room.width/2+.05,room.z-room.depth/2+.05),new T.Vector2(room.x+room.width/2-.05,room.z+room.depth/2-.05));
    if(!fitStorageWithoutOverlap(building,prop,[building],area)){console.warn(`Sem espaço para ${placement.label}`);return;}
    prop.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(prop,true);
    if(placement.water&&!prop.userData.containsWater){
      const radius=Math.min(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)*.32;
      const surface=new T.Mesh(new T.CircleGeometry(radius,24),new T.MeshStandardMaterial({color:'#72a7b4',transparent:true,opacity:.8,roughness:.22,metalness:.08,side:T.DoubleSide,depthWrite:false}));
      surface.rotation.x=-Math.PI/2;
      surface.position.set((bounds.min.x+bounds.max.x)/2,bounds.min.y+(bounds.max.y-bounds.min.y)*.52,(bounds.min.z+bounds.max.z)/2);
      surface.name='Água do balde';building.add(surface);registerCityInteriorProp(building,surface);
    }
    const fruit=placement.pack==='apple'||placement.pack==='grapes';
    if(!fruit)building.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
    if(fruit){prop.userData.batchableCityProp=true;prop.userData.inventoryItemId=placement.pack;}
    building.add(prop);registerCityInteriorProp(building,prop);if(fruit)scheduleCityPropBatch(building);
    building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
  }).catch(error=>console.error('Não foi possível carregar objeto do palácio',error));

  for(const [lightIndex,placement] of (building.userData.palaceLightPlacements??[]).entries())void waitForCityLightSlot(building,new T.Vector3(placement.x,placement.y,placement.z)).then(()=>loadCityPropTemplate(placement.pack)).then(template=>{
    if(!building.parent)return;
    const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
    prop.scale.setScalar(placement.height/Math.max(.001,size.y));prop.position.set(placement.x,placement.y,placement.z);prop.rotation.y=placement.rotation;
    prop.name=placement.pack==='candle'?'Vela do palácio':placement.pack==='tavern-fire'?'Fogo da lareira real':'Tocha do palácio';
    prop.userData.palaceExteriorTorch=placement.pack==='wall-torch'&&!cityPointIsIndoors(building,prop.position);
    prop.userData.cityObject=true;prop.userData.alwaysLit=true;prop.userData.sharedCityGeometry=true;
    if(placement.group){prop.userData.fireGroup=`${building.uuid}:${placement.group}`;prop.userData.firePriority=true;}
    building.add(prop);registerCityInteriorProp(building,prop);addCityFirelight(prop,placement.pack==='wall-torch'||placement.pack==='tavern-fire',{intensity:placement.intensity,distance:placement.distance,persistent:placement.persistent??placement.pack==='wall-torch',emitter:palaceFirelightEmitter(building,lightIndex,placement.group)});
    if(placement.emitterOffset){
      const light=prop.getObjectByName('Luz da vela');
      if(light){
        prop.updateWorldMatrix(true,true);
        const [dx,dy,dz]=placement.emitterOffset;
        light.position.copy(prop.worldToLocal(building.localToWorld(new T.Vector3(placement.x+dx,placement.y+dy,placement.z+dz))));
      }
    }
  }).catch(error=>console.error('Não foi possível carregar iluminação do palácio',error));

  for(const opening of building.userData.royalRoomDoors??[])void loadCityPropTemplate('village-door').then(template=>{
    if(!building.parent)return;
    const prop=cloneSkeleton(template) as T.Group;
    const size=new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
    prop.scale.set(opening.width/Math.max(.001,size.x),opening.height/Math.max(.001,size.y),1);
    prop.rotation.y=Math.PI/2;prop.position.set(opening.x,opening.y,opening.z);
    // Mount on the room-side face of the masonry, with clearance for the leaf thickness.
    if(opening.wallDepth)prop.position.x+=Math.sign(opening.x)*(opening.wallDepth/2+size.z/2+.03);
    prop.name=opening.label;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
    prop.traverse(child=>{if(child instanceof T.Mesh)child.castShadow=child.receiveShadow=true;});
    building.add(prop);registerVillageDoor(building,prop,opening);
  }).catch(error=>console.error('Não foi possível carregar porta do quarto real',error));
  void loadCityPropTemplate('church-door').then(template=>{
    if(!building.parent)return;
    const opening=building.userData.royalGate;if(!opening)return;
    const prop=cloneSkeleton(template) as T.Group;
    prop.animations=template.animations;
    const size=new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
    prop.scale.setScalar(opening.height/Math.max(.001,size.y));
    prop.scale.x=opening.width/Math.max(.001,size.x);
    prop.position.set(0,opening.y,opening.z);prop.name='Portão oval do palácio';prop.userData.alwaysVisibleCityGate=true;
    prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
    prop.userData.assetSource='code:CityChurchDoor';
    prop.traverse(child=>{if(child instanceof T.Mesh)child.castShadow=child.receiveShadow=true;});
    building.add(prop);registerChurchDoor(building,prop,opening);
  }).catch(error=>console.error('Não foi possível carregar o portão do palácio',error));
}
export function setCityWallGateInward(prop:T.Group,inwardSign:number){
  const offset=prop.userData.wallGateClosedOffset??={x:prop.position.x,z:prop.position.z};
  // The imported animation swings toward -Z. Turn the complete fitted model
  // around its centered opening when the city interior is on its +Z side.
  const turn=inwardSign>0;
  prop.rotation.y=turn?Math.PI:0;prop.position.x=offset.x*(turn?-1:1);prop.position.z=offset.z*(turn?-1:1);
  prop.updateMatrixWorld(true);
}
export function createCityWallGateDoor(_template:T.Group,openingWidth=6.1,doorHeight=7.6){
  // Generate the approved procedural leaves at their final dimensions. The
  // hinge bones then animate geometry with no nonuniform parent scale.
  const prop=createCityChurchDoor(openingWidth,doorHeight);
  const bounds=new T.Box3().setFromObject(prop,true);
  prop.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
  prop.updateMatrixWorld(true);
  setCityWallGateInward(prop,1);
  prop.name='Portão da cidade';prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
  prop.userData.alwaysVisibleCityGate=true;prop.userData.assetSource='code:CityChurchDoor';
  prop.traverse(child=>{if(child instanceof T.Mesh)child.castShadow=child.receiveShadow=true;});
  return prop;
}
/** One fixture on each solid flank, attached to the saved gate transform. */
export function cityWallGateTorchSites(building:T.Group){
  const scale=building.getWorldScale(new T.Vector3());
  const floor=building.userData.wallGateFloorY??0;
  return [-1,1].map(side=>new T.Vector3(side*4.2,floor+2.7/Math.abs(scale.y),1.4));
}
export function addCityWallGateTorches(building:T.Group){
  void loadCityPropTemplate('wall-torch').then(template=>{
    if(!building.parent)return;
    const size=new T.Box3().setFromObject(template,true).getSize(new T.Vector3());
    const scale=building.getWorldScale(new T.Vector3()),factor=1.5/Math.max(.001,size.y);
    for(const position of cityWallGateTorchSites(building)){
      const prop=cloneSkeleton(template) as T.Group;
      prop.scale.set(factor/Math.abs(scale.x),factor/Math.abs(scale.y),factor/Math.abs(scale.z));
      prop.position.copy(position);prop.position.z+=size.z*prop.scale.z/2+.02;
      prop.name='Tocha fixa lateral do portão';prop.userData.cityObject=true;
      prop.userData.fixedExteriorTorch=true;prop.userData.alwaysVisibleCityGate=true;
      prop.userData.sharedCityGeometry=true;prop.userData.assetSource='/models/city/props/wall-torch.glb';
      building.add(prop);addCityFirelight(prop,true,{intensity:95,distance:20,persistent:true});
    }
  }).catch(error=>console.error('Não foi possível carregar tochas do portão',error));
}
export function addCityWallGateDoor(building:T.Group){
  void loadCityPropTemplate('church-door').then(template=>{
    if(!building.parent)return;
    const openingWidth=building.userData.wallGateOpeningWidth??6.2,doorHeight=building.userData.wallGateDoorHeight??7.6;
    const prop=createCityWallGateDoor(template,openingWidth-.1,doorHeight);building.add(prop);
    building.userData.setWallGateInward=(sign:number)=>setCityWallGateInward(prop,sign);
    building.userData.setWallGateInward(building.userData.wallGateInwardSign??1);
    const opening={y:0,z:0,width:openingWidth,height:doorHeight+.1,label:'portão da muralha'};
    registerChurchDoor(building,prop,opening);
    const collider=building.userData.localColliders.at(-1) as number[];
    const originalY=prop.position.y,originalScaleY=prop.scale.y;
    const setFloor=(floorY:number)=>{
      // Keep the arch crown fixed; the door threshold rests on city paving.
      const floor=T.MathUtils.clamp(floorY,0,doorHeight-.1),ratio=(doorHeight-floor)/doorHeight;
      prop.scale.y=originalScaleY*ratio;prop.position.y=originalY*ratio+floor;
      opening.y=floor;opening.height=doorHeight+.1-floor;collider[1]=floor;
      building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
    };
    building.userData.setWallGateFloor=setFloor;
    setFloor(building.userData.wallGateFloorY??0);
  }).catch(error=>console.error('Não foi possível carregar portão da muralha',error));
}
export function addCityFacadeWindows(building:T.Group){
  if(building.userData.cityFacadeWindows)return;
  building.userData.cityFacadeWindows=true;
  const rawKind=building.name.slice('Cidade:'.length);
  const windowList=(building.userData.windows??[]) as Array<{x:number;y:number;z:number;rotation:number}>;
  for(const window of windowList){
    const {x,y,z,rotation}=window,normalX=Math.sin(rotation),normalZ=Math.cos(rotation);
    const frame=cityWindowTemplate().clone(true),frameBounds=new T.Box3().setFromObject(frame),frameSize=frameBounds.getSize(new T.Vector3());
    frame.scale.set(CITY_WINDOW_WIDTH/frameSize.x,CITY_WINDOW_HEIGHT/frameSize.y,CITY_WINDOW_DEPTH/frameSize.z);
    frame.position.set(x+normalX*CITY_WINDOW_OFFSET,y-CITY_WINDOW_HEIGHT/2,z+normalZ*CITY_WINDOW_OFFSET);frame.rotation.y=rotation;
    frame.name='Objeto medieval: village-window';frame.userData.cityObject=true;frame.userData.sharedCityGeometry=true;frame.userData.assetSource='procedural:city-window';
    building.add(frame);
    const curtain=createCityCurtain(),curtainBounds=new T.Box3().setFromObject(curtain),curtainSize=curtainBounds.getSize(new T.Vector3());
    curtain.scale.set(2.15/curtainSize.x,2.2/curtainSize.y,.18/curtainSize.z);
    curtain.position.set(x-normalX*.4,y-1.1,z-normalZ*.4);curtain.rotation.y=rotation+Math.PI;
    curtain.name=`Cortina da ${rawKind}`;curtain.userData.cityObject=true;curtain.userData.sharedCityGeometry=true;
    building.add(curtain);
  }
}

export function addCityProps(building:T.Group,index:number){
  if(building.name==='Cidade:fountain'){addCityFountain(building);return;}
  if(building.name==='Cidade:market'){addMarketStalls(building,index);return;}
  const info=building.userData.building;if(!info)return;
  if(building.userData.woodFloorSurfaces?.length)addWoodFloors(building);
  // Each saved building owns its own collider array; templates remain immutable.
  building.userData.localColliders=(building.userData.localColliders as number[][]).map(b=>[...b]);
  const mountChandelierCandles=(chandelier:T.Group,count:number,radius:number,base:number,height:number,roomHeight:number)=>{
    void loadCityInteriorProp(building,chandelier.position,()=>loadCityPropTemplate('candle')).then(template=>{
      if(!building.parent)return;
      for(let i=0;i<count;i++){
        const candle=cloneSkeleton(template) as T.Group;
        candle.animations=template.animations;
        const bounds=new T.Box3().setFromObject(candle),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
        const scale=height/Math.max(.001,size.y),angle=i*Math.PI*2/count;
        candle.scale.setScalar(scale);
        candle.position.set(Math.cos(angle)*radius-center.x*scale,base-bounds.min.y*scale,Math.sin(angle)*radius-center.z*scale);
        candle.name='Vela do lustre';candle.userData.cityObject=true;candle.userData.sharedCityGeometry=true;
        candle.userData.assetSource='/models/city/props/candle.glb';
        chandelier.add(candle);
        // Keep the existing single constant emitter for each chandelier.
        addCityFirelight(candle,false,{intensity:0});
        const light=candle.getObjectByName('Luz da vela') as T.PointLight;
        if(i===0){
          configureCityChandelierLight(light,building,roomHeight);
          chandelier.updateWorldMatrix(true,true);light.position.copy(candle.worldToLocal(chandelier.localToWorld(new T.Vector3(0,.8,0))));
        }
      }
    }).catch(error=>console.error('Não foi possível carregar velas do lustre',error));
  };
  const put=(pack:string,name:string,height:number,x:number,z:number,y=.08,rotation=0,diameterScale=1)=>{
    // Tavern lighting comes from candles and the hearth; no wall torches.
    if(pack==='wall-torch'&&kind==='tavern')return;
    // Exterior building torches were removed; keep only interior fixtures.
    if(pack==='wall-torch'&&(Math.abs(x)>=info.width/2||Math.abs(z)>=info.depth/2))return;
    const door=pack==='church-door'||pack==='village-door';
    const local=new T.Vector3(x,y,z);
    const ready=door
      ?loadCityPropTemplate(pack,name).then(async template=>{await waitForCityPropSlot(building);return template;})
      :loadCityInteriorProp(building,local,()=>loadCityPropTemplate(pack,name));
    void ready.then(template=>{
      if(!building.parent)return;
      const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop).getSize(new T.Vector3());
      prop.scale.setScalar(height/Math.max(.001,size.y));
      prop.scale.x*=diameterScale;prop.scale.z*=diameterScale;
      if(pack==='church-door'||pack==='village-door')prop.scale.x=info.doorWidth/Math.max(.001,size.x);prop.position.set(x,y,z);prop.rotation.y=rotation;
      prop.name=`Objeto medieval: ${name||pack}`;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
      prop.userData.assetSource=pack==='village-door'?'procedural:city-village-door':`/models/city/props/${pack}.glb`;
      if((pack==='box-low-poly'||pack==='wagon'||(pack==='farm'&&['Barrel','Bucket','Box'].includes(name)))&&!fitStorageWithoutOverlap(building,prop))return;
      // Compute the collider before parenting to keep it in building space.
      prop.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(prop);
      if(pack!=='tavern-fire'&&pack!=='church-door'&&!(pack==='village-door'&&info.enterable))building.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
      if(pack==='altar')building.userData.npcAltar={z:bounds.min.z-.65};
      if(pack==='tavern-interior'&&name==='barCounter')building.userData.npcCounter={x:bounds.min.x-.65,y:.08,z:(bounds.min.z+bounds.max.z)/2};
      if(pack==='church-door')registerChurchDoor(building,prop);
      if(pack==='village-door'&&info.enterable)registerVillageDoor(building,prop);
      if(pack==='wall-torch'&&building.name==='Cidade:church'&&Math.abs(x)<3&&z<-info.depth*.45)prop.userData.firePriority=true;
      if(pack==='wall-torch'&&building.name==='Cidade:church')prop.userData.alwaysLit=true;
      if(pack==='tavern-fire'){prop.userData.alwaysLit=true;prop.userData.firePriority=true;addCityFirelight(prop,true);}
      if(pack==='candle'||pack==='wall-torch'){prop.userData.alwaysLit=true;addCityFirelight(prop,pack==='wall-torch',building.userData.innArchitecture?{intensity:pack==='wall-torch'?45:12,distance:pack==='wall-torch'?12:7}:undefined);}
      prop.userData.batchableCityProp=prop.animations.length===0&&pack!=='potion'&&pack!=='magic-potion';
      if(pack==='potion'||pack==='magic-potion')prop.userData.inventoryItemId=pack==='magic-potion'?'magic-potion':'hp-potion';
      if(building.name==='Cidade:tavern'&&pack==='chair'){
        // Keep seat anchors before static prop batching removes the source mesh.
        const seats=building.userData.npcSeats??(building.userData.npcSeats=[]);
        seats.push({x,z,y:bounds.min.y+size.y*prop.scale.y*.47,rotation});
      }
      building.add(prop);if(!door)registerCityInteriorProp(building,prop);scheduleCityPropBatch(building);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar objeto medieval',error));
  };
  const w=info.width,d=info.depth,rawKind=building.name.slice('Cidade:'.length),kind=rawKind==='wood-house'?'house':rawKind;
  if(kind!=='church')put('village-door','',info.doorHeight,0,d/2+.12,0);
  // Fit supplied static props in building coordinates, keeping stairs walkable.
  const fitted=(pack:string,width:number,height:number,depth:number,x:number,y:number,z:number,rotation=0,solid=false,checkStorage=false)=>{
    const place=(template:T.Group)=>{
      const prop=template.clone(true),size=new T.Box3().setFromObject(prop).getSize(new T.Vector3());
      prop.scale.set(width/size.x,height/size.y,depth/size.z);prop.position.set(x,y,z);prop.rotation.y=rotation;
      prop.name=`Objeto medieval: ${pack}`;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
      prop.userData.assetSource=pack==='bed'?'procedural:royal-style-bed':pack==='royal-timber-table'?'procedural:royal-timber-table':pack==='village-window'?'procedural:city-window':`/models/city/props/${pack}.glb`;prop.userData.batchableCityProp=true;
      const room=building.userData.upperBedroom;
      const area=room&&Math.abs(y-room.y)<.01?new T.Box2(new T.Vector2(room.x-room.width/2+.2,room.z-room.depth/2+.2),new T.Vector2(room.x+room.width/2-.2,room.z+room.depth/2-.2)):undefined;
      if(checkStorage&&!fitStorageWithoutOverlap(building,prop,[building],area)){
        console.warn(`Sem espaço para ${pack} em ${building.name}`);return;
      }
      if(pack==='bed'){prop.userData.cityBedAnchor=cityBedAnchor(prop,size);if(!building.userData.innArchitecture)building.userData.npcBed=prop.userData.cityBedAnchor;}
      if(solid){prop.updateMatrixWorld(true);const b=new T.Box3().setFromObject(prop);building.userData.localColliders.push([...b.min.toArray(),...b.max.toArray()]);}
      building.add(prop);
      if(pack!=='curtain'){
        registerCityInteriorProp(building,prop);
        scheduleCityPropBatch(building);
      }
      building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
      return prop;
    };
    // Facade geometry is ready before this building is parented to the scene.
    // Procedural windows must not wait behind downloaded furniture in the queue.
    if(pack==='village-window')return Promise.resolve(place(cityWindowTemplate()));
    const local=new T.Vector3(x,y,z);
    const ready=pack==='curtain'
      ?loadCityPropTemplate(pack)
      :pack==='bed'
      ?loadCityPropTemplate(pack).then(async template=>{await waitForCityPropSlot(building);return template;})
      :loadCityInteriorProp(building,local,()=>loadCityPropTemplate(pack));
    return ready.then(template=>place(template))
      .catch(error=>console.error(`Não foi possível carregar ${pack}`,error));
  };
  if(building.userData.innArchitecture){
    const rooms=building.userData.innRooms as import('./SelenaInn').InnRoom[];
    for(const room of rooms){
      const {x,z,y,width}=room;
      for(let i=0;i<room.beds;i++){
        const bx=room.beds===1?x:x+(i===0?-1:1)*width*.25;
        void fitted('bed',room.vip?4:3.3,1.5,room.vip?3.6:2.8,bx,y,-info.depth/2+.225+(room.vip?4:3.3)/2,-Math.PI/2,true).then(bed=>{
          if(!bed)return;
          const anchor=bed.userData.cityBedAnchor;
          if(room.owner==='Selena')building.userData.npcBed=anchor;
          else (building.userData.innGuestBeds??=[]).push(anchor);
        });
        // One chest per bed; the door is on +Z, beyond the foot of each bed.
        const chestZ=-info.depth/2+.225+(room.vip?4:3.3)+.35+(1.4*.7)/2;
        const chest=addInteractiveRoyalChest(building,y,bx,chestZ,(cx,cz,cw,ch,cd)=>building.userData.localColliders.push([cx-cw/2,y,cz-cd/2,cx+cw/2,y+ch,cz+cd/2]),Math.PI);
        registerCityInteriorProp(building,chest);
        building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
      }
      // Keep the chair against the right wall, facing inward, with the doorway clear.
      fitted('chair',.75,1.1,.75,x+width/2-.465,y,-2.3,-Math.PI/2,true);
      const rugWidth=Math.min(width-1,5),rugDepth=Math.min(room.depth-1,3);
      const rug=new T.Mesh(new T.BoxGeometry(rugWidth,.015,rugDepth),bedroomRugMaterials.field);
      rug.position.set(x,y+.02,z);rug.receiveShadow=true;rug.userData.cityObject=true;rug.userData.sharedCityGeometry=true;building.add(rug);registerCityInteriorProp(building,rug);
    }
    const doorPlacements=[...rooms.map(room=>({x:room.x,z:0,y:room.y,width:1.8,height:3.4,label:room.owner==='Selena'?'porta do quarto da Selena':room.vip?'porta da suíte nobre':`porta do ${room.name.toLowerCase()}`})),{...building.userData.innOffice,label:'porta do escritório da Selena'}];
    for(const opening of doorPlacements)void loadCityPropTemplate('village-door').then(async template=>{
      await waitForCityPropSlot(building);if(!building.parent)return;
      const door=cloneSkeleton(template) as T.Group;
      const bounds=new T.Box3().setFromObject(door),size=bounds.getSize(new T.Vector3());
      door.scale.set(opening.width/size.x,opening.height/size.y,.18/size.z);
      door.position.set(opening.x-(bounds.min.x+bounds.max.x)/2*door.scale.x,opening.y-bounds.min.y*door.scale.y,opening.z-(bounds.min.z+bounds.max.z)/2*door.scale.z);
      door.name=opening.label;door.userData.cityObject=true;door.userData.sharedCityGeometry=true;
      building.add(door);registerVillageDoor(building,door,opening);
    }).catch(error=>console.error('Não foi possível carregar porta interna da pousada',error));
    const innTable=(x:number,z:number,width:number,depth:number)=>{
      const table=new T.Group();table.name='Mesa da biblioteca real';
      table.userData.cityObject=true;table.userData.sharedCityGeometry=true;
      appendRoyalTimberTable(x,.08,z,(geometry,material)=>{
        const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;table.add(mesh);
      },width,depth);
      building.add(table);registerCityInteriorProp(building,table,new T.Vector3(x,.08,z));
      building.userData.localColliders.push([x-width/2,.08,z-depth/2,x+width/2,1.21,z+depth/2]);
      for(const side of [-1,1])for(let seat=0;seat<2;seat++){
        fitted('chair',.7,1.1,.7,x+(seat-.5)*(width/2),.08,z+side*(depth/2+.65),side===1?Math.PI:0,true);
      }
    };
    // Reception, dining and kitchen use the real existing furniture models.
    // Reception faces the hall along the office side wall.
    // Leave a walkable passage behind both returns, including the shelf projection.
    const receptionX=-1.8,receptionWidth=7,receptionZ=-7.3;
    addCityCounter(building,receptionWidth,2,receptionZ,receptionX,-Math.PI/2);
    put('tavern-interior','barrelCrane',.65,receptionX,receptionZ+2.5,1.08,-Math.PI/2);
    building.userData.npcInnOffice={x:9.5,y:.08,z:-7};
    for(const y of [1.5,2.8,4.1]){
      void fitted('shelf',receptionWidth,.32,1,2.4,y-.16,receptionZ,-Math.PI/2,true).then(shelf=>{
        if(!shelf)return;
        for(let i=0;i<8;i++)put(TAVERN_BOTTLES[(i+Math.round(y*10))%TAVERN_BOTTLES.length],'',.44,2.4,receptionZ-2.87+i*.82,y+.16);
      });
    }
    for(const x of [-16,-8])for(const z of [-5,3]){
      innTable(x,z,3.2,2);
      put('ale-mug','',.22,x-.5,z,1.21);put('tavern-tankard','',.22,x+.5,z,1.21);put('candle','',.28,x,z,1.21);
    }
    innTable(8,-9,4,1.4);
    fitted('closed-box',1.3,1,1.1,13,.08,-8,0,true);
    fitted('closed-box',1.1,.8,1,13,1.08,-8,0,true);
    put('tavern-hearth','',3.2,-20.7,5,.08,Math.PI/2);
    put('tavern-fire','',.6,-20.3,5,.18,Math.PI/2);
    put('tavern-chimney','',4,-20.7,5,17);
    put('tavern-sign','',1.6,3.8,d/2+.55,3.2);
    // Clear guest corridors: each runner ends at the last room wall corner.
    for(const floor of [5,10]){
      const left=-21.55,right=Math.max(...rooms.filter(room=>room.y===floor).map(room=>room.x+room.width/2)),length=right-left,depth=3.2;
      const rug=new T.Group();rug.name='Tapete do corredor da pousada';
      rug.position.set((left+right)/2,floor+.012,5.5);
      rug.userData.cityObject=true;rug.userData.sharedCityGeometry=true;rug.userData.batchableCityProp=true;
      const piece=(width:number,depth:number,y:number,material:T.Material)=>{
        const mesh=new T.Mesh(new T.BoxGeometry(width,.012,depth),material);
        mesh.position.y=y;mesh.receiveShadow=true;rug.add(mesh);
      };
      piece(length,depth,0,bedroomRugMaterials.border);
      piece(length-.18,depth-.18,.008,bedroomRugMaterials.field);
      for(const side of [-1,1]){
        const stripe=new T.Mesh(new T.BoxGeometry(length-.4,.008,.045),bedroomRugMaterials.pattern);
        stripe.position.set(0,.018,side*(depth/2-.2));stripe.receiveShadow=true;rug.add(stripe);
      }
      building.add(rug);registerCityInteriorProp(building,rug);
    }
    // One compact six-candle chandelier per floor; a single direct light covers the hall and stairs.
    const iron=new T.MeshStandardMaterial({color:'#302d28',metalness:.7,roughness:.6});
    for(const floor of [0,5,10]){
      const chandelier=new T.Group();chandelier.name='Candelabro da pousada';
      const corridorRug=building.children.find(child=>child.name==='Tapete do corredor da pousada'&&Math.abs(child.position.y-(floor+.012))<.001);
      chandelier.position.set(corridorRug?.position.x??0,floor+3.65,corridorRug?.position.z??3);
      chandelier.userData.cityObject=true;chandelier.userData.alwaysLit=true;chandelier.userData.sharedCityGeometry=true;
      const ring=new T.Mesh(new T.TorusGeometry(.8,.055,6,24),iron);ring.rotation.x=Math.PI/2;chandelier.add(ring);
      const stem=new T.Mesh(new T.CylinderGeometry(.035,.035,.85,6),iron);stem.position.y=.48;chandelier.add(stem);
      chandelier.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=true;}});
      building.add(chandelier);registerCityInteriorProp(building,chandelier);
      mountChandelierCandles(chandelier,6,.8,.02,.44,5);
      chandelier.userData.innFloor=floor;
    }
    for(const window of building.userData.windows??[]){
      const {x,y,z,rotation}=window,nx=Math.sin(rotation),nz=Math.cos(rotation);
      fitted('village-window',CITY_WINDOW_WIDTH,CITY_WINDOW_HEIGHT,CITY_WINDOW_DEPTH,x+nx*CITY_WINDOW_OFFSET,y-CITY_WINDOW_HEIGHT/2,z+nz*CITY_WINDOW_OFFSET,rotation);
      // Keep curtains off the stacked staircase wall and the landing.
      if(x<16)fitted('curtain',2.15,2.2,.18,x-nx*.4,y-1.1,z-nz*.4,rotation+Math.PI);
    }
    return;
  }
  const bedroom=building.userData.upperBedroom;
  if(bedroom){
    const {x,z,y,width,depth}=bedroom;
    const left=x-width/2,right=x+width/2,back=z-depth/2,front=z+depth/2;
    // Keep the same footprint and reverse the bed by half a turn.
    const bedWidth=3.4,bedX=left+1.95,bedZ=back+.2+bedWidth/2;
    fitted('bed',bedWidth,1.5,3.4,bedX,y,bedZ,Math.PI*1.5,true,true);
    // A chest serves as a bedside table, with its candle supported on the lid.
    const bedsideX=left+.75,bedsideZ=back+4.3;
    void fitted('closed-box',1.05,1,.95,bedsideX,y,bedsideZ,0,true,true).then(chest=>{
      if(chest)put('candle','',.28,chest.position.x,chest.position.z,y+1);
    });
    // The writing table faces the front window, away from the stair landing.
    const deskX=x+.55,deskZ=front-1;
    void fitted('royal-timber-table',3.2,1.13,2,deskX,y,deskZ-.475,0,true,true).then(desk=>{
      if(!desk)return;
      const deskX=desk.position.x,deskZ=desk.position.z;
      fitted('chair',.8,1.15,.8,deskX,y,deskZ-1.5,0,true,true);
      put('candle','',.28,deskX-.7,deskZ,y+1.13);
      put('tavern-tankard','',.22,deskX+.65,deskZ,y+1.13);
    });
    // Storage at the window corner; the upper crate sits on the lower one.
    const storageX=left+.85,storageZ=front-.95;
    void fitted('box-low-poly',1.15,.85,1.05,storageX,y,storageZ,0,true,true).then(base=>{
      if(base)fitted('box-low-poly',.85,.65,.8,base.position.x,y+.85,base.position.z,0,true,true);
    });
    fitted('box-low-poly',.95,.75,.95,storageX+1.4,y,storageZ,0,true,true);
    // Store the larger chest against the side wall, clear of the bed and rug.
    fitted('closed-box',.95,.8,1.8,left+.7,y,z,0,true,true);
    fitted('potted-plant',.75,1.05,.75,right-1,y,z+1.8,0,true,true);
    void fitted('shelf',2.3,.95,.55,right-1.65,y,back+.65,0,true,true).then(shelf=>{
      if(!shelf)return;
      put('candle','',.28,shelf.position.x-.7,shelf.position.z,y+.95);
      put('tavern-bottle-green','',.4,shelf.position.x+.55,shelf.position.z,y+.95);
    });
    // Woven rug: a thin border, inset field, and restrained geometric motifs.
    const rug=new T.Group(),rugWidth=Math.min(6,width*.62),rugDepth=Math.min(4.6,depth*.34);
    rug.name='Tapete do quarto';rug.position.set(x,y+.025,z);
    rug.userData.cityObject=true;rug.userData.batchableCityProp=true;rug.userData.sharedCityGeometry=true;
    const rugPiece=(rw:number,rd:number,rx:number,rz:number,ry:number,material:T.Material)=>{
      const mesh=new T.Mesh(new T.BoxGeometry(rw,.012,rd),material);
      mesh.position.set(rx,ry,rz);mesh.receiveShadow=true;rug.add(mesh);
    };
    rugPiece(rugWidth,rugDepth,0,0,0,bedroomRugMaterials.border);
    rugPiece(rugWidth-.2,rugDepth-.2,0,0,.008,bedroomRugMaterials.field);
    for(const side of [-1,1])rugPiece(rugWidth-.5,.055,0,side*(rugDepth/2-.24),.016,bedroomRugMaterials.pattern);
    for(const offset of [-.9,0,.9]){
      const diamond=new T.Mesh(new T.BoxGeometry(.36,.012,.36),bedroomRugMaterials.pattern);
      diamond.position.set(offset,.016,0);diamond.rotation.y=Math.PI/4;diamond.receiveShadow=true;rug.add(diamond);
    }
    building.add(rug);registerCityInteriorProp(building,rug);scheduleCityPropBatch(building);
  }
  if(['shop','weapons','potions','guild'].includes(kind)){
    // Two chests along the rear left corner; leave the door and right stair free.
    for(const offset of [2.4,4.2])fitted('closed-box',1.5,.85,.85,-w/2+.9,.08,-d/2+offset,Math.PI/2,true,true);
  }
  if(['potions','weapons','shop','guild','tavern'].includes(kind))addCityCounter(building,kind==='tavern'?w*.6:Math.min(w*.65,8.9),kind==='tavern'?3:Math.min(2.3,d*.23-1),-d*.27);
  if(['potions','weapons','shop','guild','tavern'].includes(kind))for(let y=1;y<(building.userData.upperFloor?building.userData.upperFloor-.8:5);y+=1.3){
    fitted('shelf',w-2,.32,1,0,y-.16,-d/2+.6,0,true);
  }
  if(['potions','shop','guild'].includes(kind))for(let y=1;y<(building.userData.upperFloor?building.userData.upperFloor-.8:5);y+=1.3){
    for(let x=-w/2+2;x<w/2-1;x+=1.4)put((Math.round((x+w/2-2)/1.4)+Math.round((y-1)/1.3))%3===0?'magic-potion':'potion','',.48,x,-d/2+.6,y+.16);
  }
  if(kind==='tavern'){
    const random=cityRandom(index^0x718b);
    for(let y=1;y<(building.userData.upperFloor?building.userData.upperFloor-.8:5);y+=1.3)for(let x=-w/2+2;x<w/2-1;x+=1.4){
      put(TAVERN_BOTTLES[Math.floor(random()*TAVERN_BOTTLES.length)],'',.42+random()*.06,x,-d/2+.6,y+.16);
    }
  }

  addCityFacadeWindows(building);
  if(['shop','weapons','potions','guild','inn'].includes(kind))addShopCratePile(building);
  addCityShopDisplays(building);
  const random=cityRandom(index),profile=facadeProfile(index);
  const side=random()<.5?-1:1,x=side*(w/2-1.15),z=d/2+1.25;
  if(kind!=='warehouse'&&['barrels','mixed','full'].includes(profile)){
    put('farm','Barrel',1.15+random()*.2,x,z,.08,random()*.4);
    if(profile==='full')put('farm','Barrel',1.15,-x,z);
  }
  if(kind!=='warehouse'&&['bucket','mixed','full'].includes(profile))put('farm','Bucket',.55+random()*.12,x-side*1.45,z+(random()-.5)*.3);
  if(kind!=='warehouse'&&['crates','full'].includes(profile)){
    put('box-low-poly','',.8+random()*.15,side*(w/2+1),-d*.25,.08,random()*.3);
    if(profile==='crates'&&random()<.5)put('box-low-poly','',.65,side*(w/2+1),-d*.25-1.2);
  }
  if(kind!=='warehouse'&&['plant','full'].includes(profile))put('potted-plant','',.65+random()*.15,-side*2.4,d/2+.95);
  if(kind!=='warehouse'&&profile!=='empty'&&random()<.18)put('haystack','',.9,-w/2-1.4,-d*.35);
  // A wagon is a standalone Build asset. It must not become a child of the
  // tavern, otherwise selecting/moving the tavern moves the wagon with it.
  if(kind==='inn'&&random()<.25)put('wagon','',1.8,-w*.3,d/2+4,.08,Math.PI/2);
  if(kind==='house'&&profile!=='empty'&&random()<.22)put('wall-torch','',.72,info.doorWidth/2+.85,d/2+.58,2.65);
  const rearPile=profile==='empty'?0:random();
  const furnishedInterior=['tavern','inn','shop','weapons','potions','guild'].includes(kind);
  if(info.enterable&&furnishedInterior){
    // Left front corner stays away from the right-hand stair and back counter.
    put('potted-plant','',.85,-w/2+1.05,kind==='tavern'?-d/2+6.8:d/2-1.15);
    for(const side of [-1,1])put('wall-torch','',.72,side*(w/2-.55),0,2.55,-side*Math.PI/2);

  }
  if(kind==='house'&&rearPile>.82){
    // Two upright barrels form the base, with a third resting across them.
    const x=(index%2?1:-1)*(w/2-2),z=-d/2-1.05;
    for(const side of [-1,1])put('farm','Barrel',1.15,x+side*.52,z);
    put('farm','Barrel',1.15,x,z,1.23);
  }
  if(kind==='house'&&rearPile>.62&&rearPile<=.82){
    // A staggered stack against the rear wall: three crates support two above.
    const size=.9,spacing=.98,z=-d/2-.85;
    const x=(index%2?1:-1)*(w/2-2.2);
    for(let row=0;row<2;row++)for(let column=0;column<3-row;column++){
      put('box-low-poly','',size,x+(column-(2-row)/2)*spacing,z,
        .08+row*size,(index+column+row)%2?.035:-.035);
    }
  }
  if(kind==='tavern'||kind==='inn'){
    // Left-hand seating and rear counter leave the right-hand stairs accessible.
    const tables=kind==='tavern'?[-w*.28,0,w*.23].flatMap(x=>[-d*.1,d*.1,d*.3].map(z=>({x,z}))):[-d*.18,d*.22].map(z=>({x:-w*.24,z}));
    for(const {x,z} of tables){
      if(kind==='tavern'){
        if(x===0&&z<0)continue; // Removed unused table with barrel.
        if(x===0&&z<d*.2)continue; // Central seating replaced by the main round table.
        if(x===0){
          for(const side of [-1,1]){
            const tx=side*5,tz=d/2-4.8;
            put('tavern-interior','table1',1.1,tx,tz);
            for(const offset of [-1,1])put('chair','',1.05,tx+offset*1.5,tz,.08,offset>0?-Math.PI/2:Math.PI/2);
            for(const offset of [-1,1])put('ale-mug','',.24,tx+offset*.7,tz,1.18);
            put('candle','',.24,tx,tz,1.18);
          }
          continue;
        }
        // Wall booths leave the fireplace and the central main table clear.
        if(x<0&&z<0)continue;
        const side=x<0?-1:1;
        if(z>d*.2){
          const tableX=side*(w/2-2.9),tableZ=d/2-2.9;
          void fitted('royal-timber-table',2.4,1.1,2.4,tableX,.08,tableZ,0,true,true);
          // Two perpendicular benches meet beside the entrance-wall corner.
          put('tavern-booth','corner-side',1.3,side*(w/2-.95),d/2-2.85,.08,-side*Math.PI/2);
          put('tavern-booth','corner-front',1.3,side*(w/2-2.3),d/2-.95,.08,Math.PI);
          put('chair','',1.05,side*(w/2-4.8),tableZ,.08,side*Math.PI/2);
          put('chair','',1.05,tableX,d/2-4.8,.08,0);
          // Three front-bench places, two side-bench places and two chairs.
          for(const dx of [-.75,0,.75])put('ale-mug','',.24,tableX+dx,tableZ+.85,1.18);
          for(const dz of [-.55,.4])put('ale-mug','',.24,tableX+side*.85,tableZ+dz,1.18);
          put('ale-mug','',.24,tableX-side*.85,tableZ,1.18);
          put('ale-mug','',.24,tableX,tableZ-.85,1.18);
          put('candle','',.24,tableX,tableZ,1.18);
          continue;
        }
        const tableX=side*(w/2-2.8);
        void fitted('royal-timber-table',2.4,1.1,2.4,tableX,.08,z,0,true,true);
        put('tavern-booth','',1.3,side*(w/2-.6),z,.08,-side*Math.PI/2);
        for(const dz of [-.65,.65])put('chair','',1.05,side*(w/2-4.7),z+dz,.08,side*Math.PI/2);
        for(const edge of [-1,1])for(const dz of [-.65,.65])put('ale-mug','',.24,tableX+edge*.8,z+dz,1.18);
        put('candle','',.24,tableX,z,1.18);

      }else{
        put('tavern-interior','table1',1.1,x,z);
        for(const side of [-1,1])put('chair','',1.05,x+side*1.5,z,.08,side>0?-Math.PI/2:Math.PI/2);
        put('tavern-interior','mug',.22,x-.3,z,1.18);
        put('tavern-interior','pitcher',.35,x+.3,z,1.18);
        put('candle','',.24,x,z-.4,1.18);
      }
    }
    if(kind==='inn'){put('tavern-interior','barCounter',1.3,-w*.15,-d/2+2.2,.08,Math.PI/2);building.userData.npcCounter={x:-w*.15,y:.08,z:-d/2+1};}
    put('tavern-interior','barrelCrane',1.2,-w/2+1.2,-d/2+1.3);
  }
  if(kind==='tavern'){
    addTavernFacade(building,info);
    // Main hall table: 5 m diameter, same 1.1 m height as the other tables.
    const chandelierY=Math.min(5.5,info.height-1.5);
    const chandelier=createCityTavernChandelier(info.height-chandelierY);
    chandelier.position.set(0,chandelierY,0);
    building.add(chandelier);registerCityInteriorProp(building,chandelier);
    mountChandelierCandles(chandelier,12,2.2,.12,.6,info.height);
    put('tavern-interior','table1',1.1,0,0,.08,0,2.5);
    for(let seat=0;seat<10;seat++){
      const angle=seat*Math.PI*2/10;
      put('chair','',1.05,Math.sin(angle)*3.5,Math.cos(angle)*3.5,.08,angle+Math.PI);
    }
    put('candle','',.24,0,0,1.18);
    for(let mug=0;mug<10;mug++){
      const angle=mug*Math.PI*2/10;
      put('ale-mug','',.24,Math.sin(angle)*1.8,Math.cos(angle)*1.8,1.18,angle);
    }
    for(const [x,z] of [[w/2-1.6,-d/2+2.1],[-w/2+1.5,-d/2+4.5]]){
      const inward=x>0?-1:1;
      put('farm','Barrel',1.15,x,z);put('farm','Bucket',.5,x+inward*1.3,z+.8);
      put(TAVERN_BOTTLES[Math.abs(Math.round(x))%3],'',.4,x+inward*1.7,z,.88);
    }
    void addTavernFloorBottles(building);
    const hearthX=-w/2+1.05,hearthZ=-d*.1;
    put('tavern-hearth','',3.4,hearthX,hearthZ,.08,Math.PI/2);
    put('tavern-fire','',.65,hearthX+.38,hearthZ,.18,Math.PI/2);
    const roofY=info.height+w*.4*(1-Math.abs(hearthX)/(w/2));
    put('tavern-chimney','',3.6,hearthX,hearthZ,roofY-.35);
    put('tavern-sign','',2,0,d/2+.62,4.8);
    for(const x of [-w*.2,0,w*.2]){
      put('tavern-tankard','',.2,x,-d*.27,1.08);
      put(TAVERN_BOTTLES[Math.abs(Math.round(x*10))%TAVERN_BOTTLES.length],'',.46,x+.5,-d*.27,1.08);
    }
  }
  if(kind==='guild')for(const x of [-w*.3,w*.3])put('candle','',.24,x,1.6,1.25);
  if(kind==='church')void loadCityInteriorProp(building,new T.Vector3(0,.08,0),()=>loadCityPropTemplate('pew')).then(async template=>{
    if(!building.parent)return;
    const size=new T.Box3().setFromObject(template).getSize(new T.Vector3()),height=1.35,width=size.x*height/size.y;
    for(let z=-d*.15;z<d*.35;z+=3)for(const side of [-1,1])for(const half of [-1,1]){
      put('pew','',height,side*w*.28+half*width/2,z,.08,Math.PI);
    }
  }).catch(error=>console.error('Não foi possível carregar bancos da igreja',error));
  if(kind==='church'){
    for(const side of [-1,1])for(const z of [-d*.28,0,d*.28]){
      put('wall-torch','',.9,side*(w/2-.6),z,3.1,side<0?Math.PI/2:-Math.PI/2);
    }
    for(const side of [-1,1])put('wall-torch','',.9,side*1.9,-d/2+.6,4.7);
    put('altar','',1.35,0,-d*.34);
    put('church-door','',info.doorHeight,0,d/2+.12,0);
  }
  if(kind==='warehouse'){
    // Exact fitted footprints keep every group beside its own wall, with a clear central aisle.
    const storage=(pack:string,name:string,width:number,height:number,depth:number,x:number,z:number)=>{
      if(name){
        // Barrels keep their original proportions and mixed wood/metal materials.
        put(pack,name,height,x,z,.1);
      }else void fitted(pack,width,height,depth,x,.1,z,0,true,true);
    };
    for(const side of [-1,1]){
      const inside=side*(w/2-1.5),outside=side*(w/2+1.3);
      for(const x of [inside,outside]){
        storage('box-low-poly','',1.7,1.4,1.5,x,-d*.28);
        storage('farm','Barrel',1.3,1.25,1.3,x,0);
        storage('haystack','',1.8,1.2,1.6,x,d*.28);
      }
    }
  }
}

function addMarketStalls(market:T.Group,_index:number){

  const placements=circularMarketStalls();
  market.userData.marketStallWorkstations=placements.map((_,post)=>marketStallWorkstation(post));
  market.userData.localColliders=[];market.userData.weatherRoofs=[];
  const gardens=createCityPlazaGardens();market.add(gardens.root);market.userData.localColliders.push(...gardens.colliders);
  const decorate=(pack:string,height:number,x:number,z:number,y=.08,angle=0,solid=true)=>{
    void loadCityPropTemplate(pack).then(async template=>{
      await waitForCityPropSlot(market);
      if(!market.parent)return;
      const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop).getSize(new T.Vector3());
      prop.scale.setScalar(height/Math.max(size.y,.001));prop.position.set(x,y,z);prop.rotation.y=angle;
      prop.name=`Mercado: ${pack}`;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
      prop.userData.assetSource=`/models/city/props/${pack}.glb`;
      prop.updateMatrixWorld(true);
      if(solid){const box=new T.Box3().setFromObject(prop);market.userData.localColliders.push([...box.min.toArray(),...box.max.toArray()]);}
      prop.userData.batchableCityProp=true;
      market.add(prop);scheduleCityPropBatch(market);market.userData.colliderRevision=(market.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar decoração do mercado',error));
  };
  decorate('wagon',1.8,-27,0,.08,.35);
  decorate('wagon',1.8,27,0,.08,-.55);
  // One cart beside each canopy, its long axis parallel to the stall's depth.
  // Keep the front counter and rear vendor workstation unobstructed.
  for(const stall of placements){
    const side=3.15;
    decorate('wheelbarrow',1.05,stall.x+Math.cos(stall.angle)*side,
      stall.z-Math.sin(stall.angle)*side,.08,stall.angle+Math.PI/2);
  }

  for(const [post,placement] of placements.entries()){
    void loadCityPropTemplate('medieval-market',placement.variant).then(async template=>{
      await waitForCityPropSlot(market);
      if(!market.parent)return;
      const stall=template.clone(true),height=new T.Box3().setFromObject(stall).getSize(new T.Vector3()).y;
      stall.scale.setScalar(placement.height/height);stall.position.set(placement.x,.08,placement.z);stall.rotation.y=placement.angle;
      stall.name='Barraca de mercado';stall.userData.cityObject=true;stall.userData.sharedCityGeometry=true;
      stall.userData.assetSource='procedural:city-market-stall';
      stall.updateMatrixWorld(true);const box=new T.Box3().setFromObject(stall);
      market.userData.localColliders.push([...box.min.toArray(),...box.max.toArray()]);
      market.userData.weatherRoofs.push([...box.min.toArray(),...box.max.toArray()]);
      const dx=-Math.sin(placement.angle),dz=-Math.cos(placement.angle);
      const tx=Math.abs(dx)>.0001?((dx>0?box.max.x:box.min.x)-placement.x)/dx:Infinity;
      const tz=Math.abs(dz)>.0001?((dz>0?box.max.z:box.min.z)-placement.z)/dz:Infinity;
      const behind=Math.min(tx,tz)+.65;
      market.userData.marketStallWorkstations[post]={x:placement.x+dx*behind,y:.08,z:placement.z+dz*behind,angle:placement.angle};
      stall.userData.batchableCityProp=true;
      market.add(stall);scheduleCityPropBatch(market);market.userData.colliderRevision=(market.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar barraca',error));
  }
}

function addCityFountain(root:T.Group){
  root.userData.localColliders=[];
  void loadCityPropTemplate('fountain').then(async template=>{
      await waitForCityPropSlot(root);
    if(!root.parent)return;
    const model=template.clone(true),size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
    model.scale.set(16/Math.max(size.x,.001),11/Math.max(size.y,.001),16/Math.max(size.z,.001));
    model.name='Fonte central monumental';model.userData.cityObject=true;model.userData.sharedCityGeometry=true;model.userData.assetSource='procedural:city-fountain';
    root.add(model);root.userData.localColliders.push(...(template.userData.localColliders as number[][]).map(bounds=>[...bounds]));root.userData.colliderRevision=(root.userData.colliderRevision??0)+1;
  }).catch(error=>console.error('Não foi possível carregar fonte',error));
}

function addWoodFloors(building:T.Group){
  void loadCityPropTemplate('wood-floor').then(async template=>{
      await waitForCityPropSlot(building);
    if(!building.parent)return;
    template.updateMatrixWorld(true);
    const size=new T.Box3().setFromObject(template).getSize(new T.Vector3());
    const tiles:{x:number;z:number;width:number;depth:number;top:number}[]=[];
    for(const [x0,z0,x1,z1,top] of building.userData.woodFloorSurfaces as number[][]){
      const columns=Math.ceil((x1-x0)/2),rows=Math.ceil((z1-z0)/2),width=(x1-x0)/columns,depth=(z1-z0)/rows;
      for(let row=0;row<rows;row++)for(let column=0;column<columns;column++)tiles.push({x:x0+(column+.5)*width,z:z0+(row+.5)*depth,width,depth,top});
    }
    const root=new T.Group();root.name='Piso de madeira texturizado';root.userData.cityObject=true;root.userData.sharedCityGeometry=true;root.userData.assetSource='procedural:wood-floor-textured';
    const transform=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);
    template.traverse(child=>{
      if(!(child instanceof T.Mesh))return;
      const instances=new T.InstancedMesh(child.geometry,child.material,tiles.length);
      tiles.forEach((tile,i)=>{
        position.set(tile.x,tile.top-.08,tile.z);scale.set(tile.depth/size.x,.08/size.y,tile.width/size.z);
        transform.compose(position,rotation,scale).multiply(child.matrixWorld);instances.setMatrixAt(i,transform);
      });
      instances.instanceMatrix.needsUpdate=true;instances.receiveShadow=true;instances.computeBoundingSphere();root.add(instances);
    });building.add(root);
  }).catch(error=>console.error('Não foi possível carregar piso de madeira',error));
}


async function addShopCratePile(building:T.Group){
  try{
    const template=await loadCityPropTemplate('box-low-poly');if(!building.parent)return;
    const info=building.userData.building,size=new T.Box3().setFromObject(template).getSize(new T.Vector3());
    const factor=.85/size.y,width=size.x*factor,depth=size.z*factor;
    // Fit a two-crate base and one supported upper crate as one assembly.
    const pile=new T.Group();pile.name='Pilha de caixas da loja';
    for(const [x,y] of [[-width/2-.025,0],[width/2+.025,0],[0,.85]]){
      const box=template.clone(true);box.scale.setScalar(factor);box.position.set(x,y,0);pile.add(box);
    }
    pile.position.set(-info.width/2+width+(building.name==='Cidade:tavern'?3:1),.08,building.name==='Cidade:tavern'?-info.depth/2+2.7:info.depth/2-depth/2-2.7);
    if(!fitStorageWithoutOverlap(building,pile))return;
    // Keep individual bounds so the air around the upper crate stays passable.
    pile.updateMatrixWorld(true);
    for(const box of pile.children){const bounds=new T.Box3().setFromObject(box);building.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);}
    pile.userData.cityObject=true;pile.userData.sharedCityGeometry=true;pile.userData.batchableCityProp=true;
    building.add(pile);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;scheduleCityPropBatch(building);
  }catch(error){console.error('Não foi possível montar pilha de caixas da loja',error);}
}

async function addTavernFloorBottles(building:T.Group){
  const info=building.userData.building;
  for(const [i,z] of [-info.depth*.34,info.depth*.05,info.depth*.3].entries()){
    const template=await loadCityPropTemplate(TAVERN_BOTTLES[i%3]);if(!building.parent)return;
    const bottle=template.clone(true),size=new T.Box3().setFromObject(bottle).getSize(new T.Vector3());
    bottle.scale.setScalar(.4/size.y);bottle.rotation.set(0,i*1.7,Math.PI/2);bottle.position.set(info.width/2-1.2,0,z);
    bottle.updateMatrixWorld(true);bottle.position.y+=.08-new T.Box3().setFromObject(bottle).min.y;
    if(!fitStorageWithoutOverlap(building,bottle))continue;
    bottle.updateMatrixWorld(true);const b=new T.Box3().setFromObject(bottle);building.userData.localColliders.push([...b.min.toArray(),...b.max.toArray()]);
    bottle.name='Garrafa deitada no chão da taverna';bottle.userData.cityObject=true;bottle.userData.sharedCityGeometry=true;bottle.userData.batchableCityProp=true;
    building.add(bottle);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;scheduleCityPropBatch(building);
  }
}
