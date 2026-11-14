import * as T from 'three';
import {CITY_WOOD_COLOR} from '../editor/CityWood';
const material=(color:string)=>new T.MeshStandardMaterial({color,roughness:.78});
export function createTBone(){
 const root=new T.Group();root.name='Corte T-bone';
 const outline=new T.Shape();outline.moveTo(-.48,-.26);outline.bezierCurveTo(-.67,.08,-.45,.48,-.12,.44);outline.bezierCurveTo(.08,.53,.52,.4,.55,.12);outline.bezierCurveTo(.65,-.22,.3,-.48,.02,-.35);outline.bezierCurveTo(-.17,-.44,-.39,-.43,-.48,-.26);
 const slab=(shape:T.Shape,color:string,scale:number,y:number,depth:number)=>{
  const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:1,curveSegments:10});geometry.rotateX(-Math.PI/2);geometry.scale(scale,1,scale);
  const mesh=new T.Mesh(geometry,material(color));mesh.position.y=y;root.add(mesh);return mesh;
 };
 slab(outline,'#eacbb0',1,0,.18).name='Borda de gordura';slab(outline,'#ae343e',.88,.012,.19).name='Carne do T-bone';
 const bone=new T.Shape();bone.moveTo(-.30,.17);bone.lineTo(.31,.17);bone.lineTo(.31,.08);bone.lineTo(.06,.07);bone.lineTo(.08,-.30);bone.lineTo(-.04,-.30);bone.lineTo(-.06,.07);bone.lineTo(-.30,.08);bone.closePath();
 slab(bone,'#fff0d0',1,.205,.018).name='Osso em T';
 const fat=material('#e9b9ae');
 for(const points of [[[-.35,-.18],[-.25,-.1],[-.2,.02]],[[.18,-.21],[.3,-.15],[.39,-.02]],[[-.28,.27],[-.15,.31],[-.03,.29]]]){
  const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,.224,z)));
  const vein=new T.Mesh(new T.TubeGeometry(curve,6,.012,4,false),fat);vein.name='Marmoreio';root.add(vein);
 }
 root.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});return root;
}
export function createApple(){
 const root=new T.Group();root.name='Maçã com talo e folha';
 const geometry=new T.SphereGeometry(.4,16,12),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),angle=Math.atan2(z,x);
  const lobe=1+.045*Math.cos(angle*5),top=Math.max(0,y/.4);
  p.setXYZ(i,x*lobe*(1+.12*y),y*.9-.075*Math.pow(top,8)+.025*Math.pow(Math.max(0,-y/.4),8),z*lobe*(1+.12*y));
 }
 geometry.computeVertexNormals();root.add(new T.Mesh(geometry,material('#bb3932')));
 const stem=new T.Mesh(new T.CylinderGeometry(.022,.03,.16,6),material(CITY_WOOD_COLOR));stem.position.set(.015,.35,0);stem.rotation.z=-.2;root.add(stem);
 const leaf=new T.Mesh(new T.SphereGeometry(1,8,4),material('#417d32'));leaf.scale.set(.14,.015,.065);leaf.position.set(.12,.39,0);leaf.rotation.z=.35;root.add(leaf);return root;
}
export function createGrapes(){
 const root=new T.Group();root.name='Cacho de uvas';const grape=material('#783b99'),geometry=new T.SphereGeometry(.115,8,6);
 for(let row=0;row<4;row++){const count=5-row;for(let i=0;i<count;i++){const angle=i*Math.PI*2/count+row*.6,radius=(3-row)*.062;const fruit=new T.Mesh(geometry,grape);fruit.position.set(Math.cos(angle)*radius,.28-row*.17,Math.sin(angle)*radius);root.add(fruit);}}
 const stem=new T.Mesh(new T.CylinderGeometry(.025,.018,.2,6),material(CITY_WOOD_COLOR));stem.position.y=.47;stem.rotation.z=.25;root.add(stem);return root;
}
