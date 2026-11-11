import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {createCityTower,TOWER_GROUND,TOWER_WALL_LANDING,TOWER_TOP,containsWalkPolygon} from './src/editor/CityTower';export {LowPolyCityBuilder,createCityAsset} from './src/editor/LowPolyCityBuilder';export {advancePlayerVertical} from './src/player/PlayerVerticalMotion';export {addCityFirelight,updateCityFirelights} from './src/editor/CityFirelight';export {cityPavingMaterial} from './src/world/CityPaving';export * as T from 'three';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {createCityTower,TOWER_GROUND,TOWER_WALL_LANDING,TOWER_TOP,LowPolyCityBuilder,createCityAsset,advancePlayerVertical,addCityFirelight,updateCityFirelights,cityPavingMaterial,T}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const scene=new T.Scene(),builder=new LowPolyCityBuilder(scene,()=>0),tower=createCityTower();tower.scale.setScalar(5);builder.root.add(tower);builder.objects.set('tower',tower);
assert.equal(tower.userData.towerPortals.length,3);assert.equal(tower.userData.towerPortals.filter(p=>!p.ground).length,2);
assert(Math.abs(TOWER_WALL_LANDING*5-6.225*3.75-.1)<.00001,'Middle floor sits ten centimetres above the battlement');
const heightAt=(angle,r,feet)=>builder.walkHeightAt(r*Math.cos(angle)*5,r*Math.sin(angle)*5,feet);
let feet=TOWER_GROUND*5-.06;
for(const step of tower.userData.spiralSteps){
  const height=heightAt(step.angle,2.3,feet);
  assert(height!==null&&Math.abs(height-step.height*5)<.001,`Unwalkable spiral tread at ${step.angle}, ${step.height}: ${height}`);
  const p=new T.Vector3(2.3*Math.cos(step.angle)*5,height-.06,2.3*Math.sin(step.angle)*5),before=p.clone();builder.resolveCollisions(p,.35);assert(p.distanceTo(before)<.001,'Tower shell must not block its staircase');
  feet=height-.06;
}
assert(Math.abs(feet+.06-TOWER_TOP*5)<.001);
const wallConnections=tower.userData.towerPortals.filter(p=>!p.ground).map((p,i)=>{
  const wall=createCityAsset('wall');wall.scale.setScalar(3.75);wall.position.set(Math.cos(p.angle)*41.25,0,Math.sin(p.angle)*41.25);wall.rotation.y=-p.angle;builder.root.add(wall);builder.objects.set(`wall-${i}`,wall);return wall;
});builder.collisionCheckAt=-Infinity;
for(const portal of tower.userData.towerPortals){
  const y=portal.bottom*5;
  for(let r=3;r<=4.4;r+=.1){
    const p=new T.Vector3(r*Math.cos(portal.angle)*5,y-.06,r*Math.sin(portal.angle)*5),before=p.clone();builder.resolveCollisions(p,.35);assert(p.distanceTo(before)<.001,'Portal opening must be passable');
    if(!portal.ground)assert(Math.abs(heightAt(portal.angle,r,y-.06)-y)<.111,'Both exits need a continuous landing');
  }
}
// The top aperture must remain open above the final approach instead of acquiring a phantom rectangle.
const opening=tower.userData.topStairOpening,angle=(opening.start+opening.end)/2;
assert(heightAt(angle,2.3,TOWER_TOP*5)<TOWER_TOP*5-1,'Actual hole in the top deck');
const ray=new T.Raycaster(new T.Vector3(2.3*Math.cos(angle)*5,TOWER_TOP*5+2,2.3*Math.sin(angle)*5),new T.Vector3(0,-1,0));tower.updateWorldMatrix(true,true);
assert(ray.intersectObject(tower,true)[0].point.y<TOWER_TOP*5-.5,'Rendered deck must have the same opening as walking geometry');
// Reject the spiral's central void, which is inside many tread bounding rectangles.
assert.equal(builder.walkHeightAt(0,0,TOWER_TOP*5),TOWER_GROUND*5);
const wall=wallConnections[0];assert.equal(wall.userData.walkSurfaces[0][4],6.225);assert(wall.userData.localColliders.length>1);
// Check a real folded wall connection in tower-local coordinates.
const portal=tower.userData.towerPortals[1],a=portal.angle;

