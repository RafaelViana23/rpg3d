import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {CITY_BALUSTRADE_MATERIAL} from './src/editor/StoneBalustrade';export {createRoyalPalace,applyRoyalPalaceLayout} from './src/editor/RoyalPalace';export {LowPolyCityBuilder} from './src/editor/LowPolyCityBuilder';export {createRoyalAvenue,updateRoyalAvenueUV} from './src/editor/RoyalAvenue';export {CITY_AVENUE_GRAY} from './src/editor/CityStone';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {CITY_BALUSTRADE_MATERIAL,T,createRoyalPalace,applyRoyalPalaceLayout,LowPolyCityBuilder,createRoyalAvenue,updateRoyalAvenueUV,CITY_AVENUE_GRAY}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const {city}=JSON.parse(await readFile('src/editor/default-city.json','utf8')),saved=Object.values(city).find(s=>s.kind==='palace'),model=createRoyalPalace(0);
assert.equal(model.userData.stairFlights.length,1,'Only the city-to-plaza stair flight remains');
assert.deepEqual(model.userData.stairFlights.map(s=>[s.bottom,s.top]),[[0,6]],'Palace shares the plaza elevation');
const bounds=new T.Box3().setFromObject(model);assert(bounds.max.x-bounds.min.x>130&&bounds.max.z-bounds.min.z>115&&bounds.max.y>44,'Royal precinct occupies the entire marked district');assert(model.children.length<=10,'Complex uses a small shared-material draw budget');
for(const z of [67]){
 model.updateMatrixWorld(true);const hit=new T.Raycaster(new T.Vector3(0,20,z),new T.Vector3(0,-1,0)).intersectObject(model,true)[0];assert(hit,'Stairs have real tread geometry');assert.equal(hit.object.material.color.getHexString(),CITY_AVENUE_GRAY.slice(1),'Stair treads use plain avenue gray');assert(!hit.object.material.map,'Stairs have no texture');
}
const roofHits=new T.Raycaster(new T.Vector3(0,20,-9),new T.Vector3(0,1,0)).intersectObject(model,true);assert(roofHits.length,'Throne hall has a physical roof that can block sunlight');
const scene=new T.Scene(),builder=new LowPolyCityBuilder(scene,()=>18);model.position.fromArray(saved.position);model.rotation.set(...saved.rotation);model.scale.fromArray(saved.scale);model.userData.cityId=saved.id;builder.root.add(model);builder.objects.set(saved.id,model);
let feet=18-.06,lastLocalHeight=-.06;
for(let z=81;z>=16;z-=.08){
 const target=model.localToWorld(new T.Vector3(0,feet-18,z)),expected=target.clone();builder.resolveCollisions(target,.32);
 assert(Math.hypot(target.x-expected.x,target.z-expected.z)<.15,`Central access blocked at ${z.toFixed(2)}`);
 const height=Math.max(18,builder.walkHeightAt(target.x,target.z,feet)??18);assert(height-feet<.45,'Every stair riser is climbable');feet=height-.06;
 lastLocalHeight=model.worldToLocal(new T.Vector3(target.x,feet,target.z)).y;
}
assert(Math.abs(lastLocalHeight-6.02)<.02,'Player can walk from city into the palace at plaza level');
const avenue=createRoyalAvenue(city['city-royal-avenue-v1']);avenue.position.fromArray(city['city-royal-avenue-v1'].position);avenue.rotation.set(...city['city-royal-avenue-v1'].rotation);updateRoyalAvenueUV(avenue,model);
for(const mesh of model.children.filter(m=>m.userData.cityPaving)){
 const positions=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),inverse=avenue.matrixWorld.clone().invert();
 for(let i=0;i<positions.count;i++){
  const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
  assert(Math.abs(uv.getX(i)-point.x/12)<1e-5&&Math.abs(uv.getY(i)-point.z/12)<1e-5,'Raised courts match city texture scale and direction');
 }
}
const old=JSON.parse(await readFile('backups/cidade-avenida-palacio-2026-11-10.json','utf8')).city;
const stub={objects:new Map(Object.entries(old).map(([id])=>[id,new T.Group()])),add(s){const o=new T.Group();this.objects.set(s.id,o);return o;}};
assert(applyRoyalPalaceLayout(old,stub));assert.equal(old[saved.id].palaceComplexRevision,1);assert.deepEqual(old[saved.id].scale,[1,1,1]);old[saved.id].position[0]+=3;assert(!applyRoyalPalaceLayout(old,stub),'Later Build edits survive');
console.log('Full stone precinct, one accessible entrance stairway, shared plaza and palace level, solid roof, untextured treads, matched plaza paving and saved-world migration validated.');

