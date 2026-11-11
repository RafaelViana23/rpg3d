import * as T from 'three';

// Art direction: all built wooden elements use the street-lantern brown.
export const CITY_WOOD_COLOR='#7b603f';
export const CITY_WOOD_MATERIAL=new T.MeshLambertMaterial({color:CITY_WOOD_COLOR});
const painted=new WeakMap<T.Material,T.Material>();
export function cityWoodMaterial(source:T.Material,solid=false):T.Material{
  if(solid)return CITY_WOOD_MATERIAL;
  if(!(source instanceof T.MeshStandardMaterial||source instanceof T.MeshLambertMaterial||source instanceof T.MeshBasicMaterial))return source;
  const cached=painted.get(source);if(cached)return cached;
  // Imported palette GLBs can be unlit; use the same lighting model as the house.
  const material=new T.MeshLambertMaterial({
    name:source.name,color:source.color,map:source.map,side:source.side,
    transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,
    alphaMap:source.alphaMap,vertexColors:source.vertexColors,
    depthWrite:source.depthWrite,depthTest:source.depthTest,
  });
  // Keep the atlas for iron, cloth and other non-wood regions.
  material.onBeforeCompile=shader=>{
    shader.uniforms.cityWoodColor={value:CITY_WOOD_MATERIAL.color};
    shader.fragmentShader='uniform vec3 cityWoodColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 woodSample=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2));
      bool wooden=woodSample.r>woodSample.g*1.15 && woodSample.r<woodSample.g*2.5
        && woodSample.g>woodSample.b*1.1 && woodSample.g<max(.001,woodSample.b)*${source.name==='IronWood'?'8.0':'2.8'};
      if(wooden)diffuseColor.rgb=cityWoodColor;`);
  };
  material.customProgramCacheKey=()=> `city-lantern-wood-lit-v3-${source.name==='IronWood'?'market':'palette'}`;
  painted.set(source,material);
  return material;
}
export function applyCityWood(root:T.Object3D,pack:string){
  const woodenPacks=new Set(['tavern-round-table','tavern-table','tavern-stool','tavern-butcher-sign','tavern-sign','ale-mug','box-low-poly','closed-box','chair','wheelbarrow','fruit-basket','pew','milking-stool','shelf','altar','village-window','wagon','village-door','church-door','produce-crate','wood-floor','wood-stairs','farm','tavern-interior','tavern-furniture','bed','well-cover','sign-board','curtain','wall-torch','candle','medieval-market']);
  if(!woodenPacks.has(pack))return;
  root.traverse(child=>{if(!(child instanceof T.Mesh))return;
    const paint=(m:T.Material)=>{
      if(pack==='wood-floor')return CITY_WOOD_MATERIAL;
      if(/metall?|cloth|covers|cork/i.test(m.name))return m;
      if(pack==='medieval-market'&&m.name!=='IronWood')return m;
      return cityWoodMaterial(m,['tavern-round-table','tavern-stool','box-low-poly','wood-floor','wood-stairs','shelf','sign-board','wagon'].includes(pack)||/^(wood|wood_texture_dark)$/i.test(m.name));
    };
    child.material=Array.isArray(child.material)?child.material.map(paint):paint(child.material);
  });
}
