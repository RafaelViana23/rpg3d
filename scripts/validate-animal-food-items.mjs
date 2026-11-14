import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {animalLoot}=await server.ssrLoadModule('/src/inventory/animalLoot.ts');
 const {ITEM_BY_ID}=await server.ssrLoadModule('/src/inventory/catalog.ts');
 const {loadInventory,grantAnimalMeatSamples,INVENTORY_STORAGE_KEY}=await server.ssrLoadModule('/src/inventory/persistence.ts');
 const {createProceduralItem,setInventoryFishTemplate}=await server.ssrLoadModule('/src/inventory/proceduralItem.ts');
 const {applyUniformFruit}=await server.ssrLoadModule('/src/editor/UniformFruit.ts');
 const T=await server.ssrLoadModule('three');
 for(const [animal,item]of Object.entries({rabbit:'rabbit-meat',deer:'deer-meat',bear:'bear-meat',wolf:'wolf-meat',puma:'mountain-lion-meat',chicken:'chicken-meat'})){
  const loot=animalLoot(animal);assert(loot.some(l=>l.itemId===item&&l.quantity>0));assert(loot.every(l=>ITEM_BY_ID.has(l.itemId)),'Every drop is lootable inventory stock');
  const model=createProceduralItem(ITEM_BY_ID.get(item));assert(model.children.length>=2,'Meat is a red cut with a fat strip');assert.equal(model.children[0].material.color.getHexString(),'a8322e');
 }
 assert(!ITEM_BY_ID.has('ragout'));assert.equal(ITEM_BY_ID.get('deer-meat').name,'Carne de Veado');
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const initial=loadInventory();initial.quantities.ragout=2;initial.quantities['rabbit-meat']=3;initial.quantities.fish=0;delete initial.animalFoodsRevision;initial.quickSlots=['ragout',null,null,null];values.set(INVENTORY_STORAGE_KEY,JSON.stringify(initial));
 const migrated=loadInventory();assert.equal(migrated.quantities['rabbit-meat'],5);assert(!('ragout'in migrated.quantities));assert.equal(migrated.quickSlots[0],'rabbit-meat');assert.equal(migrated.quantities.fish,1);assert.equal(loadInventory().quantities.fish,1,'Reload grants no duplicate fish');
 const previousRabbit=migrated.quantities['rabbit-meat'];assert(grantAnimalMeatSamples(migrated));
 for(const id of ['rabbit-meat','mountain-lion-meat','bear-meat','deer-meat','wolf-meat','chicken-meat'])assert(migrated.quantities[id]>=1);
 assert.equal(migrated.quantities['rabbit-meat'],previousRabbit+1);const stock=JSON.stringify(migrated.quantities);assert(!grantAnimalMeatSamples(migrated));assert.equal(JSON.stringify(migrated.quantities),stock);
 const reloaded=JSON.parse(JSON.stringify(migrated));assert(!grantAnimalMeatSamples(reloaded));
 const fish=new T.Group();fish.name='Actual trout template';fish.add(new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()));setInventoryFishTemplate(fish);assert.equal(createProceduralItem(ITEM_BY_ID.get('fish')).name,fish.name,'Inventory fish uses supplied river/sea template');
 for(const pack of ['apple','grapes']){
  const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());root.add(mesh);applyUniformFruit(root,pack);
  const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};mesh.material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.fruitColor.value.getHexString(),pack==='apple'?'bb3932':'783b99');assert(shader.fragmentShader.includes('if(isFruit)diffuseColor.rgb=fruitColor;'));
  if(pack==='grapes'){assert(shader.fragmentShader.includes('bool isFruit=fruitSample.b>fruitSample.g*1.2;'));for(const [r,g,b]of [[91,58,112],[34,57,98]])assert(b>g*1.2,'Both actual purple and blue atlas shades must be recolored');}
 }
 console.log('6 carnes específicas por espécie, migração do ragout, peixe sem duplicação, modelo da truta e cores únicas das frutas validados.');
}finally{await server.close();}
