import {attachRoyalCrown} from './RoyalCrown';
import {RoyalCoupleRoutine,royalCoupleLayout,royalCoupleActivity} from './RoyalCoupleRoutine';
import {citizenHairColor} from './CitizenHair';
import {PalaceStaffRoutine,isPalaceStaff,palaceStaffActivity,palaceStaffLayout} from './PalaceStaffRoutine';
import {openDoorForResident} from './ChurchDoors';
import { princessActivity,PrincessPalaceRoutine } from './PrincessPalaceRoutine';
import type { PersistedInventory } from '../inventory/types';
import { dressCitizen, clearCitizenOutfit } from './CitizenOutfits';
import { CitySleeping, cityBedSide, type CityBedAnchor } from './CitySleeping';
import { armorColor, GUARD_ARMOR } from '../inventory/armorMaterials';
import { ITEM_BY_ID } from '../inventory/catalog';
import * as THREE from 'three';
import { DEFAULT_CONFIG, ProceduralCharacter } from '../character';
import { citizenRoutine, CITIZEN_ROLE_LABELS, MERCHANT_ROLES } from './ResidentSchedule';
import { CITY_WOOD_MATERIAL } from './CityWood';
import type { MerchantSession } from '../inventory/ShopPanel';
import { ResidentNavigation } from './ResidentNavigation';
import { loadCityPropTemplate } from './CityProps';
import { resolveCircleCollision } from '../world/CollisionSystem';
import { createCityPopulation, type Citizen } from './CityPopulation';

type Resident={careTime:number;citizen:Citizen;actor:ProceduralCharacter|null;home:THREE.Group;anchor:THREE.Group;local:THREE.Vector3;position:THREE.Vector3;angle:number;walking:boolean;seated:boolean;phase:number;wait:number;direction:number;distance:number;label:HTMLDivElement|null;routine:string;path:THREE.Vector3[];destination:number;indoors:boolean;atWork:boolean};
const outfits=['#536c58','#825346','#576784','#b3945a','#6d537a','#3e7774'];


