import { registerRideableHorse } from '../player/RideableHorses';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CITY_WOOD_MATERIAL } from './CityWood';
import { loadCityPropTemplate } from './CityProps';
import { fitStorageWithoutOverlap } from './CityStoragePlacement';
import { addCityFirelight } from './CityFirelight';
import { scheduleCityPropBatch } from './CityPropBatching';
import type { SavedCityObject, CityAssetKind } from './WorldEditorSupport';
import type { LowPolyCityBuilder } from './LowPolyCityBuilder';
import type { MedievalCityFloor } from '../world/MedievalCityFloor';

export const PERIMETER_CATALOG=[
  {kind:'guardhouse',label:'Corpo da guarda'}, {kind:'stable',label:'Cavalariça'},
  {kind:'training-yard',label:'Pátio de treino'}, {kind:'military-store',label:'Depósito militar'},
  {kind:'tollhouse',label:'Posto de cobrança'}, {kind:'repair-workshop',label:'Oficina de manutenção'},
  {kind:'smithy',label:'Ferraria'}, {kind:'wagon-shelter',label:'Abrigo de carroças'},
  {kind:'wall-shrine',label:'Capela dos viajantes'},
] as const;
const mats={wood:CITY_WOOD_MATERIAL,stone:new T.MeshLambertMaterial({color:'#aaa99c'}),
  roof:new T.MeshLambertMaterial({color:'#975b40'}),iron:new T.MeshLambertMaterial({color:'#454e56'}),
  straw:new T.MeshLambertMaterial({color:'#cfb363'}),cloth:new T.MeshLambertMaterial({color:'#91414b'}),
  plaster:new T.MeshLambertMaterial({color:'#e6d9bd'}),white:new T.MeshLambertMaterial({color:'#e5d7b6'})};
type Mat=keyof typeof mats;
const footprints:Record<string,[number,number]>={guardhouse:[12,10],stable:[14,10],'training-yard':[18,10],'military-store':[12,10],tollhouse:[8,7],'repair-workshop':[12,9],smithy:[12,10],'wagon-shelter':[14,10],'wall-shrine':[8,8]};

