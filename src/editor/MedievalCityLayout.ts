import type { CityAssetKind, SavedCityObject } from './WorldEditorSupport';
import type { LowPolyCityBuilder } from './LowPolyCityBuilder';
import type { MedievalCityFloor } from '../world/MedievalCityFloor';

type Lot={kind:CityAssetKind;x:number;z:number;angle:number;sx:number;sy:number;sz:number;w:number;d:number};
const dimensions:Partial<Record<CityAssetKind,[number,number]>>={house:[12,16],inn:[32,12],tavern:[16,16],guild:[22,24],weapons:[16,16],potions:[16,16],church:[25,28],palace:[42,25]};
/** Deterministic street frontages: frontage follows the lane; doors face it. */
export function medievalStreetPlan(){
  const lots:Lot[]=[];
  let seed=84217;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const corners=(l:Lot)=>{const c=Math.cos(l.angle),s=Math.sin(l.angle);return [-1,1].flatMap(a=>[-1,1].map(b=>({x:l.x+a*(l.w+.5)/2*c+b*(l.d+.5)/2*s,z:l.z-a*(l.w+.5)/2*s+b*(l.d+.5)/2*c})));};
  const overlap=(a:Lot,b:Lot)=>{const ac=corners(a),bc=corners(b);for(const angle of [a.angle,b.angle])for(const turn of [0,Math.PI/2]){const x=Math.cos(angle+turn),z=-Math.sin(angle+turn),ap=ac.map(p=>p.x*x+p.z*z),bp=bc.map(p=>p.x*x+p.z*z);if(Math.max(...ap)<=Math.min(...bp)||Math.max(...bp)<=Math.min(...ap))return false;}return true;};
  const add=(kind:CityAssetKind,x:number,z:number,angle:number,sx=1,sy=1,sz=1)=>{
    const [w,d]=dimensions[kind]??[12,16],lot={kind,x,z,angle,sx,sy,sz,w:w*sx,d:d*sz};
    // Leave a clear perimeter promenade and keep every footprint outside the square.
    if(corners(lot).some(p=>Math.hypot(p.x,p.z)>193)||Math.hypot(x,z)-Math.hypot(lot.w,lot.d)/2<32||lots.some(other=>overlap(lot,other)))return false;
    lots.push(lot);return true;
  };
  // Civic buildings form distinct blocks, not one identical building per slice.
  add('palace',-69,-145,.38,1,1.1,1);
  add('church',93,-106,-.62,1,1,1);
  add('guild',-58,72,2.5,1,1.1,1);
  add('inn',39,61,-1.8,1,1.25,1);
  add('tavern',52,36,-1.5,1,1.15,1);
  add('weapons',-50,-38,.95,1,1.2,1);
  add('potions',-33,-55,.55,1,1.3,1);
  // Eight connected approaches, bending between blocks. Small frontage gaps
  // join houses; larger breaks at two radii become cross streets and alleys.
  for(let street=0;street<8;street++){
    const a=street*Math.PI/4,dx=Math.sin(a),dz=Math.cos(a),nx=Math.cos(a),nz=-Math.sin(a);
    for(const side of [-1,1])for(const row of [0,1]){
      let distance=row?105:43+random()*6;
      while(distance<179){
        const sx=.8+random()*.32,sy=1.25+random()*.85,sz=.85+random()*.3,width=12*sx;
        if(Math.abs(distance-96)<8||Math.abs(distance-147)<6){distance+=10;continue;}
        const bend=Math.sin(distance*.025+street*1.7)*3;
        const offset=side*(row?40+random()*1.2:7+8*sz+random()*.8)+bend;
        const x=dx*distance+nx*offset,z=dz*distance+nz*offset;
        const angle=a-side*Math.PI/2+(random()-.5)*.035;
        add('house',x,z,angle,sx,sy,sz);
        distance+=width+.65+(random()<.12?4:0);
      }
    }
  }
  return lots;
}

