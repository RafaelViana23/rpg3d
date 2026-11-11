import assert from 'node:assert/strict';
import {createServer} from 'vite';
const s=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CitySleeping,cityBedAnchor,cityBedSide}=await s.ssrLoadModule('/src/editor/CitySleeping.ts');
 const {createRoyalStyleBed}=await s.ssrLoadModule('/src/editor/RoyalStyleBed.ts');
 const {createRoyalPalace}=await s.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {royalCoupleLayout}=await s.ssrLoadModule('/src/editor/RoyalCoupleRoutine.ts');
 const {createCityPopulation}=await s.ssrLoadModule('/src/editor/CityPopulation.ts');
 const {medievalStreetPlan}=await s.ssrLoadModule('/src/editor/MedievalCityLayout.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await s.ssrLoadModule('/src/character.ts');
 const {dressCitizen}=await s.ssrLoadModule('/src/editor/CitizenOutfits.ts');
 const T=await s.ssrLoadModule('three');
 const buildings=new Map(),scene=new T.Scene(),palace=createRoyalPalace();palace.position.set(0,18,0);scene.add(palace);
 for(const [i,p] of medievalStreetPlan().entries()){const b=p.kind==='palace'?palace:new T.Group();b.name='Cidade:'+p.kind;b.position.set(p.x,18,p.z);b.userData.building??={width:16,depth:16,doorWidth:4};buildings.set('b'+i,b);}
 const people=createCityPopulation(buildings);assert.equal(people.length,146);
 const home=new T.Group();home.position.set(5,4,-7);home.rotation.y=.67;scene.add(home);
 const model=createRoyalStyleBed(),size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
 const blanket=model.children.find(m=>m.material.color?.getHexString()==='527246');blanket.geometry.computeBoundingBox();
 assert(Math.abs(model.userData.bedMattressY-blanket.position.y-blanket.geometry.boundingBox.max.y)<1e-6,'Bed anchor uses the actual blanket top');
 model.position.set(-2,2,4);model.rotation.y=-.8;model.scale.set(.8,.9,.7);const normal=cityBedAnchor(model,size);
 const sleepers=new CitySleeping(),actors=new Map();let maxGap=0;
 for(const person of people){
  const key=person.gender+':'+person.role;let actor=actors.get(key);
  if(!actor){actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:person.gender==='mulher'?'feminino':'masculino'});actor.setChibi(true);for(const part of ['shirt','pants','boots'])actor.setClothing(part,true);dressCitizen(actor,person);if(person.role.startsWith('guarda-'))for(const part of ['armor','armorPants','armorBoots','armorGloves','steelHelmet'])actor.setClothing(part,true);scene.add(actor.group);actors.set(key,actor);}
  sleepers.restore(actor.group);actor.group.position.set(0,0,0);actor.group.quaternion.identity();actor.setAnimation('idle');actor.update(0);
  let anchor=normal,building=home;
  if(person.role==='rei'||person.role==='rainha'){anchor=royalCoupleLayout(palace,person.role).bed;building=palace;}
  if(person.role==='princesa'){anchor=cityBedSide(palace.userData.princessBed,1);building=palace;}
  sleepers.place(actor.group,building,anchor);
  const inverse=new T.Matrix4().multiplyMatrices(building.matrixWorld,new T.Matrix4().fromArray(anchor.matrix)).invert();
  let contact=Infinity;const point=new T.Vector3();
  actor.group.traverseVisible(mesh=>{if(!mesh.isMesh||!['bodySkin.torso','equipment.armor.breastplate'].includes(mesh.name))return;for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);contact=Math.min(contact,point.y);}});
  const gap=contact-anchor.mattressY;maxGap=Math.max(maxGap,gap);assert(gap<=.003&&gap>=-.006,person.name+': floating gap '+gap);
 }
 console.log(`146 moradores verificados: costas/peitoral apoiados no colchão, incluindo rei, rainha, Alice e guardas. Maior folga: ${maxGap.toFixed(6)}.`);
}finally{await s.close();}
