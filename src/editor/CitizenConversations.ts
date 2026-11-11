import { CITIZEN_REPLIES } from './CitizenDialogueReplies';
import * as THREE from 'three';
import type { Citizen } from './CityPopulation';
import { CITIZEN_ROLE_LABELS, MERCHANT_ROLES } from './ResidentSchedule';
import { CITIZEN_DIALOGUE_DATA } from './CitizenDialogueData';
import { grantExperience } from '../guild/quests';
import type { PersistedInventory } from '../inventory/types';

type Contact={citizen:Citizen;actor:{group:THREE.Group}|null;position:THREE.Vector3;routine:string};
type Task={title:string;request:string;detail:string;items?:Array<[string,number]>;landmark?:string;offset?:[number,number];object?:'medallion'|'book'|'herbs'|'tracks'|'survey';gold:number;xp:number};
export const CITIZEN_TASKS:Record<string,Task>={
 rei:{title:'Rumores ao norte',request:CITIZEN_DIALOGUE_DATA.rei.mission,detail:'Investigue o sinal dourado nos arredores ao norte do palácio e volte ao rei.',landmark:'palace',offset:[0,-1],object:'survey',gold:65,xp:100},
 rainha:{title:'Provisões para uma família',request:CITIZEN_DIALOGUE_DATA.rainha.mission,detail:'Leve 2 pães e 1 água fresca à casa indicada. Depois volte à rainha.',items:[['bread',2],['water-flask',1]],landmark:'house',offset:[0,1],object:'survey',gold:35,xp:75},
 princesa:{title:'O medalhão de Alice',request:CITIZEN_DIALOGUE_DATA.princesa.mission,detail:'Procure o medalhão dourado ao lado direito do palácio e devolva-o a Alice.',landmark:'palace',offset:[1,0],object:'medallion',gold:45,xp:80},
 armeiro:{title:'Ferro para a forja',request:'Estou precisando de minério de ferro. Traga cinco unidades e pagarei pelo material.',detail:'Entregue 5 unidades de minério de ferro ao ferreiro. Recompensa: 40 ouro e 80 XP.',items:[['iron-ore',5]],gold:40,xp:80},
 lojista:{title:'A entrega perdida',request:CITIZEN_DIALOGUE_DATA.lojista.mission,detail:'Encontre o sinal da entrega atrás da loja e leve as notícias de volta.',landmark:'shop',offset:[0,-1],object:'survey',gold:40,xp:75},
 padre:{title:'O livro sagrado',request:'Um antigo livro sagrado desapareceu. Procure nos arredores do templo e traga-o de volta.',detail:'Procure o livro atrás da igreja. Volte ao padre para entregá-lo.',landmark:'church',offset:[0,-1],object:'book',gold:40,xp:90},
 freira:{title:'Ervas para a enfermaria',request:CITIZEN_DIALOGUE_DATA.freira.mission,detail:'Colha o pequeno grupo de ervas ao lado esquerdo da igreja e volte à freira.',landmark:'church',offset:[-1,0],object:'herbs',gold:25,xp:65},
 guilda:{title:'A estrada ameaçada',request:CITIZEN_DIALOGUE_DATA.guilda.mission,detail:'Investigue as pegadas junto à estrada diante da guilda e relate o que encontrou. Os contratos de caça ficam no quadro da guilda.',landmark:'guild',offset:[0,1],object:'tracks',gold:40,xp:85},
 cavalarico:{title:'O cavalo desaparecido',request:'Um dos cavalos fugiu. Poderia procurar suas pegadas nos arredores do estábulo?',detail:'Localize as pegadas atrás do estábulo e volte ao cavalariço para organizar o resgate.',landmark:'stable',offset:[0,-1],object:'tracks',gold:35,xp:75},
 morador:{title:'Ajuda à vizinhança',request:'Você poderia separar dois pães para uma família da nossa rua?',detail:'Entregue 2 pães a este morador.',items:[['bread',2]],gold:15,xp:35},
 taverneira:{title:'Água para a cozinha',request:'O salão está cheio. Pode trazer água fresca para a cozinha?',detail:'Entregue 2 águas frescas.',items:[['water-flask',2]],gold:20,xp:45},
 estalajadeira:{title:'Acolher os viajantes',request:'Chegaram hóspedes sem provisões. Pode ajudar com pão e água?',detail:'Entregue 2 pães e 1 água fresca.',items:[['bread',2],['water-flask',1]],gold:25,xp:50},
 alquimista:{title:'Ingredientes da enfermaria',request:'Preciso de uma amostra das ervas que crescem junto à igreja.',detail:'Colha as ervas à esquerda da igreja e traga a amostra.',landmark:'church',offset:[-1,0],object:'herbs',gold:30,xp:65},
};
const extras:Record<string,string[]>={
 taverneira:['Entre e descanse um pouco. A estrada pode esperar.','Cada mesa guarda uma história diferente.','Uma boa refeição ajuda mais que uma noite em claro.','Ouvi viajantes falando de uivos perto da estrada.','Se precisar de mantimentos, posso mostrar o que temos.'],
 estalajadeira:['Seja bem-vindo. Aqui os viajantes encontram descanso.','Uma cama tranquila faz diferença depois de uma longa viagem.','A cidade é mais silenciosa antes do amanhecer.','Não deixe sua bagagem pelo caminho.','Fale comigo se precisar de provisões.'],
 alquimista:['Bem-vindo. Cuidado com os frascos sobre a prateleira.','Uma poção certa pode mudar o resultado de uma batalha.','Vigor e saúde merecem o mesmo cuidado.','As plantas guardam segredos que o aço não conhece.','Escolha com calma; posso mostrar minhas poções.'],
 guard:['Mantenha o caminho livre, viajante.','Nossa vigília protege quem vive dentro destas muralhas.','Se perceber algo estranho, avise à guarda.','As estradas exigem atenção mesmo durante o dia.','Coragem também é saber quando pedir reforços.'],
};
export function conversationKey(c:Citizen){
 if(c.role==='morador')return Number(c.id.slice(-3))%2===0?(c.gender==='mulher'?'camponesa':'campones'):`morador-${c.gender}`;
 return c.role;
}
export function commonLines(c:Citizen){
 const lines=CITIZEN_DIALOGUE_DATA[conversationKey(c)]?.lines??extras[c.role]??extras.guard;
 return [...lines, c.role==='princesa'?'Ainda quero conhecer cada caminho além destas muralhas.':c.role==='freira'?'Se precisar conversar, posso escutar.':'Sempre há uma nova história para quem sabe escutar.'];
}
export function contextualLine(c:Citizen,state:Pick<PersistedInventory,'worldTime'|'weather'|'level'>,progress?:string){
 if(progress==='claimed')return 'Ainda me lembro da sua ajuda. Você fez diferença por aqui.';
 if(progress==='ready')return 'Você voltou! Conseguiu terminar o que combinamos?';
 if(progress==='active')return 'Como está nossa tarefa? Posso recordar os detalhes, se precisar.';
 const hour=(state.worldTime%1)*24;
 if(state.weather==='rain')return c.role==='freira'?'A chuva trouxe viajantes encharcados. Nossa porta está aberta.':'Com esta chuva, tenha cuidado com as trilhas e procure abrigo.';
 if(state.weather==='snow')return 'A neve torna a viagem mais difícil. Leve provisões e procure se aquecer.';
 if(hour>=18||hour<6)return c.role==='padre'?'Mesmo nesta hora escura, que a luz acompanhe seus passos.':'Está ficando tarde. Não recomendo viajar sozinho pela floresta.';
 if(state.level>=3)return 'Ouvi falar das suas aventuras. Sua experiência pode ajudar muita gente.';
 return c.role==='princesa'?'Com um dia assim, é difícil ficar dentro do castelo!':'A cidade já está em movimento. Que seu caminho seja tranquilo hoje.';
}
export class CitizenConversations{
 readonly element=document.createElement('section');
 private contact:Contact|null=null;
 private line='';
 private lastAction='';
 private taskDiscussed=false;
 private princessInvite=false;
 private topic:{kind:'talk'|'context';step:number}|null=null;
 private subtitle=document.createElement('aside');
 private host:HTMLElement;
 private turns=new Map<string,number>();
 private greeted=new Set<string>();
 private greetingUntil=0;
 private greeting=document.createElement('aside');
 private markers=new Map<string,THREE.Group>();
 get open(){return this.contact!==null;}
 get activeCitizenId(){return this.contact?.citizen.id??null;}
 constructor(parent:HTMLElement,private scene:THREE.Scene,private buildings:Map<string,THREE.Group>,private state:PersistedInventory,private player:THREE.Vector3,private contacts:()=>Contact[],private ground:(x:number,z:number)=>number,private changed:()=>void,private trade:()=>void,private guild:()=>void,private companionChanged:()=>void=()=>{},private requestKiss:(id:string)=>boolean=()=>false){
  this.host=parent;
  this.subtitle.id='citizen-response';this.subtitle.className='citizen-response';this.subtitle.hidden=true;this.subtitle.setAttribute('aria-live','polite');this.subtitle.setAttribute('aria-atomic','true');parent.append(this.subtitle);
  this.element.className='citizen-conversation';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-label','Conversa com morador');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-describedby','citizen-response');parent.append(this.element);
  this.greeting.className='citizen-greeting';this.greeting.hidden=true;parent.append(this.greeting);
  this.element.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(button)this.action(button.dataset.action??'');});
  this.element.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown'].includes(event.key))return;
    const buttons=[...this.element.querySelectorAll<HTMLButtonElement>('button')];
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement),step=event.key==='ArrowDown'?1:-1;
    buttons[(index+step+buttons.length)%buttons.length]?.focus();event.preventDefault();
  });
 }
 nearest(){return this.contacts().filter(r=>r.actor?.group.visible&&r.routine!=='sleep'&&r.position.distanceTo(this.player)<=3).sort((a,b)=>a.position.distanceToSquared(this.player)-b.position.distanceToSquared(this.player))[0];}
 show(){const c=this.nearest();if(!c)return false;this.contact=c;this.lastAction='';this.taskDiscussed=false;this.topic=null;this.princessInvite=false;this.host.classList.add('citizen-talking');this.greeted.add(c.citizen.id);this.line=commonLines(c.citizen)[0];this.render();this.element.hidden=false;this.greeting.hidden=true;this.element.querySelector<HTMLButtonElement>('button')?.focus();return true;}
 close(){this.contact=null;this.element.hidden=true;this.subtitle.hidden=true;this.host.classList.remove('citizen-talking');}
 private finish(line:string){
  const name=this.contact?.citizen.name;this.close();
  this.greeting.textContent=`${name}: ${line}`;this.greetingUntil=performance.now()+6000;this.greeting.hidden=false;
 }
 private nextLine(c:Citizen){const n=this.turns.get(c.id)??0;this.turns.set(c.id,n+1);return commonLines(c)[n%commonLines(c).length];}
 private task(c:Citizen){return CITIZEN_TASKS[c.role]??null;}
 private progress(c:Citizen){return this.state.citizenQuests?.[c.id];}
 private ready(c:Citizen){const task=this.task(c),p=this.progress(c);return !!task&&p?.status==='active'&&(task.landmark?p.found:!task.items||task.items.every(([id,n])=>(this.state.quantities[id]??0)>=n));}
 private action(action:string){
  const c=this.contact?.citizen;if(!c)return;
  if(action==='close'){this.close();return;}
  if(action==='trade'){this.close();this.trade();return;}
  if(action==='guild'){this.close();this.guild();return;}
  if(c.role==='princesa'){
    if(action==='kiss'&&this.state.companion?.id===c.id){
      if(this.requestKiss(c.id))this.finish('Vem cá.');
      else {this.line='Vamos ficar de pé e mais perto primeiro.';this.render();}
      return;
    }
    if(action==='promise'&&this.topic?.kind==='talk'&&this.topic.step===2){this.finish('Muito obrigada!');return;}
    if(action==='promise-later'&&this.topic?.kind==='talk'&&this.topic.step===2){this.close();return;}
    if(action==='invite'){
      this.princessInvite=true;this.topic=null;this.taskDiscussed=false;
      this.line='Eu adoraria, mas meu pai não deixa eu sair do castelo.';this.render();return;
    }
    if(action==='invite-cancel'&&this.princessInvite){this.princessInvite=false;this.close();return;}
    if(action==='invite-resolve'&&this.princessInvite){
      this.state.companion={id:c.id,mode:'follow',position:this.contact!.position.toArray() as [number,number,number]};
      this.companionChanged();this.changed();this.princessInvite=false;
      this.finish('Ok, mas não conta pra ninguém.');return;
    }
    if(action==='dismiss'&&this.state.companion?.id===c.id){
      delete this.state.companion;this.companionChanged();this.changed();
      this.finish('Mas já? Ok, mas da próxima eu quero um beijo.');return;
    }
    if((action==='wait'||action==='follow')&&this.state.companion?.id===c.id){
      this.state.companion.mode=action==='wait'?'wait':'follow';
      this.state.companion.position=this.contact!.position.toArray() as [number,number,number];
      this.companionChanged();this.changed();this.finish(action==='wait'?'Está bem. Vou esperar você aqui.':'Vamos. Eu sigo você.');return;
    }
  }
  this.lastAction=action;
  if(action==='task'){this.taskDiscussed=true;this.topic=null;}
  if(action==='decline')this.taskDiscussed=false;
  const task=this.task(c),progress=this.progress(c);
  if(action==='talk'){this.topic={kind:'talk',step:0};this.taskDiscussed=false;this.line=commonLines(c)[1];}
  if(action==='continue'&&this.topic?.kind==='talk'&&this.topic.step<2){
    this.topic.step++;this.line=commonLines(c)[this.topic.step+1];
  }
  if(action==='back'){this.topic=null;this.line='Claro. O que mais gostaria de saber?';}
  if(action==='context'){this.topic={kind:'context',step:0};this.taskDiscussed=false;this.line=contextualLine(c,this.state,this.ready(c)?'ready':progress?.status);}
  if(action==='task')this.line=task?`${task.request}\n\n${task.detail}`:'Meu dever é guardar a cidade. Procure a guilda para encontrar trabalho.';
  if(action==='decline')this.line='Tudo bem. Se mudar de ideia, podemos conversar novamente.';
  if(action==='accept'&&task&&!progress){
   const target=task.landmark?this.taskTarget(task):undefined;
   if(task.landmark&&!target){this.line='Ainda não posso indicar o local desta tarefa.';this.render();return;}
   (this.state.citizenQuests??={})[c.id]={status:'active',found:false,target:target?.toArray() as [number,number,number]|undefined};
   this.line=`Obrigado por ajudar. ${task.detail}`;this.changed();
  }
  if(action==='claim'&&task&&this.ready(c)){
   for(const [id,n]of task.items??[])if(!task.landmark)this.state.quantities[id]-=n;
   this.state.citizenQuests![c.id].status='claimed';this.state.gold+=task.gold;grantExperience(this.state,task.xp);
   this.line=`Muito obrigado! Sua ajuda fez diferença. Recompensa: ${task.gold} ouro e ${task.xp} XP.`;this.changed();
  }
  this.render();
 }
 private taskTarget(task:Task){
  const b=[...this.buildings.values()].find(b=>b.name===`Cidade:${task.landmark}`);if(!b)return;
  const info=b.userData.building??{width:16,depth:16},[x,z]=task.offset??[0,1];
  const p=b.localToWorld(new THREE.Vector3(x*(info.width/2+3),0,z*(info.depth/2+3)));p.y=this.ground(p.x,p.z)+.12;return p;
 }
 update(enabled=true){
  if(!enabled){this.close();this.greeting.hidden=true;}
  if(this.contact&&(!this.contact.actor?.group.visible||this.contact.position.distanceTo(this.player)>4||this.contact.routine==='sleep'))this.close();
  const nearest=enabled?this.nearest():undefined;
  if(nearest&&!this.open&&!this.greeted.has(nearest.citizen.id)){
   this.greeted.add(nearest.citizen.id);this.greeting.textContent=`${nearest.citizen.name}: ${this.nextLine(nearest.citizen)}`;this.greetingUntil=performance.now()+5000;this.greeting.hidden=false;
  }
  if(performance.now()>this.greetingUntil)this.greeting.hidden=true;
  for(const [id,p]of Object.entries(this.state.citizenQuests??{})){
   if(p.status!=='active'||p.found||!p.target){this.removeMarker(id);continue;}
   const citizen=this.contacts().find(r=>r.citizen.id===id)?.citizen,task=citizen&&this.task(citizen);if(!task)continue;
   let marker=this.markers.get(id);
   if(!marker){marker=this.createMarker(task);marker.position.fromArray(p.target);this.scene.add(marker);this.markers.set(id,marker);}
   const target=new THREE.Vector3().fromArray(p.target);
   if(enabled&&this.player.distanceTo(target)<1.9){
    if(task.items&&!task.items.every(([item,n])=>(this.state.quantities[item]??0)>=n))continue;
    for(const [item,n]of task.items??[])this.state.quantities[item]-=n;
    p.found=true;this.removeMarker(id);this.changed();
    this.greeting.textContent=`${task.title}: objetivo encontrado. Volte a ${citizen!.name}.`;this.greeting.hidden=false;this.greetingUntil=performance.now()+6000;
    if(this.contact?.citizen.id===id)this.render();
   }
  }
 }
 private createMarker(task:Task){
  const root=new THREE.Group();root.name=`Objetivo: ${task.title}`;root.userData.buildEditable=false;
  const gold=new THREE.MeshStandardMaterial({color:task.object==='herbs'?'#4d8b47':'#d4ad53',roughness:.7,emissive:'#60451b',emissiveIntensity:.25});
  const geometry=task.object==='medallion'?new THREE.TorusGeometry(.16,.04,6,16):task.object==='book'?new THREE.BoxGeometry(.34,.08,.45):task.object==='herbs'?new THREE.ConeGeometry(.22,.5,6):task.object==='tracks'?new THREE.TorusGeometry(.15,.04,6,10,Math.PI*1.5):new THREE.OctahedronGeometry(.20);
  const object=new THREE.Mesh(geometry,gold);object.position.y=.35;object.castShadow=true;root.add(object);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.53,32),new THREE.MeshBasicMaterial({color:'#e2c06b',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;root.add(ring);return root;
 }
 private removeMarker(id:string){const marker=this.markers.get(id);if(!marker)return;marker.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});marker.removeFromParent();this.markers.delete(id);}
 private render(){
  const c=this.contact?.citizen;if(!c)return;const task=this.task(c),p=this.progress(c),ready=this.ready(c);
  this.element.replaceChildren();
  const title=document.createElement('h2');title.textContent=`${c.name} (${CITIZEN_ROLE_LABELS[c.role]??(c.gender==='mulher'?'Moradora':'Morador')})`;this.element.append(title);
  this.subtitle.textContent=`${c.name}: ${this.line.replace(/\n+/g,' ')}`;this.subtitle.hidden=false;
  const choices=document.createElement('nav');this.element.append(choices);
  const button=(label:string,action:string)=>{const b=document.createElement('button');b.textContent=label;b.dataset.action=action;b.className=this.lastAction===action?'chosen':'';choices.append(b);};
  if(this.princessInvite){
    button('Eu resolvo isso.','invite-resolve');button('Então deixa.','invite-cancel');
    choices.querySelector<HTMLButtonElement>('button')?.focus();return;
  }
  if(c.role==='princesa'&&this.topic?.kind==='talk'&&this.topic.step===2){
    button('Prometo.','promise');button('Talvez outra hora.','promise-later');
    choices.querySelector<HTMLButtonElement>('button')?.focus();return;
  }
  if(this.topic){
    if(this.topic.kind==='talk'&&this.topic.step<2){
      const replies=CITIZEN_REPLIES[conversationKey(c)]??CITIZEN_REPLIES.guard;
      button(replies[this.topic.step],'continue');
      button('Podemos falar de outra coisa?','back');
    }else button(this.topic.kind==='context'?'Vou levar isso em conta.':'Entendi. Vamos falar de outra coisa.','back');
    choices.querySelector<HTMLButtonElement>('button')?.focus();
    return;
  }
  if(task&&!p&&this.taskDiscussed){
    button('Vou ajudar.','accept');button('Talvez outra hora.','decline');
    choices.querySelector<HTMLButtonElement>('button')?.focus();
    return;
  }
  const question=c.role==='princesa'?'Como é viver no castelo?':c.role==='rei'?'O que devo saber sobre o reino?':c.role==='rainha'?'Como está o povo do reino?':c.role==='freira'?'Como é o seu trabalho na igreja?':c.role==='padre'?'Que conselho pode me dar?':'O que pode me contar sobre este lugar?';
  button(question,'talk');button('Como estão as coisas por aqui?','context');
  if(task){button(p?.status==='active'?'Pode me lembrar o que preciso fazer?':'Precisa de alguma ajuda?','task');if(ready)button('Terminei o que você me pediu.','claim');}
  if(MERCHANT_ROLES[c.role])button('O que você tem para vender?','trade');
  if(c.role==='guilda')button('Quais contratos a guilda tem disponíveis?','guild');
  if(c.role==='princesa'){
    if(this.state.companion?.id===c.id){
      button('Me dá um beijo.','kiss');
      button(this.state.companion.mode==='follow'?'Me espere aqui.':'Venha comigo.',this.state.companion.mode==='follow'?'wait':'follow');
      button('Tenho que ir agora.','dismiss');
    }
    else button('Quer sair comigo?','invite');
  }
  button('Até logo.','close');
  if(this.lastAction)this.element.querySelector<HTMLButtonElement>(`[data-action="${this.lastAction}"]`)?.focus();
 }
}
