import type {PavedStreet} from './CityPavedStreet';
import defaultMap from './default-map.json';
export type SavedBuildAsset = { position: number[]; rotation: number[]; scale: number[]; visible: boolean; forestModel?: string; harborModel?: "dock-group" | "ship"; streetLantern?: true; buildModel?: string; label?: string };
export type ForestErasure = { x:number;z:number;radius:number;kind:"mixed"|"trees"|"grass"|"rocks" };
export type TerrainMaterial = "grass" | "dirt" | "sand" | "stone" | "snow" | "road";
export type SavedTerrainChunk = { heights: number[]; materials: (TerrainMaterial | null)[] };
export type CityAssetKind = "guardhouse" | "stable" | "training-yard" | "military-store" | "tollhouse" | "repair-workshop" | "smithy" | "wagon-shelter" | "wall-shrine" | "wall-access" | "warehouse" | "inn" | "guild" | "weapons" | "potions" | "market" | "fountain" | "palace" | "house" | "shop" | "tavern" | "church" | "castle" | "tower" | "gate" | "bridge" | "stairs" | "wall" | "road" | "path";
export type SavedCityObject = { buildingStyle?:'wood'; fortificationStyle?:'village'; villagePerimeterRevision?:number; villageGateLayoutRevision?:number; streetBorderOpenings?:number[][][]; pavedStreet?:PavedStreet; pavingUvReference?:{position:number[];rotationY:number}; centralPlazaRadius?:number; fountainPlazaRadius?:number; militaryFacilitiesRevision?:number; outpostRemovalRevision?:number; id: string; kind: CityAssetKind; layer: string; position: number[]; rotation: number[]; scale: number[]; avenueFrontage?:'main'|'secondary';frontageLayoutRevision?:number;avenueClearanceRevision?:number;secondaryAvenues?:{revision:1;left:number;right:number;width:number};palaceEntranceRevision?:number;palaceComplexRevision?:number;royalAvenueRevision?:number; architectureRevision?: number; warehouseLayoutRevision?: number; perimeterLayoutRevision?: number; warehouseClearanceRevision?: number; tavernLayoutRevision?: number; churchScaleRevision?: number; points?: number[][]; width?: number };
export type WorldJsonAsset = { id:string; modelo:string; nome:string; posição:number[]; rotação:number[]; escala:number[]; visível:boolean; biome?:true; estiloConstrução?:'wood'; estiloFortificação?:'village'; revisaoPortaoVila?:number; pontosEstruturais?:number[][]; larguraEstrutural?:number };
export type WorldJson = { version:5; mapWidth:number; mapDepth:number; objects:Record<string,WorldJsonAsset>; terrain:Record<string,SavedTerrainChunk>; worldPreset:"arena-island-v1"; forestErasures?:ForestErasure[] };
export type SavedBuildState = { version: 4; mapWidth: number; mapDepth: number; assets: Record<string, SavedBuildAsset>; removedAssets: string[]; terrain: Record<string, SavedTerrainChunk>; city: Record<string, SavedCityObject>; worldPreset: "arena-island-v1"; pathsRemoved?: boolean; sceneryCleaned?:boolean; sceneryCleanupRevision?:number; harborCleanupRevision?:number;groundBaselineRevision?:number; forestErasures?:ForestErasure[] };
const STRUCTURAL_MODELS = new Set<CityAssetKind>(['guardhouse','stable','training-yard','military-store','tollhouse','repair-workshop','smithy','wagon-shelter','wall-shrine','wall-access','warehouse','inn','guild','weapons','potions','market','fountain','palace','house','shop','tavern','church','castle','tower','gate','bridge','stairs','wall','road','path']);

const DEFAULT_STATE: SavedBuildState = structuredClone(defaultMap as unknown as SavedBuildState);

export class WorldEditorStore {
  readonly state: SavedBuildState;
  private readonly undoStack: string[] = [];
  private readonly redoStack: string[] = [];
  private loadFailure: Error | null = null;

