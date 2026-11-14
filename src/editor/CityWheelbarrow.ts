import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
import {IRON_ARMOR_COLOR,IRON_METALNESS,IRON_ROUGHNESS} from '../inventory/armorMaterials';
const ironMaterial=new T.MeshStandardMaterial({color:IRON_ARMOR_COLOR,metalness:IRON_METALNESS,roughness:IRON_ROUGHNESS});
/** Approved procedural wheelbarrow: open wooden box, raised slats, single spoked wheel. */
export function createCityWheelbarrow(){
 const wood:T.BufferGeometry[]=[],iron:T.BufferGeometry[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,angle=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateZ(angle);g.translate(x,y,z);wood.push(g);};
 // Tray and two long rails/handles, wheel at +X.
 box(-.12,.65,0,1.18,.075,.70);
 for(const z of [-.34,.34])box(-.45,.51,z,2.18,.065,.065,-.04);
 // Three distinct horizontal planks on each side, opening slightly toward the rim.
 for(let row=0;row<3;row++){
  const y=.75+row*.13,z=.36+row*.025;
  for(const side of [-1,1])box(-.12,y,side*z,1.26,.105,.045);
  for(const side of [-1,1])box(-.12+side*(.61+row*.025),y,0,.045,.105,z*2);
 }
 for(const x of [-.76,.52])for(const z of [-.42,.42])box(x,.88,z,.055,.65,.055);
 for(const z of [-.3,.3])box(-.48,.29,z,.065,.58,.065,.08);
 const cx=.94,cy=.31,r=.30;
 const tyre=new T.TorusGeometry(r,.045,4,12);tyre.translate(cx,cy,0);iron.push(tyre);
 const rim=new T.TorusGeometry(r-.055,.028,4,12);rim.translate(cx,cy,0);wood.push(rim);
 for(let i=0;i<6;i++){const a=i*Math.PI/6;box(cx,cy,0,(r-.055)*2,.035,.055,a);}
 const axle=new T.CylinderGeometry(.055,.055,.84,8);axle.rotateX(Math.PI/2);axle.translate(cx,cy,0);iron.push(axle);
 for(const z of [-.34,.34])box(.62,.44,z,.76,.065,.065,-.42);
 const root=new T.Group();
 for(const [parts,material]of [[wood,CITY_WOOD_MATERIAL],[iron,ironMaterial]] as const){const geometry=mergeGeometries([...parts])!;parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const child of root.children)child.position.set(-center.x,-bounds.min.y,-center.z);
 return root;
}
