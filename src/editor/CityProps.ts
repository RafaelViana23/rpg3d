import {placeRoyalKitchenStorage} from './RoyalKitchenStorage';
import { createRoyalStyleBed } from './RoyalStyleBed';
import { cityBedAnchor } from './CitySleeping';
import { addCityShopDisplays } from './CityShopDisplays';
import { waitForCityPropSlot } from './CityPropLoading';
import { TAVERN_BOTTLES } from './TavernBottles';
import { fitStorageWithoutOverlap } from './CityStoragePlacement';
import { applyCityWood } from './CityWood';
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
const bedroomRugMaterials={
  border:new T.MeshLambertMaterial({color:'#c3a46a'}),
  field:new T.MeshLambertMaterial({color:'#743947'}),
  pattern:new T.MeshLambertMaterial({color:'#d4bd8d'}),
};

export function loadCityPropTemplate(pack:string,name=""){
  const key=`${pack}:${name}`;
  if(pack==='bed'){let bed=pieces.get(key);if(!bed){bed=Promise.resolve(createRoyalStyleBed());pieces.set(key,bed);}return bed;}
  let pending=pieces.get(key);
  if(!pending){
    let loaded=packs.get(pack);
    if(!loaded){loaded=loader.loadAsync(`/models/city/props/${pack}.glb`);packs.set(pack,loaded);}
    pending=loaded.then(gltf=>{
      applyCityWood(gltf.scene,pack);
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
        const mesh=new T.Mesh(geometry,child.material);mesh.name=child.name;mesh.castShadow=mesh.receiveShadow=true;template.add(mesh);
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
  if(building.userData.royalKitchen)void Promise.all([loadCityPropTemplate('box-low-poly'),loadCityPropTemplate('farm','Barrel'),loadCityPropTemplate('tavern-round-table'),...TAVERN_BOTTLES.map(pack=>loadCityPropTemplate(pack))]).then(async ([crate,barrel,table,...bottles])=>{
    await waitForCityPropSlot(building);if(building.parent)placeRoyalKitchenStorage(building,crate,barrel,{table,bottles});
  }).catch(error=>console.error('Não foi possível organizar a despensa real',error));

  for(const placement of building.userData.palacePropPlacements??[])void loadCityPropTemplate(placement.pack,placement.piece??'').then(async template=>{
    await waitForCityPropSlot(building);if(!building.parent)return;
    const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
    prop.scale.setScalar(placement.height/Math.max(.001,size.y));prop.position.set(placement.x,placement.y,placement.z);prop.rotation.y=placement.rotation;
    if(placement.horizontalScale){prop.scale.x*=placement.horizontalScale;prop.scale.z*=placement.horizontalScale;}
    prop.name=placement.label;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
    prop.userData.assetSource=`/models/city/props/${placement.pack}.glb`;
    const room=placement.room?building.userData[placement.room]:building.userData.princessBedroom;
    const area=new T.Box2(new T.Vector2(room.x-room.width/2+.05,room.z-room.depth/2+.05),new T.Vector2(room.x+room.width/2-.05,room.z+room.depth/2-.05));
    if(!fitStorageWithoutOverlap(building,prop,[building],area)){console.warn(`Sem espaço para ${placement.label}`);return;}
    prop.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(prop,true);
    if(placement.water){
      const radius=Math.min(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)*.32;
      const surface=new T.Mesh(new T.CircleGeometry(radius,24),new T.MeshStandardMaterial({color:'#72a7b4',transparent:true,opacity:.8,roughness:.22,metalness:.08,side:T.DoubleSide,depthWrite:false}));
      surface.rotation.x=-Math.PI/2;
      surface.position.set((bounds.min.x+bounds.max.x)/2,bounds.min.y+(bounds.max.y-bounds.min.y)*.52,(bounds.min.z+bounds.max.z)/2);
      surface.name='Água do balde';building.add(surface);
    }
    building.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
    building.add(prop);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
  }).catch(error=>console.error('Não foi possível carregar objeto do palácio',error));

  for(const [lightIndex,placement] of (building.userData.palaceLightPlacements??[]).entries())void loadCityPropTemplate(placement.pack).then(async template=>{
    await waitForCityPropSlot(building);if(!building.parent)return;
    const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
    prop.scale.setScalar(placement.height/Math.max(.001,size.y));prop.position.set(placement.x,placement.y,placement.z);prop.rotation.y=placement.rotation;
    prop.name=placement.pack==='candle'?'Vela do palácio':placement.pack==='tavern-fire'?'Fogo da lareira real':'Tocha do palácio';
    prop.userData.cityObject=true;prop.userData.alwaysLit=true;prop.userData.sharedCityGeometry=true;
    if(placement.group){prop.userData.fireGroup=`${building.uuid}:${placement.group}`;prop.userData.firePriority=true;}
    building.add(prop);addCityFirelight(prop,placement.pack==='wall-torch'||placement.pack==='tavern-fire',{intensity:placement.intensity,distance:placement.distance,persistent:placement.persistent??placement.pack==='wall-torch',emitter:palaceFirelightEmitter(building,lightIndex,placement.group)});
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
    prop.position.set(0,opening.y,opening.z);prop.name='Portão oval do palácio';
    prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
    prop.userData.assetSource='/models/city/props/church-door.glb';
    prop.traverse(child=>{if(child instanceof T.Mesh)child.castShadow=child.receiveShadow=true;});
    building.add(prop);registerChurchDoor(building,prop,opening);
  }).catch(error=>console.error('Não foi possível carregar o portão do palácio',error));
}
export function addCityProps(building:T.Group,index:number){
  if(building.name==='Cidade:fountain'){addCityFountain(building);return;}
  if(building.name==='Cidade:market'){addMarketStalls(building,index);return;}
  const info=building.userData.building;if(!info)return;
  if(building.userData.woodFloorSurfaces?.length)addWoodFloors(building);
  // Each saved building owns its own collider array; templates remain immutable.
  building.userData.localColliders=(building.userData.localColliders as number[][]).map(b=>[...b]);
  const put=(pack:string,name:string,height:number,x:number,z:number,y=.08,rotation=0)=>{
    void loadCityPropTemplate(pack,name).then(async template=>{
      await waitForCityPropSlot(building);
      if(!building.parent)return;
      const prop=cloneSkeleton(template) as T.Group,size=new T.Box3().setFromObject(prop).getSize(new T.Vector3());
      prop.scale.setScalar(height/Math.max(.001,size.y));
      if(pack==='church-door'||pack==='village-door')prop.scale.x=info.doorWidth/Math.max(.001,size.x);prop.position.set(x,y,z);prop.rotation.y=rotation;
      prop.name=`Objeto medieval: ${name||pack}`;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
      prop.userData.assetSource=`/models/city/props/${pack}.glb`;
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
      if(pack==='candle'||pack==='wall-torch'){prop.userData.alwaysLit=true;addCityFirelight(prop,pack==='wall-torch');}
      prop.userData.batchableCityProp=prop.animations.length===0&&pack!=='potion'&&pack!=='magic-potion';
      if(pack==='potion'||pack==='magic-potion')prop.userData.inventoryItemId=pack==='magic-potion'?'magic-potion':kind==='tavern'?'water-flask':'hp-potion';
      if(building.name==='Cidade:tavern'&&(pack==='chair'||pack==='tavern-stool')){
        // Keep seat anchors before static prop batching removes the source mesh.
        const seats=building.userData.npcSeats??(building.userData.npcSeats=[]);
        seats.push({x,z,y:pack==='chair'?bounds.min.y+size.y*prop.scale.y*.47:bounds.max.y,rotation});
      }
      building.add(prop);scheduleCityPropBatch(building);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar objeto medieval',error));
  };
  const w=info.width,d=info.depth,kind=building.name.slice('Cidade:'.length);
  if(kind!=='church')put('village-door','',info.doorHeight,0,d/2+.12,0);
  // Fit supplied static props in building coordinates, keeping stairs walkable.
  const fitted=(pack:string,width:number,height:number,depth:number,x:number,y:number,z:number,rotation=0,solid=false,checkStorage=false)=>{
    return loadCityPropTemplate(pack).then(async template=>{
      await waitForCityPropSlot(building);
      if(!building.parent)return;
      const prop=template.clone(true),size=new T.Box3().setFromObject(prop).getSize(new T.Vector3());
      prop.scale.set(width/size.x,height/size.y,depth/size.z);prop.position.set(x,y,z);prop.rotation.y=rotation;
      prop.name=`Objeto medieval: ${pack}`;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
      prop.userData.assetSource=pack==='bed'?'procedural:royal-style-bed':`/models/city/props/${pack}.glb`;prop.userData.batchableCityProp=true;
      const room=building.userData.upperBedroom;
      const area=room&&Math.abs(y-room.y)<.01?new T.Box2(new T.Vector2(room.x-room.width/2+.2,room.z-room.depth/2+.2),new T.Vector2(room.x+room.width/2-.2,room.z+room.depth/2-.2)):undefined;
      if(checkStorage&&!fitStorageWithoutOverlap(building,prop,[building],area)){
        console.warn(`Sem espaço para ${pack} em ${building.name}`);return;
      }
      if(pack==='bed')building.userData.npcBed=cityBedAnchor(prop,size);
      if(solid){prop.updateMatrixWorld(true);const b=new T.Box3().setFromObject(prop);building.userData.localColliders.push([...b.min.toArray(),...b.max.toArray()]);}
      building.add(prop);scheduleCityPropBatch(building);building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
      return prop;
    }).catch(error=>console.error(`Não foi possível carregar ${pack}`,error));
  };
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
    void fitted('tavern-table',2.15,1.15,1.05,deskX,y,deskZ,0,true,true).then(desk=>{
      if(!desk)return;
      const deskX=desk.position.x,deskZ=desk.position.z;
      fitted('chair',.8,1.15,.8,deskX,y,deskZ-1.15,0,true,true);
      put('candle','',.28,deskX-.7,deskZ,y+1.15);
      put('tavern-tankard','',.22,deskX+.65,deskZ,y+1.15);
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
    fitted('milking-stool',.65,.65,.65,deskX+1.8,y,deskZ-1.5,0,true,true);
    void fitted('shelf',2.3,.95,.55,right-1.65,y,back+.65,0,true,true).then(shelf=>{
      if(!shelf)return;
      put('candle','',.28,shelf.position.x-.7,shelf.position.z,y+.95);
      put('tavern-bottle-green','',.4,shelf.position.x+.55,shelf.position.z,y+.95);
    });
    // Woven rug: a thin border, inset field, and restrained geometric motifs.
    const rug=new T.Group(),rugWidth=Math.min(6,width*.62),rugDepth=Math.min(4.6,depth*.34);
    rug.name='Tapete do quarto';rug.position.set(x+.25,y+.025,z+.3);
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
    building.add(rug);scheduleCityPropBatch(building);
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
    put('potion','',.4,-w/2+2,-d/2+.6,2.46);
    const random=cityRandom(index^0x718b);
    for(let y=2.3;y<(building.userData.upperFloor?building.userData.upperFloor-.8:5);y+=1.3)for(let x=-w/2+2;x<w/2-1;x+=1.4){
      if(y===2.3&&x===-w/2+2)continue;
      put(TAVERN_BOTTLES[Math.floor(random()*TAVERN_BOTTLES.length)],'',.42+random()*.06,x,-d/2+.6,y+.16);
    }
  }

  for(const window of building.userData.windows??[]){
    const {x,y,z,rotation}=window,normalX=Math.sin(rotation),normalZ=Math.cos(rotation);
    fitted('village-window',CITY_WINDOW_WIDTH,CITY_WINDOW_HEIGHT,CITY_WINDOW_DEPTH,x+normalX*CITY_WINDOW_OFFSET,y-CITY_WINDOW_HEIGHT/2,z+normalZ*CITY_WINDOW_OFFSET,rotation);
    fitted('curtain',2.15,2.2,.18,x-normalX*.4,y-1.1,z-normalZ*.4,rotation+Math.PI);
  }
  if(['shop','weapons','potions','guild','tavern','inn'].includes(kind))addShopCratePile(building);
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
  if(kind==='tavern'||(kind==='inn'&&random()<.25))put('wagon','',1.8,-w*.3,d/2+4,.08,Math.PI/2);
  if(kind==='house'&&profile!=='empty'&&random()<.22)put('wall-torch','',.72,info.doorWidth/2+.85,d/2+.58,2.65);
  const rearPile=profile==='empty'?0:random();
  const furnishedInterior=['tavern','inn','shop','weapons','potions','guild'].includes(kind);
  if(info.enterable&&furnishedInterior){
    // Left front corner stays away from the right-hand stair and back counter.
    put('potted-plant','',.85,-w/2+1.05,d/2-1.15);
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
        if(x===0&&z<0){put('tavern-table','',2.2,x,z);continue;}
        if(x===0){
          put('tavern-interior','table1',1.1,x,z);
          for(const side of [-1,1])put('chair','',1.05,x+side*1.5,z,.08,side>0?-Math.PI/2:Math.PI/2);
          put('tavern-tankard','',.2,x-.4,z,1.18);put('candle','',.24,x,z,1.18);continue;
        }
        put('tavern-round-table','',1.1,x,z);
        for(const side of [-1,1])put('chair','',1.05,x+side*1.1,z,.08,side>0?-Math.PI/2:Math.PI/2);
        for(const side of [-1,1])put('tavern-stool','',.6,x,z+side*1.05);
        put('ale-mug','',.2,x-.22,z+.15,1.18);
        put('tavern-tankard','',.2,x+.22,z-.15,1.18,Math.PI);
        put('candle','',.24,x,z,1.18);
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
    for(const [x,z] of [[w/2-1.6,-d/2+2.1],[-w/2+1.5,d*.12]]){
      const inward=x>0?-1:1;
      put('farm','Barrel',1.15,x,z);put('farm','Bucket',.5,x+inward*1.3,z+.8);
      put('box-low-poly','',.8,x+inward*2.4,z);put(TAVERN_BOTTLES[Math.abs(Math.round(x))%3],'',.4,x+inward*2.4,z,.88);
    }
    void addTavernFloorBottles(building);
    const hearthX=-w/2+1.05,hearthZ=-d*.1;
    put('tavern-hearth','',3.4,hearthX,hearthZ,.08,Math.PI/2);
    put('tavern-fire','',.65,hearthX+.38,hearthZ,.18,Math.PI/2);
    const roofY=info.height+w*.4*(1-Math.abs(hearthX)/(w/2));
    put('tavern-chimney','',3.6,hearthX,hearthZ,roofY-.35);
    put('tavern-sign','',2,3.1,d/2+.48,2.65);
    put('tavern-butcher-sign','',1.35,-3.2,d/2+.4,2.65);
    for(const x of [-w*.2,0,w*.2]){
      put('tavern-tankard','',.2,x,-d*.27,1.08);
      put(TAVERN_BOTTLES[Math.abs(Math.round(x*10))%TAVERN_BOTTLES.length],'',.46,x+.5,-d*.27,1.08);
    }
  }
  if(kind==='guild')for(const x of [-w*.3,w*.3])put('candle','',.24,x,1.6,1.25);
  if(kind==='guild')for(const x of [-w*.3,w*.3])for(const side of [-1,1]){
    put('milking-stool','',.6,x+side*2,2);
  }
  if(kind==='church')void loadCityPropTemplate('pew').then(async template=>{
      await waitForCityPropSlot(building);
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

function addMarketStalls(market:T.Group,index:number){
  const variants=['Stand_Vegetables','Stand_Tools','Stand_Meat'];
  let seed=(index+12371)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const placements:{x:number;z:number;angle:number;variant:string;height:number;radius:number}[]=[];
  // Irregular clusters fill the square while leaving the fountain and walking gaps clear.
  for(let attempt=0;attempt<3000&&placements.length<20;attempt++){
    const angle=random()*Math.PI*2,radius=13+random()*14;
    const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
    const footprint=4.3;
    if(Math.hypot(x-27,z)<8.5||Math.hypot(x+27,z)<8.5)continue;
    if(placements.some(p=>Math.hypot(p.x-x,p.z-z)<p.radius+footprint+1))continue;
    placements.push({x,z,angle:random()*Math.PI*2,variant:variants[Math.floor(random()*variants.length)],height:2.6+random()*.2,radius:footprint});
  }
  market.userData.localColliders=[];market.userData.weatherRoofs=[];
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
  let wheelbarrows=0;
  placements.forEach((stall,i)=>{
    const angle=Math.atan2(stall.x,stall.z)+Math.PI;
    const x=stall.x+Math.sin(angle)*4.7,z=stall.z+Math.cos(angle)*4.7;
    if(Math.hypot(x,z)<9||placements.some(p=>p!==stall&&Math.hypot(p.x-x,p.z-z)<5.2))return;
    if(i%2===0){
      if(i%4===0)decorate('fruit-basket',.53,x,z,.08,random()*Math.PI*2);
      else decorate('produce-crate',.18,x,z,.08,random()*.8-.4);
      // Loose fruit beside the crate and several pieces lying on the paving.
      for(let n=0;n<4;n++){
        const fruit=n%2?'grapes':'apple';
        decorate(fruit,fruit==='apple'?.15:.22,x+.65+(random()-.5)*.45,z+(random()-.5)*.8,.08,random()*Math.PI*2,false);
      }
    }else if(i%3===0)decorate('sign-board',1.3,x,z,.08,angle+(random()-.5)*.5);
    else if(wheelbarrows<3){
      decorate('wheelbarrow',1.05,x,z,.08,angle+(random()-.5)*.7);
      wheelbarrows++;
    }
  });

  for(const placement of placements){
    void loadCityPropTemplate('medieval-market',placement.variant).then(async template=>{
      await waitForCityPropSlot(market);
      if(!market.parent)return;
      const stall=template.clone(true),height=new T.Box3().setFromObject(stall).getSize(new T.Vector3()).y;
      stall.scale.setScalar(placement.height/height);stall.position.set(placement.x,.08,placement.z);stall.rotation.y=placement.angle;
      stall.name='Barraca de mercado';stall.userData.cityObject=true;stall.userData.sharedCityGeometry=true;
      stall.userData.assetSource='/models/city/props/medieval-market.glb';
      stall.updateMatrixWorld(true);const box=new T.Box3().setFromObject(stall);
      market.userData.localColliders.push([...box.min.toArray(),...box.max.toArray()]);
      market.userData.weatherRoofs.push([...box.min.toArray(),...box.max.toArray()]);
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
    model.scale.set(16/Math.max(size.x,.001),5.95/Math.max(size.y,.001),16/Math.max(size.z,.001));
    const painted=new Map<T.Material,T.Material>();
    model.traverse(child=>{if(!(child instanceof T.Mesh))return;
      const paint=(source:T.Material)=>{
        let material=painted.get(source);if(material)return material;
        material=source.clone();
        if(material instanceof T.MeshStandardMaterial){
          material.color.set('#ffffff');material.roughness=.9;
          material.onBeforeCompile=(shader)=>{
            shader.uniforms.fountainRiverColor={value:new T.Color('#3e9fc0')};
            shader.fragmentShader='uniform vec3 fountainRiverColor;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
              bool fountainWater=diffuseColor.b>diffuseColor.r*2.2&&diffuseColor.g>diffuseColor.r*1.6&&diffuseColor.b>diffuseColor.g*.75;
              if(fountainWater)diffuseColor.rgb=fountainRiverColor;
              else diffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)))*.48;`);
          };
          material.customProgramCacheKey=()=> 'fountain-dark-stone-river-water-v1';
        }
        painted.set(source,material);return material;
      };
      child.material=Array.isArray(child.material)?child.material.map(paint):paint(child.material);
    });
    model.name='Fonte central GLB';model.userData.cityObject=true;model.userData.sharedCityGeometry=true;model.userData.assetSource='/models/city/props/fountain.glb';
    root.add(model);root.userData.localColliders.push([-7.6,0,-7.6,7.6,1,7.6]);root.userData.colliderRevision=(root.userData.colliderRevision??0)+1;
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
    const root=new T.Group();root.name='Piso de madeira GLB';root.userData.cityObject=true;root.userData.sharedCityGeometry=true;root.userData.assetSource='/models/city/props/wood-floor.glb';
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
    pile.position.set(-info.width/2+width+1,.08,info.depth/2-depth/2-2.7);
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