  constructor(_storageKey: string, private readonly initialRaw: string | null = null) {
    const hadStoredSave = Boolean(initialRaw);
    this.state = this.load();
    if (this.loadFailure) {
      throw this.loadFailure;
    }
    if (!hadStoredSave && !this.state.pathsRemoved) {
      this.state.pathsRemoved = true;
      this.undoStack.push(this.snapshot());
      for (const [id, object] of Object.entries(this.state.city))
        if (object.kind === "road" || object.kind === "path") delete this.state.city[id];
      for (const chunk of Object.values(this.state.terrain))
        chunk.materials = chunk.materials.map((material) => material === "road" ? null : material);
    }
    if(!hadStoredSave&&this.state.sceneryCleanupRevision!==1){
      this.state.sceneryCleaned=true;this.state.sceneryCleanupRevision=1;
      this.undoStack.push(this.snapshot());
      for(const [id,object] of Object.entries(this.state.city))if(object.kind!=="castle")delete this.state.city[id];
    }
    if(!hadStoredSave&&this.state.harborCleanupRevision!==1){
      // Early Build-mode copies spawned complete three-piece piers only 1.5 m
      // apart, stacking them over the original maritime dock.
      for(const [id,asset] of Object.entries(this.state.assets))
        if(asset.harborModel==="dock-group"&&/doca marítima.*cópia/i.test(asset.label??""))delete this.state.assets[id];
      this.state.harborCleanupRevision=1;
    }
    if(!hadStoredSave&&!Object.keys(this.state.city).some(id=>id.startsWith('capital-octagon-'))){
      Object.assign(this.state.city,structuredClone(DEFAULT_STATE.city));
    }
    // Object origins are normalized by the city model loader. Do not rewrite
    // saved world coordinates here: Build owns transforms and Y=0 is the
    // model's real ground plane.
    this.state.forestErasures??=[];
    const hasApprovedPerimeter=Object.keys(this.state.city).some(id=>id.startsWith('capital-octagon-wall-'));
    const hasApprovedAvenue=Boolean(this.state.city['city-royal-avenue-v1']);
    if(!hasApprovedPerimeter||!hasApprovedAvenue){
      for(const [id,object] of Object.entries(DEFAULT_STATE.city)){
        if(id.startsWith('capital-octagon-')||id==='city-royal-avenue-v1')this.state.city[id]=structuredClone(object);
      }
    }
    // Remove the abandoned overlay-mesh format from the persisted map. Terrain
    // painting is stored only in the terrain material grid now.
  }

  private load(): SavedBuildState {
    try {
      let raw = this.initialRaw;
      const saved = JSON.parse(raw ?? "null") as (Partial<SavedBuildState> & Partial<WorldJson>) | null;
      if(!saved)return structuredClone(DEFAULT_STATE);
      if (saved?.version === 5 && saved.objects && saved.terrain) {
        const assets:Record<string,SavedBuildAsset>={}, city:Record<string,SavedCityObject>={};
        for (const entry of Object.values(saved.objects as Record<string,WorldJsonAsset>)) {
          if (entry.modelo === "bridge" || entry.modelo === "dock-group" || entry.id === "dock-lake-group" || /ponte|doca/i.test(entry.nome ?? "")) continue;
          const base={position:entry.posição,rotation:entry.rotação,scale:entry.escala,visible:entry.visível,label:entry.nome};
          if (STRUCTURAL_MODELS.has(entry.modelo as CityAssetKind)) {
            // Version 5 keeps the common transform schema for every object,
            // while roads/walls may still need structural geometry fields.
            // Reuse the bundled structural definition only for those omitted
            // fields; the saved transform and identity remain authoritative.
            const template=DEFAULT_STATE.city[entry.id];
            city[entry.id]={...(template?.kind===entry.modelo?structuredClone(template):{}),id:entry.id,kind:entry.modelo as CityAssetKind,layer:entry.nome,position:entry.posição,rotation:entry.rotação,scale:entry.escala,...(entry.estiloConstrução?{buildingStyle:entry.estiloConstrução}:{}),...(entry.estiloFortificação?{fortificationStyle:entry.estiloFortificação}:{}),...(entry.revisaoPortaoVila?{villageGateLayoutRevision:entry.revisaoPortaoVila}:{}),...(entry.pontosEstruturais?{points:entry.pontosEstruturais}:{}),...(entry.larguraEstrutural!==undefined?{width:entry.larguraEstrutural}:{})};
          }
          else if (entry.biome) assets[entry.id]={...base,forestModel:entry.modelo};
          else assets[entry.id]={...base,buildModel:entry.modelo};
        }
        return {version:4,mapWidth:saved.mapWidth!,mapDepth:saved.mapDepth!,assets,removedAssets:[],terrain:saved.terrain!,city,worldPreset:saved.worldPreset!,forestErasures:saved.forestErasures};
      }
      if (saved.version !== 4 || !saved.assets || !Array.isArray(saved.removedAssets)
        || !saved.terrain || !saved.city) throw new Error("estrutura incompleta");
      const legacy = saved as Partial<SavedBuildState> & { arenaTerrain?: Record<string, SavedTerrainChunk>; arenaCity?: Record<string, SavedCityObject> };
      const storedCity=legacy.arenaCity??saved?.city;
      // An explicitly saved empty city is valid: deleting everything in Build
      // must not cause the bundled default city to return on the next load.
      const city=Object.fromEntries(Object.entries(storedCity??structuredClone(DEFAULT_STATE.city)).filter(([,value]) => value.kind !== "bridge"));
      for (const [id,value] of Object.entries(saved?.assets ?? {})) if (value.buildModel === "bridge" || value.buildModel === "dock-group" || id === "dock-lake-group" || /ponte|doca/i.test(value.label ?? "")) delete saved.assets[id];
      return { version: 4, mapWidth: saved?.mapWidth ?? 50, mapDepth: saved?.mapDepth ?? 35, assets: saved?.assets ?? {}, removedAssets: saved?.removedAssets ?? [], terrain: legacy.arenaTerrain ?? saved?.terrain ?? {}, city, worldPreset: "arena-island-v1", pathsRemoved: saved?.pathsRemoved ?? false,sceneryCleaned:saved?.sceneryCleaned??false,sceneryCleanupRevision:saved?.sceneryCleanupRevision,harborCleanupRevision:saved?.harborCleanupRevision,groundBaselineRevision:saved?.groundBaselineRevision,forestErasures:saved?.forestErasures??[] };
    } catch (error) {
      this.loadFailure = new Error('O save local do mapa está corrompido. Nenhum default foi carregado.');
      throw this.loadFailure;
    }
  }

