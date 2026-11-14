import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {ResidentNavigation}=await server.ssrLoadModule('/src/editor/ResidentNavigation.ts');
 const builder=new LowPolyCityBuilder(new T.Scene(),()=>0),building=new T.Group();
 builder.root.add(building);builder.objects.set('test',building);
 building.position.set(12,3,-5);building.rotation.y=.37;building.scale.set(1.2,1.5,.9);
 building.userData.localColliders=[];
 const surfaces=Array.from({length:500},(_,i)=>[i*4,0,i*4+3,3,i%4]);
 building.userData.walkSurfaces=surfaces;
 building.userData.walkSurfacePolygons=surfaces.map(([x,z,x1,z1])=>[[x,z],[x1,z],[x,z1]]);
 builder.prepareWeatherCover();building.updateWorldMatrix(true,false);
 const point=new T.Vector3();
 let candidateCount=0,queries=0;
 for(let i=0;i<500;i+=7)for(const [dx,dz] of [[.2,.2],[2.9,2.9]]){
  point.set(i*4+dx,0,dz).applyMatrix4(building.matrixWorld);
  const groups=builder.walkGrid.get(`${Math.floor(point.x/16)}:${Math.floor(point.z/16)}`)??[];
  candidateCount+=groups.reduce((sum,g)=>sum+g.surfaces.length,0);queries++;
  const h=builder.walkHeightAt(point.x,point.z,20);
  assert.equal(h,dx<1?3+(i%4)*1.5:null,'Spatial index preserves rotated/scaled heights and polygon holes');
 }
 assert(candidateCount/queries<30,'Each query scans nearby surfaces, not the complete building');
 building.position.x+=50;builder.collisionCheckAt=-Infinity;builder.prepareWeatherCover();
 point.set(.2,0,.2).applyMatrix4(building.matrixWorld);
 assert.equal(builder.walkHeightAt(point.x,point.z,20),3,'Build movement invalidates spatial cache');
 const {MedievalCityFloor}=await server.ssrLoadModule('/src/world/MedievalCityFloor.ts');
 const floor=new MedievalCityFloor(new T.Scene()),stairs=new T.Group();floor.root.add(stairs);
 stairs.position.set(15,2,4);stairs.rotation.set(.08,.43,.02);stairs.scale.set(1.2,1.1,.9);
 floor.stairSurfaces.push({group:stairs,width:5,length:19,top:18,bottom:10,count:24});
 for(const offset of [0,30]){
  stairs.position.x+=offset;stairs.updateWorldMatrix(true,false);
  for(const along of [1,5,10,18]){
   const p=new T.Vector3(.4,0,along).applyMatrix4(stairs.matrixWorld);
   const local=stairs.worldToLocal(new T.Vector3(p.x,stairs.position.y,p.z));
   const step=Math.min(23,Math.floor(local.z/19*24));
   const expected=stairs.localToWorld(new T.Vector3(local.x,18-8*step/24+.06,local.z)).y;
   assert(Math.abs(floor.stairHeightAt(p.x,p.z)-expected)<1e-9,'Cached stair transforms preserve exact original height');
  }
 }
 // Compare the broad phase with the previous unfiltered candidate loop.
 building.userData.localColliders=Array.from({length:40},(_,i)=>[i%8*2,0,Math.floor(i/8)*2,i%8*2+.4,5,Math.floor(i/8)*2+.4]);
 building.userData.colliderRevision=1;builder.collisionCheckAt=-Infinity;builder.prepareWeatherCover();
 const shapes=builder.collisionShapes;
 for(let i=0;i<400;i++){
  const p=new T.Vector3((i%20)*.8,1,Math.floor(i/20)*.6).applyMatrix4(building.matrixWorld),reference=p.clone();
  builder.resolveCollisions(p,.32);
  const saved=shapes.map(shape=>shape.bounds);
  shapes.forEach(shape=>shape.bounds=new T.Box3(new T.Vector3(-Infinity,-Infinity,-Infinity),new T.Vector3(Infinity,Infinity,Infinity)));
  builder.resolveCollisions(reference,.32);
  shapes.forEach((shape,index)=>shape.bounds=saved[index]);
  assert(p.distanceTo(reference)<1e-9,'Broad-phase rejection preserves collision resolution');
 }
 let heights=0;
 const nav=new ResidentNavigation(),search=nav.routeSteps(new T.Vector3(),new T.Vector3(100,0,0),()=>{heights++;return 0;},()=>{});
 let maxHeightCalls=0,result;
 do{const before=heights;result=search.next();maxHeightCalls=Math.max(maxHeightCalls,heights-before);}while(!result.done);
 assert(result.value.length>40);assert(maxHeightCalls<=4,'Path reconstruction yields between height queries');
 console.log(JSON.stringify({surfaces:500,averageCandidates:candidateCount/queries,maxHeightCallsPerNavigationStep:maxHeightCalls,transformsAndPolygons:'preserved'}));
}finally{await server.close();}
