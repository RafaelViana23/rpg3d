import {openDoorForResident} from './ChurchDoors';
import { ResidentNavigation } from './ResidentNavigation';
import * as T from 'three';
import type { CityBedAnchor } from './CitySleeping';

type Point=[number,number,number];
export type PrincessPalaceLayout={bed:CityBedAnchor;room:{name:string;ownerName:string;x:number;y:number;z:number;width:number;depth:number};nodes:Record<string,Point>;edges:[string,string][]};
export function princessActivity(worldTime:number){
 const hour=((worldTime%1)+1)%1*24+1e-9;
 if(hour<7||hour>=22)return {target:'bed',label:'dormindo',sleep:true};
 if(hour<8)return {target:'window',label:'no quarto',sleep:false};
 if(hour<10)return {target:'throne',label:'com a família no salão do trono',sleep:false};
 if(hour<12)return {target:'gallery',label:'passeando pela galeria',sleep:false};
 if(hour<14)return {target:'dining',label:'no salão de refeições',sleep:false};
 if(hour<17)return {target:'window',label:'lendo no quarto',sleep:false};
 if(hour<20)return {target:'throne',label:'com a família no salão do trono',sleep:false};
 return {target:'bed',label:'se preparando para dormir',sleep:false};
}

/** Uses the palace's existing east bedroom, real stair centers and open doorways. */
export function createPrincessPalaceLayout(z:(n:number)=>number,upper:number,throne:number,flights:{start:number[];end:number[]}[],daughter:number[],plaza=6.08):PrincessPalaceLayout{
 const room={name:'Quarto de Alice',ownerName:'Alice',x:40.5,y:upper,z:(z(-27)+z(-8))/2,width:24.6,depth:z(-8)-z(-27)-.3};
 const bedMatrix=new T.Matrix4().makeRotationY(-Math.PI/2);bedMatrix.setPosition(42,upper,z(-27)+3.5);
 const nodes:Record<string,Point>={
  throne:[...daughter] as Point,daisFront:[daughter[0],throne,z(-24)+3.5],landing:[6,throne,z(-24)+3.5],
  branch:[6,throne,flights[2].start[2]],stairBottom:flights[2].start as Point,stairTop:flights[2].end as Point,
  galleryBack:[24.1,upper,flights[2].end[2]],gallery:[24.1,upper,z(-18)],door:[27,upper,z(-18)],room:[35,upper,z(-18)],
  bed:[38,upper,z(-27)+5.3],windowTurn:[35,upper,z(-19)-4.2],window:[48,upper,z(-19)-4.2],
  cityEntry:[0,0,78],plazaEntry:[0,plaza,57.5],palaceApproach:[0,plaza,47.2],hallEntry:[0,flights[0].start[1],22],
  mainTop:flights[0].end as Point,mainBottom:flights[0].start as Point,dining:[0,flights[0].start[1],z(0)],
 };
 const edges:[string,string][]=[['throne','daisFront'],['daisFront','landing'],['landing','branch'],['branch','stairBottom'],['stairBottom','stairTop'],['stairTop','galleryBack'],['galleryBack','gallery'],['gallery','door'],['door','room'],['room','bed'],['room','windowTurn'],['windowTurn','window'],['daisFront','mainTop'],['mainTop','mainBottom'],['mainBottom','dining'],['dining','hallEntry'],['hallEntry','palaceApproach'],['palaceApproach','plazaEntry'],['plazaEntry','cityEntry']];
 return {room,bed:{matrix:bedMatrix.toArray(),length:6,width:4.6,mattressY:1.16},nodes,edges};
}

