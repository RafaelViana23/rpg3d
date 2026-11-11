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
 const {createRoyalStyleBed}=await server.ssrLoadModule('/src/editor/RoyalStyleBed.ts');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 const {cityBedAnchor}=await server.ssrLoadModule('/src/editor/CitySleeping.ts');
 const bed=createRoyalStyleBed(),size=new Box3().setFromObject(bed).getSize(new Vector3());
 assert.equal(cityBedAnchor(bed,size).mattressY,1.18);
 assert(bed.children.some(m=>m.material===CITY_WOOD_MATERIAL));
 assert(bed.children.some(m=>m.material.color.getHexString()==='527246'));
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const palace=createRoyalPalace(),builder=new LowPolyCityBuilder(new Scene(),()=>0);builder.root.add(palace);builder.objects.set('palace',palace);builder.prepareWeatherCover();
 const lights=palace.userData.palaceLightPlacements;
 assert(lights.filter(p=>p.pack==='candle').length>=4);assert(lights.filter(p=>p.pack==='wall-torch').length>=12);
 for(const room of palace.userData.royalBedrooms){
  const world=palace.localToWorld(new Vector3(room.x,room.y+2,room.z));
  assert(builder.roofHeightAt(world.x,world.z)>world.y,'Every royal bedroom has weather cover');
  assert(lights.some(p=>p.pack==='candle'&&Math.abs(p.x-room.x)<room.width/2&&Math.abs(p.z-room.z)<room.depth/2));
 }
 const mainChandelier=palace.getObjectByName('Lustre central monumental do palácio');assert(mainChandelier);
 const mainData=mainChandelier.userData.royalHallChandelier,extension=palace.userData.palaceExtension;
 assert.equal(mainData.x,0);assert(Math.abs(mainData.z-(extension.back+extension.front)/2)<.001);
 assert.equal(lights.filter(p=>p.group==='palace-main-chandelier').length,24);
 assert(mainData.radius>=6&&mainData.bottom>palace.userData.royalInterior.galleryLevel-palace.userData.palaceFloorElevation+6.08);
 const chandelier=lights.filter(p=>p.group==='alice-chandelier');assert.equal(chandelier.length,6);
 assert(chandelier.every(p=>p.intensity===150&&p.distance>=40&&p.emitterOffset));
 const {addCityFirelight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const fireScene=new Scene(),fixture=new Group();fireScene.add(fixture);
 for(const p of chandelier){
  const candle=new Group();candle.userData.alwaysLit=true;candle.userData.firePriority=true;candle.userData.fireGroup='test-chandelier';
  candle.add(new Mesh(new BoxGeometry(.1,.2,.1),new MeshBasicMaterial({color:'#fff0b0'})));fixture.add(candle);
  addCityFirelight(candle,false,{intensity:p.intensity,distance:p.distance});
 }
 fireScene.updateMatrixWorld(true);updateCityFirelights(.05,new Vector3(),1,4,.5);
 const active=fireScene.children.filter(o=>o.isPointLight&&o.visible&&o.intensity>0);
 assert.equal(active.length,1,'Six lit candles share one room emitter');assert(active[0].intensity>130);assert.equal(active[0].distance,42);
 assert(fixture.children.every(c=>c.visible&&c.children[0].visible),'Every visible candle stays lit with a bounded emitter budget');
 const torches=[];
 for(let i=0;i<12;i++){
  const torch=new Group();torch.position.x=100+i*10;torch.userData.alwaysLit=true;
  torch.add(new Mesh(new BoxGeometry(.1,.2,.1),new MeshBasicMaterial()));fixture.add(torch);
  addCityFirelight(torch,true,{intensity:150,distance:42,persistent:true});torches.push(torch);
 }
 fireScene.updateMatrixWorld(true);
 for(const viewer of [new Vector3(),new Vector3(400,0,0),new Vector3(-400,0,0)]){
  updateCityFirelights(.05,viewer,0,1,.5);
  assert(torches.every(t=>{const l=t.getObjectByName('Luz da tocha');return l.visible&&l.intensity>130;}),'All twelve palace torches remain lit simultaneously with a one-emitter nearby budget, regardless of player position');
 }
 console.log('Chuva e neve bloqueadas após movimento/respawn; cama de manta verde e colchão, tochas e velas nos quatro quartos reais validados.');
}finally{await server.close();}