export function createPerimeterBuilding(kind:string):T.Group|null{
  if(!footprints[kind])return null;
  const root=new T.Group();root.name=`Cidade:${kind}`;root.userData.cityObject=true;
  const [w,d]=footprints[kind],colliders:number[][]=[],walk:number[][]=[],roofs:number[][]=[];
  const batches=new Map<Mat,T.BufferGeometry[]>();
  const shape=(g:T.BufferGeometry,m:Mat,x:number,y:number,z:number,rz=0)=>{
    g.applyMatrix4(new T.Matrix4().makeRotationZ(rz));g.translate(x,y,z);
    const list=batches.get(m)??[];list.push(g);batches.set(m,list);
  };
  const box=(x:number,y:number,z:number,a:number,b:number,c:number,m:Mat,solid=true)=>{
    shape(new T.BoxGeometry(a,b,c),m,x,y,z);
    if(solid)colliders.push([x-a/2,y-b/2,z-c/2,x+a/2,y+b/2,z+c/2]);
  };
  const cylinder=(x:number,y:number,z:number,r:number,h:number,m:Mat)=>shape(new T.CylinderGeometry(r,r,h,10),m,x,y,z);
  const bench=(x:number,z:number,length=3)=>{box(x,.6,z,length,.18,.6,'wood');for(const dx of [-length*.35,length*.35])box(x+dx,.27,z,.2,.54,.5,'wood');};
  const table=(x:number,z:number)=>{box(x,1.1,z,2.7,.2,1.3,'wood');for(const dx of [-1,1])for(const dz of [-.4,.4])box(x+dx,.5,z+dz,.18,1,.18,'wood');};
  const rack=(x:number,z:number)=>{
    for(const dx of [-1.4,1.4])box(x+dx,1.1,z,.18,2.2,.4,'wood');
    box(x,1.6,z,3,.18,.3,'wood');
    for(const dx of [-1,-.5,0,.5,1]){box(x+dx,1.35,z,.07,2.5,.07,'wood',false);shape(new T.ConeGeometry(.13,.4,4),'iron',x+dx,2.8,z);}
  };
  const shield=(x:number,z:number)=>{const g=new T.CylinderGeometry(.48,.48,.12,8);g.rotateX(Math.PI/2);shape(g,'iron',x,1.25,z);box(x,1.25,z+.08,.12,.75,.08,'wood',false);};
  const roofed=kind!=='training-yard';
  if(roofed){
    box(0,-.05,0,w,.2,d,'stone',false);walk.push([-w/2,-d/2,w/2,d/2,.05]);
    for(const x of [-w/2+.2,w/2-.2])for(const z of [-d/2+.2,d/2-.2])box(x,2.2,z,.3,4.4,.3,'wood');
    box(0,2,-d/2,w,4,.3,'plaster');
    if(['guardhouse','military-store','tollhouse','wall-shrine'].includes(kind)){
      for(const side of [-1,1])box(side*w/2,2,0,.3,4,d,'plaster');
      // Broad open entrance faces the patrol lane.
      for(const side of [-1,1])box(side*(w/4+1),2,d/2,w/2-2,4,.3,'plaster');
      box(0,3.8,d/2,4,.4,.3,'wood');
    }
        // Sloped roof halves, with real shadow-casting geometry.
        for(const side of [-1,1]){
      const g=new T.BoxGeometry(w+.8,.24,Math.hypot(d/2+.5,1.8));g.rotateX(side*Math.atan2(1.8,d/2+.5));
      shape(g,'roof',0,5.1,side*(d/4+.25));
    }
    roofs.push([-w/2-.4,4.15,-d/2-.5,w/2+.4,6.1,d/2+.5]);
  }
  if(kind==='guardhouse'){
    table(0,0);bench(0,1.5);rack(-3,-3.5);shield(3,-4.5);
    for(const x of [-4,4]){box(x,.45,0,1.6,.55,3,'wood');box(x,.77,0,1.4,.12,2.7,'cloth',false);box(x,.87,-.9,1.2,.18,.5,'white',false);}
  }
  if(kind==='stable'){
    for(const x of [-4,0,4]){
      box(x,.5,-4.15,2.5,.6,.8,'wood');box(x,.82,-4.15,2.2,.05,.55,'straw',false);
      if(x!==4){box(x+2,1.1,-.8,.14,2.2,5.4,'wood');}
    }
    for(const x of [-2,2]){box(x,1.1,-4.6,1,.16,.45,'wood');box(x,1.3,-4.4,.75,.22,.6,'cloth',false);}
  }
  if(kind==='training-yard'){
    for(const x of [-6,0,6]){
      box(x,1.1,-2,.15,2.2,.15,'wood');cylinder(x,2.5,-2,.35,.6,'straw');box(x,1.7,-2,.7,1,.5,'straw');box(x,1.8,-2,1.8,.18,.2,'wood',false);
      const target=new T.CylinderGeometry(.9,.9,.15,16);target.rotateX(Math.PI/2);shape(target,'straw',x,2,-4.5);
      const bull=new T.CylinderGeometry(.22,.22,.17,12);bull.rotateX(Math.PI/2);shape(bull,'cloth',x,2,-4.4);
      box(x,1,-4.6,.15,2,.2,'wood');
    }
    rack(-6,3.5);bench(4,3.5,4);
  }
  if(kind==='military-store'){for(const x of [-4,0,4])rack(x,-3.8);for(const x of [-4,4])shield(x,-1.8);}
  if(kind==='tollhouse'){table(0,-1);bench(0,1);box(.6,1.3,-1,.65,.2,.45,'white',false);box(-.8,1.4,-1,.45,.4,.35,'iron',false);}
  if(kind==='repair-workshop'){table(-3,-2);const rope=new T.TorusGeometry(.35,.08,6,16);rope.rotateX(Math.PI/2);shape(rope,'straw',-3,1.28,-2);for(const x of [-3,-2.5,-2])box(x,1.25,-2,.12,.1,.7,'iron',false);for(const x of [1,1.5,2,2.5])box(x,.3,-3,.35,.4,3,'wood');rack(3,2);}
  if(kind==='smithy'){
    box(-3,.7,-2,2.6,1.4,2.4,'stone');box(-3,1.5,-2,1.8,.2,1.5,'iron');
    box(-3,4,-3.5,1.3,5,1.3,'stone');box(2,.45,0,.8,.9,.8,'wood');box(2,1,0,1.5,.3,.65,'iron');box(2.7,1.1,0,.6,.16,.35,'iron');
    table(3,-3);rack(-3,3);
  }
  if(kind==='wall-shrine'){
    box(0,.8,-2,2.4,1.5,1.3,'stone');box(0,2.8,-3.65,.22,2,.16,'wood',false);box(0,3.1,-3.65,1.2,.18,.16,'wood',false);
    bench(-2,1,2);bench(2,1,2);
  }
  for(const [m,geometries] of batches){const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(geometry){const mesh=new T.Mesh(geometry,mats[m]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}}
  root.userData.localColliders=colliders;root.userData.walkSurfaces=walk;root.userData.weatherRoofs=roofs;
  root.userData.perimeterFootprint=[w,d];root.userData.sharedCityGeometry=false;
  if(roofed)root.userData.building={width:w,depth:d,height:6,doorWidth:4,doorHeight:3.6,enterable:true,perimeter:true};
  queueMicrotask(()=>{if(root.parent)void furnishPerimeter(root,kind);});
  return root;
}

async function furnishPerimeter(root:T.Group,kind:string){
  const add=async(pack:string,name:string,w:number,h:number,d:number,x:number,z:number,y=.08)=>{
    try{
      const template=await loadCityPropTemplate(pack,name);if(!root.parent)return;
      const prop=clone(template) as T.Group,size=new T.Box3().setFromObject(prop).getSize(new T.Vector3());
      prop.scale.set(w/Math.max(size.x,.001),h/Math.max(size.y,.001),d/Math.max(size.z,.001));prop.position.set(x,y,z);
      const lit=pack==='candle'||pack==='tavern-fire';
      if(!lit&&!fitStorageWithoutOverlap(root,prop))return;
      prop.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(prop);
      if(!lit)root.userData.localColliders.push([...bounds.min.toArray(),...bounds.max.toArray()]);
      prop.name=`Decoração: ${name||pack}`;prop.userData.batchableCityProp=!lit;prop.userData.sharedCityGeometry=true;root.add(prop);
      if(lit){prop.animations=template.animations;prop.userData.alwaysLit=true;addCityFirelight(prop,pack==='tavern-fire');}
      root.userData.colliderRevision=(root.userData.colliderRevision??0)+1;scheduleCityPropBatch(root);
    }catch(error){console.error('Decoração da muralha',pack,error);}
  };
  if(kind==='wall-shrine')for(const x of [-.8,.8])await add('candle','',.18,.45,.18,x,-2,1.56);
  if(kind==='smithy')await add('tavern-fire','',1.2,.7,1,-3,-2,1.62);
  if(kind==='military-store')for(const x of [-3,0,3])await add('box-low-poly','',1.8,1.3,1.6,x,2);
  if(kind==='stable'){
    for(const x of [-5.8,5.8])await add('haystack','',1.2,1,1.6,x,.6);
    await add('farm','Barrel',1,1.2,1,5.8,2.8);
    try{
      const gltf=await new GLTFLoader().loadAsync('/models/animals/horse/model.glb');
      for(const x of [-4,0,4]){
        if(!root.parent)return;const model=clone(gltf.scene),horse=new T.Group();horse.add(model);model.updateMatrixWorld(true);
        model.traverse(o=>{if(o.name==='Object_21')o.visible=false;if(o instanceof T.SkinnedMesh)o.skeleton.update();if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});
        const b=new T.Box3().setFromObject(model,true),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());model.position.sub(new T.Vector3(center.x,b.min.y,center.z));horse.scale.setScalar(2.68/size.y);horse.position.set(x,.08,-.6);
        if(!fitStorageWithoutOverlap(root,horse))continue;
        horse.name='Cavalo da cavalariça';horse.animations=gltf.animations;horse.userData.animalModel='/models/animals/horse/model.glb';horse.userData.stableId=root.userData.cityId;horse.userData.rideableHorseId=`${root.userData.cityId}:horse:${x}`;
        root.add(horse);registerRideableHorse(horse,gltf.animations);
      }
    }catch(error){console.error('Cavalos da cavalariça',error);}
  }
  if(kind==='wagon-shelter'){await add('wagon','',3.8,2.8,6,0,0);await add('box-low-poly','',1.5,1.2,1.5,-5,2);}
  if(kind==='repair-workshop')await add('wheelbarrow','',1.5,1.1,2.5,3,0);
  if(kind==='guardhouse')await add('closed-box','',1.4,.8,.9,0,-3.7);
}

