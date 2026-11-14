import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {createRoyalAvenue}=await server.ssrLoadModule('/src/editor/RoyalAvenue.ts');
 const {streetLanternSites,streetLanternBaseBounds}=await server.ssrLoadModule('/src/editor/CityStreetLanterns.ts');
 const {Vector3}=await server.ssrLoadModule('three');
 const saved=JSON.parse(await readFile('src/editor/default-city.json','utf8')).city['city-royal-avenue-v1'];
 const road=createRoyalAvenue(saved);road.position.fromArray(saved.position);road.rotation.set(...saved.rotation);road.scale.fromArray(saved.scale);
 const before=JSON.stringify(saved),sites=streetLanternSites([road]);
 assert.equal(sites.length,40);assert.equal(JSON.stringify(saved),before,'Generating poles never changes saved map coordinates');
 for(let i=0;i<sites.length;i+=2){
  const a=sites[i],b=sites[i+1],p=road.worldToLocal(a.point.clone()),q=road.worldToLocal(b.point.clone());
  const vertical=Math.abs(a.facing.x)===1;
  assert(Math.abs(p.y-.14)<1e-10&&Math.abs(q.y-.14)<1e-10,'Bases rest on the raised border top');
  assert(Math.abs((vertical?p.z:p.x)-(vertical?q.z:q.x))<1e-10,'Opposite poles form exact pairs');
  const edge=(vertical?saved.width:saved.secondaryAvenues.width)/2+.45;
  assert(Math.abs(Math.abs(vertical?p.x:p.z)-edge)<1e-10,'Post center lies on the centerline of the 0.9 m border');
  assert(Math.abs((vertical?p.x+q.x:p.z+q.z))<1e-10,'Rows are symmetric');
  assert(a.facing.dot(b.facing)===-1,'Opposite lamps face one another');
  const toCenter=new Vector3(vertical?-p.x:0,0,vertical?0:-p.z).normalize();assert(a.facing.dot(toCenter)>.999999);
 }
 road.position.set(70,25,-40);road.rotation.y=-.7;road.scale.set(1.5,1.2,1.5);
 const moved=streetLanternSites([road]);
 for(let i=0;i<sites.length;i++){
  const local=road.worldToLocal(moved[i].point.clone());
  assert(Math.abs(local.y-.14)<1e-10,'Alignment follows transformed avenues');
 }
 const {loadCityPropTemplate}=await server.ssrLoadModule('/src/editor/CityProps.ts');
 const model=(await loadCityPropTemplate('street-lantern')).clone(true);
 const {Box3}=await server.ssrLoadModule('three');
 const foot=streetLanternBaseBounds(model),anchor=foot.getCenter(new Vector3()),lamp=new Box3();
 model.traverse(mesh=>{if(mesh.isMesh&&mesh.name.includes('Lighting_Effect'))lamp.union(new Box3().setFromObject(mesh));});
 const arm=lamp.getCenter(new Vector3()).sub(anchor),correction=-Math.atan2(arm.x,arm.z);
 for(const child of model.children){child.position.x-=anchor.x;child.position.y-=foot.min.y;child.position.z-=anchor.z;}
 const scale=4.5/new Box3().setFromObject(model).getSize(new Vector3()).y;
 model.scale.setScalar(scale);model.updateMatrixWorld(true);
 const placed=streetLanternBaseBounds(model,model.parent??model);
 assert(Math.abs(placed.getCenter(new Vector3()).x)<1e-8&&Math.abs(placed.getCenter(new Vector3()).z)<1e-8,'Real foot is centered at the post origin');
 assert(Math.abs(placed.min.y)<1e-8,'Foot rests exactly on the placement surface');
 assert(placed.getSize(new Vector3()).x*scale<.9&&placed.getSize(new Vector3()).z*scale<.9,'The real base fits entirely on the 0.9-wide trim');
 for(const site of sites){
  const actualArm=arm.clone().setY(0).normalize().applyAxisAngle(new Vector3(0,1,0),Math.atan2(site.facing.x,site.facing.z)+correction);
  assert(actualArm.dot(site.facing)>.999999,'The imported lantern arm faces the avenue');
 }
 assert.equal(streetLanternSites([]).length,0,'No fallback poles are attached to random houses');
 const {addStreetLanternLight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial}=await server.ssrLoadModule('three');
 const scene=new Scene();scene.add(road);
 const slots=[];
 for(let i=0;i<40;i++){
  const post=new Group(),lamp=new Mesh(new BoxGeometry(.2,.4,.2),new MeshBasicMaterial());lamp.name='Lighting_Effect';post.add(lamp);post.position.set(i,4,0);road.add(post);
  addStreetLanternLight(post);slots.push(post.getObjectByName('Luz da lanterna da rua'));scene.updateMatrixWorld(true);updateCityFirelights(.01,new Vector3(1000,0,1000),0,0,.5);
  const visible=[];scene.traverse(o=>{if(o.isPointLight&&o.visible)visible.push(o);});
  assert.equal(visible.length,i+1,'Each exterior post uses its own direct light');
 }
 for(const viewer of [new Vector3(),new Vector3(1000,0,1000)])for(const time of [.1,.5,.9]){
  updateCityFirelights(.1,viewer,0,0,time);
  assert(slots.every(l=>l.visible&&!l.castShadow),'Exterior lamps remain active near/far and day/night without shadow maps');
 }
 console.log('40 postes em pares simétricos nas bordas, voltados para a avenida; transformações e JSON preservados.');
}finally{await server.close();}
