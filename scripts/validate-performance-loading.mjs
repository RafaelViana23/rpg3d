import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {preparePalaceFirelights,palaceFirelightEmitter,addCityFirelight,updateCityFirelights}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const {LowPolyCityBuilder}=await server.ssrLoadModule('/src/editor/LowPolyCityBuilder.ts');
 const {Scene,Group,Mesh,BoxGeometry,MeshBasicMaterial,Vector3}=await server.ssrLoadModule('three');
 const scene=new Scene(),palace=new Group();scene.add(palace);palace.position.set(10,5,20);
 const placements=Array.from({length:16},()=>({pack:'wall-torch',intensity:150,distance:42}));
 preparePalaceFirelights(palace,placements);
 const visibleLights=()=>{let count=0;scene.traverse(o=>{if(o.isPointLight&&o.visible)count++;});return count;};
 assert.equal(visibleLights(),0);
 for(let i=0;i<16;i++){
  const root=new Group();root.position.set(i*2,2,0);root.add(new Mesh(new BoxGeometry(.1,.2,.1),new MeshBasicMaterial()));palace.add(root);
  addCityFirelight(root,true,{persistent:true,intensity:150,distance:42,emitter:palaceFirelightEmitter(palace,i)});
  scene.updateMatrixWorld(true);updateCityFirelights(.05,new Vector3(1000,0,1000),0,0,.5);
  assert.equal(visibleLights(),0,'Distant palace torches do not add active lights as models arrive');
 }
 for(let i=0;i<16;i++)assert.equal(palaceFirelightEmitter(palace,i),undefined,'Exterior uses fixed lighting without reserved dynamic emitters');
 scene.updateMatrixWorld(true);updateCityFirelights(.05,new Vector3(10,5,20),0,3,.5);
 assert.equal(visibleLights(),3,'Nearby palace torches use the bounded shared pool');
 const builder=new LowPolyCityBuilder(new Scene(),()=>0),objects=[];
 for(let i=0;i<100;i++){const b=new Group();b.name='Cidade:house';b.position.x=i*20;b.userData.building={width:10,depth:10,height:6};b.userData.localColliders=[[-5,0,-5,-4,6,5]];builder.root.add(b);builder.objects.set(String(i),b);objects.push(b);}
 builder.prepareWeatherCover();const old=builder.collisionShapes[0];
 objects[99].userData.localColliders.push([4,0,-5,5,6,5]);objects[99].userData.colliderRevision=1;builder.collisionCheckAt=-Infinity;builder.prepareWeatherCover();
 assert.equal(builder.collisionShapes[0],old,'Unchanged buildings reuse their collision shapes when another building loads');
 const p=new Vector3(99*20+4.5,0,0);builder.resolveCollisions(p,.32);assert(p.x!==99*20+4.5,'Newly loaded colliders remain active');
 objects[0].position.x=-20;builder.collisionCheckAt=-Infinity;builder.prepareWeatherCover();assert.notEqual(builder.collisionShapes[0],old,'Build transforms invalidate only their own cached shapes');
 console.log('Carga de luzes com contagem fixa, tochas no orçamento compartilhado e cache incremental de colisões validados.');
}finally{await server.close();}
