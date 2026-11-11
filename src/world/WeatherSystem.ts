import * as THREE from 'three';

export type WeatherType='clear'|'rain'|'snow';

export class WeatherSystem{
  readonly group=new THREE.Group();
  private rain:THREE.LineSegments;
  private snow:THREE.Points;
  private rainPositions:Float32Array;
  private snowPositions:Float32Array;
  private intensity=1;
  private readonly rainRadius=100;
  private readonly rainHeight=36;
  private readonly nearDrops=2400;
  private readonly nearRadius=25;
  private positioned=false;
  type:WeatherType='clear';
  constructor(scene:THREE.Scene){
    // A dense inner layer and a broad outer layer share one draw call.
    const rainDrops=12000;this.rainPositions=new Float32Array(rainDrops*6);
    for(let index=0;index<rainDrops;index++)this.resetRain(index,true);
    const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#a7c9e8',transparent:true,opacity:.48,depthWrite:false,fog:true}));this.rain.frustumCulled=false;this.group.add(this.rain);
    const flakes=650;this.snowPositions=new Float32Array(flakes*3);for(let index=0;index<flakes;index++)this.resetSnow(index,true);
    const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(this.snowPositions,3));
    this.snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:'#f4f8ff',size:.075,transparent:true,opacity:.92,depthWrite:false,fog:true}));this.snow.frustumCulled=false;this.group.add(this.snow);scene.add(this.group);this.setWeather('clear');
  }
  private resetRain(index:number,initial=false){
    const offset=index*6,near=index<this.nearDrops;
    const inner=near?0:this.nearRadius,outer=near?this.nearRadius:this.rainRadius;
    const radius=Math.sqrt(inner*inner+Math.random()*(outer*outer-inner*inner)),angle=Math.random()*Math.PI*2;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=initial?Math.random()*this.rainHeight:this.rainHeight+Math.random()*3;
    this.rainPositions[offset]=x;this.rainPositions[offset+1]=y;this.rainPositions[offset+2]=z;
    this.rainPositions[offset+3]=x-.12;this.rainPositions[offset+4]=y-1;this.rainPositions[offset+5]=z+.08;
  }
  private resetSnow(index:number,initial=false){const offset=index*3;this.snowPositions[offset]=(Math.random()-.5)*24;this.snowPositions[offset+1]=initial?Math.random()*12:11+Math.random()*3;this.snowPositions[offset+2]=(Math.random()-.5)*24;}
  setWeather(type:WeatherType){this.type=type;this.rain.visible=type==='rain';this.snow.visible=type==='snow';}
  setIntensity(value:number){this.intensity=THREE.MathUtils.clamp(value,.15,1.5);(this.rain.material as THREE.LineBasicMaterial).opacity=.18+.38*this.intensity;(this.snow.material as THREE.PointsMaterial).opacity=.42+.45*this.intensity;}
  update(delta:number,center:THREE.Vector3,roofAt?:(x:number,z:number)=>number){
    const dx=this.positioned?center.x-this.group.position.x:0,dy=this.positioned?center.y-this.group.position.y:0,dz=this.positioned?center.z-this.group.position.z:0;
    this.group.position.copy(center);this.positioned=true;
    if(this.type==='rain'){
      const drops=this.rainPositions.length/6,fall=delta*(12+this.intensity*13);
      for(let index=0;index<drops;index++){
        const offset=index*6;
        // Keep drops fixed in the world as the player moves through the rain.
        this.rainPositions[offset]-=dx;this.rainPositions[offset+3]-=dx;
        this.rainPositions[offset+2]-=dz;this.rainPositions[offset+5]-=dz;
        this.rainPositions[offset+1]-=fall+dy;this.rainPositions[offset+4]-=fall+dy;
        const x=this.rainPositions[offset],z=this.rainPositions[offset+2],radius=index<this.nearDrops?this.nearRadius:this.rainRadius;
        if(x*x+z*z>radius*radius)this.resetRain(index,true);
        else if(this.rainPositions[offset+4]<-2)this.resetRain(index);
        // Validate the final coordinates, including particles recycled by player movement.
        // Both ends matter at doorways because the streak leans sideways.
        const roof=Math.max(
          roofAt?.(center.x+this.rainPositions[offset],center.z+this.rainPositions[offset+2])??-Infinity,
          roofAt?.(center.x+this.rainPositions[offset+3],center.z+this.rainPositions[offset+5])??-Infinity,
        );
        if(center.y+this.rainPositions[offset+4]<=roof){
          const lift=roof-center.y+1.1-this.rainPositions[offset+4];
          this.rainPositions[offset+1]+=lift;this.rainPositions[offset+4]+=lift;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate=true;
    }else if(this.type==='snow'){
      const flakes=this.snowPositions.length/3,time=performance.now()*.0015;
      for(let index=0;index<flakes;index++){
        const offset=index*3;
        this.snowPositions[offset]+=Math.sin(time+index)*delta*.16-dx;
        this.snowPositions[offset+1]-=delta*(.65+this.intensity*1.15)+dy;
        this.snowPositions[offset+2]-=dz;
        if(Math.abs(this.snowPositions[offset])>12||Math.abs(this.snowPositions[offset+2])>12||this.snowPositions[offset+1]<0)this.resetSnow(index);
        const roof=roofAt?.(center.x+this.snowPositions[offset],center.z+this.snowPositions[offset+2])??-Infinity;
        this.snowPositions[offset+1]=Math.max(this.snowPositions[offset+1],roof-center.y+1);
      }
      this.snow.geometry.attributes.position.needsUpdate=true;
    }
  }
}
