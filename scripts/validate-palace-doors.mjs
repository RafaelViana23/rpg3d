import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {createRoyalPalace}=await server.ssrLoadModule('/src/editor/RoyalPalace.ts');
 const {registerVillageDoor,toggleChurchDoor,updateChurchDoors}=await server.ssrLoadModule('/src/editor/ChurchDoors.ts');
 const {Group,Mesh,BoxGeometry,MeshBasicMaterial,Box3,Vector3,Matrix4}=await server.ssrLoadModule('three');
 const bytes=await readFile('public/models/city/props/village-door.glb'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const nodes=gltf.nodes.map(n=>{const o=new Group();if(n.matrix)o.applyMatrix4(new Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
 gltf.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));
 const source=new Group();for(const i of gltf.scenes[gltf.scene??0].nodes)source.add(nodes[i]);source.updateMatrixWorld(true);
 const template=new Group();gltf.nodes.forEach((n,i)=>{if(n.mesh===undefined)return;for(const p of gltf.meshes[n.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION],min=new Vector3(...a.min),max=new Vector3(...a.max),size=max.clone().sub(min);const geometry=new BoxGeometry(...size.toArray());geometry.translate(...min.add(max).multiplyScalar(.5).toArray());geometry.applyMatrix4(nodes[i].matrixWorld);template.add(new Mesh(geometry,new MeshBasicMaterial()));}});
 const bounds=new Box3().setFromObject(template),center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3());for(const c of template.children)c.position.set(-center.x,-bounds.min.y,-center.z);
 const scene=new Group(),palace=createRoyalPalace();scene.add(palace);
 for(const opening of palace.userData.royalRoomDoors){
  const door=template.clone(true),side=Math.sign(opening.x);
  door.scale.set(opening.width/size.x,opening.height/size.y,1);door.rotation.y=Math.PI/2;
  door.position.set(opening.x+side*(opening.wallDepth/2+size.z/2+.03),opening.y,opening.z);palace.add(door);
  palace.updateMatrixWorld(true);const closed=new Box3().setFromObject(door);
  registerVillageDoor(palace,door,opening);palace.updateMatrixWorld(true);
  assert(new Box3().setFromObject(door).min.distanceTo(closed.min)<.0001,`Closed pose ${opening.label}: ${closed.min.toArray()} -> ${new Box3().setFromObject(door).min.toArray()}`);
  const probe=palace.localToWorld(new Vector3(opening.x,opening.y+1,opening.z));
  for(let cycle=0;cycle<2;cycle++){
   assert(toggleChurchDoor(probe));
   for(let i=0;i<22;i++){
    updateChurchDoors(.05);palace.updateMatrixWorld(true);
    const b=new Box3().setFromObject(door);
    assert(side>0?b.min.x>=27.8-.001:b.max.x<=-27.8+.001,`${opening.label}: leaf stays outside the wall throughout its swing`);
   }
   const hinge=door.getObjectByName('VillageDoorHinge'),angle=2*Math.acos(Math.abs(hinge.quaternion.w));
   assert(Math.abs(angle-Math.PI/2)<.001,'Opens exactly ninety degrees');
   const openSize=new Box3().setFromObject(door).getSize(new Vector3());
   assert(Math.abs(openSize.x-opening.width)<.001,'Open leaf keeps the full fitted width');
   toggleChurchDoor(probe);updateChurchDoors(1.2);palace.updateMatrixWorld(true);
   const shut=new Box3().setFromObject(door);assert(shut.min.distanceTo(closed.min)<.001&&shut.max.distanceTo(closed.max)<.001,'Closing restores the original pose');
  }
 }
 console.log('Portas da cozinha, quartos e salas: dobradiças fixas, abertura rígida de 90°, sem atravessar a parede, e ciclos de fechamento validados.');
}finally{await server.close();}