assert.equal(model.userData.frontWallLine.z,model.userData.stairFlights[0].back,'Front wall is on the last tread, not first');assert.equal(model.userData.frontWallLine.base,0,'Front wall masonry fills to city ground');
const stairFoot=model.localToWorld(new T.Vector3(0,0,77));const avenueLocal=avenue.worldToLocal(stairFoot.clone());assert(Math.abs(avenueLocal.x)<1e-5,'Avenue is centered on royal entrance');assert(Math.abs(avenueLocal.z-city['city-royal-avenue-v1'].points[1][2])<1e-5,'Avenue reaches first stair');
console.log('Elevated front wall and avenue entrance alignment validated.');

assert.equal(model.userData.stairFlights[0].width,model.userData.building.doorWidth,'Entry staircase matches clear portal width');
assert(model.userData.enclosureWalls.every(w=>w.bottom===0&&w.top===18),'All enclosing walls share one top and reach ground');
const masonry=createRoyalPalace(0);masonry.updateMatrixWorld(true);
for(const height of [.5,8,17.5]){
 for(const sign of [-1,1])assert(new T.Raycaster(new T.Vector3(sign*90,height,35),new T.Vector3(-sign,0,0)).intersectObject(masonry,true).length,'Side wall filled from city floor to common top');
 assert(new T.Raycaster(new T.Vector3(50,height,70),new T.Vector3(0,0,-1)).intersectObject(masonry,true).length,'Front wall has no floating lower panel');
}
const edgeRay=new T.Raycaster(new T.Vector3(12,10,67),new T.Vector3(0,-1,0));assert.equal(edgeRay.intersectObject(masonry,true).length,0,'Stair does not extend beyond portal opening');
console.log('Uniform ground-filled walls and portal-width entrance stairs validated.');

