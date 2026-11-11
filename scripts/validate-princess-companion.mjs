import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {CityResidents}=await server.ssrLoadModule('/src/editor/CityResidents.ts');
 const {Scene,Group,Vector3}=await server.ssrLoadModule('three');
 const scene=new Scene(),buildings=new Map();
 for(const [id,kind]of [...Array.from({length:150},(_,i)=>[`home-${i}`,'house']),['palace','palace']]){
  const g=new Group();g.name=`Cidade:${kind}`;g.userData.building={width:16,depth:16,doorWidth:4};scene.add(g);buildings.set(id,g);
 }
 const residents=new CityResidents(scene,buildings,[]);residents.createActor=()=>{};
 const princess=residents.residents.find(r=>r.citizen.role==='princesa');
 const state={id:princess.citizen.id,mode:'follow',position:[0,0,0]},player=new Vector3(8,0,0);
 residents.setCompanion(state);
 const tick=(collide=()=>{})=>residents.update(.05,player,()=>0,collide,23/24);
 for(let i=0;i<80;i++)tick();
 assert(princess.position.x>5);assert(princess.position.distanceTo(player)>=1.7);
 assert.equal(princess.routine,'companion','Following overrides night and palace routines');
 state.mode='wait';residents.setCompanion(state);const waiting=princess.position.clone();player.x=30;
 for(let i=0;i<30;i++)tick();assert(princess.position.distanceTo(waiting)<.001);
 state.mode='follow';residents.setCompanion(state);residents.setCompanionPaused(true);for(let i=0;i<20;i++)tick();assert(princess.position.distanceTo(waiting)<.001);
 residents.setCompanionPaused(false);for(let i=0;i<120;i++)tick();assert(princess.position.x>25);
 // A follower must route around a wall rather than pass through it.
 state.position=[0,0,0];residents.setCompanion(undefined);residents.setCompanion(state);player.set(8,0,0);
 const wall=p=>{if(p.x>1.5&&p.x<2.5&&Math.abs(p.z)<2.2)p.x=1.5;};
 let crossedWall=false;
 for(let i=0;i<400;i++){tick(wall);if(princess.position.x>1.51&&princess.position.x<2.49&&Math.abs(princess.position.z)<2)crossedWall=true;}
 assert(!crossedWall);assert(princess.position.x>5,'Follower gets around the wall');
 const saved=JSON.parse(JSON.stringify(state));assert.equal(saved.id,princess.citizen.id);assert(saved.position[0]>5);
 // Regression: a companion on the raised palace floor must not fall to city ground.
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const palaceScene=new Scene(),builder=new LowPolyCityBuilder(palaceScene,()=>18),palace=createRoyalPalace(0);
 palace.position.y=18;builder.root.add(palace);builder.objects.set('palace',palace);
 for(const [id,b]of buildings)if(b.name==='Cidade:house'){palaceScene.add(b);builder.objects.set(id,b);}
 palace.updateMatrixWorld(true);
 const royalResidents=new CityResidents(palaceScene,builder.objects,[]);royalResidents.createActor=()=>{};
 const alice=royalResidents.residents.find(r=>r.citizen.role==='princesa');
 const start=palace.localToWorld(new Vector3(...palace.userData.npcRoyalDaughterPosition));
 const traveler=start.clone().add(new Vector3(0,0,10));
 royalResidents.setCompanion({id:alice.citizen.id,mode:'follow',position:start.toArray()});
 let lowest=Infinity;
 for(let i=0;i<220;i++){
  royalResidents.update(.05,traveler,(x,z,feetY=0)=>Math.max(18,builder.walkHeightAt(x,z,feetY)??-Infinity),(p,r)=>builder.resolveCollisions(p,r),.5);
  lowest=Math.min(lowest,alice.position.y);
 }
 assert(lowest>18+5,'Alice remains on the raised palace floor');
 assert(alice.position.distanceTo(traveler)<4,'Alice leaves her royal position and approaches the player');
 // Follow the player's turns out of the furnished sitting room, along the gallery and down both stairs.
 const layout=palace.userData.princessPalace,room=palace.userData.royalSittingRoom;
 const roomDoor=palace.userData.royalRoomDoors.find(d=>d.label==='Sala de estar real');
 const route=[
  [40,room.y,room.z+3],[32,room.y,room.z+3],[32,room.y,roomDoor.z],[24.1,room.y,roomDoor.z],
  layout.nodes.gallery,layout.nodes.galleryBack,layout.nodes.stairTop,layout.nodes.stairBottom,
  layout.nodes.branch,layout.nodes.landing,layout.nodes.daisFront,layout.nodes.mainTop,layout.nodes.mainBottom,
 ];
 const toWorld=p=>palace.localToWorld(new Vector3(...p));
 traveler.copy(toWorld(route[0]));
 royalResidents.setCompanion(undefined);royalResidents.setCompanion({id:alice.citizen.id,mode:'follow',position:traveler.toArray()});
 const royalTick=()=>royalResidents.update(.05,traveler,(x,z,feet=0)=>Math.max(18,builder.walkHeightAt(x,z,feet)??-Infinity),(p,r)=>builder.resolveCollisions(p,r),.5);
 const roundTrip=[...route,...route.slice(0,-1).reverse()];
 for(let k=1;k<roundTrip.length;k++){
  const target=toWorld(roundTrip[k]),start=traveler.clone(),steps=Math.ceil(start.distanceTo(target)/.1);
  for(let i=1;i<=steps;i++){traveler.copy(start).lerp(target,i/steps);royalTick();}
  for(let i=0;i<250;i++)royalTick();
  assert(alice.position.distanceTo(traveler)<2.2,`Gallery/stair stop ${k}: ${alice.position.toArray()} must approach ${traveler.toArray()}`);
 }
 console.log('Alice contorna paredes e móveis, atravessa a porta da sala, percorre a galeria e sobe e desce os dois lances de escada sem cair do piso.');

}finally{await server.close();}
