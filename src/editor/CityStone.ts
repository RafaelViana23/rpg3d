import { MeshStandardMaterial } from 'three';
import { cityPavingMaterial } from '../world/CityPaving';

// Same texture tint and lighting model as the city paving.
export const CITY_STONE_COLOR='#d4cbb6';

/** Project the floor's brick pattern in world units, including scaled wall assets. */
export function cityMasonryMaterial(color:string,flatShading=false){
 const material=new MeshStandardMaterial({color,flatShading,map:cityPavingMaterial().map,roughness:cityPavingMaterial().roughness,metalness:cityPavingMaterial().metalness});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 cityMasonryPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   #include <project_vertex>
   vec4 masonryPosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    masonryPosition=instanceMatrix*masonryPosition;
   #endif
   cityMasonryPosition=(modelMatrix*masonryPosition).xyz;
  `);
  shader.fragmentShader='varying vec3 cityMasonryPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec3 masonryNormal=normalize(cross(dFdx(cityMasonryPosition),dFdy(cityMasonryPosition)));
    vec3 weights=pow(abs(masonryNormal),vec3(4.0));
    weights/=max(dot(weights,vec3(1.0)),0.0001);
    vec3 p=cityMasonryPosition/12.0;
    vec4 brick=texture2D(map,p.zy)*weights.x
              +texture2D(map,p.xz)*weights.y
              +texture2D(map,p.xy)*weights.z;
    diffuseColor*=brick;
   #endif
  `);
 };
 material.customProgramCacheKey=()=> 'city-masonry-world-bricks-v1';
 return material;
}
// Visible avenue gray includes the paving texture's average tone, not just its pale tint.
export const CITY_AVENUE_GRAY='#64686e';
// Average visible brick color multiplied by the city's paving tint.
export const CITY_MERLON_MATERIAL=new MeshStandardMaterial({color:'#66635a',flatShading:true,roughness:.96});
export const CITY_PLAIN_STONE_MATERIAL=new MeshStandardMaterial({color:CITY_AVENUE_GRAY,flatShading:true,roughness:.96});
export const CITY_STONE_MATERIAL=cityMasonryMaterial(CITY_STONE_COLOR,true);
export const CITY_STONE_LIGHT_MATERIAL=cityMasonryMaterial(CITY_STONE_COLOR,true);
export const CITY_STONE_DARK_MATERIAL=cityMasonryMaterial(CITY_STONE_COLOR,true);
