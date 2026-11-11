import assert from 'node:assert/strict';
import {createServer} from 'vite';
const s=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {ProceduralCharacter,DEFAULT_CONFIG}=await s.ssrLoadModule('/src/character.ts');
 const {dressCitizen}=await s.ssrLoadModule('/src/editor/CitizenOutfits.ts');
 for(const gender of ['masculino','feminino']){
  const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:gender});actor.setChibi(true);
  actor.setClothing('shirt',true);actor.setClothing('pants',true);actor.setClothing('boots',true);
  if(gender==='feminino')dressCitizen(actor,{role:'princesa',gender:'mulher'});
  else{actor.setClothing('armor',true);actor.setArmorPartColor('torso','#59646b');}
  const visible=new Map(),materials=new Map();actor.group.traverse(o=>{visible.set(o,o.visible);if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.isMeshStandardMaterial)materials.set(m,{color:m.color.getHex(),metalness:m.metalness,roughness:m.roughness,env:m.envMap});});
  actor.setRestUndressed(true);actor.setRestUndressed(true);
  assert.equal(actor.group.getObjectByName('equipment.underwear').visible,false);
  actor.group.traverse(o=>{if(o.name==='CitizenOutfit'||o.name==='equipment.armor.breastplate')assert.equal(o.visible,false);});
  actor.setRestUndressed(false);actor.setRestUndressed(false);
  for(const [o,state] of visible)assert.equal(o.visible,state,o.name);
  for(const [m,v] of materials){assert.equal(m.color.getHex(),v.color);assert.equal(m.metalness,v.metalness);assert.equal(m.roughness,v.roughness);assert.equal(m.envMap,v.env);}
 }
 console.log('Alternância temporária dos dois corpos: roupas ocultas e restauradas integralmente, sem alterar inventário.');
}finally{await s.close();}
