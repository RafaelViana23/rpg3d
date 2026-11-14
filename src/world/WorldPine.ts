import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
export function createWorldPine(){
 const parts:T.BufferGeometry[]=[];
 const add=(geometry:T.BufferGeometry,color:T.Color)=>{const g=geometry.index?geometry.toNonIndexed():geometry;const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);};
 const trunk=new T.CylinderGeometry(.035,.055,.29,5,1);trunk.translate(0,.145,0);add(trunk,new T.Color().setRGB(.194132,.073948,.002128));
 for(const [i,tier]of [[.35,.14,.37],[.32,.27,.35],[.27,.40,.33],[.22,.53,.30],[.17,.66,.27],[.11,.79,.21]].entries()){
  const [r,y,h]=tier,g=new T.ConeGeometry(r,h,5,1);g.rotateY(i*.37);g.translate(0,y+h/2,0);add(g,new T.Color().setRGB(.017936,.209968,.055499));
 }
 const merged=mergeGeometries(parts)!,geometry=mergeVertices(merged);merged.dispose();parts.forEach(g=>g.dispose());const root=new T.Group(),mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
