import assert from 'node:assert/strict';import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');const {createCityPopulation}=await server.ssrLoadModule('/src/editor/CityPopulation.ts');
 const {CITIZEN_ROLE_LABELS,citizenRoutine}=await server.ssrLoadModule('/src/editor/ResidentSchedule.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const {dressCitizen}=await server.ssrLoadModule('/src/editor/CitizenOutfits.ts');
 const {createSelenaInn}=await server.ssrLoadModule('/src/editor/SelenaInn.ts');
 const objects=new Map(),root=new T.Group();for(let i=0;i<150;i++){const o=new T.Group();o.name='Cidade:house';o.position.set(i*20,0,0);root.add(o);objects.set('home-'+i,o);}
 const inn=createSelenaInn();root.add(inn);objects.set('inn',inn);const palace=new T.Group();palace.name='Cidade:palace';objects.set('palace',palace);
 const population=createCityPopulation(objects),maids=population.filter(c=>c.role==='empregada-pousada');assert.equal(maids.length,4);assert(maids.every(c=>c.gender==='mulher'&&c.workId==='inn'&&c.homeId!=='inn'));assert.deepEqual(maids.map(c=>c.post),[0,1,2,3]);assert.equal(population.filter(c=>c.role==='empregada-real').length,3);
 assert.equal(CITIZEN_ROLE_LABELS['empregada-real'],'Empregada real');assert.equal(CITIZEN_ROLE_LABELS['empregada-pousada'],'Empregada da pousada');assert.equal(citizenRoutine(12/24,'empregada-pousada'),'work');assert.equal(citizenRoutine(2/24,'empregada-pousada'),'sleep');
 function uniform(role){const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});dressCitizen(actor,{...maids[0],role});const parts=[];actor.group.traverse(o=>{if(o.isMesh&&o.parent){let p=o;while(p&&p.name!=='CitizenOutfit')p=p.parent;if(p)parts.push({name:o.name,vertices:Array.from(o.geometry.getAttribute('position').array),colors:(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.color?.getHexString())});}});return parts;}
 const owner=population.find(c=>c.role==='estalajadeira');assert.equal(owner.socialClass,'nobre');
 const ownerActor=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});dressCitizen(ownerActor,owner);
 for(const name of ['Gargantilha dourada da nobre','Faixa dourada da cintura da nobre','Pulseira dourada da nobre L','Pulseira dourada da nobre R'])assert(ownerActor.group.getObjectByName(name),'Selena wears '+name);
 assert(maids.every(c=>c.socialClass==='plebeu'),'Inn employees remain commoners');
 assert.deepEqual(uniform('empregada-pousada'),uniform('empregada-real'),'Inn and palace employees wear the exact same geometry and colors');
 for(const x of [-13.5,-5.5])for(let z=-5;z<=3;z+=.25){assert(!inn.userData.localColliders.some(c=>x>c[0]-.32&&x<c[3]+.32&&z>c[2]-.32&&z<c[5]+.32&&.18<c[4]&&2.4>c[1]),'Serving aisles clear the inn structure');for(const tx of [-16,-8])assert(Math.abs(x-tx)>1.6+.32,'Servers remain beside tables');}
 for(const floor of [5,10])for(let x=-16;x<=14;x+=.5)assert(!inn.userData.localColliders.some(c=>x>c[0]-.32&&x<c[3]+.32&&4>c[2]-.32&&4<c[5]+.32&&floor+.18<c[4]&&floor+2.4>c[1]),'Housekeeping corridor clears structural obstacles');
 console.log('Four existing women assigned to inn work (two guest-floor housemaids and two dining-floor servers); three royal maids retained; role labels, schedule, identical uniforms and two clear guest-floor routes validated.');
}finally{await server.close();}
