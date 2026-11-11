import { loadCityPropTemplate } from './CityProps';
import { waitForCityPropSlot } from './CityPropLoading';
import { addCityFirelight } from './CityFirelight';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CITY_STONE_COLOR, CITY_MERLON_MATERIAL, CITY_PLAIN_STONE_MATERIAL, cityMasonryMaterial } from './CityStone';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const stone=cityMasonryMaterial(CITY_STONE_COLOR);
const coping=cityMasonryMaterial(CITY_STONE_COLOR);
const treadStone=CITY_PLAIN_STONE_MATERIAL;
const floorStone=CITY_MERLON_MATERIAL;

export const TOWER_GROUND=.825,TOWER_WALL_LANDING=6.225*3.75/5+.02,TOWER_TOP=10.825;
const TAU=Math.PI*2;
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
let template:T.Group|undefined;
export function createCityTower(){
  if(template)return instantiateTower(template);
  const root=new T.Group();root.name='Cidade:tower';root.userData.cityObject=true;
  const colliders:number[][]=[],flight:number[][]=[],surfaces:number[][]=[],polygons:number[][][]=[];
  const batches=new Map<T.Material,T.BufferGeometry[]>();
  const mesh=(g:T.BufferGeometry,m:T.Material,solid=false,floor=false)=>{
    if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
    if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
    g.computeBoundingBox();const b=g.boundingBox!;
    if(solid||floor)(floor?flight:colliders).push([...b.min.toArray(),...b.max.toArray()]);
    const list=batches.get(m)??[];list.push(g);batches.set(m,list);
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,ry=0,solid=true)=>{
    const g=new T.BoxGeometry(w,h,d);g.rotateY(ry);g.translate(x,y,z);mesh(g,m,solid);
  };
  const sector=(inner:number,outer:number,a:number,b:number,y:number,thickness:number,m:T.Material,walk=false,solid=false)=>{
    const points=[[inner*Math.cos(a),inner*Math.sin(a)],[outer*Math.cos(a),outer*Math.sin(a)],
      [outer*Math.cos(b),outer*Math.sin(b)],[inner*Math.cos(b),inner*Math.sin(b)]];
    const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
    const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y-thickness,0);
    mesh(g,m,solid,walk);
    if(walk){surfaces.push([Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),y]);polygons.push(points);}
  };
  const portalAngles=[Math.PI,5*Math.PI/8,-5*Math.PI/8];
  const halfWidth=.38,halfAngle=Math.asin(halfWidth/3.5);
  const portals=portalAngles.map((angle,i)=>({angle,bottom:i===0?.8:TOWER_WALL_LANDING,ground:i===0,halfWidth}));
  // Only actual shell faces: no radial partitions or averaged corner normals.
  // Analytic radial normals make adjacent panels read as one smooth cylinder.
  const shell=(a:number,b:number,lowA:number,lowB:number,highA=10.55,highB=10.55)=>{
    const point=(r:number,angle:number,y:number)=>new T.Vector3(r*Math.cos(angle),y,r*Math.sin(angle));
    const positions:number[]=[],normals:number[]=[];
    const quad=(points:T.Vector3[],radial=0)=>{
      const flat=new T.Vector3().subVectors(points[1],points[0]).cross(new T.Vector3().subVectors(points[2],points[0])).normalize();
      for(const i of [0,1,2,0,2,3]){
        const p=points[i],n=radial?new T.Vector3(p.x,0,p.z).normalize().multiplyScalar(radial):flat;
        positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);
      }
    };
    quad([point(3.5,a,lowA),point(3.5,b,lowB),point(3.5,b,highB),point(3.5,a,highA)],-1);
    quad([point(4.15,a,lowA),point(4.15,a,highA),point(4.15,b,highB),point(4.15,b,lowB)],1);
    quad([point(3.5,a,lowA),point(4.15,a,lowA),point(4.15,b,lowB),point(3.5,b,lowB)]);
    quad([point(3.5,a,highA),point(3.5,b,highB),point(4.15,b,highB),point(4.15,a,highA)]);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));mesh(g,stone,true);
  };
  const angles=Array.from({length:257},(_,i)=>i*TAU/256);
  for(const p of portals)for(let i=0;i<=64;i++){
    // Samples distributed along a semicircle also resolve its near-vertical ends.
    const delta=Math.asin(halfWidth*Math.cos(i*Math.PI/64)/3.5);
    angles.push((p.angle+delta+TAU)%TAU);
  }
  angles.sort((a,b)=>a-b);
  const cuts=angles.filter((a,i)=>i===0||a-angles[i-1]>1e-8);
  for(let i=0;i<cuts.length-1;i++){
    const a=cuts[i],b=cuts[i+1],mid=(a+b)/2;
    const portal=portals.find(p=>Math.abs(angleDelta(mid,p.angle))<halfAngle+1e-8);
    if(portal){
      const head=(angle:number)=>{
        const tangent=3.5*Math.sin(angleDelta(angle,portal.angle));
        return portal.bottom+.72+Math.sqrt(Math.max(0,halfWidth*halfWidth-tangent*tangent));
      };
      // The stone support sits below the wooden slab, never on its visible face.
      const baseTop=portal.ground?portal.bottom:portal.bottom-.12;
      shell(a,b,0,0,baseTop,baseTop);
      shell(a,b,head(a),head(b));
      if(portal.ground)sector(3.5,4.15,a,b,TOWER_GROUND,.1,stone,true);
    }else shell(a,b,0,0);
  }
  for(const p of portals)for(const sign of [-1,1]){
    const angle=p.angle+sign*halfAngle,positions:number[]=[];
    const points=[new T.Vector3(3.5*Math.cos(angle),p.bottom,3.5*Math.sin(angle)),new T.Vector3(4.15*Math.cos(angle),p.bottom,4.15*Math.sin(angle)),new T.Vector3(4.15*Math.cos(angle),p.bottom+.72,4.15*Math.sin(angle)),new T.Vector3(3.5*Math.cos(angle),p.bottom+.72,3.5*Math.sin(angle))];
    for(const i of (sign>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]))positions.push(...points[i].toArray());
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();mesh(g,stone,true);
  }
  // Dressed stone around the arches and jambs gives the openings a readable edge.
  for(const p of portals)for(const [r,sign] of [[3.48,-1],[4.17,1]]){
    const frame=(coordinates:number[][])=>{
      const vertices:number[]=[],normals:number[]=[];
      for(const i of (sign<0?[0,1,2,0,2,3]:[0,2,1,0,3,2])){
        const [x,y]=coordinates[i],a=p.angle+Math.asin(x/3.5);vertices.push(r*Math.cos(a),y,r*Math.sin(a));normals.push(sign*Math.cos(a),0,sign*Math.sin(a));
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));mesh(g,coping);
    };
    for(let i=0;i<48;i++){
      const a=i*Math.PI/48,b=(i+1)*Math.PI/48;
      frame([[.38*Math.cos(a),p.bottom+.72+.38*Math.sin(a)],[.46*Math.cos(a),p.bottom+.72+.46*Math.sin(a)],[.46*Math.cos(b),p.bottom+.72+.46*Math.sin(b)],[.38*Math.cos(b),p.bottom+.72+.38*Math.sin(b)]]);
    }
    for(const side of [-1,1]){const points=[[side*.38,p.bottom],[side*.46,p.bottom],[side*.46,p.bottom+.72],[side*.38,p.bottom+.72]];frame(side<0?points.reverse():points);}
  }
  // Lift the interior slab above the city paving so their surfaces never fight.
  for(let i=0;i<128;i++)sector(0,3.5,i*TAU/128,(i+1)*TAU/128,TOWER_GROUND,.16,floorStone,true);
  // Central mast and two spiral flights. The intermediate landing connects to both walls.
  const mast=new T.CylinderGeometry(.32,.38,TOWER_TOP-TOWER_GROUND,16);mast.translate(0,(TOWER_TOP+TOWER_GROUND)/2,0);mesh(mast,stone,true);
  const steps:{angle:number;height:number}[]=[];
  const spiral=(start:number,bottom:number,top:number,count:number)=>{
    for(let i=0;i<count;i++){
      const a=start+i*TAU/count,b=start+(i+1)*TAU/count,y=bottom+(top-bottom)*(i+1)/count;
      sector(1.25,3.3,a,b-.008,y,.065,treadStone,true);
      sector(1.25,3.3,b-.008,b,y,.065,CITY_PLAIN_STONE_MATERIAL);steps.push({angle:(a+b)/2,height:y});

    }
  };
  const lowerStart=Math.PI+.35,lowerEnd=lowerStart+TAU;
  // Keep the upper flight beyond both wall doorways, leaving a clear approach.
  const upperStart=lowerStart+1.25,upperEnd=upperStart+TAU;
  spiral(lowerStart,TOWER_GROUND,TOWER_WALL_LANDING,72);
  const middleOpeningStart=lowerEnd-1;
  const floorCuts=Array.from({length:129},(_,i)=>lowerEnd+i*TAU/128);
  floorCuts.push(middleOpeningStart+TAU);floorCuts.sort((a,b)=>a-b);
  for(let i=0;i<floorCuts.length-1;i++){
    const a=floorCuts[i],b=floorCuts[i+1];
    sector(.38,1.25,a,b,TOWER_WALL_LANDING,.12,floorStone,true);
    sector(3.3,3.5,a,b,TOWER_WALL_LANDING,.12,floorStone,true);
    if((a+b)/2<middleOpeningStart+TAU)sector(1.25,3.3,a,b,TOWER_WALL_LANDING,.12,floorStone,true);
  }
  // Finish exactly at each wall's end plane: no coplanar slab under the battlement.
  for(const a of [5*Math.PI/8,11*Math.PI/8]){
    const points=[[3.45,-.58],[3.75,-.58],[3.75,.58],[3.45,.58]].map(([r,t])=>[r*Math.cos(a)-t*Math.sin(a),r*Math.sin(a)+t*Math.cos(a)]);
    const g=new T.ExtrudeGeometry(new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z))),{depth:.12,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,TOWER_WALL_LANDING-.12,0);mesh(g,floorStone,false,true);
    surfaces.push([Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),TOWER_WALL_LANDING]);polygons.push(points);
  }

  spiral(upperStart,TOWER_WALL_LANDING,TOWER_TOP,112);
  // Top deck has an actual annular opening above the final staircase approach.
  const openingStart=upperEnd-1.05;
  for(let i=0;i<128;i++){
    const a=upperEnd+i*TAU/128,b=upperEnd+(i+1)*TAU/128;
    sector(.38,1.25,a,b,TOWER_TOP,.16,floorStone,true);
    sector(3.3,4.35,a,b,TOWER_TOP,.16,floorStone,true);
    if(a<openingStart+TAU)sector(1.25,3.3,a,b,TOWER_TOP,.16,floorStone,true);
    // Parapet is continuous; merlons sit above it.
    sector(4.02,4.35,a,b,TOWER_TOP+.25,.25,stone,false,true);
  }
  for(let i=0;i<16;i++){
    const a=i*TAU/16;
    box(4.14*Math.cos(a),TOWER_TOP+.7,4.14*Math.sin(a),.7,.9,.5,CITY_MERLON_MATERIAL,-a+Math.PI/2);
  }
  for(const [material,parts] of batches){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;const object=new T.Mesh(geometry,material);object.castShadow=object.receiveShadow=true;root.add(object);}
  root.userData.localColliders=colliders;root.userData.localFlightColliders=flight;
  root.userData.walkSurfaces=surfaces;root.userData.walkSurfacePolygons=polygons;
  root.userData.walkStepHeight=.065;
  root.userData.towerPortals=portals;root.userData.spiralSteps=steps;
  root.userData.middleStairOpening={inner:1.25,outer:3.3,start:middleOpeningStart,end:lowerEnd,height:TOWER_WALL_LANDING};
  root.userData.spiralAngles={lowerStart,upperStart};
  root.userData.torchSites=[
    ...steps.filter((_,i)=>i<72?i%8===4:(i-72)%12===6).map(s=>({angle:s.angle,height:s.height+.28,radius:3.43})),
    ...[TOWER_GROUND,TOWER_WALL_LANDING].flatMap(y=>[0,Math.PI].map(angle=>({angle,height:y+.28,radius:.47}))),
  ];
  root.userData.topStairOpening={inner:1.25,outer:3.3,start:openingStart,end:upperEnd,height:TOWER_TOP};
  root.userData.weatherRoofs=[[-4.35,TOWER_TOP,-4.35,4.35,TOWER_TOP,4.35]];
  root.traverse(o=>{o.userData.cityObject=true;});
  root.userData.sharedCityGeometry=true;template=root;
  return instantiateTower(root);
}

