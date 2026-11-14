import * as THREE from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { GameAudio } from "../audio/GameAudio";
import type { ProceduralCharacter } from "../character";
import { normalizeDamage,targetHeight,targetRadius } from "../combat/CombatRules";
import type { WorldEditorStore } from "../editor/WorldEditorSupport";
import { grantExperience,recordGuildKill } from '../guild/quests';
import { animalLoot } from '../inventory/animalLoot';
import { saveInventory } from "../inventory/persistence";
import type { PersistedInventory } from "../inventory/types";
import { ANIMAL_TERRITORIES,animalPatrolPoints,findAnimalHabitatPoint,isAnimalHabitat } from "./AnimalTerritories";
import type { OpenWorld } from "./OpenWorld";

type LootEntry = { itemId: string; quantity: number };
export type Prey = {
  id: "deer" | "rabbit" | "chicken" | "rat" | "raccoon" | "bear" | "wolf" | "puma";
  label: string;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  dieClip: string;
  headAnchor: THREE.Object3D;
  hud: HTMLDivElement;
  hudUntil: number;
  loot: LootEntry[];
  deathElapsed?: number;
  hitElapsed?: number;
  hitStartPosition: THREE.Vector3;
  hitDirection: THREE.Vector3;
  hitBaseRotationX: number;
  hitBaseRotationZ: number;
  fleeTime: number;
  routine: "stationary" | "patrol";
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  routinePause: number;
  moveSpeed: number;
  idleClip: string;
  currentMotion: "idle" | "walk";
  home: THREE.Vector3;
  territoryRadius: number;
  hostileState: "calm" | "chase" | "attack" | "return";
  attackCooldown: number;
  attackElapsed?: number;
  attackDidDamage: boolean;
  attackBasePosition: THREE.Vector3;
  attackDamage: number;
  predatorPosition?: THREE.Vector3;
  frozenUntil: number;
  avoidanceSign:-1|1;
  avoidanceUntil:number;
  howlCooldown:number;
  howlElapsed?:number;
  jaw?:THREE.Object3D;
  jawRest?:THREE.Quaternion;
};

export interface PreyAnimalsContext {
  openWorld: OpenWorld;
  totalStats: () => { attack: number; defense: number; hp: number; stamina: number; };
  loadSharedGltf: (url: string, onLoad: (gltf: GLTF) => void, _progress?: unknown, onError?: (error: unknown) => void) => void;
  scene: THREE.Scene;
  viewport: HTMLDivElement;
  buildState: WorldEditorStore["state"];
  LEGACY_CITY_CONTENT_ENABLED: boolean;
  gltfLoader: GLTFLoader;
  character: ProceduralCharacter;
  gameAudio: GameAudio;
  setPlayStatus: (text: string) => void;
  inventoryState: PersistedInventory;
  refreshHud: () => void;
}

