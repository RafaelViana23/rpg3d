import { CITY_WOOD_COLOR } from '../editor/CityWood';
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createWorldAssetLoader } from "./WorldAssetLighting";
import { FOREST_ASSETS, SNOW_ASSETS, DESERT_ASSETS, TERRAIN_BIOME_FOLDERS } from "./biomeAssets";
import { arenaTerrainFillAt } from "./ArenaTerrainLayout";
import { mountainReliefAt } from "./MountainTerrain";
import type { ForestErasure, SavedBuildAsset, SavedTerrainChunk, TerrainMaterial } from "../editor/WorldEditorSupport";

export interface OpenWorldConfig {
  worldSize: number;
  chunkSize: number;
  viewRadius: number;
  propRadius: number;
  seed: number;
}

type Biome = "field" | "forest" | "mountain";
type Collider = { x: number; z: number; radius: number; topY?: number };
type Chunk = { key: string; x: number; z: number; detail: number; group: THREE.Group; terrain: THREE.Mesh; colliders: Collider[] };
export type TerrainBrushMode = "raise" | "lower" | "flatten" | "plateau" | "hill" | "cliff" | "ramp" | "smooth" | "paint" | "road" | "forest" | "forestErase";
export type ForestBrushKind = "mixed" | "trees" | "grass" | "rocks";
export type TerrainBrush = { mode: TerrainBrushMode; radius: number; strength: number; shape: "circle" | "square"; material: TerrainMaterial };
export const ARENA_REGIONS = [
  ["Cidade Inicial",0,0,160],["Planícies Centrais",-350,350,280],["Floresta de Horunka",-450,-250,230],["Vila Horunka",-300,-100,65],["Alpes de Neve",-550,-700,280],["Bioma de Neve",650,-180,220],["Montanhas de Aincrad",350,-700,350],["Região dos Lagos",450,150,230],["Tolbana",250,550,110],["Deserto",-750,300,200],["Porto",750,550,90],
] as const;
const EDIT_SEGMENTS = 18;
// Inland water connects to the coastal water in this island preset. Keeping
// both surfaces at the same elevation avoids a visible horizontal step where
// their meshes meet.
const SEA_WATER_LEVEL = 0;
const INLAND_WATER_LEVEL = 11;
const INLAND_WATER_EDGE = 42;
const MATERIAL_COLORS: Record<TerrainMaterial, THREE.Color> = {
  grass: new THREE.Color("#79b85e"), dirt: new THREE.Color("#785238"), sand: new THREE.Color("#d2ba72"),
  stone: new THREE.Color("#7d8584"), snow: new THREE.Color("#e3e9e7"), road: new THREE.Color("#a98b58"),
};

const DEFAULT_CONFIG: OpenWorldConfig = { worldSize: 2048, chunkSize: 128, viewRadius: 2, propRadius: 1, seed: 73421 };
const CAPITAL_CENTER_Z = 7.5;
const CAPITAL_SIDE_LENGTH = 172.5;
const CAPITAL_RADIUS = CAPITAL_SIDE_LENGTH/(2*Math.sin(Math.PI/8));
const CAPITAL_TOWER_CLEAR_RADIUS = 22;
const CAPITAL_VERTICES=Array.from({length:8},(_,i)=>{
  const angle=Math.PI/8+i*Math.PI/4;
  return {x:Math.cos(angle)*CAPITAL_RADIUS,z:CAPITAL_CENTER_Z+Math.sin(angle)*CAPITAL_RADIUS};
});

function isInsideCapitalTreeClearance(x:number,z:number){
  // Ray casting follows the real octagonal wall instead of making a large
  // circular clearing around it.  Small circles cover the portions of the
  // vertex towers that project outside the wall.
  let inside=false;
  for(let i=0,j=CAPITAL_VERTICES.length-1;i<CAPITAL_VERTICES.length;j=i++){
    const a=CAPITAL_VERTICES[i],b=CAPITAL_VERTICES[j];
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside||CAPITAL_VERTICES.some(tower=>Math.hypot(x-tower.x,z-tower.z)<CAPITAL_TOWER_CLEAR_RADIUS);
}

function hash2(x: number, z: number, seed: number) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * .017) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x: number, z: number, seed: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uz);
}

function fbm(x: number, z: number, seed: number) {
  let value = 0, amplitude = .55, frequency = 1;
  for (let octave = 0; octave < 4; octave++) {
    value += valueNoise(x * frequency, z * frequency, seed + octave * 101) * amplitude;
    frequency *= 2.03; amplitude *= .48;
  }
  return value;
}

function riverCenter(z: number) { return 265 + Math.sin(z * .0048) * 180 + Math.sin(z * .013) * 30; }

export class OpenWorld {
  cityFloorHeightAt?: (x:number,z:number)=>number|null;
  cityTreeBlockedAt?: (x:number,z:number,clearance:number)=>boolean;
  readonly config: OpenWorldConfig;
  onBiomeModelsChanged?: () => void;
  private readonly root = new THREE.Group();
  private readonly chunks = new Map<string, Chunk>();
  private readonly terrainMaterials: Record<Biome, THREE.MeshLambertMaterial>;
  private readonly waterMaterial = new THREE.MeshLambertMaterial({ color: "#3e9fc0", transparent: true, opacity: .78, depthWrite: false, side: THREE.DoubleSide });
  private readonly trunkGeometry = new THREE.CylinderGeometry(.22, .32, 2.2, 5);
  private readonly crownGeometry = new THREE.ConeGeometry(1.25, 3.6, 6);
  private readonly rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly rockGeometryAlt = new THREE.DodecahedronGeometry(1, 0);
  private readonly grassGeometry = new THREE.ConeGeometry(.18, .85, 3);
  private readonly trunkMaterial = new THREE.MeshLambertMaterial({ color: "#4d3925", flatShading: true });
  private readonly crownMaterial = new THREE.MeshLambertMaterial({ color: "#176849", flatShading: true });
  private readonly rockMaterial = new THREE.MeshLambertMaterial({ color: "#768087", flatShading: true });
  private readonly grassMaterial = new THREE.MeshLambertMaterial({ color: "#3f8d46", flatShading: true });
  private readonly ruinMaterial = new THREE.MeshLambertMaterial({ color: "#77756d", flatShading: true });
  private readonly woodMaterial = new THREE.MeshLambertMaterial({ color: CITY_WOOD_COLOR, flatShading: true });
  private readonly roofMaterial = new THREE.MeshLambertMaterial({ color: "#834739", flatShading: true });
  private terrainEdits: Record<string, SavedTerrainChunk>;
  private worldPreset: "arena-island-v1" | null;
  private readonly dungeonColliders: Collider[] = [];
  private editorOverview = false;
  private readonly treeAssets: THREE.Group[] = [];
  private readonly grassAssets: THREE.Group[] = [];
  private readonly forestRockAssets: THREE.Group[] = [];
  private readonly mapRockAssets: THREE.Group[] = [];
  private readonly snowAssets: THREE.Group[] = [];
  private readonly desertAssets: THREE.Group[] = [];
  private readonly snowZoneCache = new Map<string,"transition"|"interior">();
  private readonly editableForestAssets = new Set<THREE.Object3D>();
  private flightOverview = false;
  private nextFlightChunkAt = 0;
  private settledStreamingKey = "";
  private savedForestAssets: Record<string, SavedBuildAsset> = {};
  private removedForestAssets = new Set<string>();
  private forestErasures:ForestErasure[]=[];
  private erasureSignature="[]";

