import * as T from 'three';

type StreetSource={root:T.Group;light:T.PointLight};
const size=256,pixels=new Uint8Array(size*size*4);
const texture=new T.DataTexture(pixels,size,size,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
const uniforms={cityStreetMap:{value:texture},cityStreetBounds:{value:new T.Vector4()},cityStreetNight:{value:0},cityStreetGround:{value:0}};
let elapsed=1,signature='';
function applyMaterial(material:T.Material){
  if(!(material instanceof T.MeshStandardMaterial||material instanceof T.MeshLambertMaterial||material instanceof T.MeshPhongMaterial)||material.transparent||material.userData.cityStreetMap)return;
  material.userData.cityStreetMap=true;
  const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 cityStreetWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 cityStreetPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ncityStreetPosition=instanceMatrix*cityStreetPosition;\n#endif\ncityStreetWorld=(modelMatrix*cityStreetPosition).xyz;');
    shader.fragmentShader='varying vec3 cityStreetWorld;\nuniform sampler2D cityStreetMap;\nuniform vec4 cityStreetBounds;\nuniform float cityStreetNight;\nuniform float cityStreetGround;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 streetUV=(cityStreetWorld.xz-cityStreetBounds.xy)/cityStreetBounds.zw;
      float insideStreet=step(0.0,streetUV.x)*step(streetUV.x,1.0)*step(0.0,streetUV.y)*step(streetUV.y,1.0);
      float streetHeight=clamp(1.0-max(0.0,cityStreetWorld.y-cityStreetGround)/8.0,0.0,1.0);
      outgoingLight+=diffuseColor.rgb*texture2D(cityStreetMap,streetUV).rgb*cityStreetNight*insideStreet*streetHeight;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>`${previousKey}:city-street-lightmap-v1`;material.needsUpdate=true;
}
/** Bake the static lamps into one shared texture instead of adding dozens of live lights. */
export function updateStreetLightingMap(delta:number,sources:StreetSource[],night:number){
  uniforms.cityStreetNight.value=night;elapsed+=delta;if(elapsed<1||!sources.length)return;elapsed=0;
  const points=sources.map(s=>({ground:s.root.getWorldPosition(new T.Vector3()).y,point:s.light.getWorldPosition(new T.Vector3())}));
  const next=points.map(p=>p.point.toArray().map(v=>v.toFixed(2)).join(',')).join(';');
  if(next!==signature){
    signature=next;
    const minX=Math.min(...points.map(p=>p.point.x))-34,minZ=Math.min(...points.map(p=>p.point.z))-34;
    const width=Math.max(...points.map(p=>p.point.x))+34-minX,depth=Math.max(...points.map(p=>p.point.z))+34-minZ;
    uniforms.cityStreetBounds.value.set(minX,minZ,width,depth);
    uniforms.cityStreetGround.value=points.reduce((sum,p)=>sum+p.ground,0)/points.length;
    const energy=new Float32Array(size*size);const radius=30;
    for(const {point} of points){
      const x0=Math.max(0,Math.floor((point.x-radius-minX)/width*size)),x1=Math.min(size-1,Math.ceil((point.x+radius-minX)/width*size));
      const z0=Math.max(0,Math.floor((point.z-radius-minZ)/depth*size)),z1=Math.min(size-1,Math.ceil((point.z+radius-minZ)/depth*size));
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
        const dx=minX+(x+.5)/size*width-point.x,dz=minZ+(z+.5)/size*depth-point.z,d=Math.hypot(dx,dz)/radius;
        if(d<1)energy[z*size+x]+=.65*(1-d)*(1-d);
      }
    }
    for(let i=0;i<energy.length;i++){const v=Math.min(.75,energy[i]);pixels[i*4]=Math.round(v*255);pixels[i*4+1]=Math.round(v*190);pixels[i*4+2]=Math.round(v*111);pixels[i*4+3]=255;}
    texture.needsUpdate=true;
  }
  let scene:T.Object3D=sources[0].root;while(scene.parent)scene=scene.parent;
  scene.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    let city=false;for(let parent:T.Object3D|null=object;parent;parent=parent.parent){if(parent.userData.cityObject||parent.name==='Piso medieval da cidade'){city=true;break;}}
    if(!city)return;
    for(const material of Array.isArray(object.material)?object.material:[object.material])applyMaterial(material);
  });
}
