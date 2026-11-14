import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {Scene,Vector3,Box3,Group,Mesh,BoxGeometry,MeshBasicMaterial}=await server.ssrLoadModule('three');
 const {WeatherSystem}=await server.ssrLoadModule('/src/world/WeatherSystem.ts');
 const weather=new WeatherSystem(new Scene());
 for(const type of ['rain','snow']){
  weather.setWeather(type);
  for(const center of [new Vector3(0,45,0),new Vector3(80,48,60),new Vector3(-90,40,-70)]){
   weather.update(.05,center,()=>1000);
   const values=type==='rain'?weather.rainPositions:weather.snowPositions;
   for(let i=1;i<values.length;i+=3)assert(center.y+values[i]>1000,`${type} stays above the roof after movement and respawn`);
  }
 }
 // Repeated impacts must never accumulate into a horizontal strip on a roof.
 for(const type of ['rain','snow']){
  weather.setWeather(type);
  const values=type==='rain'?weather.rainPositions:weather.snowPositions;
  values.fill(0);weather.positioned=false;weather.update(.05,new Vector3(),()=>1000);
  const heights=[];
  for(let i=1;i<values.length;i+=type==='rain'?6:3)heights.push(values[i]);
  assert(Math.max(...heights)-Math.min(...heights)>8,`${type}: roof impacts are distributed vertically`);
 }
 const {createMedievalBuilding}=await server.ssrLoadModule('/src/editor/MedievalBuildings.ts');
 const {LowPolyCityBuilder:RoofBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 for(const kind of ['house','inn']){
  const scene=new Scene(),builder=new RoofBuilder(scene,()=>0),building=createMedievalBuilding(kind);
  builder.root.add(building);builder.objects.set(kind,building);builder.prepareWeatherCover();
  const pitch=building.userData.weatherPitch;
  assert(Math.abs(builder.roofHeightAt(0,0)-(pitch.eaves+pitch.rise+.2))<1e-6);
  const x=pitch.axis==='x'?pitch.halfWidth*.8:0,z=pitch.axis==='z'?pitch.halfWidth*.8:0;
  assert(builder.roofHeightAt(x,z)<builder.roofHeightAt(0,0),'Cover follows roof slope');
 }
 console.log('Chuva e neve sem faixas acumuladas; cobertura acompanha a inclinação de casas e pousadas.');
}finally{await server.close();}