function instantiateTower(template:T.Group){
  const tower=template.clone(true);
  if(typeof window!=='undefined')queueMicrotask(()=>{if(tower.parent)void addTowerTorches(tower);});
  return tower;
}
async function addTowerTorches(tower:T.Group){
  try{
    const template=await loadCityPropTemplate('wall-torch');
    const bounds=new T.Box3().setFromObject(template,true),size=bounds.getSize(new T.Vector3());
    // Locate the back of the mounting bracket, excluding the animated flame.
    let bracketBack=Infinity;const vertex=new T.Vector3();template.updateMatrixWorld(true);
    template.traverse(child=>{if(!(child instanceof T.Mesh))return;
      for(let i=0;i<child.geometry.getAttribute('position').count;i++){
        child.getVertexPosition(i,vertex).applyMatrix4(child.matrixWorld);
        if(vertex.y<bounds.min.y+size.y*.6)bracketBack=Math.min(bracketBack,vertex.z);
      }
    });
    if(!Number.isFinite(bracketBack))bracketBack=bounds.min.z;
    for(const site of tower.userData.torchSites){
      await waitForCityPropSlot(tower);if(!tower.parent)return;
      const torch=cloneSkeleton(template) as T.Group;
      tower.updateWorldMatrix(true,false);const scale=tower.getWorldScale(new T.Vector3());
      const factor=.95/Math.max(.001,size.y);torch.scale.set(factor/Math.abs(scale.x),factor/Math.abs(scale.y),factor/Math.abs(scale.z));
      let radius=site.radius;
      if(site.radius<1){
        const pillarRadius=.38-.06*T.MathUtils.clamp((site.height-TOWER_GROUND)/(TOWER_TOP-TOWER_GROUND),0,1);
        radius=pillarRadius-bracketBack*torch.scale.z-.002;
      }
      torch.position.set(radius*Math.cos(site.angle),site.height,radius*Math.sin(site.angle));
      const facing=site.radius<1?1:-1;
      torch.rotation.y=Math.atan2(facing*Math.cos(site.angle),facing*Math.sin(site.angle));torch.name='Tocha da torre';torch.animations=template.animations;
      torch.userData.cityObject=true;torch.userData.sharedCityGeometry=true;torch.userData.alwaysLit=true;torch.userData.towerTorch=true;
      tower.add(torch);addCityFirelight(torch,true,{intensity:96,distance:42});
    }
  }catch(error){console.error('Não foi possível iluminar a torre',error);}
}

/** Convex tread footprints prevent rectangular bounds from filling the spiral's void. */
export function containsWalkPolygon(points:number[][],x:number,z:number){
  let positive=false,negative=false;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],cross=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);
    if(cross>1e-8)positive=true;if(cross< -1e-8)negative=true;
  }
  return !(positive&&negative);
}
