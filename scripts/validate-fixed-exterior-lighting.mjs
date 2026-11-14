import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {cityPointIsIndoors}=await server.ssrLoadModule('/src/editor/CityLightInteriors.ts');
 const {preparePalaceFirelights,addCityFirelight,addStreetLanternLight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const {waitForCityLightSlot,updateCityPropLoading}=await server.ssrLoadModule('/src/editor/CityPropLoading.ts');
 const {registerChurchDoor,toggleChurchDoor,updateChurchDoors}=await server.ssrLoadModule('/src/editor/ChurchDoors.ts');
 const scene=new T.Scene(),palace=createRoyalPalace();scene.add(palace);preparePalaceFirelights(palace,palace.userData.palaceLightPlacements);
 const exterior=[];
 for(const p of palace.userData.palaceLightPlacements){
  if(p.pack!=='wall-torch'||cityPointIsIndoors(palace,new T.Vector3(p.x,p.y,p.z)))continue;
  const root=new T.Group(),fire=new T.Bone();fire.name='fire_12';root.add(fire);root.position.set(p.x,p.y,p.z);root.userData.palaceExteriorTorch=true;palace.add(root);
  addCityFirelight(root,true,{persistent:true,intensity:p.intensity,distance:p.distance});exterior.push(root);
 }
 assert.equal(exterior.length,12);
 const street=new T.Group();street.position.set(80,0,0);scene.add(street);addStreetLanternLight(street);
 const house=new T.Group();house.position.set(120,0,0);house.userData.building={enterable:true,width:12,depth:12,height:8,doorWidth:2,doorHeight:3};house.userData.localColliders=[];scene.add(house);
 const door=new T.Group();door.animations=[new T.AnimationClip('open',1,[new T.NumberKeyframeTrack('.rotation[y]',[0,1],[0,-1.5])])];house.add(door);registerChurchDoor(house,door);
 const interior=new T.Group(),fire=new T.Bone();fire.name='fire_12';interior.add(fire);interior.position.y=2;house.add(interior);addCityFirelight(interior,true,{intensity:90,distance:20});
 const point=new T.Vector3(120,0,8),inside=new T.Vector3(120,1,0);
 const step=viewer=>{scene.updateMatrixWorld(true);updateChurchDoors(1);updateCityFirelights(1,viewer,0,3);};
 const active=()=>{const lights=[];scene.traverseVisible(o=>{if(o.isPointLight)lights.push(o);});return lights;};
 let loaded=false;void waitForCityLightSlot(house,new T.Vector3(0,2,0)).then(()=>{loaded=true;});
 updateCityPropLoading(point);await Promise.resolve();assert(!loaded,'Closed room fixtures must remain unloaded');
 step(point);assert.equal(active().length,0,'Exterior uses no dynamic PointLights, including zero-intensity slots');
 assert(exterior.every(root=>root.getObjectByName('fire_12').scale.x===1));
 const mesh=palace.children.find(o=>o.isMesh&&o.material.userData.cityStreetMap);
 assert(mesh,'Palace surfaces receive the shared baked map');
 const shader={uniforms:{},vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <opaque_fragment>'};mesh.material.onBeforeCompile(shader,{});
 assert.equal(shader.uniforms.cityStreetNight.value,1);
 const pixels=shader.uniforms.cityStreetMap.value.image.data;assert(pixels.some((v,i)=>i%4===0&&v>0),'Fixed torch lighting is baked');
 assert(toggleChurchDoor(point));updateCityPropLoading(point);await Promise.resolve();assert(loaded,'Opening nearby door releases fixture load');
 step(point);assert(active().length<=3&&active().length>0,'Open interior uses bounded lights');
 step(inside);assert.equal(shader.uniforms.cityStreetNight.value,0,'All outside baked illumination switches off indoors');
 assert(exterior.every(root=>root.getObjectByName('fire_12').scale.length()===0),'Exterior flame skins switch off indoors');
 assert(active().every(o=>o.name==='Emissor compartilhado da cidade'));
 step(new T.Vector3(1000,0,1000));assert.equal(active().length,0);assert.equal(shader.uniforms.cityStreetNight.value,1);
 assert(exterior.every(root=>root.getObjectByName('fire_12').scale.x===1),'Fixed exterior torches return, including at distance');
 console.log('12 tochas fixas + postes sem luzes dinâmicas; carga por porta; interior exclusivo; exterior desliga dentro e retorna ao sair.');
}finally{await server.close();}