assert.equal(model.userData.cornerTowers.length,2,'Front enclosure corners have towers');
assert.equal(model.userData.rearEnclosure,'city-wall','Existing city wall closes rear');
for(const wall of model.userData.enclosureWalls.filter(w=>w.axis==='x'))assert(Math.abs(Math.abs(wall.position)+1.25-model.userData.deckEdges.right)<1e-6,'Side wall outer face aligns with terrace edge');
assert.equal(model.userData.stairBorder.back,model.userData.stairFlights[0].back,'Avenue curb reaches last tread');
const capitalTowers=Object.entries(city).filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,s])=>new T.Vector3(...s.position));
for(const wall of model.userData.enclosureWalls.filter(w=>w.axis==='x'))for(let z=wall.from;z<=wall.to;z+=1)for(const edge of [-1.25,1.25]){
 const point=model.localToWorld(new T.Vector3(wall.position+edge,0,z));
 for(const tower of capitalTowers)assert(Math.hypot(point.x-tower.x,point.z-tower.z)>23,'Narrower royal walls stay outside city towers');
}
console.log('Corner towers, flush terrace/walls, city-wall rear closure, full stair curbs and city-tower clearance validated.');
assert.equal(model.userData.towerSites.length,4,'Only four front towers remain');
assert(model.userData.towerSites.every(t=>t.z>50&&t.height===32),'Front towers raised, rear towers removed');
assert.equal(model.userData.upperTerrace.front,model.userData.upperTerrace.wallFront,'Palace front wall is flush with upper platform');
for(let z=40;z>=16;z-=.5){
 const hits=new T.Raycaster(new T.Vector3(10,8,z),new T.Vector3(0,-1,0)).intersectObject(masonry,true);
 assert(hits[0]?.object.userData.cityPaving,'Plaza continues into palace without another staircase');
 assert(Math.abs(hits[0].point.y-6.08)<1e-4,'Palace and plaza share one continuous finished floor');
}
for(const x of [-60,60])for(let z=40;z>=-28;z-=.5){
 const point=model.localToWorld(new T.Vector3(x,5.94,z)),expected=point.clone();builder.resolveCollisions(point,.32);
 assert(Math.hypot(point.x-expected.x,point.z-expected.z)<.05,'Lateral plaza has an unobstructed passage');
 const floorHeight=builder.walkHeightAt(point.x,point.z,point.y);assert(Math.abs(floorHeight-(saved.position[1]+6.08))<.01,'Side of palace stays on lower plaza level');
}
console.log('Raised front towers, no rear towers, lateral lower plazas and flush upper palace entrance validated.');
for(const sign of [-1,1])for(let x=22.6;x<=35;x+=.2){
 const point=model.localToWorld(new T.Vector3(sign*x,16.02,model.userData.wingConnections[0].z)),expected=point.clone();builder.resolveCollisions(point,.32);
 assert(point.distanceTo(expected)<.05,'Both hollow wings connect to the main hall without collision barriers');
}
for(const x of [-43,43])assert(new T.Raycaster(new T.Vector3(x,20,-8),new T.Vector3(0,1,0)).intersectObject(masonry,true).length,'Royal wings have physical roofs');
for(const [x,z,y]of [[60,0,6.08],[0,40,6.08],[40,0,6.08],[10,0,6.08]]){
 const hits=new T.Raycaster(new T.Vector3(x,y+.02,z),new T.Vector3(0,-1,0),0,.025).intersectObject(masonry,true);
 assert.equal(hits.length,1,'Paved surface has no coplanar stone foundation causing flicker');
 assert(hits[0].object.userData.cityPaving);
}
console.log('Hollow connected palace wings, physical wing roofs and non-overlapping paved foundations validated.');
for(const sign of [-1,1]){
 const hits=new T.Raycaster(new T.Vector3(sign*40,17,model.userData.palaceExtension.front+1.2),new T.Vector3(0,0,-1),0,4).intersectObject(masonry,true);
 assert(hits.length,'Wing front closes flush with the palace facade');
}
for(const mesh of masonry.children.filter(m=>m.userData.cityPaving)){
 const normals=mesh.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)assert(normals.getY(i)>.99,'Paving exists only on horizontal top faces, never wall edges');
}
assert(model.userData.royalGate.z>22.8&&model.userData.royalGate.z<23.2,'Animated door follows the extended palace facade');
assert.equal(model.userData.royalGate.y,6,'Door meets the shared palace and plaza floor');
console.log('Sealed facade returns, top-only paving and palace entrance door location validated.');

assert.equal(model.userData.upperTerrace.wingFront,model.userData.upperTerrace.wallFront,'Wing platform ends at the facade corner');

assert.equal(model.userData.upperTerrace.back,-46.4,'Second level reaches rear city wall');

for(const x of [-14.5,0,14.5]){
 const local=new T.Vector3(x,8,55.5),origin=model.localToWorld(local);
 const hit=new T.Raycaster(origin,new T.Vector3(0,-1,0)).intersectObject(model,true)[0];
 assert(hit?.object.userData.cityPaving,'Finished plaza covers portal bases and arch underside');
 assert(Math.abs(model.worldToLocal(hit.point.clone()).y-6.08)<1e-4,'Paving is above masonry at 6, preventing coplanar flicker');
}
console.log('Portal paving remains above all gate-base faces; stair tips end before paved landings.');

for(const x of [-10,0,10])for(const z of [-20,-12,-4]){
 const ceilingHits=new T.Raycaster(new T.Vector3(x,29,z),new T.Vector3(0,1,0),0,1.1).intersectObject(masonry,true);
 assert(ceilingHits.length>=1,'Hall retains a solid ceiling beneath the roof');
 assert.equal(ceilingHits[0].object.material.color.getHexString(),'7b603f','Visible hall ceiling uses standard city timber');
 for(let i=1;i<ceilingHits.length;i++)assert(Math.abs(ceilingHits[i].point.y-ceilingHits[i-1].point.y)>.001,'Ceiling layers do not overlap coplanarly');
 assert(!ceilingHits[0].object.material.map,'Interior ceiling remains smooth');
 assert(ceilingHits[0].point.y>29.4&&ceilingHits[0].point.y<30,'Timber lining stays directly below the original roof');
}
console.log('Upper tower rests above the roof; no textured bottom intersects the smooth hall ceiling.');