  constructor(scene: THREE.Scene, config: Partial<OpenWorldConfig> = {}, terrainEdits: Record<string, SavedTerrainChunk> = {}, worldPreset: "arena-island-v1" | null = null) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.terrainEdits = terrainEdits;
    this.worldPreset = worldPreset;
    this.root.name = "Mundo aberto em chunks";
    this.root.userData.buildEditable = false;
    this.terrainMaterials = {
      field: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
      forest: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
      mountain: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    };
    scene.add(this.root);
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    });
    this.loadTreeAssets();
    this.loadSnowAssets();
    this.loadLandscapePack();
    this.loadDesertAssets();
  }

  private normalizeForestAsset(source: THREE.Object3D, label: string, folder: string = FOREST_ASSETS.folder) {
    source.updateWorldMatrix(true, true);
    const asset = new THREE.Group(), model = source.clone(true);
    source.matrixWorld.decompose(model.position, model.quaternion, model.scale);
    asset.add(model);
    asset.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(asset), center = box.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    asset.userData.assetHeight = Math.max(.001, box.max.y - box.min.y);
    asset.name = label;
    asset.userData.biome = folder;
    this.optimizeBiomeTemplate(asset);
    // Merging rotated child meshes tightens their bounds; normalize the final geometry too.
    asset.updateMatrixWorld(true);
    const finalBox = new THREE.Box3().setFromObject(asset);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    for(const child of asset.children)child.position.sub(new THREE.Vector3(finalCenter.x,finalBox.min.y,finalCenter.z));
    asset.userData.assetHeight=Math.max(.001,finalBox.max.y-finalBox.min.y);
    asset.updateMatrixWorld(true);
    asset.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true; });
    return asset;
  }

  private optimizeBiomeTemplate(asset:THREE.Group) {
    asset.updateMatrixWorld(true);
    const byMaterial=new Map<THREE.Material,THREE.BufferGeometry[]>();
    let unsupported=false;
    asset.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      if(object instanceof THREE.SkinnedMesh||Array.isArray(object.material)){unsupported=true;return;}
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      for(const name of Object.keys(geometry.attributes))if(!["position","normal","uv","color"].includes(name))geometry.deleteAttribute(name);
      if(!geometry.getAttribute("normal"))geometry.computeVertexNormals();
      const count=geometry.getAttribute("position").count;
      if(!geometry.getAttribute("uv"))geometry.setAttribute("uv",new THREE.Float32BufferAttribute(new Float32Array(count*2),2));
      if(!geometry.getAttribute("color"))geometry.setAttribute("color",new THREE.Float32BufferAttribute(new Float32Array(count*3).fill(1),3));
      if(object.matrixWorld.determinant()<0)for(const attribute of Object.values(geometry.attributes)){
        const data=attribute as THREE.BufferAttribute;
        for(let i=0;i<count;i+=3)for(let n=0;n<data.itemSize;n++){
          const a=(i+1)*data.itemSize+n,b=(i+2)*data.itemSize+n,temp=data.array[a];data.array[a]=data.array[b];data.array[b]=temp;
        }
      }
      const group=byMaterial.get(object.material)??[];group.push(geometry);byMaterial.set(object.material,group);
    });
    const meshes:THREE.Mesh[]=[];
    if(!unsupported)for(const [material,geometries] of byMaterial){
      const geometry=mergeGeometries(geometries,false);
      if(!geometry){unsupported=true;break;}
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;meshes.push(mesh);
    }
    for(const geometries of byMaterial.values())geometries.forEach(geometry=>geometry.dispose());
    if(unsupported){meshes.forEach(mesh=>mesh.geometry.dispose());return;}
    asset.clear();asset.add(...meshes);asset.updateMatrixWorld(true);
  }

  private rebuildForestChunks(keys?:Set<string>) {
    const chunks=[...this.chunks.values()].filter(chunk=>!keys||keys.has(chunk.key));
    const loaded = chunks.map(({ x, z, detail }) => ({ x, z, detail }));
    for (const chunk of chunks) this.unloadChunk(chunk);
    for (const chunk of loaded) this.loadChunk(chunk.x, chunk.z, chunk.detail);
    this.onBiomeModelsChanged?.();
  }

  registerForestRocks(source: THREE.Object3D) {
    if (this.forestRockAssets.some(model=>/^Pedra · Rock/.test(model.name))) return;
    source.traverse((object) => {
      if (FOREST_ASSETS.rocks.nodePattern.test(object.name))
        this.forestRockAssets.push(this.normalizeForestAsset(object, `Pedra · ${object.name}`));
    });
    this.rebuildForestChunks();
  }

  private loadLandscapePack() {
    createWorldAssetLoader().load('/models/biomes/Floresta/low_poly_rocks_hills_trees.glb',({scene})=>{
      scene.traverse(source=>{
        // The forest uses only its dark conifer and stone variants.
        if(!/^(small_rock|big_rock)_\d+_\d+$/.test(source.name))return;
        const label=`Pedra · Paisagem · ${source.name}`;
        const model=this.normalizeForestAsset(source,label);
        model.userData.largeRock=source.name.startsWith('big_rock');
        model.userData.mountainRock=true;
        const material=new THREE.MeshStandardMaterial({color:'#414b50',roughness:1,metalness:0,flatShading:true});
        model.traverse(object=>{if(object instanceof THREE.Mesh)object.material=material;});
        for(const biome of [FOREST_ASSETS.folder,SNOW_ASSETS.folder]){
          const variant=model.clone(true);
          variant.name=`${label} · ${biome}`;variant.userData.biome=biome;
          this.mapRockAssets.push(variant);
        }
      });
      this.rebuildForestChunks();
    },undefined,error=>console.warn('Não foi possível carregar o pack de paisagem',error));
  }

  private loadSnowAssets() {
    for (const source of SNOW_ASSETS.sources) createWorldAssetLoader().load(source.url, ({ scene }) => {
      for (const name of source.nodes) {
        const found = name ? scene.getObjectByName(name) : scene;
        if (!found) continue;
        const label = source.nodes.length > 1 ? `${source.label} · ${name.replace("FirTreeSnow", "")}` : source.label;
        const model=this.normalizeForestAsset(found,label,SNOW_ASSETS.folder);
        model.userData.biomeAssetKind="tree";
        model.userData.snowZone=source.zone;
        this.snowAssets.push(model);
      }
      this.rebuildForestChunks();
    }, undefined, (error) => console.warn(`Não foi possível carregar ${source.label}`,error));
  }

  private loadTreeAssets() {
    createWorldAssetLoader().load(FOREST_ASSETS.trees, ({ scene }) => {
      // Keep the forest visually consistent with the tall, dark-green conifer.
      const names = ["Group4"];
      for (const name of names) {
        const found = scene.getObjectByName(name);
        if (!found) continue;
        const asset = new THREE.Group(), model = found.clone(true);
        model.rotation.x = -Math.PI / 2;
        asset.add(model);
        asset.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(asset), center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -box.min.y, -center.z);
        asset.updateMatrixWorld(true);
        const normalized = new THREE.Box3().setFromObject(asset);
        asset.userData.assetHeight = Math.max(.001, normalized.max.y - normalized.min.y);
        asset.name = "Pinheiro verde";
        asset.userData.biome = FOREST_ASSETS.folder;
        asset.userData.biomeAssetKind = "tree";
        this.optimizeBiomeTemplate(asset);
        asset.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
        this.treeAssets.push(asset);
      }
      this.rebuildForestChunks();
    }, undefined, (error) => console.warn("Não foi possível carregar o pack de árvores", error));
  }

  private loadDesertAssets() {
    for(const source of DESERT_ASSETS.sources)createWorldAssetLoader().load(source.url,({scene})=>{
      const names:string[]=[...source.nodes];
      if(source.kind==="rocks")scene.traverse(object=>{
        if(/^rock(?:\.?\d+)?$/.test(object.name))names.push(object.name);
      });
      for(const name of names){
        const found=name?scene.getObjectByName(name):scene;
        if(!found)continue;
        const label=names.length>1?`${source.label} · ${name}`:source.label;
        const model=this.normalizeForestAsset(found,label,DESERT_ASSETS.folder);
        model.userData.desertKind=source.kind;
        model.userData.editorHeight=source.height;
        this.desertAssets.push(model);
      }
      this.rebuildForestChunks();
    },undefined,error=>console.warn(`Não foi possível carregar ${source.label}`,error));
  }

  setWorldPreset(preset: "arena-island-v1" | null) { if (this.worldPreset === preset) return; for(const chunk of [...this.chunks.values()])this.unloadChunk(chunk);this.root.clear();this.worldPreset = preset;this.dungeonColliders.length = 0;this.settledStreamingKey=""; }

  setEditorOverview(enabled: boolean) {
    if (this.editorOverview === enabled) return;
    this.editorOverview = enabled;
    this.settledStreamingKey = "";
  }

  setFlightOverview(enabled:boolean){
    if(this.flightOverview===enabled)return;
    this.flightOverview=enabled;
    this.settledStreamingKey="";
  }

  configureForestEditor(saved: Record<string, SavedBuildAsset>, removed: string[], erasures:ForestErasure[]=[]) {
    const procedural=(assets:Record<string,SavedBuildAsset>)=>Object.entries(assets).filter(([id])=>/^(forest|snow)-(tree|grass|rock|desert)-/.test(id));
    const changed=JSON.stringify(procedural(this.savedForestAssets))!==JSON.stringify(procedural(saved))||JSON.stringify([...this.removedForestAssets])!==JSON.stringify(removed)||this.erasureSignature!==JSON.stringify(erasures);
    this.savedForestAssets = saved;
    this.removedForestAssets = new Set(removed);
    this.forestErasures=erasures;this.erasureSignature=JSON.stringify(erasures);
    return changed;
  }

  getEditableForestAssets() { return [...this.editableForestAssets].filter((object) => object.parent); }

  getBiomeModels() {
    return [...this.treeAssets, ...this.forestRockAssets, ...this.mapRockAssets, ...this.grassAssets, ...this.snowAssets, ...this.desertAssets].map((model) => ({
      id: model.name, label: model.name,
      biome: model.userData.biome as string,
      height: model.userData.editorHeight ?? (model.name.startsWith("Pedra") ? (model.userData.largeRock ? 10 : 1.3) : model.userData.biome === SNOW_ASSETS.folder || model.name.startsWith("Árvore") ? 7 : .5),
    }));
  }

  createBiomeModel(id: string) {
    const source = [...this.treeAssets, ...this.forestRockAssets, ...this.mapRockAssets, ...this.grassAssets, ...this.snowAssets, ...this.desertAssets].find((model) => model.name === id);
    if (!source) return null;
    const model = source.clone(true), entry = this.getBiomeModels().find((item) => item.id === id)!;
    model.scale.setScalar(entry.height / source.userData.assetHeight);
    model.userData.forestModel = id;
    model.userData.biome = source.userData.biome;
    model.userData.buildEditable = true;
    return model;
  }

  getBiomeAt(x: number,z: number): string {
    if (this.isWaterAt(x,z)) return "Mar";
    return TERRAIN_BIOME_FOLDERS[this.terrainMaterialAt(x,z) ?? this.defaultTerrainMaterialAt(x,z)];
  }

  getSnowTreeZoneAt(x:number,z:number):"transition"|"interior" {
    const gx=Math.floor(x/24),gz=Math.floor(z/24),key=`${gx}:${gz}`;
    const cached=this.snowZoneCache.get(key);if(cached)return cached;
    const cx=gx*24+12,cz=gz*24+12;
    for(const radius of [32,64,96])for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,sx=cx+Math.cos(angle)*radius,sz=cz+Math.sin(angle)*radius;
      if((this.terrainMaterialAt(sx,sz)??this.defaultTerrainMaterialAt(sx,sz))==="grass"){
        this.snowZoneCache.set(key,"transition");return "transition";
      }
    }
    this.snowZoneCache.set(key,"interior");return "interior";
  }

  canPlaceBiomeAsset(object: THREE.Object3D,x=object.position.x,z=object.position.z,clearance=0) {
    if(object.userData.biomeAssetKind==="tree"&&this.cityTreeBlockedAt?.(x,z,clearance))return false;
    if(this.worldPreset==="arena-island-v1"&&object.userData.biomeAssetKind==="tree"&&isInsideCapitalTreeClearance(x,z))return false;
    return !object.userData.biome || (object.userData.biome === this.getBiomeAt(x,z) &&
      !this.isWaterAt(x,z) && !this.isRiverBank(x,z) &&
      (!object.userData.mountainRock || this.isMountainOutskirts(x,z)));
  }

  private isMountainOutskirts(x:number,z:number) {
    const material=this.terrainMaterialAt(x,z)??this.defaultTerrainMaterialAt(x,z);
    if(material!=="grass"&&material!=="snow")return false;
    const relief=mountainReliefAt(x,z);
    if(relief>80)return false;
    if(relief>3)return true;
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      if(mountainReliefAt(x+Math.cos(angle)*80,z+Math.sin(angle)*80)>12)return true;
    }
    return false;
  }

  private isRiverBank(x:number,z:number) {
    return this.worldPreset === "arena-island-v1" &&
      this.arenaRiverDistance(x,z)<42;
  }

  groundBiomeRock(object:THREE.Object3D, terrain?:THREE.Mesh) {
    if(!object.userData.biome || (object.userData.biome!==DESERT_ASSETS.folder && !/pedra|rock|stone|boulder/i.test(object.userData.forestModel ?? object.userData.assetVariant ?? object.name)))return;
    const {cx,cz}=this.chunkCoordinates(object.position.x,object.position.z);
    terrain ??= this.chunks.get(`${cx}:${cz}`)?.terrain;
    let ground=this.getHeightAt(object.position.x,object.position.z);
    if(terrain){
      terrain.updateWorldMatrix(true,false);
      const ray=new THREE.Raycaster(new THREE.Vector3(object.position.x,10000,object.position.z),new THREE.Vector3(0,-1,0));
      ground=ray.intersectObject(terrain,false)[0]?.point.y ?? ground;
    }
    object.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(object);
    if(!box.isEmpty()){
      const height=box.max.y-box.min.y;
      const embed=object.userData.biome===DESERT_ASSETS.folder
        ? Math.min(.18,height*.12)
        : Math.min(.34,height*.2);
      object.position.y+=ground-box.min.y-embed;
    }
    object.updateMatrixWorld(true);
  }

  refreshBiomeAssets() { this.rebuildForestChunks(); }

  isForestModel(id:string,kind:ForestBrushKind="mixed") {
    return this.getBiomeModels().some(model=>model.id===id&&model.biome===FOREST_ASSETS.folder)&&this.forestKindMatches(id,kind);
  }

  private forestKindMatches(id:string,kind:ForestBrushKind) {
    return kind==="mixed"||(kind==="trees"?id.startsWith("Árvore"):kind==="grass"?id.startsWith("Grama"):id.startsWith("Pedra"));
  }

  eraseForestBrush(center:THREE.Vector3,radius:number,kind:ForestBrushKind) {
    this.forestErasures.push({x:center.x,z:center.z,radius,kind});this.erasureSignature=JSON.stringify(this.forestErasures);
    const keys=new Set<string>(),min=this.chunkCoordinates(center.x-radius,center.z-radius),max=this.chunkCoordinates(center.x+radius,center.z+radius);
    for(let cz=min.cz;cz<=max.cz;cz++)for(let cx=min.cx;cx<=max.cx;cx++)keys.add(`${cx}:${cz}`);
    this.rebuildForestChunks(keys);
  }

  paintForestBrush(center:THREE.Vector3,radius:number,density:number,kind:ForestBrushKind) {
    const added:THREE.Group[]=[];
    const kinds=kind==="mixed"?["trees","grass","rocks"] as const:[kind];
    for(const category of kinds){
      const sources=category==="trees"?this.treeAssets:category==="grass"?this.grassAssets:[...this.forestRockAssets,...this.mapRockAssets.filter(model=>model.userData.biome===FOREST_ASSETS.folder)];
      if(!sources.length)continue;
      const spacing=Math.round((category==="trees"?9:category==="grass"?5:19)/Math.sqrt(Math.max(.25,density))*10)/10;
      for(let gx=Math.floor((center.x-radius)/spacing);gx<=Math.ceil((center.x+radius)/spacing);gx++)for(let gz=Math.floor((center.z-radius)/spacing);gz<=Math.ceil((center.z+radius)/spacing);gz++){
        const id=`forest-brush-${category}-${spacing}-${gx}-${gz}`;
        if(this.savedForestAssets[id]||this.removedForestAssets.has(id))continue;
        const x=(gx+.5+(hash2(gx,gz,91)-.5)*.65)*spacing,z=(gz+.5+(hash2(gx,gz,123)-.5)*.65)*spacing;
        if(Math.hypot(x-center.x,z-center.z)>radius||Math.abs(x)>this.config.worldSize*.5-1||Math.abs(z)>this.config.worldSize*.5-1)continue;
        const source=sources[Math.floor(hash2(gx,gz,53)*sources.length)];
        if(!this.canPlaceBiomeAsset(source,x,z))continue;
        const object=this.createBiomeModel(source.name);if(!object)continue;
        object.userData.buildId=id;object.userData.forestBrush=true;
        object.name=`${source.name} · pincel ${gx}:${gz}`;
        object.position.set(x,this.getHeightAt(x,z),z);
        object.rotation.y=hash2(gx,gz,83)*Math.PI*2;
        object.scale.multiplyScalar(.8+hash2(gx,gz,72)*.45);
        this.groundBiomeRock(object);
        added.push(object);
      }
    }
    return added;
  }

  private addEditableForestAsset(group: THREE.Group, object: THREE.Object3D, id: string, label: string) {
    object.name = label;
    object.userData.buildId = id;
    object.userData.buildEditable = true;
    object.userData.biome ??= FOREST_ASSETS.folder;
    if (this.removedForestAssets.has(id) || this.removedForestAssets.has(label)) return false;
    const saved = this.savedForestAssets[id];
    if (saved) {
      object.position.fromArray(saved.position);
      object.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2]);
      object.scale.fromArray(saved.scale);
      object.userData.buildStateApplied = true;
    }
    let treeClearance=0;
    if(object.userData.biomeAssetKind==='tree'){
      const size=new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
      treeClearance=Math.max(size.x,size.z)/2;
    }
    if (!this.canPlaceBiomeAsset(object,object.position.x,object.position.z,treeClearance)) return false;
    this.groundBiomeRock(object,group.children.find(child=>child instanceof THREE.Mesh && child.name.startsWith("Terreno ")) as THREE.Mesh|undefined);
    if(object.userData.biome===FOREST_ASSETS.folder&&this.forestErasures.some(area=>Math.hypot(object.position.x-area.x,object.position.z-area.z)<=area.radius&&this.forestKindMatches(object.userData.assetVariant??label,area.kind)))return false;
    group.add(object);
    this.editableForestAssets.add(object);
    return true;
  }

  private biomeAt(x: number, z: number): Biome {
    if (this.worldPreset === "arena-island-v1") { if (z < -430 || Math.hypot(x - 350, z + 700) < 360) return "mountain"; if (Math.hypot(x + 450, z + 250) < 270) return "forest"; return "field"; }
    const macro = fbm(x * .00135, z * .00135, this.config.seed + 400);
    if (macro > .73 || Math.abs(x) > 760 || Math.abs(z) > 820) return "mountain";
    if (macro > .48) return "forest";
    return "field";
  }

  private hubBlend(x: number, z: number) {
    const dx = Math.max(Math.abs(x) - 45, 0);
    const dz = Math.max(Math.abs(z - 7.5) - 53, 0);
    return THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 4, 125);
  }

  private roadWeight(x: number, z: number) {
    if (this.worldPreset === "arena-island-v1") return 0;
    const verticalRoad = Math.abs(x - Math.sin(z * .012) * 7);
    const horizontalRoad = Math.abs(z - 7.5 - Math.sin(x * .01) * 6);
    return 1 - THREE.MathUtils.smoothstep(Math.min(verticalRoad, horizontalRoad), 3.5, 8.5);
  }

  private proceduralHeightAt(x: number, z: number) {
    if (this.worldPreset === "arena-island-v1") return this.arenaHeightAt(x, z);
    const hubBlend = this.hubBlend(x, z);
    if (hubBlend <= 0) return 0;
    const macro = fbm(x * .00135, z * .00135, this.config.seed + 400);
    const forestBlend = THREE.MathUtils.smoothstep(macro, .42, .62);
    const mountainBlend = Math.max(THREE.MathUtils.smoothstep(macro, .67, .82), THREE.MathUtils.smoothstep(Math.max(Math.abs(x) - 700, Math.abs(z) - 760), 0, 230));
    const broad = fbm(x * .0022, z * .0022, this.config.seed) - .48;
    const detail = fbm(x * .009, z * .009, this.config.seed + 71) - .5;
    const broadAmplitude = THREE.MathUtils.lerp(8, 15, forestBlend) + mountainBlend * 34;
    const detailAmplitude = THREE.MathUtils.lerp(2.4, 4, forestBlend) + mountainBlend * 7;
    let height = broad * broadAmplitude + detail * detailAmplitude;
    const rolling = (Math.sin(x * .018) + Math.cos(z * .015) + Math.sin((x + z) * .009) * .7) * 1.35;
    const roadWeight = this.roadWeight(x, z);
    height += rolling * (1 - roadWeight * .62);
    height *= 1 - roadWeight * .34;
    const riverDistance = Math.abs(x - riverCenter(z));
    if (riverDistance < 18) height = THREE.MathUtils.lerp(-2.4, height, THREE.MathUtils.smoothstep(riverDistance, 7, 18));
    const lakeDistance = Math.hypot(x - 430, z + 350);
    if (lakeDistance < 86) height = THREE.MathUtils.lerp(-2.1, height, THREE.MathUtils.smoothstep(lakeDistance, 58, 86));
    const edge = this.config.worldSize * .5 - 55;
    const boundary = Math.max(Math.abs(x), Math.abs(z));
    if (boundary > edge) height += Math.pow((boundary - edge) / 55, 2) * 32;
    return height * hubBlend;
  }

  getHeightAt(x: number, z: number) {
    const cityFloor=this.cityFloorHeightAt?.(x,z);
    if(cityFloor!==null&&cityFloor!==undefined)return cityFloor-.06;
    // Editor strokes must not reintroduce bumps in the instrument's bed.
    if(this.worldPreset === "arena-island-v1" && this.arenaRiverDistance(x,z)<=-2)return -3;
    return this.proceduralHeightAt(x, z) + this.sampleHeightEdit(x, z);
  }

  private chunkCoordinates(x: number, z: number) {
    const half = this.config.worldSize * .5, count = Math.ceil(this.config.worldSize / this.config.chunkSize);
    return { cx: THREE.MathUtils.clamp(Math.floor((x + half) / this.config.chunkSize), 0, count - 1), cz: THREE.MathUtils.clamp(Math.floor((z + half) / this.config.chunkSize), 0, count - 1) };
  }

  private sampleHeightEdit(x: number, z: number) {
    const { cx, cz } = this.chunkCoordinates(x, z), data = this.terrainEdits[`${cx}:${cz}`];
    if (!data) return 0;
    const half = this.config.worldSize * .5, localX = (x - (cx * this.config.chunkSize - half)) / this.config.chunkSize * EDIT_SEGMENTS;
    const localZ = (z - (cz * this.config.chunkSize - half)) / this.config.chunkSize * EDIT_SEGMENTS;
    const x0 = THREE.MathUtils.clamp(Math.floor(localX), 0, EDIT_SEGMENTS), z0 = THREE.MathUtils.clamp(Math.floor(localZ), 0, EDIT_SEGMENTS);
    const x1 = Math.min(EDIT_SEGMENTS, x0 + 1), z1 = Math.min(EDIT_SEGMENTS, z0 + 1), tx = localX - x0, tz = localZ - z0;
    const at = (ix: number, iz: number) => data.heights[iz * (EDIT_SEGMENTS + 1) + ix] ?? 0;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(x0, z0), at(x1, z0), tx), THREE.MathUtils.lerp(at(x0, z1), at(x1, z1), tx), tz);
  }

  getTerrainMeshes() { return [...this.chunks.values()].map((chunk) => chunk.terrain); }

  replaceTerrainEdits(edits: Record<string, SavedTerrainChunk>) {
    const changed=JSON.stringify(this.terrainEdits)!==JSON.stringify(edits);
    this.terrainEdits=edits;
    if(changed){this.snowZoneCache.clear();this.refreshTerrain();}
    return changed;
  }

  refreshTerrain(keys?: Set<string>) {
    for (const chunk of this.chunks.values()) if (!keys || keys.has(chunk.key)) this.updateTerrainGeometry(chunk);
  }

  applyTerrainBrush(center: THREE.Vector3, brush: TerrainBrush, flattenHeight: number, rampStart?: THREE.Vector3) {
    if(brush.mode==="forest"||brush.mode==="forestErase")return new Set<string>();
    if(brush.mode==="paint"||brush.mode==="road")this.snowZoneCache.clear();
    const changed = new Set<string>(), half = this.config.worldSize * .5, size = this.config.chunkSize, spacing = size / EDIT_SEGMENTS;
    const min = this.chunkCoordinates(center.x - brush.radius, center.z - brush.radius), max = this.chunkCoordinates(center.x + brush.radius, center.z + brush.radius);
    for (let cz = min.cz; cz <= max.cz; cz++) for (let cx = min.cx; cx <= max.cx; cx++) {
      const key = `${cx}:${cz}`, data = this.terrainEdits[key] ??= { heights: Array((EDIT_SEGMENTS + 1) ** 2).fill(0), materials: Array((EDIT_SEGMENTS + 1) ** 2).fill(null) };
      let touched = false;
      for (let iz = 0; iz <= EDIT_SEGMENTS; iz++) for (let ix = 0; ix <= EDIT_SEGMENTS; ix++) {
        const x = cx * size - half + ix * spacing, z = cz * size - half + iz * spacing;
        const dx = Math.abs(x - center.x), dz = Math.abs(z - center.z), distance = brush.shape === "square" ? Math.max(dx, dz) : Math.hypot(dx, dz);
        if (distance > brush.radius) continue;
        const index = iz * (EDIT_SEGMENTS + 1) + ix, falloff = brush.mode === "plateau" || brush.mode === "cliff" ? (distance < brush.radius * .72 ? 1 : 1 - (distance - brush.radius * .72) / (brush.radius * .28)) : 1 - distance / brush.radius;
        if (brush.mode === "paint" || brush.mode === "road") data.materials[index] = brush.mode === "road" ? "road" : brush.material;
        else {
          const current = this.proceduralHeightAt(x, z) + (data.heights[index] ?? 0);
          let target = current;
          if (brush.mode === "raise" || brush.mode === "hill") target += brush.strength * falloff;
          else if (brush.mode === "lower") target -= brush.strength * falloff;
          else if (brush.mode === "flatten" || brush.mode === "plateau") target = THREE.MathUtils.lerp(current, flattenHeight, Math.min(1, brush.strength * .2) * falloff);
          else if (brush.mode === "cliff") target += Math.round(brush.strength * falloff * 2) / 2;
          else if (brush.mode === "ramp" && rampStart) { const total = Math.max(.001, rampStart.distanceTo(center)); target = THREE.MathUtils.lerp(rampStart.y, center.y, Math.min(1, Math.hypot(x - rampStart.x, z - rampStart.z) / total)); }
          else if (brush.mode === "smooth") {
            let sum = current, count = 1;
            for (const [ox, oz] of [[-spacing, 0], [spacing, 0], [0, -spacing], [0, spacing]]) { sum += this.getHeightAt(x + ox, z + oz); count++; }
            target = THREE.MathUtils.lerp(current, sum / count, Math.min(.8, brush.strength * .12) * falloff);
          }
          data.heights[index] = target - this.proceduralHeightAt(x, z);
        }
        touched = true;
      }
      if (touched) changed.add(key);
    }
    this.refreshTerrain(changed); return changed;
  }

  getWaterLevelAt(x: number, z: number) {
    if (this.worldPreset !== "arena-island-v1") return -.5;
    return this.arenaRiverWeight(x,z) > .01 ? INLAND_WATER_LEVEL : SEA_WATER_LEVEL;
  }

  isWaterAt(x: number, z: number) {
    if (this.worldPreset === "arena-island-v1") return this.getHeightAt(x, z) <= this.getWaterLevelAt(x,z) + .15;
    return Math.abs(x - riverCenter(z)) < 7 || Math.hypot(x - 430, z + 350) < 59;
  }

  update(player: THREE.Vector3) {
    const half = this.config.worldSize * .5;
    player.x = THREE.MathUtils.clamp(player.x, -half + 3, half - 3);
    player.z = THREE.MathUtils.clamp(player.z, -half + 3, half - 3);
    const cx = Math.floor((player.x + half) / this.config.chunkSize);
    const cz = Math.floor((player.z + half) / this.config.chunkSize);
    const streamingKey = `${cx}:${cz}:${Number(this.editorOverview)}:${Number(this.flightOverview)}:${this.worldPreset ?? "default"}`;
    // Once a chunk neighborhood is fully loaded, nothing in the streaming
    // result changes until the player crosses a chunk boundary or an overview
    // mode changes. Avoid rebuilding sets, sorting and scanning every frame.
    if (streamingKey === this.settledStreamingKey) return;
    const wanted = new Set<string>();
    const pending:{x:number;z:number;detail:number;distance:number}[]=[];
    const chunkCount = Math.ceil(this.config.worldSize / this.config.chunkSize);
    // A full overview must cover the opposite edge even when the player is
    // standing at an outermost chunk. Half the chunk count only works when
    // the camera is near the center of the island.
    // Only the editor needs the whole island. Flight uses a wider moving
    // window; keeping all 256 chunks alive caused periodic stalls at speed.
    const fullOverview=(this.editorOverview||this.flightOverview)&&this.worldPreset==="arena-island-v1";
    const radius=fullOverview?chunkCount:this.config.viewRadius;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= chunkCount || z >= chunkCount) continue;
      const distance=Math.max(Math.abs(dx),Math.abs(dz));
      const key = `${x}:${z}`;
      const previousChunk=this.chunks.get(key);
      // Retain near-detail chunks within a one-chunk hysteresis band instead
      // of rebuilding both sides whenever a flight crosses a chunk boundary.
      const near=distance<=this.config.propRadius || (previousChunk?.detail===1&&distance<=this.config.propRadius+1);
      const detail = near ? 1 : this.editorOverview ? 2 : 0;
      wanted.add(key);
      const existing = this.chunks.get(key);
      if(!existing||existing.detail!==detail)pending.push({x,z,detail,distance});
    }
    for (const chunk of this.chunks.values()) if (!wanted.has(chunk.key)) this.unloadChunk(chunk);
    // Overview modes show the complete island, but must stream it over
    // several frames. Loading all 256 chunks synchronously froze the Build
    // panel before it could even paint.
    pending.sort((a,b)=>a.distance-b.distance);
    const now=performance.now();
    const budget=this.flightOverview?(now>=this.nextFlightChunkAt?1:0):this.editorOverview?2:pending.length;
    for(const entry of pending.slice(0,budget)){
      const existing=this.chunks.get(`${entry.x}:${entry.z}`);
      if(existing)this.unloadChunk(existing);
      this.loadChunk(entry.x,entry.z,entry.detail);
    }
    if(this.flightOverview&&budget>0&&pending.length)this.nextFlightChunkAt=now+90;
    if (pending.length <= budget) this.settledStreamingKey = streamingKey;
  }

  resolveCollisions(position: THREE.Vector3, radius: number, flightY?:number) {
    const half = this.config.worldSize * .5;
    position.x = THREE.MathUtils.clamp(position.x, -half + radius, half - radius);
    position.z = THREE.MathUtils.clamp(position.z, -half + radius, half - radius);
    for (const chunk of this.chunks.values()) {
      if (!chunk.detail) continue;
      for (const collider of chunk.colliders) {
        if(flightY!==undefined&&collider.topY!==undefined&&flightY>collider.topY+.5)continue;
        const dx = position.x - collider.x, dz = position.z - collider.z, minimum = radius + collider.radius, distanceSq = dx * dx + dz * dz;
        if (distanceSq >= minimum * minimum) continue;
        const distance = Math.sqrt(distanceSq) || 1;
        position.x = collider.x + dx / distance * minimum;
        position.z = collider.z + dz / distance * minimum;
      }
    }
    for (const collider of this.dungeonColliders) { const dx=position.x-collider.x,dz=position.z-collider.z,minimum=radius+collider.radius,distanceSq=dx*dx+dz*dz;if(distanceSq<minimum*minimum){const distance=Math.sqrt(distanceSq)||1;position.x=collider.x+dx/distance*minimum;position.z=collider.z+dz/distance*minimum;} }
  }

  private arenaRiverDistance(x:number,z:number){
    // Broad, natural lake silhouette. Overlapping basins avoid a geometric
    // circle while shoreline noise gives it the irregular edge of a real lake.
    const ellipse=(px:number,pz:number,cx:number,cz:number,rx:number,rz:number)=>{
      const nx=(px-cx)/rx,nz=(pz-cz)/rz;
      return (Math.hypot(nx,nz)-1)*Math.min(rx,rz);
    };
    const basin=Math.min(
      ellipse(x,z,445,150,198,148),
      ellipse(x,z,330,180,116,96),
      ellipse(x,z,545,120,142,124)
    );
    const shoreline=(fbm(x*.017,z*.017,this.config.seed+317)-.5)*15;
    return basin+shoreline;
  }
  private arenaRiverWeight(x:number,z:number){return 1-THREE.MathUtils.smoothstep(this.arenaRiverDistance(x,z),18,INLAND_WATER_EDGE);}
  private arenaHeightAt(x:number,z:number){
    const island=Math.hypot(x/960,z/930),coast=1-THREE.MathUtils.smoothstep(island,.78,1.02);
    const noise=(fbm(x*.003,z*.003,this.config.seed)-.45)*15+(fbm(x*.011,z*.011,this.config.seed+91)-.5)*6;
    let h=16+noise;
    if(Math.hypot(x+750,z-300)<230)h=Math.min(h,28)+(fbm(x*.018,z*.018,this.config.seed+8)-.5)*8;
    const city=Math.hypot(x,z);if(city<180)h=THREE.MathUtils.lerp(14,h,THREE.MathUtils.smoothstep(city,135,180));
    const riverDistance=this.arenaRiverDistance(x,z);
    const fill = arenaTerrainFillAt(x,z);
    const mountainHeight = 16 + noise;
    const fillHeight = fill.mountain * mountainHeight + fill.sand * (8 + noise * .35) + fill.grass * (16 + noise);
    h = THREE.MathUtils.lerp(coast <= .01 ? -14 : THREE.MathUtils.lerp(-10,h,coast), fillHeight, fill.coverage);
    // Relief crosses biome boundaries continuously, creating foothills instead of a perimeter wall.
    h += mountainReliefAt(x,z);
    // Keep the capital walkable and the existing waterways open through the fill.
    if(city<180)h=THREE.MathUtils.lerp(14,h,THREE.MathUtils.smoothstep(city,135,180));
    // Every point covered by water uses the same flat bed. Only the dry bank
    // outside the shoreline blends back into the surrounding terrain.
    if(riverDistance<32)h=THREE.MathUtils.lerp(-3,h,THREE.MathUtils.smoothstep(riverDistance,22,32));
    return h;
  }

  private loadChunk(x: number, z: number, detail: number) {
    const key = `${x}:${z}`, group = new THREE.Group(), colliders: Collider[] = [];
    group.name = `Chunk ${key}`; group.userData.buildEditable = false;
    const terrain = this.createTerrain(x, z, detail);
    group.add(terrain, ...this.createWater(x, z));
    if(this.worldPreset==="arena-island-v1"){
      // Preserve the prop draw distance, but avoid saturating all nine nearby
      // chunks with the editor's maximum vegetation density.
      if(detail)this.addArenaProps(group,x,z,colliders,detail === 1 ? .68 : .24);
    }else if(detail){this.addProps(group,x,z,colliders);this.addLandmark(group,x,z,colliders);}
    // Generated biome props are static. Batch both near and distant chunks;
    // colliders remain independent, while rendering drops from one draw per
    // cloned mesh to one instanced draw per geometry/material pair.
    if(detail)this.batchDistantBiomeAssets(group);
    this.root.add(group);
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      // Terrain receives the local character shadow. Vegetation and distant
      // props stay out of the shadow pass; rendering them again into a shadow
      // map was the largest source of draw calls in populated chunks.
      object.castShadow = false;
      object.receiveShadow = object === terrain;
    });
    this.chunks.set(key, { key, x, z, detail, group, terrain, colliders });
  }

  private unloadChunk(chunk: Chunk) {
    chunk.group.traverse((object) => this.editableForestAssets.delete(object));
    chunk.group.removeFromParent();
    chunk.terrain.geometry.dispose();
    chunk.group.traverse((object) => {
      if(object instanceof THREE.InstancedMesh)object.dispose();
      if (object instanceof THREE.Mesh && object !== chunk.terrain && object.userData.chunkOwnedGeometry) object.geometry.dispose();
    });
    this.chunks.delete(chunk.key);
  }

  private batchDistantBiomeAssets(group:THREE.Group) {
    const batches=new Map<string,{source:THREE.Mesh;matrices:THREE.Matrix4[]}>();
    group.updateMatrixWorld(true);
    for(const asset of [...group.children]){
      if(!asset.userData.biome)continue;
      let animated=false;asset.traverse(object=>{if(object instanceof THREE.SkinnedMesh)animated=true;});
      if(animated)continue;
      asset.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const key=`${object.geometry.uuid}:${materials.map(material=>material.uuid).join(":")}`;
        const batch=batches.get(key)??{source:object,matrices:[] as THREE.Matrix4[]};
        batch.matrices.push(object.matrixWorld.clone());batches.set(key,batch);
      });
      this.editableForestAssets.delete(asset);asset.removeFromParent();
    }
    for(const {source,matrices} of batches.values()){
      const mesh=new THREE.InstancedMesh(source.geometry,source.material,matrices.length);
      matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
      mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=false;
      mesh.userData.buildEditable=false;mesh.name="Vegetação distante";mesh.computeBoundingSphere();group.add(mesh);
    }
  }

  private createTerrain(cx: number, cz: number, detail: number) {
    // Shared lattice at every detail level avoids cracks between neighboring chunks.
    const size = this.config.chunkSize, halfWorld = this.config.worldSize * .5, segments = 12;
    void detail;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments); geometry.rotateX(-Math.PI / 2);
    const originX = cx * size - halfWorld, originZ = cz * size - halfWorld;
    const positions = geometry.attributes.position as THREE.BufferAttribute, colors: number[] = [];
    const biome = this.biomeAt(originX + size * .5, originZ + size * .5);
    for (let index = 0; index < positions.count; index++) {
      let worldX = originX + positions.getX(index) + size * .5, worldZ = originZ + positions.getZ(index) + size * .5;
      if (this.worldPreset === "arena-island-v1" && mountainReliefAt(worldX,worldZ)>4 && Math.abs(worldX)<halfWorld-1 && Math.abs(worldZ)<halfWorld-1) {
        const gx=cx*segments+index%(segments+1), gz=cz*segments+Math.floor(index/(segments+1));
        const jitterX=(hash2(gx,gz,this.config.seed+61)-.5)*size/segments*.42;
        const jitterZ=(hash2(gx,gz,this.config.seed+83)-.5)*size/segments*.42;
        positions.setX(index,positions.getX(index)+jitterX);positions.setZ(index,positions.getZ(index)+jitterZ);
        worldX+=jitterX;worldZ+=jitterZ;
      }
      positions.setY(index, this.getHeightAt(worldX, worldZ));
      const color = this.terrainColorAt(worldX, worldZ);
      colors.push(color.r, color.g, color.b);
    }
    const indices:number[]=[];
    for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){
      const a=row*(segments+1)+col,b=a+segments+1,c=b+1,d=a+1;
      if((row+col+cx*segments+cz*segments)%2)indices.push(a,b,c,a,c,d);
      else indices.push(a,b,d,b,c,d);
    }
    geometry.setIndex(indices);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const faceted=geometry.toNonIndexed();geometry.dispose();faceted.computeVertexNormals();
    faceted.computeBoundingSphere();
    const mesh = new THREE.Mesh(faceted, this.terrainMaterials[biome]); mesh.position.set(originX + size * .5, 0, originZ + size * .5); mesh.receiveShadow = true; mesh.name = `Terreno ${cx}:${cz}`;
    return mesh;
  }

  private terrainMaterialAt(x: number, z: number) {
    const { cx, cz } = this.chunkCoordinates(x, z), data = this.terrainEdits[`${cx}:${cz}`]; if (!data) return null;
    const half = this.config.worldSize * .5, ix = Math.round((x - (cx * this.config.chunkSize - half)) / this.config.chunkSize * EDIT_SEGMENTS), iz = Math.round((z - (cz * this.config.chunkSize - half)) / this.config.chunkSize * EDIT_SEGMENTS);
    return data.materials[THREE.MathUtils.clamp(iz, 0, EDIT_SEGMENTS) * (EDIT_SEGMENTS + 1) + THREE.MathUtils.clamp(ix, 0, EDIT_SEGMENTS)] ?? null;
  }

  private defaultTerrainMaterialAt(x: number, z: number): TerrainMaterial {
    if (this.worldPreset === "arena-island-v1") {
      const fill = arenaTerrainFillAt(x,z);
      if (fill.coverage >= .5) {
        if (fill.mountain >= fill.sand && fill.mountain >= fill.grass) return "stone";
        return fill.sand >= fill.grass ? "sand" : "grass";
      }
      return this.getHeightAt(x,z) > .15 ? "snow" : "sand";
    }
    if (this.roadWeight(x,z) > .5) return "road";
    return this.biomeAt(x,z) === "mountain" ? "stone" : "grass";
  }

  private terrainColorAt(x: number, z: number) {
    // A biome assigns the same material ID used by the paint brush, never a second palette.
    const material = this.terrainMaterialAt(x,z) ?? this.defaultTerrainMaterialAt(x,z);
    return MATERIAL_COLORS[material].clone();
  }

  private updateTerrainGeometry(chunk: Chunk) {
    const positions = chunk.terrain.geometry.attributes.position as THREE.BufferAttribute, colors = chunk.terrain.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const x = chunk.terrain.position.x + positions.getX(i), z = chunk.terrain.position.z + positions.getZ(i);
      positions.setY(i, this.getHeightAt(x, z));
      const c = this.terrainColorAt(x, z); colors.setXYZ(i, c.r, c.g, c.b);
    }
    positions.needsUpdate = true; colors.needsUpdate = true; chunk.terrain.geometry.computeVertexNormals(); chunk.terrain.geometry.computeBoundingSphere(); chunk.terrain.geometry.computeBoundingBox();
  }

  private createWater(cx: number, cz: number) {
    const size = this.config.chunkSize, halfWorld = this.config.worldSize * .5, originX = cx * size - halfWorld, originZ = cz * size - halfWorld;
    const meshes: THREE.Mesh[] = [];
    if(this.worldPreset==="arena-island-v1"){
      const segments=24, step=size/segments;
      type WaterVertex={x:number;z:number;edge:number};
      const createClippedSurface=(height:number,name:string,edgeAt:(x:number,z:number)=>number)=>{
        const vertices:number[]=[];
        const sample=(x:number,z:number):WaterVertex=>({x,z,edge:edgeAt(x,z)});
        const triangle=(points:WaterVertex[])=>{
          const clipped:WaterVertex[]=[];
          for(let i=0;i<3;i++){
            const a=points[i],b=points[(i+1)%3];
            if(a.edge<=0)clipped.push(a);
            if((a.edge<=0)!==(b.edge<=0)){
              const t=a.edge/(a.edge-b.edge);
              clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,edge:0});
            }
          }
          for(let i=1;i+1<clipped.length;i++)for(const p of [clipped[0],clipped[i],clipped[i+1]])vertices.push(p.x,height,p.z);
        };
        const lattice=Array.from({length:(segments+1)*(segments+1)},(_,index)=>sample(originX+(index%(segments+1))*step,originZ+Math.floor(index/(segments+1))*step));
        for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){
          const index=row*(segments+1)+col;
          const a=lattice[index],b=lattice[index+segments+1],c=lattice[index+segments+2],d=lattice[index+1];
          triangle([a,b,d]);triangle([b,c,d]);
        }
        if(!vertices.length)return;
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
        geometry.computeVertexNormals();geometry.computeBoundingSphere();
        const water=new THREE.Mesh(geometry,this.waterMaterial);
        water.name=name;water.userData.chunkOwnedGeometry=true;water.renderOrder=2;meshes.push(water);
      };
      // Keep the ocean at its original datum while raising the inland lake
      // and river to meet their banks and fishing docks.
      // The sea surface must stop at the inland-water boundary. Previously it
      // continued under the raised river/lake, producing two visible layers.
      createClippedSurface(SEA_WATER_LEVEL,"Mar",(x,z)=>Math.max(
        this.getHeightAt(x,z)-.15,
        INLAND_WATER_EDGE-this.arenaRiverDistance(x,z),
      ));
      createClippedSurface(INLAND_WATER_LEVEL,"Rio e lago",(x,z)=>this.arenaRiverDistance(x,z)-INLAND_WATER_EDGE);
      return meshes;
    }
    const centerZ = originZ + size * .5, riverX = riverCenter(centerZ);
    if (riverX > originX - 18 && riverX < originX + size + 18) {
      const geometry = new THREE.PlaneGeometry(18, size * 1.08, 1, 5); geometry.rotateX(-Math.PI / 2);
      const river = new THREE.Mesh(geometry, this.waterMaterial); river.position.set(riverX, -.55, centerZ); river.rotation.y = Math.atan(Math.cos(centerZ * .0048) * 1.1); river.userData.chunkOwnedGeometry = true; river.renderOrder = 2; meshes.push(river);
    }
    const lakeChunkX = Math.floor((430 + halfWorld) / size), lakeChunkZ = Math.floor((-350 + halfWorld) / size);
    if (cx === lakeChunkX && cz === lakeChunkZ) {
      const geometry = new THREE.CircleGeometry(61, 24); geometry.rotateX(-Math.PI / 2);
      const lake = new THREE.Mesh(geometry, this.waterMaterial); lake.position.set(430, -.5, -350); lake.userData.chunkOwnedGeometry = true; lake.renderOrder = 2; meshes.push(lake);
    }
    return meshes;
  }

  private addArenaProps(group:THREE.Group,cx:number,cz:number,colliders:Collider[],density=1){
    const size=this.config.chunkSize,half=this.config.worldSize*.5,ox=cx*size-half,oz=cz*size-half,centerX=ox+size*.5,centerZ=oz+size*.5,random=seededRandom((cx+11)*92821+(cz+23)*68917+this.config.seed);
    const forest=1-THREE.MathUtils.smoothstep(Math.hypot(centerX+450,centerZ+250),150,330);
    const treeCount=Math.round((150+forest*90)*density);
    const rockCount=Math.round((22+forest*12)*density);
    const placedTrees:{x:number;z:number;radius:number}[]=[];
    const scatter = (templates: THREE.Group[], count: number, kind: string, minHeight: number, maxHeight: number) => {
      if (!templates.length) return;
      const first = Math.floor(random() * templates.length);
      for (let i = 0; i < count; i++) {
        const attempts=kind==="tree"?18:1;
        for(let attempt=0;attempt<attempts;attempt++){
          // Keep tree centers away from chunk edges so crowns from neighboring
          // chunks cannot be generated inside each other.
          const margin=kind==="tree"?8:0;
          const x=ox+margin+random()*(size-margin*2),z=oz+margin+random()*(size-margin*2),h=this.getHeightAt(x,z);
          const biome=this.getBiomeAt(x,z);
          const pool=templates.filter(model=>model.userData.biome===biome && (templates!==this.snowAssets || model.userData.snowZone===this.getSnowTreeZoneAt(x,z)));
          if(!pool.length)continue;
          const source=pool[(first+i)%pool.length];
          if(!this.canPlaceBiomeAsset(source,x,z))continue;
          // Keep the capital, waterways and exposed upper slopes clear of forest scatter.
          if(h<3||this.isWaterAt(x,z)||(source.userData.biome===SNOW_ASSETS.folder&&mountainReliefAt(x,z)>45))continue;
          const height=THREE.MathUtils.lerp(minHeight,maxHeight,random());
          const crownRadius=height*.38;
          if(kind==="tree"&&placedTrees.some(tree=>Math.hypot(tree.x-x,tree.z-z)<tree.radius+crownRadius))continue;
          const object=source.clone(true);
          object.position.set(x,h,z);
          object.rotation.y=random()*Math.PI*2;
          object.scale.setScalar(height/source.userData.assetHeight);
          object.userData.assetVariant=source.name;
          const prefix=source.userData.biome===SNOW_ASSETS.folder?"snow":"forest";
          const added=this.addEditableForestAsset(group,object,`${prefix}-${kind}-${cx}-${cz}-${i}`,`${source.name} · ${cx}:${cz} · ${i+1}`);
          if(!added)continue;
          if(kind==="tree"){
            const actualHeight=source.userData.assetHeight*object.scale.y;
            colliders.push({x:object.position.x,z:object.position.z,radius:THREE.MathUtils.clamp(actualHeight*.075,.38,1.1),topY:object.position.y+actualHeight});
          }else if(kind.includes("rock")){
            object.updateWorldMatrix(true,true);
            const size=new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
            colliders.push({x:object.position.x,z:object.position.z,radius:THREE.MathUtils.clamp(Math.max(size.x,size.z)*.38,.3,6),topY:object.position.y+size.y});
          }
          if(kind==="tree")placedTrees.push({x:object.position.x,z:object.position.z,radius:crownRadius});
          break;
        }
      }
    };
    scatter(this.treeAssets, treeCount, "tree", 8.45, 18.59);
    scatter(this.forestRockAssets, rockCount, "rock", .55, 2.7);
    scatter(this.snowAssets, Math.round(150*density), "tree", 8.45, 16.9);
    scatter(this.mapRockAssets.filter(model=>!model.userData.largeRock),Math.round(26*density),"rock-pack-small",.8,3.5);
    scatter(this.mapRockAssets.filter(model=>model.userData.largeRock),Math.round(8*density),"rock-pack-large",6,16);
    scatter(this.desertAssets.filter(model=>model.userData.desertKind==="cactus"),Math.round(48*density),"desert-cactus",1.5,5);
    scatter(this.desertAssets.filter(model=>model.userData.desertKind==="tumbleweed"),Math.round(24*density),"desert-tumbleweed",.45,1.2);
    scatter(this.desertAssets.filter(model=>model.userData.desertKind==="bones"),Math.round(4*density),"desert-bones",.55,1.4);
    scatter(this.desertAssets.filter(model=>model.userData.desertKind==="rocks"),Math.round(32*density),"desert-rocks",.7,4);
  }

  private addProps(group: THREE.Group, cx: number, cz: number, colliders: Collider[]) {
    const size=this.config.chunkSize, half=this.config.worldSize*.5, originX=cx*size-half, originZ=cz*size-half, biome=this.biomeAt(originX+64,originZ+64);
    const random=seededRandom((cx+1)*92821+(cz+7)*68917+this.config.seed), treeCount=biome==="forest"?52:biome==="field"?20:7, rockCount=biome==="mountain"?30:12, grassCount=biome==="field"?130:46;
    const trunks=new THREE.InstancedMesh(this.trunkGeometry,this.trunkMaterial,treeCount),crowns=new THREE.InstancedMesh(this.crownGeometry,this.crownMaterial,treeCount),rocks=new THREE.InstancedMesh(this.rockGeometry,this.rockMaterial,rockCount),grass=new THREE.InstancedMesh(this.grassGeometry,this.grassMaterial,grassCount),dummy=new THREE.Object3D();
    const place=(mesh:THREE.InstancedMesh,count:number,type:"tree"|"rock"|"grass")=>{
      for(let i=0;i<count;i++){
        let x=originX+4+random()*(size-8),z=originZ+4+random()*(size-8);
        if(Math.abs(x)<55&&z>-48&&z<64)x+=62;
        if(this.isWaterAt(x,z))x+=18;
        if(this.roadWeight(x,z)>.32)x+=10+random()*8;
        const scale=.7+random()*.8;
        let scaleX=scale,scaleY=scale,scaleZ=scale;
        if(type==="rock"){scaleX=scale;scaleY=.45+random()*.72;scaleZ=.65+random()*.8;}
        if(type==="grass")scaleX=scaleY=scaleZ=.7;
        const baseHeight=this.getHeightAt(x,z);
        const centerOffset=type==="tree"?1.1*scaleY:type==="rock"?.72*scaleY:.425*scaleY;
        dummy.position.set(x,baseHeight+centerOffset,z);
        dummy.rotation.set(type==="rock"?random()*.5:0,random()*Math.PI,type==="rock"?random()*.5:0);
        dummy.scale.set(scaleX,scaleY,scaleZ);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        if(type==="tree")colliders.push({x,z,radius:.42*scale,topY:baseHeight+5*scaleY});
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=false;mesh.computeBoundingSphere();group.add(mesh);
    };
    place(trunks,treeCount,"tree");
    for(let i=0;i<treeCount;i++){trunks.getMatrixAt(i,dummy.matrix);dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);dummy.position.y+=2.15*dummy.scale.y;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);} crowns.instanceMatrix.needsUpdate=true; crowns.castShadow=false; crowns.computeBoundingSphere(); group.add(crowns);
    place(rocks,rockCount,"rock"); place(grass,grassCount,"grass");
  }

  private addLandmark(group:THREE.Group,cx:number,cz:number,colliders:Collider[]){
    const roll=hash2(cx,cz,this.config.seed+900), size=this.config.chunkSize, half=this.config.worldSize*.5, x=cx*size-half+64, z=cz*size-half+64;
    if(roll<.055){
      const ruin=new THREE.Group();
      for(let i=0;i<5;i++){const worldX=x+(i-2)*3,worldZ=z+(i%2)*1.2,height=3+hash2(i,cx,7)*4,column=new THREE.Mesh(new THREE.BoxGeometry(1.3,height,1.3),this.ruinMaterial);column.position.set(worldX,this.getHeightAt(worldX,worldZ)+height*.5,worldZ);column.userData.chunkOwnedGeometry=true;ruin.add(column);}
      group.add(ruin);colliders.push({x,z,radius:7});
    } else if(roll>.945){
      const village=new THREE.Group();
      for(let i=0;i<4;i++){const worldX=x+(i%2)*9-4.5,worldZ=z+Math.floor(i/2)*9-4.5,ground=this.getHeightAt(worldX,worldZ),house=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(5,3.4,4),this.woodMaterial),roof=new THREE.Mesh(new THREE.ConeGeometry(4,2.2,4),this.roofMaterial);body.position.y=1.7;roof.position.y=4;roof.rotation.y=Math.PI/4;body.userData.chunkOwnedGeometry=roof.userData.chunkOwnedGeometry=true;house.position.set(worldX,ground,worldZ);house.add(body,roof);village.add(house);colliders.push({x:worldX,z:worldZ,radius:3.2});}
      group.add(village);
    } else if(roll>.48&&roll<.5){const ground=this.getHeightAt(x,z),cave=new THREE.Mesh(new THREE.TorusGeometry(4,1.25,5,8,Math.PI),this.rockMaterial);cave.position.set(x,ground+1,z);cave.rotation.x=Math.PI/2;cave.userData.chunkOwnedGeometry=true;group.add(cave);colliders.push({x,z,radius:4});}
  }

  dispose(){ for(const chunk of [...this.chunks.values()])this.unloadChunk(chunk);this.root.removeFromParent();Object.values(this.terrainMaterials).forEach(material=>material.dispose());[this.waterMaterial,this.trunkMaterial,this.crownMaterial,this.rockMaterial,this.grassMaterial,this.ruinMaterial,this.woodMaterial,this.roofMaterial].forEach(material=>material.dispose());[this.trunkGeometry,this.crownGeometry,this.rockGeometry,this.rockGeometryAlt,this.grassGeometry].forEach(geometry=>geometry.dispose()); }
}

function seededRandom(seed:number){return()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};}
