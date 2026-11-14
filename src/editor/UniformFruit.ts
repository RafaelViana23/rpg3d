import * as T from 'three';
/** Collapse the atlas's alternate fruit shades, preserving the leaf/stem regions. */
export function applyUniformFruit(root:T.Object3D,pack:'apple'|'grapes'){
 root.traverse(object=>{
  const mesh=object as T.Mesh;if(!mesh.isMesh)return;
  const paint=(source:T.Material)=>{
   const m=source.clone();const previous=m.onBeforeCompile;
   m.onBeforeCompile=(shader,renderer)=>{
    previous.call(m,shader,renderer);
    shader.uniforms.fruitColor={value:new T.Color(pack==='apple'?'#bb3932':'#783b99')};
    shader.fragmentShader='uniform vec3 fruitColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 fruitSample=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2));
      bool isFruit=${pack==='apple'?'fruitSample.r>fruitSample.g*1.35 && fruitSample.r>fruitSample.b*1.35 && fruitSample.b>fruitSample.g*.5':'fruitSample.b>fruitSample.g*1.2'};
      if(isFruit)diffuseColor.rgb=fruitColor;`);
   };
   m.customProgramCacheKey=()=>`uniform-fruit-${pack}-v1`;return m;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(paint):paint(mesh.material);
 });
}
