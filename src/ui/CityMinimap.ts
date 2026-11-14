import {cityDistrictPlan,drawDistricts,drawMapAvenues,drawNeighborhoodStreets,drawCommercialBoundary,CITY_DISTRICTS} from './CityDistricts';
import {cityMapFootprint} from './CityMapFootprint';
import { PERIMETER_CATALOG } from '../editor/CityPerimeter';
import type * as T from 'three';
const places:Record<string,{name:string;color:string}>= {
 ...Object.fromEntries(PERIMETER_CATALOG.map(item=>[item.kind,{name:item.label,color:'#d2b98c'}])),
 inn:{name:'Pousada da Selena',color:'#69baff'},tavern:{name:'Taverna',color:'#f5a454'},
 church:{name:'Igreja',color:'#eee8d9'},guild:{name:'Guilda',color:'#c99aff'},
 weapons:{name:'Armas',color:'#ee7777'},potions:{name:'Poções',color:'#82e7ac'},
 warehouse:{name:'Armazém',color:'#d6ac7c'},shop:{name:'Loja',color:'#91d599'},
 market:{name:'Mercado',color:'#f6d765'},fountain:{name:'Fonte',color:'#5ee2ed'},
 palace:{name:'Palácio',color:'#f0bcf2'},
};
type Point=(x:number,z:number)=>readonly[number,number];
/** Paint the actual edited footprints; gaps between them are the real streets. */
export function drawCityMinimap(ctx:CanvasRenderingContext2D,objects:Iterable<T.Group>,polygon:T.Vector2[]|undefined,point:Point,scale:number,local:boolean){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 const live=[...objects];
 ctx.save();
 if(polygon?.length){ctx.beginPath();polygon.forEach((p,i)=>{const xy=point(p.x,p.y);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});ctx.closePath();ctx.fillStyle='#827b65';ctx.fill();ctx.strokeStyle='#b8ae91';ctx.lineWidth=2;ctx.stroke();}
 const plan=cityDistrictPlan(live,polygon);
 drawDistricts(ctx,plan,point);
 drawMapAvenues(ctx,live,point);
 drawNeighborhoodStreets(ctx,live,point);
 const markers:{x:number;y:number;name:string;color:string}[]=[];
 for(const object of live){
  const kind=object.name.replace('Cidade:',''),b=object.userData.building;
  if(!object.parent)continue;
  const footprint=cityMapFootprint(object),[x,y]=point(footprint.center.x,footprint.center.z);
  const corners=footprint.corners.map(p=>point(p.x,p.z));
  if(corners.length){
   const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
   if(Math.max(...xs)<0||Math.min(...xs)>w||Math.max(...ys)<0||Math.min(...ys)>h)continue;
   ctx.beginPath();corners.forEach((p,i)=>{if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();
   ctx.fillStyle=kind==='palace'?'#684183':b?'#483b34':'#b8b2a2';ctx.strokeStyle=kind==='palace'?'#bb77ef':b?'#c4a783':'#343734';ctx.lineWidth=.7;ctx.fill();ctx.stroke();
   if(footprint.door.length&&scale>.4){
    ctx.beginPath();footprint.door.forEach((p,i)=>{const xy=point(p.x,p.z);if(i)ctx.lineTo(...xy);else ctx.moveTo(...xy);});
    ctx.strokeStyle='#e4d7b4';ctx.lineWidth=2;ctx.stroke();
   }
  }
  if(places[kind]&&x>=7&&x<=w-7&&y>=7&&y<=h-7)markers.push({x,y,...places[kind]});
 }
 drawCommercialBoundary(ctx,plan,point);
 ctx.font=`600 ${local?9:11}px sans-serif`;ctx.textBaseline='middle';
 const occupied:{x:number;y:number;w:number;h:number}[]=[];
 if(!local){
  ctx.font='700 10px sans-serif';
  for(const district of CITY_DISTRICTS){
   const cells=plan.cells.filter(c=>c.site.district===district.id&&c.polygon.length);
   const area=(p:{x:number;z:number}[])=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.z-b.x*a.z;},0));
   const cell=cells.sort((a,b)=>area(b.polygon)-area(a.polygon))[0];if(!cell)continue;
   const center=cell.polygon.reduce((p,q)=>({x:p.x+q.x/cell.polygon.length,z:p.z+q.z/cell.polygon.length}),{x:0,z:0});
   const [x,y]=point(center.x,center.z),tw=ctx.measureText(district.short).width+12,th=18;
   const box={x:Math.max(2,Math.min(w-tw-2,x-tw/2)),y:Math.max(2,Math.min(h-th-2,y-th/2)),w:tw,h:th};
   if(occupied.some(b=>box.x<b.x+b.w+2&&box.x+box.w+2>b.x&&box.y<b.y+b.h+2&&box.y+box.h+2>b.y))continue;
   occupied.push(box);ctx.fillStyle='#141a18ee';ctx.fillRect(box.x,box.y,tw,th);ctx.strokeStyle=district.color;ctx.lineWidth=1;ctx.strokeRect(box.x,box.y,tw,th);ctx.fillStyle=district.color;ctx.fillText(district.short,box.x+6,box.y+th/2);
  }
  ctx.font='600 11px sans-serif';
 }
 for(const m of markers){
  ctx.fillStyle=m.color;ctx.strokeStyle='#171a20';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(m.x,m.y,local?3.5:4.5,0,Math.PI*2);ctx.fill();ctx.stroke();
  const tw=ctx.measureText(m.name).width+7,th=local?13:16;
  const offsets=[[7,-th/2],[-tw-7,-th/2],[-tw/2,-th-7],[-tw/2,7],[7,10],[-tw-7,10],[7,-th-12],[-tw-7,-th-12]];
  let label:{x:number;y:number;w:number;h:number}|undefined;
  for(const [dx,dy] of offsets){const box={x:Math.max(2,Math.min(w-tw-2,m.x+dx)),y:Math.max(2,Math.min(h-th-2,m.y+dy)),w:tw,h:th};if(!occupied.some(b=>box.x<b.x+b.w+2&&box.x+box.w+2>b.x&&box.y<b.y+b.h+2&&box.y+box.h+2>b.y)){label=box;break;}}
  if(!label)continue;
  occupied.push(label);ctx.strokeStyle=m.color;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(label.x+label.w/2,label.y+label.h/2);ctx.stroke();
  ctx.fillStyle='#16201de8';ctx.fillRect(label.x,label.y,label.w,label.h);ctx.fillStyle=m.color;ctx.fillText(m.name,label.x+3.5,label.y+label.h/2);
 }
 ctx.restore();
}
