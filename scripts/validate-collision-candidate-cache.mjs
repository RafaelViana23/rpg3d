import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const builder=new LowPolyCityBuilder(new T.Scene(),()=>0),owner=new T.Group();
 owner.userData.localColliders=[[-1,0,-1,1,4,1]];owner.userData.localFlightColliders=[[-1,6,-1,1,8,1]];builder.root.add(owner);builder.objects.set('owner',owner);builder.prepareWeatherCover();
 const original=(x,z,r,walk)=>{const result=new Set();for(let gx=Math.floor((x-r)/16);gx<=Math.floor((x+r)/16);gx++)for(let gz=Math.floor((z-r)/16);gz<=Math.floor((z+r)/16);gz++)for(const s of builder.collisionGrid.get(`${gx}:${gz}`)??[])if(!walk||!s.flightOnly)result.add(s);return [...result];};
 for(const x of [-16.1,-1,0,15.9,16])for(const z of [-16.1,-1,0,15.9,16])for(const r of [.32,1.32,18])for(const walk of [false,true])assert.deepEqual(builder.nearbyColliders(x,z,r,walk),original(x,z,r,walk),'Identical shape references, deduplication and insertion order at cell boundaries');
 assert.equal(builder.nearbyColliders(0,0,1,true).length,1);assert.equal(builder.nearbyColliders(0,0,1,false).length,2,'Flight candidates include roof shapes');
 const cached=builder.nearbyColliders(0,0,1,true);assert.equal(cached,builder.nearbyColliders(.1,.1,1,true),'Same cell rectangle reuses candidates');
 owner.userData.localColliders.push([3,0,-1,4,4,1]);owner.userData.colliderRevision=1;builder.collisionCheckAt=-Infinity;builder.prepareWeatherCover();
 assert.notEqual(builder.nearbyColliders(0,0,1,true),cached,'New props/door revisions invalidate candidates');
 const point=new T.Vector3(3.5,0,0);builder.resolveCollisions(point,.32);assert.notEqual(point.x,3.5);
 owner.position.x=100;builder.collisionCheckAt=-Infinity;builder.prepareWeatherCover();assert.equal(builder.nearbyColliders(0,0,1,true).length,0,'Build movement removes obsolete cells');assert.equal(builder.nearbyColliders(100,0,1,true).length,2);
 for(let i=0;i<2100;i++)builder.nearbyColliders(i*32,300,1,true);assert(builder.collisionCandidates.size<=2048,'Long travel cannot grow cache without a bound');
 console.log('Candidate cache: boundary order, deduplication, walking/flight separation, loading/door revisions, Build movement and bounded memory OK.');
}finally{await server.close();}
