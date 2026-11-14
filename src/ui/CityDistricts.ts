import {Vector3, type Group, type Vector2} from 'three';
import {cityMapFootprint} from './CityMapFootprint';

export const CITY_COMMERCIAL_RADIUS=90;

export const CITY_DISTRICTS = [
  {id:'noble',name:'Distrito Nobre',short:'Nobre',color:'#f1ce4b'},
  {id:'royal',name:'Distrito Real',short:'Real',color:'#bb77ef'},
  {id:'commercial',name:'Distrito Comercial',short:'Comercial',color:'#f4a33d'},
  {id:'military',name:'Distrito Militar',short:'Militar',color:'#ed7377'},
  {id:'residential',name:'Bairro Residencial',short:'Residencial',color:'#df8acb'},
] as const;
export type DistrictId=typeof CITY_DISTRICTS[number]['id'];
const kinds:Record<string,{district:DistrictId;label:string}>={
  palace:{district:'royal',label:'Palácio'},
  market:{district:'commercial',label:'Mercado'},fountain:{district:'commercial',label:'Fonte'},shop:{district:'commercial',label:'Loja'},
  guild:{district:'residential',label:'Guilda'},weapons:{district:'residential',label:'Loja de armas'},potions:{district:'residential',label:'Loja de poções'},
  inn:{district:'residential',label:'Pousada da Selena'},tavern:{district:'residential',label:'Taverna'},stable:{district:'residential',label:'Cavalariça'},'wagon-shelter':{district:'residential',label:'Abrigo de carroças'},
  church:{district:'residential',label:'Igreja'},'wall-shrine':{district:'residential',label:'Capela dos viajantes'},
  guardhouse:{district:'military',label:'Corpo da guarda'},'training-yard':{district:'military',label:'Pátio de treino'},'military-store':{district:'military',label:'Depósito militar'},
  smithy:{district:'residential',label:'Ferraria'},'repair-workshop':{district:'residential',label:'Oficina de manutenção'},
  house:{district:'residential',label:'Casa'},
};
type XY={x:number;z:number};
type Site=XY&{district:DistrictId};
const polygonArea=(p:XY[])=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.z-b.x*a.z;},0))/2;
export type DistrictPlan={cells:{site:Site;polygon:XY[]}[];inventory:Map<DistrictId,Map<string,number>>;support:Map<string,number>};
let cachedKey='',cached:DistrictPlan;
/** Half-plane clipping keeps the planning overlay inside the live city perimeter. */
function clip(poly:XY[],a:number,b:number,c:number){
  const out:XY[]=[];
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p.x+b*p.z-c,dq=a*q.x+b*q.z-c;
    if(dp<=0)out.push(p);
    if((dp<=0)!==(dq<=0)){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
  }
  return out;
}
/** Subtract a convex footprint as disjoint convex fragments (no overlapping zones). */
function subtractPolygon(polygon:XY[],cut:XY[]){
  if(!polygon.length||!cut.length)return polygon.length?[polygon]:[];
  const center=cut.reduce((p,q)=>({x:p.x+q.x/cut.length,z:p.z+q.z/cut.length}),{x:0,z:0});
  const outside:XY[][]=[];let remaining=polygon;
  for(let i=0;i<cut.length&&remaining.length;i++){
    const p=cut[i],q=cut[(i+1)%cut.length];let a=q.z-p.z,b=p.x-q.x,c=a*p.x+b*p.z;
    if(a*center.x+b*center.z>c){a=-a;b=-b;c=-c;}
    const fragment=clip(remaining,-a,-b,-c);if(polygonArea(fragment)>1e-6)outside.push(fragment);
    remaining=clip(remaining,a,b,c);
  }
  return outside;
}
export function cityDistrictPlan(objects:Iterable<Group>,perimeter:Vector2[]|undefined,commercialRadius=CITY_COMMERCIAL_RADIUS):DistrictPlan{
  const live=[...objects].filter(o=>o.parent);
  const entries=live.map(o=>({kind:o.name.replace('Cidade:',''),footprint:cityMapFootprint(o),object:o}));
  const avenue=live.find(o=>o.userData.royalAvenue);
  avenue?.updateWorldMatrix(true,false);
  const key=JSON.stringify([commercialRadius,entries.map(e=>[e.kind,e.footprint.center.toArray(),e.footprint.corners.map(p=>p.toArray())]),perimeter?.map(p=>[p.x,p.y]),avenue?.matrixWorld.elements]);
  if(key===cachedKey)return cached;
  const inventory:DistrictPlan['inventory']=new Map(),support=new Map<string,number>(),sites:Site[]=[];
  const boundary=(perimeter??[]).map(p=>({x:p.x,z:p.y}));
  const palaces=entries.filter(e=>e.kind==='palace').map(e=>e.footprint.corners.map(p=>({x:p.x,z:p.z})));
  for(const {kind,footprint:{center:p}} of entries){
    const item=kinds[kind];if(!item||kind==='palace'||avenue&&item.district==='commercial')continue;
    // Military zoning is the designated sector, rather than scattered guard posts.
    const district=avenue&&item.district==='military'?'residential':item.district;
    if(kind!=='house'&&!sites.some(s=>s.district===district&&Math.hypot(s.x-p.x,s.z-p.z)<1))sites.push({x:p.x,z:p.z,district});
  }
  for(const {kind,footprint:{center:p}} of entries)if(kind==='house'&&!sites.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<55))sites.push({x:p.x,z:p.z,district:'residential'});
  const cells:DistrictPlan['cells']=sites.map(site=>{let polygon=boundary;for(const other of sites){if(other===site)continue;polygon=clip(polygon,2*(other.x-site.x),2*(other.z-site.z),other.x**2+other.z**2-site.x**2-site.z**2);if(!polygon.length)break;}return {site,polygon};});
  if(avenue&&boundary.length){
    const inv=avenue.matrixWorld.clone().invert().elements;
    // The user's upper-right and lower-right slices are bounded by the live
    // avenues, so the plan follows a transformed city without editing its save.
    const xPlane=[inv[0],inv[8],-inv[12]],zPlane=[inv[2],inv[10],-inv[14]];
    const half=(p:XY[],plane:number[],sign=1)=>clip(p,plane[0]*sign,plane[1]*sign,plane[2]*sign);
    for(const cell of cells)cell.polygon=half(cell.polygon,zPlane);
    const right=half(boundary,zPlane,-1);
    for(const [district,sign] of [['noble',-1],['military',1]] as const){
      const polygon=half(right,xPlane,sign);
      const center=polygon.reduce((p,q)=>({x:p.x+q.x/polygon.length,z:p.z+q.z/polygon.length}),{x:0,z:0});
      cells.push({site:{...center,district},polygon});
    }
    // Commercial zoning is a wider central disk; the actual paving stays unchanged.
    const c=avenue.userData.royalAvenueCircle;
    if(c){
      const plaza=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,p=new Vector3(c.x+Math.cos(a)*commercialRadius,0,c.z+Math.sin(a)*commercialRadius).applyMatrix4(avenue.matrixWorld);return {x:p.x,z:p.z};});
      const cut=cells.flatMap(cell=>subtractPolygon(cell.polygon,plaza).map(polygon=>({...cell,polygon})));
      cells.splice(0,cells.length,...cut);
      const p=new Vector3(c.x,0,c.z).applyMatrix4(avenue.matrixWorld);
      cells.push({site:{x:p.x,z:p.z,district:'commercial'},polygon:plaza});
    }
  }
  // The royal district is exactly the real palace footprint, with no halo.
  for(const palace of palaces){
    if(!palace.length)continue;
    const cut=cells.flatMap(cell=>subtractPolygon(cell.polygon,palace).map(polygon=>({...cell,polygon})));
    cells.splice(0,cells.length,...cut);
    const center=palace.reduce((p,q)=>({x:p.x+q.x/palace.length,z:p.z+q.z/palace.length}),{x:0,z:0});
    cells.push({site:{...center,district:'royal'},polygon:palace});
  }
  const valid=cells.filter(c=>polygonArea(c.polygon)>1e-6);
  cells.splice(0,cells.length,...valid);
  const plan={cells,inventory,support};
  for(const {kind,footprint:{center:p}} of entries){
    const item=kinds[kind];
    const district=districtAt(plan,p.x,p.z)?.id;
    const label=item?.label??(kind==='warehouse'?'Armazém':kind==='tollhouse'?'Posto de cobrança':undefined);
    if(!label||!district)continue;
    const counts=inventory.get(district)??new Map<string,number>();counts.set(label,(counts.get(label)??0)+1);inventory.set(district,counts);
  }
  for(const cell of cells)if(!inventory.has(cell.site.district))inventory.set(cell.site.district,new Map());
  cachedKey=key;return cached={cells,inventory,support};
}
export function districtAt(plan:DistrictPlan,x:number,z:number){
  const cell=plan.cells.find(({polygon:p})=>p.length&&p.every((a,i)=>{const b=p[(i+1)%p.length];const cross=(b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);return cross>=-1e-6;}) || p.length&&p.every((a,i)=>{const b=p[(i+1)%p.length];return (b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x)<=1e-6;}));
  return CITY_DISTRICTS.find(d=>d.id===cell?.site.district);
}
export function drawDistricts(ctx:CanvasRenderingContext2D,plan:DistrictPlan,point:(x:number,z:number)=>readonly[number,number]){
  ctx.save();ctx.globalAlpha=.42;
  for(const cell of plan.cells){if(!cell.polygon.length)continue;ctx.beginPath();cell.polygon.forEach((p,i)=>{const xy=point(p.x,p.z);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});ctx.closePath();ctx.fillStyle=CITY_DISTRICTS.find(d=>d.id===cell.site.district)!.color;ctx.fill();}
  ctx.restore();
}
export function drawCommercialBoundary(ctx:CanvasRenderingContext2D,plan:DistrictPlan,point:(x:number,z:number)=>readonly[number,number]){
  ctx.save();ctx.strokeStyle='#f4a33d';ctx.lineWidth=1.6;
  for(const cell of plan.cells){if(cell.site.district!=='commercial'||!cell.polygon.length)continue;
    ctx.beginPath();cell.polygon.forEach((p,i)=>{const xy=point(p.x,p.z);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});ctx.closePath();ctx.stroke();
  }ctx.restore();
}
let legendKey='';
export function updateDistrictLegend(element:HTMLElement,plan:DistrictPlan){
  const key=JSON.stringify([[...plan.inventory].map(([id,m])=>[id,[...m]]),[...plan.support]]);if(key===legendKey&&element.childElementCount)return;legendKey=key;
  element.replaceChildren();
  const title=document.createElement('h3');title.textContent='Distritos e funções';element.append(title);
  for(const district of CITY_DISTRICTS){const counts=plan.inventory.get(district.id);if(!counts)continue;const row=document.createElement('div');row.className='district-legend-row';row.style.setProperty('--district-color',district.color);
    const name=document.createElement('strong');name.textContent=district.name;
    const details=document.createElement('span');details.textContent=[...counts].map(([name,n])=>`${name}${n>1?` ×${n}`:''}`).join(' · ')||'Área planejada, sem construções cadastradas';if(district.id==='commercial')details.textContent+=` · Raio de ${CITY_COMMERCIAL_RADIUS} m`;row.append(name,details);element.append(row);
  }
  const note=document.createElement('p');note.textContent='Setores planejados pelas avenidas. A legenda lista as construções que estão hoje em cada área.';element.append(note);
  if(plan.support.size){const support=document.createElement('p');support.textContent='Apoio junto às muralhas: '+[...plan.support].map(([name,n])=>`${name} ×${n}`).join(' · ');element.append(support);}

}

