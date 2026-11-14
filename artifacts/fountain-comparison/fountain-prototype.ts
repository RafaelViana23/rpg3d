import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true});
/** Isolated fountain comparison; stone and water colours are retained in one mesh. */
export function createComparisonFountain(){
 const parts:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:string)=>{const c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);};
 const stone='#909090',water='#3e9fc0';
 const basin=new T.LatheGeometry([new T.Vector2(.96,0),new T.Vector2(1,.065),new T.Vector2(.97,.13),new T.Vector2(1,.16),new T.Vector2(1,.23),new T.Vector2(.9,.23),new T.Vector2(.9,.13)],7,0,Math.PI*2);add(basin,stone);
 const surface=new T.CircleGeometry(.9,7);surface.rotateX(-Math.PI/2);surface.translate(0,.17,0);add(surface,water);
 const stem=new T.LatheGeometry([new T.Vector2(.16,.13),new T.Vector2(.15,.2),new T.Vector2(.1,.28),new T.Vector2(.075,.35),new T.Vector2(.15,.4)],7);add(stem,stone);
 const bowl=new T.LatheGeometry([new T.Vector2(.10,.38),new T.Vector2(.33,.43),new T.Vector2(.44,.5),new T.Vector2(.44,.54),new T.Vector2(.38,.54),new T.Vector2(.16,.45)],7);add(bowl,stone);
 const upperWater=new T.CircleGeometry(.38,7);upperWater.rotateX(-Math.PI/2);upperWater.translate(0,.515,0);add(upperWater,water);
 const top=new T.LatheGeometry([new T.Vector2(.07,.515),new T.Vector2(.085,.54),new T.Vector2(.055,.62),new T.Vector2(.04,.66)],6);add(top,stone);
 const crown=new T.SphereGeometry(.06,6,4);crown.translate(0,.7,0);add(crown,stone);
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const root=new T.Group(),mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return root;
}
