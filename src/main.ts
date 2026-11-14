import {updateCityInteriorStreaming} from './editor/CityInteriorStreaming';
import {CityStructureInstances} from './editor/CityStructureInstances';
import {renderQuestJournal} from './inventory/QuestJournal';
import {ChestInventory} from './inventory/ChestInventory';
import {nearestRoyalChest} from './editor/RoyalRoomDetails';
import {removeTravelersChapel,applyMilitaryFacilitiesLayout,removeRetiredCityOutposts} from './editor/MilitaryFacilitiesLayout';
import { makeItemPreview, clothingFor } from "./inventory/ItemPreviews";
import { initializeItemTooltips } from "./inventory/ItemTooltips";
import { initializeGameShell } from "./ui/GameShell";
import {configureDirectLightShader} from './world/DirectLightShader';
import {setInventoryFishTemplate,setInventoryBottleTemplate} from './inventory/proceduralItem';
// Keep the original dependency evaluation order; extracted factories are imported below.
import './inventory/animalLoot';
import {grantRoyalKitchenBread,grantAnimalMeatSamples} from './inventory/persistence';
import { cloneBuildPreviewModel, freezeBuildPreviewPose } from './editor/BuildPreviewModel';
import './editor/OrientedSelectionBox';
import './editor/CitySelection';
import { connectDatabaseSaveButton } from './saves/CloudSaves';
import {CompanionKiss} from './editor/CompanionKiss';
import {PrincessBedRest} from './editor/PrincessBedRest';
import { clothShirtColor, clothPantsColor } from './inventory/clothColors';
import { CitizenConversations } from './editor/CitizenConversations';
import { applyAvenueFrontages } from './editor/AvenueFrontages';
import { applySecondaryAvenuesLayout } from './editor/SecondaryAvenues';
import { applyRoyalPalaceLayout, alignRoyalAvenueEntrance } from './editor/RoyalPalace';
import { applyRoyalAvenueLayout, updateRoyalAvenueUV, updateRoyalAvenueGatePaving } from './editor/RoyalAvenue';
import defaultCityLayout from './editor/default-city.json';
import { ownsHorse } from './player/HorseCommerce';
import { physicalDamage, DODGE_DURATION, DODGE_DISTANCE, DODGE_STAMINA, dodgeInvulnerable, dodgeProgress } from "./player/PlayerCombat";
import { GuildPanel } from './guild/GuildPanel';
import './guild/quests';
import { setItemThumbnail, itemThumbnail, refreshItemThumbnails, watchItemThumbnails } from './inventory/ItemThumbnails';
import {cityDistrictPlan,districtAt,updateDistrictLegend} from './ui/CityDistricts';
import { cityMapFrame } from './ui/CityMapFrame';
import { ShopPanel } from './inventory/ShopPanel';
import { armorColor } from './inventory/armorMaterials';
import { rideableHorses, registerRideableHorse, nearestRideableHorse, resolveHorseCollision, updateHorseLook, resetHorseLook, updateRideableHorses } from './player/RideableHorses';
import { advancePlayerVertical } from './player/PlayerVerticalMotion';
import { seedCityPerimeter } from './editor/CityPerimeter';
import { FlightImpactResponse } from './editor/FlightImpactResponse';
import { updateCityPropLoading } from './editor/CityPropLoading';
import { CityResidents } from "./editor/CityResidents";
import { toggleChurchDoor, churchDoorPrompt, updateChurchDoors } from "./editor/ChurchDoors";
import { updateCityFirelights } from "./editor/CityFirelight";
import { loadCityPropTemplate } from "./editor/CityProps";
import { updateCityAnimals, resolveCityAnimalCollisions } from "./editor/CityAnimals";
import { drawCityMinimap } from "./ui/CityMinimap";
import * as THREE from "three";
import { MedievalCityFloor } from "./world/MedievalCityFloor";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "three/addons/controls/TransformControls.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createWorldAssetLoader } from "./world/WorldAssetLighting";
import { removeCastleActors } from "./world/CastleAssets";
import { ANIMAL_TERRITORIES,animalPatrolPoints,isAnimalHabitat } from "./world/AnimalTerritories";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DEFAULT_CONFIG, ProceduralCharacter } from "./character";
import type { AnimationState, MagicArmTuning, BroomRideNode, BroomRideTuning } from "./animation/AnimationController";
import {
  INVENTORY_CATALOG,
  ITEM_BY_ID,
} from "./inventory/catalog";
import { createProceduralItem } from "./inventory/proceduralItem";
import { loadInventory, saveInventory } from "./inventory/persistence";
import type {
  EquipmentSlot,
  InventoryItem,
  ItemCategory,
} from "./inventory/types";
import { DayNightSky } from "./world/DayNightSky";
import { LowPolyClouds } from "./world/LowPolyClouds";
import { OpenWorld } from "./world/OpenWorld";
import { WorldEditorStore } from "./editor/WorldEditorSupport";
import type { CityAssetKind } from "./editor/WorldEditorSupport";
import { seedMedievalCity, seedWallWarehouses, separateWarehouseHouses, upgradeCityArchitecture } from "./editor/MedievalCityLayout";
import { LowPolyCityBuilder, createCityAsset } from "./editor/LowPolyCityBuilder";
import { RuntimeWorldStore, validPosition } from "./player/RuntimeWorldStore";
import { resolveCircleCollision } from "./world/CollisionSystem";
import "./combat/CombatRules";
import { setBarPercent, setHudStatus } from "./hud/HudUtilities";
import { PerformanceMonitor } from "./debug/PerformanceMonitor";
import { WeatherSystem } from "./world/WeatherSystem";
import { GameAudio } from "./audio/GameAudio";
import { SpellEffects } from "./magic/SpellEffects";
import { HAND_BONE_TUNING_STORAGE_KEY } from "./hand/HandBoneTuning";
import { SWORD_SOCKET_STORAGE_KEY } from "./hand/GripSolver";
import "./style.css";
import { initializeBuildEditor } from "./editor/BuildEditor";
import { initializePlayerEquipment,type ScabbardTransform } from "./inventory/PlayerEquipment";
import { initializePreyAnimals,type Prey } from "./world/PreyAnimals";
import { initializeMarineLife } from "./world/MarineLife";

const app = document.querySelector<HTMLDivElement>("#app")!;
const broomRideNodes = initializeGameShell(app);

const viewport = document.querySelector<HTMLDivElement>("#viewport")!;
const damageFlash=document.createElement("div");damageFlash.className="damage-flash";damageFlash.setAttribute("aria-hidden","true");viewport.append(damageFlash);
const showPlayerDamage=()=>{damageFlash.classList.remove("active");void damageFlash.offsetWidth;damageFlash.classList.add("active");};
const interactionPrompt =
  document.querySelector<HTMLElement>("#interactionPrompt")!;
const setInteractionPrompt = (text = "", key = "E") => {
  interactionPrompt.querySelector("span")!.textContent = text;
  interactionPrompt.querySelector("kbd")!.textContent = key;
  interactionPrompt.classList.toggle("visible", Boolean(text));
};
const setPlayStatus = (text: string) => {
  setHudStatus(text);
};
const scene = new THREE.Scene();
const gameAudio = new GameAudio();
window.addEventListener("pointerdown",()=>gameAudio.ensureStarted(),{once:true});
const subtitleStorageKey="rpg3d.subtitles.v1";
const subtitlesToggle=document.querySelector<HTMLInputElement>("#subtitlesToggle")!;
const applySubtitles=(enabled:boolean)=>{
  document.body.classList.toggle("subtitles-disabled",!enabled);
  subtitlesToggle.checked=enabled;
  subtitlesToggle.closest("label")!.querySelector("output")!.textContent=enabled?"Ligadas":"Desligadas";
  localStorage.setItem(subtitleStorageKey,String(enabled));
};
applySubtitles(localStorage.getItem(subtitleStorageKey)!=="false");
subtitlesToggle.addEventListener("change",()=>applySubtitles(subtitlesToggle.checked));
const savedAudioSettings=gameAudio.getSettings();
document.querySelectorAll<HTMLInputElement>("[data-audio-setting]").forEach((input)=>{
  const setting=input.dataset.audioSetting as keyof typeof savedAudioSettings;
  const output=input.closest("label")!.querySelector("output")!;
  input.value=String(Math.round(savedAudioSettings[setting]*100));
  output.textContent=`${input.value}%`;
  input.addEventListener("input",()=>{
    const value=Number(input.value)/100;
    gameAudio.setSettings({[setting]:value});
    output.textContent=`${input.value}%`;
  });
});
const spellEffects = new SpellEffects(scene);
scene.background = null;
scene.fog = null;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
camera.position.set(3.8, 2.6, 6.5);
configureDirectLightShader();
// Request a single, ordinary context. Retrying WebGLRenderer creation after a
// failed high-performance request can leave Chrome/ANGLE with another pending
// context and exhaust the per-process context budget on reloads.
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "default",
  failIfMajorPerformanceCaveat: false,
});
// Retina at DPR 2 renders four physical pixels for every CSS pixel. A 1.25
// ceiling keeps the image crisp while cutting the main framebuffer by 61%.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);
const performanceMonitor = new PerformanceMonitor(renderer,scene);
const cityStructureInstances=new CityStructureInstances(scene);
type QualityLevel = "low" | "medium" | "high";
const QUALITY_PROFILES:Record<QualityLevel,{dpr:number;shadow:number;shadowDistance:number;simulationHz:number}>={
  low:{dpr:.7,shadow:512,shadowDistance:24,simulationHz:5},
  medium:{dpr:1,shadow:768,shadowDistance:20,simulationHz:8},
  high:{dpr:1.25,shadow:1024,shadowDistance:32,simulationHz:10}
};
let qualityLevel=(localStorage.getItem("rpg3d.quality") as QualityLevel)||"medium";
if(!(qualityLevel in QUALITY_PROFILES))qualityLevel="medium";
let quality=QUALITY_PROFILES[qualityLevel],lowFpsSamples=0;
const qualityControl=document.createElement("label");
qualityControl.className="quality-control";
qualityControl.innerHTML=`Qualidade <select aria-label="Qualidade gráfica"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select>`;
performanceMonitor.attachControl(qualityControl);
const qualitySelect=qualityControl.querySelector("select")!;qualitySelect.value=qualityLevel;
const applyQuality=(level:QualityLevel,automatic=false)=>{
  qualityLevel=level;quality=QUALITY_PROFILES[level];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality.dpr));
  renderer.shadowMap.enabled=quality.shadow>0;sun.castShadow=quality.shadow>0;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  if(quality.shadow>0)sun.shadow.mapSize.set(quality.shadow,quality.shadow);
  localStorage.setItem("rpg3d.quality",level);qualitySelect.value=level;
  qualityControl.classList.toggle("automatic",automatic);
};
qualitySelect.addEventListener("change",()=>applyQuality(qualitySelect.value as QualityLevel));
performanceMonitor.onSample=(fps)=>{
  lowFpsSamples=fps<45?lowFpsSamples+1:Math.max(0,lowFpsSamples-1);
  if(lowFpsSamples<3)return;
  lowFpsSamples=0;
  if(qualityLevel==="high")applyQuality("medium",true);
  else if(qualityLevel==="medium")applyQuality("low",true);
};

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const PLAYER_CAMERA_HEAD_HEIGHT=2.25;
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, PLAYER_CAMERA_HEAD_HEIGHT, 0);
controls.enableDamping = true;
controls.minDistance = 3.5;
controls.maxDistance = 3200;
controls.maxPolarAngle = Math.PI * 0.97;
controls.update();

