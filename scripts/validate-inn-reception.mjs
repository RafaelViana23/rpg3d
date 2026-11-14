import assert from 'node:assert/strict';
import {createServer} from 'vite';
class Element{
 hidden=true;children=[];dataset={};textContent='';innerHTML='';listeners={};classList={add(){},remove(){}};
 setAttribute(){} addEventListener(name,fn){this.listeners[name]=fn;} append(...nodes){this.children.push(...nodes);} replaceChildren(){this.children=[];} querySelector(){return null;} querySelectorAll(){return [];}
}
globalThis.document={createElement:()=>new Element()};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CitizenConversations}=await server.ssrLoadModule('/src/editor/CitizenConversations.ts');
 const {tradeItem,merchantBuys}=await server.ssrLoadModule('/src/inventory/commerce.ts');
 const {INVENTORY_CATALOG}=await server.ssrLoadModule('/src/inventory/catalog.ts');
 const {ShopPanel}=await server.ssrLoadModule('/src/inventory/ShopPanel.ts');
 const {Scene,Group,Vector3}=await server.ssrLoadModule('three');
 const state={level:1,xp:0,gold:30,worldTime:.5,weather:'clear',quantities:{beer:2,wine:1,bread:1,'bronze-sword':1},equipped:{},quickSlots:[]};
 const citizen={id:'citizen-090',name:'Cerys',role:'atendente-pousada',gender:'mulher'};
 const contact={citizen,actor:{group:new Group()},position:new Vector3(),routine:'work'};
 let tradedId;
 const panel=new CitizenConversations(new Element(),new Scene(),new Map(),state,new Vector3(),()=>[contact],()=>0,()=>{},id=>tradedId=id,()=>{});
 assert(panel.show());assert.equal(panel.element.children[1].children[0].dataset.action,'trade');
 panel.action('talk');assert(!panel.line.includes('escritório'));
 panel.action('continue');assert(panel.line.includes('cuido da recepção'));assert(!panel.line.includes('escritório'));
 assert.equal(panel.element.children[1].children[0].textContent,'Onde encontro a dona da pousada?');
 panel.action('continue');assert(panel.line.includes('escritório'));
 panel.action('back');panel.action('trade');assert.equal(tradedId,citizen.id);assert(!panel.open);
 const notifications=[];panel.accepted=title=>notifications.push(title);
 panel.show();panel.action('task');panel.action('accept');panel.action('accept');assert.deepEqual(notifications,['Um brinde aos viajantes']);panel.action('claim');
 assert.equal(state.gold,130);assert.equal(state.quantities.beer,0);assert.equal(state.quantities.wine,0);
 panel.action('claim');assert.equal(state.gold,130);
 for(const potion of INVENTORY_CATALOG.filter(item=>item.id.endsWith('-potion'))){
  for(const kind of ['inn','tavern','weapons','shop','stable']){state.quantities[potion.id]=1;const gold=state.gold;assert(!merchantBuys(kind,potion));assert(!tradeItem(state,kind,potion.id,'sell').ok);assert.equal(state.gold,gold);assert.equal(state.quantities[potion.id],1);}
  assert(tradeItem(state,'potions',potion.id,'sell').ok);
 }
 state.gold=55;
 let available=true;
 const shop=new ShopPanel(new Element(),state,()=>available,()=>{});
 shop.show({id:citizen.id,name:'Cerys',kind:'inn'});
 assert(shop.element.innerHTML.includes('MEUS CONSUMÍVEIS'));assert(shop.element.innerHTML.includes('data-side="buy"'));assert(shop.element.innerHTML.includes('data-side="sell"'));assert(!shop.element.innerHTML.includes('bronze-sword'));
 const click=(id,side)=>shop.element.listeners.click({target:{closest:()=>({dataset:{trade:id,side}})}});
 click('beer','buy');assert.equal(state.gold,51);assert.equal(state.quantities.beer,1);
 click('bread','sell');assert.equal(state.gold,55);assert.equal(state.quantities.bread,0);
 click('bronze-sword','sell');assert.equal(state.quantities['bronze-sword'],1);assert.equal(state.gold,55);
 state.gold=0;click('rum','buy');assert.equal(state.quantities.rum,undefined);
 available=false;click('wine','buy');assert(!shop.open);
 console.log('Conversa primeiro, comerciante correto, missão única, duas listas, compra/venda, consumíveis e ouro validados.');
}finally{await server.close();delete globalThis.document;}
