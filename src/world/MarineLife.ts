import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { GameAudio } from "../audio/GameAudio";
import type { ProceduralCharacter } from "../character";
import { saveInventory } from "../inventory/persistence";
import type { PersistedInventory } from "../inventory/types";
import { physicalDamage } from "../player/PlayerCombat";
import { ANIMAL_TERRITORIES,findAnimalHabitatPoint,isAnimalHabitat } from "./AnimalTerritories";
import type { OpenWorld } from "./OpenWorld";

type MarineLife = {
  kind: "shark" | "trout" | "seagull";
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  angle: number;
  radius: number;
  speed: number;
  altitude: number;
  attackCooldown: number;
  attackElapsed?: number;
  attackDidDamage: boolean;
  attackBase: THREE.Vector3;
  velocity: THREE.Vector3;
  home: THREE.Vector3;
};

export interface MarineLifeContext {
  loadSharedGltf: (url: string, onLoad: (gltf: GLTF) => void, _progress?: unknown, onError?: (error: unknown) => void) => void;
  scene: THREE.Scene;
  seaCenter: THREE.Vector3;
  openWorld: OpenWorld;
  character: ProceduralCharacter;
  seaWaterMaterial: THREE.MeshPhysicalMaterial;
  qualityLevel: "low" | "medium" | "high";
  playerDodgingHit: () => boolean;
  totalStats: () => { attack: number; defense: number; hp: number; stamina: number; };
  inventoryState: PersistedInventory;
  resolveWorldCollisions: (position: THREE.Vector3, radius: number, ignored?: THREE.Object3D) => void;
  gameAudio: GameAudio;
  showPlayerDamage: () => void;
  refreshHud: () => void;
  setPlayStatus: (text: string) => void;
  camera: THREE.PerspectiveCamera;
}