const ambientLight = new THREE.HemisphereLight("#eaf5ff", "#574a38", 2.1);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight("#fff0d2", 4.1);
sun.position.set(7, 11, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -3;
sun.shadow.bias = -0.0003;
scene.add(sun);
applyQuality(qualityLevel);
const skySystem = new DayNightSky(scene, sun, ambientLight);
const cloudSystem = new LowPolyClouds(scene, { quality: "medium" });
const weatherSystem = new WeatherSystem(scene);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 35),
  new THREE.MeshStandardMaterial({
    color: "#777a7d",
    roughness: 0.92,
    metalness: 0.04,
  }),
);
floor.name = "Terreno principal";
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 7.5);
floor.receiveShadow = true;
const grid = new THREE.GridHelper(50, 50, "#2b2e30", "#55585a");
grid.name = "Grade do mapa";
grid.position.set(0, 0.008, 7.5);
(Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(
  (material) => {
    material.transparent = true;
    material.opacity = 0.62;
  },
);
// In-game world builder. It edits the real scene graph, so changes are
// immediately visible to gameplay and survive reloads through localStorage.
const BUILD_STORAGE_KEY = "rpg3d.worldBuilder.v1";
const HAS_SAVED_BUILD_WORLD = localStorage.getItem(BUILD_STORAGE_KEY) !== null;
// Never replace an existing origin/profile save with a bundled recovery snapshot.
const worldEditorStore = new WorldEditorStore(BUILD_STORAGE_KEY);
const buildState = worldEditorStore.state;
const openWorld = new OpenWorld(scene, { worldSize: 2048, chunkSize: 128 }, buildState.terrain, buildState.worldPreset);
// Match the top of the raised avenue paving. Keep the saved street geometry
// untouched while lifting the player's support point onto its visible surface.
const PLAYER_GROUND_OFFSET=.145;
const savedForestStateChanged = openWorld.configureForestEditor(buildState.assets, buildState.removedAssets,buildState.forestErasures);
// The world generates vegetation before the editor state is attached. Apply
// saved Build deletions immediately so removed trees never reappear on reload.
if (savedForestStateChanged) openWorld.refreshBiomeAssets();
const cityBuilder = new LowPolyCityBuilder(scene, (x, z) => openWorld.getHeightAt(x, z));
// Seed the principal city as one persistent construction group: eight straight
// sides, a tower on every fold and gates on the east, west and south sides.
const CAPITAL_PREFIX="capital-octagon-", CAPITAL_LAYER="Cidade Principal";
const CAPITAL_SCALE_VERSION="3.75-towers-5-level-joints-v3", CAPITAL_SCALE_STORAGE_KEY="rpg3d.capitalScaleVersion";
const GROUND_SURFACES_Y02_VERSION="all-city-objects-y02-v2", GROUND_SURFACES_Y02_STORAGE_KEY="rpg3d.groundSurfacesY02Version";
const STREET_SURFACES_Y03_VERSION="street-surfaces-y03-v1", STREET_SURFACES_Y03_STORAGE_KEY="rpg3d.streetSurfacesY03Version";
const STREET_LEVELS_VERSION="street-avenue-levels-v1", STREET_LEVELS_STORAGE_KEY="rpg3d.streetAvenueLevelsVersion";
const TOWER_BASE_Y0_VERSION="tower-base-y0-v1", TOWER_BASE_Y0_STORAGE_KEY="rpg3d.towerBaseY0Version";
const hasCapital=Object.keys(buildState.city).some((id)=>id.startsWith(CAPITAL_PREFIX));
const hasDefaultCityLayout=Object.entries(defaultCityLayout.city).every(([id,value])=>JSON.stringify(buildState.city[id])===JSON.stringify(value));
if(!HAS_SAVED_BUILD_WORLD&&hasDefaultCityLayout)localStorage.setItem(CAPITAL_SCALE_STORAGE_KEY,CAPITAL_SCALE_VERSION);
if(!HAS_SAVED_BUILD_WORLD&&(!hasCapital||localStorage.getItem(CAPITAL_SCALE_STORAGE_KEY)!==CAPITAL_SCALE_VERSION)){
  for(const id of Object.keys(buildState.city))if(id.startsWith(CAPITAL_PREFIX))delete buildState.city[id];
  const center=new THREE.Vector2(0,7.5), sideLength=172.5, radius=sideLength/(2*Math.sin(Math.PI/8));
  // Connected masonry shares one foundation elevation. Sampling each piece
  // independently produced the steps visible at every wall joint.
  const foundationY=openWorld.getHeightAt(center.x,center.y);
  const vertices=Array.from({length:8},(_,i)=>{
    const angle=Math.PI/8+i*Math.PI/4;
    return new THREE.Vector2(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius);
  });
  const addCapitalPart=(id:string,kind:"wall"|"gate"|"tower",x:number,z:number,rotationY=0,scaleX=3.75,scaleY=3.75,scaleZ=3.75)=>{
    buildState.city[id]={id,kind,layer:CAPITAL_LAYER,position:[x,foundationY,z],rotation:[0,rotationY,0],scale:[scaleX,scaleY,scaleZ]};
  };
  vertices.forEach((point,i)=>addCapitalPart(`${CAPITAL_PREFIX}tower-${i+1}`,"tower",point.x,point.y,-(Math.PI/8+i*Math.PI/4),5,5,5));
  const gateSides=new Set([0,4,6]);
  for(let side=0;side<8;side++){
    const a=vertices[side],b=vertices[(side+1)%8],dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz),rotationY=-Math.atan2(dz,dx);
    for(let segment=0;segment<3;segment++){
      const distance=41.25+segment*45,t=distance/length,x=a.x+dx*t,z=a.y+dz*t,isGate=segment===1&&gateSides.has(side),kind=isGate?"gate":"wall";
      addCapitalPart(`${CAPITAL_PREFIX}${kind}-${side+1}-${segment+1}`,kind,x,z,rotationY,isGate?45/14:3.75);
    }
  }
  localStorage.setItem(CAPITAL_SCALE_STORAGE_KEY,CAPITAL_SCALE_VERSION);
  worldEditorStore.save();
}
cityBuilder.rebuild(buildState.city);
// Building pivots are not uniform: several village models extend below their
// saved origin. Once the ground datum moved to zero, settle their *real mesh
// base* at .1 instead of assuming a position value is the visible floor.
if((buildState.groundBaselineRevision??0)<2){
  const groundedKinds=new Set(['house','shop','inn','tavern','church','guild','weapons','potions','warehouse','market','fountain','palace']);
  try{localStorage.setItem(`rpg3d.ground-zero-building-backup.${Date.now()}`,worldEditorStore.snapshot());}catch{/* preserve the current map when storage permits */}
  for(const [id,saved]of Object.entries(buildState.city)){
    if(!groundedKinds.has(saved.kind))continue;
    const object=cityBuilder.objects.get(id);if(!object)continue;
    object.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(object);if(bounds.isEmpty())continue;
    const offset=.1-bounds.min.y;if(Math.abs(offset)<1e-6)continue;
    object.position.y+=offset;saved.position[1]+=offset;
  }
  buildState.groundBaselineRevision=2;worldEditorStore.save();
}
if(!HAS_SAVED_BUILD_WORLD){
  const militaryFacilitiesChanged=await applyMilitaryFacilitiesLayout(buildState,cityBuilder);
  const outpostsRemoved=await removeRetiredCityOutposts(buildState,cityBuilder);
  const travelersChapelRemoved=await removeTravelersChapel(buildState,cityBuilder);
  if(militaryFacilitiesChanged||outpostsRemoved||travelersChapelRemoved)worldEditorStore.save();
}
const cityFloor=new MedievalCityFloor(scene);
const updateCityFloor=()=>{cityFloor.update(
  [...cityBuilder.objects.entries()].filter(([id])=>id.startsWith(`${CAPITAL_PREFIX}tower-`)).map(([,object])=>object),
  [...cityBuilder.objects.entries()].filter(([id])=>id.startsWith(`${CAPITAL_PREFIX}gate-`)).map(([,object])=>object),
  (x,z)=>openWorld.getHeightAt(x,z),
);
for(const object of cityBuilder.objects.values())if(object.userData.royalAvenue){
  updateRoyalAvenueGatePaving(object,[...cityBuilder.objects.entries()].filter(([id])=>id.startsWith(`${CAPITAL_PREFIX}gate-`)).map(([,gate])=>gate));
  updateRoyalAvenueUV(object,cityFloor.root);
  for(const palace of cityBuilder.objects.values())if(palace.userData.palaceComplex)updateRoyalAvenueUV(object,palace);
}
};
updateCityFloor();
if(!HAS_SAVED_BUILD_WORLD){
  if(seedMedievalCity(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
  if(upgradeCityArchitecture(buildState.city,cityBuilder)){worldEditorStore.save();}
  if(seedWallWarehouses(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
  if(seedCityPerimeter(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
  if(separateWarehouseHouses(buildState.city,cityBuilder,cityFloor)){worldEditorStore.save();}
  if(applyRoyalAvenueLayout(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
  if(applyRoyalPalaceLayout(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
  if(alignRoyalAvenueEntrance(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
  if(applySecondaryAvenuesLayout(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
  if(applyAvenueFrontages(buildState.city,cityBuilder)){updateCityFloor();worldEditorStore.save();}
}
// Explicit user-approved datum for the outdoor city surfaces. Apply once to
// the current save, keeping all horizontal transforms and object proportions.
if(localStorage.getItem(GROUND_SURFACES_Y02_STORAGE_KEY)!==GROUND_SURFACES_Y02_VERSION){
  let changed=false;
  for(const [id,entry] of Object.entries(buildState.city)){
    if(entry.position[1]===.2)continue;
    entry.position[1]=.2;
    const object=cityBuilder.objects.get(id);
    if(object)object.position.y=.2;
    changed=true;
  }
  localStorage.setItem(GROUND_SURFACES_Y02_STORAGE_KEY,GROUND_SURFACES_Y02_VERSION);
  if(changed)worldEditorStore.save();
  updateCityFloor();
}
if(localStorage.getItem(STREET_SURFACES_Y03_STORAGE_KEY)!==STREET_SURFACES_Y03_VERSION){
  let changed=false;
  for(const [id,entry] of Object.entries(buildState.city)){
    if(entry.kind!=='road'&&entry.kind!=='path'&&!entry.pavedStreet&&id!=='city-royal-avenue-v1')continue;
    if(entry.position[1]===.3)continue;
    entry.position[1]=.3;
    cityBuilder.objects.get(id)?.position.setY(.3);
    changed=true;
  }
  localStorage.setItem(STREET_SURFACES_Y03_STORAGE_KEY,STREET_SURFACES_Y03_VERSION);
  if(changed)worldEditorStore.save();
}
if(localStorage.getItem(STREET_LEVELS_STORAGE_KEY)!==STREET_LEVELS_VERSION){
  let changed=false;
  for(const [id,entry] of Object.entries(buildState.city)){
    const isNeighborhoodStreet=Boolean(entry.pavedStreet);
    const isAvenue=id==='city-royal-avenue-v1';
    if(!isNeighborhoodStreet&&!isAvenue)continue;
    const target=isNeighborhoodStreet?.4:.2;
    if(entry.position[1]===target)continue;
    entry.position[1]=target;cityBuilder.objects.get(id)?.position.setY(target);changed=true;
  }
  localStorage.setItem(STREET_LEVELS_STORAGE_KEY,STREET_LEVELS_VERSION);
  if(changed)worldEditorStore.save();
}
if(localStorage.getItem(TOWER_BASE_Y0_STORAGE_KEY)!==TOWER_BASE_Y0_VERSION){
  let changed=false;
  for(const [id,entry] of Object.entries(buildState.city)){
    if(!id.startsWith(`${CAPITAL_PREFIX}tower-`)||entry.position[1]===0)continue;
    entry.position[1]=0;cityBuilder.objects.get(id)?.position.setY(0);changed=true;
  }
  localStorage.setItem(TOWER_BASE_Y0_STORAGE_KEY,TOWER_BASE_Y0_VERSION);
  if(changed)worldEditorStore.save();
  updateCityFloor();
}
openWorld.cityFloorHeightAt=(x,z)=>cityFloor.terrainHeightAt(x,z);
openWorld.cityTreeBlockedAt=(x,z,clearance)=>cityFloor.heightAt(x,z)!==null||cityFloor.blocksTreeAt(x,z,clearance+1)||cityBuilder.overlapsTree(x,z,Math.max(4,clearance+1));
const protectedBuildAssets = new Set(["LobbyCharacter", "Horse"]);
const saveBuildState = () => {updateCityFloor();worldEditorStore.save();};
const buildEditor = initializeBuildEditor({
  camera,
  renderer,
  scene,
  cityBuilder,
  get character() { return character; },
  cityFloor,
  get cityResidents() { return cityResidents; },
  updateCityFloor,
  buildState,
  openWorld,
  worldEditorStore,
  saveBuildState,
  grid,
  floor,
  protectedBuildAssets,
  setPlayStatus,
  controls,
  get preySystem() { return preySystem; },
  get setInventoryOpen() { return setInventoryOpen; },
  get pressed() { return pressed; },
  get playerGroundHeightAt() { return playerGroundHeightAt; },
  PLAYER_GROUND_OFFSET,
  get snapCameraToPlayer() { return snapCameraToPlayer; },
  get saveRuntimeWorld() { return saveRuntimeWorld; },
});
const character = new ProceduralCharacter({ ...DEFAULT_CONFIG });
// Terrain paint is part of the saved world, not Build UI state. Restore it
// during normal game startup so roads/material circles exist before Build opens.
buildEditor.restoreTerrainPaints();
const refreshSavedHandCalibration = () => {
  character.refreshHandCalibration();
  setPlayStatus("Ajuste do Hand Editor aplicado");
};
window.addEventListener("storage", (event) => {
  if (
    event.key === HAND_BONE_TUNING_STORAGE_KEY ||
    event.key === SWORD_SOCKET_STORAGE_KEY
  )
    refreshSavedHandCalibration();
});
window.addEventListener("focus", refreshSavedHandCalibration);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshSavedHandCalibration();
});
let handCalibrationFingerprint = `${localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY) ?? ""}|${localStorage.getItem(SWORD_SOCKET_STORAGE_KEY) ?? ""}`;
window.setInterval(() => {
  const next = `${localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY) ?? ""}|${localStorage.getItem(SWORD_SOCKET_STORAGE_KEY) ?? ""}`;
  if (next === handCalibrationFingerprint) return;
  handCalibrationFingerprint = next;
  refreshSavedHandCalibration();
}, 250);
let sharedCalibrationFingerprint = "";
const syncSharedHandCalibration = async () => {
  try {
    let response = await fetch("/api/hand-calibration", { cache: "no-store" });
    if (!response.ok)
      response = await fetch("/hand-calibration.json", { cache: "no-store" });
    if (!response.ok) return;
    const calibration = (await response.json()) as {
        boneTuning?: unknown;
        swordSocket?: unknown;
      },
      fingerprint = JSON.stringify(calibration);
    if (fingerprint === sharedCalibrationFingerprint) return;
    sharedCalibrationFingerprint = fingerprint;
    if (calibration.boneTuning)
      localStorage.setItem(
        HAND_BONE_TUNING_STORAGE_KEY,
        JSON.stringify(calibration.boneTuning),
      );
    if (calibration.swordSocket)
      localStorage.setItem(
        SWORD_SOCKET_STORAGE_KEY,
        JSON.stringify(calibration.swordSocket),
      );
    handCalibrationFingerprint = `${localStorage.getItem(HAND_BONE_TUNING_STORAGE_KEY) ?? ""}|${localStorage.getItem(SWORD_SOCKET_STORAGE_KEY) ?? ""}`;
    refreshSavedHandCalibration();
  } catch {
    /* Offline/static mode continues using the browser-local calibration. */
  }
};
void syncSharedHandCalibration();
window.setInterval(syncSharedHandCalibration, 750);
character.group.name = "LobbyCharacter";
character.setChibi(true);
for (const item of [
  "shirt",
  "ironShirt",
  "leatherShirt",
  "pants",
  "boots",
  "gloves",
  "armor",
  "armorPants",
  "pants",
  "armorBoots",
  "armorGloves",
  "armorHelmet",
  "closedHelmet",
  "belt",
  "sword",
  "shield",
] as const)
  character.setClothing(item, false);
scene.add(character.group);
openWorld.update(character.group.position);
const equippedDecorations = new THREE.Group();
equippedDecorations.name = "EquippedProceduralAccessories";
character.group.add(equippedDecorations);

const femaleNpc = new ProceduralCharacter({
  ...DEFAULT_CONFIG,
  name: "Eleonor",
  hair: "#765034",
  body: "feminino",
  hairStyle: "curto",
  helmetHair: true,
});
femaleNpc.group.name = "NPC_Female_01";
femaleNpc.group.position.set(2.15, 0, -2.35);
femaleNpc.group.rotation.y = -0.55;
femaleNpc.setChibi(true);
for (const item of ["shirt", "pants", "boots", "gloves", "belt"] as const)
  femaleNpc.setClothing(item, true);
femaleNpc.setClothing("sword", false);
femaleNpc.setAnimation("idle");
scene.add(femaleNpc.group);
const createWarriorNpc = (
  name: string,
  x: number,
  z: number,
  rotation: number,
  hair: string,
) => {
  const npc = new ProceduralCharacter({
    ...DEFAULT_CONFIG,
    name,
    body: "feminino",
    hairStyle: "curto",
    helmetHair: true,
    hair,
  });
  npc.group.name = `NPC_Warrior_${name}`;
  npc.group.position.set(x, 0, z);
  npc.group.rotation.y = rotation;
  npc.setChibi(true);
  for (const item of ["shirt", "pants", "boots", "gloves", "belt"] as const)
    npc.setClothing(item, true);
  npc.setClothing("sword", false);
  npc.setAnimation("idle");
  scene.add(npc.group);
  return npc;
};
const aliceNpc = createWarriorNpc("Alice", 4.1, -1.1, -1.05, "#765034");
const emmaNpc = createWarriorNpc("Emma", 3.65, -4.25, 0.15, "#111315");
const warriorNpcs = [femaleNpc, aliceNpc, emmaNpc];
for(const npc of warriorNpcs){
  npc.group.userData.mapHidden=true;npc.group.userData.buildEditable=false;
  npc.group.traverse(object=>object.layers.disable(0));
}

const cityResidents = new CityResidents(scene, cityBuilder.objects, warriorNpcs,index=>followingWarriorIndex===index||activeWarriorIndex===index&&npcDialogue.classList.contains("open"));

// Live RPG inventory portrait. The preview renderer uses dedicated layers, so
// it draws only the selected character while sharing the real animated model
// and its currently equipped materials with the world view.
character.group.traverse((object) => object.layers.enable(2));
femaleNpc.group.traverse((object) => object.layers.enable(3));
const avatarCanvas = document.querySelector<HTMLCanvasElement>(
  "#inventoryAvatar canvas",
)!;
const avatarRenderer = new THREE.WebGLRenderer({
  canvas: avatarCanvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
avatarRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
avatarRenderer.outputColorSpace = THREE.SRGBColorSpace;
avatarRenderer.toneMapping = THREE.ACESFilmicToneMapping;
avatarRenderer.toneMappingExposure = 1.18;
const avatarCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
avatarCamera.layers.set(2);
const avatarKey = new THREE.HemisphereLight("#f3f7ff", "#44392e", 2.8);
avatarKey.layers.set(2);
avatarKey.layers.enable(3);
scene.add(avatarKey);
const avatarRim = new THREE.DirectionalLight("#ffe5bb", 3.2);
avatarRim.position.set(2, 4, 3);
avatarRim.layers.set(2);
avatarRim.layers.enable(3);
scene.add(avatarRim);
let avatarTarget: "player" | "female" = "player";
let avatarYaw = 0,
  avatarDragging = false,
  avatarPointerX = 0;
avatarCanvas.addEventListener("pointerdown", (event) => {
  avatarDragging = true;
  avatarPointerX = event.clientX;
  avatarCanvas.setPointerCapture(event.pointerId);
  avatarCanvas.classList.add("dragging");
});
avatarCanvas.addEventListener("pointermove", (event) => {
  if (!avatarDragging) return;
  avatarYaw += (event.clientX - avatarPointerX) * 0.012;
  avatarPointerX = event.clientX;
});
const stopAvatarDrag = (event: PointerEvent) => {
  avatarDragging = false;
  avatarCanvas.classList.remove("dragging");
  if (avatarCanvas.hasPointerCapture(event.pointerId))
    avatarCanvas.releasePointerCapture(event.pointerId);
};
avatarCanvas.addEventListener("pointerup", stopAvatarDrag);
avatarCanvas.addEventListener("pointercancel", stopAvatarDrag);
const resizeAvatar = () => {
  const host = document.querySelector<HTMLElement>("#inventoryAvatar")!,
    width = Math.max(1, host.clientWidth),
    height = Math.max(1, host.clientHeight);
  avatarRenderer.setSize(width, height, false);
  avatarCamera.aspect = width / height;
  avatarCamera.updateProjectionMatrix();
};
new ResizeObserver(resizeAvatar).observe(
  document.querySelector("#inventoryAvatar")!,
);
resizeAvatar();

// Render real miniature 3D objects once and use the resulting images inside
// the square inventory slots. This avoids emoji placeholders while keeping a
// single lightweight WebGL context for every thumbnail.
const previewRenderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
const releaseWebGLContexts=()=>{
  for(const activeRenderer of [renderer,avatarRenderer,previewRenderer]){
    activeRenderer.dispose();
    activeRenderer.forceContextLoss();
  }
};
window.addEventListener('beforeunload',releaseWebGLContexts,{once:true});
if(import.meta.hot)import.meta.hot.dispose(releaseWebGLContexts);
previewRenderer.setSize(160, 160, false);
previewRenderer.setPixelRatio(1);
previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
previewRenderer.toneMappingExposure = 1.25;
const previewScene = new THREE.Scene(),
  previewCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
previewScene.environment = scene.environment;
previewCamera.position.set(2.8, 2.2, 4);
previewCamera.lookAt(0, 0.25, 0);
previewScene.add(new THREE.HemisphereLight("#ffffff", "#252014", 3));
const previewSun = new THREE.DirectionalLight("#ffe7bd", 4);
previewSun.position.set(3, 5, 4);
previewScene.add(previewSun);
const buildPreviewCamera=new THREE.PerspectiveCamera(32,1,.01,30);
buildPreviewCamera.position.set(2.8,2.8,4);buildPreviewCamera.lookAt(0,0,0);
buildEditor.renderBuildThumbnail=(source)=>{
  const parts:string[]=[];
  source.traverse(child=>{if(child instanceof THREE.Mesh){
    const materials=Array.isArray(child.material)?child.material:[child.material];
    parts.push(`${child.uuid}:${child.visible}:${child.geometry.id}:${materials.map(m=>`${m.uuid}:${m.version}:${'color' in m?(m.color as THREE.Color).getHexString():''}`).join(',')}`);
  }});
  const signature=parts.join('|'),cached=buildEditor.buildThumbnailCache.get(source);if(cached?.signature===signature)return cached.image;
  const root=new THREE.Group();
  try{
    const model=cloneBuildPreviewModel(source);root.add(model);
    if(source.userData.animalModel&&source.animations.length){
      const clip=source.animations.find(clip=>/idle|stand|rest/i.test(clip.name))??source.animations[0];
      const mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();mixer.setTime(.1);
    }
    model.traverse(child=>{
      if(child instanceof THREE.Light||child.userData.cityDistanceHidden)child.visible=!(child instanceof THREE.Light);
    });
    root.updateMatrixWorld(true);
    freezeBuildPreviewPose(model);
    const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())return "";
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),maximum=Math.max(size.x,size.y,size.z,.001);
    model.position.sub(center);root.scale.setScalar(1.75/maximum);root.rotation.set(-.12,.55,0);
    if(String(source.userData.animalModel??'').includes('/chicken/'))root.rotation.y+=Math.PI;
    buildPreviewCamera.position.set(2.8,source.userData.animalModel?1.6:2.8,4);buildPreviewCamera.lookAt(0,0,0);
    previewScene.add(root);
    root.updateMatrixWorld(true);previewRenderer.render(previewScene,buildPreviewCamera);
    const image=previewRenderer.domElement.toDataURL("image/png");buildEditor.buildThumbnailCache.set(source,{signature,image});return image;
  }catch(error){console.error(`Falha na miniatura do modelo real: ${source.name}`,error);return "";}
  finally{
    root.removeFromParent();
    root.traverse(child=>{if(child instanceof THREE.Mesh&&child.userData.buildPreviewBakedGeometry)child.geometry.dispose();});
  }
};
for(const button of document.querySelectorAll<HTMLElement>("[data-city-kind]")){
  const kind=button.dataset.cityKind as CityAssetKind;
  const icon=button.querySelector<HTMLElement>("i"),asset=[...cityBuilder.objects.values()].find(object=>object.name===`Cidade:${kind}`)??createCityAsset(kind);
  const image=buildEditor.renderBuildThumbnail(asset);if(icon&&image)icon.style.backgroundImage=`url(${image})`;
}
const equipmentPreviewCharacter = new ProceduralCharacter({ ...DEFAULT_CONFIG });
document
  .querySelectorAll<HTMLElement>("[data-item-id],[data-female-modal-item]")
  .forEach((button) => {
    const id = button.dataset.itemId,
      item = id ? ITEM_BY_ID.get(id) : undefined;
    const clothingPreview = item && item.visual !== 'bracers' ? clothingFor(item) : null;
    const type = button.dataset.femaleModalItem;
    const holder = button.querySelector<HTMLElement>("span")!,
      model = item
        ? clothingPreview
          ? equipmentPreviewCharacter.createEquipmentPreview(clothingPreview, clothShirtColor(item.visual) ?? clothPantsColor(item.visual) ?? (clothingPreview === "shirt" ? "#f4f1e8" : armorColor(item.visual)), item.visual === 'leather-chest')
          : createProceduralItem(item)
        : makeItemPreview(type ?? "");
    holder.textContent = "";
    const image=buildEditor.renderBuildThumbnail(model);
    holder.style.backgroundImage = `url(${image})`;
    if(item)setItemThumbnail(item.id,image);
    previewScene.remove(model);
  });

// Use supplied consumable GLBs for inventory and quick-slot images.
const inventoryBottles:Record<string,string>={beer:'tavern-bottle-yellow',wine:'tavern-bottle-green',rum:'tavern-bottle-brown'};
for(const id of ['beer','wine','rum','fish','magic-potion','hp-potion','greater-hp-potion','stamina-potion','greater-stamina-potion']){
  void loadCityPropTemplate(inventoryBottles[id]??(id==='magic-potion'?'magic-potion':id.includes('potion')?'potion':id)).then(model=>{
    if(id==='fish')setInventoryFishTemplate(model);
    if(inventoryBottles[id])setInventoryBottleTemplate(id,model);
    const image=buildEditor.renderBuildThumbnail(model);
    setItemThumbnail(id,image);
    document.querySelectorAll<HTMLElement>(`[data-item-id="${id}"] span`).forEach(holder=>{holder.style.backgroundImage=`url(${image})`;});
    equipmentSystem.refreshQuickSlots();
  }).catch(error=>console.error('Não foi possível carregar consumível do inventário',error));
}

const horseMixers: THREE.AnimationMixer[] = [];
const horseActions = new Map<string, THREE.AnimationAction>();
let horseCurrentAction: THREE.AnimationAction | null = null;
let horseCurrentMotion = "idle";
type HorseIdleBone = {
  bone: THREE.Object3D;
  base: THREE.Quaternion;
  phase: number;
  amount: number;
};
const horseIdleBones: HorseIdleBone[] = [];
let horseIdleTime = 0;
let horseRegistryScanElapsed=0;
let horseRoot: THREE.Object3D | null = null;
let horseMountAnchor: THREE.Object3D | null = null;
let mounted = false;
let nimbusSource: THREE.Group | null = null;
let broomMountVisual: THREE.Object3D | null = null;
let broomFlying = false;
let broomAimPitch = 0;
const PLAYER_GRAVITY=22;
const PLAYER_JUMP_HEIGHT=2;
let broomFallVelocity = 0;
const broomImpact=new FlightImpactResponse();
const NIMBUS_SCALE_MULTIPLIER = 1.9435;
type NimbusHandTransform = { position: [number, number, number]; rotation: [number, number, number]; scale: number };
const NIMBUS_HAND_TRANSFORM_KEY = "rpg3d.nimbusHandTransform.v1";
const DEFAULT_NIMBUS_HAND_TRANSFORM: NimbusHandTransform = {
  position: [-.95, -.27, 0],
  rotation: [0, 0, 0],
  scale: NIMBUS_SCALE_MULTIPLIER,
};
const loadNimbusHandTransform = (): NimbusHandTransform => {
  try {
    const saved = JSON.parse(localStorage.getItem(NIMBUS_HAND_TRANSFORM_KEY) ?? "null") as Partial<NimbusHandTransform> | null;
    return {
      position: saved?.position?.length === 3 ? [...saved.position] as [number, number, number] : [...DEFAULT_NIMBUS_HAND_TRANSFORM.position],
      rotation: saved?.rotation?.length === 3 ? [...saved.rotation] as [number, number, number] : [...DEFAULT_NIMBUS_HAND_TRANSFORM.rotation],
      scale: Number.isFinite(saved?.scale) ? Math.max(.1, saved!.scale!) : DEFAULT_NIMBUS_HAND_TRANSFORM.scale,
    };
  } catch { return structuredClone(DEFAULT_NIMBUS_HAND_TRANSFORM); }
};
let nimbusHandTransform = loadNimbusHandTransform();
type NimbusArmDebug = MagicArmTuning;
const NIMBUS_ARM_DEBUG_KEY = "rpg3d.nimbusArmDebug.v1";
const DEFAULT_NIMBUS_ARM_DEBUG: NimbusArmDebug = {
  shoulder:{position:[0,0,0],rotation:[0,7,-6]},
  elbow:{position:[0,0,0],rotation:[0,67,-18]},
  wrist:{position:[0,0,0],rotation:[0,-44,0]},
};
const loadNimbusArmDebug = (): NimbusArmDebug => {
  try {
    const saved=JSON.parse(localStorage.getItem(NIMBUS_ARM_DEBUG_KEY)??"null") as Partial<NimbusArmDebug>|null;
    const result=structuredClone(DEFAULT_NIMBUS_ARM_DEBUG);
    for(const bone of ['shoulder','elbow','wrist'] as const)for(const group of ['position','rotation'] as const)
      if(saved?.[bone]?.[group]?.length===3)result[bone][group]=[...saved[bone]![group]!] as [number,number,number];
    return result;
  } catch { return structuredClone(DEFAULT_NIMBUS_ARM_DEBUG); }
};
let nimbusArmDebug=loadNimbusArmDebug();
const applyNimbusArmDebug = () => character.setMagicArmTuning({
  shoulder:{position:[...nimbusArmDebug.shoulder.position],rotation:nimbusArmDebug.shoulder.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]},
  elbow:{position:[...nimbusArmDebug.elbow.position],rotation:nimbusArmDebug.elbow.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]},
  wrist:{position:[...nimbusArmDebug.wrist.position],rotation:nimbusArmDebug.wrist.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]},
});
const gltfLoader = createWorldAssetLoader();
// Parse each repeated GLB once. Population instances clone the transform and
// skeleton hierarchy but share immutable geometry, materials and textures.
const sharedGltfCache=new Map<string,Promise<GLTF>>();
const loadSharedGltf=(url:string,onLoad:(gltf:GLTF)=>void,_progress?:unknown,onError?:(error:unknown)=>void)=>{
  let request=sharedGltfCache.get(url);
  if(!request){request=new Promise((resolve,reject)=>gltfLoader.load(url,resolve,undefined,reject));sharedGltfCache.set(url,request);}
  request.then(source=>onLoad({...source,scene:cloneSkeleton(source.scene) as THREE.Group})).catch(error=>onError?.(error));
};
for(const [label,url,targetHeight] of buildEditor.ANIMAL_ASSET_CATALOG)loadSharedGltf(url,gltf=>{
  const root=new THREE.Group(),model=gltf.scene;root.add(model);root.updateMatrixWorld(true);
  const initial=new THREE.Box3().setFromObject(root),size=initial.getSize(new THREE.Vector3());model.scale.setScalar(targetHeight/Math.max(size.y,.001));root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);
  root.animations=gltf.animations;
  if(url.includes('/horse/')){root.traverse(o=>{if(o.name==='Object_21')o.visible=false;});}
  root.name=label;root.userData.modelLabel=label;root.userData.animalModel=url;root.userData.buildEditable=true;buildEditor.animalAssetTemplates.set(url,root);
  if(buildEditor.buildMode)buildEditor.refreshBuildAssetList();
},undefined,error=>console.warn(`Não foi possível carregar o asset ${label}`,error));
const mergeStaticModel=(root:THREE.Object3D)=>{
  root.updateMatrixWorld(true);
  type StaticBatch={material:THREE.Material;geometries:THREE.BufferGeometry[];sources:THREE.Mesh[]};
  const inverseRoot=root.matrixWorld.clone().invert(),batches=new Map<string,StaticBatch>();
  const materialKey=(material:THREE.Material)=>{
    const value=material as THREE.MeshStandardMaterial;
    return [material.type,value.color?.getHexString(),value.map?.uuid,value.normalMap?.uuid,value.alphaMap?.uuid,value.roughness,value.metalness,material.side,material.transparent,material.opacity,material.alphaTest,material.vertexColors].join(":");
  };
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object instanceof THREE.SkinnedMesh||Array.isArray(object.material)||!object.visible)return;
    const geometry=object.geometry.clone();geometry.applyMatrix4(inverseRoot.clone().multiply(object.matrixWorld));
    const key=materialKey(object.material),batch:StaticBatch=batches.get(key)??{material:object.material,geometries:[],sources:[]};
    batch.geometries.push(geometry);batch.sources.push(object);batches.set(key,batch);
  });
  const merged:THREE.Mesh[]=[];
  for(const {material,geometries,sources} of batches.values()){
    if(geometries.length<2){geometries.forEach(geometry=>geometry.dispose());continue;}
    const geometry=mergeGeometries(geometries,false);geometries.forEach(item=>item.dispose());if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,material);mesh.name="Lote estático";mesh.castShadow=false;mesh.receiveShadow=true;merged.push(mesh);
    sources.forEach(source=>source.removeFromParent());
  }
  root.add(...merged);root.updateMatrixWorld(true);
};

// Fishing docks: two platforms reach into the inland lake and three form the
// coastal pier by the port. The ship stays moored beside the seaward end.
const prepareHarborModel=(model:THREE.Object3D)=>{
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
  model.position.x-=center.x;model.position.z-=center.z;
  model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  return model;
};
const createProceduralDockPlatform=()=>{
  const root=new THREE.Group();root.name="Módulo de doca artesanal";
  const wood=new THREE.MeshStandardMaterial({color:"#8b6038",roughness:.92,flatShading:true});
  const woodDark=new THREE.MeshStandardMaterial({color:"#4d321f",roughness:1,flatShading:true});
  const metal=new THREE.MeshStandardMaterial({color:"#34383a",roughness:.75,metalness:.28,flatShading:true});
  const part=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{const value=new THREE.Mesh(geometry,material);value.position.set(x,y,z);value.castShadow=value.receiveShadow=true;root.add(value);return value;};
  // Local Z is the pier's long axis, matching the placement/rotation used by
  // the former imported module.
  for(let i=0;i<17;i++)part(new THREE.BoxGeometry(3.8,.22,.88),i%2?wood:woodDark,0,.05,-8+i+.5);
  for(const x of [-1.55,1.55]){
    part(new THREE.BoxGeometry(.22,.35,17),woodDark,x,-.2,0);
    for(const z of [-7.5,-3.75,0,3.75,7.5]){
      const support=part(new THREE.CylinderGeometry(.16,.22,5.2,6),woodDark,x,-2.45,z);
      support.userData.dockSupport=true;support.userData.baseHeight=5.2;
      const post=part(new THREE.CylinderGeometry(.11,.14,1.35,6),woodDark,x,.78,z);
      post.userData.dockRailPost=true;
    }
    const rail=part(new THREE.CylinderGeometry(.075,.075,16,6),wood,x,1.35,0);rail.rotation.x=Math.PI/2;
  }
  for(const z of [-7.5,7.5])part(new THREE.BoxGeometry(3.7,.12,.12),metal,0,.28,z);
  root.userData.walkableDock=true;return root;
};
buildEditor.proceduralDockTemplate=createProceduralDockPlatform();
buildEditor.fitProceduralDockSupports=(dock)=>{
  const embedDepth=3;
  dock.updateWorldMatrix(true,true);
  const worldScale=new THREE.Vector3();dock.getWorldScale(worldScale);
  dock.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!object.userData.dockSupport)return;
    const top=dock.localToWorld(new THREE.Vector3(object.position.x,-.3,object.position.z));
    const ground=openWorld.getHeightAt(top.x,top.z)-embedDepth,height=Math.max(.5,top.y-ground),baseHeight=object.userData.baseHeight as number;
    const midpoint=dock.worldToLocal(new THREE.Vector3(top.x,(ground+top.y)*.5,top.z));
    object.scale.y=height/Math.max(.001,baseHeight*Math.abs(worldScale.y));object.position.y=midpoint.y;
  });
};
{
  const template=buildEditor.proceduralDockTemplate;
  const lakeDocks=new THREE.Group(),seaDocks=new THREE.Group();
  lakeDocks.name="Doca de pesca do lago · 3 peças";lakeDocks.userData.harborModel="dock-group";lakeDocks.userData.buildFolder="Construção";lakeDocks.userData.buildId="dock-lake-group";
  seaDocks.name="Doca marítima · 3 peças";seaDocks.userData.harborModel="dock-group";seaDocks.userData.buildFolder="Construção";seaDocks.userData.buildId="dock-sea-group";
  const addDock=(parent:THREE.Group,name:string,x:number,y:number,z:number,rotationY:number)=>{
    const dock=template.clone(true);dock.name=name;dock.position.set(x,y,z);dock.rotation.y=rotationY;
    dock.userData.walkableDock=true;
    parent.add(dock);
    // Stretch each piling to the actual terrain/riverbed below it. The dock
    // may be rotated, so sample using the support's world X/Z position.
    buildEditor.fitProceduralDockSupports(dock);
  };
  // Inland lake west bank: the first platform meets the raised bank and the
  // other two continue straight out over the water.
  const inlandDockY=15;
  addDock(lakeDocks,"Doca de pesca do lago 1",277,inlandDockY,150,Math.PI*.5);
  addDock(lakeDocks,"Doca de pesca do lago 2",294,inlandDockY,150,Math.PI*.5);
  addDock(lakeDocks,"Doca de pesca do lago 3",311,inlandDockY,150,Math.PI*.5);
  // Port coast: the shoreline is near radius 950 in this direction. Start at
  // its edge and keep the remaining platforms beyond the terrain in open sea.
  const coastHeading=Math.atan2(750,550),coastDirection=new THREE.Vector3(Math.sin(coastHeading),0,Math.cos(coastHeading));
  for(let index=0;index<3;index++){
    const distance=950+index*17;
    addDock(seaDocks,`Doca marítima ${index+1}`,coastDirection.x*distance,0,coastDirection.z*distance,coastHeading);
  }
  const centerDockGroup=(group:THREE.Group)=>{
    group.updateMatrixWorld(true);const center=new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
    // Keep Y independent from the support length. Centering on the complete
    // bounding box made longer pilings move the group's pivot vertically and
    // old Build transforms then lifted the whole pier off the shore.
    const horizontalCenter=new THREE.Vector3(center.x,0,center.z);
    group.children.forEach(child=>child.position.sub(horizontalCenter));group.position.copy(horizontalCenter);
  };
  centerDockGroup(lakeDocks);centerDockGroup(seaDocks);
  scene.add(lakeDocks,seaDocks);
  const dockPivotVersionKey="rpg3d.dockPivotVersion",dockPivotVersion="horizontal-v2";
  if(localStorage.getItem(dockPivotVersionKey)!==dockPivotVersion){
    // Preserve the exact dock transform from the approved save, including its elevation.
    localStorage.setItem(dockPivotVersionKey,dockPivotVersion);
  }
  // Recreate dock copies saved by the Build editor on previous sessions.
  for(const [id,saved] of Object.entries(buildState.assets)){
    if(saved.harborModel!=="dock-group"||scene.children.some(object=>object.userData.buildId===id)||buildState.removedAssets.includes(id)||buildState.removedAssets.includes(saved.label??""))continue;
    const source=/marítima/i.test(saved.label??"")?seaDocks:lakeDocks,group=source.clone(true);
    group.name=saved.label??`Doca · ${id.slice(-8)}`;group.userData={...source.userData,buildId:id,buildStateApplied:true};
    buildEditor.applySavedBuildAsset(group,saved);scene.add(group);
  }
  buildEditor.refreshBuildAssetList();
}
gltfLoader.load("/models/environment/harbor/pirate-ship.glb",({scene:shipScene})=>{
  const ship=prepareHarborModel(shipScene),coastHeading=Math.atan2(750,550);
  const outward=new THREE.Vector3(Math.sin(coastHeading),0,Math.cos(coastHeading));
  const side=new THREE.Vector3(-outward.z,0,outward.x);
  ship.name="Navio pirata atracado";
  // Keep the complete hull beyond the coastline instead of burying its stern
  // in the forest terrain. The lateral offset leaves it beside the pier.
  ship.position.copy(outward.multiplyScalar(995).add(side.multiplyScalar(24)));
  // The ship's long axis is local X; turn it parallel to the pier.
  ship.rotation.y=coastHeading-Math.PI*.5;
  ship.userData.harborModel="ship";ship.userData.buildFolder="Construção";ship.userData.buildId="harbor-pirate-ship";ship.userData.solidHarbor=true;ship.userData.collisionHalfSize=[17,7.5];
  scene.add(ship);
  for(const [id,saved] of Object.entries(buildState.assets)){
    if(saved.harborModel!=="ship"||scene.children.some(object=>object.userData.buildId===id)||buildState.removedAssets.includes(id)||buildState.removedAssets.includes(saved.label??""))continue;
    const copy=ship.clone(true);copy.name=saved.label??`Navio pirata · ${id.slice(-8)}`;
    copy.userData={...ship.userData,buildId:id,buildStateApplied:true};buildEditor.applySavedBuildAsset(copy,saved);scene.add(copy);
  }
  buildEditor.refreshBuildAssetList();
},undefined,error=>console.error("Não foi possível carregar o navio pirata",error));
const harborGroundHeightAt=(x:number,z:number,terrainHeight:number)=>{
  let surface=terrainHeight;
  const point=new THREE.Vector3(x,0,z),local=new THREE.Vector3(),top=new THREE.Vector3();
  // Only harbor roots can contain decks; walking the terrain, skeletons and
  // vegetation for every ground query was unrelated work in the flight loop.
  for(const root of scene.children){
    if(!root.userData.harborModel||!root.visible)continue;
    root.traverse(object=>{
    if(!object.userData.walkableDock||!object.visible)return;
    object.updateWorldMatrix(true,false);local.copy(point);object.worldToLocal(local);
    if(Math.abs(local.x)>3.15||Math.abs(local.z)>8.9)return;
    top.set(0,1.92,0);object.localToWorld(top);
    // Only catch the dock from nearby; flying beneath or far above it should
    // not snap the player onto the deck.
    if(character.group.position.y<=top.y+1.25)surface=Math.max(surface,top.y);
    });
  }
  return surface;
};
const playerGroundHeightAt=(x:number,z:number,allowStepUp=true)=>Math.max(harborGroundHeightAt(x,z,openWorld.getHeightAt(x,z)),cityFloor.heightAt(x,z)??-Infinity,cityFloor.stairHeightAt(x,z)??-Infinity,cityBuilder.walkHeightAt(x,z,character.group.position.y,allowStepUp)??-Infinity);
const createNimbusInstance = () => {
  if (!nimbusSource) return null;
  const clone = nimbusSource.clone(true);
  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry = child.geometry.clone();
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone();
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return clone;
};
const createHeldNimbusInstance = () => {
  const broom = createNimbusInstance();
  if (!broom) return null;
  // Keep the calibrated grip offset inside the rotated pivot. Rotating the
  // model and leaving this offset in parent space made the broom orbit away
  // from the fist instead of rotating around it.
  broom.position.fromArray(nimbusHandTransform.position);
  const pivot = new THREE.Group();
  pivot.name = "Nimbus2000HandPivot";
  pivot.rotation.set(
    THREE.MathUtils.degToRad(nimbusHandTransform.rotation[0]),
    THREE.MathUtils.degToRad(nimbusHandTransform.rotation[1]),
    THREE.MathUtils.degToRad(nimbusHandTransform.rotation[2]),
  );
  pivot.scale.setScalar(nimbusHandTransform.scale / NIMBUS_SCALE_MULTIPLIER);
  pivot.add(broom);
  return pivot;
};
gltfLoader.load("/models/equipment/nimbus-2000/model.glb", (gltf) => {
  const content = gltf.scene;
  content.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(content), size = initial.getSize(new THREE.Vector3());
  const oriented = new THREE.Group();
  if (size.y >= size.x && size.y >= size.z) content.rotation.z = -Math.PI / 2;
  else if (size.z >= size.x && size.z >= size.y) content.rotation.y = Math.PI / 2;
  oriented.add(content);
  oriented.updateMatrixWorld(true);
  const orientedBox = new THREE.Box3().setFromObject(oriented), orientedSize = orientedBox.getSize(new THREE.Vector3());
  oriented.scale.setScalar((1.72 * NIMBUS_SCALE_MULTIPLIER) / Math.max(orientedSize.x, .001));
  oriented.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(oriented), fittedCenter = fitted.getCenter(new THREE.Vector3());
  oriented.position.set(-fitted.min.x - .16, -fittedCenter.y, -fittedCenter.z);
  nimbusSource = new THREE.Group();
  nimbusSource.name = "Nimbus2000";
  nimbusSource.add(oriented);
  const image = buildEditor.renderBuildThumbnail(nimbusSource);
  setItemThumbnail('nimbus-2000', image);
  document.querySelectorAll<HTMLElement>('[data-item-id="nimbus-2000"] span').forEach(holder => { holder.style.backgroundImage = `url(${image})`; });
  equipmentSystem.refreshEquipmentSlots();
  const mountedModel = createNimbusInstance();
  if (mountedModel) {
    mountedModel.updateMatrixWorld(true);
    const mountedCenter = new THREE.Box3().setFromObject(mountedModel).getCenter(new THREE.Vector3());
    mountedModel.position.sub(mountedCenter);
    broomMountVisual = new THREE.Group();
    broomMountVisual.name = "Nimbus2000Mounted";
    broomMountVisual.position.set(0, .72, .02);
    broomMountVisual.rotation.y = Math.PI / 2;
    broomMountVisual.visible = false;
    broomMountVisual.add(mountedModel);
    character.group.add(broomMountVisual);
    applyBroomRideDebug();
  }
  equipmentSystem.syncCharacterEquipment();
}, undefined, (error) => console.error("Não foi possível carregar a Vassoura Voadora", error));
const LEGACY_HUB_ENABLED = false;
const LEGACY_CITY_CONTENT_ENABLED = false;
let castleStableAnchor: THREE.Object3D | null = null;
let skyBirdFlock: { root: THREE.Group; mixer: THREE.AnimationMixer } | null = null;
const skyBirdMapHalf=openWorld.config.worldSize*.5;
const resetSkyBirdCrossing=(root:THREE.Object3D)=>{
  root.position.set(
    -skyBirdMapHalf-90,
    82+Math.random()*42,
    -skyBirdMapHalf+120+Math.random()*(openWorld.config.worldSize-240),
  );
};
let castleSkyFloorY = 18;
const raiseSkyAboveCastle = (castle: THREE.Object3D) => {
  castle.updateMatrixWorld(true);
  const castleTop = new THREE.Box3().setFromObject(castle).max.y;
  castleSkyFloorY = Math.max(18, castleTop + 5);
  if (skyBirdFlock && skyBirdFlock.root.position.y < castleSkyFloorY)
    skyBirdFlock.root.position.y = castleSkyFloorY + 1.2;
};
const placeHorseAtCastleStable = () => {
  if (!horseRoot || !castleStableAnchor) return false;
  if (HAS_SAVED_BUILD_WORLD) return false;
  const placementKey = "rpg3d.horsePlacedInCastleStable.v1";
  if (localStorage.getItem(placementKey)) return false;
  const stablePosition = castleStableAnchor.getWorldPosition(new THREE.Vector3());
  horseRoot.position.set(stablePosition.x, 0, stablePosition.z);
  let castleParent: THREE.Object3D | null = castleStableAnchor.parent;
  while (castleParent?.parent && castleParent.parent !== scene) castleParent = castleParent.parent;
  horseRoot.rotation.y = (castleParent?.rotation.y ?? 0) + Math.PI / 2;
  horseRoot.userData.buildId = "horse";
  horseRoot.userData.buildStateApplied = true;
  buildState.assets.horse = buildEditor.snapshotBuildAsset(horseRoot);
  saveBuildState();
  localStorage.setItem(placementKey, "true");
  return true;
};
if (LEGACY_HUB_ENABLED) gltfLoader.load(
  "/models/environment/medieval-castle/model.glb",
  (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    openWorld.registerForestRocks(model);
    removeCastleActors(model);
    model.traverse((child) => {
      if (/^Floor_0$/i.test(child.name)) child.visible = false;
      // The castle pack includes baked decorative inhabitants. Gameplay owns
      // its people and horses, so remove those meshes while keeping buildings,
      // props and the chickens from the original castle scene.
      if (/^(?:Horse(?:man)?|Character|Soldier|Girl|Bucketgirl)(?:_\d+)?(?:_0)?$/i.test(child.name))
        child.visible = false;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    model.updateMatrixWorld(true);
    const castleBox = new THREE.Box3();
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible)
        castleBox.union(new THREE.Box3().setFromObject(child));
    });
    const center = castleBox.getCenter(new THREE.Vector3());
    const size = castleBox.getSize(new THREE.Vector3());
    mergeStaticModel(model);
    // Floor_0 had its walkable surface about 0.35 m above the GLB origin.
    // Rebase that surface to the editor's Y=0 while allowing foundations to
    // remain underground. The root can now stay at Y=0 at every scale.
    model.position.set(-center.x, -0.35, -center.z);
    const root = new THREE.Group();
    root.name = "Castelo medieval";
    root.position.set(0, 0, 7.5);
    root.scale.setScalar(buildEditor.CASTLE_LOCKED_SCALE);
    if(buildState.worldPreset==="arena-island-v1")root.position.y=openWorld.getHeightAt(0,7.5);
    root.add(model);
    castleStableAnchor = new THREE.Object3D();
    castleStableAnchor.name = "Ponto do estábulo";
    // Authored center of Stable_0. Y=.35 compensates the removed Floor_0 and
    // lands on the rebased walkable plane.
    castleStableAnchor.position.set(17.86, .35, 15.71);
    model.add(castleStableAnchor);
    scene.add(root);

    // Match the editable world map to the castle footprint, excluding its
    // oversized embedded Floor_0 mesh.
    buildEditor.buildWidth.value = String(Math.ceil(size.x));
    buildEditor.buildDepth.value = String(Math.ceil(size.z));
    buildEditor.applyBuildMapSize();
    buildEditor.refreshBuildAssetList();
    // The castle is taller than the original scene. Keep the moving sky layer
    // above its highest visible point, including an edited castle scale.
    raiseSkyAboveCastle(root);
    placeHorseAtCastleStable();
  },
  undefined,
  (error) => console.error("Não foi possível carregar o castelo medieval", error),
);

