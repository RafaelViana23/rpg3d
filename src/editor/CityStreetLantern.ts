import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_COLOR} from './CityWood';
const structureMaterial=new T.MeshLambertMaterial({vertexColors:true});
const glowMaterial=new T.MeshStandardMaterial({color:'#ffc57b',emissive:'#ffb04d',emissiveIntensity:1.5,roughness:.6});
/** Shared street fixture: stone foot, standard wood, iron frame and emissive lamp. */
export function createCityStreetLantern(){
 const parts:T.BufferGeometry[]=[];
 const add=(geometry:T.BufferGeometry,color:string)=>{
  const c=new T.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}geometry.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(geometry);
 };
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,color=CITY_WOOD_COLOR)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);};
 box(0,.12,0,.58,.24,.58,'#777772');
 const foot=new T.CylinderGeometry(.22,.36,.42,4);foot.rotateY(Math.PI/4);foot.translate(0,.45,0);add(foot,'#777772');
 box(0,2.31,0,.18,3.78,.18);
 const tip=new T.ConeGeometry(.1273,.3,4);tip.rotateY(Math.PI/4);tip.translate(0,4.35,0);add(tip,CITY_WOOD_COLOR);
 box(.65,4.16,0,1.48,.16,.18);
 const start=new T.Vector3(.04,3.35,0),end=new T.Vector3(.85,4.08,0),brace=new T.BoxGeometry(.1,start.distanceTo(end),.1);brace.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize()));brace.translate(...start.add(end).multiplyScalar(.5).toArray());add(brace,CITY_WOOD_COLOR);
 box(1.15,3.88,0,.035,.45,.035,'#30343a');
 const roof=new T.ConeGeometry(.34,.23,4);roof.rotateY(Math.PI/4);roof.translate(1.15,3.56,0);add(roof,'#30343a');
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const low=new T.Vector3(1.15+sx*.145,2.94,sz*.145),high=new T.Vector3(1.15+sx*.21,3.42,sz*.21),bar=new T.BoxGeometry(.03,low.distanceTo(high),.03);
  bar.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),high.clone().sub(low).normalize()));bar.translate(...low.add(high).multiplyScalar(.5).toArray());add(bar,'#30343a');
 }

 box(1.15,2.91,0,.35,.065,.35,'#30343a');box(1.15,3.45,0,.49,.065,.49,'#30343a');
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const structure=new T.Mesh(geometry,structureMaterial);structure.name='Estrutura do poste';structure.receiveShadow=true;
 const glassGeometry=new T.CylinderGeometry(.26,.17,.45,4);glassGeometry.rotateY(Math.PI/4);const glass=new T.Mesh(glassGeometry,glowMaterial);glass.position.set(1.15,3.18,0);glass.name='LampLight_Lighting_Effect_0';
 const root=new T.Group();root.add(structure,glass);root.userData.streetLanternFootBounds=[-.29,0,-.29,.29,.24,.29];return root;
}
