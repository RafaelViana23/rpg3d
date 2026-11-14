import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createMedievalBuilding}=await server.ssrLoadModule('/src/editor/MedievalBuildings.ts');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 const inn=createMedievalBuilding('inn');inn.updateMatrixWorld(true);
 assert.equal(inn.userData.building.storeys,3);assert.equal(inn.userData.building.width,44);assert.equal(inn.userData.building.depth,24);
 assert.deepEqual(inn.position.toArray(),[0,0,0]);assert.deepEqual(inn.scale.toArray(),[1,1,1]);
 assert.equal(inn.userData.innRooms.filter(r=>!r.bath).length,7);
 assert.equal(inn.userData.innRooms.filter(r=>r.bath).length,0);
 for(const floor of [0,5,10]){
  const partitions=floor===0?[3,16.3]:floor===5?[-10,-.2,9.6]:[-10,-2,5,11];
  const rear=inn.userData.windows.filter(w=>w.z===-12&&w.y===floor+2.65);
  for(const window of rear)assert(partitions.every(x=>Math.abs(window.x-x)>=2.15/2+.18/2),'Rear windows and curtains clear room partitions');
  for(const x of [-17,-10,-3.5,3.5,10,17].filter(x=>!rear.some(w=>w.x===x))){
   const ray=new T.Raycaster(new T.Vector3(x,floor+2.65,-13),new T.Vector3(0,0,1),0,1.5);
   assert(ray.intersectObject(inn,true).length,'Removed window aperture is filled with wall');
  }
 }
 for(const y of [5,10]){
  for(const z of [-9,10])assert(inn.userData.walkSurfaces.some(s=>s[0]<=19&&s[2]>=19&&s[1]<=z&&s[3]>=z&&s[4]===y),'Supported stair landing');
  const ray=new T.Raycaster(new T.Vector3(-6,y+.2,3),new T.Vector3(0,-1,0),0,.6);
  assert(ray.intersectObject(inn,true).length,'Real opaque floor beneath corridor');
  assert(!inn.userData.localColliders.some(c=>c[0]<-6&&c[3]>-6&&c[2]<3&&c[5]>3&&c[1]<y+2&&c[4]>y+.2),'Clear hall');
 }
 for(const room of inn.userData.innRooms){
  assert(!inn.userData.localColliders.some(c=>c[0]<room.x&&c[3]>room.x&&c[2]<0&&c[5]>0&&c[1]<room.y+2&&c[4]>room.y+.1),'Room doorway open');
 }
 const roof=new T.Raycaster(new T.Vector3(0,14,0),new T.Vector3(0,1,0),0,10);
 assert(roof.intersectObject(inn,true).length,'Real ceiling blocks sun');
 assert(inn.children.some(o=>o.material===CITY_WOOD_MATERIAL));
 const flights=inn.userData.innFlights;assert.equal(flights.length,2);
 assert((flights[0].end-flights[0].start)*(flights[1].end-flights[1].start)<0,'Flights reverse direction');
 assert(flights[1].right<flights[0].left,'Flights are side by side, with a supported divider');
 assert.equal(flights[0].end,flights[1].start,'Return uses the same landing');
 for(const f of flights)for(let i=0;i<24;i++){
  const z=f.start+(f.end-f.start)*(i+.5)/24,top=f.from+(i+1)*(f.to-.08-f.from)/24;
  const ray=new T.Raycaster(new T.Vector3((f.left+f.right)/2,top+.025,z),new T.Vector3(0,-1,0),0,.06);
  assert(ray.intersectObject(inn,true).some(hit=>Math.abs(hit.point.y-top)<1e-5),'Actual tread matches support in both directions');
 }
 for(const y of [5,10])assert(!inn.userData.localColliders.some(c=>c[0]<15&&c[3]>15&&c[2]<0&&c[5]>0&&c[1]<y+2&&c[4]>y+.1),'L-shaped hall has no former washroom wall');
 assert(inn.userData.innOffice,'Office has a door opening');
 console.log('Selena inn: 3 floors, 44×24, 7 bedrooms, no baths, 2 return flights, clear doors/halls, opaque ceilings and unchanged root transform.');
}finally{await server.close();}