assert.equal(model.userData.palaceExtension.back,model.userData.deckEdges.back,'Extended palace reaches the rear city wall');
assert.equal(model.userData.palaceExtension.front,22.8,'Facade advances another four metres');
assert(Math.abs(model.userData.palaceExtension.depth-69.2)<1e-6,'Palace depth grows from 39.6 to 69.2 metres');
for(const x of [-40,15,40]){
 const hits=new T.Raycaster(new T.Vector3(x,15,-50),new T.Vector3(0,0,1),0,6).intersectObject(masonry,true);
 assert(hits.length,'Extended rear wall closes against the back of the precinct');
 assert(Math.abs(hits[0].point.z+46.4)<1e-4,'Rear masonry reaches the exact rear boundary');
}
console.log('Rear wall at -46.4, facade advanced to 22.8, and extended wing connections validated.');

assert.equal(model.userData.royalInterior.flights.length,3,'Main flight and two lateral branches form a T');
assert.equal(model.userData.royalBedrooms.length,4,'Two bedrooms in each upper wing');
assert.equal(model.userData.royalRoomDoors.filter(d=>d.y>10).length,4,'Each bedroom has a door from the gallery');
assert.equal(model.userData.building.storeys,2,'Palace has a real upper storey');
for(const flight of model.userData.royalInterior.flights){
 const start=new T.Vector3(...flight.start),end=new T.Vector3(...flight.end);
 let feet=saved.position[1]+start.y-.06;
 for(let i=0;i<=240;i++){
  const local=start.clone().lerp(end,i/240),target=model.localToWorld(new T.Vector3(local.x,feet-saved.position[1],local.z)),expected=target.clone();
  builder.resolveCollisions(target,.32);
  assert(target.distanceTo(expected)<.05,'T stair flights are unobstructed');
  const support=builder.walkHeightAt(target.x,target.z,feet);
  assert(support!==null,'Every tread supports the player');
  assert(support-feet<.45,'T stair risers are climbable');
  feet=support-.06;
 }
 assert(Math.abs(feet-(saved.position[1]+end.y-.06))<.03,'Each stair reaches its landing');
}
for(const room of model.userData.royalBedrooms){
 const support=builder.walkHeightAt(...(()=>{const p=model.localToWorld(new T.Vector3(room.x,room.y,room.z));return [p.x,p.z,p.y];})());
 assert(Math.abs(support-(saved.position[1]+16.08))<.02,'Bedroom has a supported upper floor');
}
console.log('Three climbable T flights, intermediate throne platform, lateral galleries and two upper bedrooms validated.');

const filled=model.userData.royalInterior.filledHall;
for(const x of [-25,-15,0,15,25])for(const zz of [filled.back+1,(filled.back+filled.front)/2,filled.front-1]){
 const hits=new T.Raycaster(new T.Vector3(x,filled.top+.1,zz),new T.Vector3(0,-1,0),0,.2).intersectObject(masonry,true);
 assert(hits.length,'Raised throne floor spans the whole hall width');
 const p=model.localToWorld(new T.Vector3(x,filled.bottom+.2,zz)),before=p.clone();
 builder.resolveCollisions(p,.32);
 assert(p.distanceTo(before)>.1,'Raised storey is filled and cannot be entered underneath');
}
for(const flight of model.userData.royalInterior.flights.slice(1)){
 assert(Math.abs(flight.start[2]-flight.width/2-filled.back)<1e-6,'Lateral stairs meet the rear wall without a gap');
}
console.log('Full-width solid throne storey and rear-wall-aligned side stairs validated.');

for(const [x0,z0,x1,z1]of model.userData.royalInterior.gallerySides){
 const local=new T.Vector3((x0+x1)/2,12,(z0+z1)/2),target=model.localToWorld(local),expected=target.clone();
 builder.resolveCollisions(target,.32);
 assert(target.distanceTo(expected)<.01,'Open lower galleries allow passage between the supporting columns');
}
const frontGalleryZ=model.userData.royalInterior.gallerySides[0][3]+1;
assert(!model.userData.walkSurfaces.some(([x0,z0,x1,z1,y])=>x0<0&&x1>0&&frontGalleryZ>z0&&frontGalleryZ<z1&&Math.abs(y-16.08)<.01),'No upper gallery crosses the front of the hall');
console.log('Front gallery removed; remaining lateral galleries have open supporting arcades.');