gltfLoader.load("/models/animals/sky-birds/model.glb", (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const root = new THREE.Group();
  root.name = "Bando de pássaros";
  root.userData.animalModel = "/models/animals/sky-birds/model.glb";
  root.userData.modelLabel = "Pássaros";
  root.userData.buildEditable = false;
  root.add(model); root.scale.setScalar(4.2 / Math.max(size.x, size.z, .001));
  // The authored flock faces -Z. It travels toward +X, so -90° aligns its
  // beaks with movement; +90° made every bird fly backwards.
  resetSkyBirdCrossing(root); root.rotation.y = -Math.PI / 2;
  model.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true; });
  scene.add(root);
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  skyBirdFlock = { root, mixer };
}, undefined, (error) => console.error("Não foi possível carregar o bando de pássaros", error));
function updateSkyBirds(delta: number) {
  if (!skyBirdFlock) return;
  skyBirdFlock.mixer.update(delta);
  skyBirdFlock.root.position.x += 42 * delta;
  skyBirdFlock.root.position.y += Math.sin(performance.now() * .0018) * delta*.22;
  if (skyBirdFlock.root.position.x > skyBirdMapHalf+90) resetSkyBirdCrossing(skyBirdFlock.root);
}

const HOOD_TRANSFORM_KEY = "rpg3d.mageHoodTransform";
type HoodTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};
const DEFAULT_HOOD_TRANSFORM: HoodTransform = {
  position: [0, 2.32, -0.185],
  rotation: [0, 0, 0],
  scale: 1.4355,
};
const loadHoodTransform = (): HoodTransform => {
  try {
    const saved = JSON.parse(localStorage.getItem(HOOD_TRANSFORM_KEY) ?? "null") as HoodTransform | null;
    return saved?.position?.length === 3 && Number.isFinite(saved.scale)
      ? {
          ...saved,
          position: [...saved.position],
          rotation: saved.rotation?.length === 3 ? [...saved.rotation] : [0, 0, 0],
        }
      : { ...DEFAULT_HOOD_TRANSFORM, position: [...DEFAULT_HOOD_TRANSFORM.position], rotation: [...DEFAULT_HOOD_TRANSFORM.rotation] };
  } catch {
    return { ...DEFAULT_HOOD_TRANSFORM, position: [...DEFAULT_HOOD_TRANSFORM.position], rotation: [...DEFAULT_HOOD_TRANSFORM.rotation] };
  }
};
let mageHoodTransform = loadHoodTransform();
let mageHoodRoot: THREE.Group | null = null;
let mageHoodAssetSize = 1;
const applyMageHoodTransform = () => {
  if (!mageHoodRoot) return;
  mageHoodRoot.position.fromArray(mageHoodTransform.position);
  mageHoodRoot.rotation.set(
    ...mageHoodTransform.rotation.map(THREE.MathUtils.degToRad) as [number, number, number],
  );
  mageHoodRoot.scale.setScalar(mageHoodTransform.scale / mageHoodAssetSize);
};
gltfLoader.load("/models/equipment/mage-hood/model.glb", (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  model.position.sub(center);
  const root = new THREE.Group(); root.add(model);
  mageHoodAssetSize = Math.max(size.x, size.y, size.z, .001);
  root.visible = false;
  root.name = "equipment.mageHood";
  root.traverse((child) => {
    // Layer 2 is used by the player's inventory-avatar camera. The hood is
    // loaded after the character, so it must opt into that layer explicitly.
    child.layers.enable(2);
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  character.attachHeadAccessory(root);
  mageHoodRoot = root;
  applyMageHoodTransform();
  const hoodEquipped = equipmentSystem.equippedItems.get("head") === "mage-hood";
  root.visible = hoodEquipped;
  character.setHoodHairHidden(false);

  // The inventory thumbnail is rendered from the supplied asset itself, not
  // from the procedural placeholder used by the other equipment.
  const iconRoot = new THREE.Group(), iconModel = model.clone(true);
  iconRoot.add(iconModel);
  iconRoot.scale.setScalar(1.45 / Math.max(size.x, size.y, size.z, .001));
  iconRoot.rotation.set(.08, -.38, 0);
  previewScene.add(iconRoot);
  previewRenderer.render(previewScene, previewCamera);
  setItemThumbnail("mage-hood",previewRenderer.domElement.toDataURL("image/png"));
  document.querySelectorAll<HTMLElement>('[data-item-id="mage-hood"] span').forEach((holder) => {
    holder.textContent = "";
    holder.style.backgroundImage = `url(${previewRenderer.domElement.toDataURL("image/png")})`;
  });
  previewScene.remove(iconRoot);
}, undefined, (error) => console.error("Não foi possível carregar o capuz de mago", error));

const seaCenter = new THREE.Vector3(0, 0, -17.5);
const seaWaterMaterial = new THREE.MeshPhysicalMaterial({
  color: "#167da0", roughness: .18, metalness: .04, transparent: true,
  opacity: .78, clearcoat: .65, clearcoatRoughness: .22, depthWrite: false,
});

const marineSystem = initializeMarineLife({
  loadSharedGltf,
  scene,
  seaCenter,
  openWorld,
  character,
  seaWaterMaterial,
  get qualityLevel() { return qualityLevel; },
  set qualityLevel(value) { qualityLevel = value; },
  get playerDodgingHit() { return playerDodgingHit; },
  get totalStats() { return equipmentSystem.totalStats; },
  get inventoryState() { return inventoryState; },
  get resolveWorldCollisions() { return resolveWorldCollisions; },
  gameAudio,
  showPlayerDamage,
  get refreshHud() { return refreshHud; },
  setPlayStatus,
  camera,
});
if(LEGACY_CITY_CONTENT_ENABLED)gltfLoader.load(
  "/models/animals/horse/model.glb",
  (gltf) => {
    const horse = gltf.scene;
    horse.name = "Horse";
    horse.userData.animalModel = "/models/animals/horse/model.glb";
    horse.userData.modelLabel = "Cavalo";
    horse.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(horse);
    const height = initialBox.getSize(new THREE.Vector3()).y;
    // Full-size riding horse: the previous 1.72 m total bounding-box height
    // made this stylized model read as a pony beside the player.
    horse.scale.setScalar(2.68 / Math.max(height, 0.001));
    horse.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(horse),
      center = box.getCenter(new THREE.Vector3());
    horse.position.set(-2.35 - center.x, -box.min.y, 0.25 - center.z);
    horse.rotation.y = Math.PI / 2;
    horse.traverse((child) => {
      // Mesh.003 is the exported hand-held rein. Without a rider it stretches
      // rigidly into empty space, so keep the fitted bridle and hide this loose
      // rein until the mounting system has hand targets.
      if (child.name === "Object_21") child.visible = false;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(horse);
    horseRoot = horse;
    const saddle = horse.getObjectByName("Object_16");
    if (saddle) {
      horse.updateMatrixWorld(true);
      const saddleBox = new THREE.Box3().setFromObject(saddle),
        saddleTop = saddleBox.getCenter(new THREE.Vector3());
      saddleTop.y = saddleBox.max.y + 0.03;
      horseMountAnchor = new THREE.Object3D();
      horseMountAnchor.name = "MountAnchor";
      horseMountAnchor.position.copy(horse.worldToLocal(saddleTop));
      horse.add(horseMountAnchor);
    }
    buildEditor.refreshBuildAssetList();
    const placedAtStable = placeHorseAtCastleStable();
    if (!placedAtStable) restoreHorseRuntimePosition();
    ensurePlayerClearOfHorse();
    if (gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(horse);
      const clips: { key: string; name: string }[] = [
        { key: "idle", name: "Armature|ArmatureAction" },
        { key: "walk", name: "Armature|Walk" },
        { key: "walk-left", name: "Armature|Walk_Left" },
        { key: "walk-right", name: "Armature|Walk_Right" },
        { key: "run", name: "Armature|Run" },
        { key: "run-left", name: "Armature|Run_Left" },
        { key: "run-right", name: "Armature|Run_Right" },
      ];
      for (const entry of clips) {
        const clip = THREE.AnimationClip.findByName(
          gltf.animations,
          entry.name,
        );
        if (clip) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          horseActions.set(entry.key, action);
        }
      }
      horseCurrentAction =
        horseActions.get("idle") ?? mixer.clipAction(gltf.animations[0]);
      horseCurrentAction.play();
      horseMixers.push(mixer);
    }
    const idleParts: [string, number, number][] = [
      ["Neck001_023", 0, 0.035],
      ["Head_024", 0.55, 0.055],
      ["EarL_025", 1.2, 0.09],
      ["EarR_026", 2.5, -0.09],
    ];
    for (const [name, phase, amount] of idleParts) {
      const bone = horse.getObjectByName(name);
      if (bone)
        horseIdleBones.push({
          bone,
          base: bone.quaternion.clone(),
          phase,
          amount,
        });
    }
  },
  undefined,
  (error) => console.error("Não foi possível carregar o cavalo", error),
);

const preySystem = initializePreyAnimals({
  openWorld,
  get totalStats() { return equipmentSystem.totalStats; },
  loadSharedGltf,
  scene,
  viewport,
  buildState,
  LEGACY_CITY_CONTENT_ENABLED,
  gltfLoader,
  character,
  gameAudio,
  setPlayStatus,
  get inventoryState() { return inventoryState; },
  get refreshHud() { return refreshHud; },
});
const mountPosition = new THREE.Vector3();
const RUNTIME_WORLD_KEY = "rpg3d.runtimeWorld.v1";
const runtimeWorldStore = new RuntimeWorldStore(RUNTIME_WORLD_KEY);
const runtimeWorld = runtimeWorldStore.state;
const snapCameraToPlayer = () => {
  const target = character.group.position.clone().add(new THREE.Vector3(0, PLAYER_CAMERA_HEAD_HEIGHT, 0));
  const offset = validPosition(runtimeWorld.cameraOffset)
    ? new THREE.Vector3().fromArray(runtimeWorld.cameraOffset)
    : new THREE.Vector3(3.8, 1.55, 6.5);
  controls.target.copy(target);
  camera.position.copy(target).add(offset);
  controls.update();
};
if (runtimeWorld.player && validPosition(runtimeWorld.player.position)) {
  character.group.position.fromArray(runtimeWorld.player.position);
  if (Number.isFinite(runtimeWorld.player.rotationY)) character.group.rotation.y = runtimeWorld.player.rotationY;
}
// Recover the player onto the rebuilt plaza instead of restoring inside its raised foundation.
const palaceGroundRecoveryKey='rpg3d.palace-plaza-ground.v4';
for(const palace of cityBuilder.objects.values()){
 if(!palace.userData.palaceComplex)continue;
 palace.updateWorldMatrix(true,false);
 const local=palace.worldToLocal(character.group.position.clone());
 const floor=palace.userData.plazaFloorElevation;
 if(typeof floor!=='number'||Math.abs(local.x)>90||local.z< -60||local.z>100)continue;
 const buried=Math.abs(local.x)<65&&local.z>=23&&local.z<=57&&local.y<floor-.2;
 if(localStorage.getItem(palaceGroundRecoveryKey)!=='1'||buried){
  character.group.position.copy(palace.localToWorld(new THREE.Vector3(0,floor+PLAYER_GROUND_OFFSET,45)));
  localStorage.setItem(palaceGroundRecoveryKey,'1');
 }
}
// Both new games and restored games start on the current terrain surface.
character.group.position.y = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET;
snapCameraToPlayer();
const restoreHorseRuntimePosition = () => {
  if (!horseRoot || !runtimeWorld.horse || !validPosition(runtimeWorld.horse.position)) return;
  horseRoot.position.fromArray(runtimeWorld.horse.position);
  horseRoot.position.y = openWorld.getHeightAt(horseRoot.position.x, horseRoot.position.z);
  if (Number.isFinite(runtimeWorld.horse.rotationY)) horseRoot.rotation.y = runtimeWorld.horse.rotationY;
};
const ensurePlayerClearOfHorse = () => {
  if (!horseRoot) return;
  horseRoot.getWorldScale(horseWorldScale);
  const sideDistance = Math.max(1.8, 1.45 * horseWorldScale.x);
  const dx = character.group.position.x - horseRoot.position.x,
    dz = character.group.position.z - horseRoot.position.z;
  if (Math.hypot(dx, dz) >= sideDistance) return;
  character.group.position.set(
    horseRoot.position.x + Math.cos(horseRoot.rotation.y) * sideDistance,
    openWorld.getHeightAt(horseRoot.position.x + Math.cos(horseRoot.rotation.y) * sideDistance, horseRoot.position.z - Math.sin(horseRoot.rotation.y) * sideDistance),
    horseRoot.position.z - Math.sin(horseRoot.rotation.y) * sideDistance,
  );
  character.group.rotation.y = horseRoot.rotation.y;
  character.group.visible = true;
  snapCameraToPlayer();
};
const saveRuntimeWorld = () => {
  const savedPlayerPosition = character.group.position.clone();
  if (mounted && horseRoot) {
    horseRoot.getWorldScale(horseWorldScale);
    const sideDistance = Math.max(1.8, 1.45 * horseWorldScale.x);
    savedPlayerPosition.set(
      horseRoot.position.x + Math.cos(horseRoot.rotation.y) * sideDistance,
      0,
      horseRoot.position.z - Math.sin(horseRoot.rotation.y) * sideDistance,
    );
  }
  runtimeWorld.player = {
    position: savedPlayerPosition.toArray() as [number, number, number],
    rotationY: character.group.rotation.y,
  };
  runtimeWorld.horses??={};
  for(const state of rideableHorses.values()){
    const key=state.root.userData.rideableHorseId??state.root.userData.buildId;if(!key||!state.root.userData.horseRuntimeApplied)continue;
    const position=state.root.getWorldPosition(new THREE.Vector3()),q=state.root.getWorldQuaternion(new THREE.Quaternion());
    runtimeWorld.horses[key]={position:position.toArray() as [number,number,number],rotationY:new THREE.Euler().setFromQuaternion(q,'YXZ').y};
  }
  if (horseRoot) runtimeWorld.horse = {
    position: horseRoot.position.toArray() as [number, number, number],
    rotationY: horseRoot.rotation.y,
  };
  runtimeWorld.cameraOffset = mounted
    ? [3.8, 1.55, 6.5]
    : camera.position.clone().sub(controls.target).toArray() as [number, number, number];
  runtimeWorldStore.save();
};
window.setInterval(saveRuntimeWorld, 1500);
window.addEventListener("pagehide", saveRuntimeWorld);
type MountDebugConfig = {
  riderForward: number;
  riderHeight: number;
  legSpread: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraTarget: number;
};
const MOUNT_DEBUG_KEY = "rpg3d.mountDebug.v1";
const DEFAULT_MOUNT_DEBUG: MountDebugConfig = {
  riderForward: .12,
  riderHeight: -.94,
  legSpread: .72,
  cameraDistance: 6,
  cameraHeight: 2.8,
  cameraTarget: 1.65,
};
const loadMountDebug = (): MountDebugConfig => {
  try { return { ...DEFAULT_MOUNT_DEBUG, ...JSON.parse(localStorage.getItem(MOUNT_DEBUG_KEY) ?? "null") }; }
  catch { return { ...DEFAULT_MOUNT_DEBUG }; }
};
let mountDebug = loadMountDebug();
character.setMountedLegSpread(mountDebug.legSpread);
type BroomModelDebug={position:[number,number,number];rotation:[number,number,number]};
const BROOM_RIDE_DEBUG_KEY="rpg3d.broomRideDebug.v1";
const DEFAULT_BROOM_MODEL_DEBUG:BroomModelDebug={position:[0,.72,.02],rotation:[0,90,0]};
const emptyRideTuning=()=>Object.fromEntries(broomRideNodes.map(([key])=>[key,{position:[0,0,0],rotation:[0,0,0]}])) as BroomRideTuning;
const RECOVERED_BROOM_RIDE_DEBUG:{model:BroomModelDebug;rig:BroomRideTuning}={
  model:{position:[0,.13,.87],rotation:[0,90,0]},
  rig:{
    center:{position:[0,0,.05],rotation:[60,0,0]},chest:{position:[0,0,0],rotation:[-40,0,0]},
    leftLeg:{position:[0,0,0],rotation:[0,0,10]},rightLeg:{position:[0,0,0],rotation:[0,0,-10]},
    leftShoulder:{position:[0,0,0],rotation:[-57,0,24]},leftElbow:{position:[0,0,0],rotation:[0,0,0]},leftWrist:{position:[0,0,0],rotation:[0,0,0]},
    rightShoulder:{position:[0,0,0],rotation:[-67,0,-27]},rightElbow:{position:[0,0,0],rotation:[0,0,0]},rightWrist:{position:[0,0,0],rotation:[0,0,0]},
  },
};
const broomRideWasZeroed=(rig:BroomRideTuning)=>broomRideNodes.every(([key])=>[...rig[key].position,...rig[key].rotation].every((value)=>value===0));
const loadBroomRideDebug=()=>{
  try{
    const saved=JSON.parse(localStorage.getItem(BROOM_RIDE_DEBUG_KEY)??"null") as {model?:BroomModelDebug;rig?:BroomRideTuning}|null;
    if(!saved?.rig||broomRideWasZeroed(saved.rig))return structuredClone(RECOVERED_BROOM_RIDE_DEBUG);
    return {model:saved?.model??structuredClone(DEFAULT_BROOM_MODEL_DEBUG),rig:saved?.rig??emptyRideTuning()};
  }catch{return {model:structuredClone(DEFAULT_BROOM_MODEL_DEBUG),rig:emptyRideTuning()};}
};
let broomRideDebug=loadBroomRideDebug();
localStorage.setItem(BROOM_RIDE_DEBUG_KEY,JSON.stringify(broomRideDebug));
const applyBroomRideDebug=()=>{
  if(broomMountVisual){
    broomMountVisual.position.fromArray(broomRideDebug.model.position);
    broomMountVisual.rotation.set(...broomRideDebug.model.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
  }
  const radians=structuredClone(broomRideDebug.rig);
  for(const [key] of broomRideNodes)radians[key].rotation=radians[key].rotation.map(THREE.MathUtils.degToRad) as [number,number,number];
  character.setBroomRideTuning(radians);
};
applyBroomRideDebug();
const mountEditor = document.querySelector<HTMLElement>("#mountEditor")!;
const refreshMountDebugInputs = () => {
  document.querySelectorAll<HTMLInputElement>("[data-mount-debug]").forEach((input) => input.value = String(mountDebug[input.dataset.mountDebug as keyof MountDebugConfig]));
  document.querySelectorAll<HTMLInputElement>("[data-broom-model]").forEach((input)=>{const [group,index]=input.dataset.broomModel!.split('.') as ['position'|'rotation',string];input.value=String(broomRideDebug.model[group][Number(index)]);});
  document.querySelectorAll<HTMLInputElement>("[data-broom-ride]").forEach((input)=>{const [node,group,index]=input.dataset.broomRide!.split('.') as [BroomRideNode,'position'|'rotation',string];input.value=String(broomRideDebug.rig[node][group][Number(index)]);});
};
const setMountEditorOpen = (open: boolean) => {
  mountEditor.classList.toggle("hidden", !open);
  mountEditor.setAttribute("aria-hidden", String(!open));
  if (open) refreshMountDebugInputs();
};
document.querySelectorAll<HTMLInputElement>("[data-mount-debug]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.mountDebug as keyof MountDebugConfig, value = Number(input.value);
    if (!Number.isFinite(value)) return;
    mountDebug[key] = value;
    if (key === "legSpread") character.setMountedLegSpread(value);
    localStorage.setItem(MOUNT_DEBUG_KEY, JSON.stringify(mountDebug));
  });
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
document.querySelectorAll<HTMLInputElement>("[data-broom-model],[data-broom-ride]").forEach((input)=>{
  input.addEventListener("input",()=>{
    const value=Number(input.value);if(!Number.isFinite(value))return;
    if(input.dataset.broomModel){const [group,index]=input.dataset.broomModel.split('.') as ['position'|'rotation',string];broomRideDebug.model[group][Number(index)]=value;}
    else {const [node,group,index]=input.dataset.broomRide!.split('.') as [BroomRideNode,'position'|'rotation',string];broomRideDebug.rig[node][group][Number(index)]=value;}
    localStorage.setItem(BROOM_RIDE_DEBUG_KEY,JSON.stringify(broomRideDebug));applyBroomRideDebug();
  });
  input.addEventListener("keydown",event=>event.stopPropagation());
});
document.querySelector<HTMLButtonElement>("[data-mount-debug-reset]")!.addEventListener("click", () => {
  mountDebug = { ...DEFAULT_MOUNT_DEBUG };
  character.setMountedLegSpread(mountDebug.legSpread);
  localStorage.setItem(MOUNT_DEBUG_KEY, JSON.stringify(mountDebug));
  localStorage.removeItem(BROOM_RIDE_DEBUG_KEY);
  broomRideDebug={model:structuredClone(DEFAULT_BROOM_MODEL_DEBUG),rig:emptyRideTuning()};
  applyBroomRideDebug();
  refreshMountDebugInputs();
});
function setHorseMotion(motion: string, direction = 1) {
  const next =
    horseActions.get(motion) ??
    horseActions.get(motion.split("-")[0]) ??
    horseActions.get("idle");
  if (!next) return;
  if (next !== horseCurrentAction) {
    horseCurrentAction?.fadeOut(0.18);
    next.reset();
    if (direction < 0) next.time = next.getClip().duration;
    next.fadeIn(0.18).play();
    horseCurrentAction = next;
  }
  next.timeScale = direction;
  horseCurrentMotion = motion;
  const state=horseRoot?rideableHorses.get(horseRoot):undefined;if(state){state.current=horseCurrentAction;state.motion=motion;}
}
function toggleMount() {
  const interactionDistance=mounted?0:horseInteractionDistance();
  if (!horseRoot || !horseMountAnchor) return false;
  character.group.visible = true;
  if (!character.group.parent) scene.add(character.group);
  if (mounted) {
    mounted = false;
    const horseState=rideableHorses.get(horseRoot);if(horseState)resetHorseLook(horseState);
    activeAction = null;
    horseRoot.getWorldPosition(mountPosition);
    character.group.position.set(mountPosition.x+1.8,playerGroundHeightAt(mountPosition.x+1.8,mountPosition.z)+PLAYER_GROUND_OFFSET,mountPosition.z);
    resolveWorldCollisions(character.group.position,.32,character.group);
    character.group.position.y=playerGroundHeightAt(character.group.position.x,character.group.position.z)+PLAYER_GROUND_OFFSET;
    horseRoot.getWorldQuaternion(frameQuaternionScratch);
    character.group.rotation.set(0,frameEulerScratch.setFromQuaternion(frameQuaternionScratch,'YXZ').y,0);
    setHorseMotion("idle");
    setAnimation("idle");
    character.setBroomRiding(false);
    setPlayStatus("Desmontou do cavalo");
    return true;
  }
  horseMountAnchor.getWorldPosition(mountPosition);
  if (interactionDistance > 2.35) return false;
  const ownedState=rideableHorses.get(horseRoot);
  if(!ownedState||!ownsHorse(inventoryState,ownedState))return false;
  if(horseRoot.parent!==scene){scene.attach(horseRoot);horseRoot.updateWorldMatrix(true,true);}
  // attach() can encode a 180° yaw as X/Z half-turns. Keep steering upright.
  horseRoot.getWorldQuaternion(frameQuaternionScratch);
  const heading=frameEulerScratch.setFromQuaternion(frameQuaternionScratch,'YXZ').y;
  horseRoot.rotation.set(0,heading,0);
  mounted = true;
  character.setBroomRiding(false);
  activeAction = null;
  pressed.clear();
  setAnimation("mounted");
  setPlayStatus("Montado · E desmontar");
  return true;
}
function horseInteractionDistance() {
  if (mounted) return 0;
  const nearest=nearestRideableHorse(character.group.position,horse=>ownsHorse(inventoryState,horse));
  if(!nearest.state)return Infinity;
  if(horseRoot!==nearest.state.root){
    horseRoot=nearest.state.root;horseMountAnchor=nearest.state.anchor;horseActions.clear();
    nearest.state.actions.forEach((action,key)=>horseActions.set(key,action));
    horseCurrentAction=nearest.state.current;horseCurrentMotion=nearest.state.motion;
  }
  return nearest.distance;
}

const inventoryState = loadInventory();
if(grantRoyalKitchenBread(inventoryState))saveInventory(inventoryState);
if(grantAnimalMeatSamples(inventoryState))saveInventory(inventoryState);
// Remove the requested cape once, preserving subsequent equipment choices.
if(localStorage.getItem('rpg3d.remove-smooth-cape.v1')!=='1'){
  if(inventoryState.equipped.accessory==='cape')delete inventoryState.equipped.accessory;
  saveInventory(inventoryState);
  localStorage.setItem('rpg3d.remove-smooth-cape.v1','1');
}
const goldBalance=document.querySelector<HTMLElement>("#goldBalance")!;
const refreshGoldBalance=()=>{goldBalance.textContent=inventoryState.gold.toLocaleString("pt-BR");};
refreshGoldBalance();

type TreasureKind="gold"|"silver"|"wood";
type TreasureChest={id:string;kind:TreasureKind;root:THREE.Group;mixer:THREE.AnimationMixer;openClip:THREE.AnimationClip;closeClip:THREE.AnimationClip;isOpen:boolean;animating:boolean;coin?:THREE.Object3D};
const treasureChests:TreasureChest[]=[];
const CHEST_STORAGE_KEY="rpg3d.opened-chests.v1";
const openedChestIds=new Set<string>(JSON.parse(localStorage.getItem(CHEST_STORAGE_KEY)??"[]") as string[]);
const chestNode:Record<TreasureKind,string>={gold:"GoldenChest",silver:"SilverChest[",wood:"WoodenChest"};
const chestLabel:Record<TreasureKind,string>={gold:"dourado",silver:"de prata",wood:"de madeira"};
let goldCoinTemplate:THREE.Object3D|undefined;
const attachGoldCoin=(chest:TreasureChest)=>{
  if(chest.kind!=="gold"||!goldCoinTemplate||chest.coin)return;
  const coin=goldCoinTemplate.clone(true);coin.position.set(0,1.35,0);coin.scale.setScalar(.28);chest.root.add(coin);chest.coin=coin;
};
gltfLoader.load("/models/chests/gold-coin.glb",({scene:coin})=>{
  coin.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(coin),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  coin.position.sub(center);coin.scale.setScalar(1/Math.max(size.y,.001));coin.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  goldCoinTemplate=coin;treasureChests.forEach(attachGoldCoin);
});
const chestPosition=(index:number)=>{
  const wantsWater=index%4===0;
  for(let attempt=0;attempt<600;attempt++){
    const sample=index*17.31+attempt*29.73;
    const x=-970+((((sample*.61803398875)%1)+1)%1)*1940;
    const z=-970+((((sample*.41421356237)%1)+1)%1)*1940;
    if(openWorld.isWaterAt(x,z)!==wantsWater)continue;
    return new THREE.Vector3(x,openWorld.getHeightAt(x,z),z);
  }
  return new THREE.Vector3(index-48,openWorld.getHeightAt(index-48,90),90);
};
const playChestAnimation=(chest:TreasureChest,open:boolean,instant=false)=>{
  chest.mixer.stopAllAction();
  const action=chest.mixer.clipAction(open?chest.openClip:chest.closeClip);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  chest.isOpen=open;chest.animating=!instant;
  if(instant){chest.mixer.update(action.getClip().duration+1);chest.animating=false;}
};
gltfLoader.load("/models/chests/chest-kit.glb",gltf=>{
  const kinds:TreasureKind[]=["gold","silver","wood"];
  for(let index=0;index<96;index++){
    const kind=kinds[index%kinds.length],source=gltf.scene.getObjectByName(chestNode[kind]);if(!source)continue;
    const model=cloneSkeleton(source),root=new THREE.Group();root.add(model);root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    model.position.set(-center.x,-box.min.y,-center.z);model.scale.setScalar(1.35/Math.max(size.y,.001));
    root.position.copy(chestPosition(index));root.rotation.y=(index*.754877666%1)*Math.PI*2;root.name=`Baú ${chestLabel[kind]} ${index+1}`;
    root.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});scene.add(root);
    const openClip=gltf.animations.find(clip=>clip.name===`${chestNode[kind]}|OpenChest`),closeClip=gltf.animations.find(clip=>clip.name===`${chestNode[kind]}|CloseChest`);if(!openClip||!closeClip){root.removeFromParent();continue;}
    const chest:TreasureChest={id:`chest-${index}`,kind,root,mixer:new THREE.AnimationMixer(root),openClip,closeClip,isOpen:false,animating:false};
    treasureChests.push(chest);attachGoldCoin(chest);if(openedChestIds.has(chest.id))playChestAnimation(chest,true,true);
  }
},undefined,error=>console.error("Não foi possível carregar os baús",error));
const nearestTreasureChest=()=>{
  let nearest:TreasureChest|undefined,distance=Infinity;
  for(const chest of treasureChests){const next=Math.hypot(character.group.position.x-chest.root.position.x,character.group.position.z-chest.root.position.z,character.group.position.y-chest.root.position.y);if(next<distance){nearest=chest;distance=next;}}
  return distance<=3.2?nearest:undefined;
};
const grantChestItem=(id:string)=>{
  const item=ITEM_BY_ID.get(id);if(!item)return;
  inventoryState.quantities[id]=(inventoryState.quantities[id]??0)+1;
  equipmentSystem.itemButton(id)?.removeAttribute("hidden");equipmentSystem.itemButton(id)?.querySelector<HTMLElement>("em")?.replaceChildren(String(inventoryState.quantities[id]));
  setPlayStatus(`Encontrado: ${item.name}`);
};
const toggleNearestChest=()=>{
  const chest=nearestTreasureChest();if(!chest||chest.animating)return false;
  const opening=!chest.isOpen;playChestAnimation(chest,opening);
  if(opening&&!openedChestIds.has(chest.id)){
    openedChestIds.add(chest.id);localStorage.setItem(CHEST_STORAGE_KEY,JSON.stringify([...openedChestIds]));
    if(chest.kind==="gold"){inventoryState.gold+=100;refreshGoldBalance();setPlayStatus("Baú dourado: +100 moedas de ouro");}
    else if(chest.kind==="silver"){const pool=["silver-sword","silver-ore"];grantChestItem(pool[Math.floor(Math.random()*pool.length)]);}
    else {const pool=["wooden-sword","leather","leather-vest","leather-chest","leather-gloves","leather-armor-boots"];grantChestItem(pool[Math.floor(Math.random()*pool.length)]);}
    saveInventory(inventoryState);equipmentSystem.refreshQuickSlots();
  }
  return true;
};
const progressionMigrationKey = "rpg3d.progression.level-one.v1";
if (!localStorage.getItem(progressionMigrationKey)) {
  inventoryState.level = 1;
  inventoryState.xp = 0;
  inventoryState.worldDay = 1;
  inventoryState.worldTime = 8 / 24;
  localStorage.setItem(progressionMigrationKey, "done");
  saveInventory(inventoryState);
}
const hpProgressionMigrationKey="rpg3d.progression.hp-levels.v2";
if(!localStorage.getItem(hpProgressionMigrationKey)){
  // Start the requested progression cleanly even for an existing save that
  // had the previous 110 HP base or was left at zero HP.
  inventoryState.level=1;inventoryState.xp=0;inventoryState.hp=100;
  localStorage.setItem(hpProgressionMigrationKey,"done");saveInventory(inventoryState);
}
let timePaused = false,
  timeSpeed = 1;
const timeSlider = document.querySelector<HTMLInputElement>("#timeSlider")!,
  dayInput = document.querySelector<HTMLInputElement>("#dayInput")!,
  timeEditorValue =
    document.querySelector<HTMLOutputElement>("#timeEditorValue")!;
timeSlider.value = String(inventoryState.worldTime * 24);
dayInput.value = String(inventoryState.worldDay);
const saveEditedTime = () => {
  companionKiss.cancel();
  cityResidents.synchronizeTime(inventoryState.worldTime);
  saveInventory(inventoryState);
};
timeSlider.addEventListener("input", () => {
  inventoryState.worldTime = Number(timeSlider.value) / 24;
  saveEditedTime();
});
dayInput.addEventListener("change", () => {
  inventoryState.worldDay = Math.max(
    1,
    Math.round(Number(dayInput.value) || 1),
  );
  dayInput.value = String(inventoryState.worldDay);
  saveEditedTime();
});
document.querySelectorAll<HTMLButtonElement>("[data-hour]").forEach((button) =>
  button.addEventListener("click", () => {
    inventoryState.worldTime = Number(button.dataset.hour) / 24;
    timeSlider.value = String(Number(button.dataset.hour));
    saveEditedTime();
  }),
);
document
  .querySelector<HTMLButtonElement>("[data-time-pause]")!
  .addEventListener("click", (event) => {
    timePaused = !timePaused;
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.toggle("active", timePaused);
    button.textContent = timePaused ? "▶ Continuar" : "⏸ Pausar";
  });
document
  .querySelectorAll<HTMLButtonElement>("[data-time-speed]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      timeSpeed = Number(button.dataset.timeSpeed);
      document
        .querySelectorAll("[data-time-speed]")
        .forEach((value) => value.classList.toggle("active", value === button));
    }),
  );
