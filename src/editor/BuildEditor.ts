import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { ProceduralCharacter } from "../character";
import { registerRideableHorse,rideableHorses } from '../player/RideableHorses';
import type { MedievalCityFloor } from "../world/MedievalCityFloor";
import { ARENA_REGIONS,OpenWorld,type ForestBrushKind,type TerrainBrush,type TerrainBrushMode } from "../world/OpenWorld";
import type { initializePreyAnimals } from "../world/PreyAnimals";
import { PERIMETER_CATALOG } from './CityPerimeter';
import type { CityResidents } from "./CityResidents";
import { selectCityObject } from './CitySelection';
import { LowPolyCityBuilder,createCityAsset } from "./LowPolyCityBuilder";
import { OrientedSelectionBox } from './OrientedSelectionBox';
import type { CityAssetKind,SavedCityObject } from "./WorldEditorSupport";
import { WorldEditorStore,type SavedBuildAsset } from "./WorldEditorSupport";
import { restoreCityPropBatches,reapplyCityPropBatches } from './CityPropBatching';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCityWoodFloor } from './CityWoodFloor';
import { cityPavingMaterial } from '../world/CityPaving';

type BuildFolderState={folders:string[];assets:Record<string,string>};

export interface BuildEditorContext {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  cityBuilder: LowPolyCityBuilder;
  character: ProceduralCharacter;
  cityFloor: MedievalCityFloor;
  cityResidents: CityResidents;
  updateCityFloor: () => void;
  buildState: WorldEditorStore["state"];
  openWorld: OpenWorld;
  worldEditorStore: WorldEditorStore;
  saveBuildState: () => void;
  grid: THREE.GridHelper;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial, THREE.Object3DEventMap>;
  protectedBuildAssets: Set<string>;
  setPlayStatus: (text: string) => void;
  controls: OrbitControls;
  preySystem: Pick<ReturnType<typeof initializePreyAnimals>, "preyAnimals" | "placePreyInArena">;
  setInventoryOpen: (open: boolean) => void;
  pressed: Set<string>;
  playerGroundHeightAt: (x: number, z: number, allowStepUp?: boolean) => number;
  PLAYER_GROUND_OFFSET: number;
  snapCameraToPlayer: () => void;
  saveRuntimeWorld: () => void;
}