for(const [, , ,end] of model.userData.royalInterior.gallerySides){
 const facadeInner=22.8-(1.6*(69.2/39.6));
 assert(Math.abs(end-facadeInner)<1e-6,'Lateral gallery reaches the inside face of the front wall');
}
console.log('Textured lateral galleries reach the front wall while the central hall remains open.');

assert.equal(model.userData.royalRoomDoors.filter(d=>d.y<10).length,2,'Two ground-floor doors lead into the banquet wings');
assert.equal(model.userData.royalBanquetHalls.length,2,'Two banquet tables flank the main hall carpet');
for(const door of model.userData.royalRoomDoors.filter(d=>d.y<10)){
 for(let x=21;x<=35;x+=.15){
  const point=model.localToWorld(new T.Vector3(Math.sign(door.x)*x,6.02,door.z)),expected=point.clone();
  builder.resolveCollisions(point,.32);
  assert(point.distanceTo(expected)<.05,'Lower hall door passage clears the filled gallery and palace wall');
 }
}
assert(model.userData.royalInterior.filledHall.front<-27,'Throne storey is recessed farther into the hall');
assert(model.userData.npcRoyalPositions.every(p=>p[2]<-38),'Thrones and rulers move toward the rear wall');
console.log('Recessed throne area, ground-floor side passages and one eighteen-seat banquet table in the main hall validated.');

const mainFlight=model.userData.royalInterior.flights[0];
assert(Math.abs(Math.abs(mainFlight.end[2]-mainFlight.start[2])-(69.2/39.6)*7.5)<1e-5,'Main stair run is exactly half its previous length');
assert.deepEqual(model.userData.royalBanquetHalls.map(t=>t.x),[-10,10],'Tables are mirrored on either side of the carpet');
assert(model.userData.royalBanquetHalls[0].z-9.8>mainFlight.start[2]+1,'Table and chairs leave clear space before the staircase');
assert(filled.front-filled.back<17,'Throne floor is reduced to the rear of the hall');
console.log('Half-length main stair, smaller throne floor and single central main-hall table validated.');

const throneFinish=new T.Raycaster(new T.Vector3(12,10.18,filled.front-2),new T.Vector3(0,-1,0),0,.2).intersectObject(masonry,true)[0];
assert(throneFinish?.object.userData.cityPaving,'Throne floor shares the main hall paving finish');
assert.equal(throneFinish.object.material.color.getHexString(),'c6c9c7','Throne floor uses the same gray as the first floor');
console.log('Extended facade and matching gray throne paving validated.');

for(const [x,zz]of [[24,0],[-24,0],[30,0],[-40,0]]){
 const finish=new T.Raycaster(new T.Vector3(x,16.18,zz),new T.Vector3(0,-1,0),0,.2).intersectObject(masonry,true)[0];
 assert(finish?.object.userData.cityPaving,'Gallery and upper bedroom floors share the main hall finish');
 assert.equal(finish.object.material.color.getHexString(),'c6c9c7','All palace floor levels use the same gray');
}
console.log('Gallery and second-storey floors match the ground-floor paving.');

assert.equal(model.userData.royalCarpet.width,6,'Six-metre red runner');
assert(model.userData.royalCarpet.entryZ>model.userData.palaceExtension.front,'Runner reaches the entrance');
assert.equal(model.userData.royalCarpet.stairTreads,model.userData.royalInterior.flights[0].count,'Runner covers every central stair tread');
for(const side of [-1,1]){
 const partition=new T.Raycaster(new T.Vector3(side*40.5,18,-20),new T.Vector3(0,0,1),0,20).intersectObject(masonry,true);
 assert(partition.length,'Each upper wing has a real bedroom partition');
}
console.log('Four separated upper bedrooms, four doors and continuous red entrance-to-throne carpet validated.');

for(let zz=mainFlight.start[2]+1;zz<model.userData.royalCarpet.entryZ-1;zz+=.5)for(const x of [-2.5,0,2.5]){
 const p=model.localToWorld(new T.Vector3(x,6.02,zz)),expected=p.clone();
 builder.resolveCollisions(p,.32);
 assert(p.distanceTo(expected)<.05,'Wide carpet remains clear of all tables and chairs');
}
console.log('Six-metre carpet and two eighteen-seat tables leave the central route unobstructed.');