const weatherIntensity =
  document.querySelector<HTMLInputElement>("#weatherIntensity")!;
weatherIntensity.value = String(inventoryState.weatherIntensity);
weatherSystem.setWeather("clear");
weatherSystem.setIntensity(inventoryState.weatherIntensity);
type ActiveWeather="clear"|"rain"|"snow";
const biomeWeatherAt=(x:number,z:number):ActiveWeather=>{
  if(openWorld.isWaterAt(x,z))return "clear";
  const biome=openWorld.getBiomeAt(x,z);
  if(biome==="Neve")return "snow";
  if(biome!=="Floresta")return "clear";
  // Forest weather changes in deterministic three-hour windows. Roughly one
  // third of those windows receive rain; desert, water and other biomes never do.
  const window=Math.floor((inventoryState.worldDay-1)*8+inventoryState.worldTime*8);
  const chance=Math.abs(Math.sin(window*12.9898+78.233))*43758.5453%1;
  return chance<.34?"rain":"clear";
};
let activeWeather:ActiveWeather|null=null;
const syncBiomeWeather=():ActiveWeather=>{
  const next=biomeWeatherAt(character.group.position.x,character.group.position.z);
  if(next===activeWeather)return next;
  activeWeather=next;weatherSystem.setWeather(next);
  document.querySelectorAll<HTMLElement>("[data-weather]").forEach((button)=>button.classList.toggle("active",button.dataset.weather===next));
  return activeWeather;
};
document
  .querySelectorAll<HTMLButtonElement>("[data-weather]")
  .forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.weather === inventoryState.weather,
    );
    button.addEventListener("click", () => {
      inventoryState.weather = button.dataset.weather as
        "clear" | "rain" | "snow";
      activeWeather=null;
      syncBiomeWeather();
      document
        .querySelectorAll("[data-weather]")
        .forEach((value) => value.classList.toggle("active", value === button));
      saveInventory(inventoryState);
    });
  });
weatherIntensity.addEventListener("input", () => {
  inventoryState.weatherIntensity = Number(weatherIntensity.value);
  weatherSystem.setIntensity(inventoryState.weatherIntensity);
  saveInventory(inventoryState);
});
const hudLevel = document.querySelector<HTMLElement>("#hudLevel")!,
  hudPhase = document.querySelector<HTMLElement>("#hudPhase")!;
const mapPanel = document.querySelector<HTMLElement>("#worldMap")!,
  miniCanvas = document.querySelector<HTMLCanvasElement>("#minimap canvas")!,
  worldMapCanvas =
    document.querySelector<HTMLCanvasElement>("#worldMap canvas")!;
const inventoryMapCanvas=document.querySelector<HTMLCanvasElement>("#inventoryMapCanvas")!;
const bar = setBarPercent;
function updateStaminaHud(active = false) {
  const maximum = equipmentSystem.totalStats().stamina;
  bar("#hudStaminaBar", (inventoryState.stamina / maximum) * 100);
  document
    .querySelector(".action-stamina")!
    .classList.toggle("contextual-hidden", !active);
}
function refreshHud() {
  const stats = equipmentSystem.totalStats(),
    xpNeeded = inventoryState.level * 100;
  inventoryState.hp = Math.min(inventoryState.hp, stats.hp);
  inventoryState.stamina = Math.min(inventoryState.stamina, stats.stamina);
  hudLevel.textContent = String(inventoryState.level);
  document.querySelector("#hudXpText")!.textContent =
    `${inventoryState.xp} / ${xpNeeded}`;
  document.querySelector<HTMLElement>(".inventory-level>b")!.textContent =
    String(inventoryState.level);
  document.querySelector<HTMLElement>(".inventory-level em")!.style.width =
    `${(inventoryState.xp / xpNeeded) * 100}%`;
  document.querySelector("#hudHpText")!.textContent =
    `${Math.round(inventoryState.hp)} / ${stats.hp}`;
  document.querySelector("#hudHungerText")!.textContent = String(
    Math.round(inventoryState.hunger),
  );
  document.querySelector("#hudThirstText")!.textContent = String(
    Math.round(inventoryState.thirst),
  );
  bar("#hudXpBar", (inventoryState.xp / xpNeeded) * 100);
  bar("#hudHpBar", (inventoryState.hp / stats.hp) * 100);
  updateStaminaHud();
  bar("#hudHungerBar", inventoryState.hunger);
  bar("#hudThirstBar", inventoryState.thirst);
}
const setMapOpen = (open: boolean) => {
  mapPanel.classList.toggle("open", open);
  mapPanel.setAttribute("aria-hidden", String(!open));
  if (open) pressed?.clear();
};
document
  .querySelectorAll<HTMLElement>("[data-open-map]")
  .forEach((button) =>
    button.addEventListener("click", () => setMapOpen(true)),
  );
document
  .querySelector<HTMLButtonElement>("#worldMap button")!
  .addEventListener("click", () => setMapOpen(false));
function drawMap(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")!,
    w = canvas.width,
    h = canvas.height,
    local = canvas === miniCanvas,
    frame=local?null:cityMapFrame(cityBuilder.objects.values(),cityFloor.root.userData.floorPolygon,w,h),
    visibleSize = local ? 256 : frame!.visibleSize,
    centerX = local ? character.group.position.x : frame!.centerX,
    centerZ = local ? character.group.position.z : frame!.centerZ,
    scale = Math.min(w, h) / visibleSize,
    point = (x: number, z: number) =>
      [w / 2 + (x - centerX) * scale, h / 2 + (z - centerZ) * scale] as const;
  context.clearRect(0, 0, w, h);
  context.fillStyle = "#172018";
  context.fillRect(0, 0, w, h);
  context.strokeStyle = "#78805b33";
  context.lineWidth = 1;
  const gridStartX = Math.floor((centerX - visibleSize / 2) / 128) * 128,
    gridEndX = centerX + visibleSize / 2,
    gridStartZ = Math.floor((centerZ - visibleSize / 2) / 128) * 128,
    gridEndZ = centerZ + visibleSize / 2;
  for (let n = gridStartX; n <= gridEndX; n += 128) {
    context.beginPath();
    context.moveTo(...point(n, centerZ - visibleSize / 2));
    context.lineTo(...point(n, centerZ + visibleSize / 2));
    context.stroke();
  }
  for (let n = gridStartZ; n <= gridEndZ; n += 128) {
    context.beginPath();
    context.moveTo(...point(centerX - visibleSize / 2, n));
    context.lineTo(...point(centerX + visibleSize / 2, n));
    context.stroke();
  }
  drawCityMinimap(context,cityBuilder.objects.values(),cityFloor.root.userData.floorPolygon,point,scale,local);
  const districtPlan=cityDistrictPlan(cityBuilder.objects.values(),cityFloor.root.userData.floorPolygon);
  if(local){
    const district=districtAt(districtPlan,centerX,centerZ),caption=document.querySelector<HTMLElement>('#minimap span');
    const text=district?`${district.short} · M`:'Mapa · M';
    if(caption&&caption.textContent!==text)caption.textContent=text;
  }else updateDistrictLegend(mapPanel.querySelector<HTMLElement>('.district-legend')!,districtPlan);
  for(const resident of cityResidents.residents){
    if(resident.citizen.role==='morador'||resident.routine==='sleep')continue;
    const [x,y]=point(resident.position.x,resident.position.z);
    if(x<4||x>w-4||y<4||y>h-4)continue;
    context.fillStyle=resident.citizen.role.startsWith('guarda-')?'#91c9f2':'#ffe29a';
    context.beginPath();context.moveTo(x,y-4);context.lineTo(x+4,y);context.lineTo(x,y+4);context.lineTo(x-4,y);context.closePath();context.fill();
  }
  for (const prey of preySystem.preyAnimals) {
    if (!prey.root.visible) continue;
    const [x, y] = point(prey.position.x, prey.position.z);
    context.fillStyle = "#d16d50";
    context.beginPath();
    context.arc(x, y, Math.max(2, scale * 1.8), 0, Math.PI * 2);
    context.fill();
  }
  if (horseRoot) {
    const [x, y] = point(horseRoot.position.x, horseRoot.position.z);
    context.fillStyle = "#b98a55";
    context.fillRect(x - 4, y - 4, 8, 8);
  }
  const [px, py] = point(
    character.group.position.x,
    character.group.position.z,
  );
  context.save();
  context.translate(px, py);
  // The triangle is drawn pointing toward canvas -Y, while yaw 0 in the
  // world faces +Z (canvas +Y). Flip its base direction before applying yaw.
  context.rotate(Math.PI-character.group.rotation.y);
  context.fillStyle = "#2196ff";
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(6, 7);
  context.lineTo(-6, 7);
  context.closePath();
  context.fill();
  context.restore();
}
const equipmentSystem = initializePlayerEquipment({
  inventoryState,
  character,
  get broomFlying() { return broomFlying; },
  set broomFlying(value) { broomFlying = value; },
  get broomMountVisual() { return broomMountVisual; },
  set broomMountVisual(value) { broomMountVisual = value; },
  controls,
  camera,
  scene,
  openWorld,
  get buildMode() { return buildEditor.buildMode; },
  set buildMode(value) { buildEditor.buildMode = value; },
  buildState,
  gameAudio,
  get broomAimPitch() { return broomAimPitch; },
  set broomAimPitch(value) { broomAimPitch = value; },
  playerGroundHeightAt,
  get broomFallVelocity() { return broomFallVelocity; },
  set broomFallVelocity(value) { broomFallVelocity = value; },
  PLAYER_GROUND_OFFSET,
  get mountDebug() { return mountDebug; },
  set mountDebug(value) { mountDebug = value; },
  get setAnimation() { return setAnimation; },
  setPlayStatus,
  get mounted() { return mounted; },
  set mounted(value) { mounted = value; },
  toggleMount,
  broomImpact,
  get activeAction() { return activeAction; },
  set activeAction(value) { activeAction = value; },
  get pressed() { return pressed; },
  applyNimbusArmDebug,
  applyBroomRideDebug,
  equippedDecorations,
  createHeldNimbusInstance,
  get mageHoodRoot() { return mageHoodRoot; },
  set mageHoodRoot(value) { mageHoodRoot = value; },
});
const corpseLoot = document.querySelector<HTMLElement>("#corpseLoot")!,
  corpseLootTitle = document.querySelector<HTMLElement>("#corpseLootTitle")!,
  corpseLootItems = document.querySelector<HTMLElement>("#corpseLootItems")!;
