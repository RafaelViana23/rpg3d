import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class ProgressEvent{constructor(type,init){Object.assign(this,{type},init);}};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {createCityPopulation}=await server.ssrLoadModule('/src/editor/CityPopulation.ts');
 const {PalaceStaffRoutine,palaceStaffLayout}=await server.ssrLoadModule('/src/editor/PalaceStaffRoutine.ts');
 const {citizenRoutine}=await server.ssrLoadModule('/src/editor/ResidentSchedule.ts');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {Scene,Vector3,Group}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace(),builder=new LowPolyCityBuilder(new Scene(),()=>18);palace.position.y=18;builder.root.add(palace);builder.objects.set('palace',palace);palace.updateMatrixWorld(true);
 for(let i=0;i<150;i++){const home=new Group();home.name='Cidade:house';builder.objects.set(`home-${i}`,home);}
 const staff=createCityPopulation(builder.objects).filter(c=>['cozinheiro-real','empregada-real'].includes(c.role));
 assert.equal(staff.length,6);assert.equal(staff.filter(c=>c.gender==='homem'&&c.role==='cozinheiro-real').length,3);assert.equal(staff.filter(c=>c.gender==='mulher'&&c.role==='empregada-real').length,3);
 assert(staff.every(c=>c.workId==='palace'&&c.homeId!=='palace'));
 const height=(x,z,y=0)=>Math.max(18,builder.walkHeightAt(x,z,y)??-Infinity),collide=(p,r)=>builder.resolveCollisions(p,r);
 const {placeRoyalKitchenStorage}=await server.ssrLoadModule('/src/editor/RoyalKitchenStorage.ts');
 async function load(name,piece){
  const data=await readFile(`public/models/city/props/${name}.glb`),length=data.readUInt32LE(12),json=JSON.parse(data.subarray(20,20+length).toString());
  for(const mesh of json.meshes??[])for(const p of mesh.primitives)delete p.material;
  delete json.materials;delete json.textures;delete json.images;
  json.buffers[0].uri=`data:application/octet-stream;base64,${data.subarray(20+length+8).toString('base64')}`;
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');return piece?gltf.scene.getObjectByName(piece):gltf.scene;
 }
 placeRoyalKitchenStorage(palace,await load('box-low-poly'),await load('farm','Barrel'),{table:await load('tavern-round-table'),bottles:await Promise.all(['green','brown','yellow'].map(c=>load(`tavern-bottle-${c}`)))});
 const layout=palaceStaffLayout(palace);
 for(const citizen of staff){
  const pos=palace.localToWorld(new Vector3(...layout.nodes.cityEntry)),routine=new PalaceStaffRoutine();
  for(const hour of citizen.role==='cozinheiro-real'?[8,10,12]:[8,10,12,14,16,18]){
   for(let i=0;i<7000;i++)routine.update(.05,hour/24,palace,pos,citizen,height,collide);
   const targets=citizen.role==='cozinheiro-real'?['cook0','cook1','cook2']:['room','sitting','study','west-room','gallery','dining'];
   const key=targets[(Math.floor(hour/2)+citizen.post)%targets.length],target=palace.localToWorld(new Vector3(...layout.nodes[key]));
   assert(pos.distanceTo(target)<.4,`${citizen.role} ${hour}h: ${pos.toArray()} must reach ${key} ${target.toArray()}`);
  }
  assert.equal(citizenRoutine(2/24,citizen.role),'sleep');assert.equal(citizenRoutine(12/24,citizen.role),'work');assert.equal(citizenRoutine(23/24,citizen.role),'return');
 }
 const {DEFAULT_CONFIG,ProceduralCharacter}=await server.ssrLoadModule('/src/character.ts');
 const {dressCitizen}=await server.ssrLoadModule('/src/editor/CitizenOutfits.ts');
 const maid=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});dressCitizen(maid,staff.find(c=>c.role==='empregada-real'));
 assert.equal(maid.group.userData.citizenOutfit.palette,'#17171b');
 for(const side of ['L','R'])assert.equal(maid.group.getObjectByName(`Manga bufante ${side}`).material.color.getHexString(),'f2eee4');
 const skirt=maid.group.getObjectByName('Saia fina do vestido');
 assert.equal(skirt.material.color.getHexString(),'17171b');
 assert(!skirt.userData.apron);assert.equal(maid.group.getObjectByName('Avental branco de tecido liso'),undefined);
 for(const material of maid.gloveMaterials){assert.equal(material.color.getHexString(),DEFAULT_CONFIG.skin.slice(1));assert.equal(material.metalness,0);}
 const cook=new ProceduralCharacter({...DEFAULT_CONFIG,body:'masculino'});let belt;
 const setClothing=cook.setClothing.bind(cook);cook.setClothing=(item,equipped)=>{if(item==='belt')belt=equipped;setClothing(item,equipped);};
 dressCitizen(cook,staff.find(c=>c.role==='cozinheiro-real'));
 assert.equal(belt,false);assert(cook.group.getObjectByName('Avental branco de tecido liso').isSkinnedMesh);
 console.log('Six staff identities and gender, homes, shifts, palace entry, kitchen stations, rooms and staircase routes validated.');
}finally{await server.close();}