/** All 146 identities exist immediately; nearby character meshes use a bounded pool. */
export class CityResidents{
  readonly residents:Resident[]=[];
  readonly population:Citizen[];
  private companion:PersistedInventory['companion'];
  private companionBedHome:THREE.Group|null=null;
  get companionSharingBed(){return this.companionBedHome!==null;}
  setCompanionBed(home:THREE.Group|null){
    if(this.companionBedHome===home)return;
    const resident=this.residents.find(r=>r.citizen.id===this.companion?.id);
    if(resident?.actor){this.sleeping.restore(resident.actor.group);resident.actor.setRestUndressed(false);}
    this.companionBedHome=home&&resident?home:null;this.princessRoutine.reset();
  }
  private conversationId:string|null=null;
  setConversation(id:string|null){this.conversationId=id;}
  private updateConversation(r:Resident,dt:number,player:THREE.Vector3){
    const actor=r.actor;if(!actor)return;
    const dx=player.x-actor.group.position.x,dz=player.z-actor.group.position.z;
    // Keep the routine's heading and path intact so it resumes after closing.
    if(Math.hypot(dx,dz)>.001)actor.group.rotation.set(0,Math.atan2(dx,dz),0);
    actor.setAnimation(r.seated?'sit':'idle');actor.update(dt);
  }
  private companionPaused=false;
  private companionAtEditedTime=false;
  private readonly princessRoutine=new PrincessPalaceRoutine();
  private companionSearch:Generator<void,THREE.Vector3[],void>|null=null;
  private companionTarget=new THREE.Vector3();
  private companionRepath=0;
  private companionTrail:THREE.Vector3[]=[];
  private readonly companionNavigation=new ResidentNavigation(.5);
  setCompanion(state:PersistedInventory['companion']){
    this.setCompanionBed(null);
    this.companionAtEditedTime=false;
    const resident=state&&this.residents.find(r=>r.citizen.id===state.id&&r.citizen.role==='princesa');
    if(state&&!resident)return;
    if(resident){
      if(this.companion?.id!==state!.id)resident.position.fromArray(state!.position);
      resident.path=[];resident.walking=false;resident.seated=false;resident.indoors=false;resident.atWork=false;
      if(this.pendingRoute?.resident===resident)this.pendingRoute=null;
    }
    this.princessRoutine.reset();
    this.companion=state;this.companionSearch=null;this.companionRepath=0;this.companionTrail=[];this.companionNavigation.clear();this.navigation.clear();
  }
  setCompanionPaused(paused:boolean){this.companionPaused=paused;}
  private updateCompanion(r:Resident,dt:number,player:THREE.Vector3,height:(x:number,z:number,feetY?:number)=>number,collide:(p:THREE.Vector3,r:number)=>void){
    const state=this.companion!;
    if(state.mode==='follow'&&!this.companionPaused){
      openDoorForResident(r.position);
      const last=this.companionTrail.at(-1);
      if(last&&last.distanceTo(player)>4)this.companionTrail=[];
      if(!last||last.distanceTo(player)>.3)this.companionTrail.push(player.clone());
      if(this.companionTrail.length>800)this.companionTrail.shift();
    }
    // Recover old companion saves that placed her inside the palace's filled floor.
    if(Math.hypot(r.position.x-player.x,r.position.z-player.z)<12){
      const support=height(r.position.x,r.position.z,Math.max(r.position.y,player.y));
      if(support>r.position.y+.5&&Math.abs(support-player.y)<1){
        this.scratch.copy(r.position);collide(this.scratch,.32);
        if(Math.hypot(this.scratch.x-r.position.x,this.scratch.z-r.position.z)>.5)r.position.y=support;
      }
    }
    r.routine='companion';r.atWork=false;r.indoors=false;r.seated=false;r.walking=false;
    this.companionRepath-=dt;
    const distance=r.position.distanceTo(player);
    if(state.mode==='follow'&&!this.companionPaused&&distance>2){
      if(this.companionRepath<=0&&!this.companionSearch){
        this.companionTarget.copy(player);this.companionRepath=.8;
        // Prefer a swept straight path; fall back to bounded A* around walls.
        let clear=true;
        const samples=Math.max(1,Math.ceil(distance/.18));
        if(samples>600)clear=false;
        let sampleFeet=r.position.y;
        if(clear)for(let i=1;i<=samples;i++){
          this.scratch.copy(r.position).lerp(player,i/samples);this.scratch.y=height(this.scratch.x,this.scratch.z,sampleFeet+.02);
          if(Math.abs(this.scratch.y-sampleFeet)>.35){clear=false;break;}sampleFeet=this.scratch.y;
          this.previous.copy(this.scratch);collide(this.scratch,.32);
          if(this.scratch.distanceToSquared(this.previous)>.0025){clear=false;break;}
        }
        if(clear)r.path=[player.clone()];
        else{
          // Follow the player's actual turns through furniture, galleries and stair landings.
          let join=-1;
          for(let j=0;j<this.companionTrail.length;j++){
            const point=this.companionTrail[j];if(point.distanceTo(r.position)>2)continue;
            const count=Math.max(1,Math.ceil(point.distanceTo(r.position)/.18));let safe=true,feet=r.position.y;
            for(let i=1;i<=count;i++){
              const p=r.position.clone().lerp(point,i/count);p.y=height(p.x,p.z,feet+.02);
              if(Math.abs(p.y-feet)>.35){safe=false;break;}feet=p.y;
              const before=p.clone();collide(p,.32);if(p.distanceToSquared(before)>.0016){safe=false;break;}
            }
            if(safe)join=j;
          }
          if(join>=0)r.path=this.companionTrail.slice(join).map(p=>p.clone());
          else this.companionSearch=this.companionNavigation.routeSteps(r.position.clone(),player.clone(),(x,z,feet)=>height(x,z,feet??r.position.y),collide);
        }
      }
      const deadline=performance.now()+1;
      while(this.companionSearch&&performance.now()<deadline){
        const result=this.companionSearch.next();
        if(result.done){r.path=result.value;this.companionSearch=null;}
      }
      const next=r.path[0];
      if(next){
        this.direction.copy(next).sub(r.position);this.direction.y=0;
        const length=this.direction.length(),step=Math.min(length,dt*(distance>7?6:3.8),Math.max(0,distance-1.8));
        if(length>.01&&step>0){
          this.direction.divideScalar(length);this.previous.copy(r.position);
          r.position.addScaledVector(this.direction,step);r.position.y=height(r.position.x,r.position.z,r.position.y);collide(r.position,.32);
          r.walking=r.position.distanceToSquared(this.previous)>.00001;
          if(r.walking)r.angle=Math.atan2(this.direction.x,this.direction.z);
          const expected=this.previous.clone().addScaledVector(this.direction,step);
          if(Math.hypot(r.position.x-expected.x,r.position.z-expected.z)>.05){r.path=[];this.companionRepath=0;this.companionSearch=null;}
          else if(!r.walking){r.path=[];this.companionRepath=0;}
        }
        if(length<.25)r.path.shift();
      }
    }else{r.path=[];this.companionSearch=null;}
    state.position=r.position.toArray() as [number,number,number];
    if(r.actor){
      this.sleeping.restore(r.actor.group);r.actor.group.visible=true;
      r.actor.group.position.copy(r.position);r.actor.group.rotation.set(0,r.angle,0);
      r.actor.setAnimation(r.walking?'walk':'idle');r.actor.update(dt);
      r.actor.group.userData.resident={...r.citizen,companion:true,activity:state.mode==='wait'?'esperando você':'acompanhando você',routine:'companion'};
    }
  }
  setPrincessRestUndressed(enabled:boolean){
    const resident=this.residents.find(r=>r.citizen.role==='princesa');
    if(!resident?.actor||enabled&&resident.routine!=='sleep')return false;
    this.sleeping.restore(resident.actor.group);
    resident.actor.setRestUndressed(enabled);
    const home=this.companionBedHome??resident.home;
    if(resident.routine==='sleep')this.sleeping.place(resident.actor.group,home,cityBedSide(home.userData.princessBed,1));
    return true;
  }
  private royalRoutines=new Map<string,RoyalCoupleRoutine>();
  private staffRoutines=new Map<string,PalaceStaffRoutine>();
  private timeSyncPending=true;
  /** Editing the clock relocates identities before proximity-based mesh loading. */
  synchronizeTime(worldTime?:number){
    this.setCompanionBed(null);
    this.companionAtEditedTime=true;
    this.timeSyncPending=true;
    if(worldTime!==undefined)this.applyScheduledTime(worldTime);
  }
  private applyScheduledTime(worldTime:number){
    this.pendingRoute=null;this.princessRoutine.reset();this.staffRoutines.clear();this.royalRoutines.clear();
    for(const r of this.residents){
      if(r.citizen.id===this.conversationId)continue;
      // Explicit clock edits also synchronize the current companion.
      if(r.citizen.id===this.companion?.id&&!this.companionAtEditedTime)continue;
      const work=this.buildings.get(r.citizen.workId)??r.home;
      const routine=citizenRoutine(worldTime,r.citizen.role);
      r.routine=routine;r.path=[];r.wait=0;r.walking=false;r.seated=false;
      r.atWork=routine==='work';r.indoors=!r.atWork&&routine!=='roam'&&routine!=='return';
      r.anchor=r.atWork?work:r.home;
      if((r.citizen.role==='rei'||r.citizen.role==='rainha')&&r.home.userData.princessPalace){
        const activity=royalCoupleActivity(worldTime),layout=royalCoupleLayout(r.home,r.citizen.role);
        r.home.updateWorldMatrix(true,false);
        r.position.copy(r.home.localToWorld(new THREE.Vector3(...layout.nodes[activity.target])));
        r.routine=activity.sleep?'sleep':'palace';r.atWork=!activity.sleep;r.indoors=true;r.seated=!activity.sleep;r.anchor=r.home;
      }else if(r.citizen.role==='princesa'&&r.home.userData.princessPalace){
        const activity=princessActivity(worldTime);
        r.position.copy(r.home.localToWorld(new THREE.Vector3(...r.home.userData.princessPalace.nodes[activity.target] as [number,number,number])));
        r.routine=activity.sleep?'sleep':'palace';r.atWork=false;r.indoors=true;
      }else if(r.atWork&&isPalaceStaff(r.citizen.role)&&work.userData.princessPalace){
        const activity=palaceStaffActivity(worldTime,r.citizen),layout=palaceStaffLayout(work);
        r.position.copy(work.localToWorld(new THREE.Vector3(...layout.nodes[activity.target])));
      }else if(r.atWork)r.position.copy(this.workPoint(r,work));
      else r.position.copy(this.homePoint(r,routine==='roam',routine==='sleep'));
      if(r.actor){
        const actor=r.actor;this.sleeping.restore(actor.group);
        actor.group.position.copy(r.position);actor.group.rotation.set(0,r.angle,0);actor.group.visible=true;
        actor.setAnimation(r.seated?'sit':'idle');actor.update(0);
        const royal=(r.citizen.role==='rei'||r.citizen.role==='rainha')&&r.home.userData.princessPalace;
        const bed=royal?royalCoupleLayout(r.home,r.citizen.role as 'rei'|'rainha').bed:r.citizen.role==='princesa'&&r.home.userData.princessBed?cityBedSide(r.home.userData.princessBed,1):r.home.userData.npcBed;
        const crown=actor.group.getObjectByName('CitizenRoleDecoration');if(crown&&royal)crown.visible=r.routine!=='sleep';
        if(r.routine==='sleep'&&bed)this.sleeping.place(actor.group,r.home,bed);
        else if(royal&&r.seated)this.placeRoyalSeat(r,actor);
        actor.group.userData.resident={...r.citizen,activity:r.routine==='sleep'?'dormindo':r.seated?'sentado no trono':r.routine,routine:r.routine};
      }
    }
    this.spawnElapsed=.15;this.timeSyncPending=false;
  }
  private elapsed=0;
  private bindingSignature='';
  private navigationSignature='';
  private spawnElapsed=0;
  private readonly navigation=new ResidentNavigation();
  private readonly sleeping=new CitySleeping();
  private routeBudget=0;
  private pendingRoute:{resident:Resident;search:Generator<void,THREE.Vector3[],void>}|null=null;
  private readonly viewFrustum=new THREE.Frustum();
  private readonly viewMatrix=new THREE.Matrix4();
  private readonly actorBounds=new THREE.Sphere(new THREE.Vector3(),2.5);
  private scratch=new THREE.Vector3();
  private previous=new THREE.Vector3();
  private direction=new THREE.Vector3();
  constructor(private scene:THREE.Scene,private buildings:Map<string,THREE.Group>,existing:ProceduralCharacter[],private existingBusy:(index:number)=>boolean=()=>false){
    this.population=createCityPopulation(buildings);
    this.population.forEach((citizen,i)=>{
      const home=buildings.get(citizen.homeId);if(!home)return;
      const anchor=buildings.get(citizen.workId)??home,info=anchor.userData.building;
      let local=new THREE.Vector3(i%2?-1.4:1.4,.08,(info?.depth??16)/2+2.5),angle=0;
      if(citizen.role==='guarda-torre'){local.set(0,10.825,0);angle=Math.atan2(anchor.position.x,anchor.position.z);}
      else if(citizen.role==='guarda-palacio'){
        const side=citizen.post%2?-1:1,row=Math.floor(citizen.post/2);
        local.set(side*(row===0?info.doorWidth/2+1.3:info.width*.32),.08,row===0?info.depth/2+1.3:row===1?info.depth*.15:-info.depth*.28);
      }else if((citizen.role==='rei'||citizen.role==='rainha')&&anchor.userData.npcRoyalPositions){local.fromArray(anchor.userData.npcRoyalPositions[citizen.role==='rei'?0:1]);local.z+=.95;}
      else if(citizen.role==='princesa'&&anchor.userData.npcRoyalDaughterPosition)local.fromArray(anchor.userData.npcRoyalDaughterPosition);
      else if(citizen.role==='padre')local.set(0,.08,-info.depth*.27);
      else if(['armeiro','alquimista','taverneira','guilda','estalajadeira'].includes(citizen.role))local.set(0,.08,-info.depth*.27-1.1);
      const actor=citizen.existingIndex===undefined?null:existing[citizen.existingIndex]??null;
      const r:Resident={careTime:0,citizen,actor,home,anchor,local,position:new THREE.Vector3(),angle,walking:citizen.role==='morador'&&citizen.existingIndex===undefined&&i%3!==0,seated:false,phase:i*1.73,wait:i%4,direction:1,distance:0,label:null,routine:'',path:[],destination:i,indoors:false,atWork:false};
      this.residents.push(r);
      if(actor){
        for(const piece of ['armor','armorPants','armorBoots','armorGloves','steelHelmet','closedHelmet'] as const)actor.setClothing(piece,false);
        actor.equipRightHand('nenhum');actor.equipLeftHand('nenhum');
        dressCitizen(actor,citizen);this.registerActor(r,actor);
      }
      anchor.updateWorldMatrix(true,false);r.position.copy(local).applyMatrix4(anchor.matrixWorld);
      if(actor)actor.group.position.copy(r.position);
    });
    this.bindingSignature=[...buildings].map(([id,b])=>`${id}:${b.id}`).join(';');
    this.scene.userData.cityPopulation=this.population;
  }
  private registerActor(r:Resident,actor:ProceduralCharacter){
    r.actor=actor;actor.group.name=`NPC_Morador_${r.citizen.name}`;
    actor.group.userData.buildEditable=false;actor.group.userData.mapHidden=false;actor.group.userData.cityResidentManaged=true;
    actor.group.userData.resident={...r.citizen,activity:r.seated?'sentado na taverna':r.walking?'passeando':r.citizen.role};
    actor.group.traverse(o=>o.layers.enable(0));
    if(!actor.group.parent)this.scene.add(actor.group);
    const label=document.createElement('div');label.className='npc-name'+(CITIZEN_ROLE_LABELS[r.citizen.role]?' npc-special':'');
    label.textContent=`${r.citizen.name} (${CITIZEN_ROLE_LABELS[r.citizen.role]??'Morador'})`;
    document.querySelector('#viewport')?.append(label);r.label=label;
  }
  private createActor(r:Resident,player:THREE.Vector3){
    const index=this.population.indexOf(r.citizen);
    const config={...DEFAULT_CONFIG,name:r.citizen.name,body:r.citizen.gender==='homem'?'masculino' as const:'feminino' as const,hairStyle:'curto' as const,helmetHair:true,hair:citizenHairColor(r.citizen.role,index),outfit:r.citizen.role==='padre'?'#211f24':outfits[index%outfits.length],skin:DEFAULT_CONFIG.skin};
    let actor:ProceduralCharacter;
    const loaded=this.residents.filter(x=>x.actor&&x.citizen.existingIndex===undefined);
    if(loaded.length>=28){
      const recyclable=loaded.filter(x=>x.citizen.id!==this.companion?.id&&x.citizen.id!==this.conversationId).filter(x=>x.position.distanceToSquared(player)>85*85||(!!MERCHANT_ROLES[r.citizen.role]||isPalaceStaff(r.citizen.role)||r.citizen.role==='padre'||r.citizen.role==='guilda')&&(x.citizen.role==='morador'||isPalaceStaff(r.citizen.role)&&x.citizen.role.startsWith('guarda-'))&&x.position.distanceToSquared(player)>20*20).sort((a,b)=>b.position.distanceToSquared(player)-a.position.distanceToSquared(player))[0];
      if(!recyclable?.actor)return;
      actor=recyclable.actor;recyclable.actor=null;recyclable.label?.remove();recyclable.label=null;
      const oldDecoration=actor.group.getObjectByName('CitizenRoleDecoration');
      if(oldDecoration){
        const materials=new Set<THREE.Material>();
        oldDecoration.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
        for(const material of materials)material.dispose();oldDecoration.removeFromParent();
      }
      this.sleeping.restore(actor.group);
      clearCitizenOutfit(actor);
      actor.rebuild(config);
    }else actor=new ProceduralCharacter(config);
    actor.setChibi(true);actor.equipRightHand('nenhum');actor.equipLeftHand('nenhum');
    for(const item of ['shirt','pants','boots','belt'] as const)actor.setClothing(item,true);
    for(const piece of ['armor','armorPants','armorBoots','armorGloves','steelHelmet','closedHelmet'] as const)actor.setClothing(piece,false);
    delete actor.group.userData.equippedItems;
    actor.setClothing('sword',false);actor.setClothing('shield',false);
    actor.setCivilianClothingColor(config.outfit);
    if(r.citizen.role.startsWith('guarda-')){
      for(const item of ['armor','armorPants','armorBoots','armorGloves','steelHelmet'] as const)actor.setClothing(item,true);
      for(const [slot,id] of Object.entries(GUARD_ARMOR)){
        const item=ITEM_BY_ID.get(id)!;
        actor.setArmorPartColor(slot==='head'?'helmet':slot as 'torso'|'legs'|'boots'|'gloves',armorColor(item.visual));
      }
      actor.group.userData.equippedItems={...GUARD_ARMOR};
      actor.setArmorShouldersVisible(true);actor.equipRightHand('espada');actor.equipLeftHand('escudo');
      if(r.citizen.role==='guarda-arqueiro'){
        actor.equipRightHand('nenhum');actor.equipLeftHand('nenhum');
        const bow=new THREE.Group();
        const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,-.65,0),new THREE.Vector3(.5,0,0),new THREE.Vector3(0,.65,0));
        bow.add(new THREE.Mesh(new THREE.TubeGeometry(curve,16,.035,6,false),CITY_WOOD_MATERIAL.clone()));
        const string=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,1.3,4),new THREE.MeshStandardMaterial({color:'#d5cdb7'}));bow.add(string);
        actor.equipProceduralWeapon(bow);
      }

    }
    if(r.citizen.role==='rei'||r.citizen.role==='rainha'||r.citizen.role==='padre'){
      const decoration=new THREE.Group();decoration.name='CitizenRoleDecoration';
      const gold=new THREE.MeshStandardMaterial({color:'#d3ac55',metalness:.8,roughness:.28});
      if(r.citizen.role==='padre'){
        // The cassock and stole are fitted to the animated rig by dressCitizen.
      }else{
        const crown=new THREE.Mesh(new THREE.CylinderGeometry(.35,.34,.12,12,1,true),gold);crown.position.y=2.69;decoration.add(crown);
        for(let j=0;j<8;j++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.065,.19,4),gold),a=j*Math.PI/4;spike.position.set(Math.sin(a)*.33,2.81,Math.cos(a)*.33);decoration.add(spike);}
      }
      actor.group.add(decoration);
      if(r.citizen.role!=='padre')attachRoyalCrown(actor,decoration);
      if(r.citizen.role==='rei'||r.citizen.role==='rainha')void loadCityPropTemplate('royal-crown').then(template=>{
        if(r.actor!==actor||!actor.group.getObjectById(decoration.id))return;
        const crown=template.clone(true),size=new THREE.Box3().setFromObject(crown).getSize(new THREE.Vector3());
        crown.scale.setScalar(.7/Math.max(.001,size.x,size.z));
        // Each resident owns its copy: recycling one actor must not dispose the shared template.
        crown.traverse(child=>{if(child instanceof THREE.Mesh){
          child.geometry=child.geometry.clone();
          child.material=Array.isArray(child.material)?child.material.map(m=>m.clone()):child.material.clone();
          child.castShadow=child.receiveShadow=true;
        }});
        const materials=new Set<THREE.Material>();
        decoration.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();for(const m of Array.isArray(child.material)?child.material:[child.material])materials.add(m);}});
        materials.forEach(m=>m.dispose());decoration.clear();decoration.add(crown);
        decoration.userData.crownBottom=0;decoration.userData.crownInset=-.16;decoration.userData.crownSourceSize=size.toArray();
        decoration.userData.assetSource='/models/city/props/royal-crown.glb';
        attachRoyalCrown(actor,decoration);
      }).catch(error=>console.error('Não foi possível carregar a coroa real',error));
    }
    dressCitizen(actor,r.citizen);
    actor.setAnimation(r.seated?(r.citizen.role==='rei'||r.citizen.role==='rainha'?'sit':'sitDrink'):r.walking?'walk':'idle');actor.update(.05);
    this.registerActor(r,actor);actor.group.position.copy(r.position);
    const bed=r.citizen.role==='princesa'?cityBedSide(r.home.userData.princessBed,1):(r.citizen.role==='rei'||r.citizen.role==='rainha')&&r.home.userData.princessPalace?royalCoupleLayout(r.home,r.citizen.role).bed:r.home.userData.npcBed;
    if(r.routine==='sleep'&&bed){this.sleeping.place(actor.group,r.home,bed);if(!r.home.userData.princessPalace)r.position.copy(actor.group.position);}
    if(r.seated&&r.citizen.role!=='rei'&&r.citizen.role!=='rainha')void loadCityPropTemplate('tavern-tankard').then(template=>{
      if(r.actor!==actor)return;
      const mug=template.clone(true),size=new THREE.Box3().setFromObject(mug).getSize(new THREE.Vector3());mug.scale.setScalar(.19/Math.max(size.y,.001));actor.equipProceduralWeapon(mug);
    });
  }
  update(dt:number,player:THREE.Vector3,heightAt:(x:number,z:number,feetY?:number)=>number,collide:(p:THREE.Vector3,r:number)=>void,worldTime=8/24){
    this.elapsed+=dt;this.spawnElapsed+=dt;this.routeBudget=1;

    if(this.elapsed>=1){
      this.elapsed=0;
      const layout=[...this.buildings.values()].map(b=>{b.updateWorldMatrix(true,false);return `${b.id}:${b.matrixWorld.elements.join(',')}:${b.userData.colliderRevision??0}`;}).join(';');
      if(layout!==this.navigationSignature){
        this.navigationSignature=layout;this.navigation.clear();this.companionNavigation.clear();this.companionSearch=null;this.companionRepath=0;this.pendingRoute=null;
        for(const r of this.residents)r.path=[];
      }

      const signature=[...this.buildings].map(([id,b])=>`${id}:${b.id}`).join(';');
      if(signature!==this.bindingSignature){
        this.bindingSignature=signature;
        const updated=createCityPopulation(this.buildings);
        this.population.splice(0,this.population.length,...updated);
        for(const r of this.residents){
          const citizen=updated.find(c=>c.id===r.citizen.id);if(!citizen)continue;
          r.citizen=citizen;
          r.home=this.buildings.get(citizen.homeId)??r.home;
          r.anchor=this.buildings.get(citizen.workId)??r.home;
          if(r.seated){r.seated=false;r.walking=true;r.local.set(1.4,.08,(r.home.userData.building?.depth??16)/2+2.5);}
          if(r.actor)r.actor.group.userData.resident={...citizen};
        }
        this.navigation.clear();this.pendingRoute=null;
      }
    }
    if(this.timeSyncPending)this.applyScheduledTime(worldTime);
    for(const r of this.residents){
      if(r.citizen.id===this.conversationId){this.updateConversation(r,dt,player);continue;}

      if(r.citizen.id===this.companion?.id&&this.companionBedHome){
        const home=this.companionBedHome,before=r.position.clone();
        const state=this.princessRoutine.update(dt,worldTime,home,r.position,heightAt,collide,undefined,{target:'bed',label:'descansando ao seu lado',sleep:true})!;
        r.anchor=home;r.walking=state.walking;r.indoors=true;r.atWork=false;r.seated=false;r.routine=state.asleep?'sleep':'companion';
        const direction=r.position.clone().sub(before);if(direction.lengthSq()>.00001)r.angle=Math.atan2(direction.x,direction.z);
        if(r.actor){
          const actor=r.actor;if(!state.asleep)this.sleeping.restore(actor.group);
          actor.group.position.copy(r.position);actor.group.rotation.set(0,r.angle,0);actor.setAnimation(state.walking?'walk':'idle');actor.update(dt);
          if(state.asleep)this.sleeping.place(actor.group,home,cityBedSide(state.bed,1));
          actor.group.userData.resident={...r.citizen,companion:true,activity:state.label,routine:r.routine};
        }
        this.companion!.position=r.position.toArray() as [number,number,number];continue;
      }
      if(r.citizen.id===this.companion?.id&&!this.companionAtEditedTime){this.updateCompanion(r,dt,player,heightAt,collide);continue;}
      if((r.citizen.role==='rei'||r.citizen.role==='rainha')&&r.home.userData.princessPalace){
        let routine=this.royalRoutines.get(r.citizen.id);
        if(!routine){routine=new RoyalCoupleRoutine();this.royalRoutines.set(r.citizen.id,routine);}
        const previous=r.position.clone();
        const state=routine.update(dt,worldTime,r.home,r.position,r.citizen.role,heightAt,collide);
        r.anchor=r.home;r.indoors=true;r.atWork=state.seated;r.walking=state.walking;r.seated=state.seated;r.routine=state.asleep?'sleep':'palace';
        const direction=r.position.clone().sub(previous);if(direction.lengthSq()>.00001)r.angle=Math.atan2(direction.x,direction.z);
        if(r.actor){
          const actor=r.actor;if(!state.asleep)this.sleeping.restore(actor.group);
          actor.group.position.copy(r.position);actor.group.rotation.set(0,r.angle,0);
          actor.setAnimation(state.seated?'sit':state.walking?'walk':'idle');actor.update(dt);
          const crown=actor.group.getObjectByName('CitizenRoleDecoration');if(crown)crown.visible=!state.asleep;
          if(state.asleep)this.sleeping.place(actor.group,r.home,state.bed);
          else if(state.seated)this.placeRoyalSeat(r,actor);
          actor.group.userData.resident={...r.citizen,activity:state.label,routine:r.routine};
        }
        continue;
      }
      if(r.citizen.role==='princesa'&&r.home.userData.princessPalace){
        const previous=r.position.clone();
        const state=this.princessRoutine.update(this.companionPaused?0:dt,worldTime,r.home,r.position,heightAt,collide)!;
        r.anchor=r.home;r.walking=state.walking;r.atWork=false;r.indoors=true;r.seated=false;r.routine=state.asleep?'sleep':'palace';
        if(r.actor){
          const actor=r.actor;if(!state.asleep)this.sleeping.restore(actor.group);
          const direction=r.position.clone().sub(previous);if(direction.lengthSq()>.00001)r.angle=Math.atan2(direction.x,direction.z);
          if(!state.asleep){actor.group.position.copy(r.position);actor.group.rotation.set(0,r.angle,0);}
          actor.setAnimation(r.walking?'walk':'idle');actor.update(dt);
          if(state.asleep)this.sleeping.place(actor.group,r.home,cityBedSide(state.bed,1));
          actor.group.userData.resident={...r.citizen,activity:state.label,routine:r.routine};
        }
        continue;
      }
      const routine=citizenRoutine(worldTime,r.citizen.role);
      if(!r.anchor.parent){if(r.actor)r.actor.group.visible=false;continue;}
      if(r.citizen.existingIndex!==undefined&&this.existingBusy(r.citizen.existingIndex)){
        if(r.actor){r.position.copy(r.actor.group.position);if(r.actor.group.visible)r.actor.update(dt);}continue;
      }
      const work=this.buildings.get(r.citizen.workId)??r.home;
      if(r.routine!==routine){
        const initial=!r.routine;
        if(r.atWork&&routine!=='work')r.position.copy(this.doorPoint(work));
        if(this.pendingRoute?.resident===r)this.pendingRoute=null;
        r.routine=routine;r.path=[];r.wait=0;r.seated=false;r.walking=false;r.atWork=false;
        if((routine==='roam'||routine==='work')&&(r.indoors||initial)){
          r.position.copy(this.homePoint(r,true));r.indoors=false;
        }
        if(routine==='work'&&!isPalaceStaff(r.citizen.role)&&r.citizen.role!=='cavalarico'&&(MERCHANT_ROLES[r.citizen.role]||work===r.home||initial))r.atWork=true;
      }
      r.anchor=r.atWork?work:r.home;
      const nearby=r.position.distanceToSquared(player)<70*70;
      r.wait-=dt;
      const traveling=routine==='roam'||routine==='return'&&!r.indoors||routine==='work'&&!r.atWork;
      if(traveling){
        if(!r.path.length&&r.wait<=0&&this.routeBudget>0&&!this.pendingRoute){
          this.routeBudget--;
          const destinations=[...this.buildings.values()].filter(b=>b.userData.building&&b.parent&&!b.userData.building.perimeter&&b.name!=='Cidade:tower');
          const target=routine==='return'?r.home:routine==='work'?work:destinations[(r.destination++*37+Math.floor(r.phase))%Math.max(1,destinations.length)]??r.home;
          const end=this.doorPoint(target);
          if(routine!=='roam'&&r.position.distanceTo(end)<4){
            r.atWork=routine==='work';r.indoors=routine==='return';r.walking=false;
          }else{
            this.pendingRoute={resident:r,search:this.navigation.routeSteps(r.position.clone(),end,heightAt,collide)};
          }
        }
        const next=r.path[0];
        if(next){
          this.direction.copy(next).sub(r.position);this.direction.y=0;
          const distance=this.direction.length(),step=Math.min(distance,dt*1.7);
          if(distance>.001){
            this.direction.divideScalar(distance);r.angle=Math.atan2(this.direction.x,this.direction.z);
            this.previous.copy(r.position);r.position.addScaledVector(this.direction,step);
            r.position.y=heightAt(r.position.x,r.position.z);collide(r.position,.32);
            r.walking=true;
            if(r.position.distanceToSquared(this.previous)<step*step*.05){r.path=[];r.wait=1;}
          }
          if(distance<.25){r.path.shift();if(!r.path.length){r.walking=false;r.wait=routine==='roam'?2+r.phase%5:0;}}
        }else r.walking=false;
      }else if(routine!=='work'){
        r.indoors=true;r.walking=false;
      }
      if(r.atWork){
        r.anchor=work;
        if(isPalaceStaff(r.citizen.role)&&work.userData.princessPalace){
          let staff=this.staffRoutines.get(r.citizen.id);if(!staff){staff=new PalaceStaffRoutine();this.staffRoutines.set(r.citizen.id,staff);}
          const before=r.position.clone(),state=staff.update(dt,worldTime,work,r.position,r.citizen,heightAt,collide);
          r.walking=state.walking;r.local.set(0,0,0);
          const direction=r.position.clone().sub(before);if(direction.lengthSq()>.00001)r.angle=Math.atan2(direction.x,direction.z);
          if(r.actor)r.actor.group.userData.staffActivity=state.label;
        }else if(r.citizen.role==='cavalarico'){
          // Walk between the three stalls, pausing to tend each horse.
          r.careTime+=dt;const index=Math.floor(r.careTime/18)%3;
          const target=new THREE.Vector3([-4,0,4][index],.08,2.6).applyMatrix4(work.matrixWorld);
          this.direction.copy(target).sub(r.position);this.direction.y=0;
          const distance=this.direction.length();r.walking=distance>.12;
          if(r.walking){this.direction.normalize();r.position.addScaledVector(this.direction,Math.min(distance,dt*1.2));r.position.y=heightAt(r.position.x,r.position.z);collide(r.position,.32);r.angle=Math.atan2(this.direction.x,this.direction.z);}
        }else{r.position.copy(this.workPoint(r,work));r.walking=false;}
        const forward=new THREE.Vector3(0,0,1).transformDirection(work.matrixWorld);
        if(!isPalaceStaff(r.citizen.role)&&(r.citizen.role!=='cavalarico'||!r.walking))r.angle=Math.atan2(forward.x,forward.z)+(r.citizen.role==='cavalarico'?Math.PI:0);
      }else if(r.indoors)r.position.copy(this.homePoint(r,false,routine==='sleep'));
      if(r.actor){
        const actor=r.actor;
        if(routine!=='sleep')this.sleeping.restore(actor.group);
        actor.group.position.copy(r.position);
        actor.group.rotation.set(0,r.angle,0);
        const royalSeated=r.atWork&&(r.citizen.role==='rei'||r.citizen.role==='rainha')&&!!work.userData.npcRoyalSeats;
        actor.setAnimation(royalSeated?'sit':r.walking?'walk':r.citizen.role==='cavalarico'&&r.atWork?'tendHorse':'idle');
        if(nearby)actor.update(dt);
        if(royalSeated){
          const seat=work.userData.npcRoyalSeats[r.citizen.role==='rei'?0:1];
          const target=work.localToWorld(new THREE.Vector3(seat[0],seat[1]+.025,seat[2]));
          actor.group.updateMatrixWorld(true);
          const hips=actor.group.getObjectByName('Hips');
          if(hips){const pelvis=hips.getWorldPosition(new THREE.Vector3());actor.group.position.add(target.sub(pelvis));}
          actor.group.updateMatrixWorld(true);
          const feet=['Foot_L','Foot_R'].map(name=>actor.group.getObjectByName(name)).filter((o):o is THREE.Object3D=>!!o);
          const dais=work.userData.throneDaises?.[0];
          if(dais&&feet.length){
            const floor=work.localToWorld(new THREE.Vector3(0,dais.top,0)).y;
            const lowest=Math.min(...feet.map(foot=>foot.getWorldPosition(new THREE.Vector3()).y));
            actor.group.position.y+=floor+.04-lowest;
          }
          r.position.copy(actor.group.position);
        }
        if(routine==='sleep'&&r.indoors&&r.home.userData.npcBed){
          this.sleeping.place(actor.group,r.home,r.home.userData.npcBed);
          r.position.copy(actor.group.position);
        }
        actor.group.userData.resident={...r.citizen,activity:royalSeated?'sentado no trono':routine==='sleep'?'dormindo':r.atWork&&r.citizen.role==='cavalarico'?'cuidando dos cavalos':r.atWork?(actor.group.userData.staffActivity??'em serviço'):r.indoors?'em casa':routine==='return'?'voltando para casa':routine==='work'?'indo trabalhar':'passeando',routine};
      }
    }

    // Resume A* for at most 2 ms per frame; an unreachable destination must not freeze play.
    const routeDeadline=performance.now()+2;
    while(this.pendingRoute&&this.pendingRoute.resident.citizen.id!==this.conversationId&&performance.now()<routeDeadline){
      const result=this.pendingRoute.search.next();
      if(result.done){
        const r=this.pendingRoute.resident;r.path=result.value;r.wait=r.path.length?0:3;
        this.pendingRoute=null;
      }
    }
    if(this.spawnElapsed>=.15){
      this.spawnElapsed=0;
      const next=this.residents.filter(r=>!r.actor&&r.anchor.parent&&r.position.distanceToSquared(player)<70*70).sort((a,b)=>this.spawnPriority(a)-this.spawnPriority(b)||a.position.distanceToSquared(player)-b.position.distanceToSquared(player))[0];
      if(next)this.createActor(next,player);
    }
    const active=this.residents.filter(r=>r.actor&&r.position.distanceToSquared(player)<70*70);
    for(let i=0;i<active.length;i++){
      const r=active[i];if(r.citizen.id===this.conversationId||r.indoors||r.seated||r.citizen.role!=='morador'||r.citizen.existingIndex!==undefined&&this.existingBusy(r.citizen.existingIndex))continue;
      for(let j=0;j<i;j++){const other=active[j];if(Math.abs(other.position.y-r.position.y)<1)resolveCircleCollision(r.actor!.group.position,.32,other.actor!.group.position,.32,this.previous);}
      if(Math.abs(player.y-r.position.y)<1.5)resolveCircleCollision(r.actor!.group.position,.32,player,.38,this.previous);
    }
  }
  transformWithCity(matrix:THREE.Matrix4){
    for(const r of this.residents){
      r.position.applyMatrix4(matrix);
      for(const point of r.path)point.applyMatrix4(matrix);
      this.direction.set(Math.sin(r.angle),0,Math.cos(r.angle)).transformDirection(matrix);
      r.angle=Math.atan2(this.direction.x,this.direction.z);
      if(r.actor){r.actor.group.position.copy(r.position);r.actor.group.rotation.set(0,r.angle,0);}
    }
    this.navigation.clear();this.pendingRoute=null;this.navigationSignature='';
  }
  private spawnPriority(r:Resident){
    if(r.citizen.id===this.companion?.id)return -1;
    return MERCHANT_ROLES[r.citizen.role]?0:isPalaceStaff(r.citizen.role)?1:r.citizen.role==='padre'||r.citizen.role==='guilda'?1:r.citizen.role.startsWith('guarda-')?2:3;
  }
  private placeRoyalSeat(r:Resident,actor:ProceduralCharacter){
    const forward=new THREE.Vector3(0,0,1).transformDirection(r.home.matrixWorld);
    actor.group.rotation.set(0,Math.atan2(forward.x,forward.z),0);
          const seat=r.home.userData.npcRoyalSeats[r.citizen.role==='rei'?0:1];
          const target=r.home.localToWorld(new THREE.Vector3(seat[0],seat[1]+.025,seat[2]));
          actor.group.updateMatrixWorld(true);
          const hips=actor.group.getObjectByName('Hips');
          if(hips){const pelvis=hips.getWorldPosition(new THREE.Vector3());actor.group.position.add(target.sub(pelvis));}
          actor.group.updateMatrixWorld(true);
          const feet=['Foot_L','Foot_R'].map(name=>actor.group.getObjectByName(name)).filter((o):o is THREE.Object3D=>!!o);
          const dais=r.home.userData.throneDaises?.[0];
          if(dais&&feet.length){
            const floor=r.home.localToWorld(new THREE.Vector3(0,dais.top,0)).y;
            const lowest=Math.min(...feet.map(foot=>foot.getWorldPosition(new THREE.Vector3()).y));
            actor.group.position.y+=floor+.04-lowest;
          }

  }
  private doorPoint(building:THREE.Group){
    building.updateWorldMatrix(true,false);
    if(building.userData.princessPalace)return new THREE.Vector3(...building.userData.princessPalace.nodes.cityEntry as [number,number,number]).applyMatrix4(building.matrixWorld);
    return new THREE.Vector3(0,.08,(building.userData.building?.depth??16)/2+3).applyMatrix4(building.matrixWorld);
  }
  private workPoint(r:Resident,work:THREE.Group){
    work.updateWorldMatrix(true,false);
    const info=work.userData.building??{width:16,depth:16,doorWidth:4};
    const p=new THREE.Vector3(0,.08,-info.depth*.27-1.1);
    if(r.citizen.role==='princesa'&&work.userData.npcRoyalDaughterPosition)return p.fromArray(work.userData.npcRoyalDaughterPosition).applyMatrix4(work.matrixWorld);
    if((r.citizen.role==='rei'||r.citizen.role==='rainha')&&work.userData.npcRoyalPositions){
      return p.fromArray(work.userData.npcRoyalPositions[r.citizen.role==='rei'?0:1]).applyMatrix4(work.matrixWorld);
    }
    if(r.citizen.role==='guarda-palacio'&&work.userData.npcGuardPosts){
      return p.fromArray(work.userData.npcGuardPosts[r.citizen.post%work.userData.npcGuardPosts.length]).applyMatrix4(work.matrixWorld);
    }
    if(r.citizen.role==='padre'){
      const altar=work.userData.npcAltar;
      p.set(0,.08,altar?.z??-info.depth*.34-1.5);
    }else if(r.citizen.role==='freira'){
      p.set((r.citizen.post%2?1:-1)*Math.min(3,info.width*.25),.08,-info.depth*.12+Math.floor(r.citizen.post/2)*2.2);
    }else if(r.citizen.role==='guarda-torre')p.set(0,10.825,0);
    else if(r.citizen.role==='guarda-arqueiro'){
      const surface=(work.userData.walkSurfaces as number[][]|undefined)?.filter(a=>a[4]>1).sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]))[0];
      if(surface)p.set((surface[0]+surface[2])/2,surface[4]+.02,(surface[1]+surface[3])/2);
      else p.set(0,10.825,0);
    }else if(r.citizen.role==='guarda-palacio'){
      const side=r.citizen.post%2?-1:1,row=Math.floor(r.citizen.post/2);
      p.set(side*(row===0?info.doorWidth/2+1.3:info.width*.32),.08,row===0?info.depth/2+1.3:row===1?info.depth*.15:-info.depth*.28);
    }else if(r.citizen.role==='rei'||r.citizen.role==='rainha')p.set(r.citizen.role==='rei'?-1.5:1.5,.08,-info.depth*.27);
    else if(work.userData.npcCounter){const point=work.userData.npcCounter;p.set(point.x,point.y,point.z);}
    return p.applyMatrix4(work.matrixWorld);
  }
  merchant(id:string):MerchantSession|null{
    const r=this.residents.find(r=>r.citizen.id===id),kind=r&&MERCHANT_ROLES[r.citizen.role];
    return r&&kind&&r.atWork&&r.routine==='work'&&r.anchor.parent?{id,name:r.citizen.name,kind,workId:r.citizen.workId}:null;
  }
  guildContact(player:THREE.Vector3){
    const r=this.residents.find(r=>r.citizen.role==='guilda'&&r.atWork&&r.routine==='work'&&r.anchor.parent&&Math.abs(r.position.y-player.y)<2&&r.position.distanceToSquared(player)<5.5*5.5);
    if(!r)return null;
    const p=r.anchor.worldToLocal(player.clone()),info=r.anchor.userData.building;
    return info&&Math.abs(p.x)<info.width/2-.2&&Math.abs(p.z)<info.depth/2-.2?{id:r.citizen.id,name:r.citizen.name}:null;
  }
  private tradeAvailable(r:Resident,player:THREE.Vector3){
    if(!MERCHANT_ROLES[r.citizen.role]||!r.atWork||r.routine!=='work'||!r.anchor.parent||Math.abs(r.position.y-player.y)>=2||r.position.distanceToSquared(player)>=5.5*5.5)return false;
    // The player must be inside the shop; proximity through an exterior wall is insufficient.
    if(r.citizen.role==='cavalarico')return true;
    const p=r.anchor.worldToLocal(player.clone()),info=r.anchor.userData.building;
    return !!info&&Math.abs(p.x)<info.width/2-.2&&Math.abs(p.z)<info.depth/2-.2;
  }
  canTrade(id:string,player:THREE.Vector3){
    const r=this.residents.find(r=>r.citizen.id===id);
    return !!r&&this.tradeAvailable(r,player);
  }
  nearestMerchant(player:THREE.Vector3){
    const r=this.residents.filter(r=>this.tradeAvailable(r,player)).sort((a,b)=>a.position.distanceToSquared(player)-b.position.distanceToSquared(player))[0];
    return r?this.merchant(r.citizen.id):null;
  }
  private homePoint(r:Resident,outside:boolean,sleep=false){
    r.home.updateWorldMatrix(true,false);
    const info=r.home.userData.building,bed=r.home.userData.npcBed;
    const p=new THREE.Vector3(0,.08,(info?.depth??16)/2+(outside?3:-2));
    if(sleep&&bed){const anchor=bed as CityBedAnchor;p.set(0,anchor.mattressY,0).applyMatrix4(new THREE.Matrix4().fromArray(anchor.matrix));}
    else if(sleep){const room=r.home.userData.upperBedroom;if(room)p.set(room.x,room.y+.2,room.z);}
    return p.applyMatrix4(r.home.matrixWorld);
  }
  updateLabels(camera:THREE.Camera,player:THREE.Vector3,viewport:HTMLElement){
    this.viewFrustum.setFromProjectionMatrix(this.viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const r of this.residents){
      const {actor,label}=r;if(!actor||!label)continue;
      this.actorBounds.center.copy(actor.group.position).y+=1.3;
      actor.group.visible=!!r.anchor.parent&&(r.routine!=='sleep'||!!r.home.userData.npcBed||r.citizen.role==='princesa'&&!!r.home.userData.princessBed||(r.citizen.role==='rei'||r.citizen.role==='rainha')&&!!r.home.userData.kingBedroom)&&actor.group.position.distanceToSquared(player)<85*85&&this.viewFrustum.intersectsSphere(this.actorBounds);
      this.scratch.copy(actor.group.position);this.scratch.y+=2.95;this.scratch.project(camera);
      const visible=r.routine!=='sleep'&&actor.group.visible&&actor.group.position.distanceToSquared(player)<=(!r.citizen.role.startsWith('guarda-')&&CITIZEN_ROLE_LABELS[r.citizen.role]?45*45:12*12)&&this.scratch.z>-1&&this.scratch.z<1&&Math.abs(this.scratch.x)<1&&Math.abs(this.scratch.y)<1;
      label.classList.toggle('visible',visible);
      if(visible){label.style.left=`${(this.scratch.x*.5+.5)*viewport.clientWidth}px`;label.style.top=`${(-this.scratch.y*.5+.5)*viewport.clientHeight}px`;}
    }
  }
  resolveCollisions(position:THREE.Vector3,radius:number){
    for(const r of this.residents)if(r.anchor.parent&&Math.abs(position.y-r.position.y)<1.8)resolveCircleCollision(position,radius,r.actor?.group.position??r.position,.3,this.scratch);
  }
}
