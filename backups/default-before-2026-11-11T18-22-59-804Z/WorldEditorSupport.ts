import defaultCityLayout from './default-city.json';
export type SavedBuildAsset = { position: number[]; rotation: number[]; scale: number[]; visible: boolean; forestModel?: string; harborModel?: "dock-group" | "ship"; label?: string };
export type ForestErasure = { x:number;z:number;radius:number;kind:"mixed"|"trees"|"grass"|"rocks" };
export type TerrainMaterial = "grass" | "dirt" | "sand" | "stone" | "snow" | "road";
export type SavedTerrainChunk = { heights: number[]; materials: (TerrainMaterial | null)[] };
export type CityAssetKind = "guardhouse" | "stable" | "training-yard" | "military-store" | "tollhouse" | "repair-workshop" | "smithy" | "wagon-shelter" | "wall-shrine" | "wall-access" | "warehouse" | "inn" | "guild" | "weapons" | "potions" | "market" | "fountain" | "palace" | "house" | "shop" | "tavern" | "church" | "castle" | "tower" | "gate" | "bridge" | "stairs" | "wall" | "road" | "path";
export type SavedCityObject = { id: string; kind: CityAssetKind; layer: string; position: number[]; rotation: number[]; scale: number[]; avenueFrontage?:'main'|'secondary';frontageLayoutRevision?:number;avenueClearanceRevision?:number;secondaryAvenues?:{revision:1;left:number;right:number;width:number};palaceEntranceRevision?:number;palaceComplexRevision?:number;royalAvenueRevision?:number; architectureRevision?: number; warehouseLayoutRevision?: number; perimeterLayoutRevision?: number; warehouseClearanceRevision?: number; tavernLayoutRevision?: number; churchScaleRevision?: number; points?: number[][]; width?: number };
export type SavedBuildState = { version: 4; mapWidth: number; mapDepth: number; assets: Record<string, SavedBuildAsset>; removedAssets: string[]; terrain: Record<string, SavedTerrainChunk>; city: Record<string, SavedCityObject>; worldPreset: "arena-island-v1"; pathsRemoved?: boolean; sceneryCleaned?:boolean; sceneryCleanupRevision?:number; harborCleanupRevision?:number;sceneryCleanupBackup?:Record<string,SavedCityObject>; forestErasures?:ForestErasure[] };

const DEFAULT_STATE: SavedBuildState = { version: 4, mapWidth: 50, mapDepth: 35, assets: {}, removedAssets: [], terrain: {}, city: defaultCityLayout.city as Record<string,SavedCityObject>, worldPreset: "arena-island-v1", pathsRemoved: true,sceneryCleaned:true,sceneryCleanupRevision:1,harborCleanupRevision:1 };

export class WorldEditorStore {
  readonly state: SavedBuildState;
  private readonly undoStack: string[] = [];
  private readonly redoStack: string[] = [];

  constructor(private readonly storageKey: string) {
    this.state = this.load();
    if (!this.state.pathsRemoved) {
      this.state.pathsRemoved = true;
      this.undoStack.push(this.snapshot());
      for (const [id, object] of Object.entries(this.state.city))
        if (object.kind === "road" || object.kind === "path") delete this.state.city[id];
      for (const chunk of Object.values(this.state.terrain))
        chunk.materials = chunk.materials.map((material) => material === "road" ? null : material);
      this.save();
    }
    if(this.state.sceneryCleanupRevision!==1){
      this.state.sceneryCleaned=true;this.state.sceneryCleanupRevision=1;
      const removed=Object.fromEntries(Object.entries(this.state.city).filter(([,object])=>object.kind!=="castle"));
      this.state.sceneryCleanupBackup={...this.state.sceneryCleanupBackup,...structuredClone(removed)};
      this.undoStack.push(this.snapshot());
      for(const [id,object] of Object.entries(this.state.city))if(object.kind!=="castle")delete this.state.city[id];
      this.save();
    }
    if(this.state.harborCleanupRevision!==1){
      // Early Build-mode copies spawned complete three-piece piers only 1.5 m
      // apart, stacking them over the original maritime dock.
      for(const [id,asset] of Object.entries(this.state.assets))
        if(asset.harborModel==="dock-group"&&/doca marítima.*cópia/i.test(asset.label??""))delete this.state.assets[id];
      this.state.harborCleanupRevision=1;
      this.save();
    }
    if(!Object.keys(this.state.city).some(id=>id.startsWith('capital-octagon-'))){
      Object.assign(this.state.city,structuredClone(DEFAULT_STATE.city));this.save();
    }
    this.state.forestErasures??=[];
  }

  private load(): SavedBuildState {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) ?? "null") as Partial<SavedBuildState> | null;
      const legacy = saved as Partial<SavedBuildState> & { arenaTerrain?: Record<string, SavedTerrainChunk>; arenaCity?: Record<string, SavedCityObject> };
      const storedCity=legacy.arenaCity??saved?.city;
      const city=storedCity&&Object.keys(storedCity).length?storedCity:structuredClone(DEFAULT_STATE.city);
      return { version: 4, mapWidth: saved?.mapWidth ?? 50, mapDepth: saved?.mapDepth ?? 35, assets: saved?.assets ?? {}, removedAssets: saved?.removedAssets ?? [], terrain: legacy.arenaTerrain ?? saved?.terrain ?? {}, city, worldPreset: "arena-island-v1", pathsRemoved: saved?.pathsRemoved ?? false,sceneryCleaned:saved?.sceneryCleaned??false,sceneryCleanupRevision:saved?.sceneryCleanupRevision,harborCleanupRevision:saved?.harborCleanupRevision,sceneryCleanupBackup:saved?.sceneryCleanupBackup,forestErasures:saved?.forestErasures??[] };
    } catch { return structuredClone(DEFAULT_STATE); }
  }

  snapshot() { return JSON.stringify(this.state); }

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
    this.state.sceneryCleanupBackup=next.sceneryCleanupBackup??this.state.sceneryCleanupBackup;
    this.state.forestErasures=next.forestErasures??[];
    this.save();
  }

  save() { localStorage.setItem(this.storageKey, this.snapshot()); }

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
