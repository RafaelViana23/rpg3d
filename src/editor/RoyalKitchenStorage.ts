import * as T from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

/** Lay out real model bounds in palace coordinates, then reserve them atomically. */
export function placeRoyalKitchenStorage(building:T.Group,crate:T.Group,barrel:T.Group,extras?:{table:T.Group;bottles:T.Group[]}){
 const room=building.userData.royalKitchen;if(!room||building.userData.kitchenStorageLoaded)return;
 const back=room.z-room.depth/2,front=room.z+room.depth/2,wall=27.8;
 const occupied:T.Box3[]=(building.userData.localColliders??[]).map((b:number[])=>new T.Box3(new T.Vector3(b[0],b[1],b[2]),new T.Vector3(b[3],b[4],b[5])));
 const pending:{prop:T.Group;bounds:T.Box3}[]=[];
 const fit=(template:T.Group,height:number)=>{const prop=cloneSkeleton(template) as T.Group;prop.position.set(0,0,0);prop.scale.multiplyScalar(height/new T.Box3().setFromObject(prop,true).getSize(new T.Vector3()).y);return prop;};
 const dimensions=(prop:T.Group)=>new T.Box3().setFromObject(prop,true).getSize(new T.Vector3());
 const place=(prop:T.Group,x:number,y:number,z:number,name:string)=>{
  const raw=new T.Box3().setFromObject(prop,true),center=raw.getCenter(new T.Vector3());
  prop.position.set(x-center.x,y-raw.min.y,z-center.z);prop.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(prop,true),inset=bounds.clone().expandByScalar(-.005);
  if(bounds.min.x<wall||bounds.max.x>52.4||bounds.min.z<back||bounds.max.z>front||occupied.some(b=>inset.intersectsBox(b)))throw new Error(`Sobreposição na despensa: ${name}`);
  prop.name=name;prop.userData.cityObject=true;prop.userData.sharedCityGeometry=true;
  occupied.push(bounds);pending.push({prop,bounds});return bounds;
 };
 const size=dimensions(fit(crate,.85));
 // Three crates on the floor, two above and one at the top. Every upper
 // footprint rests on the crates below; dimensions come from the actual GLB.
 for(const pileZ of [back+4,back+22,back+31])for(let row=0;row<3;row++)for(let column=0;column<3-row;column++){
  place(fit(crate,.85),wall+size.x/2+.025,room.y+row*size.y,pileZ+(column-(2-row)/2)*size.z,'Caixa empilhada da despensa');
 }
 const bs=dimensions(fit(barrel,1.3));
 // Two compact cellar groups at opposite ends, leaving the door approach clear.
 for(const centerZ of [back+13,front-5])for(const [column,row]of [[0,0],[0,1],[1,0]]){
  place(fit(barrel,1.3),wall+bs.x/2+.025+column*(bs.x+.12),room.y,centerZ+row*(bs.z+.12),'Barril da despensa');
 }
 // Loose stock is deliberately irregular, while the main west-door aisle stays open.
 for(const [x,z]of [[34,back+16],[34.5,back+26],[46,front-3],[33.8,front-24]])place(fit(crate,.7),x,room.y,z,'Caixa avulsa da cozinha');
 if(extras){
  for(const [index,z]of [back+14,back+27,front-10].entries()){
   const table=place(fit(extras.table,.85),46,room.y,z,'Mesa redonda da cozinha');
   const bottle=fit(extras.bottles[index%extras.bottles.length],.35);
   place(bottle,46,table.max.y,z,'Garrafa da taverna sobre a mesa');
  }
  for(const z of [back+17,front-8]){
   const lying=fit(barrel,1.3);lying.rotation.z=Math.PI/2;
   place(lying,30.8,room.y,z,'Barril deitado da cozinha');
  }
 }
 for(const {prop,bounds}of pending){building.add(prop);building.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);}
 building.userData.kitchenStorageLoaded=true;building.userData.colliderRevision=(building.userData.colliderRevision??0)+1;
}