watchItemThumbnails(corpseLootItems);
let activeLootPrey: Prey | undefined;
function nearestLootablePrey() {
  let result: Prey | undefined,
    distance = Infinity;
  for (const prey of preySystem.preyAnimals) {
    if (prey.hp > 0 || !prey.loot.length) continue;
    const current = character.group.position.distanceTo(prey.position);
    if (current < distance) {
      result = prey;
      distance = current;
    }
  }
  return distance <= 2.7 ? result : undefined;
}
const animalDisplayName = (label: string) => label.replace(/(?:[\s·#-]+\d+)+$/, "").trim();
function renderCorpseLoot() {
  if (!activeLootPrey) return;
  corpseLootTitle.textContent = animalDisplayName(activeLootPrey.label);
  corpseLootItems.innerHTML = activeLootPrey.loot
    .map((loot, index) => {
      const item = ITEM_BY_ID.get(loot.itemId);
      if (!item) return "";
      return `<button type="button" data-loot-index="${index}" aria-label="Guardar ${loot.quantity} ${item.name}"><span>${itemThumbnail(item.id)}</span><b>${item.name}</b><em>×${loot.quantity}</em></button>`;
    })
    .join("");
  corpseLootItems
    .querySelectorAll<HTMLButtonElement>("[data-loot-index]")
    .forEach((button) => {
      const loot = activeLootPrey?.loot[Number(button.dataset.lootIndex)],
        source = loot
          ? equipmentSystem.itemButton(loot.itemId)?.querySelector<HTMLElement>("span")
          : undefined;
      button.querySelector<HTMLElement>("span")!.style.backgroundImage =
        source?.style.backgroundImage ?? "";
    });
  refreshItemThumbnails(corpseLootItems);
}
function setCorpseLootOpen(prey?: Prey) {
  activeLootPrey = prey;
  const open = Boolean(prey);
  corpseLoot.classList.toggle("open", open);
  corpseLoot.setAttribute("aria-hidden", String(!open));
  if (prey) {
    pressed.clear();
    renderCorpseLoot();
    setPlayStatus(`Investigando ${animalDisplayName(prey.label)}`);
  } else corpseLootItems.replaceChildren();
}
function toggleCorpseLoot() {
  if (corpseLoot.classList.contains("open")) {
    setCorpseLootOpen();
    setPlayStatus("Saque fechado");
    return true;
  }
  const prey = nearestLootablePrey();
  if (!prey) return false;
  setCorpseLootOpen(prey);
  return true;
}
corpseLootItems.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-loot-index]",
  );
  if (!button || !activeLootPrey) return;
  const loot = activeLootPrey.loot[Number(button.dataset.lootIndex)],
    item = loot && ITEM_BY_ID.get(loot.itemId);
  if (!loot || !item) return;
  inventoryState.quantities[item.id] =
    (inventoryState.quantities[item.id] ?? 0) + loot.quantity;
  activeLootPrey.loot.splice(Number(button.dataset.lootIndex), 1);
  saveInventory(inventoryState);
  const lootedButton = equipmentSystem.itemButton(item.id);
  lootedButton?.removeAttribute("hidden");
  lootedButton
    ?.querySelector<HTMLElement>("em")
    ?.replaceChildren(String(inventoryState.quantities[item.id]));
  equipmentSystem.refreshQuickSlots();
  setPlayStatus(`Guardado: ${loot.quantity}× ${item.name}`);
  if (activeLootPrey.loot.length) renderCorpseLoot();
  else {
    const label = activeLootPrey.label;
    activeLootPrey.root.visible = false;
    setCorpseLootOpen();
    setPlayStatus(`${label} saqueado`);
  }
});
const npcDialogue = document.querySelector<HTMLElement>("#npcDialogue")!,
  npcName = document.querySelector<HTMLElement>("#npcName")!,
  npcSubtitle = document.querySelector<HTMLElement>("#npcSubtitle")!,
  npcSubtitleText = npcSubtitle.querySelector<HTMLElement>("span")!;
const npcNameLabels = [
  npcName,
  document.querySelector<HTMLElement>("#npcNameAlice")!,
  document.querySelector<HTMLElement>("#npcNameEmma")!,
];
const warriorNames = ["Eleonor", "Alice", "Emma"] as const;
let npcSubtitleUntil = 0;
const dialogueLines: Record<
  (typeof warriorNames)[number],
  Record<string, string>
> = {
  Eleonor: {
    welcome:
      "Sou Eleonor, guerreira de Tolbana. Protejo os viajantes que cruzam este campo.",
    aincrad:
      "Este campo pertence a Aincrad. A cidade segura fica além das colinas.",
    hunt: "Controle seu vigor e nunca ataque sem observar uma rota de fuga.",
    goodbye: "Mantenha a lâmina pronta. Nos veremos novamente.",
  },
  Alice: {
    welcome:
      "Meu nome é Alice. Vim aperfeiçoar minha espada longe das muralhas.",
    aincrad:
      "Aincrad muda a cada andar. Aqui ainda há espaço para treinar e respirar.",
    hunt: "Não desperdice movimentos. Um golpe preciso vale mais que três apressados.",
    goodbye: "Boa sorte no caminho. Não baixe a guarda.",
  },
  Emma: {
    welcome:
      "Sou Emma, batedora deste grupo. Eu vigio as trilhas e os animais.",
    aincrad: "Há caminhos seguros, mas eles mudam quando o clima fecha.",
    hunt: "Observe o terreno antes da luta. Posicionamento também é uma arma.",
    goodbye: "Até logo. Avisarei se encontrar perigo.",
  },
};
let activeWarriorIndex = 0;
let followingWarriorIndex: number | null = null;
const nearestWarrior = () => {
  let index = -1,
    distance = Infinity;
  warriorNpcs.forEach((npc, candidate) => {
    if(npc.group.userData.mapHidden)return;
    const value = character.group.position.distanceTo(npc.group.position);
    if (value < distance) {
      distance = value;
      index = candidate;
    }
  });
  return { index, distance };
};
const isNpcNearby = () => !mounted && nearestWarrior().distance <= 2.7;
function setNpcDialogueOpen(open: boolean) {
  npcDialogue.classList.toggle("open", open);
  npcDialogue.setAttribute("aria-hidden", String(!open));
  if (open) {
    const nearest = nearestWarrior();
    activeWarriorIndex = nearest.index;
    const npc = warriorNpcs[activeWarriorIndex],
      name = warriorNames[activeWarriorIndex];
    pressed.clear();
    npc.setAnimation("idle");
    npc.group.lookAt(
      character.group.position.x,
      npc.group.position.y,
      character.group.position.z,
    );
    npcDialogue.querySelector("header strong")!.textContent = name;
    npcSubtitle.querySelector("b")!.textContent = name;
    setPlayStatus(`Conversando com ${name} · E para fechar`);
  }
}
function toggleNpcDialogue() {
  if (npcDialogue.classList.contains("open")) {
    setNpcDialogueOpen(false);
    setPlayStatus("Conversa encerrada");
    return true;
  }
  if (!isNpcNearby()) return false;
  setNpcDialogueOpen(true);
  return true;
}
npcDialogue.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-dialogue]",
  );
  if (!button) return;
  const command = button.dataset.dialogue;
  if (command === "follow") {
    if (
      followingWarriorIndex !== null &&
      followingWarriorIndex !== activeWarriorIndex
    )
      warriorNpcs[followingWarriorIndex].setAnimation("idle");
    followingWarriorIndex = activeWarriorIndex;
    const name = warriorNames[activeWarriorIndex];
    npcSubtitle.querySelector("b")!.textContent = name;
    npcSubtitleText.textContent = "Vou com você.";
    npcSubtitle.classList.add("visible");
    npcSubtitleUntil = performance.now() + 3200;
    setNpcDialogueOpen(false);
    setPlayStatus(`${name} está seguindo você`);
    return;
  }
  if (command === "wait") {
    const name = warriorNames[activeWarriorIndex];
    if (followingWarriorIndex === activeWarriorIndex)
      followingWarriorIndex = null;
    warriorNpcs[activeWarriorIndex].setAnimation("idle");
    npcSubtitle.querySelector("b")!.textContent = name;
    npcSubtitleText.textContent = "Vou esperar aqui.";
    npcSubtitle.classList.add("visible");
    npcSubtitleUntil = performance.now() + 3200;
    setNpcDialogueOpen(false);
    setPlayStatus(`${name} ficou esperando`);
    return;
  }
  const line =
    dialogueLines[warriorNames[activeWarriorIndex]][
      button.dataset.dialogue ?? ""
    ];
  if (!line) return;
  npcSubtitleText.textContent = line;
  npcSubtitle.classList.add("visible");
  npcSubtitleUntil = performance.now() + 5200;
  if (button.dataset.dialogue === "goodbye") setNpcDialogueOpen(false);
});
const assignQuickSlot = (item: InventoryItem) => {
  if (item.category !== "consumable") return;
  inventoryState.quickSlots[equipmentSystem.selectedQuickSlot] = item.id;
  saveInventory(inventoryState);
  equipmentSystem.refreshQuickSlots();
  setPlayStatus(`${item.name} adicionado ao atalho ${equipmentSystem.selectedQuickSlot + 1}`);
};
let inventorySelectionMode = false;
const selectedInventoryItems = new Set<string>();
const selectModeButton = document.querySelector<HTMLButtonElement>(
    "#inventorySelectMode",
  )!,
  deleteSelectedButton = document.querySelector<HTMLButtonElement>(
    "#inventoryDeleteSelected",
  )!;
const refreshInventorySelection = () => {
  document
    .querySelectorAll<HTMLElement>("[data-item-id]")
    .forEach((card) =>
      card.classList.toggle(
        "bulk-selected",
        selectedInventoryItems.has(card.dataset.itemId!),
      ),
    );
  selectModeButton.classList.toggle("active", inventorySelectionMode);
  selectModeButton.textContent = inventorySelectionMode
    ? "Cancelar seleção"
    : "Selecionar";
  deleteSelectedButton.disabled = selectedInventoryItems.size === 0;
  deleteSelectedButton.querySelector("b")!.textContent = String(
    selectedInventoryItems.size,
  );
};
const deleteInventoryItems = (ids: Iterable<string>) => {
  const removed = [...ids];
  for (const id of removed) {
    inventoryState.quantities[id] = 0;
    for (const [slot, equippedId] of [...equipmentSystem.equippedItems])
      if (equippedId === id) equipmentSystem.equippedItems.delete(slot);
    inventoryState.quickSlots = inventoryState.quickSlots.map((quickId) =>
      quickId === id ? null : quickId,
    );
    equipmentSystem.itemButton(id)?.setAttribute("hidden", "");
    selectedInventoryItems.delete(id);
  }
  equipmentSystem.syncCharacterEquipment();
  equipmentSystem.refreshEquipmentSlots();
  equipmentSystem.refreshQuickSlots();
  equipmentSystem.persist();
  refreshInventorySelection();
  setPlayStatus(
    `${removed.length} ${removed.length === 1 ? "item excluído" : "itens excluídos"}`,
  );
};
selectModeButton.addEventListener("click", () => {
  inventorySelectionMode = !inventorySelectionMode;
  if (!inventorySelectionMode) selectedInventoryItems.clear();
  refreshInventorySelection();
});
deleteSelectedButton.addEventListener("click", () => {
  deleteInventoryItems(selectedInventoryItems);
  inventorySelectionMode = false;
  refreshInventorySelection();
});
document
  .querySelectorAll<HTMLButtonElement>("[data-item-id]")
  .forEach((button) => {
    button.draggable = true;
    const item = ITEM_BY_ID.get(button.dataset.itemId!)!;
    button.addEventListener("click", () => {
      if (inventorySelectionMode) {
        if (selectedInventoryItems.has(item.id))
          selectedInventoryItems.delete(item.id);
        else selectedInventoryItems.add(item.id);
        refreshInventorySelection();
        return;
      }
      if (item.category === "consumable") assignQuickSlot(item);
    });
    button.addEventListener("contextmenu", (event) => {
      const equippedSlot = [...equipmentSystem.equippedItems].find(([, id]) => id === item.id)?.[0];
      if (!equippedSlot) return;
      event.preventDefault();
      equipmentSystem.unequipSlot(equippedSlot);
      setPlayStatus(`${item.name} desequipado`);
    });
    button.addEventListener("dragstart", (event) => {
      hideItemTooltip();
      equipmentSystem.draggedItem = { id: item.id, source: "inventory" };
      event.dataTransfer?.setData("text/plain", item.id);
      button.classList.add("dragging");
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("dragging");
      hideItemTooltip();
      equipmentSystem.draggedItem = null;
      document
        .querySelectorAll(".drop-target")
        .forEach((node) => node.classList.remove("drop-target"));
    });
  });
document
  .querySelectorAll<HTMLButtonElement>("[data-equip-slot]")
  .forEach((slot) => {
    const slotName = (
      slot.dataset.equipSlot === "chest" ? "torso" : slot.dataset.equipSlot
    ) as EquipmentSlot;
    slot.addEventListener("dragover", (event) => {
      const item = equipmentSystem.draggedItem ? ITEM_BY_ID.get(equipmentSystem.draggedItem.id) : undefined;
      if (item && equipmentSystem.canEquip(item, slotName)) {
        event.preventDefault();
        slot.classList.add("drop-target");
      }
    });
    slot.addEventListener("dragleave", () =>
      slot.classList.remove("drop-target"),
    );
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drop-target");
      const item = equipmentSystem.draggedItem ? ITEM_BY_ID.get(equipmentSystem.draggedItem.id) : undefined;
      if (item) equipmentSystem.equipItem(item, slotName);
    });
    slot.addEventListener("contextmenu", (event) => {
      const id = equipmentSystem.equippedItems.get(slotName);
      if (!id) return;
      event.preventDefault();
      const name = ITEM_BY_ID.get(id)?.name ?? "Item";
      equipmentSystem.unequipSlot(slotName);
      setPlayStatus(`${name} desequipado`);
    });
    slot.addEventListener("dragstart", (event) => {
      const id = slot.dataset.item;
      if (!id) {
        event.preventDefault();
        return;
      }
      hideItemTooltip();
      equipmentSystem.draggedItem = { id, source: "slot", slot: slotName };
      event.dataTransfer?.setData("text/plain", id);
    });
    slot.addEventListener("dragend", () => {
      hideItemTooltip();
      equipmentSystem.draggedItem = null;
    });
  });
const inventoryDrop = document.querySelector<HTMLElement>(".inventory-items")!;
inventoryDrop.addEventListener("dragover", (event) => {
  if (equipmentSystem.draggedItem?.source === "slot") {
    event.preventDefault();
    inventoryDrop.classList.add("drop-target");
  }
});
inventoryDrop.addEventListener("dragleave", (event) => {
  if (!inventoryDrop.contains(event.relatedTarget as Node))
    inventoryDrop.classList.remove("drop-target");
});
inventoryDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  inventoryDrop.classList.remove("drop-target");
  if (equipmentSystem.draggedItem?.slot) equipmentSystem.unequipSlot(equipmentSystem.draggedItem.slot);
});
const inventoryTrash = document.querySelector<HTMLElement>("#inventoryTrash")!;
inventoryTrash.addEventListener("dragover", (event) => {
  if (!equipmentSystem.draggedItem) return;
  event.preventDefault();
  event.stopPropagation();
  inventoryTrash.classList.add("drop-target");
});
inventoryTrash.addEventListener("dragleave", () =>
  inventoryTrash.classList.remove("drop-target"),
);
inventoryTrash.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  inventoryTrash.classList.remove("drop-target");
  if (!equipmentSystem.draggedItem) return;
  deleteInventoryItems([equipmentSystem.draggedItem.id]);
});
function useConsumable(item: InventoryItem) {
  const quantity = inventoryState.quantities[item.id] ?? 0;
  if (quantity <= 0) return;
  inventoryState.quantities[item.id] = quantity - 1;
  inventoryState.hp = Math.min(
    equipmentSystem.totalStats().hp,
    inventoryState.hp + (item.stats.hp ?? 0),
  );
  inventoryState.stamina = Math.min(
    equipmentSystem.totalStats().stamina,
    inventoryState.stamina + (item.stats.stamina ?? 0),
  );
  inventoryState.hunger = Math.min(
    100,
    inventoryState.hunger + (item.stats.hunger ?? 0),
  );
  inventoryState.thirst = Math.min(
    100,
    inventoryState.thirst + (item.stats.thirst ?? 0),
  );
  saveInventory(inventoryState);
  equipmentSystem.itemButton(item.id)
    ?.querySelector<HTMLElement>("em")
    ?.replaceChildren(String(quantity - 1));
  equipmentSystem.refreshQuickSlots();
  refreshHud();
  setPlayStatus(`${item.name} utilizado`);
}
type SpellName = "heal" | "firebolt" | "lightning";
const spellCost: Record<SpellName, number> = {
  heal: 12,
  firebolt: 10,
  lightning: 18,
};
function castSpell(name: SpellName) {
  if (buildEditor.buildMode) return;
  if (mounted || activeAction) {
    setPlayStatus(mounted ? "Desmonte para conjurar" : "Aguarde a ação terminar");
    return;
  }
  const cost = spellCost[name];
  if (inventoryState.stamina < cost) {
    setPlayStatus("Vigor insuficiente para conjurar");
    return;
  }
  inventoryState.stamina -= cost;
  activeAction = { state: "cast", elapsed: 0, duration: .9 };
  setAnimation("cast");
  setPlayStatus("Conjurando...");
  saveInventory(inventoryState);
  refreshHud();
  const button = document.querySelector<HTMLElement>(`[data-spell="${name}"]`);
  setTimeout(() => {
    const origin = character.getCastingHandWorldPosition();
    if (name === "heal") {
      inventoryState.hp = Math.min(equipmentSystem.totalStats().hp, inventoryState.hp + 30);
      spellEffects.heal(origin.clone().add(new THREE.Vector3(0, -.25, 0)));
      setPlayStatus("Cura restaurou 30 HP");
      saveInventory(inventoryState);
      refreshHud();
    } else if (name === "firebolt") {
      const aim = preySystem.forwardSpellTarget(origin, 14, .22);
      spellEffects.firebolt(origin, aim.point, () => {
        if (aim.target) preySystem.damagePrey(aim.target, 26);
        else setPlayStatus("Bola de Fogo errou o alvo");
      });
      setPlayStatus(aim.target ? `Bola de Fogo em ${aim.target.label}` : "Bola de Fogo disparada");
    } else {
      const aim = preySystem.forwardSpellTarget(origin, 12, .42);
      spellEffects.lightning(origin, aim.point, () => {
        if (aim.target) preySystem.damagePrey(aim.target, 38);
        else setPlayStatus("Relâmpago errou o alvo");
      });
    }
    gameAudio.spell(name);
    button?.classList.remove("casting");
    requestAnimationFrame(() => button?.classList.add("casting"));
    setTimeout(() => button?.classList.remove("casting"), 300);
  }, 340);
}
let iceCasting = false;
let iceDamageCooldown = 0;
function startIceSpell() {
  if (buildEditor.buildMode) return;
  if (iceCasting || mounted || activeAction || inventoryState.stamina < 2) return;
  iceCasting = true;
  iceDamageCooldown = 0;
  activeAction = { state: "cast", elapsed: 0, duration: Infinity };
  setAnimation("cast");
  gameAudio.spell("ice");
  document.querySelector<HTMLElement>("[data-ice-spell]")?.classList.add("casting");
  setPlayStatus("Canalizando gelo...");
}
function stopIceSpell() {
  if (!iceCasting) return;
  iceCasting = false;
  spellEffects.stopIceStream();
  if (activeAction?.state === "cast" && activeAction.duration === Infinity) activeAction = null;
  document.querySelector<HTMLElement>("[data-ice-spell]")?.classList.remove("casting");
  saveInventory(inventoryState);
}
function updateIceSpell(delta: number) {
  if (!iceCasting) return;
  inventoryState.stamina = Math.max(0, inventoryState.stamina - 9 * delta);
  if (inventoryState.stamina <= 0) { stopIceSpell(); setPlayStatus("Vigor esgotado"); return; }
  const origin = character.getCastingHandWorldPosition();
  const aim = preySystem.forwardSpellTarget(origin, 10, .32);
  spellEffects.iceStream(origin, aim.point);
  updateStaminaHud(true);
  iceDamageCooldown -= delta;
  if (aim.target) {
    aim.target.frozenUntil = performance.now() + 180;
    aim.target.hudUntil = performance.now() + 500;
    if (iceDamageCooldown <= 0) {
      preySystem.damagePrey(aim.target, 3);
      aim.target.frozenUntil = performance.now() + 180;
      iceDamageCooldown = .35;
      setPlayStatus(`${aim.target.label} congelado`);
    }
  }
}
const iceButton = document.querySelector<HTMLButtonElement>("[data-ice-spell]")!;
iceButton.addEventListener("pointerdown", (event) => { event.preventDefault(); startIceSpell(); });
iceButton.addEventListener("pointerup", stopIceSpell);
iceButton.addEventListener("pointerleave", stopIceSpell);
iceButton.addEventListener("pointercancel", stopIceSpell);
document
  .querySelectorAll<HTMLButtonElement>("[data-quick-slot]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      equipmentSystem.selectedQuickSlot = Number(button.dataset.quickSlot);
      equipmentSystem.refreshQuickSlots();
    });
    button.addEventListener("dblclick", () => {
      const id = inventoryState.quickSlots[Number(button.dataset.quickSlot)],
        item = id ? ITEM_BY_ID.get(id) : undefined;
      if (item) useConsumable(item);
    });
    button.addEventListener("dragover", (event) => {
      const item = equipmentSystem.draggedItem ? ITEM_BY_ID.get(equipmentSystem.draggedItem.id) : undefined;
      if (item?.category === "consumable") {
        event.preventDefault();
        button.classList.add("drop-target");
      }
    });
    button.addEventListener("dragleave", () =>
      button.classList.remove("drop-target"),
    );
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drop-target");
      const item = equipmentSystem.draggedItem ? ITEM_BY_ID.get(equipmentSystem.draggedItem.id) : undefined;
      if (item) {
        equipmentSystem.selectedQuickSlot = Number(button.dataset.quickSlot);
        assignQuickSlot(item);
      }
    });
  });
document
  .querySelectorAll<HTMLButtonElement>("[data-spell]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      castSpell(button.dataset.spell as SpellName),
    ),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-filter]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      const filter = button.dataset.filter as ItemCategory | "clothing" | "all";
      document
        .querySelectorAll("[data-filter]")
        .forEach((value) => value.classList.toggle("active", value === button));
      let visible = 0;
      document
        .querySelectorAll<HTMLElement>("[data-item-id]")
        .forEach((card) => {
          const available =
              (inventoryState.quantities[card.dataset.itemId!] ?? 0) > 0,
            categoryMatch =
              filter === "all" ||
              (filter === "clothing"
                ? card.dataset.clothing === "true"
                : filter === "armor"
                  ? card.dataset.category === "armor" &&
                    card.dataset.clothing !== "true"
                  : card.dataset.category === filter),
            show = available && categoryMatch;
          card.hidden = !show;
          if (show) visible++;
        });
      document.querySelector("#inventoryCount")!.textContent =
        `${visible} itens`;
    }),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      const tab = button.dataset.inventoryTab;
      if(tab==="quests")renderQuestJournal(document.querySelector<HTMLElement>('[data-inventory-panel="quests"]')!,inventoryState,cityResidents.population,refreshCityInventory);
      avatarTarget = tab === "female" ? "female" : "player";
      avatarCamera.layers.set(avatarTarget === "female" ? 3 : 2);
      document.querySelector(".inventory-content")?.classList.toggle("page-open",tab==="settings"||tab==="map"||tab==="quests");
      document.querySelector(".inventory-window")?.classList.toggle("page-open",tab==="settings"||tab==="map"||tab==="quests");
      document
        .querySelectorAll("[data-inventory-tab]")
        .forEach((value) => value.classList.toggle("active", value === button));
      document.querySelectorAll<HTMLElement>("[data-main-tab]").forEach((value)=>{
        const page=tab==="quests"?"quests":tab==="map"?"map":tab==="settings"?"settings":"inventory";
        value.classList.toggle("active",value.dataset.mainTab===page);
      });
      document
        .querySelectorAll<HTMLElement>("[data-inventory-panel]")
        .forEach((panel) =>
          panel.classList.toggle(
            "active",
            panel.dataset.inventoryPanel === tab,
          ),
        );
    }),
  );

const hideItemTooltip = initializeItemTooltips(equipmentSystem.equippedItems);
for (const item of INVENTORY_CATALOG) {
  const quantity = inventoryState.quantities[item.id] ?? 0,
    button = equipmentSystem.itemButton(item.id);
  button?.querySelector<HTMLElement>("em")?.replaceChildren(String(quantity));
  if (quantity <= 0) button?.setAttribute("hidden", "");
}
equipmentSystem.syncCharacterEquipment();
equipmentSystem.refreshEquipmentSlots();
equipmentSystem.refreshQuickSlots();
refreshHud();

const refreshCityInventory=()=>{
  renderQuestJournal(document.querySelector<HTMLElement>('[data-inventory-panel="quests"]')!,inventoryState,cityResidents.population,refreshCityInventory);
  // Transactions update the persisted inventory first, then refresh all derived views.
  for(const [slot,id] of [...equipmentSystem.equippedItems])if((inventoryState.quantities[id]??0)===0)equipmentSystem.equippedItems.delete(slot);
  for(const item of INVENTORY_CATALOG){
    const button=equipmentSystem.itemButton(item.id),quantity=inventoryState.quantities[item.id]??0;
    button?.toggleAttribute('hidden',quantity<=0);button?.querySelector('em')?.replaceChildren(String(quantity));
  }
  refreshGoldBalance();equipmentSystem.syncCharacterEquipment();equipmentSystem.refreshEquipmentSlots();equipmentSystem.refreshQuickSlots();equipmentSystem.refreshCharacterStats();refreshHud();equipmentSystem.persist();
};
const chestInventory=new ChestInventory(viewport,inventoryState,refreshCityInventory);
const cityShop=new ShopPanel(viewport,inventoryState,id=>cityResidents.canTrade(id,character.group.position),refreshCityInventory);
const questNotice=document.createElement('aside');questNotice.className='quest-accepted-notice';questNotice.setAttribute('role','status');viewport.append(questNotice);
let questNoticeTimer:ReturnType<typeof setTimeout>|undefined;
const notifyQuestAccepted=(title:string)=>{
  clearTimeout(questNoticeTimer);questNotice.replaceChildren();
  const label=document.createElement('small');label.textContent='MISSÃO ACEITA';
  const name=document.createElement('strong');name.textContent=title;questNotice.append(label,name);
  questNotice.classList.add('visible');gameAudio.questAccepted();
  questNoticeTimer=setTimeout(()=>questNotice.classList.remove('visible'),4000);
};
const guildPanel=new GuildPanel(viewport,inventoryState,id=>cityResidents.guildContact(character.group.position)?.id===id,refreshCityInventory,notifyQuestAccepted);
const openGuild=()=>{
  if(mounted||broomFlying)return false;
  const contact=cityResidents.guildContact(character.group.position);if(!contact)return false;
  cityShop.close();setNpcDialogueOpen(false);setInventoryOpen(false);pressed.clear();activeAction=null;
  character.setAnimation("idle");guildPanel.show(contact);return true;
};
const openCityShop=(id?:string)=>{
  if(mounted||broomFlying)return false;
  const merchant=id?cityResidents.merchant(id):cityResidents.nearestMerchant(character.group.position);if(!merchant)return false;
  setNpcDialogueOpen(false);setInventoryOpen(false);pressed.clear();activeAction=null;
  guildPanel.close();character.setAnimation('idle');cityShop.show(merchant);return true;
};

const companionKiss=new CompanionKiss();
const requestCompanionKiss=(id:string)=>{
  const companion=cityResidents.residents.find(r=>r.citizen.id===id);
  if(!companion?.actor||inventoryState.companion?.id!==id||mounted||broomFlying||princessBedRest.active||companion.routine==='sleep'||inventoryState.hp<=0)return false;
  restoreBedOutfits();pressed.clear();activeAction=null;
  return companionKiss.start(character,companion.actor,companion.position);
};
const citizenConversations=new CitizenConversations(
  viewport,scene,cityBuilder.objects,inventoryState,character.group.position,
  ()=>cityResidents.residents,playerGroundHeightAt,refreshCityInventory,openCityShop,openGuild,()=>cityResidents.setCompanion(inventoryState.companion),requestCompanionKiss,notifyQuestAccepted,
);
cityResidents.setCompanion(inventoryState.companion);
const openCitizenConversation=()=>{
  if(mounted||broomFlying||!citizenConversations.nearest())return false;
  cityShop.close();guildPanel.close();setNpcDialogueOpen(false);setInventoryOpen(false);
  pressed.clear();activeAction=null;character.setAnimation('idle');
  return citizenConversations.show();
};