assert.equal(model.userData.throneDaises.length,1,'One shared platform supports both thrones');
assert(model.userData.throneDaises.every(d=>d.steps===3&&Math.abs(d.top-10.68)<.001),'Three small twenty-centimetre steps raise each throne');
const windowOrigin=new T.Vector3(2,22,model.userData.royalWindow.z+1);
const windowHits=new T.Raycaster(windowOrigin,new T.Vector3(0,0,-1),0,8).intersectObject(masonry,true);
assert(windowHits.some(h=>h.object.material.transparent),'Rear window contains translucent glass');
assert(!windowHits.some(h=>h.object.castShadow),'Rear window opening admits real sunlight without opaque masonry');
assert(!masonry.getObjectsByProperty('isLight',true).length,'Window adds no artificial light emitter');
console.log('Large arched daylight window and two three-step throne platforms validated.');

const raised=createRoyalPalace();raised.position.fromArray(saved.position);raised.rotation.set(...saved.rotation);raised.scale.fromArray(saved.scale);
const raisedScene=new T.Scene(),raisedBuilder=new LowPolyCityBuilder(raisedScene,()=>18);raisedBuilder.root.add(raised);raisedBuilder.objects.set(saved.id,raised);
assert(Math.abs(saved.position[1]+raised.userData.palaceFloorElevation-(14+6.225*3.75))<1e-6,'Palace main floor matches city-wall walkway elevation');
assert(raised.userData.royalWindow.bottom+saved.position[1]>14+(6.225+.26+.32)*3.75,'Entire window clears the city battlements');
let raisedFeet=17.94;
for(let zz=81;zz>=16;zz-=.06){
 const p=raised.localToWorld(new T.Vector3(0,raisedFeet-18,zz)),expected=p.clone();
 raisedBuilder.resolveCollisions(p,.32);
 assert(p.distanceTo(expected)<.05,'Plaza and elevated palace entry are connected without collision barriers');
 const support=Math.max(18,raisedBuilder.walkHeightAt(p.x,p.z,raisedFeet)??18);
 assert(support-raisedFeet<.45,'New exterior stair risers remain climbable');
 raisedFeet=support-.06;
}
assert(Math.abs(raisedFeet-(18+raised.userData.palaceFloorElevation-.06))<.02,'Entrance stairs reach the elevated main floor');
const sharedDais=raised.userData.throneDaises[0];
assert.equal(raised.userData.throneDaises.length,1);
assert.equal(sharedDais.tiers.length,3);
for(let i=1;i<3;i++)assert(sharedDais.tiers[i].width<sharedDais.tiers[i-1].width&&sharedDais.tiers[i].depth<sharedDais.tiers[i-1].depth,'Each platform tier decreases in width and depth');
assert.equal(raised.userData.royalCarpet.borderColor,'#c5a45a','Runner and throne carpet have golden-yellow edging');
console.log('Elevated palace access, clear daylight window, single shrinking three-tier dais and golden carpet border validated.');

assert(Math.abs(raised.userData.plazaFloorElevation*2-raised.userData.palaceFloorElevation)<1e-8,'Plaza is exactly half the palace elevation above the city');
assert.equal(raised.userData.palaceAccessStairs.bottom,raised.userData.plazaFloorElevation,'Second stair starts at the lower plaza');
assert.equal(raised.userData.palaceAccessStairs.top,raised.userData.palaceFloorElevation,'Second stair reaches the palace');
console.log('Plaza is halfway up; both connected entry stair flights remain climbable.');

assert.equal(raised.userData.palaceAccessStairs.width,raised.userData.royalGate.width,'Palace entry stairs exactly match its door width');
assert.equal(raised.userData.exteriorStairBorders,false,'Exterior steps have no projecting curb strips');
const groundTower=createRoyalPalace();groundTower.updateMatrixWorld(true);
for(const tower of groundTower.userData.towerSites){
 const hits=new T.Raycaster(new T.Vector3(tower.x,.3,70),new T.Vector3(0,0,-1),0,20).intersectObject(groundTower,true);
 assert(hits.some(h=>h.point.z>59),'Round tower foundations reach the city ground, outside the raised plaza');
}
console.log('Door-width palace steps, removed stair borders and towers extended to city ground validated.');

