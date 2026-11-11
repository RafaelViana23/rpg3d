import { royalAvenueBlocksPoint } from './RoyalAvenue';
import { batchStaticSiblings } from './StaticMeshBatch';
import { CITY_WOOD_MATERIAL } from './CityWood';
import * as T from 'three';
import { loadCityPropTemplate } from './CityProps';
import { addStreetLanternLight } from './CityFirelight';

export function streetLanternSites(objects:Iterable<T.Group>){
  const all=[...objects],avenues=all.filter(o=>o.userData.royalAvenue);
  const buildings=all.filter(o=>o.userData.building);
  buildings.forEach(o=>o.updateWorldMatrix(true,false));
  const sites:{owner:T.Group;point:T.Vector3}[]=[];
  for(const owner of buildings){
    if(owner.name!=='Cidade:house')continue;
    const b=owner.userData.building;
    // Place the pole just outside a front corner. A neighbouring facade
    // rejects continuous frontage, leaving the openings between city blocks.
    for(const side of [-1,1]){
    const point=owner.localToWorld(new T.Vector3(side*(b.width/2+.9),.08,b.depth/2+.9));
    if(avenues.some(avenue=>royalAvenueBlocksPoint(avenue,point,1.5)))continue;
    if(sites.some(s=>s.point.distanceTo(point)<23))continue;
    if(buildings.some(o=>{if(o===owner)return false;const p=o.worldToLocal(point.clone()),info=o.userData.building;return Math.abs(p.x)<info.width/2+1.5&&Math.abs(p.z)<info.depth/2+1.5;}))continue;
    sites.push({owner,point});
    }
  }
  // Sample the complete street circuit so every district receives lamps.
  return sites.length<=40?sites:Array.from({length:40},(_,i)=>sites[Math.floor(i*sites.length/40)]);
}
let brownTemplate:Promise<T.Group>|undefined;
function template(){
  return brownTemplate??=loadCityPropTemplate('street-lantern').then(source=>{
    const model=source.clone(true);
    model.traverse(child=>{if(!(child instanceof T.Mesh))return;
      const paint=(source:T.Material)=>{
        if(child.name.startsWith('Wood_')||child.name.startsWith('Lantern_'))return CITY_WOOD_MATERIAL;
        const m=source.clone();
        if(m instanceof T.MeshStandardMaterial){

          if(child.name.includes('Lighting_Effect')){m.color.set('#ffc57b');m.emissive.set('#ffb04d');m.emissiveIntensity=1.5;}
        }
        return m;
      };
      child.material=Array.isArray(child.material)?child.material.map(paint):paint(child.material);
    });
    model.updateMatrixWorld(true);
    const base=new T.Box3(),lamp=new T.Box3();
    model.traverse(child=>{if(!(child instanceof T.Mesh))return;
      if(child.name.startsWith('Stone_'))base.union(new T.Box3().setFromObject(child));
      if(child.name.includes('Lighting_Effect'))lamp.union(new T.Box3().setFromObject(child));
    });
    if(!base.isEmpty()&&!lamp.isEmpty()){
      const anchor=base.getCenter(new T.Vector3()),arm=lamp.getCenter(new T.Vector3()).sub(anchor);
      model.userData.streetFacingRotation=-Math.atan2(arm.x,arm.z);
      // Position streetside posts by their base rather than the arm's midpoint.
      for(const child of model.children){child.position.x-=anchor.x;child.position.z-=anchor.z;}
    }
    return model;
  });
}
export function addCityStreetLanterns(objects:Iterable<T.Group>){
  const all=[...objects];if(all.some(o=>o.userData.streetLanternScheduled))return;
  for(const {owner,point} of streetLanternSites(all)){
    owner.userData.streetLanternScheduled=true;
    void template().then(source=>{
      if(!owner.parent)return;
      const lantern=source.clone(true),height=new T.Box3().setFromObject(lantern).getSize(new T.Vector3()).y;
      owner.updateWorldMatrix(true,false);const scale=owner.getWorldScale(new T.Vector3()),factor=4.5/height;
      lantern.scale.set(factor/Math.abs(scale.x),factor/Math.abs(scale.y),factor/Math.abs(scale.z));
      lantern.position.copy(owner.worldToLocal(point.clone()));lantern.rotation.y=source.userData.streetFacingRotation??0;
      lantern.name='Lanterna marrom da rua';lantern.userData.sharedCityGeometry=true;lantern.userData.cityObject=true;
      lantern.userData.assetSource='/models/city/props/street-lantern.glb';
      addStreetLanternLight(lantern);
      batchStaticSiblings(lantern);
      // The elevated arm stays passable; only the post/base blocks movement.
      lantern.updateMatrixWorld(true);
      const base=new T.Box3();
      lantern.traverse(child=>{if(child instanceof T.Mesh&&child.name.startsWith('Stone_'))base.union(new T.Box3().setFromObject(child));});
      if(!base.isEmpty())owner.userData.localColliders.push([...base.min.toArray(),base.max.x,base.min.y+2/Math.abs(scale.y),base.max.z]);
      owner.add(lantern);owner.userData.colliderRevision=(owner.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar lanterna da rua',error));
  }
}
