import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {addCityFirelight,addStreetLanternLight,updateCityFirelights,preparePalaceFirelights,palaceFirelightEmitter}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const {registerChurchDoor,toggleChurchDoor,updateChurchDoors}=await server.ssrLoadModule('/src/editor/ChurchDoors.ts');
 const {cityPointIsIndoors}=await server.ssrLoadModule('/src/editor/CityLightInteriors.ts');
 const scene=new T.Scene(),houses=[],fires=[];
 for(let i=0;i<2;i++){
  const house=new T.Group();house.position.x=i*40;house.userData.building={width:12,depth:12,height:8,enterable:true,doorWidth:2,doorHeight:3};house.userData.localColliders=[];scene.add(house);houses.push(house);
  const door=new T.Group();door.animations=[new T.AnimationClip('open',1,[new T.NumberKeyframeTrack('.rotation[y]',[0,1],[0,-1.5])])];house.add(door);registerChurchDoor(house,door);
  const placements=Array.from({length:12},()=>({pack:'wall-torch',persistent:true}));preparePalaceFirelights(house,placements);
  const roots=[];
  for(let n=0;n<12;n++){
   const root=new T.Group(),bone=new T.Bone();bone.name='fire_12';root.add(bone);root.position.set((n%3)-1,2,0);house.add(root);root.userData.alwaysLit=true;
   addCityFirelight(root,true,{persistent:true,intensity:90,distance:20,emitter:palaceFirelightEmitter(house,n)});roots.push(root);
  }
  fires.push(roots);
 }
 const street=new T.Group();scene.add(street);const outdoor=new T.Group();outdoor.position.set(0,2,8);street.add(outdoor);addStreetLanternLight(outdoor);
 const step=(viewer)=>{scene.updateMatrixWorld(true);updateChurchDoors(.3);updateCityFirelights(.3,viewer,0,3,.9);};
 const active=()=>{const lights=[];scene.traverse(o=>{if(o.isPointLight&&o.visible&&o.intensity>0)lights.push(o);});return lights;};
 const outside=new T.Vector3(0,0,8),inside=new T.Vector3(0,0,0);
 step(outside);
 assert.equal(active().length,0,'Closed interiors add no dynamic emitters; street illumination uses the shared map');
 assert(fires.flat().every(r=>r.getObjectByName('fire_12').scale.length()===0),'Closed interior flame skins are extinguished');
 assert(toggleChurchDoor(outside));step(outside);
 assert(fires[0].every(r=>r.getObjectByName('fire_12').scale.x===1),'Opening the entrance immediately ignites its interior');
 assert(fires[1].every(r=>r.getObjectByName('fire_12').scale.x===0),'Other buildings stay dark');
 assert(active().filter(l=>l.name==='Emissor compartilhado da cidade').length<=3,'Interior lights obey their shared budget');
 step(inside);
 assert.equal(active().length,3);assert(active().filter(l=>l.name==='Emissor compartilhado da cidade').every(l=>l.color.getHex()===0xffad55),'Interior shared emitters only select interior torches');
 assert(!outdoor.getObjectByName('Luz da lanterna da rua').visible,'Street map does not add dynamic lights indoors');
 assert(toggleChurchDoor(new T.Vector3(0,0,5)));step(inside);
 assert(fires[0].every(r=>r.getObjectByName('fire_12').scale.x===1),'Closing the door does not turn off an occupied interior');
 step(outside);step(outside);step(outside);step(outside);
 assert(fires[0].every(r=>r.getObjectByName('fire_12').scale.x===0),'Leaving the closed building extinguishes its interior');
 assert(active().every(l=>l.color.getHex()===0xffbf78),'Outdoor lanterns return after leaving');
 toggleChurchDoor(outside);step(outside);step(new T.Vector3(100,0,100));
 assert(fires[0].every(r=>r.getObjectByName('fire_12').scale.x===0),'An open door left behind does not keep distant interiors active');
 for(const time of [.1,.5,.9])for(const viewer of [new T.Vector3(),new T.Vector3(1000,0,1000)]){
  scene.updateMatrixWorld(true);updateCityFirelights(.1,viewer,0,0,time);
  const light=outdoor.getObjectByName('Luz da lanterna da rua');
  assert(!light.visible&&!light.castShadow,'Continuous street map does not add dynamic lights at any viewer distance');
 }
 houses[0].rotation.y=Math.PI/2;houses[0].scale.set(2,2,2);houses[0].position.set(30,10,20);scene.updateMatrixWorld(true);
 step(houses[0].localToWorld(new T.Vector3(0,1,0)));
 assert(fires[0].every(r=>r.getObjectByName('fire_12').scale.x===1),'Interior detection respects saved rotations, scale and elevation');
 const palace=new T.Group();palace.userData.building={enterable:true,height:40};palace.userData.palaceComplex=true;palace.userData.weatherRoofs=[[-10,20,-10,10,20,10]];
 assert(cityPointIsIndoors(palace,new T.Vector3(0,5,0)));assert(!cityPointIsIndoors(palace,new T.Vector3(0,5,20)),'Palace courtyards remain outdoors');
 const facade=new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshLambertMaterial());facade.userData.palaceComplexMesh=true;palace.add(facade);
 scene.add(palace);palace.position.set(200,0,0);
 const outer=new T.Group(),outerFire=new T.Bone();outerFire.name='fire_12';outer.add(outerFire);outer.position.set(0,5,20);outer.userData.palaceExteriorTorch=true;palace.add(outer);
 addCityFirelight(outer,true,{persistent:true,intensity:90,distance:30});
 for(const viewer of [new T.Vector3(200,0,22),new T.Vector3(200,5,0),houses[0].localToWorld(new T.Vector3(0,1,0)),new T.Vector3(-1000,0,0)]){
  step(viewer);
  const indoors=cityPointIsIndoors(palace,palace.worldToLocal(viewer.clone()))||cityPointIsIndoors(houses[0],houses[0].worldToLocal(viewer.clone()));
  assert.equal(outerFire.scale.x,indoors?0:1,'Exterior flames switch off indoors and return outdoors');
  assert(!outer.getObjectByName('Luz da tocha').visible,'Exterior light is baked, with no live PointLight');
  assert(!outer.getObjectByName('Luz da tocha').castShadow,'Permanent exterior light never renders shadow maps');
  outer.visible=false;outer.userData.cityDistanceHidden=true;step(viewer);
  assert(outer.visible&&!outer.userData.cityDistanceHidden,'Exterior palace torches are exempt from distance culling');
  assert(active().filter(l=>l.name==='Emissor compartilhado da cidade').length<=3,'Interior lights retain their shared emitter budget');
 }
 console.log('Portas, entrada/saída, lanternas externas, limite de três emissores e interiores transformados validados.');
}finally{await server.close();}