const scabbardEditor = document.querySelector<HTMLElement>("#scabbardEditor")!;
const scabbardPositionInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-scabbard-position]"),
];
const scabbardRotationInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-scabbard-rotation]"),
];
const scabbardWidthInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-scabbard-width]"),
];
const swordPositionInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-sword-position]"),
];
const shieldEditors = (["right", "left"] as const).map(side => {
  const positions = [...document.querySelectorAll<HTMLInputElement>(`[data-shield-position^="${side}-"]`)];
  const rotations = [...document.querySelectorAll<HTMLInputElement>(`[data-shield-rotation^="${side}-"]`)];
  const scaleInput = document.querySelector<HTMLInputElement>(`[data-shield-scale="${side}"]`)!;
  const sync = () => {
    const equipped = character.getShieldTransform(side);
    const transform = equipped ?? character.getSavedShieldTransform(side);
    const label = side === "right" ? "Mão esquerda" : "Mão direita";
    document.querySelector(`[data-shield-status="${side}"]`)!.textContent = `Escudo · ${label}${equipped ? " · equipado" : ""}`;
    transform.position.forEach((value: number, index: number) => positions[index].value = String(value));
    transform.rotation.forEach((value: number, index: number) => rotations[index].value = String(value));
    scaleInput.value = String(transform.scale);
  };
  const update = () => {
    const position = positions.map(input => Number(input.value));
    const rotation = rotations.map(input => Number(input.value));
    const scale = Math.max(0.1, Number(scaleInput.value));
    if (![...position, ...rotation, scale].every(Number.isFinite)) return;
    character.setShieldTransform(position, rotation, scale, side);
    localStorage.setItem(`rpg3d.shieldTransform.${side}`, JSON.stringify({position, rotation, scale}));
  };
  [...positions, ...rotations, scaleInput].forEach(input => {
    input.addEventListener("input", update);
    input.addEventListener("keydown", event => event.stopPropagation());
  });
  document.querySelector(`[data-shield-reset="${side}"]`)!.addEventListener("click", () => {
    localStorage.removeItem(`rpg3d.shieldTransform.${side}`);
    equipmentSystem.syncCharacterEquipment();
    sync();
  });
  return {sync};
});
const syncShieldEditor = () => shieldEditors.forEach(editor => editor.sync());
const syncScabbardEditor = () => {
  syncShieldEditor();
  const transform = character.getScabbardTransform();
  if (!transform) return;
  document.querySelector("#scabbardSide")!.textContent =
    `Bainha · lado ${transform.side === "right" ? "direito" : "esquerdo"}`;
  transform.position.forEach(
    (value, index) => (scabbardPositionInputs[index].value = value.toFixed(2)),
  );
  transform.rotation.forEach(
    (value, index) => (scabbardRotationInputs[index].value = value.toFixed(1)),
  );
  transform.width.forEach(
    (value, index) => (scabbardWidthInputs[index].value = value.toFixed(2)),
  );
  transform.swordPosition.forEach(
    (value, index) => (swordPositionInputs[index].value = value.toFixed(2)),
  );
};
const updateScabbardFromEditor = () => {
  const position = scabbardPositionInputs.map(
      (input) => Number(input.value) || 0,
    ) as [number, number, number],
    rotation = scabbardRotationInputs.map(
      (input) => Number(input.value) || 0,
    ) as [number, number, number],
    width = scabbardWidthInputs.map((input) =>
      Math.max(0.1, Number(input.value) || 1),
    ) as [number, number],
    swordPosition = swordPositionInputs.map(
      (input) => Number(input.value) || 0,
    ) as [number, number, number];
  character.setScabbardTransform(position, rotation);
  character.setScabbardWidth(width);
  character.setSheathedSwordPosition(swordPosition);
  localStorage.setItem(
    equipmentSystem.SCABBARD_TRANSFORM_KEY,
    JSON.stringify({
      position,
      rotation,
      width,
      swordPosition,
    } satisfies ScabbardTransform),
  );
};
[
  ...scabbardPositionInputs,
  ...scabbardRotationInputs,
  ...scabbardWidthInputs,
  ...swordPositionInputs,
].forEach((input) => {
  input.addEventListener("input", updateScabbardFromEditor);
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
document
  .querySelector<HTMLButtonElement>("[data-scabbard-reset]")!
  .addEventListener("click", () => {
    localStorage.removeItem(equipmentSystem.SCABBARD_TRANSFORM_KEY);
    equipmentSystem.syncCharacterEquipment();
    syncScabbardEditor();
  });
const setScabbardEditorOpen = (open: boolean) => {
  scabbardEditor.classList.toggle("hidden", !open);
  scabbardEditor.setAttribute("aria-hidden", String(!open));
  if (open) {
    pressed?.clear();
    syncScabbardEditor();
  }
};

const hoodEditor = document.querySelector<HTMLElement>("#hoodEditor")!;
const hoodPositionInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-hood-position]"),
];
const hoodRotationInputs = [
  ...document.querySelectorAll<HTMLInputElement>("[data-hood-rotation]"),
];
const hoodScaleInput = document.querySelector<HTMLInputElement>("[data-hood-scale]")!;
const syncHoodEditor = () => {
  mageHoodTransform.position.forEach(
    (value, index) => (hoodPositionInputs[index].value = value.toFixed(3)),
  );
  mageHoodTransform.rotation.forEach(
    (value, index) => (hoodRotationInputs[index].value = value.toFixed(1)),
  );
  hoodScaleInput.value = mageHoodTransform.scale.toFixed(4);
};
const updateHoodFromEditor = () => {
  mageHoodTransform = {
    position: hoodPositionInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    rotation: hoodRotationInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    scale: Math.max(.1, Number(hoodScaleInput.value) || .1),
  };
  applyMageHoodTransform();
  localStorage.setItem(HOOD_TRANSFORM_KEY, JSON.stringify(mageHoodTransform));
};
[...hoodPositionInputs, ...hoodRotationInputs, hoodScaleInput].forEach((input) => {
  input.addEventListener("input", updateHoodFromEditor);
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
document.querySelector<HTMLButtonElement>("[data-hood-reset]")!.addEventListener("click", () => {
  localStorage.removeItem(HOOD_TRANSFORM_KEY);
  mageHoodTransform = {
    ...DEFAULT_HOOD_TRANSFORM,
    position: [...DEFAULT_HOOD_TRANSFORM.position],
    rotation: [...DEFAULT_HOOD_TRANSFORM.rotation],
  };
  applyMageHoodTransform();
  syncHoodEditor();
});
const setHoodEditorOpen = (open: boolean) => {
  hoodEditor.classList.toggle("hidden", !open);
  hoodEditor.setAttribute("aria-hidden", String(!open));
  if (open) {
    pressed?.clear();
    syncHoodEditor();
  }
};

const nimbusHandEditor = document.querySelector<HTMLElement>("#nimbusHandEditor")!;
const nimbusPositionInputs = [...document.querySelectorAll<HTMLInputElement>("[data-nimbus-position]")];
const nimbusRotationInputs = [...document.querySelectorAll<HTMLInputElement>("[data-nimbus-rotation]")];
const nimbusScaleInput = document.querySelector<HTMLInputElement>("[data-nimbus-scale]")!;
const nimbusArmInputs = [...document.querySelectorAll<HTMLInputElement>("[data-nimbus-arm]")];
const syncNimbusHandEditor = () => {
  nimbusHandTransform.position.forEach((value, index) => nimbusPositionInputs[index].value = value.toFixed(3));
  nimbusHandTransform.rotation.forEach((value, index) => nimbusRotationInputs[index].value = value.toFixed(1));
  nimbusScaleInput.value = nimbusHandTransform.scale.toFixed(4);
  nimbusArmInputs.forEach((input) => {
    const [bone, group, index] = input.dataset.nimbusArm!.split(".") as ["shoulder"|"elbow"|"wrist","position"|"rotation",string];
    input.value = nimbusArmDebug[bone][group][Number(index)].toFixed(group === "rotation" ? 1 : 3);
  });
};
const updateNimbusHandFromEditor = () => {
  nimbusHandTransform = {
    position: nimbusPositionInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    rotation: nimbusRotationInputs.map((input) => Number(input.value) || 0) as [number, number, number],
    scale: Math.max(.1, Number(nimbusScaleInput.value) || .1),
  };
  localStorage.setItem(NIMBUS_HAND_TRANSFORM_KEY, JSON.stringify(nimbusHandTransform));
  equipmentSystem.syncCharacterEquipment();
};
[...nimbusPositionInputs, ...nimbusRotationInputs, nimbusScaleInput].forEach((input) => {
  input.addEventListener("input", updateNimbusHandFromEditor);
  input.addEventListener("keydown", (event) => event.stopPropagation());
});
nimbusArmInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const [bone, group, index] = input.dataset.nimbusArm!.split(".") as ["shoulder"|"elbow"|"wrist","position"|"rotation",string];
    const value=Number(input.value);if(!Number.isFinite(value))return;
    nimbusArmDebug[bone][group][Number(index)]=value;
    localStorage.setItem(NIMBUS_ARM_DEBUG_KEY,JSON.stringify(nimbusArmDebug));
    applyNimbusArmDebug();
  });
  input.addEventListener("keydown",(event)=>event.stopPropagation());
});
document.querySelector<HTMLButtonElement>("[data-nimbus-reset]")!.addEventListener("click", () => {
  localStorage.removeItem(NIMBUS_HAND_TRANSFORM_KEY);
  localStorage.removeItem(NIMBUS_ARM_DEBUG_KEY);
  nimbusHandTransform = structuredClone(DEFAULT_NIMBUS_HAND_TRANSFORM);
  nimbusArmDebug = structuredClone(DEFAULT_NIMBUS_ARM_DEBUG);
  equipmentSystem.syncCharacterEquipment();
  syncNimbusHandEditor();
});
const setNimbusHandEditorOpen = (open: boolean) => {
  nimbusHandEditor.classList.toggle("hidden", !open);
  nimbusHandEditor.setAttribute("aria-hidden", String(!open));
  if (open) { pressed?.clear(); syncNimbusHandEditor(); }
};

const pressed = new Set<string>();
const movementKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyP",
  "KeyO",
  "KeyE",
  "KeyQ",
  "KeyI",
  "KeyM",
  "KeyT",
  "KeyB",
  "KeyC",
  "KeyV",
  "KeyF",
  "ControlLeft",
  "ControlRight",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
]);
const inventoryModal =
  document.querySelector<HTMLDivElement>("#inventoryModal")!;
const setInventoryOpen = (open: boolean) => {
  inventoryModal.classList.toggle("open", open);
  inventoryModal.setAttribute("aria-hidden", String(!open));
  if (open) pressed.clear();
};
document
  .querySelector<HTMLButtonElement>(".inventory-close")!
  .addEventListener("click", () => setInventoryOpen(false));
document
  .querySelectorAll<HTMLButtonElement>("[data-open-build]")
  .forEach((button) => button.addEventListener("click", () => buildEditor.setBuildMode(true)));
inventoryModal.addEventListener("click", (event) => {
  if (event.target === inventoryModal) setInventoryOpen(false);
});
const dodgeDirection = new THREE.Vector3();
const playerDodgingHit = () => activeAction?.state === "dodge" && dodgeInvulnerable(activeAction.elapsed);
const princessBedRest = new PrincessBedRest();
let restOutfitsRemoved=false;
const restoreBedOutfits=()=>{
  if(!restOutfitsRemoved)return;
  character.setRestUndressed(false);cityResidents.setPrincessRestUndressed(false);
  restOutfitsRemoved=false;
  if(princessBedRest.active)princessBedRest.refreshFit(character.group);
};
const toggleBedOutfits=()=>{
  if(!princessBedRest.active)return;
  if(restOutfitsRemoved)restoreBedOutfits();
  else {
    if(!cityResidents.setPrincessRestUndressed(true)){setPlayStatus('Alice precisa estar deitada ao seu lado');return;}
    character.setRestUndressed(true);restOutfitsRemoved=true;
    princessBedRest.refreshFit(character.group);
  }
  setPlayStatus('F para trocar as roupas dos dois · E para levantar');
};
const togglePrincessBedRest = () => {
  if(mounted||broomFlying||inventoryState.hp<=0)return false;
  const wasResting=princessBedRest.active;
  if(wasResting){restoreBedOutfits();cityResidents.setCompanionBed(null);}
  if(!wasResting&&!princessBedRest.nearest(character.group.position,cityBuilder.objects.values()))return false;
  activeAction=null;pressed.clear();setAnimation('idle');character.update(0);
  if(!princessBedRest.toggle(character.group,cityBuilder.objects.values()))return false;
  if(princessBedRest.active&&inventoryState.companion){restoreBedOutfits();character.setRestUndressed(false);cityResidents.setCompanionBed(princessBedRest.home);}
  setPlayStatus(princessBedRest.active?(cityResidents.companionSharingBed?'Alice vem descansar ao seu lado · F para tirar/vestir roupas · E para levantar':'Deitado ao lado de Alice · F para tirar/vestir roupas · E para levantar'):'Você se levantou da cama');
  return true;
};
let activeAction: {
  state: AnimationState;
  elapsed: number;
  duration: number;
} | null = null;
function startAction(state: AnimationState, duration: number) {
  if (princessBedRest.active||companionKiss.active) return;
  if (buildEditor.buildMode) return;
  if (activeAction) return;
  if(state==='jump'){
    if(mounted||broomFlying||broomFallVelocity!==0)return;
    broomFallVelocity=Math.sqrt(2*PLAYER_GRAVITY*PLAYER_JUMP_HEIGHT);
    setAnimation('jump');return;
  }
  if (state === "dodge") {
    if(mounted||broomFlying||broomFallVelocity!==0||inventoryState.stamina<DODGE_STAMINA)return;
    if(playerWaterDepth()>.08&&character.group.position.y<=openWorld.getWaterLevelAt(character.group.position.x,character.group.position.z)-.12)return;
    const v=Number(pressed.has("KeyW")||pressed.has("ArrowUp"))-Number(pressed.has("KeyS")||pressed.has("ArrowDown"));
    const h=Number(pressed.has("KeyD")||pressed.has("ArrowRight"))-Number(pressed.has("KeyA")||pressed.has("ArrowLeft"));
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    right.crossVectors(forward,camera.up).normalize();
    if(v||h)dodgeDirection.copy(forward).multiplyScalar(v).addScaledVector(right,h).normalize();
    else dodgeDirection.set(Math.sin(character.group.rotation.y),0,Math.cos(character.group.rotation.y));
    character.group.rotation.set(0,Math.atan2(dodgeDirection.x,dodgeDirection.z),0);
    inventoryState.stamina-=DODGE_STAMINA;updateStaminaHud(true);duration=DODGE_DURATION;
  }
  if (state === "attack") {
    if (inventoryState.stamina < 8) return;
    inventoryState.stamina -= 8;
    updateStaminaHud(true);
  }
  activeAction = { state, elapsed: 0, duration };
  setAnimation(state);
  if (state === "attack") {
    gameAudio.attack(equipmentSystem.hasEquippedWeapon());
    preySystem.hitNearestPrey();
  }
}
window.addEventListener("keydown", (event) => {
  gameAudio.ensureStarted();
  const editingText = event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable);
  if(chestInventory.open){
    if(!event.repeat&&(event.code==='Escape'||event.code==='KeyR'||event.code==='KeyE'))chestInventory.close();
    event.preventDefault();return;
  }
  if(citizenConversations.open){
    if(!event.repeat&&(event.code==='Escape'||event.code==='KeyE')){citizenConversations.close();event.preventDefault();}
    else if(event.code==='Tab'){
      const buttons=[...citizenConversations.element.querySelectorAll<HTMLButtonElement>('button')];
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(buttons.length&&(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===buttons.length-1)){buttons[event.shiftKey?buttons.length-1:0].focus();event.preventDefault();}
    }
    return;
  }
  if(cityShop.open||guildPanel.open){
    if(!event.repeat&&(event.code==='Escape'||event.code==='KeyE')){cityShop.close();guildPanel.close();event.preventDefault();}
    else if(event.code==='Tab'){
      const panel=guildPanel.open?guildPanel.element:cityShop.element;
      const buttons=[...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(buttons.length&&(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===buttons.length-1)){
        buttons[event.shiftKey?buttons.length-1:0].focus();event.preventDefault();
      }
    }
    return;
  }
  if(companionKiss.active&&!editingText){if(event.code==='Escape')companionKiss.cancel();event.preventDefault();return;}
  if(princessBedRest.active&&!editingText){
    if(!event.repeat&&(event.code==='KeyE'||event.code==='Escape'))togglePrincessBedRest();
    else if(!event.repeat&&event.code==='KeyF')toggleBedOutfits();
    event.preventDefault();return;
  }
  if (!editingText && !event.repeat && event.code === "KeyT") {
    event.preventDefault();
    buildEditor.toggleTimeEditor();
    return;
  }
  if (buildEditor.buildMode && !editingText) {
    if (event.code === "Escape") { if (buildEditor.cityPlacementKind) buildEditor.clearCityPlacement(); else if (buildEditor.terrainBrushEnabled) { buildEditor.terrainBrushEnabled = false; buildEditor.terrainToggle.classList.remove("active"); buildEditor.terrainPreview.visible = false; } else buildEditor.setBuildMode(false); }
    else if (["KeyW","KeyA","KeyS","KeyD"].includes(event.code)) {
      // WASD is reserved for editor-camera travel. Automatically returning to
      // free camera makes movement work even after viewing from the player.
      if(!buildEditor.editorFreeCamera)document.querySelector<HTMLButtonElement>("[data-editor-camera]")?.click();
      pressed.add(event.code);
    }
    else if (event.code === "KeyE") document.querySelector<HTMLButtonElement>('[data-build-tool="rotate"]')?.click();
    else if (event.code === "KeyR") document.querySelector<HTMLButtonElement>('[data-build-tool="scale"]')?.click();
    else if (["ShiftLeft", "ShiftRight", "Space", "ControlLeft", "ControlRight"].includes(event.code)) pressed.add(event.code);
    event.preventDefault();
    return;
  }
  if (movementKeys.has(event.code)) event.preventDefault();
  pressed.add(event.code);
  if (!event.repeat && event.code === "KeyI") {
    setInventoryOpen(!inventoryModal.classList.contains("open"));
    return;
  }
  if (!event.repeat && event.code === "KeyM") {
    setMapOpen(!mapPanel.classList.contains("open"));
    return;
  }
  if (!event.repeat && event.code === "KeyB") {
    setScabbardEditorOpen(scabbardEditor.classList.contains("hidden"));
    return;
  }
  if (!event.repeat && event.code === "KeyC") {
    setMountEditorOpen(mountEditor.classList.contains("hidden"));
    pressed.clear();
    return;
  }
  if (!event.repeat && event.code === "KeyN") {
    setHoodEditorOpen(hoodEditor.classList.contains("hidden"));
    return;
  }
  if (!event.repeat && event.code === "KeyV") {
    setNimbusHandEditorOpen(nimbusHandEditor.classList.contains("hidden"));
    return;
  }
  if (!event.repeat && event.code === "KeyF") {
    equipmentSystem.toggleBroomFlight();
    return;
  }
  if (!event.repeat && event.code === "KeyO" && equipmentSystem.hasInventoryWeapon()) {
    equipmentSystem.swordsSheathed = true;
    character.setSwordSheathed(true);
    return;
  }
  if (!event.repeat && event.code.startsWith("Digit")) {
    const number = Number(event.code.slice(-1));
    if (number <= 4) {
      const id = inventoryState.quickSlots[number - 1],
        item = id ? ITEM_BY_ID.get(id) : undefined;
      if (item) useConsumable(item);
    } else if (number === 5) castSpell("heal");
    else if (number === 6) castSpell("firebolt");
    else if (number === 7) castSpell("lightning");
    else if (number === 8) startIceSpell();
    return;
  }
  if(!event.repeat&&event.code==='KeyR'){
    const chest=nearestRoyalChest(scene,character.group.position);
    if(chest){pressed.clear();setCorpseLootOpen();chestInventory.show(chest);return;}
  }
  if (!event.repeat && event.code === "Space" && !broomFlying) startAction("jump", 0);
  if (!event.repeat && event.code === "KeyP" && equipmentSystem.swordsSheathed) {
    equipmentSystem.swordsSheathed = false;
    character.setSwordSheathed(false);
    return;
  }
  if (!event.repeat && event.code === "KeyP")
    startAction("attack", equipmentSystem.hasEquippedWeapon() ? 1.05 : 0.52);
  if (!event.repeat && event.code === "KeyE") {
    const nearbyChest=nearestRoyalChest(scene,character.group.position);
    if(nearbyChest){pressed.clear();setCorpseLootOpen();chestInventory.show(nearbyChest);return;}
    if (togglePrincessBedRest()) return;
    if (toggleChurchDoor(character.group.position)) return;
    if(!broomFlying&&horseInteractionDistance()<=2.35){toggleMount();return;}
    if (openCitizenConversation()) return;
    if (openGuild()) return;
    if(!['inn','lodging'].includes(cityResidents.nearestMerchant(character.group.position)?.kind??'')&&openCityShop())return;
    if (toggleNearestChest()) return;
    if (toggleCorpseLoot()) return;
    if (npcDialogue.classList.contains("open")) {
      toggleNpcDialogue();
      return;
    }
    if (mounted) {
      toggleMount();
      return;
    }
    const npcDistance = nearestWarrior().distance,
      horseDistance = horseInteractionDistance();
    if (horseDistance <= 2.35 && horseDistance <= npcDistance) toggleMount();
    else if (npcDistance <= 2.7) toggleNpcDialogue();
    else if (horseDistance <= 2.35) toggleMount();
    return;
  }
  if (!event.repeat && event.code === "KeyQ" && !broomFlying) startAction("dodge", 1.1);
});
window.addEventListener("keyup", (event) => {
  pressed.delete(event.code);
  if (event.code === "Digit8") stopIceSpell();
});
window.addEventListener("blur", () => pressed.clear());

type RemoteControllerMessage =
  | { type: "key"; code: string; down: boolean }
  | { type: "camera"; dx: number; dy: number }
  | { type: "action"; action: "cross" | "start" | "triangle"; down: boolean };
const applyRemoteControllerMessage = (message: RemoteControllerMessage) => {
  if (message.type === "key") {
    window.dispatchEvent(new KeyboardEvent(message.down ? "keydown" : "keyup", { code: message.code, bubbles: true }));
    return;
  }
  if (message.type === "action") {
    if (message.action === "start") {
      if (message.down) window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI", bubbles: true }));
      else window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyI", bubbles: true }));
      return;
    }
    if (message.action === "triangle") {
      const canInteract = princessBedRest.active || !!princessBedRest.nearest(character.group.position,cityBuilder.objects.values()) || !!churchDoorPrompt(character.group.position) || citizenConversations.open || !!citizenConversations.nearest() || guildPanel.open || !!cityResidents.guildContact(character.group.position) || cityShop.open || !!cityResidents.nearestMerchant(character.group.position) || mounted || corpseLoot.classList.contains("open") || npcDialogue.classList.contains("open") || horseInteractionDistance() <= 2.35 || nearestWarrior().distance <= 2.7;
      const code = broomFlying || !canInteract ? "KeyF" : "KeyE";
      window.dispatchEvent(new KeyboardEvent(message.down ? "keydown" : "keyup", { code, bubbles: true }));
      return;
    }
    if (message.down) {
      const code = mounted || broomFlying ? "ShiftLeft" : "Space";
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
    } else {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    }
    return;
  }
  const offset = camera.position.clone().sub(controls.target), spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= message.dx * .012;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - message.dy * .01, .18, Math.PI - .22);
  camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
  controls.update();
};
if (import.meta.hot) import.meta.hot.on("rpg:controller-input", applyRemoteControllerMessage);

