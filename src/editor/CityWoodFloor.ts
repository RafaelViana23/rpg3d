import * as T from 'three';
import {CITY_WOOD_MATERIAL} from './CityWood';
let materialPromise:Promise<T.MeshLambertMaterial>|undefined;
/** One shared material, with plank layout baked from the original floor GLB. */
export function cityWoodFloorMaterial(){
 return materialPromise??=Promise.all([
  new T.TextureLoader().loadAsync('/textures/city/wood-floor-color.png'),
  new T.TextureLoader().loadAsync('/textures/city/wood-floor-height.png'),
 ]).then(([map,bumpMap])=>{
  for(const texture of [map,bumpMap]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;}
  map.colorSpace=T.SRGBColorSpace;
  const material=CITY_WOOD_MATERIAL.clone();material.name='Madeira padrão: piso com juntas';material.map=map;material.bumpMap=bumpMap;material.bumpScale=.02*.08/.085;return material;
 });
}
/** Same bounds/pivot as the normalized imported template, including solid underside. */
export function createCityWoodFloorGeometry(){
 const geometry=new T.BoxGeometry(1,.085,.998),uv=geometry.attributes.uv;
 // The pattern belongs only on the walking face; slab edges and underside stay plain wood.
 for(let face=0;face<6;face++)if(face!==2)for(let vertex=face*4;vertex<face*4+4;vertex++)uv.setXY(vertex,.05,.95);
 geometry.translate(0,.0425,0);return geometry;
}
export async function createCityWoodFloor(){
 const material=await cityWoodFloorMaterial(),root=new T.Group(),mesh=new T.Mesh(createCityWoodFloorGeometry(),material);
 mesh.castShadow=mesh.receiveShadow=true;root.name='Piso de madeira com textura';root.add(mesh);return root;
}
