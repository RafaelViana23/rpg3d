import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
import {IRON_ARMOR_COLOR,IRON_METALNESS,IRON_ROUGHNESS} from '../inventory/armorMaterials';
const ironMaterial=new T.MeshStandardMaterial({color:IRON_ARMOR_COLOR,metalness:IRON_METALNESS,roughness:IRON_ROUGHNESS,flatShading:true});
export function createCityBeerBarrel(){
 const wood:T.BufferGeometry[]=[],iron:T.BufferGeometry[]=[];
 const body=new T.LatheGeometry([[.40,-.55],[.43,-.48],[.49,-.25],[.50,0],[.49,.25],[.43,.48],[.40,.55]].map(([r,y])=>new T.Vector2(r,y)),12);body.rotateX(Math.PI/2);body.translate(0,.70,0);wood.push(body);
 for(const side of [-1,1]){const cap=new T.CircleGeometry(.40,12);if(side<0)cap.rotateY(Math.PI);cap.translate(0,.70,side*.55);wood.push(cap);}
 for(const z of [-.4,.4]){const band=new T.CylinderGeometry(.48,.48,.08,12,1,true);band.rotateX(Math.PI/2);band.translate(0,.70,z);iron.push(band);}
 const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);wood.push(g);};
 for(const z of [-.35,.35]){box(0,.12,z,.88,.16,.14);for(const x of [-.34,.34])box(x,.25,z,.13,.32,.14);}
 const rim=new T.TorusGeometry(.40,.025,4,12);rim.translate(0,.70,.55);wood.push(rim);
 const pipe=new T.CylinderGeometry(.035,.035,.17,6);pipe.rotateX(Math.PI/2);pipe.translate(0,.48,.63);iron.push(pipe);
 const spout=new T.CylinderGeometry(.035,.035,.10,6,1,true);spout.translate(0,.43,.71);iron.push(spout);
 const handle=new T.BoxGeometry(.14,.035,.035);handle.translate(0,.54,.66);iron.push(handle);
 const root=new T.Group();for(const [parts,mat]of [[wood,CITY_WOOD_MATERIAL],[iron,ironMaterial]] as const){const g=mergeGeometries([...parts])!;parts.forEach(p=>p.dispose());const m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=true;root.add(m);}
 const b=new T.Box3().setFromObject(root),c=b.getCenter(new T.Vector3());for(const child of root.children)child.position.set(-c.x,-b.min.y,-c.z);return root;
}
