import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {CITY_STONE_MATERIAL}=await server.ssrLoadModule('/src/editor/CityStone.ts');
 const {CITY_WOOD_MATERIAL}=await server.ssrLoadModule('/src/editor/CityWood.ts');
 const {Box3,Vector3,Raycaster,Group,Mesh,BoxGeometry,MeshBasicMaterial,Box2,Vector2}=await server.ssrLoadModule('three');
 const palace=createRoyalPalace();palace.updateMatrixWorld(true);
 let decor;palace.traverse(o=>{if(o.userData.aliceBedroomDecor)decor=o;});assert(decor);
 assert.equal(decor.userData.elements.length,10);
 assert.equal(decor.userData.bookcaseCount,5);
 assert.equal(decor.userData.wardrobePositions.length,4);
 assert.equal(decor.userData.paintingPlacements.length,3);
 assert.equal(decor.userData.paintingPlacements.filter(p=>p.angle===Math.PI).length,2);
 assert(decor.userData.chestPosition[2]-.7>palace.userData.princessBedroom.z-palace.userData.princessBedroom.depth/2-.2);
 const box=new Box3().setFromObject(decor),room=palace.userData.princessBedroom;
 assert(box.min.x>room.x-room.width/2&&box.max.x<room.x+room.width/2);
 assert(box.min.z>room.z-room.depth/2&&box.max.z<room.z+room.depth/2);
 assert(box.max.y<palace.userData.princessExteriorWindows[0].top+1.3,'Chandelier stays below the existing ceiling');
 assert(decor.children.some(o=>o.material===CITY_WOOD_MATERIAL));
 assert.equal(palace.userData.princessExteriorWindows.length,2);
 for(const w of palace.userData.princessExteriorWindows){
  assert.equal(w.facing,'east');
  const hits=new Raycaster(new Vector3(55,w.bottom+3.1,w.z+.45),new Vector3(-1,0,0),0,4).intersectObject(palace,true);
  assert(hits.length,'Exterior opening contains its glass pane');
  assert(!hits.some(h=>h.object.material===CITY_STONE_MATERIAL),'Real window opening cuts through the exterior masonry');
 }
 assert(palace.userData.palaceLightPlacements.filter(p=>p.pack==='candle').length>=12,'Chandelier, bedside and room table candles use shared emitters');
 assert.equal(decor.userData.mannequinPositions.length,4);
 const bath=new Box3(new Vector3(...decor.userData.bathBounds.slice(0,3)),new Vector3(...decor.userData.bathBounds.slice(3))).applyMatrix4(decor.matrixWorld);
 for(const [x,y,z]of decor.userData.mannequinPositions){assert(!bath.intersectsBox(new Box3(new Vector3(x-.9,y,z-.9),new Vector3(x+.9,y+2.65,z+.9)).applyMatrix4(decor.matrixWorld)));}
 const bathCenter=bath.getCenter(new Vector3()),bathFloor=bath.min.y;
 for(const [origin,direction]of [[new Vector3(bathCenter.x,bathFloor+.55,bathCenter.z),new Vector3(1,0,0)],[new Vector3(bath.max.x+1,bathFloor+.55,bathCenter.z),new Vector3(-1,0,0)]]){
  const walls=new Raycaster(origin,direction,0,5).intersectObject(decor,true).filter(h=>h.object.material===CITY_WOOD_MATERIAL);
  assert(walls.length,'Bath walls are visible from both inside and outside');
 }
 const bottomHits=new Raycaster(new Vector3(bathCenter.x,bathFloor+2,bathCenter.z),new Vector3(0,-1,0),0,3).intersectObject(decor,true).filter(h=>h.object.material===CITY_WOOD_MATERIAL);
 assert(bottomHits.some(h=>h.point.y>bathFloor+.18&&h.point.y<bathFloor+.24),'Opaque wooden bottom hides the room floor beneath the water');
 const {princessDisplayOutfit}=await server.ssrLoadModule('/src/editor/PrincessDisplayOutfit.ts');
 const display=princessDisplayOutfit();assert(display.getAttribute('position').count>1000);assert(display.getAttribute('uv'));
 const {fitStorageWithoutOverlap}=await server.ssrLoadModule('/src/editor/CityStoragePlacement.ts');
 for(const placement of palace.userData.palacePropPlacements){
  const bytes=await readFile(`public/models/city/props/${placement.pack}.glb`),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length).toString());
  const nodes=gltf.nodes.map(n=>{const o=new Group();if(n.matrix)o.applyMatrix4(new (palace.matrix.constructor)().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}o.name=n.name??'';return o;});
  gltf.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));
  const root=new Group();for(const i of gltf.scenes[gltf.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
  const selected=placement.piece?nodes.find(o=>o.name===placement.piece):root;assert(selected);
  const bounds=new Box3();selected.traverse(o=>{const i=nodes.indexOf(o),node=gltf.nodes[i];if(node?.mesh===undefined)return;for(const primitive of gltf.meshes[node.mesh].primitives){const a=gltf.accessors[primitive.attributes.POSITION];bounds.union(new Box3(new Vector3(...a.min),new Vector3(...a.max)).applyMatrix4(o.matrixWorld));}});
  const size=bounds.getSize(new Vector3()),prop=new Group();
  const mesh=new Mesh(new BoxGeometry(size.x,size.y,size.z),new MeshBasicMaterial());mesh.position.y=size.y/2;prop.add(mesh);
  prop.scale.setScalar(placement.height/size.y);prop.position.set(placement.x,placement.y,placement.z);prop.rotation.y=placement.rotation;
  if(placement.horizontalScale){prop.scale.x*=placement.horizontalScale;prop.scale.z*=placement.horizontalScale;}
  const propRoom=placement.room?palace.userData[placement.room]:room;
  const area=new Box2(new Vector2(propRoom.x-propRoom.width/2+.05,propRoom.z-propRoom.depth/2+.05),new Vector2(propRoom.x+propRoom.width/2-.05,propRoom.z+propRoom.depth/2-.05));
  assert(fitStorageWithoutOverlap(palace,prop,[palace],area),`${placement.label} must fit using the real model bounds`);
  assert(prop.position.distanceTo(new Vector3(placement.x,placement.y,placement.z))<.01,`${placement.label} stays at its planned location: ${prop.position.toArray()}, model size ${size.toArray()}`);
 }
 console.log('Decoração completa de Alice dentro do cômodo, madeira padrão, lustre abaixo do teto e duas janelas reais voltadas ao exterior validados.');
}finally{await server.close();}
