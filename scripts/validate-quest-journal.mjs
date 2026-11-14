import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {acceptedQuests,removeSecondaryQuest}=await server.ssrLoadModule('/src/inventory/QuestJournal.ts');
 const {acceptGuildQuest}=await server.ssrLoadModule('/src/guild/quests.ts');
 const citizens=[{id:'cerys',name:'Cerys',role:'atendente-pousada'},{id:'guild',name:'Teobaldo',role:'guilda'}];
 const state={quantities:{},level:1,xp:0,gold:0};
 assert.deepEqual(acceptedQuests(state,citizens),[],'No unaccepted quests in journal');
 state.citizenQuests={cerys:{status:'active',found:false,giverName:'Cerys'}};
 let entries=acceptedQuests(state,citizens);assert.equal(entries.length,1);assert.equal(entries[0].name,'Um brinde aos viajantes');assert(entries[0].description.includes('2 cervejas'));assert(entries[0].reward.includes('100 ouro'));assert.equal(entries[0].giver,'Cerys');assert.equal(entries[0].profession,'Atendente da pousada');
 acceptGuildQuest(state,'guild-provisions');state.guildQuests['guild-provisions'].giverName='Teobaldo';
 entries=acceptedQuests(JSON.parse(JSON.stringify(state)),citizens);assert.equal(entries.length,2);assert(entries.every(quest=>quest.category==='secondary'),'NPC and guild quests are secondary');assert.equal(entries[1].giver,'Teobaldo');assert(entries[1].reward.includes('Poção de HP'));
 state.citizenQuests.cerys.status='claimed';assert.equal(acceptedQuests(state,citizens)[0].status,'Concluída');
 assert(removeSecondaryQuest(state,citizens,'citizen','cerys'));assert.equal(state.citizenQuests.cerys.status,'claimed');assert(!acceptedQuests(state,citizens).some(q=>q.id==='cerys'));
 assert(removeSecondaryQuest(state,citizens,'guild','guild-provisions'));assert(!state.guildQuests['guild-provisions']);assert.deepEqual(acceptedQuests(state,citizens),[]);assert(!removeSecondaryQuest(state,citizens,'guild','story-main'));
 console.log('Journal: empty before acceptance; accepted citizen/guild quests, details, rewards, giver and persistence OK.');
}finally{await server.close();}
