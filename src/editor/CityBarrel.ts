import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {IRON_ARMOR_COLOR,IRON_METALNESS,IRON_ROUGHNESS} from '../inventory/armorMaterials';
import {CITY_WOOD_COLOR} from './CityWood';
const material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
const ironMaterial=new T.MeshStandardMaterial({color:IRON_ARMOR_COLOR,metalness:IRON_METALNESS,roughness:IRON_ROUGHNESS,flatShading:true});
/** Shared optimized barrel. Wood and armor-grade iron use their respective shared material settings. */
export function createCityBarrel(){
 const parts:T.BufferGeometry[]=[],iron:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:string)=>{const metallic=color===IRON_ARMOR_COLOR,c=new T.Color(metallic?'#ffffff':color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));(metallic?iron:parts).push(g);};
 const profile=[[.34,0],[.36,.04],[.39,.22],[.39,.78],[.36,.96],[.34,1],[.31,1],[.31,.95]];
 const body=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),12);add(body,CITY_WOOD_COLOR);
 for(const y of [0,.95]){const cap=new T.CircleGeometry(y===0?.34:.31,12);cap.rotateX(y===0?Math.PI/2:-Math.PI/2);cap.translate(0,y,0);add(cap,CITY_WOOD_COLOR);}
 for(const [y,r]of [[.25,.396],[.72,.396]]){const band=new T.CylinderGeometry(r,r,.06,12,1,true);band.translate(0,y,0);add(band,IRON_ARMOR_COLOR);}
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,seam=new T.PlaneGeometry(.005,.56);seam.rotateY(angle);seam.translate(Math.sin(angle)*.391,.5,Math.cos(angle)*.391);add(seam,'#58452e');
 }
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);};
 for(const x of [-.035,.035])box(x,.974,0,.012,.045,.018,IRON_ARMOR_COLOR);box(0,.992,0,.082,.012,.018,IRON_ARMOR_COLOR);
 const tap=new T.CylinderGeometry(.024,.024,.1,6);tap.rotateZ(Math.PI/2);tap.translate(.405,.25,0);add(tap,CITY_WOOD_COLOR);
 const root=new T.Group();
 for(const [pieces,mat,name]of [[parts,material,'Madeira do barril'],[iron,ironMaterial,'Aros e alça de ferro']] as const){
  const geometry=mergeGeometries([...pieces])!;pieces.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 // Match the normalized farm/Barrel template exactly, preserving placement and stacking bounds.
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 for(const child of root.children){const mesh=child as T.Mesh;mesh.geometry.translate(-center.x,-bounds.min.y,-center.z);mesh.geometry.scale(.1311900845659692/size.x,.1378482745361468/size.y,.13345654700300824/size.z);}
 return root;
}