/** Draw the real transformed avenue, keeping the street visible over zoning. */
export function drawMapAvenues(ctx:CanvasRenderingContext2D,objects:Iterable<Group>,point:(x:number,z:number)=>readonly[number,number]){
  ctx.save();ctx.fillStyle='#b9b09a';ctx.strokeStyle='#d8cfb6';ctx.lineWidth=.7;
  for(const avenue of objects){if(!avenue.parent||!avenue.userData.royalAvenue)continue;avenue.updateWorldMatrix(true,false);
    const world=(x:number,z:number)=>{const p=new Vector3(x,0,z).applyMatrix4(avenue.matrixWorld);return point(p.x,p.z);};
    for(const [x0,z0,x1,z1] of avenue.userData.royalAvenueAreas as number[][]){ctx.beginPath();[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].forEach(([x,z],i)=>{const p=world(x,z);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.fill();}
    const c=avenue.userData.royalAvenueCircle;if(c){ctx.beginPath();for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,p=world(c.x+Math.cos(a)*c.radius,c.z+Math.sin(a)*c.radius);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);}ctx.closePath();ctx.fill();ctx.stroke();}
  }ctx.restore();
}

/** Paint the paved neighborhood streets and authored route center lines. */
export function drawNeighborhoodStreets(ctx:CanvasRenderingContext2D,objects:Iterable<Group>,point:(x:number,z:number)=>readonly[number,number]){
  ctx.save();ctx.fillStyle='#9f967f';ctx.strokeStyle='#d6cbb0';ctx.lineJoin='round';
  for(const street of objects){
    if(!street.parent||street.userData.royalAvenue)continue;
    const polygons=street.userData.walkSurfacePolygons as number[][][]|undefined;
    const route=street.userData.minimapRoute as {points:number[][];width:number;kind:'road'|'path'}|undefined;
    if(!polygons?.length&&!route)continue;
    street.updateWorldMatrix(true,false);
    const world=(x:number,z:number)=>{const p=new Vector3(x,0,z).applyMatrix4(street.matrixWorld);return point(p.x,p.z);};
    for(const polygon of polygons??[]){
      if(polygon.length<3)continue;
      ctx.beginPath();polygon.forEach(([x,z],index)=>{const p=world(x,z);if(index)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.fill();ctx.lineWidth=.65;ctx.stroke();
    }
    if(route){
      const scaleX=street.getWorldScale(new Vector3()).x;
      ctx.beginPath();route.points.forEach(([x,z],index)=>{const p=world(x,z);if(index)ctx.lineTo(...p);else ctx.moveTo(...p);});
      ctx.strokeStyle=route.kind==='path'?'#9a7950':'#b9b09a';ctx.lineWidth=Math.max(1,route.width*Math.abs(scaleX)*.45);ctx.stroke();ctx.strokeStyle='#ded2b7';ctx.lineWidth=.55;ctx.stroke();
    }
  }ctx.restore();
}
