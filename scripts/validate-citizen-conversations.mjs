import assert from 'node:assert/strict';
import {createServer} from 'vite';
class Element{
 hidden=true;children=[];dataset={};textContent='';classList={add(){},remove(){}};
 setAttribute(){} addEventListener(){} append(...nodes){this.children.push(...nodes);} replaceChildren(){this.children=[];} querySelector(){return null;}
}
globalThis.document={createElement:()=>new Element()};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CitizenConversations,commonLines,contextualLine}=await server.ssrLoadModule('/src/editor/CitizenConversations.ts');
 const {CITIZEN_DIALOGUE_DATA}=await server.ssrLoadModule('/src/editor/CitizenDialogueData.ts');
 const {Scene,Group,Vector3}=await server.ssrLoadModule('three');
 const buildings=new Map();for(const kind of ['palace','church','guild','stable','shop','house']){const b=new Group();b.name=`Cidade:${kind}`;b.userData.building={width:16,depth:16};buildings.set(kind,b);}
 const state={level:1,xp:0,gold:0,worldTime:.5,weather:'clear',quantities:{'iron-ore':5,bread:2,'water-flask':1}};
 const citizen={id:'citizen-001',name:'Rito',role:'rei',gender:'homem'};
 const actor={group:new Group()},contact={citizen,actor,position:new Vector3(),routine:'work'};
 const panel=new CitizenConversations(new Element(),new Scene(),buildings,state,new Vector3(),()=>[contact],()=>0,()=>{},()=>{},()=>{});
 for(const role of Object.keys(CITIZEN_DIALOGUE_DATA)){
  const c={...citizen,role:role.includes('morador')||role.includes('campon')?'morador':role};
  assert(commonLines(c).length>=5);
  assert.notEqual(contextualLine(c,{...state,weather:'rain'}),contextualLine(c,state));
  assert.notEqual(contextualLine(c,{...state,worldTime:.9}),contextualLine(c,state));
 }
 assert(panel.show());assert.equal(panel.activeCitizenId,citizen.id);panel.close();assert.equal(panel.activeCitizenId,null);
 assert(panel.show());const first=panel.line;panel.action('talk');assert.notEqual(panel.line,first);
 assert.deepEqual(panel.element.children[1].children.map(b=>b.dataset.action),['continue','back']);
 const reply1=panel.line;panel.action('continue');assert.notEqual(panel.line,reply1);
 const reply2=panel.line;panel.action('continue');assert.notEqual(panel.line,reply2);
 assert.deepEqual(panel.element.children[1].children.map(b=>b.dataset.action),['back'],'Three connected NPC lines finish the branch');
 panel.action('back');assert(panel.element.children[1].children.some(b=>b.dataset.action==='task'));
 panel.action('context');assert.deepEqual(panel.element.children[1].children.map(b=>b.dataset.action),['back']);
 panel.action('back');
 panel.action('task');
 assert.deepEqual(panel.element.children[1].children.map(b=>b.dataset.action),['accept','decline'],'Only accept and decline appear inside the mission branch');
 panel.action('decline');assert(!state.citizenQuests);
 assert(panel.element.children[1].children.some(b=>b.dataset.action==='talk'),'Declining restores the other topics');
 panel.action('accept');assert.equal(state.citizenQuests[citizen.id].status,'active');
 panel.action('claim');assert.equal(state.gold,0,'Cannot claim before visiting the objective');
 panel.player.fromArray(state.citizenQuests[citizen.id].target);panel.update();assert(state.citizenQuests[citizen.id].found);
 panel.contact=contact;panel.action('claim');assert.equal(state.gold,65);panel.action('claim');assert.equal(state.gold,65,'No duplicate rewards');
 citizen.id='citizen-002';citizen.role='armeiro';panel.action('accept');panel.action('claim');assert.equal(state.quantities['iron-ore'],0);assert.equal(state.gold,105);
 citizen.id='citizen-003';citizen.role='rainha';panel.action('accept');panel.player.fromArray(state.citizenQuests[citizen.id].target);panel.update();assert.equal(state.quantities.bread,0);assert.equal(state.quantities['water-flask'],0);assert(panel.ready(citizen),'Delivered supplies remain claimable after consumption');panel.contact=contact;panel.action('claim');assert.equal(state.gold,140);
 citizen.id='citizen-082';citizen.role='princesa';citizen.name='Alice';
 contact.position.copy(panel.player);assert(panel.show());
 panel.action('talk');panel.action('continue');panel.action('continue');
 assert.deepEqual(panel.element.children[1].children.map(b=>b.dataset.action),['promise','promise-later']);
 panel.action('promise');assert(!panel.open);assert(panel.greeting.textContent.includes('Muito obrigada'));
 panel.show();panel.action('talk');panel.action('continue');panel.action('continue');panel.action('promise-later');assert(!panel.open);
 panel.show();panel.action('invite');assert(panel.line.includes('meu pai'));
 assert.deepEqual(panel.element.children[1].children.map(b=>b.dataset.action),['invite-resolve','invite-cancel']);
 panel.action('invite-cancel');assert(!panel.open);assert(!state.companion);
 panel.show();panel.action('invite');panel.action('invite-resolve');assert.equal(state.companion.mode,'follow');assert.equal(state.companion.id,citizen.id);assert(!panel.open);assert(panel.greeting.textContent.includes('não conta pra ninguém'));
 panel.show();panel.action('wait');assert.equal(state.companion.mode,'wait');assert(!panel.open);
 panel.show();panel.action('follow');assert.equal(state.companion.mode,'follow');
 panel.show();panel.action('dismiss');assert(!state.companion);assert(!panel.open);assert(panel.greeting.textContent.includes('da próxima eu quero um beijo'));
 const restored=JSON.parse(JSON.stringify(state));assert.equal(restored.citizenQuests['citizen-001'].status,'claimed');assert.equal(restored.citizenQuests['citizen-003'].status,'claimed');
 console.log('Falas variadas/contextuais, recusa, exploração, entregas, consumo único, recompensas únicas e persistência validados.');
}finally{await server.close();delete globalThis.document;}
