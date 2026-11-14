/** Shared by equipped characters, city guards and inventory previews. */
export const STEEL_ARMOR_COLOR = '#c7ced1';
export const IRON_ARMOR_COLOR = '#59646b';
export const IRON_METALNESS = .8;
export const IRON_ROUGHNESS = .19;
export const LEATHER_ARMOR_COLOR = '#4a2818';
export function armorColor(visual:string){
  return visual.includes('steel')?STEEL_ARMOR_COLOR:visual.includes('iron')?IRON_ARMOR_COLOR:visual.includes('leather')?LEATHER_ARMOR_COLOR:'#4f5960';
}
export const GUARD_ARMOR = {
  torso:'steel-chest',legs:'steel-pants',boots:'steel-boots',gloves:'steel-gloves',head:'steel-helm',
} as const;
