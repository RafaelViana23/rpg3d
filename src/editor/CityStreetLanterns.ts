import {circularPlazaLanterns} from './CentralPlazaLayout';
import { batchStaticSiblings } from './StaticMeshBatch';
import { CITY_WOOD_MATERIAL } from './CityWood';
import * as T from 'three';
import { loadCityPropTemplate } from './CityProps';
import { addStreetLanternLight } from './CityFirelight';

const STREET_LANTERN_WORLD_Y = .2;

/** The Stone meshes also contain high fittings. Anchor/collide only the foot. */
export function streetLanternBaseBounds(root:T.Group,space:T.Object3D=root){
  root.updateWorldMatrix(true,true);space.updateWorldMatrix(true,false);
  const inverse=space.matrixWorld.clone().invert(),vertices:T.Vector3[]=[];
  const footBounds=root.userData.streetLanternFootBounds as number[]|undefined;
  if(footBounds)return new T.Box3(new T.Vector3(...footBounds.slice(0,3)),new T.Vector3(...footBounds.slice(3,6))).applyMatrix4(inverse.multiply(root.matrixWorld));
  root.traverse(child=>{if(!(child instanceof T.Mesh)||!child.name.startsWith('Stone_'))return;
    const transform=inverse.clone().multiply(child.matrixWorld),positions=child.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++)vertices.push(new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(transform));
  });
  const full=new T.Box3().setFromPoints(vertices),foot=new T.Box3();
  const limit=full.min.y+(full.max.y-full.min.y)*.08;
  for(const point of vertices)if(point.y<=limit)foot.expandByPoint(point);
  return foot;
}

