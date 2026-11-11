import * as THREE from 'three';
/** Shared by equipped characters, city guards and inventory previews. */
export const STEEL_ARMOR_COLOR = '#c7ced1';
export const IRON_ARMOR_COLOR = '#59646b';
export const IRON_METALNESS = .8;
export const IRON_ROUGHNESS = .19;
/** Shared reflected light keeps metal armor readable even without a scene environment. */
export const METAL_ENVIRONMENT = (() => {
  const size=32;
  const faces=Array.from({length:6},(_,face)=>{
    const data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const band=Math.exp(-Math.pow((x/size-.30)/.15,2));
      const shade=face===2?185:face===3?65:105;
      const value=Math.min(255,shade+band*100+(1-y/size)*30);
      const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
    }
    return new THREE.DataTexture(data,size,size);
  });
  const texture=new THREE.CubeTexture(faces);
  texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  return texture;
})();
export const LEATHER_ARMOR_COLOR = '#4a2818';
export function armorColor(visual:string){
  return visual.includes('steel')?STEEL_ARMOR_COLOR:visual.includes('iron')?IRON_ARMOR_COLOR:visual.includes('leather')?LEATHER_ARMOR_COLOR:'#4f5960';
}
export const GUARD_ARMOR = {
  torso:'steel-chest',legs:'steel-pants',boots:'steel-boots',gloves:'steel-gloves',head:'steel-helm',
} as const;