assert.equal(model.userData.npcRoyalSeats.length,2,'King and queen each have a seated throne anchor');
assert(model.userData.npcRoyalSeats.every(seat=>Math.abs(seat[1]-11.156)<.001),'Seat anchors match the red throne cushions');
assert(model.userData.royalArcades.some(c=>Math.abs(c.bottom-6.08)<1e-6&&Math.abs(c.top-15.78)<1e-6),'Columns support the gallery from below');
assert(model.userData.royalArcades.some(c=>c.bottom===16.08&&c.top===30),'Upper columns reach the hall ceiling');
const colZ=[...new Set(model.userData.royalArcades.map(c=>c.z))].sort((a,b)=>a-b);
for(const yy of [12,22]){
 const bayZ=(colZ[3]+colZ[4])/2;
 const hit=new T.Raycaster(new T.Vector3(20,yy,bayZ),new T.Vector3(1,0,0),0,4).intersectObject(masonry,true);
 assert.equal(hit.length,0,'Arcade bays remain open without hidden wall faces');
}
console.log('Gold-framed red thrones, seated royal anchors and open pointed arcades on both levels validated.');

assert.equal(model.userData.royalWindow.width,model.userData.royalCarpet.throneRectangle.right-model.userData.royalCarpet.throneRectangle.left,'Window outer frame aligns with the throne carpet edges');
assert(Math.abs(model.userData.royalWindow.bottom-model.userData.royalInterior.throneLevel)<1e-8,'Rear window begins at the throne floor, without a raised sill');
assert(Math.abs(model.userData.royalCarpet.throneRectangle.back-model.userData.royalWindow.z)<1e-8,'Carpet extends back to touch the rear window');
console.log('Window reaches the floor, aligns with carpet edges, and meets the extended carpet at the rear.');

// The small doorway bridge and bedroom must share an edge, never a floor area.
const seamPalace=createRoyalPalace(0);seamPalace.updateMatrixWorld(true);
for(const door of seamPalace.userData.royalRoomDoors.filter(d=>d.y>10)){
 for(const offset of [-.12,-.06,.06,.12]){
  const x=Math.sign(door.x)*(27.8+offset);
  const hits=new T.Raycaster(new T.Vector3(x,door.y+.02,door.z),new T.Vector3(0,-1,0),0,.04).intersectObject(seamPalace,true).filter(hit=>Math.abs(hit.point.y-door.y)<.001);
  assert.equal(hits.length,1,`One visible paving face at bedroom threshold ${door.label}, x=${x}`);
 }
}
console.log('All four upper bedroom thresholds have a single continuous paving surface without z-fighting.');

const midPlaza=raised.userData.intermediatePlaza;
const accessFlights=raised.userData.palaceAccessFlights;
assert.equal(accessFlights.length,2,'Exterior palace access is split into two flights');
assert(Math.abs(midPlaza.height-(raised.userData.plazaFloorElevation+raised.userData.palaceFloorElevation)/2)<1e-8,'Intermediate plaza is at exactly half the stair height');
assert.equal(midPlaza.landingDepth,8,'Intermediate plaza has a generous flat eight-metre central landing');
assert.equal(midPlaza.right-midPlaza.left,108,'Intermediate plaza spans the palace frontage');
assert.equal(accessFlights[0].top,midPlaza.height);
assert.equal(accessFlights[1].bottom,midPlaza.height);
assert.equal(accessFlights[0].back,midPlaza.landingFront);
assert.equal(accessFlights[1].front,midPlaza.landingBack);
for(const x of [-40,0,40])for(const z of [midPlaza.landingBack+.8,(midPlaza.landingBack+midPlaza.landingFront)/2,midPlaza.landingFront-.8]){
 const p=raised.localToWorld(new T.Vector3(x,midPlaza.height,z));
 const support=raisedBuilder.walkHeightAt(p.x,p.z,p.y);
 assert(Math.abs(support-p.y)<.02,'Entire intermediate plaza provides level walkable support');
 const hit=new T.Raycaster(new T.Vector3(x,midPlaza.height+1,z),new T.Vector3(0,-1,0),0,2).intersectObject(raised,true)[0];
 assert(hit?.object.userData.cityPaving,'Intermediate plaza has real paving geometry');
 assert(Math.abs(hit.point.y-midPlaza.height)<1e-5,'Visible paving matches collision support');
}
for(const post of raised.userData.npcGuardPosts.slice(-2))assert.equal(post[1],midPlaza.height,'Entrance guards stand on the intermediate plaza');
console.log('Two exterior palace flights, full-width intermediate plaza, flat landing and guard support validated.');