// Force the bounded collision cache to notice the newly attached wall immediately.
builder.collisionCheckAt=-Infinity;
for(let r=3.1;r<=9;r+=.08){
  const x=r*5*Math.cos(a),z=r*5*Math.sin(a),y=TOWER_WALL_LANDING*5;
  assert(Math.abs(builder.walkHeightAt(x,z,y-.06)-y)<.111,'Continuous path from tower landing to battlement');
  const p=new T.Vector3(x,y-.06,z),before=p.clone();builder.resolveCollisions(p,.35);assert(p.distanceTo(before)<.001,'Clear passage between tower and battlement');
}
console.log('Spiral ascent, intermediate floor, two wall exits, ground portal, open top deck and tower-to-wall traversal validated.');

assert(TOWER_GROUND*5>4.03,'Interior slab must clear the city paving');
assert(!tower.children.some(o=>o.material?.map),'Tower floors, steps and landings are smooth without texture');
const entrance=tower.userData.towerPortals.find(p=>p.ground);
assert(entrance.halfWidth<.5,'Narrower entrance');
for(const t of [-.9,-.5,0,.5,.9]){
  const a=entrance.angle+Math.asin(t*entrance.halfWidth/3.5),head=entrance.bottom+.72+entrance.halfWidth*Math.sqrt(1-t*t);
  const direction=new T.Vector3(-Math.cos(a),0,-Math.sin(a));
  const cast=y=>new T.Raycaster(new T.Vector3(5*Math.cos(a)*5,y*5,5*Math.sin(a)*5),direction).intersectObject(tower,true)[0];
  const below=cast(head-.015),above=cast(head+.015);
  assert(!below||below.distance>7.4,'Arch must remain open just below its continuous curve');
  assert(above&&above.distance<7.4,'Stone must follow the rounded curve without square gaps');
}
console.log('Raised slab, absent wooden doors and continuous narrow semicircular arch validated.');
let smoothOuterVertices=0;
for(const child of tower.children){
  if(!(child instanceof T.Mesh))continue;
  const positions=child.geometry.getAttribute('position'),normals=child.geometry.getAttribute('normal');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z),y=positions.getY(i);
    if(Math.abs(r-4.15)>.0001||y>10.55+.0001)continue;
    const dot=(normals.getX(i)*x+normals.getZ(i)*z)/r;
    if(dot>.5){assert(dot>.99999,'Exterior normals must follow the smooth cylinder');smoothOuterVertices++;}
  }
}
assert(smoothOuterVertices>1500);console.log('Continuous smooth radial shading on the cylindrical tower validated.');

for(const portal of tower.userData.towerPortals){
  const a=portal.angle,origin=new T.Vector3(3.8*Math.cos(a)*5,(portal.bottom+.35)*5,3.8*Math.sin(a)*5);
  for(const side of [-1,1]){
    const ray=new T.Raycaster(origin,new T.Vector3(-Math.sin(a)*side,0,Math.cos(a)*side));
    const hit=ray.intersectObject(tower,true)[0];
    assert(hit&&hit.distance<3,'Both sides of each entrance must have visible solid stone jambs');
  }
}
assert(tower.children.every(mesh=>mesh.material.color.getHexString()!=='39434b'),'Remove the entire staircase handrail');
console.log('Closed entrance sides and removal of the handrail and its supports validated.');

