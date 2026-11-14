import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const {IRON_ARMOR_COLOR,STEEL_ARMOR_COLOR}=await server.ssrLoadModule('/src/inventory/armorMaterials.ts');
 const actor=new ProceduralCharacter(DEFAULT_CONFIG);
 for(const piece of ['ironShirt','armor','armorPants','armorBoots','armorGloves','steelHelmet'])actor.setClothing(piece,true);
 for(const color of [IRON_ARMOR_COLOR,STEEL_ARMOR_COLOR]){
  for(const part of ['torso','legs','boots','gloves','helmet'])actor.setArmorPartColor(part,color);
  let metals=0;
  actor.group.traverse(mesh=>{
   if(!mesh.isMesh)return;
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!material.isMeshStandardMaterial||material.metalness===0)continue;
    metals++;assert.equal(material.envMap,null,'Metal inherits scene environment and time intensity');
    assert.equal(material.emissive.getHex(),0,'Metal emits no light');
    assert(mesh.castShadow&&mesh.receiveShadow,'Metal casts and receives shadows');
   }
  });
  assert(metals>0);
 }
 console.log('Ferro e aço: sem reflexo fixo nem emissão própria; materiais recebem o ambiente do horário e preservam sombras.');
}finally{await server.close();}
