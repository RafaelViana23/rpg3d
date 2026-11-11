import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({stdin:{contents:"export {createCityPopulation} from './src/editor/CityPopulation';export {medievalStreetPlan} from './src/editor/MedievalCityLayout';",resolveDir:root},bundle:true,write:false,platform:'node',format:'esm'});
const {createCityPopulation,medievalStreetPlan}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const buildings=new Map();
function add(id,kind,x,z){buildings.set(id,{name:`Cidade:${kind}`,position:{x,z,distanceToSquared(p){return (x-p.x)**2+(z-p.z)**2;}},userData:{}});}
medievalStreetPlan().forEach((p,i)=>add(`medieval-streets-v2-${p.kind}-${i}`,p.kind,p.x,p.z));
for(let i=0;i<8;i++)add(`capital-octagon-tower-${i+1}`,'tower',Math.sin(i*Math.PI/4)*225,Math.cos(i*Math.PI/4)*225);
const citizens=createCityPopulation(buildings);
assert.equal(citizens.length,146);assert.equal(new Set(citizens.map(c=>c.name)).size,146);
assert(citizens.every(c=>!c.name.includes(' ')),'Usar apenas nomes sem sobrenome');
for(const name of ['Lifa','Rito','Basel'])assert(citizens.some(c=>c.name===name));
for(const gender of ['homem','mulher'])assert.equal(citizens.filter(c=>c.gender===gender).length,73);
const count=role=>citizens.filter(c=>c.role===role);
assert.equal(count('guarda-torre').length,8);assert.equal(count('guarda-palacio').length,6);
assert.equal(count('guarda-arqueiro').length,8);assert.equal(count('guarda-patrulha').length,8);
assert.equal(new Set(count('guarda-torre').map(c=>c.workId)).size,8);
for(const c of citizens){assert(buildings.has(c.homeId),`${c.name} sem moradia`);assert(buildings.has(c.workId),`${c.name} sem local de trabalho`);}
for(const b of buildings.values())if(b.name==='Cidade:house'){assert.equal(b.userData.ownerIds.length,1);assert(b.userData.ownerName);}
for(const c of citizens.filter(c=>c.role.startsWith('guarda-')))assert.equal(buildings.get(c.homeId).name,'Cidade:house');
for(const [role,gender,kind]of [['armeiro','homem','weapons'],['alquimista','homem','potions'],['estalajadeira','mulher','inn'],['taverneira','mulher','tavern'],['rei','homem','palace'],['rainha','mulher','palace']]){const c=count(role)[0];assert.equal(c.gender,gender);assert.equal(c.homeId,c.workId);assert.equal(buildings.get(c.homeId).name,`Cidade:${kind}`);}
const reserved=new Set();
for(const role of ['padre','guilda']){const c=count(role)[0],work=buildings.get(c.workId);assert.equal(c.gender,role==='padre'?'homem':'mulher');const homes=[...buildings].filter(([id,b])=>b.name==='Cidade:house'&&!reserved.has(id)).sort(([,a],[,b])=>a.position.distanceToSquared(work.position)-b.position.distanceToSquared(work.position));assert.equal(c.homeId,homes[0][0],`${role}: casa mais próxima disponível`);reserved.add(c.homeId);}
assert.deepEqual(citizens.filter(c=>c.existingIndex!==undefined).map(c=>c.name),['Eleonor','Elara','Emma']);
assert.equal(citizens.filter(c=>buildings.get(c.homeId).name==='Cidade:house').length,139);
assert.deepEqual(createCityPopulation(buildings),citizens,'Donos precisam permanecer estáveis ao recarregar');
console.log('146 cidadãos; 73 homens/73 mulheres; 140 casas com dono único; 8 guardas nas torres e 6 no palácio; moradias e locais de trabalho validados; identidades estáveis.');

const daughter=count('princesa')[0];assert(daughter,'Royal daughter exists');assert.equal(daughter.gender,'mulher');assert.equal(daughter.homeId,count('rei')[0].homeId);assert.deepEqual(daughter.parentIds,[count('rei')[0].id,count('rainha')[0].id]);assert.equal(daughter.name,'Alice');console.log('Princesa Alice vive no palácio e é filha do rei e da rainha.');
