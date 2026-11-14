import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {addCityFirelight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const scene=new T.Scene(),houses=[];
 for(let h=0;h<2;h++){
  const house=new T.Group();house.position.x=h*100;house.userData.building={width:44,depth:24,height:15,enterable:true};scene.add(house);houses.push(house);
  for(let i=0;i<18;i++){const fixture=new T.Group(),fire=new T.Group();fire.name='fire_2';fixture.add(fire);fixture.userData.alwaysLit=true;fixture.position.set((i%6-3)*5,1+Math.floor(i/6)*5,0);house.add(fixture);addCityFirelight(fixture,false);}
 }
 const outdoor=new T.Group();outdoor.userData.fixedExteriorTorch=true;scene.add(outdoor);addCityFirelight(outdoor,true);
 const visible=house=>{let n=0;house.traverse(o=>{if(o.isPointLight&&o.visible)n++;});return n;};
 scene.updateMatrixWorld(true);updateCityFirelights(.1,new T.Vector3(0,1,0),0,0);
 assert.equal(visible(houses[0]),18,'All 18 interior lights work even with old budget parameter zero');
 const fixedLights=[];houses[0].traverse(o=>{if(o.isPointLight)fixedLights.push({light:o,intensity:o.intensity,position:o.position.clone()});});
 for(const delta of [.016,.13,.5,1])updateCityFirelights(delta,new T.Vector3(0,1,0),0,0);
 for(const {light,intensity,position} of fixedLights){assert.equal(light.intensity,intensity,'Candle intensity stays fixed over time');assert(light.position.equals(position),'Emitter position stays fixed');}
 assert.equal(visible(houses[1]),0,'Other interiors stay off');assert.equal(visible(outdoor),0,'Exterior off indoors');
 scene.updateMatrixWorld(true);updateCityFirelights(.1,new T.Vector3(100,1,0),0,1);
 assert.equal(visible(houses[1]),18);assert.equal(visible(houses[0]),0);
 updateCityFirelights(.1,new T.Vector3(300,1,300),0,0);assert.equal(visible(outdoor),1,'Exterior direct light restored');
 scene.traverse(o=>{if(o.isPointLight)assert(!o.castShadow,'Direct lights do not render shadow maps');});
 assert(!scene.children.some(o=>o.name==='Emissor compartilhado da cidade'),'No shared pool');
 console.log('Direct lights: all 18 active fixtures, no shared limit, interior/exterior switching, other interiors off and no dynamic shadows.');
}finally{await server.close();}