  snapshot() { return JSON.stringify(this.state); }

  worldJson() {
    const objects:Record<string,WorldJsonAsset>={};
    for (const [id,value] of Object.entries(this.state.city)) objects[id]={id,modelo:value.kind,nome:value.layer||id,posição:value.position,rotação:value.rotation,escala:value.scale,visível:true,...(value.buildingStyle?{estiloConstrução:value.buildingStyle}:{}),...(value.fortificationStyle?{estiloFortificação:value.fortificationStyle}:{}),...(value.villageGateLayoutRevision?{revisaoPortaoVila:value.villageGateLayoutRevision}:{}),...(value.points?{pontosEstruturais:value.points}:{}),...(value.width!==undefined?{larguraEstrutural:value.width}:{})};
    for (const [id,value] of Object.entries(this.state.assets)) {
      const modelo=value.forestModel??value.buildModel??value.harborModel??(value.streetLantern?'street-lantern':id.split('-')[0]);
      objects[id]={id,modelo,nome:value.label??id,posição:value.position,rotação:value.rotation,escala:value.scale,visível:value.visible,...(value.forestModel?{biome:true as const}:{})};
    }
    const world:WorldJson={version:5,mapWidth:this.state.mapWidth,mapDepth:this.state.mapDepth,objects,terrain:this.state.terrain,worldPreset:this.state.worldPreset};
    if(this.state.forestErasures?.length)world.forestErasures=this.state.forestErasures;
    return JSON.stringify(world);
  }

  checkpoint(before?: string) {
    const value = before ?? this.snapshot();
    if (this.undoStack.at(-1) !== value) this.undoStack.push(value);
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack.length = 0;
    this.save();
  }

  undo() {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.snapshot());
    this.replace(JSON.parse(previous) as SavedBuildState);
    return true;
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.snapshot());
    this.replace(JSON.parse(next) as SavedBuildState);
    return true;
  }

  replace(next: SavedBuildState) {
    if (!next || typeof next !== "object" || !next.assets || !Array.isArray(next.removedAssets)) throw new Error("Mapa inválido");
    this.state.version = 4;
    this.state.mapWidth = Number(next.mapWidth) || 50;
    this.state.mapDepth = Number(next.mapDepth) || 35;
    this.state.assets = next.assets;
    this.state.removedAssets = next.removedAssets;
    this.state.terrain = next.terrain ?? {};
    this.state.city = next.city ?? {};
    this.state.worldPreset = "arena-island-v1";
    this.state.pathsRemoved = next.pathsRemoved ?? true;
    this.state.sceneryCleaned=next.sceneryCleaned??true;
    this.state.sceneryCleanupRevision=next.sceneryCleanupRevision??1;
    this.state.harborCleanupRevision=next.harborCleanupRevision??1;
    this.state.forestErasures=next.forestErasures??[];
    this.save();
  }

  save() { /* Build state lives in memory until the explicit database save. */ }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rpg-map-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  async importFile(file: File) {
    const parsed = JSON.parse(await file.text()) as SavedBuildState;
    this.checkpoint();
    this.replace(parsed);
  }
}