export function streetLanternSites(objects:Iterable<T.Group>){
  const all=[...objects],gates=all.filter(o=>o.name==='Cidade:gate');
  const sites:{owner:T.Group;point:T.Vector3;facing:T.Vector3}[][]=[];
  for(const owner of all){
    if(!owner.userData.royalAvenue)continue;
    owner.updateWorldMatrix(true,false);
    const areas=owner.userData.royalAvenueAreas as number[][];
    const radius=owner.userData.royalAvenueCircle?.radius??26.9;
    for(const [axis,area] of areas.entries()){
      const [x0,z0,x1,z1]=area,vertical=axis===0;
      const halfWidth=(vertical?x1-x0:z1-z0)/2-.9;
      // The avenue trim is 0.9 m wide. Its centreline is 0.45 m beyond the
      // paving edge; anchor the post base exactly on that saved border axis.
      const edge=halfWidth+.45;
      const join=Math.sqrt(Math.max(0,(radius-.9)**2-halfWidth**2));
      const start=vertical?z0:x0,end=vertical?z1:x1;
      for(const [a,b] of [[start+5,-join-5],[join+5,end-5]]){
        if(b<a)continue;
        const count=Math.floor((b-a)/32)+1,first=(a+b-(count-1)*32)/2;
        for(let i=0;i<count;i++){
          const regularAlong=first+i*32;
          // The first pair after the plaza is the L-junction pair.  It must
          // sit on the actual meeting line, not five metres inside the road.
          const atJunction=a===join+5&&i===0?join:regularAlong;
          const along=atJunction;
          sites.push([-1,1].map(side=>({owner,
            point:owner.localToWorld(new T.Vector3(vertical?side*edge:along,0,vertical?along:side*edge)).setY(STREET_LANTERN_WORLD_Y),
            facing:new T.Vector3(vertical?-side:0,0,vertical?0:-side),
          })));
        }
      }
    }
  }
  // Preserve complete opposite pairs when limiting the city-wide fixture count.
  const pairs=sites.length<=20?sites:Array.from({length:20},(_,i)=>sites[Math.floor(i*sites.length/20)]);
  // Remove the complete final pair at each gateway; wall torches own that bay.
  const straight=pairs.filter(pair=>!gates.some(gate=>{
    const position=gate.getWorldPosition(new T.Vector3());
    return pair.some(site=>Math.hypot(site.point.x-position.x,site.point.z-position.z)<20);
  })).flat();
  const circular=all.filter(owner=>owner.userData.fountainPlazaCircle).flatMap(owner=>{
    const inner=owner.userData.fountainPlazaCircle.radius,outer=owner.userData.royalAvenueCircle.radius;
    return circularPlazaLanterns(inner,outer).map(site=>({owner,point:owner.localToWorld(new T.Vector3(site.x,0,site.z)).setY(STREET_LANTERN_WORLD_Y),facing:new T.Vector3(site.fx,0,site.fz)}));
  });
  // A mouth is reserved for the neighborhood street.  Remove fixtures that
  // would land inside that opening; the adjacent pair remains on the avenue
  // corners, outside the 5 m street carriageway.
  const clearOfMouth=(site:{owner:T.Group;point:T.Vector3})=>{
    const mouths=(site.owner.userData.streetMouthPoints as T.Vector3[]|undefined)??[];
    return !mouths.some(m=>m.distanceTo(site.owner.worldToLocal(site.point.clone()))<8);
  };
  return [...straight.filter(clearOfMouth),...circular];
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
    const base=streetLanternBaseBounds(model),lamp=new T.Box3();
    model.traverse(child=>{if(!(child instanceof T.Mesh))return;
      if(child.name.includes('Lighting_Effect'))lamp.union(new T.Box3().setFromObject(child));
    });
    if(!base.isEmpty()&&!lamp.isEmpty()){
      const anchor=base.getCenter(new T.Vector3()),arm=lamp.getCenter(new T.Vector3()).sub(anchor);
      model.userData.streetFacingRotation=-Math.atan2(arm.x,arm.z);
      // Position streetside posts by their base rather than the arm's midpoint.
      for(const child of model.children){child.position.x-=anchor.x;child.position.z-=anchor.z;child.position.y-=base.min.y;}
    }
    return model;
  });
}
export function addCityStreetLanterns(objects:Iterable<T.Group>){
  const all=[...objects];
  const sites=streetLanternSites(all);
  const byOwner=new Map<T.Group,typeof sites>();
  for(const site of sites){const list=byOwner.get(site.owner)??[];list.push(site);byOwner.set(site.owner,list);}
  // HMR and editor rebuilds can leave the procedural lanterns already mounted.
  // Apply the new junction coordinates to those instances instead of silently
  // keeping their old positions behind streetLanternScheduled.
  for(const [owner,ownerSites] of byOwner){
    const existing=owner.children.filter(child=>child.name==='Lanterna marrom da rua');
    if(!existing.length)continue;
    ownerSites.forEach((site,index)=>{
      const lantern=existing[index] as T.Group|undefined;if(!lantern)return;
      lantern.position.copy(owner.worldToLocal(site.point.clone()));
    });
  }
  const pending=sites.filter(({owner})=>!owner.userData.streetLanternScheduled);
  for(const owner of new Set(pending.map(site=>site.owner)))owner.userData.streetLanternScheduled=true;
  for(const [index,{owner,point,facing}] of pending.entries()){
    // Keep the planned position in avenue space across asynchronous model loads.
    const localPoint=owner.worldToLocal(point.clone());
    void template().then(source=>{
      if(!owner.parent)return;
      const lantern=source.clone(true),height=new T.Box3().setFromObject(lantern).getSize(new T.Vector3()).y;
      owner.updateWorldMatrix(true,false);const scale=owner.getWorldScale(new T.Vector3()),factor=4.5/height;
      lantern.scale.set(factor/Math.abs(scale.x),factor/Math.abs(scale.y),factor/Math.abs(scale.z));
      lantern.position.copy(localPoint);
      // Sites already express facing in avenue space; the parent applies its rotation.
      lantern.rotation.y=Math.atan2(facing.x,facing.z)+(source.userData.streetFacingRotation??0);
      lantern.userData.streetFacingRotation=source.userData.streetFacingRotation??0;
      lantern.name='Lanterna marrom da rua';lantern.userData.sharedCityGeometry=true;
      lantern.userData.buildId=`street-lantern-${owner.id}-${index}`;
      lantern.userData.buildEditable=true;
      lantern.userData.assetSource='/models/city/props/street-lantern.glb';
      owner.add(lantern);
      addStreetLanternLight(lantern);
      batchStaticSiblings(lantern);
      // The elevated arm stays passable; only the post/base blocks movement.
      lantern.updateMatrixWorld(true);
      const base=streetLanternBaseBounds(lantern,owner);
      if(!base.isEmpty())owner.userData.localColliders.push([...base.min.toArray(),base.max.x,base.min.y+2/Math.abs(scale.y),base.max.z]);
      owner.userData.colliderRevision=(owner.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar lanterna da rua',error));
  }
}
