import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const T=await server.ssrLoadModule('three');
  const {updateDirectionalShadowBias}=await server.ssrLoadModule('/src/world/DayNightSky.ts');
  for(const resolution of [512,768,1024])for(const radius of [32,48,200,2400]){
    const light=new T.DirectionalLight();light.castShadow=true;
    light.shadow.mapSize.set(resolution,resolution);
    light.shadow.camera.near=.5;light.shadow.camera.far=radius*4+640;
    const mapSize=light.shadow.mapSize.clone(),projection=light.shadow.camera.projectionMatrix.clone();
    updateDirectionalShadowBias(light,radius);
    assert(light.shadow.normalBias>=.08&&light.shadow.normalBias<=.4);
    assert(Math.abs(light.shadow.bias*(light.shadow.camera.far-light.shadow.camera.near)+.16)<1e-12,'Depth offset remains 16 cm rather than growing across the island');
    assert.equal(light.castShadow,true,'Real roof/building shadows stay enabled');
    assert(light.shadow.mapSize.equals(mapSize),'No extra shadow-map resolution or GPU cost');
    assert(light.shadow.camera.projectionMatrix.equals(projection),'Shadow coverage is unchanged');
    if(radius===48&&resolution===512)assert.equal(light.shadow.normalBias,.375,'Low-quality wall receives sufficient normal offset');
    if(radius===48&&resolution===1024)assert.equal(light.shadow.normalBias,.1875,'Higher resolution uses a smaller offset');
  }
  console.log('Sun/moon shadow bias: 12 camera/resolution combinations; world-space depth offset, bounded wall offset, real shadows and resolution retained: OK');
}finally{await server.close();}
