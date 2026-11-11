import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CityResidents}=await server.ssrLoadModule('/src/editor/CityResidents.ts');
 const T=await server.ssrLoadModule('three');
 const scene=new T.Scene(),buildings=new Map();
 for(const kind of ['palace','church','guild','stable','shop','house','tavern','inn']){
  const b=new T.Group();b.name=`Cidade:${kind}`;b.userData.building={width:16,depth:16,doorWidth:4};scene.add(b);buildings.set(kind,b);
 }
 const residents=new CityResidents(scene,buildings,[]),all=[...residents.residents];
 const player=new T.Vector3(2,0,2);
 let updates=0;
 for(const r of all){
  residents.residents.splice(0,residents.residents.length,r);
  const group=new T.Group();group.position.set(0,0,0);scene.add(group);
  r.actor={group,setAnimation(state){this.state=state;},update(){updates++;}};
  r.position.copy(group.position);r.path=[new T.Vector3(4,0,0)];r.wait=3;r.walking=true;
  const path=r.path,heading=r.angle,routine=r.routine,position=r.position.clone();
  residents.elapsed=0;residents.spawnElapsed=0;residents.setConversation(r.citizen.id);
  for(let i=0;i<20;i++)residents.update(.02,player,()=>0,()=>{},.5);
  assert(r.position.equals(position)&&group.position.equals(position),r.citizen.role+': position frozen');
  assert.equal(r.path,path);assert.equal(r.wait,3);assert.equal(r.angle,heading);assert.equal(r.routine,routine);
  const facing=new T.Vector3(0,0,1).applyQuaternion(group.quaternion);
  assert(facing.dot(player.clone().normalize())>.999,r.citizen.role+': faces player');
  assert.equal(r.actor.state,r.seated?'sit':'idle');
  group.removeFromParent();r.actor=null;
 }
 // Releasing a following companion returns control to its movement routine.
 const princess=all.find(r=>r.citizen.role==='princesa');assert(princess);
 residents.residents.splice(0,residents.residents.length,princess);
 residents.setCompanion({id:princess.citizen.id,mode:'wait',position:princess.position.toArray()});
 residents.setConversation(princess.citizen.id);residents.update(.01,player,()=>0,()=>{},.5);
 residents.setConversation(null);residents.spawnElapsed=-100;
 residents.update(.01,player,()=>0,()=>{},.5);
 assert.equal(princess.routine,'companion','Closing resumes companion routine');
 assert(updates>0);
 console.log(`${all.length} personagens: conversa mantém posição e caminho, vira para o jogador e libera a rotina ao fechar.`);
}finally{await server.close();}
