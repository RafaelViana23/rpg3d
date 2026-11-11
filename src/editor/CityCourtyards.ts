import { royalAvenueBlocksPoint } from './RoyalAvenue';
import { TAVERN_BOTTLES } from './TavernBottles';
import { fitStorageWithoutOverlap } from './CityStoragePlacement';
import * as T from 'three';
import { loadCityPropTemplate } from './CityProps';
import { scheduleCityPropBatch } from './CityPropBatching';
import { cityRandom, cityObjectSeed } from './CityVariation';

/** Find open pockets surrounded by houses, away from the market and doorways. */
export function courtyardWellSites(objects:Iterable<T.Group>){
  const all=[...objects],avenues=all.filter(o=>o.userData.royalAvenue);
  const buildings=all.filter(o=>o.userData.building);
  const houses=buildings.filter(o=>o.name==='Cidade:house');
  buildings.forEach(o=>o.updateWorldMatrix(true,false));
  const rectangles=buildings.map(building=>({
    inverse:building.matrixWorld.clone().invert(),info:building.userData.building,
    scale:building.getWorldScale(new T.Vector3()),center:building.getWorldPosition(new T.Vector3()),
  }));
  const local=new T.Vector3();
  const clearance=(point:T.Vector3)=>{
    if(avenues.some(avenue=>royalAvenueBlocksPoint(avenue,point,4)))return 0;
    let nearest=Infinity;
    for(const rect of rectangles){
      local.copy(point).applyMatrix4(rect.inverse);
      const dx=(Math.abs(local.x)-rect.info.width/2)*Math.abs(rect.scale.x);
      const dz=(Math.abs(local.z)-rect.info.depth/2)*Math.abs(rect.scale.z);
      if(dx<=0&&dz<=0)return 0;
      nearest=Math.min(nearest,Math.hypot(Math.max(0,dx),Math.max(0,dz)));
    }
    return nearest;
  };
  const candidates:{owner:T.Group;point:T.Vector3;score:number}[]=[];
  for(const owner of houses){
    const info=owner.userData.building;
    for(const offset of [-6,0,6])for(const distance of [6,10,14]){
      const point=owner.localToWorld(new T.Vector3(offset,.08,-info.depth/2-distance));
      // Move toward the largest open space, rather than placing at a fixed wall offset.
      let space=clearance(point);
      if(space<3)continue;
      for(const step of [3,1.5,.75,.375]){
        let best=point.clone(),bestSpace=space;
        for(const dx of [-step,0,step])for(const dz of [-step,0,step]){
          const trial=point.clone().add(new T.Vector3(dx,0,dz)),free=clearance(trial);
          if(free>bestSpace){best=trial;bestSpace=free;}
        }
        point.copy(best);space=bestSpace;
      }
      if(space<5.2)continue;
      const nearby=rectangles.filter(r=>r.center.distanceTo(point)<34);
      if(nearby.length<3)continue;
      const angles=nearby.map(r=>Math.atan2(r.center.z-point.z,r.center.x-point.x)).sort((a,b)=>a-b);
      const gap=Math.max(...angles.map((a,i)=>(angles[(i+1)%angles.length]+(i===angles.length-1?Math.PI*2:0))-a));
      if(gap>Math.PI*.95)continue;
      candidates.push({owner,point,score:space*2+nearby.length*.1-gap});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  const selected:typeof candidates=[];
  for(const candidate of candidates){
    if(selected.some(s=>s.point.distanceTo(candidate.point)<35))continue;
    selected.push(candidate);if(selected.length===6)break;
  }
  return selected;
}

export function addCourtyardWells(objects:Iterable<T.Group>){
  const all=[...objects];
  addCourtyardClutter(all);
  if(all.some(o=>o.getObjectByName('Poço do pátio')))return;
  for(const {owner,point} of courtyardWellSites(all)){
    void loadCityPropTemplate('well-cover').then(template=>{
      if(!owner.parent)return;
      const well=template.clone(true),height=new T.Box3().setFromObject(well).getSize(new T.Vector3()).y;
      owner.updateWorldMatrix(true,false);
      const scale=owner.getWorldScale(new T.Vector3()),factor=4.2/Math.max(height,.001);
      well.scale.set(factor/Math.abs(scale.x),factor/Math.abs(scale.y),factor/Math.abs(scale.z));
      well.position.copy(owner.worldToLocal(point.clone()));well.name='Poço do pátio';
      well.userData.cityObject=true;well.userData.sharedCityGeometry=true;
      well.userData.assetSource='/models/city/props/well-cover.glb';
      well.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(well);
      owner.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
      owner.add(well);owner.userData.colliderRevision=(owner.userData.colliderRevision??0)+1;
    }).catch(error=>console.error('Não foi possível carregar poço do pátio',error));
  }
}


/** Wall-side storage groups keep the middle of courtyards and entrances open. */
export function addCourtyardClutter(objects:Iterable<T.Group>){
  const buildings=[...objects].filter(o=>o.userData.building);
  buildings.forEach(o=>o.updateWorldMatrix(true,false));
  const occupied:T.Vector3[]=[];
  const clear=(point:T.Vector3)=>buildings.every(other=>{
    const p=other.worldToLocal(point.clone()),info=other.userData.building;
    if(Math.abs(p.x)<info.width/2+1.1&&Math.abs(p.z)<info.depth/2+1.1)return false;
    // Reserve the approach to every door.
    return !(Math.abs(p.x)<info.doorWidth/2+2.5&&p.z>info.depth/2&&p.z<info.depth/2+5);
  });
  const place=(owner:T.Group,pack:string,name:string,height:number,point:T.Vector3,y:number,angle:number,lying=false)=>{
    void loadCityPropTemplate(pack,name).then(template=>{
      if(!owner.parent)return;
      const model=template.clone(true),size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
      const scale=owner.getWorldScale(new T.Vector3()),factor=height/Math.max(.001,size.y);
      model.scale.set(factor/Math.abs(scale.x),factor/Math.abs(scale.y),factor/Math.abs(scale.z));
      model.position.copy(owner.worldToLocal(point.clone()));model.position.y+=y/Math.abs(scale.y);model.rotation.y=angle;
      if(lying){
        model.rotation.z=Math.PI/2;model.updateMatrixWorld(true);
        const bounds=new T.Box3().setFromObject(model);model.position.y+=owner.worldToLocal(point.clone()).y+y/Math.abs(scale.y)-bounds.min.y;
      }
      model.name=`Pátio: ${name||pack}`;model.userData.cityObject=true;model.userData.sharedCityGeometry=true;
      model.userData.assetSource=`/models/city/props/${pack}.glb`;model.userData.batchableCityProp=true;
      if(!fitStorageWithoutOverlap(owner,model,buildings))return;
      model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model);
      owner.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
      owner.add(model);owner.userData.colliderRevision=(owner.userData.colliderRevision??0)+1;scheduleCityPropBatch(owner);
    }).catch(error=>console.error('Não foi possível carregar objetos do pátio',error));
  };
  for(const owner of buildings){
    if(owner.userData.courtyardClutterScheduled)continue;
    owner.userData.courtyardClutterScheduled=true;
    if(!['Cidade:house','Cidade:inn','Cidade:tavern','Cidade:shop'].includes(owner.name))continue;
    const info=owner.userData.building,random=cityRandom(cityObjectSeed(String(owner.userData.cityId??owner.userData.buildId??owner.position.toArray())));
    const candidates=[{x:-info.width*.25,z:-info.depth/2-2.3},{x:info.width*.25,z:-info.depth/2-2.3},
      {x:-info.width/2-2.3,z:0},{x:info.width/2+2.3,z:0}];
    let groups=0;
    for(const candidate of candidates){
      const center=owner.localToWorld(new T.Vector3(candidate.x,.08,candidate.z));
      if(occupied.some(p=>p.distanceTo(center)<6))continue;
      const points=[[-.8,0],[.7,.25],[0,1.1]].map(([x,z])=>center.clone().add(new T.Vector3(x,0,z)));
      if(!points.every(clear))continue;
      occupied.push(center);groups++;
      place(owner,'farm','Barrel',1.1+random()*.2,points[0],0,random()*.3);
      place(owner,'box-low-poly','',.9,points[1],0,random()*.3);
      place(owner,'farm','Bucket',.5+random()*.1,points[2],0,random()*Math.PI);
      if(random()<.4)place(owner,'box-low-poly','',.6,points[1],.9,random()*.15);
      const bottle=()=>TAVERN_BOTTLES[Math.floor(random()*TAVERN_BOTTLES.length)];
      // Stand one beside the crates; lay two farther along the wall on the paving.
      place(owner,bottle(),'',.4,center.clone().add(new T.Vector3(1.45,0,.45)),0,random()*Math.PI*2);
      for(const [x,z] of [[-1.6,.75],[.3,1.85]]){
        const point=center.clone().add(new T.Vector3(x,0,z));
        if(clear(point))place(owner,bottle(),'',.38,point,0,random()*Math.PI*2,true);
      }
      if(groups===2)break;
    }
  }
}
