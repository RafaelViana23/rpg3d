import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {PrincessPalaceRoutine,princessActivity}=await server.ssrLoadModule('/src/editor/PrincessPalaceRoutine.ts');
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {Scene,Vector3,Matrix4}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace(),builder=new LowPolyCityBuilder(new Scene(),()=>18);
 palace.position.y=18;builder.root.add(palace);builder.objects.set('palace',palace);palace.updateMatrixWorld(true);
 const layout=palace.userData.princessPalace;
 assert.equal(layout.room.ownerName,'Alice');assert.equal(layout.room.name,'Quarto de Alice');
 const bedCenter=new Vector3().setFromMatrixPosition(new Matrix4().fromArray(layout.bed.matrix));
 assert(bedCenter.x>27&&bedCenter.x<53);assert.equal(layout.bed.length,6);
 assert.equal(princessActivity(6/24).sleep,true);assert.equal(princessActivity(7/24).sleep,false);assert.equal(princessActivity(22/24).sleep,true);
 const position=palace.localToWorld(new Vector3(...palace.userData.npcRoyalDaughterPosition)),routine=new PrincessPalaceRoutine();
 const height=(x,z,y=0)=>Math.max(18,builder.walkHeightAt(x,z,y)??-Infinity);
 for(const hour of [8,10,12,15,18,21,23,7]){
  let result;
  for(let i=0;i<4000;i++)result=routine.update(.05,hour/24,palace,position,height,(p,r)=>builder.resolveCollisions(p,r));
  const target=palace.localToWorld(new Vector3(...layout.nodes[princessActivity(hour/24).target]));
  assert(position.distanceTo(target)<.4,`${hour}h: ${position.toArray()} must reach ${target.toArray()} (${result.label})`);
  assert.equal(result.asleep,princessActivity(hour/24).sleep);
 }
 routine.reset();position.copy(palace.localToWorld(new Vector3(5,0,85)));
 for(let i=0;i<6000;i++)routine.update(.05,23/24,palace,position,height,(p,r)=>builder.resolveCollisions(p,r));
 const bed=palace.localToWorld(new Vector3(...layout.nodes.bed));
 assert(position.distanceTo(bed)<.4,`Dismissed outside: ${position.toArray()} must return to bed ${bed.toArray()}`);
 console.log('Quarto e cama de Alice, escadas e portas reais, passeios, refeições, retorno noturno e despertar validados.');
}finally{await server.close();}