let currentAnimation: AnimationState = "idle";
function setAnimation(next: AnimationState) {
  if (next === currentAnimation) return;
  currentAnimation = next;
  character.setAnimation(next);
  setPlayStatus(
    next === "run"
      ? "Correndo"
      : next === "walk"
        ? "Caminhando"
        : "Explore livremente",
  );
}

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const mountedCameraTarget = new THREE.Vector3();
const horseWorldScale = new THREE.Vector3();
const collisionScratch = new THREE.Vector3();
const followTargetScratch = new THREE.Vector3();
const preyPreviousPositionScratch = new THREE.Vector3();
const frameDirectionScratch=new THREE.Vector3(),frameRightScratch=new THREE.Vector3(),frameMovementScratch=new THREE.Vector3();
const screenPositionScratch=new THREE.Vector3(),shadowPositionScratch=new THREE.Vector3();
const frameQuaternionScratch=new THREE.Quaternion(),frameEulerScratch=new THREE.Euler();
let simulationAccumulator=0,shadowAccumulator=0,horseCameraLookYaw=0;
character.group.traverse(object=>{if(object instanceof THREE.Mesh)object.userData.alwaysShadow=true;});
const updateLocalShadowCasters=()=>{
  if(!renderer.shadowMap.enabled)return;
  scene.updateMatrixWorld();
  scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object.userData.cityStructureInstances)return;
    if(object.userData.noFireShadow){object.castShadow=false;return;}
    if(object.userData.alwaysShadow){object.castShadow=true;return;}
    if(object instanceof THREE.InstancedMesh||object===floor||object.name.startsWith("Terreno ")){object.castShadow=false;return;}
    shadowPositionScratch.setFromMatrixPosition(object.matrixWorld);
    let reach=quality.shadowDistance;
    if(object.userData.palaceComplexMesh){
      if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
      const bounds=object.geometry.boundingSphere;
      if(bounds){shadowPositionScratch.copy(bounds.center).applyMatrix4(object.matrixWorld);reach+=bounds.radius*object.matrixWorld.getMaxScaleOnAxis();}
    }
    object.castShadow=object.visible&&shadowPositionScratch.distanceToSquared(character.group.position)<=reach*reach;
  });
};
const cameraFollowHeight = new THREE.Vector3(0, PLAYER_CAMERA_HEAD_HEIGHT, 0);
const underwaterFilter = document.querySelector("#underwaterFilter");
function resolveWorldCollisions(
  position: THREE.Vector3,
  radius: number,
  ignored?: THREE.Object3D,
) {
  // Animals use this resolver too. Treat the player as a solid body unless
  // the player itself is the object currently being moved.
  if(ignored!==character.group&&!mounted)resolveCircleCollision(position,radius,character.group.position,.34,collisionScratch);
  warriorNpcs.forEach((npc, index) => {
    if(npc.group.userData.mapHidden||npc.group.userData.cityResidentManaged)return;
    if (mounted && followingWarriorIndex === index) return;
    if (npc.group !== ignored) resolveCircleCollision(position, radius, npc.group.position, .34, collisionScratch);
  });
  cityResidents.resolveCollisions(position,radius);
  preySystem.preyAnimals.forEach((prey) => {
    if (prey.root.visible && prey.root !== ignored) resolveCircleCollision(position, radius, prey.position, preySystem.preyRadius(prey), collisionScratch);
  });
  if(!mounted&&horseRoot&&!rideableHorses.has(horseRoot)&&horseRoot!==ignored)resolveCircleCollision(position,radius,horseRoot.position,.78,collisionScratch);
  for(const state of rideableHorses.values()){
    if(state.root===ignored||(mounted&&state.root===horseRoot)||!state.root.parent)continue;
    resolveHorseCollision(state,position,radius);
  }
  // Ship hulls use an oriented box so collision follows the model even after
  // it is rotated, scaled, duplicated or moved through the Build editor.
  for(const object of scene.children){
    if(!object.visible||!object.userData.solidHarbor||object===ignored)continue;
    object.updateWorldMatrix(true,false);
    const local=object.worldToLocal(position.clone()),half=object.userData.collisionHalfSize as [number,number];
    const scale=Math.max(.001,Math.min(Math.abs(object.scale.x),Math.abs(object.scale.z))),padding=radius/scale;
    if(Math.abs(local.x)>half[0]+padding||Math.abs(local.z)>half[1]+padding)continue;
    const dx=half[0]+padding-Math.abs(local.x),dz=half[1]+padding-Math.abs(local.z);
    if(dx<dz)local.x=Math.sign(local.x||1)*(half[0]+padding);else local.z=Math.sign(local.z||1)*(half[1]+padding);
    object.localToWorld(local);position.x=local.x;position.z=local.z;
  }
  openWorld.resolveCollisions(position, radius);
  cityBuilder.resolveCollisions(position,radius);
  resolveCityAnimalCollisions(position,radius);
}
function moveAnimalAvoiding(prey:Prey,direction:THREE.Vector3,distance:number){
  const start=prey.position.clone(),radius=preySystem.preyRadius(prey);
  const forward=start.clone().addScaledVector(direction,distance);
  resolveWorldCollisions(forward,radius,prey.root);
  const forwardProgress=forward.clone().sub(start).dot(direction);
  let destination=forward;
  if(forwardProgress<distance*.45){
    const side=new THREE.Vector3(-direction.z,0,direction.x);
    const now=performance.now();
    if(now>=prey.avoidanceUntil){
      prey.avoidanceSign=preySystem.preyAnimals.indexOf(prey)%2?-1:1;
      prey.avoidanceUntil=now+700;
    }
    const lateral=(sign:-1|1)=>{
      const point=start.clone().addScaledVector(side,sign*distance*1.35);
      resolveWorldCollisions(point,radius,prey.root);
      return point;
    };
    destination=lateral(prey.avoidanceSign);
    if(destination.distanceToSquared(start)<distance*distance*.16){
      prey.avoidanceSign=prey.avoidanceSign===1?-1:1;
      prey.avoidanceUntil=now+700;
      destination=lateral(prey.avoidanceSign);
    }
  }
  const displacement=destination.clone().sub(start);
  prey.position.copy(destination);
  prey.root.position.add(displacement);
  // Asset-authored forward axes differ: bear faces -X and chicken faces -Z.
  const modelHeadingOffset=prey.id==="bear"?Math.PI*.5:prey.id==="chicken"?Math.PI:0;
  if(displacement.lengthSq()>.000001)prey.root.rotation.y=Math.atan2(displacement.x,displacement.z)+modelHeadingOffset;
}
function playerWaterDepth() {
  if (!openWorld.isWaterAt(character.group.position.x, character.group.position.z)) return 0;
  return Math.max(0, openWorld.getWaterLevelAt(character.group.position.x, character.group.position.z) - .5 - playerGroundHeightAt(character.group.position.x, character.group.position.z));
}
const isSubmergedAt=(position:THREE.Vector3)=>
  openWorld.isWaterAt(position.x,position.z)&&
  position.y<openWorld.getWaterLevelAt(position.x,position.z)-.08;
function updatePlayerBuoyancy(delta: number) {
  const ground = playerGroundHeightAt(character.group.position.x, character.group.position.z)+PLAYER_GROUND_OFFSET;
  const waterLevel = openWorld.getWaterLevelAt(character.group.position.x, character.group.position.z);
  const targetY=Math.max(ground,waterLevel-1.85+Math.sin(performance.now()*.0022)*.012);
  character.group.position.y=THREE.MathUtils.lerp(character.group.position.y,targetY,1-Math.exp(-5*delta));
}
let playerDeathElapsed:number|undefined;
const respawnPlayerInCity=()=>{
  const square=[...cityBuilder.objects.values()].find(o=>o.name==="Cidade:fountain");
  const x=square?.position.x??0,z=(square?.position.z??7.5)+30;
  character.group.position.set(x,playerGroundHeightAt(x,z)+PLAYER_GROUND_OFFSET,z);character.group.rotation.y=0;
  inventoryState.hp=equipmentSystem.totalStats().hp;inventoryState.stamina=equipmentSystem.totalStats().stamina;
  broomFallVelocity=0;playerDeathElapsed=undefined;activeAction=null;pressed.clear();setAnimation("idle");
  saveInventory(inventoryState);refreshHud();snapCameraToPlayer();setPlayStatus("Você voltou à Cidade Inicial");
};
function updatePlayer(delta: number) {
  if(companionKiss.active){character.setAnimation('idle');return;}
  if (princessBedRest.active) {
    if(inventoryState.hp<=0){restoreBedOutfits();cityResidents.setCompanionBed(null);princessBedRest.toggle(character.group,cityBuilder.objects.values());}
    else {character.setAnimation("idle");return;}
  }
  if (buildEditor.buildMode) return;
  if(cityShop.open||guildPanel.open||citizenConversations.open){character.setAnimation('idle');return;}
  if(inventoryState.hp<=0||playerDeathElapsed!==undefined){
    if(playerDeathElapsed===undefined){
      playerDeathElapsed=0;activeAction=null;pressed.clear();
      if(broomFlying)equipmentSystem.toggleBroomFlight();if(mounted)toggleMount();
      setAnimation("death");setPlayStatus("Você morreu...");saveInventory(inventoryState);refreshHud();
    }
    playerDeathElapsed+=delta;setAnimation("death");
    if(playerDeathElapsed>=3)respawnPlayerInCity();
    return;
  }
  const inWater = playerWaterDepth() > .08 && character.group.position.y<=openWorld.getWaterLevelAt(character.group.position.x,character.group.position.z)-.12;
  const movingInput =
      pressed.has("KeyW") ||
      pressed.has("KeyS") ||
      pressed.has("KeyA") ||
      pressed.has("KeyD") ||
      pressed.has("ArrowUp") ||
      pressed.has("ArrowDown") ||
      pressed.has("ArrowLeft") ||
      pressed.has("ArrowRight"),
    sprinting =
      !inWater && movingInput && (pressed.has("ShiftLeft") || pressed.has("ShiftRight"));
  inventoryState.stamina = THREE.MathUtils.clamp(
    inventoryState.stamina + (sprinting ? -14 : 10) * delta,
    0,
    equipmentSystem.totalStats().stamina,
  );
  updateStaminaHud(sprinting || activeAction?.state === "attack");
  if (broomFlying) {
    const vertical = Number(pressed.has("KeyW") || pressed.has("ArrowUp")) - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
    const horizontal = Number(pressed.has("KeyD") || pressed.has("ArrowRight")) - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
    const rising = Number(pressed.has("Space")) - Number(pressed.has("ControlLeft") || pressed.has("ControlRight"));
    const boosting = (pressed.has("ShiftLeft") || pressed.has("ShiftRight")) && inventoryState.stamina > 0;
    const broomMoving=Boolean(vertical||horizontal||rising);
    const broomSubmerged=isSubmergedAt(character.group.position);
    gameAudio.setFlight(broomMoving&&!broomSubmerged,boosting&&broomMoving&&!broomSubmerged);
    camera.getWorldDirection(forward);
    if(forward.lengthSq()>.0001)forward.normalize();
    const targetBroomPitch=Math.asin(THREE.MathUtils.clamp(forward.y,-1,1));
    broomAimPitch=THREE.MathUtils.lerp(broomAimPitch,targetBroomPitch,1-Math.exp(-10*delta));
    character.setBroomAimPitch(broomAimPitch);
    if(broomMountVisual)broomMountVisual.rotation.set(
      THREE.MathUtils.degToRad(broomRideDebug.model.rotation[0])-broomAimPitch,
      THREE.MathUtils.degToRad(broomRideDebug.model.rotation[1]),
      THREE.MathUtils.degToRad(broomRideDebug.model.rotation[2]),
    );
    right.crossVectors(forward,camera.up).normalize();
    if(Math.hypot(forward.x,forward.z)>.001)character.group.rotation.y=Math.atan2(forward.x,forward.z);
    const flightStart=character.group.position.clone();
    move.set(0,0,0);
    if (vertical || horizontal) {
      const flightSpeed = boosting ? 80 : 40;
      move.copy(forward).multiplyScalar(vertical).addScaledVector(right,horizontal).normalize().multiplyScalar(flightSpeed*delta);
    }
    if(rising)move.y+=rising*(boosting?20:10)*delta;
    // Building floors must not snap the flying rider up into a ceiling/wall.
    // Clamp against outdoor ground before collision, never after collision.
    const target=flightStart.clone().add(move);
    const flightGround=Math.max(harborGroundHeightAt(target.x,target.z,openWorld.getHeightAt(target.x,target.z)),cityFloor.heightAt(target.x,target.z)??-Infinity,cityFloor.stairHeightAt(target.x,target.z)??-Infinity);
    target.y=THREE.MathUtils.clamp(target.y,flightGround+1.05,flightGround+250);
    openWorld.resolveCollisions(target,.42,target.y);
    move.subVectors(target,flightStart);
    broomImpact.move(character.group.position,move,delta,(start,end,normal)=>cityBuilder.resolveFlightMovement(start,end,.42,normal),boosting);
    character.setMountedLegSpread(.24);
    character.setBroomRiding(true);
    setAnimation("mounted");
    setPlayStatus(boosting ? "Nimbus em velocidade máxima · mouse direciona · F desmontar" : "Voando · mouse direciona · F desmontar");
    return;
  }
  if (mounted && horseRoot && horseMountAnchor) {
    character.setMountedLegSpread(mountDebug.legSpread);
    const vertical =
      Number(pressed.has("KeyW") || pressed.has("ArrowUp")) -
      Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
    const horizontal =
      Number(pressed.has("KeyD") || pressed.has("ArrowRight")) -
      Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
    const running =
      (pressed.has("ShiftLeft") || pressed.has("ShiftRight")) &&
      inventoryState.stamina > 0;
    // A/D steer the shared camera heading; W/S provide forward/backward motion.
    if(horizontal){
      const turn=-horizontal*(running?1.35:1.05)*delta;
      cameraOffset.copy(camera.position).sub(controls.target).applyAxisAngle(camera.up,turn);
      camera.position.copy(controls.target).add(cameraOffset);
      camera.lookAt(controls.target);camera.updateMatrixWorld();
    }
    camera.getWorldDirection(forward);forward.y=0;
    if(forward.lengthSq()>.000001){
      forward.normalize();
      const cameraHeading=Math.atan2(forward.x,forward.z);
      const cameraTurn=Math.atan2(Math.sin(cameraHeading-horseRoot.rotation.y),Math.cos(cameraHeading-horseRoot.rotation.y));
      horseCameraLookYaw=THREE.MathUtils.clamp(cameraTurn/Math.max(delta,.001)*.12-horizontal*.25,-.4,.4);
      horseRoot.rotation.set(0,cameraHeading,0);
    }else forward.set(Math.sin(horseRoot.rotation.y),0,Math.cos(horseRoot.rotation.y));
    const moving = vertical !== 0 || horizontal !== 0;
    if (moving) {
      const base=running?"run":"walk",turn=horizontal<0?"-left":horizontal>0?"-right":"";
      setHorseMotion(base+turn,(vertical<0?-1:1)*(running?1.6:1));
      const distance=(running?14.88:4.725)*vertical*delta;
      move.copy(forward).multiplyScalar(distance);
      horseRoot.position.add(move);
      horseRoot.getWorldScale(horseWorldScale);
      resolveWorldCollisions(horseRoot.position,.78*Math.max(.65,horseWorldScale.z),horseRoot);
      horseRoot.position.y=Math.max(openWorld.getHeightAt(horseRoot.position.x,horseRoot.position.z),cityFloor.heightAt(horseRoot.position.x,horseRoot.position.z)??-Infinity,cityBuilder.walkHeightAt(horseRoot.position.x,horseRoot.position.z,horseRoot.position.y)??-Infinity);
      setPlayStatus(
        running
          ? "Cavalo correndo · E desmontar"
          : "Cavalo andando · E desmontar",
      );
    } else if (horseCurrentMotion !== "idle") {
      setHorseMotion("idle");
      setPlayStatus("Montado · E desmontar");
    }
    horseMountAnchor.getWorldPosition(mountPosition);
    horseRoot.getWorldScale(horseWorldScale);
    const horseScaleFactor = Math.max(.65, horseWorldScale.z);
    // Keep the rider slightly forward from the saddle anchor. The offset is
    // proportional to the edited horse scale without pushing the rider onto
    // the neck or leaving them over the rump.
    const riderForwardOffset = mountDebug.riderForward * horseScaleFactor;
    character.group.position.set(
      mountPosition.x + Math.sin(horseRoot.rotation.y) * riderForwardOffset,
      mountPosition.y + mountDebug.riderHeight,
      mountPosition.z + Math.cos(horseRoot.rotation.y) * riderForwardOffset,
    );
    horseRoot.getWorldQuaternion(frameQuaternionScratch);
    character.group.rotation.set(0,frameEulerScratch.setFromQuaternion(frameQuaternionScratch,'YXZ').y,0);
    // Follow the saddle without changing the player's orbit or zoom.
    mountedCameraTarget.copy(mountPosition);
    mountedCameraTarget.y += 0.35;
    const cameraAlpha = 1 - Math.exp(-6 * delta);
    controls.enabled = true;
    cameraOffset.copy(camera.position).sub(controls.target);
    controls.target.lerp(mountedCameraTarget, cameraAlpha);
    camera.position.copy(controls.target).add(cameraOffset);
    setAnimation("mounted");
    return;
  }
  controls.enabled = true;
  let airborne=broomFallVelocity!==0;
  const updateVertical=()=>{
    if(inWater&&broomFallVelocity<=0){broomFallVelocity=0;airborne=false;updatePlayerBuoyancy(delta);return;}
    const ground=playerGroundHeightAt(character.group.position.x,character.group.position.z,!airborne)+PLAYER_GROUND_OFFSET;
    const motion=advancePlayerVertical(character.group.position.y,broomFallVelocity,ground,delta,PLAYER_GRAVITY);
    character.group.position.y=motion.height;broomFallVelocity=motion.velocity;airborne=motion.airborne;
  };
  if (activeAction) {
    const previousElapsed=activeAction.elapsed;
    activeAction.elapsed += delta;
    if(activeAction.state==="dodge"){
      const distance=DODGE_DISTANCE*(dodgeProgress(activeAction.elapsed)-dodgeProgress(previousElapsed));
      const steps=Math.max(1,Math.ceil(distance/.08));
      for(let i=0;i<steps;i++){
        character.group.position.addScaledVector(dodgeDirection,distance/steps);
        resolveWorldCollisions(character.group.position,.32,character.group);
        if(!airborne){
          const ground=playerGroundHeightAt(character.group.position.x,character.group.position.z)+PLAYER_GROUND_OFFSET;
          if(character.group.position.y-ground<=.08)character.group.position.y=ground;
          else {broomFallVelocity=-Number.EPSILON;airborne=true;}
        }
      }
    }
    if (activeAction.elapsed < activeAction.duration){updateVertical();return;}
    activeAction = null;
  }
  const vertical =
    Number(pressed.has("KeyW") || pressed.has("ArrowUp")) -
    Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
  const horizontal =
    Number(pressed.has("KeyD") || pressed.has("ArrowRight")) -
    Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
  if (!vertical && !horizontal) {
    updateVertical();
    setAnimation(airborne?"jump":inWater?"swim":"idle");
    return;
  }

  camera.getWorldDirection(forward);
  if(!inWater)forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();
  move
    .copy(forward)
    .multiplyScalar(vertical)
    .addScaledVector(right, horizontal)
    .normalize();
  const running =
    !inWater &&
    (pressed.has("ShiftLeft") || pressed.has("ShiftRight")) &&
    inventoryState.stamina > 0;
  const speed = (running ? 13.5 : 5.7) * (inWater ? .48 : 1);
  const distance = speed * delta;
  // Sample short moves so running and slow frames cannot skip stair treads.
  const movementSteps=Math.max(1,Math.ceil(distance/.08));
  for(let step=0;step<movementSteps;step++){
    character.group.position.addScaledVector(move,distance/movementSteps);
    resolveWorldCollisions(character.group.position,0.32,character.group);
    if(!inWater&&!airborne){
      const ground=playerGroundHeightAt(character.group.position.x,character.group.position.z)+PLAYER_GROUND_OFFSET;
      if(character.group.position.y-ground<=.08)character.group.position.y=ground;
      else {broomFallVelocity=-Number.EPSILON;airborne=true;}
    }
  }
  if(inWater&&!airborne){
    const swimGround=playerGroundHeightAt(character.group.position.x,character.group.position.z);
    const swimSurface=openWorld.getWaterLevelAt(character.group.position.x,character.group.position.z);
    character.group.position.y=THREE.MathUtils.clamp(character.group.position.y,swimGround+.18,swimSurface-.12);
  }
  updateVertical();
  character.group.rotation.set(0,Math.atan2(move.x, move.z),0);

  setAnimation(airborne?"jump":inWater?"swimMove":running ? "run" : "walk");
}