// Initialize only at the original bootstrap point. Live accessors preserve later state changes.
export function initializeBuildEditor(context: BuildEditorContext) {
  const { camera, renderer, scene, cityBuilder, cityFloor, updateCityFloor, buildState, openWorld, worldEditorStore, saveBuildState, grid, floor, protectedBuildAssets, setPlayStatus, controls, PLAYER_GROUND_OFFSET } = context;
  // This dependency is declared later during main bootstrap. Keep its context
  // getter lazy instead of evaluating it while the Build editor is created.
  const playerGroundHeightAt = (x: number, z: number, allowStepUp?: boolean) =>
    context.playerGroundHeightAt(x, z, allowStepUp);
  const buildPanel = document.querySelector<HTMLElement>("#buildMode")!;
  const buildBadge = document.querySelector<HTMLElement>("#buildBadge")!;
  const buildAssetsHost = document.querySelector<HTMLElement>("#buildAssets")!;
  const buildSelectedName = document.querySelector<HTMLElement>("#buildSelectedName")!;
  const buildSearch = document.querySelector<HTMLInputElement>("#buildSearch")!;
  const buildWidth = document.querySelector<HTMLInputElement>("#buildMapWidth")!;
  const buildDepth = document.querySelector<HTMLInputElement>("#buildMapDepth")!;
  const buildMapOutput = document.querySelector<HTMLOutputElement>("#buildMapSizeOutput")!;
  const transformControls = new TransformControls(camera, renderer.domElement);
  const transformHelper = transformControls.getHelper();
  transformHelper.name = "WorldBuilderGizmo";
  scene.add(transformHelper);
  let buildMode = false;
  let editorFreeCamera = true;
  let selectedBuildAsset: THREE.Object3D | null = null;
  let floorDragPaint:{source:THREE.Object3D;start:THREE.Vector3;step:number;copies:THREE.Object3D[]}|null=null;
  let selectedBuildUniformScale = 1;
  let selectedBuildGroundY = 0;
  let buildAssetRefreshTimer = 0;
  let lastBuildCandidateCount = -1;
  let buildSpace: "world" | "local" = "local";
  transformControls.setSpace(buildSpace);
  const buildInitialTransforms = new WeakMap<THREE.Object3D, SavedBuildAsset>();
  const buildAssetRegistry = new Map<string, THREE.Object3D>();
  const openBuildFolders = new Set<string>();
  const ANIMAL_ASSET_CATALOG=[
    ["Cavalo","/models/animals/horse/model.glb",2.68],["Galinha","/models/animals/chicken/model.glb",.416],
    ["Gato","/models/animals/cat/model.glb",.72],["Rato","/models/animals/rat/model.glb",.125],
    ["Cervo","/models/animals/deer/model.glb",1.42],["Coelho","/models/animals/rabbit/model.glb",.52],
    ["Guaxinim","/models/animals/raccoon/model.glb",.58],["Urso","/models/animals/bear/model.glb",1.85],
    ["Lobo","/models/animals/dire-wolf/model.glb",1.42],["Leão-da-montanha","/models/animals/mountain-lion/model.glb",1.42],
    ["Tubarão","/models/animals/shark/model.glb",3],["Truta","/models/animals/trout/model.glb",.34],
    ["Gaivota","/models/animals/seagull/model.glb",.46],["Pássaros","/models/animals/sky-birds/model.glb",1]
  ] as const;
  const animalAssetTemplates=new Map<string,THREE.Group>();
  const BUILD_FOLDERS_KEY="rpg3d.buildFolders.v1";

  const buildFolderState:BuildFolderState=(()=>{try{return{folders:[],assets:{},...JSON.parse(localStorage.getItem(BUILD_FOLDERS_KEY)||"{}")};}catch{return{folders:[],assets:{}};}})();
  const saveBuildFolders=()=>localStorage.setItem(BUILD_FOLDERS_KEY,JSON.stringify(buildFolderState));
  let renderBuildThumbnail:(object:THREE.Object3D)=>string=()=>"";
  const buildThumbnailCache=new WeakMap<THREE.Object3D,{signature:string;image:string}>();
  const buildBiomePreviewSources=new Map<string,THREE.Object3D>();
  const floorPreviewSources=new Map<string,THREE.Object3D>();
  const floorPreviewLoads=new Set<string>();
  let proceduralDockTemplate:THREE.Group|null=null;
  let fitProceduralDockSupports:(dock:THREE.Object3D)=>void=()=>{};
  const buildTransformInputs = [...document.querySelectorAll<HTMLInputElement>("[data-build-transform]")];
  const buildInspector = document.querySelector<HTMLElement>(".build-inspector")!;
  const inspectedBuildObject = () => selectedBuildAsset ?? (selectedCityIds.size === 1 ? cityBuilder.objects.get([...selectedCityIds][0]) ?? null : null);
  const terrainToggle = document.querySelector<HTMLButtonElement>("[data-terrain-toggle]")!;
  const terrainRadius = document.querySelector<HTMLInputElement>("[data-terrain-radius]")!;
  const terrainStrength = document.querySelector<HTMLInputElement>("[data-terrain-strength]")!;
  const terrainMaterial = document.querySelector<HTMLSelectElement>("[data-terrain-material]")!;
  const terrainShape = document.querySelector<HTMLSelectElement>("[data-terrain-shape]")!;
  const forestBrushKind = document.querySelector<HTMLSelectElement>("[data-forest-brush-kind]")!;
  const forestBrushDensity = document.querySelector<HTMLInputElement>("[data-forest-brush-density]")!;
  let lastForestBrushPoint:THREE.Vector3|undefined;
  forestBrushDensity.addEventListener("input",()=>{forestBrushDensity.parentElement!.querySelector("output")!.textContent=`${forestBrushDensity.value}×`;});
  let terrainMode: TerrainBrushMode = "paint", terrainBrushEnabled = false, terrainPainting = false, terrainStrokeBefore = "", terrainFlattenHeight = 0;
  let terrainRampStart: THREE.Vector3 | undefined;
  let lastTerrainBrushAt=0, pendingTerrainBrush:{point:THREE.Vector3;shift:boolean}|undefined;
  const terrainPreviewMaterial = new THREE.LineBasicMaterial({ color: "#8affae", transparent: true, opacity: .9, depthTest: false });
  const circlePoints = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * Math.PI * 2), 0, Math.sin(i / 48 * Math.PI * 2)));
  const squarePoints = [new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,0,-1),new THREE.Vector3(1,0,1),new THREE.Vector3(-1,0,1),new THREE.Vector3(-1,0,-1)];
  const terrainCirclePreview = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints), terrainPreviewMaterial);
  const terrainSquarePreview = new THREE.Line(new THREE.BufferGeometry().setFromPoints(squarePoints), terrainPreviewMaterial);
  const terrainPreview = new THREE.Group(); terrainPreview.name = "Prévia do pincel de terreno"; terrainPreview.userData.buildEditable = false; terrainPreview.visible = false; terrainPreview.renderOrder = 20; terrainPreview.add(terrainCirclePreview, terrainSquarePreview); scene.add(terrainPreview);
  const rebuildTerrainPaintMarks = () => {};
  const cityLayerInput = document.querySelector<HTMLInputElement>("[data-city-layer]")!, cityWidthInput = document.querySelector<HTMLInputElement>("[data-city-width]")!, cityGridInput = document.querySelector<HTMLInputElement>("[data-city-grid]")!;
  const citySelectionOutput = document.querySelector<HTMLOutputElement>("[data-city-selection]")!, cityCategoryInput = document.querySelector<HTMLSelectElement>("[data-city-category]")!;
  let cityPlacementKind: CityAssetKind | null = null, cityPreview: THREE.Group | null = null, cityPathPoints: THREE.Vector3[] = [];
  const cityPathPreview = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#66ef9b", transparent: true, opacity: .65, depthTest: false })); cityPathPreview.visible = false; cityPathPreview.userData.buildEditable = false; scene.add(cityPathPreview);
  const selectedCityIds = new Set<string>(), cityGroupProxy = new THREE.Object3D(); cityGroupProxy.name = "Seleção de cidade"; cityGroupProxy.userData.buildEditable = false; scene.add(cityGroupProxy);
  const citySelectionHelpers = new THREE.Group(); citySelectionHelpers.name = "Destaques da seleção"; citySelectionHelpers.userData.buildEditable = false; scene.add(citySelectionHelpers);
  let cityGroupStart = new THREE.Vector3(), cityGroupRotationStart = new THREE.Quaternion(), cityGroupScaleStart = new THREE.Vector3(1,1,1);
  let cityGroupObjectStarts = new Map<string, {position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>();
  const cityAttachedStarts=new Map<THREE.Object3D,THREE.Matrix4>();
  const cityAttachedStartMatrix=new THREE.Matrix4(),cityAttachedPreviousDelta=new THREE.Matrix4();
  const capitalCityAttachedObjects=()=>[...scene.children].filter(object=>{
    const horse=rideableHorses.get(object),linkedHorse=!!horse?.root.userData.stableId;
    return linkedHorse||((!!object.userData.buildId||!!object.userData.cityResidentManaged||object===context.character.group)&&cityFloor.heightAt(object.position.x,object.position.z)!==null);
  });
  const startAttachedCityTransform=()=>{
    cityAttachedStarts.clear();cityAttachedPreviousDelta.identity();
    if(!isCapitalCitySelection())return;
    cityGroupProxy.updateMatrix();cityAttachedStartMatrix.copy(cityGroupProxy.matrix);
    for(const object of capitalCityAttachedObjects()){
      if(object.userData.cityResidentManaged)continue; // transformed by CityResidents.transformWithCity
      object.updateMatrix();cityAttachedStarts.set(object,object.matrix.clone());
    }
  };
  const applyAttachedCityTransform=()=>{
    if(!isCapitalCitySelection())return;
    cityGroupProxy.updateMatrix();
    const delta=cityGroupProxy.matrix.clone().multiply(cityAttachedStartMatrix.clone().invert());
    const step=delta.clone().multiply(cityAttachedPreviousDelta.clone().invert());
    context.cityResidents.transformWithCity(step);cityAttachedPreviousDelta.copy(delta);
    for(const [object,start]of cityAttachedStarts){
      delta.clone().multiply(start).decompose(object.position,object.quaternion,object.scale);
    }
    updateCityFloor();
  };
  const capitalCityIds=()=>Object.keys(buildState.city);
  const isCapitalCitySelection=()=>{const ids=capitalCityIds();return ids.length>0&&ids.length===selectedCityIds.size&&ids.every(id=>selectedCityIds.has(id));};
  const selectCapitalCity=()=>{selectedBuildAsset=null;selectedCityIds.clear();capitalCityIds().forEach(id=>selectedCityIds.add(id));updateCitySelection();};
  document.querySelector<HTMLButtonElement>("[data-folder-create]")!.addEventListener("click",()=>{
    const name=prompt("Nome da nova pasta:")?.trim();if(!name||buildFolderState.folders.includes(name))return;
    buildFolderState.folders.push(name);openBuildFolders.add(name);saveBuildFolders();refreshBuildAssetList();
  });
  const updateCitySelection = () => {
    citySelectionOutput.value = isCapitalCitySelection()?"Cidade Principal · grupo":`${selectedCityIds.size} selecionado${selectedCityIds.size === 1 ? "" : "s"}`;
    for (const helper of citySelectionHelpers.children) { if (helper instanceof THREE.LineSegments) { helper.geometry.dispose(); const materials = Array.isArray(helper.material) ? helper.material : [helper.material]; materials.forEach((material) => material.dispose()); } } citySelectionHelpers.clear(); for (const id of selectedCityIds) { const object = cityBuilder.objects.get(id); if (object) citySelectionHelpers.add(new OrientedSelectionBox(object)); }
    if(isCapitalCitySelection())for(const object of [cityFloor.root,...capitalCityAttachedObjects()])citySelectionHelpers.add(new THREE.BoxHelper(object,0xe9bc69));
    if (selectedCityIds.size === 1) transformControls.attach(cityBuilder.objects.get([...selectedCityIds][0])!);
    else if (selectedCityIds.size > 1) { const center = new THREE.Vector3(); for (const id of selectedCityIds) center.add(cityBuilder.objects.get(id)!.position); center.multiplyScalar(1 / selectedCityIds.size); cityGroupProxy.position.copy(center); cityGroupProxy.rotation.set(0,0,0); cityGroupProxy.scale.set(1,1,1); transformControls.attach(cityGroupProxy); }
    else if (!selectedBuildAsset) transformControls.detach(); refreshBuildInspector();
  };
  const ghostCityObject = (object: THREE.Object3D, invalid = false) => object.traverse((child) => { if (!(child instanceof THREE.Mesh)) return; if (!child.userData.cityGhostMaterial) { const source = Array.isArray(child.material) ? child.material : [child.material]; const cloned = source.map((m) => { const copy = m.clone(); copy.transparent = true; copy.opacity = .42; copy.depthWrite = false; return copy; }); child.material = Array.isArray(child.material) ? cloned : cloned[0]; child.userData.cityGhostMaterial = true; } const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.color.set(invalid ? "#e85b55" : "#63e69a")); });
  const clearCityPlacement = () => { cityPlacementKind = null; cityPathPoints = []; cityPreview?.removeFromParent(); cityPreview = null; cityPathPreview.visible = false; cityPathPreview.geometry.dispose(); cityPathPreview.geometry = new THREE.BufferGeometry(); document.querySelectorAll("[data-city-kind]").forEach((b) => b.classList.remove("active")); };
  const startCityPlacement = (kind: CityAssetKind) => { clearCityPlacement(); terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainToggle.textContent = "Ativar pincel"; cityPlacementKind = kind; if (!["wall", "road", "path"].includes(kind)) { cityPreview = createCityAsset(kind); ghostCityObject(cityPreview); cityPreview.userData.buildEditable = false; scene.add(cityPreview); } };
  const snapCityPoint = (point: THREE.Vector3) => { const gridSize = Math.max(0, Number(cityGridInput.value)); if (gridSize) { point.x = Math.round(point.x / gridSize) * gridSize; point.z = Math.round(point.z / gridSize) * gridSize; } point.y = openWorld.getHeightAt(point.x, point.z); return point; };
  const savedCityObject = (kind: CityAssetKind, position: THREE.Vector3, points?: THREE.Vector3[]): SavedCityObject => ({ id: crypto.randomUUID(), kind, layer: cityLayerInput.value.trim() || "Cidade", position: position.toArray(), rotation: [0, 0, 0], scale: [1, 1, 1], points: points?.map((p) => p.toArray()), width: Number(cityWidthInput.value) });
  const currentTerrainBrush = (shift = false): TerrainBrush => ({
    mode: shift && terrainMode === "raise" ? "lower" : shift && terrainMode === "lower" ? "raise" : terrainMode,
    radius: Number(terrainRadius.value), strength: Number(terrainStrength.value), shape: terrainShape.value as "circle" | "square", material: terrainMaterial.value as TerrainBrush["material"],
  });
  const terrainHit = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(openWorld.getTerrainMeshes(), false)[0];
  };
  const floorSpawnPoint=()=>{
    const direction=camera.getWorldDirection(new THREE.Vector3());direction.y=0;
    if(direction.lengthSq()<.0001)direction.set(0,0,-1);direction.normalize();
    const point=camera.position.clone().addScaledVector(direction,12);
    point.y=openWorld.getHeightAt(point.x,point.z)+.03;return point;
  };
  const updateTerrainPreview = (event: PointerEvent) => {
    if (!buildMode || !terrainBrushEnabled) { terrainPreview.visible = false; return undefined; }
    const hit = terrainHit(event); terrainPreview.visible = Boolean(hit); if (!hit) return undefined;
    terrainPreview.position.copy(hit.point); terrainPreview.position.y += .12; terrainPreview.scale.setScalar(Number(terrainRadius.value));
    terrainCirclePreview.visible = terrainShape.value === "circle"; terrainSquarePreview.visible = !terrainCirclePreview.visible; return hit;
  };
  const applyTerrainAt = (point: THREE.Vector3, shift = false) => {
    if(terrainMode==="forestErase"){
      const radius=Number(terrainRadius.value),kind=forestBrushKind.value as ForestBrushKind;
      if(lastForestBrushPoint&&lastForestBrushPoint.distanceTo(point)<Math.max(1,radius*.3))return;
      lastForestBrushPoint=point.clone();
      const modelIds=new Set(openWorld.getBiomeModels().filter(model=>openWorld.isForestModel(model.id,kind)).map(model=>model.id));
      const removed=new Set<string>();
      for(const [id,saved] of Object.entries(buildState.assets))if(saved.forestModel&&modelIds.has(saved.forestModel)&&Math.hypot(saved.position[0]-point.x,saved.position[2]-point.z)<=radius){delete buildState.assets[id];removed.add(id);}
      for(const object of [...scene.children])if(removed.has(object.userData.buildId))object.removeFromParent();
      // Persist the erase operation in the Build save. Rebuilding terrain or
      // switching between gameplay/Build must not regenerate the trees.
      const erase = { x: point.x, z: point.z, radius, kind } as const;
      buildState.forestErasures ??= [];
      buildState.forestErasures.push(erase);
      openWorld.eraseForestBrush(point,radius,kind);return;
    }
    if(terrainMode==="forest"){
      if(lastForestBrushPoint&&lastForestBrushPoint.distanceTo(point)<Math.max(1,Number(terrainRadius.value)*.18))return;
      lastForestBrushPoint=point.clone();
      const objects=openWorld.paintForestBrush(point,Number(terrainRadius.value),Number(forestBrushDensity.value),forestBrushKind.value as ForestBrushKind);
      for(const object of objects){scene.add(object);buildState.assets[object.userData.buildId]=snapshotBuildAsset(object);}
      return;
    }
    if (terrainMode === "paint") {
      openWorld.applyTerrainBrush(point, currentTerrainBrush(shift), terrainFlattenHeight, terrainRampStart);
      saveBuildState();
      return;
    }
    openWorld.applyTerrainBrush(point, currentTerrainBrush(shift), terrainFlattenHeight, terrainRampStart);
  };
  const queueTerrainBrush=(point:THREE.Vector3,shift=false,force=false)=>{
    pendingTerrainBrush={point:point.clone(),shift};
    const now=performance.now();if(!force&&now-lastTerrainBrushAt<60)return;
    const pending=pendingTerrainBrush;pendingTerrainBrush=undefined;lastTerrainBrushAt=now;applyTerrainAt(pending.point,pending.shift);
  };
  terrainToggle.addEventListener("click", () => { terrainBrushEnabled = !terrainBrushEnabled; terrainToggle.classList.toggle("active", terrainBrushEnabled); terrainToggle.textContent = terrainBrushEnabled ? "Pincel ativo" : "Ativar pincel"; if (terrainBrushEnabled) selectBuildAsset(null); else terrainPreview.visible = false; });
  document.querySelectorAll<HTMLButtonElement>("[data-terrain-mode]").forEach((button) => button.addEventListener("click", () => {
    terrainMode = button.dataset.terrainMode as TerrainBrushMode;lastForestBrushPoint=undefined;
    document.querySelectorAll("[data-terrain-mode]").forEach((item) => item.classList.toggle("active", item === button));
    const foliageMode=terrainMode==="forest"||terrainMode==="forestErase";
    document.querySelector<HTMLElement>("[data-forest-brush-options]")!.hidden=!foliageMode;
    forestBrushDensity.parentElement!.hidden=terrainMode==="forestErase";
    document.querySelector<HTMLElement>("[data-forest-brush-options] small")!.textContent=terrainMode==="forestErase"?"Arraste para apagar assets de Floresta dentro do raio. Não afeta Neve, terreno, castelo ou animais. Desfazer restaura a pincelada.":"Arraste para preencher somente a grama. Use Desfazer para remover a pincelada.";
    terrainPreviewMaterial.color.set(terrainMode==="forestErase"?"#ff8b77":"#8affae");
    terrainMaterial.parentElement!.hidden=foliageMode;
    terrainStrength.parentElement!.hidden=foliageMode;
    terrainShape.parentElement!.hidden=foliageMode;
    if(foliageMode){
      clearCityPlacement();terrainBrushEnabled=true;terrainToggle.classList.add("active");terrainToggle.textContent="Pincel ativo";selectBuildAsset(null);
    }
  }));
  for (const input of [terrainRadius, terrainStrength]) input.addEventListener("input", () => { input.parentElement!.querySelector("output")!.textContent = input.value; });
  document.querySelectorAll<HTMLButtonElement>("[data-city-kind]").forEach((button) => button.addEventListener("click", () => { startCityPlacement(button.dataset.cityKind as CityAssetKind); button.classList.add("active"); }));
  document.querySelector<HTMLButtonElement>("[data-city-cancel]")!.addEventListener("click", clearCityPlacement);
  cityCategoryInput.addEventListener("change", () => document.querySelectorAll<HTMLElement>("[data-city-category-item]").forEach((item) => { item.hidden = cityCategoryInput.value !== "all" && item.dataset.cityCategoryItem !== cityCategoryInput.value; }));
  const citySearchInput = document.querySelector<HTMLInputElement>("[data-city-search]")!;
  const filterCityCatalog = () => { const query = citySearchInput.value.trim().toLowerCase(), category = cityCategoryInput.value; document.querySelectorAll<HTMLElement>("[data-city-category-item]").forEach((item) => { item.hidden = Boolean((category !== "all" && item.dataset.cityCategoryItem !== category) || (query && !item.dataset.cityLabel?.includes(query))); }); };
  cityCategoryInput.addEventListener("change", filterCityCatalog); citySearchInput.addEventListener("input", filterCityCatalog);
  document.querySelectorAll<HTMLButtonElement>("[data-build-tab]").forEach((button) => button.addEventListener("click", () => {
    const tab = button.dataset.buildTab!; document.querySelectorAll("[data-build-tab]").forEach((item) => item.classList.toggle("active", item === button)); document.querySelectorAll<HTMLElement>("[data-build-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.buildPanel === tab));
    if (tab !== "terrain") { terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainToggle.textContent = "Ativar pincel"; terrainPreview.visible = false; }
    if (tab !== "construction") clearCityPlacement();
  }));
  cityWidthInput.addEventListener("input", () => { cityWidthInput.parentElement!.querySelector("output")!.textContent = cityWidthInput.value; });
  document.querySelector<HTMLButtonElement>("[data-city-clear]")!.addEventListener("click", () => { selectedCityIds.clear(); updateCitySelection(); });
  document.querySelector<HTMLButtonElement>("[data-city-align]")!.addEventListener("click", () => {
    if (!selectedCityIds.size) return; worldEditorStore.checkpoint(); for (const id of selectedCityIds) { const object = cityBuilder.objects.get(id)!; cityBuilder.alignToTerrain(object); buildState.city[id].position = object.position.toArray(); } saveBuildState();
  });
  document.querySelector<HTMLButtonElement>("[data-city-duplicate]")!.addEventListener("click", () => {
    if (!selectedCityIds.size) return; worldEditorStore.checkpoint(); const next = new Set<string>();
    for (const id of selectedCityIds) { const source = buildState.city[id], copy = structuredClone(source); copy.id = crypto.randomUUID(); copy.position[0] += Math.max(1, Number(cityGridInput.value)); copy.position[2] += Math.max(1, Number(cityGridInput.value)); buildState.city[copy.id] = copy; cityBuilder.add(copy); next.add(copy.id); }
    selectedCityIds.clear(); next.forEach((id) => selectedCityIds.add(id)); saveBuildState(); updateCitySelection();
  });

  const CASTLE_LOCKED_SCALE = 1.41;
  // Saved transforms belong to the world owner; no asset has a code-forced scale.
  const hasLockedBuildScale = (_object: THREE.Object3D | null | undefined) => false;
  const enforceLockedBuildScale = (_object: THREE.Object3D | null | undefined) => {};
  const assetLabel = (object: THREE.Object3D, index: number) => object.name || `${object.type} ${index + 1}`;
  const buildFolderFor = (object: THREE.Object3D, label: string) => {
    if (typeof object.userData.buildFolder === "string") return object.userData.buildFolder;
    if (typeof object.userData.biome === "string") return object.userData.biome;
    const value = `${object.name} ${label}`.toLowerCase();
    if (/lobbycharacter|npc_|warrior|eleonor|alice|emma|personagem/.test(value)) return "Personagens";
    if (/horse|cavalo|galinha|rato|urso|guaxinim|coelho|cervo|coiote|leão|deer|rabbit|bear|cat|wolf|raccoon|chicken|animal/.test(value)) return "Animais";
    if (/nuvem|céu|passar|bird|gaivota/.test(value)) return "Céu";
    if (/mar|água|tubarão|truta|shark|trout|water|sea/.test(value)) return "Água";
    return "Cenário";
  };
  const isStreetLantern=(object:THREE.Object3D)=>object.name==='Lanterna marrom da rua'||String(object.userData.buildId??'').startsWith('street-lantern-');
  const buildCandidates = () => {
    // Every post is independent, including avenue-mounted and older catalog
    // instances that inherited metadata from their visual parent.
    scene.traverse(object=>{if(!isStreetLantern(object))return;object.userData.buildEditable=true;delete object.userData.cityId;delete object.userData.ownerCityId;delete object.userData.cityObject;});
    const streetLanterns:THREE.Object3D[]=[];
    cityBuilder.root.traverse(object=>{if(object.name==='Lanterna marrom da rua')streetLanterns.push(object);});
    const cityProps:THREE.Object3D[]=[];
    cityBuilder.root.traverse(object=>{if(object.userData.buildEditable&&object.userData.cityObject)cityProps.push(object);});
    const forestAssets = openWorld.getEditableForestAssets();
    // Forest roots can lose the flag when a chunk is rebuilt. Reassert it at
    // the editor boundary so every live tree remains selectable in Build.
    forestAssets.forEach(object => { object.userData.buildEditable = true; });
    return [...scene.children, ...cityBuilder.root.children.filter(object=>object.userData.generatedWell), ...streetLanterns, ...cityProps, ...forestAssets].filter((object, index, all) => all.indexOf(object) === index).filter((object) => {
    if (object.userData.biomeAssetKind && (buildState.removedAssets.includes(object.name) || (object.userData.buildId && buildState.removedAssets.includes(String(object.userData.buildId))))) return false;
    if ((object.userData.buildEditable === false && !object.userData.animalModel) || object === transformHelper || object === grid || object === floor || object instanceof THREE.Light || object instanceof THREE.Camera) return false;
    let hasRenderable = false;
    object.traverse((child) => { if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) hasRenderable = true; });
      return hasRenderable;
    });
  };
  const buildIdFor = (object: THREE.Object3D, index: number) => {
    if (!object.userData.buildId) {
      const slug = assetLabel(object, index).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      // Named game assets use a stable key. The previous index-based key could
      // change with asynchronous GLB loading and make edited scales appear to
      // reset on the next reload.
      const stableId = object.name ? slug : `${slug}-${index}`;
      if (object.name && !buildState.assets[stableId]) {
        const legacyId = Object.keys(buildState.assets).find((id) => id.startsWith(`${slug}-`));
        if (legacyId) buildState.assets[stableId] = buildState.assets[legacyId];
      }
      object.userData.buildId = stableId;
    }
    return object.userData.buildId as string;
  };
  // Posts share a display name, but never a removal identity.
  const buildRemovalKey = (object: THREE.Object3D, index: number) => isStreetLantern(object) ? buildIdFor(object,index) : object.name || buildIdFor(object, index);
  const removeBuildAssetFromScene = (object: THREE.Object3D) => {
    if (protectedBuildAssets.has(object.name)) {
      setPlayStatus(object.name === "Horse" ? "A montaria não pode ser removida" : "O jogador não pode ser removido");
      return;
    }
    const assets = buildCandidates(), index = assets.indexOf(object);
    if (index < 0) return;
    worldEditorStore.checkpoint();
    const key = buildRemovalKey(object, index);
    if (!buildState.removedAssets.includes(key)) buildState.removedAssets.push(key);
    const buildId = object.userData.buildId as string | undefined;
    if (buildId && !buildState.removedAssets.includes(buildId)) buildState.removedAssets.push(buildId);
    if (object.userData.biomeAssetKind === "tree") {
      object.updateWorldMatrix(true, true);
      const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
      const radius = Math.max(2, Math.max(size.x, size.z) * .55);
      const erase = { x: object.position.x, z: object.position.z, radius, kind: "trees" as const };
      buildState.forestErasures ??= [];
      const exists = buildState.forestErasures.some(area => area.kind === "trees" && Math.hypot(area.x - erase.x, area.z - erase.z) < Math.max(area.radius, erase.radius) * .35);
      if (!exists) {
        buildState.forestErasures.push(erase);
        // A right-click removes this exact instance. Do not rebuild the chunk:
        // rebuilding would recreate/reorder every procedural tree nearby.
        openWorld.recordForestErasure(new THREE.Vector3(erase.x, object.position.y, erase.z), radius, "trees");
      }
    }
    if (selectedBuildAsset === object) { selectedBuildAsset = null; transformControls.detach(); refreshBuildInspector(); }
    object.removeFromParent();
    saveBuildState();
    refreshBuildAssetList();
  };
  const snapshotBuildAsset = (object: THREE.Object3D): SavedBuildAsset => ({
    position: object.position.toArray(), rotation: [object.rotation.x, object.rotation.y, object.rotation.z], scale: object.scale.toArray(), visible: true,
    ...(object.userData.forestModel ? { forestModel: object.userData.forestModel, label: object.name } : {}),
    ...(object.userData.harborModel ? { harborModel: object.userData.harborModel, label: object.name } : {}),
    ...(isStreetLantern(object) ? { streetLantern: true, label: object.name } : {}),
  });
  const applySavedBuildAsset = (object: THREE.Object3D, saved: SavedBuildAsset) => {
    if (object.name === "LobbyCharacter") {
      // Player position and facing belong to the live gameplay state. Restoring
      // an editor snapshot here could move the player away while the async scene
      // was still loading, making it look as if the character had disappeared.
      object.scale.fromArray(saved.scale);
    } else {
      object.position.fromArray(saved.position);
      object.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2]);
      object.scale.fromArray(saved.scale);
    }
    enforceLockedBuildScale(object);
    object.visible = true;
    openWorld.groundBiomeRock(object);
  };
  const persistSelectedBuildAsset = () => {
    if (!selectedBuildAsset) return;
    const assets = buildCandidates(), index = assets.indexOf(selectedBuildAsset);
    // Build mode is a free-form world editor. Biome/tree-vs-city validation is
    // for procedural spawning and gameplay, never for moving an existing asset.
    if (index >= 0) buildState.assets[buildIdFor(selectedBuildAsset, index)] = snapshotBuildAsset(selectedBuildAsset);
    saveBuildState();
  };
  const refreshBuildInspector = () => {
    const inspected = inspectedBuildObject(); buildInspector.classList.toggle("hidden", !inspected);
    buildSelectedName.textContent = inspected?.userData.cityId
      ?`${inspected.userData.ownerName?`${buildState.city[inspected.userData.cityId]?.kind === "inn" ? "Pousada da" : "Casa de"} ${inspected.userData.ownerName} · `:''}${inspected.userData.cityId}`
      :inspected?.name || inspected?.type || "Nenhum asset";
    buildTransformInputs.forEach((input) => {
      const [group, axis] = input.dataset.buildTransform!.split(".") as ["position" | "rotation" | "scale", "x" | "y" | "z" | "uniform"];
      input.disabled = !inspected || (axis === "uniform" && hasLockedBuildScale(inspected));
      if (!inspected) { input.value = ""; return; }
      const raw = axis === "uniform" ? inspected.scale.x : inspected[group][axis];
      input.value = (group === "rotation" ? THREE.MathUtils.radToDeg(raw) : raw).toFixed(2);
    });
  };
  const anchorSelectedAssetToGround = () => {
    if (!selectedBuildAsset) return;
    selectedBuildAsset.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(selectedBuildAsset);
    if (!box.isEmpty() && Number.isFinite(box.min.y)) {
      selectedBuildAsset.position.y += selectedBuildGroundY - box.min.y;
      selectedBuildAsset.updateMatrixWorld(true);
    }
  };
  const selectBuildAsset = (object: THREE.Object3D | null) => {
    if (object) selectedCityIds.clear();
    selectedBuildAsset = object;
    if (object) {
      enforceLockedBuildScale(object);
      if (!object.visible) object.visible = true;
      selectedBuildUniformScale = object.scale.x;
      object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(object);
      selectedBuildGroundY = box.isEmpty() ? object.position.y : box.min.y;
      transformControls.attach(object);
    }
    else transformControls.detach();
    refreshBuildInspector(); refreshBuildAssetList();
  };
  function refreshBuildAssetList() {
    openWorld.configureForestEditor(buildState.assets, buildState.removedAssets,buildState.forestErasures);
    for (const [id, saved] of Object.entries(buildState.assets)) {
      if (!saved.forestModel || scene.children.some((object) => object.userData.buildId === id) || buildState.removedAssets.includes(id) || buildState.removedAssets.includes(saved.label ?? "")) continue;
      const model = openWorld.createBiomeModel(saved.forestModel);
      if (!model) continue;
      model.name = saved.label ?? `${saved.forestModel} · ${id}`;
      model.userData.buildId = id;
      applySavedBuildAsset(model, saved);
      // Saved editor assets remain visible wherever the user placed them.
      model.visible = true;
      scene.add(model);
    }
    // Recreate every catalog post from its saved transform. Older saves did
    // not carry a model marker, so the stable ID prefix is also authoritative.
    let liveAssets=buildCandidates();
    const lanternTemplate=liveAssets.find(object=>object.name==='Lanterna marrom da rua');
    if(lanternTemplate){
      const liveIds=new Set<string>();scene.traverse(object=>{if(object.userData.buildId)liveIds.add(String(object.userData.buildId));});
      for(const [id,saved] of Object.entries(buildState.assets)){
        if(!(saved.streetLantern||id.startsWith('street-lantern-catalog-'))||liveIds.has(id)||buildState.removedAssets.includes(id))continue;
        const object=lanternTemplate.clone(true);
        object.name=saved.label??`Poste da avenida · ${id.slice(-8)}`;
        object.userData={...object.userData,buildId:id,buildEditable:true,buildStateApplied:true};
        delete object.userData.cityId;delete object.userData.ownerCityId;delete object.userData.cityObject;
        applySavedBuildAsset(object,saved);scene.add(object);liveIds.add(id);
      }
    }
    const query = buildSearch.value.trim().toLowerCase();
    let assets = buildCandidates();
    assets.forEach((object, index) => {
      if (!protectedBuildAssets.has(object.name) && buildState.removedAssets.includes(buildRemovalKey(object, index))) object.removeFromParent();
    });
    assets = buildCandidates();
    lastBuildCandidateCount = openWorld.getBiomeModels().length + animalAssetTemplates.size + cityBuilder.objects.size;
    const folders = new Map<string, { hidden: boolean; render: () => HTMLElement }[]>();
    const animalModels = new Set<string>();
    assets.forEach((object, index) => {
      const id = buildIdFor(object, index), label = assetLabel(object, index);
      buildAssetRegistry.set(id, object);
      if (!buildInitialTransforms.has(object)) buildInitialTransforms.set(object, snapshotBuildAsset(object));
      const saved = buildState.assets[id];
      if (saved && !object.userData.buildStateApplied) { applySavedBuildAsset(object, saved); object.userData.buildStateApplied = true; }
      if (object.userData.biome) object.visible = openWorld.canPlaceBiomeAsset(object);
      // The library lists source models. Scatter instances remain selectable in the viewport.
      if (object.userData.biome && !object.userData.forestModel) return;
      const folderName = buildFolderFor(object, label);
      const isAnimalModel = Boolean(object.userData.animalModel);
      if (isAnimalModel) {
        if (animalModels.has(object.userData.animalModel)) return;
        animalModels.add(object.userData.animalModel);
      }
      const displayLabel = isAnimalModel ? object.userData.modelLabel as string : label;
      const hidden = Boolean(query && !displayLabel.toLowerCase().includes(query));
      const render = () => {
      const row = document.createElement("div"), button = document.createElement("button"), remove = document.createElement("button");
      row.className = "build-asset-row"; row.hidden = hidden;row.draggable=true;row.dataset.assetId=id;
      row.addEventListener("dragstart",event=>event.dataTransfer?.setData("text/build-asset",id));
      button.type = "button"; button.dataset.buildAsset = id;
      const thumbnail=renderBuildThumbnail(object);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${displayLabel}</span>`;
      if (isAnimalModel) { button.title = "Selecionar um exemplar deste modelo no mapa"; button.dataset.animalModel = object.userData.animalModel; }
      button.classList.toggle("active", object === selectedBuildAsset);
      button.addEventListener("click", () => selectBuildAsset(object));
      if (!isAnimalModel) button.addEventListener("contextmenu", (event) => { event.preventDefault(); removeBuildAssetFromScene(object); });
      remove.type = "button"; remove.className = "build-asset-delete"; remove.title = `Excluir ${label}`; remove.setAttribute("aria-label", `Excluir ${label}`); remove.textContent = "🗑";
      remove.addEventListener("click", () => removeBuildAssetFromScene(object));
      row.append(button);
      if (!isAnimalModel) row.append(remove);
      return row;
      };
      const folder = buildFolderState.assets[id]??(object.userData.forestModel ? "Objetos colocados" : isAnimalModel ? "Animais" : folderName);
      const entries = folders.get(folder) ?? [];
      entries.push({ hidden, render });
      folders.set(folder, entries);
    });
    // The object library is a source catalog, not a dump of every live scene
    // object. Keep only the four authored world-building collections.
    folders.clear();
    const lantern=assets.find(object=>object.name==='Lanterna marrom da rua');
    const lanternEntries=lantern?[{
      hidden:Boolean(query&&!`poste da avenida lanterna marrom da rua`.includes(query)),
      render:()=>{
        const row=document.createElement('div'),button=document.createElement('button');row.className='build-asset-row';button.type='button';
        const thumbnail=renderBuildThumbnail(lantern);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')`+'"':''}></i><span>Poste da avenida</span>`;
        button.title='Adicionar um poste da avenida';button.addEventListener('click',()=>{
          const object=lantern.clone(true),id=`street-lantern-catalog-${crypto.randomUUID()}`;
          object.name=`Poste da avenida · ${id.slice(-8)}`;object.userData={...object.userData,buildId:id,buildEditable:true};
          delete object.userData.cityId;delete object.userData.ownerCityId;delete object.userData.cityObject;
          const ground=playerGroundHeightAt(controls.target.x,controls.target.z);
          object.position.set(controls.target.x,ground,controls.target.z);scene.add(object);object.updateMatrixWorld(true);
          object.updateMatrixWorld(true);buildState.assets[id]=snapshotBuildAsset(object);saveBuildState();selectBuildAsset(object);refreshBuildAssetList();
        });row.append(button);return row;
      },
    }]:[];
    folders.set("Animais",[...animalAssetTemplates].map(([url,template])=>({
      hidden:Boolean(query&&!String(template.userData.modelLabel).toLowerCase().includes(query)),
      render:()=>{
        const row=document.createElement("div"),button=document.createElement("button");row.className="build-asset-row";button.type="button";
        const thumbnail=renderBuildThumbnail(template);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${template.userData.modelLabel}</span>`;
        button.addEventListener("click",()=>{const object=cloneSkeleton(template) as THREE.Group;object.name=`${template.userData.modelLabel} · ${crypto.randomUUID().slice(0,8)}`;object.userData.animalModel=url;object.userData.modelLabel=template.userData.modelLabel;object.userData.buildEditable=true;object.position.set(controls.target.x,openWorld.getHeightAt(controls.target.x,controls.target.z),controls.target.z);scene.add(object);if(url.includes('/horse/'))registerRideableHorse(object,object.animations);selectBuildAsset(object);});
        row.append(button);return row;
      }
    })));
    const catalogModels=openWorld.getBiomeModels().filter(model=>
      model.biome==="Deserto"||
      (model.biome==="Floresta"&&/^(?:Pinheiro|Pedra)/i.test(model.label))||
      (model.biome==="Neve"&&/^Pinheiro/i.test(model.label))
    );
    for (const folder of ["Floresta","Neve","Deserto"]) folders.set(folder, catalogModels.filter((model) => model.biome === folder).map((model) => ({
      hidden: Boolean(query && !model.label.toLowerCase().includes(query)),
      render: () => {
        const row = document.createElement("div"), add = document.createElement("button");
        row.className = "build-asset-row";
        add.type = "button";
        let preview=buildBiomePreviewSources.get(model.id);
        if(!preview){preview=openWorld.createBiomeModel(model.id)??undefined;if(preview)buildBiomePreviewSources.set(model.id,preview);}
        const thumbnail=preview?renderBuildThumbnail(preview):"";
        add.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>${model.label}</span>`;
        add.title = "Adicionar este modelo ao ponto central da câmera";
        add.dataset.forestModel = model.id;
        add.addEventListener("click", () => {
          const object = openWorld.createBiomeModel(model.id);
          if (!object) return;
          object.position.set(controls.target.x, openWorld.getHeightAt(controls.target.x, controls.target.z), controls.target.z);
          worldEditorStore.checkpoint();
          const id = `biome-placed-${crypto.randomUUID()}`;
          object.userData.buildId = id;
          object.name = `${model.label} · ${id.slice(-8)}`;
          object.position.set(controls.target.x, openWorld.getHeightAt(controls.target.x, controls.target.z), controls.target.z);
          scene.add(object);
          buildState.assets[id] = snapshotBuildAsset(object);
          saveBuildState();
          selectBuildAsset(object);
        });
        row.append(add);
        return row;
      },
    })));
    if(proceduralDockTemplate){
      const dockTemplate=proceduralDockTemplate;
      folders.get("Floresta")!.unshift({hidden:Boolean(query&&!"doca artesanal madeira floresta".includes(query)),render:()=>{
        const row=document.createElement("div"),button=document.createElement("button");row.className="build-asset-row";button.type="button";
        const thumbnail=renderBuildThumbnail(dockTemplate);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>Doca artesanal</span>`;
        button.title="Adicionar doca procedural ao centro da câmera";
        button.addEventListener("click",()=>{
          worldEditorStore.checkpoint();const object=dockTemplate.clone(true),id=`dock-procedural-${crypto.randomUUID()}`;
          object.name=`Doca artesanal · ${id.slice(-8)}`;object.userData={...object.userData,buildId:id,harborModel:"procedural-dock",buildFolder:"Floresta",buildEditable:true};
          const x=controls.target.x,z=controls.target.z,y=openWorld.getHeightAt(x,z)+.3;object.position.set(x,y,z);scene.add(object);fitProceduralDockSupports(object);
          buildState.assets[id]=snapshotBuildAsset(object);saveBuildState();selectBuildAsset(object);refreshBuildAssetList();
        });row.append(button);return row;
      }});
    }
    const capitalEntry={hidden:Boolean(query&&!"cidade principal grupo capital".includes(query)),render:()=>{
      const row=document.createElement("div"),button=document.createElement("button");row.className="build-asset-row";button.type="button";
      const thumbnail=renderBuildThumbnail(cityBuilder.root);
      button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:""}></i><span>Cidade Principal <small>grupo</small></span>`;
      button.title="Selecionar e transformar a cidade inteira";button.classList.toggle("active",isCapitalCitySelection());button.addEventListener("click",selectCapitalCity);row.append(button);return row;
    }};
    folders.set("Cidades",[capitalEntry]);
    const constructionNames:Record<string,string>={...Object.fromEntries(PERIMETER_CATALOG.map(item=>[item.kind,item.label])),tavern:'Taverna',inn:'Pousada',shop:'Loja',weapons:'Loja de armas',potions:'Loja de poções',guild:'Guilda',warehouse:'Armazém',church:'Igreja',palace:'Palácio',house:'Casa',castle:'Castelo',wall:'Muralha',tower:'Torre',gate:'Portal da cidade'};
    const constructionCatalog = [...new Set(Object.values(buildState.city).map(saved=>saved.kind).filter(kind=>constructionNames[kind]))];
    const constructionEntries = constructionCatalog.flatMap(kind=>{
      const saved=Object.values(buildState.city).find(item=>item.kind===kind)!;
      const entries = [{label:constructionNames[kind],door:false}];
      return entries.map(({label,door})=>({
        hidden:Boolean(query&&!`${label} catálogo`.toLowerCase().includes(query)),
        render:()=>{
          const row=document.createElement('div'),button=document.createElement('button');row.className='build-asset-row';button.type='button';
          const object=cityBuilder.objects.get(saved.id);
          const source=door?object?.children.find(child=>child.userData.assetSource==='/models/city/props/church-door.glb'):object;
          const thumbnail=source?renderBuildThumbnail(source):'';
          const icon=document.createElement('i');icon.className='asset-real-thumb';if(thumbnail)icon.style.backgroundImage=`url('${thumbnail}')`;
          const name=document.createElement('span');name.textContent=label;
          button.append(icon,name);button.title='Adicionar este modelo ao ponto central da câmera';
          button.addEventListener('click',()=>startCityPlacement(kind as CityAssetKind));
          row.append(button);return row;
        },
      }));
    });
    constructionEntries.push(...lanternEntries);
    const well=assets.find(object=>object.userData.generatedWell);
    if(well)constructionEntries.push({
      hidden:Boolean(query&&!"poço d'água poco agua well".includes(query)),
      render:()=>{
        const row=document.createElement('div'),button=document.createElement('button');row.className='build-asset-row';button.type='button';
        const thumbnail=renderBuildThumbnail(well);button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:''}></i><span>Poço d’água</span>`;
        button.title='Adicionar um poço d’água';button.addEventListener('click',()=>{
          const object=well.clone(true),id=`well-catalog-${crypto.randomUUID()}`;
          object.name=`Poço d’água · ${id.slice(-8)}`;object.userData={...object.userData,buildId:id,buildEditable:true,generatedWell:true};
          delete object.userData.cityId;delete object.userData.ownerCityId;
          const ground=playerGroundHeightAt(controls.target.x,controls.target.z);
          object.position.set(controls.target.x,ground,controls.target.z);scene.add(object);object.updateMatrixWorld(true);
          const bounds=new THREE.Box3().setFromObject(object);if(!bounds.isEmpty())object.position.y+=ground-bounds.min.y;
          object.updateMatrixWorld(true);buildState.assets[id]=snapshotBuildAsset(object);saveBuildState();selectBuildAsset(object);refreshBuildAssetList();
        });row.append(button);return row;
      },
    });
    folders.set('Construções',constructionEntries);
    const floorEntries=[
      {label:'Caminho de terra',kind:'path-dirt',add:async()=>new GLTFLoader().loadAsync('/models/comparisons/path-dirt-original.glb').then(g=>g.scene),preview:()=>new THREE.Mesh(new THREE.PlaneGeometry(1,2),new THREE.MeshLambertMaterial({color:'#795634',flatShading:true}))},
      {label:'Piso de madeira das casas',kind:'house-wood',add:async()=>createCityWoodFloor(),preview:()=>new THREE.Mesh(new THREE.BoxGeometry(1,.085,1),new THREE.MeshLambertMaterial({color:'#7b603f'}))},
      {label:'Piso de pedra',kind:'city-floor',add:async()=>{const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshLambertMaterial({color:'#73766f',flatShading:true})));return g;},preview:()=>new THREE.Mesh(new THREE.PlaneGeometry(1,1),cityPavingMaterial().clone())},
    ].map(item=>({hidden:Boolean(query&&!item.label.toLowerCase().includes(query)),render:()=>{const row=document.createElement('div'),button=document.createElement('button');row.className='build-asset-row';button.type='button';let preview=floorPreviewSources.get(item.kind);if(!preview){if(!floorPreviewLoads.has(item.kind)){floorPreviewLoads.add(item.kind);const original=item.kind==='path-dirt'?new GLTFLoader().loadAsync('/models/comparisons/path-dirt-original.glb').then(g=>g.scene):item.kind==='house-wood'?createCityWoodFloor():Promise.resolve(item.preview());void original.then(model=>{floorPreviewSources.set(item.kind,model);refreshBuildAssetList();});}preview=item.kind==='house-wood'?undefined:item.preview();}const thumbnail=preview?renderBuildThumbnail(preview):'';button.innerHTML=`<i class="asset-real-thumb"${thumbnail?` style="background-image:url('${thumbnail}')"`:''}></i><span>${item.label}</span>`;button.addEventListener('click',async()=>{const object=await item.add();const id=`floor-${item.kind}-${crypto.randomUUID()}`;object.name=`${item.label} · ${id.slice(-8)}`;object.userData={...object.userData,buildId:id,buildFolder:'Piso',floorModel:item.kind,buildEditable:true};object.scale.set(5,1,5);object.position.copy(floorSpawnPoint());scene.add(object);buildState.assets[id]=snapshotBuildAsset(object);saveBuildState();selectBuildAsset(object);refreshBuildAssetList();});row.append(button);return row;}}));
    folders.set('Piso',floorEntries);
    for(const custom of buildFolderState.folders)if(!folders.has(custom))folders.set(custom,[]);
    const order = [...new Set(["Floresta","Neve","Deserto","Animais","Cidades","Construções","Piso",...buildFolderState.folders])];
    buildAssetsHost.replaceChildren(...order.flatMap((folder) => {
      const buttons = folders.get(folder); if (!buttons||(!buttons.length&&!(["Cidades","Animais"].includes(folder))&&!buildFolderState.folders.includes(folder))) return [];
      const details = document.createElement("details"), summary = document.createElement("summary"), content = document.createElement("div");
      details.className = "build-folder"; details.open = openBuildFolders.has(folder) || Boolean(query && buttons.some((entry) => !entry.hidden));
      const customFolder=buildFolderState.folders.includes(folder);
      summary.innerHTML = `<span>${folder}</span><b>${buttons.filter((button) => !button.hidden).length}</b>${customFolder?'<button type="button" class="folder-delete" title="Excluir pasta">×</button>':''}`;
      summary.querySelector(".folder-delete")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();buildFolderState.folders=buildFolderState.folders.filter(item=>item!==folder);for(const [id,value] of Object.entries(buildFolderState.assets))if(value===folder)delete buildFolderState.assets[id];saveBuildFolders();refreshBuildAssetList();});
      details.addEventListener("dragover",event=>{if(event.dataTransfer?.types.includes("text/build-asset")){event.preventDefault();details.classList.add("drag-over");}});
      details.addEventListener("dragleave",()=>details.classList.remove("drag-over"));
      details.addEventListener("drop",event=>{event.preventDefault();details.classList.remove("drag-over");const id=event.dataTransfer?.getData("text/build-asset");if(!id)return;buildFolderState.assets[id]=folder;saveBuildFolders();openBuildFolders.add(folder);refreshBuildAssetList();});
      const visibleEntries = buttons.filter((entry) => !entry.hidden);
      let renderedCount = 0;
      const more = document.createElement("button");
      more.type = "button";
      const renderNext = () => {
        more.remove();
        const next = visibleEntries.slice(renderedCount, renderedCount + 18);
        content.append(...next.map((entry) => entry.render()));
        renderedCount += next.length;
        if (renderedCount < visibleEntries.length) {
          more.textContent = `Mostrar mais · ${renderedCount} de ${visibleEntries.length}`;
          content.append(more);
        }
      };
      more.addEventListener("click", renderNext);
      const renderContents = () => { if (!content.childElementCount) renderNext(); };
      if (details.open) requestAnimationFrame(()=>{if(details.isConnected&&details.open)renderContents();});
      details.append(summary, content);
      summary.addEventListener("click",event=>{
        event.preventDefault();
        const next=!details.open;
        for(const sibling of buildAssetsHost.querySelectorAll<HTMLDetailsElement>(".build-folder[open]"))if(sibling!==details)sibling.open=false;
        openBuildFolders.clear();if(next)openBuildFolders.add(folder);
        details.open=next;
        if(next)requestAnimationFrame(()=>{if(details.isConnected&&details.open)renderContents();});
      });
      // Toggle events are queued by the browser. Detached or replaced folders
      // must never clear the current folder state or close its replacement.
      details.addEventListener("toggle",()=>{if(details.isConnected&&details.open)renderContents();});
      return [details];
    }));
  }
  openWorld.onBiomeModelsChanged = () => refreshBuildAssetList();
  const applyEditorState = () => {
    openWorld.setWorldPreset(buildState.worldPreset);
    rebuildTerrainPaintMarks();
    openWorld.replaceTerrainEdits(buildState.terrain);
    const proceduralAssetsChanged=openWorld.configureForestEditor(buildState.assets,buildState.removedAssets,buildState.forestErasures);
    // Terrain material/height edits already update their meshes in place.
    // Rebuilding biome chunks here would respawn/reorder trees when the user
    // only painted grass, snow, desert or a dirt road.
    if(proceduralAssetsChanged)openWorld.refreshBiomeAssets();
    if (buildState.worldPreset === "arena-island-v1") context.preySystem.preyAnimals.forEach(context.preySystem.placePreyInArena);
    document.querySelector<HTMLOutputElement>("[data-world-preset-status]")!.value = "Ilha Arenas ativa";
    selectedCityIds.clear(); cityBuilder.reconcile(buildState.city); updateCityFloor(); updateCitySelection();
    for (const [id, object] of buildAssetRegistry) {
      if (object.userData.biome && !object.userData.forestModel) continue;
      if(object.userData.forestModel&&!buildState.assets[id]){object.removeFromParent();continue;}
      const removed = buildState.removedAssets.includes(object.name || id);
      if (removed) object.removeFromParent();
      else {
        if (!object.parent) scene.add(object);
        const saved = buildState.assets[id];
        if (saved) applySavedBuildAsset(object, saved);
        if (object.userData.biome) object.visible = openWorld.canPlaceBiomeAsset(object);
      }
    }
    buildWidth.value = String(buildState.mapWidth);
    buildDepth.value = String(buildState.mapDepth);
    applyBuildMapSize();
    refreshBuildAssetList();
    refreshBuildInspector();
  };
  const applyBuildMapSize = (persist = true) => {
    const width = Math.max(1, Number(buildWidth.value) || 1), depth = Math.max(1, Number(buildDepth.value) || 1);
    buildWidth.value = String(width); buildDepth.value = String(depth);
    buildState.mapWidth = width; buildState.mapDepth = depth;
    floor.scale.set(width / 50, depth / 35, 1);
    grid.scale.set(width / 50, 1, depth / 50);
    buildMapOutput.value = `${width} × ${depth}`;
    if (buildMode) controls.maxDistance = 3200;
    camera.far = 5000; camera.updateProjectionMatrix();
    if (persist) saveBuildState();
  };
  buildWidth.value = String(buildState.mapWidth); buildDepth.value = String(buildState.mapDepth); applyBuildMapSize(false);
  const setTimeEditorOpen = (open: boolean) => {
    const editor = document.querySelector<HTMLElement>("#timeEditor")!;
    editor.classList.toggle("hidden", !open);
    editor.setAttribute("aria-hidden", String(!open));
    document.querySelector("[data-build-time]")?.setAttribute("aria-expanded", String(open));
  };
  const toggleTimeEditor = () => setTimeEditorOpen(document.querySelector("#timeEditor")!.classList.contains("hidden"));
  document.querySelector("[data-time-close]")!.addEventListener("click", () => setTimeEditorOpen(false));
  const buildTimeButton = document.createElement("button");
  buildTimeButton.type = "button";
  buildTimeButton.textContent = "◷ Tempo (T)";
  buildTimeButton.setAttribute("data-build-time", "");
  buildTimeButton.setAttribute("aria-controls", "timeEditor");
  buildTimeButton.setAttribute("aria-expanded", "false");
  buildTimeButton.addEventListener("click", toggleTimeEditor);
  document.querySelector(".build-history")!.append(buildTimeButton);
  const setBuildMode = (open: boolean) => {
    buildMode = open; buildPanel.classList.toggle("open", open); buildPanel.classList.remove("collapsed"); buildBadge.classList.remove("open"); document.body.classList.toggle("build-active", open);
    buildPanel.setAttribute("aria-hidden", String(!open));
    controls.minDistance = open ? 1 : 3.5;
    controls.maxDistance = 3200;
    camera.far = 5000;
    camera.updateProjectionMatrix();
    // Build mode temporarily keeps the complete island loaded for overview
    // captures and editing. Closing Build restores regional streaming.
    openWorld.setEditorOverview(open && buildState.worldPreset === "arena-island-v1");
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = open ? 10000 : 18;
      scene.fog.far = open ? 10001 : 40;
    }
    setTimeEditorOpen(open);
    if (open) { restoreCityPropBatches(cityBuilder.root); rebuildTerrainPaintMarks(); context.setInventoryOpen(false); context.pressed.clear(); requestAnimationFrame(()=>{if(buildMode)refreshBuildAssetList();}); buildAssetRefreshTimer = window.setInterval(() => { if (openWorld.getBiomeModels().length + animalAssetTemplates.size + cityBuilder.objects.size !== lastBuildCandidateCount) refreshBuildAssetList(); }, 1200); }
    else { reapplyCityPropBatches(cityBuilder.root); window.clearInterval(buildAssetRefreshTimer); selectBuildAsset(null); selectedCityIds.clear(); updateCitySelection(); clearCityPlacement(); terrainBrushEnabled = false; terrainPreview.visible = false; context.character.group.position.y = context.playerGroundHeightAt(context.character.group.position.x, context.character.group.position.z)+PLAYER_GROUND_OFFSET; context.snapCameraToPlayer(); }
  };
  let buildTransformBefore = "";
  transformControls.addEventListener("mouseDown", () => { buildTransformBefore = worldEditorStore.snapshot(); selectedBuildUniformScale=transformControls.object?.scale.x??1; cityGroupStart.copy(cityGroupProxy.position); cityGroupRotationStart.copy(cityGroupProxy.quaternion); cityGroupScaleStart.copy(cityGroupProxy.scale); cityGroupObjectStarts = new Map([...selectedCityIds].map((id) => {const object=cityBuilder.objects.get(id)!;return [id,{position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()}];})); startAttachedCityTransform(); });
  transformControls.addEventListener("mouseUp", () => { if(isCapitalCitySelection()){
    for(const [object]of cityAttachedStarts){if(object.userData.buildId)buildState.assets[object.userData.buildId]=snapshotBuildAsset(object);}
    context.saveRuntimeWorld();
  }if (buildTransformBefore) worldEditorStore.checkpoint(buildTransformBefore); buildTransformBefore = ""; for (const id of selectedCityIds) { const object = cityBuilder.objects.get(id)!; const saved = buildState.city[id]; saved.position = object.position.toArray(); saved.rotation = [object.rotation.x, object.rotation.y, object.rotation.z]; saved.scale = object.scale.toArray(); } saveBuildState(); });
  transformControls.addEventListener("dragging-changed", (event) => { controls.enabled = !(event as THREE.Event & { value: boolean }).value; });
  transformControls.addEventListener("objectChange", () => {
    const scaledObject=transformControls.object;
    if(scaledObject&&transformControls.getMode()==="scale"){
      if(hasLockedBuildScale(scaledObject)) enforceLockedBuildScale(scaledObject);
      else {
        const values=[scaledObject.scale.x,scaledObject.scale.y,scaledObject.scale.z];
        const uniform=values.reduce((chosen,value)=>Math.abs(value-selectedBuildUniformScale)>Math.abs(chosen-selectedBuildUniformScale)?value:chosen,values[0]);
        scaledObject.scale.setScalar(Math.max(.01,uniform));selectedBuildUniformScale=scaledObject.scale.x;
      }
      if(scaledObject===selectedBuildAsset)anchorSelectedAssetToGround();
    }
    if (selectedCityIds.size > 1 && transformControls.object === cityGroupProxy) {
      const mode=transformControls.getMode(),rotationDelta=cityGroupProxy.quaternion.clone().multiply(cityGroupRotationStart.clone().invert());
      const scaleDelta=new THREE.Vector3(cityGroupProxy.scale.x/cityGroupScaleStart.x,cityGroupProxy.scale.y/cityGroupScaleStart.y,cityGroupProxy.scale.z/cityGroupScaleStart.z);
      for(const id of selectedCityIds){const object=cityBuilder.objects.get(id)!,start=cityGroupObjectStarts.get(id)!;
        if(mode==="translate")object.position.copy(start.position).add(cityGroupProxy.position.clone().sub(cityGroupStart));
        else if(mode==="rotate"){object.position.copy(start.position).sub(cityGroupStart).applyQuaternion(rotationDelta).add(cityGroupStart);object.quaternion.copy(rotationDelta).multiply(start.quaternion);}
        else if(mode==="scale"){object.position.copy(start.position).sub(cityGroupStart).multiply(scaleDelta).add(cityGroupStart);object.scale.copy(start.scale).multiply(scaleDelta);}
      }
      applyAttachedCityTransform();
    }
    else if (selectedCityIds.size === 1 && transformControls.object === cityBuilder.objects.get([...selectedCityIds][0])) { const id = [...selectedCityIds][0], object = cityBuilder.objects.get(id)!; const saved = buildState.city[id]; saved.position = object.position.toArray(); saved.rotation = [object.rotation.x, object.rotation.y, object.rotation.z]; saved.scale = object.scale.toArray(); saveBuildState(); }
    for(const helper of citySelectionHelpers.children)if(helper instanceof OrientedSelectionBox)helper.update();
    refreshBuildInspector(); persistSelectedBuildAsset();
  });
  buildTransformInputs.forEach((input) => input.addEventListener("input", () => {
    const inspected = inspectedBuildObject(); if (!inspected) return;
    const [group, axis] = input.dataset.buildTransform!.split(".") as ["position" | "rotation" | "scale", "x" | "y" | "z" | "uniform"];
    if (axis === "uniform" && hasLockedBuildScale(inspected)) { enforceLockedBuildScale(inspected); refreshBuildInspector(); return; }
    const value = Number(input.value); if (!Number.isFinite(value)) return;
    if (axis === "uniform") inspected.scale.setScalar(Math.max(.01, value));
    else inspected[group][axis] = group === "rotation" ? THREE.MathUtils.degToRad(value) : value;
    if (selectedBuildAsset) { selectedBuildUniformScale = selectedBuildAsset.scale.x; if (axis === "uniform") anchorSelectedAssetToGround(); persistSelectedBuildAsset(); }
    else { const id = [...selectedCityIds][0], saved = buildState.city[id]; saved.position = inspected.position.toArray(); saved.rotation = [inspected.rotation.x, inspected.rotation.y, inspected.rotation.z]; saved.scale = inspected.scale.toArray(); saveBuildState(); }
    for(const helper of citySelectionHelpers.children)if(helper instanceof OrientedSelectionBox)helper.update();
  }));
  buildTransformInputs.forEach((input) => {
    input.addEventListener("focus", () => { buildTransformBefore = worldEditorStore.snapshot(); });
    input.addEventListener("change", () => { if (buildTransformBefore) worldEditorStore.checkpoint(buildTransformBefore); buildTransformBefore = ""; });
  });
  buildSearch.addEventListener("input", refreshBuildAssetList);
  buildWidth.addEventListener("input", () => applyBuildMapSize()); buildDepth.addEventListener("input", () => applyBuildMapSize());
  document.querySelectorAll<HTMLButtonElement>("[data-build-tool]").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.buildTool as "translate" | "rotate" | "scale"; transformControls.setMode(mode);
    document.querySelectorAll("[data-build-tool]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  document.querySelector<HTMLButtonElement>("[data-build-space]")!.addEventListener("click", (event) => {
    buildSpace = buildSpace === "world" ? "local" : "world"; transformControls.setSpace(buildSpace);
    (event.currentTarget as HTMLButtonElement).textContent = buildSpace === "world" ? "Global" : "Local";
  });
  const buildGridButton = document.querySelector<HTMLButtonElement>("[data-build-grid]")!;
  document.querySelector<HTMLElement>(".world-editor-actions")!.prepend(buildGridButton);
  const setBuildGridVisible = (visible: boolean) => {
    grid.visible = visible;
    buildGridButton.classList.toggle("active", visible);
    buildGridButton.textContent = visible ? "# Grade" : "# Sem grade";
    localStorage.setItem("rpg3d.buildGridVisible", String(visible));
  };
  setBuildGridVisible(localStorage.getItem("rpg3d.buildGridVisible") !== "false");
  buildGridButton.addEventListener("click", () => setBuildGridVisible(!grid.visible));
  const worldPresetStatus = document.querySelector<HTMLOutputElement>("[data-world-preset-status]")!;
  const refreshWorldPresetStatus = () => { worldPresetStatus.value = "Ilha Arenas ativa"; };
  refreshWorldPresetStatus();
  document.querySelector<HTMLSelectElement>("[data-arena-region]")!.addEventListener("change", (event) => { const index=Number((event.currentTarget as HTMLSelectElement).value);if(!Number.isInteger(index)||!ARENA_REGIONS[index])return;const [,x,z,radius]=ARENA_REGIONS[index];const y=openWorld.getHeightAt(x,z);controls.target.set(x,y,z);camera.position.set(x+radius*.7,y+radius*.45,z+radius*.7);controls.update(); });
  document.querySelector<HTMLButtonElement>("[data-build-undo]")!.addEventListener("click", () => { if (worldEditorStore.undo()) applyEditorState(); });
  document.querySelector<HTMLButtonElement>("[data-build-redo]")!.addEventListener("click", () => { if (worldEditorStore.redo()) applyEditorState(); });
  document.querySelector<HTMLButtonElement>("[data-build-duplicate]")!.addEventListener("click", () => {
    if (!selectedBuildAsset || protectedBuildAssets.has(selectedBuildAsset.name)) return;
    worldEditorStore.checkpoint();
    const copy = selectedBuildAsset.clone(true);
    copy.name = `${selectedBuildAsset.name || selectedBuildAsset.type} cópia`;
    const duplicateSize=new THREE.Box3().setFromObject(selectedBuildAsset).getSize(new THREE.Vector3());
    // Place full construction groups beside the source instead of almost on
    // top of it. The old fixed 1.5 m offset stacked complete piers together.
    copy.position.x += Math.max(1.5,duplicateSize.x+1.5);
    copy.userData = { ...copy.userData, buildId: `duplicate-${crypto.randomUUID()}`, buildStateApplied: true };
    if (copy.userData.biome) copy.userData.forestModel ??= copy.userData.assetVariant;
    scene.add(copy);
    const id = copy.userData.buildId as string;
    buildAssetRegistry.set(id, copy);
    buildState.assets[id] = snapshotBuildAsset(copy);
    saveBuildState(); selectBuildAsset(copy); refreshBuildAssetList();
  });
  document.querySelector<HTMLButtonElement>("[data-build-export]")!.addEventListener("click", () => worldEditorStore.exportJson());
  const buildImportFile = document.querySelector<HTMLInputElement>("[data-build-import-file]")!;
  document.querySelector<HTMLButtonElement>("[data-build-import]")!.addEventListener("click", () => buildImportFile.click());
  buildImportFile.addEventListener("change", async () => {
    const file = buildImportFile.files?.[0]; if (!file) return;
    try { await worldEditorStore.importFile(file); applyEditorState(); setPlayStatus("Mapa importado"); }
    catch { setPlayStatus("JSON de mapa inválido"); }
    buildImportFile.value = "";
  });
  window.addEventListener("keydown", (event) => {
    if (!buildMode || !(event.ctrlKey || event.metaKey)) return;
    if (event.code === "KeyZ") {
      event.preventDefault();
      const changed = event.shiftKey ? worldEditorStore.redo() : worldEditorStore.undo();
      if (changed) applyEditorState();
    } else if (event.code === "KeyD") {
      event.preventDefault();
      document.querySelector<HTMLButtonElement>("[data-build-duplicate]")?.click();
    }
  });
  document.querySelector<HTMLButtonElement>("[data-build-focus]")!.addEventListener("click", () => {
    const box=new THREE.Box3().makeEmpty();
    if(selectedBuildAsset)box.setFromObject(selectedBuildAsset);else for(const id of selectedCityIds){const object=cityBuilder.objects.get(id);if(object)box.union(new THREE.Box3().setFromObject(object));}
    if(box.isEmpty())return;const sphere = box.getBoundingSphere(new THREE.Sphere());
    controls.target.copy(sphere.center); camera.position.copy(sphere.center).add(new THREE.Vector3(Math.max(2, sphere.radius * 2), Math.max(1.5, sphere.radius), Math.max(2, sphere.radius * 2))); controls.update();
  });
  document.querySelector<HTMLButtonElement>("[data-build-reset]")!.addEventListener("click", () => {
    if (!selectedBuildAsset) return; const initial = buildInitialTransforms.get(selectedBuildAsset); if (initial) applySavedBuildAsset(selectedBuildAsset, initial); persistSelectedBuildAsset(); refreshBuildInspector();
  });
  document.querySelector<HTMLButtonElement>("[data-build-close]")!.addEventListener("click", () => setBuildMode(false));
  document.querySelector<HTMLButtonElement>("[data-build-collapse]")!.addEventListener("click", () => { buildPanel.classList.add("collapsed"); buildBadge.classList.add("open"); });
  buildBadge.addEventListener("click", () => { if (!buildMode) return; buildPanel.classList.remove("collapsed"); buildBadge.classList.remove("open"); });
  document.querySelector<HTMLButtonElement>("[data-editor-camera]")!.addEventListener("click", (event) => { editorFreeCamera = !editorFreeCamera; const button = event.currentTarget as HTMLButtonElement; button.classList.toggle("active", editorFreeCamera); button.textContent = editorFreeCamera ? "◉ Câmera livre · WASD" : "◎ Câmera do jogador"; if (!editorFreeCamera) { controls.target.copy(context.character.group.position).add(new THREE.Vector3(0, 1, 0)); camera.position.copy(controls.target).add(new THREE.Vector3(4, 3, 6)); } });
  // Capture before TransformControls: Shift-drag on a selected floor is a
  // stamping gesture, never a transform gesture.
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if(!buildMode||event.button!==0||!event.shiftKey||!selectedBuildAsset?.userData.floorModel)return;
    const hit=terrainHit(event);if(!hit)return;
    const bounds=new THREE.Box3().setFromObject(selectedBuildAsset),size=bounds.getSize(new THREE.Vector3());
    floorDragPaint={source:selectedBuildAsset,start:hit.point.clone(),step:Math.max(.05,Math.min(size.x,size.z)*.995),copies:[]};
    event.preventDefault();event.stopImmediatePropagation();transformControls.enabled=false;controls.enabled=false;
  },true);
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!buildMode || transformControls.dragging) return;
    if (event.button===0 && event.shiftKey && selectedBuildAsset?.userData.floorModel) {
      const hit=terrainHit(event);
      if(hit){const bounds=new THREE.Box3().setFromObject(selectedBuildAsset),size=bounds.getSize(new THREE.Vector3());floorDragPaint={source:selectedBuildAsset,start:hit.point.clone(),step:Math.max(.05,Math.min(size.x,size.z)*.995),copies:[]};event.preventDefault();transformControls.enabled=false;controls.enabled=false;return;}
    }
    if (terrainBrushEnabled && event.button === 0) {
      lastForestBrushPoint=undefined;
      const hit = updateTerrainPreview(event); if (!hit) return;
      event.preventDefault(); terrainPainting = true; terrainStrokeBefore = worldEditorStore.snapshot(); terrainFlattenHeight = hit.point.y; terrainRampStart = terrainMode === "ramp" ? hit.point.clone() : undefined; controls.enabled = false;
      lastTerrainBrushAt=0;pendingTerrainBrush=undefined;if (terrainMode !== "ramp") queueTerrainBrush(hit.point, event.shiftKey,true); return;
    }
    if (cityPlacementKind && event.button === 0) {
      const hit = terrainHit(event); if (!hit) return; const point = snapCityPoint(hit.point.clone()); event.preventDefault();
      if (["wall", "road", "path"].includes(cityPlacementKind)) {
        if (event.detail >= 2 && cityPathPoints.length >= 2) { const saved = savedCityObject(cityPlacementKind, new THREE.Vector3(), cityPathPoints); worldEditorStore.checkpoint(); buildState.city[saved.id] = saved; cityBuilder.add(saved); saveBuildState(); clearCityPlacement(); }
        else cityPathPoints.push(point);
        return;
      }
      if (!cityPreview) return; cityPreview.position.copy(point); cityBuilder.alignToTerrain(cityPreview);
      if (cityBuilder.overlaps(cityPreview)) { setPlayStatus("Posição bloqueada: construção sobreposta"); return; }
      const saved = savedCityObject(cityPlacementKind, cityPreview.position); saved.rotation = [cityPreview.rotation.x, cityPreview.rotation.y, cityPreview.rotation.z]; saved.scale = cityPreview.scale.toArray(); worldEditorStore.checkpoint(); buildState.city[saved.id] = saved; cityBuilder.add(saved); saveBuildState();
      selectedCityIds.clear(); selectedCityIds.add(saved.id); updateCitySelection(); return;
    }
    if (event.button === 0) {
      const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(pointer, camera);
      // Loose catalog assets (notably newly placed street lanterns) can sit in
      // front of a city building. Give their explicit editable root priority;
      // otherwise the city-root raycast below captures the click first.
      const editableCandidates = buildCandidates();
      for (const hit of ray.intersectObjects(editableCandidates, true)) {
        let editable: THREE.Object3D | null = hit.object;
        while (editable && !editableCandidates.includes(editable)) editable = editable.parent;
        if (editable?.userData.buildEditable) {
          selectBuildAsset(editable);
          return;
        }
      }
      // Procedural biome assets live below their streaming chunk group. When
      // the candidate root is not the first raycast branch, resolve the hit
      // from the full scene and climb to the editable forest root explicitly.
      for (const hit of ray.intersectObjects(scene.children, true)) {
        let editable: THREE.Object3D | null = hit.object;
        while (editable && editable !== scene && !editable.userData.buildEditable) editable = editable.parent;
        if (editable?.userData.buildEditable) {
          selectBuildAsset(editable);
          return;
        }
      }
      const cityHit = ray.intersectObject(cityBuilder.root, true)[0]; if (cityHit) {
        let editable: THREE.Object3D | null = cityHit.object;
        while (editable && editable !== cityBuilder.root && !editable.userData.buildEditable) editable = editable.parent;
        if(editable?.userData.buildEditable){selectBuildAsset(editable);return;}
        let object: THREE.Object3D | null = cityHit.object;
        while (object && !object.userData.cityId) object = object.parent;
        if(object?.userData.generatedWell){selectBuildAsset(object);return;}
        const id = object?.userData.cityId as string | undefined; if (id) { selectCityObject(selectedCityIds,id,event.shiftKey); selectBuildAsset(null); updateCitySelection(); return; }
      }
    }
    const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
    const candidates = buildCandidates(), hits = raycaster.intersectObjects(candidates, true);
    if (!hits.length) return; let target: THREE.Object3D = hits[0].object;
    while (target.parent && target.parent !== scene&&!candidates.includes(target)) target = target.parent;
    if (candidates.includes(target)) selectBuildAsset(target);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if(floorDragPaint){const hit=terrainHit(event);if(!hit)return;const delta=hit.point.clone().sub(floorDragPaint.start);const axis=Math.abs(delta.x)>=Math.abs(delta.z)?'x':'z';const distance=Math.abs(delta[axis]);const count=Math.floor(distance/floorDragPaint.step);const sign=delta[axis]>=0?1:-1;while(floorDragPaint.copies.length<count){const copy=floorDragPaint.source.clone(true),id=`floor-stamp-${crypto.randomUUID()}`;copy.name=`${floorDragPaint.source.name} · ${floorDragPaint.copies.length+1}`;copy.userData={...copy.userData,buildId:id,buildEditable:true,buildStateApplied:true};copy.position.copy(floorDragPaint.source.position);copy.position[axis]+=sign*floorDragPaint.step*(floorDragPaint.copies.length+1);scene.add(copy);buildAssetRegistry.set(id,copy);buildState.assets[id]=snapshotBuildAsset(copy);floorDragPaint.copies.push(copy);}return;}
    const hit = updateTerrainPreview(event); if (!terrainPainting || !hit || terrainMode === "ramp") return;
    queueTerrainBrush(hit.point, event.shiftKey);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!buildMode || !cityPlacementKind) return; const hit = terrainHit(event); if (!hit) { if (cityPreview) cityPreview.visible = false; cityPathPreview.visible = false; return; } const point = snapCityPoint(hit.point.clone());
    if (cityPreview) { cityPreview.visible = true; cityPreview.position.copy(point); cityBuilder.alignToTerrain(cityPreview); ghostCityObject(cityPreview, cityBuilder.overlaps(cityPreview)); }
    else if (cityPathPoints.length) { cityPathPreview.geometry.dispose(); cityPathPreview.geometry = new THREE.BufferGeometry().setFromPoints([...cityPathPoints, point]); cityPathPreview.visible = true; }
  });
  window.addEventListener("pointerup", (event) => {
    if(floorDragPaint){floorDragPaint=null;transformControls.enabled=true;controls.enabled=true;saveBuildState();refreshBuildAssetList();return;}
    if (!terrainPainting) return; const hit = updateTerrainPreview(event);
    if (terrainMode === "ramp" && hit) applyTerrainAt(hit.point, event.shiftKey);
    else if(pendingTerrainBrush)queueTerrainBrush(pendingTerrainBrush.point,pendingTerrainBrush.shift,true);
    terrainPainting = false; controls.enabled = true; if (terrainStrokeBefore) worldEditorStore.checkpoint(terrainStrokeBefore); terrainStrokeBefore = ""; terrainRampStart = undefined;
    saveBuildState();
    pendingTerrainBrush=undefined;
    lastForestBrushPoint=undefined;
    refreshBuildAssetList();
  });
  renderer.domElement.addEventListener("pointerleave", () => { if (!terrainPainting) terrainPreview.visible = false; });
  renderer.domElement.addEventListener("contextmenu", (event) => {
    if (!buildMode) return;
    event.preventDefault();
    if (cityPlacementKind) { clearCityPlacement(); return; }
    if (terrainBrushEnabled) { terrainBrushEnabled = false; terrainToggle.classList.remove("active"); terrainToggle.textContent = "Ativar pincel"; terrainPreview.visible = false; return; }
    const rect = renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
    // A loose editable asset may be directly in front of an avenue or a
    // building. Delete that asset first instead of the city object behind it.
    const editableCandidates=buildCandidates();
    for(const editableHit of raycaster.intersectObjects(editableCandidates,true)){
      let editable:THREE.Object3D|null=editableHit.object;
      while(editable&&!editableCandidates.includes(editable))editable=editable.parent;
      if(editable?.userData.buildEditable){
        removeBuildAssetFromScene(editable);return;
      }
    }
    for(const editableHit of raycaster.intersectObjects(scene.children,true)){
      let editable:THREE.Object3D|null=editableHit.object;
      while(editable&&editable!==scene&&!editable.userData.buildEditable)editable=editable.parent;
      if(editable?.userData.buildEditable){
        removeBuildAssetFromScene(editable);return;
      }
    }
    const cityHit = raycaster.intersectObject(cityBuilder.root, true)[0];
    if (cityHit) { let cityObject: THREE.Object3D | null = cityHit.object; while (cityObject && !cityObject.userData.cityId) cityObject = cityObject.parent; if(cityObject?.userData.generatedWell){removeBuildAssetFromScene(cityObject);return;} const id = cityObject?.userData.cityId as string | undefined; if (id) { worldEditorStore.checkpoint(); delete buildState.city[id]; cityBuilder.objects.get(id)?.removeFromParent(); cityBuilder.objects.delete(id); selectedCityIds.delete(id); saveBuildState(); updateCitySelection(); return; } }
    const candidates = buildCandidates(), hit = raycaster.intersectObjects(candidates, true)[0];
    if (!hit) return;
    let target: THREE.Object3D = hit.object;
    while (target.parent && target.parent !== scene) target = target.parent;
    if (candidates.includes(target)) removeBuildAssetFromScene(target);
  });

    return {
    get renderBuildThumbnail() { return renderBuildThumbnail; },
    set renderBuildThumbnail(value: typeof renderBuildThumbnail) { renderBuildThumbnail = value; },
    buildThumbnailCache,
    ANIMAL_ASSET_CATALOG,
    animalAssetTemplates,
    get buildMode() { return buildMode; },
    set buildMode(value: typeof buildMode) { buildMode = value; },
    refreshBuildAssetList,
    restoreTerrainPaints: rebuildTerrainPaintMarks,
    get proceduralDockTemplate() { return proceduralDockTemplate; },
    set proceduralDockTemplate(value: typeof proceduralDockTemplate) { proceduralDockTemplate = value; },
    get fitProceduralDockSupports() { return fitProceduralDockSupports; },
    set fitProceduralDockSupports(value: typeof fitProceduralDockSupports) { fitProceduralDockSupports = value; },
    applySavedBuildAsset,
    snapshotBuildAsset,
    CASTLE_LOCKED_SCALE,
    buildWidth,
    buildDepth,
    applyBuildMapSize,
    setBuildMode,
    toggleTimeEditor,
    get cityPlacementKind() { return cityPlacementKind; },
    set cityPlacementKind(value: typeof cityPlacementKind) { cityPlacementKind = value; },
    clearCityPlacement,
    get terrainBrushEnabled() { return terrainBrushEnabled; },
    set terrainBrushEnabled(value: typeof terrainBrushEnabled) { terrainBrushEnabled = value; },
    terrainToggle,
    terrainPreview,
    get editorFreeCamera() { return editorFreeCamera; },
    set editorFreeCamera(value: typeof editorFreeCamera) { editorFreeCamera = value; },
    transformControls,
  };
}
