import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=`
import assert from 'node:assert/strict';
import * as T from 'three';
import {LowPolyCityBuilder} from './src/editor/LowPolyCityBuilder';
import {createMedievalBuilding} from './src/editor/MedievalBuildings';
import {FlightImpactResponse} from './src/editor/FlightImpactResponse';
export function validate(){
 let scenarios=0;
 for(const kind of ['house','shop','potions','inn'])for(const scale of [.4,.6,1,2])for(const fps of [20,60,144])for(const boosting of [false,true]){
  const scene=new T.Scene(),builder=new LowPolyCityBuilder(scene,()=>0),building=createMedievalBuilding(kind);
  building.position.set(20,2,35);building.rotation.y=.7;building.scale.setScalar(scale);scene.add(building);builder.objects.set(kind,building);building.updateMatrixWorld(true);
  const w=building.userData.building.width,inward=new T.Vector3(1,0,0).transformDirection(building.matrixWorld),sideways=new T.Vector3(0,0,1).transformDirection(building.matrixWorld);
  const world=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(building.matrixWorld),local=p=>p.clone().applyMatrix4(building.matrixWorld.clone().invert());
  const sweep=(a,b,n)=>builder.resolveFlightMovement(a,b,.42,n),response=new FlightImpactResponse(),p=world(-w/2-6,1.1/scale,0),dt=1/fps;
  let impacts=0,firstContact=null,maxRebound=0;
  for(let i=0;i<Math.ceil(fps*2.5);i++){
   const before=p.clone();const hit=response.move(p,inward.clone().multiplyScalar((boosting?80:40)*dt),dt,sweep,boosting);
   if(hit){impacts++;if(!firstContact)firstContact=p.clone();assert(response.normal.dot(inward)<-.9,kind+': normal incorreta');}
   if(firstContact)maxRebound=Math.max(maxRebound,p.clone().sub(firstContact).dot(inward.clone().negate()));
   assert(local(p).x<-w/2,kind+': entrou pela parede');assert(p.distanceTo(before)<5,kind+': correção excessiva');
  }
  assert(impacts>0);assert(maxRebound>.6,kind+': não rebateu ao segurar avanço');
  const contact=p.clone();for(let i=0;i<Math.ceil(fps*.15);i++)response.move(p,sideways.clone().multiplyScalar(8*dt),dt,sweep);
  assert(p.clone().sub(contact).dot(sideways)>.5,kind+': movimento lateral preso');
  const exit=p.clone();for(let i=0;i<Math.ceil(fps*.2);i++)response.move(p,inward.clone().multiplyScalar(-20*dt),dt,sweep);
  assert(p.clone().sub(exit).dot(inward)<-2,kind+': não consegue se afastar');
  // Recover a rider left partially inside a wall by the old flight controller.
  const stuck=world(-w/2,1.1/scale,0),recovery=new FlightImpactResponse();
  for(let i=0;i<30;i++)recovery.move(stuck,new T.Vector3(),dt,sweep);
  assert(Math.abs(local(stuck).x+w/2)>.5/scale,kind+': penetração antiga não recuperou');
  // A descending roof impact must push up; flying away must remain possible.
  const h=building.userData.building.height,roof=world(0,h+20,0),roofResponse=new FlightImpactResponse();let roofHits=0;
  for(let i=0;i<Math.ceil(fps*2);i++)if(roofResponse.move(roof,new T.Vector3(0,-40*dt,0),dt,sweep)){roofHits++;assert(roofResponse.normal.y>.9,'Telhado empurrou na direção errada');}
  assert(roofHits>0);const roofBefore=roof.y;
  for(let i=0;i<Math.ceil(fps*.2);i++)roofResponse.move(roof,new T.Vector3(0,15*dt,0),dt,sweep);
  assert(roof.y>roofBefore+2,'Preso ao tentar sair do telhado');
  scenarios++;
 }
 for(const fps of [20,60,144]){
  const scene=new T.Scene(),builder=new LowPolyCityBuilder(scene,()=>0),corner=new T.Group();
  corner.userData.localColliders=[[0,0,-5,.3,6,5],[-5,0,0,5,6,.3]];
  scene.add(corner);builder.objects.set('corner',corner);
  const p=new T.Vector3(-2,1,-2),response=new FlightImpactResponse(),sweep=(a,b,n)=>builder.resolveFlightMovement(a,b,.42,n),dt=1/fps;
  let hits=0;
  for(let i=0;i<fps*2;i++){
    if(response.move(p,new T.Vector3(1,0,1).normalize().multiplyScalar(40*dt),dt,sweep))hits++;
    assert(p.x<-.4&&p.z<-.4,'Atravessou canto de duas paredes');
  }
  assert(hits>0);const before=p.clone();
  for(let i=0;i<Math.ceil(fps*.3);i++)response.move(p,new T.Vector3(-20*dt,0,0),dt,sweep);
  assert(p.x<before.x-3,'Continua preso no canto ao tentar sair');scenarios++;
 }
 return scenarios;
}`;
const result=await build({stdin:{contents:source,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm'});
try{const {validate}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);console.log(`${validate()} cenários: avanço contínuo, rebote, desvio lateral, saída, penetração antiga e telhados OK.`);}catch(error){console.error(error.message);process.exitCode=1;}
