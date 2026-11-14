import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,flatShading:true});
/** Shared lightweight potted plant, with the same bounds as the imported model. */
export function createCityPottedPlant(){
 const parts:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:string)=>{const c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));parts.push(g);};
 const pot=new T.LatheGeometry([new T.Vector2(.10,0),new T.Vector2(.11,.02),new T.Vector2(.15,.26),new T.Vector2(.18,.27),new T.Vector2(.18,.3),new T.Vector2(.15,.3),new T.Vector2(.15,.275)],8);add(pot,'#b76f44');
 const soil=new T.CircleGeometry(.145,8);soil.rotateX(-Math.PI/2);soil.translate(0,.275,0);add(soil,'#6b4a33');
 const leaf=(base:T.Vector3,tip:T.Vector3,width:number,color:string)=>{
  const direction=tip.clone().sub(base),side=new T.Vector3(-direction.z,0,direction.x).normalize().multiplyScalar(width),mid=base.clone().lerp(tip,.5),ridge=mid.clone().add(new T.Vector3(0,.025,0));
  const points=[base,mid.clone().add(side),tip,mid.clone().sub(side),ridge],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));g.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);g.computeVertexNormals();add(g,color);
 };
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5+.3,bottom=new T.Vector3(Math.cos(a)*.055,.275,Math.sin(a)*.055),top=new T.Vector3(Math.cos(a)*.19,.57+(i%3)*.065,Math.sin(a)*.19);
  const stem=new T.CylinderGeometry(.006,.008,bottom.distanceTo(top),4);stem.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),top.clone().sub(bottom).normalize()));stem.translate(...bottom.clone().add(top).multiplyScalar(.5).toArray());add(stem,'#5f7a4a');
  for(let j=0;j<3;j++){
   const base=bottom.clone().lerp(top,.25+j*.21),angle=a+(j%2?1.2:-1.2),tip=base.clone().add(new T.Vector3(Math.cos(angle)*.17,.065,Math.sin(angle)*.17));leaf(base,tip,.045,['#5f7a4a','#46612a','#6e8c3a'][(i+j)%3]);
  }
  leaf(top.clone().add(new T.Vector3(0,-.04,0)),top.clone().add(new T.Vector3(Math.cos(a)*.12,.075,Math.sin(a)*.12)),.035,'#6e8c3a');
 }
 // Match the foliage footprint independently, keeping the pot's original proportions.
 const foliageBounds=new T.Box3();for(const g of parts.slice(2)){g.computeBoundingBox();foliageBounds.union(g.boundingBox!);}
 const foliageSize=foliageBounds.getSize(new T.Vector3()),foliageCenter=foliageBounds.getCenter(new T.Vector3());
 for(const g of parts.slice(2)){g.translate(-foliageCenter.x,0,-foliageCenter.z);g.scale(.732236743/foliageSize.x,1,.666183829/foliageSize.z);}
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();const bounds=geometry.boundingBox!,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(.732236743/size.x,.779221356/size.y,.666183829/size.z);
 const root=new T.Group(),mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