/** Add only missing outposts; keep saved editor transforms on subsequent loads. */
export function seedCityPerimeter(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder,floor:MedievalCityFloor){
  const towers=[...builder.objects.entries()].filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,o])=>o);
  if(towers.length!==8)return false;
  const cx=towers.reduce((n,o)=>n+o.position.x,0)/8,cz=towers.reduce((n,o)=>n+o.position.z,0)/8;
  const scale=Math.min(...towers.map(o=>Math.hypot(o.position.x-cx,o.position.z-cz)))/225.382;
  const apothem=Math.min(...towers.map(o=>Math.hypot(o.position.x-cx,o.position.z-cz)))*Math.cos(Math.PI/8);
  const plans:[CityAssetKind,string,number,number][]=[
    ['guardhouse','leste',Math.PI/2,-35],['guardhouse','oeste',-Math.PI/2,-35],
    ['stable','sul',0,-48],['training-yard','norte',Math.PI,10],
    ['military-store','nordeste',Math.PI*.75,35],['tollhouse','leste',Math.PI/2,25],
    ['tollhouse','oeste',-Math.PI/2,25],['tollhouse','sul',0,25],
    ['repair-workshop','noroeste',-Math.PI*.75,35],['smithy','sudeste',Math.PI*.25,35],
    ['wall-shrine','sudoeste',-Math.PI*.25,0],
    
  ];
  const corners=(x:number,z:number,a:number,w:number,d:number)=>[-1,1].flatMap(i=>[-1,1].map(j=>new T.Vector2(x+i*w/2*Math.cos(a)+j*d/2*Math.sin(a),z-i*w/2*Math.sin(a)+j*d/2*Math.cos(a))));
  const overlap=(a:T.Vector2[],b:T.Vector2[])=>[a,b].every(poly=>[1,2].every(edge=>{const p=poly[0],next=poly[edge],axis=new T.Vector2(-(next.y-p.y),next.x-p.x).normalize();const aa=a.map(v=>v.dot(axis)),bb=b.map(v=>v.dot(axis));return Math.max(...aa)>Math.min(...bb)&&Math.max(...bb)>Math.min(...aa);}));
  const gateBases=new Set(['military-store','repair-workshop','smithy']);
  const gates=Object.values(saved).filter(e=>e.kind==='gate');
  let changed=false;
  for(const [id,entry] of Object.entries(saved)){
    if(!id.startsWith('medieval-perimeter-v1-')&&entry.kind!=='wall-access')continue;
    // Retire exterior stair flights and migrate gate posts once to the gate flanks.
    if((gateBases.has(entry.kind)&&entry.perimeterLayoutRevision!==3)||id==='medieval-perimeter-v1-wagon-shelter-sul'||entry.kind==='wall-access'||(['guardhouse','tollhouse'].includes(entry.kind)&&entry.perimeterLayoutRevision!==2)){
      builder.objects.get(id)?.removeFromParent();builder.objects.delete(id);delete saved[id];changed=true;
    }
  }
  for(const [kind,name,a,preferred] of plans){
    const id=`medieval-perimeter-v1-${kind}-${name}`;if(saved[id])continue;
    const [w,d]=footprints[kind],nx=Math.sin(a),nz=Math.cos(a),rotation=a+Math.PI;
    let site:{x:number;z:number}|undefined;
    for(const offset of [0,4,-4,8,-8,12,-12,16,-16,20,-20,24,-24]){
      const tangent=preferred+offset;if(Math.abs(tangent)>69||(['leste','oeste','sul'].includes(name)&&Math.abs(tangent)<17+w/2))continue;
      const distance=apothem-((gateBases.has(kind)?6.65:7)+d/2)*scale;
      const x=cx+nx*distance+Math.cos(a)*tangent*scale,z=cz+nz*distance-Math.sin(a)*tangent*scale;
      const poly=corners(x,z,rotation,(w+2)*scale,(d+2)*scale);
      // Reserve the full approach of the real diagonal gates, not assumed cardinal gates.
      if(gates.some(gate=>{
        const angle=gate.rotation[1],reach=15*scale;
        return overlap(poly,corners(gate.position[0]+Math.sin(angle)*reach,gate.position[2]+Math.cos(angle)*reach,angle,14*Math.abs(gate.scale[0])+8*scale,45*scale));
      }))continue;
      const occupied=[...builder.objects.values()].filter(o=>o.userData.building||o.userData.perimeterFootprint).some(o=>{
        const b=o.userData.building,fp=o.userData.perimeterFootprint??[b.width,b.depth];
        return overlap(poly,corners(o.position.x,o.position.z,o.rotation.y,(fp[0]+2)*Math.abs(o.scale.x),(fp[1]+2)*Math.abs(o.scale.z)));
      });
      if(!occupied){site={x,z};break;}
    }
    if(!site){console.warn('Sem espaço livre para',id);continue;}
    const y=floor.heightAt(site.x,site.z);if(y===null)continue;
    const entry:SavedCityObject={id,kind,perimeterLayoutRevision:gateBases.has(kind)?3:2,layer:'Cidade Principal',position:[site.x,y,site.z],rotation:[0,rotation,0],scale:[scale,scale,scale]};saved[id]=entry;builder.add(entry);changed=true;
  }
  return changed;
}