new ResizeObserver(() => {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(viewport);

let previous = performance.now();
let survivalSaveAccumulator = 0;
let lastMapDrawAt = -Infinity;
function playAnimalMotion(prey: Prey, motion: "idle" | "walk") {
  if (prey.currentMotion === motion) return;
  const clips = prey.root.userData.clips as THREE.AnimationClip[];
  const clip = motion === "walk"
    ? clips.find((value) => /walk|run|gallop|hop/i.test(value.name))
    : THREE.AnimationClip.findByName(clips, prey.idleClip) ?? clips.find((value) => /idle|eat/i.test(value.name));
  if (!clip) return;
  prey.mixer.stopAllAction();
  prey.mixer.clipAction(clip).reset().fadeIn(.16).play();
  prey.currentMotion = motion;
}
function playAnimalAttackMotion(prey:Prey){
  const clips=prey.root.userData.clips as THREE.AnimationClip[];
  const preferred=prey.id==="wolf"?/selection|attack|bite/i:prey.id==="puma"?/roar|attack|bite/i:/attack|bite/i;
  const clip=clips.find(value=>preferred.test(value.name));
  prey.mixer.stopAllAction();
  if(clip){const action=prey.mixer.clipAction(clip).reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(.08).play();}
  else {const idle=THREE.AnimationClip.findByName(clips,prey.idleClip)??clips[0];if(idle)prey.mixer.clipAction(idle).reset().fadeIn(.08).play();}
  prey.currentMotion="idle";
}
let lastScheduledWolfHowl="";
let lastWorldClock="";
const mapPhaseLabel=document.querySelector("#mapPhase")!;
const inventoryMapPhaseLabel=document.querySelector("#inventoryMapPhase")!;
function updateWorld(delta: number) {
  if (!timePaused) inventoryState.worldTime += (delta / 480) * timeSpeed;
  if (inventoryState.worldTime >= 1) {
    const elapsedDays = Math.floor(inventoryState.worldTime);
    inventoryState.worldTime -= elapsedDays;
    inventoryState.worldDay += elapsedDays;
  }
  const t = inventoryState.worldTime;
  const phase =
      t < 0.22
        ? "Noite"
        : t < 0.42
          ? "Manhã"
          : t < 0.7
            ? "Dia"
            : t < 0.82
              ? "Tarde"
              : "Noite",
    hours = Math.floor(t * 24),
    minutes = Math.floor((t * 24 - hours) * 60),
    clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    dateTime = `Dia ${inventoryState.worldDay} · ${clock} · ${phase}`;
  if(dateTime!==lastWorldClock){
    lastWorldClock=dateTime;
    hudPhase.textContent=dateTime;
    mapPhaseLabel.textContent=dateTime;
    inventoryMapPhaseLabel.textContent=dateTime;
    timeEditorValue.textContent=clock;
  }
  if (document.activeElement !== timeSlider) timeSlider.value = String(t * 24);
  if (document.activeElement !== dayInput)
    dayInput.value = String(inventoryState.worldDay);
  const wideCamera=buildEditor.buildMode||broomFlying;
  const shadowRadius = wideCamera ? Math.max(40, camera.position.distanceTo(controls.target) * 1.15) : 48;
  const localWeather=syncBiomeWeather();
  const skyLight = skySystem.update(t, camera.position, localWeather, delta, controls.target, shadowRadius);
  scene.environmentIntensity = (.04 + skyLight.daylight * .56) * (localWeather === "clear" ? 1 : .65);
  cloudSystem.update(delta, character.group.position, skyLight.daylight, localWeather);
  const fogColor = new THREE.Color(
    phase === "Noite" ? "#081024" : phase === "Tarde" ? "#b96e55" : "#8fc9e5",
  );
  if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(fogColor);
  const fog = scene.fog;
  if (fog instanceof THREE.Fog) {
    fog.near = wideCamera ? 10000 : 18;
    fog.far = wideCamera
      ? 10001
      : localWeather === "snow"
        ? 22
        : localWeather === "rain"
          ? 29
          : 40;
  }
  cityBuilder.prepareWeatherCover();
  weatherSystem.update(delta, character.group.position,(x,z)=>cityBuilder.roofHeightAt(x,z));
  // Survival drain is temporarily disabled while the combat/progression loop
  // is being tuned. Keep existing saves pinned to full hunger and thirst.
  inventoryState.hunger=100;
  inventoryState.thirst=100;
  survivalSaveAccumulator += delta;
  if (survivalSaveAccumulator >= 2) {
    survivalSaveAccumulator = 0;
    saveInventory(inventoryState);
    refreshHud();
  }
}
function updateEditorCamera(delta: number) {
  if (!buildEditor.buildMode || !buildEditor.editorFreeCamera) return;
  const vertical = Number(pressed.has("KeyW")) - Number(pressed.has("KeyS")), horizontal = Number(pressed.has("KeyD")) - Number(pressed.has("KeyA"));
  const elevation=Number(pressed.has("Space"))-Number(pressed.has("ControlLeft")||pressed.has("ControlRight"));
  if (!vertical && !horizontal && !elevation) return;
  const direction=frameDirectionScratch;camera.getWorldDirection(direction);direction.y=0;direction.normalize();const rightward=frameRightScratch.crossVectors(direction,camera.up).normalize();
  const movement=frameMovementScratch.copy(direction).multiplyScalar(vertical).addScaledVector(rightward,horizontal).addScaledVector(camera.up,elevation).normalize().multiplyScalar(delta*(pressed.has("ShiftLeft")||pressed.has("ShiftRight")?72:28));camera.position.add(movement);controls.target.add(movement);
}
// Reserve the shared lights before the first render, before GLBs arrive.
previous=performance.now();
document.addEventListener('visibilitychange',()=>{
  previous=performance.now();simulationAccumulator=0;performanceMonitor.reset();
});
// Navigation generators survive across frames; stable callbacks attribute their
// queries to the current frame instead of a captured, already-reported sample.
let residentHeightMs=0,residentCollisionMs=0;
const residentGroundHeight=(x:number,z:number,feetY=0)=>{
  const started=performance.now();
  const height=Math.max(openWorld.getHeightAt(x,z),cityFloor.heightAt(x,z)??-Infinity,cityFloor.stairHeightAt(x,z)??-Infinity,cityBuilder.walkHeightAt(x,z,feetY)??-Infinity);
  residentHeightMs+=performance.now()-started;return height;
};
const residentResolveCollisions=(position:THREE.Vector3,radius:number)=>{
  const started=performance.now();cityBuilder.resolveCollisions(position,radius);residentCollisionMs+=performance.now()-started;
};
let lastAvatarRenderAt=-Infinity;
renderer.setAnimationLoop((now) => {
  if(document.hidden){previous=now;return;}
  const framePrevious=previous;
  const delta = Math.min((now - previous) / 1000, 0.05);
  simulationAccumulator+=delta;shadowAccumulator+=delta;
  const simulationStep=1/quality.simulationHz,simulationTick=simulationAccumulator>=simulationStep;
  const simulationDelta=simulationTick?Math.floor(simulationAccumulator/simulationStep)*simulationStep:0;
  if(simulationTick)simulationAccumulator-=simulationDelta;
  if(shadowAccumulator>=.5){shadowAccumulator=0;cityBuilder.updatePropVisibility(buildEditor.buildMode?controls.target:character.group.position);updateLocalShadowCasters();}
  const residentsStart=performance.now();
  const talkingResidentId=citizenConversations.activeCitizenId??(npcDialogue.classList.contains('open')?cityResidents.residents.find(r=>r.citizen.existingIndex===activeWarriorIndex)?.citizen.id??null:null);
  cityResidents.setConversation(talkingResidentId);
  cityResidents.setCompanionPaused(buildEditor.buildMode||companionKiss.active);
  residentHeightMs=0;residentCollisionMs=0;
  // Resident navigation, height queries and collision resolution are gameplay
  // simulation, not render work. Running all 146 residents at display rate was
  // needlessly consuming whole frames (especially while the camera was still).
  // Their meshes/animations remain rendered every frame; only their simulation
  // advances at the already-selected quality cadence.
  if (simulationTick) {
    cityResidents.update(simulationDelta,character.group.position,residentGroundHeight,residentResolveCollisions,inventoryState.worldTime);
  }
  performanceMonitor.record("moradores",performance.now()-residentsStart);

  performanceMonitor.record("NPC altura",residentHeightMs);performanceMonitor.record("NPC colisao",residentCollisionMs);
  const cityAnimalStart=performance.now();
  updateCityAnimals(delta,(x,z)=>Math.max(openWorld.getHeightAt(x,z),cityFloor.heightAt(x,z)??-Infinity,cityFloor.stairHeightAt(x,z)??-Infinity),
    (position,radius)=>{openWorld.resolveCollisions(position,radius);cityBuilder.resolveCollisions(position,radius);},character.group.position);
  performanceMonitor.record("animais cidade",performance.now()-cityAnimalStart);
  const cityLightStart=performance.now();
  updateChurchDoors(delta,character.group.position);
  updateCityInteriorStreaming(cityBuilder.objects.values(),buildEditor.buildMode?controls.target:character.group.position,buildEditor.buildMode);
  updateCityPropLoading(buildEditor.buildMode?controls.target:character.group.position,buildEditor.buildMode);
  updateCityFirelights(delta,character.group.position);
  performanceMonitor.record("luzes cidade",performance.now()-cityLightStart);
  spellEffects.update(delta);
  updateWorld(delta);
  const playerStart=performance.now();
  updatePlayer(delta);
  performanceMonitor.record("jogador",performance.now()-playerStart);
  if (!buildEditor.buildMode && !mounted) {
    // Follow vertical changes even while idle, jumping, or settling onto land.
    cameraOffset.copy(character.group.position).add(cameraFollowHeight).sub(controls.target);
    controls.target.add(cameraOffset);
    camera.position.add(cameraOffset);
  }
  updateEditorCamera(delta);
  const streamStart=performance.now();
  openWorld.update(buildEditor.buildMode ? controls.target : character.group.position);
  performanceMonitor.record("chunks",performance.now()-streamStart);
  gameAudio.update(delta, currentAnimation);
  if(simulationTick){marineSystem.updateMarineLife(simulationDelta,now/1000);marineSystem.updateSchoolFish(now/1000);}
  // Visual flight must follow render cadence, not the throttled AI cadence.
  updateSkyBirds(delta);
  const animationStart=performance.now();
  character.update(delta);
  companionKiss.update(delta,(x,z)=>playerGroundHeightAt(x,z),(p,r)=>cityBuilder.resolveCollisions(p,r));
  if(restOutfitsRemoved&&(!princessBedRest.active||cityResidents.residents.find(r=>r.citizen.role==='princesa')?.routine!=='sleep'))restoreBedOutfits();
  princessBedRest.update(character.group);
  performanceMonitor.record("animação",performance.now()-animationStart);
  updateIceSpell(delta);
  if (followingWarriorIndex !== null && !(npcDialogue.classList.contains("open")&&activeWarriorIndex===followingWarriorIndex) && !cityResidents.residents.some(r=>r.citizen.existingIndex===followingWarriorIndex&&r.citizen.id===talkingResidentId)) {
    const follower = warriorNpcs[followingWarriorIndex];
    if (mounted && horseRoot) {
      const passengerOffset = new THREE.Vector3(
        -Math.sin(horseRoot.rotation.y) * 0.46,
        0,
        -Math.cos(horseRoot.rotation.y) * 0.46,
      );
      follower.group.position
        .copy(character.group.position)
        .add(passengerOffset);
      follower.group.position.y = character.group.position.y;
      follower.group.rotation.y = horseRoot.rotation.y;
      follower.setAnimation("mountedPassenger");
    } else {
      follower.group.position.y = openWorld.getHeightAt(follower.group.position.x, follower.group.position.z);
      const playerBack = new THREE.Vector3(
        -Math.sin(character.group.rotation.y) * 1.25,
        0,
        -Math.cos(character.group.rotation.y) * 1.25,
      );
      const followTarget = followTargetScratch.copy(character.group.position).add(playerBack);
      followTarget.y = follower.group.position.y;
      const direction = followTarget.sub(follower.group.position);
      direction.y = 0;
      const distance = direction.length();
      if (distance > 1.05) {
        direction.normalize();
        const step = Math.min(distance - 1.05, 2.75 * delta);
        follower.group.position.addScaledVector(direction, step);
        resolveWorldCollisions(follower.group.position, 0.34, follower.group);
        follower.group.rotation.y = Math.atan2(direction.x, direction.z);
        follower.setAnimation(distance > 3.5 ? "run" : "walk");
      } else follower.setAnimation("idle");
    }
  }
  const sameNameEnvironment=cityResidents.updateLabels(camera,character.group.position,viewport);
  if(simulationTick)warriorNpcs.forEach((npc, index) => {
    if(npc.group.userData.cityResidentManaged){npcNameLabels[index].classList.remove("visible");return;}
    const delta=simulationDelta;
    if (!mounted || followingWarriorIndex !== index)
      npc.group.position.y = Math.max(openWorld.getHeightAt(npc.group.position.x, npc.group.position.z),cityFloor.heightAt(npc.group.position.x,npc.group.position.z)??-Infinity);
    npc.update(delta);
    const npcHead = npc.group
        .getWorldPosition(screenPositionScratch)
        .add(new THREE.Vector3(0, 2.78, 0))
        .project(camera),
      npcOnScreen = !npc.group.userData.mapHidden && sameNameEnvironment(npc.group.position) &&
        npc.group.position.distanceToSquared(character.group.position) <= 25 &&
        npcHead.z > -1 &&
        npcHead.z < 1 &&
        Math.abs(npcHead.x) < 1.1 &&
        Math.abs(npcHead.y) < 1.1,
      label = npcNameLabels[index];
    label.classList.toggle("visible", npcOnScreen);
    if (npcOnScreen) {
      label.style.left = `${(npcHead.x * 0.5 + 0.5) * viewport.clientWidth}px`;
      label.style.top = `${(-npcHead.y * 0.5 + 0.5) * viewport.clientHeight}px`;
    }
  });
  if (npcDialogue.classList.contains("open")) {
    const playerScreen = character.group
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 1.35, 0))
        .project(camera),
      panelWidth = npcDialogue.offsetWidth || 300,
      panelHeight = npcDialogue.offsetHeight || 250;
    const left = THREE.MathUtils.clamp(
        (playerScreen.x * 0.5 + 0.5) * viewport.clientWidth + 46,
        12,
        viewport.clientWidth - panelWidth - 12,
      ),
      top = THREE.MathUtils.clamp(
        (-playerScreen.y * 0.5 + 0.5) * viewport.clientHeight,
        panelHeight / 2 + 12,
        viewport.clientHeight - panelHeight / 2 - 12,
      );
    npcDialogue.style.left = `${left}px`;
    npcDialogue.style.top = `${top}px`;
  }
  if (npcSubtitleUntil && now > npcSubtitleUntil) {
    npcSubtitleUntil = 0;
    npcSubtitle.classList.remove("visible");
  }
  if(simulationTick){horseMixers.forEach((mixer)=>mixer.update(simulationDelta));updateRideableHorses(simulationDelta,character.group.position);}
  if(mounted&&horseRoot){
    const state=rideableHorses.get(horseRoot);
    if(state){camera.getWorldDirection(forward);updateHorseLook(state,Math.asin(THREE.MathUtils.clamp(forward.y,-1,1)),delta,horseCameraLookYaw);}
  }
  horseRegistryScanElapsed+=delta;
  if(horseRegistryScanElapsed>1){
    horseRegistryScanElapsed=0;const candidates:THREE.Object3D[]=[];
    scene.traverse(o=>{if(o.userData.animalModel?.includes('/horse/')&&(o!==horseRoot||rideableHorses.has(o)))candidates.push(o);});
    for(const root of candidates){
      registerRideableHorse(root,root.animations);if(root.userData.horseRuntimeApplied)continue;
      const key=root.userData.rideableHorseId??root.userData.buildId,saved=key?runtimeWorld.horses?.[key]:undefined;
      if(saved&&validPosition(saved.position)){scene.attach(root);root.position.fromArray(saved.position);root.rotation.y=saved.rotationY;}
      root.userData.horseRuntimeApplied=true;
    }
  }
  treasureChests.forEach(chest=>{
    if(chest.animating){chest.mixer.update(delta);if(!chest.mixer.existingAction(chest.isOpen?chest.openClip:chest.closeClip)?.isRunning())chest.animating=false;}
    if(chest.coin){chest.coin.rotation.y+=delta*2.4;chest.coin.visible=!chest.isOpen;}
  });
  if(simulationTick)preySystem.updateCatAndRats(simulationDelta);
  horseIdleTime += delta;
  if (horseCurrentMotion === "idle")
    for (const { bone, base, phase, amount } of horseIdleBones) {
      const breathe = Math.sin(horseIdleTime * 1.75 + phase) * amount;
      bone.quaternion
        .copy(base)
        .multiply(frameQuaternionScratch.setFromEuler(frameEulerScratch.set(breathe*.35,breathe,breathe*.2)));
    }
  const worldHour=Math.floor(inventoryState.worldTime*24)%24;
  const wolfHowlHour=[19,21,23,1,3].includes(worldHour);
  const wolfHowlKey=`${inventoryState.worldDay}:${worldHour}`;
  const startScheduledWolfHowl=wolfHowlHour&&wolfHowlKey!==lastScheduledWolfHowl;
  if(startScheduledWolfHowl){lastScheduledWolfHowl=wolfHowlKey;gameAudio.wolfHowl();}
  if(simulationTick)preySystem.preyAnimals.forEach((prey) => {
    const delta=simulationDelta;
    const distanceToCameraSq=prey.position.distanceToSquared(camera.position);
    const activationRange=qualityLevel==="low"?36:qualityLevel==="medium"?58:86;
    if(prey.position.distanceToSquared(character.group.position)>activationRange*activationRange){prey.root.visible=false;prey.hud.classList.remove("visible");return;}
    prey.root.visible=true;
    const frozen = prey.hp > 0 && now < prey.frozenUntil;
    const previousPosition=preyPreviousPositionScratch.copy(prey.position);
    prey.mixer.timeScale = frozen ? 0 : 1;
    if(distanceToCameraSq<55*55||prey.hostileState!=="calm"||prey.hitElapsed!==undefined)prey.mixer.update(delta);
    if (frozen) { preySystem.constrainPreyToHabitat(prey,previousPosition); return; }
    if (prey.hitElapsed !== undefined && prey.hp > 0) {
      prey.hitElapsed += delta;
      const duration = 0.42,
        phase = Math.min(1, prey.hitElapsed / duration),
        impact = Math.sin(phase * Math.PI),
        recoil = impact * (prey.id === "deer" ? 0.28 : 0.17);
      prey.root.position
        .copy(prey.hitStartPosition)
        .addScaledVector(prey.hitDirection, recoil);
      prey.root.position.y += impact * (prey.id === "deer" ? 0.1 : 0.07);
      prey.root.rotation.x =
        prey.hitBaseRotationX - impact * (prey.id === "deer" ? 0.12 : 0.18);
      prey.root.rotation.z =
        prey.hitBaseRotationZ +
        Math.sin(phase * Math.PI * 2) * (prey.id === "deer" ? 0.08 : 0.14);
      if (phase >= 1) {
        prey.root.position.copy(prey.hitStartPosition);
        prey.root.rotation.x = prey.hitBaseRotationX;
        prey.root.rotation.z = prey.hitBaseRotationZ;
        prey.hitElapsed = undefined;
      }
    }
    const wolfBiome=openWorld.getBiomeAt(prey.position.x,prey.position.z),wolfOnMountain=wolfBiome==="Montanha"||(wolfBiome==="Neve"&&openWorld.getHeightAt(prey.position.x,prey.position.z)>35);
    if(prey.id==="wolf"&&prey.hp>0&&prey.hitElapsed===undefined&&prey.hostileState==="calm"&&wolfOnMountain){
      const distanceToPlayer=character.group.position.distanceTo(prey.position);
      if(prey.howlElapsed!==undefined){
        prey.howlElapsed+=delta;
        if(prey.howlElapsed>=3.2){prey.howlElapsed=undefined;playAnimalMotion(prey,"idle");}
        else if(distanceToPlayer>prey.territoryRadius){preySystem.constrainPreyToHabitat(prey,previousPosition);return;}
      }else if(startScheduledWolfHowl&&distanceToPlayer>prey.territoryRadius){
        const clips=prey.root.userData.clips as THREE.AnimationClip[],howl=clips.find(clip=>/selection|howl/i.test(clip.name));
        prey.mixer.stopAllAction();if(howl)prey.mixer.clipAction(howl).reset().setLoop(THREE.LoopOnce,1).play();
        prey.currentMotion="idle";prey.howlElapsed=0;
        preySystem.constrainPreyToHabitat(prey,previousPosition);return;
      }
    }
    if (prey.territoryRadius > 0 && prey.hp > 0 && prey.hitElapsed === undefined) {
      prey.attackCooldown = Math.max(0, prey.attackCooldown - delta);
      const playerDistance = character.group.position.distanceTo(prey.position);
      const homeDistance = prey.position.distanceTo(prey.home);
      if (prey.hostileState === "calm" && playerDistance <= prey.territoryRadius) {
        prey.hostileState = "chase";
        setPlayStatus(`Território de ${animalDisplayName(prey.label)} invadido!`);
      }
      if (prey.hostileState === "chase") {
        if (homeDistance > ANIMAL_TERRITORIES[prey.id].patrol*2 || (playerDistance>prey.territoryRadius*2&&!isAnimalHabitat(openWorld,prey.id,character.group.position.x,character.group.position.z))) prey.hostileState = "return";
        else if (playerDistance <= 1.45 && prey.attackCooldown === 0) {
          prey.hostileState = "attack";
          prey.attackElapsed = 0;
          prey.attackDidDamage = false;
          prey.attackBasePosition.copy(prey.root.position);
          if(prey.id==="bear"||prey.id==="wolf"||prey.id==="puma")gameAudio.animalAttack(prey.id);
          playAnimalAttackMotion(prey);
        } else {
          const chaseDirection = character.group.position.clone().sub(prey.position).setY(0);
          if (chaseDirection.lengthSq() > .001) {
            chaseDirection.normalize();
            const step = Math.min(playerDistance, prey.moveSpeed * delta);
            moveAnimalAvoiding(prey,chaseDirection,step);
            playAnimalMotion(prey, "walk");
          }
        }
      } else if (prey.hostileState === "attack" && prey.attackElapsed !== undefined) {
        prey.attackElapsed += delta;
        const phase = Math.min(1, prey.attackElapsed / .82);
        const lunge = Math.sin(phase * Math.PI);
        const bite=Math.sin(Math.min(1,phase*1.8)*Math.PI);
        const attackDirection = character.group.position.clone().sub(prey.position).setY(0);
        if (attackDirection.lengthSq() > .001) attackDirection.normalize();
        else attackDirection.set(0, 0, 1);
        const contactDistance=preySystem.preyRadius(prey)+.34;
        const availableLunge=Math.max(0,prey.attackBasePosition.distanceTo(character.group.position)-contactDistance);
        prey.root.position.copy(prey.attackBasePosition).addScaledVector(attackDirection,lunge*Math.min(.55,availableLunge));
        prey.root.rotation.x = prey.hitBaseRotationX - lunge * .22;
        prey.root.rotation.y = Math.atan2(attackDirection.x, attackDirection.z)+(prey.id === "bear" ? Math.PI*.5 : 0);
        if(prey.jaw&&prey.jawRest)prey.jaw.quaternion.copy(prey.jawRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,bite*.48)));
        if (!prey.attackDidDamage && phase >= .42) {
          prey.attackDidDamage = true;
          if (character.group.position.distanceTo(prey.position) <= 1.75 && !playerDodgingHit()) {
            const damage=physicalDamage(prey.attackDamage,equipmentSystem.totalStats().defense);
            inventoryState.hp = Math.max(0, inventoryState.hp - damage);
            character.group.position.addScaledVector(attackDirection,1.15);
            resolveWorldCollisions(character.group.position,.32,character.group);
            gameAudio.hit();
            showPlayerDamage();
            refreshHud();
            saveInventory(inventoryState);
            setPlayStatus(`${animalDisplayName(prey.label)} atacou: -${damage} HP`);
          }
        }
        if (phase >= 1) {
          prey.root.position.copy(prey.attackBasePosition);
          prey.root.rotation.x = prey.hitBaseRotationX;
          if(prey.jaw&&prey.jawRest)prey.jaw.quaternion.copy(prey.jawRest);
          prey.attackElapsed = undefined;
          prey.attackCooldown = .65;
          prey.hostileState = homeDistance > ANIMAL_TERRITORIES[prey.id].patrol*2 ? "return" : "chase";
          if(prey.hostileState==="chase")playAnimalMotion(prey,"walk");
        }
      } else if (prey.hostileState === "return") {
        const returnDirection = prey.home.clone().sub(prey.position).setY(0);
        const distance = returnDirection.length();
        if (distance < .18) {
          prey.position.copy(prey.home);
          prey.hostileState = "calm";
          playAnimalMotion(prey, "idle");
        } else {
          returnDirection.normalize();
          const step = Math.min(distance, prey.moveSpeed * .75 * delta);
          moveAnimalAvoiding(prey,returnDirection,step);
          playAnimalMotion(prey, "walk");
        }
      }
    }
    if (prey.deathElapsed !== undefined) {
      prey.deathElapsed += delta;
      if (prey.deathElapsed > 35 && !prey.loot.length) {
        prey.deathElapsed = undefined;
        prey.hp = prey.maxHp;
        prey.root.visible = true;
        prey.mixer.stopAllAction();
        const clips = prey.root.userData.clips as THREE.AnimationClip[],
          idle =
            clips.find((clip) => !clip.name.toLowerCase().includes("die")) ??
            clips[0];
        if (idle) prey.mixer.clipAction(idle).reset().play();
        prey.currentMotion = "idle";
        prey.fleeTime = 0;
        prey.routinePause = 2 + Math.random() * 4;
        preySystem.updatePreyHud(prey);
      }
    }
    if (
      prey.hp > 0 &&
      prey.root.visible &&
      prey.hitElapsed === undefined &&
      prey.fleeTime > 0
    ) {
      prey.fleeTime = Math.max(0, prey.fleeTime - delta);
      const threat = prey.predatorPosition ?? character.group.position;
      const direction = prey.position.clone().sub(threat);
      direction.y = 0;
      if (direction.lengthSq() < 0.0001)
        direction.set(
          Math.sin(prey.root.rotation.y),
          0,
          Math.cos(prey.root.rotation.y),
        );
      else direction.normalize();
      const movement = (prey.id === "deer" ? 5.4 : prey.id === "rabbit" ? 8.5 : prey.id === "raccoon" ? 3.8 : prey.id === "rat" ? 3.15 : 2.15) * delta;
      moveAnimalAvoiding(prey,direction,movement);
      if (prey.currentMotion !== "walk") {
        const clips = prey.root.userData.clips as THREE.AnimationClip[],
          run =
            clips.find((clip) => /run|gallop|hop/i.test(clip.name)) ??
            clips.find((clip) => /walk/i.test(clip.name)) ??
            clips[0];
        prey.mixer.stopAllAction();
        if (run) prey.mixer.clipAction(run).reset().fadeIn(0.12).play();
        prey.currentMotion = "walk";
      }
      if (prey.fleeTime === 0) {
        prey.predatorPosition = undefined;
        prey.routinePause = preySystem.FOREST_ANIMAL_IDS.has(prey.id) ? .65+Math.random()*1.35 : 1.5+Math.random()*2;
      }
    }
    if (
      prey.hp > 0 &&
      prey.root.visible &&
      prey.hitElapsed === undefined &&
      prey.fleeTime === 0 &&
      prey.hostileState === "calm" &&
      prey.routine === "patrol" &&
      prey.waypoints.length
    ) {
      if (prey.routinePause > 0) {
        prey.routinePause -= delta;
        if (prey.currentMotion !== "idle") {
          const clips = prey.root.userData.clips as THREE.AnimationClip[];
          const idle =
            THREE.AnimationClip.findByName(clips, prey.idleClip) ??
            clips.find((clip) => /idle|eat/i.test(clip.name)) ??
            clips[0];
          prey.mixer.stopAllAction();
          if (idle) prey.mixer.clipAction(idle).reset().fadeIn(0.18).play();
          prey.currentMotion = "idle";
        }
      } else {
        const target = prey.waypoints[prey.waypointIndex],
          direction = target.clone().sub(prey.position);
        direction.y = 0;
        const distance = direction.length();
        if (distance < 0.18) {
          if(prey.waypointIndex>=prey.waypoints.length-1){
            const roamSeed=preySystem.preyAnimals.indexOf(prey)*977+Math.floor(now*.001);
            prey.waypoints=animalPatrolPoints(openWorld,prey.id,roamSeed,[prey.position.x,prey.position.z]).map(point=>new THREE.Vector3(...point));
            prey.waypointIndex=0;
          }else prey.waypointIndex++;
          prey.routinePause = preySystem.FOREST_ANIMAL_IDS.has(prey.id) ? .8+Math.random()*2.2 : 2+Math.random()*6;
        } else {
          direction.normalize();
          const movement = Math.min(distance, prey.moveSpeed * delta),
            movementDirection=direction;
          moveAnimalAvoiding(prey,movementDirection,movement);
          if (prey.currentMotion !== "walk") {
            const clips = prey.root.userData.clips as THREE.AnimationClip[];
            const walk =
              clips.find((clip) => /walk|run|hop/i.test(clip.name)) ??
              THREE.AnimationClip.findByName(clips, prey.idleClip) ??
              clips[0];
            prey.mixer.stopAllAction();
            if (walk) prey.mixer.clipAction(walk).reset().fadeIn(0.18).play();
            prey.currentMotion = "walk";
          }
        }
      }
    }
    preySystem.constrainPreyToHabitat(prey,previousPosition);
    if(prey.id==="rabbit"){
      const moving=prey.currentMotion==="walk"&&prey.hp>0&&prey.root.visible;
      const phase=now*.012+preySystem.preyAnimals.indexOf(prey)*1.7;
      prey.root.position.y=prey.position.y+(moving?Math.max(0,Math.sin(phase))*.42:0);
    }
    const head = prey.headAnchor
        .getWorldPosition(screenPositionScratch)
        .project(camera),
      visible =
        now < prey.hudUntil && prey.root.visible && head.z > -1 && head.z < 1;
    prey.hud.classList.toggle("visible", visible);
    if (visible) {
      prey.hud.style.left = `${(head.x * 0.5 + 0.5) * viewport.clientWidth}px`;
      prey.hud.style.top = `${(-head.y * 0.5 + 0.5) * viewport.clientHeight}px`;
    }
  });
  cityShop.update();guildPanel.update();
  citizenConversations.update(!buildEditor.buildMode&&!cityShop.open&&!guildPanel.open&&inventoryState.hp>0&&!mounted&&!broomFlying);
  if(buildEditor.buildMode){cityShop.close();guildPanel.close();}
  if (
    activeLootPrey &&
    character.group.position.distanceTo(activeLootPrey.position) > 3.2
  ) {
    setCorpseLootOpen();
    setPlayStatus("Você se afastou do saque");
  } else if (npcDialogue.classList.contains("open") && !isNpcNearby()) {
    setNpcDialogueOpen(false);
    setPlayStatus("Você se afastou da conversa");
  } else if (!activeLootPrey && !npcDialogue.classList.contains("open")) {
    const chest=nearestTreasureChest(),lootable = nearestLootablePrey();
    const royalChest=nearestRoyalChest(scene,character.group.position);
    const churchPrompt=churchDoorPrompt(character.group.position);
    const merchant=cityResidents.nearestMerchant(character.group.position);
    const guild=cityResidents.guildContact(character.group.position);
    if(cityShop.open||guildPanel.open||citizenConversations.open||chestInventory.open)setInteractionPrompt();
    else if(princessBedRest.active)setInteractionPrompt('Levantar · F tirar/vestir roupas');
    else if(!mounted&&!broomFlying&&princessBedRest.nearest(character.group.position,cityBuilder.objects.values()))setInteractionPrompt('Deitar ao lado de Alice');
    else if(royalChest)setInteractionPrompt(royalChest.userData.open?'Fechar baú':'Abrir baú','E');
    else if(churchPrompt) setInteractionPrompt(churchPrompt);
    else if(citizenConversations.nearest())setInteractionPrompt(`Conversar com ${citizenConversations.nearest()!.citizen.name}`);
    else if(!broomFlying&&horseInteractionDistance()<=2.35)setInteractionPrompt(mounted?"Desmontar do cavalo":"Montar cavalo");
    else if(guild&&!mounted&&!broomFlying)setInteractionPrompt(`Missões da guilda · ${guild.name}`);
    else if(merchant&&!mounted&&!broomFlying)setInteractionPrompt(merchant.kind==='stable'?`Comprar cavalo · ${merchant.name}`:(merchant.kind==='inn'||merchant.kind==='lodging')?`Conversar com ${merchant.name}`:`Comprar / vender · ${merchant.name}`);
    else if(chest) setInteractionPrompt(`${chest.isOpen?"Fechar":"Abrir"} baú ${chestLabel[chest.kind]}`);
    else if (lootable) setInteractionPrompt(`Investigar ${animalDisplayName(lootable.label)}`);
    else if (broomFlying) setInteractionPrompt("Desmontar da Vassoura Voadora", "F");
    else if (mounted) setInteractionPrompt("Desmontar do cavalo");
    else if(nearestRideableHorse(character.group.position).distance<=2.35)setInteractionPrompt("Cavalo à venda · fale com o cavalariço", "");
    else if (equipmentSystem.hasEquippedNimbus()&&horseInteractionDistance()>2.35) setInteractionPrompt("Montar Vassoura Voadora", "F");
    else {
      const nearest = nearestWarrior(),
        horseDistance = horseInteractionDistance();
      if (horseDistance <= 2.35 && horseDistance <= nearest.distance)
        setInteractionPrompt("Montar cavalo");
      else if (
        nearest.distance <= 2.7 &&
        !npcSubtitle.classList.contains("visible")
      )
        setInteractionPrompt(`Falar com ${warriorNames[nearest.index]}`);
      else if (horseDistance <= 2.35) setInteractionPrompt("Montar cavalo");
      else setInteractionPrompt();
    }
  } else setInteractionPrompt();
  // Canvas maps do not need the display's refresh rate. Updating at 10 Hz is
  // visually smooth for map markers and removes repeated 2D drawing work.
  const mapStep=1/(buildEditor.buildMode&&buildEditor.transformControls.dragging?20:quality.simulationHz);
  if (now-lastMapDrawAt >= mapStep*1000) {
    lastMapDrawAt=now;
    drawMap(miniCanvas);
    if (mapPanel.classList.contains("open")) drawMap(worldMapCanvas);
    if(document.querySelector('[data-inventory-panel="map"]')?.classList.contains("active"))drawMap(inventoryMapCanvas);
  }
  previous = now;
  controls.update();
  const underwater=isSubmergedAt(camera.position);
  underwaterFilter?.classList.toggle("active",underwater);
  const renderStart=performance.now();
  cityStructureInstances.render(renderer,camera,cityBuilder.objects.values(),!buildEditor.buildMode,now);
  performanceMonitor.record("render",performance.now()-renderStart);
  performanceMonitor.update((now - framePrevious) / 1000);
  if (inventoryModal.classList.contains("open") && now-lastAvatarRenderAt>=1000/30) {
    lastAvatarRenderAt=now;
    const portrait =
        avatarTarget === "female" ? femaleNpc.group : character.group,
      target = portrait
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, 1.25, 0));
    const facingOffset = new THREE.Vector3(0, 0.02, 7.0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), avatarYaw)
      .applyQuaternion(portrait.getWorldQuaternion(new THREE.Quaternion()));
    avatarCamera.position.copy(target).add(facingOffset);
    avatarCamera.lookAt(target);
    const background = scene.background;
    scene.background = null;
    avatarRenderer.render(scene, avatarCamera);
    scene.background = background;
  }
});

// Release GPU contexts before a reload replaces this large scene.
let graphicsReleased=false;
const releaseGraphics=()=>{
  if(graphicsReleased)return;graphicsReleased=true;
  cityStructureInstances.dispose();
  for(const context of [renderer,previewRenderer,avatarRenderer]){
    context.setAnimationLoop(null);context.dispose();context.forceContextLoss();
  }
};
window.addEventListener('pagehide',releaseGraphics,{once:true});

connectDatabaseSaveButton(() => { worldEditorStore.save(); runtimeWorldStore.save(); saveInventory(inventoryState); });
