import { ITEM_BY_ID } from '../inventory/catalog';
import { itemThumbnail, refreshItemThumbnails, watchItemThumbnails } from '../inventory/ItemThumbnails';
import type { PersistedInventory } from '../inventory/types';
import { acceptGuildQuest, claimGuildQuest, GUILD_QUESTS, guildQuestReady } from './quests';
export type GuildContact={id:string;name:string};
export class GuildPanel{
  readonly element=document.createElement('section');
  private contact:GuildContact|null=null;
  private message='';
  private readonly tracker=document.createElement('aside');
  private trackerHtml='';
  get open(){return this.contact!==null;}
  constructor(parent:HTMLElement,private state:PersistedInventory,private available:(id:string)=>boolean,private changed:()=>void){
    this.element.className='city-shop guild-panel';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-label','Missões da guilda');parent.append(this.element);this.tracker.className='guild-tracker';this.tracker.hidden=true;parent.append(this.tracker);watchItemThumbnails(this.element);
    this.element.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||!this.contact)return;
      if(button.dataset.close!==undefined){this.close();return;}
      if(!this.available(this.contact.id)){this.close();return;}
      const id=button.dataset.accept??button.dataset.claim;if(!id)return;
      if(button.dataset.accept&&acceptGuildQuest(this.state,id)){this.message='Missão aceita. Volte à guilda para receber a recompensa.';this.changed();}
      if(button.dataset.claim&&claimGuildQuest(this.state,id)){const q=GUILD_QUESTS.find(q=>q.id===id)!;this.message=`Missão concluída! +${q.reward.xp} XP · +${q.reward.gold} ouro`;this.changed();}
      this.render();
    });
  }
  show(contact:GuildContact){this.contact=contact;this.message='';this.render();this.element.hidden=false;this.element.querySelector<HTMLButtonElement>('button')?.focus();}
  close(){this.contact=null;this.element.hidden=true;}
  update(){
    if(this.contact&&!this.available(this.contact.id))this.close();
    const active=GUILD_QUESTS.filter(q=>this.state.guildQuests?.[q.id]?.status==='active');
    this.tracker.hidden=!active.length||this.open;
    const html='<b>Missões ativas</b>'+active.slice(0,3).map(q=>{
      const text=q.objective.kind==='hunt'?`${this.state.guildQuests![q.id].progress}/${q.objective.count}`:q.objective.items.map(i=>`${ITEM_BY_ID.get(i.id)!.name}: ${Math.min(i.quantity,this.state.quantities[i.id]??0)}/${i.quantity}`).join(' · ');
      return `<div>${q.title}<small>${guildQuestReady(this.state,q)?'Pronta · volte à guilda':text}</small></div>`;
    }).join('')+(active.length>3?`<small>+${active.length-3} missões em andamento</small>`:'');
    if(html!==this.trackerHtml){this.trackerHtml=html;this.tracker.innerHTML=html;}
  }
  private render(){
    if(!this.contact)return;
    const scroll=this.element.querySelector<HTMLElement>('.guild-quests')?.scrollTop??0;
    this.element.innerHTML=`<header><div><small>Gerente · ${this.contact.name}</small><h2>Missões da guilda</h2></div><button data-close>Fechar · Esc</button></header><div class="city-shop-wallet">Nível ${this.state.level} · ${this.state.xp}/${this.state.level*100} XP · <b>${this.state.gold} ouro</b></div><p class="city-shop-notice">Aceite um contrato e volte à gerente para entregar e receber.</p><div class="guild-quests">${GUILD_QUESTS.map(q=>{
      const saved=this.state.guildQuests?.[q.id],ready=guildQuestReady(this.state,q),claimed=saved?.status==='claimed';
      const objective=q.objective.kind==='hunt'?`${q.objective.label}: ${saved?.progress??0}/${q.objective.count}`:q.objective.items.map(i=>`${ITEM_BY_ID.get(i.id)!.name}: ${Math.min(i.quantity,this.state.quantities[i.id]??0)}/${i.quantity}`).join(' · ');
      return `<article class="guild-quest ${claimed?'claimed':''}"><div class="guild-quest-title"><h3>${q.title}</h3><small>${claimed?'Concluída':ready?'Pronta para entregar':saved?'Em andamento':'Disponível'}</small></div><p>${q.description}</p><p class="guild-objective">${objective}</p>${q.objective.kind==='delivery'?'<small>Os itens pedidos serão retirados do inventário na entrega.</small>':''}<div class="guild-rewards"><b>Recompensas: ${q.reward.xp} XP · ${q.reward.gold} ouro</b>${q.reward.items.map(i=>`<span>${itemThumbnail(i.id)}<span>${i.quantity}× ${ITEM_BY_ID.get(i.id)!.name}</span></span>`).join('')}</div><button ${claimed?'disabled':saved?`data-claim="${q.id}" ${ready?'':'disabled'}`:`data-accept="${q.id}"`}>${claimed?'Recompensa recebida':saved?q.objective.kind==='delivery'?'Entregar e receber':'Receber recompensa':'Aceitar missão'}</button></article>`;
    }).join('')}</div><p class="city-shop-feedback" role="status">${this.message}</p>`;
    refreshItemThumbnails(this.element);
    const list=this.element.querySelector<HTMLElement>('.guild-quests');if(list)list.scrollTop=scroll;
  }
}
