import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Vector3 } from 'three';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {physicalDamage,dodgeInvulnerable,dodgeProgress,DODGE_DURATION,DODGE_DISTANCE}=await server.ssrLoadModule('/src/player/PlayerCombat.ts');
  assert.equal(physicalDamage(20,0),20);
  assert.equal(physicalDamage(20,100),10);
  assert.equal(physicalDamage(50,100),25);
  assert.equal(physicalDamage(20,-10),20);
  assert.equal(physicalDamage(1,1000),1);
  assert.equal(physicalDamage(0,100),0);
  assert(!dodgeInvulnerable(0));assert(dodgeInvulnerable(.1));assert(!dodgeInvulnerable(.4));
  for(const fps of [15,30,60,144]){
    let distance=0,elapsed=0;
    while(elapsed<DODGE_DURATION){const previous=elapsed;elapsed+=1/fps;distance+=DODGE_DISTANCE*(dodgeProgress(elapsed)-dodgeProgress(previous));}
    assert(Math.abs(distance-DODGE_DISTANCE)<1e-8);
  }
  const {ResidentNavigation}=await server.ssrLoadModule('/src/editor/ResidentNavigation.ts');
  const navigation=new ResidentNavigation();
  const start=new Vector3(),end=new Vector3(30,0,20);
  const height=()=>0,collide=()=>{};
  const expected=navigation.route(start,end,height,collide);
  const search=navigation.routeSteps(start,end,height,collide);
  let result=search.next(),frames=0;
  while(!result.done){frames++;result=search.next();}
  assert(frames>1);assert.deepEqual(result.value.map(p=>p.toArray()),expected.map(p=>p.toArray()));
  const blocked=navigation.routeSteps(start,new Vector3(100,0,100),height,p=>{p.x+=1;});
  navigation.clear();let visits=0,done=blocked.next();while(!done.done){visits++;assert(visits<=5000);done=blocked.next();}
  assert.deepEqual(done.value,[]);
  console.log('Defesa, janela da esquiva, deslocamento em 4 FPS e navegação incremental: OK');
}finally{await server.close();}