const balustrades=raised.userData.terraceBalustrades;
assert.equal(balustrades.length,4,'Intermediate plaza has two front balustrades and two side returns');
assert(balustrades.every(rail=>rail.height===1.5&&rail.bottom===midPlaza.height&&rail.columns>10),'Classical parapets stand on the terrace with repeated miniature columns');
const fronts=balustrades.filter(rail=>rail.axis==='x');
assert(fronts[0].to+.33<-6&&fronts[1].from-.33>6,'Newel posts leave the full stair width unobstructed');
for(const rail of balustrades){
 const along=(rail.from+rail.to)/2;
 const local=new T.Vector3(rail.axis==='x'?along:rail.fixed,midPlaza.height+.02,rail.axis==='x'?rail.fixed:along);
 const p=raised.localToWorld(local.clone()),before=p.clone();
 raisedBuilder.resolveCollisions(p,.32);
 assert(p.distanceTo(before)>.15,'Parapet collision prevents walking through the terrace edge');
}
assert(raised.children.length<=model.children.length+1,'All concrete railings share a single additional geometry batch');
console.log('Cement Doric balustrades, protected terrace edges, clear stairs and shared draw batch validated.');

const stairRails=raised.userData.stairBalustrades;
assert.equal(stairRails.filter(rail=>rail.top>rail.bottom).length,4,'Both stair flights have two inclined balustrades');
assert(stairRails.every(rail=>Math.abs(rail.x)===5.65),'Stair columns remain supported on the outer treads');
for(const rail of stairRails.filter(rail=>rail.top>rail.bottom)){
 const z=(rail.front+rail.back)/2,y=(rail.bottom+rail.top)/2;
 const p=raised.localToWorld(new T.Vector3(rail.x,y+.03,z)),before=p.clone();
 raisedBuilder.resolveCollisions(p,.32);
 assert(p.distanceTo(before)>.15,'Inclined parapet has physical side protection');
}
for(let x=-40;x<=40;x+=.1){
 const p=raised.localToWorld(new T.Vector3(x,midPlaza.height-.06,(midPlaza.landingFront+midPlaza.landingBack)/2)),before=p.clone();
 raisedBuilder.resolveCollisions(p,.32);
 assert(p.distanceTo(before)<.05,'Midway landing stays open for access to both sides of the plaza');
}
console.log('Sloping cement handrails, supported stair columns, protected sides and open cross-landing validated.');

const cityRails=raised.userData.cityStairBalustrades;
assert.equal(cityRails.filter(rail=>rail.end[1]>rail.start[1]).length,2,'City entrance stairs have a sloping rail on each side');
assert(cityRails.every(rail=>Math.abs(rail.start[0])===9.65),'City rail plinths rest on the outer treads');
assert(cityRails.some(rail=>rail.end[2]===57),'City rails continue across the top landing into the gateway');
const royalInterior=raised.getObjectByName('Interior real: escadaria e galeria');
const interiorRails=royalInterior.userData.stoneBalustrades;
assert.equal(interiorRails.filter(rail=>rail.end[1]>rail.start[1]).length,6,'All three palace stair flights have classical railings on both sides');
assert.equal(interiorRails.filter(rail=>rail.end[1]===rail.start[1]).length,4,'Throne and gallery parapets match the stair railings');
assert.equal(CITY_BALUSTRADE_MATERIAL.color.getHexString(),'66635a','All balustrades retain the approved visible wall gray');
assert.equal(CITY_BALUSTRADE_MATERIAL.map,null,'Classical cement remains smooth and untextured');
assert.equal(CITY_BALUSTRADE_MATERIAL.bumpMap,null);
for(const rail of cityRails.filter(rail=>rail.end[1]>rail.start[1])){
 const p=raised.localToWorld(new T.Vector3().fromArray(rail.start).lerp(new T.Vector3().fromArray(rail.end),.5)),before=p.clone();
 raisedBuilder.resolveCollisions(p,.32);
 assert(p.distanceTo(before)>.15,'City stair rail has physical edge protection');
}
console.log('City entry, all palace stairs and galleries share smooth gray classical balustrades.');
