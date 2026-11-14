import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const {CityResidents}=await server.ssrLoadModule('/src/editor/CityResidents.ts');
 const {marketStallWorkstation,circularMarketStalls}=await server.ssrLoadModule('/src/editor/CentralPlazaLayout.ts');
 const snapshot=JSON.parse(await readFile('backups/central-plaza-expansion/applied.json','utf8')),city=JSON.parse(snapshot.payload.entries['rpg3d.worldBuilder.v1']).city;
 const scene=new T.Scene(),buildings=new Map();
 for(const [id,s]of Object.entries(city)){
  const o=s.id==='city-royal-avenue-v1'?createRoyalAvenue(s):new T.Group();o.name='Cidade:'+s.kind;o.position.fromArray(s.position);o.rotation.set(...s.rotation);o.scale.fromArray(s.scale);
  if(['house','guild','inn','church','tavern','weapons','potions','palace'].includes(s.kind))o.userData.building={width:16,depth:16,doorWidth:4};
  scene.add(o);buildings.set(id,o);
 }
 const residents=new CityResidents(scene,buildings,[]),workers=residents.residents.filter(r=>r.citizen.role==='feirante');
 for(const r of workers)assert.equal(residents.population.filter(c=>c.name===r.citizen.name).length,1,'New workers have unique names');
 assert.equal(workers.length,12);for(const gender of ['homem','mulher'])assert.equal(workers.filter(r=>r.citizen.gender===gender).length,6);
 assert.equal(new Set(workers.map(r=>r.citizen.post)).size,12);assert.equal(new Set(residents.population.map(c=>c.id)).size,residents.population.length);
 for(const r of workers){assert.equal(r.citizen.socialClass,'plebeu');assert.equal(r.home.name,'Cidade:house');assert.equal(buildings.get(r.citizen.workId).name,'Cidade:market');}
 residents.synchronizeTime(12/24);
 const market=buildings.get(workers[0].citizen.workId);market.updateWorldMatrix(true,true);
 for(const r of workers){
  const station=marketStallWorkstation(r.citizen.post),expected=new T.Vector3(station.x,station.y,station.z).applyMatrix4(market.matrixWorld);
  assert(r.position.distanceTo(expected)<1e-8);assert(r.atWork&&!r.indoors&&r.routine==='work');
  const facing=new T.Vector3(Math.sin(r.angle),0,Math.cos(r.angle)),towardFountain=market.getWorldPosition(new T.Vector3()).sub(r.position).setY(0).normalize();assert(facing.dot(towardFountain)>.9999);
  assert(Math.hypot(station.x,station.z)<28,'Worker stays clear of the flowerbeds');
 }
 market.position.x+=8;market.rotation.y+=.4;residents.synchronizeTime(.5);
 for(const r of workers){const station=marketStallWorkstation(r.citizen.post);assert(r.position.distanceTo(market.localToWorld(new T.Vector3(station.x,station.y,station.z)))<1e-8,'Workers follow the live shared market transform');}
 residents.synchronizeTime(2/24);assert(workers.every(r=>!r.atWork&&r.routine==='sleep'&&r.anchor===r.home));
 residents.synchronizeTime(.5);assert(workers.every(r=>r.atWork&&r.routine==='work'));
 assert.equal(circularMarketStalls().length,workers.length);
 console.log('12 market workers: 6 men/6 women, plebeian outfits/class, unique stall assignments, real market transforms, fountain-facing workstations and existing day/night schedule passed.');
}finally{await server.close();}
