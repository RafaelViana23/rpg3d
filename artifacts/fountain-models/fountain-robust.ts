import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true,side:T.DoubleSide});
/** Monumental three-tier alternative, within the current 16×16 footprint; not installed. */
export function createRobustFountain(){
 const parts:T.BufferGeometry[]=[];const stone='#909090',water='#3e9fc0';
 const add=(g:T.BufferGeometry,color=stone)=>{const c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));parts.push(g);};
 const lathe=(profile:number[][],segments=7)=>add(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments));
 const disk=(radius:number,y:number)=>{const g=new T.CircleGeometry(radius,7);g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,water);};
 lathe([[7.4,0],[8,.35],[8,.65],[7.7,.8],[8,1.1],[8,1.9],[7.35,1.9],[7.35,.9]]);
 disk(7.35,1.4);
 // Broad sculpted pedestal carries the lower raised basin.
 lathe([[1.8,.9],[1.8,1.6],[1.4,1.9],[1.05,3.3],[1.5,3.9]]);
 lathe([[1.35,3.7],[3.3,4.2],[4.2,4.8],[4.2,5.3],[3.65,5.3],[3.65,4.8]]);
 disk(3.65,5.05);
 lathe([[.9,4.8],[.95,5.5],[.6,6.55],[.95,7.05]],6);
 lathe([[.85,6.85],[2.0,7.25],[2.6,7.7],[2.6,8.15],[2.15,8.15],[2.15,7.7]]);
 disk(2.15,7.95);
 lathe([[.55,7.7],[.65,8.4],[.38,9.7],[.45,10]],6);
 const crown=new T.SphereGeometry(.65,6,4);crown.translate(0,10.35,0);add(crown);
 // Low-cost curved water ribbons link all three basins.
 const stream=(points:T.Vector3[],width:number,axis:'x'|'z')=>{
  const curve=new T.CatmullRomCurve3(points),positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let i=0;i<=4;i++){const p=curve.getPoint(i/4);for(const side of [-1,1]){positions.push(p.x+(axis==='x'?side*width:0),p.y,p.z+(axis==='z'?side*width:0));uv.push((side+1)/2,i/4);}}
  for(let i=0;i<4;i++){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();add(g,water);
 };
 for(const side of [-1,1]){
  stream([new T.Vector3(side*2.25,8.06,0),new T.Vector3(side*2.9,7.7,0),new T.Vector3(side*3.3,6.3,0),new T.Vector3(side*3.35,5.05,0)],.12,'z');
  stream([new T.Vector3(0,5.22,side*3.85),new T.Vector3(0,4.7,side*4.7),new T.Vector3(0,2.5,side*5.5),new T.Vector3(0,1.4,side*5.6)],.16,'x');
 }
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();const bounds=geometry.boundingBox!,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(16/size.x,11/size.y,16/size.z);
 const root=new T.Group(),mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.name='Fonte monumental de três níveis';root.add(mesh);return root;
}
