import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/inventory/commerce';export * from './src/inventory/catalog';export * from './src/editor/ResidentSchedule';export * from './src/ui/CityMapFrame';export * from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {tradeItem,merchantItems,itemPrice,ITEM_BY_ID,citizenRoutine,cityMapFrame,Group,Scene,Vector2}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const state={gold:10000,quantities:{},equipped:{},quickSlots:[null,null,null,null]};
for(const kind of ['weapons','potions','tavern','inn','shop']){
 const items=merchantItems(kind);assert(items.length>0);
 for(const item of items){
  assert(ITEM_BY_ID.has(item.id));assert(Number.isSafeInteger(itemPrice(item))&&itemPrice(item)>0);
  const before=structuredClone(state);assert(tradeItem(state,kind,item.id,'buy').ok);assert.equal(state.gold,before.gold-itemPrice(item));assert.equal(state.quantities[item.id],1);
  assert(tradeItem(state,kind,item.id,'sell').ok);assert.equal(state.gold,before.gold);assert.equal(state.quantities[item.id],0);
 }
}
const before=structuredClone(state);assert(!tradeItem(state,'tavern','iron-sword','buy').ok);assert.deepEqual(state,before);
state.gold=0;assert(!tradeItem(state,'weapons','iron-sword','buy').ok);assert.equal(state.quantities['iron-sword'],0);
assert(!tradeItem(state,'weapons','iron-sword','sell').ok);
assert(!tradeItem(state,'weapons','invented-item','buy').ok);
state.quantities['iron-sword']=1;state.equipped.rightHand='iron-sword';state.quickSlots[0]='iron-sword';assert(tradeItem(state,'weapons','iron-sword','sell').ok);assert(!state.equipped.rightHand);assert.equal(state.quickSlots[0],null);
for(const role of ['armeiro','alquimista','taverneira','estalajadeira','lojista']){
 for(const hour of [6,8,12,21.99])assert.equal(citizenRoutine(hour/24,role),'work');
 assert.equal(citizenRoutine(22/24,role),'home');assert.equal(citizenRoutine(0,role),'sleep');
}
for(const role of ['padre','guilda','guarda-palacio','guarda-arqueiro','guarda-torre']){
 assert.equal(citizenRoutine(6/24,role),'home');assert.equal(citizenRoutine(8/24,role),'work');assert.equal(citizenRoutine(22/24,role),'return');
}
assert.equal(citizenRoutine(.5,'guarda-patrulha'),'roam');
assert(merchantItems('tavern').some(i=>i.id==='water-flask'));assert(merchantItems('tavern').every(i=>i.category==='consumable'));
const scene=new Scene(),building=new Group();building.userData.building={width:30,depth:15};building.position.set(300,0,-250);building.rotation.y=.7;building.scale.set(2,1,1.5);scene.add(building);
const polygon=[new Vector2(100,-400),new Vector2(500,-400),new Vector2(500,0),new Vector2(100,0)];
for(const [width,height] of [[720,520],[360,600]]){
 const frame=cityMapFrame([building],polygon,width,height),scale=Math.min(width,height)/frame.visibleSize;
 assert.equal(frame.centerX,300);assert.equal(frame.centerZ,-200);
 for(const p of polygon){const x=width/2+(p.x-frame.centerX)*scale,y=height/2+(p.y-frame.centerZ)*scale;assert(x>0&&x<width&&y>0&&y<height,'City must fit entirely in map');}
}
console.log('Compra/venda simétrica, saldo insuficiente, itens reais, desequipar última unidade, rotinas especiais e enquadramento da cidade validados.');
