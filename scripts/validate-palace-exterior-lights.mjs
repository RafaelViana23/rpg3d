import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {cityPointIsIndoors}=await server.ssrLoadModule('/src/editor/CityLightInteriors.ts');
 const {preparePalaceFirelights,palaceFirelightEmitter,addCityFirelight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const palace=createRoyalPalace(),scene=new T.Scene();scene.add(palace);
 const placements=palace.userData.palaceLightPlacements;
 preparePalaceFirelights(palace,placements);
 const lights=[];
 for(const [index,p] of placements.entries()){
  const position=new T.Vector3(p.x,p.y,p.z);
  if(p.pack!=='wall-torch'||cityPointIsIndoors(palace,position))continue;
  const root=new T.Group(),bone=new T.Bone();bone.name='fire_12';root.add(bone);root.position.copy(position);root.rotation.y=p.rotation;
  root.userData.palaceExteriorTorch=true;palace.add(root);
  const emitter=palaceFirelightEmitter(palace,index,p.group);
  addCityFirelight(root,true,{persistent:p.persistent,intensity:p.intensity,distance:p.distance,emitter});
  lights.push({root,emitter});
 }
 assert.equal(lights.length,12,'Test all twelve actual palace exterior placements');
 const gateLights=placements.filter(p=>p.pack==='wall-torch'&&p.z===57.35);
 assert.equal(gateLights.length,2);assert.deepEqual(gateLights.map(p=>p.x),[-12,12]);
 palace.updateMatrixWorld(true);
 for(const p of gateLights){
  const hit=new T.Raycaster(new T.Vector3(p.x,p.y,p.z),new T.Vector3(0,0,-1),0,1).intersectObject(palace,true)[0];
  assert(hit&&Math.abs(hit.distance-.35)<1e-6,'Each new gate torch is mounted just in front of solid gateway masonry');
 }
 for(const viewer of [new T.Vector3(),new T.Vector3(0,10,22),new T.Vector3(0,10,-20),new T.Vector3(1000,0,1000)]){
  scene.updateMatrixWorld(true);updateCityFirelights(.05,viewer,0,0,.9);
  for(const {root,emitter} of lights){
   assert(root.visible);assert.equal(root.getObjectByName('fire_12').scale.x,cityPointIsIndoors(palace,viewer)?0:1);
   assert.equal(emitter,undefined,'Fixed exterior lighting requires no live emitter');
   assert(!root.getObjectByName('Luz da tocha').visible);
  }
  const active=[];scene.traverse(o=>{if(o.isPointLight&&o.visible&&o.intensity>0)active.push(o);});
  assert.equal(active.length,0,'Exterior torches use only fixed lighting');
 }
 console.log('Doze tochas externas no mapa fixo, sem emissores dinâmicos; apagadas no interior.');
}finally{await server.close();}
