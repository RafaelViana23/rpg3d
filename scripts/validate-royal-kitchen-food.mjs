import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {createRoyalKitchen}=await server.ssrLoadModule('/src/editor/RoyalKitchen.ts');
 const {createRoyalBread}=await server.ssrLoadModule('/src/inventory/royalBread.ts');
 const {createProceduralItem}=await server.ssrLoadModule('/src/inventory/proceduralItem.ts');
 const {grantRoyalKitchenBread}=await server.ssrLoadModule('/src/inventory/persistence.ts');
 const {ITEM_BY_ID}=await server.ssrLoadModule('/src/inventory/catalog.ts');
 const {Box3}=await server.ssrLoadModule('three');
 const kitchen=createRoyalKitchen(4,0,70,2);
 assert.equal(kitchen.props.length,63);assert.equal(kitchen.props.filter(p=>p.pack==='apple').length,21);assert.equal(kitchen.props.filter(p=>p.pack==='grapes').length,42);
 assert(kitchen.props.every(p=>p.room==='royalKitchen'&&p.height===.28));
 const bread=ITEM_BY_ID.get('bread');assert(bread&&bread.category==='consumable');
 assert.deepEqual(new Box3().setFromObject(createRoyalBread()),new Box3().setFromObject(createProceduralItem(bread)),'Inventory uses the kitchen loaf');
 const state={quantities:{bread:8,apple:5,grapes:4},equipped:{rightHand:'steel-sword'}};
 assert(grantRoyalKitchenBread(state));assert.equal(state.quantities.bread,9);assert.equal(state.quantities.apple,5);assert.equal(state.equipped.rightHand,'steel-sword');
 assert(!grantRoyalKitchenBread(state));assert.equal(state.quantities.bread,9,'Reload must not add another loaf');
 const restored=JSON.parse(JSON.stringify(state));assert(!grantRoyalKitchenBread(restored));assert.equal(restored.quantities.bread,9,'Grant survives save/reload');
 console.log('21 maçãs e 42 cachos de uvas reais; pão compartilhado entre cozinha e inventário; uma unidade concedida sem duplicar ao recarregar.');
}finally{await server.close();}