export function seedMedievalCity(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder,floor:MedievalCityFloor){
  if(Object.keys(saved).some(id=>id.startsWith('medieval-streets-v2-')))return false;
  const towers=[...builder.objects.entries()].filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,o])=>o);
  if(towers.length!==8)return false;
  const cx=towers.reduce((sum,o)=>sum+o.position.x,0)/8,cz=towers.reduce((sum,o)=>sum+o.position.z,0)/8;
  const y=floor.heightAt(cx,cz);if(y===null)return false;
  const scale=Math.min(...towers.map(o=>Math.hypot(o.position.x-cx,o.position.z-cz)))/225.382;
  // Only replace the previous generated district. Manually added assets survive.
  for(const [id,entry] of Object.entries(saved))if(id.startsWith('medieval-district-')&&!['market','fountain'].includes(entry.kind)){
    builder.objects.get(id)?.removeFromParent();builder.objects.delete(id);delete saved[id];
  }
  const add=(id:string,kind:CityAssetKind,x:number,z:number,angle=0,sx=1,sy=1,sz=1)=>{
    const entry:SavedCityObject={id,kind,layer:'Cidade Principal',position:[cx+x*scale,y,cz+z*scale],rotation:[0,angle,0],scale:[sx*scale,sy*scale,sz*scale]};saved[id]=entry;builder.add(entry);
  };
  for(const kind of ['fountain','market'] as const)if(!Object.values(saved).some(o=>o.kind===kind))add(`medieval-district-${kind}-center`,kind,0,0);
  medievalStreetPlan().forEach((l,i)=>add(`medieval-streets-v2-${l.kind}-${i}`,l.kind,l.x,l.z,l.angle,l.sx,l.sy,l.sz));
  return true;
}

/** Upgrade generated dimensions once, retaining later player edits. */
export function upgradeCityArchitecture(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
  let changed=false;
  // Scale the whole church so its interior, animated door and colliders agree.
  for(const entry of Object.values(saved)){
    if(entry.kind!=='church'||entry.churchScaleRevision===1)continue;
    entry.scale=entry.scale.map(value=>value*1.3);
    builder.objects.get(entry.id)?.scale.fromArray(entry.scale);
    entry.churchScaleRevision=1;changed=true;
  }
  const towers=[...builder.objects.entries()].filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,o])=>o);
  if(towers.length!==8)return changed;
  const cx=towers.reduce((n,o)=>n+o.position.x,0)/8,cz=towers.reduce((n,o)=>n+o.position.z,0)/8;
  const radius=Math.min(...towers.map(o=>Math.hypot(o.position.x-cx,o.position.z-cz)))*.85;
  for(const entry of Object.values(saved)){
    if(!entry.id.startsWith('medieval-streets-')||entry.architectureRevision===1)continue;
    const object=builder.objects.get(entry.id);if(!object?.userData.building)continue;
    if(entry.kind==='house')entry.scale[1]=Math.min(entry.scale[1],Math.max(entry.scale[0],entry.scale[2])*1.08);
    else if(entry.kind==='inn')entry.scale[1]=Math.min(entry.scale[0],entry.scale[2]);
    object.scale.fromArray(entry.scale);
    if(entry.kind==='inn'){
      const corners=(o:typeof object,x=o.position.x,z=o.position.z)=>{
        const b=o.userData.building,a=o.rotation.y,c=Math.cos(a),s=Math.sin(a),w=b.width*o.scale.x+2,d=b.depth*o.scale.z+2;
        return [-1,1].flatMap(i=>[-1,1].map(j=>[x+i*w/2*c+j*d/2*s,z-i*w/2*s+j*d/2*c]));
      };
      const neighbours=[...builder.objects.values()].filter(o=>o!==object&&o.userData.building);
      const overlaps=(other:typeof object,x:number,z:number)=>{
        const ac=corners(object,x,z),bc=corners(other);
        return [object.rotation.y,other.rotation.y].every(a=>[0,Math.PI/2].every(turn=>{
          const dx=Math.cos(a+turn),dz=-Math.sin(a+turn),ap=ac.map(p=>p[0]*dx+p[1]*dz),bp=bc.map(p=>p[0]*dx+p[1]*dz);
          return Math.max(...ap)>Math.min(...bp)&&Math.max(...bp)>Math.min(...ap);
        }));
      };
      const ox=object.position.x,oz=object.position.z;
      let found=false;
      for(let r=0;r<80&&!found;r+=3)for(let i=0;i<(r?32:1);i++){
        const a=i*Math.PI/16,x=ox+Math.sin(a)*r,z=oz+Math.cos(a)*r;
        if(Math.hypot(x-cx,z-cz)<52||corners(object,x,z).some(p=>Math.hypot(p[0]-cx,p[1]-cz)>radius)||neighbours.some(o=>overlaps(o,x,z)))continue;
        object.position.set(x,object.position.y,z);entry.position=object.position.toArray();found=true;break;
      }
    }
    entry.architectureRevision=1;changed=true;
  }
  return upgradeTavernDistrict(saved,builder)||changed;
}