// Initialize only at the original bootstrap point. Live accessors preserve later state changes.
export function initializeMarineLife(context: MarineLifeContext) {
  const { loadSharedGltf, scene, seaCenter, openWorld, character, seaWaterMaterial, gameAudio, showPlayerDamage, setPlayStatus, camera } = context;

  const marineLife: MarineLife[] = [];
  const SHARK_MODEL_FORWARD_OFFSET = Math.PI * .5;
  const turnMarineHeading = (heading: THREE.Vector3, target: THREE.Vector3, maxTurn: number) => {
    if (target.lengthSq() < .0001) return;
    const currentAngle = Math.atan2(heading.x, heading.z);
    const targetAngle = Math.atan2(target.x, target.z);
    const difference = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
    const angle = currentAngle + THREE.MathUtils.clamp(difference, -maxTurn, maxTurn);
    heading.set(Math.sin(angle), 0, Math.cos(angle));
  };
  const faceMarineHeading = (life: MarineLife) => {
    life.root.rotation.y = Math.atan2(life.velocity.x, life.velocity.z) +
      (life.kind === "shark" ? SHARK_MODEL_FORWARD_OFFSET : 0);
  };
  function loadMarineLife(kind: MarineLife["kind"], url: string, count: number) {
    for (let index = 0; index < count; index++) loadSharedGltf(url, (gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const initial = new THREE.Box3().setFromObject(model);
      const targetHeight = kind === "shark" ? 3 : kind === "trout" ? .34 : .46;
      model.scale.setScalar(targetHeight / Math.max(initial.getSize(new THREE.Vector3()).y, .001));
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) { child.castShadow = child.receiveShadow = true; }
      });
      const root = new THREE.Group();
      root.name = `${kind === "shark" ? "Tubarão" : kind === "trout" ? "Truta" : "Gaivota"} ${index + 1}`;
      root.userData.animalModel = url;
      root.userData.modelLabel = kind === "shark" ? "Tubarão" : kind === "trout" ? "Truta" : "Gaivota";
      root.add(model);
      scene.add(root);
      let mixer: THREE.AnimationMixer | undefined;
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        const preferred = kind === "trout" ? "Trout_Swim" : kind === "seagull" ? "Take 001" : "ArmatureAction";
        (THREE.AnimationClip.findByName(gltf.animations, preferred) ?? gltf.animations[0]) &&
          mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, preferred) ?? gltf.animations[0]).play();
      }
      const angle = index / count * Math.PI * 2 + (kind === "shark" ? 1.2 : .35);
      const life: MarineLife = {
        kind, root, mixer, angle,
        radius: kind === "shark" ? 5.4 : kind === "trout" ? 2.7 + index * .65 : 4.5 + index * .7,
        speed: kind === "shark" ? 3.8+index*.22 : kind === "trout" ? .55 + index * .08 : .28 + index * .025,
        altitude: kind === "seagull" ? 3.4 + index * .55 : kind === "shark" ? -.72 : -1.05 - index * .08,
        attackCooldown: 0, attackDidDamage: false, attackBase: new THREE.Vector3(),
        velocity: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize(),
        home: new THREE.Vector3(),
      };
      root.position.set(seaCenter.x + Math.cos(angle) * life.radius, life.altitude, seaCenter.z + Math.sin(angle) * life.radius);
      if (kind !== "seagull") {
        const point=findAnimalHabitatPoint(openWorld,kind,index);
        if(!point){root.visible=false;return;}
        root.position.set(point[0],openWorld.getWaterLevelAt(point[0],point[2])+life.altitude,point[2]);
        life.home.copy(root.position);
        root.userData.habitat="Mar";
      }
      faceMarineHeading(life);
      marineLife.push(life);
    }, undefined, (error) => console.error(`Não foi possível carregar ${kind}`, error));
  }
  loadMarineLife("shark","/models/animals/shark/model.glb",5);
  loadMarineLife("trout","/models/animals/trout/model.glb",40);

  // 40 animated trout above plus 260 lightweight school fish: 300 fish across
  // the map without creating 300 animation mixers and hundreds of draw calls.
  const schoolFishCount=260;
  const schoolFishGeometry=new THREE.IcosahedronGeometry(.18,0);
  schoolFishGeometry.scale(1.9,.72,.58);
  const schoolFishMaterial=new THREE.MeshLambertMaterial({color:"#70a9b5",flatShading:true});
  const schoolFish=new THREE.InstancedMesh(schoolFishGeometry,schoolFishMaterial,schoolFishCount);
  schoolFish.name="Cardume do mapa · 260 peixes";schoolFish.frustumCulled=false;schoolFish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const schoolFishHomes:Array<THREE.Vector3>=[];
  const schoolFishTransform=new THREE.Object3D();
  const schoolFishRegionCenter=new THREE.Vector3(Number.POSITIVE_INFINITY,0,Number.POSITIVE_INFINITY);
  for(let index=0;index<schoolFishCount;index++){
    const point=findAnimalHabitatPoint(openWorld,"trout",index+40);
    const home=point
      ? new THREE.Vector3(point[0],openWorld.getWaterLevelAt(point[0],point[2])-1.15-(index%5)*.16,point[2])
      : new THREE.Vector3(900,-1.2,-650);
    schoolFishHomes.push(home);schoolFishTransform.position.copy(home);schoolFishTransform.scale.setScalar(.7+(index%7)*.045);schoolFishTransform.updateMatrix();schoolFish.setMatrixAt(index,schoolFishTransform.matrix);
  }
  schoolFish.instanceMatrix.needsUpdate=true;scene.add(schoolFish);
  const localWaterPoint=(species:"shark"|"trout",index:number,radius=42,minDistance=5)=>{
    for(let attempt=0;attempt<96;attempt++){
      const angle=index*2.399963+attempt*1.618034,distance=minDistance+((index*.754877+attempt*.56984)%1)*Math.max(1,radius-minDistance);
      const x=character.group.position.x+Math.cos(angle)*distance,z=character.group.position.z+Math.sin(angle)*distance;
      if(isAnimalHabitat(openWorld,species,x,z))return new THREE.Vector3(x,openWorld.getWaterLevelAt(x,z),z);
    }
    return null;
  };
  const updateSchoolFish=(elapsed:number)=>{
    if(openWorld.isWaterAt(character.group.position.x,character.group.position.z)&&schoolFishRegionCenter.distanceToSquared(character.group.position)>1600){
      schoolFishRegionCenter.copy(character.group.position);
      for(let index=0;index<Math.min(200,schoolFishCount);index++){
        const point=localWaterPoint("trout",index,48);
        if(point)schoolFishHomes[index].set(point.x,point.y-1.05-(index%6)*.14,point.z);
      }
    }
    for(let index=0;index<schoolFishCount;index++){
      const home=schoolFishHomes[index],phase=elapsed*(.32+(index%9)*.025)+index*2.399;
      const x=home.x+Math.cos(phase)*(1.2+(index%6)*.3),z=home.z+Math.sin(phase)*(1.2+(index%6)*.3);
      const bottom=openWorld.getHeightAt(x,z)+.28,top=openWorld.getWaterLevelAt(x,z)-.3;
      const dive=.5+Math.sin(elapsed*(.16+(index%13)*.009)+index*1.731)*.46;
      const y=top>bottom?THREE.MathUtils.lerp(bottom,top,dive):home.y;
      schoolFishTransform.position.set(x,y,z);
      schoolFishTransform.rotation.set(0,-phase+Math.PI*.5,0);schoolFishTransform.scale.setScalar(.7+(index%7)*.045);schoolFishTransform.updateMatrix();schoolFish.setMatrixAt(index,schoolFishTransform.matrix);
    }
    schoolFish.instanceMatrix.needsUpdate=true;
  };

  function updateMarineLife(delta: number, elapsed: number) {
    seaWaterMaterial.opacity = .72 + Math.sin(elapsed * 1.4) * .045;
    for (const [lifeIndex,life] of marineLife.entries()) {
      const marineRange=context.qualityLevel==="low"?42:context.qualityLevel==="medium"?65:95;
      if(life.root.position.distanceToSquared(character.group.position)>marineRange*marineRange){life.root.visible=false;continue;}
      life.root.visible=true;
      const playerInWater=openWorld.isWaterAt(character.group.position.x,character.group.position.z);
      const shouldBeLocal=life.kind!=="seagull"&&playerInWater&&life.root.position.distanceToSquared(character.group.position)>(life.kind==="shark"?55*55:38*38);
      if(shouldBeLocal&&life.kind!=="seagull"){
        const point=localWaterPoint(life.kind,lifeIndex,life.kind==="shark"?55:30,life.kind==="shark"?20:5);
        if(point){life.root.position.set(point.x,point.y+life.altitude,point.z);life.home.copy(life.root.position);life.root.visible=true;}
      }
      if(life.kind!=="seagull"&&!isAnimalHabitat(openWorld,life.kind,life.root.position.x,life.root.position.z)){
        const point=findAnimalHabitatPoint(openWorld,life.kind,marineLife.indexOf(life));
        if(!point){life.root.visible=false;continue;}
        life.root.position.set(point[0],openWorld.getWaterLevelAt(point[0],point[2])+life.altitude,point[2]);life.home.copy(life.root.position);life.root.visible=true;
      }
      const previousPosition=life.root.position.clone();
      life.mixer?.update(delta);
      life.attackCooldown = Math.max(0, life.attackCooldown - delta);
      if (life.kind === "shark") {
        const playerInSea = isAnimalHabitat(openWorld,"shark",character.group.position.x,character.group.position.z);
        const playerDistance = character.group.position.distanceTo(life.root.position);
        if (life.attackElapsed !== undefined) {
          life.attackElapsed += delta;
          const phase = Math.min(1, life.attackElapsed / .72), lunge = Math.sin(phase * Math.PI);
          const direction = character.group.position.clone().sub(life.attackBase).setY(0).normalize();
          life.root.position.copy(life.attackBase).addScaledVector(direction, lunge * .7);
          life.root.rotation.x = -lunge * .18;
          if (!life.attackDidDamage && phase >= .4) {
            life.attackDidDamage = true;
            if (character.group.position.distanceTo(life.root.position) <= 1.6 && !context.playerDodgingHit()) {
              const damage=physicalDamage(50,context.totalStats().defense);
              context.inventoryState.hp = Math.max(0, context.inventoryState.hp - damage);
              character.group.position.addScaledVector(direction,1.4);context.resolveWorldCollisions(character.group.position,.32,character.group);
              gameAudio.hit();showPlayerDamage();context.refreshHud();saveInventory(context.inventoryState);
              setPlayStatus(`Tubarão atacou: -${damage} HP`);
            }
          }
          if (phase >= 1) {
            life.root.position.copy(life.attackBase); life.root.rotation.x = 0;
            life.attackElapsed = undefined; life.attackCooldown = 4;
            life.velocity.copy(life.root.position).sub(character.group.position).setY(0);
            if(life.velocity.lengthSq()<.001)life.velocity.set(Math.cos(lifeIndex),0,Math.sin(lifeIndex));
            life.velocity.normalize();
          }
        } else if (playerInSea && playerDistance < 7.5 && life.attackCooldown===0) {
          const direction = character.group.position.clone().sub(life.root.position).setY(0);
          if (direction.lengthSq() > .001) {
            direction.normalize();
            turnMarineHeading(life.velocity, direction, delta * 1.35);
            life.root.position.addScaledVector(life.velocity, 2.9 * delta);
            faceMarineHeading(life);
          }
          if (playerDistance <= 1.45 && life.attackCooldown === 0) {
            life.attackElapsed = 0; life.attackDidDamage = false; life.attackBase.copy(life.root.position);
          }
        } else {
          const turn=Math.sin(elapsed*.17+lifeIndex*2.31)*delta*.34;
          life.velocity.applyAxisAngle(camera.up,turn).normalize();
          life.root.position.addScaledVector(life.velocity, life.speed * delta);
          const bottom=openWorld.getHeightAt(life.root.position.x,life.root.position.z)+.55;
          const top=openWorld.getWaterLevelAt(life.root.position.x,life.root.position.z)-.65;
          const dive=.5+Math.sin(elapsed*(.19+(lifeIndex%5)*.027)+lifeIndex*2.173)*.45;
          life.root.position.y=top>bottom?THREE.MathUtils.lerp(bottom,top,dive):top;
          faceMarineHeading(life);
        }
      } else if (life.kind === "trout") {
        life.root.position.addScaledVector(life.velocity, life.speed * delta);
        const bottom=openWorld.getHeightAt(life.root.position.x,life.root.position.z)+.24;
        const top=openWorld.getWaterLevelAt(life.root.position.x,life.root.position.z)-.28;
        const dive=.5+Math.sin(elapsed*(.22+(lifeIndex%11)*.013)+lifeIndex*1.917)*.46;
        life.root.position.y=top>bottom?THREE.MathUtils.lerp(bottom,top,dive):top;
        life.root.rotation.y = Math.atan2(life.velocity.x, life.velocity.z);
      } else {
        life.angle += delta * life.speed;
        life.root.position.set(
          seaCenter.x + Math.cos(life.angle) * life.radius,
          life.altitude + Math.sin(elapsed * (life.kind === "seagull" ? 1.4 : 2.2) + life.angle) * (life.kind === "seagull" ? .28 : .06),
          seaCenter.z + Math.sin(life.angle) * life.radius,
        );
        life.root.rotation.y = -life.angle;
        life.root.rotation.z = Math.sin(elapsed + life.angle) * .08;
      }
      const outsideHabitat=life.kind!=="seagull"&&!isAnimalHabitat(openWorld,life.kind,life.root.position.x,life.root.position.z);
      const outsidePatrol=life.kind!=="seagull"&&life.kind!=="shark"&&Math.hypot(life.root.position.x-life.home.x,life.root.position.z-life.home.z)>ANIMAL_TERRITORIES[life.kind].patrol;
      if(life.kind!=="seagull"&&(outsideHabitat||outsidePatrol)){
        life.root.position.copy(previousPosition);
        if(life.kind==="shark")life.velocity.applyAxisAngle(camera.up,.32+(lifeIndex%3)*.08).normalize();
        else life.velocity.copy(life.home).sub(previousPosition).setY(0).normalize();
        life.attackElapsed=undefined;
      }
    }
  }

    return {
    updateMarineLife,
    updateSchoolFish,
  };
}
