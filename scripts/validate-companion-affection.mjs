import assert from 'node:assert/strict';
import {createServer} from 'vite';
const s=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CompanionKiss}=await s.ssrLoadModule('/src/editor/CompanionKiss.ts');
 const {CityResidents}=await s.ssrLoadModule('/src/editor/CityResidents.ts');
 const {createRoyalPalace}=await s.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {medievalStreetPlan}=await s.ssrLoadModule('/src/editor/MedievalCityLayout.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await s.ssrLoadModule('/src/character.ts');
 const {LowPolyCityBuilder}=await s.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const T=await s.ssrLoadModule('three');
 const player=new ProceduralCharacter(DEFAULT_CONFIG),alice=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});
 player.setClothing('shirt',true);alice.setClothing('shirt',true);alice.group.position.set(0,0,2);
 const position=alice.group.position.clone(),kiss=new CompanionKiss();assert(kiss.start(player,alice,position));
 let maxTilt=0;
 for(let i=0;i<200&&kiss.active;i++){const before=position.clone();kiss.update(.05,()=>0,()=>{});maxTilt=Math.max(maxTilt,Math.abs(alice.group.getObjectByName('Head').rotation.z));assert(position.distanceTo(before)<.08);}
 assert(!kiss.active);assert(maxTilt>.1);assert(Math.abs(player.group.position.distanceTo(alice.group.position)-.52)<.04);
 assert(Math.abs(alice.group.getObjectByName('Head').rotation.z)<.001);
 const scene=new T.Scene(),buildings=new Map(),palace=createRoyalPalace();palace.position.y=18;
 for(const [i,p] of medievalStreetPlan().entries()){const b=p.kind==='palace'?palace:new T.Group();b.name='Cidade:'+p.kind;b.userData.building??={width:16,depth:16,doorWidth:4};scene.add(b);buildings.set('b'+i,b);}
 const residents=new CityResidents(scene,buildings,[]),princess=residents.residents.find(r=>r.citizen.role==='princesa');
 residents.residents.splice(0,residents.residents.length,princess);princess.actor=alice;scene.add(alice.group);
 const layout=palace.userData.princessPalace;palace.updateMatrixWorld(true);
 princess.position.copy(palace.localToWorld(new T.Vector3(...layout.nodes.room)));
 residents.setCompanion({id:princess.citizen.id,mode:'follow',position:princess.position.toArray()});residents.setCompanionBed(palace);
 const builder=new LowPolyCityBuilder(scene,()=>18);builder.objects.set('palace',palace);
 const height=(x,z,y=0)=>Math.max(18,builder.walkHeightAt(x,z,y)??-Infinity);
 for(let i=0;i<1600;i++)residents.update(.05,new T.Vector3(10000,18,10000),height,(p,r)=>builder.resolveCollisions(p,r),12/24);
 assert.equal(princess.routine,'sleep','Companion lies beside player even during the day');
 assert(Math.abs(new T.Vector3(0,1,0).applyQuaternion(alice.group.quaternion).y)<.01);
 const outfit=new Map();alice.group.traverse(o=>outfit.set(o,o.visible));
 assert(residents.setPrincessRestUndressed(true),'F works while Alice rests as companion');
 assert.equal(alice.group.getObjectByName('equipment.underwear').visible,false);
 residents.update(.05,new T.Vector3(10000,18,10000),height,(p,r)=>builder.resolveCollisions(p,r),12/24);
 assert.equal(princess.routine,'sleep');
 assert(Math.abs(new T.Vector3(0,1,0).applyQuaternion(alice.group.quaternion).y)<.01,'Changing outfits keeps Alice lying down');
 assert(residents.setPrincessRestUndressed(false));
 for(const [object,visible] of outfit)assert.equal(object.visible,visible,object.name);
 assert(residents.setPrincessRestUndressed(true));
 residents.setCompanionBed(null);residents.setCompanionPaused(true);residents.update(.05,new T.Vector3(10000,18,10000),height,(p,r)=>builder.resolveCollisions(p,r),12/24);
 for(const [object,visible] of outfit)assert.equal(object.visible,visible,'Standing restores '+object.name);
 assert.equal(princess.routine,'companion');assert(new T.Vector3(0,1,0).applyQuaternion(alice.group.quaternion).y>.99);
 console.log('Beijo breve com aproximação contínua e pose restaurada; Alice acompanha o repouso na cama e levanta junto.');
}finally{await s.close();}