// Falling through the inner stairwell must retain height and land on the first floor crossed.
for(const [initial,target] of [[19,TOWER_GROUND*5],[40,TOWER_WALL_LANDING*5]]){
  let height=initial,velocity=0,frames=0;
  while(frames<400){
    const ground=builder.walkHeightAt(4,0,height,false);
    const next=advancePlayerVertical(height,velocity,ground??4,1/60,22);
    if(frames===0){assert(next.height>initial-.01,'Leaving a stair must not teleport to the ground');assert(next.airborne);}
    assert(next.height<=height,'Fall continues downward');height=next.height;velocity=next.velocity;frames++;
    if(!next.airborne)break;
  }
  assert(frames>30&&frames<400);assert(Math.abs(height-target)<.001,'Land on the first floor below the fall');
}
for(const dt of [1/120,1/60,1/30]){
  let height=30,velocity=0;
  for(let i=0;i<Math.round(1/dt);i++){const state=advancePlayerVertical(height,velocity,0,dt,22);height=state.height;velocity=state.velocity;}
  assert(Math.abs(height-19)<1e-8,'Gravity is independent of frame rate');assert(Math.abs(velocity+22)<1e-8);
}
let jump=advancePlayerVertical(4,8,4,1/60,22);assert(jump.height>4&&jump.airborne);
for(let i=0;i<120&&jump.airborne;i++)jump=advancePlayerVertical(jump.height,jump.velocity,4,1/60,22);
assert.equal(jump.height,4);assert(!jump.airborne,'Jump still lands normally');
console.log('Continuous falls, landing on intermediate floors, frame-independent gravity and jumps validated.');
const middle=tower.userData.middleStairOpening;
for(let i=0;i<120;i++)for(const radius of [.8,1.7,2.7,3.4]){
  const angle=i*Math.PI*2/120,relative=((angle-middle.start)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
  const hole=relative<middle.end-middle.start&&radius>middle.inner&&radius<middle.outer;
  if(hole)continue;
  const actual=builder.walkHeightAt(radius*Math.cos(angle)*5,radius*Math.sin(angle)*5,TOWER_WALL_LANDING*5-.06,false);
  assert(Math.abs(actual-TOWER_WALL_LANDING*5)<.001,'Middle floor fills the tower except its stair aperture');
}
const middleAngle=(middle.start+middle.end)/2;
assert(heightAt(middleAngle,2.3,TOWER_WALL_LANDING*5)<TOWER_WALL_LANDING*5-.5,'Stair aperture stays open');
for(const p of tower.userData.towerPortals.filter(p=>!p.ground))for(const radius of [1.4,2.3,3.2]){
  const origin=new T.Vector3(radius*Math.cos(p.angle)*5,TOWER_WALL_LANDING*5+.02,radius*Math.sin(p.angle)*5);
  const hit=new T.Raycaster(origin,new T.Vector3(0,1,0)).intersectObject(tower,true)[0];
  assert(!hit||hit.distance>2.2,'Rotated stairs leave headroom in front of both wall doors');
}
assert(tower.userData.torchSites.length>=20);
assert(tower.userData.torchSites.some(s=>s.height<TOWER_GROUND+1));
assert(tower.userData.torchSites.some(s=>s.height>TOWER_WALL_LANDING&&s.height<TOWER_WALL_LANDING+1));
assert(tower.userData.torchSites.some(s=>s.height>TOWER_TOP-1));
const colors=new Set(tower.children.map(o=>o.material.color.getHexString()));assert(colors.size>=3,'Stairs, floors, walls and details need visual separation');
console.log('Full middle floor, aligned stair opening, clear doorway headroom, torch distribution and contrasting stone details validated.');

assert(!tower.children.some(o=>o.material===cityPavingMaterial()),'Ground floor uses the smooth tower finish');
for(const p of tower.userData.towerPortals.filter(p=>!p.ground)){
  const direction=new T.Vector2(Math.cos(p.angle),Math.sin(p.angle));
  for(let i=0;i<tower.userData.walkSurfaces.length;i++){
    if(Math.abs(tower.userData.walkSurfaces[i][4]-TOWER_WALL_LANDING)>.001)continue;
    for(const [x,z] of tower.userData.walkSurfacePolygons[i])assert(x*direction.x+z*direction.y<=3.75001,'Tower landing must stop before overlapping the battlement floor');
  }
}
const torch=new T.Group();torch.add(new T.Mesh(new T.BoxGeometry(.1,.5,.1),new T.MeshBasicMaterial()));torch.position.set(30,4,0);torch.userData.alwaysLit=true;const torchHolder=new T.Group();torchHolder.add(torch);scene.add(torchHolder);
addCityFirelight(torch,true,{intensity:96,distance:42});updateCityFirelights(1/60,new T.Vector3(),0,3,.5);
const emitters=scene.children.filter(o=>o.name==='Emissor compartilhado da cidade');assert.equal(emitters.length,3,'Keep the shared light budget');
assert(emitters.some(o=>o.intensity>0&&o.distance===42),'Tower torch must illuminate from thirty metres away');
assert(tower.children.some(o=>o.material?.color?.getHexString()==='66635a'&&!o.material.map),'Smooth floor in the masonry tone');
console.log('Smooth middle floor, non-overlapping wall joins and wide-range illumination within the shared light budget validated.');
const wallStone=tower.children.find(o=>o instanceof T.Mesh&&o.material.color.getHexString()==='d4cbb6');
for(const portal of tower.userData.towerPortals.filter(p=>!p.ground)){
  const radius=3.6,ray=new T.Raycaster(new T.Vector3(radius*Math.cos(portal.angle)*5,TOWER_WALL_LANDING*5+.4,radius*Math.sin(portal.angle)*5),new T.Vector3(0,-1,0));
  const support=ray.intersectObject(wallStone,true)[0];
  assert(support&&support.point.y<TOWER_WALL_LANDING*5-.5,'Stone threshold stays under the wooden slab instead of fighting its surface');
}
console.log('Recessed stone thresholds do not overlap the wooden doorway floors.');