/** Swap the tavern with its rear neighbour, then reserve room for the great hall. */
export function upgradeTavernDistrict(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder){
  let changed=false;
  const buildings=[...builder.objects.values()].filter(o=>o.userData.building);
  const towers=[...builder.objects.entries()].filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,o])=>o);
  const center=towers.length?{x:towers.reduce((s,o)=>s+o.position.x,0)/towers.length,z:towers.reduce((s,o)=>s+o.position.z,0)/towers.length}:{x:0,z:0};
  const radius=towers.length?Math.min(...towers.map(o=>Math.hypot(o.position.x-center.x,o.position.z-center.z)))*.85:Infinity;
  const corners=(o:typeof buildings[number],x:number,z:number)=>{
    const b=o.userData.building,a=o.rotation.y,c=Math.cos(a),s=Math.sin(a),w=b.width*Math.abs(o.scale.x)+3,d=b.depth*Math.abs(o.scale.z)+3;
    return [-1,1].flatMap(i=>[-1,1].map(j=>[x+i*w/2*c+j*d/2*s,z-i*w/2*s+j*d/2*c]));
  };
  const overlap=(o:typeof buildings[number],x:number,z:number,other:typeof o,otherX=other.position.x,otherZ=other.position.z)=>{
    const ac=corners(o,x,z),bc=corners(other,otherX,otherZ);
    return [o.rotation.y,other.rotation.y].every(a=>[0,Math.PI/2].every(turn=>{
      const dx=Math.cos(a+turn),dz=-Math.sin(a+turn),ap=ac.map(p=>p[0]*dx+p[1]*dz),bp=bc.map(p=>p[0]*dx+p[1]*dz);
      return Math.max(...ap)>Math.min(...bp)&&Math.max(...bp)>Math.min(...ap);
    }));
  };
  for(const entry of Object.values(saved)){
    if(entry.kind!=='tavern'||entry.tavernLayoutRevision===1)continue;
    const tavern=builder.objects.get(entry.id);if(!tavern)continue;
    const rearX=-Math.sin(tavern.rotation.y),rearZ=-Math.cos(tavern.rotation.y);
    const houses=buildings.filter(o=>o.name==='Cidade:house').sort((a,b)=>{
      const score=(o:typeof a)=>{const x=o.position.x-tavern.position.x,z=o.position.z-tavern.position.z;return Math.hypot(x,z)+(x*rearX+z*rearZ>0?0:1000);};return score(a)-score(b);
    });
    const house=houses[0],houseEntry=house?saved[house.userData.cityId]:undefined;
    const origin={x:tavern.position.x,z:tavern.position.z},target=house?{x:house.position.x,z:house.position.z}:origin;
    const neighbors=buildings.filter(o=>o!==tavern&&o!==house);
    const find=(o:typeof tavern,at:typeof origin,extra?:(x:number,z:number)=>boolean)=>{
      for(let r=0;r<=100;r+=2)for(let i=0;i<(r?64:1);i++){
        const angle=i*Math.PI/32,x=at.x+Math.sin(angle)*r,z=at.z+Math.cos(angle)*r;
        const poly=corners(o,x,z);
        if(poly.some(p=>Math.hypot(p[0]-center.x,p[1]-center.z)>radius)||Math.hypot(x-center.x,z-center.z)<40)continue;
        if(neighbors.some(other=>overlap(o,x,z,other))||extra?.(x,z))continue;
        return {x,z};
      }
    };
    const location=find(tavern,target);if(!location)continue;
    const home=house?find(house,origin,(x,z)=>overlap(house,x,z,tavern,location.x,location.z)):undefined;
    if(house&&!home)continue;
    tavern.position.set(location.x,tavern.position.y,location.z);entry.position=tavern.position.toArray();
    if(house&&home&&houseEntry){house.position.set(home.x,house.position.y,home.z);houseEntry.position=house.position.toArray();}
    entry.tavernLayoutRevision=1;changed=true;
  }
  return changed;
}

