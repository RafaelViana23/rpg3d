import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {RoyalCoupleRoutine,royalCoupleLayout,royalCoupleActivity}=await server.ssrLoadModule('/src/editor/RoyalCoupleRoutine.ts');
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {Scene,Vector3}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace(),builder=new LowPolyCityBuilder(new Scene(),()=>18);palace.position.y=18;builder.root.add(palace);builder.objects.set('palace',palace);palace.updateMatrixWorld(true);
 const height=(x,z,y=0)=>Math.max(18,builder.walkHeightAt(x,z,y)??-Infinity);
 assert.equal(royalCoupleActivity(23.99/24).sleep,false);assert.equal(royalCoupleActivity(0).sleep,true);assert.equal(royalCoupleActivity(5.99/24).sleep,true);assert.equal(royalCoupleActivity(6/24).sleep,false);
 for(const role of ['rei','rainha']){
  const layout=royalCoupleLayout(palace,role),position=palace.localToWorld(new Vector3(...layout.nodes.royalThrone)),routine=new RoyalCoupleRoutine();
  for(const hour of [23,0,6]){
   let result,climbed=false;
   for(let i=0;i<6500;i++){
    const before=position.clone();result=routine.update(.05,hour/24,palace,position,role,height,(p,r)=>builder.resolveCollisions(p,r));
    assert(Math.hypot(position.x-before.x,position.z-before.z)<.09,'Royal movement must be continuous');
    assert(Math.abs(position.y-before.y)<.65,'Vertical movement follows real stair treads');
    if(position.y>palace.position.y+layout.nodes.stairBottom[1]+1)climbed=true;
   }
   const target=palace.localToWorld(new Vector3(...layout.nodes[royalCoupleActivity(hour/24).target]));
   assert(position.distanceTo(target)<.45,`${role} ${hour}h: ${position.toArray()} != ${target.toArray()} (${result.label})`);
   assert.equal(result.asleep,hour===0);assert.equal(result.seated,hour!==0);
   if(hour===0)assert(climbed,'Uses the upper floor');
  }
  console.log(role+': trono → escadas → cama à meia-noite → trono às 6h, sem teletransporte');
 }
}finally{await server.close();}
