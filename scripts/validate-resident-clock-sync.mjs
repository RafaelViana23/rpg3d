import assert from 'node:assert/strict';
import {createServer} from 'vite';
const s=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CityResidents}=await s.ssrLoadModule('/src/editor/CityResidents.ts');
 const {createRoyalPalace}=await s.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {medievalStreetPlan}=await s.ssrLoadModule('/src/editor/MedievalCityLayout.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await s.ssrLoadModule('/src/character.ts');
 const {royalCoupleLayout,royalCoupleActivity}=await s.ssrLoadModule('/src/editor/RoyalCoupleRoutine.ts');
 const {princessActivity}=await s.ssrLoadModule('/src/editor/PrincessPalaceRoutine.ts');
 const {Scene,Group,Vector3,Matrix4}=await s.ssrLoadModule('three');
 const scene=new Scene(),buildings=new Map();
 for(const [i,p] of medievalStreetPlan().entries()){
  const b=p.kind==='palace'?createRoyalPalace():new Group();b.name='Cidade:'+p.kind;b.position.set(p.x,18,p.z);b.userData.building??={width:16,depth:16,doorWidth:4};scene.add(b);buildings.set('building-'+i,b);
 }
 const residents=new CityResidents(scene,buildings,[]);
 assert.equal(residents.residents.length,146);
 const royals=residents.residents.filter(r=>['rei','rainha','princesa'].includes(r.citizen.role));assert.equal(royals.length,3);
 for(const r of royals){r.actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:r.citizen.gender==='mulher'?'feminino':'masculino'});scene.add(r.actor.group);}
 const princess=royals.find(r=>r.citizen.role==='princesa');
 residents.setCompanion({id:princess.citizen.id,mode:'follow',position:[0,18,0]});
 for(const hour of [1,12,5.99,6,23,0,1.67]){
  for(const r of residents.residents)r.position.set(999,18,999);
  residents.synchronizeTime(hour/24); // Must apply without waiting for a simulation tick.
  assert(residents.residents.every(r=>r.position.x!==999),'All identities reposition immediately');
  for(const r of royals){
   const isPrincess=r.citizen.role==='princesa';
   const layout=isPrincess?r.home.userData.princessPalace:royalCoupleLayout(r.home,r.citizen.role);
   const activity=isPrincess?princessActivity(hour/24):royalCoupleActivity(hour/24);
   const target=r.home.localToWorld(new Vector3(...layout.nodes[activity.target]));
   assert(r.position.distanceTo(target)<1e-6,'Navigation identity is at the scheduled node');
   assert.equal(r.routine==='sleep',activity.sleep);
   const up=new Vector3(0,1,0).applyQuaternion(r.actor.group.quaternion);
   if(activity.sleep){assert(Math.abs(up.y)<.01,'Sleeping posture applies immediately');const bedWorld=new Vector3().setFromMatrixPosition(new Matrix4().multiplyMatrices(r.home.matrixWorld,new Matrix4().fromArray(layout.bed.matrix)));assert(r.actor.group.position.distanceTo(bedWorld)<4);}
   else assert(up.y>.99,'Awake posture restored');
  }
 }
 console.log('Relógio manual: 146 identidades sincronizadas imediatamente; rei, rainha e Alice deitados às 01h/01h40, tronos às 6h; acompanhante incluída.');
}finally{await s.close();}