/** Four persistent, individually editable stores against the inner cardinal walls. */
export function seedWallWarehouses(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder,floor:MedievalCityFloor){
  const towers=[...builder.objects.entries()].filter(([id])=>id.startsWith('capital-octagon-tower-')).map(([,o])=>o);
  if(towers.length!==8)return false;
  const cx=towers.reduce((v,o)=>v+o.position.x,0)/8,cz=towers.reduce((v,o)=>v+o.position.z,0)/8;
  const scale=Math.min(...towers.map(o=>Math.hypot(o.position.x-cx,o.position.z-cz)))/225.382;
  let changed=false;
  for(const [direction,nx,nz] of [['norte',0,-1],['sul',0,1],['leste',1,0],['oeste',-1,0]] as const){
    const id=`medieval-wall-warehouse-${direction}`;
    const existing=saved[id];
    if(existing){
      if(existing.warehouseLayoutRevision===1)continue;
      existing.rotation[1]+=Math.PI/2;
      existing.position[0]-=nx*2*scale;existing.position[2]-=nz*2*scale;
      existing.warehouseLayoutRevision=1;
      const object=builder.objects.get(id);
      if(object){object.rotation.y=existing.rotation[1];object.position.fromArray(existing.position);}
      changed=true;continue;
    }
    const walls=[...builder.objects.entries()].filter(([key,o])=>key.startsWith('capital-octagon-wall-')&&Math.abs(Math.sin(o.rotation.y)*nx+Math.cos(o.rotation.y)*nz)>.99&&(o.position.x-cx)*nx+(o.position.z-cz)*nz>0).map(([,o])=>o);
    const wall=walls.sort((a,b)=>Math.abs((a.position.x-cx)*nz-(a.position.z-cz)*nx-45*scale)-Math.abs((b.position.x-cx)*nz-(b.position.z-cz)*nx-45*scale))[0];
    if(!wall)continue;
    // Side elevation follows the masonry; reserve room for the wall-side supplies.
    const x=wall.position.x-nx*17.3*scale,z=wall.position.z-nz*17.3*scale;
    const y=floor.heightAt(x,z);if(y===null)continue;
    const entry:SavedCityObject={id,kind:'warehouse',layer:'Cidade Principal',position:[x,y,z],rotation:[0,Math.atan2(-nx,-nz)+Math.PI/2,0],scale:[scale,scale,scale],warehouseLayoutRevision:1};
    saved[id]=entry;builder.add(entry);changed=true;
  }
  return changed;
}

/** Move the two houses beside the south warehouse as one row, preserving their owners. */
export function separateWarehouseHouses(saved:Record<string,SavedCityObject>,builder:LowPolyCityBuilder,floor:MedievalCityFloor){
  const warehouse=builder.objects.get('medieval-wall-warehouse-sul');if(!warehouse)return false;
  const houses=[...builder.objects.values()].filter(o=>o.name==='Cidade:house').sort((a,b)=>a.position.distanceToSquared(warehouse.position)-b.position.distanceToSquared(warehouse.position)).slice(0,2);
  if(houses.length!==2||houses.every(o=>saved[o.userData.cityId]?.warehouseClearanceRevision===1))return false;
  const group=new Set(houses),neighbors=[...builder.objects.values()].filter(o=>!group.has(o)&&o.userData.building);
  const polygon=(o:typeof warehouse,x=o.position.x,z=o.position.z,padding=2)=>{
    const b=o.userData.building,c=Math.cos(o.rotation.y),s=Math.sin(o.rotation.y),w=b.width*Math.abs(o.scale.x)+padding,d=b.depth*Math.abs(o.scale.z)+padding;
    return [-1,1].flatMap(i=>[-1,1].map(j=>[x+i*w/2*c+j*d/2*s,z-i*w/2*s+j*d/2*c]));
  };
  const overlaps=(a:number[][],b:number[][])=>[a,b].every(poly=>[1,2].every(edge=>{
    const dx=poly[edge][0]-poly[0][0],dz=poly[edge][1]-poly[0][1],ap=a.map(p=>p[0]*-dz+p[1]*dx),bp=b.map(p=>p[0]*-dz+p[1]*dx);
    return Math.max(...ap)>Math.min(...bp)&&Math.max(...bp)>Math.min(...ap);
  }));
  const towers=[...builder.objects.values()].filter(o=>o.name==='Cidade:tower');
  for(let shift=4;shift<=64;shift+=2){
    const dx=shift*Math.abs(warehouse.scale.x);
    const positions=houses.map(o=>({o,x:o.position.x+dx,z:o.position.z}));
    if(positions.some(({o,x,z})=>{
      const poly=polygon(o,x,z);
      if(poly.some(p=>floor.heightAt(p[0],p[1])===null)||neighbors.some(n=>overlaps(poly,polygon(n,n.position.x,n.position.z,n===warehouse?12:2))))return true;
      return towers.some(t=>{const angle=o.rotation.y,wx=t.position.x-x,wz=t.position.z-z,b=o.userData.building;
        const ax=Math.max(0,Math.abs(wx*Math.cos(angle)-wz*Math.sin(angle))-b.width*Math.abs(o.scale.x)/2-1),az=Math.max(0,Math.abs(wx*Math.sin(angle)+wz*Math.cos(angle))-b.depth*Math.abs(o.scale.z)/2-1);
        return Math.hypot(ax,az)<4.35*Math.abs(t.scale.x)+2;
      });
    }))continue;
    for(const {o,x,z} of positions){const entry=saved[o.userData.cityId];if(!entry)continue;o.position.set(x,o.position.y,z);entry.position=o.position.toArray();entry.warehouseClearanceRevision=1;}
    return true;
  }
  console.warn('Não foi encontrado espaço lateral para as casas do armazém');return false;
}
