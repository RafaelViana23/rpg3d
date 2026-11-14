import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const {createCityAsset}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {cityWallGateTorchSites}=await server.ssrLoadModule('/src/editor/CityProps.ts');
 const {streetLanternSites}=await server.ssrLoadModule('/src/editor/CityStreetLanterns.ts');
 const {addCityFirelight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const {city}=JSON.parse(await readFile('src/editor/default-city.json','utf8')),saved=city['city-royal-avenue-v1'];
 const scene=new T.Scene(),road=createRoyalAvenue(saved);road.position.fromArray(saved.position);road.rotation.set(...saved.rotation);scene.add(road);
 const gates=Object.values(city).filter(o=>o.kind==='gate').map(o=>{
  const gate=createCityAsset('gate');gate.position.fromArray(o.position);gate.rotation.set(...o.rotation);gate.scale.fromArray(o.scale);scene.add(gate);gate.userData.wallGateFloorY=(18-o.position[1])/o.scale[1];return gate;
 });
 scene.updateMatrixWorld(true);const before=gates.map(g=>g.matrix.clone());const sites=streetLanternSites([road,...gates]);
 assert.equal(sites.length,34,'Remove only the three gateway pairs (6 posts)');
 for(const gate of gates){
  assert(sites.every(s=>s.point.distanceTo(gate.getWorldPosition(new T.Vector3()))>=20),'No post remains immediately before a gate');
  const positions=cityWallGateTorchSites(gate);assert.equal(positions.length,2);assert.equal(positions[0].x,-positions[1].x);
  for(const pos of positions){
   assert(Math.abs(pos.x)>3.1&&Math.abs(pos.x)<7,'Torch attaches to solid masonry outside the arch');
   const world=gate.localToWorld(pos.clone());assert(Math.abs(world.y-20.7)<1e-5,'Mount 2.7 metres above city paving');
   const root=new T.Group(),fire=new T.Bone();fire.name='fire_12';root.add(fire);root.position.copy(pos);root.userData.fixedExteriorTorch=true;gate.add(root);addCityFirelight(root,true,{intensity:95,distance:20,persistent:true});
  }
 }
 scene.updateMatrixWorld(true);updateCityFirelights(1,new T.Vector3(1000,0,1000),0,3);
 let active=0;scene.traverseVisible(o=>{if(o.isPointLight)active++;});assert.equal(active,0,'Gateway torches use only fixed illumination');
 gates.forEach((gate,i)=>assert(gate.matrix.equals(before[i]),'Saved gate transforms stay untouched'));
 console.log('6 postes diante dos portões removidos; 6 tochas simétricas na alvenaria, sem emissores dinâmicos nem alteração dos transforms.');
}finally{await server.close();}
