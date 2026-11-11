import { ITEM_BY_ID } from '../inventory/catalog';
import type { PersistedInventory } from '../inventory/types';
export type QuestItem={id:string;quantity:number};
export type GuildQuest={id:string;title:string;description:string;objective:{kind:'hunt';target:string;label:string;count:number}|{kind:'delivery';items:QuestItem[]};reward:{xp:number;gold:number;items:QuestItem[]}};
export const GUILD_QUESTS:GuildQuest[]=[
  {id:'guild-provisions',title:'Mantimentos para a guilda',description:'Entregue pão e água para abastecer os aventureiros.',objective:{kind:'delivery',items:[{id:'bread',quantity:4},{id:'water-flask',quantity:2}]},reward:{xp:80,gold:45,items:[{id:'hp-potion',quantity:2}]}},
  {id:'guild-rats',title:'Controle de ratos',description:'Abata 3 ratos depois de aceitar a missão.',objective:{kind:'hunt',target:'rat',label:'Ratos abatidos',count:3},reward:{xp:100,gold:60,items:[]}},
  {id:'guild-hunt',title:'Caçada aos cervos',description:'Abata 3 cervos para a guilda depois de aceitar a missão.',objective:{kind:'hunt',target:'deer',label:'Cervos abatidos',count:3},reward:{xp:140,gold:90,items:[{id:'stamina-potion',quantity:2}]}},
  {id:'guild-leather',title:'Couro para os artesãos',description:'Entregue 6 unidades de couro para os artesãos da guilda.',objective:{kind:'delivery',items:[{id:'leather',quantity:6}]},reward:{xp:120,gold:85,items:[{id:'iron-ore',quantity:3}]}},
  {id:'guild-wolves',title:'A ameaça dos lobos',description:'Abata 3 lobos depois de aceitar a missão.',objective:{kind:'hunt',target:'wolf',label:'Lobos abatidos',count:3},reward:{xp:220,gold:150,items:[{id:'steel-gloves',quantity:1}]}},
  {id:'guild-bear',title:'Caçada ao urso',description:'Abata 1 urso depois de aceitar a missão.',objective:{kind:'hunt',target:'bear',label:'Ursos abatidos',count:1},reward:{xp:300,gold:220,items:[{id:'greater-hp-potion',quantity:2},{id:'magic-potion',quantity:2}]}},
];
export function grantExperience(state:PersistedInventory,xp:number){
  state.xp+=xp;let levels=0;
  while(state.xp>=state.level*100){state.xp-=state.level*100;state.level++;state.hp+=20;levels++;}
  return levels;
}
export function acceptGuildQuest(state:PersistedInventory,id:string){
  if(!GUILD_QUESTS.some(q=>q.id===id)||state.guildQuests?.[id])return false;
  (state.guildQuests??={})[id]={status:'active',progress:0};return true;
}
export function recordGuildKill(state:PersistedInventory,target:string){
  for(const quest of GUILD_QUESTS){
    const progress=state.guildQuests?.[quest.id];
    if(progress?.status==='active'&&quest.objective.kind==='hunt'&&quest.objective.target===target)progress.progress=Math.min(quest.objective.count,progress.progress+1);
  }
}
export function guildQuestReady(state:PersistedInventory,quest:GuildQuest){
  const progress=state.guildQuests?.[quest.id];if(progress?.status!=='active')return false;
  return quest.objective.kind==='hunt'?progress.progress>=quest.objective.count:quest.objective.items.every(i=>(state.quantities[i.id]??0)>=i.quantity);
}
/** Delivery and reward are one transaction; completed contracts cannot pay twice. */
export function claimGuildQuest(state:PersistedInventory,id:string){
  const quest=GUILD_QUESTS.find(q=>q.id===id);if(!quest||!guildQuestReady(state,quest))return false;
  if(!quest.reward.items.every(i=>ITEM_BY_ID.has(i.id)))return false;
  if(quest.objective.kind==='delivery')for(const item of quest.objective.items)state.quantities[item.id]-=item.quantity;
  state.guildQuests![id].status='claimed';
  state.gold+=quest.reward.gold;grantExperience(state,quest.reward.xp);
  for(const item of quest.reward.items)state.quantities[item.id]=(state.quantities[item.id]??0)+item.quantity;
  return true;
}
