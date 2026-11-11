// Biomes own their catalog and editor folder. New packs can add entries here.
export const FOREST_ASSETS = {
  folder: "Floresta",
  trees: "/models/biomes/Floresta/arvores.glb",
  grass: "/models/biomes/Floresta/grama.glb",
  rocks: { source: "/models/environment/medieval-castle/model.glb", nodePattern: /^Rock(?:_\d+)?$/ },
} as const;

export const SNOW_ASSETS = {
  folder: "Neve",
  sources: [
    { url: "/models/biomes/Neve/fir_tree_set_with_snow.glb", nodes: ["FirTreeSnowC"], label: "Pinheiro com neve", zone: "transition" },
    { url: "/models/biomes/Neve/treesnow_low_poly.glb", nodes: [""], label: "Pinheiro cheio de neve", zone: "interior" },
  ],
} as const;

export const DESERT_ASSETS = {
  folder: "Deserto",
  sources: [
    { url: "/models/biomes/Deserto/low_poly_rocks.glb", nodes: [], label: "Pedra do deserto", kind: "rocks", height: 2 },
    { url: "/models/biomes/Deserto/desert_plants.glb", nodes: ["Cactus_6","Cactus_4","Cactus_3","Cactus_2","Cactus_1"], label: "Cacto", kind: "cactus", height: 3 },
    { url: "/models/biomes/Deserto/low-poly_thumbleweed.glb", nodes: [""], label: "Matinho do deserto", kind: "tumbleweed", height: .8 },
    { url: "/models/biomes/Deserto/low_poly_skeleton_pack.glb", nodes: ["Skeleton_0","Skeleton2_1"], label: "Ossada", kind: "bones", height: 1.2 },
  ],
} as const;

export const TERRAIN_BIOME_FOLDERS = {
  grass: "Floresta", snow: "Neve", sand: "Deserto", stone: "Montanha", dirt: "Terra", road: "Estrada",
} as const;
