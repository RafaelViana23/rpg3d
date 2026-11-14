import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {Vector3}=await server.ssrLoadModule('three');
 const {ResidentNavigation:Before}=await server.ssrLoadModule('/artifacts/performance/ResidentNavigation.before-heap.ts');
 const {ResidentNavigation:After}=await server.ssrLoadModule('/src/editor/ResidentNavigation.ts');
 const cases=[
  {name:'rua reta',cell:2,end:[100,0,0],height:()=>0,collide:()=>{}},
  {name:'trajeto diagonal',cell:2,end:[70,0,70],height:()=>0,collide:()=>{}},
  {name:'desvio de parede',cell:2,end:[60,0,0],height:()=>0,collide:p=>{if(p.x>=20&&p.x<=24&&Math.abs(p.z)<20)p.x=19;}},
  {name:'destino cercado',cell:2,end:[30,0,30],height:()=>0,collide:p=>{if(Math.abs(p.x-30)<=6&&Math.abs(p.z-30)<=6)p.x+=1;}},
  {name:'interior com obstaculo',cell:.5,end:[7,0,5],height:()=>0,collide:p=>{if(p.x>=2&&p.x<=3&&p.z<3&&p.z>-4)p.x=1;}},
  {name:'interior com degraus',cell:.5,end:[8,.8,0],height:x=>Math.max(0,Math.min(.8,Math.floor(x/2)*.2)),collide:()=>{}},
 ];
 const paths=[];
 for(const c of cases){
  const run=Type=>new Type(c.cell).route(new Vector3(),new Vector3(...c.end),c.height,c.collide).map(p=>p.toArray());
  const old=run(Before),current=run(After);assert.deepEqual(current,old,`${c.name}: same route and tie-breaking`);paths.push({name:c.name,points:current.length});
 }
 const samples={before:[],after:[]};
 const batch=Type=>{for(const c of cases)new Type(c.cell).route(new Vector3(),new Vector3(...c.end),c.height,c.collide);};
 for(let round=0;round<16;round++)for(const mode of round%2?['after','before']:['before','after']){
  const start=performance.now();batch(mode==='before'?Before:After);if(round>=4)samples[mode].push(performance.now()-start);
 }
 const summary=values=>{values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};};
 const report={method:'Node CPU benchmark, six deterministic routes, alternating implementations in the same process; no live save, GPU or FPS measurement.',paths,before:summary(samples.before),after:summary(samples.after)};
 report.reductionPercent=(1-report.after.medianMs/report.before.medianMs)*100;
 await writeFile('artifacts/performance/resident-navigation-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await server.close();}
