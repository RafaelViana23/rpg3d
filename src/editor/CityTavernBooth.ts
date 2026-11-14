import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CITY_WOOD_MATERIAL} from './CityWood';
const upholstery=new T.MeshLambertMaterial({color:'#722b35'});
/** Wall-backed tavern bench, facing +Z. */
export function createCityTavernBooth(width=2.6,depth=.85){
 const wood:T.BufferGeometry[]=[],cloth:T.BufferGeometry[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,soft=false)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);(soft?cloth:wood).push(g);};
 box(0,.26,0,width,.52,depth);box(0,.57,.04,width-.1,.12,depth-.05,true);
 box(0,.91,-depth/2+.025,width,.78,.12);box(0,.93,-depth/2+.105,width-.14,.66,.10,true);
 const root=new T.Group();for(const [parts,material]of [[wood,CITY_WOOD_MATERIAL],[cloth,upholstery]] as const){const g=mergeGeometries([...parts])!;parts.forEach(p=>p.dispose());root.add(new T.Mesh(g,material));}return root;
}
