import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CityResidents}=await server.ssrLoadModule('/src/editor/CityResidents.ts');
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {palaceStaffLayout,palaceStaffActivity}=await server.ssrLoadModule('/src/editor/PalaceStaffRoutine.ts');
 const {princessActivity}=await server.ssrLoadModule('/src/editor/PrincessPalaceRoutine.ts');
 const {Scene,Group,Vector3}=await server.ssrLoadModule('three');
 const scene=new Scene(),palace=createRoyalPalace();scene.add(palace);const buildings=new Map([['palace',palace]]);
 for(let i=0;i<150;i++){const house=new Group();house.name='Cidade:house';house.position.set(300+i*20,0,300);house.userData.building={width:12,depth:16,doorWidth:3};scene.add(house);buildings.set(`house-${i}`,house);}
 const residents=new CityResidents(scene,buildings,[]),far=new Vector3(10000,0,10000);
 const update=(time,player=far,dt=0)=>residents.update(dt,player,(_x,_z,y=0)=>y,()=>{},time);
 // Loading a saved noon must not start workers outside their distant houses.
 update(.5);
 const staff=residents.residents.filter(r=>['cozinheiro-real','empregada-real'].includes(r.citizen.role));
 for(const hour of [12,0,23,10,14,8,12]){
  residents.synchronizeTime();update(hour/24);
  for(const r of staff){
   if(hour>=8&&hour<22){
    const {target}=palaceStaffActivity(hour/24,r.citizen),position=palace.localToWorld(new Vector3(...palaceStaffLayout(palace).nodes[target]));
    assert(r.atWork);assert(r.position.distanceTo(position)<.01,`${r.citizen.role} must appear at the ${hour}h task`);
   }else{assert(!r.atWork);assert(r.position.distanceTo(r.home.position)<20,'Off-duty staff appears at home');}
  }
  const princess=residents.residents.find(r=>r.citizen.role==='princesa');
  const target=palace.localToWorld(new Vector3(...palace.userData.princessPalace.nodes[princessActivity(hour/24).target]));
  assert(princess.position.distanceTo(target)<.01,'Princess follows edited clock');
 }
 // Exercise mesh scheduling without requiring the browser renderer or DOM.
 const spawned=[];residents.createActor=(r)=>{spawned.push(r.citizen.id);r.actor={group:new Group(),setAnimation(){},update(){}};scene.add(r.actor.group);};
 const kitchen=palace.userData.royalKitchen,player=palace.localToWorld(new Vector3(kitchen.x,kitchen.y,kitchen.z));
 for(let i=0;i<30;i++)update(.5,player,.16);
 assert(staff.filter(r=>r.citizen.role==='cozinheiro-real').every(r=>r.actor),'All three nearby cook meshes are scheduled after editing the time');
 console.log('Initial noon, edits across midnight, work/home relocation, maid tasks, princess destinations and all three cook mesh spawns validated.');
}finally{await server.close();}
