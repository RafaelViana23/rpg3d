import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
const waterMaterial=new T.MeshStandardMaterial({color:'#72a7b4',transparent:true,opacity:.8,roughness:.22,metalness:.08,side:T.DoubleSide,depthWrite:false,forceSinglePass:true});
/** Shared optimized bucket: tapered wooden well bucket with its wooden handle and real water surface. */
export function createCityBucket(){
 const root=new T.Group(),parts:T.BufferGeometry[]=[];
 parts.push(new T.LatheGeometry([new T.Vector2(.24,0),new T.Vector2(.32,.45),new T.Vector2(.34,.48),new T.Vector2(.30,.48),new T.Vector2(.30,.42)],10));
 const bottom=new T.CircleGeometry(.24,10);bottom.rotateX(Math.PI/2);parts.push(bottom);
 for(const side of [-1,1]){
  const shape=new T.Shape();shape.moveTo(-.075,0);shape.lineTo(.075,0);shape.lineTo(.075,.21);shape.lineTo(.035,.26);shape.lineTo(-.035,.26);shape.lineTo(-.075,.21);shape.closePath();
  const bracket=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false});bracket.rotateY(Math.PI/2);bracket.translate(side*.335-.0175,.40,0);parts.push(bracket);
 }
 const grip=new T.CatmullRomCurve3([new T.Vector3(-.335,.615,0),new T.Vector3(-.2,.65,0),new T.Vector3(.2,.65,0),new T.Vector3(.335,.615,0)]);parts.push(new T.TubeGeometry(grip,4,.024,4,false));
 const flat=parts.map(g=>{if(!g.index)return g;const result=g.toNonIndexed();g.dispose();return result;});
 const geometry=mergeGeometries(flat)!;flat.forEach(g=>g.dispose());geometry.computeVertexNormals();
 const wood=new T.Mesh(geometry,CITY_WOOD_MATERIAL);wood.name='Madeira do balde';wood.castShadow=wood.receiveShadow=true;root.add(wood);
 const water=new T.Mesh(new T.CircleGeometry(.295,10),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=.435;water.name='Água do balde';water.receiveShadow=true;root.add(water);root.userData.containsWater=true;
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 const transform=new T.Matrix4().makeScale(.08275825634621006/size.x,.06848648016978001/size.y,.08692628634282387/size.z).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
 for(const child of root.children){const mesh=child as T.Mesh;mesh.updateMatrix();mesh.geometry.applyMatrix4(transform.clone().multiply(mesh.matrix));mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.updateMatrix();}
 return root;
}
