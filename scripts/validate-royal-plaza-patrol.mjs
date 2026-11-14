import assert from 'node:assert/strict';import {build} from 'esbuild';
const b=await build({stdin:{contents:"export {createRoyalPalace} from './src/editor/RoyalPalace';export {RoyalPlazaPatrol} from './src/editor/RoyalPlazaPatrol';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {T,createRoyalPalace,RoyalPlazaPatrol}=await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const palace=createRoyalPalace();const routes=palace.userData.npcPlazaPatrolRoutes;assert.equal(routes.length,2);
for(const [side,route] of routes.entries()){
 for(let i=0;i<route.length;i++){const a=route[i],z=route[(i+1)%route.length];for(let n=0;n<=40;n++){const t=n/40,x=a[0]+(z[0]-a[0])*t,y=a[1],zz=a[2]+(z[2]-a[2])*t;
  assert(side===0?x<0:x>0,'The two patrols stay on opposite sides');
  assert(!palace.userData.localColliders.some(c=>x>c[0]-.32&&x<c[3]+.32&&zz>c[2]-.32&&zz<c[5]+.32&&y+2.3>c[1]&&y+.1<c[4]),`Route ${side} hits palace geometry at ${x},${y},${zz}`);
 }}
 const patrol=new RoyalPlazaPatrol(),p=new T.Vector3();const reached=new Set();let walking=0;
 for(let i=0;i<14000;i++){const state=patrol.update(.05,palace,side,p,()=>{});if(state.walking)walking++;for(let j=0;j<route.length;j++)if(p.distanceTo(new T.Vector3(...route[j]))<.2)reached.add(j);}
 assert(reached.size>=5,'Sentry covers the front and lateral circuit');assert(walking>100);
}
palace.position.set(95,18,-34);palace.rotation.y=.7;palace.scale.setScalar(1.2);const patrol=new RoyalPlazaPatrol(),p=new T.Vector3();patrol.update(.05,palace,0,p,()=>{});const local=palace.worldToLocal(p.clone());assert(Math.abs(local.y-routes[0][0][1])<1e-6,'Patrol stays on transformed plaza floor');
console.log('Both mirrored patrols cover plaza front/sides, avoid palace colliders and follow palace transforms.');
