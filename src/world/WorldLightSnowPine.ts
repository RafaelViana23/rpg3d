import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
export function createWorldLightSnowPine(){
 const parts:T.BufferGeometry[]=[];
 const add=(geometry:T.BufferGeometry,color:T.Color)=>{const g=geometry.index?geometry.toNonIndexed():geometry;const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);};
 const trunk=new T.CylinderGeometry(.035,.055,.29,5,1);trunk.translate(0,.145,0);add(trunk,new T.Color().setRGB(.194132,.073948,.002128));
 for(const [i,tier]of [[.25,.17,.34],[.22,.30,.32],[.19,.43,.30],[.16,.56,.28],[.12,.69,.25],[.08,.82,.18]].entries()){
  const [r,y,h]=tier;
  const band=.045;
  const leaves=new T.ConeGeometry(r*.82,h-band,6);leaves.rotateY(i*.31);leaves.translate(0,y+band+(h-band)/2,0);add(leaves,new T.Color().setRGB(.0768372,.367238,.0471387));
  const snow=new T.CylinderGeometry(r*.82,r,band,6,1,false);snow.rotateY(i*.31);snow.translate(0,y+band/2,0);add(snow,new T.Color().setRGB(.619029,.706904,.8));
 }
 const patch=new T.CylinderGeometry(.075,.085,.018,6);patch.translate(0,.009,0);add(patch,new T.Color().setRGB(.619029,.706904,.8));
 const merged=mergeGeometries(parts)!,geometry=mergeVertices(merged);merged.dispose();parts.forEach(g=>g.dispose());const root=new T.Group(),mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
