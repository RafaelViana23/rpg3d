import * as THREE from "three";
import type { WeatherType } from "./WeatherSystem";

const vertexShader = `varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragmentShader = `uniform vec3 zenithColor;uniform vec3 horizonColor;uniform vec3 groundColor;uniform vec3 sunDirection;uniform vec3 sunGlowColor;uniform float sunGlow;varying vec3 vWorld;void main(){vec3 direction=normalize(vWorld-cameraPosition);float height=direction.y;float gradient=smoothstep(-.18,.82,height);vec3 color=mix(horizonColor,zenithColor,gradient);color=mix(groundColor,color,smoothstep(-.22,.03,height));float aroundSun=max(dot(direction,normalize(sunDirection)),0.0);color+=sunGlowColor*pow(aroundSun,18.0)*sunGlow*.55;gl_FragColor=vec4(color,1.0);}`;

function haloTexture() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!, gradient = context.createRadialGradient(64,64,5,64,64,62);
  gradient.addColorStop(0,"rgba(255,249,215,.75)"); gradient.addColorStop(.25,"rgba(255,241,183,.3)"); gradient.addColorStop(1,"rgba(255,230,160,0)");
  context.fillStyle=gradient; context.fillRect(0,0,128,128); return new THREE.CanvasTexture(canvas);
}

export class DayNightSky {
  readonly group=new THREE.Group(); readonly moonLight=new THREE.DirectionalLight("#94b9ff",0); readonly sunDirection=new THREE.Vector3();
  private readonly stars:THREE.Points; private readonly sunDisc:THREE.Mesh; private readonly sunHalo:THREE.Sprite; private readonly moonDisc:THREE.Mesh;
  private storm=0; private readonly sunDir=new THREE.Vector3(); private readonly moonDir=new THREE.Vector3(); private readonly sunVisual=new THREE.Vector3(); private readonly moonVisual=new THREE.Vector3();
  private readonly colors={nightZenith:new THREE.Color("#050b20"),dayZenith:new THREE.Color("#169ed5"),stormZenith:new THREE.Color("#405d70"),nightHorizon:new THREE.Color("#172744"),dayHorizon:new THREE.Color("#a9e2f3"),stormHorizon:new THREE.Color("#8b9da6"),sunset:new THREE.Color("#ef7954")};
  private readonly uniforms={zenithColor:{value:new THREE.Color()},horizonColor:{value:new THREE.Color()},groundColor:{value:new THREE.Color()},sunDirection:{value:new THREE.Vector3()},sunGlowColor:{value:new THREE.Color()},sunGlow:{value:1}};

  constructor(scene:THREE.Scene,private sunLight:THREE.DirectionalLight,private ambient:THREE.HemisphereLight){
    this.group.name="Sistema de céu, Sol e Lua";this.group.userData.buildEditable=false;
    const sky=new THREE.Mesh(new THREE.SphereGeometry(2400,32,18),new THREE.ShaderMaterial({vertexShader,fragmentShader,side:THREE.BackSide,depthWrite:false,uniforms:this.uniforms})); sky.renderOrder=-100; this.group.add(sky);
    const positions:number[]=[]; let seed=71423; const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    for(let index=0;index<850;index++){const theta=random()*Math.PI*2,phi=Math.acos(1-random()*.96),radius=2200;positions.push(Math.sin(phi)*Math.cos(theta)*radius,Math.cos(phi)*radius,Math.sin(phi)*Math.sin(theta)*radius);}
    const starGeometry=new THREE.BufferGeometry(); starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    this.stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:"#e8efff",size:7,transparent:true,opacity:0,depthWrite:false,fog:false,blending:THREE.AdditiveBlending})); this.group.add(this.stars);
    this.sunDisc=new THREE.Mesh(new THREE.CircleGeometry(85,10),new THREE.MeshBasicMaterial({color:"#fff8d9",side:THREE.DoubleSide,fog:false,toneMapped:false}));
    this.sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture(),color:"#fff0bd",transparent:true,opacity:.64,depthWrite:false,blending:THREE.AdditiveBlending,fog:false})); this.sunHalo.scale.set(400,400,1);
    this.moonDisc=new THREE.Mesh(new THREE.SphereGeometry(52,12,8),new THREE.MeshStandardMaterial({color:"#dce6f4",emissive:"#91a9d2",emissiveIntensity:1.5,roughness:.92,fog:false}));
    this.group.add(this.sunHalo,this.sunDisc,this.moonDisc); this.moonLight.castShadow=true; this.moonLight.shadow.mapSize.set(1024,1024); scene.add(this.group,this.moonLight,this.moonLight.target,this.sunLight.target);
  }

  update(time:number,center:THREE.Vector3,weather:WeatherType,delta:number,shadowCenter:THREE.Vector3=center,shadowRadius=48){
    this.group.position.copy(center); const angle=time*Math.PI*2-Math.PI/2; this.sunDir.set(Math.cos(angle),Math.sin(angle),-.28).normalize(); this.moonDir.copy(this.sunDir).negate();
    this.sunVisual.set(this.sunDir.x+.38,this.sunDir.y*.52+.08,-1).normalize(); this.moonVisual.set(this.moonDir.x-.38,this.moonDir.y*.42+.12,-1).normalize();
    this.sunDisc.position.copy(this.sunVisual).multiplyScalar(2100); this.sunDisc.lookAt(center); this.sunHalo.position.copy(this.sunDisc.position); this.moonDisc.position.copy(this.moonVisual).multiplyScalar(2100); this.sunDirection.copy(this.sunVisual); this.uniforms.sunDirection.value.copy(this.sunVisual);
    const elevation=this.sunDir.y,daylight=THREE.MathUtils.smoothstep(elevation,-.13,.22),night=1-THREE.MathUtils.smoothstep(elevation,-.22,.04),twilight=1-Math.min(1,Math.abs(elevation)*5.2),targetStorm=weather==="rain"?1:weather==="snow"?.55:0;
    this.storm=THREE.MathUtils.lerp(this.storm,targetStorm,1-Math.exp(-delta*.32));
    this.uniforms.zenithColor.value.copy(this.colors.nightZenith).lerp(this.colors.dayZenith,daylight).lerp(this.colors.stormZenith,this.storm*daylight);
    this.uniforms.horizonColor.value.copy(this.colors.nightHorizon).lerp(this.colors.dayHorizon,daylight).lerp(this.colors.sunset,twilight*.68*(1-this.storm)).lerp(this.colors.stormHorizon,this.storm*daylight);
    this.uniforms.groundColor.value.set(daylight>.15?"#9dc5d5":"#02040b").lerp(this.colors.stormHorizon,this.storm*.5); this.uniforms.sunGlowColor.value.set(twilight>.25?"#ff9b59":"#fff1b0"); this.uniforms.sunGlow.value=daylight*(.45+twilight*1.5)*(1-this.storm*.82);
    (this.stars.material as THREE.PointsMaterial).opacity=night*.94; this.stars.rotation.y+=.00008; this.sunDisc.visible=elevation>-.12; this.sunHalo.visible=this.sunDisc.visible; (this.sunHalo.material as THREE.SpriteMaterial).opacity=.64*daylight*(1-this.storm*.9); this.moonDisc.visible=elevation<.15;
    // Center shadow maps on the viewed world, not on the camera above it.
    const radius=THREE.MathUtils.clamp(shadowRadius,32,2400),distance=radius*2+320;
    for(const [light,direction] of [[this.sunLight,this.sunDir],[this.moonLight,this.moonDir]] as const){
      light.position.copy(shadowCenter).addScaledVector(direction,distance);
      light.target.position.copy(shadowCenter);
      const camera=light.shadow.camera;
      if(camera.right!==radius){camera.left=camera.bottom=-radius;camera.right=camera.top=radius;camera.near=.5;camera.far=distance+radius*2+320;camera.updateProjectionMatrix();}
      light.shadow.normalBias=.035;
      light.shadow.bias=-.00008;
      light.castShadow=direction.y>-.08;
    }
    this.sunLight.intensity=daylight*(2.7+Math.max(0,elevation)*2.2)*(1-this.storm*.42); this.sunLight.color.set(twilight>.32?"#ffd09a":"#fff3da");
    this.moonLight.intensity=night*.65; this.ambient.intensity=(.16+daylight*1.62)*(1-this.storm*.18); this.ambient.color.set(daylight>.25?"#d9efff":"#91afe0").lerp(this.colors.stormHorizon,this.storm*.35); this.ambient.groundColor.set(daylight>.25?"#6d6759":"#18243b");
    return{daylight,night,twilight,elevation};
  }
}
