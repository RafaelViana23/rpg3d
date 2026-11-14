import {Vector3,type Object3D} from 'three';
/** Project saved objects through their live world matrix, including all Euler axes. */
export function cityMapFootprint(object:Object3D){
 object.updateWorldMatrix(true,false);
 const kind=object.name.replace('Cidade:',''),b=object.userData.building;
 const width=b?.width??object.userData.perimeterFootprint?.[0]??(kind==='wall'?12:kind==='gate'?14:kind==='tower'?8:0);
 const depth=b?.depth??object.userData.perimeterFootprint?.[1]??(kind==='wall'?2.65:kind==='gate'?2.8:kind==='tower'?8:0);
 const world=(x:number,z:number)=>new Vector3(x,0,z).applyMatrix4(object.matrixWorld);
 const corners=width&&depth?[world(-width/2,-depth/2),world(width/2,-depth/2),world(width/2,depth/2),world(-width/2,depth/2)]:[];
 const door=b?.enterable?[world(-b.doorWidth/2,depth/2),world(b.doorWidth/2,depth/2)]:[];
 return {center:world(0,0),corners,door};
}
