import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {OpenWorld}=await server.ssrLoadModule('/src/world/OpenWorld.ts');
 const world=Object.create(OpenWorld.prototype);
 Object.assign(world,{config:{worldSize:2048,chunkSize:128,viewRadius:2,propRadius:1},chunks:new Map(),editorOverview:true,flightOverview:false,worldPreset:'arena-island-v1',settledStreamingKey:''});
 let loads=0,unloads=0;
 world.loadChunk=(x,z,detail)=>{loads++;world.chunks.set(`${x}:${z}`,{key:`${x}:${z}`,detail});};
 world.unloadChunk=chunk=>{unloads++;world.chunks.delete(chunk.key);};
 for(let i=0;i<40;i++){const before=loads;world.update(new T.Vector3());assert(loads-before<=1,'One region generated per frame');}
 assert.equal(world.chunks.size,25,'Build retains a 5×5 neighborhood, not all 256 regions');
 const oldKeys=new Set(world.chunks.keys());
 for(let i=0;i<40;i++)world.update(new T.Vector3(850,0,850));
 assert(world.chunks.size<=25);assert(unloads>0);assert([...oldKeys].every(key=>!world.chunks.has(key)),'Distant regions unloaded after moving camera target');
 world.flightOverview=true;world.settledStreamingKey='';for(let i=0;i<40;i++)world.update(new T.Vector3(850,0,850));assert(world.chunks.size<=25,'Editor remains regional even if flight was active');
 const {waitForCityPropSlot,updateCityPropLoading}=await server.ssrLoadModule('/src/editor/CityPropLoading.ts');
 const scene=new T.Scene(),near=new T.Group(),far=new T.Group();scene.add(near,far);far.position.x=1000;
 let nearLoaded=false,farLoaded=false;waitForCityPropSlot(near).then(()=>nearLoaded=true);waitForCityPropSlot(far).then(()=>farLoaded=true);
 updateCityPropLoading(new T.Vector3(),true);await Promise.resolve();assert(nearLoaded);assert(!farLoaded);
 updateCityPropLoading(new T.Vector3(1000,0,0),true);await Promise.resolve();assert(farLoaded);
 console.log('Build: bounded camera regions, one chunk/frame, distant unloads and regional prop loading OK.');
}finally{await server.close();}
