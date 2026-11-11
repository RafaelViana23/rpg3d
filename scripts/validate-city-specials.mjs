import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CityResidents}=await server.ssrLoadModule('/src/editor/CityResidents.ts');
 const {Scene,Group,Vector3}=await server.ssrLoadModule('three');
 const scene=new Scene(),buildings=new Map();
 const add=(id,kind,x=0,z=0)=>{const b=new Group();b.name=`Cidade:${kind}`;b.position.set(x,0,z);b.userData.building={width:16,depth:16,doorWidth:4};scene.add(b);buildings.set(id,b);return b;};
 for(let i=0;i<150;i++)add(`house-${i}`,'house',i*20,50);
 for(const kind of ['palace','church','guild','weapons','potions','tavern','inn','shop']){const b=add(kind,kind,0,-40);b.userData.npcCounter={x:0,y:.08,z:-5};}
 buildings.get('church').userData.npcAltar={z:-6.2};
 for(let i=0;i<8;i++){add(`tower-${i}`,'tower');add(`wall-${i}`,'wall').userData.walkSurfaces=[[-6,-1,6,1,6.225]];}
 const residents=new CityResidents(scene,buildings,[]);residents.spawnElapsed=-Infinity;
 const tick=hour=>residents.update(.01,new Vector3(10000,0,10000),()=>0,()=>{},hour/24);
 tick(8);
 for(const role of ['armeiro','alquimista','taverneira','estalajadeira','lojista']){
  const r=residents.residents.find(r=>r.citizen.role===role);assert(r);assert.equal(r.home,buildings.get(r.citizen.workId));assert(r.atWork);assert.equal(r.position.z,-45);assert(residents.canTrade(r.citizen.id,r.position.clone().add(new Vector3(0,0,2))));
 }
 for(const role of ['guarda-torre','guarda-arqueiro'])for(const r of residents.residents.filter(r=>r.citizen.role===role)){assert(r.atWork);assert(Math.abs(r.position.y-(role==='guarda-torre'?10.825:6.245))<1e-8);}
 const priest=residents.residents.find(r=>r.citizen.role==='padre');assert.equal(priest.position.z,-46.2);
 tick(22);assert(!residents.nearestMerchant(residents.residents.find(r=>r.citizen.role==='armeiro').position));
 tick(6);assert.equal(priest.routine,'home');
 // A commuter must travel from home, then occupy the actual work anchor on arrival.
 const clerk=residents.residents.find(r=>r.citizen.role==='guilda');
 tick(8);assert.equal(clerk.routine,'work');assert(!clerk.atWork);
 clerk.position.copy(residents.doorPoint(buildings.get('guild')));clerk.path=[];clerk.wait=0;
 for(let i=0;i<146&&!clerk.atWork;i++)tick(8);
 assert(clerk.atWork);assert.equal(clerk.position.z,-45);
 assert.equal(residents.guildContact(clerk.position)?.id,clerk.citizen.id);
 assert.equal(residents.guildContact(new Vector3(10000,0,10000)),null);
 tick(22);assert.equal(residents.guildContact(clerk.position),null);
 console.log('Lojistas nos balcões, padre atrás do altar, arqueiros na muralha, vigias no topo, deslocamento da guilda e fechamento noturno validados.');
}finally{await server.close();}