export class PrincessPalaceRoutine{
 private home:T.Group|null=null;
 private target='';
 private path:T.Vector3[]=[];
 private current='throne';
 private connecting=false;
 private connectionSearch:Generator<void,T.Vector3[],void>|null=null;
 private navigation=new ResidentNavigation(.5);
 private next='';
 private expected=new T.Vector3();
 reset(){this.home=null;this.path=[];this.target='';this.connectionSearch=null;this.navigation.clear();}
 update(dt:number,worldTime:number,home:T.Group,position:T.Vector3,height:(x:number,z:number,feet?:number)=>number,collide:(p:T.Vector3,r:number)=>void,overrideLayout?:PrincessPalaceLayout,overrideActivity?:ReturnType<typeof princessActivity>){
  const layout=overrideLayout??home.userData.princessPalace as PrincessPalaceLayout|undefined;if(!layout)return null;
  const activity=overrideActivity??princessActivity(worldTime);home.updateWorldMatrix(true,false);
  const world=(key:string)=>new T.Vector3(...layout.nodes[key]).applyMatrix4(home.matrixWorld);
  if(this.home!==home){
   this.home=home;this.target='';this.path=[];
   const local=home.worldToLocal(position.clone());
   this.current=local.z>58||Math.abs(local.x)>54||local.y<layout.nodes.plazaEntry[1]-.5?'cityEntry':local.z>23?'palaceApproach':Object.keys(layout.nodes).sort((a,b)=>world(a).distanceToSquared(position)-world(b).distanceToSquared(position))[0];
   this.connecting=world(this.current).distanceTo(position)>.1;
  }
  if(this.target!==activity.target){this.target=activity.target;this.path=[];this.next='';}
  if(dt>0)openDoorForResident(position);
  let walking=false;
  if(this.connecting&&!this.path.length){
   const destination=world(this.current);
   if(!this.connectionSearch){
    const samples=Math.max(1,Math.ceil(position.distanceTo(destination)/.3));let clear=true;
    for(let i=1;i<=samples;i++){
     const point=position.clone().lerp(destination,i/samples);point.y=height(point.x,point.z,Math.max(position.y,point.y));
     const resolved=point.clone();collide(resolved,.32);if(resolved.distanceTo(point)>.08){clear=false;break;}
    }
    if(clear)this.path=[destination];
    else this.connectionSearch=this.navigation.routeSteps(position.clone(),destination,(x,z,feet)=>height(x,z,feet??position.y),collide);
   }
   const deadline=performance.now()+1;
   while(this.connectionSearch&&performance.now()<deadline){
    const result=this.connectionSearch.next();
    if(result.done){this.connectionSearch=null;if(result.value.length)this.path=[...result.value,destination];else if(position.distanceTo(destination)<.2)this.connecting=false;break;}
   }
  }
  if(!this.connecting&&!this.path.length&&this.current!==this.target){
   const queue=[this.current],parents=new Map<string,string|undefined>([[this.current,undefined]]);
   for(let i=0;i<queue.length&&!parents.has(this.target);i++)for(const [a,b]of layout.edges){
    const next=a===queue[i]?b:b===queue[i]?a:null;if(next&&!parents.has(next)){parents.set(next,queue[i]);queue.push(next);}
   }
   if(parents.has(this.target)){
    const route:string[]=[];let key=this.target;
    while(key!==this.current){route.unshift(key);key=parents.get(key)!;}
    this.next=route[0];
    const end=world(this.next),start=position.clone(),count=Math.max(1,Math.ceil(start.distanceTo(end)/.15));
    this.path=Array.from({length:count},(_,i)=>start.clone().lerp(end,(i+1)/count));
   }
  }
  let remaining=dt*1.65;
  while(this.path.length&&remaining>0){
   const goal=this.path[0],distance=goal.distanceTo(position),step=Math.min(distance,remaining);
   this.expected.copy(position).lerp(goal,distance>.0001?step/distance:1);
   // Authored stair heights select the actual elevated walk surface, never city ground.
   this.expected.y=height(this.expected.x,this.expected.z,Math.max(position.y,goal.y)+.02);
   const resolved=this.expected.clone();collide(resolved,.32);
   if(Math.hypot(resolved.x-this.expected.x,resolved.z-this.expected.z)>.08){
    if(overrideLayout&&!this.connecting){this.current=this.next;this.connecting=true;this.path=[];this.connectionSearch=null;}
    break;
   }
   const moved=position.distanceTo(resolved);position.copy(resolved);walking=walking||moved>.001;
   remaining-=Math.max(step,.001);
   if(Math.hypot(goal.x-position.x,goal.z-position.z)<.04){this.path.shift();if(!this.path.length){if(this.connecting)this.connecting=false;else this.current=this.next;}}
  }
  const arrived=!this.connecting&&this.current===this.target&&!this.path.length;
  return {walking,asleep:activity.sleep&&arrived,label:arrived?activity.label:activity.sleep?'indo dormir':activity.target==='bed'?'voltando ao quarto':'passeando pelo palácio',bed:layout.bed};
 }
}
