import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/guild/quests';export * from './src/inventory/catalog';export * from './src/inventory/persistence';export * from './src/inventory/ItemThumbnails';export * from './src/guild/GuildPanel';export * from './src/inventory/ShopPanel';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const {GUILD_QUESTS,acceptGuildQuest,recordGuildKill,claimGuildQuest,guildQuestReady,grantExperience,ITEM_BY_ID,loadInventory,saveInventory,setItemThumbnail,watchItemThumbnails,refreshItemThumbnails}=api;
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const state=loadInventory();
recordGuildKill(state,'rat');assert(!state.guildQuests);assert(!acceptGuildQuest(state,'unknown'));
for(const quest of GUILD_QUESTS){
 for(const item of quest.reward.items){assert(ITEM_BY_ID.has(item.id));assert(item.quantity>0);}
 if(quest.objective.kind==='delivery')for(const item of quest.objective.items)assert(ITEM_BY_ID.has(item.id));
 assert(quest.reward.gold>0&&quest.reward.xp>0);
 const s=loadInventory();assert(acceptGuildQuest(s,quest.id));assert(!acceptGuildQuest(s,quest.id));assert(!claimGuildQuest(s,'unknown'));
 if(quest.objective.kind==='hunt'){
  const before=structuredClone(s);recordGuildKill(s,'wrong-target');assert.deepEqual(s,before);assert(!guildQuestReady(s,quest));assert(!claimGuildQuest(s,quest.id));
  for(let i=0;i<quest.objective.count+2;i++)recordGuildKill(s,quest.objective.target);
  assert.equal(s.guildQuests[quest.id].progress,quest.objective.count);
 }else{
  for(const item of quest.objective.items)s.quantities[item.id]=item.quantity;
  s.quantities[quest.objective.items[0].id]--;const before=structuredClone(s);assert(!claimGuildQuest(s,quest.id));assert.deepEqual(s,before,'Failed delivery must not consume partial materials');
  s.quantities[quest.objective.items[0].id]++;
 }
 assert(guildQuestReady(s,quest));const gold=s.gold,quantities={...s.quantities};assert(claimGuildQuest(s,quest.id));assert.equal(s.gold,gold+quest.reward.gold);
 for(const item of quest.reward.items)assert.equal(s.quantities[item.id],(quantities[item.id]??0)+item.quantity);
 if(quest.objective.kind==='delivery')for(const item of quest.objective.items)assert.equal(s.quantities[item.id],quantities[item.id]-item.quantity);
 const paid=structuredClone(s);assert(!claimGuildQuest(s,quest.id));assert(!acceptGuildQuest(s,quest.id));recordGuildKill(s,'rat');assert.deepEqual(s,paid,'Rewards must only pay once');
 saveInventory(s);const restored=loadInventory();assert.deepEqual(restored.guildQuests,s.guildQuests);assert.equal(restored.gold,s.gold);assert.equal(restored.xp,s.xp);assert(!claimGuildQuest(restored,quest.id));
}
const leveling={level:1,xp:90,hp:100};assert.equal(grantExperience(leveling,310),2);assert.deepEqual(leveling,{level:3,xp:100,hp:140});
const image={dataset:{itemThumbnail:'iron-sword'},classList:{add(name){this[name]=true;}}},root={querySelectorAll:()=>[image]};
watchItemThumbnails(root);refreshItemThumbnails(root);assert.equal(image.src,undefined);setItemThumbnail('iron-sword','data:image/png;base64,example');assert.equal(image.src,'data:image/png;base64,example');assert(image.classList.loaded);
console.log('6 missões: aceitação, abates após aceitar, entrega atômica, XP/níveis, ouro/itens reais, persistência, recompensa única e thumbnails tardias validados.');

// Exercise the actual panel actions against a minimal DOM surface.
const makeElement=()=>({hidden:true,innerHTML:'',handlers:{},setAttribute(){},append(){},querySelector:()=>({focus(){}}),querySelectorAll:()=>[],addEventListener(name,fn){this.handlers[name]=fn;}});
globalThis.document={createElement:makeElement};
const parent=makeElement(),click=(panel,dataset)=>panel.element.handlers.click({target:{closest:()=>({dataset})}});
const uiState={...loadInventory(),gold:1000,guildQuests:{},quantities:{...loadInventory().quantities,'iron-sword':0}};
let changes=0,available=true;
const shop=new api.ShopPanel(parent,uiState,()=>available,()=>changes++);
shop.show({id:'merchant',name:'Armeiro',kind:'weapons'});assert(shop.element.innerHTML.includes('data-item-thumbnail="iron-sword"'));
click(shop,{trade:'iron-sword'});assert.equal(uiState.quantities['iron-sword'],1);
click(shop,{tab:'sell'});assert(shop.element.innerHTML.includes('data-item-thumbnail="iron-sword"'));click(shop,{trade:'iron-sword'});assert.equal(uiState.quantities['iron-sword'],0);assert.equal(uiState.gold,1000);
const panel=new api.GuildPanel(parent,uiState,()=>available,()=>changes++);panel.show({id:'guild',name:'Gerente'});
assert.equal((panel.element.innerHTML.match(/<article/g)||[]).length,6);assert(panel.element.innerHTML.includes('data-item-thumbnail="steel-gloves"'));
click(panel,{accept:'guild-rats'});assert.equal(uiState.guildQuests['guild-rats'].status,'active');recordGuildKill(uiState,'rat');recordGuildKill(uiState,'rat');recordGuildKill(uiState,'rat');
click(panel,{claim:'guild-rats'});assert.equal(uiState.guildQuests['guild-rats'].status,'claimed');const paid=uiState.gold;click(panel,{claim:'guild-rats'});assert.equal(uiState.gold,paid);
available=false;click(panel,{accept:'guild-bear'});assert(!panel.open);assert(!uiState.guildQuests['guild-bear']);shop.update();assert(!shop.open);assert.equal(changes,4);
console.log('Painéis reais: thumbnails em compra/venda, aceitar/concluir missão e bloqueio após afastamento validados.');
