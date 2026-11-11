import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 const {CITY_STONE_MATERIAL}=await server.ssrLoadModule('/src/editor/CityStone.ts');
 const {Scene,Vector3,Box3,Raycaster,Group,Mesh,BoxGeometry,MeshBasicMaterial,Matrix4,Box2,Vector2}=await server.ssrLoadModule('three');
 const scene=new Scene(),palace=createRoyalPalace(),builder=new LowPolyCityBuilder(scene,()=>0);builder.root.add(palace);builder.objects.set('palace',palace);palace.updateMatrixWorld(true);
 const room=palace.userData.royalLibrary,library=palace.getObjectByName('Biblioteca Real'),shelves=library.userData.shelves;
 assert(room&&library);assert.equal(room.width,palace.userData.royalKitchen.width);
 assert(shelves.length>40,'Bookcases fill the full-length hall');
 assert.deepEqual(new Set(shelves.map(s=>s.wall)),new Set(['interior','exterior','fundo','frente','corredor']));
 for(const [i,shelf]of shelves.entries()){
  const b=shelf.bounds;
  assert(Math.abs(b[4]-b[1]-4.8)<.001,'Bookcase heights match the royal rooms');
  assert(b[0]>-52.4&&b[3]<-27.8,'Shelf stays within the room width');
  for(const other of shelves.slice(i+1)){
   const a=new Box3(new Vector3(...b.slice(0,3)),new Vector3(...b.slice(3))).expandByScalar(-.01);
   const c=other.bounds;assert(!a.intersectsBox(new Box3(new Vector3(...c.slice(0,3)),new Vector3(...c.slice(3)))),'Bookcase footprints never intersect');
  }
 }
 assert(library.userData.shelfRows.length>=4,'Multiple parallel shelf banks form aisles');
 assert(library.userData.shelfAisleWidth>=3.5,'Book aisles allow comfortable circulation');
 assert.equal(library.userData.paintingPlacements.length,4);
 assert.equal(palace.userData.palacePropPlacements.filter(p=>p.room==='royalLibrary'&&p.pack==='potted-plant').length,2);
 for(const z of library.userData.shelfRows)for(const x of [-31,-49]){
  const p=new Vector3(x,room.y,z),before=p.clone();builder.resolveCollisions(p,.32);
  assert(p.distanceTo(before)<.01,'Side passages along shelf banks stay clear');
 }
 assert.equal(library.userData.readingTable.seats,6);assert.equal(library.userData.readingTable.width,6.4);assert.equal(library.userData.readingTable.depth,2.6);
 const door=palace.userData.royalRoomDoors.find(d=>d.label==='Biblioteca Real');assert(door);
 for(let x=-24.1;x>=-34;x-=.1){const p=new Vector3(x,room.y,door.z),before=p.clone();builder.resolveCollisions(p,.32);assert(p.distanceTo(before)<.01,'Gallery-to-library doorway remains clear');}
 const roof=new Raycaster(new Vector3(-40.3,room.y+8,room.z),new Vector3(0,1,0),0,2).intersectObject(library,true);
 assert(roof.some(h=>h.object.material===CITY_WOOD_MATERIAL),'Timber ceiling blocks sunlight with actual geometry');
 const torchLights=palace.userData.palaceLightPlacements.filter(l=>l.pack==='wall-torch'&&l.x<-27.8&&l.y<room.y+8);assert(torchLights.length>=8&&torchLights.every(l=>l.persistent));
 const kitchenWindow=palace.userData.palaceExtension.back+13.8*(palace.userData.palaceExtension.depth/39.6);
 const windowHits=new Raycaster(new Vector3(-55,room.y+3,kitchenWindow),new Vector3(1,0,0),0,4).intersectObject(palace,true);
 assert(windowHits.length&&!windowHits.some(h=>h.object.material===CITY_STONE_MATERIAL),'Library window cuts through exterior masonry');
 assert(palace.userData.palacePropPlacements.some(p=>p.room==='royalLibrary'&&p.pack==='tavern-hearth'));
 const {fitStorageWithoutOverlap}=await server.ssrLoadModule('/src/editor/CityStoragePlacement.ts');
 for(const placement of palace.userData.palacePropPlacements.filter(p=>p.room==='royalLibrary')){
  const bytes=await readFile(`public/models/city/props/${placement.pack}.glb`),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const nodes=g.nodes.map(n=>{const o=new Group();if(n.matrix)o.applyMatrix4(new Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
  g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));
  const model=new Group();g.scenes[g.scene??0].nodes.forEach(i=>model.add(nodes[i]));model.updateMatrixWorld(true);
  const b=new Box3();g.nodes.forEach((n,i)=>{if(n.mesh===undefined)return;for(const p of g.meshes[n.mesh].primitives){const a=g.accessors[p.attributes.POSITION];b.union(new Box3(new Vector3(...a.min),new Vector3(...a.max)).applyMatrix4(nodes[i].matrixWorld));}});
  const size=b.getSize(new Vector3()),prop=new Group(),mesh=new Mesh(new BoxGeometry(...size.toArray()),new MeshBasicMaterial());mesh.position.y=size.y/2;prop.add(mesh);
  prop.scale.setScalar(placement.height/size.y);if(placement.horizontalScale){prop.scale.x*=placement.horizontalScale;prop.scale.z*=placement.horizontalScale;}
  prop.position.set(placement.x,placement.y,placement.z);prop.rotation.y=placement.rotation;
  const area=new Box2(new Vector2(room.x-room.width/2+.05,room.z-room.depth/2+.05),new Vector2(room.x+room.width/2-.05,room.z+room.depth/2-.05));
  assert(fitStorageWithoutOverlap(palace,prop,[palace],area),`${placement.label} fits the actual model bounds`);
  assert(prop.position.distanceTo(new Vector3(placement.x,placement.y,placement.z))<.01,'Fireplace and chimney keep their planned alignment');
  const bounds=new Box3().setFromObject(prop);palace.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
 }
 console.log(`Biblioteca de ala inteira: ${shelves.length} estantes nas quatro paredes, dimensões reais, seis assentos, porta livre, teto, janela e iluminação validados.`);
}finally{await server.close();}
