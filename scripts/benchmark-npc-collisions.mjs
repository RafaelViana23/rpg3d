import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const output=process.argv[2]??'artifacts/performance/npc-collision-current.json';
const reference=process.argv[3];
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {LowPolyCityBuilder,createCityAsset}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const raw=JSON.parse(await readFile('src/editor/default-city.json','utf8')),saved=raw.city??raw;
 const scene=new T.Scene(),builder=new LowPolyCityBuilder(scene,()=>0);
 let buildings=0;
 for(const value of Object.values(saved)){
  if(!['house','inn','palace','tavern','church','weapons','potions','guild','wall','gate','tower'].includes(value.kind))continue;
  const owner=createCityAsset(value.kind);owner.position.fromArray(value.position);owner.rotation.fromArray(value.rotation);owner.scale.fromArray(value.scale);
  builder.root.add(owner);builder.objects.set(value.id??String(buildings),owner);buildings++;
 }
 scene.updateMatrixWorld(true);builder.prepareWeatherCover();
 let seed=4271;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
 const queries=Array.from({length:4096},()=>new T.Vector3((random()-.5)*440,18+Math.floor(random()*3)*5,(random()-.5)*440));
 const point=new T.Vector3(),results=[];
 const run=record=>{for(const query of queries){point.copy(query);builder.resolveCollisions(point,.32);if(record)results.push(point.toArray());}};
 const coldStart=performance.now();run(true);const coldMs=performance.now()-coldStart;
 const rounds=[];for(let i=0;i<16;i++){const start=performance.now();run(false);if(i>=4)rounds.push(performance.now()-start);}
 rounds.sort((a,b)=>a-b);
 const checksum=createHash('sha256').update(JSON.stringify(results)).digest('hex');
 const report={method:'Node CPU benchmark; static shells and exact transforms from repository default map; no live save, GLB props, GPU or FPS measurement.',buildings,shapes:builder.collisionShapes.length,queries:queries.length,coldMs,medianMs:rounds[Math.floor(rounds.length/2)],p95Ms:rounds[Math.floor(rounds.length*.95)],checksum};
 if(reference){const before=JSON.parse(await readFile(reference,'utf8'));assert.equal(checksum,before.checksum,'All resolved coordinates must match baseline exactly');report.speedup=before.medianMs/report.medianMs;report.reductionPercent=(1-report.medianMs/before.medianMs)*100;}
 // Alternate the original collector and cache in the same process to reduce
 // machine-load and JIT differences between separate benchmark runs.
 const optimized=builder.nearbyColliders;
 const legacy=function(x,z,radius){
  const result=new Set();
  for(let gx=Math.floor((x-radius)/16);gx<=Math.floor((x+radius)/16);gx++)for(let gz=Math.floor((z-radius)/16);gz<=Math.floor((z+radius)/16);gz++){
   for(const shape of this.collisionGrid.get(`${gx}:${gz}`)??[])result.add(shape);
  }
  return result;
 };
 const paired={legacy:[],cached:[]};
 for(let round=0;round<20;round++)for(const mode of round%2?['cached','legacy']:['legacy','cached']){
  builder.nearbyColliders=mode==='legacy'?legacy:optimized;
  const start=performance.now();run(false);if(round>=4)paired[mode].push(performance.now()-start);
 }
 builder.nearbyColliders=optimized;
 const summary=values=>{values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length/2)],p95Ms:values[Math.floor(values.length*.95)]};};
 report.paired={legacy:summary(paired.legacy),cached:summary(paired.cached)};
 report.paired.reductionPercent=(1-report.paired.cached.medianMs/report.paired.legacy.medianMs)*100;
 await mkdir('artifacts/performance',{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await server.close();}