// Initialize only at the original bootstrap point. Live accessors preserve later state changes.
export function initializePreyAnimals(context: PreyAnimalsContext) {
  const { openWorld, loadSharedGltf, scene, viewport, buildState, LEGACY_CITY_CONTENT_ENABLED, gltfLoader, character, gameAudio, setPlayStatus } = context;


  const preyAnimals: Prey[] = [];
  const WOLF_MOUNTAIN_PACKS=[[-550,-700],[350,-700]] as const;
  const FOREST_ANIMAL_IDS=new Set<Prey["id"]>(["bear","raccoon","deer","rabbit"]);
  const animalRoutinePause=(id:Prey["id"])=>
    FOREST_ANIMAL_IDS.has(id) ? .65+Math.random()*1.85 : 1.5+Math.random()*4;
  function placePreyInArena(prey: Prey) {
    const sameSpecies = preyAnimals.filter((item) => item.id === prey.id), index = Math.max(0, sameSpecies.indexOf(prey));
    const wolfPack=prey.id==="wolf"?WOLF_MOUNTAIN_PACKS[Math.min(WOLF_MOUNTAIN_PACKS.length-1,Math.floor(index/3))]:undefined;
    const point=wolfPack?findAnimalHabitatPoint(openWorld,prey.id,index,wolfPack,150):findAnimalHabitatPoint(openWorld,prey.id,index);
    if(!point){prey.root.visible=false;return;}
    const [x,,z]=point;
    const position = new THREE.Vector3(x, openWorld.getHeightAt(x, z), z); prey.position.copy(position); prey.home.copy(position); prey.root.position.copy(position); prey.hitStartPosition.copy(position); prey.attackBasePosition.copy(position);
    prey.waypoints = animalPatrolPoints(openWorld,prey.id,index,[x,z]).map((p)=>new THREE.Vector3(...p));
    prey.routine="patrol";prey.waypointIndex=0;prey.root.visible=true;
    prey.root.userData.habitat=ANIMAL_TERRITORIES[prey.id].label;
  }
  function constrainPreyToHabitat(prey: Prey, previous: THREE.Vector3) {
    if(prey.hp<=0)return;
    if(!isAnimalHabitat(openWorld,prey.id,prey.position.x,prey.position.z)){
      const recovery=isAnimalHabitat(openWorld,prey.id,previous.x,previous.z)
        ? previous.toArray() : findAnimalHabitatPoint(openWorld,prey.id,preyAnimals.indexOf(prey));
      if(!recovery){prey.root.visible=false;return;}
      prey.position.set(recovery[0],openWorld.getHeightAt(recovery[0],recovery[2]),recovery[2]);
      prey.root.position.copy(prey.position);
      prey.fleeTime=0;prey.attackElapsed=undefined;prey.hitElapsed=undefined;prey.hostileState="calm";
      prey.waypointIndex=(prey.waypointIndex+1)%Math.max(1,prey.waypoints.length);
      if(!isAnimalHabitat(openWorld,prey.id,prey.home.x,prey.home.z)){
        prey.home.copy(prey.position);
        prey.waypoints=animalPatrolPoints(openWorld,prey.id,preyAnimals.indexOf(prey),[prey.home.x,prey.home.z]).map(p=>new THREE.Vector3(...p));
      }
    }
    const verticalOffset=prey.root.position.y-prey.position.y;
    prey.position.y=openWorld.getHeightAt(prey.position.x,prey.position.z);
    prey.root.position.y=prey.position.y+verticalOffset;
  }
  const preyRadius = (prey: Prey) => prey.id === "bear" ? .82 : prey.id === "wolf" || prey.id === "puma" ? .52 : prey.id === "deer" ? .62 : prey.id === "chicken" ? .16 : prey.id === "rat" ? .065 : .24;
  const playerDamage = () => context.totalStats().attack;
  function updatePreyHud(prey: Prey) {
    (prey.hud.querySelector("b") as HTMLElement).style.width =
      `${Math.max(0, prey.hp / prey.maxHp) * 100}%`;
    prey.hud.classList.toggle("dead", prey.hp <= 0);
  }
  function loadPrey(config: {
    count?: number;
    id: "deer" | "rabbit" | "chicken" | "rat" | "raccoon" | "bear" | "wolf" | "puma";
    label: string;
    url: string;
    position: THREE.Vector3;
    height: number;
    idleClip: string;
    dieClip: string;
    hp: number;
    rotation: number;
    routine?: "stationary" | "patrol";
    waypoints?: THREE.Vector3[];
    moveSpeed?: number;
    territoryRadius?: number;
    attackDamage?: number;
  }) {
    if((config.count??1)>1){for(let i=0;i<config.count!;i++)loadPrey({...config,count:1,label:`${config.label} ${i+1}`});return;}
    loadSharedGltf(
      config.url,
      (gltf) => {
        const model = gltf.scene, root = new THREE.Group();
        root.add(model);
        root.name = config.label;
        root.userData.animalModel = config.url;
        root.userData.modelLabel = ({ deer: "Cervo", rabbit: "Coelho", chicken: "Galinha", rat: "Rato", raccoon: "Guaxinim", bear: "Urso", wolf: "Lobo", puma: "Leão-da-montanha" })[config.id];
        root.updateMatrixWorld(true);
        const initial = new THREE.Box3().setFromObject(root),
          height = initial.getSize(new THREE.Vector3()).y;
        model.scale.setScalar(config.height / Math.max(height, 0.001));
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root),
          center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x,-box.min.y,-center.z);
        root.position.copy(config.position);
        root.rotation.y = config.rotation;
        const raccoonMeshes: THREE.Mesh[] = [];
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (config.id === "bear") {
              const tintMaterial = (material: THREE.Material) => {
                const tinted = material.clone();
                if (tinted instanceof THREE.MeshStandardMaterial || tinted instanceof THREE.MeshLambertMaterial || tinted instanceof THREE.MeshPhongMaterial) {
                  if (child.name === "Object_8" || material.name === ".002")
                    tinted.color.set("#050505");
                  else tinted.color.multiply(new THREE.Color("#70452d"));
                  if (tinted.color.getHSL({ h: 0, s: 0, l: 0 }).l < .08)
                    tinted.color.set(child.name === "Object_8" ? "#050505" : "#38251d");
                  tinted.needsUpdate = true;
                }
                return tinted;
              };
              child.material = Array.isArray(child.material)
                ? child.material.map(tintMaterial)
                : tintMaterial(child.material);
            } else if (config.id === "raccoon") {
              raccoonMeshes.push(child);
              child.material = new THREE.MeshStandardMaterial({
                color: "#767b78",
                roughness: .86,
                metalness: 0,
              });
            }
          }
        });
        const jaw=root.getObjectByName("Jaw_M_032")??root.getObjectByName("Jaw_M_039")??[...root.children].find(child=>/jaw/i.test(child.name));
        if (config.id === "raccoon") {
          // This asset uses the retired specular/glossiness glTF extension.
          // Load its embedded diffuse texture explicitly so modern Three.js
          // renders the authored gray, black and cream markings.
          void gltf.parser.getDependency("texture", 0).then((texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            raccoonMeshes.forEach((mesh) => {
              mesh.material = new THREE.MeshStandardMaterial({
                map: texture,
                color: "#ffffff",
                roughness: .86,
                metalness: 0,
              });
            });
          }).catch((error) => console.error("Não foi possível carregar as cores do guaxinim", error));
        }
        scene.add(root);
        const mixer = new THREE.AnimationMixer(root),
          idle =
            THREE.AnimationClip.findByName(gltf.animations, config.idleClip) ??
            gltf.animations[0];
        if (idle) mixer.clipAction(idle).play();
        root.updateMatrixWorld(true);
        const placedBox = new THREE.Box3().setFromObject(root),
          headWorld = new THREE.Vector3(
            config.position.x,
            placedBox.max.y + 0.16,
            config.position.z,
          );
        const headAnchor = new THREE.Object3D();
        headAnchor.position.copy(root.worldToLocal(headWorld));
        root.add(headAnchor);
        const hud = document.createElement("div");
        hud.className = "animal-health";
        hud.innerHTML = `<i><b></b></i>`;
        viewport.append(hud);
        const prey: Prey = {
          id: config.id,
          label: config.label,
          root,
          mixer,
          position: config.position.clone(),
          hp: config.hp,
          maxHp: config.hp,
          dieClip: config.dieClip,
          headAnchor,
          hud,
          hudUntil: 0,
          loot: [],
          hitStartPosition: root.position.clone(),
          hitDirection: new THREE.Vector3(),
          hitBaseRotationX: root.rotation.x,
          hitBaseRotationZ: root.rotation.z,
          fleeTime: 0,
          routine: config.routine ?? "stationary",
          waypoints: config.waypoints?.map((point) => point.clone()) ?? [],
          waypointIndex: 0,
          routinePause: animalRoutinePause(config.id),
          moveSpeed: config.moveSpeed ?? (config.id === "deer" ? 0.5 : 0.34),
          idleClip: config.idleClip,
          currentMotion: "idle",
          home: config.position.clone(),
          territoryRadius: config.territoryRadius ?? 0,
          hostileState: "calm",
          attackCooldown: 0,
          attackDidDamage: false,
          attackBasePosition: root.position.clone(),
          attackDamage: config.attackDamage ?? 0,
          frozenUntil: 0,
          avoidanceSign:Math.random()<.5?-1:1,
          avoidanceUntil:0,
          howlCooldown:120,
          jaw,
          jawRest:jaw?.quaternion.clone(),
        };
        root.userData.clips = gltf.animations;
        preyAnimals.push(prey);
        if (buildState.worldPreset === "arena-island-v1") placePreyInArena(prey);
        updatePreyHud(prey);
      },
      undefined,
      (error) =>
        console.error(`Não foi possível carregar ${config.label}`, error),
    );
  }
  const deerSpawns = [
    { position: [2.8, -0.6], routine: "stationary", route: [] },
    {
      position: [-5.5, -3.5],
      routine: "patrol",
      route: [
        [-5.5, -3.5],
        [-1.5, -5.8],
        [2, -4.7],
      ],
    },
    {
      position: [7.5, 4.5],
      routine: "patrol",
      route: [
        [7.5, 4.5],
        [10, 1],
        [6, -1.5],
      ],
    },
    { position: [-9, 6], routine: "stationary", route: [] },
    {
      position: [11, -8],
      routine: "patrol",
      route: [
        [11, -8],
        [6, -9],
        [4, -6],
      ],
    },
    {
      position: [-12, -9],
      routine: "patrol",
      route: [
        [-12, -9],
        [-8, -5],
        [-13, -2],
      ],
    },
  ] as const;
  deerSpawns.forEach((spawn, index) =>
    loadPrey({
      count: 2,
      id: "deer",
      label: `Cervo ${index + 1}`,
      url: "/models/animals/deer/model.glb",
      position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
      height: 1.42,
      idleClip: "Armature|Eat",
      dieClip: "Armature|Die",
      hp: 80,
      rotation: -0.65,
      routine: spawn.routine,
      waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      moveSpeed: 1.35,
    }),
  );
  const rabbitSpawns = [
    { position: [1.9, 1.6], routine: "stationary", route: [] },
    {
      position: [-3, 3.5],
      routine: "patrol",
      route: [
        [-3, 3.5],
        [0.5, 5],
        [3, 3],
      ],
    },
    {
      position: [5.5, -4],
      routine: "patrol",
      route: [
        [5.5, -4],
        [8, -2],
        [7.5, 1],
      ],
    },
    { position: [-7, -7], routine: "stationary", route: [] },
    {
      position: [12, 7],
      routine: "patrol",
      route: [
        [12, 7],
        [9, 9],
        [6.5, 7],
      ],
    },
    {
      position: [-13, 4],
      routine: "patrol",
      route: [
        [-13, 4],
        [-10, 1],
        [-7, 3],
      ],
    },
    { position: [3, 10], routine: "stationary", route: [] },
    {
      position: [-2, -11],
      routine: "patrol",
      route: [
        [-2, -11],
        [2, -12],
        [4, -9],
      ],
    },
  ] as const;
  rabbitSpawns.forEach((spawn, index) =>
    loadPrey({
      count: 3,
      id: "rabbit",
      label: `Coelho ${index + 1}`,
      url: "/models/animals/rabbit/model.glb",
      position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
      height: 0.52,
      idleClip: "Armature.001|Idle",
      dieClip: "Armature.001|Die",
      hp: 30,
      rotation: -1.1,
      routine: spawn.routine,
      waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      moveSpeed: 2.1,
    }),
  );

  if(LEGACY_CITY_CONTENT_ENABLED)[
    { position: [-3, 3], route: [[-3, 3], [-1, 4], [-2, 6]] },
    { position: [-1.5, 2], route: [[-1.5, 2], [1, 3], [.5, 5]] },
    { position: [2, 4], route: [[2, 4], [4, 3], [3.5, 6]] },
    { position: [4, 5.5], route: [[4, 5.5], [2.5, 7], [5, 7.5]] },
  ].forEach((spawn, index) => loadPrey({
    id: "chicken",
    label: `Galinha ${index + 1}`,
    url: "/models/animals/chicken/model.glb",
    position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
    height: .416,
    idleClip: "chicken-rig|idle",
    dieClip: "__none__",
    hp: 20,
    rotation: index * 1.3,
    routine: "patrol",
    waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    moveSpeed: .48,
  }));

  if(LEGACY_CITY_CONTENT_ENABLED)[
    { position: [-11, -3], route: [[-11, -3], [-8, -2], [-5, -4], [-9, -5]] },
    { position: [-4, -1], route: [[-4, -1], [-7, -3], [-10, -1], [-6, 0]] },
    { position: [-9, 1], route: [[-9, 1], [-6, -1], [-5, -4], [-11, -2]] },
  ].forEach((spawn, index) => loadPrey({
    id: "rat",
    label: `Rato ${index + 1}`,
    url: "/models/animals/rat/model.glb",
    position: new THREE.Vector3(spawn.position[0], 0, spawn.position[1]),
    height: .125,
    idleClip: "__none__",
    dieClip: "__none__",
    hp: 8,
    rotation: index * 2,
    routine: "patrol",
    waypoints: spawn.route.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    moveSpeed: .72,
  }));

  loadPrey({
    id: "raccoon",
    count: 12,
    label: "Guaxinim",
    url: "/models/animals/raccoon/model.glb",
    position: new THREE.Vector3(-5.5, 0, 5.5),
    height: .58,
    idleClip: "Racoon_Idle",
    dieClip: "__none__",
    hp: 38,
    rotation: .7,
    routine: "patrol",
    waypoints: [
      new THREE.Vector3(-5.5, 0, 5.5),
      new THREE.Vector3(-2.5, 0, 7),
      new THREE.Vector3(-4, 0, 9),
      new THREE.Vector3(-7, 0, 7.5),
    ],
    moveSpeed: 1.2,
  });

  loadPrey({
    id: "bear",
    count: 6,
    label: "Urso territorial",
    url: "/models/animals/bear/model.glb",
    position: new THREE.Vector3(-7, 0, 7),
    height: 1.85,
    idleClip: "metarigAction",
    dieClip: "__none__",
    hp: 180,
    rotation: Math.PI * .7,
    routine: "stationary",
    moveSpeed: 3.6,
    territoryRadius: 14,
    attackDamage: 20,
  });

  loadPrey({
    id: "wolf",
    count: 6,
    label: "Lobo",
    url: "/models/animals/dire-wolf/model.glb",
    position: new THREE.Vector3(8, 0, -7),
    height: 1.42,
    idleClip: "Coyote_Idle",
    dieClip: "__none__",
    hp: 105,
    rotation: -.8,
    routine: "stationary",
    moveSpeed: 3.35,
    territoryRadius: 16,
    attackDamage: 15,
  });

  loadPrey({
    id: "puma",
    count: 8,
    label: "Leão-da-montanha",
    url: "/models/animals/mountain-lion/model.glb",
    position: new THREE.Vector3(9, 0, 8),
    height: 1.42,
    idleClip: "Mountain-puma_Idle_Standing",
    dieClip: "__none__",
    hp: 125,
    rotation: -2.2,
    routine: "stationary",
    moveSpeed: 3.75,
    territoryRadius: 18,
    attackDamage: 18,
  });

  const catHome = new THREE.Vector3(-7, 0, -3);
  catHome.y=openWorld.getHeightAt(catHome.x,catHome.z);
  let catHunter: { root: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; motion: string } | null = null;
  if(LEGACY_CITY_CONTENT_ENABLED)gltfLoader.load("/models/animals/cat/model.glb", (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(.72 / Math.max(initial.getSize(new THREE.Vector3()).y, .001));
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
    model.position.sub(center); model.position.y += box.getSize(new THREE.Vector3()).y * .5;
    model.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
    const root = new THREE.Group(); root.name = "Gato caçador"; root.userData.buildEditable = false; root.userData.animalModel = "/models/animals/cat/model.glb"; root.userData.modelLabel = "Gato"; root.userData.habitat="Cidade"; root.add(model); root.position.copy(catHome); scene.add(root);
    const mixer = new THREE.AnimationMixer(model), actions = new Map<string, THREE.AnimationAction>();
    for (const name of ["idle", "walk", "run"]) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name);
      if (clip) actions.set(name, mixer.clipAction(clip));
    }
    (actions.get("idle") ?? mixer.clipAction(gltf.animations[0])).play();
    catHunter = { root, mixer, actions, motion: "idle" };
  }, undefined, (error) => console.error("Não foi possível carregar o gato", error));

  function setCatMotion(motion: "idle" | "walk" | "run") {
    if (!catHunter || catHunter.motion === motion) return;
    const next = catHunter.actions.get(motion); if (!next) return;
    catHunter.actions.get(catHunter.motion)?.fadeOut(.15);
    next.reset().fadeIn(.15).play(); catHunter.motion = motion;
  }
  function updateCatAndRats(delta: number) {
    if (!catHunter) return;
    const previousPosition=catHunter.root.position.clone();
    catHunter.mixer.update(delta);
    let target: Prey | undefined, closest = Infinity;
    for (const prey of preyAnimals) {
      if (prey.id !== "rat" || prey.hp <= 0 || prey.position.distanceTo(catHome) > 18) continue;
      const distance = prey.position.distanceTo(catHunter.root.position);
      if (distance < closest) { closest = distance; target = prey; }
    }
    if (target) {
      target.predatorPosition = catHunter.root.position;
      target.fleeTime = .45;
      const direction = target.position.clone().sub(catHunter.root.position).setY(0);
      if (direction.lengthSq() > .001) {
        direction.normalize(); catHunter.root.position.addScaledVector(direction, 2.45 * delta);
        catHunter.root.rotation.y = Math.atan2(direction.x, direction.z); setCatMotion("run");
      }
    } else {
      const homeDirection = catHome.clone().sub(catHunter.root.position).setY(0), distance = homeDirection.length();
      if (distance > .12) {
        homeDirection.normalize(); catHunter.root.position.addScaledVector(homeDirection, Math.min(distance, 1.35 * delta));
        catHunter.root.rotation.y = Math.atan2(homeDirection.x, homeDirection.z); setCatMotion("walk");
      } else setCatMotion("idle");
    }
    if(!isAnimalHabitat(openWorld,"cat",catHunter.root.position.x,catHunter.root.position.z))catHunter.root.position.copy(previousPosition);
    catHunter.root.position.y=openWorld.getHeightAt(catHunter.root.position.x,catHunter.root.position.z);
  }

  function nearestLivingPrey(maxDistance = Infinity) {
    let target: Prey | undefined,
      distance = Infinity;
    for (const prey of preyAnimals) {
      if (prey.hp <= 0) continue;
      const current = character.group.position.distanceTo(prey.position);
      if (current < distance) {
        target = prey;
        distance = current;
      }
    }
    return target && distance <= maxDistance ? target : undefined;
  }

  const spellForward = new THREE.Vector3();
  const spellTargetOffset = new THREE.Vector3();
  function forwardSpellTarget(origin: THREE.Vector3, maxDistance: number, hitRadius: number) {
    spellForward.set(Math.sin(character.group.rotation.y), 0, Math.cos(character.group.rotation.y)).normalize();
    let target: Prey | undefined, closest = maxDistance;
    for (const prey of preyAnimals) {
      if (prey.hp <= 0 || !prey.root.visible) continue;
      spellTargetOffset.copy(prey.position).sub(origin).setY(0);
      const forwardDistance = spellTargetOffset.dot(spellForward);
      if (forwardDistance <= 0 || forwardDistance > maxDistance) continue;
      const sidewaysDistance = spellTargetOffset.addScaledVector(spellForward, -forwardDistance).length();
      const radius = targetRadius(prey.id);
      if (sidewaysDistance <= hitRadius + radius && forwardDistance < closest) {
        closest = forwardDistance;
        target = prey;
      }
    }
    const distance = target ? closest : maxDistance;
    const point = origin.clone().addScaledVector(spellForward, distance);
    point.y = target ? target.position.y + targetHeight(target.id) : origin.y;
    return { target, point };
  }

  function damagePrey(target: Prey, damage: number) {
    if (target.hp <= 0) return;
    damage = normalizeDamage(damage);
    target.hp = Math.max(0, target.hp - damage);
    updatePreyHud(target);
    gameAudio.hit();
    target.hudUntil = performance.now() + 1800;
    setPlayStatus(`${target.label}: -${damage} HP`);
    if (target.hp === 0) {
      if (target.hitElapsed !== undefined) {
        target.root.position.copy(target.hitStartPosition);
        target.root.rotation.x = target.hitBaseRotationX;
        target.root.rotation.z = target.hitBaseRotationZ;
        target.hitElapsed = undefined;
      }
      target.mixer.stopAllAction();
      const clips = target.root.userData.clips as THREE.AnimationClip[];
      const die = THREE.AnimationClip.findByName(clips, target.dieClip);
      if (die) {
        const action = target.mixer.clipAction(die);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
      }
      target.deathElapsed = 0;
      target.loot = animalLoot(target.id);
      const xpReward:Record<Prey["id"],number>={rat:5,chicken:8,rabbit:10,raccoon:15,deer:20,wolf:35,puma:40,bear:50};
      const earned=xpReward[target.id],levelsGained=grantExperience(context.inventoryState,earned);
      recordGuildKill(context.inventoryState,target.id);
      if(levelsGained)setPlayStatus(`Nível ${context.inventoryState.level}! +${levelsGained*20} HP máximo · +${earned} XP`);
      else setPlayStatus(`${target.label} abatido · +${earned} XP · aperte E para saquear`);
      saveInventory(context.inventoryState);
      context.refreshHud();
    } else {
      target.hitElapsed = 0;
      target.hitStartPosition.copy(target.root.position);
      target.hitBaseRotationX = target.root.rotation.x;
      target.hitBaseRotationZ = target.root.rotation.z;
      target.hitDirection.copy(target.position).sub(character.group.position).setY(0);
      if (target.hitDirection.lengthSq() < 0.0001) target.hitDirection.set(0, 0, 1);
      else target.hitDirection.normalize();
      if (target.territoryRadius > 0) {
        target.hostileState = "chase";
        target.fleeTime = 0;
      } else target.fleeTime = target.id === "deer" ? 4.5 : 3.2;
    }
  }

  function hitNearestPrey() {
    const target = nearestLivingPrey(2.45);
    if (!target) {
      setPlayStatus("Nenhuma caça no alcance");
      return;
    }
    damagePrey(target, playerDamage());
  }


    return {
    preyAnimals,
    placePreyInArena,
    forwardSpellTarget,
    damagePrey,
    hitNearestPrey,
    preyRadius,
    updateCatAndRats,
    constrainPreyToHabitat,
    updatePreyHud,
    FOREST_ANIMAL_IDS,
  };
}
