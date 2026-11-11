import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const {dressCitizen,clearCitizenOutfit}=await server.ssrLoadModule('/src/editor/CitizenOutfits.ts');
 const {Vector3}=await server.ssrLoadModule('three');
 for(const role of ['morador','empregada-real','lojista','taverneira','estalajadeira']){
  const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});
  actor.setClothing('gloves',true);actor.setClothing('armorGloves',true);
  dressCitizen(actor,{id:'test',name:'Moradora',gender:'mulher',role,homeId:'',workId:'',post:0});
  for(const material of actor.gloveMaterials){assert.equal(material.color.getHexString(),DEFAULT_CONFIG.skin.slice(1));assert.equal(material.metalness,0);}
  const skirt=actor.group.getObjectByName('Saia fina do vestido');assert(!skirt.userData.apron);assert(!Array.isArray(skirt.material));
  assert.equal(actor.group.getObjectByName('Avental branco de tecido liso'),undefined);
  const geometry=skirt.geometry,indices=geometry.index;
  for(const state of ['walk','run','sit']){
   actor.setAnimation(state);
   for(let frame=0;frame<30;frame++){actor.update(1/30);actor.group.updateMatrixWorld(true);skirt.skeleton.update();for(let i=0;i<indices.count;i+=27)assert(skirt.getVertexPosition(indices.getX(i),new Vector3()).toArray().every(Number.isFinite));}
  }
  clearCitizenOutfit(actor);
 }
 console.log('Moradoras e empregadas sem avental e sem luvas; vestidos validados andando, correndo e sentando.');
}finally{await server.close();}
