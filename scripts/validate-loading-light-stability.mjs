import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {preparePalaceFirelights,palaceFirelightEmitter,addCityFirelight,updateCityFirelights,prepareCityFirelightPool}=await server.ssrLoadModule('/src/editor/CityFirelight.ts');
 const T=await server.ssrLoadModule('three');
 const scene=new T.Scene(),palace=new T.Group();scene.add(palace);
 palace.userData.building={enterable:true,width:100,depth:100,height:30};palace.userData.palaceComplex=true;
 const placements=Array.from({length:14},()=>({pack:'wall-torch',persistent:true,intensity:95,distance:20}));
 preparePalaceFirelights(palace,placements);prepareCityFirelightPool(scene,3,0);
 const count=()=>{let n=0;scene.traverseVisible(o=>{if(o.isPointLight)n++;});return n;};
 assert.equal(count(),0,'Fixed exterior lighting creates no dynamic slots');
 for(let i=0;i<14;i++){
  const root=new T.Group();root.userData.palaceExteriorTorch=true;root.add(new T.Mesh(new T.BoxGeometry(.1,.2,.1),new T.MeshBasicMaterial()));palace.add(root);
  addCityFirelight(root,true,{persistent:true,intensity:95,distance:20,emitter:palaceFirelightEmitter(palace,i)});
  scene.updateMatrixWorld(true);updateCityFirelights(.016,new T.Vector3(1000,0,1000),0,3);
  assert.equal(count(),0,'GLB arrivals must not add dynamic exterior lights');
 }
 assert([...Array(14)].every((_,i)=>palaceFirelightEmitter(palace,i)===undefined),'Exterior lighting is baked into the shared map');
 console.log('Contagem de luzes estável durante 14 chegadas de modelos; iluminação externa fixa preservada.');
}finally{await server.close();}
