import {batchStaticSiblings} from './StaticMeshBatch';
import * as T from 'three';
import {CITY_WOOD_MATERIAL} from './CityWood';

/** Timber tabletop and four inset legs shared with the palace library. */
export function appendRoyalTimberTable(x:number,y:number,z:number,add:(geometry:T.BufferGeometry,material:T.Material)=>void,width=6.4,depth=2.6){
 const box=(cx:number,cy:number,cz:number,w:number,h:number,d:number)=>{
  const geometry=new T.BoxGeometry(w,h,d);geometry.translate(cx,cy,cz);add(geometry,CITY_WOOD_MATERIAL);
 };
 box(x,y+1.05,z,width,.16,depth);
 for(const dx of [-width/2+.3,width/2-.3])for(const dz of [-depth/2+.25,depth/2-.25])box(x+dx,y+.48,z+dz,.18,.96,.18);
}

/** Prop template for fitted desks, using the same joinery as the inn tables. */
export function createRoyalTimberTable(){
 const root=new T.Group();root.name='Mesa de madeira da pousada';
 appendRoyalTimberTable(0,0,0,(geometry,material)=>{
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 });
 batchStaticSiblings(root);
 return root;
}
