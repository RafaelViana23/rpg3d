import {CITIZEN_ROLE_LABELS} from '../editor/ResidentSchedule';
import {CITIZEN_TASKS} from '../editor/CitizenConversations';
import type {Citizen} from '../editor/CityPopulation';
import {GUILD_QUESTS} from '../guild/quests';
import {ITEM_BY_ID} from './catalog';
import type {PersistedInventory} from './types';

export function acceptedQuests(state:PersistedInventory,citizens:Citizen[]){
 const quests:{id:string;source:'citizen'|'guild';category:'main'|'secondary';name:string;description:string;reward:string;giver:string;profession:string;status:string}[]=[];
 for(const [id,progress] of Object.entries(state.citizenQuests??{})){
  if(progress.journalHidden)continue;
  const citizen=citizens.find(c=>c.id===id),task=citizen&&CITIZEN_TASKS[citizen.role];if(!task)continue;
  quests.push({id,source:'citizen',category:'secondary',name:task.title,description:task.request+' '+task.detail,reward:`${task.gold} ouro · ${task.xp} XP`,giver:progress.giverName??citizen.name,profession:CITIZEN_ROLE_LABELS[citizen.role]??'Morador',status:progress.status==='claimed'?'Concluída':'Em andamento'});
 }
 for(const [id,progress] of Object.entries(state.guildQuests??{})){
  if(progress.journalHidden)continue;
  const quest=GUILD_QUESTS.find(q=>q.id===id);if(!quest)continue;
  quests.push({id,source:'guild',category:'secondary',name:quest.title,description:quest.description,reward:[`${quest.reward.gold} ouro`,`${quest.reward.xp} XP`,...quest.reward.items.map(item=>`${item.quantity}× ${ITEM_BY_ID.get(item.id)?.name??item.id}`)].join(' · '),giver:progress.giverName??citizens.find(c=>c.role==='guilda')?.name??'Guilda',profession:CITIZEN_ROLE_LABELS.guilda??'Chefe da guilda',status:progress.status==='claimed'?'Concluída':'Em andamento'});
 }
 return quests;
}
export function removeSecondaryQuest(state:PersistedInventory,citizens:Citizen[],source:'citizen'|'guild',id:string){
 const quest=acceptedQuests(state,citizens).find(q=>q.source===source&&q.id===id);
 if(!quest||quest.category!=='secondary')return false;
 const entries=source==='citizen'?state.citizenQuests:state.guildQuests;
 const progress=entries?.[id];if(!progress)return false;
 // Completed rewards stay claimed even when the card is removed.
 if(progress.status==='claimed')progress.journalHidden=true;
 else delete entries![id];
 return true;
}
export function renderQuestJournal(root:HTMLElement,state:PersistedInventory,citizens:Citizen[],changed:()=>void=()=>{}){
 root.replaceChildren();
 const title=document.createElement('h2');title.textContent='Missões';root.append(title);
 const quests=acceptedQuests(state,citizens);
 for(const [category,label] of [['main','Principal'],['secondary','Secundárias']] as const){
  const section=document.createElement('section');section.className='quest-journal-category';section.dataset.questCategory=category;
  const heading=document.createElement('h2');heading.textContent=label;section.append(heading);
  root.append(section);
  for(const quest of quests.filter(quest=>quest.category===category)){
  const card=document.createElement('article');
  for(const [tag,text] of [['h3',quest.name],['small',quest.status],['p',quest.description],['p',`Recompensa: ${quest.reward}`],['p',`Quem passou: ${quest.giver} (${quest.profession})`]]){
   const el=document.createElement(tag);el.textContent=text;card.append(el);
  }
  if(quest.category==='secondary'){
   const remove=document.createElement('button');remove.type='button';remove.className='quest-remove';remove.textContent='Remover missão';
   remove.addEventListener('click',()=>{if(removeSecondaryQuest(state,citizens,quest.source,quest.id)){changed();renderQuestJournal(root,state,citizens,changed);}});
   card.append(remove);
  }
  section.append(card);
  }
 }
}
